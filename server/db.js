// Base de données SQLite (module intégré à Node.js, aucun paquet à installer).
// Le fichier est créé dans data/roque.db au premier lancement.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, 'roque.db'));

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    username    TEXT NOT NULL UNIQUE COLLATE NOCASE,
    pass_hash   TEXT NOT NULL,
    pass_salt   TEXT NOT NULL,
    created_at  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token       TEXT PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  INTEGER NOT NULL,
    last_seen   INTEGER NOT NULL
  );

  -- Une ligne par lien d'amitié : en attente (demande envoyée) ou acceptée
  CREATE TABLE IF NOT EXISTS friendships (
    requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status       TEXT NOT NULL CHECK (status IN ('pending', 'accepted')),
    created_at   INTEGER NOT NULL,
    PRIMARY KEY (requester_id, addressee_id)
  );

  CREATE TABLE IF NOT EXISTS games (
    id          TEXT PRIMARY KEY,
    white_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    black_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    white_name  TEXT NOT NULL,
    black_name  TEXT NOT NULL,
    result      TEXT NOT NULL,
    reason      TEXT NOT NULL,
    moves       TEXT NOT NULL,      -- coups en notation SAN, séparés par des espaces
    time_base   INTEGER NOT NULL,
    time_inc    INTEGER NOT NULL,
    ended_at    INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS games_white ON games(white_id, ended_at);
  CREATE INDEX IF NOT EXISTS games_black ON games(black_id, ended_at);
`);

// --- Mots de passe : scrypt + sel aléatoire ------------------------------------
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

function checkPassword(password, user) {
  const { hash } = hashPassword(password, user.pass_salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.pass_hash, 'hex'));
}

// --- Utilisateurs ----------------------------------------------------------------
const q = {
  userByName: db.prepare('SELECT * FROM users WHERE username = ?'),
  userById: db.prepare('SELECT id, username, created_at FROM users WHERE id = ?'),
  insertUser: db.prepare('INSERT INTO users (username, pass_hash, pass_salt, created_at) VALUES (?, ?, ?, ?)'),

  insertSession: db.prepare('INSERT INTO sessions (token, user_id, created_at, last_seen) VALUES (?, ?, ?, ?)'),
  sessionUser: db.prepare(`SELECT u.id, u.username FROM sessions s JOIN users u ON u.id = s.user_id
                           WHERE s.token = ? AND s.last_seen > ?`),
  touchSession: db.prepare('UPDATE sessions SET last_seen = ? WHERE token = ?'),
  deleteSession: db.prepare('DELETE FROM sessions WHERE token = ?'),
  purgeSessions: db.prepare('DELETE FROM sessions WHERE last_seen < ?'),

  friendship: db.prepare(`SELECT * FROM friendships
                          WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)`),
  insertFriendship: db.prepare('INSERT INTO friendships (requester_id, addressee_id, status, created_at) VALUES (?, ?, ?, ?)'),
  acceptFriendship: db.prepare(`UPDATE friendships SET status = 'accepted' WHERE requester_id = ? AND addressee_id = ? AND status = 'pending'`),
  deleteFriendship: db.prepare(`DELETE FROM friendships
                                WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)`),
  friendsOf: db.prepare(`SELECT u.id, u.username FROM friendships f
                         JOIN users u ON u.id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END
                         WHERE (f.requester_id = ? OR f.addressee_id = ?) AND f.status = 'accepted'
                         ORDER BY u.username COLLATE NOCASE`),
  incoming: db.prepare(`SELECT u.id, u.username FROM friendships f JOIN users u ON u.id = f.requester_id
                        WHERE f.addressee_id = ? AND f.status = 'pending' ORDER BY f.created_at DESC`),
  outgoing: db.prepare(`SELECT u.id, u.username FROM friendships f JOIN users u ON u.id = f.addressee_id
                        WHERE f.requester_id = ? AND f.status = 'pending' ORDER BY f.created_at DESC`),

  insertGame: db.prepare(`INSERT OR REPLACE INTO games
    (id, white_id, black_id, white_name, black_name, result, reason, moves, time_base, time_inc, ended_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  gamesOf: db.prepare(`SELECT * FROM games WHERE white_id = ? OR black_id = ? ORDER BY ended_at DESC LIMIT ?`),
  gameById: db.prepare('SELECT * FROM games WHERE id = ?'),
  statsOf: db.prepare(`SELECT
      SUM(CASE WHEN (white_id = ?1 AND result = '1-0') OR (black_id = ?1 AND result = '0-1') THEN 1 ELSE 0 END) AS wins,
      SUM(CASE WHEN (white_id = ?1 AND result = '0-1') OR (black_id = ?1 AND result = '1-0') THEN 1 ELSE 0 END) AS losses,
      SUM(CASE WHEN result = '1/2-1/2' THEN 1 ELSE 0 END) AS draws
    FROM games WHERE white_id = ?1 OR black_id = ?1`),
};

const SESSION_DAYS = 30;
const sessionLimit = () => Date.now() - SESSION_DAYS * 24 * 3600 * 1000;

module.exports = {
  createUser(username, password) {
    const { hash, salt } = hashPassword(password);
    const r = q.insertUser.run(username, hash, salt, Date.now());
    return { id: Number(r.lastInsertRowid), username };
  },
  verifyUser(username, password) {
    const u = q.userByName.get(username);
    if (!u || !checkPassword(password, u)) return null;
    return { id: u.id, username: u.username };
  },
  userByName: (name) => {
    const u = q.userByName.get(name);
    return u ? { id: u.id, username: u.username } : null;
  },
  userById: (id) => q.userById.get(id) || null,

  createSession(userId) {
    const token = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    q.insertSession.run(token, userId, now, now);
    return token;
  },
  sessionUser(token) {
    if (!token) return null;
    const u = q.sessionUser.get(token, sessionLimit());
    if (u) q.touchSession.run(Date.now(), token);
    return u || null;
  },
  deleteSession: (token) => q.deleteSession.run(token),
  purgeSessions: () => q.purgeSessions.run(sessionLimit()),

  friendship: (a, b) => q.friendship.get(a, b, b, a) || null,
  requestFriend: (from, to) => q.insertFriendship.run(from, to, 'pending', Date.now()),
  acceptFriend: (requester, me) => q.acceptFriendship.run(requester, me).changes > 0,
  removeFriendship: (a, b) => q.deleteFriendship.run(a, b, b, a).changes > 0,
  areFriends(a, b) {
    const f = q.friendship.get(a, b, b, a);
    return !!f && f.status === 'accepted';
  },
  friendsOf: (id) => q.friendsOf.all(id, id, id),
  incoming: (id) => q.incoming.all(id),
  outgoing: (id) => q.outgoing.all(id),

  saveGame(g) {
    q.insertGame.run(g.id, g.whiteId, g.blackId, g.whiteName, g.blackName, g.result, g.reason, g.moves, g.timeBase, g.timeInc, Date.now());
  },
  gamesOf: (id, limit = 20) => q.gamesOf.all(id, id, limit),
  gameById: (id) => q.gameById.get(id) || null,
  statsOf(id) {
    const s = q.statsOf.get(id);
    return { wins: s.wins || 0, losses: s.losses || 0, draws: s.draws || 0 };
  },
};
