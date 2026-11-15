// Partie entre amis via Firebase (remplace l'ancien serveur).
// Expose un petit objet qui imite l'ancienne connexion temps réel : on(événement), emit(action).
//   événements : 'state' (état de la partie), 'chat', 'swap' (revanche, couleurs inversées), 'disconnect'
//   actions    : 'join', 'move', 'resign', 'offerDraw', 'declineDraw', 'rematch', 'chat'
// Les règles de la base servent d'arbitre (voir scripts/rules.js) : un coup seulement à son tour,
// pendule vérifiée avec l'heure de Firebase, et personne ne peut se déclarer gagnant tout seul
// (le mat est confirmé par le joueur maté, l'abandon écrit par celui qui abandonne, etc.).
// Chaque navigateur vérifie aussi que les coups sont légaux.
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
  return { chess, verbose, count: list.length, illegal: verbose.length < list.length };
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
      const t = (game.ply || 0) % 2 === 0 ? 'w' : 'b'; // camp au trait selon la base (comme l'arbitre)
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
      ids: { w: game.white, b: game.black },
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

  /** Fin de partie : chaque joueur range la partie dans son propre historique (vérifié par les règles). */
  function saveHistory(game) {
    if (!color || savedRound === game.round || game.result === '*') return;
    const { verbose } = rebuild(game);
    if (!verbose.length) return;
    savedRound = game.round;
    set(ref(db, `history/${user.id}/${gameId}-${game.round}`), {
      white: game.names.w,
      black: game.names.b,
      me: color,
      mode: 'ami',
      game: gameId,
      round: game.round,
      ply: game.ply || 0,
      opp: color === 'w' ? game.black : game.white,
      result: game.result,
      reason: game.reason || '',
      moves: verbose.map((m) => m.san).join(' '),
      base: game.time.base,
      inc: game.time.inc,
      date: serverTimestamp(),
    }).catch(() => {});
  }

  // Temps écoulé : n'importe lequel des deux navigateurs peut le constater (l'arbitre vérifie avec son heure)
  setInterval(() => {
    if (!g || g.status !== 'playing' || !color) return;
    const { chess, count } = rebuild(g);
    const { clock, running } = clockState(g, chess, count);
    const t = (g.ply || 0) % 2 === 0 ? 'w' : 'b';
    if (!running || clock[t] > 0) return;
    const opp = other(t);
    // Le camp qui n'est pas tombé gagne, sauf s'il n'a plus de quoi mater (nulle) ; celui qui est tombé ne peut écrire que sa défaite
    const hasMaterial = t === color || chess.board().flat().some((p) => p && p.color === opp && p.type !== 'k');
    update(gRef, {
      status: 'over',
      result: hasMaterial ? (opp === 'w' ? '1-0' : '0-1') : '1/2-1/2',
      reason: hasMaterial ? 'temps' : 'temps-materiel',
    }).catch(() => {});
  }, 1000);

  /**
   * Fins de partie constatées sur l'échiquier. Pour qu'on ne puisse pas tricher :
   *  - échec et mat : c'est le joueur maté qui l'écrit (son navigateur le fait tout seul) ;
   *  - pat, répétition, 50 coups, matériel insuffisant : chaque joueur le constate, la partie se termine quand les deux l'ont fait ;
   *  - coup illégal reçu (triche) : la partie est annulée.
   */
  function checkBoardEnd(game) {
    if (!color || game.status !== 'playing') return;
    const { chess, illegal } = rebuild(game);
    const toMove = (game.ply || 0) % 2 === 0 ? 'w' : 'b';
    if (illegal) {
      if (toMove === color) update(gRef, { status: 'over', result: '*', reason: 'annulee' }).catch(() => {});
      return;
    }
    const end = localGameOver(chess);
    if (!end) return;
    if (end.reason === 'mat') {
      if (toMove === color) update(gRef, { status: 'over', result: end.result, reason: 'mat' }).catch(() => {});
      return;
    }
    const mine = game.claims?.[color];
    const theirs = game.claims?.[other(color)];
    if (theirs === end.reason) update(gRef, { [`claims/${color}`]: end.reason, status: 'over', result: '1/2-1/2', reason: end.reason }).catch(() => {});
    else if (mine !== end.reason) update(gRef, { [`claims/${color}`]: end.reason }).catch(() => {});
  }

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
        else checkBoardEnd(game);
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
      const updates = { [`moves/${count}`]: m.from + m.to + (m.promotion || ''), ply: count + 1 };
      if (g.time.base) {
        // La pendule démarre quand chaque camp a joué son premier coup ; l'incrément s'ajoute après chaque coup
        if (count >= 2 && g.clock?.at) updates[`clock/${color}`] = Math.max(0, g.clock[color] - (serverNow() - g.clock.at)) + g.time.inc;
        updates['clock/at'] = count + 1 >= 2 ? serverTimestamp() : 0;
      }
      if (g.drawOffer && g.drawOffer !== color) updates.drawOffer = null; // jouer un coup refuse la nulle
      // La fin de partie éventuelle (mat, pat…) est constatée ensuite par checkBoardEnd, selon les règles de l'arbitre
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
        ply: 0,
        claims: null,
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
