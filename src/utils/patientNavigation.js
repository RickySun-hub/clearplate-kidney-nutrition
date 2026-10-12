export const PATIENT_PAGES = ['today', 'planner', 'recipes', 'history'];
export function patientPageFromHash(hash) {
  const match = /^#patient\/(today|planner|recipes|history)$/.exec(hash || '');
  return match ? match[1] : null;
}
export function patientPageHash(page) {
  if (!PATIENT_PAGES.includes(page)) throw new Error('Unknown patient page.');
  return '#patient/' + page;
}
export function writePatientPage(page, browser = window, replace = false) {
  const hash = patientPageHash(page);
  if (browser.location.hash === hash) return false;
  browser.history[replace ? 'replaceState' : 'pushState'](null, '', browser.location.pathname + browser.location.search + hash);
  return true;
}
