import { Smartphone } from 'lucide-react';
import GoogleMark from './GoogleMark';
import { useEffect, useRef, useState } from 'react';
import { createCareCloud } from '../utils/careCloud';
import './care-connection.css';

export default function CareConnection({ mode = 'patient', requestedMode = 'signin', onAuthModeChange, onGoogleAvailability, getRecord, onReviewRecord, onSessionChange }) {
  const client = useRef(null);
  const mountedRef = useRef(false);
  const busyRef = useRef(false);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const callbacks = useRef({ onReviewRecord, onSessionChange });
  callbacks.current = { onReviewRecord, onSessionChange };
  const [authMode, setAuthMode] = useState('signin');
  useEffect(()=>{if(['signin','signup'].includes(requestedMode))setAuthMode(requestedMode);},[requestedMode]);
  const [googleAvailable, setGoogleAvailable] = useState(false);
  const [loginMethod, setLoginMethod] = useState('email');
  const [emailStep, setEmailStep] = useState(false);
  const [phoneAvailable, setPhoneAvailable] = useState(false);
  const [phone, setPhone] = useState('+1 ');
  const [otp, setOtp] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!sentTo) return; const id=setInterval(()=>setNow(Date.now()),1000); return ()=>clearInterval(id); }, [sentTo]);
  const [ready, setReady] = useState(false);
  const [account, setAccount] = useState(null);
  const accountRef = useRef(account);
  accountRef.current = account;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [readerId, setReaderId] = useState('');
  const [grants, setGrants] = useState([]);
  const [patients, setPatients] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Checking cloud connection…');
  const isRD = mode === 'rd';
  useEffect(() => {
    let mounted = true;
    mountedRef.current = true;
    fetch('/api/care-config', { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) throw new Error();
      const config = await response.json();
      if (!mounted) return;
      client.current = createCareCloud(config);
      setReady(true); setMessage('');
      client.current.phoneAvailable().then(enabled=>{if(mounted)setPhoneAvailable(enabled);}).catch(()=>{});
      client.current.googleAvailable().then(enabled => { if (mounted) { setGoogleAvailable(enabled); onGoogleAvailability?.(enabled); } }).catch(() => {});
      try {
        const user = await client.current.finishGoogleSignIn();
        if (mounted && user) { setAccount(user); callbacks.current.onSessionChange?.({ accessToken: client.current.accessToken(), account: user }); setMessage('Signed in with Google.'); }
      } catch (error) { if (mounted) setMessage(error.message); }
    }).catch(() => { if (mounted) setMessage('Cloud connection is not available yet. Your local record stays on this device.'); });
    const timer = window.setInterval(() => {
      if (accountRef.current && !client.current?.accessToken()) {
        client.current.clearSession(); setAccount(null); setGrants([]); setPatients([]);
        callbacks.current.onSessionChange?.(null); callbacks.current.onReviewRecord?.(null);
        setMessage('Your session expired. Please sign in again.');
      }
    }, 30000);
    return () => { mounted = false; mountedRef.current = false; clearInterval(timer); client.current?.dispose(); callbacks.current.onSessionChange?.(null); callbacks.current.onReviewRecord?.(null); };
  }, []);
  useEffect(() => {
    if (!account) return;
    let current = true;
    (isRD ? client.current.shared() : client.current.grants()).then((rows) => {
      if (current) { if (isRD) setPatients(rows); else setGrants(rows); }
    }).catch(() => { if (current) {
      setMessage('Could not refresh account access. Please refresh or sign in again.');
      if (!client.current?.accessToken()) { setAccount(null); setGrants([]); setPatients([]); callbacks.current.onSessionChange?.(null); callbacks.current.onReviewRecord?.(null); }
    } });
    return () => { current = false; };
  }, [isRD, account?.id]);
  async function action(operation) {
    if (busyRef.current || !mountedRef.current) return;
    busyRef.current = true;
    setBusy(true); setMessage('');
    try { await operation(); }
    catch (error) {
      if (!mountedRef.current) return;
      setMessage(error.message || 'Cloud action could not be completed.');
      if (!client.current?.accessToken()) {
        setAccount(null); setGrants([]); setPatients([]);
        callbacks.current.onSessionChange?.(null); callbacks.current.onReviewRecord?.(null);
      }
    } finally { busyRef.current = false; if (mountedRef.current) setBusy(false); }
  }
  useEffect(() => {
    if (ready && requestedMode === 'google') {
      onAuthModeChange?.('signin');
      action(() => client.current.signInWithGoogle());
    }
  }, [ready, requestedMode]);
  async function authenticate(signup) {
    await action(async () => {
      let user;
      try { user = await client.current[signup ? 'signUp' : 'signIn'](email, password); }
      finally { if (mountedRef.current) setPassword(''); }
      setAccount(user);
      if (!user) { setMessage('Check your email to confirm your account, then sign in.'); return; }
      callbacks.current.onSessionChange?.({ accessToken: client.current.accessToken(), account: user });
      setMessage('Signed in. Your account ID is shown below.');

    });
  }
  return <section className="care-connection" aria-labelledby="care-connection-title">
    <header><h2 id="care-connection-title">{!account ? 'Your ClearPlate account' : isRD ? 'Connect to shared patient records' : 'Your account & care records'}</h2><p>{!account ? 'Sign in to use voice assistance and securely save your record. New here? Create an account first.' : isRD ? 'Use your own account. Patients grant access using your account ID.' : 'Your record uploads only when you choose. You control which care-team account can read it.'}</p></header>
    {ready && !account && <form onSubmit={(event) => {
      event.preventDefault();
      if (loginMethod === 'phone') {
        action(async () => {
          if (!sentTo) { await client.current.sendPhoneCode(phone); setSentTo(phone.replace(/[\s()-]/g,'')); setResendAt(Date.now()+60000); setNow(Date.now()); setMessage('Enter the code from your text message.'); }
          else { const user=await client.current.verifyPhoneCode(sentTo,otp); setAccount(user); setOtp(''); callbacks.current.onSessionChange?.({accessToken:client.current.accessToken(),account:user}); setMessage('Signed in.'); }
        });
      } else if (!emailStep) { setEmailStep(true); }
      else authenticate(authMode === 'signup');
    }}>
      <p className="auth-intro">New here? Continue with Google or create an account with your email.</p>
      <button className="google-signin" type="button" disabled={busy || !googleAvailable} onClick={() => action(() => client.current.signInWithGoogle())}><GoogleMark />Continue with Google</button>
      {!googleAvailable && <p className="care-help">Google sign-in is being set up. You can use email below.</p>}
      <button className="google-signin phone-signin" type="button" disabled={busy} aria-expanded={loginMethod==='phone'} onClick={()=>{setLoginMethod(loginMethod==='phone'?'email':'phone');setMessage('');}}><Smartphone size={19} aria-hidden="true" />Continue with phone{!phoneAvailable && <small>Coming soon</small>}</button>
      {loginMethod==='phone' ? <>
        <div className="auth-divider">use a text message code</div>
        {!phoneAvailable && <p className="phone-notice" role="status">Phone sign-in is not available yet. Please continue with Google or email.</p>}
        <label>Mobile phone number<input type="tel" inputMode="tel" autoComplete="tel" placeholder="+1 555 123 4567" required disabled={!phoneAvailable || !!sentTo} value={phone} onChange={e=>setPhone(e.target.value)} /></label>
        <p className="care-help">Include your country code, such as +1 for the US and Canada. We will text you a sign-in code.</p>
        {sentTo && <label>Verification code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,''))} /></label>}
        <div className="care-actions"><button className="account-submit" disabled={busy || !phoneAvailable}>{busy?'Please wait…':sentTo?'Verify and continue':'Send code'}</button></div>
        {sentTo && <><button className="auth-text-action" type="button" disabled={busy || now<resendAt} onClick={()=>action(async()=>{await client.current.sendPhoneCode(sentTo);setResendAt(Date.now()+60000);setNow(Date.now());setMessage('A new code was sent.');})}>{now<resendAt?`Resend in ${Math.ceil((resendAt-now)/1000)}s`:'Resend code'}</button><button className="auth-text-action" type="button" disabled={busy} onClick={()=>{setSentTo('');setOtp('');setMessage('');}}>Use a different number</button></>}
        <button type="button" className="auth-text-action" disabled={busy} onClick={()=>{setLoginMethod('email');setMessage('');}}>Use email instead</button>
      </> : <>
        <div className="auth-divider">or use email</div>
        <label>Email<input autoComplete="username" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        {emailStep && <><label>Password<input autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} type="password" minLength="8" required value={password} onChange={(event) => setPassword(event.target.value)} /></label><p className="care-help">{authMode==='signup'?'Use at least 8 characters. We will email you a confirmation link.':'Enter the password for your ClearPlate account.'}</p></>}
        <div className="care-actions"><button className="account-submit" disabled={busy} type="submit">{busy ? 'Please wait…' : !emailStep ? 'Continue with email' : authMode === 'signup' ? 'Create account' : 'Sign in'}</button></div>
        <button className="auth-text-action" type="button" disabled={busy} onClick={()=>{setEmailStep(true);setAuthMode(authMode==='signup'?'signin':'signup');setMessage('');}}>{authMode==='signup'?'Already have an account? Sign in':'New here? Create an email account'}</button>
      </>}
      <p className="care-help auth-footnote">You choose when to share your food record with your care team.</p>
      <button className="auth-text-action auth-back" type="button" onClick={()=>onAuthModeChange?.('home')}>Back to home</button>
    </form>}
    {account && <>
      <div className="care-account"><strong>{account.email || account.phone || 'Signed-in account'}</strong><label>Your account ID<input readOnly value={account.id} onFocus={(event) => event.target.select()} /></label><button disabled={busy} type="button" onClick={() => action(async () => {
        setAccount(null); setGrants([]); setPatients([]); callbacks.current.onSessionChange?.(null); callbacks.current.onReviewRecord?.(null);
        await client.current.signOut();
        setMessage('Signed out.');
      })}>Sign out</button></div>
      {isRD ? <div className="care-shared">
        <button disabled={busy} type="button" onClick={() => action(async () => { setPatients(await client.current.shared()); setMessage('Shared record list refreshed.'); })}>Refresh shared patients</button>
        <p className="care-help">Opening a record retrieves the latest uploaded snapshot. Changes on the patient’s device appear after they upload again.</p>
        {patients.length ? <ul>{patients.map((patient) => <li key={patient.owner_id}><span>Patient account <code>{patient.owner_id}</code><small>Updated {new Date(patient.updated_at).toLocaleString()}</small></span><button disabled={busy} type="button" onClick={() => action(async () => {
          callbacks.current.onReviewRecord?.(null);
          const latest = await client.current.read(patient.owner_id);
          if (!mountedRef.current || modeRef.current !== 'rd') return;
          callbacks.current.onReviewRecord?.(latest.record, { ownerId: latest.owner_id, updatedAt: latest.updated_at });
          setMessage('Shared snapshot opened for review.');
        })}>Review record</button></li>)}</ul> : <p>No patient records are shared with this account.</p>}
      </div> : <div className="care-owner">
        <button className="care-upload" disabled={busy || !getRecord} type="button" onClick={() => action(async () => { await client.current.upload(getRecord()); setMessage('Current record uploaded privately. Only you and accounts you grant can read it.'); })}>Upload current record</button>
        <p className="care-help">This replaces your previous cloud snapshot with your current profile, meal entries and saved daily records. Future local edits stay local until you upload again.</p>
        <form onSubmit={(event) => { event.preventDefault(); action(async () => { await client.current.grant(readerId); setReaderId(''); setGrants(await client.current.grants()); setMessage('Read access granted to this account.'); }); }}>
          <label>RD account ID<input required placeholder="Ask your RD for their account ID" value={readerId} onChange={(event) => setReaderId(event.target.value)} /></label><button disabled={busy} type="submit">Grant read access</button>
        </form>
        <p className="care-help">Verify the account ID with your RD before granting access. This grants access to your uploaded snapshot and later uploads.</p>
        {grants.length > 0 && <ul>{grants.map((grant) => <li key={grant.reader_id}><code>{grant.reader_id}</code><button disabled={busy} type="button" onClick={() => action(async () => { await client.current.revoke(grant.reader_id); setGrants(await client.current.grants()); setMessage('Access revoked. Previously viewed or downloaded copies cannot be recalled.'); })}>Revoke access</button></li>)}</ul>}
      </div>}
    </>}
    {message && <p className="care-status" role="status" aria-live="polite">{message}</p>}
  </section>;
}
