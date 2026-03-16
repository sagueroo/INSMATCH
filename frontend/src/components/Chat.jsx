import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

// 🟢 MODIFICATION : On ajoute onLogout dans les props
const Chat = ({ onLogout }) => {
  const firstName = localStorage.getItem('first_name') || 'Étudiant';
  
  const [messages, setMessages] = useState([
    { role: 'ai', content: `Bonjour ${firstName}, je suis ton Agent INSMATCH. Tu cherches un partenaire de sport pour quand ? 🎾⚽️` }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Playfair+Display:wght@700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = { role: 'user', content: input };
    const newMessages = [...messages, userMsg]; // 🟢 On prépare le nouvel historique complet
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const token = localStorage.getItem('token');

      // 🟢 1. On traduit le format de React pour que l'IA le comprenne ('ai' devient 'assistant')
      const conversationHistory = newMessages.map(msg => ({
        role: msg.role === 'ai' ? 'assistant' : msg.role,
        content: msg.content
      }));

      // 🟢 2. On envoie TOUT l'historique sous le nom 'history'
      const response = await axios.post('http://127.0.0.1:8000/chat/', 
        { history: conversationHistory }, 
        { 
          headers: { Authorization: `Bearer ${token}` } 
        }
      );

      setMessages((prev) => [...prev, { role: 'ai', content: response.data.reply }]);
// ... la suite (catch) ne change pas
  } catch (error) {
    // Si le token est invalide ou expiré, on prévient l'utilisateur
    if (error.response?.status === 401) {
      // 🟢 MODIFICATION : On appelle onLogout pour rediriger vers la page de login
      onLogout(); 
    } else {
      setMessages((prev) => [...prev, { role: 'ai', content: 'Erreur de connexion au serveur.' }]);
    }
  } finally {
    setIsLoading(false);
  }
};

  const formatTime = () => {
    const now = new Date();
    return now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f3f4f6',
      fontFamily: "'Outfit', sans-serif",
      display: 'flex',
      flexDirection: 'column',
    }}>
      <style>{`
        * { box-sizing: border-box; }
        @keyframes fadeUp   { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes popIn    { from { opacity:0; transform:scale(0.88); } to { opacity:1; transform:scale(1); } }
        @keyframes blink    { 0%,80%,100%{opacity:0} 40%{opacity:1} }
        @keyframes spin     { to { transform: rotate(360deg); } }
        .msg-ai   { animation: popIn  0.25s cubic-bezier(0.34,1.56,0.64,1) both; transform-origin: bottom left; }
        .msg-user { animation: popIn  0.25s cubic-bezier(0.34,1.56,0.64,1) both; transform-origin: bottom right; }
        .dot      { animation: blink 1.4s infinite both; }
        .dot:nth-child(2) { animation-delay: 0.2s; }
        .dot:nth-child(3) { animation-delay: 0.4s; }
        .send-btn:active  { transform: scale(0.93); }
        .tap-btn          { -webkit-tap-highlight-color: transparent; }
        ::-webkit-scrollbar { width: 0; }
        @media (min-width: 600px) {
          .outer  { align-items: center; justify-content: center; padding: 2rem 1rem !important; }
          .shell  { max-width: 480px; border-radius: 24px !important; box-shadow: 0 24px 64px rgba(0,33,87,0.14) !important; overflow: hidden; }
          .banner { border-radius: 0 !important; }
        }
      `}</style>

      <div className="outer" style={{ flex:1, display:'flex', flexDirection:'column', padding:'0' }}>
        <div className="shell" style={{
          flex:1, display:'flex', flexDirection:'column',
          background:'white', width:'100%', borderRadius:0,
          overflow:'hidden',
        }}>

          {/* ─── BANNER ─── */}
          <div className="banner" style={{
            background: '#002157',
            padding: '16px 20px 18px',
            position: 'relative',
            overflow: 'hidden',
            flexShrink: 0,
          }}>
            <svg style={{ position:'absolute',top:0,left:0,width:'100%',height:'100%',opacity:0.07,pointerEvents:'none' }} viewBox="0 0 375 100" preserveAspectRatio="xMidYMid slice">
              <circle cx="330" cy="-20" r="120" fill="none" stroke="white" strokeWidth="1.5"/>
              <circle cx="-10" cy="90" r="80" fill="none" stroke="white" strokeWidth="1"/>
            </svg>
            <div style={{ position:'absolute', top:0, right:0, width:'3px', height:'100%', background:'#E30613' }} />

            <div style={{ display:'flex', alignItems:'center', gap:'12px', position:'relative', zIndex:1 }}>
              {/* Logo */}
              <div style={{ width:'40px', height:'40px', background:'#E30613', borderRadius:'11px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="24" height="24" viewBox="0 0 38 38" fill="none">
                  <path d="M6 30L19 8L32 30H25L19 19L13 30H6Z" fill="white"/>
                </svg>
              </div>

              {/* Title */}
              <div style={{ flex:1 }}>
                <div style={{ fontSize:'9px', letterSpacing:'0.2em', color:'#E30613', fontWeight:'600', textTransform:'uppercase' }}>INSA Lyon</div>
                <div style={{ fontSize:'18px', fontFamily:"'Playfair Display', serif", color:'white', lineHeight:1.1, fontWeight:'700' }}>
                  INSMATCH Agent
                </div>
              </div>

              {/* Online badge */}
              <div style={{ display:'flex', alignItems:'center', gap:'5px', background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'20px', padding:'5px 10px' }}>
                <div style={{ width:'7px', height:'7px', borderRadius:'50%', background:'#22c55e' }} />
                <span style={{ fontSize:'11px', color:'rgba(255,255,255,0.8)', fontWeight:'500' }}>En ligne</span>
              </div>
            </div>

            {/* Subtitle */}
            <div style={{ display:'flex', alignItems:'center', gap:'8px', marginTop:'10px', position:'relative', zIndex:1 }}>
              <div style={{ width:'16px', height:'2px', background:'#E30613', borderRadius:'2px', flexShrink:0 }} />
              <span style={{ fontSize:'12px', color:'rgba(255,255,255,0.45)' }}>
                Trouve ton partenaire de sport idéal
              </span>
            </div>
          </div>

          {/* ─── MESSAGES ─── */}
          <div style={{
            flex:1, overflowY:'auto',
            padding:'16px',
            display:'flex', flexDirection:'column', gap:'10px',
            background:'#f8f9fb',
          }}>

            {/* Date pill */}
            <div style={{ textAlign:'center', marginBottom:'4px' }}>
              <span style={{ fontSize:'11px', color:'#9ca3af', background:'#f3f4f6', border:'1px solid #e5e7eb', borderRadius:'20px', padding:'3px 10px', fontWeight:'500' }}>
                Aujourd'hui
              </span>
            </div>

            {messages.map((msg, i) => (
              <div key={i} className={msg.role === 'user' ? 'msg-user' : 'msg-ai'}
                style={{ display:'flex', flexDirection:'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>

                {/* Avatar label for AI */}
                {msg.role === 'ai' && (
                  <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'4px' }}>
                    <div style={{ width:'22px', height:'22px', background:'#002157', borderRadius:'6px', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <svg width="13" height="13" viewBox="0 0 38 38" fill="none">
                        <path d="M6 30L19 8L32 30H25L19 19L13 30H6Z" fill="white"/>
                      </svg>
                    </div>
                    <span style={{ fontSize:'11px', fontWeight:'600', color:'#002157' }}>Agent INSMATCH</span>
                  </div>
                )}

                <div style={{
                  maxWidth:'78%',
                  padding:'12px 14px',
                  borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: msg.role === 'user' ? '#E30613' : 'white',
                  color: msg.role === 'user' ? 'white' : '#111827',
                  fontSize:'15px',
                  lineHeight:'1.5',
                  border: msg.role === 'ai' ? '1px solid #e5e7eb' : 'none',
                  boxShadow: msg.role === 'ai' ? '0 2px 8px rgba(0,0,0,0.05)' : '0 2px 8px rgba(227,6,19,0.2)',
                  wordBreak:'break-word',
                }}>
                  {msg.content}
                </div>

                <span style={{ fontSize:'10px', color:'#9ca3af', marginTop:'3px', paddingLeft: msg.role === 'ai' ? '4px' : '0', paddingRight: msg.role === 'user' ? '4px' : '0' }}>
                  {formatTime()}
                </span>
              </div>
            ))}

            {/* Typing indicator */}
            {isLoading && (
              <div className="msg-ai" style={{ display:'flex', flexDirection:'column', alignItems:'flex-start' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'4px' }}>
                  <div style={{ width:'22px', height:'22px', background:'#002157', borderRadius:'6px', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <svg width="13" height="13" viewBox="0 0 38 38" fill="none">
                      <path d="M6 30L19 8L32 30H25L19 19L13 30H6Z" fill="white"/>
                    </svg>
                  </div>
                  <span style={{ fontSize:'11px', fontWeight:'600', color:'#002157' }}>Agent INSMATCH</span>
                </div>
                <div style={{
                  padding:'14px 18px', borderRadius:'18px 18px 18px 4px',
                  background:'white', border:'1px solid #e5e7eb',
                  boxShadow:'0 2px 8px rgba(0,0,0,0.05)',
                  display:'flex', gap:'5px', alignItems:'center',
                }}>
                  {[0,1,2].map(i => (
                    <div key={i} className="dot" style={{ width:'7px', height:'7px', borderRadius:'50%', background:'#002157', animationDelay:`${i*0.2}s` }} />
                  ))}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* ─── INPUT BAR ─── */}
          <div style={{
            background:'white',
            borderTop:'1px solid #e5e7eb',
            padding:'12px 16px',
            paddingBottom:'calc(12px + env(safe-area-inset-bottom, 0px))',
            flexShrink:0,
          }}>
            <div style={{ display:'flex', gap:'10px', alignItems:'flex-end' }}>
              <div style={{ flex:1, position:'relative' }}>
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(e)}
                  placeholder="Ex: Je cherche un partenaire tennis…"
                  disabled={isLoading}
                  style={{
                    width:'100%', height:'50px',
                    padding:'0 16px',
                    border:'1.5px solid #e5e7eb',
                    borderRadius:'14px',
                    fontSize:'16px',
                    fontFamily:"'Outfit',sans-serif",
                    color:'#111827',
                    background: isLoading ? '#f9fafb' : 'white',
                    outline:'none',
                    transition:'border-color 0.18s',
                    WebkitAppearance:'none',
                    touchAction:'manipulation',
                  }}
                  onFocus={e => e.target.style.borderColor = '#E30613'}
                  onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>

              <button
                className="send-btn tap-btn"
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                style={{
                  width:'50px', height:'50px', flexShrink:0,
                  background: !input.trim() || isLoading ? '#d1d5db' : '#E30613',
                  border:'none', borderRadius:'14px',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  cursor: !input.trim() || isLoading ? 'not-allowed' : 'pointer',
                  transition:'background 0.2s, transform 0.15s',
                  boxShadow: input.trim() && !isLoading ? '0 4px 12px rgba(227,6,19,0.3)' : 'none',
                }}
              >
                {isLoading
                  ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" style={{ animation:'spin 0.8s linear infinite' }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                  : <svg width="18" height="18" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                }
              </button>
            </div>

            <p style={{ textAlign:'center', fontSize:'10px', color:'#d1d5db', marginTop:'8px', marginBottom:0, letterSpacing:'0.05em' }}>
              INSMATCH · INSA Lyon
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Chat;