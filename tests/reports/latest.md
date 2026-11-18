# Rapport — module `tonalite` (18/11/2026)

## Résumé
- Testé : choix de la tonalité et du mode, suggestion, transposition, notation (dièses / bémols selon la tonalité, « Eb » tapé enregistré « D# »), degrés romains, téléphone. 47 tests, 7 fichiers.
- Résultat : `CI=1 npm run test:e2e:envoi` vert (922 réussis, 59 ignorés, 0 échoué, 1 flaky hors module) ; module complet sans réessai : chromium 44 / 44, et 264 / 264 sur firefox, webkit, edge, android, iphone, tablette. Y compris 5 échecs attendus (bugs T-01 à T-04).
- Suite conseillée : arbitrer T-02 (« Suggérer » non annulable) et T-03 / T-04 (écriture des basses et chiffres), puis module `voicing`.

## Problèmes (4 bugs avec test, 1 constat sans test) — détail dans `tests/reports/bugs.md`
**T-01 — dièses écrits « # » ici, « ♯ » là** (mineur, à arbitrer)
- Étapes : 1. Morceau « C Am F G ». 2. Tonalité « F♯ ». 3. Lire la puce, puis `#song-summary-key` (au téléphone : la ligne de résumé).
- Attendu : « F♯ majeur » partout. Observé : puce « F♯ », résumé « F# majeur ».
- Appareil : tous. Trace : `test-results/tonalite-notation-…T-01…` (test `test.fail`, vidéo / trace gardées à l'échec attendu).
- Avis : bug de l'appli (cosmétique) ; la règle du 16/11 (« D# ») plaide peut-être pour « # » partout.

**T-02 — « Suggérer » n'est pas annulable** (mineur)
- Étapes : 1. « C Am F G ». 2. Tonalité, « Suggérer », « A mineur ». 3. Regarder « Annuler ».
- Attendu : actif, un appui rend « C majeur ». Observé : grisé (un choix de tonique, lui, s'annule).
- Appareil : tous. Trace : `suggestion.spec.ts` « la proposition choisie se défait… » (`test.fail`).
- Avis : bug de l'appli (oubli d'un `pushUndo`).

**T-03 — la basse ne suit pas la règle des fondamentales** (mineur, à arbitrer)
- Étapes : 1. Ajout rapide « C/Eb//Eb » en do. 2. Mi majeur, « D/F#//F# ».
- Attendu : C/E♭ comme E♭ ; D/F# comme F#. Observé : « C/D# » en do ; « D/G♭ » en mi.
- Appareil : tous. Trace : `notation.spec.ts` (deux tests T-03, `test.fail`).
- Avis : bug de l'appli ou règle volontaire (« Eb → D# en do » pour les notes) ; à arbitrer.

**T-04 — chiffres romains : Fmaj7 = F7** (mineur, à arbitrer)
- Étapes : 1. « Fmaj7 », « F7 », « Cmaj7 » en do. 2. Lire les chiffres. Attendu : distincts. Observé : « IV7 », « IV7 », « I7 ».
- Appareil : tous. Trace : `degres.spec.ts` (T-04, `test.fail`). Avis : bug de l'appli (ambigu à la lecture).

**T-05 — degrés hors échelle** (constat, sans test) : en do phrygien « Dm » = « biii », en do mixolydien « Bdim » = « bi° ». Cohérent mais inhabituel.

## Instabilités
- Aucune dans le module : 308 exécutions sans réessai (chromium + 6 projets), 0 flaky.
- Hors module (dans la même passe `envoi`) : `synchro/versions.spec.ts` « un 2ᵉ appareil voit les versions… » a réussi au 2ᵉ essai sur Firefox (déjà connu : famille Y-03).

## Tests ajoutés (`tests/e2e/tonalite/`, étiquette `@tonalite`)
- `choix.spec.ts` : 9 tests (4 `@critique`) — fenêtre (12 toniques, 7 modes), tonique, mode, sept modes, annuler / rétablir, enregistrement et rechargement, nouveau morceau en do, fermeture.
- `suggestion.spec.ts` : 8 (2 `@critique`, 1 `@ordinateur`, 1 `test.fail` T-02) — liste classée, choix d'une proposition, mineur, ii-V-I, morceau vide, suivi du morceau, Échap.
- `transposition.spec.ts` : 9 (3 `@critique`) — haut, bas, retour, 12 pas, mode / types / basses, plusieurs parties, historique, enregistrement, durées.
- `notation.spec.ts` : 12 (3 `@critique`, 3 `test.fail` T-01 / T-03) — fondamentales en do, saisie « Eb » / « D# », tableaux par tonalité (dièses, bémols, mineures), basses, fenêtre.
- `notation-notes.spec.ts` : 1 `@ordinateur` — étiquettes du séquenceur selon la tonalité.
- `degres.spec.ts` : 4 (1 `@critique`, 1 `test.fail` T-04) — qualité dans le chiffre, accord étranger, dominante secondaire.
- `telephone.spec.ts` : 4 (1 `@critique`) — 3 `@mobile` (résumé, panneau, repli) et 1 `@ordinateur` (barre des réglages).
- Aide : `aide-tonalite.ts`. Total : 47 tests, 44 sur ordinateur, 44 sur téléphone (14 `@critique`).

## Sélecteurs et testabilité
- Sélecteurs CSS faute de mieux : `.row-roman` (chiffres romains : proposer `data-testid="degre"`), `.cell-sym` (déjà utilisé), `.key-suggest-label` / `.key-suggest-pct` (liste de suggestion), `#song-summary-key` (texte de la tonalité, masqué à l'ordinateur), `.sq-etiq`.
- Aucun `waitForTimeout`. Aucune modification de l'appli.

## Non couvert
Diagrammes clavier / guitare selon la tonalité, étiquettes de la fenêtre d'accord (déjà dans `accord`), tonalité dans les versions du cloud (`synchro`), export (MIDI / PDF) d'un morceau transposé, notes ajoutées du séquenceur (module `sequenceur`).
