const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend', 'src', 'components', 'Dashboard.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add Community Search and Athlete Profile States
content = content.replace(
  "  const [communityLoading, setCommunityLoading] = useState(true);",
  "  const [communityLoading, setCommunityLoading] = useState(true);\n  const [searchQuery, setSearchQuery] = useState('');\n  const [searchResults, setSearchResults] = useState([]);\n  const [searchLoading, setSearchLoading] = useState(false);\n  const [selectedAthlete, setSelectedAthlete] = useState(null);\n  const [athleteProfileData, setAthleteProfileData] = useState(null);\n  const [athleteProfileLoading, setAthleteProfileLoading] = useState(false);"
);

// 2. Add Handlers for community search
const communityLogic = `
  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      const delayFn = setTimeout(async () => {
        setSearchLoading(true);
        try {
          const token = localStorage.getItem('token');
          const res = await axios.get(\`http://127.0.0.1:8000/community/search?q=\${encodeURIComponent(searchQuery)}\`, {
            headers: { Authorization: \`Bearer \${token}\` }
          });
          setSearchResults(res.data);
        } catch (e) {
          console.error(e);
        } finally {
          setSearchLoading(false);
        }
      }, 300);
      return () => clearTimeout(delayFn);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const handleAthleteClick = async (athlete) => {
    setSelectedAthlete(athlete);
    setAthleteProfileLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(\`http://127.0.0.1:8000/community/users/\${athlete.id}/profile\`, {
        headers: { Authorization: \`Bearer \${token}\` }
      });
      setAthleteProfileData(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setAthleteProfileLoading(false);
    }
  };
`;

content = content.replace("  // ─── TIME AGO HELPER ───", communityLogic + "\n  // ─── TIME AGO HELPER ───");

// 3. Inject Search Bar into Community Panel
const searchBarUI = `          {/* ── SEARCH BAR ── */}
          <div style={{ margin: '0 16px 16px' }}>
            <div style={{ position: 'relative' }}>
              <input 
                type="text" 
                placeholder="Rechercher un étudiant, sport, département..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', height: '48px', padding: '0 16px 0 46px', borderRadius: '16px', border: \`1px solid \${c.surfaceBorder}\`, background: c.surface, color: c.text, fontSize: '14px', outline: 'none' }}
              />
              <svg style={{ position: 'absolute', left: '16px', top: '14px', color: c.textMuted }} width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            </div>
            
            {searchQuery.trim().length > 0 && (
              <div style={{ marginTop: '12px', background: c.surface, border: \`1px solid \${c.surfaceBorder}\`, borderRadius: '16px', overflow: 'hidden' }}>
                {searchLoading ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: c.textMuted, fontSize: '13px' }}>Recherche en cours...</div>
                ) : searchResults.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: c.textMuted, fontSize: '13px' }}>Aucun résultat trouvé</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {searchResults.map(u => (
                      <div key={u.id} onClick={() => handleAthleteClick(u)} style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: \`1px solid \${c.surfaceBorder}\`, cursor: 'pointer' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#002157', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>{u.firstName[0]}</div>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontWeight: '600', color: c.text, fontSize: '14px' }}>{u.firstName} {u.lastName}</p>
                          <p style={{ margin: 0, color: c.textMuted, fontSize: '12px' }}>{u.department === '3' || u.department === '4' ? \`\${u.department}ème TC\` : u.department} - {u.mainSport || 'Sportif'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>\n\n`;

content = content.replace("          {/* ── HERO BANNER ── */}", searchBarUI + "          {/* ── HERO BANNER ── */}");

// 4. Inject User Profile Modal
const profileModalUI = `
  const renderUserProfilePopup = () => {
    if (!selectedAthlete) return null;

    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: c.overlay, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', animation: 'fadeIn 0.2s ease' }}>
        <div style={{ background: c.surface, borderRadius: '24px', width: '100%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto', border: \`1px solid \${c.surfaceBorder}\` }}>
          {/* Header */}
          <div style={{ position: 'sticky', top: 0, background: c.surface, padding: '16px 20px', borderBottom: \`1px solid \${c.surfaceBorder}\`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: c.text }}>Profil de {selectedAthlete.firstName}</h3>
            <button onClick={() => setSelectedAthlete(null)} style={{ background: darkMode ? '#1a2744' : '#f3f4f6', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" fill="none" stroke={c.text} strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
          
          {/* Content */}
          <div style={{ padding: '20px' }}>
            {athleteProfileLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: c.textMuted }}>Chargement du profil...</div>
            ) : !athleteProfileData ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: c.textMuted }}>Erreur lors du chargement</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Hero Info */}
                <div style={{ textAlign: 'center', background: 'linear-gradient(135deg, #002157 0%, #E30613 100%)', padding: '24px 20px', borderRadius: '20px', color: 'white' }}>
                  <div style={{ width: '70px', height: '70px', borderRadius: '50%', border: '3px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: '28px', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(5px)' }}>{athleteProfileData.user.first_name[0]}</div>
                  <h2 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: '800' }}>{athleteProfileData.user.first_name} {athleteProfileData.user.last_name}</h2>
                  <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'rgba(255,255,255,0.8)' }}>{athleteProfileData.user.department === '3' || athleteProfileData.user.department === '4' ? \`\${athleteProfileData.user.department}ème année de TC\` : athleteProfileData.user.department} - {athleteProfileData.user.class_group.match(/^\\d$/) ? \`Groupe \${athleteProfileData.user.class_group}\` : athleteProfileData.user.class_group}</p>
                  
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ flex: 1, background: 'rgba(255,255,255,0.2)', padding: '10px', borderRadius: '12px' }}>
                      <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{athleteProfileData.stats.totalMatches}</div>
                      <div style={{ fontSize: '10px', opacity: 0.8 }}>Matchs</div>
                    </div>
                    <div style={{ flex: 1, background: 'rgba(255,255,255,0.2)', padding: '10px', borderRadius: '12px' }}>
                      <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{athleteProfileData.stats.totalSports}</div>
                      <div style={{ fontSize: '10px', opacity: 0.8 }}>Sports</div>
                    </div>
                  </div>
                </div>

                {/* Sports */}
                <div>
                  <h4 style={{ margin: '0 0 10px', fontSize: '15px', color: c.text, fontWeight: '700' }}>Sports pratiqués</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {athleteProfileData.sports.length > 0 ? athleteProfileData.sports.map(s => (
                      <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: c.inputBg, border: \`1px solid \${c.inputBorder}\`, padding: '12px 14px', borderRadius: '12px' }}>
                        <div>
                          <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: '700', color: c.text }}>{s.name}</p>
                          <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '8px', background: s.level.includes('Avancé') ? '#eff6ff' : s.level.includes('Intermédiaire') ? '#fef2f2' : '#f3f4f6', color: s.level.includes('Avancé') ? '#1d4ed8' : s.level.includes('Intermédiaire') ? '#E30613' : '#374151', fontWeight: 'bold' }}>{s.level}</span>
                        </div>
                        <div style={{ fontSize: '12px', color: c.textMuted }}>{s.matchCount} matchs</div>
                      </div>
                    )) : <p style={{ fontSize: '13px', color: c.textMuted }}>Aucun sport enregistré.</p>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };
`;

content = content.replace("{renderEditProfilePopup()}", "{renderEditProfilePopup()}\n      {renderUserProfilePopup()}");
content = content.replace("export default Dashboard;", profileModalUI + "\n\nexport default Dashboard;");

// Update topAthletes onClick
content = content.replace(
  "                      display: 'flex', alignItems: 'center', gap: '12px',",
  "                      display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer',"
);
content = content.replace(
  "                    <div key={athlete.id} style={{",
  "                    <div key={athlete.id} onClick={() => handleAthleteClick(athlete)} style={{"
);


fs.writeFileSync(filePath, content, 'utf8');
console.log("Community Search Fixed!");
