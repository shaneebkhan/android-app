# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    'name': "Course Certifications",
    'summary': 'Add certification capabilities to your courses',
    'description': """This module lets you use the full power of certifications within your courses.""",
    'category': 'Hidden',
    'version': '1.0',
    'depends': ['website_slides', 'website_survey'],
    'installable': True,
    'auto_install': True,
    'data': [
        'views/assets.xml',
        'views/slide_channel_views.xml',
        'views/slide_slide_views.xml',
        'views/survey_templates.xml',
        'views/website_slides_templates_course.xml',
        'views/website_slides_templates_lesson.xml',
        'views/website_slides_templates_lesson_fullscreen.xml',
        'views/website_slides_templates_homepage.xml',
        'views/website_profile.xml',
        'data/mail_template_data.xml',
        'data/gamification_data.xml',
    ],
    'demo': [
        'data/survey_demo.xml',
        'data/slide_slide_demo.xml',
    ],
}
