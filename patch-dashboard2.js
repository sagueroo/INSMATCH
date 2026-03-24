const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend', 'src', 'components', 'Dashboard.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add state for match drawer
content = content.replace(
  "const [activeTab, setActiveTab] = useState('ia');",
  "const [activeTab, setActiveTab] = useState('ia');\n  const [isMatchDrawerOpen, setIsMatchDrawerOpen] = useState(false);"
);

// 2. Format Profile displaying department and class
content = content.replace(
  /<h2 style={{ color: 'white', fontSize: '22px', fontWeight: '700', margin: '0 0 4px' }}>\{user.first_name\} \{user.last_name\}<\/h2>\n\s*<p style={{ color: 'rgba\(255,255,255,0\.75\)', fontSize: '14px', margin: '0 0 2px' }}>\{user\.class_group\}<\/p>\n\s*<p style={{ color: 'rgba\(255,255,255,0\.55\)', fontSize: '12px', margin: '0 0 18px' }}>\{user\.department\}<\/p>/g,
  `<h2 style={{ fontSize: '24px', fontWeight: '800', margin: '0 0 4px', letterSpacing: '-0.02em', color: 'white' }}>{user.first_name} {user.last_name}</h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '15px', margin: '0 0 4px', fontWeight: '500' }}>
             {user.department === '3' || user.department === '4' ? \`\${user.department}ème année de TC\` : user.department}
          </p>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', margin: '0 0 18px' }}>
             {/^\\d$/.test(user.class_group) ? \`Groupe \${user.class_group}\` : user.class_group}
          </p>`
);

// Format Community popup
content = content.replace(
  /<p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 24px' }}>\{user\.class_group\} - \{user\.department\}<\/p>/g,
  `<p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 24px' }}>
              {user.department === '3' || user.department === '4' ? \`\${user.department}ème année de TC\` : user.department} - {/^\\d$/.test(user.class_group) ? \`Groupe \${user.class_group}\` : user.class_group}
            </p>`
);

// Edit Profile Form replacement
const oldEditForm = `            {/* Classe */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: darkMode ? '#bfdbfe' : '#002157', marginBottom: '6px' }}>Classe</label>
              <input type="text" value={editProfileData.classGroup} onChange={e => setEditProfileData({...editProfileData, classGroup: e.target.value})} style={{ width: '100%', height: '42px', padding: '0 14px', borderRadius: '12px', border: 'none', background: darkMode ? '#1a1a1a' : '#f8fafc', color: c.text, fontSize: '14px', fontFamily: "'Inter', sans-serif" }} />
            </div>

            {/* Département */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: darkMode ? '#bfdbfe' : '#002157', marginBottom: '6px' }}>Département</label>
              <select value={editProfileData.department} onChange={e => setEditProfileData({...editProfileData, department: e.target.value})} style={{ width: '100%', height: '42px', padding: '0 14px', borderRadius: '12px', border: 'none', background: darkMode ? '#1a1a1a' : '#f8fafc', color: c.text, fontSize: '14px', fontFamily: "'Inter', sans-serif", appearance: 'none' }}>
                <option value="Télécommunications">Télécommunications</option>
                <option value="Informatique">Informatique</option>
                <option value="Génie Mécanique">Génie Mécanique</option>
                <option value="Génie Civil">Génie Civil</option>
                <option value="Génie Électrique">Génie Électrique</option>
                <option value="Biosciences">Biosciences</option>
                <option value="Génie Industriel">Génie Industriel</option>
                <option value="Matériaux">Matériaux</option>
                <option value="Énergétique et Environnement">Énergétique et Environnement</option>
              </select>
            </div>`;
const newEditForm = `            {/* Département */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: darkMode ? '#bfdbfe' : '#002157', marginBottom: '6px' }}>Département / Année</label>
              <select value={editProfileData.department} onChange={e => setEditProfileData({...editProfileData, department: e.target.value, classGroup: ''})} style={{ width: '100%', height: '42px', padding: '0 14px', borderRadius: '12px', border: 'none', background: darkMode ? '#1a1a1a' : '#f8fafc', color: c.text, fontSize: '14px', fontFamily: "'Inter', sans-serif", appearance: 'none' }}>
                <option value="" disabled hidden>Choisir l'année</option>
                <option value="3">3ème année de TC</option>
                <option value="4">4ème année de TC</option>
              </select>
            </div>

            {/* Classe */}
            {editProfileData.department && (
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: darkMode ? '#bfdbfe' : '#002157', marginBottom: '6px' }}>Classe / Groupe</label>
                <select value={editProfileData.classGroup} onChange={e => setEditProfileData({...editProfileData, classGroup: e.target.value})} style={{ width: '100%', height: '42px', padding: '0 14px', borderRadius: '12px', border: 'none', background: darkMode ? '#1a1a1a' : '#f8fafc', color: c.text, fontSize: '14px', fontFamily: "'Inter', sans-serif", appearance: 'none' }}>
                  <option value="" disabled hidden>Choisir le groupe</option>
                  {(editProfileData.department === '3' ? ['1','2','3','4'] : editProfileData.department === '4' ? ['1','2','3'] : []).map(g => (
                    <option key={g} value={g}>Groupe {g}</option>
                  ))}
                </select>
              </div>
            )}`;
content = content.replace(oldEditForm, newEditForm);

// Hamburger menu
const oldHamburger = \`<button className="hamburger-btn" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', lineHeight: 0 }}>\`;
const newHamburger = \`<button onClick={() => setIsMatchDrawerOpen(true)} className="hamburger-btn" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', lineHeight: 0 }}>\`;
content = content.replace(oldHamburger, newHamburger);

// Add Emploi Page right before Matchs Page
content = content.replace(
  "  // ━━━━━━━━━━━━ MATCHS PAGE ━━━━━━━━━━━━",
  "  // ━━━━━━━━━━━━ EMPLOI DU TEMPS ━━━━━━━━━━━━\\n" +
  "  const renderEmploiPage = () => (\\n" +
  "    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: c.bg, alignItems: 'center', justifyContent: 'center' }}>\\n" +
  "      <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: darkMode ? '#1a2744' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>\\n" +
  "        <svg width=\\"40\\" height=\\"40\\" fill=\\"none\\" stroke={c.textMuted} strokeWidth=\\"1.5\\" viewBox=\\"0 0 24 24\\"><rect x=\\"3\\" y=\\"4\\" width=\\"18\\" height=\\"18\\" rx=\\"2\\" ry=\\"2\\"/><line x1=\\"16\\" y1=\\"2\\" x2=\\"16\\" y2=\\"6\\"/><line x1=\\"8\\" y1=\\"2\\" x2=\\"8\\" y2=\\"6\\"/><line x1=\\"3\\" y1=\\"10\\" x2=\\"21\\" y2=\\"10\\"/></svg>\\n" +
  "      </div>\\n" +
  "      <h2 style={{ fontSize: '20px', fontWeight: '700', color: c.text, margin: '0 0 8px' }}>Emploi du temps</h2>\\n" +
  "      <p style={{ fontSize: '14px', color: c.textMuted, margin: 0 }}>Bientôt disponible...</p>\\n" +
  "    </div>\\n" +
  "  );\\n\\n" +
  "  // ━━━━━━━━━━━━ MATCHS PAGE ━━━━━━━━━━━━"
);

// Mobile content switch
content = content.replace(
  "if (activeTab === 'matchs') return renderMatchsPage();",
  "if (activeTab === 'emploi') return renderEmploiPage();"
);

// Bottom nav items
content = content.replace(
  "{ id: 'matchs', label: 'Matchs', icon: (a) => <svg width=\\"22\\" height=\\"22\\" fill=\\"none\\" stroke={a ? '#E30613' : c.textMuted} strokeWidth=\\"2\\" viewBox=\\"0 0 24 24\\"><path d=\\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\\"/><polyline points=\\"14 2 14 8 20 8\\"/><line x1=\\"16\\" y1=\\"13\\" x2=\\"8\\" y2=\\"13\\"/><line x1=\\"16\\" y1=\\"17\\" x2=\\"8\\" y2=\\"17\\"/></svg> },",
  "{ id: 'emploi', label: 'Emploi du temps', icon: (a) => <svg width=\\"22\\" height=\\"22\\" fill=\\"none\\" stroke={a ? '#E30613' : c.textMuted} strokeWidth=\\"2\\" viewBox=\\"0 0 24 24\\"><rect x=\\"3\\" y=\\"4\\" width=\\"18\\" height=\\"18\\" rx=\\"2\\" ry=\\"2\\"/><line x1=\\"16\\" y1=\\"2\\" x2=\\"16\\" y2=\\"6\\"/><line x1=\\"8\\" y1=\\"2\\" x2=\\"8\\" y2=\\"6\\"/><line x1=\\"3\\" y1=\\"10\\" x2=\\"21\\" y2=\\"10\\"/></svg> },"
);


const startIdx = content.indexOf("  const renderMatchsPage = () => (");
const endIdx = content.indexOf("  // ━━━━━━━━━━━━ POPUP DETAIL ━━━━━━━━━━━━", startIdx);

if (startIdx !== -1 && endIdx !== -1) {
  let innerMatchPage = content.substring(startIdx, endIdx);
  
  innerMatchPage = innerMatchPage.replace(
    "const renderMatchsPage = () => (\\n    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>",
    "const renderMatchsDrawer = () => {\\n    if (!isMatchDrawerOpen) return null;\\n    return (\\n      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1200, display: 'flex', animation: 'fadeIn 0.2s ease', background: c.overlay }}>\\n        <div onClick={() => setIsMatchDrawerOpen(false)} style={{ flex: 1 }}></div>\\n        <div className=\\"drawer-container\\" style={{ background: c.bg, width: '85%', maxWidth: '380px', height: '100vh', display: 'flex', flexDirection: 'column', boxShadow: '4px 0 24px rgba(0,0,0,0.3)', position: 'absolute', left: 0, top: 0, animation: 'slideInLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1)', zIndex: 1201 }}>"
  );
  
  // Inject close button in header
  innerMatchPage = innerMatchPage.replace(
    "</div>\\n      </div>",
    "</div>\\n        <button onClick={() => setIsMatchDrawerOpen(false)} style={{ background: 'none', border: 'none', color: c.textMuted, cursor: 'pointer', padding: '4px', display: 'flex' }}><svg width=\\"24\\" height=\\"24\\" fill=\\"none\\" stroke=\\"currentColor\\" strokeWidth=\\"2\\" viewBox=\\"0 0 24 24\\"><line x1=\\"18\\" y1=\\"6\\" x2=\\"6\\" y2=\\"18\\"/><line x1=\\"6\\" y1=\\"6\\" x2=\\"18\\" y2=\\"18\\"/></svg></button>\\n      </div>"
  );

  // Close the drawer tags manually
  const parts = innerMatchPage.split("  );");
  if (parts.length >= 2) {
    parts[parts.length - 2] = parts[parts.length - 2] + "      </div>\\n      </div>";
    innerMatchPage = parts.join("  );\\n  };");
  }
  
  content = content.substring(0, startIdx) + innerMatchPage + content.substring(endIdx);
}

// Add the drawer to the root component render list
content = content.replace(
  "{renderEditProfilePopup()}",
  "{renderEditProfilePopup()}\\n      {renderMatchsDrawer()}"
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Dashboard patched successfully');
