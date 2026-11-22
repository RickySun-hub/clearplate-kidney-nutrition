import { useEffect } from 'react';
import { X, Mic } from 'lucide-react';
import useDialogFocus from '../hooks/useDialogFocus';

export default function VoiceLogDrawer({ onClose, children }) {
  const ref = useDialogFocus(true, onClose);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);
  return <div className="voice-log-backdrop"><section ref={ref} className="voice-log-drawer voice-fullscreen" role="dialog" aria-modal="true" aria-labelledby="voice-log-title" tabIndex={-1}>
    <header className="voice-log-header"><div><span><Mic size={17} />Today · food record</span><h2 id="voice-log-title">Speak with Nepholio</h2></div><button className="icon-button" onClick={onClose} aria-label="Close voice logging"><X /></button></header>
    <div className="voice-log-content">{children}</div>

  </section></div>;
}
