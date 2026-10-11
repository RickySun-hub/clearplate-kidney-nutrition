import { hasValidProteinTargets } from "./profile.js";
import { validNutrientValue } from "./nutrientCatalog.js";
import { formatAmount } from "./nutrition.js";

const daysInMonth = (year, monthIndex) => new Date(year, monthIndex + 1, 0).getDate();

export function buildCalendarMonth(year, monthIndex) {
  const leadingDays = new Date(year, monthIndex, 1).getDay();
  const monthDays = daysInMonth(year, monthIndex);
  const cellCount = Math.ceil((leadingDays + monthDays) / 7) * 7;

  return Array.from({ length: cellCount }, (_, cellIndex) => {
    const day = cellIndex - leadingDays + 1;
    if (day < 1 || day > monthDays) return null;

    const date = new Date(year, monthIndex, day);
    const dateKey = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");

    return { day, dateKey, cellIndex };
  });
}

export function historyDayStatus(totals, itemCount, profile) {
  if (!itemCount) return "empty";
  if (!hasValidProteinTargets(profile) || !validNutrientValue(totals.sodium) || !validNutrientValue(totals.protein)
    || !validNutrientValue(profile.sodiumTargetMg) || Number(profile.sodiumTargetMg) <= 0) return "review";

  const sodiumWithin = totals.sodium <= profile.sodiumTargetMg;
  const proteinWithin = totals.protein >= profile.proteinMinG
    && totals.protein <= profile.proteinMaxG;

  return sodiumWithin && proteinWithin ? "within" : "review";
}

export function historyNutritionState(totals, itemCount, profile) {
  const sodiumKnown = validNutrientValue(totals.sodium);
  const proteinKnown = validNutrientValue(totals.protein);
  const sodiumTargetValid = validNutrientValue(profile.sodiumTargetMg) && Number(profile.sodiumTargetMg) > 0;
  const proteinTargetsValid = hasValidProteinTargets(profile);
  return {
    sodiumProgress: itemCount && sodiumKnown && sodiumTargetValid ? Number(totals.sodium) / Number(profile.sodiumTargetMg) * 100 : undefined,
    proteinProgress: itemCount && proteinKnown && proteinTargetsValid ? Number(totals.protein) / Number(profile.proteinMaxG) * 100 : undefined,
    sodiumStatus: !itemCount ? 'No foods recorded' : !sodiumKnown ? 'Incomplete nutrient data' : !sodiumTargetValid ? 'Targets need review'
      : Number(totals.sodium) <= Number(profile.sodiumTargetMg) ? 'Within recorded limit' : 'Above recorded limit',
    proteinStatus: !itemCount ? 'No foods recorded' : !proteinKnown ? 'Incomplete nutrient data' : !proteinTargetsValid ? 'Targets need review'
      : Number(totals.protein) < Number(profile.proteinMinG) ? formatAmount(profile.proteinMinG - totals.protein, 1) + ' g below range'
      : Number(totals.protein) > Number(profile.proteinMaxG) ? formatAmount(totals.protein - profile.proteinMaxG, 1) + ' g above range' : 'Within recorded range',
  };
}
