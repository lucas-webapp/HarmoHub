# Rapport — module `mobile` (18/11/2026)

## Résumé
- Testé : la mise en page téléphone (< 900 px) : barre du haut et onglets, réglages et affichage de la grille, bande Clavier / Guitare / Fichier, bloc « Voir » du panneau Lecture, « + Accord », « + Section », appui long, défilement, glisser, pincement, largeurs 320 à 899 px, paysage, seuil de 900 px ; plus un test qui vérifie que l'ordinateur n'a rien du téléphone.
- Résultat : 54 tests, module complet sur les 7 projets tout vert (1 échec attendu = M-01, `test.fail`). Trois passes de suite sur Android et iPhone : 303 réussis, 0 instabilité. `CI=1 npm run test:e2e:envoi` vert : chromium 394 réussis / 0 échoué ; autres projets (`@smoke|@critique`) 842 réussis / 0 échoué / 1 instable (synchro, iPhone, réussi au 2ᵉ essai : famille Y-03, pas ce module).
- Suite conseillée : arbitrer M-01 et M-02 ; puis les modules P2 (`tonalite`, `voicing`, `diagrammes`, `structure`, `paroles`).

## Problèmes

### M-01 — « Modifier » (appui long) : onglet Voicing marqué, contenu Accord
1. Téléphone, morceau « C Am F G ». Appui long (0,8 s) sur « Am » : le menu s'ouvre.
2. Toucher « Modifier ».
3. La feuille montre FONDAMENTALE et TYPE (contenu de l'onglet Accord) mais « Voicing » est marqué (`aria-pressed`) ; au double-tape, « Accord » l'est.
- **Attendu** : l'onglet marqué est celui du contenu visible. **Observé** : « Voicing » marqué.
- **Appareil** : Android (Pixel 7) et iPhone 15 émulés, déterministe.
- **Trace** : `npx playwright test tests/e2e/mobile/gestes.spec.ts -g "comme le double-tape" --project=mobile-android` (`test.fail`).
- **Avis** : bug de l'appli (état d'onglet incohérent). Gravité : mineur.

### M-02 — Copie par appui long + glisser : pas dans la partie visée (à arbitrer, sans test)
1. Téléphone, « Couplet : C Am F G », « Refrain : F C ». Doigt sur « Am » 0,8 s, glisser sur le « C » du Refrain, relâcher.
- **Attendu** : un « Am » dans le Refrain (ou rien). **Observé** : « C Am Am F G », Refrain inchangé. Dans la même partie, la copie va avant la case visée, quel que soit le côté. Idem à la souris (Ctrl+glisser).
- **Appareil** : Android (appui long réel), Chromium ordinateur. **Trace** : aucune (exploration).
- **Avis** : comportement à arbitrer, pas de test faute d'attendu décidé. Gravité : mineur.

## Instabilités
Aucune dans ce module (3 passes × 2 projets téléphone). Dans l'envoi : 1 test de `synchro` (iPhone, Y-03) réussi au 2ᵉ essai.

## Limites de la matrice (à savoir)
- Appui long, glissé, pincement, durée au doigt : vrais évènements tactiles DevTools sur Android seulement. Sur iPhone (WebKit), Playwright n'a ni `touchmove` ni molette : l'appui long y est rejoué par des `touchstart` / `touchend` envoyés dans la page ; 5 tests de gestes composés y sont ignorés (raison dans le titre : glissé depuis une case, déplacement d'une case, durée au doigt, pincement, doigt qui bouge pendant l'appui). Le défilement de la barre fixe y passe par `scrollBy`.
- Pas de clavier virtuel réel, pas de Safari / iPhone physiques.
- Piège de pincement : un doigt posé sur la poignée de durée (bord d'une case) déclenche la durée, pas le zoom ; les tests posent les doigts sur le corps des cases.

## Tests ajoutés (`tests/e2e/mobile/`, 54 tests, 24 `@critique`)
- `barre-haut.spec.ts` : 6 (deux rangées, onglets Structure / Paroles / Grille, Annuler / Rétablir, Paramètres, barres fixes, rangée des réglages).
- `reglages-affichage.spec.ts` : 7 (résumé déplié, Transposer, listes Mesure / Swing / Son, tonalité, Affichage Compact / Normal / Large + persistance, pincement, bouton Séquenceur).
- `bande-du-bas.spec.ts` : 8 (placement, fixe au défilement, diagrammes et persistance, diagramme qui suit l'accord, bande cachée sous les panneaux, bloc « Voir », Séquenceur, Fichier).
- `ajouts.spec.ts` : 8 (« + Accord » par partie, destination, suggestions, partie vide, « + Section » cachée puis visible, création et nom, plusieurs sections).
- `gestes.spec.ts` : 15 (appui long : menu, Dupliquer, Octave, Renommer, Supprimer, Modifier (M-01), Séquenceur, Copier / Coller ; défilement depuis une case, déplacer, durée au doigt).
- `mise-en-page.spec.ts` : 10 (6 largeurs, paysage, seuil 900 px, clavier non levé, ordinateur intact `@ordinateur`).
- Aide : `aide-mobile.ts` (appui long, glissé, pincement, défilement).
- Sélecteurs : identifiants (`#tb-titre`, `#song-summary`, `#tel-affichage`, `#toggle-viz-piano`, `#add-section`…) et rôles ; CSS seulement pour `.cell-meta`, `.cell-sym-input`, `.chord-header-row`, `#piano-viz`, `#guitar-viz-wrap`, `[title="Glisser pour changer la durée"]` (un `data-testid` aiderait : poignée de durée, en-tête du diagramme).

## Observations sans bug
- Toucher « Guitare » dans la bande désélectionne l'accord (le diagramme revient au premier) : cohérent avec « toucher à côté désélectionne ».
- Notation : dièses affichés « # » dans les cases, « ♯ » dans la fenêtre de tonalité ; bémols « ♭ » partout.
