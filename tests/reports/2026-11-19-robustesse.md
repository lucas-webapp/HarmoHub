# Rapport du module « robustesse » — 19/11/2026

## Résumé
- Testé : états vides (morceau sans accord, partie vide, dernier accord supprimé, export sans nom), très gros volumes (640 accords, textes de 300 à 400 caractères, 150 morceaux, 30 annulations), stockage plein / refusé / bloqué (localStorage, IndexedDB, données mal formées), rechargement en pleine édition, deux onglets du même navigateur.
- Résultat : 71 tests (5 fichiers, 26 `@critique`) sur Chromium et les autres ordinateurs, 59 au téléphone ; dont 11 `test.fail` = 7 bugs ouverts (Z-01 à Z-07) ; voir « Envoi » pour les résultats par projet.
- Suite conseillée : corriger Z-06 (état « Enregistré » faux après rechargement), Z-07 (onglet périmé qui écrit dans l'autre morceau) et Z-02 (échec d'enregistrement muet), puis arbitrer Z-04 / Z-05 (stockage ou données illisibles) ; phase 6 (compte rendu final) ensuite.

## Envoi
`CI=1 npm run test:e2e:envoi` lancé en entier APRÈS la dernière retouche des tests : code de sortie 0, aucune relance (0 « flaky »). Chromium : 853 réussis / 11 ignorés / 0 échoué (51 min en tout avec le second passage). Firefox, WebKit, Edge, Android, iPhone, iPad (`@smoke` et `@critique`) : 1670 réussis / 60 ignorés / 0 échoué. Dans `robustesse` sur Chromium, les 11 « ✘ » sont les 11 `test.fail` attendus (Z-01 à Z-07).
Passage du module complet (avant l'envoi, après les retouches de Firefox et du téléphone sauf mention) : Chromium 71 / 71 ; Firefox, WebKit, Edge, Android, iPhone, iPad : 400 réussis, 4 échecs réels corrigés ensuite (voir « tolérances »).

## Bugs (détail dans `tests/reports/bugs.md`)
- **Z-06 gênant** — Étapes : ouvrir « Alpha » (enregistré) ; renommer la partie ; recharger. Attendu : la modification reste ET la barre dit « Non enregistré ». Observé : la modification reste, la barre dit « Enregistré à hh:mm » (la version enregistrée n'a pas la modification). Tous navigateurs (mesuré Chromium). Trace : `test-results/robustesse-rechargement-*-Z-06-*`. Avis : bug de l'appli.
- **Z-07 gênant** — Étapes : onglets A et B sur « Alpha » ; A crée et enregistre « Charlie » ; B (affiche « Alpha ») ajoute D et enregistre. Attendu : D dans « Alpha ». Observé : B bascule en silence sur « Charlie » et y écrit D. Avis : bug de l'appli (la copie de travail partagée est relue au premier geste).
- **Z-02 gênant** — stockage plein : « Enregistrer » ne dit rien (exception non interceptée), le morceau reste « Non enregistré ». **Z-03 gênant** — copie de travail non écrivable : ajouter un accord ne fait rien, sans message. Avis : bugs de l'appli (aucune gestion de `QuotaExceededError`).
- **Z-04 / Z-05 gênants, rares** — stockage local bloqué (SecurityError) ou données de morceau de la mauvaise forme (liste absente, `null`, partie sans `chords`) : `window.app` n'existe jamais (même famille que E-06). Avis : bugs de l'appli.
- **Z-01 mineur (à arbitrer)** — « Nomme d'abord ton morceau… » ouvre le champ du nom ; un clic ailleurs enregistre un morceau vide « Sans titre ».
- Constats sans test (fin de `bugs.md`) : pas de service worker (une page rechargée hors ligne ne s'ouvre pas) ; durée d'accord de 10⁹ temps = onglet planté (non testé).

## Instabilités, tolérances, limites
- Aucune instabilité constatée sur Chromium (module passé 3 fois) ; les résultats des autres projets sont dans « Envoi ».
- **Tolérance justifiée 1** (`rechargement.spec.ts`, saisie en cours) : sous Firefox ordinateur, le texte tapé sans Entrée est VALIDÉ en quittant la page (accord « Em7 » ajouté), les autres moteurs le perdent. Le test attend donc 5 accords sous Firefox et 4 ailleurs : comportement du moteur, noté dans le titre et dans `bugs.md`. La grille d'origine est vérifiée intacte dans les deux cas.
- **`test.fail` conditionnel** (`morceau-long.spec.ts`, séquenceur sur un accord du milieu) : G-01 sous Firefox (clic sur une case d'une autre partie sans effet au premier clic). Vérification intacte.
- **Test limité à l'ordinateur** : la barre de lecture d'un morceau vide (`@ordinateur`) : au téléphone la barre est un panneau différent, éprouvé par le module `mobile`. Les raccourcis clavier, le séquenceur, le verre dépoli à deux onglets, l'historique de 30 annulations sont aussi `@ordinateur` (pas de clavier ni de séquenceur au téléphone).
- **Refus de stockage simulé** par un script posé avant le chargement (`Storage.prototype.setItem` / `getItem`, `IDBFactory.prototype.open`), activé après le démarrage ; un test vérifie à chaque fois que la simulation a bien refusé au moins une écriture (compteur `__refus`). Un vrai quota se comporterait de la même façon pour l'appli, mais n'est pas atteint dans le navigateur de test.
- Durées : seuls des plafonds larges (30 s de chargement d'un morceau de 640 accords) ; `test.slow()` pour les gros volumes.
- Non couvert : plantage réel du navigateur (le rechargement est simulé par F5), vrai quota du disque, mode privé réel de Safari, hors ligne AVEC rechargement (impossible sans service worker), coupure du réseau avec compte connecté (module `synchro`), SDK Firebase absent (`demarrage/hors-ligne`), réglages abîmés (`parametres/persistance`).

## Tests ajoutés (`tests/e2e/robustesse/`)
- `etats-vides.spec.ts` : 13 (4 `@critique`, 1 `test.fail` Z-01).
- `morceau-long.spec.ts` : 12 (6 `@critique`).
- `stockage.spec.ts` : 23 (1 `@critique` ; 5 `test.fail` écrits = Z-02 ×2, Z-03, Z-04, Z-05 ×4 par boucle).
- `rechargement.spec.ts` : 14 (6 `@critique`, 1 `test.fail` Z-06).
- `deux-onglets.spec.ts` : 9 (5 `@critique`, 1 `test.fail` Z-07).
- `aide-robustesse.ts` : aides communes (erreurs de page, refus de stockage, deuxième onglet, morceau long).
