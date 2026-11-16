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
  /** Roue crantée (paramètres). */
  gear: svg(
    `<path d="M28 5 H36 L37.5 12 Q41.5 13.3 44.8 15.7 L51.5 12.8 L57.2 18.5 L54.3 25.2 Q56.7 28.5 58 32.5 L65 34 V42 L58 43.5 Q56.7 47.5 54.3 50.8 L57.2 57.5 L51.5 63.2 L44.8 60.3 Q41.5 62.7 37.5 64 L36 71 H28 L26.5 64 Q22.5 62.7 19.2 60.3 L12.5 63.2 L6.8 57.5 L9.7 50.8 Q7.3 47.5 6 43.5 L-1 42 V34 L6 32.5 Q7.3 28.5 9.7 25.2 L6.8 18.5 L12.5 12.8 L19.2 15.7 Q22.5 13.3 26.5 12 Z" transform="translate(32 32) scale(.82) translate(-32 -38)" fill="#a98bff"/>
    <circle cx="32" cy="32" r="10.5" fill="#ffd36b"/>
    <circle cx="32" cy="32" r="4.5" fill="#1d1530" stroke="none"/>
    ${sparkle(53, 9, 4, '#c7f5e3')}`,
    'gear',
  ),
  /** Appareil photo (changer ma photo). */
  camera: svg(
    `<path d="M22 16 L25 9 H39 L42 16" fill="#ffd36b"/>
    <rect x="6" y="15" width="52" height="38" rx="7" fill="#a98bff"/>
    <path d="M6.5 24 H18 M46 24 H57.5" stroke-width="3"/>
    <rect x="11" y="18" width="7" height="4" rx="1.5" fill="#ff7aa8" stroke-width="2.4"/>
    <circle cx="32" cy="34" r="13" fill="#ffd36b"/>
    <circle cx="32" cy="34" r="7.5" fill="#d6ecff"/>
    <path d="M28 31 Q29.5 28.5 32 28" stroke="#ffffff" stroke-width="2.6"/>
    ${sparkle(52, 8, 4, '#c7f5e3')}`,
    'camera',
  ),
  /** Cadre photo barré d'une gomme (retirer la photo). */
  noPhoto: svg(
    `<rect x="6" y="9" width="44" height="38" rx="5" fill="#f3eeff"/>
    <path d="M10 43 L22 29 L30 37 L36 31 L46 43 Z" fill="#9ff0d0" stroke-width="3"/>
    <circle cx="37" cy="20" r="4.5" fill="#ffd36b" stroke-width="3"/>
    <path d="M36 50 L50 36 Q53 33 56 36 L59 39 Q62 42 59 45 L45 59 Z" fill="#ff7aa8"/>
    <path d="M36 50 L45 59 L41 61 Q38 62 36 60 L34 58 Q32 56 33 53 Z" fill="#ffd8e6"/>
    <path d="M42 44 L51 53" stroke-width="3"/>`,
    'noPhoto',
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
  // --- Icônes du reste du site (à la place des emojis), même style ----------------------------------------
  /** Cadenas (verrouillé). */
  lock: svg(
    `<path d="M21 29 V20 Q21 9 32 9 Q43 9 43 20 V29" stroke-width="10"/>
    <path d="M21 29 V20 Q21 9 32 9 Q43 9 43 20 V29" stroke="#c9ccd6" stroke-width="4"/>
    <rect x="12" y="27" width="40" height="30" rx="7" fill="#ffd36b"/>
    <path d="M17 32 V51" stroke="#fff1bd" stroke-width="2.6"/>
    <circle cx="32" cy="39" r="4" fill="${OUT}" stroke="none"/><path d="M32 41 V48" stroke-width="3.4"/>`,
    'lock',
  ),
  /** Poussière d'étoile (les doublons des box). */
  dust: svg(`${sparkle(27, 36, 19, '#cdb4ff')}${sparkle(49, 14, 9, '#fff6c8')}${sparkle(50, 50, 6, '#c7f5e3')}<circle cx="13" cy="13" r="2.4" fill="#fff6c8" stroke-width="2.4"/>`, 'dust'),
  /** Ampoule (indice, conseil). */
  bulb: svg(
    `<path d="M32 5 C17 5 11 18 15 28 C18 35 24 38 24 45 H40 C40 38 46 35 49 28 C53 18 47 5 32 5 Z" fill="#ffe27a"/>
    <rect x="23" y="45" width="18" height="11" rx="3.5" fill="#c9ccd6"/>
    <path d="M23 50.5 H41" stroke-width="2.6"/><path d="M28 59 H36" stroke-width="3.4"/>
    <path d="M27 31 L32 37 L37 31" stroke-width="2.6"/>
    <path d="M21 18 Q23 11 30 10" stroke="#ffffff" stroke-width="3"/>`,
    'bulb',
  ),
  /** Flamme (série). */
  fire: svg(
    `<path d="M33 4 C36 17 51 22 51 39 C51 51 43 59 32 59 C21 59 13 51 13 39 C13 29 19 24 22 15 C26 21 26 26 28 28 C31 20 30 12 33 4 Z" fill="#ff8a4c"/>
    <path d="M32 30 C36 37 43 40 43 47 C43 54 38 58 32 58 C26 58 21 54 21 47 C21 40 28 38 32 30 Z" fill="#ffd36b"/>
    <path d="M28 49 Q28 44 32 41" stroke="#fff6c8" stroke-width="2.6"/>`,
    'fire',
  ),
  /** Trophée doré (victoire, record). */
  trophy: svg(
    `<path d="M18 13 H9 Q7 28 21 30 M46 13 H55 Q57 28 43 30" stroke-width="4"/>
    <path d="M17 7 H47 V21 C47 32 40 38 32 38 C24 38 17 32 17 21 Z" fill="#ffd36b"/>
    <path d="M23 12 V22" stroke="#fff1bd" stroke-width="3"/>
    <path d="M32 15 L33.8 19.4 L38.4 19.8 L34.9 22.8 L36 27.4 L32 25 L28 27.4 L29.1 22.8 L25.6 19.8 L30.2 19.4 Z" fill="#fff6c8" stroke-width="2.4"/>
    <rect x="28" y="38" width="8" height="9" fill="#f5b840"/>
    <rect x="17" y="47" width="30" height="11" rx="3.5" fill="#a8694a"/>
    <path d="M25 52.5 H39" stroke="#e3a57c" stroke-width="2.4"/>`,
    'trophy',
  ),
  /** Interdit (bannir). */
  ban: svg(
    `<circle cx="32" cy="32" r="25" fill="#ff6b6b"/>
    <rect x="15" y="27" width="34" height="10" rx="4" fill="#ffffff"/>
    <path d="M17 20 Q22 12 31 10" stroke="#ffb3b3" stroke-width="3"/>`,
    'ban',
  ),
  /** Haut-parleur (son). */
  sound: svg(
    `<path d="M7 24 H18 L32 11 V53 L18 40 H7 Z" fill="#a98bff"/>
    <path d="M11 28 V36" stroke="#d9ccff" stroke-width="2.6"/>
    <path d="M40 24 Q46 32 40 40" stroke-width="4"/><path d="M46 15 Q60 32 46 49" stroke-width="4"/>`,
    'sound',
  ),
  /** Haut-parleur barré (son coupé). */
  mute: svg(
    `<path d="M7 24 H18 L32 11 V53 L18 40 H7 Z" fill="#a98bff"/>
    <path d="M11 28 V36" stroke="#d9ccff" stroke-width="2.6"/>
    <path d="M41 24 L56 39 M56 24 L41 39" stroke-width="8"/><path d="M41 24 L56 39 M56 24 L41 39" stroke="#ff7a7a" stroke-width="3.4"/>`,
    'mute',
  ),
  /** Éclair (prémove). */
  bolt: svg(
    `<path d="M37 4 L12 37 H30 L25 60 L52 25 H34 Z" fill="#ffd36b"/>
    <path d="M33 12 L20 31" stroke="#fff6c8" stroke-width="3"/>`,
    'bolt',
  ),
  /** Dé (adversaire au hasard). */
  dice: svg(
    `<rect x="9" y="9" width="46" height="46" rx="11" fill="#f3eeff"/>
    <path d="M15 20 Q15 15 20 15" stroke="#ffffff" stroke-width="3"/>
    ${[[21, 21], [43, 21], [32, 32], [21, 43], [43, 43]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.6" fill="#a98bff" stroke-width="2.6"/>`).join('')}`,
    'dice',
  ),
  /** Livre ouvert (leçons). */
  book: svg(
    `<path d="M6 14 Q19 8 32 14 V56 Q19 50 6 56 Z" fill="#7fc0ff"/>
    <path d="M58 14 Q45 8 32 14 V56 Q45 50 58 56 Z" fill="#b9dcff"/>
    <path d="M12 22 Q19 19 26 22 M12 30 Q19 27 26 30 M38 22 Q45 19 52 22 M38 30 Q45 27 52 30" stroke-width="2.6"/>
    ${sparkle(50, 44, 4, '#fff6c8')}`,
    'book',
  ),
  /** Cible et flèche (entraînements). */
  target: svg(
    `<circle cx="28" cy="36" r="23" fill="#ff7aa8"/>
    <circle cx="28" cy="36" r="15" fill="#ffffff"/>
    <circle cx="28" cy="36" r="7" fill="#ff7aa8"/>
    <path d="M29 35 L52 12" stroke-width="4"/>
    <path d="M47 7 L52 12 L57 9 L55 4 Z M52 12 L57 17 L60 12 L55 9" fill="#3cf2a3" stroke-width="2.8"/>`,
    'target',
  ),
  /** Panneau attention. */
  warning: svg(
    `<path d="M32 6 L60 55 Q61 58 57 58 H7 Q3 58 4 55 Z" fill="#ffd36b"/>
    <path d="M32 24 V38" stroke-width="5.5"/><circle cx="32" cy="47" r="3.4" fill="${OUT}" stroke="none"/>`,
    'warning',
  ),
  /** Enveloppe (e-mail). */
  mail: svg(
    `<rect x="6" y="13" width="52" height="38" rx="6" fill="#f3eeff"/>
    <path d="M9 17 L32 36 L55 17" stroke-width="3.5"/>
    <path d="M9 48 L25 31 M55 48 L39 31" stroke-width="2.6"/>
    <circle cx="32" cy="36" r="5.5" fill="#ff7aa8" stroke-width="2.8"/>`,
    'mail',
  ),
  /** Cotillon (fête). */
  party: svg(
    `<path d="M9 57 L21 19 L47 45 Z" fill="#ffd36b"/>
    <path d="M15 39 L29 51 M18 29 L39 47" stroke="#ff7aa8" stroke-width="4"/>
    <circle cx="45" cy="11" r="3.2" fill="#3cf2a3" stroke-width="2.4"/><circle cx="56" cy="34" r="3" fill="#a98bff" stroke-width="2.4"/>
    <path d="M33 9 Q37 15 31 19" stroke-width="2.8"/><path d="M50 22 Q55 22 57 17" stroke-width="2.8"/>
    ${sparkle(41, 26, 5, '#fff6c8')}`,
    'party',
  ),
  /** Courbe qui monte (classement). */
  trend: svg(
    `<rect x="7" y="8" width="50" height="48" rx="6" fill="#f3eeff"/>
    <path d="M14 46 L25 33 L33 39 L48 20" stroke-width="9"/>
    <path d="M14 46 L25 33 L33 39 L48 20" stroke="#3cf2a3" stroke-width="4"/>
    <path d="M40 18 H50 V28" stroke-width="4"/>`,
    'trend',
  ),
  /** Pièce de puzzle (problèmes). */
  puzzle: svg(
    `<path d="M10 20 H23 Q20 9 30 9 Q40 9 37 20 H50 V33 Q60 30 60 39 Q60 48 50 45 V57 H37 Q40 48 30 48 Q20 48 23 57 H10 V45 Q20 48 20 39 Q20 30 10 33 Z" fill="#a98bff"/>
    <path d="M14 25 V29" stroke="#d9ccff" stroke-width="2.6"/>`,
    'puzzle',
  ),
  /** Infini (mat à l'infini). */
  infinity: svg(
    `<path d="M32 32 C26 21 9 21 9 32 C9 43 26 43 32 32 C38 21 55 21 55 32 C55 43 38 43 32 32 Z" stroke-width="11"/>
    <path d="M32 32 C26 21 9 21 9 32 C9 43 26 43 32 32 C38 21 55 21 55 32 C55 43 38 43 32 32 Z" stroke="#a98bff" stroke-width="4.5"/>
    ${sparkle(52, 11, 4, '#c7f5e3')}`,
    'infinity',
  ),
  /** Clé à molette (outils de test). */
  tools: svg(
    `<path d="M45 5 C37 5 31 12 34 20 L9 45 Q5 49 9 53 L11 55 Q15 59 19 55 L44 30 C52 33 59 27 59 19 L51 23 L45 17 L49 9 Q47 5 45 5 Z" fill="#c9ccd6"/>
    <path d="M14 48 L33 29" stroke="#ffffff" stroke-width="2.6"/>`,
    'tools',
  ),
  /** Globe (public). */
  globe: svg(
    `<circle cx="32" cy="32" r="25" fill="#7fd3ff"/>
    <path d="M14 22 Q22 14 30 19 Q29 27 22 27 Q16 29 14 22 Z M36 33 Q45 29 49 38 Q45 49 38 47 Q33 42 36 33 Z M38 12 Q46 13 50 20 Q44 21 40 18 Z" fill="#3cf2a3" stroke-width="2.8"/>
    <path d="M12 22 Q20 16 22 9" stroke="#ffffff" stroke-width="2.6"/>`,
    'globe',
  ),
  /** Œil (voir la solution). */
  eye: svg(
    `<path d="M4 32 Q32 6 60 32 Q32 58 4 32 Z" fill="#f3eeff"/>
    <circle cx="32" cy="32" r="12" fill="#a98bff"/>
    <circle cx="32" cy="32" r="5" fill="${OUT}" stroke="none"/>
    <circle cx="36" cy="27.5" r="2.4" fill="#ffffff" stroke="none"/>`,
    'eye',
  ),
  /** Balai (effacer). */
  broom: svg(
    `<path d="M50 5 L32 33" stroke-width="9"/><path d="M50 5 L32 33" stroke="#c4835d" stroke-width="4"/>
    <path d="M24 29 L40 39 L33 59 Q19 57 9 48 Z" fill="#ffd36b"/>
    <path d="M24 29 L40 39" stroke-width="5"/><path d="M19 44 L27 54 M26 40 L32 52" stroke-width="2.6"/>`,
    'broom',
  ),
  /** Clé dorée (ouvrir le coffre). */
  key: svg(
    `<path d="M29 29 L55 55" stroke-width="11"/><path d="M29 29 L55 55" stroke="#ffd36b" stroke-width="5"/>
    <path d="M44 44 L50 38 M50 50 L56 44" stroke-width="5"/>
    <circle cx="21" cy="21" r="14" fill="#ffd36b"/>
    <circle cx="21" cy="21" r="5.5" fill="${OUT}" stroke="none"/>
    <path d="M12 17 Q14 11 20 10" stroke="#fff1bd" stroke-width="2.6"/>`,
    'key',
  ),
  /** Nouvel ami (demande d'ami). */
  userPlus: svg(
    `<path d="M6 58 Q6 38 24 38 Q42 38 42 58 Z" fill="#a98bff"/>
    <circle cx="24" cy="23" r="11" fill="#ffd8b5"/>
    <path d="M13 23 Q13 11 24 11 Q35 11 35 22 Q29 17 22 18 Q16 19 13 23 Z" fill="#6b4a8f"/>
    <circle cx="47" cy="20" r="12" fill="#3cf2a3"/>
    <path d="M47 14 V26 M41 20 H53" stroke-width="3.6"/>`,
    'userPlus',
  ),
  /** Cadeau (trouver dans les box). */
  gift: svg(
    `<path d="M32 19 Q19 4 14 12 Q12 19 32 19 Z M32 19 Q45 4 50 12 Q52 19 32 19 Z" fill="#ffd36b"/>
    <rect x="9" y="28" width="46" height="29" rx="4" fill="#ff7aa8"/>
    <rect x="6" y="19" width="52" height="11" rx="3.5" fill="#ff9cc4"/>
    <rect x="28" y="19" width="8" height="38" fill="#ffd36b"/>`,
    'gift',
  ),
  /** Flèches qui tournent (répétition). */
  repeat: svg(
    `<path d="M12 30 Q12 17 25 17 H45" stroke-width="9"/><path d="M12 30 Q12 17 25 17 H45" stroke="#a98bff" stroke-width="4"/>
    <path d="M52 34 Q52 47 39 47 H19" stroke-width="9"/><path d="M52 34 Q52 47 39 47 H19" stroke="#3cf2a3" stroke-width="4"/>
    <path d="M40 8 L50 17 L40 26 Z" fill="#a98bff" stroke-width="3"/><path d="M24 38 L14 47 L24 56 Z" fill="#3cf2a3" stroke-width="3"/>`,
    'repeat',
  ),
  /** Sablier (attente). */
  hourglass: svg(
    `<path d="M18 11 H46 Q46 26 35 32 Q46 38 46 53 H18 Q18 38 29 32 Q18 26 18 11 Z" fill="#d6ecff"/>
    <path d="M23 16 H41 Q40 24 32 28 Q24 24 23 16 Z" fill="#ffd36b" stroke-width="2.6"/>
    <path d="M22 50 Q25 41 32 39 Q39 41 42 50 Z" fill="#ffd36b" stroke-width="2.6"/>
    <rect x="12" y="4" width="40" height="8" rx="3" fill="#a8694a"/><rect x="12" y="52" width="40" height="8" rx="3" fill="#a8694a"/>`,
    'hourglass',
  ),
  /** Crayon (écrire). */
  pencil: svg(
    `<path d="M44 8 L56 20 L22 54 L8 58 L12 44 Z" fill="#ffd36b"/>
    <path d="M12 44 L22 54 L8 58 Z" fill="#ffd8b5" stroke-width="3"/>
    <path d="M8 58 L10 51 L15 56 Z" fill="${OUT}" stroke-width="2"/>
    <path d="M44 8 L56 20 L50 26 L38 14 Z" fill="#ff7aa8"/>
    <path d="M18 44 L42 20" stroke="#fff1bd" stroke-width="2.6"/>`,
    'pencil',
  ),
  /** Médaille (badge). */
  medal: svg(
    `<path d="M15 4 H28 L37 25 H24 Z" fill="#7fc0ff"/><path d="M49 4 H36 L27 25 H40 Z" fill="#ff7aa8"/>
    <circle cx="32" cy="41" r="17" fill="#ffd36b"/>
    <circle cx="32" cy="41" r="11" fill="#f5b840" stroke-width="2.6"/>
    <path d="M32 34 L34 38.6 L39 39 L35.2 42.2 L36.4 47 L32 44.4 L27.6 47 L28.8 42.2 L25 39 L30 38.6 Z" fill="#fff6c8" stroke-width="2.2"/>`,
    'medal',
  ),
  /** Deux épées croisées (défier). */
  swords: svg(
    `<path d="M10 10 L41 41 M54 10 L23 41" stroke-width="10"/>
    <path d="M10 10 L41 41 M54 10 L23 41" stroke="#d6e4ff" stroke-width="4.5"/>
    <path d="M35 48 L48 35 M16 35 L29 48" stroke-width="8"/><path d="M35 48 L48 35 M16 35 L29 48" stroke="#ffd36b" stroke-width="3.5"/>
    <path d="M45 45 L54 54 M19 45 L10 54" stroke-width="8"/><path d="M45 45 L54 54 M19 45 L10 54" stroke="#a8694a" stroke-width="3.5"/>
    <circle cx="56" cy="56" r="4" fill="#ffd36b" stroke-width="2.8"/><circle cx="8" cy="56" r="4" fill="#ffd36b" stroke-width="2.8"/>`,
    'swords',
  ),
  /** Bulle de chat (message). */
  chat: svg(
    `<path d="M8 14 Q8 8 14 8 H50 Q56 8 56 14 V38 Q56 44 50 44 H28 L16 56 V44 H14 Q8 44 8 38 Z" fill="#a98bff"/>
    <circle cx="22" cy="26" r="3.4" fill="${OUT}" stroke="none"/><circle cx="32" cy="26" r="3.4" fill="${OUT}" stroke="none"/><circle cx="42" cy="26" r="3.4" fill="${OUT}" stroke="none"/>`,
    'chat',
  ),
};

/** Une icône dans du texte (même taille que les lettres). */
export const ico = (name, cls = '') => `<span class="ico${cls ? ' ' + cls : ''}" aria-hidden="true">${ICONS[name] || ''}</span>`;

/** Flèches de navigation (début, précédent, suivant, fin), simples et nettes, de la couleur du texte. */
const nav = (d) => `<svg class="nav-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${d}</svg>`;
export const NAV = {
  first: nav('<rect x="4" y="5" width="3" height="14" rx="1.2"/><path d="M19 6.2v11.6a1 1 0 0 1-1.6.8L9.6 12.8a1 1 0 0 1 0-1.6l7.8-5.8a1 1 0 0 1 1.6.8z"/>'),
  prev: nav('<path d="M17 6.2v11.6a1 1 0 0 1-1.6.8L7.6 12.8a1 1 0 0 1 0-1.6l7.8-5.8a1 1 0 0 1 1.6.8z"/>'),
  next: nav('<path d="M7 6.2v11.6a1 1 0 0 0 1.6.8l7.8-5.8a1 1 0 0 0 0-1.6L8.6 5.4A1 1 0 0 0 7 6.2z"/>'),
  last: nav('<rect x="17" y="5" width="3" height="14" rx="1.2"/><path d="M5 6.2v11.6a1 1 0 0 0 1.6.8l7.8-5.8a1 1 0 0 0 0-1.6L6.6 5.4A1 1 0 0 0 5 6.2z"/>'),
};

/** Pages HTML : <span data-ico="trophy"></span> reçoit l'icône dessinée (et data-nav-ico="first" les flèches). */
export function fillIcons(root = document) {
  for (const el of root.querySelectorAll('[data-ico]')) if (!el.firstElementChild) el.innerHTML = ICONS[el.dataset.ico] || '';
  for (const el of root.querySelectorAll('[data-nav-ico]')) if (!el.firstElementChild) el.innerHTML = NAV[el.dataset.navIco] || '';
}
