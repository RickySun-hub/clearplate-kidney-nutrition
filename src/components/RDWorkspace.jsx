import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, RefreshCw, UserPlus } from 'lucide-react';
import CareInvitations from './CareInvitations';
import RDDashboard from './RDDashboard';
import baseRecipes from '../data/recipes.json';
import { createPatientReview, patientDirectory, filterPatients, pendingInvitations } from '../utils/rdWorkspace.js';
import './RDDashboard.css';

const timestamp = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString() : 'No saved record';
export default function RDWorkspace({ client, account, onSignOut, busy, accountMessage, demo = false, displayName }) {
  const [localHour, setLocalHour] = useState(() => new Date().getHours());
  useEffect(() => { const update = () => setLocalHour(new Date().getHours()); const timer = setInterval(update, 60000); window.addEventListener('focus', update); return () => { clearInterval(timer); window.removeEventListener('focus', update); }; }, []);
  const greeting = localHour < 12 ? 'Good morning' : localHour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = typeof displayName === 'string' ? displayName.trim().split(/\s+/)[0] : '';
  const controller = useRef(null);
  const [state, setState] = useState({ patients: [], invitations: [], selectedId: null, record: null, loading: true, opening: false, error: '' });
  const [page, setPage] = useState('patients'), [search, setSearch] = useState(''), [status, setStatus] = useState('all');
  useEffect(() => {
    const review = createPatientReview(client, setState); controller.current = review;
    let running = false;
    const refresh = async () => { if (running || document.hidden) return; running = true; try { await review.refresh(); } finally { running = false; } };
    refresh(); const timer = setInterval(refresh, 15000); window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); review.dispose(); };
  }, [client, account.id]);
  const directory = patientDirectory(state.patients, state.invitations, account.id);
  const patients = filterPatients(directory, search, status);
  const waiting = directory.filter(patient => patient.noRecord).length;
  const pending = pendingInvitations(state.invitations, account.id).length;
  const go = next => { controller.current?.close(); setPage(next); };
  const record = state.record;
  return <main className="rd-workbench">
    <header className="rd-workbench-bar"><a href="#rd-signin" onClick={e => { e.preventDefault(); go('patients'); }} className="rd-wordmark">Nepholio <span>Dietitian workspace</span></a><details className="rd-account-menu"><summary>Account</summary><div><strong>{account.email || account.phone || 'Signed in'}</strong><label>Account ID<input readOnly value={account.id} /></label><p>{demo ? 'Demo account · fictional data only.' : 'Patient consent controls access to each file.'}</p><button onClick={onSignOut} disabled={busy}>Sign out</button></div></details></header>
    {demo && <section className="rd-demo-banner" role="note"><h2 className="rd-greeting">{greeting}{firstName ? `, RD ${firstName}` : ''}.</h2><strong>RD demo · Simulated patients</strong><span>Explore fictional food logs and nutrition summaries. No real patient records are connected. Invitations and sharing are unavailable in this demo.</span></section>}
    {accountMessage && <p className="rd-feedback" role="status">{accountMessage}</p>}
    {state.error && <div className="rd-feedback" role="alert">{state.error}<button onClick={() => controller.current?.refresh()}>Retry</button></div>}
    {page !== 'patients' ? <section className="rd-directory-page"><button className="rd-back" onClick={() => go('patients')}><ArrowLeft size={17} />Patients</button><CareInvitations key={`${account.id}-${page}`} client={client} account={account} isRD initialFormOpen={page === 'invite'} onChanged={() => controller.current?.refresh()} /></section>
      : state.selectedId ? state.opening ? <section className="rd-empty" aria-busy="true"><button className="rd-back" onClick={() => controller.current?.close()}><ArrowLeft size={17} />Patients</button><p role="status">Opening patient file…</p></section>
      : record && <RDDashboard key={state.selectedId} entries={record.entries} profile={record.profile} dayRecords={record.dayRecords} recipesById={Object.fromEntries([...baseRecipes, ...(record.customRecipes || [])].map(r => [r.id, r]))} sharedIdentity={state.selectedId} updatedAt={state.updatedAt} onBack={() => controller.current?.close()} />
      : <section className="rd-directory-page" aria-labelledby="rd-directory-title">
        <div className="rd-directory-title"><div><h1 id="rd-directory-title">Patients</h1><p>Open a shared record to review its food log.</p></div><button className="secondary-button" disabled={demo} onClick={() => go('invite')}><UserPlus size={17} />Invite patient</button></div>
        {!state.loading && (pending > 0 || waiting > 0) && <aside className="rd-followups" aria-label="Connection follow-up"><strong>Follow-up</strong>{pending > 0 && <button onClick={() => go('invitations')}>{pending} invitation{pending === 1 ? '' : 's'} awaiting acceptance<ArrowUpRight size={15} /></button>}{waiting > 0 && <button onClick={() => { setSearch(''); setStatus('waiting'); }}>{waiting} connected patient{waiting === 1 ? '' : 's'} awaiting a shared record<ArrowUpRight size={15} /></button>}</aside>}
        <div className="rd-directory-controls"><label>Search connected patients<input type="search" placeholder="Name, full email or file ID" aria-describedby="rd-search-help" value={search} onChange={e => setSearch(e.target.value)} /></label><label>Connection<select value={status} onChange={e => setStatus(e.target.value)}><option value="all">All connections</option><option value="record">Shared record available</option><option value="waiting">Awaiting shared record</option></select></label><button className="rd-icon-button" aria-label="Refresh patients" onClick={() => controller.current?.refresh()}><RefreshCw size={18} /></button><button className="rd-text-button" disabled={demo} onClick={() => go('invitations')}>Invitation history</button></div>
        <p id="rd-search-help" className="rd-search-help">Search by name, full email address or file ID. Only connected patients appear here.</p>
        {state.loading ? <p className="rd-empty" role="status">Loading shared patients…</p> : <><p className="rd-result-count" role="status">{patients.length} of {directory.length} connected patients</p><div className="rd-patient-table"><div className="rd-patient-head" aria-hidden="true"><span>Patient</span><span>Connection</span><span>Record information</span><span /></div>{patients.map(patient => <div className="rd-patient-row" key={patient.owner_id}><div><strong>{patient.profile?.name || 'Name not recorded'}</strong><small>{patient.email || `File ${patient.owner_id.slice(0, 8)}`}</small></div><span className="rd-connection-status">{patient.noRecord ? 'Awaiting shared record' : 'Shared record available'}</span><div className="rd-record-summary"><span>{patient.noRecord ? 'No shared file yet' : 'Last meal & completeness: open to view'}</span><small>{patient.noRecord ? 'Connection accepted. Waiting for the patient to sync a record.' : <>File updated <time dateTime={patient.updated_at || undefined}>{timestamp(patient.updated_at)}</time></>}</small></div><button className="primary-button" disabled={patient.noRecord} onClick={() => controller.current?.open(patient.owner_id)} aria-label={`Open patient ${patient.profile?.name || patient.owner_id}`}>Open<ArrowUpRight size={17} /></button></div>)}</div>{!patients.length && <div className="rd-empty workspace-empty"><h2>{directory.length ? 'No matching patients' : 'No shared patient records yet'}</h2><p>{directory.length ? 'Try another name, a complete email address or a connection filter.' : 'A patient must grant access or accept an invitation before a record becomes available.'}</p>{directory.length > 0 && <button className="secondary-button" onClick={() => { setSearch(''); setStatus('all'); }}>Clear search & filters</button>}</div>}</>}
        <p className="rd-directory-footnote">Access is checked about every 15 seconds while this workspace is open and visible. The directory contains file timestamps only. Open a patient to check meal dates and recording completeness; a saved file does not establish that any meals were recorded.</p>
      </section>}
  </main>;
}
