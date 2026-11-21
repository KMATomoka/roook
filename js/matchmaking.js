// « Adversaire au hasard » : file d'attente par cadence dans la base (matchmaking/<base-inc>/<joueur>).
// Le joueur arrivé en dernier s'apparie avec le plus ancien qui attend : en UNE écriture, il crée la partie et
// écrit le « match » des deux joueurs. Si deux joueurs essaient en même temps, la base n'accepte que le premier
// (les règles, scripts/rules.js, vérifient que les deux joueurs étaient bien dans la file de cette cadence).
// Partie classée (ranked) : file à part « r-<base-inc> », chacun y entre avec son Elo ; on ne s'apparie qu'avec un
// joueur dans l'écart d'Elo accepté par les deux (±50 au départ, jusqu'à ±200 après une minute, js/rangs.js).
import { db, ref, get, set, update, remove, push, onValue, onDisconnect, serverTimestamp, serverNow } from './fb.js?v=f4cd128-mwquidh7';
import { windowFor, rankedKey, pairKey, PAIR_MAX, PAIR_SPAN } from './rangs.js?v=f4cd128-mwquidh7';

/**
 * Cherche un adversaire. Renvoie une fonction pour annuler la recherche.
 * ranked : { cat, elo, placement, proof } pour une partie classée (proof : 5 parties en ligne, js/rangs.js → onlineProof).
 * Classée : jamais plus de 3 parties contre le même adversaire en 24 h (les règles refusent la 4e) ; on cherche un autre.
 * onStatus({ waiting, window }) : joueurs qui cherchent dans cette file (soi compris), écart d'Elo accepté.
 * onFound(gameId) : partie créée, il n'y a plus qu'à la rejoindre.
 * onError(err) : la recherche n'a pas pu démarrer (hors ligne, compte banni…).
 */
export function findOpponent({ user, base, inc, ranked = null, onStatus, onFound, onError }) {
  const key = ranked ? rankedKey(base, inc) : `${base}-${inc}`;
  const queue = ref(db, `matchmaking/${key}`);
  const meRef = ref(db, `matchmaking/${key}/${user.id}`);
  let stopped = false;
  let claiming = false;
  let last = {};
  let unsub = null;
  let timer = null;
  const avoid = new Set(); // adversaires déjà affrontés 3 fois en classé ces dernières 24 h

  const stop = () => {
    stopped = true;
    unsub?.();
    clearInterval(timer);
    onDisconnect(meRef).cancel().catch(() => {});
  };
  const done = (gameId) => {
    if (stopped) return;
    stop();
    remove(meRef).catch(() => {});
    onFound(gameId);
  };

  /** Regarde la file : déjà apparié ? sinon, s'apparier avec le plus ancien qui attend (si je suis le plus récent). */
  function look() {
    if (stopped) return;
    const mine = last[user.id];
    if (!mine) return;
    if (mine.match) return done(mine.match);
    const others = Object.entries(last)
      .filter(([id, e]) => id !== user.id && e && !e.match && typeof e.at === 'number')
      .map(([id, e]) => ({ id, ...e }));
    const now = serverNow();
    const myWindow = ranked && typeof mine.at === 'number' ? windowFor(now - mine.at) : null;
    onStatus?.({ waiting: others.length + 1, window: myWindow });
    if (claiming || typeof mine.at !== 'number') return;
    // Classée : seulement un adversaire dont l'Elo est dans l'écart accepté par les deux, et pas un adversaire à éviter
    const fits = (o) => !ranked || (typeof o.elo === 'number' && !avoid.has(o.id) && Math.abs(o.elo - ranked.elo) <= Math.min(myWindow, windowFor(now - o.at)));
    // Le plus récent des deux fait l'appariement : les deux ne s'apparient jamais l'un l'autre en même temps
    const older = others.filter((o) => (o.at < mine.at || (o.at === mine.at && o.id < user.id)) && fits(o)).sort((a, b) => a.at - b.at);
    if (older.length) claim(older[0]);
  }

  async function claim(opp) {
    claiming = true;
    const gameId = push(ref(db, 'games')).key;
    const meFirst = Math.random() < 0.5;
    const me = { id: user.id, name: user.username };
    const them = { id: opp.id, name: opp.username };
    const white = meFirst ? me : them;
    const black = meFirst ? them : me;
    // Classée : trace de la paire (3 parties au plus en 24 h), écrite avec la partie
    let pair = null;
    if (ranked) {
      const pk = pairKey(user.id, opp.id);
      const cur = await get(ref(db, `rankedPairs/${pk}`)).then((s) => s.val()).catch(() => null);
      const open = cur && typeof cur.since === 'number' && serverNow() - cur.since < PAIR_SPAN;
      if (open && cur.n >= PAIR_MAX) {
        avoid.add(opp.id);
        claiming = false;
        return;
      }
      pair = { [`rankedPairs/${pk}`]: open ? { n: cur.n + 1, since: cur.since, last: gameId } : { n: 1, since: serverTimestamp(), last: gameId } };
    }
    try {
      await update(ref(db), {
        ...pair,
        [`games/${gameId}`]: {
          white: white.id,
          black: black.id,
          names: { w: white.name, b: black.name },
          time: { base, inc },
          clock: { w: base, b: base, at: 0 },
          status: 'playing',
          round: 1,
          ply: 0,
          rematch: { w: false, b: false },
          createdAt: serverTimestamp(),
          mm: key,
          ...(ranked ? {
            ranked: true,
            cat: ranked.cat,
            elo: { w: white.id === user.id ? ranked.elo : opp.elo, b: black.id === user.id ? ranked.elo : opp.elo },
            // en placement (pas encore de rang) : pas de logo de rang à côté du pseudo
            pl: { w: white.id === user.id ? !!ranked.placement : !!opp.pl, b: black.id === user.id ? !!ranked.placement : !!opp.pl },
          } : {}),
        },
        [`matchmaking/${key}/${opp.id}/match`]: gameId,
        [`matchmaking/${key}/${user.id}/match`]: gameId,
      });
      done(gameId);
    } catch {
      // Quelqu'un d'autre l'a pris (ou il est parti) : on continue à chercher
      claiming = false;
    }
  }

  (async () => {
    try {
      await set(meRef, { username: user.username, at: serverTimestamp(), ...(ranked ? { elo: ranked.elo, pl: !!ranked.placement, ...(ranked.proof ? { proof: ranked.proof } : {}) } : {}) });
      await onDisconnect(meRef).remove(); // page fermée : on quitte la file
    } catch (err) {
      stop();
      onError?.(err);
      return;
    }
    if (stopped) {
      remove(meRef).catch(() => {});
      return;
    }
    unsub = onValue(queue, (s) => {
      last = s.val() || {};
      look();
    });
    timer = setInterval(look, 2500); // après un appariement raté, on réessaie avec la file connue
  })();

  return () => {
    if (stopped) return;
    stop();
    remove(meRef).catch(() => {});
  };
}
