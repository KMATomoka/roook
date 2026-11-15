# ROOOK — échecs entre amis

Site : **https://kmatomoka.github.io/roook/**

- **Comptes** : inscription avec une adresse e-mail (privée) et un pseudo unique, connexion par e-mail, « mot de passe oublié » qui envoie un lien par e-mail.
- **Amis** : on trouve ses amis avec la barre « Rechercher un joueur » en haut de chaque page (ou la touche « / »), on voit qui est en ligne et on les défie en un clic. L'ami reçoit le défi en direct, où qu'il soit sur le site.
- **Rôles** : membre ou admin. Les admins ont la page `admin.html` : liste de tous les membres en direct (e-mail, inscription, dernière connexion, parties, amis), bannir (1 h à définitif, avec motif) / débannir, retirer une photo, envoyer un lien « nouveau mot de passe », nommer ou retirer un admin.
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

La configuration Firebase (`public/js/firebase-config.js`) n'est pas secrète. La sécurité vient des **règles de la base** (`database.rules.json`, générées par `node scripts/rules.js`, à recopier dans la console Firebase → Realtime Database → Règles si on les modifie) :
seul le joueur dont c'est le tour peut ajouter un coup, personne ne lit l'historique ou les demandes d'un autre, on ne peut défier que ses amis, un joueur banni ne peut plus rien écrire, seuls les admins voient les e-mails et la liste des membres, etc.

**Nommer le premier admin** : dans la console Firebase → Realtime Database → Données, ajouter `roles/<identifiant du compte>` = `admin` (l'identifiant est dans Authentication → Utilisateurs). Ensuite, les admins peuvent en nommer d'autres depuis la page Administration.

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
| `public/connexion.html` | Connexion, création de compte, mot de passe oublié |
| `public/admin.html`, `js/admin.js` | Administration des membres (admins seulement) |
| `public/amis.html`, `js/amis.js` | Mes amis, demandes, défis, historique |
| `public/jeu.html`, `js/jeu.js` | Page de partie (ami, Noa, même écran) |
| `public/js/online.js` | Parties entre amis via Firebase (coups, pendule, nulle, revanche, chat) |
| `public/js/compte.js` | Compte, présence, amis, défis et notifications |
| `public/js/fb.js`, `js/firebase-config.js` | Connexion à Firebase |
| `public/bilan.html`, `js/bilan.js`, `js/explain.js` | Bilan de partie et explications de Noa |
| `public/js/engine.js` | IA (moteur dans le navigateur) et niveaux |
| `public/css/style.css` | Le style (thème espace violet) |
| `database.rules.json`, `scripts/rules.js` | Règles de sécurité de la base Firebase (et leur générateur) |
| `scripts/build.js` | Construit le site dans `dist/` |

## L'arbitre (sécurité des parties)

Il n'y a pas de serveur : ce sont les **règles de la base** (`scripts/rules.js`) qui arbitrent les parties entre amis.

- Un coup : seulement à son tour, numéroté dans l'ordre, jamais réécrit.
- La pendule : vérifiée avec l'heure de Firebase à chaque coup. Impossible de se rajouter du temps ou de jouer après être tombé.
- Personne ne peut se déclarer gagnant soi-même :
  - l'abandon est écrit par celui qui abandonne ;
  - le mat est confirmé par le joueur maté (automatique dans le jeu) ;
  - la nulle d'un commun accord demande la proposition de l'autre ;
  - pat, répétition, 50 coups et matériel insuffisant demandent que les deux joueurs le constatent ;
  - le gain au temps n'est accepté que si l'heure de Firebase montre que la pendule est tombée.
- Un coup illégal reçu permet d'annuler la partie (personne ne gagne).
- L'historique n'accepte une partie entre amis que si elle existe, est terminée, avec le même résultat, et une seule fois. On ne peut ni effacer ni modifier une partie ; un admin le peut.
- Les statistiques « classées » du profil ne comptent que ces parties vérifiées.

## Limites à connaître

- Les parties contre Noa se jouent dans le navigateur : elles ne peuvent pas être vérifiées. Elles sont affichées à part (« entraînement, non classé »).
- Rien n'empêche quelqu'un de se faire aider par un logiciel d'échecs pendant une partie (comme partout).

Crédits : moteur Stockfish (GPL, licence dans `vendor/stockfish/`), échiquier Chessground de Lichess (GPL), pièces originales dessinées pour ROOOK, avatar de Noa tiré de son overlay.
