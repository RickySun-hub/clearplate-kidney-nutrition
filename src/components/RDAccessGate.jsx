import { useEffect, useMemo, useRef, useState } from 'react';
import RDWorkspace from './RDWorkspace';
import Logo from './Logo';
import { createDietitianDemo } from '../utils/rdDemo.js';
import RDAdministration from './RDAdministration';
import { createAccessLoader, RD_IDENTITY_FIELDS } from '../utils/rdAccess';
import './rd-access.css';

// Demo launch: the real cloud client is never passed into this workspace.
export default function RDAccessGate({ displayName, account, onSignOut, busy, accountMessage }) {
  const demo = useMemo(() => createDietitianDemo(), [account.id]);
  return <RDWorkspace displayName={displayName} client={demo.client} account={demo.account} onSignOut={onSignOut} busy={busy} accountMessage={accountMessage} demo />;
}

export function ReviewedRDAccessGate({ client, account, onSignOut, busy, accountMessage }) {
  const [access, setAccess] = useState(null), [error, setError] = useState(''), [checking, setChecking] = useState(true);
  const [page, setPage] = useState('workspace'), [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({}), [invite, setInvite] = useState(() => { try { return sessionStorage.getItem('nepholio-rd-invite') || ''; } catch { return ''; } });
  const loader = useRef(null), lock = useRef(false), alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    const current = createAccessLoader(() => client.rdAccess('status'), result => { setAccess(result.access); setError(result.error); setChecking(false); });
    loader.current = current; current.refresh();
    const refresh = () => { if (!document.hidden) current.refresh(); };
    const timer = setInterval(refresh, 15000); window.addEventListener('focus', refresh);
    return () => { alive.current = false; current.dispose(); clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [client, account.id]);
  async function act(action, payload) {
    if (lock.current) return; lock.current = true; setSaving(true); setError('');
    try {
      await client.rdAccess(action, payload);
      if (!alive.current) return;
      if (action === 'accept_invite') { setInvite(''); try { sessionStorage.removeItem('nepholio-rd-invite'); } catch {} }
      await loader.current.refresh();
    } catch (e) { if (alive.current) setError(e.message); }
    finally { lock.current = false; if (alive.current) setSaving(false); }
  }
  if (checking) return <main className="rd-access"><p role="status">Checking dietitian access…</p></main>;
  return <>
    {(!access?.approved || access?.isAdmin) && <nav className="rd-access-nav" aria-label="Dietitian access">{(!access?.approved || page === 'admin') && <Logo />}
      {access?.isAdmin && <><button onClick={() => setPage('workspace')}>My RD access</button><button onClick={() => setPage('admin')}>Review RD applications</button></>}
      {(!access?.approved || page === 'admin') && <><span>{account.email}</span><button disabled={busy} onClick={onSignOut}>Sign out</button></>}</nav>}
    {error && <section className="rd-access rd-access-error" role="alert"><h1>We couldn’t open your dietitian workspace.</h1><p>{error}</p><p className="rd-muted">Patient records remain private while access is unavailable.</p><button onClick={() => loader.current.refresh()}>Retry access check</button></section>}
    {page === 'admin' && access?.isAdmin ? <RDAdministration key={account.id} client={client} />
      : access?.approved ? <RDWorkspace client={client} account={account} onSignOut={onSignOut} busy={busy} accountMessage={accountMessage} />
      : access && <main className="rd-access"><p className="rd-muted">DIETITIAN ACCESS</p><h1>{access.application ? 'Your application' : 'Apply for RD access'}</h1>
        <p>RD access requires administrator review. Approval does not grant access to any patient; each patient must separately consent.</p>
        <dl><dt>Email</dt><dd>{access.email || 'No email on this account'} — {access.emailVerified ? 'Verified' : 'Not verified'}</dd><dt>Application</dt><dd>{access.application?.status || 'Not submitted'}</dd><dt>Qualification check</dt><dd>{access.application?.qualification_checked ? 'Recorded by administrator' : 'Not recorded'}</dd></dl>
        <p className="rd-muted">Email verification is not qualification verification. Do not submit identity documents or patient information.</p>
        {(!access.application || ['pending','rejected'].includes(access.application.status)) && <form onSubmit={e => { e.preventDefault(); act('submit', { ...Object.fromEntries(RD_IDENTITY_FIELDS.map(([key]) => [key, draft[key] ?? access.application?.[key] ?? ''])), version: access.application?.version }); }}>
          {RD_IDENTITY_FIELDS.map(([key,label,max]) => <label key={key}>{label}<input required maxLength={max} value={draft[key] ?? access.application?.[key] ?? ''} onChange={e => setDraft({ ...draft, [key]: e.target.value })} /></label>)}
          <button disabled={saving || !access.emailVerified}>{saving ? 'Saving…' : 'Submit for review'}</button>
        </form>}
        {['approved','suspended','revoked'].includes(access.application?.status) && <p>Contact your administrator to review this status. Patient files are unavailable.</p>}
        <details><summary>Have an administrator invitation?</summary><p>Use the account with the verified email named in the invitation. Invitations expire after seven days and can be used once.</p><form onSubmit={e => { e.preventDefault(); act('accept_invite', { id: invite.trim() }); }}><label>Invitation ID<input required value={invite} onChange={e => setInvite(e.target.value)} /></label><button disabled={saving || !access.emailVerified}>Accept RD invitation</button></form></details>
      </main>}
  </>;
}
