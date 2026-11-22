import RDAccessGate from './RDAccessGate';
import { Smartphone } from 'lucide-react';
import CareInvitations from './CareInvitations';
import GoogleMark from './GoogleMark';
import { useEffect, useRef, useState } from 'react';
import { createCareCloud } from '../utils/careCloud';
import { signOutAccount } from '../utils/accountNavigation.js';
import './care-connection.css';

export default function CareConnection({ onBack, backLabel="Back to Today", initialNotice="", profileName, mode = 'patient', requestedMode = 'signin', onAuthModeChange, onGoogleAvailability, onSync, syncStatus, onReviewRecord, onSessionChange, onInvitationCount, onSignOut }) {
  const client = useRef(null);
  const mountedRef = useRef(false);
  const busyRef = useRef(false);
  const callbacks = useRef({ onReviewRecord, onSessionChange, onSignOut });
  callbacks.current = { onReviewRecord, onSessionChange, onSignOut };
  const [authMode, setAuthMode] = useState('signin');
  useEffect(()=>{if(['signin','signup','rd-signin'].includes(requestedMode)){setAuthMode(requestedMode==='signup'?'signup':'signin');setLoginMethod('email');setEmailStep(false);}},[requestedMode]);
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
      setReady(true); setMessage(initialNotice);
      client.current.phoneAvailable().then(enabled=>{if(mounted)setPhoneAvailable(enabled);}).catch(()=>{});
      client.current.googleAvailable().then(enabled => { if (mounted) { setGoogleAvailable(enabled); onGoogleAvailability?.(enabled); } }).catch(() => {});
      try {
        const user = await client.current.finishGoogleSignIn() || await client.current.restoreSession();
        if (mounted && user) { setAccount(user); callbacks.current.onSessionChange?.({ accessToken: client.current.accessToken(), account: user, client: client.current }); setMessage(''); }
      } catch (error) { if (mounted) setMessage(error.message); }
    }).catch(() => { if (mounted) setMessage('Cloud connection is not available yet. Your local record stays on this device.'); });
    const renew = async () => {
      const active = client.current;
      if (!mounted || !active || busyRef.current) return;
      try {
        const before = active.accessToken();
        const user = await active.restoreSession();
        if (!mounted || active !== client.current) return;
        if (user && (!accountRef.current || before !== active.accessToken())) {
          setAccount(user); callbacks.current.onSessionChange?.({accessToken:active.accessToken(),account:user,client:active});
        } else if (!user && accountRef.current) {
          setAccount(null); setGrants([]); setPatients([]); callbacks.current.onSessionChange?.(null);
        }
      } catch { if(mounted) setMessage('Could not reconnect. Your saved sign-in will be retried.'); }
    };
    const storageChanged = event => {
      if (event.key !== client.current?.storageKey) return;
      if (!event.newValue) { client.current?.forgetSession(); setAccount(null); setGrants([]); setPatients([]); callbacks.current.onSessionChange?.(null); callbacks.current.onReviewRecord?.(null); }
      else { client.current?.forgetSession(); void renew(); }
    };
    const timer = window.setInterval(renew,30000);
    window.addEventListener('focus',renew);
    window.addEventListener('storage',storageChanged);
    return () => { mounted = false; mountedRef.current = false; clearInterval(timer); window.removeEventListener('focus',renew); window.removeEventListener('storage',storageChanged); client.current?.dispose(); };
  }, []);
  useEffect(() => {
    if (!account || isRD) return;
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
      try { user = await client.current[signup ? 'signInOrSignUp' : 'signIn'](email, password); }
      catch (error) { if (signup && mountedRef.current) setAuthMode('signin'); throw error; }
      finally { if (mountedRef.current) setPassword(''); }
      setAccount(user);
      if (!user) {
        setAuthMode('signin');
        setMessage('Check your inbox and spam folder if this is a new account, then sign in below after confirming your email. Already registered? Sign in with your original password or Google. Creating an account again does not reset your password. You do not need to submit registration again.');
        return;
      }
      callbacks.current.onSessionChange?.({ accessToken: client.current.accessToken(), account: user, client: client.current });
      setMessage('Signed in. Your account ID is shown below.');

    });
  }
  const logOut = () => action(async () => {
    const result = callbacks.current.onSignOut ? await callbacks.current.onSignOut(client.current) : await signOutAccount(client.current);
    if (result === false) throw new Error('Log out could not be completed. Please try again.');
    if (mountedRef.current) { setAccount(null); setGrants([]); setPatients([]); setMessage(result?.warning || 'Logged out.'); }
    if (!callbacks.current.onSignOut) { callbacks.current.onSessionChange?.(null); callbacks.current.onReviewRecord?.(null); }
  });
  if (isRD && account) return <RDAccessGate displayName={profileName} key={account.id} client={client.current} account={account} busy={busy} onSignOut={logOut} />;
  return <section className={`care-connection${isRD && account ? " rd-workspace" : ""}`} aria-labelledby="care-connection-title">
    {account && !isRD && onBack && <button type="button" className="secondary-button" onClick={onBack}>{backLabel}</button>}
    <header><h2 id="care-connection-title">{!account ? 'Your Nepholio account' : isRD ? 'Patient directory' : 'My dietitian'}</h2><p>{!account ? 'Sign in to save your food record. You stay signed in on this browser until you sign out. New here? Create an account first.' : isRD ? 'Patient files, food records, and nutrition in one place.' : 'Connect with your dietitian to share your food record. You can remove access at any time.'}</p></header>
    {ready && !account && <form onSubmit={(event) => {
      event.preventDefault();
      if (loginMethod === 'phone') {
        action(async () => {
          if (!sentTo) { await client.current.sendPhoneCode(phone); setSentTo(phone.replace(/[\s()-]/g,'')); setResendAt(Date.now()+60000); setNow(Date.now()); setMessage('Enter the code from your text message.'); }
          else { const user=await client.current.verifyPhoneCode(sentTo,otp); setAccount(user); setOtp(''); callbacks.current.onSessionChange?.({accessToken:client.current.accessToken(),account:user,client:client.current}); setMessage('Signed in.'); }
        });
      } else if (!emailStep) { setEmailStep(true); }
      else authenticate(authMode === 'signup');
    }}>
      <p className="auth-intro">{requestedMode==='rd-signin'?'Use your Google account or work email. Patient access is managed separately.':authMode==='signup'?'Create an account, or use your existing email and password to return to your account.':'Welcome back. Sign in with your existing email and password or Google.'}</p>
      <button className="google-signin" type="button" disabled={busy || !googleAvailable} onClick={() => action(() => {try{if(requestedMode==='rd-signin')sessionStorage.setItem('renalsync-login-destination','rd');}catch{}return client.current.signInWithGoogle();})}><GoogleMark />Continue with Google</button>
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
        {emailStep && <><label>Password<input autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} type="password" minLength="8" required value={password} onChange={(event) => setPassword(event.target.value)} /></label><p className="care-help">{authMode==='signup'?'Use at least 8 characters. We will email you a confirmation link.':'Enter the password for your Nepholio account.'}</p></>}
        <div className="care-actions"><button className="account-submit" disabled={busy} type="submit">{busy ? 'Please wait…' : !emailStep ? 'Continue with email' : authMode === 'signup' ? 'Create account' : 'Sign in'}</button></div>
        <button className="auth-text-action" type="button" disabled={busy} onClick={()=>{setEmailStep(true);setAuthMode(authMode==='signup'?'signin':'signup');setMessage('');}}>{authMode==='signup'?'Already have an account? Sign in':'New here? Create an email account'}</button>
      </>}
      <p className="care-help auth-footnote">{isRD ? 'Patients choose which food records to share with you. Sign in to review records shared with your dietitian account.' : 'You choose when to share your food record with your care team.'}</p>
      {requestedMode==='rd-signin'&&<button className="auth-text-action" type="button" onClick={()=>onAuthModeChange?.('signin')}>Here to track your meals? Patient sign in →</button>}
      <button className="auth-text-action auth-back" type="button" onClick={()=>onAuthModeChange?.('home')}>Back to home</button>
    </form>}
    {account && <>
      <details className="care-account-details"><summary>Account & patient access</summary><div className="care-account"><strong>{account.email || account.phone || 'Signed-in account'}</strong><label>Your account ID<input readOnly value={account.id} onFocus={(event) => event.target.select()} /></label><button disabled={busy} type="button" onClick={logOut}>Log out</button></div><p className="care-help">This identifies your signed-in account. To switch accounts, log out first.</p></details>
      <CareInvitations key={account.id} client={client.current} account={account} isRD={false} onConnections={rows=>onInvitationCount?.(rows.filter(i=>i.reader_id!==account.id&&i.status==='pending').length)} onChanged={()=>{client.current.grants().then(setGrants).catch(()=>{});}} />
      <div className="care-owner">
        <p className="care-help" role="status">{syncStatus || 'Changes save automatically to your private account.'}</p>
        <button className="care-upload" disabled={busy} type="button" onClick={()=>onSync?.()}>Refresh cloud record</button>
        <details><summary>Connect using an RD account ID</summary><form onSubmit={(event) => { event.preventDefault(); action(async () => { await client.current.grant(readerId); setReaderId(''); setGrants(await client.current.grants()); setMessage('Read access granted to this account.'); }); }}>
          <label>RD account ID<input required placeholder="Ask your RD for their account ID" value={readerId} onChange={(event) => setReaderId(event.target.value)} /></label><button disabled={busy} type="submit">Grant read access</button>
        </form>
        <p className="care-help">Verify the account ID with your RD before granting access. This grants access to your cloud record and future confirmed changes.</p></details>
        {grants.length === 0 && <p>No dietitian has access through a saved connection. Review an invitation above, or ask your dietitian for one.</p>}
        {grants.length > 0 && <ul>{grants.map((grant) => <li key={grant.reader_id}><code>{grant.reader_id}</code><button disabled={busy} type="button" onClick={() => action(async () => { await client.current.revoke(grant.reader_id); setGrants(await client.current.grants()); setMessage('Access revoked. Previously viewed or downloaded copies cannot be recalled.'); })}>Revoke access</button></li>)}</ul>}
      </div>
    </>}
    {message && <p className="care-status" role="status" aria-live="polite">{message}</p>}
  </section>;
}
