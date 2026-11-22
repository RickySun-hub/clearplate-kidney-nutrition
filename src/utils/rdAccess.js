export const RD_IDENTITY_FIELDS = [['name','Full name',100],['institution','Institution / practice',200],['qualification','Qualification number / identifier',200],['issuer','Issuing organization',200]];
export const rdTransitions = status => ({ pending:['approved','rejected'], approved:['suspended','revoked'], suspended:['approved','revoked'] }[status] || []);
// UI state only. The database enforces every privilege and state transition.
export function createAccessLoader(fetchStatus, onState) {
  let version = 0, disposed = false;
  return {
    async refresh() {
      const request = ++version;
      try {
        const access = await fetchStatus();
        if (!access || typeof access.approved !== 'boolean' || typeof access.isAdmin !== 'boolean') throw Error('RD access is unavailable. Contact the administrator.');
        if (!disposed && version === request) onState({ access, error:'' });
      } catch (e) { if (!disposed && version === request) onState({ access:null, error:e.message || 'Could not verify RD access.' }); }
    },
    dispose() { disposed = true; version++; },
  };
}
export function captureRDInvitation(browser = window) {
  const match = /^#rd-invite\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.exec(browser.location.hash);
  if (!match) return false;
  try { browser.sessionStorage.setItem('nepholio-rd-invite',match[1]); browser.sessionStorage.setItem('renalsync-login-destination','rd'); } catch {}
  return true;
}
