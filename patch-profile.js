const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend', 'src', 'components', 'Dashboard.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Remove extraneous markdown tail if present
content = content.replace("        ``` \n", "");
content = content.replace("        ```\n", "");

// 2. Add State Handlers
content = content.replace(
  "  const [profileLoading, setProfileLoading] = useState(true);",
  "  const [profileLoading, setProfileLoading] = useState(true);\n  const [isEditingProfile, setIsEditingProfile] = useState(false);\n  const [editProfileData, setEditProfileData] = useState({ first_name: '', last_name: '', email: '', phone: '', department: '', class_group: '', sports: [] });\n  const [newSportId, setNewSportId] = useState('');\n  const [newSportLevel, setNewSportLevel] = useState('Débutant');\n  const [isSavingProfile, setIsSavingProfile] = useState(false);"
);

// 3. Add Handler Logic just before renderSearchPanel
const handlerLogic = `
  const handleEditProfileClick = () => {
    if (profileData && profileData.user) {
      setEditProfileData({
        first_name: profileData.user.first_name || '',
        last_name: profileData.user.last_name || '',
        email: profileData.user.email || '',
        phone: profileData.user.phone || '',
        department: profileData.user.department || '',
        class_group: profileData.user.class_group || '',
        sports: profileData.sports ? profileData.sports.map(s => ({ sport_id: s.id, level: s.level, name: s.name })) : []
      });
    }
    setNewSportId('');
    setNewSportLevel('Débutant');
    setIsEditingProfile(true);
  };

  const handleAddSport = () => {
    if (!newSportId) return;
    const sportInfo = profileData?.availableSports?.find(s => s.id === parseInt(newSportId));
    if (sportInfo) {
      // Check if already added
      if (editProfileData.sports.some(s => s.sport_id === sportInfo.id)) return;
      setEditProfileData({
        ...editProfileData,
        sports: [...editProfileData.sports, { sport_id: sportInfo.id, level: newSportLevel, name: sportInfo.name }]
      });
      setNewSportId('');
    }
  };

  const handleRemoveSport = (sportId) => {
    setEditProfileData({
      ...editProfileData,
      sports: editProfileData.sports.filter(s => s.sport_id !== sportId)
    });
  };

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put('http://127.0.0.1:8000/profile', editProfileData, {
        headers: { Authorization: \`Bearer \${token}\` }
      });
      setIsEditingProfile(false);
      fetchProfile(); // reload
    } catch (err) {
      console.error('Error saving profile', err);
      alert('Erreur lors de la sauvegarde du profil.');
    } finally {
      setIsSavingProfile(false);
    }
  };
`;
content = content.replace("  // ━━━━━━━━━━━━ PANELS ━━━━━━━━━━━━", handlerLogic + "\n  // ━━━━━━━━━━━━ PANELS ━━━━━━━━━━━━");

// 4. Update the "Modifier" button
content = content.replace(
  "          {/* Modifier button */}\n          <button style={{",
  "          {/* Modifier button */}\n          <button onClick={handleEditProfileClick} style={{"
);

// 5. Add renderEditProfilePopup string
const renderPopup = `
  const renderEditProfilePopup = () => {
    if (!isEditingProfile) return null;
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: c.overlay, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', animation: 'fadeIn 0.2s ease' }}>
        <div style={{ background: c.surface, borderRadius: '24px', width: '100%', maxWidth: '500px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', border: \`1px solid \${c.surfaceBorder}\`, boxShadow: '0 24px 80px rgba(0,0,0,0.2)' }}>
          {/* Header */}
          <div style={{ padding: '20px', borderBottom: \`1px solid \${c.surfaceBorder}\`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: c.text, margin: '0 0 4px' }}>Modifier le profil</h2>
              <p style={{ fontSize: '13px', color: c.textMuted, margin: 0 }}>Mettez à jour vos informations et sports favoris</p>
            </div>
            <button onClick={() => setIsEditingProfile(false)} style={{ background: darkMode ? '#1a2744' : '#f3f4f6', border: 'none', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" fill="none" stroke={c.text} strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
          
          {/* Content (Scrollable) */}
          <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Info de base */}
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: '700', color: c.text, marginBottom: '12px' }}>Informations personnelles</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: c.textMuted, marginBottom: '6px' }}>Prénom</label>
                  <input type="text" value={editProfileData.first_name} onChange={e => setEditProfileData({...editProfileData, first_name: e.target.value})} style={{ width: '100%', height: '42px', padding: '0 14px', borderRadius: '12px', border: \`1px solid \${c.inputBorder}\`, background: c.inputBg, color: c.text, fontSize: '14px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: c.textMuted, marginBottom: '6px' }}>Nom</label>
                  <input type="text" value={editProfileData.last_name} onChange={e => setEditProfileData({...editProfileData, last_name: e.target.value})} style={{ width: '100%', height: '42px', padding: '0 14px', borderRadius: '12px', border: \`1px solid \${c.inputBorder}\`, background: c.inputBg, color: c.text, fontSize: '14px' }} />
                </div>
              </div>
              <div style={{ marginTop: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: c.textMuted, marginBottom: '6px' }}>Téléphone</label>
                <input type="text" value={editProfileData.phone} onChange={e => setEditProfileData({...editProfileData, phone: e.target.value})} style={{ width: '100%', height: '42px', padding: '0 14px', borderRadius: '12px', border: \`1px solid \${c.inputBorder}\`, background: c.inputBg, color: c.text, fontSize: '14px' }} />
              </div>
            </div>

            {/* Scolarité */}
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: '700', color: c.text, marginBottom: '12px' }}>Scolarité</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: c.textMuted, marginBottom: '6px' }}>Département / Année</label>
                  <select value={editProfileData.department} onChange={e => setEditProfileData({...editProfileData, department: e.target.value, class_group: ''})} style={{ width: '100%', height: '42px', padding: '0 14px', borderRadius: '12px', border: \`1px solid \${c.inputBorder}\`, background: c.inputBg, color: c.text, fontSize: '14px' }}>
                    <option value="" disabled hidden>Choisir l'année</option>
                    <option value="3">3ème année de TC</option>
                    <option value="4">4ème année de TC</option>
                  </select>
                </div>
                {editProfileData.department && (
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: c.textMuted, marginBottom: '6px' }}>Classe / Groupe</label>
                    <select value={editProfileData.class_group} onChange={e => setEditProfileData({...editProfileData, class_group: e.target.value})} style={{ width: '100%', height: '42px', padding: '0 14px', borderRadius: '12px', border: \`1px solid \${c.inputBorder}\`, background: c.inputBg, color: c.text, fontSize: '14px' }}>
                      <option value="" disabled hidden>Choisir le groupe</option>
                      {(editProfileData.department === '3' ? ['1','2','3','4'] : editProfileData.department === '4' ? ['1','2','3'] : []).map(g => (
                        <option key={g} value={g}>Groupe {g}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Sports */}
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: '700', color: c.text, marginBottom: '12px' }}>Mes sports favoris</h3>
              
              {/* Added sports list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                {editProfileData.sports.map((s, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: darkMode ? '#1a2744' : '#eff6ff', padding: '10px 14px', borderRadius: '10px', border: \`1px solid \${darkMode ? '#253a5c' : '#bfdbfe'}\` }}>
                    <div>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: c.text, marginRight: '8px' }}>{s.name}</span>
                      <span style={{ fontSize: '11px', background: darkMode ? '#0c1f3f' : 'white', padding: '2px 8px', borderRadius: '12px', color: '#002157', fontWeight: '600' }}>{s.level}</span>
                    </div>
                    <button onClick={() => handleRemoveSport(s.sport_id)} style={{ background: 'none', border: 'none', color: '#E30613', cursor: 'pointer', padding: '4px' }}>
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                  </div>
                ))}
              </div>

              {/* Add new sport controls */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <div style={{ flex: 2 }}>
                  <select value={newSportId} onChange={e => setNewSportId(e.target.value)} style={{ width: '100%', height: '42px', padding: '0 14px', borderRadius: '12px', border: \`1px solid \${c.inputBorder}\`, background: c.inputBg, color: c.text, fontSize: '14px' }}>
                    <option value="" disabled hidden>Ajouter un sport</option>
                    {(profileData?.availableSports || []).filter(s => !editProfileData.sports.some(es => es.sport_id === s.id)).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <select value={newSportLevel} onChange={e => setNewSportLevel(e.target.value)} style={{ width: '100%', height: '42px', padding: '0 14px', borderRadius: '12px', border: \`1px solid \${c.inputBorder}\`, background: c.inputBg, color: c.text, fontSize: '14px' }}>
                    <option value="Débutant">Débutant</option>
                    <option value="Intermédiaire">Intermédiaire</option>
                    <option value="Avancé">Avancé</option>
                  </select>
                </div>
                <button onClick={handleAddSport} disabled={!newSportId} style={{ height: '42px', padding: '0 16px', borderRadius: '12px', border: 'none', background: !newSportId ? (darkMode ? '#333' : '#ccc') : '#E30613', color: 'white', fontWeight: '600', cursor: !newSportId ? 'not-allowed' : 'pointer' }}>
                  Ajouter
                </button>
              </div>
            </div>

          </div>

          {/* Footer actions */}
          <div style={{ padding: '16px 20px', borderTop: \`1px solid \${c.surfaceBorder}\`, display: 'flex', justifyContent: 'flex-end', gap: '10px', flexShrink: 0 }}>
            <button onClick={() => setIsEditingProfile(false)} style={{ padding: '10px 16px', borderRadius: '12px', border: 'none', background: darkMode ? '#333' : '#f3f4f6', color: c.text, fontWeight: '600', cursor: 'pointer' }}>
              Annuler
            </button>
            <button onClick={handleSaveProfile} disabled={isSavingProfile} style={{ padding: '10px 20px', borderRadius: '12px', border: 'none', background: '#002157', color: 'white', fontWeight: '600', cursor: isSavingProfile ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {isSavingProfile ? 'Sauvegarde...' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    );
  };
`;

content = content.replace("{renderDetailPopup()}", "{renderDetailPopup()}\n      {renderEditProfilePopup()}");
content = content.replace("export default Dashboard;", renderPopup + "\n\nexport default Dashboard;");

fs.writeFileSync(filePath, content, 'utf8');
console.log("Profile Edit Fixed!");
