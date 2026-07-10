import { useState } from 'react';

// NOTE ON SECURITY: like the original app, this is a simple client-side
// password gate — good enough to keep casual visitors out, but NOT real
// authentication (anyone who inspects the built JS bundle can find the
// password, same limitation as the original hardcoded password had).
// For real access control, move to Supabase Auth (or similar) in a later
// phase — that was flagged as a known issue, not fixed silently here.
const APP_PASSWORD = import.meta.env.VITE_APP_PASSWORD || '';

export default function PinScreen({ onUnlock }) {
  const [val, setVal] = useState('');
  const [error, setError] = useState('');

  function submit(e) {
    e.preventDefault();
    if (!val) {
      setError('Enter your password');
      return;
    }
    if (val === APP_PASSWORD) {
      setError('');
      setVal('');
      onUnlock();
    } else {
      setError('Incorrect password — try again');
      setVal('');
    }
  }

  return (
    <div className="pin-screen">
      <div className="pin-box">
        <div className="pin-logo">
        <img src="/logo.jpg" alt="INCINX" />
      </div>
        <div className="pin-sub">INCINX · Billing &amp; Accounts</div>
        <form className="pin-field-wrap" onSubmit={submit}>
          <input
            className="pin-field"
            id="pinInput"
            type="password"
            placeholder="Enter password"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            autoFocus
          />
          <button className="pin-enter-btn" type="submit">Unlock</button>
        </form>
        <div className="pin-error">{error}</div>
        {!APP_PASSWORD && (
          <div className="pin-hint">No VITE_APP_PASSWORD set in .env — set one to enable the lock.</div>
        )}
      </div>
    </div>
  );
}
