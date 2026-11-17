# Rapport e2e — module `accord` (17/11/2026)

## Résumé
- Testé : fenêtre d'accord (ouverture et fermeture, onglets Accord, Voicing et Rythme, navigation entre accords, annuler / rétablir) et panneau d'accord du téléphone.
- Résultat : 49 tests écrits (40 ordinateur, 9 téléphone, 16 `@critique`). Chromium, tout le dépôt : 124 réussis, 0 échoué (6 échecs attendus : G-02 ×2, G-03, A-01 à A-03). `@smoke|@critique` sur les 6 autres projets : tout vert (39 / 39 / 39 / 39 / 17 / 17).
- Suite conseillée : arbitrer A-01 (types texte) et A-03, puis module suivant `lecture`.

## Environnement
- Émulateurs Auth 9099 et Firestore 8080 sur `demo-harmohub` ; appli servie en mode test sur 127.0.0.1:8936. Je les ai lancés et arrêtés.
- Exploration `playwright-cli` (session `harmohub`, ordinateur et Pixel 7) : aucune requête vers la production Firebase. Garde-fou : 0 requête bloquée dans les tests.

## Résultats par projet
- chromium (tout le dépôt) : 124 réussis, 0 échoué, 1 ignoré (échecs attendus inclus : A-01 à A-03, G-02 ×2, G-03).
- `@smoke|@critique` : firefox 39, webkit 39, edge 39, tablette 39, mobile-android 17, mobile-iphone 17 réussis, 0 échoué.
- Module `accord` complet, répété ×2 sous firefox et webkit : 160 réussis, 0 échoué, 0 instable.

## Problèmes (détail et étapes dans `tests/reports/bugs.md`)
- **A-01 mineur, tous** : la fenêtre d'accord enregistre durée, octave et renversement en TEXTE (`"3"`, `"1"`). Étapes : Am, « Un temps de moins », Voicing, octave +, 1er renv. ; lire `localStorage.myProgression`. Attendu : nombres. Observé : chaînes. Avis : bug de l'appli (export et cloud portent des chaînes). Trace : `test-results/accord-onglet-voicing-…-nombres-…`.
- **A-02 mineur, à arbitrer, ordinateur** : basse = fondamentale s'écrit « Am/A ». Étapes : Am, onglet Accord, basse « A ». Attendu : « Am ». Avis : imperfection ; à arbitrer.
- **A-03 mineur, ordinateur** : onglet Rythme, un accord tenu n'a aucune forme marquée séquenceur fermé, puis « Plaqué » se marque ~300 ms après l'ouverture du séquenceur. Attendu : « Plaqué » dans les deux cas. Avis : bug d'affichage ; à arbitrer.
Ces trois tests restent en `test.fail` (vérification intacte), ils deviendront rouges à la correction : retirer alors le `test.fail`.

## Instabilités
- **WebKit ordinateur (~1 fois sur 120)** : le double-clic qui ouvre la fenêtre n'est parfois pas reconnu par l'appli (fenêtre jamais ouverte). Non reproduit sous les autres moteurs. Avis : test fragile OU défaut de reconnaissance du double-clic sous WebKit chargé ; l'aide `ouvrirFenetre` recommence jusqu'à 3 fois (comme un utilisateur) et attend le nom de LA case visée. Aucune vérification affaiblie.
- **Téléphone** : après le double-tape, l'appli ignore les touchers pendant ~300 ms (garde anti « clic fantôme ») : un toucher immédiat sur « Dm » est perdu. L'aide attend 600 ms. Pas un bug (un humain n'est pas si rapide), à connaître.

## Observations (pas des bugs)
- Fenêtre d'accord : `#bulle-accord` (ordinateur), `#panneau-accord` (téléphone, feuille du bas) ; les deux sont des `dialog` « Accord <nom> ».
- 20 types d'accord, 12 fondamentales, durée de 1 temps à plus de 10 mesures (le « + » n'a pas de butée), octave de 2 à 5.
- Le 3e renversement n'existe que pour un accord à quatre sons ; changer le type remet renversement et drop à zéro.
- Au téléphone, « Réglages du son » mène à l'onglet Voicing et « Moins » revient à Accord ; la rangée Basse et la durée sont dans la feuille défilante.
- Non couvert : glisser le bord d'une case pour changer la durée (bancs historiques), appui long, vue Piano, intensité.

## Tests ajoutés (`tests/e2e/accord/`)
- `ouverture.spec.ts` : 7 tests ordinateur, 2 `@critique`.
- `onglet-accord.spec.ts` : 10 tests ordinateur, 3 `@critique` (dont le test rouge A-02).
- `onglet-voicing.spec.ts` : 9 tests ordinateur, 3 `@critique` (dont le test rouge A-01).
- `onglet-rythme.spec.ts` : 9 tests ordinateur, 1 `@critique` (dont le test rouge A-03).
- `navigation-annuler.spec.ts` : 5 tests ordinateur, 2 `@critique`.
- `telephone.spec.ts` : 9 tests téléphone, 5 `@critique`.
- `aide-accord.ts` : aides communes (pas une spec). Aucun `waitForTimeout`.
- Total : 49 tests, 16 `@critique`. Tous étiquetés `@accord`, `@ordinateur` ou `@mobile`.

## Sélecteurs CSS faute de mieux (`data-testid` à proposer)
- `.cell-meta` (octave / voicing sous le nom, cible du double-clic) → `case-octave`.
- `[data-bulle="root"|"quality"|"bass"][data-valeur]` : attributs stables, acceptables tels quels.
- `.bulle-duree` : valeur de durée → `fenetre-duree`.
- `#sequenceur`, `#context-menu` : `id` stables.
