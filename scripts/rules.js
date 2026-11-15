// Génère database.rules.json (les règles de sécurité de la base Firebase).
// Écrites ici en JavaScript pour pouvoir réutiliser les conditions « est admin » et « n'est pas banni ».
// Utilisation : node scripts/rules.js  puis recopier le fichier dans la console Firebase → Realtime Database → Règles.
const fs = require('fs');
const path = require('path');

const ME = 'auth != null';
const ADMIN = "root.child('roles/' + auth.uid).val() === 'admin'";
const BAN = "root.child('bans/' + auth.uid)";
// Pas banni : aucun bannissement, ou un bannissement temporaire déjà terminé (until = 0 → définitif)
const OK = `(!${BAN}.exists() || (${BAN}.child('until').val() > 0 && ${BAN}.child('until').val() < now))`;
const OWNER = (v) => `auth.uid === ${v}`;
// Profil visible : le sien, celui de quelqu'un qui n'est pas en privé, celui d'un ami, ou tout profil pour un admin
const VISIBLE = (v) => `(auth.uid === ${v} || ${ADMIN} || root.child('users/' + ${v} + '/private').val() !== true || root.child('friends/' + ${v} + '/' + auth.uid).exists())`;

const rules = {
  rules: {
    users: {
      '.read': `${ME} && ${ADMIN}`,
      $uid: {
        '.read': ME,
        '.write': `${ME} && ${OWNER('$uid')} && ${OK}`,
        '.validate': "newData.hasChildren(['username']) && newData.child('username').val().matches(/^[A-Za-z0-9_-]{3,20}$/) && (!newData.child('private').exists() || newData.child('private').isBoolean())",
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
        '.write': `${ME} && !data.exists() && newData.val() === auth.uid && $name.matches(/^[a-z0-9_-]{3,20}$/)`,
      },
    },
    roles: {
      '.read': ME,
      $uid: {
        // Seul un admin nomme ou retire un admin, et jamais lui-même (pour ne pas se retirer ses droits par erreur)
        '.write': `${ME} && ${ADMIN} && $uid !== auth.uid`,
        '.validate': "newData.val() === 'admin'",
      },
    },
    bans: {
      '.read': `${ME} && ${ADMIN}`,
      $uid: {
        '.read': `${ME} && (${OWNER('$uid')} || ${ADMIN})`,
        '.write': `${ME} && ${ADMIN} && $uid !== auth.uid && root.child('roles/' + $uid).val() !== 'admin'`,
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
    games: {
      $g: {
        '.read': ME,
        '.write': `${ME} && ${OK} && ((!data.exists() && (newData.child('white').val() === auth.uid || newData.child('black').val() === auth.uid)) || (data.exists() && (data.child('white').val() === auth.uid || data.child('black').val() === auth.uid)))`,
        '.validate': "newData.hasChildren(['white', 'black', 'names', 'time', 'status', 'round'])",
        moves: {
          $n: {
            '.validate': "newData.isString() && newData.val().matches(/^[a-h][1-8][a-h][1-8][qrbn]?$/) && !data.exists() && ($n.matches(/[02468]$/) ? root.child('games/' + $g + '/white').val() === auth.uid : root.child('games/' + $g + '/black').val() === auth.uid)",
          },
        },
        chat: {
          $m: {
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
        '.write': `${ME} && auth.uid === $uid`,
      },
    },
  },
};

const out = path.join(__dirname, '..', 'database.rules.json');
fs.writeFileSync(out, JSON.stringify(rules, null, 2) + '\n');
console.log('Règles écrites dans database.rules.json (' + fs.statSync(out).size + ' octets)');
