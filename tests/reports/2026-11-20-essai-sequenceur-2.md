# Essai neutre du séquenceur, deuxième passage (20/11/2026)

Testeur : découverte par le navigateur seulement (Chromium 1440 x 900, Firefox, WebKit, Pixel 7 tactile). Vrais gestes (souris, clavier, toucher par événements tactiles). Origines Firebase bloquées. Captures dans `tests/reports/essai-sequenceur-2/` (14 PNG).

## En bref

- Le séquenceur est riche et cohérent : pose d'une note d'un clic, peinture d'un trait, poignées, lasso (Maj + glisser), Alt + glisser = copie, Échap annule un glisser, Ctrl+Z / Ctrl+Y fiables.
- La proposition de nom est une vraie bonne idée : elle arrive en 0,75 s, nomme les notes ajoutées et reste affichée. Mais elle est loin du geste (bas de l'écran, sur le clavier piano) et peut devenir périmée.
- Le plus grave : après Ctrl+Z, la proposition reste affichée ; l'accepter renomme l'accord ET supprime la tierce (EB-01).
- Les altérations du bandeau sont mal orthographiées (G# écrit « A♭ » dans Am + G# = Ammaj7) (EB-02).
- Un déplacement lâché dans l'interstice de 3 px entre deux lignes est annulé sans rien dire, et plusieurs autres refus sont silencieux (EB-03, EB-04).
- Impossible d'appliquer un rythme à plusieurs accords sélectionnés, ni à toute la partie (l'option existe sur téléphone, pas sur ordinateur) (EB-05).
- Les arpèges sur triades ne montent pas (A tenu, C quatre fois, E deux fois) ; la vignette ne correspond pas (EB-07).
- Firefox et WebKit se comportent comme Chromium. Sur téléphone, les gestes de base marchent mais je n'ai pas vu de proposition de nom.

## 1. Notes et accords

Réflexe de nouvel utilisateur : j'ai d'abord cherché où « poser » une note. Premier essai : le bouton ♫ « Note libre » (il crée une ligne vide, il faut ensuite cliquer dedans), puis la vue Piano où l'on clique ou peint directement. Une note posée sur une seule croche ne déclenche rien ; il faut une note tenue (la proposition arrive environ 0,75 s après le geste).

Fonctionnement observé : le bandeau « Am + G : renommer en Am7 ? » (boutons Renommer et ×) est une proposition ; rien ne change tout seul dans la grille tant qu'on n'accepte pas. Au refus (×) ou sans réponse, la grille garde « Am ». À l'acceptation, la note garde sa hauteur (G4 reste G4), prend la couleur de 7e et le rythme est conservé. Ctrl+Z annule d'abord le renommage, puis la note (deux étapes distinctes, Ctrl+Y rejoue correctement).

Tableau (notes de départ : Am = A3 C4 E4, C = C3 E3 G3, F = F3 A3 C4, G = G3 B3 D4 ; note tenue sur toute la mesure) :

| Notes posées | Ce que dit le bandeau | Après acceptation | Attendu / verdict |
|---|---|---|---|
| Am + G4 | Am + G : renommer en Am7 ? | Am7 | juste |
| Am + B3 | Am + B : renommer en Amadd9 ? | Amadd9 | juste (graphie « Amadd9 » lourde, « Am(add9) » plus lisible) |
| Am + D4 | Am + D : renommer en Amadd11 ? | Amadd11 | juste |
| Am + G#4 | Am + **A♭** : renommer en Ammaj7 ? | Ammaj7 | nom juste, note mal nommée (EB-02) |
| Am + F#4 | Am + **G♭** : renommer en Am6 ? | Am6 | nom juste, note mal nommée |
| Am + D#4 | rien | rien | Am(b5/#11) possible ; silence total |
| Am : C4 monte en C#4 | Am − C + **D♭** : renommer en A ? | A | nom juste, note mal nommée |
| Am : E4 descend en D#4 | Am − E + E♭ : renommer en Adim ? | Adim | juste |
| Am : E4 monte en F4 (A C F) | rien | rien | attendu F/A (renversement non reconnu) |
| Am : A3 monte en A#3 | rien | rien | combinaison inconnue, aucun message |
| Am : retire E4 (quinte) | rien | rien | acceptable (reste Am) |
| Am : retire C4 | rien | rien | acceptable |
| C + B3 | C + B : renommer en Cmaj7 ? | Cmaj7 | juste |
| C + A#3 | C + B♭ : renommer en C7 ? | C7 | juste |
| C + D3 | C + D : renommer en Cadd9 ? | Cadd9 | juste |
| C + A3 | C + A : renommer en C6 ? | C6 | juste |
| C + F3 | C + F : renommer en Cadd11 ? | Cadd11 | juste |
| C : E3 -> D#3 | C − E + E♭ : renommer en Cm ? | Cm | juste |
| C : E3 -> F3 | C − E + F : renommer en Csus4 ? | Csus4 | juste |
| C : G3 -> G#3 | C − G + **A♭** : renommer en Caug ? | Caug | nom juste, note mal nommée (devrait être G#) |
| C : G3 -> F#3 | rien | rien | C(b5), rare ; silence |
| C : retire E3 / retire C3 | rien | rien | acceptable |
| F + E4 | F + E : renommer en Fmaj7 ? | Fmaj7 | juste |
| F + D#4 | F + E♭ : renommer en F7 ? | F7 | juste (E♭ correct ici) |
| F : A3 -> G#3 | F − A + A♭ : renommer en Fm ? | Fm | juste |
| G + F4 | G + F : renommer en G7 ? | G7 | juste |
| G + E4 | G + E : renommer en G6 ? | G6 | juste |
| G + A3 | G + A : renommer en Gadd9 ? | Gadd9 | juste |
| G : B3 -> A#3 | G − B + B♭ : renommer en Gm ? | Gm | juste |
| G + F4 + A4 | G + F + A : renommer en G9 ? | G9 | juste |
| G : D4 -> C4 | rien | rien | inconnu |
| G + F4 + A3 + E4 (G13) | rien | rien | inconnu |
| C + B3 + D4 + A3 (Cmaj13) | rien | rien | inconnu |
| Am + G (accepté), puis + B3 sans accepter | Am + G + B : renommer en Am9 ? (texte mis à jour sur place) | — | juste |

Retour arrière : après chaque acceptation, Ctrl+Z rend le nom et les notes d'avant (vérifié sur les 33 cas ci-dessus).

Conclusions :
- La justesse musicale des noms est très bonne (triades, 6, 7, maj7, add9, add11, sus4, dim, aug, m, 9).
- Les noms de notes dans le bandeau suivent une orthographe automatique qui préfère les bémols (EB-02).
- Les cas inconnus ne disent rien : l'utilisateur ne sait pas si l'appli n'a pas compris ou si elle n'a rien à proposer.
- Les renversements ne sont pas reconnus (EB-09).
- Le bandeau est visible tant qu'on ne fait rien (plus de 40 s mesurées) ; ce n'est pas un toast qui disparaît. Bien. Mais il apparaît sur le clavier piano, tout en bas, loin de la case concernée (capture 01).
- Le bandeau ignoré (×) revient à la modification suivante (EB-10).

## 2. Gestes

Mesures (Chromium, 34 px par croche, lignes de 29 px, notes de 22 px de haut dans des cases de 26 px) :

- **Poser** : clic sur case vide = note d'une croche (aucune note ne se pose en double-clic). Glisser sur des cases vides = peint une note tenue d'un trait, y compris à travers deux accords. Cela surprend au début : on croit « tirer » quelque chose qui n'existe pas.
- **Déplacer** : glisser par le corps. En horizontal il faut avoir parcouru la croche complète (10, 17, 25 px = rien ; 34 px = +1 ; 51 px = +1 ; 68 px = +2) : troncature, pas arrondi au plus proche. En vertical, +1 demi-ton à partir de 28 px. Aperçu : la note d'origine reste en fantôme, la note déplacée porte un contour blanc (capture 04), mais son étiquette de hauteur ne change pas pendant le glisser.
- **Poignées** : 8 px de large x 20 px de haut (zone active x1-11 à x1-3 mesurée par le curseur ew-resize) sur des croches de 34 px. Le corps de note a le curseur par défaut (pas de « main »). Départ à 2 px du bord droit de la note = déplacement, à 2 px au-delà du bord = peinture d'une nouvelle note collée à la première.
- **Étirer / raccourcir** : par les deux bords. La longueur suit la case sous le pointeur : étirer par le bord droit de 10 px donne déjà +1 croche. Minimum 1 croche, ne passe pas la limite de la mesure. Incohérent avec le déplacement (EB-18).
- **Supprimer** : Suppr, Retour arrière et clic droit > « Supprimer la note » marchent. Le menu contextuel (capture 06) propose aussi « Scinder la note » et « Prolonger d'une croche » ; il n'a ni « Copier » ni « Dupliquer ». Double-clic sur une note : rien. Clic droit sur une case vide : rien.
- **Copier** : Alt + glisser (Alt tenu avant de saisir) copie ; Alt appuyé en cours de glisser déplace. Aucun indice visuel de copie pendant le glisser (même aperçu que le déplacement). Ctrl + glisser : rien. **Ctrl+C puis Ctrl+V avec une note sélectionnée colle un accord entier dans la grille** (EB-06).
- **Sélection** : clic = une note ; Ctrl+clic ou Cmd+clic = ajoute/retire ; **Maj+clic remplace la sélection** (EB-08) ; Maj + glisser = lasso (marche) ; Ctrl+A = tout ; Échap ne désélectionne pas (EB-19) ; clic dans le vide pose une note et désélectionne.
- **Groupe** : le glisser d'une note sélectionnée déplace tout le groupe (vérifié : +2 croches et -1 demi-ton sur deux notes). Si une seule note du groupe sortirait de la mesure, tout est refusé sans message (EB-04). Suppr sur le groupe puis Ctrl+Z : correct.
- **Annuler / rétablir** : Ctrl+Z / Ctrl+Y et boutons de la barre du haut cohérents. L'historique est perdu au rechargement de la page (normal), l'état du morceau (notes, noms) est conservé localement.
- **Annuler un glisser** : Échap pendant le glisser (puis continuer à bouger et relâcher) = rien ne bouge. Marche sur le déplacement.
- **Irrégularité trouvée (EB-03)** : sur 11 essais de déplacement vertical lâchés à 43, 44 et 45 px, le résultat est « aucun changement » alors que 36 px donne +1 et 50 px donne +2. Cause : la case n'a que 26 px de haut dans une ligne de 29 px ; lâcher sur l'interstice annule tout le glisser. Environ 10 % des positions de lâcher.
- **Refus silencieux (EB-04)** : note déposée sur une ligne déjà occupée (B3 monté en C4 alors que l'accord a sa tierce C4 sur toute la mesure), copie Alt qui dépasse la mesure, groupe qui dépasse. Aucun message.
- **Pas de décalage de la note sous la souris** observé : la note suit bien le pointeur, sans saut.

## 3. Rythmes

Motifs relevés (croches 1 à 8 allumées par ligne, de la voix haute à la basse) :

| Rythme | Am (triade) | Cmaj7 (quatre notes) |
|---|---|---|
| Plaqué | E4 12345678 / C4 12345678 / A3 12345678 | B3, G3, E3, C3 tenus |
| Arpège ↑ | E4 3,7 / C4 2,4,6,8 / A3 tenu | B3 4,8 / G3 3,7 / E3 2,6 / C3 tenu |
| Arpège ↓ | E4 2,6 / C4 3,4,7,8 / A3 tenu | B3 2,6 / G3 3,7 / E3 4,8 / C3 tenu |
| Pompe | E4 3,7 / C4 3,7 / A3 1,2,5,6 | B3 3,7 / G3 3,7 / E3 3,7 / C3 1,2,5,6 |
| Ballade | E4 1,4,7 / C4 2,3,5,6,8 / A3 tenu | B3 1,4,7 / G3 3,6 / E3 2,5,8 / C3 tenu |

- Sur quatre notes, les arpèges ressemblent aux vignettes (montée C-E-G-B jouée deux fois, basse tenue). Sur une **triade**, le motif de quatre lignes est « replié » sur trois : la ligne du milieu cumule deux rangs et l'arpège ne monte plus (A tenu, C quatre fois, E deux fois). Le nom et la vignette ne correspondent plus (EB-07). Capture 10 : Cmaj7 ; comparer à Am.
- Appliquer un rythme agit sur l'accord **choisi** seulement. Avec 4 accords sélectionnés (barre « 4 accords sélectionnés : Copier, Dupliquer, Transposer, Boucler, Supprimer »), cliquer Pompe n'agit que sur le dernier (capture 08). Coller un rythme copié : idem (« Coller le rythme de Am sur F », seul F reçoit, pas C, alors que C et F étaient sélectionnés). Maj, Alt ou Ctrl + clic sur le rythme : rien de plus. Le menu de partie (Répéter, Renommer, Monter, Descendre, Dupliquer, Supprimer) n'a pas non plus d'option « rythme ». Sur téléphone au contraire, un commutateur « Toute la partie / Cet accord » existe (EB-05).
- Copier / coller de rythme : bouton à tooltip clair (« Coller le rythme de Am sur F »). Fonctionne sur l'accord choisi.
- Vider : « Effacer le rythme » rend la mesure silencieuse ; la case de la grille est barrée et affiche « SILENCE ». Très bien, mais le mot chevauche le « O3 » (EB-13, capture 07). La grille dit bien quelque chose d'un accord devenu muet.
- Créer une forme : « Enregistrer la forme… » propose un nom (« Forme 1 » présélectionné), Entrée valide, toast « Forme « Ma forme » enregistrée ». La forme apparaît comme sixième motif. Effet de bord : les cinq boutons perdent leur libellé (EB-14, capture 09).
- Les notes ajoutées à la main (notes libres) survivent à l'application d'un rythme : cliquer Plaqué n'efface pas G4 ni B3 ajoutées. Cohérent avec « notes ajoutées », mais pas évident.
- Modifier à la main un rythme fourni : le bouton « + rythme libre » s'allume dès qu'on retouche une note. Bien.
- Le clic droit sur un rythme propose « Modifier ce schéma… » et « Masquer ce rythme ».

## 4. Lecture

- Après Lecture, il y a un décompte de 2 s (à 120 BPM) sans indication visible ; puis la case de la grille s'allume, la tête du séquenceur et la frise du bas avancent en phase (écarts mesurés de 1 à 15 px à la croche).
- Chaque accord dure 2 s, l'index de la case allumée et « Mesure n / 6 » changent ensemble (à +-0,1 s près).
- Stop : le compteur revient à « Mesure 1 / 6 », la case s'éteint. Relancer repart du début (compteur juste après trois Stop / relances). Un deuxième clic sur Lecture arrête (pas de pause).
- Plage à boucler : glisser sur la règle des mesures (rangée de 16 px de haut sous les cases) de la mesure 2 à la mesure 4, puis de la 4 à la 2 : même plage orange 2-4 dans les deux sens, commence sous le pointeur. La zone active est toute la largeur de la mesure (pas seulement le chiffre). À y = +10 px sous la règle : rien. Capture 11.
- Lecture en boucle d'une plage de deux mesures : 1-2-1-2 propre, compteur juste.
- Pendant le décompte, le compteur affiche « Mesure 1 » même si la boucle commence à la mesure 2 (EB-17).
- Un clic dans une case de la grille place la tête à cet endroit de la mesure (trait vert).

## 5. Autres moteurs et téléphone

- **Firefox et WebKit** : pose d'une note, proposition (même texte en 0,76 s), acceptation, étirement par poignée, déplacement, Suppr, Ctrl+Z, Échap pendant glisser, lasso Maj, Alt + glisser = copie, clic droit : résultats identiques à Chromium. WebKit affiche des erreurs réseau pour les échantillons de piano (tonejs.github.io, sans accès ici) : sans rapport avec l'appli.
- **Téléphone (Pixel 7, 412 x 839)** : le séquenceur s'ouvre en volet depuis le bouton « Séquenceur » ; en-tête « Am vi · mes. 1 » avec flèches d'accord et fermeture ; onglets Accord / Voicing / Rythme ; rythmes en vignettes ; commutateurs Voix / Toutes les notes et Toute la partie / Cet accord ; cases de 42 x 40 px. Un toucher pose une note d'une croche (D4 posée). Un glisser sur le fond fait défiler (annoncé par le tooltip « Dessiner »). Les poignées existent (12-13 px de large, petites pour un doigt) : étirer D4 de +90 px l'a prolongée de 2 croches. Glisser le corps de la note ne la déplace pas. Une note G3 tenue sur la mesure n'a produit aucun bandeau de proposition (élément absent) lors de mon essai (EB-16).
- L'ajout d'accords sur téléphone passe par un volet d'accords de la tonalité ; il se referme après chaque accord (il faut le rouvrir quatre fois pour Am, C, F, G).

## 6. Le reste

- Fenêtre « Retrouve ton travail partout » à chaque chargement (case « Ne plus me le proposer » utile mais en petit).
- Étiquettes de lignes à gauche en vue Accord : elles reprennent les notes de l'accord choisi (E4, C4, A3) alors que les autres accords de la ligne ont d'autres notes dans les mêmes lignes (G3, E3, C3) : trompeur (EB-12, capture 08).
- Après acceptation d'un renommage, la ligne vide « G4 ✕ » (ancienne note libre) reste affichée à côté de la ligne G4 devenue note d'accord (capture 03) ; une ligne vide sans étiquette apparaît aussi au-dessus quand la partie a un accord à quatre notes ailleurs (EB-11).
- Grille d'accords et séquenceur ouverts avec plus de 4 mesures : la deuxième ligne de la grille est coupée par le bouton « Ajouter section » (capture 05).
- Après quelques redressements de panneau, l'appli reste fluide ; aucune erreur JavaScript en Chromium sur tout l'essai.
- Bon : tooltips très détaillés, notation internationale, retours (toasts « Rétabli », « Accord collé », « G7 ajouté ») lisibles.

## Bugs

**EB-01 (gênant, tous moteurs) Proposition périmée après Ctrl+Z ; l'accepter supprime la tierce.**
Étapes : morceau Am C F G ; séquenceur en vue Piano ; sur F, glisser A3 vers G#3 (bandeau « F − A + A♭ : renommer en Fm ? ») ; cliquer à côté puis Ctrl+Z (A3 revient) ; le bandeau reste affiché ; cliquer Renommer.
Observé : F devient Fm et les lignes de F ne contiennent plus que F3 et C4 (A3 et G#3 absents). Attendu : le bandeau disparaît à l'annulation, ou l'acceptation écrit Fm avec A♭3. Capture 02.

**EB-02 (gênant, tous moteurs) Altérations écrites avec des bémols à tort dans le bandeau.**
Étapes : Am, vue Piano, peindre G#4 sur la mesure. Observé : « Am + A♭ : renommer en Ammaj7 ? » (la ligne s'appelle G#4). Idem F#4 -> « G♭ » (Am6), C4 monté en C#4 -> « D♭ » (A), G3 -> G#3 sur C -> « A♭ » (Caug). Attendu : G#, F#, C#, G# (les lignes et la tonalité utilisent les dièses ; la 7e majeure de Am est G#).

**EB-03 (gênant, tous moteurs) Déplacement annulé si on lâche entre deux lignes.**
Étapes : vue Piano, note libre G4 ; la saisir par le corps et la monter de 43, 44 ou 45 px, relâcher. Observé : la note revient à sa place sans rien dire (à 36 px : +1 demi-ton ; à 50 px : +2). Attendu : suit la ligne la plus proche. Cause probable : les cases font 26 px dans des lignes de 29 px.

**EB-04 (gênant, tous moteurs) Refus silencieux.**
Cas : (a) glisser une note libre B3 vers C4 alors que C4 est tenu par l'accord ; (b) groupe de deux notes dont une dépasserait la mesure ; (c) Alt + glisser d'une copie qui dépasse la mesure. Observé : rien ne bouge, aucun message ni aperçu rouge. Attendu : message court (« Place occupée ») ou limite visible pendant le glisser.

**EB-05 (gênant, tous moteurs) Rythme appliqué à un seul accord.**
Étapes : Ctrl+clic sur Am, C, F, G dans la grille (« 4 accords sélectionnés ») ; cliquer Pompe. Observé : seul G change (capture 08) ; même chose avec Coller un rythme. Aucune option « toute la partie » sur ordinateur, alors que le téléphone a « Toute la partie / Cet accord ». Attendu : s'applique à tous les accords sélectionnés ou à la partie.

**EB-06 (gênant, tous moteurs) Ctrl+C / Ctrl+V dans le séquenceur colle un accord.**
Étapes : sélectionner la note G4, Ctrl+C, cliquer dans le vide (pose A4), Ctrl+V. Observé : toast « Accord collé », un accord Am est inséré dans la grille (6 mesures -> 7 ; G repoussé), avec ses notes et son rythme. Attendu : copie de la note sélectionnée (ou au moins un message). Capture 05.

**EB-07 (gênant, tous moteurs) Arpèges et Ballade pliés sur les triades.**
Étapes : Am (triade), cliquer Arpège ↑. Observé : A3 tenu, C4 en croches 2,4,6,8, E4 en 3 et 7 : ce n'est pas un arpège qui monte. Sur Cmaj7 le même rythme monte bien (capture 10). Attendu : un motif écrit pour trois notes ou une adaptation qui conserve la montée.

**EB-08 (mineur) Maj+clic ne cumule pas la sélection.** Étapes : clic sur E4, Maj+clic sur G4. Observé : seule G4 reste sélectionnée. Ctrl/Cmd+clic cumule. Attendu (réflexe Logic/GarageBand) : Maj+clic ajoute.

**EB-09 (mineur) Renversements et cas inconnus sans réponse.** Am avec E4 monté en F4 (A C F) : aucun bandeau (attendu F/A). Am + D#4, C : G3 -> F#3, G13, Cmaj13 : aucun message non plus ; l'utilisateur ne sait pas si l'analyse a eu lieu.

**EB-10 (mineur) « Ignorer » non retenu et texte obsolète.** Étapes : Am + G + B -> Ignorer (×) ; ajouter D4 (aucun bandeau) ; retirer D4 : le bandeau « Am + G + B : renommer en Am9 ? » revient. Autre cas : bandeau affiché, puis ajout d'une note qui rend la combinaison inconnue : le texte ancien reste affiché sans lien avec les notes.

**EB-11 (mineur) Lignes fantômes en vue Accord.** Après acceptation d'un renommage qui absorbe une note libre : ligne vide « G4 ✕ » en double ; ligne vide sans étiquette en haut quand un autre accord de la ligne affichée a quatre notes (capture 03).

**EB-12 (mineur) Étiquettes de lignes trompeuses.** En vue Accord les étiquettes E4 / C4 / A3 sont celles de l'accord choisi ; les cases des autres accords ont d'autres hauteurs (G3, E3, C3) sur les mêmes lignes. Les étiquettes changent selon l'accord choisi (D4, B3, G3 quand G est choisi, capture 08).

**EB-13 (mineur) « SILENCE » chevauche « O3 » dans la case barrée.** Étapes : choisir C, Effacer le rythme. Capture 07.

**EB-14 (mineur) Les rythmes perdent leur libellé après l'ajout d'une forme.** Étapes : Enregistrer la forme « Ma forme » : les six boutons passent en icônes seules (capture 09). Attendu : libellés conservés ou réduits de façon stable.

**EB-15 (mineur) Grille d'accords rognée.** Séquenceur ouvert et plus de 4 mesures : la deuxième ligne de la grille est coupée par « Ajouter section » (capture 05).

**EB-16 (mineur, téléphone) Pas de bandeau de proposition vu ; poignées de 12-13 px.** Pixel 7 : Am + G3 tenu : l'élément de proposition reste caché (display none) après 3 s. Poignées d'étirement de 12 x 34 px (pour un doigt, 44 px recommandés). Capture 14.

**EB-17 (mineur) Compteur pendant le décompte.** Boucle 2-3 : pendant les 2 s de décompte, « Mesure 1 / 6 » est affiché puis « Mesure 2 / 6 » au démarrage.

**EB-18 (mineur) Réglage d'accrochage incohérent.** Déplacement : il faut 34 px entiers pour +1 croche (troncature) ; redimensionnement : +1 croche dès que le pointeur franchit la case voisine (3 px suffisent). Le curseur du corps de note reste « flèche » (pas d'indice de glisser).

**EB-19 (mineur) Échap ne désélectionne pas.** Après Ctrl+A ou un lasso, Échap laisse la sélection.

## Améliorations proposées

**Fort**
1. Appliquer rythme / coller rythme à la sélection d'accords, et ajouter « toute la partie » sur ordinateur (comme sur téléphone).
2. Invalider le bandeau de nom dès que les notes changent (annulation, nouvelle édition) et le recalculer à chaque modification ; l'afficher près du séquenceur plutôt que sur le clavier piano.
3. Accepter la proposition sans jamais supprimer de note (EB-01) et écrire les dièses et bémols selon la note posée.
4. Rendre la zone de dépôt tolérante : prendre la ligne la plus proche, aucune annulation entre deux lignes.
5. Afficher une raison quand un glisser est refusé (ligne occupée, hors mesure) et la limite pendant le glisser.

**Moyen**
6. Reconnaître les renversements (F/A) et dire « pas un accord connu » pour les combinaisons inconnues (« Am + D# : aucun nom proposé »).
7. Ctrl+C / Ctrl+V dans le séquenceur doivent copier les notes sélectionnées ; garder le collage d'accords pour la grille.
8. Maj+clic qui cumule (et Maj+clic = plage dans une même ligne) ; Échap qui désélectionne.
9. Adapter les arpèges aux triades (un motif par nombre de voix) et dessiner la vignette d'après le motif réel.
10. Étiquettes de lignes de la vue Accord : numéroter les voix (1 basse, 2, 3) ou afficher la hauteur dans chaque case, supprimer les lignes fantômes vides après renommage.
11. Retenir « Ignorer » par accord et par combinaison de notes.
12. Afficher le décompte (3-2-1 ou voyant) et la plage à boucler aussi dans la règle du séquenceur.

**Faible**
13. Curseur « main » sur le corps d'une note, indice « + » sur le curseur pendant Alt + glisser, étiquette de hauteur qui suit le glisser.
14. Zone des poignées plus large (12 px minimum, 16 px au toucher) ; poignées de 44 px au téléphone.
15. Ajouter « Copier » / « Dupliquer » au menu contextuel de la note ; double-clic sur une note = renommer ou menu.
16. Graphies plus lisibles : Am(add9), Am(maj7).
17. Garder les libellés des rythmes ou les passer en deux lignes quand une forme est ajoutée.
18. Volet d'ajout d'accords sur téléphone : rester ouvert après chaque accord.

## Limites de l'essai

- Aucun son dans la machine : je n'ai pas pu juger de l'effet réel des rythmes ni du moment où une note « sonne » ; seules la tête, la case allumée et le compteur ont été suivis.
- Navigation tactile limitée à Pixel 7 en Chromium (pas d'iPhone WebKit tactile) et gestes par événements tactiles simulés, sans appui long ni deux doigts. La proposition de nom sur téléphone n'a été essayée qu'une fois.
- Pas de test de la vue Voicing, de la fenêtre d'accord à trois onglets, du plein écran du séquenceur, de la synchronisation et des réglages de verre (hors périmètre prioritaire).
- Une fois, le premier bandeau (G4 posé juste après le chargement, essai en Chromium) n'est pas apparu dans la seconde et demie d'attente ; non reproduit ensuite.
- L'historique d'annulation est perdu à chaque rechargement ; j'ai donc regroupé les scénarios d'annulation dans des sessions continues.
- Les résultats d'accrochage (dead zone de 3 px) ont été mesurés avec des mouvements de souris simulés pas à pas ; sur une vraie main, la fréquence réelle de lâcher dans l'interstice dépend du geste.
