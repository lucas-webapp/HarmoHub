Mode SILENCIEUX pour ce travail (économie de tokens). Tout se dit et s'écrit en français.

Pendant que tu travailles sur ce que je te demande (ou sur la suite prévue dans « Suite à faire » de `CLAUDE-HARMOHUB.md`) :

- **Ne m'écris rien entre deux étapes** : pas de « je vais… », pas de résultats intermédiaires, pas de captures ni de sorties de bancs affichées, pas de questions de confirmation sur des choix conventionnels (choisis le plus logique, note-le au journal). Travaille d'une traite : code, banc, sabotages, balayage ciblé, corrections.
- **Économise le contexte** : lis par plages (`grep -n` puis `sed -n`), filtre les sorties (`grep -E "^FAIL|FATAL|PASS /"`), n'affiche jamais un balayage entier, pas de capture d'écran sauf nécessité (préfère des mesures chiffrées), regroupe les appels indépendants dans un même message.
- **Bancs** : balayage CIBLÉ pendant le lot ; balayage COMPLET une seule fois en fin de lot, SEUL (rien d'autre en parallèle : ~15 min). Pousse seulement après un balayage complet sans régression, comme d'habitude (`CLAUDE.md`).
- **Ne t'arrête que** si tu es réellement bloqué sur une décision qui n'appartient qu'à moi (une seule question, courte, avec ta recommandation), ou si quelque chose de destructif est en jeu.
- **À la fin, UNE seule réponse de quelques phrases** (5 au plus) : ce qui est fait (et poussé ou non), ce qui reste à faire, la question en attente s'il y en a une. Mets à jour `CLAUDE-HARMOHUB.md` (« Suite à faire », « Où on en est ») avant de répondre.

Si j'ai ajouté une consigne en lançant la commande, elle prime : 
