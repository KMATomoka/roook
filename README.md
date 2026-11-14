# Roque — site d'échecs entre amis

- **Comptes et amis** : chacun crée son compte (pseudo + mot de passe), ajoute ses amis par leur pseudo, voit qui est en ligne et les défie en un clic. L'ami reçoit le défi en direct, où qu'il soit sur le site.
- **Parties entre amis** : en temps réel, à la pendule (bullet, blitz, rapide, classique), avec chat, nulle et revanche. Chaque partie terminée est enregistrée dans l'historique.
- **Contre Noa** : l'IA, 8 niveaux, du débutant au grand maître.
- **Bilan** : Noa, le coach, note et explique chaque coup (meilleur coup, erreur, gaffe…), avec précision en %, graphique et moments clés.
- **Même écran** et **analyse d'un PGN** collé.

## Lancer le site sur ton ordinateur

Il faut [Node.js](https://nodejs.org) **version 22.13 ou plus** (la base de données utilise SQLite, intégré à Node).

```bash
npm install
npm start
```

Puis ouvre http://localhost:3000

> Sur ton ordinateur, seuls les appareils de ton réseau peuvent te rejoindre.
> Pour jouer avec des amis ailleurs, il faut mettre le site en ligne.

## La base de données

Les comptes, les amitiés et l'historique des parties sont dans un fichier SQLite : `data/roque.db`.
Il est créé automatiquement au premier lancement. Les mots de passe y sont chiffrés (scrypt), jamais en clair.

- Pour tout remettre à zéro : arrête le serveur et supprime le dossier `data/`.
- Pour mettre la base ailleurs : variable d'environnement `DATA_DIR` (ex. `DATA_DIR=/var/data`).

## Mettre le site en ligne (Railway, relié à GitHub)

Le projet est prêt pour Railway : `railway.json` (démarrage, contrôle de santé, redémarrage) et `.nvmrc` (Node 24).

1. Sur [railway.com](https://railway.com), connecte-toi avec GitHub.
2. *New Project* → *Deploy from GitHub repo* → choisis `roque` (autorise Railway à voir ce dépôt seulement).
3. **Volume pour les comptes** : sur le service, *Add Volume*, chemin de montage `/data`.
   Railway fournit alors `RAILWAY_VOLUME_MOUNT_PATH`, et la base s'y range toute seule.
   Sans volume, la base est effacée à chaque mise à jour (les comptes disparaissent).
4. *Settings* → *Networking* → *Generate Domain* : tu obtiens une adresse du type `https://roque-production.up.railway.app`.
5. À chaque `git push` sur la branche `main`, Railway remet le site à jour automatiquement.

Autre hébergeur (Render, Fly.io…) : même principe, avec un disque persistant et la variable `DATA_DIR` qui pointe dessus.

## Organisation du code

| Fichier | Rôle |
|---|---|
| `server.js` | Serveur : comptes, amis, invitations, parties en temps réel (Socket.io), vérifie chaque coup |
| `server/db.js` | Base de données SQLite : comptes, sessions, amitiés, historique |
| `public/index.html`, `js/accueil.js` | Page d'accueil |
| `public/connexion.html` | Connexion et création de compte |
| `public/amis.html`, `js/amis.js` | Mes amis, demandes, défis, historique |
| `public/js/compte.js` | Compte en haut de page, notifications de défi, fenêtre « Défier » |
| `public/jeu.html`, `js/jeu.js` | Page de partie (ami, Noa, même écran) |
| `public/bilan.html`, `js/bilan.js`, `js/explain.js` | Bilan de partie et explications de Noa |
| `public/js/engine.js` | IA (moteur dans le navigateur) et niveaux |
| `public/css/style.css` | Le style du site (thème espace violet) |

Les parties en cours sont gardées en mémoire : si le serveur redémarre pendant une partie, elle est perdue. Les parties terminées, elles, sont dans la base.

Crédits : moteur Stockfish (GPL), échiquier Chessground de Lichess (GPL), pièces originales dessinées pour Roque, avatar de Noa tiré de son overlay.
