/**
 * Modale de confirmation réutilisable (INSAMATCH — thème clair / sombre via `theme`).
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  children = null,
  error = '',
  cancelLabel = 'Annuler',
  confirmLabel = 'Confirmer',
  confirmLoading = false,
  zIndex = 3200,
  maxWidth = 400,
  /** 'delete' | 'cancel' */
  iconVariant = 'warning',
  theme,
  isDark = true,
  /** Espace sous le texte descriptif avant les boutons (ex. 24 pour la modale suppression). */
  descriptionMarginBottom = 8,
}) {
  if (!open) return null;

  const c = theme;
  const iconDelete = (
    <svg width="28" height="28" fill="none" stroke="#E30613" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
  const iconCancel = (
    <svg width="28" height="28" fill="none" stroke="#E30613" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
  const icon = iconVariant === 'delete' ? iconDelete : iconCancel;
  const iconBg = isDark ? 'rgba(227,6,19,0.15)' : 'rgba(227,6,19,0.1)';

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: c.overlay,
        zIndex,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: c.surface,
          borderRadius: '24px',
          width: '100%',
          maxWidth,
          padding: '24px',
          border: `1px solid ${c.surfaceBorder}`,
          boxShadow: '0 24px 80px rgba(0,0,0,0.25)',
          textAlign: description && !children ? 'center' : 'left',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: iconBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}
        >
          {icon}
        </div>
        <h3
          id="confirm-dialog-title"
          style={{
            fontSize: '18px',
            fontWeight: '700',
            color: c.text,
            margin: '0 0 8px',
            textAlign: 'center',
          }}
        >
          {title}
        </h3>
        {description ? (
          <p
            style={{
              fontSize: '14px',
              color: c.textMuted,
              margin: `0 0 ${descriptionMarginBottom}px`,
              lineHeight: 1.55,
              textAlign: 'center',
            }}
          >
            {description}
          </p>
        ) : null}
        {children}
        {error ? (
          <p
            style={{
              fontSize: '13px',
              color: isDark ? '#fecaca' : '#991b1b',
              background: isDark ? '#450a0a' : '#fef2f2',
              border: `1px solid ${isDark ? '#7f1d1d' : '#fecaca'}`,
              borderRadius: '10px',
              padding: '10px 12px',
              marginBottom: '16px',
              lineHeight: 1.45,
              marginTop: children ? 0 : 0,
            }}
          >
            {error}
          </p>
        ) : null}
        <div style={{ display: 'flex', gap: '12px', marginTop: children || error ? 0 : 0 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={confirmLoading}
            style={{
              flex: 1,
              padding: '12px',
              background: 'transparent',
              border: `1.5px solid ${c.surfaceBorder}`,
              borderRadius: '12px',
              color: c.text,
              fontWeight: '600',
              cursor: confirmLoading ? 'not-allowed' : 'pointer',
              fontFamily: "'Inter', sans-serif",
              opacity: confirmLoading ? 0.6 : 1,
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmLoading}
            style={{
              flex: 1,
              padding: '12px',
              background: '#E30613',
              border: 'none',
              borderRadius: '12px',
              color: 'white',
              fontWeight: '600',
              cursor: confirmLoading ? 'wait' : 'pointer',
              fontFamily: "'Inter', sans-serif",
              opacity: confirmLoading ? 0.85 : 1,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
