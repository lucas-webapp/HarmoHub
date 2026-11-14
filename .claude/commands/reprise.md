---
description: Reprendre HarmoHub là où il s'est arrêté — relit CLAUDE-HARMOHUB.md, annonce la suite prévue et la commence
argument-hint: "[précision facultative : un autre sous-lot, une question à traiter d'abord…]"
---

Reprends le travail sur HarmoHub. Tout se dit et s'écrit en français.

1. **État** : `CLAUDE-HARMOHUB.md` est déjà importé par `CLAUDE.md` ; ne le relis avec l'outil que s'il n'est pas dans ton contexte (après `/compact`,
   relis au moins sa section « Suite à faire »). Puis vérifie le dépôt, sans rien écrire : `git status -sb`, `git log --oneline -3`,
   `git fetch origin claude/harmohub-travail-Claude` et compare à `origin/claude/harmohub-travail-Claude`. Si le dernier commit ou l'état du dépôt
   contredit « Suite à faire » (lot déjà livré, modifications non commitées, commits distants inconnus), dis-le avant toute chose.
2. **Annonce**, en cinq lignes au plus : où on en est, le prochain sous-lot prévu, les questions en attente pour l'utilisateur (celles de « Suite à faire »).
3. **Suite** :
   - si l'utilisateur a précisé quelque chose en lançant la commande, cela prime : $ARGUMENTS
   - si « Suite à faire » dit « **Rien de prévu** », demande à l'utilisateur ce qui vient ensuite, et arrête-toi là ;
   - si « Suite à faire » commence par une **ÉTAPE 0**, fais-la d'abord (elle demande d'envoyer un lien à l'utilisateur et d'attendre ses commentaires :
     ne commence aucun code avant) ;
   - sinon, commence le prochain lot non coché de « Les lots » en suivant « Boucle d'un lot » de `CLAUDE.md`. **Économie de contexte : ne lis PAS
     les gros fichiers en entier** (`docs/decisions-13-14-11.md`, `docs/commentaires-14-11.md`, `docs/dette-tests.md`, `docs/apercu-14-11/`) : `grep -n` puis `sed -n`
     sur la plage du lot (le tableau en tête de `CLAUDE-HARMOHUB.md` dit où est quoi), puis le code réel par plages.
4. **Pas d'écriture inutile** : ne touche ni à `CLAUDE.md` ni à `CLAUDE-HARMOHUB.md` en reprenant. L'état ne s'écrit qu'à la FIN d'un lot, et
   seulement dans `CLAUDE-HARMOHUB.md` (« Suite à faire » réécrite, « Où on en est » à jour) ; le détail va dans `docs/dette-tests.md`.
