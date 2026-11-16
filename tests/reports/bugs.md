# Bugs trouvés par les tests de bout en bout

Tenu par le sous-agent `testeur-e2e` (phase 5 de `tests/PLAN.md`). Les bugs ne sont PAS corrigés pendant l'écriture des tests : l'utilisateur décide quand.
Gravité : **bloquant** (empêche un parcours principal), **gênant** (contournable mais pénible), **mineur** (cosmétique, ou comportement à arbitrer).

| # | Date | Module | Navigateur / appareil | Gravité | Résumé | Statut |
|---|---|---|---|---|---|---|
| G-01 | 16/11 | grille | Firefox ordinateur | gênant | Un clic sur une case d'une AUTRE partie ne la sélectionne pas (il faut cliquer deux fois) | ouvert |
| G-02 | 16/11 | grille | tous les ordinateurs et l'iPad | mineur | La barre de lecture garde un ancien total de mesures après « Supprimer la partie » ou « Dupliquer » une partie | ouvert |
| G-03 | 16/11 | grille | tous les ordinateurs et l'iPad | mineur (à arbitrer) | Un double-clic sur le « + » d'une case ouvre le panneau d'ajout puis le referme aussitôt | ouvert |
| G-04 | 16/11 | grille | tous | mineur (à arbitrer) | Une saisie refusée (« C Am F G » avec espaces, « xyz ») ne produit aucun message : le texte reste, rien ne se passe | ouvert |

Tests qui échouent à cause de ces bugs : marqués `test.fail()` (échec attendu, vérification intacte) pour que la CI reste verte ; ils deviendront ROUGES le jour où le bug est corrigé : retirer alors le `test.fail` :
G-01 → `grille/selection.spec.ts` « un clic sur une case d'une autre partie la sélectionne du premier coup » et `grille/copier-coller.spec.ts` « on peut coller dans une autre partie… » (Firefox seulement) ;
G-02 → `grille/parties.spec.ts` « après la suppression d'une partie… » et « ajouter une partie met à jour le nombre de mesures… » ;
G-03 → `grille/ajout-au-clic.spec.ts` « un double-clic sur le « + » laisse le panneau d'ajout ouvert ».
G-04 : pas de test rouge (le test `« C Am F G » (séparés par des espaces) n'ajoute rien` fige le comportement observé).

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
