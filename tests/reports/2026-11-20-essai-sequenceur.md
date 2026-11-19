# Essai utilisateur du séquenceur — 20/11/2026

Testeur qui découvre l'appli, sans lire le code. Chromium, écran 1440 × 900, appli de test (`npm run app:test`, http://127.0.0.1:8936). Pas de son dans la machine. Gestes à la souris réels (`mouse.move/down/up`, glisser lent ou rapide, Ctrl, Maj, Alt, clavier). Morceau de départ : Am C F G en 4/4, 120 BPM, tonalité C. Captures dans `tests/reports/essai-sequenceur/`.

## En bref

- Le séquenceur est agréable : vue Accord (une ligne par voix) ou vue Piano (piano-roll), couleurs par voix, retour visuel pendant chaque glisser, annulation fiable.
- Les gestes de base marchent bien : tracer, étirer par les deux bords, déplacer seul ou en groupe, Suppr, Ctrl+Z / Ctrl+Y. Aucun « saut » de note sous la souris pendant l'essai.
- Le lien entre les notes et la grille est le point faible. L'appli ne propose un nouveau nom que quand on **ajoute** une note connue (Am + G → Am7). Si on **déplace** ou si on **retire** une note, la case garde son nom. Am peut sonner A, ou Am sans quinte, et la grille affiche toujours « Am ».
- Quand elle propose, c'est discret : un bandeau en bas, 0,7 s après le geste, qui disparaît au bout de 12 s. Et une proposition est fausse (Cadd11 au lieu de Csus4).
- Accepter la proposition déplace la note ajoutée d'une octave : elle sort de la vue.
- Les rythmes sont bien pensés (par accord, pour toute la partie, copier / coller, formes à soi). Mais les arpèges doublent la tierce sur une triade, et les libellés des rythmes disparaissent dès qu'on enregistre une forme.
- La lecture suit bien la grille (la tête avance à 136 px/s, soit exactement 120 BPM, et la case allumée change à la barre de mesure). Mais il faut attendre 2 à 3,5 s avant que quelque chose bouge.
- La grille est en croches seulement : ni doubles croches, ni triolets.

## 1. Notes et accords

Chaque cas part d'un morceau neuf. Le séquenceur est en vue Piano, sur l'accord testé. Voix de départ : Am = A3 C4 E4, C = C3 E3 G3, G = G3 B3 D4. « Proposition » = bandeau « X + note : renommer en … ? » avec les boutons **Renommer** et **Ignorer**.

| # | Notes posées | Ce que dit la grille | Ce que j'attendais |
|---|---|---|---|
| 1 | Am + G3 sur toute la mesure | Proposition « Am7 ». Après **Renommer** : case Am7, degré vi7. Mais la G3 posée devient **G4** | Am7 : bon. La G aurait dû rester en G3 (c'est Am7/G), ou l'appli aurait dû le demander |
| 2 | Am + G3 sur une seule croche | Rien | Normal pour une note de passage, mais rien ne le dit. Le seuil est de 2 croches |
| 3 | Am, C4 montée en C#4 (A C# E) | Reste « Am », pas de proposition | **A** |
| 4 | Am, quinte E4 retirée (A C) | Reste « Am » | Am(no5), ou au moins un signe |
| 5 | Am, E4 montée en F4 (A C F) | Reste « Am » | F/A |
| 6 | Am, C4 descendue en B3 (A B E) | Reste « Am » | Asus2 |
| 7 | Am, C4 montée en D4 (A D E) | Reste « Am » | Asus4 |
| 8 | Am + D#4 (note étrangère) | Rien | Rien, c'est acceptable. Un « note hors accord » serait utile |
| 9 | Am + F#3 | Proposition « Am6 ». Après Renommer : F#3 devient F#4 | Am6 : bon (même saut d'octave) |
| 10 | Am + B3 | Rien | Am(add9), qui est pourtant reconnu pour C (cas 20) |
| 11 | Am + G3, puis + B3 | Proposition « Am7 » deux fois. Après Renommer : case Am7 avec B toujours là | Am9 |
| 12 | Am + A#3 | Rien | Rien, ou Am(b9) |
| 13 | Am, fondamentale A3 retirée (C E) | Reste « Am » | C(no5), ou un signe |
| 14 | Am, C4→C#4, puis + G3 (A C# E G) | Rien | **A7** |
| 15 | Am, les trois notes retirées | Reste « Am » | « silence », ou une case marquée |
| 16 | C, E3 descendue en D#3 (C D# G) | Reste « C » | **Cm** |
| 17 | G + F4 | Proposition « G7 », bon | G7 |
| 18 | C + A3 | Proposition « C6 », bon | C6 (ou Am7/C) |
| 19 | C, E3 montée en F3 (C F G) | Proposition « **Cadd11** ». Après Renommer : F4 G3 C3, case « Cadd11 » | **Csus4** : la tierce n'y est plus |
| 20 | C + D4 | Proposition « Cadd9 », bon | Cadd9 |
| 21 | C + B3 | Proposition « Cmaj7 », bon | Cmaj7 |
| 22 | C + A#3 | Proposition « C + A# : … C7 », bon | C7, mais à écrire Bb |
| 23 | Am + G3, sans cliquer | Le bandeau disparaît après 12 s. La case reste « Am » pour toujours, sans aucune trace | Un rappel qui reste sur la case |
| 24 | Am + E3 (quinte doublée en dessous) | Rien | Rien : bon |
| 25 | Am + D4 | Rien | Am(add11) (Cadd11 est reconnu, lui) |
| 26 | Am + G#3 | Rien | Am(maj7) |
| 27 | Am + G3, puis D#4 ajoutée | La proposition reste « Am + G : Am7 » | Elle devrait tenir compte du D# |

Dans l'autre sens (de la grille vers les notes), ça marche bien. Renommer Am en Dm dans la case garde le rythme (Pompe) et transpose les voix. Une note ajoutée reste où elle est. Renommer Am en Am7 alors qu'une G est déjà posée l'intègre comme 4ᵉ voix. La transposition du morceau emmène aussi les notes ajoutées, et elle passe en bémols (B♭m D♭ G♭ A♭).

**Ce que j'en conclus.** L'appli compare « nom de l'accord + une note ajoutée » à une table d'extensions. Elle ne lit pas l'ensemble des notes réellement posées.
- Pour un ajout simple sur un accord majeur, c'est juste et utile (7, maj7, 6, add9, 7 de dominante).
- Les accords mineurs sont moins bien couverts (add9, add11, maj7).
- Les déplacements et les suppressions ne sont jamais vus. Pire, un déplacement peut donner une proposition fausse (cas 19).
- Rien ne signale durablement que le nom et les notes ne correspondent plus. Pour un musicien qui lit la grille ou l'exporte, c'est le risque principal : la grille ment sans le dire.
- Le vocabulaire « Renommer / Ignorer » est clair. Le bandeau est loin du séquenceur (au-dessus du clavier, en bas) et il passe vite.

## 2. Gestes

Mesures en vue Piano, largeur de croche par défaut (34 px), barres de 26 px de haut.

- **Poser** : un clic dans une case vide pose une croche. Un glisser horizontal trace une note tenue, et ça marche aussi à cheval sur deux mesures : la note est alors coupée à la barre, une part par accord. Un glisser en diagonale ne pose qu'une croche.
- **Zones de prise** (relevées au curseur, pixel par pixel) :
  - note d'une croche (33 px) : bord gauche actif sur 8 px, bord droit sur 8 px, corps sur 13 px seulement ;
  - note d'une mesure : bords de 8 px aussi (par exemple x 344 à 351 pour une note qui finit en 353) ;
  - les bords ont un curseur ↔, mais le corps garde la flèche normale : rien n'indique qu'on peut le glisser.
- **Étirer / raccourcir** : 12 essais sur 12 réussis, par le bord gauche comme par le bord droit, appui lent (300 ms d'arrêt) ou immédiat. L'aperçu suit la souris pendant le glisser (capture 05).
- **Déplacer dans le temps** : précis, la note se cale à la croche. On peut aussi changer de mesure sur une ligne vide. Si la place est déjà prise par une note de même hauteur, l'aperçu montre la note à cet endroit, puis elle revient à sa place au lâcher, sans explication (ES-09).
- **Déplacer en hauteur** : un demi-ton par ligne, c'est précis. Une note de voix déplacée devient une « note libre » : elle passe en gris avec un contour pointillé et perd la couleur de sa voix.
- **Sélection multiple** : Ctrl+clic ajoute bien une note à la sélection. Le groupe se déplace d'un bloc. Suppr efface tout le groupe, et un seul Ctrl+Z le rend. En revanche :
  - Maj+clic remplace la sélection au lieu de l'étendre ;
  - il n'y a pas de lasso : Maj+glisser ou Alt+glisser posent une croche ;
  - Ctrl+A sélectionne le texte de toute la page (ES-12).
- **Supprimer** : clic puis Suppr. Le clic droit et le double-clic sur une note ne proposent rien de plus.
- **Annuler / rétablir** : Ctrl+Z, Ctrl+Maj+Z, Ctrl+Y et les boutons du haut marchent tous, et un geste s'annule en un pas. L'historique se perd au rechargement de la page, ce qui est normal.
- **Ce qui surprend** :
  - un clic dans le vide pour « désélectionner » pose une note ;
  - Échap pendant un glisser n'annule pas : la note est posée au lâcher (ES-11) ;
  - une note glissée jusque sur la grille d'accords y affiche un repère d'insertion « + » entre deux cases, puis il ne se passe rien (ES-10, capture 06) ;
  - les flèches du clavier ne déplacent pas les notes choisies, elles changent l'accord choisi dans la grille.
- **Intensité** : en mode Intensité, chaque clic fait tourner normal → fort → doux → normal. « Fort » se voit bien, la barre est plus claire.
- **Note libre** (bouton ♫) : une bande s'ouvre avec les 12 notes, un champ « C4, Eb3… » et l'octave. Elle ajoute une **ligne** vide, sur laquelle il faut ensuite tracer la note. C'est clair une fois compris, mais le bouton « Ajouter G4 » laisse croire que la note est posée.

## 3. Rythmes

- Rythmes prédéfinis : Plaqué, Arpège ↑, Arpège ↓, Pompe, Ballade, chacun avec une vignette. Ils s'appliquent à l'accord choisi.
  - **Pompe** (basse sur 1-2 et 5-6, accord sur 3 et 7) et **Ballade** correspondent à leur nom et à leur vignette.
  - **Arpège ↑ sur une triade** (Am) donne A tenue, puis C, C, E, —, C, C, E : la tierce est doublée (ES-08, capture 07). Le schéma (« Modifier ce schéma… ») est écrit pour 4 voix (V2 sur 2-6, V3 sur 3-7, V4 sur 4-8). Sur une triade, V3 tombe sur la tierce. Musicalement, on attend A C E C ou A C E A.
  - **Arpège ↓** fait la même chose (A, E, C, C).
- **Pour toute la partie** (clic droit sur la case, « Ce rythme pour toute la partie ») : ça marche, et Ctrl+Z annule d'un coup. Mais si on part d'un accord à 4 sons (Am7), les triades de la partie reçoivent des silences sur les croches 4 et 8, parce que la 4ᵉ voix manque. On obtient donc un résultat différent du bouton appliqué à chaque accord.
- **Copier / coller** : le bouton devient « Coller le rythme de G sur C ». C'est excellent, c'est clair et juste.
- **Retouche à la main** : dès qu'on touche une note, le bouton « + » (rythme libre) s'allume et la case de la grille reçoit un point orange. C'est un bon repère.
- **Enregistrer une forme** (« Tous les rythmes », icône signet) :
  - nom proposé « Forme 1 », Entrée valide, message « Forme “Ma pompe” enregistrée » ;
  - la forme apparaît sous « Mes formes » et dans la barre ;
  - appliquée à C puis à F, elle donne exactement le schéma voix par voix, la croche ajoutée à la main comprise ;
  - elle est gardée après rechargement.
  - **Mais** dès qu'une forme est enregistrée, les cinq libellés (Plaqué, Arpège…) disparaissent : il ne reste que les icônes, alors que la barre a encore plus de 300 px libres (ES-13, capture 08). La vignette de « Ma pompe » est identique à celle de Pompe. Les libellés reviennent quand l'éditeur de schéma est ouvert.
- **Créer une forme** : grille vide de 4 × 8, choix Triade / Tétrade, nom, Effacer / Annuler / Enregistrer. C'est clair.
- **Modifier ce schéma** (clic droit sur un rythme) : bon éditeur, avec un bouton « Écouter ». Mais il repousse la grille, et « Section 4 mesures » passe sous « Ajouter section » (ES-15, capture 10).
- **Effacer le rythme de cet accord** : vide toute la mesure. L'accord devient muet, la case garde « Am » sans aucun signe (même pas le point orange) (ES-07, capture 11). Le libellé laisse croire qu'on revient au rythme par défaut.
- « Tous les rythmes » ne contient rien de plus que la barre, sauf Enregistrer / Créer. Le nom promet davantage.

## 4. Lecture

- **Départ** : 3,5 s au premier lancement, puis 2,1 s à chaque fois.
  - Les 2 s correspondent à un décompte d'une mesure à 120 BPM. Le mot « Décompte » n'apparaît qu'au bout d'environ 1,4 s, et seulement dans le panneau du clavier, en bas à gauche, loin du séquenceur (ES-16).
  - Sans son, on croit que rien ne se passe. Une partie de l'attente vient peut-être du chargement des sons, qui ne se fait pas dans cette machine sans réseau.
- **Suivi** : la tête du séquenceur avance à 136 à 137 px/s pour 272 px par mesure de 2 s, soit exactement 120 BPM. La case allumée de la grille passe d'Am à C au moment où la tête franchit la barre (relevé toutes les 200 ms). La colonne jouée est marquée dans le séquenceur.
- **Modifier pendant la lecture** : une note posée dans G pendant qu'on joue Am est prise en compte. La tête ne saute pas.
- **Arrêter / relancer** :
  - un 2ᵉ clic sur Lecture arrête la lecture (ce n'est pas une pause), et la relance repart du début de l'accord choisi ;
  - le bouton garde le nom « Lecture » et le même aspect pendant la lecture ;
  - après Stop, le compteur reste sur la mesure où on s'est arrêté (« 2 / 4 »), alors que la relance repart de la mesure 1 ;
  - la barre d'espace lance et arrête bien la lecture.
- **Départ choisi** : un clic sur F, puis Lecture, part bien du début de F. Le clic sur une case fait aussi entendre l'accord, et un trait vert parcourt la mesure pendant ce temps : il est vite confondu avec la tête de lecture.
- **Boucle** : on trace une plage sur la règle des mesures, sous les cases, et elle s'affiche en orange. Le bouton devient « Boucle activée ». La lecture reste bien dans la plage (Am, C, Am, C…). En revanche (ES-14, capture 13) :
  - un appui sur le numéro de mesure lui-même (« 2 ») fait commencer la plage une mesure trop tôt ;
  - un tracé de droite à gauche ne fait rien et sélectionne du texte ;
  - un tracé court (30 px) dans une seule mesure est ignoré ;
  - une fois, 650 → 706 a donné F-G au lieu de C.

## 5. Le reste

- La fenêtre « Retrouve ton travail partout » revient à **chaque** chargement, même après « Continuer sans compte » (ES-17). Seule la case « Ne plus me le proposer » l'arrête.
- Au chargement, le panneau du clavier affiche « C · C E G » alors que le morceau commence par Am et que rien n'a été touché (ES-18). Ensuite, il suit l'accord cliqué ou joué, notes ajoutées comprises (« Am · F# A C D E »). C'est bien.
- L'infobulle du mode Intensité éteint dit « un clic pose ou enlève une note ». En réalité, un clic sur une note la sélectionne (ES-19).
- Notation : dans la tonalité C, toutes les touches noires s'écrivent en dièses (A#3, D#4, « C + A# : C7 »). Pour C7, Cm ou F, on attend Bb et Eb (ES-05).
- Accessibilité (ES-20) :
  - les cases du séquenceur s'appellent « E4, croche 1 : normal » sans le nom de l'accord, donc quatre cases portent le même nom dans une partie de quatre accords ;
  - après l'enregistrement d'une forme, les boutons de rythme prennent pour nom leur infobulle (« Plaqué — clic droit : modifier ce schéma »).
- Ce qui est réussi :
  - en-têtes de colonnes « Am vi », « C I » (degrés en direct, vi7 après Am7) ;
  - règle des temps 1 2 3 4 ;
  - colonne de l'accord choisi teintée ;
  - message « Accord renommé (Ctrl+Z pour annuler) » ;
  - réglages du séquenceur clairs (hauteur des barres, largeur des croches, octaves au-dessus et en dessous, Notes / Degrés).

## Bugs

**ES-01 — Le nom d'accord ne suit pas les notes déplacées ou retirées** (gênant). Capture 04.
- Étapes : Am C F G, séquenceur, vue Piano. Glisser la note C4 de Am vers C#4. Ou retirer E4. Ou, sur C, descendre E3 en D#3.
- Observé : la case reste « Am » (ou « C »), sans proposition ni signe, alors que l'accord sonne A (ou Cm).
- Attendu : une proposition « A ? » / « Cm ? », ou au moins une marque « notes ≠ nom » sur la case.

**ES-02 — Proposition fausse après un déplacement : Cadd11 au lieu de Csus4** (gênant).
- Étapes : C F G C, vue Piano sur C. Glisser E3 vers F3.
- Observé : « C + F : renommer en Cadd11 ? ». Après Renommer, la case affiche « Cadd11 » avec les notes C3 G3 F4.
- Attendu : Csus4, puisque la tierce E n'y est plus.

**ES-03 — Après « Renommer », la note ajoutée change d'octave et sort de la vue** (gênant). Captures 01, 02, 03.
- Étapes : Am, vue Piano, tracer G3 sur toute la mesure. Attendre le bandeau, cliquer Renommer.
- Observé : la case devient Am7, mais la G3 disparaît de la vue : elle est passée en G4, au-dessus des lignes visibles. Même chose pour F#3 → F#4 (Am6) et F3 → F4 (cas 19).
- Attendu : garder la hauteur choisie (Am7/G), ou prévenir et faire défiler jusqu'à la note.

**ES-04 — Reconnaissance des extensions incomplète, surtout en mineur** (gênant).
- Étapes : sur Am, ajouter B3, ou D4, ou G#3. Sur Am, ajouter G3 puis B3.
- Observé : rien pour Am + B, Am + D et Am + G#, alors que C + D → Cadd9 et C + F → Cadd11 sont reconnus. Avec G puis B, la proposition reste « Am7 », et après Renommer la case affiche Am7 avec un B. Avec G puis D#, la proposition « Am7 » ignore le D#.
- Attendu : Am(add9), Am(add11), Am(maj7), Am9. Une proposition qui tient compte de toutes les notes.

**ES-05 — Orthographe des altérations** (mineur).
- Étapes : C + A#3 (A# est la seule écriture possible, la ligne s'appelle A#3).
- Observé : « C + A# : renommer en C7 ? », et des dièses partout en C.
- Attendu : Bb (7ᵉ mineure), Eb pour Cm.

**ES-07 — « Effacer le rythme de cet accord » rend l'accord muet sans le montrer** (gênant). Capture 11.
- Étapes : choisir Am, cliquer la corbeille de la barre du séquenceur.
- Observé : toutes les notes de Am disparaissent. La case reste « Am », sans point orange ni marque.
- Attendu : un libellé « Silence / vider la mesure », et une case marquée (par exemple barrée), ou un retour au rythme par défaut.

**ES-08 — Arpèges mal adaptés aux triades** (gênant). Capture 07.
- Étapes : Am choisi, cliquer « Arpège ↑ ».
- Observé : A tenue, puis C C E — C C E : la tierce est doublée. Avec « Ce rythme pour toute la partie » depuis Am7, les triades C et F ont des silences sur les croches 4 et 8.
- Attendu : A C E C (ou A C E A) sur une triade, et un résultat qui ne dépend pas de l'accord de départ.

**ES-09 — Déplacement refusé sans explication** (mineur). Capture 05.
- Étapes : poser G3 dans Am (croches 4 à 7), la glisser vers la mesure de C, où G3 occupe déjà la mesure.
- Observé : l'aperçu montre la note sur la nouvelle place, puis au lâcher elle revient à l'ancienne.
- Attendu : un aperçu rouge « place prise », ou une fusion des deux notes.

**ES-10 — Une note lâchée sur la grille montre un repère d'insertion trompeur** (mineur). Capture 06.
- Étapes : glisser une note du séquenceur jusque sur la case C de la grille.
- Observé : la note flotte sur la grille avec un « + » bleu entre Am et C. Au lâcher, rien ne se passe.
- Attendu : pas de repère, ou une vraie action (par exemple copier la note dans l'accord visé).

**ES-11 — Échap n'annule pas un glisser** (mineur).
- Étapes : saisir une note, la glisser de deux lignes, appuyer sur Échap avant de lâcher.
- Observé : la note est posée au lâcher.
- Attendu : la note revient à sa place.

**ES-12 — Ctrl+A sélectionne toute la page** (mineur). Capture 12.
- Étapes : choisir une note, puis Ctrl+A.
- Observé : tout le texte de la page est surligné en bleu.
- Attendu : toutes les notes de la partie sélectionnées, ou rien.

**ES-13 — Les libellés des rythmes disparaissent après l'enregistrement d'une forme** (gênant). Captures 08, 09.
- Étapes : « Tous les rythmes » → « Enregistrer la forme… » → Entrée.
- Observé : Plaqué, Arpège ↑, Arpège ↓, Pompe et Ballade n'ont plus que leurs icônes, alors que plus de 300 px restent libres dans la barre. La vignette de la forme est la même que celle de Pompe.
- Attendu : libellés gardés, et une vignette dessinée d'après le schéma de la forme.

**ES-14 — Tracé de la plage à boucler imprécis** (gênant). Capture 13.
- Étapes : sur la règle des mesures, sous les cases (y ≈ 214), glisser de x 600 (le chiffre « 2 ») à 706.
- Observé : la boucle couvre les mesures 1 et 2. Un glisser de 605 à 700 donne bien la mesure 2 seule. Un glisser de droite à gauche (760 → 610) ne change rien et sélectionne le « 5 ». Un glisser de 30 px dans Am est ignoré.
- Attendu : la plage commence à la mesure sous le pointeur, et le tracé marche dans les deux sens.

**ES-15 — L'éditeur de schéma chevauche la grille** (mineur). Capture 10.
- Étapes : clic droit sur un rythme → « Modifier ce schéma… ».
- Observé : « Section 4 mesures » passe sous le cadre « Ajouter section », et les cases ne se voient plus.
- Attendu : une mise en page propre, ou l'éditeur en panneau flottant.

**ES-16 — Départ de la lecture sans retour visible ; le compteur et le bouton ne disent pas l'état** (mineur).
- Étapes : cliquer Lecture.
- Observé :
  - environ 1,4 s sans rien, puis « Décompte » dans le panneau du clavier, avant que la tête parte (2,1 à 3,5 s en tout) ;
  - le bouton reste « Lecture » pendant la lecture ;
  - après Stop, le compteur reste sur « 2 / 4 » alors que la relance repart de la mesure 1.
- Attendu : décompte affiché sur le séquenceur, bouton « Arrêter » pendant la lecture, compteur remis au point de départ.

**ES-17 — La fenêtre de connexion revient à chaque chargement** (mineur).
- Étapes : « Continuer sans compte », puis recharger la page.
- Observé : la fenêtre revient à chaque fois.
- Attendu : elle ne revient pas avant un certain temps.

**ES-18 — Le panneau du clavier montre C au chargement** (mineur).
- Étapes : ouvrir le morceau Am C F G.
- Observé : « C · C E G » avant tout clic.
- Attendu : l'accord choisi, ou le premier accord.

**ES-19 — L'infobulle du mode Intensité éteint est inexacte, et le clic à côté pose une note** (mineur).
- Observé : l'infobulle dit qu'un clic « enlève » une note, mais un clic sur une note la sélectionne. Un clic dans le vide pour désélectionner pose une croche.
- Attendu : une infobulle juste (« clic : poser ou choisir · Suppr : effacer »). Pour désélectionner, Échap ou un clic sur la règle.

**ES-20 — Noms accessibles ambigus** (mineur).
- Observé : les cases s'appellent « E4, croche 1 : normal » sans l'accord, et le même nom revient quatre fois. Les boutons de rythme changent de nom après l'enregistrement d'une forme.
- Attendu : « Am, E4, croche 1 », et des noms stables.

ES-06 a été fondu dans ES-04, ce qui explique le trou dans la numérotation.

**Total : 19 bugs, dont 0 bloquant, 8 gênants (ES-01, 02, 03, 04, 07, 08, 13, 14) et 11 mineurs.**

## Améliorations proposées

**Impact fort**
1. Reconnaître l'accord à partir de **toutes** les notes tenues de la mesure (ajout, déplacement, retrait), pas « nom + une note ». Proposer le nom directement sur la case, par exemple en nom fantôme « → A7 » à côté de « Am ».
2. Marquer durablement une case dont les notes ne correspondent plus au nom (petite pastille « ≠ »). Au survol, lister les notes réelles et proposer « Renommer en … ».
3. Au renommage, garder la note là où le musicien l'a mise et nommer le renversement (Am7/G), au lieu de la monter d'une octave.
4. Ajouter une résolution plus fine : doubles croches et triolets, dans les réglages du séquenceur.
5. Écrire des arpèges adaptés au nombre de voix : triade 1-3-5-3 ou 1-3-5-8, et étendre proprement un rythme à 4 voix vers une triade.

**Impact moyen**

6. Sélection : lasso (Maj+glisser sur le vide), Ctrl+A sur les notes, Maj+clic qui étend, flèches pour déplacer d'une croche ou d'un demi-ton, Alt+glisser pour dupliquer.
7. Échap annule le glisser en cours. Une place refusée s'affiche en rouge pendant le glisser.
8. Garder les libellés des rythmes, et dessiner la vignette des formes perso d'après leur schéma.
9. Renommer « Effacer le rythme » en « Vider la mesure (silence) », et marquer la case muette dans la grille.
10. Décompte visible sur le séquenceur (1 2 3 4 sur la tête de lecture), avec un réglage pour le couper. Un bouton Lecture qui devient Arrêter (ou Pause, avec reprise).
11. Boucle : tracer dans les deux sens, s'accrocher à la mesure sous le pointeur, et pouvoir tracer aussi sur la règle des temps du séquenceur.
12. Écrire les altérations selon la fonction dans l'accord : Bb dans C7, Eb dans Cm, F# dans D.
13. Garder le bandeau de proposition tant que l'accord est choisi, et le placer près du séquenceur plutôt qu'au-dessus du clavier, en bas.

**Impact faible**

14. Retenir « Ignorer » pour un accord donné : aujourd'hui la proposition revient à chaque retouche.
15. Dire pourquoi une note d'une croche n'est pas proposée (« note de passage »).
16. Donner au corps d'une note un curseur de déplacement, et agrandir la prise sur les notes d'une croche (13 px de corps saisissable aujourd'hui).
17. Au chargement, montrer dans le panneau du clavier l'accord choisi, ou le premier accord, plutôt que C.

## Limites de l'essai

- **Pas de son** : le rendu sonore, l'intensité entendue et la justesse du décompte n'ont pas été écoutés. Le délai de départ vient peut-être en partie du chargement des sons, qui ne se fait pas dans cette machine sans réseau.
- Chromium seul, à l'ordinateur (1440 × 900). Le téléphone, la tablette, le tactile, Firefox et Safari n'ont pas été essayés.
- Pas essayés :
  - 3/4, swing, morceaux longs (« Ligne suivante de la grille ») et plusieurs parties ;
  - « Voicing » (conduite des voix), « Masquer ce rythme » et « Rétablir les rythmes masqués » ;
  - l'enregistrement d'une forme créée de zéro (l'éditeur a seulement été ouvert).
- Chaque étape relançait le navigateur avec l'état enregistré (localStorage) : l'historique d'annulation était donc vide en début d'étape. Les essais d'annulation ont été faits dans une même session.
- Aucune connexion au compte ni synchronisation (production bloquée, aucun émulateur lancé).
