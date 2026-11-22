// An original, unscored adaptation of the SBAS two-domain activity history.
// Preserve raw choices; do not convert them to scores or energy requirements.
export const ACTIVITY_QUESTIONS = [
  { key: 'work', title: 'Work and regular household tasks', options: [
    ['no-regular-work', 'No regular work or household tasks.'],
    ['mostly-seated', 'Mostly sitting or standing, with little lifting.'],
    ['walking-moving', 'Mostly walking or moving my arms, such as repairs or painting.'],
    ['frequent-carrying', 'Often moving heavy items, such as construction or manual gardening.'],
    ['heavy-labor', 'Strenuous labor through most of the day, such as digging or carrying heavy loads.'],
  ] },
  { key: 'leisure', title: 'Activity outside work and household routines', options: [
    ['mostly-inactive', 'Mostly quiet activities or light chores; vigorous activity rarely.'],
    ['weekend-light', 'Usually inactive on weekdays; light walks or active chores on weekends.'],
    ['moderate-three-days', 'About three days weekly: moderate exercise for 15–20 minutes, or longer active chores.'],
    ['vigorous-three-days', 'About three days weekly: vigorous exercise for 30 minutes, or strenuous chores for an hour.'],
    ['vigorous-five-days', 'Similar vigorous activity on at least five days weekly.'],
  ] },
];
export function normalizeActivitySurvey(value = {}) {
  return { version: 1, period: 'past-year', ...Object.fromEntries(ACTIVITY_QUESTIONS.map(({ key, options }) => [key, options.some(([choice]) => choice === value?.[key]) ? value[key] : ''])) };
}
export function validateActivitySurvey(value) {
  if (value == null) return '';
  if (typeof value !== 'object' || Array.isArray(value)) return 'Check your activity answers.';
  for (const { key, options } of ACTIVITY_QUESTIONS) {
    if (value[key] != null && value[key] !== '' && !options.some(([choice]) => choice === value[key])) return `Choose one of the ${key} activity descriptions, or leave it unanswered.`;
  }
  return '';
}
