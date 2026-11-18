# Rapport du module « paroles » — 18/11/2026

## Résumé
- Testé : l'onglet Paroles (iframe) : ouvrir, écrire, poser les accords au-dessus des paroles (Syllabe / Libre), glisser, annuler / rétablir / réinitialiser, ×N, options, versions, export texte / copie / PDF, lien avec la grille et la bibliothèque, téléphone.
- Résultat : 99 tests (607 exécutions sur 7 projets), tous verts, dont 11 `test.fail` = 8 bugs ouverts (P-01 à P-08). `CI=1 npm run test:e2e:envoi` entièrement vert APRÈS la dernière retouche (729 réussis / 11 ignorés sur Chromium, puis 1414 réussis / 60 ignorés sur les 6 autres projets, 0 échec, 0 relance).
- Suite conseillée : corriger P-05, P-06 (graves) et P-08, puis `parametres`.

## Bugs (détail dans `tests/reports/bugs.md`)
- **P-05 grave** — les textes sont rangés par position de partie : « Monter » le refrain, ou supprimer / dupliquer le couplet, met les paroles sous la mauvaise partie.
  Étapes : paroles écrites dans Couplet et Refrain ; grille ; menu du Refrain › Monter ; Paroles. Attendu : « Refrain » porte son texte. Observé : il porte celui du couplet.
  Appareil : tous (mesuré Chromium). Tests : `lien-grille.spec.ts` (3, `test.fail`). Avis : bug de l'appli.
- **P-06 grave** — les accords posés sont rattachés au RANG de l'accord : insérer « Dm » avant, ou supprimer un accord qui précède, renomme les pastilles (Am devient C). Tests : `lien-grille.spec.ts` (2, `test.fail`). Avis : bug de l'appli.
- **P-03 gênant** — « Rétablir » reste actif après une nouvelle saisie et écrase le texte neuf. `glisser-annuler.spec.ts`.
- **P-08 gênant** — le ×N est enregistré mais réaffiché « × 1 » après rechargement. `parties-options.spec.ts`.
- **P-02, P-04, P-01, P-07 mineurs** — infobulle « reclique pour désarmer » fausse ; glissé en Syllabe qui devient position libre ; bouton « Nommer le morceau » de 32 px au libellé débordant ; texte d'aide des versions en 16 px.
- Constats sans test (export texte sans accords posés ni ×N, PDF toujours sur une page, mode Libre non retenu…) : voir la fin de `bugs.md`.

## Instabilités, tolérances, limites
- **Firefox : le premier clic dans l'iframe ne donne pas le focus** à la zone de texte (reproduit sur une page témoin sans l'appli : un bouton du parent actif + un `contenteditable` dans une iframe). Aide `focaliser` : on clique jusqu'à ce que la zone soit focalisée (attente d'un état). Avis : environnement du navigateur de test, pas l'appli.
- Un test de collage (évènement `paste` fabriqué) est ignoré sur Firefox, qui n'honore pas un évènement non fiable ; couvert ailleurs. Le test du PDF long tape ses lignes (aucun collage).
- Le glissé au doigt est ignoré sur iPhone (WebKit mobile : pas de geste composé dans Playwright) ; couvert sur Android.
- Tolérances justifiées : pastille centrée sur son caractère à 10 px près (Syllabe : un caractère < 15 px), à 3 px près en Libre ; `sansTags` ignore la structure `<div>` propre à Firefox ; positions relatives à la zone après export (un bandeau décale la page de 57 px) ; presse-papiers lu seulement sur Chromium / Edge.
- Accords et textes d'essai courts : sur téléphone une longue phrase passe à la ligne et fausse le point visé.
- Sélecteurs : aucun `data-testid` dans la page des paroles ; CSS `.lyrics-text`, `.lyric-pill`, `.pill-del`, `.section-block`, `.chord-chip` (classes `armed` / `placed` / `active`), `#options-panel`, `#versions-paroles-liste`. À proposer en `data-testid` : zone de texte (`paroles-zone`), pastille posée, croix, carte de partie.

## Tests ajoutés (`tests/e2e/paroles/`, tag `@paroles`)
- `ecrire.spec.ts` : 15 tests (5 `@critique`).
- `accords.spec.ts` : 25 (7 `@critique`).
- `glisser-annuler.spec.ts` : 19 (6 `@critique`).
- `parties-options.spec.ts` : 12 (5 `@critique`).
- `export.spec.ts` : 9 (3 `@critique`).
- `lien-grille.spec.ts` : 12 (5 `@critique`).
- `telephone.spec.ts` : 7 (1 `@critique`, `@mobile` ou `@ordinateur`).
- Aide : `aide-paroles.ts`.
