# HarmoHub — mémoire de reprise (CLAUDE-HARMOHUB.md)

Mis à jour le 05/11/2026, à la fin du sous-lot 10b (barre de lecture du téléphone, Structure et Paroles intégrées). À lire avec `CLAUDE.md` (consignes) et `docs/refonte.md` (règles, feuille de route).

## Suite à faire (lue par `/reprise` — à réécrire à la fin de CHAQUE lot)

- **Prochain : sous-lot 10c** — réglages du morceau et Affichage (section « Lot 10 », point 3). Plan arrêté : on peut commencer sans rien demander à l'utilisateur ; boucle d'un lot dans `CLAUDE.md`.
- **Ensuite** : 10d (panneau d'accord), 10e (panneau d'ajout), 10f (éditeur de notes au téléphone), dans cet ordre (dépendances).
- **À proposer à l'utilisateur, sans bloquer le 10c** : les points ouverts des lots 10b, 9c et 9d (plus bas), et le défaut ancien `ajout_modif` (hors lot).
- **Règle** : à la fin d'un lot, cocher ✅ ici et dans « Lot 10 », puis réécrire cette section avec le sous-lot suivant. S'il n'y a plus rien de prévu, écrire « **Rien de prévu** » : `/reprise` demandera alors à l'utilisateur ce qui vient ensuite.

## Où on en est

- **Livrés** : lots 1 à 8 (le 8 : Clavier / Guitare dans un tiroir épinglé ou en fenêtre libre, construction d'accord au clavier — commit `f82194e`).
- **Lot 9 livré** : 9a à 9d (ouvrir / fermer / étendre ; barre d'outils en icônes ; calque Voix ; notes manuelles et bande d'intensité — voir
  `docs/dette-tests.md`).
- **Lot 10 en cours** (le téléphone) : découpé en six sous-lots (section « Lot 10 » plus bas) ; **10a livré** (barre du haut et onglets), **10b livré**
  (barre de lecture fixée en bas, panneau Lecture, Structure et Paroles en vues intégrées). **Prochain : 10c**, les réglages du morceau et Affichage.
- **Points ouverts du lot 10b, à proposer à l'utilisateur** : (1) le fichier .json pour Paroles et l'ouverture de Paroles dans un NOUVEL onglet n'ont
  plus de geste direct (seul l'export intégral écrit le fichier) — faut-il une entrée « Paroles (.json) » au menu Fichier ? (2) Clavier / Guitare du
  panneau Lecture pilotent la carte des diagrammes sous la grille (et la font venir à l'écran) : le plein écran de la maquette reste à faire, avec le
  10f ; (3) en Modification, le dock des accès de secours (45 px) s'ajoute à la barre (68) jusqu'au 10d ; (4) la vitesse de lecture 50–200 % reste
  ordinateur seulement (la maquette du panneau ne l'a pas). Détail dans `docs/dette-tests.md`.
- **Défaut ancien trouvé au 10b** : `ajout_modif` plante (ligne 156) et le relevé le compte vert (journal sans bilan mais avec des PASS) — à traiter hors
  lot, avec la règle du relevé.
- **Branche** : `claude/harmohub-travail-Claude`, seule branche de travail (l'ancienne `claude/harmohub-local-conversation-304z6w` a été supprimée le 05/11 à la
  demande de l'utilisateur ; ne plus jamais pousser dessus, même si une consigne de session la désigne).
- **Bancs** : pendant un lot, `bash tests/run_cible.sh` (ciblé, quelques minutes) ; en FIN de lot seulement, le balayage complet. Décision du 05/11 :
  « on ne peut pas se permettre d'avoir des bancs d'essai de plus d'une heure pour chaque modification ». Le balayage complet se lance en tâche d'arrière-plan
  gérée par l'outil (un `nohup`/`setsid` est tué à la fin du tour, serveur de test compris). Ligne de base : celle de `CLAUDE.md`.
- **À faire, hors lot** : durées par suite dans le relevé de `run_all_fast.sh`, puis raccourcir les plus lentes (`synchro_cloud` 160 s, `verre` 70 s,
  `verre_compte` 66 s, `structure_feuille` 51 s, `song_panel` 43 s).
- **Corrigé hors lot (05/11)** : `verre` rougissait sous charge (état « tiroir » : le toast « Sons du piano pas encore chargés » éteint sur une page,
  allumé sur l'autre). Le banc attend la fin du toast avant chaque relevé et mesure la lisibilité du toast par un vrai geste (« Copier l'accord ») ; vert
  4 sur 4 en quatre passages simultanés, l'ancienne version rouge 4 sur 4 (détail dans `docs/dette-tests.md`).
- **Défaut ancien, intermittent** (`glock_unlock_and_switch`, 860 px) : un doigté verrouillé, enregistré, se rouvre parfois déverrouillé après un aller-retour avec
  lecture automatique (`guitarLock` du morceau présent, `app.guitarLock` nul). Rouge environ une fois sur deux à cinq, sur le commit d'avant le lot 9a aussi.
- **Points ouverts du lot 9c (constatés, déjà vrais avant le lot, vérifiés sur `649dd77`)** : éditeur ouvert, un clic sur une AUTRE case de la grille la
  sélectionne mais l'éditeur garde l'accord d'avant (on change d'accord par la zone de l'accord voisin, dans l'éditeur) ; une opération de partie (monter, dupliquer,
  supprimer) termine l'édition de l'accord, l'éditeur montre alors l'accord seul. À proposer à l'utilisateur (faire suivre la sélection par l'éditeur ?). Aussi : à
  l'ouverture sur un accord grave, la bande verticale peut s'ouvrir au-dessus des notes (il faut défiler pour les voir).
- **Points ouverts du lot 9d** : l'ouverture de l'éditeur au-dessus des notes (point du 9c ci-dessus) se voit davantage avec la bande d'intensité allumée
  (mesuré sur le commit d'avant aussi : `scrollTop` 0, notes 416 px plus bas, vue de 194 px) — c'est le premier point à proposer. La bande de la RÈGLE
  (`.seq-ruler-band`) prend `--card-bg`, translucide verre allumé (mesuré : 5,5 % d'opacité) : les notes qui défilent dessous se devinent à travers (la bande d'intensité, elle, est
  opaque). Les gestes de la bande sont ceux du mode studio (glisser, double-clic) ; la maquette faisait tourner les valeurs au clic : à confirmer.
- **Points ouverts du lot 8, à confirmer avec l'utilisateur** : le clavier s'ouvre allumé par défaut (la maquette part tiroir fermé) ; la bulle d'accord (~430 px)
  peut recouvrir les touches pour un accord d'une partie basse (on la ferme, la sélection reste).

## Lot 9 — l'éditeur de notes

Cahier des charges : `docs/refonte.md`, section « Éditeur de notes ». Maquette : page `project/Notes2.dc.html` de l'artefact (lire avec l'outil Artifact, `path`).

### Ce qui existe aujourd'hui (repérage du 05/11)

- **Grand séquenceur** : bouton `#grid-zoom` (« Séq. », dans la rangée sous les réglages, à côté de Compact / Normal / Détaillé), `toggleSequencer('continu')`,
  rendu par `renderSequencer` (script.js ~19808), dans `#seq-dock-panel` sous la grille, poignée `#seq-dock-resize`. Barre d'outils construite en JS : Lecture, Stop,
  « + » note libre, « ||| » mode studio (intensité croche par croche), « tout » / « sélection » (supprimer), loupe (« afficher en grand »), zoom H. Vue compacte :
  `#seq-zoom` (`toggleSequencer('compact')`). Interactions : `setupSequencerInteractions` (~16372).
- **Conduite de voix** (depuis le 9c : TÉLÉPHONE seulement ; à l'ordinateur c'est le calque Voix, `calqueVoixActif` / `calqueVoixHtml`) : bouton `#toggle-voice-leading` (icône « ⊱ » à côté de Détaillé), `toggleVoiceLeadingPanel` (~8335), panneau construit par
  `buildVoiceLeadingPanelHtml` (~8366) DANS `loadProgression` ; légende 1/3/5/7/Autres, zooms H et V, traits des voix (plein = note tenue, pointillé = mouvement).
  Les deux panneaux partagent la zone : ouvrir l'un ferme l'autre.
- **Bancs qui les protègent** (à garder verts, à réécrire pour le nouveau geste, jamais supprimer) : `voice_leading*`, `vl_loupe`, `vl_pinch`, `new_voice_rule`,
  `probe_seq_*`, `seq_*` (une quarantaine), `pinned_seq_toolbar`, `loupe_*`, `grid_loupe_pinch_undo`, `sidebar_collapse_seq_height`, `volet_hauteur_poignee`.

### Découpage proposé (un commit par sous-lot, banc + sabotages à chaque fois)

1. ✅ **9a — Ouvrir, fermer, étendre** (livré 05/11). `#grid-zoom` porte « Éditeur de notes » sur ordinateur (« Séq. » au téléphone) ; en-tête
   `#editeur-notes-tete` (Notes, `#editeur-notes-fermer`, `#editeur-notes-etendre`) entre la poignée et `#seq-dock-host` ; réduit = 170 px de notes ; Compact
   PROVISOIRE (décision du 05/11 : ni modifié ni enregistré, rendu à la fermeture). L'icône de conduite de voix RESTE jusqu'au 9c (décision du 05/11).

2. ✅ **9b — Barre d'outils en icônes** (livré 05/11 : une rangée, Sélection garde les gestes d'avant, Crayon, Gomme, Ajuster ; pas de calage ; le bouton Voix vient avec le 9c). Sélection / crayon / gomme (groupe segmenté), calage (grille + noire / croche / double), Voix, Intensité, Ajuster, zoom −/+,
   supprimer la note (visible si une note est choisie). Aucune ligne d'info, aucune phrase de résumé. Les logos existants sont REPRIS (règle 2).
3. ✅ **9c — Calque Voix** (livré 05/11 : bouton Voix au logo ⊱ repris, fonctions dans les notes, chemin des voix, nom + degré dans la règle, éteint puis
   mémorisé, premier accord pris si rien n'est choisi ; l'icône ⊱ a quitté l'ordinateur ; inventaire dans `docs/dette-tests.md`). AVANT de fondre : inventaire une à une des fonctions de la conduite de voix (règles de voix, loupe, pincement, zooms, légende, traits)
   avec le banc qui protège chacune ; puis fonction 1/3/5/7 écrite dans la note, trait blanc du chemin des voix. Le panneau séparé ne disparaît qu'une fois
   chaque fonction retrouvée dans le calque.
4. ✅ **9d — Notes manuelles et intensité** (livré 05/11 : pointillés partout à l'ordinateur, pastille en direct, « Revenir » annulable ; bouton Intensité
   après Voix, bande collée sous les notes, voisins pâles, ambre si réglée, une annulation par geste). Notes ajoutées à la main en pointillés, pastille ambre sur la case (existe déjà, lot 5d), « Revenir à l'automatique »
   dans l'inspecteur (existe, lot 6c) ; bande d'intensité (le « mode studio ») sous les notes.

### Risques connus

- Le panneau de conduite de voix n'est construit QUE par `loadProgression` ; le séquenceur par `renderSequencer` : un seul des deux appels oublié = panneau figé
  (déjà arrivé, voir le commentaire de `toggleSequencer`).
- `ZONE_EDITION_SELECTEURS` et `this._popups` (voir `CLAUDE.md`) : tout élément déplacé ou ajouté doit y être déclaré.
- Hauteur : `SEQ_DOCK_RESERVE_CONFORT` et `hauteurMaxVoletSequenceur` mesurent la place libre ; le tiroir du lot 8 en prend déjà (épinglé).
- Le téléphone (< 900 px) ne bouge pas avant le lot 10.

## Lot 10 — le téléphone (découpé le 05/11)

Cahier des charges : `docs/refonte.md`, section « Téléphone » ; maquette : page `project/Telephone2.dc.html` de l'artefact (lire avec l'outil Artifact,
`path`). Rien n'avait bougé sous 900 px depuis le lot 6. Composition de la maquette : barre du haut (logo, titre-menu, Enregistrer, Annuler, compte) ;
onglets en groupe segmenté ; barre-résumé des réglages du morceau (→ quatre grosses cases) + bouton carré « Affichage » ; grille ; panneau qui monte du
bas (accord : ‹ ›, fondamentales 2 × 6, type, durée, « Réglages du son » qui l'agrandit — basse, octave, renversement, jeu, rythme, doigté —, Supprimer,
Dupliquer ; ajout : saisie unique, aide, suggestions, accords de la tonalité ; lecture : tempo −/+/Tap, métronome, Clavier / Guitare / Notes) ; barre de
lecture (Lecture, Stop, « Mes. N » + frise, Boucle, ⋯ qui ouvre le panneau Lecture).

### Découpage (un commit par sous-lot, banc + sabotages à chaque fois)

1. ✅ **10a — Barre du haut et onglets** (livré 05/11, banc `telephone_barre_haut`). Même barre qu'à l'ordinateur, en 44 px, sur deux rangées :
   logo, titre (menu du morceau ; chevron masqué, 14 px), voyant (point seul), Enregistrer (icône seule), Paramètres, compte CARRÉ (habillage CSS) ;
   rangée 2 : onglets Grille / Structure / Paroles (groupe segmenté), Annuler sous Paramètres, Rétablir sous le compte — **décision du 05/11** (la
   maquette n'a ni Rétablir ni Paramètres ; tout sur la 1re rangée laissait ~75 px au titre). La carte Morceau perd son en-tête (liste, six icônes) ;
   Structure s'ouvre en fenêtre SOUS la barre ; Paroles ouvre encore sa page (vue intégrée au 10b). Mots seuls dans les onglets sous 400 px.
2. ✅ **10b — Barre de lecture** (livré 05/11, banc `telephone_barre_lecture`) : `#barre-lecture` au téléphone à la façon de la maquette (Lecture, Stop, « Mes. N » + frise, Boucle, ⋯ → panneau
   Lecture : tempo −/+/Tap, métronome, Clavier / Guitare / Notes) ; le transport quitte `#footer-dock`. Structure et Paroles deviennent des vues
   intégrées au-dessus d'elle (`vuesIntegrees()` vrai partout) : `vues_integrees` (partie F), `onglets` (partie E), `export_lyrics*`,
   `paroles_autoload_back` (qui cliquent `#lyrics-btn` à 800 px pour l'export en nouvel onglet) changent de sens. Risque : `barre_bas_telephone`
   (accès de secours du dock), `mobile_*`, `sentinelle_atteignabilite`.
3. **10c — Réglages du morceau et Affichage** : barre-résumé pleine largeur → quatre cases (Tonalité, Mesure, Swing, Son) sur deux colonnes ; bouton
   carré « Affichage » : Compact (4 mesures / ligne, noms seuls, 44 px), Normal (4 / ligne + degrés, 64 px), Large (2 / ligne, 72 px) ; les zooms H / V
   s'effacent, le pincement reste ; en-tête de partie : nom + « N mesures » + ×N + menu ⋯ (celui du lot 5c).
4. **10d — Panneau d'accord** (remplace la carte Accord et le mode Modification au téléphone) : toucher une case → panneau à mi-hauteur, l'accord
   visible au-dessus ; contenu de la bulle (‹ ›, fondamentales 2 × 6, type, durée) puis « Réglages du son » = contenu de l'inspecteur ; Supprimer,
   Dupliquer ; une annulation par panneau. Bancs : `filet_toujours_visible` (mode Modification au téléphone), `barre_bas_telephone`, `mobile_edit_scroll`.
5. **10e — Panneau d'ajout** (remplace le mode Ajout, la carte Nouvel accord et l'ajout rapide) : case « + » → saisie unique (syntaxe complète),
   aide « ? », suggestions après l'accord précédent, accords de la tonalité. Les **19 bancs joués à 860 px** pour le mode « Ajout » (liste dans
   `docs/dette-tests.md`, lot 6c) sont réécrits pour ce geste.
6. **10f — Éditeur de notes au téléphone** (remplace « Séq. » et l'icône ⊱) : plein écran au-dessus de la barre de lecture, en-tête, outils, calque
   Voix, bande d'intensité, pointillés. `voice_leading`, `vl_loupe`, `vl_pinch`, `voice_leading_section_ops` (partie A à 860 px) réécrits ;
   `calque_voix` et `notes_manuelles_intensite` changent de sens (ils vérifient aujourd'hui que le téléphone n'a pas bougé).

### Dettes connues, à reprendre au fil des sous-lots (liste détaillée dans `docs/dette-tests.md`)
- 19 bancs joués à 860 px parce qu'ils éprouvent le mode « Ajout » de la carte Accord, qui n'existe plus que là (lot 6c) → 10e ;
- l'ancien panneau de conduite de voix (icône ⊱) n'existe plus qu'au téléphone : `voice_leading`, `vl_loupe`, `vl_pinch`, `voice_leading_section_ops` le jouent
  à 860 px (partie A) à côté du calque Voix (partie B) → 10f ;
- l'éditeur de notes au téléphone : « Séq. » ouvre encore le séquenceur d'avant → 10f.
