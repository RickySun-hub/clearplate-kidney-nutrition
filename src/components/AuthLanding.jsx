import { ArrowRight, BookOpen, Mic, Users } from 'lucide-react';
import GoogleMark from './GoogleMark';
import HowItWorks from './HowItWorks';
import RecipeShowcase from './RecipeShowcase';
import Logo from './LandingLogo';
import './auth-landing.css';

export default function AuthLanding({ page, onNavigate, googleAvailable }) {
  const publicPage = page === 'home' || page === 'how-it-works';
  function pageLink(event, destination) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate(destination);
  }
  function link(destination, label, className) {
    const current = page === destination;
    return <a href={destination === 'home' ? window.location.pathname : '#' + destination}
      aria-current={current ? 'page' : undefined} className={className || (current ? 'current' : undefined)}
      onClick={event => pageLink(event, destination)}>{label}</a>;
  }
  return <>
    <header className="public-header"><div className="public-nav">
      {link('home', <Logo />, 'public-brand')}
      <nav aria-label="Public navigation">{link('home', 'Home')}{link('how-it-works', 'How it works')}</nav>
      <div className="public-account">{link('signin', 'Sign in')}{link('signup', 'Get started', 'public-primary')}</div>
    </div></header>
    {page === 'how-it-works' ? <HowItWorks onNavigate={onNavigate} /> : page === 'home' ? (
      <main className="public-main">
        <section className="public-hero">
          <div className="hero-intro">
            <h1>Recipes for you.<br />A food log for your dietitian.</h1>
            <p className="public-hero-copy">Get recipe recommendations that fit your saved preferences. Log what you eat and share it with your registered dietitian, who can review your meals in their dashboard.</p>
            <div className="public-hero-actions">
              {link('signup', 'Create an account', 'public-primary')}
              {googleAvailable && <button className="public-secondary google-signin" onClick={() => onNavigate('google')}><GoogleMark />Sign up with Google</button>}
              {link('how-it-works', 'How it works', 'hero-text-link')}
            </div>
          </div>
          <RecipeShowcase />
        </section>
        <section className="care-flow" aria-labelledby="care-flow-title">
          <h2 id="care-flow-title">From recipe to review</h2>
          <ol className="care-flow-steps">
            <li><Mic aria-hidden="true" /><h3>You</h3><p>Tell Nepholio what you ate, or type it in. Check the portion before you save.</p><ArrowRight className="flow-arrow" aria-hidden="true" /></li>
            <li className="flow-platform"><BookOpen aria-hidden="true" /><h3>Nepholio</h3><p>Keep your meal record and find recipes that match your saved preferences and nutrient limits.</p><ArrowRight className="flow-arrow" aria-hidden="true" /></li>
            <li><Users aria-hidden="true" /><h3>Your dietitian</h3><p>When you share your log, your dietitian can review your meals and portions in their dashboard.</p></li>
          </ol>
          <div className="flow-return"><p><strong>Back to you</strong> Discuss your dietitian’s suggestions and use them to plan your next meal.</p></div>
        </section>
      </main>
    ) : <div className="public-auth-heading"><h1>{page === 'care-invite' ? 'Review your care invitation' : page === 'rd-signin' ? 'Dietitian sign in' : page === 'signup' ? 'Create your account' : 'Sign in to Nepholio'}</h1><p>{page === 'care-invite' ? 'Sign in with the exact email that received the invitation. Nothing is shared until you accept.' : page === 'rd-signin' ? 'Review the food records your patients share with you.' : 'Keep your food log, recipes, and nutrition history together.'}</p></div>}
    {publicPage && <footer className="public-footer"><span>Nepholio</span>{link('rd-signin', 'For dietitians →')}</footer>}
  </>;
}
