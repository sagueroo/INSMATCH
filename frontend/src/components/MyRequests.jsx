import { useState, useEffect } from 'react';
import axios from 'axios';

const MyRequests = ({ onLogout }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchRequests();
    // Rafraîchir toutes les 15 secondes pour le côté "temps réel"
    const interval = setInterval(fetchRequests, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchRequests = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://127.0.0.1:8000/requests', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRequests(response.data);
      setError('');
    } catch (err) {
      if (err.response?.status === 401) {
        onLogout();
      } else {
        setError('Impossible de charger vos demandes.');
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fffbeb', color: '#b45309', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>
            <span style={{ display: 'flex', width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }} className="animate-pulse" />
            En attente
          </div>
        );
      case 'matched':
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#eff6ff', color: '#1d4ed8', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Partenaire trouvé
          </div>
        );
      case 'accepted':
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f0fdf4', color: '#15803d', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            Match validé !
          </div>
        );
      default:
        return null;
    }
  };

  const formatDate = (dateString) => {
    const d = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d);
  };

  return (
    <div style={{
      flex: 1,
      minHeight: '100%',
      background: '#f3f4f6',
      fontFamily: "'Outfit', sans-serif",
      padding: '24px 16px',
    }}>
      <style>{`
        ::-webkit-scrollbar { width: 0; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .card-anim { animation: fadeIn 0.4s ease both; }
      `}</style>

      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '48px', height: '48px', background: '#002157', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          </div>
          <div>
            <h1 style={{ fontSize: '24px', margin: 0, color: '#111827', fontFamily: "'Playfair Display', serif", fontWeight: '700' }}>Mes Demandes</h1>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: '4px 0 0' }}>Suis l'avancée de tes matchs INSMATCH</p>
          </div>
        </div>

        {/* State Management */}
        {loading && (
          <div style={{ padding: '40px 0', textAlign: 'center' }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#E30613" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
            <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '12px' }}>Recherche de tes dossiers...</p>
          </div>
        )}

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '16px', borderRadius: '16px', color: '#dc2626', fontSize: '14px', textAlign: 'center' }}>
            {error}
          </div>
        )}

        {!loading && !error && requests.length === 0 && (
          <div style={{ background: 'white', padding: '40px 20px', borderRadius: '24px', textAlign: 'center', border: '1px solid #e5e7eb', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
            <div style={{ width: '64px', height: '64px', background: '#f3f4f6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="32" height="32" fill="none" stroke="#9ca3af" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <h3 style={{ fontSize: '18px', color: '#111827', margin: '0 0 8px', fontWeight: '600' }}>Aucune demande en cours</h3>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>Va discuter avec l'Agent pour organiser un match ou trouver un partenaire !</p>
          </div>
        )}

        {/* Liste des Demandes */}
        {!loading && !error && requests.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {requests.map((request, index) => (
              <div key={request.id} className="card-anim" style={{
                background: 'white',
                borderRadius: '24px',
                padding: '20px',
                border: '1px solid #e5e7eb',
                boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
                animationDelay: `${index * 0.05}s`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  {getStatusBadge(request.status)}
                  <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '500' }}>{formatDate(request.createdAt)}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                  {/* Icon du Sport */}
                  <div style={{ width: '56px', height: '56px', background: '#fff5f5', borderRadius: '16px', border: '1px solid #fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="28" height="28" fill="none" stroke="#E30613" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '20px', color: '#002157', margin: '0 0 6px', fontWeight: '700', fontFamily: "'Playfair Display', serif" }}>
                      {request.sportName}
                    </h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {/* Lieu */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4b5563', fontSize: '13.5px' }}>
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        {request.location}
                      </div>
                      
                      {/* Heure */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4b5563', fontSize: '13.5px' }}>
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        <span style={{ fontWeight: request.time.includes('Automatique') ? '500' : '400', color: request.time.includes('Automatique') ? '#d97706' : '#4b5563' }}>
                          {request.time}
                        </span>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
};

export default MyRequests;
