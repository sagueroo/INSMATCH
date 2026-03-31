import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { SportIcon } from './SportIcons.jsx';
import { ConfirmDialog } from './ui/ConfirmDialog.jsx';
import { EmptyState } from './ui/EmptyState.jsx';

const Dashboard = ({ onLogout }) => {
  const [darkMode, setDarkMode] = useState(true);
  const [activeTab, setActiveTab] = useState('ia');
  const [isMatchDrawerOpen, setIsMatchDrawerOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [requests, setRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [requestToDelete, setRequestToDelete] = useState(null);
  const [respondLoading, setRespondLoading] = useState(false);
  const [matchCancelLoading, setMatchCancelLoading] = useState(false);
  /** Modale « Annuler le match » : null ou { matchId, sportName, creneau } */
  const [matchCancelConfirm, setMatchCancelConfirm] = useState(null);
  const [matchCancelModalError, setMatchCancelModalError] = useState('');
  const [profileData, setProfileData] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [communityData, setCommunityData] = useState(null);
  const [communityLoading, setCommunityLoading] = useState(true);
  const [venuesData, setVenuesData] = useState([]);
  const [venuesLoading, setVenuesLoading] = useState(true);
  // Schedule
  const [scheduleData, setScheduleData] = useState(null);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [activeDay, setActiveDay] = useState(() => { const d = new Date().getDay(); return d === 0 || d === 6 ? 1 : d - 1; });
  // Profile Edit
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  // Community search & external profile
  const [communitySearch, setCommunitySearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedCommunityUser, setSelectedCommunityUser] = useState(null);
  const [communityUserProfile, setCommunityUserProfile] = useState(null);
  const [communityUserLoading, setCommunityUserLoading] = useState(false);
  const bottomRef = useRef(null);

  const firstName = localStorage.getItem('first_name') || 'Étudiant';
  const lastName = localStorage.getItem('last_name') || '';

  // ─── FETCH PROFILE ───
  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProfileData(res.data);
    } catch (err) {
      if (err.response?.status === 401) onLogout();
      console.error('Erreur profil:', err);
    } finally {
      setProfileLoading(false);
    }
  };

  // ─── DELETE REQUEST ───
  const confirmDeleteRequest = async () => {
    if (!requestToDelete) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/requests/${requestToDelete}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedRequest(null);
      setRequestToDelete(null);
      fetchRequests();
      fetchProfile();
    } catch (err) {
      alert('Erreur lors de la suppression.');
    }
  };

  // ─── FETCH COMMUNITY ───
  const fetchCommunity = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/community', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCommunityData(res.data);
    } catch (err) {
      console.error('Erreur communauté:', err);
    } finally {
      setCommunityLoading(false);
    }
  };

  // ─── TIME AGO HELPER ───
  const timeAgo = (dateString) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'À l\'instant';
    if (diffMin < 60) return `Il y a ${diffMin} minute${diffMin > 1 ? 's' : ''}`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `Il y a ${diffH} heure${diffH > 1 ? 's' : ''}`;
    const diffD = Math.floor(diffH / 24);
    return `Il y a ${diffD} jour${diffD > 1 ? 's' : ''}`;
  };

  // ─── FETCH VENUES ───
  const fetchVenues = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/venues', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVenuesData(res.data);
    } catch (err) {
      console.error('Erreur venues:', err);
    } finally {
      setVenuesLoading(false);
    }
  };

  // ─── FETCH SCHEDULE ───
  const fetchSchedule = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/schedule', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setScheduleData(res.data);
    } catch (err) {
      console.error('Erreur schedule:', err);
    } finally {
      setScheduleLoading(false);
    }
  };

  // ─── UPDATE PROFILE ───
  const updateProfile = async () => {
    if (!editForm) return;
    setEditSaving(true);
    setEditError('');
    try {
      const token = localStorage.getItem('token');
      const payload = {
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        email: editForm.email,
        phone: editForm.phone,
        sports: editForm.sports,
      };
      if (profileData?.user?.user_role === 'professor') {
        payload.professor_trigram = editForm.professor_trigram;
      } else {
        payload.department = editForm.department;
        payload.class_group = editForm.class_group;
      }
      await axios.put('/profile', payload, { headers: { Authorization: `Bearer ${token}` } });
      await fetchProfile();
      setIsEditingProfile(false);
    } catch (err) {
      setEditError('Erreur lors de la mise à jour.');
    } finally {
      setEditSaving(false);
    }
  };

  // ─── OPEN EDIT FORM ───
  const openEditForm = () => {
    if (!profileData) return;
    const { user, sports, availableSports } = profileData;
    setEditForm({
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      phone: user.phone || '',
      department: user.department || '',
      class_group: user.class_group || '',
      professor_trigram: user.professor_trigram || '',
      sports: sports.map(s => ({ sport_id: s.id, level: s.level })),
      availableSports: availableSports || [],
    });
    setEditError('');
    setIsEditingProfile(true);
  };

  // ─── COMMUNITY SEARCH ───
  const fetchCommunitySearch = async (query) => {
    if (!query.trim()) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/community/search?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSearchResults(res.data);
    } catch (err) {
      console.error('Erreur search:', err);
    } finally {
      setSearchLoading(false);
    }
  };

  // ─── FETCH COMMUNITY USER PROFILE ───
  const fetchCommunityUserProfile = async (userId) => {
    setSelectedCommunityUser(userId);
    setCommunityUserProfile(null);
    setCommunityUserLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/community/users/${userId}/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCommunityUserProfile(res.data);
    } catch (err) {
      console.error('Erreur user profile:', err);
    } finally {
      setCommunityUserLoading(false);
    }
  };

  // ─── LEAFLET ICONS ───
  const createIcon = (color) => L.divIcon({
    className: '',
    html: `<div style="background:${color};width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
  });
  const iconAvailable = createIcon('#D32F2F');
  const iconOccupied = createIcon('#9CA3AF');

  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@1,700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    setMessages([
      { role: 'ai', content: `Bonjour ! Je suis votre agent IA INSAMATCH. Comment puis-je vous aider à trouver des partenaires sportifs aujourd'hui ?`, time: formatTime() }
    ]);
    fetchRequests();
    fetchProfile();
    fetchCommunity();
    fetchVenues();
    fetchSchedule();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const fetchRequests = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/requests', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = res.data;
      setRequests(Array.isArray(payload) ? payload : (payload.requests || []));
    } catch (err) {
      if (err.response?.status === 401) onLogout();
    } finally {
      setRequestsLoading(false);
    }
  };

  const respondToMatch = async (requestId, action) => {
    setRespondLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `/requests/${requestId}/respond`,
        { action },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSelectedRequest(null);
      fetchRequests();
      fetchProfile();
    } catch (err) {
      alert(err.response?.data?.detail || 'Impossible d\'enregistrer ta réponse.');
    } finally {
      setRespondLoading(false);
    }
  };

  const openMatchCancelModal = (matchId, sportName, creneau) => {
    if (!matchId) return;
    setMatchCancelModalError('');
    setMatchCancelConfirm({
      matchId,
      sportName: sportName || 'Sport',
      creneau: creneau || 'Créneau à confirmer',
    });
  };

  const closeMatchCancelModal = () => {
    if (matchCancelLoading) return;
    setMatchCancelConfirm(null);
    setMatchCancelModalError('');
  };

  const confirmMatchCancellation = async () => {
    const mid = matchCancelConfirm?.matchId;
    if (!mid || matchCancelLoading) return;
    setMatchCancelLoading(true);
    setMatchCancelModalError('');
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        '/requests/match/cancel',
        { matchId: mid },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMatchCancelConfirm(null);
      setSelectedRequest(null);
      fetchRequests();
      fetchSchedule();
      fetchProfile();
    } catch (err) {
      setMatchCancelModalError(
        err.response?.data?.detail || 'Impossible d\'annuler ce match. Réessaie dans un instant.'
      );
    } finally {
      setMatchCancelLoading(false);
    }
  };

  const sendMessage = async (e) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    const userMsg = { role: 'user', content: input, time: formatTime() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const conversationHistory = newMessages.map(msg => ({
        role: msg.role === 'ai' ? 'assistant' : msg.role,
        content: msg.content
      }));
      const response = await axios.post('/chat/',
        { history: conversationHistory },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessages(prev => [...prev, { role: 'ai', content: response.data.reply, time: formatTime() }]);
      fetchRequests();
      fetchProfile();
    } catch (error) {
      if (error.response?.status === 401) onLogout();
      else setMessages(prev => [...prev, { role: 'ai', content: 'Erreur de connexion au serveur.', time: formatTime() }]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = () => {
    const now = new Date();
    return now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
  };

  const formatDate = (dateString) => {
    const d = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d);
  };

  // ─── COLORS ───
  const c = darkMode ? {
    bg: '#0a0a0a', surface: '#121212', surfaceBorder: '#2a2a2a',
    text: '#e2e8f0', textMuted: '#888888',
    inputBg: '#1a1a1a', inputBorder: '#333333',
    bubbleBg: '#1a1a1a', bubbleBorder: '#333333', bubbleText: '#e2e8f0',
    userBubbleBg: '#E30613',
    navBg: '#0a0a0a', navBorder: '#222222',
    headerBg: '#0e0e0e', headerBorder: '#222222',
    subHeaderBg: '#121212',
    cardBg: '#141414', cardBorder: '#2a2a2a',
    overlay: 'rgba(0,0,0,0.8)',
  } : {
    bg: '#ffffff', surface: '#ffffff', surfaceBorder: '#e5e7eb',
    text: '#111827', textMuted: '#6b7280',
    inputBg: '#f3f4f6', inputBorder: '#e5e7eb',
    bubbleBg: '#ffffff', bubbleBorder: '#e5e7eb', bubbleText: '#111827',
    userBubbleBg: '#E30613',
    navBg: '#ffffff', navBorder: '#e5e7eb',
    headerBg: '#ffffff', headerBorder: '#e5e7eb',
    subHeaderBg: '#ffffff',
    cardBg: '#ffffff', cardBorder: '#e5e7eb',
    overlay: 'rgba(0,0,0,0.45)',
  };

  // ─── STATUS CONFIG ───
  const statusConfig = {
    pending: {
      label: '🔍 Recherche en cours',
      color: '#f59e0b', bgColor: darkMode ? '#1a1400' : '#fffbeb',
      borderColor: darkMode ? '#4d3800' : '#fde68a',
      description: "On cherche un partenaire pour toi !",
    },
    matched: {
      label: '🎯 Partenaire trouvé',
      color: '#3b82f6', bgColor: darkMode ? '#0a1020' : '#eff6ff',
      borderColor: darkMode ? '#1e3a5f' : '#bfdbfe',
      description: "Un joueur est disponible, en attente de confirmation.",
    },
    accepted: {
      label: '✅ Match confirmé',
      color: '#22c55e', bgColor: darkMode ? '#0a1a0e' : '#f0fdf4',
      borderColor: darkMode ? '#1a3a20' : '#bbf7d0',
      description: "C'est parti, ton match est validé !",
    },
  };

  // ━━━━━━━━━━━━ PANELS ━━━━━━━━━━━━

  // Search Panel (desktop left sidebar)
  const renderSearchPanel = () => (
    <div style={{ padding: '20px', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
        <svg width="20" height="20" fill="none" stroke={c.text} strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
        <h2 style={{ fontSize: '18px', fontWeight: '700', color: c.text, margin: 0 }}>Mes Recherches</h2>
      </div>
      {requestsLoading ? (
        <p style={{ color: c.textMuted, fontSize: '13px' }}>Chargement...</p>
      ) : requests.length === 0 ? (
        <EmptyState emoji="🔍" title="Aucune recherche" hint="Crée une demande depuis l’onglet IA ou le volet Mes matchs." theme={c} darkMode={darkMode} padding="24px 12px" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {requests.map(req => (
            <div key={req.id} style={{
              background: c.cardBg, border: `1px solid ${c.cardBorder}`, borderRadius: '12px',
              padding: '14px 16px', borderLeft: '3px solid #E30613', cursor: 'pointer',
              transition: 'transform 0.15s', position: 'relative',
            }}>
              <div onClick={() => setSelectedRequest(req)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <span style={{ display: 'flex' }}><SportIcon name={req.sportName} size={18} /></span>
                  <span style={{ fontWeight: '700', fontSize: '14px', color: c.text }}>{req.sportName}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                  <svg width="12" height="12" fill="none" stroke={c.textMuted} strokeWidth="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                  <span style={{ fontSize: '12px', color: c.textMuted }}>{req.location}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="12" height="12" fill="none" stroke={c.textMuted} strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                  <span style={{ fontSize: '12px', color: c.textMuted }}>{req.time}</span>
                </div>
              </div>
              {/* Bouton supprimer */}
              <button onClick={(e) => { e.stopPropagation(); setRequestToDelete(req.id); }} style={{
                position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none',
                cursor: 'pointer', color: c.textMuted, padding: '4px', borderRadius: '6px',
                transition: 'color 0.2s',
              }} title="Supprimer">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Profile Panel (Dynamic from API)
  const renderProfilePanel = () => {
    if (profileLoading) {
      return (
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.bg }}>
          <p style={{ color: c.textMuted, fontSize: '14px' }}>Chargement du profil...</p>
        </div>
      );
    }

    if (!profileData) {
      return (
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.bg }}>
          <p style={{ color: c.textMuted, fontSize: '14px' }}>Erreur lors du chargement du profil.</p>
        </div>
      );
    }

    const { user, stats, sports, rewards, recentMatches } = profileData;
    const email = user.email;

    const getLevelColor = (level) => {
      if (level === 'Avancé') return '#002157';
      if (level === 'Intermédiaire') return '#E30613';
      return '#64748b'; // Débutant
    };

    const sportTagColor = (name) => {
      const n = name.toLowerCase();
      if (n.includes('tennis')) return { bg: '#fef2f2', color: '#E30613', border: '#fecaca' };
      if (n.includes('badminton')) return { bg: '#fef2f2', color: '#E30613', border: '#fecaca' };
      if (n.includes('natation')) return { bg: '#fef2f2', color: '#E30613', border: '#fecaca' };
      if (n.includes('foot')) return { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' };
      return { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' };
    };

    return (
      <div style={{ height: '100%', overflowY: 'auto', background: c.bg }}>
        {/* ── HERO CARD ── */}
        <div style={{
          margin: '16px', borderRadius: '24px', overflow: 'hidden',
          background: 'linear-gradient(135deg, #002157 0%, #001a44 40%, #8b1a2b 75%, #E30613 100%)',
          padding: '32px 24px 24px', textAlign: 'center', position: 'relative',
        }}>
          {/* Avatar */}
          <div style={{
            width: '90px', height: '90px', borderRadius: '50%', margin: '0 auto 14px',
            background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '3px solid rgba(255,255,255,0.25)',
          }}>
            <svg width="44" height="44" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
          </div>
          <h2 style={{ color: 'white', fontSize: '22px', fontWeight: '700', margin: '0 0 4px' }}>{user.first_name} {user.last_name}</h2>
          {user.user_role === 'professor' ? (
            <>
              <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '14px', margin: '0 0 2px' }}>Enseignant</p>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', margin: '0 0 18px' }}>Trigramme {user.professor_trigram || '—'}</p>
            </>
          ) : (
            <>
              <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '14px', margin: '0 0 2px' }}>{user.department}ème année de TC</p>
              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', margin: '0 0 18px' }}>Groupe {user.class_group}</p>
            </>
          )}

          {/* Modifier button */}
          <button onClick={openEditForm} style={{
            background: 'white', border: 'none', borderRadius: '20px',
            padding: '8px 20px', fontSize: '13px', fontWeight: '600', color: '#002157',
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px',
            fontFamily: "'Inter', sans-serif",
          }}>
            <svg width="14" height="14" fill="none" stroke="#002157" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
            Modifier
          </button>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '22px' }}>
            {[
              { icon: <svg width="22" height="22" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C7 4 7 7 7 7" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5C17 4 17 7 17 7" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></svg>, value: stats.totalMatches.toString(), label: 'Matchs joués' },
              { icon: <svg width="22" height="22" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><circle cx="12" cy="12" r="8" /><line x1="12" y1="1" x2="12" y2="4" /><line x1="12" y1="20" x2="12" y2="23" /></svg>, value: stats.totalSports.toString(), label: 'Sports pratiqués' },
              { icon: <svg width="22" height="22" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>, value: stats.totalPartners.toString(), label: 'Partenaires' },
            ].map((s, i) => (
              <div key={i} style={{
                flex: 1, background: 'rgba(255,255,255,0.12)', borderRadius: '16px',
                padding: '14px 8px', textAlign: 'center', backdropFilter: 'blur(6px)',
              }}>
                <div style={{ marginBottom: '6px', display: 'flex', justifyContent: 'center' }}>{s.icon}</div>
                <p style={{ color: 'white', fontSize: '22px', fontWeight: '800', margin: '0 0 2px' }}>{s.value}</p>
                <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '10px', fontWeight: '500', margin: 0, lineHeight: '1.3' }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── INFORMATIONS ── */}
        <div style={{ margin: '0 16px 16px', background: c.cardBg, border: `1px solid ${c.cardBorder}`, borderRadius: '20px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
            <svg width="18" height="18" fill="none" stroke="#E30613" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
            <h3 style={{ fontSize: '17px', fontWeight: '700', color: c.text, margin: 0 }}>Informations</h3>
          </div>
          {[
            { icon: <svg width="16" height="16" fill="none" stroke={c.textMuted} strokeWidth="2" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>, label: 'Email', value: email },
            { icon: <svg width="16" height="16" fill="none" stroke={c.textMuted} strokeWidth="2" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.72c.13.81.36 1.6.68 2.34a2 2 0 0 1-.45 2.11L8.09 9.31a16 16 0 0 0 6 6l1.14-1.14a2 2 0 0 1 2.11-.45c.74.32 1.53.55 2.34.68A2 2 0 0 1 22 16.92z" /></svg>, label: 'Téléphone', value: user.phone || 'Non renseigné' },
            { icon: <svg width="16" height="16" fill="none" stroke={c.textMuted} strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>, label: 'Inscription', value: formatDate(user.created_at) },
            { icon: <svg width="16" height="16" fill="none" stroke={c.textMuted} strokeWidth="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>, label: 'Localisation', value: 'Campus INSA Lyon' },
          ].map((info, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: i < 3 ? '16px' : 0 }}>
              <div style={{ marginTop: '2px', flexShrink: 0 }}>{info.icon}</div>
              <div>
                <p style={{ fontSize: '12px', color: c.textMuted, margin: '0 0 2px' }}>{info.label}</p>
                <p style={{ fontSize: '14px', color: c.text, fontWeight: '600', margin: 0 }}>{info.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── MES SPORTS ── */}
        <div style={{ margin: '0 16px 16px', background: c.cardBg, border: `1px solid ${c.cardBorder}`, borderRadius: '20px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
            <svg width="18" height="18" fill="none" stroke="#E30613" strokeWidth="2" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
            <h3 style={{ fontSize: '17px', fontWeight: '700', color: c.text, margin: 0 }}>Mes Sports</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {sports.length === 0 ? (
              <p style={{ color: c.textMuted, fontSize: '13px' }}>Aucun sport pratiqué pour le moment.</p>
            ) : null}
            {sports.map((sport, i) => {
              const maxMatches = 20; // Objectif de base
              const levelColor = getLevelColor(sport.level);
              const isAdvanced = sport.level === 'Avancé';
              const levelBadgeBg = isAdvanced
                ? '#002157'
                : levelColor === '#E30613'
                  ? (darkMode ? '#2a0a0e' : '#fef2f2')
                  : (darkMode ? '#1a2030' : '#f3f4f6');
              const levelBadgeColor = isAdvanced ? '#ffffff' : levelColor;
              return (
                <div key={i} style={{
                  background: c.bg, border: `1px solid ${c.cardBorder}`, borderRadius: '14px',
                  padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px',
                }}>
                  {/* Sport icon */}
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
                    background: darkMode ? '#1a2744' : '#fef2f2',
                    border: `1px solid ${darkMode ? '#253a5c' : '#fecaca'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <SportIcon name={sport.name} size={20} />
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '700', color: c.text }}>{sport.name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px',
                        background: levelBadgeBg,
                        color: levelBadgeColor,
                      }}>{sport.level}</span>
                      <span style={{ fontSize: '12px', color: c.textMuted }}>{sport.matchCount} matchs</span>
                    </div>
                  </div>
                  {/* Progress */}
                  <div style={{ width: '80px', textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ height: '6px', borderRadius: '3px', background: darkMode ? '#1a2744' : '#e5e7eb', marginBottom: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min((sport.matchCount / maxMatches) * 100, 100)}%`, height: '100%', borderRadius: '3px', background: '#E30613', transition: 'width 0.5s ease' }} />
                    </div>
                    <span style={{ fontSize: '11px', color: c.textMuted, fontWeight: '600' }}>{sport.matchCount}/{maxMatches}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── RÉCOMPENSES ── */}
        <div style={{ margin: '0 16px 16px', background: c.cardBg, border: `1px solid ${c.cardBorder}`, borderRadius: '20px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
            <svg width="18" height="18" fill="none" stroke="#E30613" strokeWidth="2" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
            <h3 style={{ fontSize: '17px', fontWeight: '700', color: c.text, margin: 0 }}>Récompenses</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {rewards.map((r, i) => (
              <div key={i} style={{
                background: r.unlocked ? (darkMode ? '#2a0a0e' : '#fef2f2') : (darkMode ? '#111827' : '#f9fafb'),
                border: `1px solid ${r.unlocked ? (darkMode ? '#5c1a1a' : '#fecaca') : c.cardBorder}`,
                borderRadius: '14px', padding: '14px', opacity: r.unlocked ? 1 : 0.5,
              }}>
                <svg width="24" height="24" fill="none" stroke={r.unlocked ? '#E30613' : c.textMuted} strokeWidth="1.5" viewBox="0 0 24 24" style={{ marginBottom: '8px' }}>
                  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C7 4 7 7 7 7" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5C17 4 17 7 17 7" /><path d="M4 22h16" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                </svg>
                <p style={{ fontSize: '13px', fontWeight: '700', color: r.unlocked ? c.text : c.textMuted, margin: '0 0 2px' }}>{r.name}</p>
                <p style={{ fontSize: '11px', color: c.textMuted, margin: 0, lineHeight: '1.4' }}>{r.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── MATCHS RÉCENTS ── */}
        <div style={{ margin: '0 16px 16px', background: c.cardBg, border: `1px solid ${c.cardBorder}`, borderRadius: '20px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
            <svg width="18" height="18" fill="none" stroke="#E30613" strokeWidth="2" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
            <h3 style={{ fontSize: '17px', fontWeight: '700', color: c.text, margin: 0 }}>Matchs Récents</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {recentMatches.length === 0 ? (
              <p style={{ color: c.textMuted, fontSize: '13px' }}>Aucun match à afficher.</p>
            ) : null}
            {recentMatches.map((m, i) => {
              const tag = sportTagColor(m.sport);
              return (
                <div key={i} style={{
                  border: `1px solid ${c.cardBorder}`, borderRadius: '14px',
                  padding: '14px 16px', background: c.bg,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <div>
                      <p style={{ fontSize: '15px', fontWeight: '700', color: c.text, margin: '0 0 3px' }}>{m.sport}</p>
                      <p style={{ fontSize: '13px', color: c.textMuted, margin: 0 }}>avec {m.partnerName}</p>
                    </div>
                    <span style={{
                      fontSize: '11px', fontWeight: '600', padding: '4px 12px', borderRadius: '20px',
                      background: tag.bg, color: tag.color, border: `1px solid ${tag.border}`,
                    }}>{m.sport}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: c.textMuted }}>
                      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                      {formatDate(m.date)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: c.textMuted }}>
                      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                      {m.venue}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── DÉCONNEXION ── */}
        <div style={{ margin: '0 16px 24px' }}>
          <button onClick={onLogout} style={{
            width: '100%', padding: '14px', borderRadius: '14px',
            border: `1.5px solid ${c.cardBorder}`, background: 'transparent',
            color: c.text, fontWeight: '600', fontSize: '14px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            fontFamily: "'Inter', sans-serif",
          }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
            Déconnexion
          </button>
        </div>
      </div>
    );
  };

  // ━━━━━━━━━━━━ CHAT ━━━━━━━━━━━━
  const renderChat = () => {
    const matchActionCount = requests.filter((r) => r.needsMyAction).length;
    return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${c.surfaceBorder}`, background: c.subHeaderBg, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="hamburger-btn" onClick={() => setIsMatchDrawerOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', lineHeight: 0, position: 'relative' }}>
            <svg width="22" height="22" fill="none" stroke={c.text} strokeWidth="2" viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
            {matchActionCount > 0 && (
              <span style={{
                position: 'absolute', top: '-6px', right: '-8px', minWidth: '18px', height: '18px', borderRadius: '999px',
                background: '#E30613', color: 'white', fontSize: '10px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
              }}>{matchActionCount > 9 ? '9+' : matchActionCount}</span>
            )}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="18" height="18" fill="none" stroke={c.text} strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            <span style={{ fontWeight: '600', fontSize: '16px', color: c.text }}>Agent IA</span>
          </div>
        </div>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', lineHeight: 0 }}>
          <svg width="22" height="22" fill="none" stroke={c.text} strokeWidth="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', background: c.bg }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%', alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{ padding: '14px 16px', borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px', background: msg.role === 'user' ? c.userBubbleBg : c.bubbleBg, color: msg.role === 'user' ? 'white' : c.bubbleText, border: msg.role === 'user' ? 'none' : `1px solid ${c.bubbleBorder}`, fontSize: '14px', lineHeight: '1.6', boxShadow: msg.role === 'user' ? '0 2px 8px rgba(227,6,19,0.2)' : 'none' }}>
              {msg.content}
            </div>
            <span style={{ fontSize: '11px', color: c.textMuted, marginTop: '4px', padding: '0 4px' }}>{msg.time}</span>
          </div>
        ))}
        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', maxWidth: '85%' }}>
            <div style={{ padding: '14px 18px', borderRadius: '18px 18px 18px 4px', background: c.bubbleBg, border: `1px solid ${c.bubbleBorder}`, display: 'flex', gap: '5px', alignItems: 'center' }}>
              {[0, 1, 2].map(i => (<div key={i} className="typing-dot" style={{ width: '7px', height: '7px', borderRadius: '50%', background: darkMode ? '#64748b' : '#002157', animationDelay: `${i * 0.2}s` }} />))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: '12px 16px', flexShrink: 0, background: c.subHeaderBg, borderTop: `1px solid ${c.surfaceBorder}` }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(e)} placeholder="Décrivez votre recherche..." disabled={isLoading} style={{ flex: 1, height: '48px', padding: '0 16px', border: `1.5px solid ${c.inputBorder}`, borderRadius: '24px', fontSize: '14px', fontFamily: "'Inter', sans-serif", color: c.text, background: c.inputBg, outline: 'none', transition: 'border-color 0.2s' }} onFocus={e => e.target.style.borderColor = '#E30613'} onBlur={e => e.target.style.borderColor = c.inputBorder} />
          <button onClick={sendMessage} disabled={isLoading || !input.trim()} style={{ width: '48px', height: '48px', flexShrink: 0, background: '#E30613', border: 'none', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: !input.trim() || isLoading ? 'not-allowed' : 'pointer', opacity: !input.trim() || isLoading ? 0.5 : 1, transition: 'opacity 0.2s', boxShadow: '0 4px 12px rgba(227,6,19,0.3)' }}>
            <svg width="20" height="20" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
          </button>
        </div>
      </div>
    </div>
    );
  };

  // ━━━━━━━━━━━━ MATCHS DRAWER ━━━━━━━━━━━━
  const renderMatchsDrawer = () => {
    if (!isMatchDrawerOpen) return null;
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1200, display: 'flex', background: c.overlay }} onClick={() => setIsMatchDrawerOpen(false)}>
        <div onClick={e => e.stopPropagation()} style={{ background: c.bg, width: '85%', maxWidth: '380px', height: '100vh', display: 'flex', flexDirection: 'column', boxShadow: '4px 0 24px rgba(0,0,0,0.3)', animation: 'slideInLeft 0.3s cubic-bezier(0.16,1,0.3,1)' }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${c.surfaceBorder}`, background: c.subHeaderBg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="22" height="22" fill="none" stroke="#E30613" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: c.text }}>Mes Matchs</h2>
              <span style={{ fontSize: '12px', color: c.textMuted, background: darkMode ? '#1a2744' : '#f3f4f6', padding: '3px 10px', borderRadius: '20px', fontWeight: '600' }}>{requests.length}</span>
            </div>
            <button onClick={() => setIsMatchDrawerOpen(false)} style={{ background: 'none', border: 'none', color: c.textMuted, cursor: 'pointer', padding: '4px' }}>
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', background: c.bg }}>
            {requestsLoading ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: c.textMuted }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#E30613" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite', margin: '0 auto', display: 'block' }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>
                <p style={{ fontSize: '14px', marginTop: '12px' }}>Chargement...</p>
              </div>
            ) : requests.length === 0 ? (
              <EmptyState emoji="🏅" title="Aucun match en cours" hint="Discute avec l’Agent IA pour lancer ta première recherche." theme={c} darkMode={darkMode} padding="60px 20px" emojiSize="36px" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {requests.map((req, index) => {
                  const st = statusConfig[req.status] || statusConfig.pending;
                  return (
                    <div key={req.id} className="card-anim" onClick={() => { setIsMatchDrawerOpen(false); setSelectedRequest(req); }} style={{ background: c.cardBg, border: `1px solid ${c.cardBorder}`, borderRadius: '16px', padding: '18px', cursor: 'pointer', transition: 'transform 0.15s', animationDelay: `${index * 0.05}s` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: st.bgColor, color: st.color, padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', border: `1px solid ${st.borderColor}` }}>{st.label}</div>
                        <span style={{ fontSize: '11px', color: c.textMuted }}>{formatDate(req.createdAt)}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: darkMode ? 'rgba(227,6,19,0.05)' : '#fef2f2', border: `1px solid ${darkMode ? 'rgba(227,6,19,0.2)' : '#fecaca'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><SportIcon name={req.sportName} size={24} /></div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h3 style={{ fontSize: '15px', fontWeight: '700', color: c.text, margin: '0 0 4px' }}>{req.sportName}</h3>
                          <p style={{ fontSize: '12px', color: c.textMuted, margin: 0 }}>{req.location} · {req.time}</p>
                        </div>
                        <svg width="18" height="18" fill="none" stroke={c.textMuted} strokeWidth="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" /></svg>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ━━━━━━━━━━━━ EMPLOI DU TEMPS ━━━━━━━━━━━━
  const renderEmploiPage = () => {
    const jours = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

    // Support for 2 weeks (activeDay from 0 to 9)
    const isNextWeek = activeDay >= 5;
    const currentMonday = new Date(monday);
    if (isNextWeek) currentMonday.setDate(currentMonday.getDate() + 7);

    const currentFriday = new Date(currentMonday);
    currentFriday.setDate(currentMonday.getDate() + 4);

    const fmtShort = (d) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(d);
    const fmtWeek = `Semaine du ${fmtShort(currentMonday)} au ${fmtShort(currentFriday)} ${currentFriday.getFullYear()}`;

    // Build the date for the active day (0-4 = this week, 5-9 = next week)
    const dayDate = new Date(monday);
    const daysToAdd = activeDay >= 5 ? activeDay + 2 : activeDay; // Skip weekend
    dayDate.setDate(monday.getDate() + daysToAdd);
    const fmtDay = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(dayDate);

    // Type badge colors — exactly matching mockup
    const typeColor = (t) => {
      const u = (t || '').toUpperCase();
      if (u === 'MATCH') return { bg: '#047857', text: 'white' };
      if (u === 'CM') return { bg: '#E30613', text: 'white' };
      if (u === 'TD') return { bg: '#002157', text: 'white' };
      if (u === 'TP') return { bg: '#6b7280', text: 'white' };
      if (u === 'COURS') return { bg: '#E30613', text: 'white' };
      return { bg: '#e5e7eb', text: '#374151' };
    };

    const formatHour = (val) => {
      if (!val) return '--:--';
      const d = new Date(val);
      if (!isNaN(d)) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      return String(val).substring(0, 5);
    };

    // Filter events for the selected day
    const todayEvents = (scheduleData?.events || []).filter(ev => {
      const st = new Date(ev.start_time);
      if (isNaN(st)) return false;
      // Compare date (year/month/day) only
      return (
        st.getFullYear() === dayDate.getFullYear() &&
        st.getMonth() === dayDate.getMonth() &&
        st.getDate() === dayDate.getDate()
      );
    });

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: c.bg }}>

        {/* ── Hero banner ── */}
        <div style={{ margin: '16px 16px 0', borderRadius: '20px', background: 'linear-gradient(135deg, #002157 0%, #001a44 50%, #8b1a2b 80%, #E30613 100%)', padding: '22px 20px', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ color: 'white', fontSize: '20px', fontWeight: '800', margin: '0 0 6px' }}>Emploi du Temps</h2>
              <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '12px', margin: '0 0 4px' }}>Cours INSA + matchs INSAMATCH</p>
              <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '13px', margin: '0 0 2px' }}>{fmtWeek}</p>
              {scheduleData && (
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', margin: 0 }}>
                  {scheduleData.user_role === 'professor' && scheduleData.professor_trigram
                    ? `Enseignant · trigramme ${scheduleData.professor_trigram}`
                    : `${scheduleData.department}TC Groupe ${scheduleData.class_group} – Télécommunications`}
                </p>
              )}
            </div>
            <svg width="28" height="28" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
        </div>

        {/* ── Day selector ── */}
        <div style={{ margin: '12px 16px 0', background: c.surface, borderRadius: '16px', border: `1px solid ${c.surfaceBorder}`, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <button onClick={() => setActiveDay(d => Math.max(0, d - 1))} disabled={activeDay === 0} style={{ background: 'none', border: 'none', cursor: activeDay === 0 ? 'not-allowed' : 'pointer', opacity: activeDay === 0 ? 0.3 : 1, padding: '4px', lineHeight: 0, color: c.text }}>
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '17px', fontWeight: '700', color: '#E30613', margin: '0 0 2px', textTransform: 'capitalize' }}>{jours[activeDay % 5]}</p>
            <p style={{ fontSize: '12px', color: c.textMuted, margin: 0, textTransform: 'capitalize' }}>{fmtDay}</p>
          </div>
          <button onClick={() => setActiveDay(d => Math.min(9, d + 1))} disabled={activeDay === 9} style={{ background: 'none', border: 'none', cursor: activeDay === 9 ? 'not-allowed' : 'pointer', opacity: activeDay === 9 ? 0.3 : 1, padding: '4px', lineHeight: 0, color: c.text }}>
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>

        {/* ── Events list ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px' }}>
          {scheduleLoading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: c.textMuted }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#E30613" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite', margin: '0 auto', display: 'block' }}>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
              <p style={{ fontSize: '14px', marginTop: '12px' }}>Chargement...</p>
            </div>
          ) : todayEvents.length === 0 ? (
            <EmptyState emoji="📅" title="Aucune activité ce jour" hint="Ni cours ni match INSAMATCH de prévu." theme={c} darkMode={darkMode} padding="60px 20px" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {todayEvents.map((ev, i) => {
                const isMatch = ev.source === 'insmatch';
                const tc = typeColor(ev.type);
                const displayTitle = ev.subject || ev.title;
                const subtitle = ev.subtitle;
                const prof = ev.professor || 'N/A';
                const loc = ev.location || 'N/A';
                const matchStatusLabel = ev.ins_match_status === 'pending_acceptance' ? 'À confirmer (Mes matchs)' : 'Confirmé';

                if (isMatch) {
                  const sportFromTitle = (displayTitle || '').replace(/^Match INSAMATCH ·\s*/i, '').trim() || 'Sport';
                  return (
                    <div key={`insmatch-${ev.id}-${i}`} style={{
                      background: c.surface,
                      border: `1px solid ${darkMode ? '#14532d' : '#a7f3d0'}`,
                      borderRadius: '16px',
                      padding: '16px 18px',
                      boxShadow: darkMode ? 'none' : '0 1px 4px rgba(0,0,0,0.06)',
                    }}>
                      <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ display: 'flex' }}><SportIcon name={sportFromTitle} size={22} /></span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h3 style={{ fontSize: '15px', fontWeight: '700', color: c.text, margin: '0 0 6px' }}>
                            {displayTitle}
                            {subtitle ? <span style={{ fontWeight: '400', color: c.textMuted, fontSize: '14px' }}> — {subtitle}</span> : null}
                          </h3>
                          <span style={{
                            display: 'inline-block',
                            fontSize: '11px', fontWeight: '700',
                            padding: '3px 10px', borderRadius: '8px',
                            background: tc.bg, color: tc.text,
                            letterSpacing: '0.5px',
                          }}>MATCH</span>
                          {ev.ins_match_status && (
                            <span style={{
                              display: 'inline-block',
                              marginLeft: '8px',
                              fontSize: '11px', fontWeight: '600',
                              padding: '3px 10px', borderRadius: '8px',
                              background: darkMode ? '#1e3a2f' : '#ecfdf5',
                              color: darkMode ? '#a7f3d0' : '#047857',
                            }}>{matchStatusLabel}</span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginTop: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: c.textMuted }}>
                          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                          </svg>
                          {formatHour(ev.start_time)} – {formatHour(ev.end_time)}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: c.textMuted }}>
                          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                          </svg>
                          {loc !== 'N/A' ? loc : 'Lieu à préciser'}
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={`course-${ev.id}-${i}`} style={{
                    background: c.surface,
                    border: `1px solid ${c.surfaceBorder}`,
                    borderRadius: '16px',
                    padding: '16px 18px',
                    boxShadow: darkMode ? 'none' : '0 1px 4px rgba(0,0,0,0.06)',
                  }}>
                    {/* Title row */}
                    <div style={{ marginBottom: '8px' }}>
                      <h3 style={{ fontSize: '15px', fontWeight: '700', color: c.text, margin: '0 0 6px' }}>
                        {displayTitle}
                        {subtitle ? <span style={{ fontWeight: '400', color: c.textMuted, fontSize: '14px' }}> – {subtitle}</span> : null}
                      </h3>
                      {/* Type badge */}
                      {ev.type && (
                        <span style={{
                          display: 'inline-block',
                          fontSize: '11px', fontWeight: '700',
                          padding: '3px 10px', borderRadius: '8px',
                          background: tc.bg, color: tc.text,
                          letterSpacing: '0.5px',
                        }}>{ev.type}</span>
                      )}
                    </div>

                    {/* Info rows */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginTop: '8px' }}>
                      {/* Time */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: c.textMuted }}>
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                        </svg>
                        {formatHour(ev.start_time)} – {formatHour(ev.end_time)}
                      </div>
                      {/* Professor */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: c.textMuted }}>
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                        </svg>
                        {prof}
                      </div>
                      {/* Location */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: c.textMuted }}>
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                        </svg>
                        {loc}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ━━━━━━━━━━━━ EDIT PROFILE MODAL ━━━━━━━━━━━━
  const renderEditProfileModal = () => {
    if (!isEditingProfile || !editForm) return null;
    const editIsProfessor = profileData?.user?.user_role === 'professor';
    const levels = ['Débutant', 'Intermédiaire', 'Avancé'];
    const inputStyle = {
      width: '100%', padding: '10px 14px', borderRadius: '10px',
      border: `1.5px solid ${c.inputBorder}`, background: c.inputBg,
      color: c.text, fontSize: '14px', fontFamily: "'Inter', sans-serif",
      outline: 'none', boxSizing: 'border-box',
    };
    const labelStyle = { fontSize: '12px', color: c.textMuted, marginBottom: '6px', display: 'block', fontWeight: '600' };
    const fieldStyle = { marginBottom: '14px' };

    const toggleSport = (sportId) => {
      const existing = editForm.sports.find(s => s.sport_id === sportId);
      if (existing) {
        setEditForm(f => ({ ...f, sports: f.sports.filter(s => s.sport_id !== sportId) }));
      } else {
        setEditForm(f => ({ ...f, sports: [...f.sports, { sport_id: sportId, level: 'Débutant' }] }));
      }
    };

    const setSportLevel = (sportId, level) => {
      setEditForm(f => ({ ...f, sports: f.sports.map(s => s.sport_id === sportId ? { ...s, level } : s) }));
    };

    return (
      <div onClick={() => setIsEditingProfile(false)} style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: c.overlay, zIndex: 2000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px', animation: 'fadeIn 0.2s ease',
      }}>
        <div onClick={e => e.stopPropagation()} style={{
          background: c.surface, borderRadius: '24px', width: '100%', maxWidth: '480px',
          maxHeight: '90vh', overflowY: 'auto',
          border: `1px solid ${c.surfaceBorder}`,
          boxShadow: '0 24px 80px rgba(0,0,0,0.25)',
        }}>
          {/* Header */}
          <div style={{ padding: '20px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#002157', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
              </div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: c.text }}>Modifier le profil</h2>
            </div>
            <button onClick={() => setIsEditingProfile(false)} style={{ background: darkMode ? '#1a2744' : '#f3f4f6', border: 'none', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" fill="none" stroke={c.text} strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>

          <div style={{ padding: '0 20px 20px' }}>
            {/* Nom / Prénom */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={labelStyle}>Prénom</label>
                <input style={inputStyle} value={editForm.first_name} onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))} placeholder="Prénom" />
              </div>
              <div>
                <label style={labelStyle}>Nom</label>
                <input style={inputStyle} value={editForm.last_name} onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))} placeholder="Nom" />
              </div>
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Email</label>
              <input style={inputStyle} value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} placeholder="email@insa-lyon.fr" />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Téléphone</label>
              <input style={inputStyle} value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} placeholder="+33 6 12 34 56 78" />
            </div>

            {editIsProfessor ? (
              <div style={fieldStyle}>
                <label style={labelStyle}>Trigramme</label>
                <input
                  style={inputStyle}
                  value={editForm.professor_trigram || ''}
                  onChange={e => setEditForm(f => ({ ...f, professor_trigram: e.target.value.toUpperCase().replace(/[^A-Za-z]/g, '') }))}
                  placeholder="Ex : CGO"
                  maxLength={6}
                />
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={labelStyle}>Année</label>
                  <input style={inputStyle} value={editForm.department} onChange={e => setEditForm(f => ({ ...f, department: e.target.value }))} placeholder="3 ou 4" />
                </div>
                <div>
                  <label style={labelStyle}>Groupe</label>
                  <input style={inputStyle} value={editForm.class_group} onChange={e => setEditForm(f => ({ ...f, class_group: e.target.value }))} placeholder="1" />
                </div>
              </div>
            )}

            {/* Sports */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ ...labelStyle, marginBottom: '12px' }}>Mes sports</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(editForm.availableSports || []).map(sport => {
                  const active = editForm.sports.find(s => s.sport_id === sport.id);
                  return (
                    <div key={sport.id} style={{ background: c.cardBg, border: `1.5px solid ${active ? '#E30613' : c.cardBorder}`, borderRadius: '12px', padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ display: 'flex' }}><SportIcon name={sport.name} size={18} /></span>
                          <span style={{ fontSize: '14px', fontWeight: '600', color: c.text }}>{sport.name}</span>
                        </div>
                        <button onClick={() => toggleSport(sport.id)} style={{
                          width: '28px', height: '28px', borderRadius: '50%', border: 'none', cursor: 'pointer',
                          background: active ? '#E30613' : (darkMode ? '#1a2744' : '#e5e7eb'),
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          {active
                            ? <svg width="14" height="14" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                            : <svg width="14" height="14" fill="none" stroke={c.textMuted} strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>}
                        </button>
                      </div>
                      {active && (
                        <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                          {levels.map(lv => (
                            <button key={lv} onClick={() => setSportLevel(sport.id, lv)} style={{
                              flex: 1, padding: '6px 4px', borderRadius: '8px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', border: 'none',
                              background: active.level === lv ? '#002157' : (darkMode ? '#1a2744' : '#e5e7eb'),
                              color: active.level === lv ? 'white' : c.textMuted,
                            }}>{lv}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Error */}
            {editError && <p style={{ color: '#E30613', fontSize: '13px', marginBottom: '12px', textAlign: 'center' }}>{editError}</p>}

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setIsEditingProfile(false)} style={{
                flex: 1, padding: '13px', borderRadius: '12px', border: `1.5px solid ${c.cardBorder}`,
                background: 'transparent', color: c.text, fontWeight: '700', fontSize: '14px', cursor: 'pointer',
                fontFamily: "'Inter', sans-serif",
              }}>Annuler</button>
              <button onClick={updateProfile} disabled={editSaving} style={{
                flex: 2, padding: '13px', borderRadius: '12px', border: 'none',
                background: editSaving ? '#9ca3af' : '#002157', color: 'white', fontWeight: '700', fontSize: '14px',
                cursor: editSaving ? 'not-allowed' : 'pointer', fontFamily: "'Inter', sans-serif",
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}>
                {editSaving ? (
                  <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>Enregistrement...</>
                ) : (
                  <><svg width="16" height="16" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>Enregistrer</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ━━━━━━━━━━━━ POPUP DETAIL ━━━━━━━━━━━━
  const renderDetailPopup = () => {
    if (!selectedRequest) return null;
    const req = selectedRequest;
    const st = statusConfig[req.status] || statusConfig.pending;

    return (
      <div onClick={() => setSelectedRequest(null)} style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: c.overlay, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px', animation: 'fadeIn 0.2s ease',
      }}>
        <div onClick={e => e.stopPropagation()} style={{
          background: c.surface, borderRadius: '24px', width: '100%', maxWidth: '440px',
          maxHeight: '85vh', overflowY: 'auto',
          border: `1px solid ${c.surfaceBorder}`,
          boxShadow: '0 24px 80px rgba(0,0,0,0.2)',
        }}>
          {/* Popup Header */}
          <div style={{ padding: '20px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: st.bgColor, color: st.color, padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: '600', border: `1px solid ${st.borderColor}` }}>
              {st.label}
            </div>
            <button onClick={() => setSelectedRequest(null)} style={{ background: darkMode ? '#1a2744' : '#f3f4f6', border: 'none', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" fill="none" stroke={c.text} strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>

          {/* Sport Title */}
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'center' }}><SportIcon name={req.sportName} size={48} /></div>
            <h2 style={{ fontSize: '24px', fontWeight: '800', color: c.text, margin: '0 0 4px' }}>{req.sportName}</h2>
            <p style={{ fontSize: '13px', color: c.textMuted, margin: 0 }}>{st.description}</p>
          </div>

          {/* Details Grid */}
          <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Lieu */}
            <div style={{ background: darkMode ? '#0a1628' : '#f9fafb', borderRadius: '14px', padding: '16px', border: `1px solid ${c.cardBorder}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <svg width="18" height="18" fill="none" stroke="#E30613" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                <span style={{ fontSize: '12px', fontWeight: '600', color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lieu</span>
              </div>
              <p style={{ fontSize: '15px', fontWeight: '600', color: c.text, margin: 0 }}>{req.location}</p>
              {/* Mini map */}
              {(() => {
                const venue = venuesData.find(v => v.name.toLowerCase().includes(req.location.toLowerCase()) || req.location.toLowerCase().includes(v.name.toLowerCase()));
                if (venue && venue.latitude && venue.longitude) {
                  return (
                    <div style={{ marginTop: '10px', borderRadius: '10px', overflow: 'hidden', height: '120px', border: `1px solid ${c.cardBorder}` }}>
                      <MapContainer
                        center={[venue.latitude, venue.longitude]}
                        zoom={16}
                        zoomControl={false}
                        dragging={false}
                        scrollWheelZoom={false}
                        doubleClickZoom={false}
                        touchZoom={false}
                        style={{ height: '100%', width: '100%', zIndex: 1 }}
                      >
                        <TileLayer url={darkMode ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'} />
                        <Marker position={[venue.latitude, venue.longitude]} icon={iconAvailable} />
                      </MapContainer>
                    </div>
                  );
                }
                return (
                  <div style={{ marginTop: '10px', borderRadius: '10px', overflow: 'hidden', height: '120px', background: darkMode ? '#162a4a' : '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${c.cardBorder}` }}>
                    <div style={{ textAlign: 'center', color: c.textMuted }}>
                      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" style={{ margin: '0 auto 4px', display: 'block' }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                      <span style={{ fontSize: '11px' }}>Carte indisponible</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Créneau */}
            <div style={{ background: darkMode ? '#0a1628' : '#f9fafb', borderRadius: '14px', padding: '16px', border: `1px solid ${c.cardBorder}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <svg width="18" height="18" fill="none" stroke="#E30613" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                <span style={{ fontSize: '12px', fontWeight: '600', color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Créneau</span>
              </div>
              <p style={{ fontSize: '15px', fontWeight: '600', color: c.text, margin: 0 }}>{req.time}</p>
            </div>

            {/* Partenaire */}
            {req.partner && (req.status === 'matched' || req.status === 'accepted') && (
              <div style={{ background: darkMode ? '#0a1628' : '#f9fafb', borderRadius: '14px', padding: '16px', border: `1px solid ${c.cardBorder}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <svg width="18" height="18" fill="none" stroke="#3b82f6" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{req.status === 'accepted' ? 'Partenaire' : 'Partenaire proposé'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#002157', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'white', fontWeight: '700', fontSize: '15px' }}>
                    {(req.partner.firstName?.[0] || '?')}{(req.partner.lastName?.[0] || '')}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '15px', fontWeight: '600', color: c.text, margin: 0 }}>{req.partner.firstName} {req.partner.lastName}</p>
                    <p style={{ fontSize: '12px', color: c.textMuted, margin: '4px 0 0', wordBreak: 'break-all' }}>{req.partner.email}</p>
                    {req.status === 'matched' && !req.needsMyAction && (
                      <>
                        <p style={{ fontSize: '12px', color: '#3b82f6', margin: '8px 0 0' }}>Tu as accepté — en attente de l&apos;autre joueur.</p>
                        {req.matchId && req.matchStatus === 'pending_acceptance' && (
                          <button
                            type="button"
                            disabled={!!matchCancelConfirm || matchCancelLoading}
                            onClick={() => openMatchCancelModal(req.matchId, req.sportName, req.time)}
                            style={{
                              marginTop: '10px', width: '100%', padding: '10px', borderRadius: '10px',
                              border: `1.5px solid ${c.cardBorder}`, background: 'transparent', color: c.text,
                              fontWeight: '700', fontSize: '13px', cursor: matchCancelLoading ? 'wait' : 'pointer',
                            }}
                          >
                            Annuler le match
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {req.status === 'matched' && req.needsMyAction && req.matchId && (
                  <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                    <button type="button" disabled={respondLoading || matchCancelLoading || !!matchCancelConfirm} onClick={() => respondToMatch(req.id, 'accept')} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: (respondLoading || matchCancelLoading || matchCancelConfirm) ? '#86efac' : '#22c55e', color: 'white', fontWeight: '700', fontSize: '14px', cursor: (respondLoading || matchCancelLoading || matchCancelConfirm) ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <svg width="16" height="16" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                      Accepter
                    </button>
                    <button
                      type="button"
                      disabled={respondLoading || !!matchCancelConfirm || matchCancelLoading}
                      onClick={() => openMatchCancelModal(req.matchId, req.sportName, req.time)}
                      style={{ flex: 1, padding: '12px', borderRadius: '12px', border: `1.5px solid ${c.cardBorder}`, background: 'transparent', color: c.text, fontWeight: '700', fontSize: '14px', cursor: (respondLoading || matchCancelLoading) ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      Annuler le match
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Infos supplémentaires */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 4px' }}>
              <span style={{ fontSize: '12px', color: c.textMuted }}>Créée le {formatDate(req.createdAt)}</span>
              <span style={{ fontSize: '12px', color: c.textMuted }}>ID: {req.id.substring(0, 8)}...</span>
            </div>

            {/* Annuler le match confirmé (hors bandeau Accepter / Annuler ci-dessus) */}
            {req.matchId && req.matchStatus === 'scheduled' && (
              <button
                type="button"
                disabled={!!matchCancelConfirm || matchCancelLoading}
                onClick={() => openMatchCancelModal(req.matchId, req.sportName, req.time)}
                style={{
                  width: '100%', padding: '12px', borderRadius: '12px', marginTop: '10px',
                  border: 'none', background: '#E30613',
                  color: 'white', fontWeight: '700', fontSize: '14px', cursor: matchCancelLoading ? 'wait' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  opacity: matchCancelLoading ? 0.75 : 1,
                }}
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                Annuler le match
              </button>
            )}

            {/* Supprimer la recherche seule (sans match lié) */}
            {!req.matchId && req.status === 'pending' && (
              <button onClick={() => setRequestToDelete(req.id)} style={{
                width: '100%', padding: '12px', borderRadius: '12px', marginTop: '10px',
                border: `1.5px solid #E30613`, background: 'transparent',
                color: '#E30613', fontWeight: '700', fontSize: '14px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                transition: 'all 0.2s',
              }}>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                Supprimer cette demande
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ━━━━━━━━━━━━ COMMUNITY PANEL ━━━━━━━━━━━━
  const renderCommunityPanel = () => {
    if (communityLoading) {
      return (
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.bg }}>
          <p style={{ color: c.textMuted, fontSize: '14px' }}>Chargement de la communauté...</p>
        </div>
      );
    }

    if (!communityData) {
      return (
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.bg }}>
          <p style={{ color: c.textMuted, fontSize: '14px' }}>Erreur lors du chargement.</p>
        </div>
      );
    }

    const { stats, topAthletes, recentActivity } = communityData;

    const rankColors = ['#E30613', '#002157', '#8b5e3c'];

    const getLevelStyle = (level) => {
      if (level === 'Expert' || level === 'Avancé') return { bg: darkMode ? '#0a1a10' : '#f0fdf4', color: '#16a34a', border: darkMode ? '#1a3a20' : '#bbf7d0' };
      if (level === 'Intermédiaire') return { bg: darkMode ? '#1a1014' : '#fef2f2', color: '#E30613', border: darkMode ? '#3a1a1a' : '#fecaca' };
      return { bg: darkMode ? '#1a1a1a' : '#f3f4f6', color: '#6b7280', border: darkMode ? '#333' : '#d1d5db' };
    };

    const getSportTagStyle = (sport) => {
      const n = (sport || '').toLowerCase();
      if (n.includes('tennis')) return { bg: darkMode ? '#1a1014' : '#fef2f2', color: '#E30613' };
      if (n.includes('badminton')) return { bg: darkMode ? '#1a1014' : '#fef2f2', color: '#E30613' };
      if (n.includes('basket')) return { bg: darkMode ? '#0f1020' : '#eff6ff', color: '#2563eb' };
      if (n.includes('foot')) return { bg: darkMode ? '#0f1020' : '#eff6ff', color: '#2563eb' };
      if (n.includes('natation')) return { bg: darkMode ? '#0a1a1a' : '#f0fdfa', color: '#0d9488' };
      return { bg: darkMode ? '#1a1a1a' : '#f3f4f6', color: '#6b7280' };
    };

    return (
      <div style={{ height: '100%', overflowY: 'auto', background: c.bg }}>
        {/* ── SEARCH BAR ── */}
        <div style={{ padding: '16px 16px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: c.surface, border: `1.5px solid ${c.surfaceBorder}`, borderRadius: '14px', padding: '10px 14px' }}>
            <svg width="16" height="16" fill="none" stroke={c.textMuted} strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input
              type="text"
              value={communitySearch}
              onChange={e => { setCommunitySearch(e.target.value); fetchCommunitySearch(e.target.value); }}
              placeholder="Rechercher un étudiant..."
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '14px', color: c.text, fontFamily: "'Inter', sans-serif" }}
            />
            {communitySearch && <button onClick={() => { setCommunitySearch(''); setSearchResults([]); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.textMuted, padding: 0, lineHeight: 0 }}><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg></button>}
          </div>
        </div>

        {/* ── SEARCH RESULTS ── */}
        {communitySearch.trim() ? (
          <div style={{ padding: '12px 16px' }}>
            {searchLoading ? (
              <p style={{ color: c.textMuted, fontSize: '13px' }}>Recherche...</p>
            ) : searchResults.length === 0 ? (
              <p style={{ color: c.textMuted, fontSize: '13px' }}>Aucun résultat pour « {communitySearch} »</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {searchResults.map(u => (
                  <div key={u.id} onClick={() => fetchCommunityUserProfile(u.id)} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: c.surface, border: `1px solid ${c.surfaceBorder}`, borderRadius: '14px', padding: '14px', cursor: 'pointer' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'linear-gradient(135deg, #002157, #E30613)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '16px', flexShrink: 0 }}>{u.firstName.charAt(0)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '14px', fontWeight: '700', color: c.text, margin: '0 0 2px' }}>{u.firstName} {u.lastName}</p>
                      <p style={{ fontSize: '12px', color: c.textMuted, margin: 0 }}>
                        {u.userRole === 'professor'
                          ? `Enseignant · ${u.professorTrigram || '—'}`
                          : `${u.department}ème année · Groupe ${u.classGroup}`}
                      </p>
                    </div>
                    {u.mainSport && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '600', padding: '3px 10px', borderRadius: '8px', background: darkMode ? '#1a2744' : '#eff6ff', color: '#2563eb', flexShrink: 0 }}>
                        <SportIcon name={u.mainSport} size={14} />
                        <span>{u.mainSport}</span>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (<>
          {/* ── HERO BANNER ── */}
          <div style={{
            margin: '16px', borderRadius: '24px', overflow: 'hidden',
            background: 'linear-gradient(135deg, #002157 0%, #001a44 40%, #8b1a2b 75%, #E30613 100%)',
            padding: '28px 22px 22px',
          }}>
            <h2 style={{ color: 'white', fontSize: '22px', fontWeight: '800', margin: '0 0 6px' }}>Communauté INSAMATCH</h2>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', margin: '0 0 20px', lineHeight: '1.5' }}>
              Connectez-vous avec les étudiants sportifs de l'INSA Lyon
            </p>

            {/* Stats row */}
            <div style={{ display: 'flex', gap: '10px' }}>
              {[
                { icon: <svg width="20" height="20" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>, value: stats.totalUsers.toLocaleString(), label: 'Étudiants actifs' },
                { icon: <svg width="20" height="20" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>, value: stats.matchesThisWeek.toLocaleString(), label: 'Matchs cette semaine' },
                { icon: <svg width="20" height="20" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C7 4 7 7 7 7" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5C17 4 17 7 17 7" /><path d="M4 22h16" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></svg>, value: stats.totalSports.toString(), label: 'Sports disponibles' },
              ].map((s, i) => (
                <div key={i} style={{
                  flex: 1, background: 'rgba(255,255,255,0.12)', borderRadius: '16px',
                  padding: '14px 10px', textAlign: 'center',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}>
                  <div style={{ marginBottom: '6px', display: 'flex', justifyContent: 'center' }}>{s.icon}</div>
                  <p style={{ color: 'white', fontSize: '22px', fontWeight: '800', margin: '0 0 2px' }}>{s.value}</p>
                  <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '10px', fontWeight: '500', margin: 0, lineHeight: '1.3' }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── TOP ATHLÈTES DU MOIS ── */}
          <div style={{
            margin: '0 16px 16px', padding: '20px',
            background: c.surface, borderRadius: '20px',
            border: `1px solid ${c.surfaceBorder}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
              <svg width="18" height="18" fill="none" stroke="#f59e0b" strokeWidth="2" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
              <h3 style={{ fontSize: '17px', fontWeight: '700', color: c.text, margin: 0 }}>Top Athlètes du Mois</h3>
            </div>

            {topAthletes.length === 0 ? (
              <p style={{ color: c.textMuted, fontSize: '13px' }}>Aucun athlète pour le moment. Fais ton premier match !</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {topAthletes.map((athlete, i) => {
                  const initial = athlete.firstName.charAt(0).toUpperCase();
                  const lvl = getLevelStyle(athlete.level);
                  const sportTag = getSportTagStyle(athlete.mainSport);
                  return (
                    <div key={athlete.id} style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '12px 14px', borderRadius: '14px',
                      background: c.bg, border: `1px solid ${c.surfaceBorder}`,
                    }}>
                      {/* Avatar + rank badge */}
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <div style={{
                          width: '44px', height: '44px', borderRadius: '50%',
                          background: `linear-gradient(135deg, ${rankColors[i] || '#6b7280'}, ${i === 0 ? '#8b1a2b' : i === 1 ? '#001a44' : '#6b5e3c'})`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'white', fontSize: '18px', fontWeight: '700',
                        }}>{initial}</div>
                        {i < 3 && (
                          <div style={{
                            position: 'absolute', top: '-4px', right: '-4px',
                            width: '20px', height: '20px', borderRadius: '50%',
                            background: rankColors[i], color: 'white',
                            fontSize: '11px', fontWeight: '800',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: `2px solid ${c.bg}`,
                          }}>{i + 1}</div>
                        )}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '14px', fontWeight: '700', color: c.text, margin: '0 0 2px' }}>
                          {athlete.firstName} {athlete.lastName}
                        </p>
                        <p style={{ fontSize: '11px', color: c.textMuted, margin: '0 0 4px' }}>
                          {athlete.department} {athlete.classGroup}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {athlete.mainSport && (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px',
                              background: sportTag.bg, color: sportTag.color,
                            }}>
                              <SportIcon name={athlete.mainSport} size={12} />
                              {athlete.mainSport}
                            </span>
                          )}
                          <span style={{ fontSize: '11px', color: c.textMuted }}>{athlete.totalMatches} matchs</span>
                        </div>
                      </div>

                      {/* Level badge */}
                      {athlete.level && (
                        <span style={{
                          fontSize: '11px', fontWeight: '600', padding: '4px 10px', borderRadius: '20px',
                          background: lvl.bg, color: lvl.color, border: `1px solid ${lvl.border}`,
                          flexShrink: 0,
                        }}>{athlete.level}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── ACTIVITÉ RÉCENTE ── */}
          <div style={{
            margin: '0 16px 100px', padding: '20px',
            background: c.surface, borderRadius: '20px',
            border: `1px solid ${c.surfaceBorder}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
              <svg width="18" height="18" fill="none" stroke="#E30613" strokeWidth="2" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
              <h3 style={{ fontSize: '17px', fontWeight: '700', color: c.text, margin: 0 }}>Activité Récente</h3>
            </div>

            {recentActivity.length === 0 ? (
              <p style={{ color: c.textMuted, fontSize: '13px' }}>Aucune activité récente.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {recentActivity.map((activity, i) => (
                  <div key={i} style={{
                    padding: '14px 16px', borderRadius: '14px',
                    background: c.bg, borderLeft: '3px solid #E30613',
                    border: `1px solid ${c.surfaceBorder}`,
                  }}>
                    <p style={{ fontSize: '13px', color: c.text, margin: '0 0 4px', lineHeight: '1.5' }}>
                      <span style={{ color: '#E30613', fontWeight: '700' }}>{activity.userName}</span>
                      {' '}{activity.message}
                    </p>
                    <p style={{ fontSize: '11px', color: c.textMuted, margin: 0 }}>{timeAgo(activity.date)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>)}

        {/* ── EXTERNAL PROFILE POPUP ── */}
        {selectedCommunityUser && (
          <div onClick={() => { setSelectedCommunityUser(null); setCommunityUserProfile(null); }} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: c.overlay, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', animation: 'fadeIn 0.2s ease' }}>
            <div onClick={e => e.stopPropagation()} style={{ background: c.bg, borderRadius: '24px', width: '100%', maxWidth: '460px', maxHeight: '90vh', overflowY: 'auto', border: `1px solid ${c.surfaceBorder}`, boxShadow: '0 24px 80px rgba(0,0,0,0.2)' }}>
              {communityUserLoading ? (
                <div style={{ padding: '60px 20px', textAlign: 'center', color: c.textMuted }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E30613" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px', display: 'block' }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>
                  <p style={{ fontSize: '14px' }}>Chargement du profil...</p>
                </div>
              ) : communityUserProfile ? (() => {
                const up = communityUserProfile;
                const getLvlColor = (level) => {
                  if (level === 'Avancé') return '#002157';
                  if (level === 'Intermédiaire') return '#E30613';
                  return '#64748b';
                };
                const maxM = 20;
                return (
                  <>
                    {/* Hero */}
                    <div style={{ margin: '16px', borderRadius: '20px', background: 'linear-gradient(135deg, #002157 0%, #001a44 40%, #8b1a2b 75%, #E30613 100%)', padding: '28px 20px 20px', position: 'relative' }}>
                      <button onClick={() => { setSelectedCommunityUser(null); setCommunityUserProfile(null); }} style={{ position: 'absolute', top: '14px', right: '14px', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="16" height="16" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      </button>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ width: '80px', height: '80px', borderRadius: '50%', margin: '0 auto 12px', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid rgba(255,255,255,0.25)', fontSize: '32px', fontWeight: '700', color: 'white' }}>{up.user.first_name.charAt(0)}</div>
                        <h2 style={{ color: 'white', fontSize: '20px', fontWeight: '700', margin: '0 0 4px' }}>{up.user.first_name} {up.user.last_name}</h2>
                        {up.user.user_role === 'professor' ? (
                          <>
                            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '14px', margin: '0 0 2px' }}>Enseignant</p>
                            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', margin: '0 0 18px' }}>Trigramme {up.user.professor_trigram || '—'}</p>
                          </>
                        ) : (
                          <>
                            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '14px', margin: '0 0 2px' }}>{up.user.department}ème année de TC</p>
                            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', margin: '0 0 18px' }}>Groupe {up.user.class_group}</p>
                          </>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {[{ v: up.stats.totalMatches, l: 'Matchs joués' }, { v: up.stats.totalSports, l: 'Sports' }, { v: up.stats.totalPartners, l: 'Partenaires' }].map((s, i) => (
                          <div key={i} style={{ flex: 1, background: 'rgba(255,255,255,0.12)', borderRadius: '14px', padding: '12px 6px', textAlign: 'center' }}>
                            <p style={{ color: 'white', fontSize: '20px', fontWeight: '800', margin: '0 0 2px' }}>{s.v}</p>
                            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '10px', fontWeight: '500', margin: 0, lineHeight: '1.3' }}>{s.l}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Informations */}
                    <div style={{ margin: '0 16px 14px', background: c.cardBg, border: `1px solid ${c.cardBorder}`, borderRadius: '18px', padding: '18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <svg width="16" height="16" fill="none" stroke="#E30613" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                        <h3 style={{ fontSize: '15px', fontWeight: '700', color: c.text, margin: 0 }}>Informations</h3>
                      </div>
                      {[
                        { label: 'Email', value: up.user.email },
                        { label: 'Téléphone', value: up.user.phone || 'Non renseigné' },
                        { label: 'Inscription', value: formatDate(up.user.created_at) },
                        { label: 'Campus', value: 'INSA Lyon' },
                      ].map((info, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < 3 ? `1px solid ${c.cardBorder}` : 'none' }}>
                          <span style={{ fontSize: '12px', color: c.textMuted }}>{info.label}</span>
                          <span style={{ fontSize: '13px', fontWeight: '600', color: c.text, textAlign: 'right', maxWidth: '60%', wordBreak: 'break-word' }}>{info.value}</span>
                        </div>
                      ))}
                    </div>

                    {/* Sports */}
                    {up.sports.length > 0 && (
                      <div style={{ margin: '0 16px 14px', background: c.cardBg, border: `1px solid ${c.cardBorder}`, borderRadius: '18px', padding: '18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                          <svg width="16" height="16" fill="none" stroke="#E30613" strokeWidth="2" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                          <h3 style={{ fontSize: '15px', fontWeight: '700', color: c.text, margin: 0 }}>Sports pratiqués</h3>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {up.sports.map((sport, i) => {
                            const lvColor = getLvlColor(sport.level);
                            const adv = sport.level === 'Avancé';
                            const lvBg = adv ? '#002157' : lvColor === '#E30613' ? (darkMode ? '#2a0a0e' : '#fef2f2') : (darkMode ? '#1a2030' : '#f3f4f6');
                            const lvFg = adv ? '#ffffff' : lvColor;
                            return (
                              <div key={i} style={{ background: c.bg, border: `1px solid ${c.cardBorder}`, borderRadius: '12px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: darkMode ? '#1a2744' : '#fef2f2', border: `1px solid ${darkMode ? '#253a5c' : '#fecaca'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <SportIcon name={sport.name} size={18} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '13px', fontWeight: '700', color: c.text }}>{sport.name}</span>
                                    <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px', background: lvBg, color: lvFg }}>{sport.level}</span>
                                  </div>
                                  <div style={{ height: '5px', borderRadius: '3px', background: darkMode ? '#1a2744' : '#e5e7eb', overflow: 'hidden' }}>
                                    <div style={{ width: `${Math.min((sport.matchCount / maxM) * 100, 100)}%`, height: '100%', borderRadius: '3px', background: '#E30613' }} />
                                  </div>
                                  <span style={{ fontSize: '11px', color: c.textMuted }}>{sport.matchCount}/{maxM} matchs</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Récompenses */}
                    <div style={{ margin: '0 16px 14px', background: c.cardBg, border: `1px solid ${c.cardBorder}`, borderRadius: '18px', padding: '18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <svg width="16" height="16" fill="none" stroke="#E30613" strokeWidth="2" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                        <h3 style={{ fontSize: '15px', fontWeight: '700', color: c.text, margin: 0 }}>Récompenses</h3>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        {up.rewards.map((r, i) => (
                          <div key={i} style={{ background: r.unlocked ? (darkMode ? '#2a0a0e' : '#fef2f2') : (darkMode ? '#111827' : '#f9fafb'), border: `1px solid ${r.unlocked ? (darkMode ? '#5c1a1a' : '#fecaca') : c.cardBorder}`, borderRadius: '12px', padding: '12px', opacity: r.unlocked ? 1 : 0.45 }}>
                            <svg width="20" height="20" fill="none" stroke={r.unlocked ? '#E30613' : c.textMuted} strokeWidth="1.5" viewBox="0 0 24 24" style={{ marginBottom: '6px' }}><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C7 4 7 7 7 7" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5C17 4 17 7 17 7" /><path d="M4 22h16" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></svg>
                            <p style={{ fontSize: '12px', fontWeight: '700', color: r.unlocked ? c.text : c.textMuted, margin: '0 0 2px' }}>{r.name}</p>
                            <p style={{ fontSize: '11px', color: c.textMuted, margin: 0, lineHeight: '1.4' }}>{r.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Matchs récents */}
                    {up.recentMatches && up.recentMatches.length > 0 && (
                      <div style={{ margin: '0 16px 20px', background: c.cardBg, border: `1px solid ${c.cardBorder}`, borderRadius: '18px', padding: '18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                          <svg width="16" height="16" fill="none" stroke="#E30613" strokeWidth="2" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                          <h3 style={{ fontSize: '15px', fontWeight: '700', color: c.text, margin: 0 }}>Matchs Récents</h3>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {up.recentMatches.map((m, i) => (
                            <div key={i} style={{ border: `1px solid ${c.cardBorder}`, borderRadius: '12px', padding: '12px 14px', background: c.bg }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                <span style={{ fontSize: '14px', fontWeight: '700', color: c.text }}>{m.sport}</span>
                                <span style={{ fontSize: '11px', color: c.textMuted }}>{formatDate(m.date)}</span>
                              </div>
                              <p style={{ fontSize: '12px', color: c.textMuted, margin: '0 0 4px' }}>avec {m.partnerName}</p>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: c.textMuted }}>
                                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                                {m.venue}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })() : null}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ━━━━━━━━━━━━ LIEUX PANEL (MAP) ━━━━━━━━━━━━
  const renderLieuxPanel = () => {
    if (venuesLoading) {
      return (
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.bg }}>
          <p style={{ color: c.textMuted, fontSize: '14px' }}>Chargement de la carte...</p>
        </div>
      );
    }

    return (
      <div style={{ height: '100%', width: '100%', position: 'relative', display: 'flex', flexDirection: 'column', background: c.bg }}>
        {/* Header simple */}
        <div style={{ padding: '20px', borderBottom: `1px solid ${c.surfaceBorder}`, background: c.surface, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="20" height="20" fill="none" stroke="#E30613" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: c.text, margin: 0 }}>Plan du Campus</h2>
          </div>
          <p style={{ color: c.textMuted, fontSize: '13px', margin: '4px 0 0' }}>Disponibilité des installations en temps réel</p>
        </div>

        {/* Conteneur de la carte */}
        <div style={{ flex: 1, position: 'relative' }}>
          {/* Légende flottante */}
          <div style={{
            position: 'absolute', top: '16px', right: '16px', zIndex: 1000,
            background: c.surface, padding: '12px 16px', borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)', border: `1px solid ${c.surfaceBorder}`
          }}>
            <p style={{ fontSize: '14px', fontWeight: '700', color: c.text, margin: '0 0 10px' }}>Légende</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#D32F2F' }}></div>
              <span style={{ fontSize: '13px', color: c.text }}>Disponible</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#9CA3AF' }}></div>
              <span style={{ fontSize: '13px', color: c.text }}>Occupé</span>
            </div>
          </div>

          <MapContainer
            center={[45.7842, 4.8805]}
            zoom={16}
            zoomControl={false}
            style={{ width: '100%', height: '100%', zIndex: 1 }}
          >
            <TileLayer
              attribution='&copy; OpenStreetMap &copy; CARTO'
              url={darkMode
                ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'}
              maxZoom={20}
            />

            {venuesData.map(venue => (
              <Marker
                key={venue.id}
                position={[venue.latitude, venue.longitude]}
                icon={venue.available ? iconAvailable : iconOccupied}
              >
                <Popup className={darkMode ? 'dark-popup' : ''}>
                  <div style={{ padding: '4px 0' }}>
                    <h3 style={{ margin: '0 0 6px', fontSize: '14px', fontWeight: '700', color: '#111827' }}>{venue.name}</h3>
                    <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#4B5563' }}>
                      <strong>Type:</strong> {venue.type}
                    </p>
                    {venue.sports && venue.sports.length > 0 && (
                      <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#4B5563' }}>
                        <strong>Sports:</strong> {venue.sports.join(', ')}
                      </p>
                    )}
                    <p style={{ margin: 0, fontSize: '12px', fontWeight: '700', color: venue.available ? '#D32F2F' : '#9CA3AF' }}>
                      {venue.available ? '● Disponible' : '● Occupé'}
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>
    );
  };

  // ━━━━━━━━━━━━ MOBILE TAB CONTENT ━━━━━━━━━━━━
  const renderMobileContent = () => {
    if (activeTab === 'ia') return renderChat();
    if (activeTab === 'emploi') return renderEmploiPage();
    if (activeTab === 'lieux') return renderLieuxPanel();
    if (activeTab === 'communaute') return renderCommunityPanel();
    if (activeTab === 'profil') return renderProfilePanel();
    return null;
  };

  // ━━━━━━━━━━━━ BOTTOM NAV ━━━━━━━━━━━━
  const bottomNavItems = [
    { id: 'ia', label: 'IA', icon: (a) => <svg width="22" height="22" fill="none" stroke={a ? '#E30613' : c.textMuted} strokeWidth="2" viewBox="0 0 24 24"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1.27A7 7 0 0 1 14 23h-4a7 7 0 0 1-6.73-4H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73A2 2 0 0 1 12 2z" /><path d="M9 17l1.5-2.5L12 17l1.5-2.5L15 17" /></svg> },
    { id: 'emploi', label: 'Emploi du temps', icon: (a) => <svg width="22" height="22" fill="none" stroke={a ? '#E30613' : c.textMuted} strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg> },
    { id: 'lieux', label: 'Lieux', icon: (a) => <svg width="22" height="22" fill="none" stroke={a ? '#E30613' : c.textMuted} strokeWidth="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg> },
    { id: 'communaute', label: 'Communauté', icon: (a) => <svg width="22" height="22" fill="none" stroke={a ? '#E30613' : c.textMuted} strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg> },
    { id: 'profil', label: 'Profil', icon: (a) => <svg width="22" height="22" fill="none" stroke={a ? '#E30613' : c.textMuted} strokeWidth="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg> },
  ];

  // ━━━━━━━━━━━━ RENDER ━━━━━━━━━━━━
  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Inter', sans-serif", background: c.bg, color: c.text, overflow: 'hidden' }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes blink { 0%,80%,100%{opacity:0} 40%{opacity:1} }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slideInLeft { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        .typing-dot { animation: blink 1.4s infinite both; }
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }
        .card-anim { animation: fadeIn 0.35s ease both; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${darkMode ? '#333' : '#d1d5db'}; border-radius: 10px; }
        .desktop-sidebar { display: none !important; }
        .desktop-chat { display: none !important; }
        @media (min-width: 900px) {
          .desktop-sidebar { display: flex !important; }
          .desktop-chat { display: ${activeTab === 'ia' ? 'flex' : 'none'} !important; }
          .mobile-content { display: ${activeTab === 'ia' ? 'none' : 'flex'} !important; }
          .hamburger-btn { display: none !important; }
        }
      `}</style>

      {/* TOP BAR */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', flexShrink: 0, background: c.headerBg, borderBottom: `1px solid ${c.headerBorder}` }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <img src="/logo.png" alt="INSAMATCH" style={{ height: '40px', objectFit: 'contain' }} />
        </div>
        <button onClick={() => setDarkMode(!darkMode)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: c.textMuted, lineHeight: 0 }}>
          {darkMode
            ? <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
            : <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
          }
        </button>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Desktop: Left sidebar */}
        <div className="desktop-sidebar" style={{ width: '260px', flexShrink: 0, borderRight: `1px solid ${c.surfaceBorder}`, background: c.surface, overflowY: 'auto', flexDirection: 'column' }}>
          {renderSearchPanel()}
        </div>

        {/* Center */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${c.surfaceBorder}`, overflow: 'hidden', minWidth: 0 }}>
          <div className="desktop-chat" style={{ display: 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
            {renderChat()}
          </div>
          <div className="mobile-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {renderMobileContent()}
          </div>
        </div>

        {/* Desktop: Right sidebar — only show on 'ia' tab */}
        {activeTab === 'ia' && (
          <div className="desktop-sidebar" style={{ width: '280px', flexShrink: 0, background: c.surface, overflowY: 'auto', flexDirection: 'column' }}>
            {renderProfilePanel()}
          </div>
        )}
      </div>

      {/* BOTTOM NAV (Mobile) */}
      <div className="mobile-bottom-nav" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '8px 0 12px', flexShrink: 0, background: c.navBg, borderTop: `1px solid ${c.navBorder}` }}>
        {bottomNavItems.map(item => {
          const active = activeTab === item.id;
          return (
            <button key={item.id} onClick={() => setActiveTab(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '4px 8px', color: active ? '#E30613' : c.textMuted }}>
              {item.icon(active)}
              <span style={{ fontSize: '10px', fontWeight: active ? '700' : '500' }}>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* POPUP */}
      {renderDetailPopup()}
      {renderMatchsDrawer()}
      {renderEditProfileModal()}
      <ConfirmDialog
        open={!!requestToDelete}
        onClose={() => setRequestToDelete(null)}
        onConfirm={confirmDeleteRequest}
        title="Supprimer la recherche ?"
        description="Êtes-vous sûr de vouloir supprimer cette recherche de partenaire ? Cette action est irréversible."
        iconVariant="delete"
        zIndex={3000}
        maxWidth={360}
        descriptionMarginBottom={24}
        theme={c}
        isDark={darkMode}
      />
      <ConfirmDialog
        open={!!matchCancelConfirm}
        onClose={closeMatchCancelModal}
        onConfirm={confirmMatchCancellation}
        title="Annuler ce match ?"
        description="Le créneau sera libéré pour toi et ton partenaire. Vous pourrez relancer une recherche ensuite."
        error={matchCancelModalError}
        cancelLabel="Retour"
        confirmLabel={matchCancelLoading ? 'Annulation…' : 'Oui, annuler'}
        confirmLoading={matchCancelLoading}
        iconVariant="cancel"
        zIndex={3500}
        theme={c}
        isDark={darkMode}
      >
        {matchCancelConfirm ? (
          <div
            style={{
              background: darkMode ? '#0a1628' : '#f9fafb',
              borderRadius: '12px',
              padding: '12px 14px',
              marginBottom: '16px',
              border: `1px solid ${c.cardBorder}`,
            }}
          >
            <p style={{ fontSize: '13px', fontWeight: '700', color: c.text, margin: '0 0 4px' }}>{matchCancelConfirm.sportName}</p>
            <p style={{ fontSize: '12px', color: c.textMuted, margin: 0 }}>{matchCancelConfirm.creneau}</p>
          </div>
        ) : null}
      </ConfirmDialog>
    </div>
  );
};

export default Dashboard;
