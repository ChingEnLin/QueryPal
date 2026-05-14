import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { loginRequest } from '../authConfig';
import { USE_MSAL_AUTH } from '../app.config';
import { useAuth } from '../contexts/AuthContext';

// ── Icons ────────────────────────────────────────────────────────────────────

const MicrosoftLogo = () => (
  <svg width="16" height="16" viewBox="0 0 21 21" style={{ flexShrink: 0 }}>
    <rect x="1" y="1" width="9" height="9" fill="#f25022" />
    <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
    <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
    <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
  </svg>
);

const DevIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
    <circle cx="8" cy="5.5" r="2.5" />
    <path d="M2.5 13.5c0-3.038 2.462-5.5 5.5-5.5s5.5 2.462 5.5 5.5" />
  </svg>
);

// ── Feature list ─────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <path d="M2 4h12M2 8h8M2 12h5" />
      </svg>
    ),
    label: 'AI query generation',
  },
  {
    icon: (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M2 3h12v3H2zM2 7h12v3H2zM2 11h12v3H2z" />
      </svg>
    ),
    label: 'Data explorer',
  },
  {
    icon: (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M3 2h7l3 3v9H3zM6 7h5M6 9h5M6 11h3" />
      </svg>
    ),
    label: 'Audit log',
  },
  {
    icon: (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <path d="M2 13h12M4 11V6M7 11V3M10 11V8M13 11V5" />
      </svg>
    ),
    label: 'Analytics',
  },
];

// ── Shared UI ─────────────────────────────────────────────────────────────────

interface LoginUIProps {
  onLogin: () => void;
  buttonText: string;
  buttonIcon: React.ReactNode;
  note: string;
}

const LoginUI: React.FC<LoginUIProps> = ({ onLogin, buttonText, buttonIcon, note }) => (
  <div style={{
    minHeight: '100vh',
    background: 'var(--bg)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 20px',
    fontFamily: 'var(--font-body)',
    color: 'var(--fg)',
  }}>
    <div style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Brand */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: 'var(--fg)', color: 'var(--bg)',
          display: 'grid', placeItems: 'center',
          fontFamily: 'var(--font-display)', fontWeight: 700,
          fontSize: 26, letterSpacing: '-0.05em',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        }}>Q</div>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontWeight: 600,
            fontSize: 26, letterSpacing: '-0.02em', color: 'var(--fg)',
            lineHeight: 1.1,
          }}>QueryPal</div>
          <div style={{
            fontSize: 13, color: 'var(--muted)', marginTop: 5,
            fontFamily: 'var(--font-body)',
          }}>
            AI-powered queries for Azure Cosmos DB
          </div>
        </div>
      </div>

      {/* Card */}
      <div style={{
        background: 'var(--panel)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '28px 28px 24px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        display: 'flex', flexDirection: 'column', gap: 20,
      }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-display)', fontWeight: 600,
            fontSize: 18, color: 'var(--fg)', letterSpacing: '-0.01em',
          }}>
            Welcome back
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 5, lineHeight: 1.5 }}>
            Sign in to access your workspace and databases.
          </div>
        </div>

        {/* Sign in button */}
        <button
          onClick={onLogin}
          style={{
            width: '100%', height: 44,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            background: 'var(--accent)', color: '#fff',
            border: 'none', borderRadius: 9,
            fontSize: 13.5, fontWeight: 600, fontFamily: 'var(--font-body)',
            cursor: 'pointer',
            transition: 'opacity 0.15s, transform 0.1s',
            letterSpacing: '-0.01em',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.88'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
          onMouseDown={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.987)'; }}
          onMouseUp={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
        >
          {buttonIcon}
          {buttonText}
        </button>

        {/* Note */}
        <div style={{
          fontSize: 11.5, color: 'var(--muted)',
          textAlign: 'center', lineHeight: 1.55,
          borderTop: '1px solid var(--border)',
          paddingTop: 16,
        }}>
          {note}
        </div>
      </div>

      {/* Feature chips */}
      <div style={{
        display: 'flex', flexWrap: 'wrap',
        gap: 8, justifyContent: 'center',
      }}>
        {FEATURES.map(f => (
          <span key={f.label} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '4px 10px',
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: 99,
            fontSize: 11.5, color: 'var(--muted)',
            fontFamily: 'var(--font-body)',
          }}>
            <span style={{ color: 'var(--accent)', display: 'flex' }}>{f.icon}</span>
            {f.label}
          </span>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        textAlign: 'center',
        fontSize: 11, color: 'var(--muted)',
        lineHeight: 1.6,
      }}>
        <div>Powered by Microsoft Azure &amp; Google Gemini</div>
        <div>
          AI features are subject to the{' '}
          <a
            href="https://ai.google.dev/gemini-api/terms"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--accent)', textDecoration: 'none' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'underline'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'none'; }}
          >
            Gemini API Terms of Service
          </a>
          . For internal use only.
        </div>
      </div>
    </div>
  </div>
);

// ── Redirecting state ─────────────────────────────────────────────────────────

const RedirectingScreen = () => (
  <div style={{
    minHeight: '100vh', background: 'var(--bg)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'var(--font-body)', color: 'var(--muted)', fontSize: 13,
    gap: 10,
  }}>
    <style>{`@keyframes qp-spin { to { transform: rotate(360deg); } }`}</style>
    <div style={{
      width: 14, height: 14, borderRadius: '50%',
      border: '2px solid var(--border)', borderTopColor: 'var(--accent)',
      animation: 'qp-spin 0.7s linear infinite',
    }} />
    Redirecting…
  </div>
);

// ── Container components ──────────────────────────────────────────────────────

const MsalLoginPage: React.FC = () => {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isAuthenticated && accounts.length > 0) {
      const from = location.state?.from?.pathname || '/hub';
      const search = location.state?.from?.search || '';
      const hash = location.state?.from?.hash || '';
      navigate(from + search + hash, { replace: true });
    }
  }, [isAuthenticated, accounts, navigate, location.state]);

  if (isAuthenticated && accounts.length > 0) return <RedirectingScreen />;

  return (
    <LoginUI
      onLogin={() => instance.loginRedirect(loginRequest).catch(console.error)}
      buttonText="Continue with Microsoft Entra ID"
      buttonIcon={<MicrosoftLogo />}
      note="You'll be redirected to Microsoft's secure sign-in page to authenticate."
    />
  );
};

const BypassLoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogin = () => {
    login();
    setTimeout(() => {
      const from = location.state?.from?.pathname || '/hub';
      const search = location.state?.from?.search || '';
      const hash = location.state?.from?.hash || '';
      navigate(from + search + hash, { replace: true });
    }, 100);
  };

  return (
    <LoginUI
      onLogin={handleLogin}
      buttonText="Continue as Developer"
      buttonIcon={<DevIcon />}
      note="Developer sign-in bypass is active. No credentials required."
    />
  );
};

// ── Export ────────────────────────────────────────────────────────────────────

const LoginPage: React.FC = () => USE_MSAL_AUTH ? <MsalLoginPage /> : <BypassLoginPage />;

export default LoginPage;
