// Génère database.rules.json (les règles de sécurité de la base Firebase).
// Écrites ici en JavaScript pour pouvoir réutiliser les conditions « est admin » et « n'est pas banni ».
// Utilisation : node scripts/rules.js  puis recopier le fichier dans la console Firebase → Realtime Database → Règles.
const fs = require('fs');
const path = require('path');

const ME = 'auth != null';
// Rôles : « fondateur » (au-dessus de tout, donné seulement depuis la console Firebase) et « admin ».
// ADMIN = a les droits d'administration (admin ou fondateur) ; FOUNDER = fondateur.
const ADMIN = "(root.child('roles/' + auth.uid).val() === 'admin' || root.child('roles/' + auth.uid).val() === 'fondateur')";
const FOUNDER = "root.child('roles/' + auth.uid).val() === 'fondateur'";
const BAN = "root.child('bans/' + auth.uid)";
// Pas banni : aucun bannissement, ou un bannissement temporaire déjà terminé (until = 0 → définitif)
const OK = `(!${BAN}.exists() || (${BAN}.child('until').val() > 0 && ${BAN}.child('until').val() < now))`;
const OWNER = (v) => `auth.uid === ${v}`;
// Profil visible : le sien, celui de quelqu'un qui n'est pas en privé, celui d'un ami, ou tout profil pour un admin
const VISIBLE = (v) => `(auth.uid === ${v} || ${ADMIN} || root.child('users/' + ${v} + '/private').val() !== true || root.child('friends/' + ${v} + '/' + auth.uid).exists())`;

// ---------------------------------------------------------------------------
// Arbitre des parties entre amis (il n'y a pas de serveur : ce sont ces règles qui arbitrent).
//  - un coup : seulement à son tour, jamais réécrit, numéroté dans l'ordre ;
//  - la pendule : recalculée avec l'heure de Firebase (« now »), impossible de se rajouter du temps ;
//  - la fin de partie : on ne peut jamais se déclarer gagnant soi-même.
//      abandon → seul le perdant peut l'écrire ; mat → c'est le joueur maté qui le confirme ;
//      nulle d'un commun accord → il faut la proposition de l'autre ; pat, répétition… → il faut que les deux le constatent ;
//      temps → seulement si l'heure de Firebase montre que la pendule est vraiment tombée ;
//      coup illégal reçu → la partie peut être annulée (personne ne gagne).
// ---------------------------------------------------------------------------
const G = (p) => `root.child('games/' + $g + '/${p}')`; // valeur actuelle (avant l'écriture)
const PLAYER = `(${G('white')}.val() === auth.uid || ${G('black')}.val() === auth.uid)`;
const SEAT = `(${G('white')}.val() === auth.uid ? 'w' : 'b')`;
const OTHER = `(${G('white')}.val() === auth.uid ? 'b' : 'w')`;
const PLAYING = `${G('status')}.val() === 'playing'`;
const TURN = `(${G('ply')}.val() % 2 === 0 ? 'w' : 'b')`; // camp qui doit jouer
const AT = `${G('clock/at')}.val()`;
const CLOCK = (c) => `root.child('games/' + $g + '/clock/' + ${c}).val()`;
const LEFT = (c) => `(${CLOCK(c)} - (now - ${AT}))`; // temps restant selon l'heure de Firebase
const NEW_CLOCK = `newData.parent().child('clock/' + ${SEAT}).val()`;
// Pendule (vérifiée au moment du coup) : avant le départ, elle ne bouge pas ; ensuite, au plus le temps restant
// + l'incrément (+ 2 s de marge pour le réseau), et on ne joue plus une fois tombé. L'heure de départ est celle de Firebase.
const CLOCK_OK = `(${AT} === 0 ? ${NEW_CLOCK} === ${CLOCK(SEAT)} : (${LEFT(SEAT)} > -1000 && ${NEW_CLOCK} <= ${LEFT(SEAT)} + ${G('time/inc')}.val() + 2000)) && (newData.val() >= 2 ? newData.parent().child('clock/at').val() === now : newData.parent().child('clock/at').val() === 0)`;
// Revanche acceptée par les deux : remise à zéro, numéro de manche + 1 (champs directement sous la partie)
const RESET = `(${PLAYER} && ${G('status')}.val() === 'over' && ${G('rematch/w')}.val() === true && ${G('rematch/b')}.val() === true && newData.parent().child('round').val() === ${G('round')}.val() + 1)`;
const R_ = "newData.parent().child('result').val()";
const W_ = "newData.parent().child('reason').val()";
const LOSS_ME = `(${SEAT} === 'w' ? '0-1' : '1-0')`;
const LOSS_TURN = `(${TURN} === 'w' ? '0-1' : '1-0')`;
const END_OK = `((${W_} === 'abandon' && ${R_} === ${LOSS_ME})
  || (${W_} === 'accord' && ${R_} === '1/2-1/2' && ${G('drawOffer')}.val() === ${OTHER})
  || (${W_} === 'mat' && ${TURN} === ${SEAT} && ${R_} === ${LOSS_ME})
  || ((${W_} === 'pat' || ${W_} === 'materiel' || ${W_} === 'repetition' || ${W_} === '50coups') && ${R_} === '1/2-1/2' && root.child('games/' + $g + '/claims/' + ${OTHER}).val() === ${W_})
  || (${AT} > 0 && ${LEFT(TURN)} <= 0 && ((${W_} === 'temps' && ${R_} === ${LOSS_TURN}) || (${W_} === 'temps-materiel' && ${R_} === '1/2-1/2' && ${TURN} !== ${SEAT})))
  || (${W_} === 'annulee' && ${R_} === '*' && ${TURN} === ${SEAT}))`.replace(/\n\s*/g, ' ');

// Historique : une partie entre amis n'y entre que si elle existe vraiment, est terminée, et avec le même résultat
const GH = (p) => `root.child('games/' + newData.child('game').val() + '/${p}')`;
const AMI_OK = `(newData.child('game').isString() && newData.child('round').isNumber() && $h === newData.child('game').val() + '-' + newData.child('round').val()
  && ${GH('status')}.val() === 'over' && newData.child('result').val() !== '*' && newData.child('date').val() === now && ${GH('round')}.val() === newData.child('round').val()
  && ${GH('result')}.val() === newData.child('result').val() && ${GH('reason')}.val() === newData.child('reason').val()
  && ${GH('ply')}.val() === newData.child('ply').val()
  && newData.child('white').val() === ${GH('names/w')}.val() && newData.child('black').val() === ${GH('names/b')}.val()
  && ((newData.child('me').val() === 'w' && ${GH('white')}.val() === $uid && newData.child('opp').val() === ${GH('black')}.val())
   || (newData.child('me').val() === 'b' && ${GH('black')}.val() === $uid && newData.child('opp').val() === ${GH('white')}.val())))`.replace(/\n\s*/g, ' ');
// (Les parties contre Noa ne vont plus dans l'historique : elles ne comptent pas dans les statistiques.)

// Badge Royal : il faut prouver 100 victoires en ligne. La preuve = 100 clés de l'historique du joueur (p0…p99),
// chacune pointant vers une partie entre amis GAGNÉE (l'historique est lui-même vérifié), rangées par date
// strictement croissante : elles sont donc toutes différentes (99 comparaisons au lieu de 4 950).
// (ROYAL_N ne sert qu'aux tests : node scripts/rules.js avec ROYAL_N=3.)
const ROYAL_N = Number(process.env.ROYAL_N) || 100;
const PROOF = Array.from({ length: ROYAL_N }, (_, i) => 'p' + i);
const WIN = (k) => `(root.child('history/' + $uid + '/' + ${k}).child('mode').val() === 'ami' && ((root.child('history/' + $uid + '/' + ${k}).child('me').val() === 'w' && root.child('history/' + $uid + '/' + ${k}).child('result').val() === '1-0') || (root.child('history/' + $uid + '/' + ${k}).child('me').val() === 'b' && root.child('history/' + $uid + '/' + ${k}).child('result').val() === '0-1')))`;
const DATE = (i) => `root.child('history/' + $uid + '/' + newData.child('p${i}').val() + '/date').val()`;
const ORDERED = [];
for (let i = 1; i < ROYAL_N; i++) ORDERED.push(`${DATE(i)} > ${DATE(i - 1)}`);
const PROOF_OK = `newData.hasChildren([${PROOF.map((k) => `'${k}'`).join(', ')}]) && ${ORDERED.join(' && ')}`;

const rules = {
  rules: {
    users: {
      '.read': `${ME} && ${ADMIN}`,
      $uid: {
        '.read': ME,
        '.write': `${ME} && ${OWNER('$uid')} && ${OK}`,
        '.validate': "newData.hasChildren(['username']) && newData.child('username').val().matches(/^[A-Za-z0-9_-]{3,20}$/) && (!newData.child('private').exists() || newData.child('private').isBoolean())",
        // Bio du profil : 300 caractères au plus ; un admin peut l'effacer (modération)
        bio: {
          '.write': `${ME} && ${ADMIN} && !newData.exists()`,
          '.validate': 'newData.isString() && newData.val().length <= 300',
        },
        // Badge affiché en partie : seulement un badge qu'on possède vraiment
        badge: {
          '.validate': `newData.isString() && ((newData.val() === 'fondateur' && root.child('roles/' + $uid).val() === 'fondateur') || (newData.val() === 'admin' && root.child('roles/' + $uid).val() === 'admin') || (newData.val() === 'royal' && (newData.parent().child('royalProof').exists() || root.child('roles/' + $uid).val() === 'admin' || root.child('roles/' + $uid).val() === 'fondateur')) || newData.val() === 'sakura' || newData.val() === 'western')`,
        },
        // Preuve du badge Royal (100 victoires différentes)
        royalProof: {
          '.validate': PROOF_OK,
          $p: { '.validate': `$p.matches(/^p[0-9]{1,2}$/) && newData.isString() && ${WIN('newData.val()')}` },
        },
      },
    },
    // Adresse e-mail : visible par le joueur lui-même et par les admins seulement
    private: {
      '.read': `${ME} && ${ADMIN}`,
      $uid: {
        '.read': `${ME} && (${OWNER('$uid')} || ${ADMIN})`,
        '.write': `${ME} && ${OWNER('$uid')}`,
        '.validate': "newData.hasChildren(['email']) && newData.child('email').isString() && newData.child('email').val().length <= 200",
      },
    },
    // Pseudo → identifiant. Lisible sans compte (pour vérifier qu'un pseudo est libre à l'inscription),
    // listable 10 par 10 par les membres (recherche de joueurs). Une fois pris, un pseudo est réservé.
    usernames: {
      '.read': `${ME} && query.orderByKey == true && query.limitToFirst <= 10`,
      $name: {
        '.read': true,
        // Réserver un pseudo libre ; le libérer seulement si c'est le sien (suppression de compte)
        '.write': `${ME} && ((!data.exists() && newData.val() === auth.uid && $name.matches(/^[a-z0-9_-]{3,20}$/)) || (data.val() === auth.uid && !newData.exists()))`,
      },
    },
    roles: {
      '.read': ME,
      $uid: {
        // Seul un admin nomme ou retire un admin, et jamais lui-même (pour ne pas se retirer ses droits par erreur)
        // Nommer admin un membre : un admin ou le fondateur. Retirer le rôle d'un admin : le fondateur seulement.
        // Le rôle « fondateur » ne se donne ni ne s'enlève depuis le site (console Firebase uniquement).
        '.write': `${ME} && $uid !== auth.uid && ((${ADMIN} && !data.exists() && newData.val() === 'admin') || (${FOUNDER} && data.val() === 'admin' && !newData.exists()))`,
        '.validate': "newData.val() === 'admin'",
      },
    },
    bans: {
      '.read': `${ME} && ${ADMIN}`,
      $uid: {
        '.read': `${ME} && (${OWNER('$uid')} || ${ADMIN})`,
        // Personne ne bannit un admin ou le fondateur
        '.write': `${ME} && ${ADMIN} && $uid !== auth.uid && !root.child('roles/' + $uid).exists()`,
        '.validate': "newData.hasChildren(['reason', 'at', 'until', 'by']) && newData.child('until').isNumber() && newData.child('reason').isString() && newData.child('reason').val().length <= 200",
      },
    },
    avatars: {
      '.read': `${ME} && ${ADMIN}`,
      $uid: {
        '.read': ME,
        // Le joueur change sa photo ; un admin peut la retirer
        '.write': `${ME} && ((${OWNER('$uid')} && ${OK}) || (${ADMIN} && !newData.exists()))`,
        '.validate': "newData.isString() && newData.val().length < 60000 && (newData.val().beginsWith('data:image/jpeg;base64,') || newData.val().beginsWith('data:image/webp;base64,') || newData.val().beginsWith('data:image/png;base64,'))",
      },
    },
    status: {
      '.read': `${ME} && ${ADMIN}`,
      $uid: {
        '.read': ME,
        '.write': `${ME} && ${OWNER('$uid')} && ${OK}`,
      },
    },
    friendRequests: {
      $to: {
        '.read': `${ME} && auth.uid === $to`,
        $from: {
          '.write': `${ME} && ${OK} && (auth.uid === $from || (auth.uid === $to && !newData.exists())) && $from !== $to`,
          '.validate': "newData.hasChildren(['username', 'at'])",
        },
      },
    },
    sentRequests: {
      $from: {
        '.read': `${ME} && auth.uid === $from`,
        $to: {
          '.write': `${ME} && ${OK} && (auth.uid === $from || (auth.uid === $to && !newData.exists()))`,
          '.validate': "newData.hasChildren(['username', 'at'])",
        },
      },
    },
    friends: {
      '.read': `${ME} && ${ADMIN}`,
      $uid: {
        // Liste d'amis : visible sur le profil, sauf profil privé (alors seulement pour ses amis)
        '.read': `${ME} && ${VISIBLE('$uid')}`,
        $fid: {
          '.write': `${ME} && ${OK} && $uid !== $fid && (!newData.exists() ? (auth.uid === $uid || auth.uid === $fid) : ((auth.uid === $uid && root.child('friendRequests/' + $uid + '/' + $fid).exists()) || (auth.uid === $fid && root.child('friendRequests/' + $fid + '/' + $uid).exists())))`,
          '.validate': "newData.hasChildren(['username', 'since'])",
        },
      },
    },
    invites: {
      $to: {
        '.read': `${ME} && auth.uid === $to`,
        $id: {
          '.write': `${ME} && ((!data.exists() && ${OK} && newData.child('from').val() === auth.uid && root.child('friends/' + $to + '/' + auth.uid).exists()) || (data.exists() && !newData.exists() && (auth.uid === $to || data.child('from').val() === auth.uid)))`,
          '.validate': "newData.hasChildren(['from', 'fromName', 'color', 'base', 'inc', 'expires'])",
        },
      },
    },
    inviteReplies: {
      $from: {
        '.read': `${ME} && auth.uid === $from`,
        $id: {
          '.write': `${ME} && (auth.uid === $from || (${OK} && root.child('friends/' + $from + '/' + auth.uid).exists()))`,
        },
      },
    },
    // Parties entre amis : les règles servent d'arbitre (voir la section « Arbitre » plus haut).
    games: {
      $g: {
        '.read': ME,
        // Création seulement (par l'un des deux joueurs, qui doivent être amis) ; ensuite, chaque champ a sa règle
        '.write': `${ME} && ${OK} && !data.exists() && (newData.child('white').val() === auth.uid || newData.child('black').val() === auth.uid) && root.child('friends/' + newData.child('white').val() + '/' + newData.child('black').val()).exists()`,
        '.validate': `newData.hasChildren(['white', 'black', 'names', 'time', 'status', 'round', 'ply']) && (data.exists() || (newData.child('status').val() === 'playing' && newData.child('round').val() === 1 && newData.child('ply').val() === 0 && !newData.child('moves').exists() && !newData.child('result').exists() && !newData.child('reason').exists() && newData.child('time/base').isNumber() && newData.child('time/base').val() >= 60000 && newData.child('time/inc').isNumber() && newData.child('clock/w').val() === newData.child('time/base').val() && newData.child('clock/b').val() === newData.child('time/base').val() && newData.child('clock/at').val() === 0))`,
        // Revanche : couleurs inversées
        white: { '.write': RESET, '.validate': `!data.exists() || newData.val() === ${G('black')}.val()` },
        black: { '.write': RESET, '.validate': `!data.exists() || newData.val() === ${G('white')}.val()` },
        names: {
          '.write': RESET,
          '.validate': `!data.exists() || (newData.child('w').val() === ${G('names/b')}.val() && newData.child('b').val() === ${G('names/w')}.val())`,
        },
        round: { '.write': RESET, '.validate': `!data.exists() || newData.val() === data.val() + 1` },
        // Nombre de coups joués : avance d'un à chaque coup, et c'est là qu'on vérifie la pendule
        ply: {
          '.write': `(${PLAYER} && ${OK} && ${PLAYING} && ${TURN} === ${SEAT} && newData.val() === data.val() + 1 && newData.parent().child('moves/' + data.val()).exists() && ${CLOCK_OK}) || (${RESET} && newData.val() === 0)`,
        },
        moves: {
          '.write': `${RESET} && !newData.exists()`,
          $n: {
            '.write': `${PLAYER} && ${OK} && ${PLAYING} && !data.exists() && $n === '' + ${G('ply')}.val() && newData.parent().parent().child('ply').val() === ${G('ply')}.val() + 1`,
            '.validate': "newData.isString() && newData.val().matches(/^[a-h][1-8][a-h][1-8][qrbn]?$/)",
          },
        },
        clock: {
          '.write': `${RESET} && newData.child('w').val() === ${G('time/base')}.val() && newData.child('b').val() === ${G('time/base')}.val() && newData.child('at').val() === 0`,
          // Sa propre pendule, seulement en jouant un coup (la valeur est contrôlée par la règle de « ply »)
          $c: {
            '.write': `${PLAYER} && ${OK} && ${PLAYING} && $c === ${SEAT} && newData.parent().parent().child('ply').val() === ${G('ply')}.val() + 1`,
            '.validate': 'newData.isNumber() && newData.val() >= 0',
          },
          at: {
            '.write': `${PLAYER} && ${OK} && ${PLAYING} && newData.parent().parent().child('ply').val() === ${G('ply')}.val() + 1`,
            '.validate': 'newData.isNumber()',
          },
        },
        status: {
          '.write': `(${PLAYER} && ${OK} && data.val() === 'playing' && newData.val() === 'over' && ${END_OK}) || (${RESET} && newData.val() === 'playing')`,
        },
        result: {
          '.write': `(${PLAYER} && !data.exists() && ${PLAYING} && newData.parent().child('status').val() === 'over') || (${RESET} && !newData.exists())`,
          '.validate': "newData.val() === '1-0' || newData.val() === '0-1' || newData.val() === '1/2-1/2' || newData.val() === '*'",
        },
        reason: {
          '.write': `(${PLAYER} && !data.exists() && ${PLAYING} && newData.parent().child('status').val() === 'over') || (${RESET} && !newData.exists())`,
          '.validate': `newData.isString() && newData.val().matches(/^(mat|abandon|accord|temps|temps-materiel|pat|materiel|repetition|50coups|annulee)$/)`,
        },
        // Proposer la nulle (pour soi), ou effacer une proposition
        drawOffer: { '.write': `${PLAYER} && (!newData.exists() || (${OK} && ${PLAYING} && newData.val() === ${SEAT}))` },
        // Nulles « automatiques » (pat, répétition…) : chaque joueur constate, il faut les deux
        claims: {
          '.write': `${RESET} && !newData.exists()`,
          $c: {
            '.write': `${PLAYER} && ${PLAYING} && $c === ${SEAT}`,
            '.validate': "newData.isString() && newData.val().matches(/^(pat|materiel|repetition|50coups)$/)",
          },
        },
        // Revanche : chacun ne coche que sa propre case
        rematch: {
          '.write': `(${PLAYER} && ${G('status')}.val() === 'over') || ${RESET}`,
          '.validate': `${RESET} || ((newData.child(${OTHER}).val() === true) === (data.child(${OTHER}).val() === true))`,
        },
        online: { $uid: { '.write': `auth.uid === $uid && ${PLAYER}` } },
        chat: {
          $m: {
            '.write': `${PLAYER} && ${OK} && !data.exists()`,
            '.validate': "newData.hasChildren(['from', 'text', 'at']) && newData.child('text').isString() && newData.child('text').val().length <= 300",
          },
        },
      },
    },
    history: {
      '.read': `${ME} && ${ADMIN}`,
      $uid: {
        // Parties et statistiques : visibles sur le profil, sauf profil privé (alors seulement pour ses amis)
        '.read': `${ME} && ${VISIBLE('$uid')}`,
        $h: {
          // On ajoute une partie, on ne la modifie ni ne l'efface (pas de défaite qui disparaît) ; un admin peut supprimer
          '.write': `${ME} && ((auth.uid === $uid && !data.exists() && newData.exists()) || (${ADMIN} && !newData.exists()))`,
          '.validate': `newData.hasChildren(['white', 'black', 'me', 'mode', 'result', 'reason', 'moves', 'date']) && newData.child('mode').val() === 'ami' && ${AMI_OK}`,
        },
      },
    },
  },
};

const out = path.join(__dirname, '..', 'database.rules.json');
fs.writeFileSync(out, JSON.stringify(rules, null, 2) + '\n');
console.log('Règles écrites dans database.rules.json (' + fs.statSync(out).size + ' octets)');
