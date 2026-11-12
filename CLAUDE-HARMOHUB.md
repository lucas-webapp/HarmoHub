# HarmoHub — mémoire de reprise (CLAUDE-HARMOHUB.md)

Mis à jour le 12/11/2026, après l'étape 4c, dernière du point D (l'ancien séquenceur n'a plus aucune porte) ; la session suivante (nettoyage, hauteur du panneau Rythme, sélection de la grille, renommage) est décrite dans « Suite à faire ». **Seul fichier où s'écrit l'état du chantier** (`CLAUDE.md` n'en recopie rien). À lire avec `CLAUDE.md` (consignes) et `docs/refonte.md` (règles, feuille de route).

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
- ✅ **« Bancs fiables » livré** (05/11, points 12 à 14) : un FATAL ou une trace de plantage de Node compte ROUGE (les deux relevés) ; huit bancs qui
  plantaient en silence sont réparés (`ajout_modif`, `duree_sur_la_ligne_accord`, `glock_full_real_ui`, `guitar_lock_click`, `grille_raccourcis_clavier`,
  `rangement_fichiers`, `guitar_override`, `zoom_coherence`) ; deux vrais défauts corrigés : le cadenas effacé par une croche de dessin en retard
  (`schedulePlayback`, `_playGen`) et le focus de la case « + » perdu quand on l'engage pendant une modification ; durées dans le relevé, les plus longues
  partent d'abord. Aucun banc raccourci (voir `docs/dette-tests.md`).
- ✅ **« Éditeur et clavier » livré** (06/11, points 4, 5, 7, 9 ; banc `editeur_et_clavier`) : l'éditeur suit la sélection (`selectChord`) ; monter,
  dupliquer, supprimer une partie rouvrent l'accord à sa nouvelle place (`reprendreEditionApresPartie`) ; `.seq-ruler-band` opaque verre allumé ; tiroir
  retenu par morceau dans une table de l'appareil (`harmohubVuesParMorceau`). Défaut ancien corrigé au passage : ouvrir un accord n'empile plus
  d'annulation (`_ouvertureEdition`, `_journalDebutSession` dans `commitLiveEdit`).
- ✅ **10d livré** (06/11, banc `telephone_panneau_accord`) : panneau d'accord du téléphone, détail dans « Lot 10 » et `docs/dette-tests.md`.
- ✅ **Point du 10d réglé** (06/11, commité sans balayage complet, qui vient en fin de 10e) : poignées de durée proportionnelles à la case au doigt (`clamp(12px, 25%, 22px)`).
- ✅ **10e livré** (06/11, banc `telephone_panneau_ajout`, assistant `tests/_ajout.js`) : panneau d'ajout du téléphone, détail dans « Lot 10 » et `docs/dette-tests.md`.
  **Confirmé par l'utilisateur le 06/11** : (1) le curseur n'est pas mis d'office dans la saisie à l'ouverture du panneau (« c'est mieux comme cela, on garde ») ;
  (2) la durée « des prochains accords » n'est plus un réglage de la page au téléphone, chaque accord règle la sienne dans son panneau (« ça me va ») ;
  (3) le panneau d'accord qui défile en interne sur un écran court (664 px) : « ça me convient », rien à changer. Défaut trouvé et corrigé : le clic fantôme hors
  du panneau d'accord (`_paOuvertA`).
- ✅ **10f livré** (07/11, banc `telephone_editeur_notes`) : « Séq. » devient « Notes », l'icône ⊱ disparaît, l'éditeur de l'ordinateur s'ouvre en feuille plein écran
  entre la barre du haut et la barre de lecture ; douze bancs réécrits (liste dans `docs/dette-tests.md`, « lot 10f »). Piège : la porte `#grid-zoom` doit rester à 32px
  (à 44px, le double toucher d'une case n'ouvrait plus le panneau d'accord).
- ✅ **Taille des diagrammes à la poignée livrée** (11/11, banc `vues_taille`) : poignée sur le bord haut du tiroir épinglé, coin de la fenêtre libre qui agrandit aussi le contenu, échelle 0,6 à 2 par appareil
  (`poserEchelleVues`). **Décision du 11/11 : « je n'ai pas besoin des diagrammes en plein écran »** → le 10g (Clavier / Guitare en plein écran au téléphone) est ABANDONNÉ.
- ✅ **Refonte du séquenceur, points A, C, B livrés** (11/11, une seule session, détail dans `docs/dette-tests.md`, cases cochées dans `docs/refonte-sequenceur.md`) :
  - **A** (banc `editeur_notes`) : le Compact provisoire du lot 9a est retiré, la grille garde exactement son affichage séquenceur ouvert (empreinte de chaque case).
  - **C** (banc `recadrage_panneau`) : l'inspecteur **flotte** au bord droit au lieu de réserver une colonne (la grille sautait de 190 px et la rangée de réglages passait sur deux
    lignes à chaque mise en modification, donc à chaque clic séquenceur ouvert) ; il part sous l'ajout rapide et s'arrête au-dessus du séquenceur (`placerInspecteurFlottant`) ;
    l'éditeur qui suit la sélection ne le fait plus apparaître (`editionParSuivi`) ; `editChord` ne recentre plus rien.
  - **B** (banc `clic_ecouter`, assistant `tests/_geste_accord.js`) : un clic / un toucher = sélectionner et entendre ; double-clic / toucher une case déjà choisie = ouvrir (bulle,
    panneau) ; un panneau ouvert suit la case cliquée ; le clic à côté qui le referme garde la sélection ; **retaper le nom** = « Renommer » au clic droit ou à l'appui long
    (nouvelle entrée `rename-chord`), ou une lettre tapée. 33 bancs réécrits pour le geste (liste dans le journal).
  - **À signaler à l'utilisateur (pas bloquant)** : l'inspecteur flottant est un état intermédiaire jusqu'à la fenêtre d'accord unique (3 bis) ; sous ~1150 px de large il peut
    recouvrir la droite d'une fenêtre de grille élargie à la poignée.
- ✅ **D, premier sous-lot livré** (11/11, banc `sequenceur`, 76 vérifications) : module `sequenceur.js` (chargé AVANT `script.js`) + intégration ordinateur — bouton « Séquenceur »
  dans le bloc « Vues », panneau dans le flux au-dessus du tiroir ; une ligne par voix, huit croches par mesure ; motifs fournis par position (règles 3 / 5 notes, basse différente) ;
  clic, peinture, Intensité (nouveau champ `intensiteVoix`, lu par la lecture et les exports via `reglageIntensiteCroche`) ; copier / coller / effacer ; plage à boucler dans la règle ;
  poignée des lignes 22–48. L'ancien séquenceur reste en place. Détail et choix faits en route dans `docs/dette-tests.md`.
  - **À signaler à l'utilisateur (pas bloquant)** : la plage tirée au séquenceur s'aligne sur des accords entiers (la boucle de l'appli repose sur des index d'accords) ; un vieux motif
    à la double-croche s'affiche à la croche et n'est réécrit à la croche que si on retouche l'accord ; ajouter une basse différente après un motif ne réapplique pas le motif.
- ✅ **D, deuxième sous-lot livré** (11/11 nuit, banc `sequenceur_formes`, 75 vérifications, onze sabotages) : **formes enregistrées** au compte (`synchro-formes.js`, chargé AVANT
  `sequenceur.js` ; document `harmohub-formes`, entrées en chaîne JSON, fusion entrée par entrée, suppression tracée, hors ligne d'abord, écoute du seul document via `SYNCHRO.etat`) —
  marque-page, « Forme N » proposé, Entrée / Échap, croches + soudures + intensités par position, × qui supprime (accords « À la main », notes gardées) ; **notes libres** (bouton en face
  de la règle, bande nom + octave + « Ajouter C4 », ligne retenue par la PARTIE — nouveau champ `notesLibres` —, l'accord ne porte la note qu'une fois une croche posée ; voix renumérotées) ;
  **clic droit sur une vignette** (schéma 4 × 8, ▶ via `playSavedChord(…, essai)`, retouche par-dessus le motif fourni, « Rétablir l'original », réapplication au morceau ouvert) ;
  **« Toutes les notes »** (hauteurs utilisées, préférence de l'appareil). Détail et choix dans `docs/dette-tests.md`.
  - **À signaler à l'utilisateur (pas bloquant)** : la barre d'outils passe sur deux rangées à 1440 px (option du cahier : ranger les motifs derrière un bouton « Motifs ») ; une retouche
    de schéma ne réécrit que le morceau ouvert (les autres morceaux la prennent quand on y réapplique le motif) ; en « Toutes les notes » une partie riche fait défiler le séquenceur.
- ✅ **D, troisième sous-lot livré** (12/11, banc `sequenceur_telephone`, 47 vérifications, cinq sabotages) : onglets Accord / Son / Rythme dans le panneau d'accord du téléphone ;
  Rythme y DÉPLACE le séquenceur (`sequenceur.placerTelephone`), réduit à l'accord du panneau (cases de 44 px) ; « Notes » du panneau Lecture → « Séquenceur ». Défaut corrigé :
  colonnes rangées par rang au lieu de l'index d'accord (`colDebut`). Constaté, déjà vrai avant : « Réglages du son » vide la sélection au téléphone.
- ✅ **Deux retours de l'utilisateur livrés le 12/11** (ordinateur) : « toute une barre noire juste pour le bouton fichier » → `#file-menu-btn` après « Enregistrer » dans la barre du haut
  (`placerBoutonFichier`), la rangée du bas disparaît ; « le saut de hauteur pour les diagrammes […] empêcher le piano de se superposer » → le tiroir épinglé reste sur UNE rangée, les
  diagrammes rapetissent quand la largeur manque (`ajusterEchelleVues`), l'échelle choisie reste retenue (banc `vues_taille`, partie G).
- ✅ **D, quatrième et dernier sous-lot livré (12/11) — retrait de l'ancien séquenceur** (découpé en 4a, 4b, 4c) (inventaire du 12/11 : **114 bancs sur 255** le touchent, 66 par `#grid-zoom`) :
  **4a** ordinateur : bouton « Éditeur de notes » (`#grid-zoom`), grand séquenceur `#seq-dock-panel` et sa poignée, loupe, calque Voix ; **4b** le petit séquenceur de l'inspecteur
  (`#arp-sequencer`) ; **4c** la feuille « Séq. » du téléphone (porte `#grid-zoom`, `telephone_editeur_notes`). Chaque étape : bancs RÉÉCRITS pour le nouveau séquenceur (jamais
  supprimés), sabotages, balayage.
  - **Essai à blanc du 12/11** (bouton masqué à l'ordinateur, non commité) : sur les 65 bancs qui citent `#grid-zoom`, **~50 rougissent ou plantent** (liste reproductible : masquer
    `#grid-zoom` sous `min-width: 900px` et rejouer `grep -l grid-zoom tests/*_test.js`).
  - **Décision du 12/11 (« Réécriture courte »)** : un banc qui éprouve une fonction qui DISPARAÎT (loupe, zooms H / V, calque Voix, chemin des voix, l'éditeur de notes lui-même,
    poignée `#seq-dock-resize`) devient une vérification COURTE : l'ancienne porte n'existe plus ET le geste du nouveau séquenceur qui la remplace fonctionne (vrai geste). Ce qui
    RESTE (notes libres, intensité, plage à boucler, copier / coller, motifs, lecture et tête de lecture, sélection suivie) est réécrit EN ENTIER pour le nouveau séquenceur. Le nom du
    banc et son fichier restent ; l'en-tête dit « RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4a) » et ce qui a disparu. Durée estimée : 2 à 3 sessions.
  - ✅ **4a livrée (12/11)** : « Éditeur de notes » a quitté l'ordinateur (et avec lui grand séquenceur, loupe, zooms, poignée, calque Voix) ; réticule repris par le
    nouveau séquenceur ; inspecteur qui suit la sélection séquenceur ouvert ; l'ancien éditeur ouvert au téléphone se referme passé 900 px. **49 bancs réécrits** (liste et
    détail dans `docs/dette-tests.md`), assistant `tests/_retrait_ancien.js`. Le code de l'ancien séquenceur reste (téléphone, inspecteur).
  - ✅ **4b livrée (12/11)** : la porte « Séquenceur » (`#seq-zoom`) et le petit séquenceur (`#arp-sequencer`) ont quitté l'inspecteur de l'ordinateur (et avec eux sa vue
    agrandie, ses zooms, son mode studio, ses outils de sélection / déplacement / duplication) ; un `toggleSequencer('compact')` de programme ouvre le séquenceur du bloc
    « Vues », et le petit séquenceur ouvert au téléphone se referme passé 900 px. **27 bancs réécrits** (liste dans `docs/dette-tests.md`), assistant
    `porteInspecteurAbsente` (`tests/_retrait_ancien.js`). Piège retenu : beaucoup de bancs ouvraient le petit séquenceur par `toggleSequencer()` SANS argument — la recherche
    par nom ne les voit pas, seul un passage avec la garde en place les révèle.
  - ✅ **4c livrée (12/11)** : au téléphone aussi, plus de porte vers l'ancien séquenceur (« Séq. » / « Notes », « Séquenceur » de la carte Accord, petit séquenceur,
    « Rythme » du dock) ; le seul séquenceur du téléphone est l'onglet Rythme du panneau d'accord (porte : « Séquenceur » du panneau Lecture) ; un `toggleSequencer` de
    programme ouvre le séquenceur de l'appareil. **52 bancs réécrits** (liste dans `docs/dette-tests.md`), assistants `porteTelephoneAbsente`, `ouvrirRythmeTel`,
    `poserCrocheTel`… dans `tests/_retrait_ancien.js`. Défauts trouvés et corrigés : ⋯ vidait la sélection, Lecture / Stop refermaient l'onglet Rythme, « Terminer »
    absent après × sur une modification sans panneau. **Le retrait de l'ancien séquenceur (point D) est terminé** ; son code reste dans `script.js` sans porte (nettoyage
    non demandé).
- **Prochain : session « Nettoyage, hauteur du panneau Rythme, sélection de la grille, renommage » — décidée par l'utilisateur le 12/11 (après la 4c)**. Une seule session, un seul
  balayage complet en fin de session (c'est lui qui autorise le push, voir `CLAUDE.md`) ; pendant le travail, balayage CIBLÉ seulement (`bash tests/run_cible.sh`).
  **Consigne de l'utilisateur pour les deux points B : « je ne veux pas de régression complète pour ces deux points simples »** → ne pas lancer de balayage complet pour eux seuls ;
  ils partent avec le balayage complet de fin de session. Ordre conseillé : B1, B2 (petits, visibles), puis A2 et A3, puis la fenêtre d'accord unique (A1) en lot séparé.
  - **A1 — fenêtre d'accord unique : ACCORDÉE par l'utilisateur le 12/11 (« oui je veux bien la fenêtre d'accord unique »)**. C'est le point 3 bis de `docs/refonte-sequenceur.md` :
    au lieu de la bulle d'accord (double-clic) ET de l'inspecteur de droite (« Réglages du son », flottant depuis le point C), UNE seule fenêtre sous la case, qui porte tout ce qui
    règle l'accord, **sans ligne Rythme** (le rythme se règle dans le séquenceur, sans le dire). Elle n'a ni lot ni découpage : **la découper d'abord** (lire 3 bis et la planche A
    de l'artefact https://claude.ai/artifact/PFwjW5A61rHhBUX3cPFCuQ avec l'outil Artifact, `read`), annoncer le découpage à l'utilisateur, puis la faire APRÈS A2, A3, B1, B2 (elle
    touche `bulle-accord`, l'inspecteur, `placerInspecteurFlottant`, `ZONE_EDITION_SELECTEURS`, `this._popups` et beaucoup de bancs — un lot à part, avec son propre balayage
    complet). Le téléphone (< 900 px) reste inchangé : son panneau d'accord existe déjà (10d).
  - **A2 — nettoyage du code mort de l'ancien séquenceur** (accordé : « tu pourras faire le nettoyage »). Retirer de `script.js`, `style.css`, `index.html` ce que la 4a, 4b, 4c
    ont laissé sans porte : `renderSequencer` et `setupSequencerInteractions`, `seqMode` / `seqOpen` / `seqZoomOpen`, `openSeqZoom` / `closeSeqZoom` et `#seq-zoom-overlay`,
    `#arp-sequencer`, `#grid-zoom`, `#seq-zoom`, `#dock-rythme`, `#seq-dock-panel` et `#seq-dock-resize`, l'éditeur de notes (`setupEditeurNotes`, `#editeur-notes-*`), le calque Voix et
    `buildVoiceLeadingPanelHtml` / `toggleVoiceLeadingPanel`, les zooms `seqInline`. **Méthode** : inventaire par `grep` AVANT, retrait par petits paquets, `run_cible` à chaque paquet ;
    ne rien retirer qui serve encore au nouveau séquenceur (`sequenceur.js`) ni aux exports / à la lecture (`getLiveSeqPattern`, `applySeqCell`, `readChord`… à vérifier un par un) ;
    `toggleSequencer` reste (garde des appels de programme, bancs `telephone_editeur_notes`). Les bancs qui citent un id retiré sont **réécrits, jamais supprimés** ; la méta-suite
    et la sentinelle d'adresses diront ce qui manque. Incrémenter `?v=`.
  - **A3 — défaut de hauteur du panneau Rythme au téléphone** (« règle ce défaut de hauteur »). À 390 × 844, la barre d'outils du séquenceur (motifs, vue, portée, copier / coller)
    prend le haut du panneau d'accord : la grille de croches commence vers 660 px et il faut faire défiler le panneau pour voir toutes les lignes. Objectif : toutes les lignes visibles
    d'un accord de 4 sons sans défiler, sur 390 × 844 ET 390 × 664 si possible (la rangée des motifs peut passer sur une seule ligne défilante de côté, la portée et les outils se ranger sur
    une seule rangée de boutons de 44 px, le titre du panneau se raccourcir). Banc : `sequenceur_telephone` (partie B) + une vérification de hauteur ; le téléphone reste gardé par
    `bulleDisponible()` / media query.
  - **B1 — nouvelle apparence de la case sélectionnée de la grille** (ordinateur ET téléphone, sélection = bleue, règle de `CLAUDE.md` : « Sélection bleue, lecture verte, plage à boucler
    orange »). L'utilisateur : « la couleur bleue des cases sélectionnées […] ne va pas avec le design de l'application ». **Demande : lui proposer 3 artefacts** (outil Artifact, la
    skill `artifact-design` à charger d'abord), chacun avec un effet DIFFÉRENT — par exemple reflet, brillance, liseré lumineux — rendus sur de vraies cases de la grille (mêmes
    dimensions, verre éteint et allumé, une case sélectionnée seule, une sélection multiple, la case en lecture verte à côté, la case de la plage à boucler orange à côté) pour qu'il
    CHOISISSE. Ne rien modifier dans l'appli avant son choix. Le choix fait : changer `style.css` (bloc en fin de fichier), `verre-surfaces.css` + `verre_test` si une surface change,
    et les bancs qui lisent la couleur de sélection (chercher `rgb` bleus de `.grid-cell.selected` dans `tests/`). **Rappeler que la sélection reste identifiable comme « bleue »
    pour les bancs et pour le sens** (ne pas la mélanger au vert de la lecture ni à l'orange de la boucle).
  - **B2 — renommage de l'accord directement dans la grille** (retour : « souvent je clique sur la case et je me retrouve dans l'encart de modification de texte ; sa zone de
    fonctionnement semble trop large »). État d'origine : depuis le point B de la refonte du séquenceur, **retaper le nom** d'un accord est « Renommer » au clic droit / appui long
    (`rename-chord`) ou une lettre tapée ; le clic sur le nom d'une case choisie déclenche encore `startInlineChordSymbolEdit` (à chercher : le gestionnaire du clic sur le symbole
    dans `loadProgression` / `onGridPointerUp`). **À trouver d'abord** : par quel geste exact l'encart s'ouvre sans qu'on le veuille (clic sur une case déjà sélectionnée ? clic sur la
    zone du nom, qui est large ?) — le MESURER avec un banc avant de corriger. Proposition de l'utilisateur : « au double-clic sur le centre du texte » ; il laisse le choix des
    meilleures idées : (a) la zone active se limite au TEXTE du nom (`getBoundingClientRect` du `.chord-name` ou équivalent, pas toute la case) ; (b) double-clic (ordinateur) /
    double toucher (téléphone) sur ce texte ; (c) un clic simple sur une case ne l'ouvre JAMAIS. **Attention** : le double-clic ouvre déjà la bulle d'accord (point B, `clic_ecouter`) :
    il faut arbitrer et le dire à l'utilisateur AVANT de coder si le double-clic sur le nom doit renommer plutôt qu'ouvrir la bulle (alors la bulle s'ouvre par le double-clic
    HORS du texte, ou par « Modifier »). Bancs : `clic_ecouter`, `grille_clic_et_double_clic`, `probe_clic_accord_voisin`, `telephone_panneau_accord`, `editeur_et_clavier` ; réécrire,
    jamais supprimer ; un banc d'abord ROUGE pour le défaut mesuré, puis vert.
- **Règle** : à la fin d'un lot, cocher ✅ ici et dans « Lot 10 », puis réécrire cette section avec le sous-lot suivant. S'il n'y a plus rien de prévu, écrire « **Rien de prévu** » : `/reprise` demandera alors à l'utilisateur ce qui vient ensuite.

## Où on en est

- **Livrés** : lots 1 à 9 (fondations, barre de lecture, barre du haut, onglets, grille, bulle + inspecteur, ajout unique + barre de sélection,
  Clavier / Guitare, éditeur de notes : 9a à 9d — l'icône ⊱ de conduite de voix n'existe plus qu'au téléphone). Détail : `docs/dette-tests.md`.
- **Lot 10 en cours** (le téléphone) : découpé en six sous-lots (section « Lot 10 » plus bas) ; **10a livré** (barre du haut et onglets), **10b livré**
  (barre de lecture fixée en bas, panneau Lecture avec tempo, vitesse et métronome, Structure et Paroles en vues intégrées), **10c livré** (barre-résumé
  et quatre cases, Affichage, en-tête de partie), **« Paroles homogènes » livré** (supprimer un morceau supprime ses paroles partout, Ctrl+Z les
  ramène ; synchro des paroles dès l'ouverture une fois connecté, cadre Paroles chargé en arrière-plan ; versions des paroles dans Paramètres ›
  Historique, base `harmohub-historique-paroles` ; banc `paroles_homogenes`), **« Versions au cloud » livré** (les 5 plus récentes versions de
  chaque morceau et de ses paroles dans Firestore, `synchro-versions.js`, banc `versions_cloud`), **« Éditeur et clavier » livré** (06/11), **10d livré** (06/11 : panneau d'accord), **10e livré** (06/11 : panneau d'ajout), **10f livré** (07/11 : éditeur de notes). **Lot 10 terminé** (10g abandonné le 11/11).
- **Versions au cloud (livré 05/11)** : les deux points des « Paroles homogènes » sont réglés (versions au cloud, liste dans la page Paroles seule).
  Limite : les versions ne sont pas écoutées en continu ; celles des autres appareils arrivent à l'ouverture de l'historique ou des Options de Paroles.
- **Deux décisions du 10c (confirmées le 05/11, voir « Suite à faire »)** : (1) la barre-résumé dit aussi le TEMPO (« C majeur · 120 BPM · 4/4 · Droit · Piano »),
  que la maquette n'y mettait pas — pour tenir son exigence « toujours voir tonalité et tempo » (`filet_toujours_visible`) ; (2) Compact / Normal /
  Large et le pincement du téléphone sont une préférence de l'APPAREIL (`harmohubGrilleTelephone`), pas du morceau : les échelles du morceau restent
  celles de l'ordinateur (un morceau en Détaillé donnait des cases de 103 px au téléphone). Aussi : Transposer garde une ligne sous les cases (absent de
  la maquette, présent avant).
- **Dernier balayage complet** (retrait de l'ancien séquenceur, étape 4c, 12/11) : **251 verts, 0 rouge, 4 sans verdict sur 255 suites** (3131 s cumulées) — après correction de
  `grid_scroll_axis` (page 32 px plus courte sans la rangée « Séq. » : fenêtre du banc resserrée). **Nouvelle ligne de base** : **0 rouge** (`seq_notes_libres_clavier` est vert) et
  4 « sans verdict » (`detune`, `instrument_stress`, `probe_cache_perime`, `smoke` ; `ctx_nav_scroll` rend un verdict). Précédent : étape 4b (12/11) : **249 verts, 1 rouge, 5 sans verdict sur 255 suites** (3109 s cumulées) — le rouge est
  `seq_notes_libres_clavier` (ligne de base, sa partie téléphone). **Ligne de base de fait** : 1 rouge (`seq_notes_libres_clavier`) et 5 « sans verdict » (`ctx_nav_scroll`,
  `detune`, `instrument_stress`, `probe_cache_perime`, `smoke`) ; `item1_hzoom_out` rend désormais un verdict (vert). Étape 4a (12/11) : 247 verts, 2 rouges, 6 sans verdict.
- **Balayage précédent** (séquenceur D, troisième sous-lot, 12/11) : **243 verts, 6 rouges, 6 sans verdict sur 255 suites** (3213 s cumulées) — la ligne de base plus
  `glock_playprogression` (« la lecture affiche le doigté verrouillé », mesure en temps réel), rouge sous la charge du balayage seulement : vert 3 fois sur 3 seul et 4 fois sur 4 en quatre
  copies parallèles ; séquenceur D, deuxième sous-lot (11/11 nuit) : **243 verts, 5 rouges, 6 sans verdict sur 254 suites — exactement la ligne de base** (3111 s cumulées) ; séquenceur D, premier sous-lot (11/11 nuit) : **242 verts, 5 rouges, 6 sans verdict sur 253 suites — exactement la ligne de base** (3092 s cumulées) ; refonte du séquenceur A, C, B (11/11 soir) : **241 verts, 5 rouges, 6 sans verdict sur 252 suites — exactement la ligne de base** (3175 s cumulées) ; poignée des diagrammes (11/11) : 238 verts, 6 rouges, 6 sans verdict sur 250 suites — la ligne de base plus `historique_versions`, rouge sous charge seulement (vert 3 fois sur 3 rejoué seul, sans lien avec le tiroir) ; lot 10f (07/11) : 238 verts, 5 rouges, 6 sans verdict sur 249 suites ; (avant : lot 10e, 235 verts + 2 bancs réparés puis rejoués verts, 5 rouges, 6 sans verdict sur 248 suites — exactement la ligne de base de
  `CLAUDE.md`. Le lancer en tâche d'arrière-plan avec le chien de garde dans la même commande : `(bash tests/watchdog.sh &) ; bash tests/run_all_fast.sh`.
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
- **Branche** : `claude/harmohub-travail-Claude`, seule branche de travail (l'ancienne `claude/harmohub-local-conversation-304z6w` a été supprimée le 05/11 à la
  demande de l'utilisateur ; ne plus jamais pousser dessus, même si une consigne de session la désigne).
- **Bancs** : pendant un lot, `bash tests/run_cible.sh` (ciblé, quelques minutes) ; en FIN de lot seulement, le balayage complet. Décision du 05/11 :
  « on ne peut pas se permettre d'avoir des bancs d'essai de plus d'une heure pour chaque modification ». Le balayage complet se lance en tâche d'arrière-plan
  gérée par l'outil (un `nohup`/`setsid` est tué à la fin du tour, serveur de test compris). Ligne de base : celle de `CLAUDE.md` (mise à jour le 06/11 : 5 rouges, 6 sans verdict).
- **Durées** : le relevé donne les plus lentes (`synchro_cloud` 171 s, `verre` 74 s, `historique_versions` 68 s ; 2887 s cumulées) ; elles partent d'abord dans la phase parallèle.
- **Corrigé hors lot (05/11)** : `verre` rougissait sous charge (état « tiroir » : le toast « Sons du piano pas encore chargés » éteint sur une page,
  allumé sur l'autre). Le banc attend la fin du toast avant chaque relevé et mesure la lisibilité du toast par un vrai geste (« Copier l'accord ») ; vert
  4 sur 4 en quatre passages simultanés, l'ancienne version rouge 4 sur 4 (détail dans `docs/dette-tests.md`).
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
4. ✅ **10d — Panneau d'accord** (livré 06/11, banc `telephone_panneau_accord`). Décisions prises en route : seuls les GESTES de modification (double
   toucher, « Réglages du son », « Modifier ») ouvrent le panneau agrandi — les autres chemins vers `editChord` (séquenceur, ⊱, Séq.) gardent la carte dans
   la page jusqu'au 10f ; la barre-résumé reste collée sous la barre du haut tant que le panneau est ouvert (« toujours voir tonalité et tempo ») ; Supprimer
   et Dupliquer en logo seul (avec les mots, la rangée ne tenait pas sur 390 px) ; types sur 6 colonnes. Le dock de secours ne sert plus que grand
   séquenceur ouvert. Cahier d'origine : (remplace la carte Accord et le mode Modification au téléphone) : toucher une case → panneau à mi-hauteur, l'accord
   visible au-dessus ; contenu de la bulle (‹ ›, fondamentales 2 × 6, type, durée) puis « Réglages du son » = contenu de l'inspecteur ; Supprimer,
   Dupliquer ; une annulation par panneau. Bancs : `filet_toujours_visible` (mode Modification au téléphone), `barre_bas_telephone`, `mobile_edit_scroll`.
5. ✅ **10e — Panneau d'ajout** (livré 06/11, banc `telephone_panneau_ajout` ; remplace le mode Ajout, la carte Nouvel accord et l'ajout rapide) : case « + » → saisie unique (syntaxe complète),
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
