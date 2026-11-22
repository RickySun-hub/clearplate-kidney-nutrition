// Keep calculation precision for hard ceilings; round only when displaying values.
export const nutrientKeys = ["calories", "protein", "sodium", "potassium", "phosphorus"];

export const emptyNutrition = () => Object.fromEntries(nutrientKeys.map((key) => [key, 0]));

export function addNutrition(left = {}, right = {}) {
  return Object.fromEntries(nutrientKeys.map((key) => [key, (Number(left[key]) || 0) + (Number(right[key]) || 0)]));
}

export function scaleNutrition(recipe, servings) {
  return Object.fromEntries(nutrientKeys.map((key) => [key, Number(recipe[key]) * servings]));
}

export function calculateRemainingBudget(loggedTotals, targets) {
  const sodiumMax = Number(targets.sodiumMax);
  const proteinMin = Number(targets.proteinMin);
  const proteinMax = Number(targets.proteinMax);
  const potassiumMax = targets.potassiumMax !== null && targets.potassiumMax !== undefined && Number.isFinite(Number(targets.potassiumMax))
    ? Number(targets.potassiumMax)
    : null;
  const phosphorusMax = targets.phosphorusMax !== null && targets.phosphorusMax !== undefined && Number.isFinite(Number(targets.phosphorusMax))
    ? Number(targets.phosphorusMax)
    : null;
  const loggedValue = (key, bound) => Object.hasOwn(loggedTotals[bound] || {}, key)
    ? loggedTotals[bound][key]
    : loggedTotals[key];
  const remainingOptionalMaximum = (key, maximum) => {
    if (maximum === null) return null;
    const consumed = loggedValue(key, "upper");
    if (consumed === null || consumed === undefined || consumed === "" || !Number.isFinite(Number(consumed))) return null;
    return maximum - Number(consumed);
  };

  return {
    calories: Number.isFinite(Number(targets.calorieTarget))
      ? Number(targets.calorieTarget) - (Number(loggedTotals.calories) || 0)
      : null,
    sodiumMax: sodiumMax - (Number(loggedTotals.upper?.sodium ?? loggedTotals.sodium) || 0),
    proteinMin: Math.max(0, proteinMin - (Number(loggedTotals.lower?.protein ?? loggedTotals.protein) || 0)),
    proteinMax: proteinMax - (Number(loggedTotals.upper?.protein ?? loggedTotals.protein) || 0),
    potassiumMax: remainingOptionalMaximum("potassium", potassiumMax),
    phosphorusMax: remainingOptionalMaximum("phosphorus", phosphorusMax),
  };
}

export function remainingAfterPlan(remainingBefore, planTotals) {
  return {
    calories: remainingBefore.calories === null ? null : remainingBefore.calories - planTotals.calories,
    sodiumMax: remainingBefore.sodiumMax - planTotals.sodium,
    proteinMin: Math.max(0, remainingBefore.proteinMin - planTotals.protein),
    proteinMax: remainingBefore.proteinMax - planTotals.protein,
    potassiumMax: remainingBefore.potassiumMax === null ? null : remainingBefore.potassiumMax - planTotals.potassium,
    phosphorusMax: remainingBefore.phosphorusMax === null ? null : remainingBefore.phosphorusMax - planTotals.phosphorus,
  };
}
