// Discard implicit email-link tokens from the address bar. Email confirmation
// is completed by Auth before redirect; the user then signs in normally.
export function consumeEmailLinkResult(browser){
 const url=new URL(browser.location.href),params=new URLSearchParams(url.hash.slice(1));
 if(!params.has('access_token')&&!params.has('error'))return '';
 const failed=params.has('error');
 url.hash='signin';browser.history.replaceState(null,'',url.pathname+url.search+url.hash);
 return failed?'This email link has expired or was already used. If you already confirmed your email, sign in with your password or Google. A used confirmation link cannot be opened again.':'Your email link was opened. Sign in with your password or Google to continue.';
}
