export const PATIENT_PAGES = ['today', 'recipes', 'history', 'connection'];
export function patientPageFromHash(hash) {
  if (hash === '#patient/planner') return 'today';
  const match = /^#patient\/(today|recipes|history|connection)$/.exec(hash || '');
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

// Only local navigation metadata is retained. It never grants access to records.
export function openWorkspacePage(page, accountId, browser = window) {
  const hash = page === 'food-submissions' ? '#food-submissions' : patientPageHash(page);
  if (browser.location.hash === hash) return false;
  const from = patientPageFromHash(browser.location.hash) || 'rd';
  browser.history.pushState({ workspaceReturn: { accountId, from, hash } }, '', browser.location.pathname + browser.location.search + hash);
  return true;
}
export function workspaceReturnPage(accountId, isDietitian, browser = window) {
  const route = browser.history.state?.workspaceReturn;
  const fallback = isDietitian ? 'rd' : 'today';
  if (!accountId || route?.accountId !== accountId || route.hash !== browser.location.hash) return fallback;
  if (isDietitian) return 'rd';
  return PATIENT_PAGES.includes(route.from) ? route.from : fallback;
}
export function hasWorkspaceReturn(accountId, browser = window) {
  const route = browser.history.state?.workspaceReturn;
  return Boolean(accountId && route?.accountId === accountId && route.hash === browser.location.hash);
}

// A return can unmount its button between two clicks. Capture the remaining
// clicks in that gesture before they activate a newly exposed control.
export function createReturnClickGuard() {
  let armed = false;
  return {
    arm(event) { armed = event?.detail > 0; },
    reset() { armed = false; },
    capture(event) {
      if (armed && event.detail > 1) {
        event.preventDefault();
        event.stopPropagation();
        return true;
      }
      // Keyboard activation (0) and a new single click (1) are never delayed.
      armed = false;
      return false;
    },
  };
}
