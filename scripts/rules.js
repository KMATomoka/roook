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
//      coup illégal reçu → la partie peut être annulée (personne ne gagne) ;
//      déconnexion → si l'adversaire a quitté la partie depuis plus de 60 s (heure de Firebase) et n'est pas revenu,
//      on peut écrire sa propre victoire (« deconnexion ») ;
//      adversaire absent → avant le 2e coup, si l'adversaire n'est pas dans la partie, on peut l'annuler (« absent »).
// Les parties se créent entre amis, ou entre deux joueurs de la file « Adversaire au hasard » (matchmaking).
// ---------------------------------------------------------------------------
const G = (p) => `root.child('games/' + $g + '/${p}')`; // valeur actuelle (avant l'écriture)
const PLAYER = `(${G('white')}.val() === auth.uid || ${G('black')}.val() === auth.uid)`;
const SEAT = `(${G('white')}.val() === auth.uid ? 'w' : 'b')`;
const OTHER = `(${G('white')}.val() === auth.uid ? 'b' : 'w')`;
const OPP_UID = `(${G('white')}.val() === auth.uid ? ${G('black')}.val() : ${G('white')}.val())`;
const LEFT_AT = `root.child('games/' + $g + '/left/' + ${OPP_UID})`; // heure de la déconnexion de l'adversaire
const OPP_GONE = `(!root.child('games/' + $g + '/online/' + ${OPP_UID}).exists() && ${LEFT_AT}.isNumber() && now - ${LEFT_AT}.val() > 60000)`;
const PLAYING = `${G('status')}.val() === 'playing'`;
const TURN = `(${G('ply')}.val() % 2 === 0 ? 'w' : 'b')`; // camp qui doit jouer
const AT = `${G('clock/at')}.val()`;
const CLOCK = (c) => `root.child('games/' + $g + '/clock/' + ${c}).val()`;
const LEFT = (c) => `(${CLOCK(c)} - (now - ${AT}))`; // temps restant selon l'heure de Firebase
const NEW_CLOCK = `newData.parent().child('clock/' + ${SEAT}).val()`;
// Pendule (vérifiée au moment du coup) : avant le départ, elle ne bouge pas ; ensuite, au plus le temps restant
// + l'incrément (+ 2 s de marge pour le réseau), et on ne joue plus une fois tombé. L'heure de départ est celle de Firebase.
const CLOCK_OK = `(${AT} === 0 ? ${NEW_CLOCK} === ${CLOCK(SEAT)} : (${LEFT(SEAT)} > -1000 && ${NEW_CLOCK} <= ${LEFT(SEAT)} + ${G('time/inc')}.val() + 2000)) && (newData.val() >= 2 ? newData.parent().child('clock/at').val() === now : newData.parent().child('clock/at').val() === 0)`;
// Revanche acceptée par les deux : remise à zéro, numéro de manche + 1 (champs directement sous la partie).
// Pas de revanche en partie classée.
const RESET = `(${PLAYER} && !${G('ranked')}.exists() && ${G('status')}.val() === 'over' &&${G('rematch/w')}.val() === true && ${G('rematch/b')}.val() === true && newData.parent().child('round').val() === ${G('round')}.val() + 1)`;
const R_ = "newData.parent().child('result').val()";
const W_ = "newData.parent().child('reason').val()";
const LOSS_ME = `(${SEAT} === 'w' ? '0-1' : '1-0')`;
const WIN_ME = `(${SEAT} === 'w' ? '1-0' : '0-1')`;
const LOSS_TURN = `(${TURN} === 'w' ? '0-1' : '1-0')`;
const END_OK = `((${W_} === 'abandon' && ${R_} === ${LOSS_ME})
  || (${W_} === 'accord' && ${R_} === '1/2-1/2' && ${G('drawOffer')}.val() === ${OTHER})
  || (${W_} === 'mat' && ${TURN} === ${SEAT} && ${R_} === ${LOSS_ME})
  || ((${W_} === 'pat' || ${W_} === 'materiel' || ${W_} === 'repetition' || ${W_} === '50coups') && ${R_} === '1/2-1/2' && root.child('games/' + $g + '/claims/' + ${OTHER}).val() === ${W_})
  || (${AT} > 0 && ${LEFT(TURN)} <= 0 && ((${W_} === 'temps' && ${R_} === ${LOSS_TURN}) || (${W_} === 'temps-materiel' && ${R_} === '1/2-1/2' && ${TURN} !== ${SEAT})))
  || (${W_} === 'annulee' && ${R_} === '*' && ${TURN} === ${SEAT})
  || (${W_} === 'deconnexion' && ${R_} === ${WIN_ME} && ${OPP_GONE})
  || (${W_} === 'absent' && ${R_} === '*' && ${G('ply')}.val() < 2 && !root.child('games/' + $g + '/online/' + ${OPP_UID}).exists()))`.replace(/\n\s*/g, ' ');

// Adversaire au hasard : la partie est créée dans la même écriture que le « trouvé » des deux joueurs de la file
const NEWG = (p) => `newData.child('${p}').val()`;
const MM_MATCH = (seat) => `newData.parent().parent().child('matchmaking/' + ${NEWG('mm')} + '/' + ${NEWG(seat)} + '/match').val() === $g`;
const MM_PAIR = `(newData.child('mm').isString() && ${NEWG('white')} !== ${NEWG('black')} && ${MM_MATCH('white')} && ${MM_MATCH('black')})`;
// Depuis matchmaking/$key/$uid/match, la racine après l'écriture
const MM_ROOT = 'newData.parent().parent().parent().parent()';
const MM_GAME = (p) => `${MM_ROOT}.child('games/' + newData.val() + '/${p}').val()`;

// ---------------------------------------------------------------------------
// Mode classé (js/rangs.js). Files « r-<base>-<inc> » ; Elo par catégorie dans ratings/<cat>/<uid>.
// ---------------------------------------------------------------------------
const RANKED_KEY = '/^r-(60000-0|180000-2000|300000-0|600000-0|900000-10000)$/';
const CAT_OF = (k) => `(${k} === 'r-60000-0' ? 'bullet' : (${k} === 'r-180000-2000' || ${k} === 'r-300000-0') ? 'blitz' : 'rapide')`;
// Elo actuel d'un joueur dans une catégorie (800 s'il n'a jamais joué)
const RATING = (uid, cat) => `(root.child('ratings/' + ${cat} + '/' + ${uid} + '/r').isNumber() ? root.child('ratings/' + ${cat} + '/' + ${uid} + '/r').val() : 800)`;
// À la création d'une partie : classée si et seulement si elle vient d'une file classée, avec l'Elo des deux
// joueurs relevé tel qu'il est, et au plus 200 points d'écart
const RANKED_GAME = `(newData.child('mm').isString() && newData.child('mm').val().beginsWith('r-')
  ? (newData.child('mm').val().matches(${RANKED_KEY}) && newData.child('ranked').val() === true && newData.child('cat').val() === ${CAT_OF("newData.child('mm').val()")}
    && newData.child('elo/w').val() === ${RATING("newData.child('white').val()", "newData.child('cat').val()")}
    && newData.child('elo/b').val() === ${RATING("newData.child('black').val()", "newData.child('cat').val()")}
    && newData.child('elo/w').val() - newData.child('elo/b').val() <= 200 && newData.child('elo/b').val() - newData.child('elo/w').val() <= 200)
  : (!newData.child('ranked').exists() && !newData.child('elo').exists() && !newData.child('cat').exists()))`.replace(/\n\s*/g, ' ');
// Nouvelle fiche d'Elo : celle que donne la formule de js/rangs.js pour une partie classée terminée, jamais deux fois.
//   coefficient K = 40 pendant les 5 parties de placement, puis 16 ; chances E = 0,5 + (moi − adversaire) / 800 ;
//   nouvel Elo = Elo relevé au début de la partie + K × (score − E), arrondi.
const RG = (p) => `root.child('games/' + newData.child('last').val() + '/${p}')`;
const R_ME = `(${RG('white')}.val() === $uid ? ${RG('elo/w')}.val() : ${RG('elo/b')}.val())`;
const R_OPP = `(${RG('white')}.val() === $uid ? ${RG('elo/b')}.val() : ${RG('elo/w')}.val())`;
const R_N0 = "(data.child('n').isNumber() ? data.child('n').val() : 0)";
const R_K = `(${R_N0} < 5 ? 40 : 16)`;
const R_S = `(${RG('result')}.val() === '1/2-1/2' ? 0.5 : ((${RG('result')}.val() === '1-0') === (${RG('white')}.val() === $uid) ? 1 : 0))`;
const R_DIFF = `(newData.child('r').val() - ${R_ME} - ${R_K} * (${R_S} - (0.5 + (${R_ME} - ${R_OPP}) / 800)))`;
const RATING_OK = `(newData.hasChildren(['r', 'n', 'best', 'last', 'name', 'at']) && newData.child('last').isString()
  && ${RG('ranked')}.val() === true && ${RG('status')}.val() === 'over' && ${RG('cat')}.val() === $cat && ${RG('result')}.val() !== '*'
  && (${RG('white')}.val() === $uid || ${RG('black')}.val() === $uid) && (${RG('white')}.val() === auth.uid || ${RG('black')}.val() === auth.uid)
  && data.child('last').val() !== newData.child('last').val()
  && ${RG('createdAt')}.val() > (data.child('at').isNumber() ? data.child('at').val() : 0)
  && (data.child('r').isNumber() ? data.child('r').val() : 800) === ${R_ME}
  && newData.child('n').val() === ${R_N0} + 1
  && newData.child('r').isNumber() && newData.child('r').val() % 1 === 0 && ${R_DIFF} <= 0.501 && ${R_DIFF} >= -0.501
  && newData.child('best').val() === (data.child('best').isNumber() && data.child('best').val() > newData.child('r').val() ? data.child('best').val() : newData.child('r').val())
  && newData.child('name').val() === root.child('users/' + $uid + '/username').val()
  && newData.child('at').val() === now)`.replace(/\n\s*/g, ' ');

// Historique classé : une ligne par partie, écrite en même temps que la nouvelle fiche d'Elo (même valeur)
const LG = (p) => `root.child('games/' + $g + '/${p}')`;
const NEW_ROOT = 'newData.parent().parent().parent().parent()';
const LOG_OK = `(newData.hasChildren(['r', 'd', 'res', 'opp', 'on', 'oe', 'at'])
  && ${LG('ranked')}.val() === true && ${LG('status')}.val() === 'over' && ${LG('cat')}.val() === $cat
  && (${LG('white')}.val() === $uid || ${LG('black')}.val() === $uid) && (${LG('white')}.val() === auth.uid || ${LG('black')}.val() === auth.uid)
  && ${NEW_ROOT}.child('ratings/' + $cat + '/' + $uid + '/last').val() === $g
  && ${NEW_ROOT}.child('ratings/' + $cat + '/' + $uid + '/r').val() === newData.child('r').val()
  && newData.child('d').val() === newData.child('r').val() - (${LG('white')}.val() === $uid ? ${LG('elo/w')}.val() : ${LG('elo/b')}.val())
  && newData.child('opp').val() === (${LG('white')}.val() === $uid ? ${LG('black')}.val() : ${LG('white')}.val())
  && newData.child('res').val().matches(/^[vnd]$/) && newData.child('on').isString() && newData.child('on').val().length <= 20
  && newData.child('oe').isNumber() && newData.child('at').val() === now)`.replace(/\n\s*/g, ' ');

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
          '.validate': `newData.isString() && ((newData.val() === 'fondateur' && root.child('roles/' + $uid).val() === 'fondateur') || (newData.val() === 'admin' && root.child('roles/' + $uid).val() === 'admin') || (newData.val() === 'royal' && (newData.parent().child('royalProof').exists() || root.child('roles/' + $uid).val() === 'admin' || root.child('roles/' + $uid).val() === 'fondateur')) || newData.val() === 'sakura' || newData.val() === 'western' || newData.val() === 'ocean' || newData.val() === 'dragon')`,
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
    // File d'attente « Adversaire au hasard », une par cadence ($key = « base-inc » en ms, ex. 600000-0).
    // Chacun s'inscrit et part soi-même ; l'appariement écrit, en une fois, la partie et le « match » des deux joueurs.
    matchmaking: {
      $key: {
        '.read': ME,
        $uid: {
          '.write': `${ME} && auth.uid === $uid && ${OK} && ($key.matches(/^[0-9]{5,7}-[0-9]{1,5}$/) || $key.matches(${RANKED_KEY})) && (!newData.exists() || !newData.child('match').exists())`,
          // File classée : on y entre avec son Elo actuel dans la catégorie
          '.validate': `newData.hasChildren(['username', 'at']) && newData.child('username').isString() && newData.child('username').val().length <= 20 && (newData.child('at').val() === now || newData.child('at').val() === data.child('at').val()) && (!$key.beginsWith('r-') || newData.child('elo').val() === ${RATING('$uid', CAT_OF('$key'))})`,
          match: {
            // Seulement en créant la partie dans la même écriture, entre deux joueurs inscrits dans cette file
            '.write': `${ME} && ${OK} && !data.exists() && newData.isString() && root.child('matchmaking/' + $key + '/' + $uid + '/at').exists() && root.child('matchmaking/' + $key + '/' + auth.uid + '/at').exists() && !root.child('games/' + newData.val()).exists() && ${MM_GAME('mm')} === $key && (${MM_GAME('white')} === $uid || ${MM_GAME('black')} === $uid) && (${MM_GAME('white')} === auth.uid || ${MM_GAME('black')} === auth.uid)`,
          },
        },
      },
    },
    // Parties entre amis : les règles servent d'arbitre (voir la section « Arbitre » plus haut).
    games: {
      $g: {
        '.read': ME,
        // Création seulement (par l'un des deux joueurs, qui doivent être amis ou appariés par la file d'attente) ;
        // ensuite, chaque champ a sa règle
        '.write': `${ME} && ${OK} && !data.exists() && (newData.child('white').val() === auth.uid || newData.child('black').val() === auth.uid) && (root.child('friends/' + newData.child('white').val() + '/' + newData.child('black').val()).exists() || ${MM_PAIR})`,
        '.validate': `newData.hasChildren(['white', 'black', 'names', 'time', 'status', 'round', 'ply']) && (data.exists() || (newData.child('status').val() === 'playing' && newData.child('round').val() === 1 && newData.child('ply').val() === 0 && !newData.child('moves').exists() && !newData.child('result').exists() && !newData.child('reason').exists() && newData.child('time/base').isNumber() && newData.child('time/base').val() >= 60000 && newData.child('time/inc').isNumber() && newData.child('clock/w').val() === newData.child('time/base').val() && newData.child('clock/b').val() === newData.child('time/base').val() && newData.child('clock/at').val() === 0 && (!newData.child('mm').exists() || newData.child('mm').val() === newData.child('time/base').val() + '-' + newData.child('time/inc').val() || newData.child('mm').val() === 'r-' + newData.child('time/base').val() + '-' + newData.child('time/inc').val()) && ${RANKED_GAME}))`,
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
          '.validate': `newData.isString() && newData.val().matches(/^(mat|abandon|accord|temps|temps-materiel|pat|materiel|repetition|50coups|annulee|deconnexion|absent)$/)`,
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
        // Heure de déconnexion d'un joueur (posée par Firebase quand sa page se ferme, effacée à son retour)
        left: { $uid: { '.write': `auth.uid === $uid && ${PLAYER}`, '.validate': 'newData.isNumber()' } },
        // Pas de discussion avec un adversaire inconnu (partie « au hasard »)
        chat: {
          $m: {
            '.write': `${PLAYER} && ${OK} && !data.exists() && !${G('mm')}.exists()`,
            '.validate': "newData.hasChildren(['from', 'text', 'at']) && newData.child('text').isString() && newData.child('text').val().length <= 300",
          },
        },
      },
    },
    // Box : une par victoire en ligne (une partie de l'historique gagnée), ou offerte par un admin (box de test).
    // Chaque box ne s'ouvre qu'une fois (on n'efface ni ne réécrit une box ouverte). Ce qu'elle donne est tiré au
    // sort dans le navigateur (les règles ne savent pas tirer au hasard) ; elles bornent ce qu'on peut écrire.
    loot: {
      $uid: {
        '.read': `${ME} && (${OWNER('$uid')} || ${ADMIN})`,
        opened: {
          $box: {
            '.write': `${ME} && ${OWNER('$uid')} && ${OK} && !data.exists()`,
            '.validate': `newData.hasChildren(['at', 'item', 'rarity']) && newData.child('at').val() === now && newData.child('item').isString() && newData.child('item').val().length <= 40 && newData.child('rarity').val().matches(/^(commun|rare|epique|legendaire|jeu)$/) && (${WIN('$box')} || root.child('lootGrants/' + $uid + '/' + $box).exists() || ($box.beginsWith('dust-') && root.child('loot/' + $uid + '/dust').val() >= 10))`,
          },
        },
        // Éléments trouvés : seulement ceux des packs qu'on trouve dans les box (une pièce : P, R, N, B, Q, K ; pieces : le jeu complet)
        owned: {
          $pack: {
            $slot: {
              '.write': `${ME} && ${OWNER('$uid')} && ${OK}`,
              '.validate': "newData.val() === true && $pack.matches(/^(japon|western|ocean|bois|dragon)$/) && $slot.matches(/^(board|pieces|endAnim|capture|P|R|N|B|Q|K)$/)",
            },
          },
        },
        // Poussière d'étoile (les doublons) : jamais négative, au plus +20 d'un coup (le gain d'une box)
        dust: {
          '.write': `${ME} && ${OWNER('$uid')} && ${OK}`,
          '.validate': 'newData.isNumber() && newData.val() >= 0 && newData.val() <= (data.exists() ? data.val() : 0) + 20',
        },
      },
    },
    // Box de test offertes par un admin ou le fondateur
    lootGrants: {
      $uid: {
        '.read': `${ME} && (${OWNER('$uid')} || ${ADMIN})`,
        $g: { '.write': `${ME} && ${ADMIN} && !data.exists()`, '.validate': 'newData.val() === true' },
      },
    },
    // Mode classé : Elo de chaque joueur par catégorie, lisible par tous les membres (classement)
    ratings: {
      $cat: {
        '.read': ME,
        '.indexOn': ['r'],
        $uid: {
          '.write': `${ME} && $cat.matches(/^(bullet|blitz|rapide)$/)`,
          '.validate': RATING_OK,
          floor: { '.validate': 'newData.isNumber() && newData.val() >= 0 && newData.val() <= 7' },
          shield: { '.validate': 'newData.isNumber() && newData.val() >= 0 && newData.val() <= 3' },
        },
      },
    },
    // Historique classé (derniers résultats, courbe d'Elo du profil) : lisible par les membres, jamais réécrit
    ratingLog: {
      $cat: {
        $uid: {
          '.read': ME,
          $g: {
            '.write': `${ME} && !data.exists() && $cat.matches(/^(bullet|blitz|rapide)$/)`,
            '.validate': LOG_OK,
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
