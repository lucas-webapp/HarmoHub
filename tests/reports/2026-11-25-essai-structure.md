# Essai neutre : structure du morceau (25/11/2026)

Testeur sans accès au code, aux tests ni aux docs. Pilotage par Playwright (Chromium, souris, clavier, toucher), appli en mode test, sans compte. Les captures sont dans `tests/reports/essai-structure/`. La lecture audio n'a pas été jugée (voulu : elle ne suit pas la structure) ; le son n'est pas disponible dans mon environnement.

## Récapitulatif

| N° | Gravité | Résumé |
|---|---|---|
| SN-01 | gênant | Ctrl+Z / Annuler n'annule jamais un geste de structure |
| SN-02 | **bloquant** | Un Ctrl+Z (ou Annuler) peut transformer TOUTE la structure en « Partie supprimée » |
| SN-03 | gênant | La vue Structure ne se rafraîchit pas quand le morceau change sous elle |
| SN-04 | gênant | Clavier : menu inutilisable, focus perdu après chaque action, Espace inactif |
| SN-05 | amélioration | Menu : ligne visée non indiquée, commentaire non modifiable en apparence |
| SN-06 | gênant | Changer la métrique : mesures fractionnaires, « mes. 1–0.7 », point au lieu de virgule |
| SN-07 | gênant | Paroles : le ×N se règle mais n'est pas retenu et ne touche pas la structure |
| SN-08 | gênant | Suppression d'une partie de la grille : lignes fantômes sans nom, confirmation muette |
| SN-09 | mineur | « Renommer » : le curseur est au début du texte, rien n'est sélectionné |
| SN-10 | mineur | Nom de 200 caractères sans espace : texte sous les boutons, hors cadre, hors page PDF |
| SN-11 | mineur | Téléphone : l'aide dit « Clic droit », boutons de 30 px |
| SN-12 | mineur | Vocabulaire incohérent (Section / Partie N, Sans titre / Nouveau morceau, « partie(s) ») |
| SN-13 | amélioration | Parties ajoutées ou déplacées dans la grille : aucun signalement dans la structure |
| SN-14 | amélioration | Réordonner : pas de glisser, ↑ actif sur la première ligne, pas d'annulation |
| SN-15 | mineur | Longue liste : l'ajout n'est pas amené à l'écran, le total défile hors vue |
| SN-16 | mineur | Structure vidée : écran blanc sans explication |
| SN-17 | mineur | PDF « tout sur une page » réduit à 60 % : texte minuscule |

Décompte : 1 bloquant, 6 gênants, 7 mineurs, 3 améliorations.

## Ce qui marche bien

- Arranger au clic est rapide : « + Partie… » ajoute à la fin, ↑ déplace d'un cran, « + » donne ×2, le DÉROULÉ du haut se met à jour. Un morceau Intro, Couplet, Refrain, Couplet, Pont, Refrain ×2, Outro se monte en une dizaine de clics (OK-arrangement-6-parties.png). Totaux justes (25 mesures, 0 min 50 s à 120 BPM).
- Dupliquer (la copie arrive juste après), Renommer (cette occurrence seulement), Commentaire, Supprimer (« la partie reste dans la grille »). Noms hostiles (`"`, `<b>`, `&`, `<img onerror>`, emoji) affichés tels quels, rien n'est exécuté, y compris dans le PDF.
- Renommer une partie dans la grille se reflète partout. Le menu d'une partie de la grille indique « Jouée à 2 endroits de la structure » avec un lien « Régler dans Structure ». Pastille ×2 / ×3 dans la grille.
- Orpheline : « Partie supprimée, cette partie n'existe plus dans la grille », barrée, avec ✕, non comptée dans les totaux. Annuler la suppression dans la grille la ressuscite.
- Rechargement (avec brouillon), morceau enregistré puis rouvert, Dupliquer le morceau (structure et commentaires copiés, indépendants) : tout est conservé. Deux morceaux différents ne se mélangent pas. Transposer fait suivre les accords. Deux onglets : l'avertissement s'affiche.
- Aperçu / PDF : clair, téléchargement du PDF fonctionnel. Fenêtres de 360 à 920 px et téléphone 390×844 : pas de défilement horizontal, appui long = menu.

---

## SN-01 — Annuler n'annule jamais un geste de structure (gênant)

Étapes : grille Intro / Couplet / Refrain / Pont / Outro, onglet Structure, clic « + » sur Couplet (×2), puis Ctrl+Z (ou bouton Annuler).
Observé : le toast « Annulé » s'affiche, le bouton Rétablir s'active, mais la liste ne change pas (×2 reste). C'est le dernier geste de GRILLE (le dernier accord tapé) qui a été annulé, sans que l'écran le montre.
Attendu : annuler le dernier geste de structure, ou au minimum un bouton Annuler grisé sur cet onglet. Idem pour ↑ ↓ − +, Dupliquer, Supprimer, Renommer, Commentaire : aucun n'est annulable. Supprimer une ligne fait perdre sa place (on ne peut la réajouter qu'en fin de liste).
Vérifié deux fois (6 gestes enchaînés, 5 Ctrl+Z successifs : rien ne change à l'écran). Voir SN-02 pour la suite.

## SN-02 — Un Annuler peut détruire toute la structure (bloquant)

Étapes : construire la grille (5 parties, accords tapés), onglet Structure, un seul geste (« + » sur Couplet), puis Ctrl+Z, puis Grille, puis Structure.
Observé : 0 mesure, 0 partie, et 5 lignes « Partie supprimée » (SN-02-undo-lignes-fantomes.png) alors que la grille contient toujours ses parties. Le morceau est jugé orphelin à 100 %.
Cause probable (hypothèse) : l'annulation recharge des parties « d'avant » le premier geste de structure, qui n'ont pas les mêmes identités. Quand l'annulation porte sur un geste de grille postérieur au premier geste de structure, tout va bien (testé : ajout d'un accord puis Annuler, structure intacte).
Récupération : Rétablir (Ctrl+Y) ramène tout. Mais un utilisateur qui voit « Annulé » en pensant défaire son geste de structure perd tout l'arrangement, et un second Annuler ne le rend pas. Reproduit 3 fois.
Attendu : l'annulation ne doit jamais rendre les lignes orphelines.

## SN-03 — Vue Structure périmée (gênant)

Trois déclencheurs, même symptôme :
1. Sur l'onglet Structure, menu du titre, Nouveau morceau : le titre devient « Morceau B », la barre du bas montre un morceau vide (1/1), mais la liste affiche encore tout l'arrangement de l'ancien morceau (SN-03-vue-perimee-nouveau-morceau.png). Un clic sur « + » agit ensuite sur le nouveau morceau et remplace la liste par « Morceau ×2 », 0 mesure (SN-03-apres-clic-sur-vue-perimee.png).
2. Deux onglets, même morceau : l'onglet A reçoit « Morceau changé dans un autre onglet : Duo » mais sa liste reste à l'ancienne valeur (25 mesures au lieu de 27) jusqu'à un aller-retour Grille / Structure (SN-03-vue-perimee-autre-onglet.png).
3. Annuler, voir SN-01.
Attendu : la vue se redessine à chaque changement de morceau. L'ouverture d'un morceau existant via le menu, elle, se rafraîchit correctement.

## SN-04 — Clavier seul (gênant)

Constats vérifiés au clavier :
- Après Entrée sur ↑, ↓, + ou −, le focus tombe sur le corps de la page (la liste est redessinée) ; le Tab suivant repart du début de la page. Impossible de monter une ligne de 3 crans sans retaper Tab depuis le haut.
- Le menu (Dupliquer, Renommer, Commentaire, Supprimer) s'ouvre bien avec Maj+F10 ou la touche Menu sur un bouton de ligne (SN-04-menu-ouvert-au-clavier.png), mais le focus reste sur le bouton : Tab ne va pas dans le menu, les flèches ne font rien, et le menu reste ouvert pendant qu'on tabule ailleurs (ses entrées sont tout en fin de page dans l'ordre de tabulation). Seule l'aide « Clic droit : options » est affichée, jamais ce raccourci.
- Espace n'active pas les boutons (+, ↑, Aperçu / PDF, onglets) : rien ne se passe, alors que Entrée fonctionne. Je pense à un raccourci global (Lecture ?) qui capte la touche, mais je n'ai pas pu le confirmer faute de son : à vérifier.
- Après Échap sur la fenêtre « Renommer », le focus est perdu (corps de la page).
- Les boutons de chaque ligne ont le même nom pour un lecteur d'écran (« Monter », « Une répétition de moins »…) sans le nom de la partie ; la grille, elle, dit « Actions de la partie Intro ».

## SN-05 — Menu : cible et commentaire (amélioration)

- Au clic droit, la ligne visée n'est pas surlignée : le menu s'ouvre au curseur, on ne sait pas laquelle des deux « Couplet » est concernée (SN-05-menu-clic-droit.png).
- Sur une ligne déjà commentée, l'entrée s'appelle toujours « Ajouter un commentaire… ». Je n'ai pas vérifié si le texte est prérempli ni comment on le retire : à confirmer.

## SN-06 — Changer la métrique après coup (gênant)

Étapes : arrangement à 25 mesures en 4/4, puis Mesure : 3/4 (ou 12/8), puis Structure.
Observé (3/4) : « 33.3 mesures », « Intro 2.7 mes. mes. 1–2.7 », « Couplet 5.3 mes. mes. 3.7–8 », accords en « | C | % G | % | » (SN-06-mesures-3-4.png). En 12/8 : « Intro 0.7 mes. mes. 1–0.7 », fin avant le début (SN-06-mesures-12-8.png). La durée (0 min 50 s) reste juste. Les durées d'accord ne sont pas adaptées, d'où les mesures fractionnaires ; la grille aussi les affiche (« 2,7 mesures »).
Incohérences : la structure écrit « 2.7 » (point) quand la grille écrit « 2,7 » (virgule) ; la barre du bas affiche un autre total que la structure (voulu en lecture, mais l'écart est grand : 1/18 contre 33.3) ; le signe « % » n'est pas expliqué.
Attendu au minimum : jamais une plage « 1–0.7 » ; virgule ; idéalement un message ou un recalage au changement de métrique.

## SN-07 — Paroles : ×N réglable mais éphémère (gênant)

Étapes : arrangement avec Couplet 2 passages et Refrain 3 ; Paroles (nommer le morceau d'abord) : COUPLET ×2, REFRAIN ×3, cohérents. Cliquer « + » sur Refrain : ×4 (SN-07-paroles-multiplicateur.png). La structure ne bouge pas. Quitter Paroles puis revenir : ×3 de nouveau, sans prévenir.
Deux sources de vérité pour le même nombre, et un réglage perdu en silence. Attendu : soit ces boutons agissent sur la structure, soit ils sont retirés / grisés tant qu'une structure existe, soit le réglage est conservé et signalé. Notons que le « − » est grisé à ×1 seulement.

## SN-08 — Partie supprimée dans la grille (gênant)

Étapes : arrangement avec Couplet utilisé 2 fois ; grille, menu « ... » du Couplet, « Supprimer la partie ». La confirmation dit « Supprimer « Couplet » et ses 4 accord(s) ? » sans mentionner les 2 passages de la structure qui deviendront orphelins.
Observé en structure : deux lignes « Partie supprimée » (SN-08-parties-supprimees-sans-nom.png) sans dire de quelle partie il s'agit ; le nom est perdu, on ne distingue pas un Couplet d'un Pont. Pas de menu utile sur ces lignes (je n'ai pas testé le clic droit dessus : à vérifier).
Attendu : garder le nom (« Couplet — supprimée »), prévenir à la confirmation.

## SN-09 — Renommer : caret au début (mineur)

« Renommer » ouvre un champ prérempli (« Couplet ») dont rien n'est sélectionné et dont le curseur est en position 0 : taper « Couplet A » donne « Couplet ACouplet ». Même chose au téléphone. Il faut Ctrl+A. Attendu : tout sélectionner (SN-09-renommer-curseur.png). Vérifié deux fois.

## SN-10 — Nom très long (mineur)

Nom de 200 caractères sans espace dans la grille (le champ n'a pas de limite) : dans la structure, le nom passe sous les boutons − + ↑ ↓ et sort du cadre ; le DÉROULÉ sort du cadre ; dans le PDF, le nom dépasse la page (SN-10-noms-hostiles-nom-200-car.png). Avec des espaces (test 920 px / 360 px) tout passe à la ligne correctement. Les 30 à 40 passages (41 lignes, 108 mesures) fonctionnent, 2,4 s pour 36 ajouts ; « + » accepte ×61 sans limite.

## SN-11 — Téléphone (mineur)

- L'aide sous la liste dit « Clic droit : options » alors qu'il faut un appui long (SN-11-telephone-clic-droit.png). L'appui long ouvre le menu (SN-11-telephone-menu-appui-long.png).
- Boutons − + ↑ ↓ : 30 × 30 px, loin de la cible tactile de 44 px.

## SN-12 — Vocabulaire (mineur)

- Une partie sans nom s'affiche « Section » (grille) mais « Partie 3 » (structure) et « P… » (barre du bas).
- Le PDF s'intitule « Sans titre » alors que le morceau s'appelle « Nouveau morceau ».
- « 7 partie(s) » compte les passages (la grille a 5 parties) ; un morceau vide affiche « 0 partie(s) » avec une ligne « Partie 1 vide » et des boutons actifs.
- « mes. 13–13 » pour une seule mesure ; « mes. 13 » serait plus net.

## SN-13 — Grille et structure divergent sans le dire (amélioration)

Une fois la structure personnalisée (premier geste), elle ne suit plus la grille : parties déplacées dans la grille (SN-13-grille-reordonnee-structure-inchangee.png), parties ajoutées ou dupliquées (« Pont (copie) ») n'y apparaissent pas ; seul le menu « + Partie… » dit « (pas encore utilisée) ». C'est cohérent mais silencieux : un « 1 partie de la grille n'est pas dans la structure » ou un point d'alerte aiderait.

## SN-14 — Réordonner (amélioration)

- Pas de glisser-déposer : placer un Couplet en 4e position demande « + Partie… » puis ↑ ×2, sans voir le résultat intermédiaire.
- ↑ sur la première ligne et ↓ sur la dernière restent actifs et ne font rien ; à griser.
- Pas d'annulation (SN-01), pas de « dupliquer à cet endroit » dans la liste « + Partie… » (toujours en fin de liste).
- Les boutons ↑ ↓ fonctionnent bien et la ligne déplacée garde ses commentaires et son ×N.

## SN-15 — Longue liste (mineur)

Avec 41 lignes, un ajout par « + Partie… » ajoute la ligne en bas mais ne la fait pas défiler dans la vue (la dernière est coupée, SN-15-liste-longue-ajout-hors-champ.png). Le résumé (mesures, durée) défile et disparaît ; seul « Aperçu / PDF » reste collé.

## SN-16 — Structure vidée (mineur)

Supprimer toutes les lignes laisse « 0 mesures / 0 partie(s) » et le menu « + Partie… », sans message (SN-16-structure-vide-apres-suppressions.png), alors qu'une grille vide affiche une phrase d'explication. Seul le toast « Retirée de la structure » l'a signalé.

## SN-17 — PDF sur plusieurs pages (mineur)

À 22 passages, « Tout sur une page » réduit à 60 % et annonce « 2 pages : même réduite à 60 %, la structure ne tient pas sur une seule » (SN-17-apercu-60-pourcent.png) : texte minuscule inutilement. Il vaudrait mieux couper à 100 % sur deux pages (ou proposer deux colonnes).

---

## Non testé / incertain

Édition ou retrait d'un commentaire existant ; clic droit sur une ligne orpheline ; impression réelle (« Imprimer ») ; hypothèse sur la cause de SN-02 ; touche Espace (SN-04) ; audio. Le correctif de Z-07 (deux onglets) semble en place : avertissement affiché, mais voir SN-03.
