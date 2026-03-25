import { useState, useEffect } from 'react';
import axios from 'axios';

// Reusable input and select
const InputField = ({ label, icon, value, onChange, type = 'text', placeholder = '', suffix, options = [] }) => (
  <div style={{ marginBottom: '14px' }}>
    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', display: 'flex' }}>{icon}</div>
      {type === 'select' ? (
        <select
          className="reg-input"
          value={value} onChange={onChange} required
          style={{
            width: '100%', height: '50px', paddingLeft: '44px', paddingRight: '16px',
            background: '#1a1a1a', border: '1.5px solid #333', borderRadius: '12px',
            color: '#e2e8f0', fontSize: '14px', outline: 'none', transition: 'all 0.2s',
            fontFamily: "'Inter', sans-serif", appearance: 'none'
          }}
        >
          <option value="" disabled hidden>{placeholder}</option>
          {options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      ) : (
        <input
          className="reg-input"
          type={type} value={value} onChange={onChange} placeholder={placeholder} required
          style={{
            width: '100%', height: '50px', paddingLeft: '44px', paddingRight: suffix ? '48px' : '16px',
            background: '#1a1a1a', border: '1.5px solid #333', borderRadius: '12px',
            color: '#e2e8f0', fontSize: '14px', outline: 'none', transition: 'all 0.2s',
            fontFamily: "'Inter', sans-serif",
          }}
        />
      )}
      {suffix && (
        <div style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', display: 'flex' }}>{suffix}</div>
      )}
    </div>
  </div>
);

const Register = ({ onGoToLogin }) => {
  const [formData, setFormData] = useState({
    first_name: '', last_name: '', email: '', password: '',
    department: '', class_group: '', trigram: '',
  });
  const [isProfessor, setIsProfessor] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [emailEdited, setEmailEdited] = useState(false);

  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@1,700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }, []);

  const set = (field) => (e) => {
    setError('');
    setSuccessMessage('');
    
    let newValue = e.target.value;
    let newFormData = { ...formData, [field]: newValue };

    if (field === 'email') setEmailEdited(true);

    if ((field === 'first_name' || field === 'last_name') && !emailEdited) {
       const fName = field === 'first_name' ? newValue : formData.first_name;
       const lName = field === 'last_name' ? newValue : formData.last_name;
       
       if (fName || lName) {
         const formatName = (name) => name.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9-]/g, ' ').trim().replace(/\s+/g, '-');
         
         const cleanF = formatName(fName);
         const cleanL = formatName(lName);
         
         if (cleanF && cleanL) newFormData.email = `${cleanF}.${cleanL}@insa-lyon.fr`;
         else if (cleanF) newFormData.email = `${cleanF}@insa-lyon.fr`;
         else if (cleanL) newFormData.email = `${cleanL}@insa-lyon.fr`;
         else newFormData.email = '';
       } else {
         newFormData.email = '';
       }
    }

    setFormData(newFormData);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (step === 1) { setStep(2); return; }
    setLoading(true);
    setError('');
    try {
      const payload = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        password: formData.password,
        department: isProfessor ? 'Enseignant' : formData.department,
        class_group: isProfessor ? formData.trigram : formData.class_group,
      };
      const response = await axios.post('http://127.0.0.1:8000/auth/register', payload);
      localStorage.setItem('first_name', response.data.first_name);
      localStorage.setItem('last_name', response.data.last_name);
      setSuccessMessage("Inscription réussie ! Bienvenue " + response.data.first_name);
      setTimeout(() => {
        if (onGoToLogin) onGoToLogin();
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.detail || "Erreur lors de l'inscription.");
    } finally {
      setLoading(false);
    }
  };

  const step1Valid = formData.first_name && formData.last_name && formData.email && formData.password;
  const step2Valid = isProfessor ? formData.trigram : (formData.department && formData.class_group);
  const canProceed = step === 1 ? step1Valid : step2Valid;

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0a0a0a', fontFamily: "'Inter', sans-serif", padding: '20px',
    }}>
      <style>{`
        * { box-sizing: border-box; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slideIn { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .reg-card { animation: fadeUp 0.5s ease both; }
        .reg-input:focus { border-color: #E30613 !important; box-shadow: 0 0 0 3px rgba(227,6,19,0.1) !important; }
        .reg-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(227,6,19,0.3) !important; }
        .reg-btn:active:not(:disabled) { transform: scale(0.98); }
        .step-content { animation: slideIn 0.3s ease both; }
        @media (min-width: 600px) {
          .reg-card { max-width: 460px; }
          .name-row { display: grid !important; grid-template-columns: 1fr 1fr; gap: 14px; }
          .name-row > div { margin-bottom: 0 !important; }
        }
      `}</style>

      <div className="reg-card" style={{
        width: '100%', maxWidth: '460px', background: '#121212',
        borderRadius: '28px', overflow: 'hidden',
        border: '1px solid #2a2a2a',
        boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
      }}>
        {/* Header */}
        <div style={{
          background: 'transparent',
          padding: '32px 28px 24px', textAlign: 'center',
          borderBottom: '1px solid #2a2a2a',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
            <img src="/logo.png" alt="INSAMATCH" style={{ height: '80px', objectFit: 'contain' }} />
          </div>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Rejoins la communauté sportive</p>
        </div>

        {/* Steps indicator */}
        <div style={{ padding: '20px 28px 0', display: 'flex', gap: '8px', alignItems: 'center' }}>
          {[1, 2].map(s => (
            <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{
                height: '4px', borderRadius: '4px',
                background: s <= step ? '#E30613' : '#333',
                transition: 'background 0.3s',
              }} />
              <span style={{ fontSize: '10px', color: s <= step ? '#e2e8f0' : '#64748b', fontWeight: '600' }}>
                {s === 1 ? 'Identité' : 'Infos INSA'}
              </span>
            </div>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 28px 28px' }}>
          <h2 style={{ color: '#e2e8f0', fontSize: '18px', fontWeight: '700', margin: '0 0 20px' }}>
            {step === 1 ? 'Créer ton compte' : 'Informations INSA'}
          </h2>

          {error && (
            <div style={{ background: '#1c1017', border: '1px solid #5c1a1a', borderRadius: '12px', padding: '12px 14px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="18" height="18" fill="none" stroke="#ef4444" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
              <span style={{ color: '#fca5a5', fontSize: '13px' }}>{error}</span>
            </div>
          )}
          {successMessage && (
            <div style={{ background: '#0f291e', border: '1px solid #1a5c38', borderRadius: '12px', padding: '12px 14px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="18" height="18" fill="none" stroke="#22c55e" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
              <span style={{ color: '#86efac', fontSize: '13px', fontWeight: '500' }}>{successMessage}</span>
            </div>
          )}

          {step === 1 ? (
            <div className="step-content" key="step1">
              <div className="name-row">
                <InputField label="Prénom" placeholder="Pierre" value={formData.first_name} onChange={set('first_name')}
                  icon={<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>}
                />
                <InputField label="Nom" placeholder="Dupont" value={formData.last_name} onChange={set('last_name')}
                  icon={<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>}
                />
              </div>
              <InputField label="Email INSA" placeholder="prenom.nom@insa-lyon.fr" value={formData.email} onChange={set('email')} type="email"
                icon={<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>}
              />
              <InputField label="Mot de passe" placeholder="••••••••" value={formData.password} onChange={set('password')} type={showPassword ? 'text' : 'password'}
                icon={<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>}
                suffix={
                  <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', padding: 0 }}>
                    {showPassword
                      ? <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                      : <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                    }
                  </button>
                }
              />
            </div>
          ) : (
            <div className="step-content" key="step2">
              {/* Professor toggle */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: '#1a1a1a', border: '1px solid #333', borderRadius: '14px',
                padding: '14px 18px', marginBottom: '20px', cursor: 'pointer',
              }} onClick={() => setIsProfessor(!isProfessor)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '10px',
                    background: isProfessor ? 'rgba(227,6,19,0.15)' : 'rgba(100,116,139,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.2s',
                  }}>
                    <svg width="20" height="20" fill="none" stroke={isProfessor ? '#E30613' : '#64748b'} strokeWidth="2" viewBox="0 0 24 24"><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c0 2 3 3 6 3s6-1 6-3v-5" /></svg>
                  </div>
                  <div>
                    <p style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: '600', margin: 0 }}>Je suis enseignant</p>
                    <p style={{ color: '#64748b', fontSize: '12px', margin: '2px 0 0' }}>Cocher si vous êtes professeur</p>
                  </div>
                </div>
                {/* Custom checkbox */}
                <div style={{
                  width: '22px', height: '22px', borderRadius: '6px',
                  border: `2px solid ${isProfessor ? '#E30613' : '#333'}`,
                  background: isProfessor ? '#E30613' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s',
                }}>
                  {isProfessor && <svg width="14" height="14" fill="none" stroke="white" strokeWidth="3" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>}
                </div>
              </div>

              {isProfessor ? (
                /* Trigramme field for professors */
                <InputField label="Trigramme" placeholder="Ex: ABC" value={formData.trigram} onChange={set('trigram')}
                  icon={<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /><line x1="12" y1="11" x2="12" y2="17" /><line x1="9" y1="14" x2="15" y2="14" /></svg>}
                />
              ) : (
                /* Student fields */
                <>
                  <InputField label="Département" placeholder="Choisir le département (3 ou 4)" value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value, class_group: '' })} type="select" options={['3', '4']}
                    icon={<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c0 2 3 3 6 3s6-1 6-3v-5" /></svg>}
                  />
                  {formData.department && (
                    <InputField label="Classe / Groupe" placeholder="Choisir la classe (ex: 1, 2...)" value={formData.class_group} onChange={set('class_group')} type="select" options={formData.department === '3' ? ['1', '2', '3', '4'] : formData.department === '4' ? ['1', '2', '3'] : []}
                      icon={<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>}
                    />
                  )}
                </>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            {step === 2 && (
              <button type="button" onClick={() => setStep(1)} style={{
                height: '52px', padding: '0 20px', background: 'transparent',
                border: '1.5px solid #333', borderRadius: '14px', color: '#e2e8f0',
                fontSize: '14px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s',
                fontFamily: "'Inter', sans-serif",
              }}>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ verticalAlign: '-3px', marginRight: '4px' }}><polyline points="15 18 9 12 15 6" /></svg>
                Retour
              </button>
            )}
            <button className="reg-btn" type="submit" disabled={!canProceed || loading} style={{
              flex: 1, height: '52px', background: canProceed ? '#E30613' : '#3b1115',
              color: 'white', border: 'none', borderRadius: '14px', fontSize: '15px',
              fontWeight: '700', cursor: canProceed && !loading ? 'pointer' : 'not-allowed',
              opacity: canProceed ? 1 : 0.5, transition: 'all 0.2s',
              fontFamily: "'Inter', sans-serif",
              boxShadow: canProceed ? '0 4px 16px rgba(227,6,19,0.25)' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}>
              {loading ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
                </svg>
              ) : step === 1 ? 'Continuer' : "S'inscrire"}
            </button>
          </div>

          {/* Login link */}
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <span style={{ color: '#64748b', fontSize: '14px' }}>Déjà inscrit ? </span>
            <button type="button" onClick={onGoToLogin} style={{
              background: 'none', border: 'none', color: '#E30613', fontSize: '14px',
              fontWeight: '700', cursor: 'pointer', textDecoration: 'underline',
              fontFamily: "'Inter', sans-serif",
            }}>
              Se connecter
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;
