const fractions = { '¼': 1 / 4, '½': 1 / 2, '¾': 3 / 4, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 1 / 8, '⅜': 3 / 8, '⅝': 5 / 8, '⅞': 7 / 8, '⅙': 1 / 6, '⅚': 5 / 6 };
const quantityPattern = '(?:\\d+\\s+\\d+\\s*/\\s*\\d+|\\d+\\s*[¼½¾⅓⅔⅛⅜⅝⅞⅙⅚]|\\d+\\s*/\\s*\\d+|[¼½¾⅓⅔⅛⅜⅝⅞⅙⅚]|(?:\\d+(?:\\.\\d+)?|\\.\\d+))';
const rangePattern = `(${quantityPattern})(?:([ \\t]*(?:to|[-–—])[ \\t]*)(${quantityPattern}))?`;
const unitPattern = /^(?:\s+)(tablespoons?|tbsp\.?|teaspoons?|tsp\.?|cups?|ounces?|oz\.?|pounds?|lbs?\.?|kilograms?|kg|grams?|g|millilit(?:er|re)s?|ml|lit(?:er|re)s?|l|quarts?|pints?|gallons?|cans?|packages?|bags?|cloves?|stalks?)\b/i;
const units = {
  tablespoon: 'tbsp', tbsp: 'tbsp', teaspoon: 'tsp', tsp: 'tsp', cup: 'cup',
  ounce: 'oz', oz: 'oz', pound: 'lb', lb: 'lb', kilogram: 'kg', kg: 'kg', gram: 'g', g: 'g',
  milliliter: 'ml', millilitre: 'ml', ml: 'ml', liter: 'l', litre: 'l', l: 'l',
  quart: 'quart', pint: 'pint', gallon: 'gallon', can: 'can', package: 'package', bag: 'bag', clove: 'clove', stalk: 'stalk',
};

function parseQuantity(text) {
  const compact = text.trim().replace(/\s*\/\s*/g, '/');
  if (fractions[compact] !== undefined) return fractions[compact];
  const unicode = compact.match(/^(\d+)\s*([¼½¾⅓⅔⅛⅜⅝⅞⅙⅚])$/);
  if (unicode) return Number(unicode[1]) + fractions[unicode[2]];
  const mixed = compact.match(/^(?:(\d+)\s+)?(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[3]) > 0 ? Number(mixed[1] || 0) + Number(mixed[2]) / Number(mixed[3]) : null;
  const value = Number(compact);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function quantityTokens(text) {
  const result = [];
  const matcher = new RegExp(rangePattern, 'gi');
  for (const match of text.matchAll(matcher)) {
    const before = text.slice(0, match.index);
    const after = text.slice(match.index + match[0].length);
    // Percentages, piece/package sizes, page references and dimensions describe
    // the source ingredient, rather than the amount of food in this batch.
    if (/[\d./¼½¾⅓⅔⅛⅜⅝⅞⅙⅚]$/.test(before) || /^\s*(?:%|percent\b|[-–]\s*[a-z]|inches?\b|count\b)/i.test(after)) continue;
    if (/\b(?:page|at least)\s*$/i.test(before)) continue;
    const opening = before.lastIndexOf('(');
    const inParenthesis = opening > before.lastIndexOf(')');
    const context = inParenthesis ? before.slice(opening + 1) : before;
    const closing = inParenthesis ? after.split(')')[0] : '';
    if (inParenthesis && /\beach\b/i.test(closing)) continue;
    // A leading container's parenthetical weight is its fixed package size.
    if (inParenthesis && /^\s*(?:about\s*)?$/.test(context) && /^\s*(?:ounces?|oz|pounds?|lb|grams?|g)\b/i.test(after)
      && /^\s*(?:cans?|packages?|bags?)\s*$/i.test(text.slice(result[0]?.end ?? 0, opening))) continue;
    const leading = before.trim() === '';
    const embedded = /(?:juice(?: and zest)? (?:from|of)|zest(?: and juice)? (?:from|of))\s+(?:about\s+)?$/i.test(before);
    const alternative = /\bor\s+(?:about\s+)?$/i.test(before);
    const measuredParenthesis = inParenthesis && (unitPattern.test(after) || /^\s*(?:about|from about)\s*$/i.test(context) || /^\s*(?:or|;)/.test(context));
    // An amount before a fixed piece size is itself a package/piece count.
    const sizedCount = inParenthesis && new RegExp(`^\\s+${quantityPattern}[-–]`).test(after);
    if (!leading && !embedded && !alternative && !measuredParenthesis && !sizedCount) continue;
    const low = parseQuantity(match[1]);
    const high = match[3] ? parseQuantity(match[3]) : null;
    if (low === null || (match[3] && high === null)) continue;
    result.push({ start: match.index, end: match.index + match[0].length, quantity: low, quantityMax: high, separator: match[2] });
  }
  return result;
}

export function parseIngredient(text) {
  const original = typeof text === 'string' ? text : '';
  const primary = quantityTokens(original)[0];
  const issues = [];
  if (/\b(?:pinch|sprinkle|to taste)\b/i.test(original)) issues.push('Unmeasured pinch, sprinkle or to-taste amount; weight unresolved.');
  if ((original.match(/\(/g) || []).length !== (original.match(/\)/g) || []).length) issues.push('Source text has an incomplete parenthetical note.');
  if (/\b(?:dry|dried|raw)\b.*\bor\b.*\bcooked\b|\bcooked\b.*\b(?:dry|dried|raw)\b/i.test(original)) issues.push('Raw/cooked alternative requires a preparation choice.');
  if (!primary && !original.trim().endsWith(':')) issues.push('No measured quantity; weight unresolved.');
  const suffix = primary ? original.slice(primary.end) : original;
  const unitMatch = suffix.match(unitPattern);
  const normalized = unitMatch?.[1].toLowerCase().replace(/\.$/, '').replace(/s$/, '');
  const unit = primary ? (units[normalized] || 'count') : null;
  return {
    original,
    quantity: primary?.quantity ?? null,
    quantityMax: primary?.quantityMax ?? null,
    unit,
    foodText: (unitMatch ? suffix.slice(unitMatch[0].length) : suffix).trim(),
    scalable: Boolean(primary),
    issue: issues.length ? issues.join(' ') : null,
  };
}

function formatQuantity(value) {
  const whole = Math.floor(value + 1e-10);
  const remainder = value - whole;
  if (Math.abs(remainder) < 1e-9) return String(whole);
  for (const [symbol, fraction] of Object.entries(fractions)) {
    if (Math.abs(remainder - fraction) < 1e-9) return `${whole ? `${whole} ` : ''}${symbol}`;
  }
  // Display rounding is deliberately confined to this formatter. Parsed values
  // and the factor remain unrounded for nutrition/weight calculations.
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

export function formatIngredient(text, factor = 1) {
  if (typeof text !== 'string' || !Number.isFinite(factor) || factor <= 0) return text;
  let formatted = text;
  for (const token of quantityTokens(text).reverse()) {
    const low = formatQuantity(token.quantity * factor);
    const quantity = token.quantityMax === null ? low : `${low}${token.separator}${formatQuantity(token.quantityMax * factor)}`;
    formatted = formatted.slice(0, token.start) + quantity + formatted.slice(token.end);
  }
  return formatted;
}

// Household volume conversions do not require food-density assumptions.
// Keep mass, package and piece amounts as supplied by the source.
export function formatHouseholdIngredient(text, factor = 1) {
  const formatted = formatIngredient(text, factor);
  if (typeof text !== 'string' || !Number.isFinite(factor) || factor <= 0) return formatted;
  const parsed = parseIngredient(text);
  if (parsed.quantityMax !== null || !['tbsp', 'tsp'].includes(parsed.unit) || !new RegExp(`^\\s*${quantityPattern}`).test(text)) return formatted;
  const teaspoons = parsed.quantity * factor * (parsed.unit === 'tbsp' ? 3 : 1);
  const amount = teaspoons >= 12 ? `${formatQuantity(teaspoons / 48)} cup` : teaspoons >= 3 ? `${formatQuantity(teaspoons / 3)} tbsp` : `${formatQuantity(teaspoons)} tsp`;
  return formatted.replace(new RegExp(`^\\s*${quantityPattern}\\s+(?:tablespoons?|tbsp\\.?|teaspoons?|tsp\\.?)\\b`, 'i'), amount);
}
