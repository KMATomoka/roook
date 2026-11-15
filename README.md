# ROOOK — échecs entre amis

Site : **https://kmatomoka.github.io/roook/**

- **Comptes et amis** : chacun crée son compte (pseudo + mot de passe), trouve ses amis avec la barre « Rechercher un joueur » en haut de chaque page (ou la touche « / »), voit qui est en ligne et les défie en un clic. L'ami reçoit le défi en direct, où qu'il soit sur le site.
- **Photo de profil** : chacun choisit sa photo sur la page « Mes amis » (recadrée et réduite à 160 px). Elle s'affiche en partie à côté du pseudo, dans la liste d'amis et dans les défis.
- **Parties entre amis** : en temps réel, à la pendule (bullet, blitz, rapide, classique), avec chat, nulle et revanche. Chaque partie terminée va dans l'historique du joueur.
- **Contre Noa** : l'IA, 8 niveaux, du débutant au grand maître (le moteur tourne dans le navigateur).
- **Bilan** : Noa, le coach, note et explique chaque coup, avec précision en %, graphique et moments clés.
- **Même écran** et **analyse d'un PGN** collé.

## Comment c'est hébergé (gratuit)

- **GitHub Pages** sert le site (pages, images, moteur de l'IA) depuis la branche `gh-pages`. Pour publier une nouvelle version : `npm run deploy` (construit le site dans `dist/` puis l'envoie sur `gh-pages`).
- **Firebase** (projet `roook-echecs`, offre gratuite Spark) gère :
  - les **comptes** (Authentication, « adresse e-mail / mot de passe » : l'adresse est fabriquée à partir du pseudo et ne sert jamais à écrire) ;
  - la **base temps réel** (Realtime Database, Belgique) : profils, photos de profil, amis, demandes, présence, défis, parties, historique.

La configuration Firebase (`public/js/firebase-config.js`) n'est pas secrète. La sécurité vient des **règles de la base** (`database.rules.json`, à recopier dans la console Firebase → Realtime Database → Règles si on les modifie) :
seul le joueur dont c'est le tour peut ajouter un coup, personne ne lit l'historique ou les demandes d'un autre, on ne peut défier que ses amis, etc.

## Lancer le site sur ton ordinateur

Il faut [Node.js](https://nodejs.org) 20 ou plus.

```bash
npm install
npm start
```

Puis ouvre http://localhost:3000 (le site local utilise la même base Firebase que le site en ligne).

## Organisation du code

| Fichier | Rôle |
|---|---|
| `public/index.html`, `js/accueil.js` | Page d'accueil |
| `public/connexion.html` | Connexion et création de compte |
| `public/amis.html`, `js/amis.js` | Mes amis, demandes, défis, historique |
| `public/jeu.html`, `js/jeu.js` | Page de partie (ami, Noa, même écran) |
| `public/js/online.js` | Parties entre amis via Firebase (coups, pendule, nulle, revanche, chat) |
| `public/js/compte.js` | Compte, présence, amis, défis et notifications |
| `public/js/fb.js`, `js/firebase-config.js` | Connexion à Firebase |
| `public/bilan.html`, `js/bilan.js`, `js/explain.js` | Bilan de partie et explications de Noa |
| `public/js/engine.js` | IA (moteur dans le navigateur) et niveaux |
| `public/css/style.css` | Le style (thème espace violet) |
| `database.rules.json` | Règles de sécurité de la base Firebase |
| `scripts/build.js` | Construit le site dans `dist/` |

## Limites à connaître

Il n'y a pas de serveur : ce sont les navigateurs des joueurs qui vérifient les coups et font tourner la pendule.
Les règles de la base empêchent de jouer à la place de l'adversaire ou hors de son tour, mais un joueur très malin pourrait trafiquer sa propre pendule.

Crédits : moteur Stockfish (GPL, licence dans `vendor/stockfish/`), échiquier Chessground de Lichess (GPL), pièces originales dessinées pour ROOOK, avatar de Noa tiré de son overlay.
