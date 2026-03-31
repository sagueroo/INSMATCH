/**
 * Icônes sports — trait uniforme #E30613, viewBox 24×24, chemins simplifiés pour un rendu net à toutes tailles.
 */
export const SPORT_ICON_COLOR = '#E30613';

function strokeForSize(size) {
  if (size <= 14) return 1.5;
  if (size <= 20) return 1.65;
  return 1.75;
}

function Icon({ size = 20, children }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      stroke={SPORT_ICON_COLOR}
      strokeWidth={strokeForSize(size)}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, display: 'block', verticalAlign: 'middle' }}
      aria-hidden
    >
      {children}
    </svg>
  );
}

/** Ping-pong uniquement si formulation explicite (pas le simple mot « tennis » = tennis court). */
function isPingPongLabel(n) {
  const q = (n || '').toLowerCase();
  const phrases = ['ping-pong', 'ping pong', 'pingpong', 'tennis de table', 'tennis-de-table', 'table tennis'];
  if (phrases.some((p) => q.includes(p))) return true;
  if (q.includes('tennis') && q.includes('table')) return true;
  return false;
}

function sportIconElement(name, size = 20) {
  const n = (name || '').toLowerCase();

  // Tennis de table / ping-pong avant tennis court
  if (isPingPongLabel(n)) {
    return (
      <Icon size={size}>
        <rect x="2.5" y="8" width="5.5" height="9" rx="1" />
        <line x1="8" y1="12" x2="14" y2="9.5" />
        <circle cx="18.5" cy="7" r="2.25" />
      </Icon>
    );
  }
  if (n.includes('tennis')) {
    return (
      <Icon size={size}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M4 12c2.5-5 13-5 16 0" />
        <path d="M4 12c2.5 5 13 5 16 0" />
      </Icon>
    );
  }
  if (n.includes('foot')) {
    return (
      <Icon size={size}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 3.5v17" />
        <path d="M3.8 8.2 20.2 15.8" />
        <path d="M3.8 15.8 20.2 8.2" />
      </Icon>
    );
  }
  if (n.includes('basket')) {
    return (
      <Icon size={size}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 3.5v17" />
        <path d="M4 12h16" />
        <path d="M6.5 6.5c3 2.5 8 2.5 11 0" />
        <path d="M6.5 17.5c3-2.5 8-2.5 11 0" />
      </Icon>
    );
  }
  if (n.includes('badminton')) {
    return (
      <Icon size={size}>
        <line x1="12" y1="2.5" x2="12" y2="10" />
        <path d="M7.5 10h9" />
        <path d="M9 10 12 21 15 10" />
      </Icon>
    );
  }
  if (n.includes('volley')) {
    return (
      <Icon size={size}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 12 20.5 7" />
        <path d="M12 12 3.5 7" />
        <path d="M12 12v8.5" />
      </Icon>
    );
  }
  if (n.includes('rugby')) {
    return (
      <Icon size={size}>
        <ellipse cx="12" cy="12" rx="9.5" ry="5.8" />
        <line x1="12" y1="8.5" x2="12" y2="15.5" />
        <line x1="9" y1="10.5" x2="15" y2="10.5" />
        <line x1="9" y1="13.5" x2="15" y2="13.5" />
      </Icon>
    );
  }
  if (n.includes('hand')) {
    return (
      <Icon size={size}>
        <circle cx="12" cy="12" r="7.5" />
        <path d="M5.5 9.5c2.2-2.5 10.8-2.5 13 0" />
        <path d="M5.5 14.5c2.2 2.5 10.8 2.5 13 0" />
      </Icon>
    );
  }
  if (n.includes('natation') || n.includes('swim')) {
    return (
      <Icon size={size}>
        <circle cx="7.5" cy="7.5" r="2.25" />
        <path d="M2 14.5c2.2-1 4.4-1 6.6 0s4.4 1 6.6 0 4.4-1 6.6 0" />
        <path d="M2 18c2.2-1 4.4-1 6.6 0s4.4 1 6.6 0 4.4-1 6.6 0" />
      </Icon>
    );
  }
  if (n.includes('escalade') || n.includes('climb')) {
    return (
      <Icon size={size}>
        <path d="M5 21V11l2.5-2.5L12 11v10" />
        <path d="M12 11 16.5 9 19 12v9" />
        <circle cx="8" cy="14.5" r="1.35" fill={SPORT_ICON_COLOR} stroke="none" />
        <circle cx="11" cy="9" r="1.35" fill={SPORT_ICON_COLOR} stroke="none" />
        <circle cx="15.5" cy="13" r="1.35" fill={SPORT_ICON_COLOR} stroke="none" />
      </Icon>
    );
  }

  return (
    <Icon size={size}>
      <circle cx="9" cy="9" r="3" />
      <circle cx="16" cy="16" r="3" />
      <path d="M11.5 11.5 14 14" />
    </Icon>
  );
}

/** Icône sport (trait #E30613), adaptée au nom du sport. */
export function SportIcon({ name, size = 20 }) {
  return sportIconElement(name, size);
}

export default SportIcon;
