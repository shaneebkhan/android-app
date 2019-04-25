# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api, tools


class ImageMixin(models.AbstractModel):
    _name = 'image.mixin'
    _description = "Image Mixin"

    # all image fields are base64 encoded and PIL-supported

    image_original = fields.Image("Original Image", help="Image in its original size, as it was uploaded.")

    # resized fields stored (as attachment) for performance
    image_big = fields.Image("Big-sized Image", related='image_original', size='big', avoid_if_small=True, preserve_aspect_ratio=True)
    image_large = fields.Image("Large-sized Image", related='image_original', size='large')
    image_medium = fields.Image("Medium-sized Image", related='image_original', size='medium')
    image_small = fields.Image("Small-sized Image", related='image_original', size='small')

    can_image_be_zoomed = fields.Boolean("Can image raw be zoomed", compute='_compute_can_image_raw_be_zoomed', store=True)

    image = fields.Image("Image", related='image_big', store=False)

    @api.multi
    @api.depends('image_original')
    def _compute_can_image_raw_be_zoomed(self):
        for record in self:
            record.can_image_be_zoomed = tools.is_image_size_above(record.image_original)
