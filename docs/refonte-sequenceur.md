# Refonte du séquenceur — cahier des charges (11/11/2026)

À lire avec `docs/refonte.md` (règles, feuille de route) et `CLAUDE-HARMOHUB.md` (état du chantier). **Rien de ce qui suit n'est codé** : l'utilisateur a demandé le
11/11 de tout noter ici, puis de faire « tout à la suite » dans une session dédiée.

Maquette commentable (artefact) : https://claude.ai/artifact/38sqeQZK1q1HDnUYf6PvJT — quatre planches (`Main.dc.html` ordinateur cliquable, `Notes.dc.html` « Toutes les
notes », `Telephone.dc.html`, `Clic.dc.html` le clic sur un accord). Les commentaires de l'utilisateur y sont la source de ce document ; en cas de doute, **la maquette
(version 17) fait foi** pour l'aspect et les gestes.

## 1. Constat de départ (l'utilisateur, 11/11)

1. Cliquer un accord ouvre le panneau, mais **il recadre l'écran à chaque fois** : sauts d'affichage.
2. Cliquer un accord ne doit pas forcément ouvrir le panneau : parfois on veut **seulement entendre l'accord**.
3. Le séquenceur est « très compliqué à utiliser, beaucoup de problèmes d'affichage » : refonte complète, plus simple.
4. **Règle absolue** : ouvrir le séquenceur ne doit **jamais** changer l'affichage de la grille (« je ne veux absolument pas ça »).

## 2. Modifications à faire dans l'appli (ordre proposé)

### A. La grille ne bouge plus quand le séquenceur s'ouvre (le plus simple, à faire en premier)
- Supprimer le **Compact provisoire** de l'éditeur de notes (décision du 05/11, lot 9a, **annulée**) : `entrerCompactProvisoire`, `sortirCompactProvisoire`,
  `poserAffichageGrilleProvisoire`, `abandonnerCompactProvisoire`, `_affichageAvantEditeur`, et leurs appels dans `majEditeurNotes` et au changement de morceau
  (`script.js`, autour de 19740 et 11997).
- La grille garde Compact / Normal / Détaillé, sa largeur et sa hauteur de cases ; le séquenceur s'ouvre en dessous, la page défile au besoin.
- Bancs à réécrire (jamais supprimer) : `editeur_notes` (partie « Compact provisoire »), `editeur_et_clavier`, `editeur_notes_outils`, `calque_voix`, `vues_tiroir` s'ils
  lisent `densite-compact` à l'ouverture ; ajouter une vérification « la grille a exactement le même affichage séquenceur ouvert ».

### B. Le clic sur un accord : écouter sans ouvrir (planche 4 de la maquette)
- **Un clic ou un toucher** sur une case : la case est sélectionnée (bleu) et l'accord est joué (halo vert le temps du son). **Rien ne s'ouvre.**
- **Double-clic**, ou toucher une case **déjà sélectionnée** : ouvre le panneau de l'accord (bulle à l'ordinateur, panneau du bas au téléphone).
- Échap ou clic à côté referme ; la sélection reste.
- À confirmer avec l'utilisateur au moment de coder : le geste exact sur ordinateur (aujourd'hui le clic ouvre la bulle, lot 6b) — l'option B proposée était un
  réglage « Ouvrir le panneau au clic » oui / non ; l'option A (ci-dessus) a été préférée dans la maquette.
- Bancs concernés : `bulle_accord*`, `telephone_panneau_accord`, `filet_*`, `mobile_*`, `probe_clic_accord_voisin`, `sentinelle_atteignabilite` (nombreux : lancer
  `bash tests/run_cible.sh --liste` après le changement de `selectChord` / `ouvrirBulle` / `ouvrirPanneauAccord`).

### C. Le panneau ne recadre plus l'écran
- `ouvrirPanneauAccord` appelle `assurerCaseVisiblePanneau` ; la bulle à l'ordinateur fait défiler la page : supprimer les défilements automatiques à l'ouverture.
- Règle : **ne bouger l'écran que si la case touchée finit cachée sous le panneau, et du strict minimum** (jamais de recentrage).
- Bancs : `telephone_panneau_accord`, `mobile_edit_scroll`, `mobile_scroll`, `bulle_*`.

### D. Un seul séquenceur (remplace le grand séquenceur, le petit séquenceur de l'inspecteur / du panneau, la loupe)
Voir la section 3 : c'est le gros morceau (module `sequenceur.js` écrit de zéro, dessiné d'un seul bloc ; l'ancien reste en place jusqu'à la bascule).

## 3. Le nouveau séquenceur — décisions de la maquette

**Principe** : UN seul séquenceur, **une ligne par voix** (basse, voix 2, voix 3, aiguë) et non une ligne par demi-ton. Huit croches par accord. **Pas de zoom, pas de
loupe, pas de poignée de hauteur, pas de « Étendre »** : toute la partie tient à l'écran. Placé sous la grille (ordinateur), dans le panneau de l'accord (téléphone,
onglet « Rythme » à côté de « Accord » et « Son »).

### Barre d'outils, de gauche à droite
1. **Pas de Lecture / Stop propres au séquenceur** (décision finale du 11/11, après un premier essai en tête de barre) : la **barre de lecture de l'application** (en bas) pilote
   la grille ET le séquenceur. Pour jouer un ou deux accords en boucle, on place la **barre orange** au-dessus du séquenceur ; « Lecture » ne joue alors que cette plage.
   Retirer le Lecture / Stop du séquenceur actuel (`#seq-play`, `#seq-stop`) et ses bancs (`pinned_seq_toolbar`, `probe_seq_*`).
2. **Motifs** en vignettes (**pas de titre « Rythme »**, il n'apporte rien : la barre commence directement par les vignettes) (Plaqué, Arpège ↑, Arpège ↓, Pompe, Ballade, À la main) + **formes enregistrées par l'utilisateur** (vignette, nom, petit × pour la
   supprimer). Un motif s'applique à « Toute la partie » ou à « Cet accord » (groupe segmenté à droite). Appliquer un motif **ne réécrit que les quatre voix** : les
   notes libres restent.
3. **Enregistrer la forme** : logo « marque-page » **repris de TrainHub** (réglages de paliers du métronome, `M6 4h12v17l-6-4-6 4z`). Un clic propose d'office un nom
   (« Forme 1 », sélectionné), Entrée valide, Échap annule. La forme garde les croches ET leurs intensités (voix 1 à 4). Supprimer une forme : les accords qui
   l'utilisaient gardent leurs notes (ils passent « À la main »).
4. **Intensité** : bouton avec le **logo du mode studio existant**. Éteint (par défaut) : un clic pose ou enlève une note, tout au même niveau (normal). Allumé :
   un clic sur une note fait tourner **normal → fort → doux → enlevée**. Niveaux lus à l'opacité de la note, liseré plus épais pour « fort ». Les intensités réglées
   sont gardées quand on éteint. **Le premier temps n'est pas plus appuyé que les autres** dans les motifs fournis (tout en « normal »).
5. **Note libre** : bouton « note de musique » dans la barre (au-dessus des notes, **pas en dessous** : il se déplaçait à chaque ligne ajoutée). Il déplie une bande :
   nom de la note (C … B, dièses) + octave − / + + « Ajouter C4 ». Crée une **ligne en pointillés** sur **tous les accords** (cases toutes normales et cliquables : on
   pose les croches là où on veut). Petit × sur la ligne pour la retirer. **Décision finale du 11/11 : pas de choix « seulement cet accord / toute la partie », pas
   de cases grisées** (« c'est bizarre »).
6. **Copier / Coller / Effacer** le rythme de l'accord choisi (la poubelle seule paraissait isolée).

### Règle, boucle, lignes
- **Règle** : seulement les **numéros de temps** (1 2 3 4). **Pas de petits points de contretemps** (essayés puis retirés : « pas jolis »). Pas de légende dans l'appli.
- **Plage à boucler** : **barre orange DANS la règle, au droit des numéros de temps** (pas une rangée à part au-dessus), **translucide** (dégradé orange à ~50 % puis ~28 %, liseré
  fin ; les chiffres se lisent à travers ; la plage reçoit aussi une teinte orange légère, ~13 %, dans la règle et les cases vides), aux extrémités arrondies, **comme GarageBand**.
  On la pose en **tirant sur la règle** ; on la **retire en cliquant dessus** (pas de bouton). Une seule pièce, alignée sur les colonnes. « Lecture » ne joue que cette plage tant qu'elle existe. Orange = plage à boucler (règle du chantier).
- **Étiquettes** à gauche : le **nom de la note avec son octave** (C3, E3, G3, B3 pour l'accord choisi), calées à droite, **colonne étroite (≈ 46 px)**, marges de page
  et de cadre resserrées (16 px / 12 px), **petit jour de ≈ 10 px** avant les mesures : « tout serrer vers la gauche, mais laisser un petit espace ».
- **Une note tenue = une barre continue** (croches voisines soudées : sans coins ni espace) ; une croche seule reste un plot court (staccato). Le nom de la note
  est écrit au début de la barre. Couleurs des rôles inchangées (1 vert, 3 bleu, 5 rouge, 7 ambre ; note libre violette).
- **Aucune légende, aucune ligne d'aide** dans l'appli (la maquette en avait pour être lisible seule).
- **Le son** : un clic sur une case de la grille joue l'accord ; poser ou changer une note la fait entendre à son niveau ; « Lecture » joue avec les intensités. Dans
  l'appli : l'instrument du morceau.

### Vue « Toutes les notes » (planche 2)
Seulement les **hauteurs utilisées** par la partie (jamais 60 lignes) pour ajouter une note hors de l'accord ; notes ajoutées à la main en pointillés. À préciser
au codage : bascule Voix / Toutes les notes dans la barre.

### Ce qui disparaît (à retirer proprement, bancs réécrits, jamais supprimés)
Grand séquenceur et petit séquenceur (deux affichages), zoom H / V, loupe, « Étendre », poignée `#seq-dock-resize`, outils crayon / gomme / sélection, calque Voix à
allumer (le chemin des voix peut devenir permanent et discret : à trancher), bande d'intensité séparée, mode studio comme mode à part (son logo est repris pour le
bouton Intensité). Les bancs `probe_seq_*`, `seq_*`, `voice_leading*`, `vl_*`, `calque_voix`, `notes_manuelles_intensite`, `editeur_notes*`, `pinned_seq_toolbar`,
`loupe_*`, `sidebar_collapse_seq_height`, `volet_hauteur_poignee` (voir « Lot 9 » dans `CLAUDE-HARMOHUB.md`) sont à réécrire pour les nouveaux gestes.

**Position de la barre d'outils** (décision du 11/11) : elle reste **au-dessus** des notes (toujours visible, place habituelle des logiciels de musique, ne bouge pas quand
des lignes s'ajoutent). Option offerte, non demandée : ranger les vignettes de motifs derrière un seul bouton « Motifs » si elles prennent trop de place.

## 4. Questions encore ouvertes (à poser à l'utilisateur avant de coder)

1. **Où vivent les formes enregistrées ?** Sur le compte (tous les morceaux et appareils, comme les morceaux dans Firestore) ou propres à un morceau ? *(question posée
   dans la maquette, pas de réponse)*.
2. **Le chemin des voix** (traits blancs entre accords) : permanent et discret, ou on le supprime ?
3. **Clic sur un accord à l'ordinateur** : confirmer « un clic = écouter, double-clic = ouvrir » (option A) ou le réglage oui / non (option B).
4. Les commentaires restés ouverts sur la maquette (fils non envoyés à Claude) ont tous été traités dans la version 17 ; seule la question 1 reste sans réponse.

## 5. Ordre de travail proposé
A (grille qui ne bouge plus) → C (plus de recadrage) → B (clic = écouter) → D (séquenceur, par sous-lots : module + ordinateur, puis formes enregistrées et notes libres,
puis téléphone, puis retrait de l'ancien code et bancs). Un commit par sous-lot, banc + sabotages à chaque fois, balayage complet en fin de lot avant de pousser
(voir `CLAUDE.md`).
