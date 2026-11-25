# Plan — nouvelle série de tests Playwright pour la STRUCTURE d'un morceau

Rédigé le 25/11/2026 à la demande de l'utilisateur (« un test playwright spécifique pour la partie structure d'un morceau, je vais en avoir besoin bientôt »).
**Ce fichier est un PLAN : aucun test n'est encore écrit.** Il se lit avec `tests/PLAN.md` (ligne 11 du tableau : module `structure`) et `CLAUDE-HARMOHUB.md`
(section « Suite à faire »). Lancé par : `/reprise`, puis « fais la série structure ».

## 0. À demander à l'utilisateur AVANT de coder (il a dit qu'il en aurait « bientôt » besoin)

1. **Pour quoi faire ?** (arranger un morceau en vrai, imprimer la feuille de route, jouer le morceau dans l'ordre de la structure, s'en servir avec les paroles…). La réponse
   fixe la priorité entre les trois blocs de la section 3.
2. **Un essai neutre d'abord ?** (méthode de `CLAUDE-HARMOHUB.md` : un sous-agent, sans lire le code ni les tests, pilote l'appli à la souris / au clavier / au doigt
   et consigne ce qui ne va pas). Il n'en existe pas encore sur la structure : les 91 tests actuels ont été écrits d'après le code et les décisions, pas d'après l'usage.
   Recommandation : **oui, en premier** (une heure), puis les tests ciblés ci-dessous, puis le correctif de ce que l'essai a trouvé.
3. **Centres d'intérêt** à donner à l'agent (le 20/11 : « l'effet des notes ajoutées sur le nom de l'accord, déplacements / étirements / rythmes sans accrochage »).
   Propositions : arranger un morceau de 6 parties avec reprises ; réordonner sans se tromper ; renommer / commenter ; lire la feuille imprimée ; deux onglets ouverts.
4. **La lecture doit-elle suivre la structure ?** C'est la grosse lacune (section 2, point A). Si oui, c'est une FONCTION à construire avant de tester, pas un test.

## 1. Ce que la structure EST (pour écrire des tests justes)

- Fenêtre « Structure du morceau » (`#structure-overlay`, `dialog` nommé « Structure du morceau », onglet `#structure-btn` « Voir la structure du morceau »).
  Une **ligne par occurrence** (`.struct-row`) : nom, mesures, ×N, position en mesures, accords écrits en mesures, commentaires ; boutons ↑ ↓, − +, menu (clic droit
  à l'ordinateur, appui long au téléphone : Dupliquer, Renommer, Ajouter un commentaire, Supprimer). Liste « + Partie… » (`combobox`). Aperçu / PDF (`#structure-apercu`).
- **Donnée** : `myProgression.structure` = tableau d'occurrences `{ id, sid, rep, label, notes:[{texte}] }` ; `sid` = identité stable de la partie de la grille
  (`script.js` : `loadStructureBrute`, `saveStructureBrute`, `structureEffective`, `repetitionsDansStructure`, `persisterStructureDansMorceau`).
  **Sans structure arrangée à la main** (`null`), elle est DÉDUITE de la grille (une ligne par partie, `materialisee: false`) ; dès le premier geste elle devient
  la structure brute, enregistrée AVEC le morceau (`syncCurrentSong({ sections, structure })`) et sans demander « Enregistrer ».
- **La structure lit la grille** (pas de copie à synchroniser) : renommer, ajouter, supprimer, dupliquer, déplacer une partie de la grille se reflète.
- **Paroles** reçoit pour chaque partie le nombre de passages TOTAL (somme des `rep` de ses occurrences) ; depuis le 24/11 le ×N saisi dans Paroles est rangé dans la partie
  (P-08), sauf structure arrangée.
- **Hors périmètre actuel (voulu)** : la lecture audio ne suit PAS la structure (`docs/dette-tests.md`, « Ce qui n'est PAS fait »).

## 2. Couverture actuelle (18/11, 91 tests, 6 fichiers) et ANGLES MORTS

Déjà couvert (ne pas refaire) : ouverture / fermeture (onglet, Échap, second clic) ; somme (mesures, durée, parties), 3/4, tempo ; ajouter / dupliquer / renommer / commenter /
supprimer une occurrence ; ×N (plancher 1, plafond 99) ; ↑ ↓ ; persistance (rechargement, morceau enregistré, morceaux indépendants) ; la structure suit la grille
(renommer, ajouter, supprimer, dupliquer, déplacer, badge ×N dans les deux sens, parties à plusieurs endroits, partie absente) ; aperçu : contenu, cases à cocher, format,
orientation, colonnes, « tout sur une page », zoom, réglages retenus, PDF valide, nombre de pages, impression ; mise en page (largeur, défilement, menu dans l'écran).

**Angles morts repérés (par `grep` dans `tests/e2e/structure/`, et dans le code) :**

| Réf. | Angle mort | Pourquoi ça compte | Priorité |
|---|---|---|---|
| A | **La lecture ne suit pas la structure** (rien n'est testé : c'est « documenté comme non fait ») | Si l'utilisateur arrange « Couplet ×2, Refrain, Pont, Refrain ×2 », il s'attend à l'entendre. Test de non-régression : la lecture joue la grille, jamais la structure (à figer tant que ce n'est pas décidé) | P1 si décidé |
| B | **Annuler / Rétablir** des gestes de la structure (Ctrl+Z après supprimer, dupliquer, ↑↓, ×N) | Le journal d'annulation connaît « grille / séquenceur / fichiers » ; la structure n'est notée « sans annulation » que dans un vieux commentaire. À vérifier d'abord : peut-être un trou, peut-être un choix | P1 |
| C | **Deux onglets ouverts** (Z-07, 25/11) : l'onglet qui suit un autre morceau ; la structure d'un morceau modifiée dans un onglet, vue dans l'autre ; `persisterStructureDansMorceau` écrit dans la bibliothèque sans « Enregistrer » | Les onglets partagent le stockage ; c'est là que les erreurs se glissent | P1 |
| D | **Export / import JSON** d'un morceau avec structure (aller-retour sans perte : `rep`, `label`, `notes`, ordre) et import d'un fichier ANCIEN sans structure (structure déduite) | Aucun test de `fichiers/` ne cite la structure ; un morceau partagé perd peut-être son plan | P1 |
| E | **Synchro cloud** d'une structure (appareil A → B ; structure modifiée hors ligne ; conflit) | Le document cloud porte `structure` ; le module `synchro` ne la cite pas | P2 |
| F | **Paroles** : `×N total` par partie, deux occurrences d'une même partie, structure arrangée → le ×N de Paroles est ignoré ; P-08 (×N retenu après rechargement) croisé avec la structure | La frontière structure / paroles a déjà produit 2 bugs (P-08, P-03/P-06) | P2 |
| G | **Données hostiles ou extrêmes** : nom d'occurrence avec `<script>` / `&` / emoji / 500 caractères ; 40 occurrences ; commentaire de 5 000 caractères ; partie sans accord ; accord de 0,5 temps ; morceau en 5/4, 6/8 | Les noms sont insérés dans du HTML ; l'aperçu les met dans un PDF | P2 |
| H | **Clavier et accessibilité** : Tab dans la fenêtre, Entrée / Espace sur ↑ ↓ − +, focus rendu à la fermeture, noms accessibles des boutons répétés (« Monter » ×6 : lesquels ?) | Même défaut que V-01 / E-01 (focus qui n'entre pas dans une fenêtre) à vérifier ici ; ES-20 a montré que des noms identiques posent problème | P2 |
| I | **Glisser pour réordonner** (si l'utilisateur le veut ; aujourd'hui seulement ↑ ↓) | Le geste « normal » d'un arrangeur | question, pas un test |
| J | **Export MIDI / PDF de la grille** : suivent-ils la structure ? (ils ne devraient pas, à figer) | Évite une confusion « feuille de route » / « morceau joué » | P3 |
| K | **Téléphone** : appui long sur WebKit mobile (rejoué par évènements `touchstart` / `touchend` seulement) ; aperçu sur petit écran | Lacune déjà notée le 18/11 | P3 |
| L | **PDF rendu** : seuls la validité et le nombre de pages sont vérifiés | Comparer le texte extrait du PDF (déroulé, ×N, commentaires) au contenu attendu | P3 |

## 3. Série proposée (ordre d'exécution)

Nouveaux fichiers dans `tests/e2e/structure/` (même aide : `aide-structure.ts`, mêmes tags `@structure`, `@critique` pour la liste réduite avant envoi, `@ordinateur` / `@mobile`).

1. **`annuler.spec.ts`** (B) — `Ctrl+Z` / `Ctrl+Y` et boutons de la barre du haut après : supprimer une occurrence, dupliquer, ↑, ↓, + / −, renommer, commenter. Pour chaque geste :
   l'annulation rétablit l'état d'avant (structure stockée ET fenêtre), le rétablissement le rejoue, et la grille n'a pas bougé. **D'abord** un test d'exploration qui dit ce qui se passe
   aujourd'hui (si rien n'est annulable : consigner R-04 dans `bugs.md` et décider avec l'utilisateur de construire l'annulation ou de la documenter).
2. **`deux-onglets.spec.ts`** (C) — voir `tests/e2e/robustesse/deux-onglets.spec.ts` (suivi et avertissement du 25/11). Cas : onglet B ouvert pendant que A arrange la structure → B affiche la structure d'A
   à son prochain geste ou aussitôt ; fenêtre Structure ouverte dans B pendant qu'A supprime une occurrence (la ligne disparaît-elle ? sinon les boutons agissent-ils sur la bonne ?) ; les deux
   ajoutent une occurrence ; l'avertissement « aussi ouvert dans un autre onglet » apparaît.
3. **`export-import.spec.ts`** (D) — export JSON (« Ce morceau ») d'un morceau arrangé (×3, nom d'occurrence, 2 commentaires, ordre changé), puis import dans une session neuve : même structure, octet pour octet
   sur `structure`. Fichier ancien sans clé `structure` : la structure est déduite de la grille, rien ne plante. Fichier avec une structure qui cite un `sid` inconnu : l'occurrence est écartée ou signalée
   (à constater, puis figer ; consigner un bug si ça casse).
4. **`donnees-extremes.spec.ts`** (G) — noms et commentaires hostiles (HTML, guillemets, emoji, très longs) dans la fenêtre, l'aperçu, le PDF (texte extrait) ; 40 occurrences (défilement, performance
   raisonnable : pas de redessin complet à chaque touche) ; partie vide ; 5/4 et 6/8 ; ×99 sur toutes les lignes (total de mesures).
5. **`clavier.spec.ts`** (H) — Tab / Maj+Tab dans la fenêtre (où entre le focus ?), Entrée et Espace sur les boutons, Échap, focus rendu à `#structure-btn`, nom accessible de chaque bouton d'une ligne
   (contenant le nom de l'occurrence, sinon bug du type ES-20 à consigner).
6. **`paroles.spec.ts`** (F) — `×N` total envoyé à Paroles (somme sur deux occurrences) ; structure arrangée : le ×N saisi dans Paroles ne change pas la structure (cf. P-08, commentaire de `chargerMorceau`) ;
   renommer une occurrence ne casse pas les paroles de la partie ; supprimer la dernière occurrence d'une partie garde ses paroles en réserve.
7. **`lecture.spec.ts`** (A, J) — **non-régression** : la lecture joue la grille (ordre des cases allumées inchangé) quelle que soit la structure ; l'export MIDI / PDF de la grille idem. À remplacer par les vrais
   tests de « lecture selon la structure » SI l'utilisateur décide de la construire (alors : ordre des passages, ×N, boucle, compteur de mesure, surbrillance de l'occurrence, plage à boucler orange).
8. **`synchro.spec.ts`** (E) — dans le module `synchro` (émulateurs) : appareil A arrange, B (même compte) reçoit la structure ; modification hors ligne puis retour du réseau (voir `reseau.spec.ts`).
9. **PDF** (L) — extraire le texte du PDF téléchargé (`pdftotext` ou `pdf-parse` s'il est déjà dans `node_modules` ; sinon se contenter du nombre de pages) et le comparer au déroulé attendu.

**Essai neutre** (sous-agent) : à lancer AVANT les points 1 à 6 si l'utilisateur est d'accord ; ses constats peuvent déplacer les priorités. Rapport dans `tests/reports/AAAA-MM-JJ-essai-structure.md`, captures voisines.

## 4. Méthode et garde-fous (rappels du dépôt)

- Vrais gestes (souris, clavier, toucher) ; `window.app` seulement pour LIRE l'état. Chaque test écrit a son **sabotage** (casser le comportement, voir le test rougir, restaurer).
- Un `test.fail` / `test.fixme` par bug trouvé, avec sa ligne dans `tests/reports/bugs.md` ; le retirer à la correction.
- Tourner d'abord sur Chromium (`npx playwright test tests/e2e/structure --project=chromium`), puis le module sur les 7 projets, puis `CI=1 npm run test:e2e:avant-envoi`.
  Émulateurs : un seul `emulators:exec` à la fois (ports 8080 / 9099). Ne pas modifier un fichier servi pendant qu'un passage tourne.
- Pièges de test connus : `toContainText` lit aussi le texte caché ; l'appui long sur WebKit mobile se rejoue par évènements ; un test de géométrie se vérifie par sabotage sur deux moteurs.
- Mise à jour à la fin : `tests/PLAN.md` (ligne 11), `tests/reports/bugs.md`, `docs/dette-tests.md`, `CLAUDE-HARMOHUB.md` (« Suite à faire »).

## 5. Estimation

Essai neutre : ≈ 1 h. Points 1 à 6 : ≈ 30 à 40 tests (≈ 3 à 4 h avec sabotages et passage sur 7 projets). Points 7 à 9 : ≈ 10 tests, plus l'éventuelle construction de la
lecture selon la structure (à chiffrer avec l'utilisateur : c'est un lot de développement, pas de test).
