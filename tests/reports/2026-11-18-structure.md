# Rapport — module `structure` (18/11/2026)

**Résumé**
- Testé : l'onglet Structure (ouverture, contenu, ×N, ↑ ↓, ajouter / dupliquer / renommer / commenter / retirer une occurrence, lien avec la grille, aperçu avant impression et PDF), ordinateur et téléphone.
- 91 tests ajoutés. Module complet sur les 7 projets : **615 réussis, 0 échoué** (dont 4 échecs attendus `test.fail` = 3 bugs). `CI=1 npm run test:e2e:envoi` : **vert** (Chromium 640 réussis / 11 ignorés ; autres projets 1239 réussis / 60 ignorés / 3 « flaky » réussis au 2ᵉ essai, tous dans `synchro`, aucun dans `structure`).
- Suite conseillée : arbitrer R-02 (Échap) puis passer le module à ☑ ; module suivant : `paroles` (P2).

Aucune requête vers la production (garde-fou : 0 requête bloquée dans les 91 tests). Aucune modification de l'appli.

## Bugs (détail dans `tests/reports/bugs.md`)

### R-02 — Échap dans « Renommer » / « Commentaire » ferme la structure derrière (gênant)
**Étapes** : 1. Ordinateur, ouvrir « Structure ». 2. Clic droit sur une ligne, « Renommer » (ou « Ajouter un commentaire… »). 3. Taper un texte, Échap.
**Attendu** : seule la petite fenêtre se ferme ; la structure reste ouverte.
**Observé** : la fenêtre Structure se ferme, la petite fenêtre reste ouverte au-dessus de la grille.
**Appareil** : Chromium, Firefox, WebKit (même résultat), Edge, iPad. **Trace** : `test-results/structure-ajouter-retirer-…-R-02-…-chromium/` (pendant les passes ; effacé à chaque lancement).
**Avis** : bug de l'appli (le menu du clic droit et l'aperçu, eux, ne ferment que leur propre fenêtre).

### R-03 — Badge ×N de la grille périmé (mineur)
**Étapes** : 1. Ouvrir « Structure », « + » sur la 1ʳᵉ ligne (×2). 2. Revenir à « Grille ».
**Attendu** : badge « ×2 » à côté du titre de la partie. **Observé** : aucun badge avant rechargement (le menu « Répéter » de la partie dit pourtant ×2).
**Appareil** : tous (mesuré Chromium, Android). **Avis** : bug de l'appli (titre non redessiné).

### R-01 — « 12.0 mesures » en 3/4 (mineur)
**Étapes** : 1. Morceau Couplet 12 temps, Refrain 16, Pont 8. 2. Mesure 3/4. 3. Ouvrir « Structure ».
**Attendu** : « 12 mesures ». **Observé** : « 12.0 mesures » (somme de fractions non arrondie ; les parties disent « 4 mes. », « 5.3 mes. »).
**Appareil** : tous. **Avis** : bug d'affichage.

Constats sans test (à arbitrer) : boutons − + ↑ ↓ de 30 px au téléphone (cible visée : 44 px) ; gestes de la structure non annulables (documenté) ; la lecture ne suit pas la structure (documenté).

## Instabilités
Aucune dans `structure` (module complet : 615 / 615 sans relance ; envoi : aucun essai de reprise sur ce module). Trois relances dans `synchro` (hors périmètre, connues : Y-03 et assimilés).

## Tolérances (aucune vérification affaiblie)
- Les tests qui comptent des pas (« plafond ×99 ») cliquent 100 fois : 33 s sur iPad, timeout du test porté à 90 s (durée du geste, pas de tolérance sur le résultat).
- Nom de morceau sans accent dans le test du PDF : Chromium n'affiche pas le nom accentué d'un téléchargement (limite connue, déjà notée par `fichiers`) ; le nom exact `HarmoHub - Demo - Structure - AAAA-MM-JJ HHMM.pdf` est vérifié.
- Sélecteurs CSS (pas de `data-testid`) : `.struct-row`, `.struct-title`, `.struct-rep`, `.struct-pos`, `.struct-chords`, `.struct-note`, `.struct-somme`, `.struct-deroule`, `.struct-famille`, `.sf-*` (feuille de l'aperçu), `#struct-menu`, `#apercu-etat`. À proposer : `data-testid="struct-ligne"` et `struct-menu`.

## Tests ajoutés (`tests/e2e/structure/`, tous `@structure`)
- `ouverture.spec.ts` (13) : onglet, second clic, Échap, somme, lignes, vide, famille de couleur, tempo, 3/4 (dont R-01).
- `repetitions-ordre.spec.ts` (8) : + / −, plafond ×99, ↑ ↓, bornes, grille intacte, rechargement et enregistrement.
- `ajouter-retirer.spec.ts` (28) : liste « + Partie… », menu, Dupliquer, Renommer, commentaires, Supprimer (dont R-02 ×2).
- `lien-grille.spec.ts` (13) : renommer / ajouter / supprimer / dupliquer / déplacer dans la grille, « Répéter » de la partie, états grisés (dont R-03).
- `apercu.spec.ts` (22) : contenu, sept cases, format / orientation / colonnes, taille et zoom, mémoire des réglages, PDF, Imprimer.
- `mise-en-page.spec.ts` (7) : sous les onglets, dans l'écran, structure longue, menu, aperçu.
- `aide-structure.ts` : aides. Étiquettes : 27 `@critique`, 6 `@ordinateur`, 2 `@mobile` (les autres tournent partout).
- Non couvert : appui long réel sur WebKit mobile (évènements rejoués), rendu visuel du PDF, son.
