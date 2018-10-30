# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from .public_project import PublicProject
from odoo import api, http
from odoo.addons.web.controllers.main import Action, DataSet
from odoo.addons.mail.controllers.main import MailController
from odoo.http import request


class PublicAction(Action, PublicProject):

    @http.route('/embed/project/action/load', type='json', auth="public")
    @PublicProject.verify_and_dispatch('load_action')
    def public_load_action(self, **kw):
        """Public interface for /web/action/load.
        Check permissions, then call Action.load() as sudo
        (or in the regular fashion if user is logged in and no access
        is granted otherwise) in order to load an action.
        
        :param kw: Contains the method, the model and any other keyword
                   arguments required by Action.load()
                   + access_info (used then removed by @verify_and_dispatch):
                   access token and document information (project_id, task_id)
        :return: The result of Action.load()
        :rtype: any
        """

        return self._sudo_load_action(**kw)


class PublicDataSet(DataSet, PublicProject):

    @http.route('/embed/project/dataset/call', type='json', auth="public")
    @PublicProject.verify_and_dispatch('call')
    def public_call(self, operation, task_id, **kw):
        """Public interface for /web/dataset/call.
        Check permissions, then call DataSet.call() as sudo
        (or in the regular fashion if user is logged in and no access
        is granted otherwise) in order to call a given method
        of a given model.

        call() is a shorthand for call_kw without keyword arguments: it passes
        an empty dict to _call_kw().

        Use within a project:
        - Read a template (only used by Summernote)

        :param operation: 'read', 'write' or 'create' - injected by @verify_and_dispatch
        :type operation: str
        :param task_id: The id of the task of which we operate - injected by @verify_and_dispatch
        :type task_id: int
        :param kw: Contains the method, the model and any other keyword
                   arguments required by DataSet.call()
                   + access_info (used then removed by @verify_and_dispatch):
                   access token and document information (project_id, task_id)
        :return: The result of Dataset.call()
        :rtype: any
        """

        if operation == 'create':
            return self._sudo_call_kw_create(request.env[kw.pop('model')],
                                             kw.get('method'),
                                             kw.get('args'),
                                             {})
        if operation == 'read':
            return self._sudo_call_kw_read(request.env[kw.pop('model')],
                                           kw.get('method'),
                                           kw.get('args'),
                                           {})
        if operation == 'write':
            return self._sudo_call_kw_write(task_id,
                                            request.env[kw.pop('model')],
                                            kw.get('method'),
                                            kw.get('args'),
                                            {})

    @http.route(['/embed/project/dataset/call_kw',
                 '/embed/project/dataset/call_kw/<path:path>'], type='json', auth="public")
    @PublicProject.verify_and_dispatch('call_kw')
    def public_call_kw(self, operation, task_id, **kw):
        """Public interface for /web/dataset/call_kw.
        Check permissions, then call DataSet.call_kw() as sudo
        (or in the regular fashion if user is logged in and no access
        is granted otherwise) in order to call a given method
        of a given model. Most dataset CRUD operations go through this route.

        Unexhaustive use within a project:
            (- K = on project view (kanban)
             - F = on task view (form)
             - C = on click create task
             - S = on click save)
        - KF    read: Read fields of a record
        - KF    search_read: Get the recordsets data
        - F     name_get: Get the (id, repr) of task types/users
        - F     message_format: Get the chatter messages/emails (from their ids) / Rest of info comes from /mail route ]
        - KF    default_view: Get the id of the kanban view (in order to instantiate it)
        - C     default_get: Return default values for the fields in ``fields_list``
        - KFC   load_views: Get the fields definitions
        - KC    read_group: Get the list of records in list view grouped by the given ``groupby`` fields
        - KC    read_progress_bar: Get the data needed for all the kanban column progressbars. Fetched alongside read_group operation.
        - C     onchange
        - S     create: Create a record in project.task
        
        :param operation: 'read', 'write' or 'create' - injected by @verify_and_dispatch
        :type operation: str
        :param task_id: The id of the task of which we operate - injected by @verify_and_dispatch
        :type task_id: int
        :param kw: Contains the method, the model and any other keyword
                   arguments required by the DataSet.call_kw()
                   + access_info (used then removed by @verify_and_dispatch):
                   access token and document information (project_id, task_id)
        :return: The result of Dataset.call_kw()
        :rtype: any
        """

        if operation == 'create':
            return self._sudo_call_kw_create(request.env[kw.pop('model')],
                                             kw.get('method'),
                                             kw.get('args'),
                                             kw.get('kwargs', {}))
        if operation == 'read':
            return self._sudo_call_kw_read(request.env[kw.pop('model')],
                                           kw.get('method'),
                                           kw.get('args'),
                                           kw.get('kwargs', {}))
        if operation == 'write':
            return self._sudo_call_kw_write(task_id,
                                            request.env[kw.pop('model')],
                                            kw.get('method'),
                                            kw.get('args'),
                                            kw.get('kwargs', {}))

    @http.route('/embed/project/dataset/resequence', type='json', auth="public")
    @PublicProject.verify_and_dispatch('resequence')
    def public_resequence(self, task_id, **kw):
        """Public interface for /web/dataset/resequence.
        Check permissions, then call BaseModel.resequence() as sudo
        (or in the regular fashion if user is logged in and no access
        is granted otherwise) in order to re-sequence a number of records
        in the model, by their ids.
        
        Use within a project:
        - Changing the order of tasks or stages
        
        :param task_id: The id of the task of which we operate - injected by @verify_and_dispatch
        :type task_id: int
        :param kw: Contains the method, the model and any other keyword
                   arguments required by the BaseModel.resequence()
                   + access_info (used then removed by @verify_and_dispatch):
                   access token and document information (project_id, task_id)
        :return: The result of BaseModel.resequence()
        :rtype: any
        """

        return self._sudo_resequence(task_id, request.env[kw.pop('model')], **kw)

    @http.route('/embed/project/dataset/search_read', type='json', auth="public")
    @PublicProject.verify_and_dispatch('search_read')
    def public_search_read(self, **kw):
        """Public interface for /web/dataset/search_read.
        Check permissions, then call DataSet.do_search_read() as sudo
        (or in the regular fashion if user is logged in and no access
        is granted otherwise) in order to perform a search() followed
        by a read() (if needed) using the provided search criteria.

        Use within a project:
        - Get the recordset's data

        :param kw: Contains the search criteria and any other keyword
                   arguments required by the DataSet.do_search_read()
                   + access_info (used then removed by @verify_and_dispatch):
                   access token and document information (project_id, task_id)
        :return: The result of DataSet.do_search_read()
        :rtype: any
        """

        return self._sudo_search_read(request.env[kw.pop('model')], **kw)


class PublicMailController(MailController, PublicProject):

    @http.route('/embed/project/mail/init_messaging', type='json', auth='public')
    @PublicProject.verify_and_dispatch('mail_init_messaging')
    def public_mail_init_messaging(self, **kw):
        """Public interface for /mail/init_messaging.
        Check permissions, then emulate MailController.mail_init_messaging()
        as sudo (or in the regular fashion if user is logged in and no access
        is granted otherwise) in order to retrieve values required for
        the chatter initialization.
        
        :param kw: Contains access_info (used then removed by @verify_and_dispatch):
                   access token and document information (project_id, task_id)
                   and potentially a context key            
        :return: The result of MailController.mail_init_messaging()
        :rtype: dict
        """

        return self._sudo_mail_init_messaging()
