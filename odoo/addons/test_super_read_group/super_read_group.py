# -*- coding: utf-8 -*-

from odoo import _, api, fields, models
from odoo.osv.expression import AND, OR, expression, normalize_domain
from odoo.tools import lazy, OrderedSet
from odoo.exceptions import UserError

import datetime
import operator
import babel.dates

import logging
import pytz
import re
from collections import defaultdict, OrderedDict
from odoo.tools.misc import CountingStream, clean_context, DEFAULT_SERVER_DATETIME_FORMAT, DEFAULT_SERVER_DATE_FORMAT

import dateutil.relativedelta

regex_measure = re.compile(r'(\w+):(\w+)')
regex_groupby = re.compile(r'(\w+)(?::(\w+))?')


# valid SQL aggregation functions
VALID_AGGREGATE_FUNCTIONS = {
    'array_agg', 'count', 'count_distinct',
    'bool_and', 'bool_or', 'max', 'min', 'avg', 'sum',
}


def check_param_type(param_name, param, expected_type):
    assert isinstance(param, expected_type), "'%r' type should be %r: actual type %r" % (param_name, expected_type, type(param))


def get_field(model, field_name, spec):
    assert field_name in model._fields, "Unknown field %r in spec %r" % (field_name, spec)
    field = model._fields[field_name].base_field
    assert field.store and field.column_type, "Fields in specs must be regular database-persisted fields (no function or related fields), or function fields with store=True"
    return field


def decode_spec(spec, regex):
    match = regex.match(spec)
    assert match, "%r should match %r" % (str(regex), spec)
    return match.groups()


class lazymapping(defaultdict):
    def __missing__(self, key): 
        value = self.default_factory(key)
        self[key] = value
        return value

def join(list):
    return ", ".join(list)

def lazy_name_get(self):
    """ Evaluate self.name_get() lazily. """
    names = lazy(lambda: dict(self.name_get()))
    return [(rid, lazy(operator.getitem, names, rid)) for rid in self.ids]

def process_date(date):
    if isinstance(date, str):
        return datetime.datetime.strptime(date, DEFAULT_SERVER_DATE_FORMAT)
    return date

def process_datetime(date, tz_convert, context):
    if isinstance(date, str):
        date = datetime.datetime.strptime(date, DEFAULT_SERVER_DATETIME_FORMAT)
    if tz_convert:
        date = pytz.timezone(context['tz']).localize(date)
    return date

def date_interval(field_name, date, delta):
    range_start, range_end = interval_bounds(date, delta, False)
    return interval(field_name, range_start, range_end, DEFAULT_SERVER_DATE_FORMAT)

def datetime_interval(field_name, date, delta, tz_convert):
    range_start, range_end = interval_bounds(date, delta, tz_convert)
    return interval(field_name, range_start, range_end, DEFAULT_SERVER_DATETIME_FORMAT)

def interval_bounds(date, delta, tz_convert):
    range_start = date
    range_end = date + delta

    if tz_convert:
        range_start = range_start.astimezone(pytz.utc)
        range_end = range_end.astimezone(pytz.utc) 
    
    return range_start, range_end

def interval(field_name, range_start, range_end, FORMAT):
    range_start = range_start.strftime(FORMAT)
    range_end = range_end.strftime(FORMAT)
    return [
        '&',
        (field_name, '>=', range_start),
        (field_name, '<', range_end),
    ]

def identity(value):
    return value

DISPLAY_FORMATS = {
    # Careful with week/year formats:
    #  - yyyy (lower) must always be used, *except* for week+year formats
    #  - YYYY (upper) must always be used for week+year format
    #         e.g. 2006-01-01 is W52 2005 in some locales (de_DE),
    #                         and W1 2006 for others
    #
    # Mixing both formats, e.g. 'MMM YYYY' would yield wrong results,
    # such as 2006-01-01 being formatted as "January 2005" in some locales.
    # Cfr: http://babel.pocoo.org/en/latest/dates.html#date-fields
    'hour': 'hh:00 dd MMM',
    'day': 'dd MMM yyyy', # yyyy = normal year
    'week': "'W'w YYYY",  # w YYYY = ISO week-year
    'month': 'MMMM yyyy',
    'quarter': 'QQQ yyyy',
    'year': 'yyyy',
}

TIME_INTERVALS = {
    'hour': dateutil.relativedelta.relativedelta(hours=1),
    'day': dateutil.relativedelta.relativedelta(days=1),
    'week': datetime.timedelta(days=7),
    'month': dateutil.relativedelta.relativedelta(months=1),
    'quarter': dateutil.relativedelta.relativedelta(months=3),
    'year': dateutil.relativedelta.relativedelta(years=1)
}


class Base(models.AbstractModel):
    _inherit = 'base'

    @api.model
    def _get_annotated_groupby(self, groupby_spec, query):
        """ A groupby_spec defines a function from the model to some other set
            This defines by taking kernel pair an equivalence relation on the model
            and that equivalence defines a quotient of the model.
            The annotated groupby associated with a groupby spec is a way to specify
            how to fetch the quotient elements, present them, and manipulate them

            An annotated groupby must have the following attributes:

                - field_name -> should desappear (possible if one remove special case for get_label of many2one)
                - type -> should desappear
                (Used mainly in query)
                - expr
                - alias
                (Used to process query results)
                - process_value
                - get_label
                - get_domain

            Note that a list of groupby_specs [gs_i] determines a list [R_i] of equivalence relation, and
            finally a single equivalence relation which is the intersection of the R_i.
            For now the only equivalence relations manipulated by super_read_group are of that form.
        """

        check_param_type('groupby_spec', groupby_spec, str)
        field_name, interval = decode_spec(groupby_spec, regex_groupby)
        
        # it is possible to check several times same field here (if groupby specs on same date field but with different intervals)
        field = get_field(self, field_name, groupby_spec)
        field_type = field.type

        if interval:
            assert interval in ('day', 'week', 'month', 'quarter', 'year'), "Unknown interval %r provided in spec %r" % (interval, groupby_spec)
            assert field_type in ('date', 'datetime'), "The interval %r is provided while the field %r is not of type date or datetime" % (interval, field_name)

        annotated_groupby = {
            'field_name': field_name,
            'alias': groupby_spec,
            'type': field_type,
        }

        # expr is what should be used in SELECT TERM
        # note that query can be modified (by an additional join in case field is inherited)
        expr = self._inherits_join_calc(self._table, field_name, query)

        if field_type in ('date', 'datetime'):
            tz_convert = field_type == 'datetime' and self._context.get('tz') in pytz.all_timezones
            
            # make sure one group by month with respect to timezone meaning
            if tz_convert:
                expr = "timezone('%s', timezone('UTC',%s))" % (self._context.get('tz', 'UTC'), expr)
            expr = "date_trunc('%s', %s::timestamp)" % (interval or 'month', expr)
        
            display_format = DISPLAY_FORMATS[interval or 'month']
            delta = TIME_INTERVALS[interval or 'month']
            locale = self._context.get('lang') or 'en_US'

            if field_type == 'date':
                annotated_groupby['process_value'] = process_date
                annotated_groupby['get_domain'] = lambda date: date_interval(field_name, date, delta)
                annotated_groupby['get_label'] = lambda date: babel.dates.format_date(date, format=display_format, locale=locale)
            else:
                annotated_groupby['process_value'] = lambda datetime: process_datetime(datetime, tz_convert, self._context)
                annotated_groupby['get_domain'] = lambda datetime: datetime_interval(field_name, datetime, delta, tz_convert)
                annotated_groupby['get_label'] = lambda datetime: babel.dates.format_datetime(datetime, format=display_format, tzinfo=datetime.tzinfo if tz_convert else None, locale=locale)
        else:
            annotated_groupby['process_value'] = identity
            annotated_groupby['get_domain'] = lambda value: [(field_name, '=', value)]
            if field_type != 'many2one':
                # many2ones get_label functions are defined later on
                annotated_groupby['get_label'] = identity
            if field_type == 'boolean':
                expr = "coalesce(%s,false)" % expr
        
        annotated_groupby['expr'] = expr

        return annotated_groupby

    @api.model
    def super_read_group(self, domain, groups, measure_specs, grouping_sets, orderby=False, limit=None, offset=0):

        # --------------------------------------------
        # CHECK grouping_sets and measure_specs TYPES
        #
        # Set groupby_specs_union
        # --------------------------------------------

        check_param_type('grouping_sets', grouping_sets, list)
        assert len(grouping_sets) > 0, "there should be at least one grouping set"

        check_param_type('measure_specs', measure_specs, list)

        def groupby_spec_union(grouping_sets):
            groupby_spec_union = set([])
            for groupby_specs in grouping_sets:
                groupby_spec_union = groupby_spec_union | set(groupby_specs)
            return groupby_spec_union

        groupby_specs_union = groupby_spec_union(grouping_sets)

        # ---------------------------
        # CHECK READ ACCESS TO MODEL
        # ---------------------------

        self.check_access_rights('read')

        # ----------------------------------------------------------------------
        # BEGINNING OF QUERY CONSTRUCTION
        #
        # Set global_domain
        # Set query
        #
        # The domains in param 'domain' and in param 'groups' are parsed here.
        # Expressions to represent them in the WHERE clause are computed here
        # ----------------------------------------------------------------------

        assert len(groups) > 0, "There should be at least one group"

        def _compute_global_domain(domain, groups):
            # groups are defined via domains for now
            group_domain_normalized = [normalize_domain(group) for group in groups]
            domain_normalized = normalize_domain(domain)
            return AND([domain_normalized, OR(group_domain_normalized)])

        global_domain = _compute_global_domain(domain, groups)

        if (global_domain[0] == (0, '=', 1)):
            return []

        query = self._where_calc(global_domain)

        # --------------------------------------------------------------------------
        # CREATE DICT TO MANIPULATE GROUPBY SPECS
        #
        # Set annotated_groupbys
        #
        # Check groupby specs qualities
        #
        # The key 'expr' of an annotated_groupby contains
        # the PostgreSQL expression of the function represented
        # by the corresponding groupby_spec
        #
        # Modify query by adding suitable joins (in case inherited fields are used)
        # --------------------------------------------------------------------------

        def __get_annotated_groupbys(groupby_specs):
            return {
                groupby_spec: self._get_annotated_groupby(groupby_spec, query)
                for groupby_spec in groupby_specs
            }

        annotated_groupbys = __get_annotated_groupbys(groupby_specs_union)

        # -----------------------------------------------------------------
        # APPLY IR RULES
        #
        # modify WHERE CLAUSE by adding limitations proper to user?
        # -----------------------------------------------------------------

        self._apply_ir_rules(query, 'read')

        # -------------------------------------------------------------------------------
        # CREATE PARTIAL TERMS TO CREATE AND MANAGE AN AUXILIARY TABLE for grouping_sets
        #
        # The table is used to indicate the grouping set
        # corresponding to each row
        # -------------------------------------------------------------------------------

        stringified_indexes = [str(i) for i in range(0, len(grouping_sets))]
        grouping_set_indexes = ", ".join(stringified_indexes)
        groupby_spec_index_alias_list = ["grouping_set_" + s for s in stringified_indexes]
        grouping_set_index_aliases =  ", ".join(groupby_spec_index_alias_list)

        # ----------------------------------------------------
        # CREATE GROUPING SETS TERM FOR grouping_sets
        # ----------------------------------------------------

        def spec_terms(index, groupby_specs):
            return '(' + join(groupby_spec_index_alias_list[index: index+1] + [
                annotated_groupbys[groupby_spec]['expr'] for groupby_spec in groupby_specs
            ]) + ')'

        term_tuples = join([
            spec_terms(index, groupby_specs)
            for (index, groupby_specs) in enumerate(grouping_sets)
        ])

        grouping_set_term = 'GROUPING SETS (' + term_tuples + ')'


        # -------------------------------------------------------------------------------
        # CREATE PARTIAL TERMS TO CREATE AND MANAGE AN AUXILIARY TABLE FOR groups
        #
        # The table is used to indicate the group
        # corresponding to each row
        # -------------------------------------------------------------------------------

        stringified_indexes = [str(i) for i in range(0, len(groups))]
        group_indexes = join(stringified_indexes)
        group_index_alias_list = ["group_" + s for s in stringified_indexes]
        group_index_aliases =  join(group_index_alias_list)

        # ----------------------------------------------------
        # CREATE GROUPING SETS TERM FOR groups
        # 
        # Set predicate_exprs
        # Set predicates_params
        # Set group_grouping_set_term
        # ----------------------------------------------------

        predicate_exprs = []
        predicates_params = []
        for group in groups:
            # already computed in _where_calc I think
            expr = expression(group, self)
            predicate_expr, predicate_params = expr.to_sql()
            predicate_exprs.append(predicate_expr)
            predicates_params = predicates_params + predicate_params

        term_tuples = join([
            '(' + group_index_alias_list[index] + ', ' + predicate_expr + ')'
            for index, predicate_expr in enumerate(predicate_exprs)
        ])

        group_grouping_set_term = 'GROUPING SETS (' + term_tuples + ')'

        # -----------------------------------------------------------------------
        # CREATE HAVING TERM FOR groups
        #
        # Set having_terms
        # Set having_term
        # That term is used to avoid the constitute classes of records
        # based on records that are in domains of the form global_domain - group
        # for group in groups
        # -----------------------------------------------------------------------

        having_terms = [
            '(' + group_index_alias_list[index] + ' = ' + str(index) + ' AND ' + predicate_expr + '' + ')'
            for index, predicate_expr in enumerate(predicate_exprs)
        ]

        having_term = " OR ".join(having_terms)

        # ----------------------------------------------
        # CREATE SELECT TERMS
        #
        # Set select_terms
        # Add terms corresponding to groupby specs in 
        # ----------------------------------------------

        select_terms = []
        for groupby_spec, annotated_groupby in annotated_groupbys.items():
            select_terms.append('%s as "%s" ' % (annotated_groupby['expr'], annotated_groupby['alias']))

        # ------------------------------------------------------------------------------
        # CHECK measure_specs
        #
        # Add corresponding terms to select_terms
        # 
        # Modify query by adding suitable joins (in case inherited fields are used)
        # 
        # Set measure_specs_uniq
        # ------------------------------------------------------------------------------

        measure_specs_uniq = list(set(measure_specs))

        assert len(measure_specs_uniq) == len(measure_specs), "Duplicates found in measure_specs: %r" % measure_specs

        for measure_spec in measure_specs_uniq:
            field_name, aggregate_function = decode_spec(measure_spec, regex_measure)
            # used only to check that the field is aggregable. Value returned not useful
            get_field(self, field_name, measure_spec)

            assert aggregate_function in VALID_AGGREGATE_FUNCTIONS, "Invalid aggregation function %r." % aggregate_function

            expr = self._inherits_join_calc(self._table, field_name, query)

            if aggregate_function.lower() == 'count_distinct':
                term = 'COUNT(DISTINCT %s) AS "%s"' % (expr, measure_spec)
            else:
                term = '%s(%s) AS "%s"' % (aggregate_function, expr, measure_spec)
            select_terms.append(term)

        # ------------------------------------------------------------------
        # GET FROM, WHERE CLAUSES
        #
        # Set from_clause, where_clause, where_clause_params, query_params
        # ------------------------------------------------------------------

        from_clause, where_clause, where_clause_params = query.get_sql()

        # doubling is done because for each group, the corresponding
        # predicate expression appears twice, once in the GROUP BY term
        # and once in the HAVING term
        query_params = where_clause_params + predicates_params * 2

        # -------------------------------------------------------
        # CREATE QUERY STRING
        #
        # Set query
        # -------------------------------------------------------

        def prefix_terms(prefix, terms):
            return (prefix + " " + ", ".join(terms)) if terms else ''

        def prefix_term(prefix, term):
            return ('%s %s' % (prefix, term)) if term else ''

        query = """
            SELECT COALESCE(%(group_index_aliases)s) AS group_index,
                    COALESCE(%(grouping_set_index_aliases)s) AS grouping_set_index,
                    min("%(table)s".id) AS id,
                    COALESCE(COUNT("%(table)s".id), 0) AS "%(count_field)s" %(extra_fields)s
            FROM %(from)s,
                    (VALUES(%(grouping_set_indexes)s)) AS G(%(grouping_set_index_aliases)s),
                    (VALUES(%(group_indexes)s)) AS O(%(group_index_aliases)s)
            %(where)s
            %(groupby)s
            %(having)s
            %(limit)s
            %(offset)s
        """ % {
            'table': self._table,
            'count_field': 'count',
            'extra_fields': prefix_terms(',', select_terms),
            'from': from_clause,
            'where': prefix_term('WHERE', where_clause),
            'groupby': prefix_terms('GROUP BY', [group_grouping_set_term, grouping_set_term]),
            'having': prefix_term('HAVING', having_term),
            'grouping_set_indexes': grouping_set_indexes,
            'grouping_set_index_aliases': grouping_set_index_aliases,
            'group_indexes': group_indexes,
            'group_index_aliases': group_index_aliases,
            # not yet! but not sure it will work anyway with grouping sets
            # 'orderby': prefix_terms('ORDER BY', orderby_terms),
            'limit': prefix_term('LIMIT', int(limit) if limit else None),
            'offset': prefix_term('OFFSET', int(offset) if limit else None),
        }

        # -------------------------------------------------------
        # EXECUTE QUERY
        #
        # Set fetched_data
        # -------------------------------------------------------

        self._cr.execute(query, query_params)
        fetched_data = self._cr.dictfetchall()

        # --------------------------------------------------------------------------------
        # SET get_label attribute FOR ANNOTATED GROUPBYS WITH ATTRIBUTE type 'many2one'
        # --------------------------------------------------------------------------------

        def add_many2ones_get_label_function(annotated_groupbys, fetched_data):
            many2one_field_names = [
                annotated_groupby['field_name'] 
                for groupby_spec, annotated_groupby in annotated_groupbys.items() 
                if annotated_groupby['type'] == 'many2one'
            ]

            comodel_record_ids = defaultdict(set)
            comodels = defaultdict()

            for data_point in fetched_data:
                for field_name in many2one_field_names:
                    if data_point[field_name]: 
                        comodel_name = self._fields[field_name].comodel_name
                        comodels[field_name] = comodel_name
                        comodel_record_ids[comodel_name].add(data_point[field_name])

            comodel_records = {
                comodel_name: self.env[comodel_name].browse(comodel_record_ids)
                for comodel_name, comodel_record_ids in comodel_record_ids.items()
            }

            comodel_record_labels = {}
            for comodel_name, records in comodel_records.items():
                comodel_record_labels[comodel_name] = dict(lazy_name_get(records.sudo()))

            for groupby_spec, annotated_groupby in annotated_groupbys.items():
                if annotated_groupby['type'] == 'many2one':
                    labels = comodel_record_labels[comodels[annotated_groupby['field_name']]]
                    annotated_groupby['get_label'] = lambda id: labels[id]

        if fetched_data:
            add_many2ones_get_label_function(annotated_groupbys, fetched_data)
            
        # ------------------------------------------------------------------------------------------
        # PROCESS AND SPLIT FETCHED DATA IN PARTS CORRESPONDING TO VARIOUS GROUPS AND GROUPING SETS
        # 
        # Set result
        # ------------------------------------------------------------------------------------------

        result = lazymapping(lambda group_index: {
            'group_index': group_index,
            'group': groups[group_index],
            'group_partitions': lazymapping(lambda grouping_set_index: {
                'grouping_set_index':grouping_set_index,
                'grouping_set': grouping_sets[grouping_set_index],
                'partition': []
            }),
        })

        # we want to have structure even if no data point is available
        # we could remove use of lazymapping above
        for group_index in range(0, len(groups)):
            for grouping_set_index in range(0, len(grouping_sets)):
                result[group_index]['group_partitions'][grouping_set_index]



        for data_point in fetched_data:
            group_index = data_point['group_index']
            grouping_set_index = data_point['grouping_set_index']
            partition = result[group_index]['group_partitions'][grouping_set_index]['partition']
            measures = {
                measure_spec: data_point[measure_spec] 
                for measure_spec in measure_specs
            }
            values = self._process_values(
                {
                    groupby_spec: data_point[groupby_spec]
                    for groupby_spec in grouping_sets[grouping_set_index]
                },
                annotated_groupbys
            )
            data_point_class = {
                'count': data_point['count'],
                'measures': measures,
                'values': values,
                'labels': self._get_labels(values, annotated_groupbys),
                'domain': self._get_domain(values, annotated_groupbys)
            }
            partition.append(data_point_class)

        # -------------------------------------------------------
        # RETURN result
        # -------------------------------------------------------
       
        return result


    @api.model
    def _get_domain(self, values, annotated_groupbys):
        return AND([
            [(annotated_groupbys[groupby_spec]['field_name'], '=', False)] if value is False else annotated_groupbys[groupby_spec]['get_domain'](value)
            for groupby_spec, value in values.items()
        ])

    @api.model
    def _get_labels(self, values, annotated_groupbys):
        return {
            groupby_spec: False if value is False else annotated_groupbys[groupby_spec]['get_label'](value)
            for groupby_spec, value in values.items()
        }

    @api.model
    def _process_values(self, values, annotated_groupbys):
        return {
            groupby_spec: False if value is None else annotated_groupbys[groupby_spec]['process_value'](value)
            for groupby_spec, value in values.items()
        }
