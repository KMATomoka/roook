// Contenu de la page « Apprendre » : leçons pour débutants et exercices.
// Chaque position est vérifiée par scripts/verif-apprendre.js (solution possible, coups légaux…).
//
// Types d'objectif d'une étape de leçon :
//   targets  : passer par toutes les cases marquées (targets), les pièces noires ne bougent pas
//   capture  : prendre toutes les pièces noires, qui ne bougent pas
//   move     : jouer un coup précis (moves : ['e5d6'…]) ; pre = coup noir joué automatiquement avant
//   castle   : roquer (side : 'k' petit roque, 'q' grand roque)
//   promote  : amener un pion au bout et le transformer
//   check    : mettre le roi adverse en échec
//   escape   : sortir de l'échec (how : 'king' bouger le roi, 'capture' prendre l'attaquant, 'block' s'interposer)
//   mate     : faire échec et mat en un coup
// only : types de pièces qu'on a le droit de bouger (ex. 'r' pour la tour seulement).
//
// Exercices (goal) : mate1 (mat en 1), mate2 (mat en 2), defend (empêcher le mat adverse),
//   line (suite précise : line = [coup du joueur, réponse adverse, coup du joueur…], chaque coup du joueur
//   pouvant avoir plusieurs réponses acceptées, séparées par « | »).

export const CHAPTERS = [
  { id: 'pieces', title: 'Les pièces', desc: 'Comment se déplace chaque pièce. Commence par là !' },
  { id: 'regles', title: 'Les règles spéciales', desc: 'Promotion, prise en passant et roque.' },
  { id: 'gagner', title: 'Échec, mat et nulle', desc: 'Comment on gagne une partie… et comment on la rate.' },
];

export const LESSONS = [
  // ------------------------------------------------------------------ Les pièces
  {
    id: 'tour', chapter: 'pieces', piece: 'r', title: 'La tour',
    intro: 'La tour se déplace <b>en ligne droite</b> : vers le haut, le bas, la gauche ou la droite, d’autant de cases qu’elle veut. Elle ne saute jamais par-dessus une autre pièce.',
    steps: [
      { goal: 'targets', fen: '8/8/8/8/8/8/8/R7 w - - 0 1', targets: ['a6'], text: 'Clique sur la tour, puis sur la case marquée ◆ pour l’y amener.' },
      { goal: 'targets', fen: '8/8/8/8/8/8/8/R7 w - - 0 1', targets: ['a6', 'f6', 'f2'], text: 'Passe par toutes les cases marquées, dans l’ordre que tu veux.' },
      { goal: 'capture', fen: '8/5p2/8/8/8/2p2p2/8/2R5 w - - 0 1', text: 'Prends tous les pions noirs. Pour prendre, la tour se pose sur la case de la pièce adverse.' },
      { goal: 'targets', fen: '8/8/8/8/P7/8/8/R7 w - - 0 1', targets: ['a8'], only: 'r', text: 'Ton pion bloque le chemin : la tour ne peut pas sauter par-dessus. Fais le tour pour atteindre la case marquée.' },
    ],
  },
  {
    id: 'fou', chapter: 'pieces', piece: 'b', title: 'Le fou',
    intro: 'Le fou se déplace <b>en diagonale</b>, d’autant de cases qu’il veut. Il reste toujours sur des cases de la même couleur : un fou qui commence sur une case claire ne pourra jamais aller sur une case foncée.',
    steps: [
      { goal: 'targets', fen: '8/8/8/8/8/8/8/2B5 w - - 0 1', targets: ['f4'], text: 'Amène le fou sur la case marquée, en diagonale.' },
      { goal: 'targets', fen: '8/8/8/8/8/8/8/2B5 w - - 0 1', targets: ['a3', 'c5', 'e7'], text: 'Passe par toutes les cases marquées.' },
      { goal: 'capture', fen: '4p3/8/8/1p6/8/3p4/8/5B2 w - - 0 1', text: 'Prends tous les pions noirs avec ton fou.' },
    ],
  },
  {
    id: 'dame', chapter: 'pieces', piece: 'q', title: 'La dame',
    intro: 'La dame est la pièce la plus forte. Elle se déplace <b>comme la tour et comme le fou</b> : en ligne droite ou en diagonale, d’autant de cases qu’elle veut.',
    steps: [
      { goal: 'targets', fen: '8/8/8/8/8/8/8/3Q4 w - - 0 1', targets: ['d7', 'h3'], text: 'Passe par les deux cases marquées : une en ligne droite, une en diagonale.' },
      { goal: 'capture', fen: '1n6/8/3p4/8/8/8/7p/3Q4 w - - 0 1', text: 'Prends toutes les pièces noires. Trois coups suffisent !' },
    ],
  },
  {
    id: 'roi', chapter: 'pieces', piece: 'k', title: 'Le roi',
    intro: 'Le roi est la pièce la plus importante : si ton roi est pris au piège (échec et mat), tu perds la partie. Mais il est lent : il avance <b>d’une seule case</b>, dans n’importe quelle direction.',
    steps: [
      { goal: 'targets', fen: '8/8/8/8/8/8/8/4K3 w - - 0 1', targets: ['e3'], text: 'Amène le roi sur la case marquée, une case à la fois.' },
      { goal: 'targets', fen: '8/8/8/8/8/8/8/4K3 w - - 0 1', targets: ['c3', 'e5', 'g3'], text: 'Passe par toutes les cases marquées.' },
    ],
  },
  {
    id: 'cavalier', chapter: 'pieces', piece: 'n', title: 'Le cavalier',
    intro: 'Le cavalier se déplace <b>en forme de L</b> : deux cases tout droit, puis une case sur le côté. C’est la seule pièce qui peut <b>sauter</b> par-dessus les autres.',
    steps: [
      { goal: 'targets', fen: '8/8/8/8/8/8/8/1N6 w - - 0 1', targets: ['c3'], text: 'Amène le cavalier sur la case marquée.' },
      { goal: 'targets', fen: '8/8/8/8/8/8/8/1N6 w - - 0 1', targets: ['c3', 'd5', 'f6'], text: 'Passe par toutes les cases marquées.' },
      { goal: 'targets', fen: '8/8/8/8/8/8/5PPP/6N1 w - - 0 1', targets: ['f3', 'e5'], only: 'n', text: 'Le cavalier saute par-dessus tes pions. Passe par les cases marquées.' },
      { goal: 'capture', fen: '8/8/8/6p1/4p3/2p5/8/1N6 w - - 0 1', text: 'Prends tous les pions noirs avec ton cavalier.' },
    ],
  },
  {
    id: 'pion', chapter: 'pieces', piece: 'p', title: 'Le pion',
    intro: 'Le pion avance <b>tout droit d’une case</b>, et ne recule jamais. Pour son tout premier coup, il peut avancer de <b>deux cases</b>. Attention : il ne prend pas tout droit, il prend <b>en diagonale</b>, une case en avant.',
    steps: [
      { goal: 'targets', fen: '8/8/8/8/8/8/4P3/8 w - - 0 1', targets: ['e4'], text: 'C’est le premier coup de ce pion : avance-le de deux cases d’un coup.' },
      { goal: 'targets', fen: '8/8/8/8/8/8/4P3/8 w - - 0 1', targets: ['e6'], text: 'Avance le pion jusqu’à la case marquée.' },
      { goal: 'capture', fen: '8/8/8/6p1/5p2/4p3/3P4/8 w - - 0 1', text: 'Prends les pions noirs : en diagonale, une case en avant.' },
      { goal: 'move', fen: '8/8/8/3pp3/4P3/8/8/8 w - - 0 1', moves: ['e4d5'], text: 'Ton pion est bloqué par le pion noir juste devant lui : il ne peut pas avancer, ni prendre tout droit. Mais il peut prendre l’autre pion, en diagonale !' },
    ],
  },
  // ------------------------------------------------------------------ Les règles spéciales
  {
    id: 'promotion', chapter: 'regles', piece: 'q', title: 'La promotion',
    intro: 'Quand un pion arrive sur la <b>dernière rangée</b>, il se transforme en la pièce de ton choix : dame, tour, fou ou cavalier. On choisit presque toujours la dame, la plus forte.',
    steps: [
      { goal: 'promote', fen: '8/8/8/4P3/8/8/8/8 w - - 0 1', text: 'Avance le pion jusqu’au bout, puis choisis la dame.' },
      { goal: 'promote', fen: '3r4/4P3/8/8/8/8/8/8 w - - 0 1', text: 'Un pion qui prend peut aussi arriver au bout : prends la tour et deviens une dame.', capture: true },
    ],
  },
  {
    id: 'en-passant', chapter: 'regles', piece: 'p', title: 'La prise en passant',
    intro: 'Une règle spéciale du pion. Si un pion adverse avance de <b>deux cases</b> d’un coup et s’arrête <b>juste à côté</b> de ton pion, tu peux le prendre comme s’il n’avait avancé que d’une case : ton pion va en diagonale, derrière lui. Attention, c’est possible <b>seulement au coup suivant</b>.',
    steps: [
      { goal: 'move', fen: '8/3p4/8/4P3/8/8/8/8 b - - 0 1', pre: 'd7d5', moves: ['e5d6'], text: 'Le pion noir vient d’avancer de deux cases, juste à côté du tien. Prends-le en passant : va en diagonale, derrière lui.', wrong: 'Ce n’est pas la prise en passant. Ton pion va en diagonale, sur la case juste derrière le pion noir.' },
      { goal: 'move', fen: '8/6p1/8/5P2/8/8/8/8 b - - 0 1', pre: 'g7g5', moves: ['f5g6'], text: 'Encore une fois : prends le pion noir en passant.', wrong: 'Ce n’est pas la prise en passant. Ton pion va en diagonale, sur la case juste derrière le pion noir.' },
    ],
  },
  {
    id: 'roque', chapter: 'regles', piece: 'k', title: 'Le roque',
    intro: 'Le roque est le seul coup où l’on bouge <b>deux pièces</b> : le roi va de deux cases vers une tour, et la tour passe de l’autre côté du roi. Il sert à mettre le roi à l’abri. Pour roquer, ni le roi ni cette tour ne doivent avoir déjà bougé, aucune pièce ne doit être entre eux, et le roi ne doit pas être en échec, ni passer ou arriver sur une case attaquée.<br>Astuce : sur ROOOK, tu peux aussi poser ton roi directement sur la tour.',
    steps: [
      { goal: 'castle', side: 'k', fen: '4k3/8/8/8/8/8/PPPPPPPP/R3K2R w KQ - 0 1', text: 'Fais le petit roque, du côté de la tour la plus proche : déplace ton roi de deux cases vers la droite.' },
      { goal: 'castle', side: 'q', fen: '4k3/8/8/8/8/8/PPPPPPPP/R3K2R w KQ - 0 1', text: 'Maintenant le grand roque, de l’autre côté : déplace ton roi de deux cases vers la gauche.' },
      { goal: 'castle', side: 'q', fen: '4k3/8/8/8/2b5/8/PPP2PPP/R3K2R w KQ - 0 1', text: 'Ici, le petit roque est interdit : le fou noir surveille f1, une case que ton roi traverserait. Fais le grand roque.' },
    ],
  },
  // ------------------------------------------------------------------ Échec, mat et nulle
  {
    id: 'echec', chapter: 'gagner', piece: 'k', title: 'L’échec',
    intro: 'Quand une pièce attaque le roi adverse, on dit que le roi est <b>en échec</b>. Le joueur en échec doit s’en sortir tout de suite, c’est obligatoire. On n’a jamais le droit de mettre ou de laisser son propre roi en échec.',
    steps: [
      { goal: 'check', fen: '4k3/8/8/8/8/8/8/R3K3 w - - 0 1', text: 'Mets le roi noir en échec avec ta tour.' },
      { goal: 'check', fen: '4k3/8/8/1N6/8/8/8/4K3 w - - 0 1', text: 'Mets le roi noir en échec avec ton cavalier.' },
      { goal: 'check', fen: '4k3/8/8/8/8/8/4B3/4K3 w - - 0 1', text: 'Mets le roi noir en échec avec ton fou.' },
    ],
  },
  {
    id: 'sortir-echec', chapter: 'gagner', piece: 'k', title: 'Sortir de l’échec',
    intro: 'Il y a trois façons de sortir d’un échec :<br>1. <b>déplacer le roi</b> sur une case qui n’est pas attaquée ;<br>2. <b>prendre</b> la pièce qui donne échec ;<br>3. <b>mettre une pièce entre</b> ton roi et l’attaquant (ça ne marche pas contre un cavalier, qui saute).',
    steps: [
      { goal: 'escape', how: 'king', fen: '4r1k1/8/8/8/8/8/8/4K3 w - - 0 1', text: 'Ton roi est en échec par la tour noire. Déplace-le sur une case sûre.' },
      { goal: 'escape', how: 'capture', fen: '6k1/8/8/4r3/8/2B5/8/4K3 w - - 0 1', text: 'Encore en échec ! Cette fois, prends la pièce qui attaque ton roi.' },
      { goal: 'escape', how: 'block', fen: '4r1k1/8/8/8/8/R7/8/4K3 w - - 0 1', text: 'Mets ta tour entre ton roi et la tour noire pour bloquer l’échec.' },
    ],
  },
  {
    id: 'mat', chapter: 'gagner', piece: 'q', title: 'L’échec et mat',
    intro: 'Si le roi est en échec et qu’il n’existe <b>aucun moyen</b> de s’en sortir, c’est <b>échec et mat</b> : la partie est finie, celui qui a fait mat a gagné. Le roi n’est jamais vraiment pris : le mat suffit.',
    steps: [
      { goal: 'mate', fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', text: 'Le roi noir est enfermé derrière ses pions. Fais échec et mat avec ta tour.' },
      { goal: 'mate', fen: 'k7/6R1/8/8/8/8/8/6KR w - - 0 1', text: 'Une tour bloque une rangée, l’autre donne échec : fais échec et mat.' },
      { goal: 'mate', fen: 'k7/8/1K6/8/8/8/7Q/8 w - - 0 1', text: 'Ton roi aide ta dame : fais échec et mat.' },
    ],
  },
  {
    id: 'nulle', chapter: 'gagner', piece: 'k', title: 'Le pat et la nulle',
    intro: 'Attention au <b>pat</b> ! Si le joueur qui doit jouer n’est <b>pas en échec</b> mais n’a <b>aucun coup possible</b>, la partie est nulle : personne ne gagne. Même avec beaucoup plus de pièces, on peut rater sa victoire comme ça.<br>La partie est aussi nulle quand la même position revient 3 fois, quand il ne reste plus assez de pièces pour faire mat (roi contre roi par exemple), après 50 coups sans prise ni coup de pion, ou quand les deux joueurs sont d’accord.',
    steps: [
      { goal: 'mate', fen: 'k7/8/2K5/8/8/8/8/1Q6 w - - 0 1', text: 'Fais échec et mat… sans faire pat ! Laisse le roi noir en échec, pas juste coincé.' },
      { goal: 'mate', fen: '7k/8/6K1/8/8/8/8/5Q2 w - - 0 1', text: 'Encore un : fais échec et mat sans faire pat.' },
    ],
  },
];

// ------------------------------------------------------------------ Exercices
export const PUZZLE_CATS = [
  { id: 'mat1', title: 'Mat en 1', desc: 'Trouve le coup qui fait échec et mat tout de suite.' },
  { id: 'gain', title: 'Gagner une pièce', desc: 'Fourchettes, enfilades… attrape une pièce adverse.' },
  { id: 'defense', title: 'Défendre', desc: 'Ton adversaire menace de te faire mat : empêche-le !' },
  { id: 'mat2', title: 'Mat en 2', desc: 'Deux coups pour faire mat, quoi que fasse l’adversaire.' },
];

export const PUZZLES = [
  // Mat en 1
  { id: 'm1-1', cat: 'mat1', goal: 'mate1', fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', hint: 'Le roi noir n’a pas de case de fuite sur la rangée du fond.' },
  { id: 'm1-2', cat: 'mat1', goal: 'mate1', fen: 'k7/8/1K6/8/8/8/7Q/8 w - - 0 1', hint: 'Ton roi surveille déjà a7 et b7. Il reste à attaquer la dernière rangée.' },
  { id: 'm1-3', cat: 'mat1', goal: 'mate1', fen: '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1', hint: 'Le roi noir est étouffé par ses propres pièces. Seul le cavalier peut l’atteindre.' },
  { id: 'm1-4', cat: 'mat1', goal: 'mate1', fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', hint: 'Le pion f7 n’est défendu que par le roi, et ton fou vise aussi cette case.' },
  { id: 'm1-5', cat: 'mat1', goal: 'mate1', fen: '2r3k1/8/8/8/8/8/5PPP/6K1 b - - 0 1', hint: 'Tu joues les Noirs. Le roi blanc est enfermé par ses pions.' },
  { id: 'm1-6', cat: 'mat1', goal: 'mate1', fen: '6k1/5p1p/6p1/8/3Q4/2B5/5PPP/6K1 w - - 0 1', hint: 'Ta dame, protégée par le fou, peut se poser juste devant le roi.' },
  { id: 'm1-7', cat: 'mat1', goal: 'mate1', fen: '7k/8/5N2/8/8/8/8/6RK w - - 0 1', hint: 'Le cavalier surveille g8 et h7. Ta tour fait le reste.' },
  { id: 'm1-8', cat: 'mat1', goal: 'mate1', fen: 'k7/6R1/8/8/8/8/8/6KR w - - 0 1', hint: 'Une tour tient la 7e rangée : l’autre peut donner échec sur la 8e.' },
  // Gagner une pièce
  { id: 'g-1', cat: 'gain', goal: 'line', fen: '4k3/8/8/3n4/8/8/3R4/4K3 w - - 0 1', line: ['d2d5'], hint: 'Une pièce noire n’est défendue par personne.' },
  { id: 'g-2', cat: 'gain', goal: 'line', fen: 'r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1', line: ['b5c7', 'e8d8', 'c7a8'], hint: 'Le cavalier peut attaquer le roi et la tour en même temps : c’est une fourchette.' },
  { id: 'g-3', cat: 'gain', goal: 'line', fen: '4k3/8/8/2n1n3/8/3P4/8/7K w - - 0 1', line: ['d3d4', 'e5c6', 'd4c5'], hint: 'Un simple pion peut attaquer deux pièces à la fois.' },
  { id: 'g-4', cat: 'gain', goal: 'line', fen: '7K/q7/8/8/3k4/8/7B/8 w - - 0 1', line: ['h2g1', 'd4e4', 'g1a7'], hint: 'Donne échec au roi en diagonale : quand il se pousse, la dame derrière lui est sans défense. C’est une enfilade.' },
  { id: 'g-5', cat: 'gain', goal: 'line', fen: 'r5k1/6pp/8/8/8/8/5PPP/3Q2K1 w - - 0 1', line: ['d1d5', 'g8h8', 'd5a8'], hint: 'Ta dame peut donner échec et attaquer la tour a8 en même temps.' },
  // Défendre
  { id: 'd-1', cat: 'defense', goal: 'defend', fen: '4r1k1/5ppp/8/8/8/8/5PPP/6K1 w - - 0 1', hint: 'La tour noire menace Te1 mat sur ta première rangée. Donne une case de fuite à ton roi.' },
  { id: 'd-2', cat: 'defense', goal: 'defend', fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3', hint: 'Tu joues les Noirs. La dame et le fou blancs visent f7 : protège cette case (ou chasse la dame).' },
  { id: 'd-3', cat: 'defense', goal: 'defend', fen: '6k1/1b3ppp/8/6q1/8/2N5/5PPP/3Q2K1 w - - 0 1', hint: 'La dame noire menace de prendre en g2, avec l’aide du fou b7. Coupe la diagonale du fou.' },
  { id: 'd-4', cat: 'defense', goal: 'defend', fen: '5r1k/6pp/8/8/5n2/4B2q/5P1P/3R2K1 w - - 0 1', hint: 'La dame noire menace Dg2 mat, protégée par le cavalier f4. Débarrasse-toi de ce cavalier.' },
  // Mat en 2
  { id: 'm2-1', cat: 'mat2', goal: 'mate2', fen: '4k3/8/8/8/8/8/R7/1R4K1 w - - 0 1', hint: 'La technique de l’escalier : une tour bloque une rangée, l’autre donne échec juste au-dessus.' },
  { id: 'm2-2', cat: 'mat2', goal: 'mate2', fen: 'r5k1/5ppp/8/8/8/8/3R1PPP/3R2K1 w - - 0 1', hint: 'Tes deux tours sont l’une derrière l’autre. Donne échec sur la rangée du fond : la tour noire doit prendre, et ton autre tour reprend.' },
  { id: 'm2-3', cat: 'mat2', goal: 'mate2', fen: '3r2k1/3r1ppp/8/8/8/8/5PPP/R5K1 b - - 0 1', hint: 'Tu joues les Noirs. Même idée sur la première rangée des Blancs : sacrifie une tour, l’autre fait mat.' },
];
