from odoo.tests.common import tagged, HttpCase


@tagged('-at_install', 'post_install', 'document_layout')
class TestAccountDocumentLayout(HttpCase):

    def test_account_document_layout(self):
        company = self.env.company
        company.write({
            'account_onboarding_invoice_layout_state': 'not_done',
            'logo': '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wgARCABAAEADAREAAhEBAxEB/8QAGQAAAgMBAAAAAAAAAAAAAAAAAwQAAQIF/8QAGAEAAwEBAAAAAAAAAAAAAAAAAAECAwT/2gAMAwEAAhADEAAAAeMECBY6ChQIDA389rDFRqascVKaYyo6HJ0PYliXvWh5a5fbx6zt7DpcyiAC9Bt2HO6+NrGz5dG0qbDTDRRK3Txu8uxJZZcBHYVvLacqXMds3l0+WiI5+rBpAqbEac/XMotVlYCpZb3j0YH/AP/EACMQAAICAgIBBAMAAAAAAAAAAAECAAMREiEiEwQUIzIQMDP/2gAIAQEAAQUC/RUoM75G01fLbFO+e8tJ1o5Hpvy8EZpb9auKkaAwmE8swaY63Z0p+musbkZ7HmZWGyOcpQnxupeKi1i0ZDAmBWz3cgfBV1rDYsrGUcdSwwViElrP5126Dzrj3bie7eG8meWC5RGu2X//xAAiEQACAgIABwEBAAAAAAAAAAAAAQIREiEDEBMxMkFRIjD/2gAIAQMBAT8B/gmr2ZxOrE6iM4szjZGUZdifETeKIq5nrnEZicTzF6O6GhIojrlxfMj3QhFC0ZIc0ibuZHSHZ4lm2bNspVfsjqNje9F8syyG2TjiRnSom1Lsfr6fr6U/ok/pGcI+ifFyVH//xAAkEQACAgAGAgIDAAAAAAAAAAAAAQIRAxASITJREzEiUjBBgf/aAAgBAgEBPwH8DTrY0HjNAsM8Y40LDpWPgYuaySIcBkl3lRQlWUOBKt+y7FkjcUSPAm9yLocnIiKi0bIt/wAJK2ODqiXsXsSE+yRH2SjZGO+5ow/qaMP6lQX6Pj0OLYoUf//EACUQAAIBAwIGAwEAAAAAAAAAAAABEQIQITFBIDJRYXGREiKBof/aAAgBAQAGPwK+nC29EYNCreeo1udrbQVIfDgfkmN/Y2t7oxbIlsMhEX7H6eSmKofQk1wMxqQ3nQq6lLn0KrMH2u2mQ6sFWxHxk5L5Ry/05CIg/8QAIxAAAgICAQQDAQEAAAAAAAAAAREAITFRQWFxgZEQsfCh0f/aAAgBAQABPyGL44ftPHwvgrgm1cwUBbxagcl9ywIOgOICgi5uZy+iogFBjRay465E1A6pUckiLV/BlmIgB+jKQHzA1Xw8wsB3wpHolFwNjUC7WYWRMtQEGQ6wio5gtfc95wtxjM0VCoACKsqGSZQ6QAODUWVaajlNDlBKdLfcxzL7hH+wttu4gLOL84jOWFXeMAw7oASS+kFbbesQqCQB9n+8wAoEAweIQNC8wBKVBC6xfchBCkvzKGpgWQIzMBJdzAAsYNQAID96hPn9/Jyr5iwK0nVxwNw3P//aAAwDAQACAAMAAAAQbIHvogRBq1i560meTYL5/aCz48wB77sW/8QAIhEBAAICAQMFAQAAAAAAAAAAAQARITFREEFxYYGRofHB/9oACAEDAQE/EJTKZU9ulPTFQ0b78OviCtonswy2L7RAhd+GpYjNGsMsD7YiD5IAjww59CYZgWcmCj4/sJXK5RCjoCpIEZii0zT4iRAxm4jZKd4YXOwzJvphmnEv6DEkBqURpuJbbqBoblPlheUO1ZCCXgsFy44VFZqJqmQneDcLh2NMr85X5xff0gnOE0EDhT//xAAkEQEAAgECBgIDAAAAAAAAAAABABEhMUEQUWFxkbGh8CCB4f/aAAgBAgEBPxDhc3143wXaOv2RWyeSaTJjrEEbPJGgZL7w9SfpIwOOk9SYVX4XMHeLPuepkpe31llEJCBVFFssWoQdc4gJ7O280pg2wMWwVpE4EU+88f8AkC9lkSqOmqzEKjRbGqwxG8CLMCIairGNhbuW0CACwzEoJbu6iFlZyzFNfkz7lhoPmx5PeOayxdz/xAAkEAEBAAIBAwMFAQAAAAAAAAABEQAhMUFRYXGB8JGhsdHhwf/aAAgBAQABPxBxQxEeI4jwjxcmvDxy5w2KaHriPbnjBIoMOswFFBZtnTAZGgGDRB8c5rRX0sJ2lOeN8aM5LJ2zq/h152+6pVcoQ6vTc14OZiI3tWkpO10Bs9JhVxYJI3seA7snFznHkB6j9PpiRqW2ioeOlvOC+hMXvGffKTDNLd39TDbe+CF8ZUDNF1bv+4uFDsYlBJFvD5Ls3iCcKFCc/wCriMNRaaDt6ab/AHIawoN99e+C0gZXfGcisbO2IoR2jjkc3vKFPXEBjvZ6Yq0QScTfGLrLLF2qDPY747oe4PyZIKoJ8/bE4cCbeK/XAGsoSlIbwADRW3f8/Wax0jAhh2mAIk1ZPfHFdaioMVnSgHH1xiklBoTF/KevbA+II1V7f7mjLQBNQcOMVQCUDAEcA2nTwE559slTIaYl4p+Zionweir+flxlqPALyQ78ya7uDJlgIt6NV+ffASkOnDtwjbxT1NmKuWcDjjJ6aPIcXi9ckeqfs153cAFZwLdQDXXYvi9Kb2LD0Ttjpu3BXvrNcR6mBEFHyYE0/HxhuHV5i/WEE0Ejb509Ppk8YhSutz//2Q=='
        })
        self.start_tour("/web", 'account_dashboard_setup_tour', login='admin')

    def test_render_account_document_layout(self):
        company = self.env.company
        report_layout = self.env.ref('web.report_layout_standard')
        company.write({
            'primary_color': '#123456',
            'secondary_color': '#789101',
            'external_report_layout_id': report_layout.view_id.id,
        })
        self.env.ref('account.account_invoices_without_payment').write({
            'report_type': 'qweb-html',
        })
        self.start_tour("/web", 'account_render_report', login='admin', timeout=200)
