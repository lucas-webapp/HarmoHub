# Rapport e2e — module `synchro` (18/11/2026)

## Résumé
- Testé : connexion par l'émulateur Auth (compte fictif), envoi du morceau, relecture en direct sur un 2ᵉ appareil (2ᵉ contexte), fusion de deux bibliothèques, suppression, conflit, coupure du réseau puis reprise, menu du compte et déconnexion, versions (historique, restauration, limite cloud, versions automatiques), règles de sécurité Firestore.
- Résultat : 49 tests dans le module (46 ajoutés + les 3 d'origine, intacts ; 175 exécutions `@critique` sur les 7 projets). Module complet sur les 7 projets : 297 réussis, 44 ignorés, 2 échecs d'un test corrigé depuis (attente du contenu, relancé 9 / 9 vert sur WebKit, iPhone, iPad). `CI=1 npm run test:e2e:envoi` : vert (chromium 393 réussis ; autres projets `@smoke|@critique` : 791 réussis au total, 57 ignorés, 2 « flaky » réussis au 2ᵉ essai = Y-03).
- Suite : arbitrer Y-01 (pastille « Hors ligne » après la reprise) et Y-02 (appareil partagé) ; module suivant `mobile`.

## Problèmes
### Y-01 — pastille « Hors ligne » après le retour du réseau (gênant, intermittent)
**Étapes** : 1. se connecter, pastille « Synchronisé » ; 2. couper le réseau ; 3. ne rien modifier, attendre 3 s, rétablir le réseau ; 4. regarder la pastille.
**Attendu** : « Synchronisé » dès le retour. **Observé** : reste « Hors ligne » (100 s mesurées) jusqu'au prochain enregistrement ou changement distant ; ≈ 9 fois sur 10.
**Appareil** : Chromium, WebKit, Firefox. **Trace** : relancer le test après avoir enlevé le `test.fixme`.
**Avis** : bug de l'appli (l'indicateur ne suit que les évènements du SDK). Test en `test.fixme` (intermittent : un `test.fail` passerait au hasard).

### Y-02 — appareil partagé (mineur, à arbitrer)
**Étapes** : 1. compte 1 avec deux morceaux ; 2. « Se déconnecter » ; 3. se connecter avec le compte 2 sur le même navigateur.
**Attendu** : à arbitrer (effacer ou demander). **Observé** : les morceaux du compte 1 partent dans le cloud du compte 2 ; le cloud du compte 1 n'est jamais touché.
**Avis** : conception à arbitrer. Test de constat dans `deconnexion.spec.ts`.

### Y-03 — la pastille ne passe pas toujours à « Hors ligne » (mineur, intermittent)
**Étapes** : connecté, couper le réseau, attendre 20 s. **Observé** : parfois toujours « Synchronisé » (≈ 2 %, WebKit, Android, iPhone, sous charge).
**Trace** : CI du 18/11, `test-results/synchro-envoi-relecture-En-5e12a--le-ressuscite-pas-critique-mobile-android/` (1ᵉʳ essai).
**Avis** : même famille que Y-01 ; rien n'est perdu (un enregistrement fait pendant cet état part à la reprise). Pas de test dédié.

## Instabilités
- 2 tests réussissent seulement au 2ᵉ essai en CI (Y-03), tous deux « supprimer un morceau sur A… » sur `mobile-android` et `mobile-iphone`.
- Corrigé côté test : « un morceau neuf créé sur B apparaît dans la liste de A » lisait le morceau avant l'arrivée de son contenu (WebKit) ; il attend maintenant les accords dans le cloud puis sur A (rien d'affaibli : la même égalité finale).

## Ce qui a été observé de l'appli
- Conflit : la version enregistrée EN DERNIER gagne ; l'autre est gardée en copie `arch_…` dans le dossier « Archives » (rien n'est perdu).
- Suppression : suivie par un marqueur ; un appareil absent ne ressuscite pas le morceau.
- Versions : une avant chaque transposition, suppression, import, restauration, à l'enregistrement et toutes les 5 minutes de travail (« Automatique »). L'appareil les garde toutes, le cloud les 5 plus récentes. Un morceau supprimé garde sa version sous « Bravo (supprimé) ».
- Règles : seul le propriétaire lit et écrit `users/{uid}/apps/{appli}` ; tiers, inconnus et autres chemins reçoivent 403.
- Aucune requête vers la production Firebase (garde-fou actif sur tous les contextes, y compris le 2ᵉ appareil).

## Tests ajoutés (`tests/e2e/synchro/`)
- `envoi-relecture.spec.ts` : 8 (`@synchro`, 5 `@critique`).
- `conflit.spec.ts` : 5 (2 `@critique`).
- `reseau.spec.ts` : 6 dont 1 `test.fixme` Y-01 (2 `@critique`).
- `deconnexion.spec.ts` : 7 (3 `@critique`).
- `versions.spec.ts` : 11 (3 `@critique`), dont 2 avec l'horloge simulée (`page.clock`).
- `regles-securite.spec.ts` : 5, Chromium seul (4 `@critique`).
- `connexion-google.spec.ts` : 3 d'origine intacts + 4 ajoutés (fenêtre d'accueil du compte).
- `aide-synchro.ts` : aides communes + fixture `test` étendue de `support/fixtures` (2ᵉ appareil fermé en fin de test, garde-fou anti-production conservé).
Non couvert : la vraie fenêtre Google (test existant, ignoré dans la VM faute d'accès à apis.google.com, joué en CI), synchro des formes / doigtés / paroles, coupure du réseau au rechargement.
