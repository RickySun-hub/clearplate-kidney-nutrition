"""Offline regression tests for exact USDA definitions and units."""
import importlib.util
from pathlib import Path
import unittest
spec = importlib.util.spec_from_file_location('import_usda', Path(__file__).with_name('import-usda.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class ImporterTests(unittest.TestCase):
    def test_definition_unit_and_missing_guards(self):
        values = {key: None for key in module.UNITS}
        ids = {key: None for key in module.UNITS}
        for nid, amount, unit in [(1104, 100, 'IU'), (1177, 12, 'UG'), (1110, 40, 'IU'), (1103, 1, 'MG')]:
            module.assign_nutrient(values, ids, nid, amount, unit)
        self.assertIsNone(values['vitaminA'])
        self.assertIsNone(values['folate'])
        self.assertIsNone(values['vitaminD'])
        self.assertIsNone(values['selenium'])
        module.assign_nutrient(values, ids, 1089, '0', 'MG')
        self.assertEqual(values['iron'], 0)
        module.assign_nutrient(values, ids, 1190, '12', 'UG')
        self.assertEqual(values['folate'], 12)
        module.assign_nutrient(values, ids, 1162, '2', 'MG', True)
        self.assertIsNone(values['vitaminC'])
    def test_sugar_priority_and_bad_values(self):
        values = {key: None for key in module.UNITS}
        ids = {key: None for key in module.UNITS}
        module.assign_nutrient(values, ids, 2000, 4, 'G')
        module.assign_nutrient(values, ids, 1063, 6, 'G')
        self.assertEqual(values['sugars'], 4)
        for bad in ('nan', '-2', 'missing'):
            module.assign_nutrient(values, ids, 1089, bad, 'MG')
        self.assertIsNone(values['iron'])
        self.assertEqual(len(module.UNITS), 28)

if __name__ == '__main__':
    unittest.main()
