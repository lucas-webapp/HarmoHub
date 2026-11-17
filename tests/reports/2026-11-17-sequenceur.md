# Rapport e2e — module `sequenceur` (17/11/2026)

## Résumé
- Testé : ouvrir / fermer, cinq rythmes prédéfinis, poser / étirer / raccourcir / déplacer / sélectionner / supprimer / annuler une note, intensité, vues Accord et Piano, notes ajoutées (ajout, renommage, retrait), poignée et plein écran, copier / coller un rythme, formes personnelles (enregistrer, créer, modifier, supprimer). Le son est factice : on vérifie l'état de la grille et le stockage, jamais l'audio.
- Résultat : 117 tests écrits (95 ordinateur, 22 téléphone, 35 `@critique`). Module complet sur les 7 projets : 519 exécutions, toutes vertes, échecs attendus inclus (3 bugs avec test : S-01 à S-03). Aucune instabilité vue.
- Suite conseillée : arbitrer S-02 (téléphone) et S-03 (Suppr), puis module suivant `fichiers`.
- Vérification finale `npm run test:e2e:envoi` : 2ᵉ passage entièrement vert (voir la dernière section). Le 1ᵉʳ avait un échec dans le module `lecture`, pas dans `sequenceur` (L-06).

## Environnement
- Émulateurs Auth 9099 et Firestore 8080 sur `demo-harmohub`, appli servie en mode test sur 127.0.0.1:8936. Je les ai lancés pour explorer, puis arrêtés avant `envoi` (qui lance les siens).
- Exploration `playwright-cli` (session `harmohub`, ordinateur 1440 px puis Pixel 7) : aucune requête vers la production Firebase (seul `fonts.googleapis.com`, coupé par la configuration). Garde-fou : 0 requête bloquée dans les tests.

## Résultats par projet (module complet)
- chromium : 95 réussis (dont 2 échecs attendus : S-01 et S-03).
- firefox, webkit, edge, tablette : 95 réussis chacun.
- mobile-android, mobile-iphone : 22 réussis chacun (dont 1 échec attendu : S-02).
- Échecs attendus (`test.fail`, vérification intacte) : S-01 et S-03 sur les cinq projets ordinateur ; S-02 sur les deux téléphones.

## Problèmes (détail et étapes dans `tests/reports/bugs.md`)
- **S-02 gênant, téléphones** : toucher « Enregistrer la forme… » (menu « Tous les rythmes ») ferme la feuille d'accord, donc le séquenceur, alors que le menu reste ouvert.
  1. Téléphone, « … » → « Séquenceur », aller sur « Am ». 2. Signet « Tous les rythmes ». 3. « Enregistrer la forme… ».
  Attendu : la feuille reste ouverte. Observé : elle se ferme (la forme s'enregistre quand même). Avis : bug de l'appli (clic « à côté » après redessin du menu, hypothèse). Trace : `test-results/sequenceur-formes-…-laisse-la-feuille-…-<projet>/`.
- **S-03 gênant (à arbitrer), ordinateurs** : le séquenceur ouvert, Suppr sans note sélectionnée supprime l'accord choisi de la grille, sans confirmation (Ctrl+Z le rend).
  1. Ouvrir le séquenceur, choisir « Am ». 2. Appuyer sur Suppr sans toucher aucune note. Attendu : rien. Observé : « Am » disparaît. Avis : probablement le raccourci de la grille, à arbitrer. Trace : `…-sans-note-sélectionnée-…`.
- **S-01 mineur (à arbitrer), ordinateurs** : ajouter la note libre « C4 » sous « Am » (qui contient déjà C4) crée une seconde ligne « C4 ». Ajouter deux fois « D4 » n'en crée qu'une. Trace : `…-seconde-ligne-identique-…`.
Les trois tests restent en `test.fail` : retirer le `test.fail` le jour de la correction.

## Instabilités
- Aucune dans le module `sequenceur` sur les 519 exécutions (hors L-06, qui est dans `lecture`). Les tests n'utilisent aucune attente fixe ; chaque geste est suivi d'un `expect.poll` ou d'un `expect` sur l'état (case, classe, stockage).
- Aucune vérification retirée ni affaiblie.

## Vérification finale `npm run test:e2e:envoi`
- 1ᵉʳ passage : chromium 269 réussis, **1 échoué** : `lecture/lecture-stop.spec.ts` « « Stop » en cours de route : la lecture repart du début » (la lecture est repartie à la case 2 au lieu de 0). Le script s'arrête là (`&&`), les autres projets n'ont pas tourné.
- Ce test, qui n'est pas de moi, échoue au hasard (Chromium, Firefox) : voir L-06 dans `bugs.md`. Je ne l'ai ni retouché ni affaibli.
- 2ᵉ passage : chromium 270 réussis, 0 échoué ; firefox, webkit, edge, mobile-android, mobile-iphone, tablette (`@smoke|@critique`) 418 réussis, 0 échoué (18 ignorés : molette sur WebKit mobile, etc.).

## Observations (pas des bugs)
- Un clic sur une case vide pose une croche ; un clic sur une note la sélectionne (il ne la supprime pas) ; Suppr ou Retour arrière supprime la sélection ; Ctrl+clic ajoute à la sélection ; glisser sur des cases vides peint une note tenue (de la croche d'appui à celle de relâchement, comprises). Échap ne désélectionne pas.
- Au téléphone, un toucher sur une case VIDE pose une croche, un toucher sur une NOTE l'enlève (sauf « Intensité » allumée : le cycle fort → doux → normal boucle sans jamais enlever). Les rythmes s'y appliquent à « Toute la partie » par défaut (« Cet accord » pour un seul accord) ; à l'ordinateur, toujours à l'accord choisi.
- Intensité : fort = 90, doux = 55, enregistrés par note (`intensiteVoix`) ; une note étirée a une seule force.
- Vue Piano : 34 lignes de G2 à E5 à l'ordinateur (moins au téléphone). Une note sur une hauteur étrangère à l'accord crée une note ajoutée. La ligne d'une note ajoutée n'est enregistrée dans l'accord qu'à la première note posée dedans.
- Copier / coller : le rythme est copié avec ses forces, mais les coups sur une note ajoutée ne sont pas collés (la cible n'a pas cette ligne).
- Plein écran : seulement en vue Piano (en vue Accord la poignée ne masque jamais la grille). Ni la hauteur ni le plein écran ne survivent à un rechargement ; la vue (Accord / Piano) et l'ouverture, si. Au rechargement, le premier accord est choisi.
- Une forme enregistrée est un bouton ; clic droit : « Modifier ce schéma… » / « Supprimer cette forme » (confirmation en deux temps). Un rythme prédéfini se masque (« Masquer ce rythme ») et se rétablit (« ↺ Rétablir (n) »).
- Non couvert : appui long et glisser au doigt (téléphone : peindre avec « Dessiner », défilement), marquise de sélection (il n'y en a pas : glisser peint), réglages du séquenceur (hauteur des barres, largeur des croches), son, lecture pendant l'édition (bancs historiques).

## Tests ajoutés (`tests/e2e/sequenceur/`, 117 tests, tous `@sequenceur`)
- `ouverture.spec.ts` : 11 tests (4 `@critique`) : bouton, croix, barre d'outils, grille, choix de l'accord, « Coller » inactif, retenu au rechargement ; téléphone : panneau « Lecture », flèches, fermeture.
- `rythmes.spec.ts` : 15 tests (4 `@critique`) : cinq rythmes, un accord seul, arpèges, pompe, remplacer / annuler, rythme par accord, rechargement, « Effacer », rythme libre « + », menu du clic droit (masquer / rétablir, modifier le schéma) ; téléphone : portée « Toute la partie » / « Cet accord ».
- `notes.spec.ts` : 22 tests (7 `@critique`) : poser, étirer à droite et à gauche, raccourcir, déplacer, sélectionner, supprimer, Ctrl+clic, annuler / rétablir, peindre, rechargement, S-03 ; téléphone : toucher pose / enlève, « Dessiner ».
- `intensite.spec.ts` : 10 tests (2 `@critique`) : bouton, cycle, éteinte, note par note, note étirée, case vide, annuler, rechargement ; téléphone : cycle bouclé.
- `vues.spec.ts` : 10 tests (4 `@critique`) : vues Accord et Piano, mêmes notes dans les deux, hauteur étrangère, déplacer en hauteur, étirer / supprimer ; téléphone : « Voix » / « Toutes les notes ».
- `notes-ajoutees.spec.ts` : 16 tests (4 `@critique`) : bande « Note libre », nom et octave, « Eb3 » → « D#3 », annuler, nom invalide, poser, renommer au clic (et Échap), retirer, par accord, rechargement, annuler, S-01 ; téléphone : ajout et retrait.
- `plein-ecran.spec.ts` : 9 tests (2 `@critique`) : poignée, plus / moins de lignes, plein écran et sortie, double-clic, édition en plein écran, rechargement, vue Accord ; téléphone : pas de poignée.
- `copier-coller.spec.ts` : 10 tests (1 `@critique` ordinateur + 1 téléphone) : copier / coller sur un autre accord, plusieurs collages, forces, annuler (ordinateur et téléphone) ; « Coller » actif, coller un rythme tenu.
- `formes.spec.ts` : 14 tests (6 `@critique`) : liste, enregistrer, annuler, appliquer, rythme dessiné, créer (Tétrade et Triade, Effacer), renommer, supprimer (deux temps, renoncer), rechargement ; téléphone : enregistrer et appliquer, S-02.
- `aide-sequenceur.ts` : aides communes (pas une spec). Aucun `waitForTimeout`.

## Sélecteurs CSS faute de mieux (`data-testid` à proposer)
- Les cases de la grille : `#sq-grille .sq-case[data-c][data-v][data-k]` (accord, voix, croche) → `sq-case` avec `data-testid="sq-case-<accord>-<voix>-<croche>"`. Elles ont un rôle `gridcell` et un nom (« E4, croche 3 : vide ») : les tests s'en servent pour lire l'état et pour la vue Piano.
- `.sq-note`, `.sq-bord.g` / `.sq-bord.d` (note et poignées d'étirement) → `sq-note`, `sq-poignee-gauche`, `sq-poignee-droite`.
- `.sq-nom[data-c]` (nom d'accord en tête de colonne), `.sq-etiq` / `.sq-etiq.libre` (étiquettes de lignes), `.sq-libre-nom` (nom renommable, rôle `button`), `.sq-case.sq-sel` (note sélectionnée), `.sq-bi-case`.
- `#sq-…` (rythmes, vues, intensité, copier, coller, effacer, poignée, portée) : `id` stables, utilisés tels quels ; `getByRole` pour tout le reste (barre « Rythme », boutons nommés, dialogues « Tous les rythmes » et « Modifier le schéma »).
- Les boutons de forme n'ont pour nom accessible que leur vignette : on les cible par leur `title` (`Ma forme — clic droit : …`).
