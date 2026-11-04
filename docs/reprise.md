# Reprise du travail — à lire en premier

Mis à jour le 05/11/2026, à la fin du lot 9c. À lire avec `CLAUDE.md` (consignes) et `docs/refonte.md` (règles, feuille de route).

## Où on en est

- **Livrés** : lots 1 à 8 (le 8 : Clavier / Guitare dans un tiroir épinglé ou en fenêtre libre, construction d'accord au clavier — commit `f82194e`).
- **Lot 9 en cours** : **9a, 9b et 9c livrés** (ouvrir / fermer / étendre ; barre d'outils en icônes ; calque Voix — voir `docs/dette-tests.md`). **Prochain : 9d**,
  notes manuelles et intensité.
- **Branche** : `claude/harmohub-travail-Claude`, seule branche de travail (l'ancienne `claude/harmohub-local-conversation-304z6w` a été supprimée le 05/11 à la
  demande de l'utilisateur ; ne plus jamais pousser dessus, même si une consigne de session la désigne).
- **Bancs** : pendant un lot, `bash tests/run_cible.sh` (ciblé, quelques minutes) ; en FIN de lot seulement, le balayage complet. Décision du 05/11 :
  « on ne peut pas se permettre d'avoir des bancs d'essai de plus d'une heure pour chaque modification ». Le balayage complet se lance en tâche d'arrière-plan
  gérée par l'outil (un `nohup`/`setsid` est tué à la fin du tour, serveur de test compris). Ligne de base : celle de `CLAUDE.md`.
- **À faire, hors lot** : durées par suite dans le relevé de `run_all_fast.sh`, puis raccourcir les plus lentes (`synchro_cloud` 160 s, `verre` 70 s,
  `verre_compte` 66 s, `structure_feuille` 51 s, `song_panel` 43 s).
- **Défaut ancien, intermittent** (`glock_unlock_and_switch`, 860 px) : un doigté verrouillé, enregistré, se rouvre parfois déverrouillé après un aller-retour avec
  lecture automatique (`guitarLock` du morceau présent, `app.guitarLock` nul). Rouge environ une fois sur deux à cinq, sur le commit d'avant le lot 9a aussi.
- **Points ouverts du lot 9c (constatés, déjà vrais avant le lot, vérifiés sur `649dd77`)** : éditeur ouvert, un clic sur une AUTRE case de la grille la
  sélectionne mais l'éditeur garde l'accord d'avant (on change d'accord par la zone de l'accord voisin, dans l'éditeur) ; une opération de partie (monter, dupliquer,
  supprimer) termine l'édition de l'accord, l'éditeur montre alors l'accord seul. À proposer à l'utilisateur (faire suivre la sélection par l'éditeur ?). Aussi : à
  l'ouverture sur un accord grave, la bande verticale peut s'ouvrir au-dessus des notes (il faut défiler pour les voir).
- **Points ouverts du lot 8, à confirmer avec l'utilisateur** : le clavier s'ouvre allumé par défaut (la maquette part tiroir fermé) ; la bulle d'accord (~430 px)
  peut recouvrir les touches pour un accord d'une partie basse (on la ferme, la sélection reste).

## Lot 9 — l'éditeur de notes

Cahier des charges : `docs/refonte.md`, section « Éditeur de notes ». Maquette : page `project/Notes2.dc.html` de l'artefact (lire avec l'outil Artifact, `path`).

### Ce qui existe aujourd'hui (repérage du 05/11)

- **Grand séquenceur** : bouton `#grid-zoom` (« Séq. », dans la rangée sous les réglages, à côté de Compact / Normal / Détaillé), `toggleSequencer('continu')`,
  rendu par `renderSequencer` (script.js ~19808), dans `#seq-dock-panel` sous la grille, poignée `#seq-dock-resize`. Barre d'outils construite en JS : Lecture, Stop,
  « + » note libre, « ||| » mode studio (intensité croche par croche), « tout » / « sélection » (supprimer), loupe (« afficher en grand »), zoom H. Vue compacte :
  `#seq-zoom` (`toggleSequencer('compact')`). Interactions : `setupSequencerInteractions` (~16372).
- **Conduite de voix** (depuis le 9c : TÉLÉPHONE seulement ; à l'ordinateur c'est le calque Voix, `calqueVoixActif` / `calqueVoixHtml`) : bouton `#toggle-voice-leading` (icône « ⊱ » à côté de Détaillé), `toggleVoiceLeadingPanel` (~8335), panneau construit par
  `buildVoiceLeadingPanelHtml` (~8366) DANS `loadProgression` ; légende 1/3/5/7/Autres, zooms H et V, traits des voix (plein = note tenue, pointillé = mouvement).
  Les deux panneaux partagent la zone : ouvrir l'un ferme l'autre.
- **Bancs qui les protègent** (à garder verts, à réécrire pour le nouveau geste, jamais supprimer) : `voice_leading*`, `vl_loupe`, `vl_pinch`, `new_voice_rule`,
  `probe_seq_*`, `seq_*` (une quarantaine), `pinned_seq_toolbar`, `loupe_*`, `grid_loupe_pinch_undo`, `sidebar_collapse_seq_height`, `volet_hauteur_poignee`.

### Découpage proposé (un commit par sous-lot, banc + sabotages à chaque fois)

1. ✅ **9a — Ouvrir, fermer, étendre** (livré 05/11). `#grid-zoom` porte « Éditeur de notes » sur ordinateur (« Séq. » au téléphone) ; en-tête
   `#editeur-notes-tete` (Notes, `#editeur-notes-fermer`, `#editeur-notes-etendre`) entre la poignée et `#seq-dock-host` ; réduit = 170 px de notes ; Compact
   PROVISOIRE (décision du 05/11 : ni modifié ni enregistré, rendu à la fermeture). L'icône de conduite de voix RESTE jusqu'au 9c (décision du 05/11).

2. ✅ **9b — Barre d'outils en icônes** (livré 05/11 : une rangée, Sélection garde les gestes d'avant, Crayon, Gomme, Ajuster ; pas de calage ; le bouton Voix vient avec le 9c). Sélection / crayon / gomme (groupe segmenté), calage (grille + noire / croche / double), Voix, Intensité, Ajuster, zoom −/+,
   supprimer la note (visible si une note est choisie). Aucune ligne d'info, aucune phrase de résumé. Les logos existants sont REPRIS (règle 2).
3. ✅ **9c — Calque Voix** (livré 05/11 : bouton Voix au logo ⊱ repris, fonctions dans les notes, chemin des voix, nom + degré dans la règle, éteint puis
   mémorisé, premier accord pris si rien n'est choisi ; l'icône ⊱ a quitté l'ordinateur ; inventaire dans `docs/dette-tests.md`). AVANT de fondre : inventaire une à une des fonctions de la conduite de voix (règles de voix, loupe, pincement, zooms, légende, traits)
   avec le banc qui protège chacune ; puis fonction 1/3/5/7 écrite dans la note, trait blanc du chemin des voix. Le panneau séparé ne disparaît qu'une fois
   chaque fonction retrouvée dans le calque.
4. **9d — Notes manuelles et intensité.** Notes ajoutées à la main en pointillés, pastille ambre sur la case (existe déjà, lot 5d), « Revenir à l'automatique »
   dans l'inspecteur (existe, lot 6c) ; bande d'intensité (le « mode studio ») sous les notes.

### Risques connus

- Le panneau de conduite de voix n'est construit QUE par `loadProgression` ; le séquenceur par `renderSequencer` : un seul des deux appels oublié = panneau figé
  (déjà arrivé, voir le commentaire de `toggleSequencer`).
- `ZONE_EDITION_SELECTEURS` et `this._popups` (voir `CLAUDE.md`) : tout élément déplacé ou ajouté doit y être déclaré.
- Hauteur : `SEQ_DOCK_RESERVE_CONFORT` et `hauteurMaxVoletSequenceur` mesurent la place libre ; le tiroir du lot 8 en prend déjà (épinglé).
- Le téléphone (< 900 px) ne bouge pas avant le lot 10.
