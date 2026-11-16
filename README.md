# ROOOK — échecs entre amis

Site : **https://kmatomoka.github.io/roook/**

- **Comptes** : inscription avec une adresse e-mail (privée) et un pseudo unique, connexion par e-mail, « mot de passe oublié » qui envoie un lien par e-mail.
- **Amis** : on trouve ses amis avec la barre « Rechercher un joueur » en haut de chaque page (ou la touche « / »), on voit qui est en ligne et on les défie en un clic. L'ami reçoit le défi en direct, où qu'il soit sur le site.
- **Rôles** : membre, admin ou fondateur. Le fondateur est au-dessus de tout : lui seul peut retirer le rôle d'un admin, et personne ne peut le bannir ni le rétrograder (le rôle fondateur se donne seulement depuis la console Firebase). Un admin peut nommer d'autres admins, mais pas leur retirer leur rôle. Les admins ont la page `admin.html` : liste de tous les membres en direct (e-mail, inscription, dernière connexion, parties, amis), bannir (1 h à définitif, avec motif) / débannir, retirer une photo, envoyer un lien « nouveau mot de passe », nommer ou retirer un admin.
- **Photo de profil** : chacun choisit sa photo sur la page « Mes amis » (recadrée et réduite à 160 px). Elle s'affiche en partie à côté du pseudo, dans la liste d'amis et dans les défis.
- **Parties entre amis** : en temps réel, à la pendule (bullet, blitz, rapide, classique), avec chat, nulle et revanche. Chaque partie terminée va dans l'historique du joueur.
- **Contre l'ordinateur** : au choix Noa (l'astronaute), Adriz ou Astrea (le chat de l'espace), 8 niveaux, du débutant au grand maître (le moteur tourne dans le navigateur). Même moteur pour les trois ; chacun a sa tête, qui réagit pendant la partie, et ses répliques de fin (`RIVALS` dans `js/common.js`). Visages d'Adriz et d'Astrea générés par `node scripts/visages.js` (Astrea reprend le casque et la combinaison de Noa).
- **Bilan** : Noa, le coach, note et explique chaque coup, avec précision en %, graphique et moments clés.
- **Même écran** et **analyse d'un PGN** collé.
- **Apprendre** (`apprendre.html`) : pour les débutants. 13 leçons pas à pas (le déplacement de chaque pièce, la promotion, la prise en passant, le roque, l'échec, sortir de l'échec, le mat, le pat et la nulle), 16 ouvertures à jouer coup par coup avec explications (italienne, espagnole, écossaise, gambit du roi, gambit dame, Londres, anglaise, sicilienne, française, Caro-Kann, scandinave, Petrov, est-indienne, Nimzo-indienne, hollandaise, Pirc), chacune avec comment la défendre ou l'affronter, puis les entraînements : « Problèmes » (3 667 vrais problèmes tirés de la base ouverte de lichess, licence CC0, de 600 à 2 800 Elo, dans `public/data/problemes.json`, préparés par `node scripts/problemes.mjs` qui ne lit que le début du fichier lichess ; problèmes choisis autour du classement du joueur, qui monte ou baisse façon Elo, filtre par thème : mat en 1/2/3, fourchette, clouage, enfilade, découverte, sacrifice, pièce en prise, finale), « Mat à l'infini » (positions créées au hasard par `public/js/mat-gen.js`, mat en 1, 2 ou 3 coups vérifié par Stockfish dans le navigateur, l'adversaire se défend au mieux ; série sans faute et record), gagner une pièce et défendre contre un mat. Indice et solution, progression gardée dans le navigateur. Le contenu des leçons est dans `public/js/apprendre-data.js` ; `node scripts/verif-apprendre.mjs` vérifie avec chess.js que chaque leçon et chaque exercice a bien une solution, et `node scripts/mesure-mat-gen.mjs` mesure le générateur de mats avec Stockfish.
- **Box** (`box.html`, `js/box.js`, `js/box-page.js`) : une box à chaque victoire en ligne (contre un ami ou au hasard, d'après l'historique vérifié par l'arbitre), compteur 🎁 dans la barre du haut. La box classique donne un élément de pack tiré au sort par rareté — un plateau, une pièce (pion, tour, cavalier, fou, dame ou roi : chacune se trouve à part), une fin de partie ou une prise et son : commun 55 % (Astrea, Classic, déjà à tous : se change en poussière d'étoile ✨), rare 33 % (Sakura, Western), épique 11,7 % (Océan), jeu complet 0,3 % (les 6 pièces d'un pack d'un coup). Les packs entiers ne sont plus dans les box (boutique à venir) ; Royal chess (légendaire) reste une mission (100 victoires). Ouverture : le coffre commun est modélisé en vraie 3D avec Three.js (`js/coffre3d.js`, WebGL : planches biseautées veinées, fer martelé clouté, couvercle bombé sur charnières, serrure, gemme verte, lumières et ombres ; version CSS de secours sans WebGL). Le joueur le frappe lui-même, la rareté monte à chaque coup tant qu'elle ne s'ouvre pas (plus le drop est gros, plus il faut de coups), puis rayon de lumière, particules (canvas), sons synthétisés (`boxSfx` dans `js/sound.js`) et carte de l'objet avec un vrai aperçu (plateau en 3D, pièce sur son socle, fin de partie ou prise jouée sur un petit échiquier). En local, `bxDemo('epique', 'ocean', 'N')` dans la console (ou `box.html?demo=epique,ocean,N`) rejoue une ouverture sans rien enregistrer. Doublons → ✨ ; 10 ✨ = une box. Les admins peuvent s'offrir des box de test. Base : `loot/{uid}` (box ouvertes, une seule fois ; éléments trouvés ; ✨) et `lootGrants/{uid}` (box offertes). Le tirage se fait dans le navigateur : les règles bornent ce qu'on peut écrire mais ne tirent pas au sort.
- **Inventaire** (`inventaire.html`) : chacun choisit l'apparence de ses parties — plateau, pièces, animation de fin de partie, animation de prise avec ses sons — pack entier d'un clic ou éléments mélangés ; dans l'onglet Pièces, on change tout le jeu ou une seule pièce (`users/{uid}/equip/piece` : le pack de chaque pièce ; classes `pc-N-ocean` sur la page, CSS dans `style.css` et, pour Classic, généré par `scripts/build.js`). Packs « Astrea chess » (l'apparence d'origine, équipée par défaut), « Classic chess » (noir et blanc, pièces Staunton, sons de bois) et « Sakura chess » (le Japon : damier rose sakura à motif asanoha et indigo à vagues seigaiha (`node scripts/damier-japon.js`), pièces rose sakura et indigo — pion kokeshi, château, éventail, casque de samouraï —, prise au sabre, fin de partie « Hanami » avec soleil rouge, pétales et sceaux 勝 / 負, sons de shogi, taiko, koto et shakuhachi ; pièces générées par `node scripts/pieces-japon.js`) « Océan » (eau claire et eau profonde — `node scripts/damier-ocean.js` —, pièces de nacre et des abysses lumineux : perle, tour de corail, coquillage, hippocampe mythique, couronne de perles, trident — `node scripts/pieces-ocean.js` —, prise « Siphon », aileron de requin à l'échec, fin « Les Abysses » avec baleine à la victoire et kraken à la défaite, sons sous l'eau ; badge 🌊) et « Western chess » (turquoise et terre cuite, motif navajo — `node scripts/damier-western.js` —, pièces à détails western : foulards, étoiles de shérif, tour en coffre-fort, cavalier géométrique navajo, dame à couronne de balles — `node scripts/pieces-western.js` —, prise « Duel » au revolver, fin « Règlement de comptes » avec viseur, virevoltant et pancarte de saloon, sons de bottes à éperons, revolver, sifflement, guitare et harmonica). Pack « Royal chess » (or et crème, esprit chevalier, particules dorées) : verrouillé et grisé jusqu'à 100 victoires en ligne contre des amis (parties vérifiées par l'arbitre), débloqué d'office pour les admins et le fondateur, avec une barre de progression ; ses pièces sont générées depuis la maquette par `node scripts/pieces-royal.js`. Avec un compte, le choix est enregistré dans `users/{uid}/equip` ; sans compte, dans le navigateur. Il s'applique à la page de partie, au bilan et à l'échiquier de l'accueil (en partie entre amis, chacun voit son propre équipement).

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
| `public/index.html`, `js/accueil.js` | Accueil (présentation et accès aux pages) |
| `public/jouer.html`, `js/jouer.js` | Jouer : contre un ami, contre l'ordinateur (Noa, Adriz, Astrea), sur le même écran |
| `public/profil.html`, `js/profil.js` | Profil d'un joueur : statistiques des parties en ligne, public ou privé |
| `public/connexion.html` | Connexion, création de compte, mot de passe oublié |
| `public/admin.html`, `js/admin.js` | Administration des membres (admins seulement) |
| `public/amis.html`, `js/amis.js` | Mes amis, demandes, défis, historique |
| `public/jeu.html`, `js/jeu.js` | Page de partie (ami, Noa, même écran) |
| `public/js/online.js` | Parties entre amis via Firebase (coups, pendule, nulle, revanche, chat) |
| `public/js/compte.js` | Compte, présence, amis, défis et notifications |
| `public/js/fb.js`, `js/firebase-config.js` | Connexion à Firebase |
| `public/bilan.html`, `js/bilan.js`, `js/explain.js` | Bilan de partie et explications de Noa |
| `public/apprendre.html`, `js/apprendre.js`, `js/apprendre-data.js`, `js/mat-gen.js`, `data/problemes.json` | Leçons et exercices pour débutants, « Problèmes » (base lichess, `scripts/problemes.mjs`), « Mat à l'infini » (vérifiés par `scripts/verif-apprendre.mjs` et `scripts/mesure-mat-gen.mjs`) |
| `public/js/engine.js` | IA (moteur dans le navigateur) et niveaux |
| `public/css/style.css` | Le style (thème espace violet, et plateaux / pièces de l'inventaire en variables CSS) |
| `public/inventaire.html`, `js/inventaire.js` | Inventaire : choisir plateau, pièces, animations et sons |
| `public/js/theme.js` | Équipement du joueur (compte ou navigateur) : classes `board-…`, `pieces-…` sur `<body>`, lu par `fx.js` et `sound.js` |
| `public/js/fx.js`, `js/sound.js` | Effets visuels et sons des coups (variantes Astrea et Classic) |
| `public/maquette-royale.html` | Maquette du futur pack « Royal » (liée nulle part, à valider) |
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
- Les statistiques du profil ne comptent que ces parties vérifiées.

## Limites à connaître

- Les parties contre Noa se jouent dans le navigateur : elles ne comptent pas dans les statistiques (seules les parties en ligne contre des amis comptent).
- Rien n'empêche quelqu'un de se faire aider par un logiciel d'échecs pendant une partie (comme partout).

Crédits : moteur Stockfish (GPL, licence dans `vendor/stockfish/`), Three.js (MIT, licence dans `vendor/three/`), échiquier Chessground de Lichess (GPL), pièces originales dessinées pour ROOOK (packs Astrea et Royal), pièces classiques « cburnett » du pack Classic chess (fournies avec Chessground, licence GPL ; transformées en variables CSS par `scripts/build.js`), avatar de Noa tiré de son overlay.
