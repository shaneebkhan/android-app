# -*- coding: utf-8 -*-
"""Test for fill temporal."""
import datetime
import json

from odoo.tests import common, tagged


@tagged('super_read_group')
class TestSuperReadGroup(common.TransactionCase):
    """Test for super_read_group function.

    This feature is mainly used in graph view. For more informations, read the
    documentation of models's '_read_group_fill_temporal' method.
    """

    def setUp(self):
        super(TestSuperReadGroup, self).setUp()
        self.Model = self.env['test_super_read_group.super_model']

    def test_super_read_group_with_no_grouping_set(self):
        """ we should have an error (assert len(grouping_sets) > 0 fails)
        """
        domain = []
        groups = [[]]
        measure_specs = []
        grouping_sets = []

        with self.assertRaises(Exception):
            self.Model.super_read_group(
                domain = domain,
                groups= groups,
                measure_specs=measure_specs,
                grouping_sets=grouping_sets,
            )
    def test_super_read_group_with_no_group(self):
        """ we should have an error (assert len(groups) > 0 fails)
        """
        domain = []
        groups = []
        measure_specs = []
        grouping_sets = [[]]

        with self.assertRaises(Exception):
            self.Model.super_read_group(
                domain = domain,
                groups= groups,
                measure_specs=measure_specs,
                grouping_sets=grouping_sets,
            )


    def test_super_read_group_with_invalid_measure_specs(self):
        """ we should have assertion errors
        """
        domain = []
        groups = [[]]
        measure_specs = ['not_a_field_name']
        grouping_sets = [[]]

        with self.assertRaises(Exception):
            self.Model.super_read_group(
                domain = domain,
                groups= groups,
                measure_specs=measure_specs,
                grouping_sets=grouping_sets,
            )

        domain = []
        groups = [[]]
        measure_specs = ['other_id:invalid_aggregate_function']
        grouping_sets = [[]]

        with self.assertRaises(Exception):
            self.Model.super_read_group(
                domain = domain,
                groups= groups,
                measure_specs=measure_specs,
                grouping_sets=grouping_sets,
            )

        domain = []
        groups = [[]]
        measure_specs = ['value:min', 'value:min']
        grouping_sets = [[]]

        with self.assertRaises(Exception):
            self.Model.super_read_group(
                domain = domain,
                groups= groups,
                measure_specs=measure_specs,
                grouping_sets=grouping_sets,
            )

    def test_super_read_group_single_group_single_grouping_set_empty_model(self):
        """ we should have a structure with no partition at all
        """
        domain = []
        groups = [[]]
        measure_specs = []
        grouping_sets = [['other_id']]

        result = self.Model.super_read_group(
            domain = domain,
            groups= groups,
            measure_specs=measure_specs,
            grouping_sets=grouping_sets,
        )   
        expected = {
            0: {
                'group_index': 0,
                'group': [],
                'group_partitions': {
                    0: {
                        'grouping_set_index':0,
                        'grouping_set': ['other_id'],
                        'partition': []
                    }
                }
            }
        }
        self.assertEqual(result, expected)

        domain = []
        groups = [[('date', '=', '1916-08-18')]]
        measure_specs = []
        grouping_sets = [[]]

        result = self.Model.super_read_group(
            domain = domain,
            groups= groups,
            measure_specs=measure_specs,
            grouping_sets=grouping_sets,
        )   

        expected = {
            0: {
                'group_index': 0,
                'group': [('date', '=', '1916-08-18')],
                'group_partitions': {
                    0: {
                        'grouping_set_index':0,
                        'grouping_set': [],
                        'partition': []
                    }
                }
            }
        }
        self.assertEqual(result, expected)

    def test_super_read_group_valid_measure_spec_empty_domain(self):
        domain = []
        groups = [[]]
        measure_specs = ['other_id:count_distinct', 'value:min']
        grouping_sets = [[]]

        result = self.Model.super_read_group(
            domain = domain,
            groups= groups,
            measure_specs=measure_specs,
            grouping_sets=grouping_sets,
        )   

        expected = {
            0: {
                'group_index': 0,
                'group': [],
                'group_partitions': {
                    0: {
                        'grouping_set_index':0,
                        'grouping_set': [],
                        'partition': []
                    }
                }
            }
        }
        self.assertEqual(result, expected)


    def test_super_read_group_with_single_grouping_set_non_empty_model(self):

        self.Model.create({'date': '1916-08-18', 'value': 2, 'super_record': True, 'stage': 'confirmed', 'name': 'A'})
        self.Model.create({'date': '1916-08-17', 'value': 4, 'super_record': True, 'stage': 'confirmed', 'name': 'B'})
        self.Model.create({'date': '1916-08-16', 'value': -1, 'super_record': False, 'stage': 'draft', 'name': 'E'})
        self.Model.create({'date': '1916-10-19', 'value': 3, 'super_record': False, 'stage': 'canceled', 'name': 'D'})
        self.Model.create({'date': '1916-12-19', 'value': 5, 'super_record': True, 'stage': 'draft', 'name': 'D'})
        records = self.Model.search([])
        record_ids = records.ids
        id_1 = record_ids[0]
        id_2 = record_ids[1]
        records[0].write({'other_id': id_1})
        records[1].write({'other_id': id_2})

        domain = []
        groups = [[]]
        measure_specs = []
        grouping_sets = [['other_id']]
        result = self.Model.super_read_group(
            domain = domain,
            groups= groups,
            measure_specs=measure_specs,
            grouping_sets=grouping_sets,
        )
        partition = result[0]['group_partitions'][0]['partition']
        partition.sort(key = lambda equivalence_class: equivalence_class['labels']['other_id'] or 'False')
        expected_partition = [
            {
                'count': 1,
                'measures': {},
                'domain': [('other_id', '=', id_1)],
                'labels': {'other_id': 'A'},
                'values': {'other_id': id_1}
            },
            {
                'count': 1,
                'measures': {},
                'domain': [('other_id', '=', id_2)],
                'labels': {'other_id': 'B'},
                'values': {'other_id': id_2}
            },
            {
                'count': 3,
                'measures': {},
                'domain': [('other_id', '=', False)],
                'labels': {'other_id': False},
                'values': {'other_id': False}
            }
        ]
        self.assertEqual(partition, expected_partition)

        domain = []
        groups = [[],[]]
        measure_specs = []
        grouping_sets = [['date']]
        result = self.Model.super_read_group(
            domain = domain,
            groups= groups,
            measure_specs=measure_specs,
            grouping_sets=grouping_sets,
        )
        partition = result[0]['group_partitions'][0]['partition']
        partition.sort(key = lambda equivalence_class: equivalence_class['labels']['date'] or 'False')
        expected_partition = [
            {
                'domain': ['&', ('date', '>=', '1916-08-01'), ('date', '<', '1916-09-01')],
                'values': {'date': datetime.datetime(1916, 8, 1, 0, 0)},
                'measures': {},
                'labels': {'date': 'August 1916'},
                'count': 3
            },
            {
                'domain': ['&', ('date', '>=', '1916-12-01'), ('date', '<', '1917-01-01')],
                'values': {'date': datetime.datetime(1916, 12, 1, 0, 0)},
                'measures': {},
                'labels': {'date': 'December 1916'},
                'count': 1
            },
            {
                'domain': ['&', ('date', '>=', '1916-10-01'), ('date', '<', '1916-11-01')],
                'values': {'date': datetime.datetime(1916, 10, 1, 0, 0)},
                'measures': {},
                'labels': {'date': 'October 1916'},
                'count': 1
            }
        ]
        self.assertEqual(partition, expected_partition)

        domain = []
        groups = [[]]
        measure_specs = []
        grouping_sets = [['stage']]
        result = self.Model.super_read_group(
            domain = domain,
            groups= groups,
            measure_specs=measure_specs,
            grouping_sets=grouping_sets,
        )
        partition = result[0]['group_partitions'][0]['partition']
        partition.sort(key = lambda equivalence_class: equivalence_class['labels']['stage'] or 'False')
        expected_partition = [
            {
                'domain': [('stage', '=', 'canceled')],
                'values': {'stage': 'canceled'},
                'measures': {},
                'labels': {'stage': 'Canceled'},
                'count': 1
            },
            {
                'domain': [('stage', '=', 'confirmed')],
                'values': {'stage': 'confirmed'},
                'measures': {},
                'labels': {'stage': 'Confirmed'},
                'count': 2
            },
            {
                'domain': [('stage', '=', 'draft')],
                'values': {'stage': 'draft'},
                'measures': {},
                'labels': {'stage': 'Draft'},
                'count': 2
            }
        ]
        self.assertEqual(partition, expected_partition)

    def test_super_read_group_with_multiple_groups_non_empty_model(self):

        self.Model.create({'date': '1916-08-18', 'value': 2, 'super_record': True, 'stage': 'confirmed', 'name': 'A'})
        self.Model.create({'date': '1916-08-17', 'value': 4, 'super_record': True, 'stage': 'confirmed', 'name': 'B'})
        self.Model.create({'date': '1916-08-16', 'value': -1, 'super_record': False, 'stage': 'draft', 'name': 'E'})
        self.Model.create({'date': '1916-10-19', 'value': 3, 'super_record': False, 'stage': 'canceled', 'name': 'D'})
        self.Model.create({'date': '1916-12-19', 'value': 5, 'super_record': True, 'stage': 'draft', 'name': 'D'})

        records = self.Model.search([])
        record_ids = records.ids
        id_1 = record_ids[0]
        id_2 = record_ids[1]

        records[0].write({'other_id': id_1})
        records[1].write({'other_id': id_2})


        domain = []
        groups = [[], [('super_record', '=', True)]]
        measure_specs = ['value:min', 'other_id:array_agg']
        grouping_sets = [['other_id', 'stage']]

        result = self.Model.super_read_group(
            domain = domain,
            groups= groups,
            measure_specs=measure_specs,
            grouping_sets=grouping_sets,
        )

        partition1 = result[0]['group_partitions'][0]['partition']
        json.dumps(partition1)
        partition1.sort(key = lambda equivalence_class: equivalence_class['measures']['value:min'] or 0)
        for equivalence_class in partition1:
            equivalence_class['domain'].sort(key = lambda term: json.dumps(term))


        partition2 = result[1]['group_partitions'][0]['partition'] 
        partition2.sort(key = lambda equivalence_class: equivalence_class['labels']['other_id'] or 'False')
        for equivalence_class in partition2:
            equivalence_class['domain'].sort(key = lambda term: json.dumps(term))

        expected_partition1 = [
            {
                'values': {'stage': 'draft', 'other_id': False},
                'labels': {'stage': 'Draft', 'other_id': False},
                'count': 2,
                'measures': {'value:min': -1, 'other_id:array_agg': [None, None]},
                'domain': ['&', ('other_id', '=', False), ('stage', '=', 'draft')]
            },
            {
                'values': {'stage': 'confirmed', 'other_id': id_1},
                'labels': {'stage': 'Confirmed', 'other_id': 'A'},
                'count': 1,
                'measures': {'value:min': 2, 'other_id:array_agg': [id_1]},
                'domain': ['&', ('other_id', '=', id_1), ('stage', '=', 'confirmed')]
            },
            {
                'values': {'stage': 'canceled', 'other_id': False},
                'labels': {'stage': 'Canceled', 'other_id': False},
                'count': 1, 
                'measures': {'value:min': 3, 'other_id:array_agg': [None]},
                'domain': ['&', ('other_id', '=', False), ('stage', '=', 'canceled')]
            },
            {
                'values': {'stage': 'confirmed', 'other_id': id_2},
                'labels': {'stage': 'Confirmed', 'other_id': 'B'}, 
                'count': 1, 
                'measures': {'value:min': 4, 'other_id:array_agg': [id_2]},
                'domain': ['&', ('other_id', '=', id_2), ('stage', '=', 'confirmed')]
            },
        ]
        expected_partition2 = [
            {
                'measures': {'other_id:array_agg': [id_1], 'value:min': 2},
                'labels': {'other_id': 'A', 'stage': 'Confirmed'},
                'domain': ['&', ('other_id', '=', id_1), ('stage', '=', 'confirmed')],
                'values': {'other_id': id_1, 'stage': 'confirmed'},
                'count': 1
            }, 
            {
                'measures': {'other_id:array_agg': [id_2], 'value:min': 4},
                'labels': {'other_id': 'B', 'stage': 'Confirmed'},
                'domain': ['&', ('other_id', '=', id_2), ('stage', '=', 'confirmed')],
                'values': {'other_id': id_2, 'stage': 'confirmed'},
                'count': 1
            },
            {
                'measures': {'other_id:array_agg': [None], 'value:min': 5},
                'labels': {'other_id': False, 'stage': 'Draft'},
                'domain': ['&', ('other_id', '=', False), ('stage', '=', 'draft')],
                'values': {'other_id': False, 'stage': 'draft'},
                'count': 1
            },
        ]



        expected = {
            0: {
                'group_index': 0,
                'group': [],
                'group_partitions': {
                    0: {
                        'grouping_set_index':0,
                        'grouping_set': ['other_id', 'stage'],
                        'partition': expected_partition1
                    }
                }
            },
            1: {
                'group_index': 1,
                'group': [('super_record', '=', True)],
                'group_partitions': {
                    0: {
                        'grouping_set_index':0,
                        'grouping_set': ['other_id', 'stage'],
                        'partition': expected_partition2
                    }
                }
            },
        }
    
        self.assertEqual(partition1, expected_partition1)
        self.assertEqual(partition2, expected_partition2)
        self.assertEqual(result, expected)

    def test_super_read_group_with_multiple_grouping_sets_non_empty_model(self):

        self.Model.create({'date': '1916-08-18', 'value': 2, 'super_record': True, 'stage': 'confirmed', 'name': 'A'})
        self.Model.create({'date': '1916-08-17', 'value': 4, 'super_record': True, 'stage': 'confirmed', 'name': 'B'})
        self.Model.create({'date': '1916-08-16', 'value': -1, 'super_record': False, 'stage': 'draft', 'name': 'E'})
        self.Model.create({'date': '1916-10-19', 'value': 3, 'super_record': False, 'stage': 'canceled', 'name': 'D'})
        self.Model.create({'date': '1916-12-19', 'value': 5, 'super_record': True, 'stage': 'draft', 'name': 'D'})

        records = self.Model.search([])
        record_ids = records.ids
        id_1 = record_ids[0]
        id_2 = record_ids[1]

        records[0].write({'other_id': id_1})
        records[1].write({'other_id': id_2})


        domain = []
        groups = [[]]
        measure_specs = ['value:min', 'other_id:array_agg']
        grouping_sets = [['stage'], ['other_id']]

        result = self.Model.super_read_group(
            domain = domain,
            groups= groups,
            measure_specs=measure_specs,
            grouping_sets=grouping_sets,
        )

        partition1 = result[0]['group_partitions'][0]['partition']
        partition1.sort(key = lambda equivalence_class: equivalence_class['measures']['value:min'] or 0)
        for equivalence_class in partition1:
            equivalence_class['domain'].sort(key = lambda term: json.dumps(term))


        partition2 = result[0]['group_partitions'][1]['partition'] 
        json.dumps(partition2)
        partition2.sort(key = lambda equivalence_class: equivalence_class['measures']['value:min'] or 0)
        for equivalence_class in partition2:
            equivalence_class['domain'].sort(key = lambda term: json.dumps(term))

        expected_partition1 = [
            {
                'count': 2,
                'values': {'stage': 'draft'},
                'measures': {'value:min': -1, 'other_id:array_agg': [None, None]},
                'domain': [('stage', '=', 'draft')],
                'labels': {'stage': 'Draft'}
            },
            {
                'count': 2,
                'values': {'stage': 'confirmed'},
                'measures': {'value:min': 2, 'other_id:array_agg': [id_1, id_2]},
                'domain': [('stage', '=', 'confirmed')],
                'labels': {'stage': 'Confirmed'}
            },
            {
                'count': 1,
                'values': {'stage': 'canceled'},
                'measures': {'value:min': 3, 'other_id:array_agg': [None]},
                'domain': [('stage', '=', 'canceled')],
                'labels': {'stage': 'Canceled'}
            },
        ]
        expected_partition2 = [ 
            {
                'count': 3,
                'values': {'other_id': False},
                'measures': {'value:min': -1, 'other_id:array_agg': [None, None, None]},
                'domain': [('other_id', '=', False)],
                'labels': {'other_id': False}
            },
            {
                'count': 1,
                'values': {'other_id': id_1},
                'measures': {'value:min': 2, 'other_id:array_agg': [id_1]},
                'domain': [('other_id', '=', id_1)],
                'labels': {'other_id': 'A'}
            },
            {
                'count': 1,
                'values': {'other_id': id_2},
                'measures': {'value:min': 4, 'other_id:array_agg': [id_2]},
                'domain': [('other_id', '=', id_2)],
                'labels': {'other_id': 'B'}
            },
        ]

        expected = {
            0: {
                'group_index': 0,
                'group': [],
                'group_partitions': {
                    0: {
                        'grouping_set_index':0,
                        'grouping_set': ['stage'],
                        'partition': expected_partition1
                    },
                    1: {
                        'grouping_set_index':1,
                        'grouping_set': ['other_id'],
                        'partition': expected_partition2
                    }
                }
            },
        }
    
        self.assertEqual(partition1, expected_partition1)
        self.assertEqual(partition2, expected_partition2)
        self.assertEqual(result, expected)