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
| M-01 | 18/11 | mobile | téléphones (Android, iPhone) | mineur | « Modifier » (menu de l'appui long) ouvre la feuille d'accord avec l'onglet « Voicing » marqué alors que le haut de la feuille montre le contenu de l'onglet Accord | ouvert |
| M-02 | 18/11 | mobile | téléphones (Android) ; même chose à la souris (Ctrl+glisser) | mineur (à arbitrer) | Appui long puis glisser une case vers une AUTRE partie : l'accord est copié juste après l'original (dans sa propre partie) au lieu de l'être dans la partie visée ; dans la même partie la copie se place AVANT la case visée, quel que soit le côté | ouvert, sans test |

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

