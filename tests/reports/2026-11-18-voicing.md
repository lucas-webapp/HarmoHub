# Rapport — module `voicing` (18/11/2026)

## Résumé
- Testé : la fenêtre « Conduite des voix » (bouton « Voicing », ouverture / fermeture, partie active, état vide), ce qu'elle dessine (barres par son, rôles et couleurs, traits tenus / mouvements, en-têtes, touches, défilement, redessin quand l'accord change), les échelles H et V, et le téléphone (pas de bouton). 57 tests, 4 fichiers.
- Résultat : `CI=1 npm run test:e2e:envoi` vert (chromium 492 réussis / 11 ignorés ; 6 autres projets, `@smoke` et `@critique` : 968 réussis / 60 ignorés ; 0 échoué, 0 flaky). Module complet sur les 7 projets (chromium, firefox, webkit, edge, android, iphone, tablette) : 274 réussis, 2 ignorés (molette sur l'iPad), 0 échoué, échecs attendus inclus (V-01 et V-02 sur les 5 ordinateurs, G-01 sur Firefox).
- Suite conseillée : arbitrer V-01 (focus au clavier) et V-02 (chiffre romain sans extension, famille T-04), puis module `diagrammes`.

## Problèmes (2 bugs avec test) — détail dans `tests/reports/bugs.md`
**V-01 — le focus n'entre pas dans la fenêtre ouverte au clavier** (mineur, accessibilité, à arbitrer)
- Étapes : 1. Morceau de quatre parties, ordinateur. 2. Focus sur le bouton « Voicing », Entrée : la fenêtre s'ouvre. 3. Tab.
- Attendu : le focus passe dans la fenêtre (c'est un `dialog`), ou au moins l'atteint vite. Observé : Tab traverse la grille cachée derrière (14 appuis) avant d'arriver aux boutons H et V. Échap ferme bien la fenêtre.
- Appareil : Chromium (mesuré) ; même structure partout. Trace : `ouverture.spec.ts` « au clavier : après Entrée sur le bouton, la touche Tab mène dans la fenêtre… » (`test.fail`, vidéo et trace gardées).
- Avis : bug de l'appli (la fenêtre est le dernier élément du document et ne prend pas le focus) ; à arbitrer, gravité faible.

**V-02 — le chiffre romain perd l'extension de l'accord** (mineur, à arbitrer)
- Étapes : 1. Poser Cmaj9, Cdim7, Cdim, G9 en do majeur. 2. Ouvrir « Voicing » (ou lire la ligne de degrés de la grille).
- Attendu : « I9 » (comme G9 « V9 »), « i°7 » distinct de « i° ». Observé : Cmaj9 « I », Cdim7 « i° » comme Cdim. La fenêtre écrit la même chose que la grille (vérifié).
- Appareil : tous. Trace : `conduite-des-voix.spec.ts` « le chiffre romain garde l'extension de l'accord… » (`test.fail`).
- Avis : bug de l'appli, de la même famille que T-04 (Fmaj7 et F7 sont tous deux « IV7 »).

**G-01 (déjà connu) sur Firefox** : le premier clic sur une case d'une autre partie ne la sélectionne pas. Le test « la fenêtre ouverte se ferme quand on clique sur une case de la grille ; la case est alors sélectionnée » est en `test.fail` sur Firefox ; les autres tests qui changent de partie recliquent une fois sous Firefox (aide `activerPartie`), comme le ferait l'utilisateur.

## Instabilités
- Une, corrigée côté test : sous WebKit (≈ 1 fois sur 3 sous charge) la colonne des touches se pose à 152 px au lieu de 151 puis revient à 151 après le premier défilement (arrondi de la mise en page, 1 px invisible, pas un bug de l'appli). Le test « molette horizontale… » tolère donc 1 px sur la position des touches (le défilement, lui, est de 400 px) ; 25 / 25 ensuite sous WebKit avec 3 travailleurs.
- Ensuite : 0 flaky dans `CI=1 npm run test:e2e:envoi`, module complet sans réessai. Limite connue de l'outil : `mouse.wheel` n'existe pas sur WebKit mobile (iPad) ; les deux tests à la molette y sont ignorés (`test.skip`), le défilement du test « V + garde l'endroit » y est posé directement.

## Observations sans test rouge (pour mémoire)
- La fenêtre couvre le haut de la grille : toute case de la grille cliquée la ferme (un clic « à côté »). Pour changer de partie active il faut donc fermer, cliquer une case de la partie, rouvrir. Cohérent, mais la fenêtre ne suit pas la sélection en direct.
- Changer l'échelle V remet à zéro le défilement vertical de la fenêtre ; l'échelle H et le défilement horizontal sont gardés (testé).
- Les boutons H et V ne se grisent pas aux butées (0,7 et 2) ; un clic de plus ne change rien (testé).
- Lancer la lecture ferme la fenêtre (clic à côté).

## Tests ajoutés (`tests/e2e/voicing/`, étiquette `@voicing`)
- `ouverture.spec.ts` : 20 tests (4 `@critique`, 1 `test.fail` V-01, 1 `test.fail` G-01 sur Firefox) — bouton (place, état), ouverture, trois façons de fermer (Échap, clic à côté, bouton), clic dedans, clic sur une case, clavier, séquenceur ouvert, lecture, partie active (Couplet, Refrain, Long), partie d'un seul accord, morceau sans accord, annuler après Suppr, rechargement, sous 900 px, 1000 px, triades.
- `conduite-des-voix.spec.ts` : 22 tests (4 `@critique`, 1 `test.fail` V-02) — une barre par son et leurs noms, en-têtes et chiffres, rôles et légende, autres sons (neuvième, quarte suspendue), tenues et mouvements, style des traits, tracé des traits, touches, molette, renversement / drop / octave / basse / type / fondamentale / transposition qui redessinent, largeur selon la durée, chiffres comme la grille, morceau inchangé.
- `echelles.spec.ts` : 12 tests (3 `@critique`) — présence, H +, V + (touches alignées), retour, butées 0,7 et 2 (H et V), mémoire après rechargement, même échelle d'une partie à l'autre, défilement gardé, fenêtre basse (reste dans l'écran, défile), morceau inchangé.
- `telephone.spec.ts` : 3 tests `@mobile` (1 `@critique`) — pas de bouton ni de fenêtre, onglet « Voicing » de la feuille d'accord intact, écran élargi à 1000 px.
- Aide : `aide-voicing.ts`. Total : 57 tests, 54 ordinateur / iPad, 3 téléphone, 12 `@critique`. L'onglet « Voicing » de la fenêtre d'accord (octave, renversement, drop, basse) reste dans `accord/onglet-voicing.spec.ts` : non dupliqué.

## Sélecteurs et testabilité
- Faute de mieux, sélecteurs CSS / attributs : `.vl-note` (une barre de note), `data-role` (root / third / fifth / seventh / ext), `line.vl-tenue`, `line.vl-mouvement`, `.voice-leading-scroll`, `.voice-leading-keys`, `.voice-leading-legend .lg`, les attributs SVG `x`, `y`, `width`, `stroke-width`. À proposer : `data-testid="vl-note"` (avec `data-note="E3"` et `data-accord`), `data-testid="vl-trait"` avec `data-type="tenue|mouvement"`, `data-testid="vl-defilement"`, `data-testid="vl-touches"`.
- Groupes d'échelle : simples `div` portant un `title` (« Échelle horizontale ») sans rôle `group` ; les boutons, eux, ont un `aria-label`.
- Aucun `waitForTimeout`. Aucune modification de l'appli.

## Non couvert
Pincement et loupe au doigt, tracé lu pendant la lecture, son, les couleurs rendues à l'écran (seuls les dégradés et les attributs sont vérifiés, pas les pixels), onglet « Voicing » de la fenêtre d'accord (module `accord`).
