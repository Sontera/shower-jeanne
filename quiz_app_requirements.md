# Quiz Shower de Bébé — Spécifications pour Claude Code

## Résumé du projet

Application web interactive multi-device pour un jeu questionnaire lors d'un shower de bébé familial. L'animateur contrôle le quiz depuis son Chromebook, la vue spectacle est castée au TV via Chromecast, et les joueurs participent depuis leur téléphone. L'expérience est conçue pour favoriser la discussion et les réactions entre les questions (rythme contrôlé par l'animateur, pas de timer forcé).

## Architecture

- **Hébergement** : Firebase Hosting (gratuit) — une seule URL pour tout le monde
- **Synchronisation** : Firebase Realtime Database (tier gratuit) pour coordonner tous les appareils en temps réel
- **3 vues, une seule app** (routing par URL ou paramètre) :
  - `/tv` — Vue TV (onglet 1 sur le Chromebook, casté au Chromecast) : questions, jetons animés, scores, spectacle visuel
  - `/admin` — Vue animateur (onglet 2 sur le Chromebook) : panneau de contrôle
  - `/play` — Vue joueur (cell de chaque invité) : rejoindre, voter, voir son résultat
- Tout passe par le navigateur Chrome — aucun serveur à lancer, aucune app à installer
- Connexion internet requise (WiFi de la maison)

### Structure Firebase Realtime Database

```
quiz/
  config/
    players/
      {playerId}/
        name: "Marie"
        color: "#E8A0BF"        ← couleur du jeton
        photoHappy: null         ← base64 optionnel (v2)
        photoSad: null           ← base64 optionnel (v2)
    questions/                   ← les ~35 questions sélectionnées, en ordre
      0/
        id: "Q11"
        text: "En Bulgarie, quand..."
        choices: ["A) ...", "B) ...", "C) ...", "D) ..."]
        answer: "B"
        explanation: "Explication détaillée..."
        theme: "Traditions internationales"
      1/ ...
  state/
    phase: "lobby"               ← lobby | question | reveal | scores | final
    currentQuestion: 0
    votes/
      {playerId}: "B"           ← ou null si pas encore voté
    scores/
      {playerId}: 3
  session/
    createdAt: timestamp
    totalQuestions: 35
```

## Source de données

- Fichier `quiz_shower_bebe.md` contenant 115 questions réparties sur 13 thèmes, avec réponses et explications
- L'animateur sélectionne ~35 questions avant le party (la liste sera finalisée à partir des résultats dans `quiz_resultats_2026-04-01.md` — questions cotées 4-5 étoiles prioritaires)
- Les questions sélectionnées sont intégrées en dur dans le code (pas de parsing du .md en temps réel)
- Les questions sont en français

## Participants

- ~6 à 12 joueurs (famille)
- L'animateur ne joue pas — il anime seulement
- Chaque joueur est identifié par un nom et une couleur attribuée (les photos sont optionnelles, v2)
- Chaque joueur rejoint la partie depuis son téléphone en scannant un QR code affiché au TV
- Un joueur peut rejoindre en cours de partie (score commence à 0)

## Fonctionnalités principales

### 1. Configuration pré-quiz (vue animateur)
- Définir les joueurs : nom + couleur (photos optionnelles pour v2)
- Les questions sont pré-sélectionnées et intégrées dans le code
- Possibilité de réordonner les questions ou d'en désactiver depuis le panneau admin

### 2. Déroulement du quiz
- Affichage d'une question à la fois sur l'écran TV (optimisé 1080p)
- Chaque joueur vote depuis son téléphone (boutons A, B, C ou D)
- L'animateur voit en temps réel sur son panneau de contrôle qui a voté (et optionnellement ce qu'ils ont répondu)
- Bouton pour révéler la bonne réponse quand l'animateur le décide (pas de timer automatique — le rythme est humain)
- Après la révélation : l'explication détaillée s'affiche au TV pour que l'animateur la lise ou la laisse lire

### 3. Jetons visuels (feature principale)
- Chaque joueur est représenté par un jeton circulaire avec sa couleur et son initiale (ou photo si disponible)
- Après la révélation de la réponse :
  - Bonne réponse : animation positive (bounce, glow vert)
  - Mauvaise réponse : animation négative (shake, glow rouge)
- Les jetons se déplacent visuellement sur un tableau/échelle de score
- L'animation doit être fluide et visible de loin (sur TV)

### 4. Scoring
- 1 point par bonne réponse
- Le score se calcule automatiquement
- Tableau de score visible entre les questions (écran de classement)
- Classement des joueurs par score (avec jetons ordonnés)

### 5. Écrans de l'app

#### Vue TV (castée au Chromecast) — `/tv`
1. **Lobby** : nom du quiz + QR code pour rejoindre + liste des joueurs connectés (jetons qui apparaissent un par un)
2. **Question** : layout en deux zones
   - **Gauche** : colonne des participants avec leur jeton — un indicateur visuel apparaît en temps réel quand la personne a voté (ex: crochet, changement d'opacité), sans révéler la réponse choisie
   - **Droite** : numéro de question, thème, texte de la question et les choix de réponse (gros texte lisible)
3. **Révélation** : la bonne réponse est mise en évidence + explication détaillée affichée + animation des jetons (bonne/mauvaise réponse)
4. **Classement** : tableau de score entre les questions avec les jetons positionnés/ordonnés selon le score
5. **Podium final** : les 3 premiers avec animations de célébration

#### Vue animateur (onglet séparé sur le Chromebook) — `/admin`
1. **Configuration** : gestion des joueurs (nom + couleur), aperçu des questions
2. **Contrôle en cours de partie** :
   - Question actuelle + bonne réponse visible
   - Liste des joueurs avec statut de vote (qui a voté quoi)
   - Boutons : Révéler la réponse → Afficher classement → Question suivante
   - Bouton retour en arrière si erreur

#### Vue joueur (téléphone) — `/play`
1. **Rejoindre** : entrer son nom ou sélectionner parmi les joueurs pré-configurés
2. **Attente** : "La prochaine question s'en vient..." (entre les questions)
3. **Voter** : la question affichée + 4 gros boutons A/B/C/D (optimisés tactile, pleine largeur)
4. **Vote envoyé** : confirmation visuelle ("Réponse envoyée!"), attente de la révélation
5. **Résultat** : bonne ou mauvaise réponse + la bonne réponse + son score actuel + son rang
6. **Podium final** : classement complet vu depuis son cell

## Contraintes techniques

- **Appareil animateur** : Chromebook (Chrome OS) — pas de serveur local possible
- **Firebase** : Realtime Database + Hosting (tout dans le tier gratuit)
- Connexion internet requise (WiFi de la maison)
- App web statique (HTML/CSS/JS) déployée sur Firebase Hosting
- Firebase JS SDK chargé via CDN
- Vue TV optimisée pour affichage 1080p via Chromecast (cast d'onglet Chrome)
- Vue joueur optimisée mobile-first (tactile, gros boutons, fonctionne sur tout téléphone avec un navigateur)
- Texte gros et lisible de loin sur la vue TV
- Compatible Chrome récent (Chromebook + phones Android/iOS)

## Design et UX

- Thème visuel baby shower (couleurs douces, pastels, mais pas trop gnangnan — le public est des adultes éduqués)
- Palette de couleurs pour les jetons des joueurs : teintes pastels distinctes et facilement différenciables
- Animations fluides (CSS transitions/animations)
- Police sans-serif, grande taille pour lisibilité TV
- Transitions smooth entre les écrans
- Vue mobile : design épuré, boutons larges, feedback tactile clair
- Les jetons doivent être assez gros pour être reconnaissables sur TV depuis le salon

## Format des questions (dans le .md source)

```
**Q1.** Texte de la question

- A) Choix A
- B) Choix B
- C) Choix C
- D) Choix D
```

Pour les vrai/faux :
```
**Q36.** VRAI ou FAUX : Énoncé

- A) Vrai
- B) Faux
```

Réponses dans la section corrigé :
```
**Q1 → B)** Explication détaillée de la réponse.
```

## Setup pré-party (une seule fois)

1. Créer un projet Firebase (console.firebase.google.com) et activer Realtime Database + Hosting
2. L'animateur finalise sa sélection de ~35 questions (à partir du fichier de résultats)
3. Claude Code intègre les questions sélectionnées dans le code et déploie sur Firebase Hosting
4. L'animateur configure les joueurs (noms) dans la vue admin
5. Tester avec un cell pour valider que le flow complet fonctionne (rejoindre → voter → révéler)

## Workflow de l'animateur pendant le party

1. Ouvrir la vue TV (`/tv`) dans un onglet Chrome → caster au Chromecast
2. Ouvrir la vue animateur (`/admin`) dans un second onglet
3. Le QR code s'affiche au TV — les invités le scannent pour rejoindre
4. Une fois tout le monde connecté, lancer le quiz depuis le panneau admin
5. La première question s'affiche au TV et sur les cells
6. Les joueurs votent sur leur cell (A/B/C/D)
7. L'animateur voit qui a voté sur son panneau — il attend que tout le monde ait répondu (ou décide d'avancer)
8. Cliquer "Révéler" → la bonne réponse + explication s'affichent au TV, les jetons s'animent, chaque joueur voit son résultat sur son cell
9. L'animateur lit l'explication à voix haute ou laisse le monde la lire au TV
10. Cliquer "Classement" → le tableau des scores s'affiche
11. Cliquer "Question suivante" → on recommence
12. Après la dernière question → écran podium final au TV + sur les cells

## Nice to have (si faisable)

- Son/effet sonore court lors de la révélation (bonne/mauvaise réponse) — joué depuis le TV
- Sauvegarde/reprise de partie (état persisté dans Firebase, reprendre si crash du navigateur)
- Bouton pour revenir en arrière si erreur d'assignation
- Export des résultats finaux (copier-coller ou screenshot)
- Timer optionnel par question (désactivé par défaut — compte à rebours visible au TV et sur les cells)
- Vibration du téléphone sur bonne/mauvaise réponse
- Animation spéciale quand un joueur prend la tête du classement
- Mode "rattrapage" pour les joueurs qui rejoignent en retard (questions manquées = 0 points, clairement indiqué)
