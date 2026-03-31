/**
 * État vide centré (listes, onglets) — réutilisable avec le thème Dashboard.
 */
export function EmptyState({
  emoji = '📋',
  title,
  hint = '',
  theme,
  darkMode = true,
  padding = '48px 20px',
  emojiSize = '40px',
}) {
  const c = theme;
  return (
    <div style={{ textAlign: 'center', padding, color: c.textMuted }}>
      <div
        style={{
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          background: darkMode ? '#1a2744' : '#f3f4f6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
          fontSize: emojiSize,
          lineHeight: 1,
        }}
        aria-hidden
      >
        {emoji}
      </div>
      <h3
        style={{
          fontSize: '17px',
          color: c.text,
          fontWeight: '700',
          margin: '0 0 6px',
        }}
      >
        {title}
      </h3>
      {hint ? (
        <p style={{ fontSize: '13px', color: c.textMuted, margin: 0, lineHeight: 1.5 }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
