// Partie entre amis via Firebase (remplace l'ancien serveur).
// Expose un petit objet qui imite l'ancienne connexion temps réel : on(événement), emit(action).
//   événements : 'state' (état de la partie), 'chat', 'swap' (revanche, couleurs inversées), 'disconnect'
//   actions    : 'join', 'move', 'resign', 'offerDraw', 'declineDraw', 'rematch', 'chat'
// La base n'accepte un coup que du joueur dont c'est le tour (règles Firebase) ;
// chaque navigateur vérifie aussi que le coup est légal avant de l'afficher.
import { db, ref, get, set, update, push, onValue, onChildAdded, onDisconnect, runTransaction, serverTimestamp, serverNow } from './fb.js';
import { Chess, localGameOver } from './common.js';
import { markPlaying } from './compte.js';

const other = (c) => (c === 'w' ? 'b' : 'w');

/** Reconstruit la partie à partir des coups enregistrés (« e2e4 », « e7e8q »…). */
function rebuild(g) {
  const chess = new Chess();
  const list = g?.moves ? Object.keys(g.moves).sort((a, b) => a - b).map((k) => g.moves[k]) : [];
  const verbose = [];
  for (const uci of list) {
    try {
      const m = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      verbose.push({ from: m.from, to: m.to, san: m.san, promotion: m.promotion });
    } catch {
      break; // coup illégal (triche) : on s'arrête au dernier coup valable
    }
  }
  return { chess, verbose, count: list.length };
}

export function gameSocket(gameId, user) {
  const handlers = {};
  const fire = (ev, data) => (handlers[ev] || []).forEach((h) => h(data));
  const gRef = ref(db, `games/${gameId}`);
  let g = null;
  let color = null;
  let round = null;
  let savedRound = null;
  let wasConnected = true;

  const sock = {
    connected: true,
    on(ev, h) {
      (handlers[ev] ||= []).push(h);
    },
    emit(ev, payload, ack) {
      actions[ev]?.(payload, ack);
    },
  };

  function seatOf(game) {
    if (!user || !game) return null;
    return game.white === user.id ? 'w' : game.black === user.id ? 'b' : null;
  }

  function clockState(game, chess, count) {
    const running = !!(game.time.base && game.status === 'playing' && count >= 2 && game.clock?.at);
    const c = { w: game.clock?.w ?? game.time.base, b: game.clock?.b ?? game.time.base };
    if (running) {
      const t = chess.turn();
      c[t] = Math.max(0, c[t] - (serverNow() - game.clock.at));
    }
    return { clock: c, running };
  }

  function publicState(game) {
    const { chess, verbose, count } = rebuild(game);
    const { clock, running } = clockState(game, chess, count);
    const on = game.online || {};
    return {
      id: gameId,
      round: game.round,
      fen: chess.fen(),
      moves: verbose,
      turn: chess.turn(),
      names: game.names,
      online: { w: !!on[game.white], b: !!on[game.black] },
      seated: { w: true, b: true },
      status: game.status,
      result: game.result || null,
      reason: game.reason || '',
      drawOffer: game.drawOffer || null,
      rematch: game.rematch || { w: false, b: false },
      time: game.time,
      clock,
      clockRunning: running,
    };
  }

  /** Fin de partie : chaque joueur range la partie dans son propre historique. */
  function saveHistory(game) {
    if (!color || savedRound === game.round) return;
    const { verbose } = rebuild(game);
    if (!verbose.length) return;
    savedRound = game.round;
    set(ref(db, `history/${user.id}/${gameId}-${game.round}`), {
      white: game.names.w,
      black: game.names.b,
      me: color,
      result: game.result,
      reason: game.reason || '',
      moves: verbose.map((m) => m.san).join(' '),
      base: game.time.base,
      inc: game.time.inc,
      date: serverTimestamp(),
    }).catch(() => {});
  }

  // Temps écoulé : n'importe lequel des deux navigateurs peut le constater
  setInterval(() => {
    if (!g || g.status !== 'playing' || !color) return;
    const { chess, count } = rebuild(g);
    const { clock, running } = clockState(g, chess, count);
    const t = chess.turn();
    if (!running || clock[t] > 0) return;
    const opp = other(t);
    const hasMaterial = chess.board().flat().some((p) => p && p.color === opp && p.type !== 'k');
    update(gRef, {
      status: 'over',
      result: hasMaterial ? (opp === 'w' ? '1-0' : '0-1') : '1/2-1/2',
      reason: hasMaterial ? 'temps' : 'temps-materiel',
      [`clock/${t}`]: 0,
    }).catch(() => {});
  }, 500);

  const actions = {
    async join(_, ack) {
      const snap = await get(gRef).catch(() => null);
      if (!snap || !snap.exists()) return ack({ error: 'introuvable' });
      g = snap.val();
      color = seatOf(g);
      round = g.round;
      if (color) {
        // Présence dans la partie (effacée automatiquement si on ferme la page)
        const p = push(ref(db, `games/${gameId}/online/${user.id}`));
        onDisconnect(p).remove();
        set(p, true);
        markPlaying(gameId);
      }
      ack({ color, chat: [], round: g.round });

      onValue(gRef, (s) => {
        const game = s.val();
        if (!game) return;
        if (round !== null && game.round !== round) {
          // Revanche : les couleurs sont inversées
          color = seatOf(game);
          fire('swap');
        }
        round = game.round;
        g = game;
        if (game.status === 'over') saveHistory(game);
        fire('state', publicState(game));
      });
      onChildAdded(ref(db, `games/${gameId}/chat`), (s) => fire('chat', s.val()));
      onValue(ref(db, '.info/connected'), (s) => {
        const ok = !!s.val();
        sock.connected = ok;
        if (!ok && wasConnected) fire('disconnect');
        if (ok && !wasConnected && g) fire('state', publicState(g));
        wasConnected = ok;
      });
    },

    move({ from, to, promotion } = {}) {
      if (!g || !color || g.status !== 'playing') return;
      const { chess, count } = rebuild(g);
      if (chess.turn() !== color) return;
      let m;
      try {
        m = chess.move({ from, to, promotion: promotion || 'q' });
      } catch {
        return fire('state', publicState(g)); // coup refusé : on remet l'échiquier comme avant
      }
      const updates = { [`moves/${count}`]: m.from + m.to + (m.promotion || '') };
      if (g.time.base) {
        // La pendule démarre quand chaque camp a joué son premier coup ; l'incrément s'ajoute après chaque coup
        if (count >= 2 && g.clock?.at) updates[`clock/${color}`] = Math.max(0, g.clock[color] - (serverNow() - g.clock.at)) + g.time.inc;
        updates['clock/at'] = count + 1 >= 2 ? serverTimestamp() : 0;
      }
      if (g.drawOffer && g.drawOffer !== color) updates.drawOffer = null; // jouer un coup refuse la nulle
      const end = localGameOver(chess);
      if (end) Object.assign(updates, { status: 'over', result: end.result, reason: end.reason });
      update(gRef, updates).catch(() => fire('state', publicState(g)));
    },

    resign() {
      if (!g || !color || g.status !== 'playing') return;
      update(gRef, { status: 'over', result: color === 'w' ? '0-1' : '1-0', reason: 'abandon' });
    },

    offerDraw() {
      if (!g || !color || g.status !== 'playing') return;
      if (g.drawOffer === other(color)) update(gRef, { status: 'over', result: '1/2-1/2', reason: 'accord', drawOffer: null });
      else update(gRef, { drawOffer: color });
    },

    declineDraw() {
      if (!g || !color || g.drawOffer !== other(color)) return;
      update(gRef, { drawOffer: null });
    },

    async rematch() {
      if (!g || !color || g.status !== 'over') return;
      const res = await runTransaction(ref(db, `games/${gameId}/rematch`), (cur) => {
        cur = cur || { w: false, b: false };
        cur[color] = true;
        return cur;
      });
      const r = res.snapshot.val() || {};
      if (!(r.w && r.b)) return;
      // Les deux veulent la revanche : nouvelle partie, couleurs inversées
      update(gRef, {
        white: g.black,
        black: g.white,
        names: { w: g.names.b, b: g.names.w },
        round: g.round + 1,
        moves: null,
        clock: { w: g.time.base, b: g.time.base, at: 0 },
        status: 'playing',
        result: null,
        reason: null,
        drawOffer: null,
        rematch: { w: false, b: false },
      });
    },

    chat(text) {
      if (!g || !color) return;
      const msg = String(text || '').replace(/[<>]/g, '').trim().slice(0, 300);
      if (!msg) return;
      push(ref(db, `games/${gameId}/chat`), { from: g.names[color], color, text: msg, at: serverTimestamp() });
    },
  };

  return sock;
}
