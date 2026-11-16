# Rapport e2e — module `demarrage` (16/11/2026)

## Résumé
- Testé : parcours principal `@smoke` (ouvrir, ajouter C Am F, lire, arrêter, recharger), garde-fou production, et nouvel état hors ligne (SDK Firebase indisponible).
- Résultat : **16 réussis / 0 échoué** sur les 7 projets (chromium, firefox, webkit, edge, mobile-android, mobile-iphone, tablette) ; 12 sautés voulus (garde-fou : chromium seul). Chromium seul : 4 / 4.
- Suite conseillée : passer au module `grille` (P1) ; ajouter les `data-testid` listés plus bas quand tu le valides.

## Environnement
- Émulateurs Auth 9099 et Firestore 8080 sur le projet `demo-harmohub` ; appli servie en mode test sur http://127.0.0.1:8936 (SDK local, configuration `demo-`).
- Exploration `playwright-cli` (session `harmohub`) : **aucune requête vers la production Firebase**. Seules les polices Google et les échantillons Tone.js partent, et sont bloqués par la configuration.
- Firefox : la sortie audio factice (PulseAudio) était déjà en place, la lecture démarre.

## Problèmes
Aucun bug de l'appli trouvé.

Observations (pas des bugs) :
- Au rechargement après une modification, l'appli ouvre un dialogue `beforeunload` (« modifications non enregistrées »). Voulu ; Playwright le ferme seul dans les tests.
- Après Entrée, le focus reste dans la case « + » : on enchaîne les accords sans recliquer.
- Hors ligne, au téléphone, le test ne vérifie pas le message « Synchronisation indisponible » : la pilule de connexion n'est éprouvée qu'à l'ordinateur. À compléter avec le module `mobile`.

## Tests ajoutés
- `tests/e2e/demarrage/hors-ligne.spec.ts` : 1 test, tags `@critique @demarrage`, tous les projets. Le SDK Firebase est refusé (503). On vérifie : pas de fenêtre d'accueil du compte, ajout de C et G, la pilule « Se connecter » qui explique l'absence de Firebase (ordinateur), la persistance après rechargement.
- Sabotage : sans la coupure du SDK, le test échoue bien (`firebase` chargé).

## Sélecteurs CSS faute de mieux (`data-testid` à proposer)
- `#cloud-guard-modal` : la fenêtre d'accueil. Un `getByRole('dialog', { name: 'Retrouve ton travail partout' })` marcherait aussi.
- `#google-signin-btn` : la pilule de connexion (son nom accessible change selon l'état).
- `#progression-sections .grid-cell[data-index]` : les cases d'accord → `data-testid="case-accord"`.
- `.prog-section-ajout`, `#quick-add-input`, `#quick-add-btn` : l'ajout au téléphone.
- `#play-prog`, `#stop` : le transport.
