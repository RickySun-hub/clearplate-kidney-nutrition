"""Normalize official USDA bulk files. No credentials or network calls.

python scripts/import-usda.py --raw output/usda/raw --out output/usda/catalog.json
"""
import argparse
import csv
import hashlib
import json
import math
from pathlib import Path

NUTRIENTS = {1008: ('calories', 'kcal'), 1003: ('protein', 'g'), 1093: ('sodium', 'mg'),
             1092: ('potassium', 'mg'), 1091: ('phosphorus', 'mg'), 1005: ('carbs', 'g'),
             1004: ('fat', 'g'), 1079: ('fiber', 'g'), 1087: ('calcium', 'mg'),
             2000: ('sugars', 'g'), 1063: ('sugars', 'g'), 1235: ('addedSugars', 'g'),
             1258: ('saturatedFat', 'g'), 1253: ('cholesterol', 'mg'), 1090: ('magnesium', 'mg'),
             1089: ('iron', 'mg'), 1095: ('zinc', 'mg'), 1103: ('selenium', 'ug'),
             1106: ('vitaminA', 'ug'), 1162: ('vitaminC', 'mg'), 1114: ('vitaminD', 'ug'),
             1109: ('vitaminE', 'mg'), 1185: ('vitaminK', 'ug'), 1165: ('thiamin', 'mg'),
             1166: ('riboflavin', 'mg'), 1167: ('niacin', 'mg'), 1175: ('vitaminB6', 'mg'),
             1190: ('folate', 'ug'), 1178: ('vitaminB12', 'ug')}

# Exact chemical definitions only: A RAE (not IU), D2+D3 µg (not IU),
# alpha-tocopherol, phylloquinone, and folate DFE (not folic acid/total folate).
UNITS = {key: unit for key, unit in NUTRIENTS.values()}
def assign_nutrient(values, ids, nid, amount, unit, below_loq=False):
    if nid not in NUTRIENTS or below_loq:
        return
    key, expected = NUTRIENTS[nid]
    value = number(amount)
    if unit.lower() != expected or value is None:
        return
    if key == 'sugars' and ids[key] == 2000 and nid == 1063:
        return
    values[key], ids[key] = value, nid

def rows(path):
    with path.open(encoding='utf-8-sig', newline='') as handle:
        yield from csv.DictReader(handle)

def number(value):
    try:
        result = float(value)
        return result if math.isfinite(result) and result >= 0 else None
    except (ValueError, TypeError):
        return None

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--raw', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    food_path = next(args.raw.rglob('food.csv'))
    sr_dir = food_path.parent
    nutrient_units = {int(row['id']): row['unit_name'].lower() for row in rows(sr_dir / 'nutrient.csv')}
    foods = {}
    for row in rows(food_path):
        fdc_id = int(row['fdc_id'])
        foods[fdc_id] = {'fdcId': fdc_id, 'description': row['description'], 'dataType': 'SR Legacy',
                         'basis': 'per100g', 'publicationDate': row.get('publication_date'),
                         'release': '2018-04', 'sourceUrl': f'https://fdc.nal.usda.gov/food-details/{fdc_id}/nutrients',
                         'nutrients': {key: None for key, unit in NUTRIENTS.values()},
                         'nutrientIds': {key: None for key, unit in NUTRIENTS.values()}, 'units': UNITS, 'portions': []}
    for row in rows(sr_dir / 'food_nutrient.csv'):
        nid, fid = int(row['nutrient_id']), int(row['fdc_id'])
        if nid in NUTRIENTS and fid in foods:
            assign_nutrient(foods[fid]['nutrients'], foods[fid]['nutrientIds'], nid,
                            row['amount'], nutrient_units.get(nid, ''), row.get('is_below_loq', '').lower() in ('true', '1'))
    for row in rows(sr_dir / 'food_portion.csv'):
        fid = int(row['fdc_id'])
        if fid in foods:
            foods[fid]['portions'].append({'amount': number(row['amount']), 'gramWeight': number(row['gram_weight']),
                                           'description': row.get('modifier') or row.get('portion_description') or '',
                                           'sourcePortionId': row['id']})
    foundation_path = next(args.raw.rglob('FoodData_Central_foundation_food_json_*.json'))
    foundation = json.loads(foundation_path.read_text(encoding='utf-8'))
    for row in foundation['FoundationFoods']:
        if not isinstance(row, dict):
            continue
        fid = row['fdcId']
        values = {key: None for key, unit in NUTRIENTS.values()}
        ids = {key: None for key, unit in NUTRIENTS.values()}
        for nutrient in row.get('foodNutrients', []):
            nid = nutrient['nutrient']['id']
            if nid in NUTRIENTS:
                assign_nutrient(values, ids, nid, nutrient.get('amount'), nutrient['nutrient']['unitName'],
                                nutrient.get('isBelowLoq') or nutrient.get('belowLoq'))
        # Match API normalization: specific Atwater energy before general factors.
        if values['calories'] is None:
            for nid in (2048, 2047):
                match = next((n for n in row.get('foodNutrients', []) if n['nutrient']['id'] == nid and n['nutrient']['unitName'].lower() == 'kcal' and not n.get('isBelowLoq') and not n.get('belowLoq') and number(n.get('amount')) is not None), None)
                if match:
                    values['calories'] = number(match.get('amount'))
                    ids['calories'] = nid
                    break
        foods[fid] = {'fdcId': fid, 'description': row['description'], 'dataType': 'Foundation', 'basis': 'per100g',
                      'publicationDate': row.get('publicationDate'), 'release': '2026-04',
                      'sourceUrl': f'https://fdc.nal.usda.gov/food-details/{fid}/nutrients', 'nutrients': values, 'nutrientIds': ids, 'units': UNITS,
                      'portions': [{'amount': p.get('amount'), 'gramWeight': p.get('gramWeight'),
                                    'description': p.get('modifier') or p.get('portionDescription') or p.get('measureUnit', {}).get('name', ''),
                                    'sourcePortionId': p.get('id')} for p in row.get('foodPortions', [])]}
    archives = [{ 'file': p.name, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(args.raw.glob('*.zip'))]
    result = {'schemaVersion': 1, 'sources': [
        {'dataType': 'SR Legacy', 'release': '2018-04', 'url': 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip'},
        {'dataType': 'Foundation', 'release': '2026-04', 'url': 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_json_2026-04-30.zip'}],
        'archives': archives, 'foods': list(foods.values())}
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(json.dumps({'foodCount': len(foods), 'foundationCount': len(foundation['FoundationFoods']), 'output': str(args.out)}))

if __name__ == '__main__':
    main()
