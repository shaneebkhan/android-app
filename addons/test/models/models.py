# -*- coding: utf-8 -*-

from odoo import models, fields, api
import time

class test_mix(models.Model):
    """
        test object
    """
    _name = 'test.main'
    _log_access = False
    _description = "Test"

    name = fields.Char()
    booltest = fields.Boolean('Is False')
    int1 = fields.Integer('Int Def 1', default=lambda x: 1)
    child_ids = fields.One2many('test', 'test_main_id')


class test(models.Model):
    """
        test object
    """
    _name = 'test'
    _log_access = False
    _description = "Test"

    _inherits = {'test.main': 'test_main_id'}

    test_main_id = fields.Many2one('test.main', required=True, ondelete='cascade')
    line_ids = fields.One2many('test.line', 'test_id')
    intx2 = fields.Integer('Int x2', compute="_get_intx2", inverse='_set_intx2', store=True)
    line_sum = fields.Integer('Sum Currency', compute='_line_sum', store=True)
    rel = fields.Many2many('test', 'test_rel', 'test_from', 'test_to', string="Relation")
    relinv = fields.Many2many('test', 'test_rel', 'test_to', 'test_from', string="Relation Inverse")

    @api.depends('line_ids.intx2')
    def _line_sum(self):
        for record in self:
            total = 0
            for line in record.line_ids:
                total += line.intx2
            record.line_sum = total

    @api.depends('int1')
    def _get_intx2(self):
        for record in self:
            record.intx2 = record.int1 * 2

    def _set_intx2(self):
        for record in self:
            record.int1 = record.intx2 // 2

    def testme(self):
        recs = self.env['res.partner'].search([])
        t = time.time()
        for partner in recs:
            partner.name
        return time.time()-t

    def testme2(self):
        t = time.time()
        main_id = self.create({
            'name': 'bla',
            'line_ids': [
                (0,0, {'name': 'abc'}),
                (0,0, {'name': 'def'}),
            ]
        })
        if hasattr(self, 'flush'):
            self.flush()
        return time.time()-t

    def testme3(self):
        t = time.time()
        print('* Create with two lines')
        main = self.create({
            'name': 'bla',
            'line_ids': [
                (0,0, {'name': 'abc'}),
                (0,0, {'name': 'def'}),
            ]
        })
        print('* main.int1 = 5')
        main.int1 = 5
        print('* main.intx2 = 8')
        main.intx2 = 8
        print('* create_line')
        self.env['test.line'].create(
            {'name': 'ghi', 'test_id': main.id}
        )
        print('* search intx2 line')
        self.env['test.line'].search([('intx2', '=', 3)])
        print('* end')
        if hasattr(self, 'flush'):
            self.flush()
        return time.time()-t

    def testme4(self):
        t = time.time()
        main_id = self.env['test.main'].create({
            'name': 'bla',
        })
        if hasattr(self, 'flush'):
            self.flush()
        return time.time()-t


    def p(self):
        for record in self:
            print('test (',record.id,': ', record.name, record.int1, record.intx2, record.line_sum)
            for line in record.line_ids:
                print('      (',line.id,') ', line.name, line.name2, line.intx2)

    def test(self):
        U = self.env["res.users"]
        G = self.env["res.groups"]
        group_user = self.env.ref('base.group_user')
        group_no_one = self.env.ref('base.group_no_one')

        group_A = G.create({"name": "A"})
        group_AA = G.create({"name": "AA", "implied_ids": [(6, 0, [group_A.id])]})
        group_B = G.create({"name": "B"})
        group_BB = G.create({"name": "BB", "implied_ids": [(6, 0, [group_B.id])]})
        group_C = G.create({"name": "C"})

        user_a = U.create({"name": "a", "login": "a", "groups_id": [(6, 0, [group_AA.id, group_user.id])]})
        user_b = U.create({"name": "b", "login": "b", "groups_id": [(6, 0, [group_BB.id])]})

        assert user_a.groups_id == (group_AA + group_A + group_user + group_no_one)

        user_b.write({"groups_id": [(4, group_C.id)]})
        user_a.write({"groups_id": [(4, group_C.id)]})

        assert user_a.groups_id == (group_AA + group_A + group_C + group_user + group_no_one)
        # As user_b is not an internal user, all its groups are removed
        assert user_b.groups_id == group_C

        crash_here_rollback



class test_line(models.Model):
    """
        test line
    """
    _name = 'test.line'
    _description = "Test Line"

    name = fields.Char()
    name2 = fields.Char('Related Name', related='test_id.name', store=True)

    test_id = fields.Many2one('test')
    intx2   = fields.Integer(compute='_get_intx2', store=True)

    @api.depends('test_id.intx2')
    def _get_intx2(self):
        for record in self:
            record.intx2 = record.test_id.intx2


