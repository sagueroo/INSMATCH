import { useState, useEffect } from 'react';
import axios from 'axios';

const Login = ({ onLoginSuccess, onGoToRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@1,700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await axios.post('/auth/login', { email, password });
      localStorage.setItem('token', response.data.access_token);
      localStorage.setItem('first_name', response.data.user.first_name);
      localStorage.setItem('last_name', response.data.user.last_name);
      onLoginSuccess();
    } catch (err) {
      setError(err.response?.data?.detail || "Identifiants incorrects.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      flex: 1, width: '100%', minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0a0a0a', fontFamily: "'Inter', sans-serif", padding: '20px', overflow: 'auto',
    }}>
      <style>{`
        * { box-sizing: border-box; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .login-card { animation: fadeUp 0.5s ease both; }
        .login-input:focus { border-color: #E30613 !important; box-shadow: 0 0 0 3px rgba(227,6,19,0.1) !important; }
        .login-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(227,6,19,0.3) !important; }
        .login-btn:active:not(:disabled) { transform: scale(0.98); }
        @media (min-width: 600px) {
          .login-card { max-width: 420px; }
        }
      `}</style>

      <div className="login-card" style={{
        width: '100%', maxWidth: '420px', background: '#121212',
        borderRadius: '28px', overflow: 'hidden',
        border: '1px solid #2a2a2a',
        boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
      }}>
        {/* Header */}
        <div style={{
          background: 'transparent',
          padding: '36px 28px 28px', textAlign: 'center',
          borderBottom: '1px solid #2a2a2a',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
            <img src="/logo.png" alt="INSAMATCH" style={{ height: '80px', objectFit: 'contain' }} />
          </div>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Trouve ton partenaire sportif</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '28px' }}>
          <h2 style={{ color: '#e2e8f0', fontSize: '20px', fontWeight: '700', margin: '0 0 24px' }}>Connexion</h2>

          {error && (
            <div style={{
              background: '#1c1017', border: '1px solid #5c1a1a', borderRadius: '12px',
              padding: '12px 14px', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '10px',
            }}>
              <svg width="18" height="18" fill="none" stroke="#ef4444" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
              <span style={{ color: '#fca5a5', fontSize: '13px' }}>{error}</span>
            </div>
          )}

          {/* Email */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', display: 'flex' }}>
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
              </div>
              <input
                className="login-input"
                type="email" value={email} onChange={e => { setEmail(e.target.value); setError(''); }}
                placeholder="prenom.nom@insa-lyon.fr"
                required
                style={{
                  width: '100%', height: '50px', paddingLeft: '44px', paddingRight: '16px',
                  background: '#1a1a1a', border: '1.5px solid #333', borderRadius: '12px',
                  color: '#e2e8f0', fontSize: '14px', outline: 'none', transition: 'all 0.2s',
                  fontFamily: "'Inter', sans-serif",
                }}
              />
            </div>
          </div>

          {/* Password */}
          <div style={{ marginBottom: '22px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mot de passe</label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', display: 'flex' }}>
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              </div>
              <input
                className="login-input"
                type={showPassword ? 'text' : 'password'} value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder="••••••••"
                required
                style={{
                  width: '100%', height: '50px', paddingLeft: '44px', paddingRight: '48px',
                  background: '#1a1a1a', border: '1.5px solid #333', borderRadius: '12px',
                  color: '#e2e8f0', fontSize: '14px', outline: 'none', transition: 'all 0.2s',
                  fontFamily: "'Inter', sans-serif",
                }}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={{
                position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', padding: 0,
              }}>
                {showPassword
                  ? <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                  : <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                }
              </button>
            </div>
          </div>

          {/* Submit */}
          <button className="login-btn" type="submit" disabled={loading} style={{
            width: '100%', height: '52px', background: '#E30613', color: 'white',
            border: 'none', borderRadius: '14px', fontSize: '15px', fontWeight: '700',
            cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
            transition: 'all 0.2s', fontFamily: "'Inter', sans-serif",
            boxShadow: '0 4px 16px rgba(227,6,19,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          }}>
            {loading ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
              </svg>
            ) : 'Se connecter'}
          </button>

          {/* Register link */}
          <div style={{ textAlign: 'center', marginTop: '22px' }}>
            <span style={{ color: '#64748b', fontSize: '14px' }}>Pas encore inscrit ? </span>
            <button type="button" onClick={onGoToRegister} style={{
              background: 'none', border: 'none', color: '#E30613', fontSize: '14px',
              fontWeight: '700', cursor: 'pointer', textDecoration: 'underline',
              fontFamily: "'Inter', sans-serif",
            }}>
              Créer un compte
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;