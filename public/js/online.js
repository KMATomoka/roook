// Partie entre amis via Firebase (remplace l'ancien serveur).
// Expose un petit objet qui imite l'ancienne connexion temps réel : on(événement), emit(action).
//   événements : 'state' (état de la partie), 'chat', 'swap' (revanche, couleurs inversées), 'disconnect'
//   actions    : 'join', 'move', 'resign', 'offerDraw', 'declineDraw', 'rematch', 'chat'
// Les règles de la base servent d'arbitre (voir scripts/rules.js) : un coup seulement à son tour,
// pendule vérifiée avec l'heure de Firebase, et personne ne peut se déclarer gagnant tout seul
// (le mat est confirmé par le joueur maté, l'abandon écrit par celui qui abandonne, etc.).
// Chaque navigateur vérifie aussi que les coups sont légaux.
import { db, auth, ref, get, set, update, push, onValue, onChildAdded, onDisconnect, runTransaction, serverTimestamp, serverNow } from './fb.js';
import { firebaseConfig } from './firebase-config.js';

/** Délai avant qu'un joueur parti (page fermée sans prévenir) perde la partie. */
export const AWAY_LIMIT = 60000;
import { Chess, localGameOver } from './common.js';
import { markPlaying, unmarkPlaying } from './compte.js';

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
  let leaving = false; // le joueur a choisi de quitter (abandon déjà envoyé)
  let token = null; // jeton de connexion gardé sous la main pour abandonner pendant la fermeture de la page

  const sock = {
    connected: true,
    /** Partie en cours où je joue (quitter la page = défaite) ? */
    get live() {
      return !!(g && color && g.status === 'playing' && !leaving);
    },
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
      // Joueur parti (page fermée) : heure de son départ, tant qu'il n'est pas revenu
      away: {
        w: !on[game.white] && typeof game.left?.[game.white] === 'number' ? game.left[game.white] : null,
        b: !on[game.black] && typeof game.left?.[game.black] === 'number' ? game.left[game.black] : null,
      },
      seated: { w: true, b: true },
      random: !!game.mm, // partie « Adversaire au hasard »
      ranked: game.ranked === true, // partie classée (Elo relevé au début : elo.w, elo.b)
      cat: game.cat || null,
      elo: game.elo || null,
      pl: game.pl || null, // joueurs encore en placement (pas de rang)
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
    // Sans aucun coup, une victoire ne compte pas (sinon on gagnerait des coffres sans jouer) ; une nulle, si
    if (!verbose.length && game.result !== '1/2-1/2') return;
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

  // Adversaire parti (page fermée sans abandonner) depuis plus d'une minute : on gagne (l'arbitre vérifie l'heure)
  setInterval(() => {
    if (!g || g.status !== 'playing' || !color) return;
    const oppId = color === 'w' ? g.black : g.white;
    const left = g.left?.[oppId];
    // Adversaire au hasard qui n'est jamais venu (30 s après la création, avant le 2e coup) : partie annulée
    if (g.mm && (g.ply || 0) < 2 && !g.online?.[oppId] && typeof g.createdAt === 'number' && serverNow() - g.createdAt > 30000) {
      update(gRef, { status: 'over', result: '*', reason: 'absent' }).catch(() => {});
      return;
    }
    if (g.online?.[oppId] || typeof left !== 'number' || serverNow() - left < AWAY_LIMIT + 1500) return;
    update(gRef, { status: 'over', result: color === 'w' ? '1-0' : '0-1', reason: 'deconnexion' }).catch(() => {});
  }, 1000);

  /** Je suis dans la partie : présence (effacée par Firebase si la page se ferme) et heure de départ posée à ce moment-là. */
  function announce() {
    if (!color) return;
    const p = push(ref(db, `games/${gameId}/online/${user.id}`));
    onDisconnect(p).remove();
    set(p, true);
    const leftRef = ref(db, `games/${gameId}/left/${user.id}`);
    onDisconnect(leftRef).set(serverTimestamp());
    set(leftRef, null).catch(() => {});
  }

  // Quitter la page pendant la partie = abandon : avertissement, puis abandon envoyé pendant la fermeture
  const refreshToken = () => auth.currentUser?.getIdToken().then((t) => (token = t)).catch(() => {});
  setInterval(refreshToken, 20 * 60 * 1000);
  addEventListener('beforeunload', (e) => {
    if (!sock.live) return;
    e.preventDefault();
    e.returnValue = '';
  });
  addEventListener('pagehide', () => {
    if (!sock.live || !token) return;
    leaving = true;
    const body = JSON.stringify({ status: 'over', result: color === 'w' ? '0-1' : '1-0', reason: 'abandon' });
    try {
      fetch(`${firebaseConfig.databaseURL}/games/${gameId}.json?auth=${encodeURIComponent(token)}`, { method: 'PATCH', body, keepalive: true });
    } catch {}
  });

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
        announce();
        refreshToken();
        markPlaying(gameId);
      }
      ack({ color, chat: [], round: g.round, random: !!g.mm, ranked: g.ranked === true });

      let seen = 0; // numéro du dernier état reçu
      onValue(gRef, (s) => {
        const game = s.val();
        if (!game) return;
        const mine = ++seen;
        if (round !== null && game.round !== round) {
          // Revanche : les couleurs sont inversées
          color = seatOf(game);
          fire('swap');
        }
        round = game.round;
        g = game;
        // « En partie » pour les amis : seulement tant que la partie se joue (revanche comprise)
        if (color && game.status === 'playing') markPlaying(gameId);
        else if (game.status === 'over') unmarkPlaying();
        if (game.status === 'over') saveHistory(game);
        else checkBoardEnd(game);
        // checkBoardEnd peut écrire la fin de partie (mat constaté par le joueur maté) : Firebase relance alors ce
        // rappel tout de suite, avec l'état « terminé », avant d'avoir fini celui-ci. L'état d'ici est donc périmé :
        // l'envoyer après ferait croire à une revanche, ce qui effaçait l'animation de mat chez le perdant.
        if (mine !== seen) return;
        fire('state', publicState(game));
      });
      onChildAdded(ref(db, `games/${gameId}/chat`), (s) => fire('chat', s.val()));
      onValue(ref(db, '.info/connected'), (s) => {
        const ok = !!s.val();
        sock.connected = ok;
        if (!ok && wasConnected) fire('disconnect');
        if (ok && !wasConnected) announce(); // de retour après une coupure : on se signale à nouveau
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

    /** Quitter la partie pour aller ailleurs sur le site : abandon, puis on part (sans second avertissement). */
    async leave(_, ack) {
      if (sock.live) {
        leaving = true;
        await update(gRef, { status: 'over', result: color === 'w' ? '0-1' : '1-0', reason: 'abandon' }).catch(() => {});
      }
      ack?.();
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

    /** Refuser la revanche : on le note dans la partie (rematch/no = ma couleur), l'autre est prévenu. */
    declineRematch() {
      if (!g || !color || g.status !== 'over') return;
      update(ref(db, `games/${gameId}/rematch`), { no: color }).catch(() => {});
    },

    async rematch() {
      if (!g || !color || g.status !== 'over' || g.ranked) return; // pas de revanche en classé
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
