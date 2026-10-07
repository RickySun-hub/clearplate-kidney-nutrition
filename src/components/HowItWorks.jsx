import { ArrowUpRight } from 'lucide-react';
import './how-it-works.css';

export default function HowItWorks({ onNavigate }) {
  return <main className="how-page">
    <header className="how-heading">
      <h1>Food tracking.<br />With your RD, or on your own.</h1>
      <p>Record meals by voice. Check your portions. Keep track of your day.</p>
    </header>

    <section className="how-story" aria-labelledby="with-rd-title">
      <img src="/images/how-it-works/with-dietitian.png" alt="An older adult discussing meals with a dietitian in a consultation room" width="1536" height="1024" fetchPriority="high" />
      <div className="how-copy">
        <h2 id="with-rd-title">With your dietitian.</h2>
        <p>Keep a food record your RD can see.<br />Follow the targets you agree on together.</p>
        <p className="how-payment">RD-sponsored access is coming.<br />Your practice covers your subscription.</p>
        <button className="how-link" onClick={()=>onNavigate('signup')}>Create an account <ArrowUpRight size={19} aria-hidden="true" /></button>
        <small>For now, sign up and share your record with your RD.</small>
      </div>
    </section>

    <section className="how-story how-story-reverse" aria-labelledby="on-own-title">
      <img src="/images/how-it-works/at-home-renalsync.png" alt="An older adult preparing vegetables at home with a phone on the kitchen counter" width="1536" height="1024" loading="lazy" />
      <div className="how-copy">
        <h2 id="on-own-title">On your own.</h2>
        <p>Find a recipe. Choose your portion.<br />Say what you ate, check it, and save.</p>
        <p className="how-payment">No RD needed.<br />Personal subscriptions are coming.</p>
        <button className="how-link" onClick={()=>onNavigate('signup')}>Get started <ArrowUpRight size={19} aria-hidden="true" /></button>
        <small>No payment is collected at sign-up today.</small>
      </div>
    </section>
    <p className="how-photo-note">Illustrative images.</p>
  </main>;
}

