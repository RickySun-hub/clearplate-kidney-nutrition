import { useEffect, useRef, useState } from 'react';
import { RD_IDENTITY_FIELDS, rdTransitions } from '../utils/rdAccess';

export default function RDAdministration({ client }) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(null), [checked, setChecked] = useState(false), [reason, setReason] = useState('');
  const [invite, setInvite] = useState({}), [inviteChecked, setInviteChecked] = useState(false), [inviteReason, setInviteReason] = useState('');
  const alive = useRef(false), revision = useRef(0), lock = useRef(false);
  async function load() {
    const version = ++revision.current;
    try {
      const [applications, invitations, audit] = await Promise.all(['list','invitations','audit'].map(action => client.rdAccess(action)));
      if (alive.current && version === revision.current) { setData({ applications, invitations, audit }); setError(''); }
    } catch (e) { if (alive.current && version === revision.current) { setData(null); setSelected(null); setError(e.message); } }
  }
  useEffect(() => { alive.current = true; load(); return () => { alive.current = false; revision.current++; }; }, [client]);
  async function mutate(action, payload) {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try { await client.rdAccess(action, payload); if (alive.current) { setSelected(null); setChecked(false); setReason(''); await load(); } }
    catch (e) { if (alive.current) { setError(e.message); setData(null); setSelected(null); } }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  const link = id => `${window.location.origin}/#rd-invite/${id}`;
  return <main className="rd-access rd-admin"><h1>RD access review</h1><p>Review identity and qualification independently before approving. Email verification alone is not evidence of professional qualification.</p>
    <button disabled={busy} onClick={load}>Reload applications</button>
    {error && <p role="alert">{error} Reload before retrying; a timed-out action may already have completed.</p>}
    {!data && !error && <p role="status">Loading applications…</p>}
    {data && <><section><h2>Applications</h2>{!data.applications.length && <p>No applications.</p>}
      {data.applications.map(a => <article className="rd-access-row" key={a.user_id}><div><strong>{a.name}</strong><p>{a.email} · {a.institution}</p><small>{a.status} · Email {a.email_verified ? 'verified and matching' : 'unverified or changed'} · Qualification {a.qualification_checked ? 'check recorded' : 'not checked'}</small></div><button disabled={busy} onClick={() => { setSelected(a); setChecked(false); setReason(''); }}>Review {a.name}</button></article>)}
      {selected && <section className="rd-review-form"><h3>Review {selected.name}</h3><p>{selected.email}</p><p>{selected.qualification} · {selected.issuer}</p><p>Current state: {selected.status}</p>
        <label className="rd-check"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} />I independently checked this person’s identity, matching email and qualification.</label>
        <label>Review reason<textarea required maxLength={500} value={reason} onChange={e => setReason(e.target.value)} /></label>
        <div className="rd-access-actions">{rdTransitions(selected.status).map(status => <button key={status} disabled={busy || !reason.trim() || status === 'approved' && (!checked || !selected.email_verified)} onClick={() => mutate('decide', { userId: selected.user_id, version: selected.version, status, qualificationChecked: checked, reason })}>{status === 'approved' ? 'Approve' : status === 'rejected' ? 'Reject' : status === 'suspended' ? 'Suspend' : 'Revoke'}</button>)}<button onClick={() => setSelected(null)}>Cancel review</button></div>
      </section>}</section>
      <details><summary>Invite a known RD</summary><p>Confirm their identity and email independently first. A link is created here; no email is sent automatically.</p>
        <form onSubmit={e => { e.preventDefault(); mutate('invite', { ...invite, qualificationChecked: inviteChecked, reason: inviteReason }); }}>
          <label>Recipient email<input type="email" required maxLength={254} value={invite.email || ''} onChange={e => setInvite({ ...invite, email: e.target.value })} /></label>
          {RD_IDENTITY_FIELDS.map(([key,label,max]) => <label key={key}>{label}<input required maxLength={max} value={invite[key] || ''} onChange={e => setInvite({ ...invite, [key]: e.target.value })} /></label>)}
          <label className="rd-check"><input type="checkbox" required checked={inviteChecked} onChange={e => setInviteChecked(e.target.checked)} />Identity, email and qualification independently checked</label>
          <label>Review reason<textarea required maxLength={500} value={inviteReason} onChange={e => setInviteReason(e.target.value)} /></label><button disabled={busy}>Create seven-day invitation</button>
        </form>
      </details>
      <section><h2>RD invitations</h2>{data.invitations.map(i => <article className="rd-access-row" key={i.id}><div><strong>{i.name}</strong><p>{i.email} · {i.status}</p><small>Expires {new Date(i.expires_at).toLocaleString()}</small>{i.status === 'pending' && <label>Invitation link<input readOnly value={link(i.id)} onFocus={e => e.target.select()} /></label>}</div>{i.status === 'pending' && <button disabled={busy} onClick={() => mutate('cancel_invite', { id: i.id })}>Cancel invitation</button>}</article>)}</section>
      <details><summary>Audit history · latest 200 events</summary>{data.audit.map(event => <article className="rd-audit-row" key={event.id}><strong>{event.action} · {event.from_status || '—'} → {event.to_status || '—'}</strong><p>{event.reason}</p><small>{new Date(event.created_at).toLocaleString()} · Actor {event.actor_id} · Subject {event.subject_id || event.invitation_id}</small></article>)}</details>
    </>}
  </main>;
}
