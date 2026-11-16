// Icônes dessinées du menu (barre du haut et menu du téléphone), à la place des emojis.
// Même style partout : gros contour sombre arrondi, couleurs pastel, petites étincelles.
// Les coffres sont ceux de ROOOK : bois, cerclages dorés, et la gemme verte du coffre commun sur la serrure.
const OUT = '#1d1530';
const svg = (body, label = '') =>
  `<svg class="ui-ico" viewBox="0 0 64 64" fill="none" stroke="${OUT}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${label ? ` data-ico="${label}"` : ''}>${body}</svg>`;
const sparkle = (x, y, r, fill) =>
  `<path d="M${x} ${y - r} Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y} Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r} Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y} Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r}Z" fill="${fill}" stroke-width="3"/>`;
const rivets = (pts) => pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6" fill="${OUT}" stroke="none"/>`).join('');

export const ICONS = {
  /** Coffre fermé, étincelles au-dessus (compteur de box). */
  chest: svg(
    `${sparkle(32, 9, 6, '#c7f5e3')}${sparkle(17, 12, 4, '#d6e4ff')}${sparkle(47, 12, 4, '#d6e4ff')}
    <rect x="8" y="22" width="48" height="33" rx="5" fill="#a8694a"/>
    <path d="M8.5 30 H55.5"/>
    <path d="M10 26 Q10 23 13 23 H51 Q54 23 54 26 V29 H10Z" fill="#c4835d" stroke="none"/>
    <path d="M22 39 H27 M37 39 H42 M22 46 H42" stroke-width="3"/>
    <rect x="12" y="20" width="8" height="37" rx="2.5" fill="#ffd36b"/>
    <rect x="44" y="20" width="8" height="37" rx="2.5" fill="#ffd36b"/>
    <path d="M14.5 23 V54" stroke="#fff1bd" stroke-width="2"/><path d="M46.5 23 V54" stroke="#fff1bd" stroke-width="2"/>
    ${rivets([[16, 26], [16, 36], [16, 46], [48, 26], [48, 36], [48, 46]])}
    <rect x="6" y="51" width="52" height="8" rx="3" fill="#f5b840"/>
    ${rivets([[12, 55], [52, 55]])}<path d="M20 55 H28 M36 55 H44" stroke-width="2.6"/>
    <rect x="28.5" y="19" width="7" height="11" rx="2" fill="#ffe7a3"/>
    <rect x="24" y="28" width="16" height="14" rx="4.5" fill="#ffd36b"/>
    <path d="M32 31 L35.8 35 L32 39 L28.2 35 Z" fill="#3cf2a3" stroke-width="2.6"/>`,
    'chest',
  ),
  /** Coffre ouvert, lumière violette et étincelles (« Mes box » dans le menu). */
  chestOpen: svg(
    `<path d="M11 27 L9 10 Q9 5 14 5 H50 Q55 5 55 10 L53 27 Z" fill="#c4835d"/>
    <path d="M15 25 L14 13 H50 L49 25 Z" fill="#cdb4ff"/>
    <rect x="28" y="4" width="8" height="9" rx="2" fill="#ffd36b"/>
    <path d="M7 33 L14 25 H50 L57 33 Z" fill="#b993ff"/>
    ${sparkle(24, 18, 4.5, '#fff6c8')}${sparkle(42, 17, 3.5, '#fff6c8')}
    <rect x="7" y="32" width="50" height="25" rx="4" fill="#a8694a"/>
    <rect x="14" y="37" width="36" height="15" rx="2.5" fill="#c98f86"/>
    <path d="M7.5 41 Q12 41 12 36 M56.5 41 Q52 41 52 36 M7.5 48 Q12 48 12 53 M56.5 48 Q52 48 52 53" stroke-width="3"/>
    <path d="M7 36 Q11 36 11 33 M57 36 Q53 36 53 33" stroke="none"/>
    <rect x="27" y="32" width="10" height="12" rx="3.5" fill="#ffd36b"/>
    <path d="M32 35 L34.6 38 L32 41 L29.4 38 Z" fill="#3cf2a3" stroke-width="2.4"/>`,
    'chest-open',
  ),
  /** Bouclier doré à étoile (administration). */
  shield: svg(
    `<path d="M32 5 L54 12 V30 C54 44 44 54 32 59 C20 54 10 44 10 30 V12 Z" fill="#ffd36b"/>
    <path d="M32 12 L47 17 V30 C47 40 40 47 32 51 C24 47 17 40 17 30 V17 Z" fill="#a98bff"/>
    <path d="M21 20 V29 C21 33 22.5 37 25 40" stroke="#d9ccff" stroke-width="2.4"/>
    <path d="M32 21 L34.6 27 L41 27.6 L36.2 31.8 L37.6 38.2 L32 34.8 L26.4 38.2 L27.8 31.8 L23 27.6 L29.4 27 Z" fill="#fff3c4" stroke-width="3"/>`,
    'shield',
  ),
  /** Buste (mon profil). */
  user: svg(
    `<path d="M11 58 Q11 37 32 37 Q53 37 53 58 Z" fill="#a98bff"/>
    <path d="M25 38 L32 46 L39 38" stroke-width="3"/>
    <circle cx="32" cy="22" r="12" fill="#ffd8b5"/>
    <path d="M20 22 Q20 9 32 9 Q44 9 44 21 Q38 15 30 16 Q24 17 20 22 Z" fill="#6b4a8f"/>
    <circle cx="27.5" cy="24" r="1.6" fill="${OUT}" stroke="none"/><circle cx="36.5" cy="24" r="1.6" fill="${OUT}" stroke="none"/>
    <path d="M29 29 Q32 31 35 29" stroke-width="2.6"/>
    ${sparkle(51, 13, 4, '#c7f5e3')}`,
    'user',
  ),
  /** Porte entrouverte et flèche qui sort (se déconnecter). */
  logout: svg(
    `<rect x="8" y="7" width="30" height="50" rx="3" fill="#7a4a35"/>
    <path d="M8 7 L28 12 V52 L8 57 Z" fill="#c4835d"/>
    <path d="M13 14 V48" stroke="#e3a57c" stroke-width="2.4"/>
    <circle cx="23" cy="33" r="2" fill="${OUT}" stroke="none"/>
    <path d="M34 26 H46 V19 L58 32 L46 45 V38 H34 Z" fill="#3cf2a3"/>`,
    'logout',
  ),
  /** Cavalier (jouer). */
  knight: svg(
    `<path d="M17 56 H49" stroke-width="3.5"/>
    <rect x="14" y="49" width="36" height="8" rx="3" fill="#ffd36b"/>
    <path d="M20 49 C20 40 26 36 28 30 L19 32 Q14 33 13 28 L24 15 Q27 9 33 8 L35 4 L39 9 Q50 14 50 30 Q50 41 46 49 Z" fill="#cdb4ff"/>
    <path d="M40 13 Q47 20 46 32" stroke="#efe6ff" stroke-width="2.6"/>
    <circle cx="30" cy="17" r="2" fill="${OUT}" stroke="none"/>
    <path d="M17.5 29 L20 28" stroke-width="2.6"/>
    ${sparkle(53, 11, 4, '#c7f5e3')}`,
    'knight',
  ),
  /** Toque de diplômé (apprendre). */
  cap: svg(
    `<path d="M17 30 V43 Q32 52 47 43 V30" fill="#8f6bff"/>
    <path d="M32 12 L60 24 L32 36 L4 24 Z" fill="#a98bff"/>
    <path d="M12 24 L32 16 L52 24" stroke="#d9ccff" stroke-width="2.4"/>
    <path d="M32 24 L50 30 V44" stroke-width="3"/>
    <path d="M47 44 L53 44 L52 52 L48 52 Z" fill="#ffd36b" stroke-width="3"/>
    <circle cx="32" cy="24" r="2.6" fill="#ffd36b" stroke-width="2.4"/>`,
    'cap',
  ),
  /** Deux amis (amis). */
  friends: svg(
    `<path d="M30 57 Q30 40 44 40 Q58 40 58 57 Z" fill="#9ff0d0"/>
    <circle cx="44" cy="28" r="9" fill="#ffd8b5"/>
    <path d="M35 27 Q36 18 44 18 Q52 18 53 26 Q47 22 40 24 Z" fill="#a8694a"/>
    <path d="M6 58 Q6 38 22 38 Q38 38 38 58 Z" fill="#a98bff"/>
    <circle cx="22" cy="24" r="10.5" fill="#ffd8b5"/>
    <path d="M11.5 24 Q12 13 22 13 Q32 13 32.5 23 Q27 18 20 19 Q15 20 11.5 24 Z" fill="#6b4a8f"/>
    <path d="M19 29 Q22 31 25 29" stroke-width="2.4"/>`,
    'friends',
  ),
  /** Tableau à barres (analyser une partie). */
  chart: svg(
    `<rect x="7" y="8" width="50" height="48" rx="6" fill="#f3eeff"/>
    <rect x="15" y="34" width="8" height="15" rx="2" fill="#a98bff"/>
    <rect x="28" y="24" width="8" height="25" rx="2" fill="#3cf2a3"/>
    <rect x="41" y="17" width="8" height="32" rx="2" fill="#ffd36b"/>
    <path d="M13 49 H51" stroke-width="3"/>
    <path d="M14 27 L25 20 L33 23 L46 12" stroke="#ff7aa8" stroke-width="3"/>`,
    'chart',
  ),
  /** Sac d'aventurier (inventaire). */
  bag: svg(
    `<path d="M24 14 Q24 6 32 6 Q40 6 40 14" stroke-width="4"/>
    <path d="M12 26 Q12 14 24 14 H40 Q52 14 52 26 V52 Q52 58 46 58 H18 Q12 58 12 52 Z" fill="#a8694a"/>
    <path d="M12 28 Q32 36 52 28 V24 Q52 16 44 15 H20 Q12 16 12 24 Z" fill="#c4835d"/>
    <rect x="20" y="38" width="24" height="14" rx="4" fill="#cdb4ff"/>
    <rect x="28" y="28" width="8" height="10" rx="2.5" fill="#ffd36b"/>
    <path d="M32 31 L34.2 33.5 L32 36 L29.8 33.5 Z" fill="#3cf2a3" stroke-width="2.2"/>
    <path d="M24 44 H40" stroke-width="2.6"/>`,
    'bag',
  ),
  /** Loupe dorée (rechercher un joueur). */
  search: svg(
    `<path d="M40 40 L55 55" stroke-width="10"/>
    <path d="M40 40 L55 55" stroke="#a8694a" stroke-width="4"/>
    <circle cx="27" cy="27" r="18" fill="#ffd36b"/>
    <circle cx="27" cy="27" r="12" fill="#d6ecff"/>
    <path d="M19.5 23 Q21.5 17.5 27 16.5" stroke="#ffffff" stroke-width="3"/>`,
    'search',
  ),
};
