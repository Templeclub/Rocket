type P = { className?: string };
const base = 'w-5 h-5';

function Svg({ className, children }: P & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className={className ?? base} aria-hidden="true">
      {children}
    </svg>
  );
}

export const IconCheck = (p: P) => <Svg {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>;
export const IconPostpone = (p: P) => <Svg {...p}><path d="M4 12a8 8 0 0 1 14-5.3" /><path d="M19 3v4h-4" /><path d="M12 8v4l3 2" /></Svg>;
export const IconSwap = (p: P) => <Svg {...p}><path d="M7 4L3 8l4 4" /><path d="M3 8h14" /><path d="M17 20l4-4-4-4" /><path d="M21 16H7" /></Svg>;
export const IconX = (p: P) => <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>;
export const IconPlus = (p: P) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
export const IconLeft = (p: P) => <Svg {...p}><path d="M15 5l-7 7 7 7" /></Svg>;
export const IconRight = (p: P) => <Svg {...p}><path d="M9 5l7 7-7 7" /></Svg>;
export const IconWeek = (p: P) => <Svg {...p}><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></Svg>;
export const IconMonth = (p: P) => <Svg {...p}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M9 9v12M15 9v12M3 15h18" /></Svg>;
export const IconSettings = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></Svg>;
export const IconStar = (p: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={p.className ?? 'w-3.5 h-3.5'} aria-hidden="true">
    <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z" />
  </svg>
);
export const IconTrash = (p: P) => <Svg {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></Svg>;
export const IconUp = (p: P) => <Svg {...p}><path d="M6 15l6-6 6 6" /></Svg>;
export const IconDown = (p: P) => <Svg {...p}><path d="M6 9l6 6 6-6" /></Svg>;
export const IconMore = (p: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={p.className ?? base} aria-hidden="true">
    <circle cx="5" cy="12" r="1.9" />
    <circle cx="12" cy="12" r="1.9" />
    <circle cx="19" cy="12" r="1.9" />
  </svg>
);
export const IconAlert = (p: P) => <Svg {...p}><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17.5v.5" /></Svg>;
export const IconPin = (p: P) => <Svg {...p}><path d="M12 21s-6-5.6-6-11a6 6 0 1 1 12 0c0 5.4-6 11-6 11z" /><circle cx="12" cy="10" r="2.2" /></Svg>;
export const IconSparkle = (p: P) => <Svg {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" /></Svg>;
export const IconOpen = (p: P) => <Svg {...p}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></Svg>;
export const IconRefresh = (p: P) => <Svg {...p}><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" /><path d="M4 4v4h4" /><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16" /><path d="M20 20v-4h-4" /></Svg>;
