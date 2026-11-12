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

### A. La grille ne bouge plus quand le séquenceur s'ouvre — ✅ livré le 11/11 (banc `editeur_notes`, empreinte de la grille)
- Supprimer le **Compact provisoire** de l'éditeur de notes (décision du 05/11, lot 9a, **annulée**) : `entrerCompactProvisoire`, `sortirCompactProvisoire`,
  `poserAffichageGrilleProvisoire`, `abandonnerCompactProvisoire`, `_affichageAvantEditeur`, et leurs appels dans `majEditeurNotes` et au changement de morceau
  (`script.js`, autour de 19740 et 11997).
- La grille garde Compact / Normal / Détaillé, sa largeur et sa hauteur de cases ; le séquenceur s'ouvre en dessous, la page défile au besoin.
- Bancs à réécrire (jamais supprimer) : `editeur_notes` (partie « Compact provisoire »), `editeur_et_clavier`, `editeur_notes_outils`, `calque_voix`, `vues_tiroir` s'ils
  lisent `densite-compact` à l'ouverture ; ajouter une vérification « la grille a exactement le même affichage séquenceur ouvert ».

### B. Le clic sur un accord : écouter sans ouvrir (planche 4 de la maquette) — ✅ livré le 11/11 (banc `clic_ecouter` ; renommer : « Renommer » au clic droit)
- **Un clic ou un toucher** sur une case : la case est sélectionnée (bleu) et l'accord est joué (halo vert le temps du son). **Rien ne s'ouvre.**
- **Double-clic**, ou toucher une case **déjà sélectionnée** : ouvre le panneau de l'accord (bulle à l'ordinateur, panneau du bas au téléphone).
- Échap ou clic à côté referme ; la sélection reste.
- **Fenêtre d'accord** (planche A, voir 3 bis) : le double-clic ouvre une fenêtre sous la case, qui remplace la bulle et l'inspecteur de droite.
- À confirmer avec l'utilisateur au moment de coder : le geste exact sur ordinateur (aujourd'hui le clic ouvre la bulle, lot 6b) — l'option B proposée était un
  réglage « Ouvrir le panneau au clic » oui / non ; l'option A (ci-dessus) a été préférée dans la maquette.
- Bancs concernés : `bulle_accord*`, `telephone_panneau_accord`, `filet_*`, `mobile_*`, `probe_clic_accord_voisin`, `sentinelle_atteignabilite` (nombreux : lancer
  `bash tests/run_cible.sh --liste` après le changement de `selectChord` / `ouvrirBulle` / `ouvrirPanneauAccord`).

### C. Le panneau ne recadre plus l'écran — ✅ livré le 11/11 (banc `recadrage_panneau` ; l'inspecteur flotte au lieu de réserver une colonne)
- `ouvrirPanneauAccord` appelle `assurerCaseVisiblePanneau` ; la bulle à l'ordinateur fait défiler la page : supprimer les défilements automatiques à l'ouverture.
- Règle : **ne bouger l'écran que si la case touchée finit cachée sous le panneau, et du strict minimum** (jamais de recentrage).
- Bancs : `telephone_panneau_accord`, `mobile_edit_scroll`, `mobile_scroll`, `bulle_*`.

### D. Un seul séquenceur (remplace le grand séquenceur, le petit séquenceur de l'inspecteur / du panneau, la loupe)
Voir la section 3 : c'est le gros morceau (module `sequenceur.js` écrit de zéro, dessiné d'un seul bloc ; l'ancien reste en place jusqu'à la bascule).
- ✅ **Premier sous-lot livré le 11/11** (banc `sequenceur`) : module `sequenceur.js` + intégration à l'ordinateur (bouton du bloc « Vues », au-dessus du tiroir ; motifs fournis par
  position, peinture, Intensité, copier / coller / effacer, plage à boucler dans la règle, poignée des lignes). Détail et choix faits en route : `docs/dette-tests.md`.
- ✅ **Deuxième sous-lot livré le 11/11 (nuit)** (banc `sequenceur_formes`) : formes enregistrées au compte (`synchro-formes.js`, document `harmohub-formes`), notes libres (bouton
  dans la colonne des noms, ligne retenue par la partie), clic droit sur une vignette (retouche par-dessus, « Rétablir l'original »), vue « Toutes les notes ». Détail : `docs/dette-tests.md`.
- ✅ **Troisième sous-lot livré le 12/11** (banc `sequenceur_telephone`) : onglets Accord / Son / Rythme dans le panneau d'accord ; le séquenceur y est déplacé, réduit à l'accord du
  panneau (cases de 44 px) ; « Notes » → « Séquenceur » dans le panneau Lecture. Détail : `docs/dette-tests.md`.
- ✅ **Retrait de l'ancien séquenceur livré le 12/11** (et de « Séq. » / « Éditeur de notes ») et réécriture de ses bancs — en trois étapes : ✅ **4a ordinateur** (12/11 : « Éditeur de notes »,
  grand séquenceur, loupe, calque Voix ; 49 bancs réécrits), [x] 4b petit séquenceur de l'inspecteur (12/11 : porte « Séquenceur » et petit séquenceur retirés de l'ordinateur ; 27 bancs réécrits), [x] 4c feuille « Séq. » du téléphone (12/11 : portes de l'ancien séquenceur retirées du téléphone, son séquenceur est l'onglet Rythme ; 52 bancs réécrits).

## 3. Le nouveau séquenceur — décisions de la maquette

**Principe** : UN seul séquenceur, **une ligne par voix** (basse, voix 2, voix 3, aiguë) et non une ligne par demi-ton. Huit croches par accord. **Pas de zoom, pas de
loupe, pas de poignée de hauteur, pas de « Étendre »** : toute la partie tient à l'écran. Placé **en bas de l'écran, au-dessus de la barre de lecture et sous les diagrammes** (ordinateur, voir 3 bis), dans le panneau de l'accord (téléphone,
onglet « Rythme » à côté de « Accord » et « Son »).

### Barre d'outils, de gauche à droite
1. **Pas de Lecture / Stop propres au séquenceur** (décision finale du 11/11, après un premier essai en tête de barre) : la **barre de lecture de l'application** (en bas) pilote
   la grille ET le séquenceur. Pour jouer un ou deux accords en boucle, on place la **barre orange** au-dessus du séquenceur ; « Lecture » ne joue alors que cette plage.
   Retirer le Lecture / Stop du séquenceur actuel (`#seq-play`, `#seq-stop`) et ses bancs (`pinned_seq_toolbar`, `probe_seq_*`).
2. **Motifs** en vignettes dessinées **comme le vrai séquenceur** (croches voisines soudées en barres aux bouts arrondis, croche isolée = petit plot ; « Plaqué » = quatre longues barres) (**pas de titre « Rythme »**, il n'apporte rien : la barre commence directement par les vignettes) (Plaqué, Arpège ↑, Arpège ↓, Pompe, Ballade, À la main) + **formes enregistrées par l'utilisateur** (vignette, nom, petit × pour la
   supprimer). Un motif s'applique à « Toute la partie » ou à « Cet accord » (groupe segmenté à droite). Appliquer un motif **ne réécrit que les quatre voix** : les
   notes libres restent.
3. **Enregistrer la forme** : logo « marque-page » **repris de TrainHub** (réglages de paliers du métronome, `M6 4h12v17l-6-4-6 4z`). Un clic propose d'office un nom
   (« Forme 1 », sélectionné), Entrée valide, Échap annule. La forme garde les croches ET leurs intensités (voix 1 à 4). Supprimer une forme : les accords qui
   l'utilisaient gardent leurs notes (ils passent « À la main »).
4. **Intensité** : bouton avec le **logo du mode studio existant**. Éteint (par défaut) : un clic pose ou enlève une note, tout au même niveau (normal). Allumé :
   un clic sur une note fait tourner **normal → fort → doux → enlevée**. Niveaux lus à l'opacité de la note, liseré plus épais pour « fort ». Les intensités réglées
   sont gardées quand on éteint. **Le premier temps n'est pas plus appuyé que les autres** dans les motifs fournis (tout en « normal »).
5. **Note libre** : bouton « note de musique » **à gauche, dans la colonne des noms de notes, juste au-dessus d'eux, en face de la règle** (ni en dessous, où il se déplaçait à chaque ligne ajoutée, ni dans la barre d'outils). Il déplie une bande :
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
- **Une note tenue = une barre continue** (croches soudées : sans coins ni espace) ; une croche seule reste un plot court (staccato). **Changé le 13/11 (retour de l'utilisateur sur le séquenceur du téléphone) : deux notes posées côte à côte restent DEUX attaques** (« 2 notes consécutives ne doivent pas constituer une note tenue ») ; une note tenue se fait exprès — en peignant d'un trait (glissé à la souris, mode « Dessiner » au doigt) ou par « Prolonger d'une croche » (clic droit, appui long). **Enlever une croche d'une note tenue enlève la note ENTIÈRE** ; « Scinder la note » (clic droit, appui long) la coupe à la croche visée. Au téléphone, le séquenceur est en **plein écran** (onglet Rythme : toute la place entre la barre du haut et la barre de lecture, sans pied de panneau), « Toute la partie » défile de côté, un glissé au doigt défile sans toucher aux notes. Le nom de la note
  est écrit au début de la barre. Couleurs des rôles inchangées (1 vert, 3 bleu, 5 rouge, 7 ambre ; note libre violette).
- **Aucune légende, aucune ligne d'aide** dans l'appli (la maquette en avait pour être lisible seule).
- **Le son** : un clic sur une case de la grille joue l'accord ; poser ou changer une note la fait entendre à son niveau ; « Lecture » joue avec les intensités. Dans
  l'appli : l'instrument du morceau.

### Accords de 3, 5 ou 6 notes (question de l'utilisateur, 11/11 — règle proposée, à confirmer)
- **Pas de filtre** à mettre dans les enregistrements. Le nombre de lignes suit l'accord ; une partie affiche autant de lignes que son accord le plus riche, un accord plus pauvre laisse
  les lignes qu'il n'a pas **vides (sans hachures)**.
- Un **motif** ou une **forme enregistrée** est écrit **par position** (basse, aiguë, voix du milieu), pas par note. Appliqué à un accord de moins de voix : on garde toujours la basse
  et l'aiguë, les voix du milieu en trop **se fondent** dans la voisine (leurs croches s'ajoutent). Avec plus de voix : voir la règle des notes en plus ci-dessous.
- **Rien n'est perdu** : le rythme d'origine reste stocké avec l'accord ; repasser un accord de 3 à 4 notes rend les croches de la voix en trop.
- **Renversements, basses différentes, drops, octaves** (11/11 : « bien adapter les rythmes types lorsqu'il y a des renversements ») : les voix sont rangées de la plus grave à la plus
  aiguë **d'après les notes réellement jouées** (renversement, octave, drop compris). La voix 1 est toujours la note la plus grave ; le rythme reste le même, seules les notes
  changent (les rôles 1, 3, 5, 7 gardent leurs couleurs). Une **basse différente** (`C_E`) est une voix à part tout en bas, même hors de l'accord ; elle prend le rythme de la basse du
  motif (ou, si elle double une autre voix, celui de la basse seule). Un arpège « monte » donc toujours du plus grave au plus aigu, jamais dans l'ordre des degrés.
  **Banc à écrire** : chaque motif × position fondamentale / renversements / basse différente / drop 2 et 3.
- **Notes en plus (accords de 5 ou 6 notes : 9es, 11es, 13es)** — règle du 11/11, d'après l'idée de l'utilisateur (« suivre la basse si les autres notes sont jouées que de temps
  en temps ; si toutes les notes sont jouées de la même façon, la note en plus doit suivre le schéma des autres notes ») :
  1. On regarde les voix **au-dessus de la basse** dans le motif (voix 2, 3 et aiguë), croches seules, sans tenir compte des intensités.
  2. **Si elles ont toutes le même rythme** (elles frappent ensemble : Plaqué, Pompe, accords répétés), la note en plus **prend ce rythme commun** : elle sonne avec le bloc de l'accord.
     Son intensité est celle de la voix voisine, croche par croche.
  3. **Sinon** (elles jouent chacune à son tour : Arpège ↑, Arpège ↓, rythmes croisés), la note en plus **suit la basse** : elle colore la basse sans casser le dessin de l'arpège.
     Intensité : celle de la basse.
  4. Cas limites : basse muette dans le motif → la note en plus suit la voix la plus proche d'elle en hauteur ; motif vide (« À la main » sans rien) → ligne vide.
  5. Deux notes en plus (accord de 6 notes) : chacune suit la même règle (même décision pour les deux).
  6. La règle ne fait que **proposer un point de départ** : les lignes en plus restent des lignes normales, qu'on retouche à la main ; une retouche est gardée (l'accord passe « À la main »).
  7. Les formes enregistrées par l'utilisateur (4 positions) suivent la même règle.
  **Confirmée le 11/11** (« Ok ça me va »).
  **Banc à écrire** : chaque motif fourni × accord à 5 et 6 notes, avec le rythme attendu de chaque ligne en plus (bloc commun ou basse) ; sabotage : inverser les deux cas.

### Modifier un schéma (clic droit sur une vignette, 11/11 — fait dans la maquette)
- **Un schéma SANS notes** (4 voix × 8 croches, de l'aiguë à la basse) retouché dans une petite bande dépliée sous la barre d'outils, **pas sur la vraie grille** : la grille est liée à un
  accord (notes, renversement) et on risquerait d'écraser un vrai rythme ; le schéma vaut pour tous les accords (règle « par position »).
- La bande : la grille du schéma (un clic pose ou enlève une croche — dans ce petit éditeur sans menu, enlever une croche d'une barre la coupe en deux, comme avant ; des croches posées une à une ne se soudent plus), le nom modifiable, ▶ pour l'entendre sur l'accord choisi, Enregistrer,
  Annuler ; « Rétablir l'original » sur un motif fourni (les retouches se posent PAR-DESSUS, l'original n'est jamais perdu) ; « Supprimer » sur une forme de l'utilisateur.
- À l'enregistrement, les accords qui suivent ce schéma le suivent dans sa nouvelle version. « À la main » n'a pas de clic droit (rien à retoucher).

### Vue « Toutes les notes » (planche 2)
Seulement les **hauteurs utilisées** par la partie (jamais 60 lignes) pour ajouter une note hors de l'accord ; notes ajoutées à la main en pointillés. À préciser
au codage : bascule Voix / Toutes les notes dans la barre.

### Ce qui disparaît (à retirer proprement, bancs réécrits, jamais supprimés)
Bulle d'accord et inspecteur de droite (remplacés par la fenêtre d'accord unique, 3 bis), bouton « Séq. » `#grid-zoom` (remplacé par le bloc « Vues » de la barre de lecture), grand séquenceur et petit séquenceur (deux affichages), zoom H / V, loupe, « Étendre », poignée `#seq-dock-resize`, outils crayon / gomme / sélection, calque Voix à
allumer (le chemin des voix est supprimé, décision du 11/11), bande d'intensité séparée, mode studio comme mode à part (son logo est repris pour le
bouton Intensité). Les bancs `probe_seq_*`, `seq_*`, `voice_leading*`, `vl_*`, `calque_voix`, `notes_manuelles_intensite`, `editeur_notes*`, `pinned_seq_toolbar`,
`loupe_*`, `sidebar_collapse_seq_height`, `volet_hauteur_poignee` (voir « Lot 9 » dans `CLAUDE-HARMOHUB.md`) sont à réécrire pour les nouveaux gestes.

**Position de la barre d'outils** (décision du 11/11) : elle reste **au-dessus** des notes (toujours visible, place habituelle des logiciels de musique, ne bouge pas quand
des lignes s'ajoutent). Option offerte, non demandée : ranger les vignettes de motifs derrière un seul bouton « Motifs » si elles prennent trop de place.

## 3 bis. Intégration dans l'application (artefact « HarmoHub — intégration et affichage », planche A, version 26, 11/11)
Artefact : https://claude.ai/artifact/PFwjW5A61rHhBUX3cPFCuQ (planche A = proposition cliquable, **validée par l'utilisateur le 11/11 : « l'affichage me paraît bien maintenant »** ; B1 à B7 = captures
réelles de l'application d'aujourd'hui). **La planche A fait foi** pour la disposition générale ; la maquette du séquenceur (section 3) fait foi pour le séquenceur lui-même.

### Nom et accès
- Le « grand séquenceur » / « éditeur de notes » s'appelle désormais **« Séquenceur »** partout (boutons, infobulles, journal). Au téléphone, le bouton « Notes » du panneau Lecture devient « Séquenceur ».
- Le bouton « Séq. » de la rangée de réglages (`#grid-zoom`) **disparaît à l'ordinateur** : le séquenceur, le Clavier et la Guitare s'ouvrent et se ferment par **trois boutons-bascules**
  réunis dans un bloc « Vues » à droite de la barre de lecture (logos existants repris tels quels ; le bloc n'a pas de titre en dehors d'une infobulle).
- La rangée Tonalité / Mesure / Swing / Son / Transposer et le groupe Compact / Normal / Détaillé ne changent pas.

### Disposition de l'écran (ordinateur) — règle générale
- **Du bas vers le haut : barre de lecture, diagrammes (Clavier / Guitare), séquenceur ; la grille prend tout le reste** et défile en interne si besoin. Les panneaux ouverts se collent en bas ;
  la grille garde son affichage (règle A) et ne saute pas quand un panneau s'ouvre ou se ferme. Rien n'est jamais caché derrière la barre de lecture.
- **Tiroir des diagrammes** : poignée sur son bord haut (déjà livrée, échelle 0,6 à 2 par appareil). Proportions : guitare 200 × 96 px, piano 270 × 60 px (échelle 1) ; écarts de 64 px entre
  deux diagrammes à l'échelle 1 et de 48 px entre le clavier et la guitare. Si la place manque pour le diagramme ET le nom du rythme type dans une vignette, **garder le diagramme** (nom en infobulle).
- **Poignée de hauteur du séquenceur, règle définitive** (« je veux régler ça une bonne fois pour toutes ») : (1) le séquenceur prend seulement la place de ses lignes (son cadre épouse
  ses lignes, plus de grand vide noir) ; (2) la poignée ne règle que la hauteur des LIGNES, de 22 à 48 px (30 par défaut), double-clic = hauteur d'origine ; barre d'outils (boutons de 32 px),
  règle et noms de notes ne changent JAMAIS de taille ; (3) la poignée ne peut pas dépasser la place libre : elle s'arrête quand le séquenceur et le tiroir toucheraient la barre du haut, **rien n'est
  jamais caché** ; (4) écran trop court : le séquenceur défile en interne, barre d'outils et règle collées en haut. **Banc** : fenêtres de 600, 700, 900 px de haut, aucune partie du
  séquenceur hors écran, poignée toujours atteignable. Les noms de notes disparaissent des cases sous ~24 px de haut.
- **Aspect des lignes** (proche du vrai séquenceur) : bandes alternées, un trait à chaque temps, un trait plus marqué à chaque début de mesure ; noms de notes à gauche dessinés comme des
  touches de piano (blanches pour les naturelles, sombres pour les dièses).
- **Geste de pose** : cliquer-glisser sur les cases **peint** plusieurs croches d'un coup (on pose ou on enlève selon l'état de la première case touchée) ; pas de glisser-déposer au pixel près.

### Barre du haut, onglets, barre de lecture
- **Onglets Grille / Structure / Paroles** : de VRAIS onglets, larges (150 px minimum, 28 px de marge de chaque côté), sur toute la hauteur de la barre du haut, sans cadre de bouton ;
  actif = vert, gras, trait de 3 px dessous et léger fond vert ; les autres gris, sans trait. (Aujourd'hui : un groupe segmenté qui ressemble à des boutons.)
- **Barre de lecture unique**, tout le bloc à **44 px** de haut : Lecture, Stop, « Mes. N », **frise des parties réduite (≈ 260 px de large**, la place libérée reste vide avant le tempo), cadran du
  tempo et ses chevrons, bloc « Vues » (Séquenceur / Clavier / Guitare).
- **Couleurs de la frise = couleurs des parties de la Structure** (même famille : `#00e676`, `#40c4ff`, `#ffb300`, `#ff6f61`, `#b388ff`, `#4db6ac`, `#f06292`, `#aed581`), pour qu'une partie ait la
  même couleur dans la frise et dans l'onglet Structure.
- **Tempo comme TrainHub** : un cadran avec le chiffre ; glisser vers le haut ou le bas règle (1 BPM tous les 4 px), la molette affine d'un cran, un clic sur le chiffre ouvre la saisie
  au clavier (30 à 300, Entrée valide, Échap annule) ; **deux petits chevrons ‹ › sans cadre** (20 px) de part et d'autre du chiffre, pas de gros boutons − / +.

### La fenêtre d'un accord (double-clic) — remplace la bulle ET l'inspecteur de droite
- Elle s'ouvre **juste sous la case cliquée** (bord gauche aligné sur la case, rabattue vers la gauche près du bord droit de l'écran), **sans recadrer ni faire défiler la grille**. Ni marge de droite réservée, ni inspecteur
  séparé : **« Réglages du son » déplie la même fenêtre** (plus de colonne à droite).
- Haut : ‹ nom de l'accord, degré, « mes. N » › et ×. ‹ › passent à l'accord voisin sans fermer.
- **Fondamentale** (12 touches) ; **Type** : les **13 types courants** puis un bouton **« ⋯ »** qui déplie les autres (Add9, Add11, Maj 9, Min 9, 9, 11, 13) ; **Durée**.
- **« Réglages du son ›»** (dépliant) : **Octave** − / + ; **Renversement** 0 à 3 ; **Drop** Non / 2 / 3 ; **Ajouter une note** et **Basse** (voir ci-dessous). **Rien d'autre** :
  pas de ligne « Rythme » ni de légende (le rythme se règle dans le séquenceur, sans le dire), **pas de doigté de guitare** (« je le ferai directement dans les diagrammes »).
- **Ajouter une note** : **une seule ligne** — les noms de notes (C à B, dièses compris) **défilent à l'horizontale** dans leur cadre, l'octave − / + et un bouton **« + » carré de 32 px**
  (même gabarit que les autres « + » de l'appli, pas de texte « Ajouter D4 » : la note visée est dite par l'infobulle et `aria-label`) restent fixes à droite. La note choisie s'entend au clic ; la note
  ajoutée s'entend aussi. Les notes ajoutées apparaissent en **puces mauves** (× pour retirer) sur la ligne du titre de la section.
- **Basse différente** (décision du 11/11) : dans « Réglages du son », une ligne **« Basse »** sur le même modèle que « Ajouter une note » (noms C à B qui défilent, octave − / +, bouton « + » de 32 px) : l'utilisateur
  peut poser **une note différente à la basse** s'il le souhaite (« c'est un peu comme une note libre »). Elle devient la voix la plus grave (voir « Renversements, basses différentes » en section 3), avec son
  puce et son × pour la retirer. **Même question de renommage** : l'appli propose automatiquement de renommer l'accord en tenant compte de cette basse, en accord sur basse (Cmin7 + si bémol à la basse → **« Cmin7/Bb »** ; une basse
  qui est déjà une note de l'accord, comme Cmaj7 + E à la basse, propose le renversement « Cmaj7/E »). Boutons « Renommer en Cmin7/Bb » et « Garder Cmin7 » ; retirer la basse ferme la question et remet le nom d'origine
  si l'accord avait été renommé pour elle.
- **Renommage : l'appli DEMANDE, elle ne renomme jamais d'office** (11/11). Si les notes ajoutées forment un autre nom d'accord (triade majeure + septième majeure = maj7 ; Cmaj7 + ré = Cmaj9…), une question
  s'affiche sous la ligne de saisie : « Ces notes forment Cmaj9. Renommer l'accord ? » avec deux boutons, « Renommer en Cmaj9 » et « Garder Cmaj7 ». Les notes restent dans l'accord dans les deux cas ;
  retirer une note ferme la question. (L'appli renomme aujourd'hui toute seule : à changer pour cette question.)
- Échap ou clic à côté ferme (`this._popups`, `ZONE_EDITION_SELECTEURS`) ; la sélection reste.

### Captures réelles à traiter (observé en les prenant)
- Le toast « Sons du piano pas encore chargés » passe par-dessus le clavier du tiroir ; sur téléphone, le nom de l'accord est sélectionné dans son champ à l'ouverture du panneau d'accord.

## 4. Décisions et questions (11/11)

Réponses de l'utilisateur, 11/11 :
1. **Les formes enregistrées vivent sur le compte** (tous les morceaux et tous les appareils), comme les morceaux et les paroles dans Firestore : même principe que `synchro-versions.js`
   (un document par compte, fusion sans doublon, suppression tracée, hors ligne d'abord). Une forme supprimée disparaît partout ; les accords qui la suivaient passent « À la main ».
   Ne pas toucher `synchro-cloud.js` ni `compte-cloud.js` (fichiers partagés, voir `docs/fichiers-partages.md`) : nouveau fichier `synchro-formes.js`.
2. **Le chemin des voix (traits entre accords) est SUPPRIMÉ** (« trop compliqué ») : retirer le calque Voix et son bouton à l'ordinateur ; au téléphone, l'ancien panneau ⊱ avait déjà disparu au 10f.
   Bancs `calque_voix`, `voice_leading*`, `vl_*` : réécrits pour ce qui reste (légende des rôles 1 / 3 / 5 / 7 et couleurs), jamais supprimés.
3. **Clic sur un accord à l'ordinateur : un clic = écouter, double-clic = ouvrir la fenêtre** (option A) — confirmé.
5. **Basse différente** : gardée, dans « Réglages du son », comme une note libre à la basse avec proposition de renommage en accord sur basse (voir 3 bis).

Restent à trancher :
4. **Notes en plus des accords de 5 ou 6 notes** : règle écrite le 11/11 d'après l'idée de l'utilisateur (section « Accords de 3, 5 ou 6 notes ») : rythme commun des voix du haut s'il existe, sinon celui de la basse. **Confirmée par l'utilisateur le 11/11** (« Ok ça me va »).
6. Les commentaires de la maquette du séquenceur (version 17) et ceux de la planche A (version 26) ont tous été traités.

## 5. Ordre de travail proposé
A (grille qui ne bouge plus) → C (plus de recadrage) → B (clic = écouter) → D (séquenceur, par sous-lots : module + ordinateur, puis formes enregistrées et notes libres,
puis téléphone, puis retrait de l'ancien code et bancs). Un commit par sous-lot, banc + sabotages à chaque fois, balayage complet en fin de lot avant de pousser
(voir `CLAUDE.md`).
