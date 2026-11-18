# Rapport — module `diagrammes` (18/11/2026)

## Résumé
- Testé : tiroir clavier / guitare (épinglé, poignée, fenêtre libre, réglages), accord construit au clavier, doigtés (flèches, liste, cadenas), « Mes doigtés » (local et cloud, 2 appareils), éditeur de manche (dessiner, nommer, substitut, ajouter à la grille), version téléphone.
- Résultat : 70 tests (59 ordinateur / 11 téléphone, 31 `@critique`) ; module complet sur les 7 projets : 314 réussis / 2 ignorés (D-04 sur WebKit et iPad) / 0 échoué, échecs attendus inclus (D-01 et D-02, `test.fail`) ; `CI=1 npm run test:e2e:envoi` : 551 + 1079 réussis, 1 « flaky » hors module (synchro, Y-03 connu, WebKit).
- Suite conseillée : corriger D-01 et D-02 (gênants), arbitrer D-03 ; module suivant `structure`.

## Bugs (détail dans `tests/reports/bugs.md`)

### D-02 — « Afficher la guitare » avec un accord choisi : le tiroir repasse sur Do (gênant)
**Étapes** : 1. Morceau « Cmaj7, Am7, Dm7, G7 ». 2. Choisir « Am7 ». 3. « Afficher la guitare ».
**Attendu** : manche d'Am7, clavier toujours sur Am7. **Observé** : nom « C », notes C E G, clavier et manche sur Do ; la case reste sélectionnée ; se corrige en choisissant un autre accord puis Am7.
**Appareil** : tous (ordinateurs, iPad, Android, iPhone). **Trace** : `test-results/diagrammes-tiroir-…D-02…/` (échec attendu). **Avis** : bug de l'appli (le tiroir se redessine avec l'accord par défaut).

### D-01 — Renommer l'accord choisi : le tiroir garde l'ancien accord (gênant)
**Étapes** : 1. Afficher la guitare, choisir « G7 ». 2. Cliquer son nom dans la case, taper « Bm7 », Entrée.
**Attendu** : clavier et manche passent à Bm7. **Observé** : la case dit Bm7, le tiroir garde G7 (notes et doigté), même après plusieurs secondes.
**Appareil** : Chromium mesuré, test en échec attendu sur les 5 ordinateurs / iPad. **Avis** : bug de l'appli.

### D-03 — Reconnaissance de l'éditeur (constat, sans test, à arbitrer)
x02210 propose « Am, C6, Am7, Am6 » ; x32010 propose « C, C6, Cmaj7, C7 » : des noms dont une note manque sur le manche. Peut-être voulu (moteur partagé avec l'import MIDI).

### D-04 — Cadenas périmé après Annuler / Rétablir (intermittent, WebKit)
Sous WebKit et iPad, machine chargée (3 travailleurs en parallèle ; non reproduit à 1 ou 2), le bouton cadenas reste plusieurs secondes dans l'ancien état après « Annuler » ou « Rétablir » du verrouillage, alors que la donnée (doigté fixé) et le point orange sont déjà corrects (relevé : 5 fois sur 8). Test dédié `doigtes.spec.ts` « D-04 » en `test.fixme` sur WebKit (iPad compris) ; le test de parcours vérifie l'état réel en revenant sur l'accord. **Avis** : bug de l'appli probable (mise à jour différée du bouton) ; à confirmer. Ajouté à `bugs.md`.

## Instabilités et choix du test (rien n'a été affaibli)
- **G-01 (Firefox)** : le premier clic sur une case d'une autre partie ne la sélectionne pas ; l'aide `selectionner` reclique après 1,5 s (même méthode que le module `voicing`). Le tiroir suit aussi la sélection avec jusqu'à ~1 s de retard sous Firefox : l'aide attend que le tiroir montre l'accord de la case avant d'agir.
- **iPad (1194 × 834)** : les dimensions attendues sont lues dans la fenêtre (plus de 1440 / 900 en dur). Test de la poignée : « le tiroir grandit d'au moins 15 % » (au lieu de +40 px) — sur un écran étroit la largeur limite la taille du clavier et du manche côte à côte (+24 % mesuré) ; la vérification « plafonné à 60 % », « plus petit vers le bas » et « double-clic = taille d'origine » reste intacte.
- Au téléphone les diagrammes sont **à la suite de la grille** (bas de la page) : on les fait défiler à l'écran, puis on vérifie qu'ils tiennent au-dessus de la bande fixe.
- `getByTestId` : aucun `data-testid` dans l'appli ; sélecteurs par `id` de l'appli (`#vues-tiroir`, `#piano-viz`, `#guitar-viz`, `#guitar-lock-btn`, `#guitar-edit-neck`…) quand le rôle ne suffit pas. **Manquent** : des `data-testid` ou rôles sur les cases du manche de l'éditeur (le dessin SVG reçoit le clic en entier : on clique à la position calculée), sur les touches du clavier (`data-midi` sert de repère) et sur les candidats de reconnaissance (classe `.guitar-draw-candidate`).

## Tests ajoutés (`tests/e2e/diagrammes/`)
- `tiroir.spec.ts` : 13 tests (`@ordinateur`, 6 `@critique`).
- `clavier.spec.ts` : 7 (3 `@critique`).
- `doigtes.spec.ts` : 14 (6 `@critique`), dont D-01 (`test.fail`) et D-04 (`test.fixme` WebKit).
- `mes-doigtes.spec.ts` : 9 (4 `@critique`), dont un test cloud à deux appareils.
- `editeur-manche.spec.ts` : 16 (6 `@critique`).
- `telephone.spec.ts` : 11 (`@mobile`, 6 `@critique`), dont D-02 (`test.fail`).
- `aide-diagrammes.ts` : aides communes (pas une spec).
- Non couvert : son, appui long (note fantôme au doigt), diagrammes pendant la lecture sur téléphone, déplacement du tiroir au clavier, notation selon la tonalité (module `tonalite`).
