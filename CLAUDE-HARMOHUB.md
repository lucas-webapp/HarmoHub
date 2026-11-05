# HarmoHub — mémoire de reprise (CLAUDE-HARMOHUB.md)

Mis à jour le 05/11/2026, après le sous-lot « Versions au cloud » (versions des morceaux et des paroles dans Firestore). **Seul fichier où s'écrit l'état du chantier** (`CLAUDE.md` n'en recopie rien). À lire avec `CLAUDE.md` (consignes) et `docs/refonte.md` (règles, feuille de route).

## Suite à faire (lue par `/reprise` — à réécrire à la fin de CHAQUE lot)

- **Décisions du 05/11 (soir), réponses aux points en attente** — elles remplacent les questions « à confirmer » plus bas :
  - **Versions au cloud** : « toutes les versions stockées dans le firestore », celles des **morceaux** ET des **paroles**, donc sur tous les appareils ;
    « s'il y a un problème de place, il faut garder moins de versions que prévu […] le minimum acceptable (environ 3 à 5 versions) ». La page
    Paroles ouverte SEULE doit aussi lister et restaurer ses versions (« oui on restaure »).
  - 10c : (1) le tempo reste dans la barre-résumé ; (2) Compact / Normal / Large et le pincement restent une préférence de l'appareil ; (3) Transposer :
    « fais au plus logique, le but est de garder une option me permettant de transposer le morceau d'un seul clic » → la ligne sous les cases reste.
  - Éditeur de notes : (4) l'éditeur SUIT la sélection (un clic sur une autre case de la grille l'y amène) ; (5) une opération de partie (monter,
    dupliquer, supprimer) garde l'édition OUVERTE ; (6) ouverture sur un accord grave : pas de recentrage (« tu peux me laisser scroller », comme
    GarageBand), rien à changer ; (7) bande de la règle : « au plus cohérent, cela doit me faciliter l'usage » → opaque comme la bande d'intensité ;
    (8) gestes de la bande d'intensité : garder glisser / double-clic (cohérent avec le mode studio).
  - Clavier : (9) « se souvenir de mes derniers paramètres dans chaque morceau » → l'état ouvert / fermé du clavier (tiroir) est retenu PAR MORCEAU ;
    (10) la bulle qui recouvre les touches d'un accord grave : OK tel quel.
  - (11) Clavier / Guitare en plein écran au téléphone avec le 10f, dock de la Modification jusqu'au 10d : OK.
  - Bancs : (12) le relevé compte un FATAL comme rouge, et `ajout_modif` / `duree_sur_la_ligne_accord` sont réparés ; (13) corriger
    `glock_unlock_and_switch` (doigté verrouillé rouvert déverrouillé ; « ce problème était déjà arrivé plusieurs fois et tu avais réussi à le
    réparer » : chercher l'ancien correctif dans `git log`) ; (14) durées par suite dans le relevé et raccourcir les plus lentes, « uniquement si cela
    n'altère pas la qualité des bancs » — et si cela réduit la consommation de tokens.
- ✅ **« Versions au cloud » livré** (05/11, banc `versions_cloud`, `synchro-versions.js`) : un document par morceau (5 + 5 au plus, moins si lourd),
  index `harmohub-versions`, fusion sans doublon, liste et restauration dans les Options de la page Paroles seule.
- **Prochain : sous-lot « Bancs fiables »** (points 12, 13, 14 ci-dessus) : le relevé de `run_all_fast.sh` compte un FATAL comme rouge et
  `ajout_modif` / `duree_sur_la_ligne_accord` sont réparés ; `glock_unlock_and_switch` corrigé (chercher l'ancien correctif dans `git log`) ; durées
  par suite dans le relevé (le ciblé les donne déjà) et raccourcir les plus lentes sans altérer les bancs. On peut commencer sans rien demander.
- **Ensuite, dans cet ordre** : « Éditeur et clavier » (points 4, 5, 7, 9) ; puis 10d (panneau d'accord),
  10e (panneau d'ajout), 10f (éditeur de notes au téléphone). L'utilisateur peut changer l'ordre en lançant `/reprise`.
- **Règle** : à la fin d'un lot, cocher ✅ ici et dans « Lot 10 », puis réécrire cette section avec le sous-lot suivant. S'il n'y a plus rien de prévu, écrire « **Rien de prévu** » : `/reprise` demandera alors à l'utilisateur ce qui vient ensuite.

## Où on en est

- **Livrés** : lots 1 à 9 (fondations, barre de lecture, barre du haut, onglets, grille, bulle + inspecteur, ajout unique + barre de sélection,
  Clavier / Guitare, éditeur de notes : 9a à 9d — l'icône ⊱ de conduite de voix n'existe plus qu'au téléphone). Détail : `docs/dette-tests.md`.
- **Lot 10 en cours** (le téléphone) : découpé en six sous-lots (section « Lot 10 » plus bas) ; **10a livré** (barre du haut et onglets), **10b livré**
  (barre de lecture fixée en bas, panneau Lecture avec tempo, vitesse et métronome, Structure et Paroles en vues intégrées), **10c livré** (barre-résumé
  et quatre cases, Affichage, en-tête de partie), **« Paroles homogènes » livré** (supprimer un morceau supprime ses paroles partout, Ctrl+Z les
  ramène ; synchro des paroles dès l'ouverture une fois connecté, cadre Paroles chargé en arrière-plan ; versions des paroles dans Paramètres ›
  Historique, base `harmohub-historique-paroles` ; banc `paroles_homogenes`), **« Versions au cloud » livré** (les 5 plus récentes versions de
  chaque morceau et de ses paroles dans Firestore, `synchro-versions.js`, banc `versions_cloud`). **Prochain : « Bancs fiables », puis 10d.**
- **Versions au cloud (livré 05/11)** : les deux points des « Paroles homogènes » sont réglés (versions au cloud, liste dans la page Paroles seule).
  Limite : les versions ne sont pas écoutées en continu ; celles des autres appareils arrivent à l'ouverture de l'historique ou des Options de Paroles.
- **Deux décisions du 10c (confirmées le 05/11, voir « Suite à faire »)** : (1) la barre-résumé dit aussi le TEMPO (« C majeur · 120 BPM · 4/4 · Droit · Piano »),
  que la maquette n'y mettait pas — pour tenir son exigence « toujours voir tonalité et tempo » (`filet_toujours_visible`) ; (2) Compact / Normal /
  Large et le pincement du téléphone sont une préférence de l'APPAREIL (`harmohubGrilleTelephone`), pas du morceau : les échelles du morceau restent
  celles de l'ordinateur (un morceau en Détaillé donnait des cases de 103 px au téléphone). Aussi : Transposer garde une ligne sous les cases (absent de
  la maquette, présent avant).
- **Dernier balayage complet** (« Versions au cloud ») : 233 verts, 5 rouges, 7 sans verdict sur 245 suites — exactement la ligne de base de
  `CLAUDE.md`. Un premier passage n'a rien valu : le serveur de test, lancé en tâche de fond par une session précédente, a atteint sa limite de
  temps en plein balayage (des dizaines de « 0 PASS / 1 FAIL »). Le relancer en tâche d'arrière-plan au délai maximal avant un balayage complet.
- **Dettes connues pour le lot 10** : au téléphone, hors barre du haut, onglets, barre de lecture et vues intégrées (10a, 10b), rien n'a bougé depuis
  le lot 6 ; 19 bancs sont joués à 860 px parce qu'ils éprouvent le mode « Ajout » de la carte Accord, qui n'existe plus que là (liste dans
  `docs/dette-tests.md`, lot 6c) → 10e. L'ancien panneau de conduite de voix (icône ⊱) n'existe plus qu'au téléphone : `voice_leading`, `vl_loupe`,
  `vl_pinch`, `voice_leading_section_ops` le jouent à 860 px (partie A) à côté du calque Voix (partie B) ; `calque_voix` et `notes_manuelles_intensite`
  vérifient que le téléphone n'a PAS bougé → ces vérifications changeront de sens au 10f.
- **Points du lot 10b, réponses du 05/11** : la vitesse de lecture est au téléphone (panneau Lecture, mention dorée à côté de « Mes. N ») ; les
  paroles « doivent être connectées au firestore directement, et doivent fonctionner comme la grille ou la structure » — elles le sont déjà
  (`synchro-paroles.js`, document `harmohub-paroles`, envoyé par la vue intégrée elle-même), pas d'entrée .json au menu Fichier ; dupliquer un
  morceau copie désormais ses paroles. **Sous-lot « Paroles homogènes » (livré, voir plus haut)** : (1) supprimer un morceau supprime ses paroles (trace des
  suppressions dans `synchro-paroles.js`) ; (2) synchro des paroles dès l'ouverture de HarmoHub (sans toucher `synchro-cloud.js`, une instance
  par page : par exemple charger le cadre Paroles en arrière-plan une fois connecté) ; (3) **décidé le 05/11** : « Oui tu peux enregistrer les
  paroles automatiquement » — l'enregistrement automatique reste ; (4) **décidé le 05/11** : « Garde en mémoire des sauvegardes précédentes » — les
  paroles gardent leurs versions précédentes et se restaurent, comme les versions automatiques des morceaux (Paramètres › Historique et
  récupération, `historique.js`). Restent aussi du 10b :
  Clavier / Guitare en plein écran (avec le 10f) ; le dock de la Modification (45 px) au-dessus de la barre jusqu'au 10d.
- **Défaut ancien trouvé au 10b** : `ajout_modif` plante (ligne 156) et le relevé le compte vert (journal sans bilan mais avec des PASS) — à traiter hors
  lot, avec la règle du relevé. **Même cas trouvé au 10c** : `duree_sur_la_ligne_accord` plante (`#duration-dd-toggle` invisible) mais imprime un bilan
  vert (16 PASS) après son FATAL — vrai aussi sur le commit d'avant. La règle du relevé devrait compter « FATAL » comme rouge.
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
- **Points ouverts du lot 9c (tranchés le 05/11, voir « Suite à faire » ; constatés, déjà vrais avant le lot, vérifiés sur `649dd77`)** : éditeur ouvert, un clic sur une AUTRE case de la grille la
  sélectionne mais l'éditeur garde l'accord d'avant (on change d'accord par la zone de l'accord voisin, dans l'éditeur) ; une opération de partie (monter, dupliquer,
  supprimer) termine l'édition de l'accord, l'éditeur montre alors l'accord seul. À proposer à l'utilisateur (faire suivre la sélection par l'éditeur ?). Aussi : à
  l'ouverture sur un accord grave, la bande verticale peut s'ouvrir au-dessus des notes (il faut défiler pour les voir).
- **Points ouverts du lot 9d (tranchés le 05/11, voir « Suite à faire »)** : l'ouverture de l'éditeur au-dessus des notes (point du 9c ci-dessus) se voit davantage avec la bande d'intensité allumée
  (mesuré sur le commit d'avant aussi : `scrollTop` 0, notes 416 px plus bas, vue de 194 px) — c'est le premier point à proposer. La bande de la RÈGLE
  (`.seq-ruler-band`) prend `--card-bg`, translucide verre allumé (mesuré : 5,5 % d'opacité) : les notes qui défilent dessous se devinent à travers (la bande d'intensité, elle, est
  opaque). Les gestes de la bande sont ceux du mode studio (glisser, double-clic) ; la maquette faisait tourner les valeurs au clic : à confirmer.
- **Points ouverts du lot 8 (tranchés le 05/11, voir « Suite à faire »)** : le clavier s'ouvre allumé par défaut (la maquette part tiroir fermé) ; la bulle d'accord (~430 px)
  peut recouvrir les touches pour un accord d'une partie basse (on la ferme, la sélection reste).

## Lot 9 — l'éditeur de notes (livré ; repères utiles au 10f)

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

Découpage et livraison (9a à 9d) : `docs/dette-tests.md` et `docs/refonte.md`. Ce qui suit sert encore au lot 10f (éditeur de notes au téléphone).

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
3. ✅ **10c — Réglages du morceau et Affichage** (livré 05/11, banc `telephone_reglages`) : barre-résumé pleine largeur → quatre cases (Tonalité, Mesure, Swing, Son) sur deux colonnes ; bouton
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
