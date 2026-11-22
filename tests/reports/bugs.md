# Bugs trouvés par les tests de bout en bout

Tenu par le sous-agent `testeur-e2e` (phase 5 de `tests/PLAN.md`). Les bugs ne sont PAS corrigés pendant l'écriture des tests : l'utilisateur décide quand.
Gravité : **bloquant** (empêche un parcours principal), **gênant** (contournable mais pénible), **mineur** (cosmétique, ou comportement à arbitrer).

| # | Date | Module | Navigateur / appareil | Gravité | Résumé | Statut |
|---|---|---|---|---|---|---|
| G-01 | 16/11 | grille | Firefox ordinateur | gênant | Un clic sur une case d'une AUTRE partie ne la sélectionne pas (il faut cliquer deux fois) | ouvert |
| G-02 | 16/11 | grille | tous les ordinateurs et l'iPad | mineur | La barre de lecture garde un ancien total de mesures après « Supprimer la partie » ou « Dupliquer » une partie | ouvert |
| G-03 | 16/11 | grille | tous les ordinateurs et l'iPad | mineur (à arbitrer) | Un double-clic sur le « + » d'une case ouvre le panneau d'ajout puis le referme aussitôt | ouvert |
| G-04 | 16/11 | grille | tous | mineur (à arbitrer) | Une saisie refusée (« C Am F G » avec espaces, « xyz ») ne produit aucun message : le texte reste, rien ne se passe | ouvert |
| A-01 | 17/11 | accord | tous | mineur | La fenêtre d'accord enregistre durée, octave et renversement en TEXTE (`"3"`, `"1"`) au lieu de nombres | ouvert |
| A-02 | 17/11 | accord | tous les ordinateurs | mineur (à arbitrer) | Une basse égale à la fondamentale s'écrit « Am/A » au lieu de « Am » | ouvert |
| A-03 | 17/11 | accord | tous les ordinateurs | mineur | Onglet Rythme : un accord tenu n'a aucune forme marquée séquenceur fermé, puis « Plaqué » quelques instants après son ouverture | ouvert |
| L-01 | 17/11 | lecture | tous les ordinateurs et l'iPad | gênant | Règle des mesures : la zone sensible d'un numéro est décalée vers la droite (10 px sous le « 2 », 24 px sous le « 4 ») ; appuyer au centre du « 3 » ou du « 4 » commence la plage à la mesure précédente | ouvert |
| L-02 | 17/11 | lecture | tous les ordinateurs et l'iPad | mineur | Chevrons du tempo : l'infobulle dit « maintenir pour faire défiler » mais, à la souris, maintenir ne fait que +1 | ouvert |
| L-03 | 17/11 | lecture | tous les ordinateurs et l'iPad | mineur (accessibilité) | Curseur de vitesse : l'accroche aux repères (50, 75, 100, 150, 200 %) rend les flèches du clavier sans effet depuis ces repères (100 % : impossible d'en sortir avec ← →) | ouvert |
| L-05 | 17/11 | lecture | tous (Chromium, Firefox, WebKit, iPad) | mineur (intermittent) | Après « Stop », une case reste parfois allumée (classe `playing`) alors que la lecture est arrêtée ; elle le reste jusqu'à la prochaine lecture (≈ 3 % des arrêts en rafale) | ouvert |
| L-04 | 17/11 | lecture | Firefox, WebKit, iPhone, iPad | mineur (à arbitrer) | Avec une case sélectionnée, « Lecture » démarre à cette case sous Chromium / Edge / Android, mais au début du morceau sous Firefox et WebKit | ouvert |
| L-06 | 17/11 | lecture | Chromium, Firefox (vu 3 fois) | mineur (intermittent) | Après « Stop » en cours de lecture, la lecture suivante démarre parfois à la 3ᵉ case au lieu de la 1ʳᵉ (≈ 1 fois sur 10 à 15, plus souvent quand la machine est chargée) | ouvert |
| S-01 | 17/11 | sequenceur | tous les ordinateurs | mineur (à arbitrer) | Ajouter une note libre qui est déjà une note de l'accord (C4 sous Am) crée une seconde ligne « C4 » identique | ouvert |
| S-02 | 17/11 | sequenceur | téléphones (Android, iPhone) | gênant | Au téléphone, « Enregistrer la forme… » (menu « Tous les rythmes ») ferme la feuille d'accord, donc le séquenceur, alors que le menu reste ouvert | ouvert |
| S-03 | 17/11 | sequenceur | tous les ordinateurs et l'iPad | gênant (à arbitrer) | Le séquenceur ouvert, Suppr sans note sélectionnée supprime l'accord choisi de la grille, sans confirmation | ouvert |
| F-01 | 17/11 | fichiers | tous | gênant | Exporter en JSON un morceau MODIFIÉ (« Ce morceau », ou « Exporter en JSON et continuer » de la fenêtre « Modifications non enregistrées ») livre la dernière version ENREGISTRÉE : les modifications de l'écran ne sont pas dans le fichier | ouvert |
| F-02 | 17/11 | fichiers | tous | mineur (à arbitrer) | Supprimer le morceau ouvert (« Mes morceaux ») remet le titre à « Nouveau morceau » mais laisse ses accords affichés dans la grille | ouvert |
| F-03 | 17/11 | fichiers | Chromium, Edge, Firefox (ordinateur, sans dossier de rangement) | gênant | « Export intégral » sans dossier de rangement : la « Sauvegarde du morceau » (.json) échoue (« 3 fichier(s) exporté(s) · échec : Sauvegarde du morceau ») alors qu'elle est cochée par défaut | ouvert |
| F-04 | 17/11 | fichiers | Chromium headless de la VM (Edge : non) | environnement (à confirmer) | Avec un dossier de rangement, exporter (MIDI, PDF, intégral) pour un morceau ENREGISTRÉ fait mourir le navigateur de test (« Target page, context or browser has been closed ») ; sans enregistrement ou sous Edge, tout passe | ouvert |
| Y-01 | 17/11 | synchro | tous (vu sur Chromium, WebKit, Firefox) | gênant (affichage trompeur, intermittent) | Après une coupure du réseau SANS rien à envoyer, la pastille reste « Hors ligne » quand le réseau revient (≈ 9 fois sur 10), jusqu'au prochain enregistrement ou à une modification venue d'un autre appareil | ouvert |
| Y-02 | 17/11 | synchro | tous | mineur (à arbitrer) | Appareil partagé : après « Se déconnecter » puis connexion avec un AUTRE compte, les morceaux du premier compte, restés dans le navigateur, partent dans le cloud du second | ouvert |
| Y-03 | 18/11 | synchro | WebKit, Android, iPhone (rare, sous charge) | mineur (intermittent) | Après une coupure du réseau, la pastille reste « Synchronisé » pendant 20 s ou plus alors que le réseau est coupé (≈ 2 à 3 fois sur 100 coupures) | ouvert |
| T-01 | 18/11 | tonalite | tous | mineur (à arbitrer) | Écriture des dièses incohérente : le résumé du morceau dit « F# majeur » (dièse ASCII) là où la fenêtre et la puce disent « F♯ » (les noms d'accords, eux, écrivent « C# » et « E♭ ») | ouvert |
| T-02 | 18/11 | tonalite | tous | mineur | Une tonalité posée avec « Suggérer » n'entre pas dans l'historique : « Annuler » reste grisé (choisir une tonique ou transposer, eux, s'annulent) | ouvert |
| T-03 | 18/11 | tonalite | tous | mineur (à arbitrer) | La basse d'un accord ne suit pas la règle d'écriture des fondamentales : en do « C/Eb » s'écrit C/D# (la fondamentale Eb s'écrit E♭) ; en mi majeur « D/F# » s'écrit D/G♭ (la fondamentale F# s'écrit F#) | ouvert |
| T-04 | 18/11 | tonalite | tous | mineur (à arbitrer) | Chiffres romains : « Fmaj7 » et « F7 » sont tous deux notés « IV7 » (« Cmaj7 » : « I7 ») : la septième majeure ne se distingue pas de la septième de dominante | ouvert |
| T-05 | 18/11 | tonalite | tous | mineur (à arbitrer) | Chiffres romains hors échelle : en do phrygien « Dm » est noté « biii », en do mixolydien « Bdim » « bi° » (bémol du degré supérieur au lieu d'un dièse) | ouvert, sans test |
| M-01 | 18/11 | mobile | téléphones (Android, iPhone) | mineur | « Modifier » (menu de l'appui long) ouvre la feuille d'accord avec l'onglet « Voicing » marqué alors que le haut de la feuille montre le contenu de l'onglet Accord | ouvert |
| M-02 | 18/11 | mobile | téléphones (Android) ; même chose à la souris (Ctrl+glisser) | mineur (à arbitrer) | Appui long puis glisser une case vers une AUTRE partie : l'accord est copié juste après l'original (dans sa propre partie) au lieu de l'être dans la partie visée ; dans la même partie la copie se place AVANT la case visée, quel que soit le côté | ouvert, sans test |
| V-01 | 18/11 | voicing | tous les ordinateurs et l'iPad | mineur (accessibilité, à arbitrer) | Au clavier, « Entrée » sur le bouton « Voicing » ouvre la fenêtre « Conduite des voix » mais le focus n'y entre pas : « Tab » traverse toute la grille (14 appuis) avant d'atteindre les boutons H et V | ouvert |
| V-02 | 18/11 | voicing | tous | mineur (à arbitrer) | Le chiffre romain d'un accord à neuvième ou à septième diminuée perd l'extension : Cmaj9 est noté « I » (alors que G9 est noté « V9 »), Cdim7 « i° » comme Cdim (même cause que T-04 ; la grille écrit la même chose) | ouvert |
| D-01 | 18/11 | diagrammes | tous les ordinateurs et l'iPad | gênant | Renommer l'accord choisi en cliquant sur son nom dans la case : la case change mais le clavier et le manche du tiroir gardent l'ANCIEN accord (G7 au lieu de Bm7) jusqu'au prochain changement de sélection | ouvert |
| D-02 | 18/11 | diagrammes | tous (ordinateurs, iPad, téléphones) | gênant | « Afficher la guitare » alors qu'un accord est déjà choisi : le tiroir (nom, notes, touches du clavier, manche) passe sur Do, l'accord par défaut, alors que la case reste sélectionnée ; il faut cliquer un autre accord pour retrouver le bon | ouvert |
| D-03 | 18/11 | diagrammes | tous | mineur (à arbitrer) | Éditeur de manche : le dessin d'un La mineur ouvert (x02210, notes A C E) propose « Am, C6, Am7, Am6 » ; Do ouvert (x32010) propose « C, C6, Cmaj7, C7 » : des accords dont une note (septième ou sixte) n'est pas sur le manche | ouvert, sans test |
| D-04 | 18/11 | diagrammes | WebKit (Safari), iPad (intermittent, machine chargée) | mineur (intermittent) | Après « Annuler » / « Rétablir » du verrouillage d'un doigté, le bouton cadenas reste plusieurs secondes dans l'ancien état (le doigté fixé et le point orange sont déjà bons) | ouvert |
| R-01 | 18/11 | structure | tous | mineur | En 3/4, le total de la fenêtre Structure s'écrit « 12.0 mesures » (avec décimale) alors que les parties s'écrivent « 4 mes. » et que le total vaut un nombre entier | ouvert |
| R-02 | 18/11 | structure | tous les ordinateurs et l'iPad | gênant | Échap dans la fenêtre « Renommer cette occurrence » ou « Commentaire » ferme la fenêtre Structure derrière et laisse la petite fenêtre ouverte au-dessus de la grille | ouvert |
| R-03 | 18/11 | structure | tous | mineur | Après « + » / « − » dans la fenêtre Structure, la grille n'affiche pas le badge ×N de la partie tant qu'on ne recharge pas la page | ouvert |
| Z-01 | 19/11 | robustesse | tous | mineur (à arbitrer) | Après « Nomme d'abord ton morceau… » (export d'un morceau sans nom), un clic à côté du champ du nom enregistre aussitôt un morceau vide « Sans titre » que l'utilisateur n'a pas demandé | ouvert |
| Z-02 | 19/11 | robustesse | tous (mesuré sur Chromium) | gênant | Stockage plein : « Enregistrer » échoue sans aucun message (exception non interceptée « quota exceeded »), le morceau reste « Non enregistré » sans qu'on sache pourquoi | ouvert |
| Z-03 | 19/11 | robustesse | tous (mesuré sur Chromium) | gênant | Copie de travail non écrivable (stockage plein ou refusé) : ajouter un accord ne fait rien (le texte reste dans le champ, aucun message) au lieu de travailler en mémoire | ouvert |
| Z-04 | 19/11 | robustesse | tous (mesuré sur Chromium) | gênant (rare) | Stockage local bloqué (SecurityError : cookies bloqués, certains modes privés) : `window.app` n'existe jamais, la page est un décor mort, sans message | ouvert |
| Z-05 | 19/11 | robustesse | tous (mesuré sur Chromium) | gênant (rare) | Données de morceau de la mauvaise forme (JSON valide) : bibliothèque qui n'est pas une liste, élément `null`, partie sans `chords`, accord `null` empêchent l'appli de démarrer (même famille que E-06) | ouvert |
| Z-06 | 19/11 | robustesse | tous | gênant | Après rechargement, un morceau enregistré puis modifié sans enregistrer s'affiche « Enregistré à hh:mm » alors que la grille porte la modification : l'état affiché est faux (rien n'avertit en le quittant) | ouvert |
| Z-07 | 19/11 | robustesse | tous (mesuré sur Chromium) | gênant | Deux onglets : l'onglet resté sur « Alpha » bascule en silence, au premier geste, sur le morceau ouvert par l'autre onglet (« Charlie ») et y écrit : l'accord tapé dans « Alpha » atterrit dans « Charlie » | ouvert |

Tests qui échouent à cause de ces bugs : marqués `test.fail()` (échec attendu, vérification intacte) pour que la CI reste verte ; ils deviendront ROUGES le jour où le bug est corrigé : retirer alors le `test.fail` :
G-01 → `grille/selection.spec.ts` « un clic sur une case d'une autre partie la sélectionne du premier coup » et `grille/copier-coller.spec.ts` « on peut coller dans une autre partie… » (Firefox seulement) ;
G-02 → `grille/parties.spec.ts` « après la suppression d'une partie… » et « ajouter une partie met à jour le nombre de mesures… » ;
G-03 → `grille/ajout-au-clic.spec.ts` « un double-clic sur le « + » laisse le panneau d'ajout ouvert ».
A-01 → `accord/onglet-voicing.spec.ts` « les valeurs enregistrées restent des nombres… » ;
A-02 → `accord/onglet-accord.spec.ts` « une basse égale à la fondamentale n'ajoute pas « /A » au nom » ;
A-03 → `accord/onglet-rythme.spec.ts` « un accord tenu est marqué « Plaqué », séquenceur fermé comme ouvert ».
L-01 → `lecture/boucle.spec.ts` « appuyer sur le numéro « 3 » / « 4 » de la règle… » (2 tests, ordinateurs et iPad) ;
L-02 → `lecture/vitesse-metronome.spec.ts` « maintenir « Plus rapide » enfoncé fait défiler le tempo… » ;
L-03 → `lecture/vitesse-metronome.spec.ts` « au clavier, les flèches font quitter un repère (100 %) » ;
L-04 → `lecture/lecture-stop.spec.ts` « avec une case sélectionnée, la lecture démarre à cette case… » (échec attendu sur Firefox, WebKit, iPhone, iPad).
L-05 : pas de test rouge (intermittent : un `test.fail` passerait au hasard et ferait échouer la CI) ; le premier test de `lecture/lecture-stop.spec.ts` vérifie quand même « plus aucune case allumée » après Stop, à un instant fixe où le défaut n'a pas été vu (40 / 40 sur Chromium et WebKit).
S-01 → `sequenceur/notes-ajoutees.spec.ts` « ajouter une note déjà présente dans l'accord ne crée pas une seconde ligne identique » ;
S-02 → `sequenceur/formes.spec.ts` « « Enregistrer la forme… » laisse la feuille d'accord et le séquenceur ouverts » (téléphones) ;
S-03 → `sequenceur/notes.spec.ts` « Suppr sans note sélectionnée ne supprime pas l'accord ».
F-01 → `fichiers/export-import-json.spec.ts` « « Ce morceau » exporte les modifications non enregistrées de l'écran » et `fichiers/nouveau-enregistrer.spec.ts` « « Exporter en JSON et continuer » télécharge le morceau MODIFIÉ… » ;
F-02 → `fichiers/liste-morceaux.spec.ts` « F-02 : supprimer le morceau ouvert vide aussi la grille » ;
F-03 → `fichiers/pdf-export.spec.ts` « l'export intégral livre aussi la sauvegarde JSON du morceau (4 fichiers)… » ;
F-04 : `fichiers/rangement-disque.spec.ts`, `test.fixme` sur le projet `chromium` seulement (lancer avec `E2E_DISQUE_CHROMIUM=1` pour réessayer) ; Edge exécute les mêmes tests.
G-04 : pas de test rouge (le test `« C Am F G » (séparés par des espaces) n'ajoute rien` fige le comportement observé).
Y-01 → `synchro/reseau.spec.ts` « Y-01 : après une coupure SANS rien à envoyer, la pastille repasse à « Synchronisé »… » en `test.fixme` (INTERMITTENT : un `test.fail` passerait au hasard et ferait échouer la CI) ; retirer le `fixme` (le test devient un test normal) quand le bug est corrigé.
Y-02 : pas de test rouge ; `synchro/deconnexion.spec.ts` « Y-02 (constat, à arbitrer)… » fige le comportement observé et rougira le jour où il change.
Y-03 : pas de test dédié (intermittent, ≈ 2 %) ; il rend « flaky » (réussis au 2ᵉ essai en CI) les tests de `synchro` qui commencent par couper le réseau, d'où leur place dans la rubrique « instabilités » du rapport.
T-01 → `tonalite/notation.spec.ts` « T-01 : la tonalité s'écrit pareil dans la fenêtre et dans le résumé du morceau » ;
T-02 → `tonalite/suggestion.spec.ts` « la proposition choisie se défait avec « Annuler » (comme un choix de tonique) » ;
T-03 → `tonalite/notation.spec.ts` deux tests « T-03 : … » (do majeur : C/Eb ; mi majeur : D/F#) ;
T-04 → `tonalite/degres.spec.ts` « T-04 : un accord de septième majeure et un accord de septième de dominante n'ont pas le même chiffre ».
T-05 : constaté sans test (voir ci-dessous).
V-01 → `voicing/ouverture.spec.ts` « au clavier : après Entrée sur le bouton, la touche Tab mène dans la fenêtre… » ;
V-02 → `voicing/conduite-des-voix.spec.ts` « le chiffre romain garde l'extension de l'accord : Cmaj9 « I9 »… ».
D-01 → `diagrammes/doigtes.spec.ts` « renommer l'accord choisi met aussitôt à jour le clavier et le manche (D-01) » ;
D-02 → `diagrammes/tiroir.spec.ts` et `diagrammes/telephone.spec.ts` « afficher la guitare alors qu'un accord est déjà choisi… (D-02) » ;
D-03 : pas de test rouge (constat).
D-04 → `diagrammes/doigtes.spec.ts` « D-04 : juste après Annuler / Rétablir, le bouton cadenas… » (`test.fixme` sur WebKit, iPad compris).

## Bugs corrigés (suivi des corrections, à partir du 19/11)

| Bug | Corrigé le | Comment | Test |
|---|---|---|---|
| P-05 | 19/11 | Paroles : les textes sont rangés par identifiant de partie (`sid`), plus par position ; les parties retirées restent en réserve (retour par Ctrl+Z) | `lien-grille.spec.ts`, `test.fail` retirés |
| P-06 | 19/11 | Paroles : les pastilles sont rattachées à l'accord (plus longue suite commune des symboles), plus à son rang | idem |
| P-03 | 19/11 | Paroles : une frappe qui rejoint un groupe encore ouvert vide aussi la pile « Rétablir » | `glisser-annuler.spec.ts`, `test.fail` retiré |
| Z-06 | 19/11 | Le drapeau « modifié » est retenu dans le stockage (`harmohub_tampon_modifie`) et relu au démarrage | `rechargement.spec.ts`, `test.fail` retiré |
| F-01 | 19/11 | « Exporter… › Ce morceau » et « Exporter en JSON et continuer » livrent le tampon affiché quand il est modifié (sans l'enregistrer) | `export-import-json.spec.ts`, `nouveau-enregistrer.spec.ts` |
| F-03 | 19/11 | Export intégral sans dossier : la sauvegarde JSON se télécharge | `pdf-export.spec.ts` |
| E-06, E-07 | 19/11 | Volumes relus du stockage : valeur d'usine si ce n'est pas un nombre, bornés à 0-100 | `persistance.spec.ts` |
| Z-04 | 19/11 | Stockage local refusé : repli sur un stockage en mémoire (l'appli démarre, ne retient rien) | `stockage.spec.ts` |
| Z-05 | 19/11 | Bibliothèque ou tampon de mauvaise forme : on garde ce qui est utilisable | `stockage.spec.ts` ×4 |
| D-01 | 19/11 | Renommer l'accord choisi : le tiroir (clavier, manche) suit aussitôt | `diagrammes/doigtes.spec.ts` |
| D-02 | 19/11 | « Afficher la guitare » avec un accord choisi dessine cet accord, plus celui du panneau | `tiroir.spec.ts`, `telephone.spec.ts` |
| E-02 | 19/11 | Espace sur un contrôle de la fenêtre Paramètres ne lance plus la lecture | `parametres/fenetre.spec.ts` |
| R-02 | 19/11 | Échap dans « Renommer » / « Commentaire » de la structure ferme seulement la petite fenêtre | `structure/ajouter-retirer.spec.ts` ×2 |
| G-02 | 19/11 | La barre de lecture met à jour son total « / N » à chaque redessin de la frise | `grille/parties.spec.ts` ×2 |
| R-01 | 19/11 | Total de mesures arrondi avant l'affichage (« 12 » et non « 12.0 ») | `structure/ouverture.spec.ts` |
| R-03 | 19/11 | Le badge ×N de la grille suit un réglage fait dans la structure | `structure/lien-grille.spec.ts` |
| T-02 | 19/11 | « Suggérer » prend l'instantané d'annulation avant de changer la tonalité | `tonalite/suggestion.spec.ts` |
| P-01, P-02, P-07 | 20/11 | Paroles : bouton « Nommer le morceau » à la largeur du libellé ; recliquer l'accord armé (par un clic) le désarme ; aide des versions au style des autres | `paroles/*.spec.ts` |
| A-01 | 20/11 | La fenêtre d'accord enregistre durée, octave et renversement en nombres | `accord/onglet-voicing.spec.ts` |
| M-01 | 20/11 | Téléphone : « Modifier » (appui long) ouvre le panneau comme le double toucher (onglet Accord) | `mobile/gestes.spec.ts` |
| Z-02 | 20/11 | Stockage plein : « Enregistrer » le dit par un message, sans exception non interceptée | `robustesse/stockage.spec.ts` ×2 |
| Z-03 | 20/11 | Stockage plein : la copie de travail continue en mémoire (prototype de Storage, message une fois) | `robustesse/stockage.spec.ts` |
| T-01 | 20/11 (décidé) | Résumé du morceau en « F♯ majeur » comme la puce ; les noms d'accords de la grille gardent « C# » (règle du 16/11) | `tonalite/notation.spec.ts` |
| T-03 | 20/11 (décidé) | La basse s'écrit comme une fondamentale de la tonalité (C/E♭ en do, D/F# en mi) | `tonalite/notation.spec.ts` ×2 |
| T-04, V-02 | 20/11 (décidé) | Chiffres romains : « IVmaj7 » ≠ « IV7 », « Imaj9 », « i°7 » ≠ « i° » | `tonalite/degres.spec.ts`, `voicing/conduite-des-voix.spec.ts` |
| E-03, E-05 | 20/11 (décidé) | Pastilles de la guitare et touches du piano : orthographe de l'accord affiché, comme sa fiche (E♭ G B♭) | `parametres/instruments.spec.ts` |
| E-04 | 20/11 | Manche de dessin : chaque note écrite comme une fondamentale de la tonalité (B♭, E♭… en do) | `parametres/instruments.spec.ts` |
| S-01 | 20/11 | Ajouter une note libre déjà présente dans l'accord choisi : refusée avec un message, pas de seconde ligne | `sequenceur/notes-ajoutees.spec.ts` |
| S-03 | 20/11 (décidé) | Suppr après un geste dans le séquenceur ne supprime plus l'accord de la grille (il sert aux notes) | `sequenceur/notes.spec.ts` |
| A-02 | 20/11 (décidé) | Une basse égale à la fondamentale ne s'écrit pas : « Am », pas « Am/A » | `accord/onglet-accord.spec.ts` |
| F-02 | 20/11 (décidé) | Supprimer le morceau ouvert repart d'un morceau neuf et vide (versions gardées, Ctrl+Z rend le morceau à la liste) | `fichiers/liste-morceaux.spec.ts` |
| Z-01 | 20/11 (décidé) | Un clic à côté du champ du nom VIDE renonce (Entrée sur un champ vide enregistre toujours « Sans titre ») | `robustesse/etats-vides.spec.ts` |
| G-04 | 20/11 (décidé) | « C Am F G » (espaces) est compris comme une liste quand chaque mot est un accord ; « xyz » est refusé avec un message (test réécrit) | `grille/ajout-rapide.spec.ts` |
| E-01, V-01 | 20/11 | Focus au clavier : la fenêtre Paramètres le prend, Tab y reste, il revient à la roue ; « Conduite des voix » ouverte au clavier y met le focus | `parametres/fenetre.spec.ts`, `voicing/ouverture.spec.ts` |
| L-02 | 20/11 | Maintenir un chevron du tempo fait défiler (le blur d'un champ, capté sur window, arrêtait la répétition) | `lecture/vitesse-metronome.spec.ts` |
| L-03 | 20/11 | Curseur de vitesse : l'aimant aux repères ne vaut que pour la souris, les flèches avancent de 5 % | `lecture/vitesse-metronome.spec.ts` |
| G-03 | 20/11 | Double-clic sur le « + » d'une case : le second clic, au même endroit, ne referme pas le panneau | `grille/ajout-au-clic.spec.ts` |
| S-02 | 20/11 | Téléphone : « Enregistrer la forme… » ne ferme plus la feuille d'accord (clic dans la popover des rythmes, ou sur une cible détachée par un redessin, n'est pas « à côté ») | `sequenceur/formes.spec.ts` (test réécrit : il contournait le bug) |
| A-03 | 20/11 | Onglet Rythme : la forme d'un accord est marquée séquenceur fermé comme ouvert | `accord/onglet-rythme.spec.ts` |
| M-02 | 20/11 (décidé) | Copie par glisser (Ctrl ou appui long) : elle va là où on la lâche, avant ou après la case selon la moitié, y compris dans une autre partie | `grille/glisser.spec.ts` (2 tests ajoutés) |
| P-04 | 20/11 | Paroles, mode Syllabe : une pastille glissée reste accrochée à un caractère (on vise la ligne de texte la plus proche) | `paroles/glisser-annuler.spec.ts` |
| L-01, ES-14 | 20/11 | Règle des mesures : la mesure est celle de la CASE la plus proche du pointeur (plus de dérive de 10 à 24 px), et le tracé marche aussi de droite à gauche | `lecture/boucle.spec.ts` (3 tests sans `test.fail`, 1 ajouté) |
| ES-01, ES-02, ES-04, ES-05 | 20/11 | Séquenceur : l'appli propose le nom d'après TOUTES les notes qui sonnent (ajout, déplacement, retrait) ; Csus4 et non Cadd11 ; trois qualités mineures reconnues (mAdd9, mAdd11, m Maj 7) ; altérations écrites comme des fondamentales (B♭) ; le bandeau reste jusqu'à la réponse | `sequenceur/reconnaissance-accord.spec.ts` (9 tests) |
| ES-03 | 20/11 | « Renommer » garde la hauteur de la note ajoutée : si elle est la plus grave, elle devient la basse (Am7/G) | idem |
| ES-07 | 20/11 | Accord au rythme vidé : sa case est barrée et marquée « silence » ; l'infobulle de la corbeille le dit | `style.css`, `script.js` |
| ES-08 | 20/11 | Arpège ↑ d'une triade : A C E C (plus de « C C » soudés) | `sequenceur/rythmes.spec.ts` |
| ES-13 | 20/11 | Non reproduit à 1440 px (libellés gardés après l'enregistrement d'une forme) | — |
| ES-09 | 20/11 | Déplacement refusé : le message dit pourquoi (« une autre note occupe cette place, ou elle sortirait de l'accord ») | `sequenceur/selection-clavier.spec.ts` |
| ES-11 | 20/11 | Échap pendant un glisser (déplacer, peindre, étirer) le annule : la note reste ou revient à sa place | idem |
| ES-12 | 20/11 | Ctrl+A choisit toutes les notes du séquenceur (plus de texte de page surligné) | idem |
| ES-19 | 20/11 | Infobulle d'Intensité juste (clic sur une note = la choisir, Suppr = l'effacer) | `sequenceur.js` |
| Améliorations 6 | 20/11 | Lasso (Maj + glisser dans le vide), flèches pour déplacer les notes choisies (← → une croche, ↑ ↓ une ligne) | idem (6 tests) |
| ES-10 | 20/11 | Pendant le déplacement d'une note, les « + » d'insertion de la grille sont masqués (plus de faux repère au lâcher) | `style.css` |
| ES-15 | 20/11 | L'éditeur de schéma laisse 190 px à la grille d'accords (elle ne disparaît plus sous le séquenceur) | `sequenceur.js` |
| ES-16 | 20/11 | Après Stop, le compteur de mesures revient au point de départ de la prochaine lecture | `lecture/lecture-stop.spec.ts` |
| Améliorations | 20/11 | Alt + glisser copie la note là où on la lâche | `sequenceur/selection-clavier.spec.ts` |
| EB-01 | 21/11 | Séquenceur : Ctrl+Z (ou Ctrl+Maj+Z) relit le bandeau de renommage : il se referme si la proposition n'a plus lieu d'être ; « Renommer » recalcule d'après les notes d'AUJOURD'HUI (plus de tierce supprimée) | `sequenceur/corrections-essai2.spec.ts` ×2 |
| EB-02 | 21/11 | Bandeau : chaque note écrite d'après son DEGRÉ dans l'accord (G♯ dans Am maj7, F♯ dans Am6, G♯ dans Caug, B♭ dans C7) | idem |
| EB-03 | 21/11 | Déplacement lâché entre deux lignes (interstice de 3 px) : la case la plus proche est prise, plus d'annulation silencieuse | idem |
| EB-04 | 21/11 | Dépôt refusé : case d'arrivée rouge pendant le glisser, curseur « interdit », message qui dit pourquoi (place occupée / hors de la mesure) ; étirement bloqué : message | idem ×2 |
| EB-05 | 21/11 | Rythme (fourni, forme), Coller et Effacer s'appliquent à TOUS les accords sélectionnés dans la grille (Ctrl / Maj + clic) ; message « Rythme appliqué à N accords » | idem |
| EB-06 | 21/11 | Ctrl+C / Ctrl+V sur des notes choisies copie les NOTES (collées après le groupe, Ctrl+V répété enchaîne) ; la grille ne reçoit plus d'accord | idem |
| EB-07 | 21/11 (décidé) | Arpèges / Ballade sur une triade : on garde A C E C (arpège usuel à trois sons, validé après ES-08) ; l'adaptation fine par nombre de voix est classée dans les améliorations | — |
| EB-08 | 21/11 | Maj + clic sur une note s'ajoute à la sélection (comme Ctrl) ; Maj + glisser dans le vide reste le lasso | idem |
| EB-09 | 21/11 | Un renversement est reconnu (A C F sur Am : « renommer en F/A ? », l'acceptation écrit F en 1er renversement, notes à leur hauteur) ; une combinaison sans nom le dit par un message | idem ×2 |
| EB-10 | 21/11 | « Ignorer » est retenu tant que la combinaison ne change pas ; un bandeau périmé se referme au geste suivant | idem |
| EB-11 | 21/11 | Après un renommage qui absorbe une note libre, sa ligne en pointillés disparaît (plus de ligne vide en double) | idem (G3 unique) |
| EB-12 | 21/11 | Étiquettes de lignes de la vue Accord : l'infobulle dit de quel accord elles sont ; une ligne que l'accord choisi n'a pas porte « – » | idem |
| EB-13 | 21/11 | « silence » prend la place du badge d'octave dans une case au rythme vidé (plus de chevauchement) | idem |
| EB-14 | 21/11 | Barre serrée en deux temps : seules les FORMES perdent leur nom d'abord, les rythmes fournis gardent le leur (ES-13, « non reproduit », l'était en fait avec deux formes) | idem |
| EB-15 | 21/11 (décidé) | Grille rognée par « Ajouter section » séquenceur ouvert : conforme à la décision du 15/11 (la grille garde au moins une rangée, elle défile ; le bouton est collé en bas) | — |
| EB-16 | 21/11 | Téléphone : la proposition s'affiche (vérifié) ; poignées d'étirement élargies (12 à 18 px) | idem (@mobile) |
| EB-17 | 21/11 | Compteur de mesures : le décompte annonce déjà la mesure de départ de la plage ; Stop revient au début de la plage | `lecture/boucle.spec.ts` |
| EB-18 | 21/11 (décidé) | Accrochage : déplacement et étirement suivent la même règle (case sous le pointeur) ; le curseur du corps de note reste la flèche (choix de l'utilisateur du 15/11) | — |
| EB-19 | 21/11 | Échap vide la sélection de notes (après Ctrl+A ou un lasso) | idem |
| Améliorations 2, 13, 15 | 22/11 | Séquenceur : bandeau de renommage posé juste au-dessus du séquenceur ; curseur « copier » et nom de la hauteur qui suit la barre pendant un glisser (Alt = copie) ; menu d'une note avec « Copier » et « Dupliquer » (ordinateur), ouvert aussi par double-clic | `sequenceur/corrections-essai2.spec.ts` ×4 |
| Améliorations 9, 10, 16, 18 | 22/11 | Séquenceur : arpèges ↑ / ↓ et Ballade sur une triade montent / descendent / roulent vraiment (la voix absente se tait : 12, 12 et 14 croches) et la vignette montre ce que l'accord jouera ; rang de la voix (1 = grave) en petit sur l'étiquette de la vue Accord ; graphies Am(add9), Am(add11), Am(maj7) (la saisie comprend les deux écritures) ; volet d'ajout du téléphone : déjà ouvert entre deux accords, test ajouté | `sequenceur/corrections-essai2.spec.ts` ×3, `rythmes.spec.ts`, `copier-coller.spec.ts`, `formes.spec.ts` (comptes réécrits), `mobile/ajouts.spec.ts` ×2, `accord/onglet-accord.spec.ts` |
| Z-07 | reporté | Demande une décision d'architecture : le tampon de travail est partagé entre onglets par le stockage local ; isoler chaque onglet change le modèle | `test.fail` conservé |
| P-08 | reporté | Corriger le ×N oblige la grille à recharger la page Paroles à chaque clic (perte de l'historique d'annulation) : à traiter avec un message de mise à jour plutôt qu'un rechargement | `test.fail` conservé |

---

## G-01 — Firefox : le premier clic sur une case d'une autre partie ne la sélectionne pas (gênant)
**Étapes**
1. Ouvrir un morceau à deux parties (Couplet : C Am F G ; Refrain : Dm Em), Firefox ordinateur.
2. Cliquer sur « Dm » (première case du Refrain) alors que la partie active est le Couplet.
3. Observer : aucune case n'est sélectionnée. Cliquer une seconde fois : « Dm » est sélectionnée.
4. Variante : copier « G » (Ctrl+C), cliquer « Dm », Ctrl+V : « G » est collé EN FIN de partie (après Em) au lieu d'après Dm.

**Attendu** : la case est sélectionnée dès le premier clic (comme sous Chromium, Edge, WebKit et iPad).
**Observé** : le premier clic ne fait que changer la partie active (`app.activeSection`), `app.selectedIndex` reste `null`, aucune classe `selected`. Reproduit à chaque fois, même avec 800 ms d'attente, même avec un clic lent.
**Avis** : bug de l'appli, propre à Firefox. Hypothèse : la grille est redessinée au changement de partie active entre l'appui et le relâchement du clic ; Firefox ne livre alors pas l'évènement `click` (voir le piège « après un redessin, e.target.closest() échoue » de `CLAUDE-HARMOHUB.md`).
**Trace** : `test-results/grille-selection-Sélection-c3cde-sélectionne-du-premier-coup-firefox/` (à regénérer en relançant `npx playwright test tests/e2e/grille/selection.spec.ts --project=firefox`).

## G-02 — Total de mesures périmé dans la barre de lecture (mineur)
**Étapes**
1. Ouvrir un morceau à deux parties (Couplet 4 mesures, Refrain 2 mesures) : la barre de lecture affiche « Mesure 1 / 6 ».
2. Menu « … » du Refrain → « Supprimer la partie » → confirmer. Il reste 4 mesures.
3. La barre de lecture affiche toujours « 1 / 6 ». (Même défaut avec « Dupliquer » : « 1 / 6 » au lieu de « 1 / 10 ».)

**Attendu** : le total suit le nombre de mesures (« / 4 », « / 10 »).
**Observé** : le total n'est corrigé qu'au prochain clic sur une case, ou après Annuler / Rétablir.
**Appareil** : Chromium, Firefox, WebKit, Edge, iPad (ordinateur). Au téléphone la barre n'affiche pas de total (« Mes. 1 »), non vérifié.
**Avis** : bug de l'appli (rafraîchissement manquant après les actions de partie).
**Trace** : `test-results/grille-parties-Parties-—-o-d7826-he-le-bon-nombre-de-mesures-<projet>/` (idem `…-0d82b-ures-de-la-barre-de-lecture-…`).

## G-03 — Double-clic sur le « + » d'une case (mineur, à arbitrer)
**Étapes**
1. Morceau C Am F G, souris : survoler « F », double-cliquer le petit « + » sur son bord gauche.
2. Le panneau « Ajouter » s'ouvre au premier clic, la grille descend de 60 px sous le pointeur, le second clic tombe sur l'en-tête de la partie (« clic à côté ») et referme le panneau : il clignote puis disparaît.

**Attendu** : le panneau reste ouvert (le plan du module parle d'un « double-clic sur + »). Un clic simple fonctionne (testé, vert).
**Observé** : panneau fermé après le double-clic. Mesuré : le « + » passe de y = 164 à y = 224 à l'ouverture.
**Avis** : probablement un bug de l'appli (décalage de mise en page à l'ouverture), mais à arbitrer : si le simple clic est le geste voulu, on supprimera le test.
**Trace** : `test-results/grille-ajout-au-clic-Ajout-1f017-e-le-panneau-d-ajout-ouvert-<projet>/`.

## G-04 — Saisie refusée sans message (mineur, à arbitrer)
**Étapes** : dans la case « + » de fin de partie ou dans « Ajout rapide », taper « C Am F G » (espaces) ou « xyz », valider.
**Attendu** : un retour visible (champ en erreur, message) ; ou « C Am F G » compris comme quatre accords.
**Observé** : rien n'est ajouté, le texte reste dans le champ, aucune erreur. L'aide ne parle que de « // » comme séparateur.
**Avis** : manque de retour utilisateur (ergonomie), pas un plantage.

## A-01 — Valeurs enregistrées en texte par la fenêtre d'accord (mineur)
**Étapes**
1. Morceau C Am F G (valeurs numériques au chargement), ordinateur ou téléphone.
2. Double-clic sur « Am » : fenêtre d'accord. Onglet Accord : « Un temps de moins ». Onglet Voicing : « + » octave, « 1er renv. ».
3. Lire le morceau enregistré (`localStorage.myProgression`, accord n° 2).

**Attendu** : `beats: 3`, `octave: 4`, `inversion: 1` (nombres, comme au chargement).
**Observé** : `"beats":"3","octave":"4","inversion":"1"` (chaînes). Au rechargement l'accord s'affiche bien (l'appli reconvertit), mais le fichier exporté et le document envoyé au cloud portent des chaînes.
**Appareil** : tous (observé sous Chromium ; le même code sert partout).
**Avis** : bug de l'appli (incohérence de type, risque pour l'export / la synchro et pour les comparaisons strictes). Le test d'aide `attendreAccord` compare en nombre pour ne pas en dépendre.
**Trace** : `test-results/accord-onglet-voicing-…-nombres-…-<projet>/` (test marqué `test.fail`, relancer `npx playwright test tests/e2e/accord/onglet-voicing.spec.ts --project=chromium`).

## A-02 — Basse égale à la fondamentale : « Am/A » (mineur, à arbitrer)
**Étapes** : fenêtre d'accord sur « Am », onglet Accord, rangée « Basse » : cliquer « A » (la même note que la fondamentale).
**Attendu** : « Am » (une basse sur la fondamentale n'a pas de sens), ou le bouton refusé.
**Observé** : la case écrit « Am/A ».
**Appareil** : ordinateur (Chromium, Firefox, WebKit, Edge, iPad) ; non vérifié au téléphone.
**Avis** : probablement une imperfection (bug de présentation) ; à arbitrer. Le bouton « — » existe justement pour « basse = fondamentale ».
**Trace** : `test-results/accord-onglet-accord-…-basse-égale-…-<projet>/`.

## A-03 — Onglet Rythme : forme d'un accord tenu marquée trop tard (mineur)
**Étapes**
1. Morceau C Am F G, aucun rythme choisi. Double-clic sur « Am », onglet Rythme.
2. Aucune des sept formes n'est marquée (séquenceur fermé).
3. « Ouvrir le séquenceur » : environ 300 ms plus tard, « Plaqué » se marque tout seul.

**Attendu** : un accord tenu est « Plaqué » dans les deux cas (le séquenceur ouvert montre bien des notes tenues).
**Observé** : état incohérent selon que le séquenceur est ouvert ou non, et marquage retardé.
**Appareil** : ordinateur (Chromium mesuré).
**Avis** : bug d'affichage de l'appli ; à arbitrer (peut-être voulu : « aucune forme choisie »). Le test exige « Plaqué » dans les deux états.
**Trace** : `test-results/accord-onglet-rythme-…-tenu-est-marqué-…-<projet>/`.

## L-01 — Règle des mesures : le numéro appuyé n'est pas la mesure choisie (gênant)
**Étapes**
1. Morceau C Am F G (un accord par mesure), ordinateur ou iPad.
2. Appuyer à la souris au CENTRE du numéro « 4 » de la règle (sous la grille), glisser jusqu'à la fin de la partie, relâcher.
3. Lire `app.loopRange`.

**Attendu** : la plage commence à la mesure 4 (`startIndex: 3`).
**Observé** : `startIndex: 2` (mesure 3). Mesuré en balayant le pointeur : la mesure 2 est prise à partir de x = 603 (le numéro commence à 593), la mesure 3 à partir de 718 (numéro à 703), la mesure 4 à partir de 836 (numéro à 812) : le décalage vers la droite grandit (10, 15, 24 px) ; on n'obtient la mesure 4 qu'en appuyant sur les 4 derniers pixels du numéro. Même chose pour le point d'arrivée du glisser. Appuyer entre deux numéros ne trace rien.
**Appareil** : Chromium, Firefox, WebKit, Edge, iPad (souris). Au téléphone, non testé.
**Avis** : bug de l'appli (correspondance entre position du pointeur et mesure, dérive d'environ 6 % le long de la règle). Les autres tests de boucle appuient au bord droit du numéro et lâchent au milieu de la case visée pour ne pas en dépendre.
**Trace** : `test-results/lecture-boucle-Règle-des-mesures-…-numéro-3-…-<projet>/`, relancer `npx playwright test tests/e2e/lecture/boucle.spec.ts -g "numéro" --project=chromium`.

## L-02 — Chevrons du tempo : maintenir ne fait pas défiler (mineur)
**Étapes** : ouvrir la fenêtre du tempo (bouton « 120 BPM »), survoler « Plus rapide », appuyer et MAINTENIR la souris 2 s.
**Attendu** : l'infobulle annonce « Plus rapide — maintenir pour faire défiler » : le tempo devrait monter en continu.
**Observé** : +1 seulement (120 → 121), rien ensuite, même après 2 s. Constat refait à la main avec `playwright-cli` (souris réelle). Un évènement `pointerdown` synthétique, lui, déclenche bien le défilement : le défilement ne démarre donc pas avec un vrai appui souris (peut-être annulé par `mousedown` / capture du pointeur).
**Appareil** : tous les ordinateurs et l'iPad. Appui long au doigt (téléphone) non testé : Playwright n'a pas de geste d'appui long.
**Avis** : bug de l'appli, à confirmer à la main sur une vraie souris (dis-le-moi si le défilement marche chez toi).
**Trace** : `test-results/lecture-vitesse-metronome-Chevrons-…-<projet>/` (test `test.fail`).

## L-03 — Curseur de vitesse : les flèches du clavier restent bloquées sur un repère (mineur, accessibilité)
**Étapes** : fenêtre du tempo, donner le focus au curseur « Vitesse de lecture » (100 %), appuyer sur → (ou ←).
**Attendu** : 105 % (le pas du curseur est de 5).
**Observé** : reste à 100 % : le curseur « s'accroche » aux repères 50, 75, 100, 150 et 200 % dans une zone de ±5, donc 105 % retombe à 100 %. Depuis 100 %, 150 %, 75 % et 50 % les flèches ne servent à rien ; « Page haut » (+15), « Début » et « Fin » fonctionnent. L'accroche est voulue pour la souris (95 → 100) mais piège le clavier.
**Appareil** : tous les ordinateurs et l'iPad (même code).
**Avis** : bug d'accessibilité de l'appli : n'accrocher que pour le glisser à la souris.
**Trace** : `test-results/lecture-vitesse-metronome-Vitesse-…-clavier-…-<projet>/` (test `test.fail`).

## L-04 — Lecture et case sélectionnée : comportement différent selon le moteur (mineur, à arbitrer)
**Étapes**
1. Morceau C Am F G. Cliquer sur « F » (3ᵉ case), attendre la fin du court aperçu sonore (`app.isPlaying` repasse à `false`).
2. Appuyer sur « Lecture ».

**Attendu** (à confirmer) : la lecture démarre à la case sélectionnée (« F » puis « G »), comme sous Chromium.
**Observé** : Chromium, Edge, Android : « F » puis « G ». Firefox, WebKit, iPhone, iPad : elle démarre à « C » (début du morceau). Autre écart lié : sous Chromium `isPlaying` reste vrai plusieurs secondes après le clic sur une case (l'aperçu y joue la suite du morceau ?), sous WebKit il retombe en moins d'une demi-seconde.
**Avis** : incohérence entre moteurs ; peut venir de l'audio factice de la VM (sortie PulseAudio simulée) plutôt que de l'appli. Non tranché : à arbitrer. Le test est `test.fail` sur Firefox / WebKit seulement.
**Trace** : `test-results/lecture-lecture-stop-…-case-sélectionnée-…-<projet>/`.

## L-05 — Une case reste allumée après « Stop » (mineur, intermittent)
**Étapes** (non déterministes)
1. Morceau C Am F G, vitesse 200 % (pour aller vite). Appuyer sur « Lecture ».
2. Appuyer sur « Stop » après 1,7 à 2,7 s, en recommençant 40 fois à des instants variés.
3. Attendre 400 ms et compter les cases `.grid-cell.playing`.

**Attendu** : aucune case allumée, `app.isPlaying === false`.
**Observé** : environ 1 arrêt sur 30 laisse UNE case allumée (verte) ; elle y reste au moins 1,5 s et jusqu'à la lecture suivante. Mesuré : Chromium 1/40 (boucle) puis 2/40 (sans boucle) et 1/48, Firefox 1/40, WebKit 2/40 puis 1/40 et 3/48, iPad 1/40. Avec ou sans boucle. Un Stop déclenché dans la micro-tâche exacte qui suit l'allumage d'une case (42 essais) ne le provoque pas : l'écart se joue ailleurs (hypothèse : un rappel d'animation déjà planifié qui rallume la case après l'arrêt).
**Appareil** : tous les ordinateurs et l'iPad ; non vérifié au téléphone.
**Avis** : bug de l'appli (état d'affichage non remis à zéro). Il a fait échouer une fois sur tablette (WebKit) le test de boucle (« case allumée après Stop ») : cette vérification accessoire a été retirée de ce test (le défaut est consigné ici).
**Trace** : pas de trace dédiée (aucun test ne le vise : intermittent).

> **À relire (17/11, module lecture)** : trois vérifications accessoires « plus aucune case allumée après Stop » ont été retirées de `lecture/boucle.spec.ts`, `lecture/tempo.spec.ts` et `lecture/lecture-stop.spec.ts` (tests qui ne portent pas sur Stop), parce que L-05 les faisait échouer au hasard (surtout iPad). La vérification subsiste dans le premier test de `lecture-stop.spec.ts`. À remettre quand L-05 sera corrigé.

## S-01 — Note libre déjà présente dans l'accord : ligne en double (mineur, à arbitrer)
**Étapes**
1. Morceau C Am F G, ordinateur. Ouvrir le séquenceur (bouton « Séquenceur »), choisir « Am » (ses notes : E4, C4, A3).
2. « Ajouter une note libre » (icône à gauche de la grille), taper « C4 », « Ajouter C4 ».

**Attendu** : pas de nouvelle ligne (C4 existe déjà dans l'accord), ou un refus. Ajouter deux fois « D4 » n'en crée qu'une, l'appli sait donc éviter les doublons entre notes libres.
**Observé** : la grille montre deux lignes « C4 » (E4, C4, C4, A3). Poser une note sur la seconde crée bien une note libre.
**Appareil** : ordinateurs (Chromium mesuré) ; téléphone non vérifié.
**Avis** : imperfection de l'appli, à arbitrer (le doublon libre / accord est peut-être voulu pour jouer deux fois la même hauteur).
**Trace** : `test-results/sequenceur-notes-ajoutees-…-seconde-ligne-identique-<projet>/` (test `test.fail`).

## S-02 — Téléphone : « Enregistrer la forme… » ferme la feuille d'accord (gênant)
**Étapes**
1. Morceau C Am F G, téléphone. « … » de la barre de lecture → « Séquenceur » (feuille d'accord sur « Rythme »), aller sur « Am ».
2. Toucher le signet « Tous les rythmes » : le menu s'ouvre. Toucher « Enregistrer la forme… ».

**Attendu** : le menu passe au champ « Nom de la forme » ; la feuille d'accord et le séquenceur restent ouverts (comme à l'ordinateur).
**Observé** : la feuille d'accord et le séquenceur se ferment, le menu reste affiché. On peut finir l'enregistrement (la forme est bien créée), mais il faut rouvrir le séquenceur ensuite.
**Appareil** : Android (Pixel 7) et iPhone (même code).
**Avis** : bug de l'appli. Hypothèse : le menu se redessine entre l'appui et le relâchement, le « clic à côté » ne retrouve plus l'élément touché (piège « `e.target.closest()` après un redessin », `CLAUDE-HARMOHUB.md`), donc la feuille se ferme.
**Trace** : `test-results/sequenceur-formes-…-laisse-la-feuille-…-<projet>/` (test `test.fail`).

## S-03 — Suppr sans note sélectionnée supprime l'accord (gênant, à arbitrer)
**Étapes**
1. Morceau C Am F G, ordinateur. Ouvrir le séquenceur, cliquer le nom « Am » dans le séquenceur (ou choisir « Pompe »).
2. Sans sélectionner de note, appuyer sur Suppr (ou Retour arrière).

**Attendu** : rien ne se passe (Suppr sert à supprimer les notes sélectionnées).
**Observé** : l'accord « Am » disparaît de la grille (C F G), sans confirmation. Ctrl+Z le rend.
**Appareil** : tous les ordinateurs (Chromium mesuré).
**Avis** : probablement le raccourci de la grille d'accords (« Suppr = supprimer l'accord choisi ») qui reste actif quand le séquenceur a le focus. À arbitrer : voulu ou dangereux pour qui travaille dans le séquenceur.
**Trace** : `test-results/sequenceur-notes-…-sans-note-sélectionnée-…-<projet>/` (test `test.fail`).

## L-06 — Après « Stop », la lecture suivante repart parfois de la 3ᵉ case (mineur, intermittent)
**Étapes** (non déterministes)
1. Morceau C Am F G. « Lecture », attendre quelques cases, « Stop ».
2. Appuyer de nouveau sur « Lecture » et noter la première case allumée.

**Attendu** : la première case (« C », indice 0). **Observé** : parfois l'indice 2 (« F »), une fois sur 10 à 15. Vu par le test `lecture/lecture-stop.spec.ts` « « Stop » en cours de route : la lecture repart du début… » : échec sur Chromium (envoi du 17/11, module `sequenceur`), sur Firefox (module complet), puis 1 échec sur 16 en le répétant 8 fois sur Chromium et Firefox ; vert aux autres passages.
**Avis** : probablement le même défaut d'état après « Stop » que L-05 (rappel d'animation encore planifié) ; ou test sensible à la charge. Le test est laissé tel quel (vérification intacte) ; à surveiller, il peut faire échouer la CI au hasard. Pas de `test.fail` (un `test.fail` intermittent échouerait au hasard dans l'autre sens).
**Trace** : `test-results/lecture-lecture-stop-Lectu-a7712--là-où-elle-s-était-arrêtée-<projet>/` (regénérer avec `--repeat-each=8`).

## F-01 — Export JSON d'un morceau modifié : les modifications manquent (gênant)
**Étapes**
1. Ouvrir un morceau enregistré (ex. « Alpha », 2 accords). Le modifier sans enregistrer (ajouter un accord, ou changer le titre de la partie) : l'état affiche « Non enregistré ».
2. Menu du nom › « Exporter… » › « Ce morceau » (ou : menu du nom › « Nouveau morceau » › « Exporter en JSON et continuer »).
3. Ouvrir le fichier téléchargé.

**Attendu** : le fichier reflète l'écran (3 accords / titre « Refrain »). Pour « Exporter en JSON et continuer », c'est le seul but du choix : sauver le travail avant de passer à autre chose.
**Observé** : le fichier contient la dernière version ENREGISTRÉE (2 accords, titre « Couplet »). Avec « Exporter en JSON et continuer », les modifications sont donc perdues sans que rien ne le dise.
**Appareil** : tous (Chromium mesuré, test vert-attendu sur les 7 projets).
**Avis** : bug de l'appli (l'export lit le morceau rangé dans la bibliothèque et non la grille en mémoire).
**Trace** : `test-results/fichiers-nouveau-enregistr-…-Exporter-en-JSON-et-continuer-…-<projet>/` et `…export-import-json-…-Ce-morceau-exporte-les-modifications…` (tests `test.fail`).

## F-02 — Suppression du morceau ouvert : la grille garde ses accords (mineur, à arbitrer)
**Étapes**
1. Ouvrir « Alpha » (C, G). « Mes morceaux », « Supprimer » sur la ligne d'« Alpha », confirmer (boîte native).
2. Fermer la fenêtre.

**Attendu** : un morceau neuf et vide (titre « Nouveau morceau », grille vide).
**Observé** : titre « Nouveau morceau », statut « Nouveau morceau », mais les accords C et G sont toujours dans la grille ; le morceau n'est plus dans la liste. Ctrl+Z remet le morceau dans la liste (sans le rouvrir).
**Appareil** : tous (Chromium mesuré).
**Avis** : à arbitrer : peut être voulu (« garder le travail à l'écran, il suffit de l'enregistrer de nouveau »). Je ne l'ai pas lu comme voulu : le titre dit « neuf » alors que la grille ne l'est pas.
**Trace** : `test-results/fichiers-liste-morceaux-…-F-02-…-<projet>/` (test `test.fail`).

## F-03 — Export intégral sans dossier : la sauvegarde JSON échoue (gênant)
**Étapes**
1. Ouvrir un morceau enregistré, sans avoir choisi de dossier de rangement. Menu « Fichiers » › « Export intégral du morceau » ; laisser les cases par défaut (sauvegarde, grille PDF, structure PDF, MIDI) › « Exporter ».

**Attendu** : 4 fichiers téléchargés, dont « HarmoHub - Nom - Morceau - … .json ».
**Observé** : 3 fichiers (2 PDF, MIDI) et le message « 3 fichier(s) exporté(s) · échec : Sauvegarde du morceau ». Console : `Export intégral — morceau Error: pas-de-dossier` (`lancerExportIntegral`). « Exporter… › Ce morceau » du menu du nom, lui, télécharge bien le JSON.
**Appareil** : Chromium, Edge, Firefox (ordinateur) ; iPhone / iPad non mesurés pour ce parcours.
**Avis** : bug de l'appli : la sauvegarde exige un dossier de rangement, alors qu'elle est cochée et annoncée « instantané » sans dossier.
**Trace** : `test-results/fichiers-pdf-export-…-livre-aussi-la-sauvegarde-JSON-…-<projet>/` (test `test.fail`).

## F-04 — Chromium headless : le navigateur meurt à l'export vers le dossier de rangement (environnement, à confirmer)
**Étapes** (déterministe dans la VM)
1. Chromium (projet `chromium`, headless), `showDirectoryPicker` remplacé par un répertoire OPFS. Ouvrir un morceau ENREGISTRÉ, « Choisir un dossier de rangement ».
2. « Exporter en MIDI » (ou PDF, ou export intégral).

**Attendu** : le fichier est écrit dans le dossier (comme sous Edge, qui écrit `MIDI/…`, `PDF/Accords/…`, `Morceaux/…`, `_versions/…`).
**Observé** : toute la session du navigateur s'arrête (`Target page, context or browser has been closed`). Un morceau NON enregistré, ou Edge, passent. Écrire directement dans OPFS depuis une page de test fonctionne : ce n'est pas l'écriture OPFS seule.
**Appareil** : Chromium 1243 headless (et `channel: 'chromium'`) dans la VM ; Edge non.
**Avis** : environnement (même symptôme que les 5 bancs historiques qui plantent « au choix d'un dossier »). Pas de preuve que l'appli soit en cause ; à retenter avec un autre Chromium ou en CI. Les tests concernés sont en `test.fixme` sur `chromium` seulement, et passent sur Edge.
**Trace** : `test-results/…-chromium/` en lançant `E2E_DISQUE_CHROMIUM=1 npx playwright test tests/e2e/fichiers/rangement-disque.spec.ts --project=chromium`.

## Y-01 — La pastille reste « Hors ligne » après le retour du réseau (gênant, intermittent)
**Étapes**
1. Se connecter (compte fictif de l'émulateur), attendre la pastille verte « Synchronisé avec le cloud ».
2. Couper le réseau du navigateur : la pastille passe à « Hors ligne — les modifications partiront au retour du réseau ».
3. Ne rien modifier. Attendre 3 s, rétablir le réseau (`navigator.onLine` redevient vrai).
4. Attendre : la pastille reste grise « Hors ligne » (100 s sans changement mesurées).
5. Contrôle : une modification enregistrée sur un autre appareil arrive bien sur celui-ci, et la pastille repasse alors à « Synchronisé » ; la connexion fonctionnait donc, c'est l'indicateur qui ment.

**Attendu** : « Synchronisé » dès que le réseau revient. **Observé** : « Hors ligne » jusqu'au prochain évènement (enregistrer, ou un changement distant). Avec un enregistrement fait pendant la coupure, la reprise est correcte (pastille « En attente » puis « Synchronisé »).
**Appareil** : Chromium, WebKit, Firefox (ordinateur) ; non essayé en plein sur téléphone. **Fréquence** : ≈ 9 fois sur 10 ; il arrive que la pastille revienne en 1 s quand la coupure est très courte.
**Avis** : bug de l'appli (état de la pastille mis à jour seulement quand un instantané arrive), pas du test. Hypothèse : l'écouteur Firestore n'émet aucun évènement à la reconnexion si rien n'a changé.
**Trace** : `npx playwright test tests/e2e/synchro/reseau.spec.ts -g Y-01 --project=chromium` après avoir enlevé le `test.fixme`.

## Y-02 — Appareil partagé : les morceaux d'un compte partent chez le suivant (mineur, à arbitrer)
**Étapes**
1. Compte 1 connecté sur un navigateur avec deux morceaux (Alpha, Bravo) ; ils partent dans son cloud.
2. Menu du compte → « Se déconnecter » (« Ce qui est déjà envoyé reste dans le cloud »).
3. Se connecter avec le compte 2 dans le même navigateur.
4. Le cloud du compte 2 contient Alpha et Bravo.

**Attendu** (à arbitrer) : soit les morceaux locaux sont retirés à la déconnexion, soit on demande si on les envoie au nouveau compte. **Observé** : tout part sans question. Voulu pour les morceaux faits SANS compte (fusion à la connexion), discutable pour ceux d'un autre compte (appareil prêté).
**Appareil** : tous. **Avis** : comportement de conception à arbitrer plutôt que défaut ; le cloud du premier compte n'est jamais modifié (vérifié).

## Y-03 — La pastille ne passe pas toujours à « Hors ligne » à la coupure (mineur, intermittent)
**Étapes**
1. Connecté, pastille « Synchronisé ».
2. Couper le réseau du navigateur (`context.setOffline(true)`).
3. Attendre 20 s : parfois la pastille reste « Synchronisé » (WebKit, Android, iPhone ; vu 3 fois sur ≈ 100 coupures, plus souvent quand la machine est chargée).

**Attendu** : « Hors ligne » peu après la coupure. **Observé** : aucun changement, jusqu'à la prochaine activité réseau. Un enregistrement fait pendant cet état passe en « En attente » puis part au retour du réseau (rien n'est perdu) : seul l'indicateur est en retard.
**Avis** : même famille que Y-01 (l'indicateur suit les évènements du SDK Firestore, pas l'état du réseau). Dans la CI, ces tests réussissent au 2ᵉ essai (2 essais de repli).
**Trace** : CI du 18/11 : `test-results/synchro-envoi-relecture-En-5e12a--le-ressuscite-pas-critique-mobile-android/` (au 1ᵉʳ essai).

## M-01 — « Modifier » (appui long) : onglet Voicing marqué, contenu Accord (mineur)
**Étapes**
1. Téléphone : un morceau « C Am F G ». Appui long (0,8 s) sur la case « Am » : le menu de la case s'ouvre.
2. Toucher « Modifier ».
3. Lire la feuille d'accord : le titre dit « Am », le haut montre FONDAMENTALE et TYPE (contenu de l'onglet Accord) et un bouton « Moins » en bas ; mais, dans le groupe « Accord, son ou rythme », c'est « Voicing » qui est marqué (`aria-pressed="true"`), « Accord » ne l'est pas.
4. Contrôle : le double-tape sur la même case marque « Accord » et propose « Réglages du son ».

**Attendu** : l'onglet marqué est celui du contenu visible (Accord), comme au double-tape. **Observé** : « Voicing » marqué, contenu Accord ; mode « développé » (bouton « Moins »).
**Appareil** : Android (Pixel 7) et iPhone 15 émulés ; déterministe. **Avis** : bug de l'appli (état d'onglet incohérent), pas du test.
**Trace** : `npx playwright test tests/e2e/mobile/gestes.spec.ts -g "comme le double-tape" --project=mobile-android` (test `test.fail`).

## M-02 — Copie par appui long + glisser : la copie ne va pas dans la partie visée (mineur, à arbitrer)
**Étapes**
1. Téléphone, morceau « Couplet : C Am F G », « Refrain : F C ».
2. Poser le doigt sur « Am » et le garder 0,8 s (le menu s'ouvre), puis glisser jusqu'à la case « C » du Refrain (l'étiquette « Copier » suit le doigt et la case visée s'éclaire) et relâcher.

**Attendu** : un « Am » dans le Refrain (ou rien si la copie entre parties n'est pas voulue). **Observé** : un second « Am » apparaît juste après l'original, dans le Couplet (« C Am Am F G »), le Refrain ne change pas. Même résultat à la souris (Ctrl+glisser). Dans la même partie, la copie se place avant la case visée, que le doigt soit sur sa moitié gauche ou droite (le déplacement simple, lui, respecte le côté).
**Appareil** : Android (appui long réel par DevTools) ; Chromium ordinateur (Ctrl+glisser). **Avis** : comportement à arbitrer (le déplacement simple entre parties ne fait rien, voulu d'après `grille/glisser.spec.ts`) ; pas de test, faute de comportement attendu décidé.
**Trace** : aucune (constaté à l'exploration).

---

## T-01 — Dièses écrits « # » ici, « ♯ » là (mineur, à arbitrer)
**Étapes** : 1. Ouvrir un morceau (« C Am F G »). 2. Régler la tonalité sur « F♯ » (fenêtre « Tonalité de référence »). 3. Lire la puce (« F♯ »), puis le résumé du morceau (téléphone : ligne « Réglages du morceau », ordinateur : `#song-summary-key`).
**Attendu** : la même écriture partout (« F♯ majeur »).
**Observé** : la fenêtre et la puce écrivent « F♯ », le résumé écrit « F# majeur » ; les noms d'accords écrivent « C# » mais « E♭ » (mélange de « # » ASCII et de « ♭ »). Les boutons de la fenêtre d'accord, eux, écrivent « C♯ ».
**Appareil** : tous. **Test** : `notation.spec.ts` (T-01, `test.fail`). **Gravité** : mineure, cosmétique ; à arbitrer (la règle du 16/11 dit « D# » pour les notes).

## T-02 — « Suggérer » n'est pas annulable (mineur)
**Étapes** : 1. Morceau « C Am F G », tonalité do majeur. 2. Ouvrir « Tonalité », « Suggérer », choisir « A mineur ». 3. Regarder « Annuler » dans la barre du haut.
**Attendu** : « Annuler » actif ; un appui rend « C majeur » (comme après un choix de tonique, qui s'annule).
**Observé** : « Annuler » reste grisé ; si on choisit ensuite une tonique, « Annuler » revient à « A mineur » (la suggestion devient le point de départ).
**Appareil** : tous. **Test** : `suggestion.spec.ts` (T-02, `test.fail`). **Gravité** : mineure.

## T-03 — La basse ne suit pas la règle d'écriture de la fondamentale (mineur, à arbitrer)
**Étapes** : 1. Ajouter « C/Eb » et « Eb » (ajout rapide) en do majeur. 2. Régler la tonalité sur mi majeur, ajouter « D/F# » et « F# ».
**Attendu** : la basse s'écrit comme une fondamentale de la même tonalité (do : C/E♭ comme E♭ ; mi : D/F# comme F#).
**Observé** : en do majeur « C/D# » (dièse) alors que la fondamentale s'écrit « E♭ » ; en mi majeur « D/G♭ » alors que la fondamentale s'écrit « F# ». En fa, si bémol, ré et mi la basse s'écrit en bémols (sauf F# en ré), sans lien avec la table des fondamentales.
**Appareil** : tous. **Tests** : `notation.spec.ts` (deux tests T-03, `test.fail`). **Gravité** : mineure ; à arbitrer (la règle « Eb tapé s'affiche D# en do » vaut peut-être aussi pour les basses).

## T-04 — Chiffres romains : septième majeure = septième de dominante (mineur, à arbitrer)
**Étapes** : 1. Poser « Fmaj7 », « F7 », « Cmaj7 » en do majeur. 2. Lire la ligne de chiffres romains au-dessus des cases.
**Attendu** : des chiffres distincts (« IVmaj7 » / « IV7 », « Imaj7 »).
**Observé** : « IV7 », « IV7 », « I7 ».
**Appareil** : tous. **Test** : `degres.spec.ts` (T-04, `test.fail`). **Gravité** : mineure (ambigu à la lecture).

## T-05 — Degrés hors de l'échelle écrits par rapprochement (constat, sans test)
En do phrygien, « Dm » est noté « biii », en do mixolydien « Bdim » est noté « bi° » (au lieu de « #ii » / « #vii° ») : une note hors de l'échelle du mode est écrite comme le bémol du degré supérieur. Cohérent d'un mode à l'autre mais inhabituel ; à arbitrer, aucun test ne le fige (les tests de modes ne vérifient que le nom de la tonalité pour le phrygien et le mixolydien).

## V-01 — Conduite des voix : le focus n'entre pas dans la fenêtre ouverte au clavier (mineur, accessibilité, à arbitrer)
**Étapes** : 1. Ouvrir un morceau de quatre parties, ordinateur. 2. Mettre le focus sur le bouton « Voicing » (Tab depuis « Séquenceur » ou `focus()`). 3. Appuyer sur Entrée : la fenêtre s'ouvre. 4. Appuyer sur Tab.
**Attendu** : le focus passe dans la fenêtre (premier bouton, H +) : c'est un `dialog` ; au minimum, Tab depuis le bouton atteint ses boutons en quelques appuis.
**Observé** : Tab va au champ « Section » puis au bouton « Actions de la partie Couplet » de la grille cachée derrière la fenêtre ; les boutons H et V ne sont atteints qu'au 14ᵉ appui (la fenêtre est le dernier élément du document). Échap ferme bien la fenêtre, focus dedans ou non.
**Appareil** : Chromium (mesuré) ; même structure sur tous les ordinateurs et l'iPad. **Test** : `ouverture.spec.ts` (V-01, `test.fail`). **Gravité** : mineure (accessibilité) ; à arbitrer.

## V-02 — Conduite des voix : le chiffre romain perd l'extension de l'accord (mineur, à arbitrer)
**Étapes** : 1. Poser « Cmaj9 », « Cdim7 », « Cdim », « G9 » en do majeur (fenêtre d'accord, onglet Accord). 2. Ouvrir « Voicing » et lire le chiffre sous chaque nom (ou la ligne de degrés de la grille).
**Attendu** : un chiffre qui garde l'extension : Cmaj9 « I9 » (comme G9 « V9 »), Cdim7 « i°7 » distinct de Cdim « i° ».
**Observé** : Cmaj9 « I », Cdim7 « i° » (identique à Cdim). La fenêtre et la grille écrivent la même chose (vérifié par `conduite-des-voix.spec.ts`, test « les chiffres romains de la fenêtre sont ceux de la grille »).
**Appareil** : tous. **Test** : `conduite-des-voix.spec.ts` (V-02, `test.fail`). **Gravité** : mineure ; apparentée à T-04 (septième majeure notée comme une septième de dominante).

## D-01 — Renommer l'accord choisi : le tiroir garde l'ancien accord (gênant)
**Étapes** : 1. Ordinateur, morceau « Cmaj7, Am7, Dm7, G7 ». 2. Afficher la guitare, cliquer la case « G7 » (le tiroir montre G7). 3. Cliquer le nom « G7 » dans la case, taper « Bm7 », Entrée.
**Attendu** : la case dit « Bm7 » et le clavier et le manche passent aussitôt à Bm7 (B D F# A).
**Observé** : la case dit « Bm7 », le tiroir dit toujours « G7 » (G B D F, doigté de G7), même après plusieurs secondes ; il se corrige quand on choisit une autre case puis celle-ci. Le point orange du doigté fixé est bien retiré.
**Appareil** : Chromium (mesuré) ; à confirmer sur les autres ordinateurs par la matrice. **Test** : `doigtes.spec.ts` (« renommer l'accord choisi… (D-01) », `test.fail`). **Gravité** : gênante.

## D-02 — « Afficher la guitare » avec un accord choisi : le tiroir repasse sur Do (gênant)
**Étapes** : 1. Ordinateur (ou téléphone), morceau « Cmaj7, Am7, Dm7, G7 ». 2. Choisir « Am7 » (le clavier dit Am7). 3. Appuyer sur « Afficher la guitare ».
**Attendu** : le manche apparaît avec le doigté d'Am7 et le clavier reste sur Am7.
**Observé** : le nom devient « C » (notes C E G), le clavier allume C E G, le manche montre un Do ; la case Am7 reste pourtant sélectionnée. Choisir une autre case, puis Am7, rétablit l'affichage. Même effet quand on réaffiche la guitare après « Fermer ». Le contournement des tests : afficher la guitare AVANT de choisir l'accord.
**Appareil** : tous. **Test** : `tiroir.spec.ts` et `telephone.spec.ts` (D-02, `test.fail`). **Gravité** : gênante (le geste « je choisis un accord puis je regarde comment le jouer » donne un faux accord).

## D-03 — Éditeur de manche : des noms proposés dont une note manque (constat, sans test)
Dessiner x02210 (A C E) propose « Am, C6, Am7, Am6 » ; x32010 propose « C, C6, Cmaj7, C7 ». Am7 / Am6 / Cmaj7 / C7 contiennent une note (septième, sixte) qui n'est pas sur le manche. C'est peut-être voulu (« plusieurs accords avec les mêmes notes », moteur partagé avec l'import MIDI) ; à arbitrer, aucun test ne fige la liste complète (seul le premier nom, C ou Am, est vérifié).

## D-04 — Cadenas périmé après Annuler / Rétablir (mineur, intermittent, WebKit)
**Étapes** : 1. Afficher la guitare, choisir « Am7 ». 2. Cliquer le cadenas (point orange sur la case). 3. « Annuler ». 4. Lire l'état du bouton cadenas.
**Attendu** : bouton relâché (« Verrouiller ce doigté… ») et flèches actives. **Observé** : le point orange disparaît et le doigté n'est plus fixé (données exactes), mais le bouton reste « verrouillé » plusieurs secondes (5 fois sur 8 avec 3 travailleurs en parallèle ; non reproduit à 1 ou 2). Même chose dans l'autre sens après « Rétablir ». Revenir sur l'accord (autre case puis celle-ci) corrige l'affichage.
**Appareil** : WebKit ordinateur et iPad ; non vu sur Chromium ni Firefox. **Test** : `doigtes.spec.ts` « D-04 » (`test.fixme` sur WebKit). **Gravité** : mineure, intermittente ; à confirmer (peut être un effet de charge du navigateur de test).

## R-01 — Structure : le total des mesures s'écrit « 12.0 » en 3/4 (mineur)
**Étapes** : 1. Ordinateur ou téléphone, morceau « Couplet (12 temps), Refrain (16), Pont (8) » en 4/4. 2. Passer la mesure à « 3/4 » (puce « Mesure » ; au téléphone, résumé du morceau puis « Mesure »). 3. Ouvrir l'onglet « Structure ». 4. Lire le total en tête de fenêtre.
**Attendu** : « 12 mesures » (36 temps ÷ 3), comme « 9 mesures » en 4/4 et comme « 4 mes. » pour le Couplet.
**Observé** : « 12.0 mesures ». Les parties s'écrivent « 4 mes. », « 5.3 mes. », « 2.7 mes. » (décimale seulement quand la mesure est entamée) : le total additionne ces fractions sans arrondir, d'où « 12.0 » au lieu de 12.
**Appareil** : Chromium (mesuré), Android ; même code partout. **Test** : `ouverture.spec.ts` « en 3/4 le total de 36 temps s'écrit « 12 mesures »… (R-01) » (`test.fail`). **Gravité** : mineure (cosmétique).

## R-02 — Structure : Échap dans une petite fenêtre ferme la fenêtre Structure derrière elle (gênant)
**Étapes** : 1. Ordinateur, ouvrir « Structure ». 2. Clic droit sur une ligne puis « Renommer » (ou « Ajouter un commentaire… »). 3. Taper un texte, appuyer sur Échap.
**Attendu** : seule la petite fenêtre se ferme (comme pour le menu du clic droit et pour l'aperçu avant impression, qui se ferment seuls au premier Échap) ; la structure reste ouverte, le texte non validé est abandonné.
**Observé** : la fenêtre Structure se ferme (on revient à la grille) et la fenêtre « Renommer cette occurrence » reste ouverte au-dessus de la grille, avec le texte tapé. « Valider » fonctionne encore (le nom est bien pris), mais on n'est plus dans la structure.
**Appareil** : Chromium (mesuré à la main et par test) ; même code sur tous les ordinateurs et l'iPad (clavier). Pas d'Échap au téléphone. **Test** : `ajouter-retirer.spec.ts` « Échap dans la fenêtre « Renommer »… (R-02) » et « …« Commentaire »… (R-02) » (`test.fail`). **Gravité** : gênante (perte de contexte au clavier, une fenêtre orpheline).

## R-03 — Structure : le badge ×N de la grille est périmé après un réglage fait dans la structure (mineur)
**Étapes** : 1. Ordinateur ou téléphone, morceau de trois parties. 2. Ouvrir « Structure », appuyer sur « + » de la première ligne (×2 s'affiche dans la fenêtre). 3. Revenir à « Grille ». 4. Regarder le titre de la première partie.
**Attendu** : le badge « ×2 » à côté du titre (comme après un réglage fait depuis le menu « Répéter » de la partie, qui met le badge à jour aussitôt).
**Observé** : aucun badge. Il apparaît après un rechargement de la page. Le menu « Répéter » de la partie, ouvert ensuite, dit bien « ×2 » (il lit la structure à l'ouverture) : seul le titre n'est pas redessiné.
**Appareil** : Chromium, Android (mesuré). **Test** : `lien-grille.spec.ts` « le badge ×N de la grille suit un réglage fait dans la structure… (R-03) » (`test.fail`). **Gravité** : mineure (affichage trompeur jusqu'au rechargement).

## Constats du module structure (sans test, à arbitrer)
- Au téléphone, les boutons « − + ↑ ↓ » d'une ligne mesurent 30 × 30 px (Pixel 7), alors que la consigne du dépôt vise 44 px pour le téléphone. Le test `mise-en-page.spec.ts` n'exige que 24 px ; à arbitrer (docs : « hors jauge »).
- Les gestes de la structure (+, −, ↑, ↓, ajouter, dupliquer, renommer, commentaire, supprimer) ne sont pas annulables : « Annuler » reste grisé. L'appli le dit elle-même (`docs/dette-tests.md` : « Pas d'annulation pour les gestes de la structure ») ; aucun test ne le fige.
- La lecture audio ne suit pas la structure (la barre de lecture compte 9 mesures quand la structure en annonce 16) : documenté comme « document de travail et d'impression » ; aucun test ne le fige.
- Retirer toutes les occurrences laisse une structure vide sans message (« 0 mesures », liste « + Partie… » seule). Cohérent, mais le message « Aucun accord pour l'instant » n'apparaît que pour une grille vide.


## P-01 — Paroles : le bouton « Nommer le morceau » garde la taille d'un bouton-icône de 32 px (mineur)
**Étapes** : 1. Ordinateur, morceau sans nom (ouverture à vide). 2. Ouvrir l'onglet « Paroles ». 3. Regarder le bouton « Nommer le morceau » sous la phrase « Donne un nom à ton morceau… ».
**Attendu** : un bouton assez large pour son libellé (comme « Enregistrer » ou « Fichiers » de la barre du haut).
**Observé** : le bouton mesure 32 × 32 px (classe `tb-save`, celle du bouton-icône « Enregistrer ») ; le libellé de 123 px déborde de chaque côté : on ne voit qu'un carré vert derrière le milieu du texte (« Nomm|er le mo|rceau »). Le clic fonctionne (le champ du nom s'ouvre).
**Appareil** : Chromium (mesuré) ; même code partout. **Test** : `ecrire.spec.ts` « le bouton « Nommer le morceau » est assez large pour son libellé » (`test.fail`). **Gravité** : mineure (cosmétique).

## P-02 — Paroles : « reclique ici pour désarmer » ne désarme pas (mineur)
**Étapes** : 1. Ouvrir « Paroles » sur un morceau d'accords « C, Am, F, G ». 2. Cliquer « Am » dans la réserve : il est armé (bouton « Arrêter » apparu, infobulle « Armé — clique dans le texte pour poser un exemplaire…, ou reclique ici pour désarmer »). 3. Cliquer de nouveau « Am ».
**Attendu** : l'accord est désarmé (comme le promet l'infobulle).
**Observé** : « Am » reste armé, « Arrêter » reste affiché. Seuls Échap et « Arrêter » désarment. Même chose sur un accord déjà posé.
**Appareil** : Chromium (mesuré) ; même code partout. **Test** : `accords.spec.ts` « recliquer l'accord armé le désarme, comme le dit son infobulle » (`test.fail`). **Gravité** : mineure (infobulle fausse, ou geste manquant : à arbitrer).

## P-03 — Paroles : « Rétablir » reste actif après une nouvelle saisie et écrase le texte neuf (gênant)
**Étapes** : 1. Ouvrir « Paroles », écrire « Premier jet » dans une partie. 2. « Annuler » (haut de l'écran) : la zone est vide, « Rétablir » devient actif. 3. Écrire « Autre idée ». 4. Regarder « Rétablir », puis le cliquer.
**Attendu** : « Rétablir » redevient inactif dès qu'on écrit autre chose (comme dans tout éditeur : un nouveau geste vide la pile de rétablissement).
**Observé** : « Rétablir » reste actif ; le cliquer remplace « Autre idée » par « Premier jet » (récupérable avec « Annuler », mais on a perdu de vue le texte neuf).
**Appareil** : Chromium (mesuré) ; même code partout. **Test** : `glisser-annuler.spec.ts` « un nouveau geste après « Annuler » vide la pile « Rétablir » » (`test.fail`). **Gravité** : gênante.

## P-04 — Paroles : une pastille glissée en mode « Syllabe » devient un accord libre (mineur, à arbitrer)
**Étapes** : 1. Ouvrir « Paroles », écrire une phrase, poser « C » en mode « Syllabe » (l'infobulle dit « les accords s'accrochent au caractère le plus proche… reste aligné même si le texte se redispose »). 2. Attraper la pastille « C » et la glisser vers la droite. 3. Lire l'enregistrement du morceau (clé `harmohub_lyrics_v1_id-…`).
**Attendu** : le placement reste de type `char` (nouveau numéro de caractère).
**Observé** : le placement devient `{ type: 'free', lineIndex, xPct }` : la pastille n'est plus accrochée à un caractère et ne suit plus le texte si on en ajoute avant elle.
**Appareil** : Chromium (mesuré) ; même code partout. **Test** : `glisser-annuler.spec.ts` « en mode Syllabe, une pastille glissée reste accrochée à un caractère » (`test.fail`). **Gravité** : mineure, à arbitrer (le glissé est peut-être voulu comme « position libre »).

## P-05 — Paroles : les textes sont rangés par POSITION de partie, ils ne suivent pas leur partie (grave : paroles au mauvais endroit)
**Étapes** : 1. Morceau « Couplet » (C, Am, F, G) et « Refrain » (F, G). 2. Dans « Paroles », écrire « Texte du couplet » dans le couplet et « Texte du refrain » dans le refrain. 3. Revenir à « Grille », menu « … » du Refrain › « Monter ». 4. Rouvrir « Paroles ».
**Attendu** : la carte « Refrain » (maintenant première) porte « Texte du refrain », la carte « Couplet » porte « Texte du couplet ».
**Observé** : la carte « Refrain » porte « Texte du couplet » et la carte « Couplet » « Texte du refrain ». Même chose, depuis le menu de la partie : « Supprimer la partie » sur le Couplet laisse le Refrain avec « Texte du couplet » (le texte du refrain reste en réserve, invisible) ; « Dupliquer » sur le Couplet donne « Couplet / Couplet (copie) / Refrain » avec les textes « Texte du couplet / Texte du refrain / (vide) ». Les accords posés suivent le même sort (la pastille posée sur le refrain apparaît sur le couplet).
**Appareil** : Chromium (mesuré) ; même code partout. **Tests** : `lien-grille.spec.ts`, trois tests « Les paroles suivent leur partie » (`test.fail`). **Gravité** : grave (le texte écrit se retrouve sous une autre partie dès qu'on réordonne, supprime ou duplique une partie ).

## P-06 — Paroles : les accords posés sont rattachés au RANG de l'accord dans la partie, pas à l'accord (grave : accords faux)
**Étapes** : 1. Morceau « C, Am, F, G ». 2. Dans « Paroles », poser « Am » et « F » au-dessus d'une phrase. 3. Revenir à « Grille », insérer « Dm » AVANT le premier accord (« + » devant « C »). 4. Rouvrir « Paroles ».
**Attendu** : les pastilles disent toujours « Am » et « F » (la réserve dit « Dm, C, Am, F, G »).
**Observé** : les pastilles disent « C » et « Am » (le même rang 1 et 2 que le nouveau morceau). Même chose en supprimant un accord qui précède : supprimer « C » change « Am » en « F » et « F » en « G » (aucun message). Ajouter un accord APRÈS les accords posés ne change rien.
**Appareil** : Chromium (mesuré) ; même code partout. **Tests** : `lien-grille.spec.ts` « un accord inséré AVANT… » et « supprimer de la grille un accord qui précède… » (`test.fail`). **Gravité** : grave (le texte chanté et le PDF exporté portent des accords différents de ceux posés, sans que rien ne le dise).

## P-07 — Paroles : l'aide sous « Versions précédentes » n'a pas le style des autres aides (mineur, cosmétique)
**Étapes** : 1. Ouvrir « Paroles » › « Options ». 2. Comparer la phrase d'aide sous « Enchaîner les accords » et celle du bas (« Restaurer remet ces paroles en place… »).
**Attendu** : même taille et même couleur (12 px gris).
**Observé** : celle du bas est en 16 px, couleur du texte principal (visiblement plus grande que le reste du panneau).
**Appareil** : Chromium (mesuré) ; même code partout. **Test** : `parties-options.spec.ts` « le texte d'aide du panneau a le même style partout » (`test.fail`). **Gravité** : mineure.

## P-08 — Paroles : le ×N d'une partie est réaffiché « × 1 » après un rechargement (gênant)
**Étapes** : 1. Ouvrir « Paroles », cliquer « + » du refrain deux fois (« × 3 »). 2. Attendre « Enregistré ». 3. Recharger la page, rouvrir « Paroles ».
**Attendu** : « × 3 ».
**Observé** : « × 1 », alors que l'enregistrement (`repeatCount: 3`) est bien présent. (Probablement relu depuis la grille et non depuis les paroles.) Le prochain réglage repartira de 1.
**Appareil** : Chromium (mesuré) ; même code partout. **Test** : `parties-options.spec.ts` « le ×N d'une partie est retrouvé tel quel après rechargement » (`test.fail`). **Gravité** : gênante (le × N est « purement indicatif », mais il est perdu).

## Constats du module paroles (sans test, à arbitrer)
- Le texte exporté (fichier .txt et presse-papiers) ne contient ni les accords posés au-dessus des phrases ni les × N : seulement « Accords : C, Am, F, G » (la liste de la partie) puis les paroles. Le PDF, lui, dessine bien les accords au-dessus du texte (vérifié à la main sur une image du PDF).
- Le PDF tient toujours sur UNE page : un texte de 70 lignes est réduit de moitié (largeur 289 pt sur 595) ; aucune coupure en deux pages. Le test vérifie que l'image reste dans les marges.
- Dans le PDF, un accord posé sur la 2ᵉ ligne frôle le bas de la 1ʳᵉ ligne (interligne serré) ; la page à l'écran est plus aérée.
- Après chaque export, un bandeau (« Texte exporté → dossier Téléchargements », « Texte copié dans le presse-papiers. ») s'insère dans la page et la décale d'environ 57 px vers le bas.
- Après le dernier accord d'une partie, la chaîne repart au premier (« Enchaîner les accords ») : voulu pour reposer les accords sur un 2ᵉ vers ; le test le décrit comme une règle.
- Le mode Syllabe / Libre n'est pas retenu après un rechargement (la page revient en « Syllabe ») ; la taille du texte et « Enchaîner » le sont.


## E-01 — Paramètres : le focus n'entre pas dans la fenêtre ouverte au clavier, et Tab part derrière elle (mineur, accessibilité, à arbitrer)
**Étapes** : 1. Ordinateur. Mettre le focus sur la roue « Paramètres » (Tab) et appuyer sur Entrée. 2. Appuyer sur Tab.
**Attendu** : le focus passe dans la fenêtre (elle se déclare modale : `aria-modal="true"`) et y reste ; à la fermeture il revient à la roue.
**Observé** : le focus reste sur la roue ; un Tab l'envoie sur la pastille « Se connecter », cachée derrière le voile ; il faut un 2ᵉ Tab pour atteindre « Fermer ». Après « Fermer » le focus reste sur un bouton devenu invisible.
**Appareil** : Chromium (mesuré) ; même code partout. **Test** : `fenetre.spec.ts` « E-01 » (`test.fail`). **Gravité** : mineure (même défaut que V-01).

## E-02 — Paramètres : Espace sur un interrupteur lance la lecture du morceau au lieu de le basculer (gênant, accessibilité)
**Étapes** : 1. Ouvrir « Paramètres ». 2. Mettre le focus sur un interrupteur (par exemple « Degrés ») avec Tab. 3. Appuyer sur Espace.
**Attendu** : l'interrupteur bascule (c'est la touche d'un bouton) ; rien ne joue.
**Observé** : l'interrupteur ne bouge pas et la lecture du morceau démarre derrière la fenêtre (le raccourci global « lecture » a pris la touche). Entrée, elle, bascule bien.
**Appareil** : Chromium (mesuré) ; même code partout. **Test** : `fenetre.spec.ts` « E-02 » (`test.fail`). **Gravité** : gênante au clavier (on lance la musique en voulant régler).

## E-03 — Pastilles de la guitare : les notes ignorent la tonalité (mineur)
**Étapes** : 1. Morceau en do majeur avec un accord posé en « Eb » (la grille écrit E♭). 2. « Paramètres » › Pastilles de la guitare › « Notes ». 3. Afficher la guitare, choisir l'accord.
**Attendu** : E♭, G, B♭ (l'infobulle du réglage : « le nom de la note (avec les dièses ou bémols de la tonalité) », et la fiche d'accord à côté écrit E♭ G B♭).
**Observé** : D#, G, A#. En mi majeur (tonalité à dièses), F# donne bien F#, A#, C# : seul le côté « bémols » est ignoré.
**Appareil** : Chromium (mesuré) ; même code partout. **Test** : `instruments.spec.ts` « E-03 » (`test.fail`). **Gravité** : mineure (même famille que T-01 et T-03).

## E-04 — Manche de dessin : les noms de notes ignorent la tonalité (mineur)
**Étapes** : 1. Morceau en do majeur. 2. « Paramètres » › « Notes du manche de dessin » allumé. 3. Guitare › crayon › onglet « Dessiner sur le manche ».
**Attendu** : B♭, E♭, A♭, D♭, G♭ (infobulle : « avec les dièses ou bémols de la tonalité »).
**Observé** : A#, D#, G#, C#, F# sur les 150 cases.
**Appareil** : Chromium (mesuré). **Test** : `instruments.spec.ts` « E-04 » (`test.fail`). **Gravité** : mineure.

## E-05 — Touches du piano : les notes ignorent la tonalité (mineur, à arbitrer)
**Étapes** : comme E-03, avec « Touches du piano » › « Notes ».
**Attendu** : E♭, G, B♭ comme la fiche d'accord affichée juste à côté (l'infobulle du piano ne promet rien sur la tonalité : à arbitrer).
**Observé** : D#, G, A# sur les touches, E♭ G B♭ dans la fiche.
**Appareil** : Chromium (mesuré). **Test** : `instruments.spec.ts` « E-05 » (`test.fail`). **Gravité** : mineure.

## E-06 — Un volume enregistré qui n'est pas un nombre empêche l'appli de démarrer (gênant, rare)
**Étapes** : 1. Stockage local : `harmohubGeneralVolume` = « beaucoup » (ou vide, ou « NaN »), ou `harmohubMetronomeVolume` = « abc ». 2. Ouvrir l'appli.
**Attendu** : l'appli démarre avec la valeur d'usine (100 / 80).
**Observé** : page sans appli (`window.app` n'existe pas ; erreur « Invalid argument(s) to setValueAtTime: null, 0.02 »). Seul vider le stockage la répare.
**Appareil** : Chromium (mesuré) ; même code partout. **Tests** : `persistance.spec.ts` « E-06 » × 3 (`test.fail`). **Gravité** : gênante si cela arrive (valeur abîmée par une ancienne version, une extension ou une synchro), mais peu probable.

## E-07 — Un volume enregistré hors de 0 à 100 est gardé tel quel (mineur)
**Étapes** : 1. Stockage local : `harmohubGeneralVolume` = 150 (ou −5), `harmohubMetronomeVolume` = 500. 2. Ouvrir l'appli.
**Attendu** : valeur ramenée entre 0 et 100.
**Observé** : l'appli garde 150, −5, 500 (le curseur, lui, se bloque à ses bornes, donc la fenêtre ne le montre pas) ; la sortie peut dépasser le niveau maximal du curseur.
**Appareil** : Chromium (mesuré). **Tests** : `persistance.spec.ts` « E-07 » × 3 (`test.fail`). **Gravité** : mineure.

## Constats du module parametres (sans test, à arbitrer)
- L'état d'usine de « Noms des rythmes » dépend de la largeur de l'écran (allumé au-dessus de 1340 px, éteint en dessous) : sur iPad en paysage (1194 px) et au téléphone, l'interrupteur apparaît éteint alors que c'est « sans réglage ». C'est dit dans l'infobulle ; le test en tient compte.
- Ouvrir « Paramètres » lève la sélection de la grille (le voile vaut « clic à côté »).
- Les interrupteurs et les pastilles de couleur ont 20 à 28 px de haut au téléphone (la jauge du téléphone est 44 px) ; l'étiquette autour est plus grande.
- Non testé : l'effet audible des réglages (le son est factice) ; « Écouter en éditant » et « Son au déplacement » ne sont vérifiés que par leur état et leur mémoire, pas par un appel de note.

Z-01 → `robustesse/etats-vides.spec.ts` « Z-01 : après « Nomme d'abord ton morceau… », un clic à côté du champ… » ;
Z-02 → `robustesse/stockage.spec.ts` « Z-02 : l'échec de « Enregistrer » est annoncé… » et « …n'est pas une exception non interceptée de la page » ;
Z-03 → `robustesse/stockage.spec.ts` « Z-03 : ajouter un accord alors que la copie de travail ne s'écrit plus… » ;
Z-04 → `robustesse/stockage.spec.ts` « Z-04 : « localStorage » inaccessible… » ;
Z-05 → `robustesse/stockage.spec.ts` « Z-05 : … l'appli démarre quand même » (4 variantes) ;
Z-06 → `robustesse/rechargement.spec.ts` « Z-06 : après le rechargement… toujours annoncé « Non enregistré » » ;
Z-07 → `robustesse/deux-onglets.spec.ts` « Z-07 : l'onglet resté sur « Alpha » ajoute son accord à « Alpha »… ».

## Z-01 — Un clic à côté du champ du nom enregistre un morceau « Sans titre » (mineur, à arbitrer)
**Étapes** : 1. Ouvrir l'appli (morceau neuf, sans nom). 2. « Fichier » › « Exporter en MIDI ». 3. Le toast dit « Nomme d'abord ton morceau pour exporter le MIDI » et le champ du nom prend le focus. 4. Cliquer ailleurs (la grille).
**Attendu** : le champ se referme, rien n'est enregistré (Échap, lui, abandonne bien).
**Observé** : un morceau vide « Sans titre » entre dans la bibliothèque (« Enregistré à hh:mm », toast « « Sans titre » enregistré »).
**Appareil** : Chromium (mesuré) ; même code partout. **Test** : `etats-vides.spec.ts` (`test.fail`).

## Z-02 — Stockage plein : « Enregistrer » échoue sans rien dire (gênant)
**Étapes** : 1. Ouvrir un morceau enregistré. 2. Le stockage local refuse l'écriture de la bibliothèque (`QuotaExceededError`). 3. Ajouter un accord, cliquer « Enregistrer ».
**Attendu** : un message dit que l'enregistrement a échoué (et pourquoi).
**Observé** : aucun message ; exception JavaScript non interceptée ; l'état reste « Non enregistré » (c'est vrai, mais sans explication). Le reste de l'appli, la bibliothèque déjà enregistrée et la lecture restent intacts ; une fois la place libérée, « Enregistrer » réussit.
**Appareil** : Chromium (mesuré, écriture refusée par un script de test). **Tests** : `stockage.spec.ts` × 2 (`test.fail`).

## Z-03 — Copie de travail non écrivable : plus aucun accord ne peut être ajouté (gênant)
**Étapes** : 1. Ouvrir un morceau. 2. Le stockage refuse l'écriture de la copie de travail (`myProgression`). 3. Taper un accord dans le « + », Entrée.
**Attendu** : l'accord apparaît (travail en mémoire) ou un message dit que le stockage est refusé.
**Observé** : rien : le texte reste dans le champ, aucun accord, aucun message. La lecture et l'affichage du morceau déjà chargé fonctionnent.
**Appareil** : Chromium. **Test** : `stockage.spec.ts` « Z-03 » (`test.fail`).

## Z-04 — Stockage local bloqué : l'appli ne démarre pas (gênant, rare)
**Étapes** : 1. Navigateur dont l'accès au stockage local lève `SecurityError` (cookies bloqués, certains modes privés). 2. Ouvrir l'appli.
**Attendu** : l'appli démarre en mémoire (ou dit pourquoi elle ne peut pas).
**Observé** : `window.app` n'existe jamais ; la page affiche les libellés mais aucun bouton ne répond ; aucun message.
**Appareil** : Chromium (stockage rendu inaccessible par un script de test). **Test** : `stockage.spec.ts` « Z-04 » (`test.fail`).

## Z-05 — Des données de morceau de la mauvaise forme empêchent l'appli de démarrer (gênant, rare)
**Étapes** : 1. Stockage local : `harmohubSongs` = `{"a":1}` (objet, pas liste) ou `[null,3,{"id":"z"}]`, ou `myProgression` = partie sans `chords` ou accord `null`. 2. Ouvrir l'appli.
**Attendu** : démarrage avec un morceau vide (comme pour un JSON illisible, qui est bien toléré).
**Observé** : `window.app` n'existe jamais (même famille que E-06) ; seul vider le stockage répare.
**Appareil** : Chromium. **Tests** : `stockage.spec.ts` « Z-05 » × 4 (`test.fail`).

## Z-06 — Après rechargement, l'état « Enregistré » est faux (gênant)
**Étapes** : 1. Ouvrir « Alpha » (enregistré). 2. Renommer la partie (« Non enregistré »). 3. Recharger la page.
**Attendu** : la grille garde la modification (c'est le cas) ET la barre du haut dit « Non enregistré ».
**Observé** : la barre dit « Enregistré à hh:mm » ; la version enregistrée n'a pas la modification (vérifié dans le stockage). Plus aucun avertissement en quittant ou en changeant de morceau.
**Appareil** : Chromium (mesuré). **Test** : `rechargement.spec.ts` « Z-06 » (`test.fail`).

## Z-07 — Deux onglets : l'onglet périmé écrit dans l'autre morceau (gênant)
**Étapes** : 1. Onglet A et onglet B ouverts sur « Alpha ». 2. Dans A, créer et enregistrer « Charlie » (un accord). 3. Dans B (affiche toujours « Alpha »), ajouter l'accord D, « Enregistrer ».
**Attendu** : D est ajouté à « Alpha », « Charlie » est inchangé.
**Observé** : B bascule sur « Charlie » au premier geste (rien ne l'annonce) ; D est ajouté à « Charlie » ; « Alpha » ne reçoit rien. (Si A a seulement modifié « Alpha », B reprend ses modifications et rien n'est perdu.)
**Appareil** : Chromium (mesuré). **Test** : `deux-onglets.spec.ts` « Z-07 » (`test.fail`).

## Constats du module robustesse (sans test, à arbitrer)
- Hors ligne sans compte : une page rechargée hors ligne ne s'ouvre pas (aucun service worker) ; seul le travail dans la page déjà ouverte continue.
- Firefox : un accord tapé dans le « + » sans Entrée puis un rechargement est validé en quittant la page (blur au déchargement) ; les autres moteurs perdent le texte. Inoffensif, noté dans le test.
- Durées d'accord invalides dans le stockage (−3, « abc », 0, `null`) : bien tolérées ; une durée de 10⁹ temps fait planter l'onglet (mesuré, volontairement non testé : il tuerait le navigateur de test).
