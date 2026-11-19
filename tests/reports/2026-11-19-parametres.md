# Rapport du module « parametres » — 19/11/2026

## Résumé
- Testé : la fenêtre « Paramètres » (ouverture, fermeture, clavier, valeurs d'usine, « À propos »), la section Son (volumes, décompte, son du métronome, jouer à la sélection, rythme des nouveaux accords), l'Affichage (degrés, fonction harmonique, repères de temps, position d'accord, date, noms des rythmes, barres du séquenceur), l'Apparence (verre, couleur), les étiquettes des instruments (piano, guitare, manche de dessin), la persistance après rechargement, des valeurs abîmées, et les réglages qui voyagent avec le compte.
- Résultat : 53 tests (6 fichiers, 19 `@critique`), 53 sur les projets ordinateur, 29 au téléphone ; tout vert sur les 7 projets, dont 11 `test.fail` = 7 bugs ouverts (E-01 à E-07). `CI=1 npm run test:e2e:envoi` : voir la ligne « Envoi » ci-dessous.
- Suite conseillée : corriger E-02 (Espace lance la lecture) et E-06 (appli qui ne démarre plus sur un volume abîmé), puis arbitrer E-03 à E-05 (noms de notes et tonalité) ; ensuite le module `robustesse`.

## Envoi
`CI=1 npm run test:e2e:envoi` lancé en entier APRÈS la dernière retouche des tests : code de sortie 0. Chromium : 782 réussis / 11 ignorés / 0 échoué. Les 6 autres projets (`@smoke` et `@critique`) : 1513 réussis / 60 ignorés / 0 échoué, 1 relancé avec succès (hors module : `fichiers/liste-morceaux.spec.ts` « la fenêtre liste chaque morceau… », iPhone, réussi au 2ᵉ essai). Aucun test de `parametres` n'a eu besoin d'une relance. Module seul sur les 7 projets (avant l'envoi) : tout vert, échecs attendus inclus. Un premier envoi (51 min) avait relancé 3 tests du module (Firefox ×2, iPhone ×1) : durcis ensuite (voir « Tolérances »), puis le tout a été relancé.

## Bugs (détail dans `tests/reports/bugs.md`)
- **E-02 gênant** — Espace sur un interrupteur de « Paramètres » lance la lecture du morceau au lieu de le basculer. Étapes : ouvrir Paramètres, Tab jusqu'à « Degrés », Espace. Attendu : l'interrupteur bascule. Observé : rien ne bascule, le morceau joue. Appareil : Chromium (même code partout). Trace : `test-results/` du test « E-02 » de `fenetre.spec.ts`. Avis : bug de l'appli (raccourci global sans garde sur les contrôles).
- **E-06 gênant (rare)** — un volume enregistré qui n'est pas un nombre (« beaucoup », vide, « abc ») empêche l'appli de démarrer (`window.app` absent, « Invalid argument(s) to setValueAtTime: null »). Tests : `persistance.spec.ts` (3). Avis : bug de l'appli.
- **E-03, E-04 mineurs** — pastilles de la guitare et manche de dessin écrivent D#, A#… en do majeur, alors que l'infobulle promet « les dièses ou bémols de la tonalité ». **E-05** (à arbitrer) : même chose sur les touches du piano. Tests : `instruments.spec.ts` (3).
- **E-01 mineur (accessibilité)** — le focus n'entre pas dans la fenêtre ouverte au clavier, Tab part derrière elle. **E-07 mineur** — un volume enregistré hors de 0 à 100 (150, −5, 500) est gardé tel quel (3 tests).
- Constats sans test : voir la fin de `bugs.md`.

## Instabilités, tolérances, limites
- **Pastilles de la guitare** : le dessin se refait après le clic ; la vérification « toutes les pastilles sont parmi A, C, E » est faite DANS une attente (`expect.poll`) qui n'aboutit que lorsque l'état final est pur. Une pastille étrangère qui resterait ferait échouer l'attente au délai. Cause de l'écart : une lecture entre deux redessins voyait l'ancien accord (Firefox, 1 fois sur 1500).
- **Décompte** : on attend le DÉBUT de la lecture (`isPlaying`) avant d'attendre sa fin ; sinon, sous Firefox chargé, la fin était « vue » avant le début (0 clic).
- **Appareil neuf qui se connecte** (`synchro-reglages.spec.ts`) : la page principale se recharge d'elle-même environ une demi-seconde après la connexion (mesuré sur Chromium et WebKit). Les lectures qui tombent dessus sont refaites (`toPass`, repère posé dans la page puis attendu), et un rechargement WebKit en « internal error » est refait. Toute autre erreur remonte.
- « Noms des rythmes » : l'état d'usine dépend de la largeur (allumé au-dessus de 1340 px) ; le test de valeurs d'usine en tient compte et le test d'effet part d'un état « allumé » forcé.
- Sélecteur CSS sans `data-testid` : `text[fill="#fff"]` dans le dessin de la guitare (les pastilles sont les seuls textes blancs ; les numéros de cases sont gris, les « X » rouges). `data-testid` manquant : `guitar-pastille` sur ces `<text>`.
- Non couvert : l'effet audible (son factice : « Écouter en éditant » et « Son au déplacement » ne sont vérifiés que par leur état et leur mémoire), étiquettes piano / guitare au téléphone, historique des versions (module `synchro`).

## Tests ajoutés (`tests/e2e/parametres/`)
- `fenetre.spec.ts` : 10 (2 `@critique`, dont 2 `test.fail` E-01, E-02).
- `son.spec.ts` : 9 (4 `@critique`).
- `affichage.spec.ts` : 9 (5 `@critique`).
- `instruments.spec.ts` : 10 (4 `@critique`, 3 `test.fail` E-03 à E-05).
- `persistance.spec.ts` : 12 (2 `@critique`, 6 `test.fail` E-06 ×3, E-07 ×3).
- `synchro-reglages.spec.ts` : 3 (2 `@critique`).
- Aide : `aide-parametres.ts`.
