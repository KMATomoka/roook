// Serveur du site d'échecs Roque :
// - pages du site et fichiers des bibliothèques
// - comptes (inscription, connexion) et amis, stockés dans une base SQLite (server/db.js)
// - invitations à jouer et parties en temps réel (Socket.io)
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const { Server } = require('socket.io');
const { Chess } = require('chess.js');
const db = require('./server/db');

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.set('trust proxy', 1); // derrière un hébergeur (Render, Railway…) pour savoir si on est en HTTPS
app.use(express.json({ limit: '20kb' }));

// --- Fichiers statiques -----------------------------------------------------
const nm = (p) => path.join(__dirname, 'node_modules', p);
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.use('/vendor/chess.js', express.static(nm('chess.js/dist/esm')));
app.use('/vendor/chessground', express.static(nm('@lichess-org/chessground/dist')));
app.use('/vendor/chessground-assets', express.static(nm('@lichess-org/chessground/assets')));
app.use('/vendor/stockfish', express.static(nm('stockfish/bin')));
app.get('/partie/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'jeu.html')));

// ============================================================================
// Comptes
// ============================================================================
const COOKIE = 'roque_session';
const USERNAME_RE = /^[A-Za-z0-9_-]{3,20}$/;

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
const userFromCookie = (header) => db.sessionUser(parseCookies(header)[COOKIE]);

function setSession(req, res, userId) {
  const token = db.createSession(userId);
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge: 30 * 24 * 3600 * 1000, path: '/' });
}

function auth(req, res, next) {
  req.user = userFromCookie(req.headers.cookie);
  if (!req.user) return res.status(401).json({ error: 'Tu dois être connecté.' });
  next();
}

// Limite simple contre les essais de mot de passe à répétition : 20 tentatives / 10 min par adresse
const attempts = new Map();
function rateLimit(req, res, next) {
  const key = req.ip;
  const now = Date.now();
  const a = attempts.get(key) || { n: 0, reset: now + 10 * 60 * 1000 };
  if (now > a.reset) Object.assign(a, { n: 0, reset: now + 10 * 60 * 1000 });
  a.n++;
  attempts.set(key, a);
  if (a.n > 20) return res.status(429).json({ error: 'Trop de tentatives. Réessaie dans quelques minutes.' });
  next();
}

app.post('/api/inscription', rateLimit, (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  if (!USERNAME_RE.test(username)) return res.status(400).json({ error: 'Pseudo : 3 à 20 caractères, lettres, chiffres, « _ » ou « - ».' });
  if (password.length < 6 || password.length > 100) return res.status(400).json({ error: 'Le mot de passe doit faire au moins 6 caractères.' });
  if (db.userByName(username)) return res.status(409).json({ error: 'Ce pseudo est déjà pris.' });
  const user = db.createUser(username, password);
  setSession(req, res, user.id);
  res.json({ user });
});

app.post('/api/connexion', rateLimit, (req, res) => {
  const user = db.verifyUser(String(req.body?.username || '').trim(), String(req.body?.password || ''));
  if (!user) return res.status(401).json({ error: 'Pseudo ou mot de passe incorrect.' });
  setSession(req, res, user.id);
  res.json({ user });
});

app.post('/api/deconnexion', (req, res) => {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (token) db.deleteSession(token);
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true });
});

app.get('/api/moi', (req, res) => {
  const user = userFromCookie(req.headers.cookie);
  res.json({ user: user || null, stats: user ? db.statsOf(user.id) : null });
});

// ============================================================================
// Amis
// ============================================================================
const online = new Map(); // userId -> nombre de connexions ouvertes
const playing = new Map(); // userId -> id de la partie en cours
const isOnline = (id) => (online.get(id) || 0) > 0;
// « En partie » seulement si le joueur est vraiment sur la page d'une partie en cours
function isPlaying(userId) {
  const g = games.get(playing.get(userId));
  if (!g || g.status !== 'playing') return false;
  const c = g.seats.w === userId ? 'w' : 'b';
  return g.online[c] > 0;
}

const friendView = (f) => ({ id: f.id, username: f.username, online: isOnline(f.id), playing: isPlaying(f.id) });
const notifyFriends = (userId, event, payload) => {
  for (const f of db.friendsOf(userId)) io.to('user:' + f.id).emit(event, payload);
};
const refreshFriends = (...ids) => ids.forEach((id) => io.to('user:' + id).emit('amis:maj'));
const presence = (userId) => notifyFriends(userId, 'presence', { id: userId, online: isOnline(userId), playing: isPlaying(userId) });

app.get('/api/amis', auth, (req, res) => {
  const me = req.user.id;
  res.json({
    friends: db.friendsOf(me).map(friendView),
    incoming: db.incoming(me),
    outgoing: db.outgoing(me),
  });
});

app.post('/api/amis', auth, (req, res) => {
  const me = req.user;
  const target = db.userByName(String(req.body?.username || '').trim());
  if (!target) return res.status(404).json({ error: 'Aucun joueur avec ce pseudo.' });
  if (target.id === me.id) return res.status(400).json({ error: 'Tu ne peux pas t’ajouter toi-même 🙂' });
  const f = db.friendship(me.id, target.id);
  if (f?.status === 'accepted') return res.status(409).json({ error: `${target.username} est déjà ton ami.` });
  if (f && f.requester_id === me.id) return res.status(409).json({ error: 'Demande déjà envoyée.' });
  if (f) {
    // Il m'avait déjà envoyé une demande : on accepte directement
    db.acceptFriend(target.id, me.id);
    refreshFriends(me.id, target.id);
    return res.json({ ok: true, accepted: true, message: `Toi et ${target.username} êtes maintenant amis !` });
  }
  db.requestFriend(me.id, target.id);
  refreshFriends(me.id, target.id);
  io.to('user:' + target.id).emit('amis:demande', { from: me.username });
  res.json({ ok: true, message: `Demande envoyée à ${target.username}.` });
});

app.post('/api/amis/:id/accepter', auth, (req, res) => {
  const other = Number(req.params.id);
  if (!db.acceptFriend(other, req.user.id)) return res.status(404).json({ error: 'Demande introuvable.' });
  refreshFriends(req.user.id, other);
  res.json({ ok: true });
});

app.post('/api/amis/:id/refuser', auth, (req, res) => {
  const other = Number(req.params.id);
  db.removeFriendship(other, req.user.id);
  refreshFriends(req.user.id, other);
  res.json({ ok: true });
});

app.delete('/api/amis/:id', auth, (req, res) => {
  const other = Number(req.params.id);
  db.removeFriendship(other, req.user.id);
  refreshFriends(req.user.id, other);
  res.json({ ok: true });
});

// ============================================================================
// Historique des parties
// ============================================================================
function gameView(row, me) {
  const color = row.white_id === me ? 'w' : row.black_id === me ? 'b' : null;
  return {
    id: row.id,
    white: row.white_name,
    black: row.black_name,
    me: color,
    result: row.result,
    reason: row.reason,
    moves: row.moves ? row.moves.split(' ') : [],
    date: row.ended_at,
    cadence: { base: row.time_base, inc: row.time_inc },
  };
}

app.get('/api/parties', auth, (req, res) => {
  res.json({ games: db.gamesOf(req.user.id, 30).map((r) => gameView(r, req.user.id)) });
});

app.get('/api/parties/:id', auth, (req, res) => {
  const row = db.gameById(req.params.id);
  if (!row || (row.white_id !== req.user.id && row.black_id !== req.user.id)) return res.status(404).json({ error: 'Partie introuvable.' });
  res.json({ game: gameView(row, req.user.id) });
});

// ============================================================================
// Parties en temps réel
// ============================================================================
/** @type {Map<string, any>} */
const games = new Map();
const newId = () => crypto.randomBytes(5).toString('base64url').replace(/[-_]/g, 'x').slice(0, 7);
const other = (c) => (c === 'w' ? 'b' : 'w');
const clean = (s, max = 300) => String(s || '').replace(/[<>]/g, '').trim().slice(0, max);

function parseCadence(txt) {
  const [m, i] = String(txt || '10+0').split(/[+ ]/).map(Number);
  return { base: Math.min(180, Math.max(1, m || 10)) * 60000, inc: Math.min(60, Math.max(0, i || 0)) * 1000 };
}

function createGame(white, black, time) {
  let id;
  do id = newId(); while (games.has(id));
  const g = {
    id,
    round: 1,
    chess: new Chess(),
    seats: { w: white.id, b: black.id }, // id des comptes
    names: { w: white.username, b: black.username },
    online: { w: 0, b: 0 },
    status: 'playing',
    result: null,
    reason: '',
    drawOffer: null,
    rematch: { w: false, b: false },
    time,
    clock: { w: time.base, b: time.base },
    turnStart: null,
    timer: null,
    chat: [],
    touched: Date.now(),
  };
  games.set(id, g);
  playing.set(white.id, id);
  playing.set(black.id, id);
  presence(white.id);
  presence(black.id);
  return g;
}

function liveClock(g) {
  const c = { ...g.clock };
  if (g.time.base && g.status === 'playing' && g.turnStart) {
    const t = g.chess.turn();
    c[t] = Math.max(0, c[t] - (Date.now() - g.turnStart));
  }
  return c;
}

function publicState(g) {
  return {
    id: g.id,
    round: g.round,
    fen: g.chess.fen(),
    moves: g.chess.history({ verbose: true }).map((m) => ({ from: m.from, to: m.to, san: m.san, promotion: m.promotion })),
    turn: g.chess.turn(),
    names: g.names,
    online: { w: g.online.w > 0, b: g.online.b > 0 },
    seated: { w: true, b: true },
    status: g.status,
    result: g.result,
    reason: g.reason,
    drawOffer: g.drawOffer,
    rematch: g.rematch,
    time: g.time,
    clock: liveClock(g),
    clockRunning: !!(g.time.base && g.status === 'playing' && g.chess.history().length >= 2),
  };
}

const broadcast = (g) => io.to('game:' + g.id).emit('state', publicState(g));

function endGame(g, result, reason) {
  if (g.time.base && g.turnStart) g.clock = liveClock(g);
  g.status = 'over';
  g.result = result;
  g.reason = reason;
  g.drawOffer = null;
  g.turnStart = null;
  clearTimeout(g.timer);
  // Enregistrement dans la base (pour l'historique et le bilan)
  if (g.chess.history().length > 0) {
    db.saveGame({
      id: `${g.id}-${g.round}`,
      whiteId: g.seats.w,
      blackId: g.seats.b,
      whiteName: g.names.w,
      blackName: g.names.b,
      result,
      reason,
      moves: g.chess.history().join(' '),
      timeBase: g.time.base,
      timeInc: g.time.inc,
    });
  }
  for (const c of ['w', 'b']) {
    if (playing.get(g.seats[c]) === g.id) playing.delete(g.seats[c]);
    presence(g.seats[c]);
  }
  broadcast(g);
}

// La pendule ne démarre qu'après le premier coup de chaque camp.
function armClock(g) {
  clearTimeout(g.timer);
  if (!g.time.base || g.status !== 'playing' || g.chess.history().length < 2) {
    g.turnStart = null;
    return;
  }
  g.turnStart = Date.now();
  const t = g.chess.turn();
  g.timer = setTimeout(() => {
    if (g.status !== 'playing' || g.chess.turn() !== t) return;
    g.clock[t] = 0;
    const opp = other(t);
    const hasMaterial = g.chess.board().flat().some((p) => p && p.color === opp && p.type !== 'k');
    endGame(g, hasMaterial ? (opp === 'w' ? '1-0' : '0-1') : '1/2-1/2', hasMaterial ? 'temps' : 'temps-materiel');
  }, g.clock[t] + 50);
}

function checkGameOver(g) {
  const c = g.chess;
  if (c.isCheckmate()) return endGame(g, c.turn() === 'w' ? '0-1' : '1-0', 'mat');
  if (c.isStalemate()) return endGame(g, '1/2-1/2', 'pat');
  if (c.isInsufficientMaterial()) return endGame(g, '1/2-1/2', 'materiel');
  if (c.isThreefoldRepetition()) return endGame(g, '1/2-1/2', 'repetition');
  if (c.isDraw()) return endGame(g, '1/2-1/2', '50coups');
  return false;
}

// ============================================================================
// Invitations
// ============================================================================
const invites = new Map(); // id -> invitation en attente
const INVITE_TTL = 60 * 1000;

function closeInvite(inv, reason) {
  clearTimeout(inv.timer);
  invites.delete(inv.id);
  io.to('user:' + inv.from.id).emit('invitation:fin', { id: inv.id, reason, by: inv.to.username });
  io.to('user:' + inv.to.id).emit('invitation:fin', { id: inv.id, reason, by: inv.from.username });
}

// ============================================================================
// Connexions temps réel
// ============================================================================
io.use((socket, next) => {
  socket.data.user = userFromCookie(socket.handshake.headers.cookie); // null si pas connecté (spectateur)
  next();
});

io.on('connection', (socket) => {
  const user = socket.data.user;
  let game = null;
  let color = null;

  if (user) {
    socket.join('user:' + user.id);
    online.set(user.id, (online.get(user.id) || 0) + 1);
    if (online.get(user.id) === 1) presence(user.id);
    // Invitations reçues pendant qu'on changeait de page
    for (const inv of invites.values()) {
      if (inv.to.id === user.id) socket.emit('invitation', publicInvite(inv));
    }
  }

  // --- Invitations ----------------------------------------------------------
  socket.on('invite', ({ friendId, color: wanted, cadence } = {}, ack = () => {}) => {
    if (!user) return ack({ error: 'Tu dois être connecté.' });
    const friend = db.userById(Number(friendId));
    if (!friend || !db.areFriends(user.id, friend.id)) return ack({ error: 'Ce joueur n’est pas dans tes amis.' });
    if (!isOnline(friend.id)) return ack({ error: `${friend.username} n’est pas connecté.` });
    if (isPlaying(friend.id)) return ack({ error: `${friend.username} est déjà en partie.` });
    for (const inv of invites.values()) {
      if (inv.from.id === user.id && inv.to.id === friend.id) return ack({ error: 'Invitation déjà envoyée, attends sa réponse.' });
    }
    const inv = {
      id: crypto.randomBytes(6).toString('hex'),
      from: { id: user.id, username: user.username },
      to: { id: friend.id, username: friend.username },
      color: wanted === 'w' || wanted === 'b' ? wanted : 'random',
      time: parseCadence(cadence),
      expires: Date.now() + INVITE_TTL,
    };
    inv.timer = setTimeout(() => invites.has(inv.id) && closeInvite(inv, 'expiree'), INVITE_TTL);
    invites.set(inv.id, inv);
    io.to('user:' + friend.id).emit('invitation', publicInvite(inv));
    ack({ ok: true, invite: publicInvite(inv) });
  });

  socket.on('invite:annuler', ({ id } = {}) => {
    const inv = invites.get(id);
    if (inv && user && inv.from.id === user.id) closeInvite(inv, 'annulee');
  });

  socket.on('invite:refuser', ({ id } = {}) => {
    const inv = invites.get(id);
    if (inv && user && inv.to.id === user.id) closeInvite(inv, 'refusee');
  });

  socket.on('invite:accepter', ({ id } = {}, ack = () => {}) => {
    const inv = invites.get(id);
    if (!inv || !user || inv.to.id !== user.id) return ack({ error: 'Cette invitation n’est plus valable.' });
    clearTimeout(inv.timer);
    invites.delete(inv.id);
    // Couleur choisie par celui qui invite
    let inviterColor = inv.color;
    if (inviterColor === 'random') inviterColor = Math.random() < 0.5 ? 'w' : 'b';
    const white = inviterColor === 'w' ? inv.from : inv.to;
    const black = inviterColor === 'w' ? inv.to : inv.from;
    const g = createGame(white, black, inv.time);
    io.to('user:' + inv.from.id).emit('partie:debut', { id: g.id });
    io.to('user:' + inv.to.id).emit('partie:debut', { id: g.id });
    ack({ ok: true, id: g.id });
  });

  // --- Partie -------------------------------------------------------------
  const seatOf = () => (game && user ? ['w', 'b'].find((c) => game.seats[c] === user.id) || null : null);
  const mine = () => {
    color = seatOf();
    return !!color;
  };

  socket.on('join', ({ id } = {}, ack = () => {}) => {
    const g = games.get(String(id || ''));
    if (!g) return ack({ error: 'introuvable' });
    g.touched = Date.now();
    game = g;
    color = seatOf();
    socket.join('game:' + g.id);
    if (color) {
      g.online[color]++;
      presence(user.id);
    }
    ack({ color, chat: g.chat, round: g.round, me: user ? user.username : null });
    broadcast(g);
  });

  socket.on('move', ({ from, to, promotion } = {}) => {
    const g = game;
    if (!mine() || g.status !== 'playing' || g.chess.turn() !== color) return;
    let move;
    try {
      move = g.chess.move({ from, to, promotion: promotion || 'q' });
    } catch {
      return broadcast(g); // coup illégal : on renvoie l'état réel
    }
    if (!move) return broadcast(g);
    g.touched = Date.now();
    if (g.time.base && g.turnStart) {
      g.clock[color] = Math.max(0, g.clock[color] - (Date.now() - g.turnStart)) + g.time.inc;
    }
    if (g.drawOffer && g.drawOffer !== color) g.drawOffer = null; // jouer un coup refuse la nulle
    if (checkGameOver(g) === false) {
      armClock(g);
      broadcast(g);
    }
  });

  socket.on('resign', () => {
    if (!mine() || game.status !== 'playing') return;
    endGame(game, color === 'w' ? '0-1' : '1-0', 'abandon');
  });

  socket.on('offerDraw', () => {
    if (!mine() || game.status !== 'playing') return;
    if (game.drawOffer === other(color)) return endGame(game, '1/2-1/2', 'accord');
    game.drawOffer = color;
    broadcast(game);
  });

  socket.on('declineDraw', () => {
    if (!mine() || game.drawOffer !== other(color)) return;
    game.drawOffer = null;
    broadcast(game);
  });

  socket.on('rematch', () => {
    const g = game;
    if (!mine() || g.status !== 'over') return;
    g.rematch[color] = true;
    if (g.rematch.w && g.rematch.b) {
      // Nouvelle partie, couleurs inversées
      [g.seats.w, g.seats.b] = [g.seats.b, g.seats.w];
      [g.names.w, g.names.b] = [g.names.b, g.names.w];
      [g.online.w, g.online.b] = [g.online.b, g.online.w];
      g.round++;
      g.chess = new Chess();
      g.status = 'playing';
      g.result = null;
      g.reason = '';
      g.drawOffer = null;
      g.rematch = { w: false, b: false };
      g.clock = { w: g.time.base, b: g.time.base };
      g.turnStart = null;
      for (const c of ['w', 'b']) {
        playing.set(g.seats[c], g.id);
        presence(g.seats[c]);
      }
      io.to('game:' + g.id).emit('swap');
    }
    broadcast(g);
  });

  socket.on('chat', (text) => {
    if (!game) return;
    mine();
    const msg = clean(text);
    if (!msg) return;
    const entry = { from: color ? game.names[color] : user ? user.username : 'Spectateur', color, text: msg, at: Date.now() };
    game.chat.push(entry);
    if (game.chat.length > 100) game.chat.shift();
    io.to('game:' + game.id).emit('chat', entry);
  });

  socket.on('disconnect', () => {
    if (mine()) {
      game.online[color] = Math.max(0, game.online[color] - 1);
      broadcast(game);
      presence(user.id);
    }
    if (user) {
      online.set(user.id, Math.max(0, (online.get(user.id) || 1) - 1));
      if (!isOnline(user.id)) {
        // Quelques secondes de grâce (changement de page) avant d'annoncer la déconnexion
        setTimeout(() => {
          if (isOnline(user.id)) return;
          presence(user.id);
          for (const inv of invites.values()) {
            if (inv.from.id === user.id || inv.to.id === user.id) closeInvite(inv, 'deconnecte');
          }
        }, 8000);
      }
    }
  });
});

function publicInvite(inv) {
  return { id: inv.id, from: inv.from, to: inv.to, color: inv.color, time: inv.time, expires: inv.expires };
}

// Nettoyage : parties inactives depuis plus de 12 h, vieilles sessions
setInterval(() => {
  const limit = Date.now() - 12 * 3600 * 1000;
  for (const [id, g] of games) {
    if (g.touched < limit && g.online.w + g.online.b === 0) {
      clearTimeout(g.timer);
      for (const c of ['w', 'b']) if (playing.get(g.seats[c]) === id) playing.delete(g.seats[c]);
      games.delete(id);
    }
  }
  db.purgeSessions();
}, 30 * 60 * 1000);

server.listen(PORT, () => {
  console.log(`Site d'échecs lancé : http://localhost:${PORT}`);
});
