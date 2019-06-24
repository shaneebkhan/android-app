# Part of Odoo. See LICENSE file for full copyright and licensing details.

import base64
import io

from PIL import Image

import odoo.tests


@odoo.tests.common.tagged('post_install', '-at_install')
class TestWebsiteSaleImage(odoo.tests.HttpCase):

    # registry_test_mode = False  # uncomment to save the product to test in browser

    def test_01_admin_shop_zoom_tour(self):
        color_red = '#CD5C5C'
        name_red = 'Indian Red'

        color_green = '#228B22'
        name_green = 'Forest Green'

        color_blue = '#4169E1'
        name_blue = 'Royal Blue'

        # create the color attribute
        product_attribute = self.env['product.attribute'].create({
            'name': 'Beautiful Color',
            'type': 'color',
        })

        # create the color attribute values
        attr_values = self.env['product.attribute.value'].create([{
            'name': name_red,
            'attribute_id': product_attribute.id,
            'html_color': color_red,
            'sequence': 1,
        }, {
            'name': name_green,
            'attribute_id': product_attribute.id,
            'html_color': color_green,
            'sequence': 2,
        }, {
            'name': name_blue,
            'attribute_id': product_attribute.id,
            'html_color': color_blue,
            'sequence': 3,
        }])

        # first image (blue) for the template
        f = io.BytesIO()
        Image.new('RGB', (1920, 1080), color_blue).save(f, 'JPEG')
        f.seek(0)
        blue_image = base64.b64encode(f.read())

        # second image (red) for the variant 1, small image (no zoom)
        f = io.BytesIO()
        Image.new('RGB', (800, 500), color_red).save(f, 'JPEG')
        f.seek(0)
        red_image = base64.b64encode(f.read())

        # second image (green) for the variant 2, big image (zoom)
        f = io.BytesIO()
        Image.new('RGB', (1920, 1080), color_green).save(f, 'JPEG')
        f.seek(0)
        green_image = base64.b64encode(f.read())

        # Template Extra Image 1
        f = io.BytesIO()
        Image.new('RGB', (124, 147)).save(f, 'GIF')
        f.seek(0)
        image_gif = base64.b64encode(f.read())

        # Template Extra Image 2
        image_svg = base64.b64encode(b'<svg></svg>')

        # Red Variant Extra Image 1
        f = io.BytesIO()
        Image.new('RGB', (767, 247)).save(f, 'BMP')
        f.seek(0)
        image_bmp = base64.b64encode(f.read())

        # Green Variant Extra Image 1
        f = io.BytesIO()
        Image.new('RGB', (2147, 3251)).save(f, 'PNG')
        f.seek(0)
        image_png = base64.b64encode(f.read())

        # create the template, without creating the variants
        template = self.env['product.template'].with_context(create_product_product=True).create({
            'name': 'A Colorful Image',
            'product_template_image_ids': [(0, 0, {'name': 'image 1', 'image': image_gif}), (0, 0, {'name': 'image 4', 'image': image_svg})],
        })

        # set the color attribute and values on the template
        line = self.env['product.template.attribute.line'].create([{
            'attribute_id': product_attribute.id,
            'product_tmpl_id': template.id,
            'value_ids': [(6, 0, attr_values.ids)]
        }])
        value_red = line.ptal_product_template_attribute_value_ids[0]
        value_green = line.ptal_product_template_attribute_value_ids[1]

        # set a different price on the variants to differentiate them
        product_template_attribute_values = self.env['product.template.attribute.value'].search([('product_tmpl_id', '=', template.id)])

        for val in product_template_attribute_values:
            if val.name == name_red:
                val.price_extra = 10
            else:
                val.price_extra = 20

        # Create RED variant, and set image to blue (will be set on the template
        # because the template image is empty and there is only one variant)
        product_red = self.env['product.product'].create({
            'product_tmpl_id': template.id,
            'image': blue_image,
            'variant_product_template_attribute_value_ids': [(6, 0, value_red.ids)],
            'product_variant_image_ids': [(0, 0, {'name': 'image 2', 'image': image_bmp})],
        })

        self.assertEqual(template.image_original, blue_image)

        # create the green variant
        product_green = self.env['product.product'].create({
            'image': green_image,
            'product_tmpl_id': template.id,
            'variant_product_template_attribute_value_ids': [(6, 0, value_green.ids)],
            'product_variant_image_ids': [(0, 0, {'name': 'image 3', 'image': image_png})],
        })

        # now set the red image on the first variant, that works because
        # template image is not empty anymore and we have a second variant
        product_red.image = red_image

        # Verify image_original size > 1024 can be zoomed
        self.assertTrue(template.can_image_be_zoomed)
        self.assertFalse(template.product_template_image_ids[0].can_image_be_zoomed)
        self.assertFalse(template.product_template_image_ids[1].can_image_be_zoomed)
        self.assertFalse(product_red.can_image_be_zoomed)
        self.assertFalse(product_red.product_variant_image_ids[0].can_image_be_zoomed)
        self.assertTrue(product_green.can_image_be_zoomed)
        self.assertTrue(product_green.product_variant_image_ids[0].can_image_be_zoomed)

        # jpeg encoding is changing the color a bit
        jpeg_blue = (65, 105, 227)
        jpeg_red = (205, 93, 92)
        jpeg_green = (34, 139, 34)

        # Verify original size: keep original
        image = Image.open(io.BytesIO(base64.b64decode(template.image_original)))
        self.assertEqual(image.size, (1920, 1080))
        self.assertEqual(image.getpixel((image.size[0] / 2, image.size[1] / 2)), jpeg_blue, "blue")
        image = Image.open(io.BytesIO(base64.b64decode(product_red.image_original)))
        self.assertEqual(image.size, (800, 500))
        self.assertEqual(image.getpixel((image.size[0] / 2, image.size[1] / 2)), jpeg_red, "red")
        image = Image.open(io.BytesIO(base64.b64decode(product_green.image_original)))
        self.assertEqual(image.size, (1920, 1080))
        self.assertEqual(image.getpixel((image.size[0] / 2, image.size[1] / 2)), jpeg_green, "green")

        # Verify big size: keep aspect ratio
        image = Image.open(io.BytesIO(base64.b64decode(template.image_big)))
        self.assertEqual(image.size, (1024, 576))
        self.assertEqual(image.getpixel((image.size[0] / 2, image.size[1] / 2)), jpeg_blue, "blue")
        image = Image.open(io.BytesIO(base64.b64decode(product_red.image_big)))
        self.assertEqual(image.size, (800, 500))
        self.assertEqual(image.getpixel((image.size[0] / 2, image.size[1] / 2)), jpeg_red, "red")
        image = Image.open(io.BytesIO(base64.b64decode(product_green.image_big)))
        self.assertEqual(image.size, (1024, 576))
        self.assertEqual(image.getpixel((image.size[0] / 2, image.size[1] / 2)), jpeg_green, "green")

        # Verify image == image_big
        self.assertEqual(template.image_big, template.image)
        self.assertEqual(product_red.image_big, product_red.image)
        self.assertEqual(product_green.image_big, product_green.image)

        # Verify large size: keep aspect ratio
        image = Image.open(io.BytesIO(base64.b64decode(template.image_large)))
        self.assertEqual(image.size, (256, 144))
        self.assertEqual(image.getpixel((image.size[0] / 2, image.size[1] / 2)), jpeg_blue, "blue")
        image = Image.open(io.BytesIO(base64.b64decode(product_red.image_large)))
        self.assertEqual(image.size, (256, 160))
        self.assertEqual(image.getpixel((image.size[0] / 2, image.size[1] / 2)), jpeg_red, "red")
        image = Image.open(io.BytesIO(base64.b64decode(product_green.image_large)))
        self.assertEqual(image.size, (256, 144))
        self.assertEqual(image.getpixel((image.size[0] / 2, image.size[1] / 2)), jpeg_green, "green")

        # Verify medium size: keep aspect ratio
        image = Image.open(io.BytesIO(base64.b64decode(template.image_medium)))
        self.assertEqual(image.size, (128, 72))
        self.assertEqual(image.getpixel((image.size[0] / 2, image.size[1] / 2)), jpeg_blue, "blue")
        image = Image.open(io.BytesIO(base64.b64decode(product_red.image_medium)))
        self.assertEqual(image.size, (128, 80))
        self.assertEqual(image.getpixel((image.size[0] / 2, image.size[1] / 2)), jpeg_red, "red")
        image = Image.open(io.BytesIO(base64.b64decode(product_green.image_medium)))
        self.assertEqual(image.size, (128, 72))
        self.assertEqual(image.getpixel((image.size[0] / 2, image.size[1] / 2)), jpeg_green, "green")

        # Verify small size: keep aspect ratio
        image = Image.open(io.BytesIO(base64.b64decode(template.image_small)))
        self.assertEqual(image.size, (64, 36))
        self.assertEqual(image.getpixel((image.size[0] / 2, image.size[1] / 2)), jpeg_blue, "blue")
        image = Image.open(io.BytesIO(base64.b64decode(product_red.image_small)))
        self.assertEqual(image.size, (64, 40))
        self.assertEqual(image.getpixel((image.size[0] / 2, image.size[1] / 2)), jpeg_red, "red")
        image = Image.open(io.BytesIO(base64.b64decode(product_green.image_small)))
        self.assertEqual(image.size, (64, 36))
        self.assertEqual(image.getpixel((image.size[0] / 2, image.size[1] / 2)), jpeg_green, "green")

        # self.env.cr.commit()  # uncomment to save the product to test in browser

        self.start_tour("/", 'shop_zoom', login="admin")

        # CASE: unlink move image to fallback if fallback image empty
        template.image = False
        product_red.unlink()
        self.assertEqual(template.image_original, red_image)

        # CASE: unlink does nothing special if fallback image already set
        self.env['product.product'].create({
            'product_tmpl_id': template.id,
            'image': green_image,
        }).unlink()
        self.assertEqual(template.image_original, red_image)

        # CASE: display variant image first if set
        self.assertEqual(product_green._get_images()[0].image_original, green_image)

        # CASE: display variant fallback after variant o2m, correct fallback
        # write on the raw field, otherwise it will write on the fallback here
        product_green.image_raw_original = False
        images = product_green._get_images()
        self.assertEqual(images[0].image_original, image_png)
        self.assertEqual(images[1].image_original, red_image)
        self.assertEqual(images[2].image_original, image_gif)
        self.assertEqual(images[3].image_original, image_svg)
