# Refonte de l'interface — cahier des charges et feuille de route

Décidé le 31/10/2026 avec l'utilisateur, sur la maquette « HarmoHub — maquette de la refonte »
(https://claude.ai/artifact/AMrn1tzDEBfmVij2fdfiBp, page « Version 2 » : Grille, Éditeur de notes, Téléphone,
Gabarit, Inventaire). La maquette est la RÉFÉRENCE VISUELLE ; ce fichier est la RÈGLE : il garde ce que
l'utilisateur a demandé commentaire par commentaire, pour que la suite du travail (autres sessions comprises)
ne le redécouvre pas.

## Règles qui valent pour tous les lots

1. **Rien ne régresse.** L'inventaire est l'écran « Inventaire » de la maquette (51 fonctions, avec les bancs qui les
   protègent). Un lot n'est livré que si ses bancs passent. Un banc qui cliquait
   sur un élément disparu est RÉÉCRIT pour le nouveau geste, jamais supprimé.
2. **Les logos de l'utilisateur ne se perdent pas.** Toute icône qui existe déjà dans HarmoHub (index.html,
   script.js) est REPRISE telle quelle. Les dessins de la maquette sont des approximations : ils ne remplacent jamais
   un logo existant. Une icône n'est créée que pour une fonction qui n'en a pas.
3. **Design épuré et cohérent** (c'est « souvent le point qui pèche »). Gabarit :
   - deux hauteurs seulement : **32 px** sur ordinateur, **44 px** pour le bloc de lecture (début, Lecture, Stop, Boucle,
     tous identiques) et pour TOUT le téléphone ;
   - un seul arrondi pour ce qu'on clique : **7 px** ; 12 px pour ce qui flotte (bulle, menu, panneau, cartes) ;
   - quatre familles de couleur, celles de style.css (`--btn-green-*`, `--btn-blue-*`, `--btn-red-*`, `--btn-neutral-*`) :
     vert = lire / enregistrer / état allumé, bleu = ajouter / modifier, rouge = arrêter / supprimer, neutre = le reste ;
     JAMAIS un aplat vert vif (#00e676) en fond de bouton ;
   - un choix parmi plusieurs = un groupe segmenté (style des segments de voicing actuels), jamais une liste déroulante
     pour moins de huit choix ;
   - une barre = une hauteur, une ligne de base ;
   - **une icône par fonction, sans mot** (« uniquement logo ») ; un mot seulement quand aucune icône n'est évidente.
4. **Couleurs douces.** Les rôles des notes gardent les teintes translucides de `.seq-note.role-*` (38 %, liseré 85 %).
   Jamais d'aplat plein.
5. **Sélection BLEUE, lecture VERTE, plage à boucler ORANGE** (l'orange de la règle actuelle). Fini l'orange du mode
   modification.
6. **Verre dépoli** (`verre-surfaces.css`) : chaque nouvelle surface y est ajoutée dans le même lot que sa création,
   avec ses contrôles de lisibilité en pixels (`verre_test`). Option par appareil, inchangée.
7. **Notation internationale** pour les tonalités (C majeur, E♭ majeur) ; le nom du mode reste en français.
8. **Chaque lot** : ses bancs écrits, balayage complet (`tests/run_all_fast.sh`) avant de pousser une série, journal dans
   `docs/dette-tests.md`, `?v=` incrémenté, commentaires en français qui disent POURQUOI (avec la citation de
   l'utilisateur), poussé sur `claude/harmohub-travail-Claude`.

## Décisions de fond

- **Enregistrement MANUEL** (bouton Enregistrer, Ctrl+S, état « non enregistré » à côté) — « je fais beaucoup de
  modifications, c'est juste pour tester ». En plus, des **versions automatiques** en arrière-plan (toutes les 5 min
  de travail et avant chaque opération lourde : transposition, import, suppression de section, restauration), gardées
  PAR APPAREIL (le document cloud est limité à 1 Mio). Elles se consultent et se restaurent dans
  **Paramètres › Historique et récupération**, qui contient aussi « À propos » (version de l'appli).
- **Groove → « Swing »** : on garde Droit / Shuffle léger / Ternaire (c'est ce que le code fait vraiment : seule la
  2ᵉ croche de chaque temps bouge, à 50 / 58 / 67 %). Pas de styles salsa/pop/rock : sans batterie, ils ne changeraient
  rien.
- **Tonalité ≠ Transposer** : la puce Tonalité change seulement la référence (degrés, modes, suggestion) ; Transposer
  déplace les accords (version automatique avant).
- **Plus de bandeau de gauche, plus de mode ajout / modification.** On agit dans la grille : une bulle (QUEL accord :
  fondamentale, type, basse, durée, ‹ › vers le voisin) et un inspecteur (COMMENT il sonne : voicing, jeu, intensité,
  rythme, doigté). Rien aux deux endroits. Une bulle = UNE étape d'annulation. Modification directe, Ctrl+Z comme filet.
- **Ajouter** : une seule saisie (syntaxe actuelle COMPLÈTE : `C_E`, `C_O4-R1-D2`, `C/Am/F/G`, plusieurs lignes, ligne
  vide = nouvelle partie, aide « ? »), accords de la tonalité, suggestions après l'accord précédent, « + » entre deux
  cases au survol.
- **Sélection** : clic = sélectionne et ouvre la bulle ; Ctrl/Maj+clic = multiple (barre de sélection : copier, dupliquer,
  transposer, boucler, supprimer) ; double-clic = retaper le nom (Tab = case suivante) ; clic droit = copier, coller,
  pipettes, insérer, dupliquer, supprimer.
- **Durée** : le bord droit d'une case se tire (poignée au survol, durée affichée, une seule annulation) ; Maj+flèches.

## Grille (bureau)

- Une **fenêtre centrée**, largeur Compact 640 / Normal 480 / Détaillé 640 px, **poignée bord droit** (largeur) et
  **poignée bord bas** (hauteur des cases, 30 à 160 px), double-clic = valeurs d'origine. Cases basses : Compact 38,
  Normal 52, Détaillé 84 px. « Les cases sont trop grosses, ça nuit à la visibilité. »
- **Affichage Compact / Normal / Détaillé** remplace les quatre boutons de zoom (hauteur calculée, mesures par ligne).
- En-tête de partie : nom et « N mesures » sur la **même ligne de base**, `×N` si répétée, menu ⋯ (répéter, renommer,
  monter, descendre, dupliquer, supprimer — version automatique avant suppression). ✅ **Livré 02/11 (lot 5c)** : ×N = répétitions de la
  STRUCTURE (même geste que la vue Structure) ; partie à plusieurs endroits de la structure → réglée dans Structure. Téléphone inchangé (lot 10).
- Chaque case porte en bas sa **règle de lecture** : numéro de mesure sur le 1ᵉʳ temps, un point par temps. On y
  glisse pour tracer la **plage à boucler (orange)** ; un clic dans la plage l'efface. Pas de numéro de mesure dans le
  coin de la case.
- La case « + » de fin de ligne a la **largeur d'une mesure**, jamais tout l'espace restant.
- Voicing personnalisé : **petite pastille ambre** (infobulle), jamais le mot « perso ». ✅ **Livré 02/11 (lot 5d)**, avec la durée affichée pendant l'étirement ;
  la case « + » garde le petit carré demandé en août (jamais plus d'une mesure).
- Les 16 petits carrés du rythme (affichage Détaillé) : **gardés** (« c'est pas débile »), avec une **option dans les
  Paramètres › Affichage** pour les montrer ou non (« Rythme de l'accord dans les cases », allumée par défaut : le mode
  Détaillé est déjà un choix). Infobulle « Rythme de l'accord ». Réglage SYNCHRONISÉ (à ajouter à
  `REGLAGES_SYNCHRONISES`). Lot 5.

## Barre du haut

- Logo SEUL (sans « HarmoHub »), nom du morceau en bouton à largeur adaptative (128 à 280 px, « … » au-delà,
  infobulle) qui ouvre le menu du morceau (ouvrir, nouveau, renommer, dupliquer, importer, exporter, historique,
  rangement) ; **Enregistrer** + état ; **onglets Grille / Structure / Paroles EXACTEMENT au centre** (trois colonnes
  égales) ; annuler, rétablir, **Paramètres (engrenage existant)**, compte (pilule commune, inchangée).
- Structure et Paroles deviennent des onglets. **Décision du 01/11 (lot 4b)** : « au lieu de séparer Paroles, on peut l'intégrer directement au morceau. Il ne
  faut pas qu'elle garde sa propre en-tête, ni le logo. » Les deux sont des VUES dans la page HarmoHub (entre la barre du haut et la barre de lecture). Paroles
  garde son code et sa synchro, chargée en mode intégré (`paroles.html?integre=1`) ; ouverte seule (favori, téléphone), elle reste une page à part.

## Barre de lecture (bas)

- Faite de **quatre blocs déplaçables** (mode « réorganiser » : flèches ◀ ▶ par bloc, « ordre d'origine ») :
  Lecture (début, Lecture, Stop, Boucle — **44 px, identiques**), Parties du morceau (« Mes. N » seulement, frise,
  bande orange de la plage), Tempo et métronome, Vues (Clavier, Guitare — icônes). Ordre mémorisé par appareil.
- Tempo : bouton « BPM » → fenêtre −/+/Tap ; **molette = ±1 BPM (Maj ±5)** ; **clic molette + glisser haut/bas** ;
  **vitesse de lecture 50 % à 200 %** (curseur + 50/75/100/150/200), affichée en doré si ≠ 100 %.
- Boucle = icône seule ; plage orange si tracée, sinon tout le morceau.
- Hauteur 60 px ; la barre reste TOUJOURS entièrement visible, à toutes les hauteurs d'écran testées.

## Clavier / Guitare

- Épinglés en bas par défaut, ou **détachés en fenêtre libre** (barre de titre qui déplace, coin qui redimensionne,
  punaise pour réépingler). Construire un accord au clavier puis « Remplacer » ou « Ajouter ». Guitare : le manche actuel
  AU COMPLET (doigtés, verrouillage, édition, dessin, envoi dans la grille).

## Éditeur de notes (remplace grand séquenceur ET conduite de voix)

- Ouvert par un **bouton bleu libellé « Éditeur de notes »** dans la rangée de réglages (pas parmi les instruments :
  « on a l'impression que c'est un instrument »), fermé par « Fermer ». S'ouvre sur tout le morceau, règle sections /
  mesures / accords.
- **Étendre ou non** : réduit par défaut (~170 px de notes), bouton à chevrons, double-clic sur la poignée, ou poignée
  tirée.
- Barre d'outils **en icônes** : sélection, crayon, gomme ; calage (grille + noire / croche / double) ; Voix ; Intensité ;
  Ajuster ; zoom ; supprimer la note. **Aucune ligne d'info sur la note, aucune phrase de résumé des voix.**
- Calque **Voix** = l'ancienne conduite de voix : fonction 1/3/5/7 écrite dans la note (la couleur n'est plus
  seule), trait blanc du chemin des voix. Chaque fonction de l'ancien panneau (règles de voix, loupe, pincement) est
  vérifiée une à une AVANT de fondre. ✅ **Livré 05/11 (lot 9c)**. Décisions du 05/11 : éteint au premier usage puis
  mémorisé par appareil ; nom + degré des accords dans la règle, calque allumé seulement ; Voix sans accord choisi ouvre
  le premier accord de la partie ; l'icône ⊱ quitte l'ordinateur (le téléphone la garde jusqu'au lot 10). Le zoom
  vertical de l'ancien panneau n'est pas repris : la hauteur des lignes de l'éditeur reste bloquée (« laisser une unique
  hauteur de barres ») ; Étendre et Ajuster en tiennent lieu.
- Notes ajoutées à la main en pointillés + pastille ambre sur la case + « Revenir à l'automatique » dans l'inspecteur.
  Bande d'intensité (le « mode studio » actuel) sous les notes. ✅ **Livré 05/11 (lot 9d)**. Décisions du 05/11 : les barres des accords voisins
  s'affichent, pâles et non modifiables ; une croche réglée à la main passe en ambre ; les pointillés valent partout à l'ordinateur (éditeur, petit
  séquenceur de l'inspecteur, accords voisins). Les gestes de la bande sont ceux du mode studio (glisser, double-clic pour revenir à l'accord), pas le
  clic qui fait tourner les valeurs de la maquette.

## Téléphone

- Tout en 44 px, bouton du compte **carré** comme ses voisins (habillage CSS HarmoHub, sans toucher `compte-cloud.js`). ✅ **Barre du haut livrée 05/11 (lot 10a)**. Décision du 05/11 : la maquette n'a
  ni Rétablir ni Paramètres ; ils restent, Annuler et Rétablir sur la seconde rangée, à droite des onglets (le titre garde ~175 px à 390 px).
- Infos du morceau (tonalité, mesure, swing, son) **repliées dans UNE barre-résumé** pleine largeur → quatre grosses
  cases sur deux colonnes ; bouton carré « Affichage » à côté : **Compact** (4 mesures/ligne, noms seuls, 44 px),
  **Normal** (4 mesures/ligne + degrés, 64 px), **Large** (2 mesures/ligne, 72 px). Pincement conservé. ✅ **Livré 05/11 (lot 10c)** :
  la barre dit aussi le tempo (« C majeur · 120 BPM · 4/4 · Droit · Piano » — exigence « toujours voir la tonalité et le tempo ») ;
  Transposer garde sa ligne sous les cases ; l'affichage et le pincement du téléphone sont une préférence de l'appareil (les échelles
  du morceau restent celles de l'ordinateur) ; l'en-tête de partie est celui de l'ordinateur à 44 px.
- Panneau d'accord qui monte du bas, à mi-hauteur : l'accord modifié reste visible au-dessus. Fondamentales sur 2 rangées
  de 6. Éditeur de notes accessible.

## Feuille de route (un lot = code + bancs verts + poussé)

| Lot | Contenu | Risque |
|---|---|---|
| 1 | Fondations : jauge des boutons (32/44, 7 px) appliquée aux hors-gabarit, logo seul | faible |
| 2 ✅ | Barre de lecture en blocs (bas), boutons 44 px, position « Mes. N », frise, vitesse 50–200 %, tempo à la molette — **livré 01/11** (voir `docs/dette-tests.md`). Restent : le bloc Vues (Clavier, Guitare) au lot 8 ; le téléphone au lot 10. Le bouton « Début » de la maquette n'existe pas : l'appli n'a pas de tête de lecture persistante, Stop fait déjà « revenir au départ » | moyen |
| 3 ✅ | Barre du haut : titre adaptatif + menu du morceau, Enregistrer + état, versions automatiques, Paramètres › Historique — **livré 01/11** (voir `docs/dette-tests.md`). Restent : les onglets Grille / Structure / Paroles au centre (lot 4, la colonne est réservée et centrée) ; sur téléphone la carte Morceau garde ses boutons (lot 10) | élevé |
| 4 ✅ | Onglets Grille / Structure / Paroles, centrés — **livré 01/11** (voir `docs/dette-tests.md`). **Lot 4b (01/11)** : Paroles et Structure INTÉGRÉES comme vues du morceau (« il ne faut pas qu'elle garde sa propre en-tête, ni le logo ») — Paroles est la page Paroles chargée dans HarmoHub en mode intégré, Structure une vue dans la page. Reste : le téléphone (lot 10) | moyen |
| 5 | Grille : fenêtre centrée, poignées, cases basses, règle et plage orange, case « + » fixe, durée par poignée | élevé |
| 6 | Bulle + inspecteur, suppression du bandeau de gauche et de la carte Accord — ✅ **livré 04/11** : 6a rangée de réglages, 6b bulle et sélection bleue, 6c inspecteur à droite et fin du bandeau de gauche (ordinateur). Reste : le téléphone (lot 10), et 19 bancs joués sous le seuil à reprendre alors (voir `docs/dette-tests.md`) | élevé |
| 7 | Ajout unique (syntaxe complète, suggestions, « + » entre deux cases), clic droit, barre de sélection — ✅ **livré 04/11** : 7a ajout unique et « + » entre les cases, 7b barre de sélection, clic droit, Tab dans la retape | moyen |
| 8 ✅ | Clavier / Guitare : épinglés ou fenêtre libre, construction d'accord — **livré 05/11** (voir `docs/dette-tests.md`) : bloc « Vues » dans la barre de lecture, tiroir épinglé / fenêtre libre, accord construit touche par touche puis Remplacer / Ajouter. Reste : le téléphone (lot 10) | moyen |
| 9 | Éditeur de notes (grand séquenceur + conduite de voix) — **9a ✅ livré 05/11** : bouton bleu « Éditeur de notes », Fermer, réduit / étendu (chevrons, double-clic, poignée), grille en Compact provisoire (voir `docs/dette-tests.md`). **9b ✅ livré 05/11** : barre d'outils en icônes, en une rangée, Sélection / Crayon / Gomme, Ajuster (pas de calage, décision du 05/11). **9c ✅ livré 05/11** : calque Voix — bouton Voix (logo ⊱ repris), fonctions dans les notes (degré réel des couleurs « Autres »), chemin des voix en blanc (plein = tenue, pointillés = mouvement), nom + degré des accords dans la règle calque allumé, éteint puis mémorisé par appareil, premier accord pris si rien n'est choisi ; l'icône ⊱ quitte l'ordinateur (téléphone : lot 10). Inventaire fonction par fonction dans `docs/dette-tests.md`. **9d ✅ livré 05/11** : notes ajoutées à la main en pointillés (partout à l'ordinateur, voisins compris), pastille ambre de la case en direct, « Revenir à l'automatique » annulable ; bouton Intensité (logo du mode studio repris) après Voix, bande collée sous les notes, voisins pâles, croche réglée à la main en ambre, une annulation par geste. **Lot 9 livré.** Reste : le téléphone (lot 10) | très élevé |
| 10 | Téléphone — découpé le 05/11 en six sous-lots (`CLAUDE-HARMOHUB.md`). **10a ✅ livré 05/11** : la barre du haut de l'ordinateur en 44 px sur deux rangées (logo, titre-menu, voyant, Enregistrer, Paramètres, compte carré ; onglets en groupe segmenté, Annuler et Rétablir à leur droite — décision du 05/11), carte Morceau sans en-tête, Structure sous la barre. **10b ✅ livré 05/11** : la barre de lecture de l'ordinateur fixée en bas du téléphone (68 px : Lecture, Stop, « Mes. N » + frise, Boucle, ⋯), le panneau Lecture (tempo −/+/Tap, vitesse de lecture — ajoutée à la demande du 05/11, mention dorée à côté de « Mes. N » — et métronome déplacés de la barre d'ordinateur ; Clavier / Guitare / Notes qui pilotent les boutons d'origine — plein écran avec le 10f), Structure et Paroles en vues intégrées entre les deux barres. **10c ✅ livré 05/11** : barre-résumé (avec le tempo) et ses quatre cases (les puces de l'ordinateur, déplacées ; Transposer dessous ; le contretemps au panneau Lecture), bouton Affichage Compact / Normal / Large et pincement propres à l'appareil, H± V± effacés, en-tête de partie à ⋯. **« Paroles homogènes » ✅ livré 05/11** (hors découpage, à la demande du 05/11) : supprimer un morceau supprime ses paroles partout (Ctrl+Z les ramène), synchro des paroles dès l'ouverture une fois connecté, versions des paroles restaurables (Paramètres › Historique). Restent : 10d panneau d'accord, 10e panneau d'ajout, 10f éditeur de notes | élevé |

Le verre dépoli (règle 6) et l'inventaire (règle 1) valent pour chaque ligne.
