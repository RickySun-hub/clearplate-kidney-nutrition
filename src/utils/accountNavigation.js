// Interface preference is never a grant to read another person's data.
export function defaultAccountPage(profile, requestedPage = 'today') {
  if (profile?.accountRole === 'dietitian') return 'rd';
  return ['today', 'recipes', 'history', 'connection'].includes(requestedPage) ? requestedPage : 'today';
}

export async function signOutAccount(client, onSignedOut) {
  const warning = 'Signed out on this device. Cloud logout could not be confirmed.';
  let remoteResult;
  try {
    // Attach rejection handling before yielding to the UI callback.
    remoteResult = Promise.resolve(client?.signOut()).then(() => ({ warning: '' }), () => ({ warning }));
  }
  catch { remoteResult = Promise.resolve({ warning }); }
  client?.clearSession?.();
  // Hide private UI now. Never clear it again when this request finishes: a new
  // account may have signed in while the old remote revocation was pending.
  await onSignedOut?.({ warning: '', pending: true });
  return remoteResult;
}

export function profileHasUnsavedChanges(saved, draft) {
  const canonical = value => Array.isArray(value) ? value.map(canonical)
    : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
  return JSON.stringify(canonical(saved)) !== JSON.stringify(canonical(draft));
}
