# Nettoyage de dette des tests — ce qui a été fait, et pourquoi

Une suite qui éprouve une fonctionnalité RETIRÉE n'échoue pas : elle ment. Elle occupe une ligne
rouge dans la campagne, on la relit, on la re-diagnostique, et on retrouve à chaque fois la même
conclusion — « ah oui, ça n'existe plus ». Pire : au milieu de 33 lignes rouges, personne ne
remarque celle qui signale un VRAI défaut. C'est exactement ce qui s'était produit ici : deux bugs
réels dormaient dans ce bruit depuis des semaines (voir plus bas).

Point de départ : **110 suites vertes sur 143**. Arrivée : **143 sur 143**.

## 1. Suites supprimées — la fonctionnalité n'existe plus

| Suite | Fonctionnalité éprouvée | Retirée par |
|---|---|---|
| `guitar_synth_test.js` | instrument « Guitare (synthé) » | `7cf11cb` |
| `tap_rhythm_test.js` | enregistrement du rythme tapé | `fc7b776` |
| `tap_rhythm_fullchord_test.js` | idem, durée pleine de l'accord | `fc7b776` |
| `tap_calib_and_grid_test.js` | calibration de la latence du rythme tapé | `fc7b776` |
| `seq_copy_paste_test.js` | boutons Copier/Coller du séquenceur | remplacés par Ctrl+C/V puis par la pipette de rangée |
| `seq_paintbrush_test.js` | outil pinceau du séquenceur | remplacé par la pipette de rangée |
| `run_loop_boundary_test.js` | `window.runTest` d'une page d'essai jamais versionnée | 404, jamais dans le dépôt |
| `run_loop_note_test.js` | idem | idem |
| `run_tone_mechanism_test.js` | idem | idem |
| `transport_click_test.js` | clic sur l'ancien bouton « Accord » (#play), en plus de #play-prog/#stop | `41be989`-suivant (retrait du bouton, retour utilisateur) — entièrement recouvert par `global_transport_test.js`, qui teste Lecture/Boucle/Stop + le flottant lui-même |

`tap_removal_test.js` est conservé : c'est lui qui vérifie que le rythme tapé a bien disparu.

## 2. Contrats réécrits — le besoin tenait, le moyen avait changé

Chaque suite porte en tête l'explication du changement. À lire AVANT de « corriger » un échec.

- **Nouveau contrat du clic dans la grille** (premier clic = sélectionner partout, second clic
  rapproché = renommer si l'on a visé le symbole) : `grid_dblclick_test`, `grid_errors_test`,
  `song_panel_test`, `midi_unnamed_test`.
- **Les six boutons d'export fusionnés dans un menu « Fichier »** : `midi_import_e2e_test`,
  `export_lyrics_test`, `export_lyrics_opens_tab_test`, `paroles_autoload_back_test`.
- **L'onglet Config a disparu** (les réglages du morceau sont un bloc dépliable autonome) :
  `config_improvements_test`, `metronome_groove_test`, `slider_function_test`,
  `slider_revert_test`, `tap_removal_test`.
- **Le bandeau Ajout/Modif a disparu**, `appMode` est devenu un getter déduit de `editingIndex` :
  `mobile_scroll_test`.
- **Un seul panneau « conduite de voix », global** au lieu d'un par partie :
  `voice_leading_section_ops_test` (réécrit), `vl_pinch_test`.
- **Le repère de contretemps est une forme CSS**, plus un caractère « • » : `grid_beat_highlight_test`.
- **Les suggestions de tonalité rendent une proportion** (`diatonicRatio`), plus un compte
  (`diatonicCount`) : `config_improvements_test`.
- **Les boutons de zoom se désactivent à la butée** : `item1_2_test`, `item1_hzoom_out_test`.

## 3. Faux négatifs de banc d'essai — l'appli allait bien, la sonde visait mal

- **Coordonnées page vs fenêtre.** `boundingBox()` de Playwright est relatif à la PAGE,
  `elementFromPoint` à la FENÊTRE. Dès que la page a défilé, le geste part à côté.
  Corrigé dans `seq_twofinger_pan`, `seq_twofinger_jitter`, `vl_pinch`.
- **Élément sous la ligne de flottaison.** Sans `scrollIntoView`, la molette et les doigts visent
  le vide. Corrigé dans `seq_hscroll`, `seq_beat_highlight`, `ctx_nav`, `ctx_nav_scroll`, les deux
  `twofinger`.
- **Playwright clique le CENTRE d'un élément.** Une zone de navigation contextuelle de 224x213px
  déborde l'écran : son centre est couvert. On vise désormais un point réellement atteignable
  (`ctx_nav`, `ctx_nav_scroll`) ou une zone nue de la case (`song_panel`).
- **État poussé sous une forme invalide.** Une sélection de séquenceur s'écrit `{voice, start, end}`,
  pas `{voice, step}` — l'ancienne forme faisait planter le rendu. (`seq_buttons_removed`)
- **Nœud détaché.** Lire `scrollLeft` juste après la fin d'un geste lit l'ancien `.seq-scroll`,
  déjà remplacé par la repeinture. (`seq_twofinger_jitter`)
- **Champ inexistant.** `window.app.liveSeqPattern` n'a jamais existé : le motif vit dans
  `#arpPattern`. (`seq_buttons_removed`)
- **Bruit réseau du bac à sable.** Google Fonts est injoignable derrière le proxy ; 44 suites
  comptaient ces échecs comme des erreurs console. Filtré partout.

## 4. Accélération de la campagne

- **`#left-tab-add` supprimé de 14 suites.** L'onglet n'existe plus ; le clic était neutralisé par
  un `.catch()` — mais Playwright attend **30 secondes** avant d'abandonner. Chaque ligne morte
  coûtait une demi-minute.
- **Chemins Chromium figés retirés de 56 suites** (`/opt/pw-browsers/chromium-1194/...`) : une
  version épinglée qui casse au premier changement d'image.

## 5. Deux VRAIS bugs, trouvés parce que le bruit a été retiré

Tous deux dans le séquenceur compact, tous deux silencieux, tous deux corrigés :

1. **Le glissé à deux doigts ne faisait rien.** `panTarget()` ne reconnaissait que `kind === 'seq'`
   pour retrouver l'élément qui défile. Le séquenceur compact — SEUL hôte à demander `pan: true` —
   s'appelait bien `'seq'` à l'origine ; renommé `'seqInline'` en `26385cd` quand les six panneaux
   ont été alignés sur les mêmes règles de zoom, il retombait depuis sur `#arp-sequencer`, qui ne
   défile pas. `scrollLeft` était consciencieusement modifié sur un élément sans débordement.

2. **Et quand il a recommencé à défiler, la vue revenait au début.** La restauration du défilement
   après repeinture est gardée par `parseInt(dataset.editingIndex) === this.editingIndex`. Sans
   accord ouvert dans le panneau, l'attribut vaut la chaîne `"null"`, `parseInt` en fait `NaN`, et
   `NaN` n'égale jamais rien : la condition était TOUJOURS fausse. La fin du geste déclenche une
   repeinture — le défilement était donc perdu 150 ms après l'avoir obtenu. Le commentaire du code
   décrivait pourtant déjà l'intention (« un accord compact qui déborde ne doit pas revenir au tout
   début à chaque repeinture ») : c'est la condition qui ne la servait pas.

## 6. Campagne complète du 12/08 — 3 suites rouges, aucune liée aux points 2+3 du séquenceur

Balayage sérialisé des 140 suites (nécessaire : trois Chromium en parallèle sur le même petit
serveur de test avaient déjà produit de faux échecs par le passé, voir plus haut). Chacune des trois
rouges a été rejouée contre le HEAD propre (sans les changements de cette session, via `git stash`) :
même échec des deux côtés, donc rien à voir avec les points 2 (lignes chromatiques) et 3 (clavier de
repérage) livrés aujourd'hui.

- **`items2345_test.js` — « octave up click ».** Le test lit `before` dans `localStorage` (une
  CHAÎNE, ex. `"4"`), puis compare `r.after === (r.before||3) + 1`. Sur une chaîne, `+ 1` concatène
  au lieu d'additionner : `"4" + 1` vaut `"41"`, jamais égal à `"5"` — alors que l'appli, elle,
  passe bien de 4 à 5 (visible dans le relevé : `{"before":"4","after":"5"}`). Bug du TEST, pas de
  l'appli.
- **`pdf_fixed_scale_test.js` — « End-of-line measure number… ».** Assertion `r[0][3].endNum ===
  '4'` : elle attend que le numéro de fin de ligne RÉPÈTE le numéro de la dernière mesure — exactement
  le défaut que l'utilisateur a signalé et que j'ai corrigé plus tôt dans cette session (« il devrait
  y avoir 5 et 9 en fin de lignes, là on a à nouveau 4 et 8 »). Contrat périmé, remplacé par
  `pdf_regle_numeros_test.js` qui vérifie la bonne valeur (`5`, pas `4`).
- **`three_more_features_test.js` — « Compact sequencer: labels NOT sticky ».** Attend que les
  étiquettes ne soient PAS collées en mode compact-mais-large (`wideCompact`). Contrat périmé lui
  aussi : `.seq-scroll-continuous .seq-label, .seq-scroll-wide .seq-label { position: sticky; }`
  couvre les deux modes par choix délibéré (voir style.css, commentaire « repère perdu de vue en
  glissant une note loin à droite ») — décision prise après ce test, jamais mise à jour dedans.

Aucune de ces trois n'a été touchée : corriger des tests obsolètes sur des fonctionnalités hors
sujet aurait élargi la tâche du jour sans rapport avec la demande. Signalé ici pour que le nettoyage
suive le même chemin que les précédents (converti ou supprimé) la prochaine fois qu'on y touche.

## 7. Retrait du bouton « Accord » (#play) — un vrai crash corrigé, trois faux positifs de minuterie

Retour utilisateur : « un seul bouton lecture pour toute la grille, le bouton lecture accord ne sert
pas à grand chose » — #play retiré du DOM (voir global_transport_test.js). Deux suites plus anciennes
le ciblaient directement :

- **`transport_click_test.js`** — supprimée (section 1) : entièrement recouverte par
  `global_transport_test.js`.
- **`item1_2_test.js` — « transport icon sizes (chord vs grid triangle) »** — un VRAI crash cette
  fois (`getBBox()` sur `#play svg path`, devenu `null`), pas juste une assertion qui rate. Corrigé
  en place plutôt que supprimé : le reste du fichier (zoom H du séquenceur compact, bouton boucle)
  reste valide, seule cette section comparait deux triangles dont un seul existe encore désormais.

Trois autres suites (`affordances_test.js`, `seq_beat_highlight_test.js`, `seq_handle_feedback_test.js`
— toutes trois sur des gestes tactiles/glissés du séquenceur) sont ressorties rouges dans le balayage
complet, mais vertes à 100% rejouées seules juste après, sans changement de code entre les deux : la
même minuterie sous contention déjà documentée plus haut (section « bruit réseau »), pas une
régression du transport. `sidebar_collapse_test.js` a, lui, buté sur un défaut PRÉEXISTANT de ce bac
à sable (rejoué sur le HEAD d'avant toute modification du jour, même symptôme) : recharger la page
juste après avoir coupé une lecture Tone.js peut occasionnellement fermer l'onglet Playwright avant
que le nettoyage audio n'ait fini — un `waitForTimeout(300)` entre `stopAll()` et `reload()` (déjà en
place ailleurs, jamais dans ce test) le rend fiable.

Un vrai bug, en revanche, trouvé et corrigé au passage : le tout premier essai du transport flottant
(colonne verticale centrée verticalement sur le bord droit) recouvrait `#quick-add-btn` et le logo du
bandeau du haut sur un écran de téléphone (390×780) — assez pour planter Playwright en boucle de
réessai de clic. Le transport vit désormais dans DEUX hôtes distincts selon la largeur d'écran (voir
placeGlobalTransport dans script.js, même principe que placeSequencer) : `.dock` (pied de colonne
collant, téléphone) ou `#global-transport` (colonne flottante, ordinateur) — jamais les deux à la
fois, jamais superposé à un vrai contrôle.

## 8. Balayage hybride (`run_all_fast.sh`) — retour utilisateur : « accélère »

Le balayage 100% série (`run_all.sh`) mettait plus d'une heure à parcourir les 140 suites alors que
la charge machine restait basse (load average ~0.1 sur 4 cœurs) : le goulot n'était pas les
ressources, juste le séquentiel. Retour utilisateur du 12/08 : accélérer, mais garder en série
uniquement ce qui en a vraiment besoin.

`run_all_fast.sh` (nouveau, scratchpad) fait deux passes :
1. **Phase 1, en série** : les ~24 suites qui simulent des gestes tactiles/glissés minutés (pincer,
   deux doigts, marquee, drag, ctx-nav...) — exactement la liste qui, par le passé, produisait de
   faux échecs sous contention (voir sections 3 et 7 ci-dessus).
2. **Phase 2, en parallèle (4 threads = nproc)** : toutes les autres suites, qui n'ont pas de
   dépendance de timing fine avec le serveur de test.

Résultat de la première campagne avec ce script : **140/140 suites analysées, aucun échec réel**
au-delà des 3 déjà connus et documentés en section 6 (`items2345_test.js`, `pdf_fixed_scale_test.js`,
`three_more_features_test.js`). Un `page.goto` a dépassé son délai de 15s une fois
(`grid_loupe_pinch_undo_test.js`, pourtant en phase série) — rejoué seul immédiatement après :
11/11 PASS, donc un aléa ponctuel de démarrage (serveur/navigateur), pas une régression.

Note pour la suite : beaucoup de suites (~49 sur 140) n'impriment pas de ligne de bilan agrégée
(« N PASS / N FAIL ») — juste des `console.log('PASS ...')`/`console.log('FAIL ...')` ligne par
ligne. `parse_sweep.py` (scratchpad) les classe à tort en « résumé manquant » ; la bonne méthode pour
vérifier ces suites-là est de chercher les lignes qui COMMENCENT par `FAIL` (pas celles qui
contiennent juste le mot, ce qui inclut à tort les résumés du type « 0 FAIL »).

## 9. Paroles ressorti du menu Fichier — 4 suites adaptées au nouveau bouton

Retour utilisateur : « sortir le module Paroles dans un bouton à part à côté de fichiers ». L'entrée
`lyrics` a disparu de `openFileMenu()` (script.js) ; `#lyrics-btn`, nouveau bouton autonome à côté de
`#file-menu-btn`, appelle directement `exportLyricsData()`. Quatre suites déclenchaient cette action
via `actionFichier(page, 'lyrics')` (clic sur `#file-menu-btn` puis sur
`[data-file-action="lyrics"]`, qui n'existe plus) : `export_lyrics_test.js`,
`export_lyrics_opens_tab_test.js`, `paroles_autoload_back_test.js` — corrigées avec un nouvel
helper `ouvrirParoles(page)` (`page.click('#lyrics-btn')`), le reste de chaque test inchangé (le
comportement DERRIÈRE le clic n'a pas bougé). `midi_import_e2e_test.js` et `popups_close_test.js`
touchent aussi le menu Fichier mais jamais l'entrée `lyrics` : aucun changement nécessaire, revérifiés
quand même (26/26 et 20/20).

## 10. Sweep du 12/08 (soir) — un serveur de test mort en plein balayage

Le petit serveur HTTP local (`python3 -m http.server 8934`) s'est arrêté en plein milieu d'un
balayage complet, sans message d'erreur visible côté script — chaque suite lancée après coup a
échoué avec `ERR_PROXY_CONNECTION_FAILED` (le proxy du bac à sable ne pouvait plus relayer vers un
serveur mort). Ce N'ÉTAIT PAS du bruit réseau habituel (polices Google Fonts) : la page elle-même ne
chargeait plus. Diagnostiqué avec `curl -m 5` (connexion refusée), corrigé en relançant le serveur.
`run_all_fast.sh` (scratchpad) tourne maintenant sous un petit gardien qui vérifie le serveur toutes
les 15s pendant le balayage et le relance automatiquement s'il retombe.

## 11. Sweep du 13/08 — trois suites rouges, AUCUNE causée par le travail du jour

Vérifié en rejouant chaque suite sur le commit `2e4217f` (avant les deux commits du jour), servi en
parallèle sur le port 8935 depuis un `git worktree` : elles y échouent à l'identique. Ce ne sont donc
pas des régressions, mais des bancs restés en arrière de suppressions décidées plus tôt.

- `seq_pinch_touch_conflict_test.js` — FATAL `window.app.openGridZoom is not a function`. La vue
  plein écran de la grille (« loupe ») a été supprimée à la demande de l'utilisateur ; la méthode
  avec. Le banc doit être réécrit sur le volet continu, qui la remplace.
- `seq_short_note_body_test.js` — 5 FAIL. Le dernier (« le séquenceur est bien épinglé dans la loupe
  de grille ») relève de la même suppression. Les QUATRE autres portent sur le marquage « corps »
  d'une note courte au survol (`.seq-zone-body`, voir setSeqHoveredNote) : ils échouaient DÉJÀ avant
  aujourd'hui, mais rien ne dit s'il s'agit d'un banc périmé ou d'une vraie panne de cette
  fonctionnalité. À instruire à part — signalé à l'utilisateur, pas corrigé en douce.
- `seq_snap_sticky_test.js` — 3 FAIL. Le sélecteur d'aimantation (fer à cheval) a été retiré à la
  demande de l'utilisateur (« il faut enlever le bouton du choix d'aimantation ») ; l'aimantation est
  désormais fixe à la double croche. Le banc teste un réglage qui n'existe plus.

Corrigé en revanche le jour même, parce que le contrat a VRAIMENT changé :
`probe_seq_finitions_test.js` affirmait `.seq-cell { touch-action: none }`. Les cases laissent
maintenant le navigateur défiler (`pan-x pan-y`) et c'est la DURÉE de l'appui qui sépare défiler de
dessiner — voir `probe_defilement_tactile_test.js`, banc dédié. 19/19 après mise à jour.

## 12. `glock_full_real_ui_test.js` est INSTABLE ici — et j'ai conclu trop vite dessus

Ce banc rend, **sur du code strictement identique** (même commit, même serveur, rien de modifié
entre deux lancements) : 29, 33, 31, 31, 33, 29, puis 31 lors du balayage ciblé de clôture. Les
échecs ne sont pas les mêmes d'un tour à l'autre ; le duo le plus fréquent est « après rechargement
complet, accord 1 : cadenas actif en édition » + « bon doigté affiché en édition », c'est-à-dire les
deux assertions qui suivent un `reload()` — un problème de synchronisation du banc (il n'attend pas
que l'état restauré soit peint), pas du produit.

**Erreur de méthode à ne pas refaire.** J'ai annoncé à l'utilisateur que le résultat était « stable à
31/33, donc ce ne sont pas deux échecs aléatoires mais deux vrais ». Je n'avais que DEUX lancements
identiques consécutifs. Deux tirages égaux ne prouvent rien sur une loi bruitée : l'échantillonnage
suivant a donné 29 puis 33. La régression que je croyais tenir n'a jamais été établie.

Ce qui a été VRAIMENT établi, et qui reste vrai : la régression du verrou de doigté causée par le
déplacement de `.viz-toggle` hors de `.chord-header-row` (garde `inEditor`), mesurée avec
`guitar_lock_test.js` — 7/7 sur `120c3f5`, 2/7 sur `ce28351`, 7/7 après `baf09ca`. Ce banc-là est
déterministe ; c'est lui qu'il faut utiliser pour juger le cadenas, pas `glock_full_real_ui`.

À faire un jour : soit fiabiliser `glock_full_real_ui_test.js` (attendre un état observable après
`reload()` plutôt qu'un délai fixe), soit le mettre en quarantaine pour qu'il cesse de polluer les
balayages.

## 13. Tour du séquenceur du 14/08 — deux bancs périmés, et le vrai défaut qu'ils cachaient

`seq_voicedrag_test.js` échoue (FAIL + FATAL « Cannot read properties of null »), à l'identique sur
`a25163a` : antérieur au travail du jour. La cause est DANS le banc : son montage n'efface que la
voix 0 (`for s: applySeqCell(0, s, false)`) et laisse les voix 1 à 3 tenues sur les 16 croches. Il
déplace ensuite une note sur la voix 2... déjà pleine, donc l'assertion ne peut RIEN observer, et
l'étape « COPY » qui suit cherche une note à une position que la précédente n'a jamais créée — d'où
le FATAL. À corriger en vidant TOUTES les voix au montage (voir diag_vdrag_compact.js, qui fait
exactement cela et passe).

`seq_vscroll_and_cancel_test.js` : 5 PASS / 3 FAIL, également identiques sur `a25163a`. Les trois
assertions rouges portent sur le défilement vertical de secours, y compris « un glissé vertical à
1 doigt sur une case VIDE fait défiler », qui est pourtant le comportement en place. Le banc mesure
donc probablement le scrollTop du mauvais élément. Il ne peut PAS servir d'arbitre sur cette
fonctionnalité tant qu'il n'est pas réparé — c'est important, parce qu'il contient l'assertion
« un glissé vertical démarré sur le BORD d'une note fait aussi défiler », qui contredit en apparence
le correctif décrit ci-dessous alors qu'elle échouait déjà avant lui.

LE VRAI DÉFAUT, trouvé en cherchant pourquoi ces bancs étaient rouges : une note d'UNE ou DEUX
doubles croches n'a que des bords (isStartEdge/isEndEdge), donc `d.resize` y est vrai partout ; or le
défilement vertical de secours était conditionné par `(d.resize || !d.wasOn)` et passe AVANT
l'arbitrage du geste. Conséquence mesurée : une note courte ne pouvait JAMAIS être glissée sur une
autre hauteur — le glissé partait systématiquement en défilement —, alors qu'une note de trois
croches ou plus le pouvait depuis son milieu. Condition ramenée à `!d.wasOn`, c'est-à-dire la règle
que le commentaire du bloc énonçait déjà. Vérifié à la main dans les DEUX vues (continue et compacte,
voir diag_vdrag.js / diag_vdrag_compact.js) : la note de deux croches passe bien de la voix 0 à la
voix 2. Contrepartie assumée : on ne fait plus défiler la vue en tirant depuis le bord d'une note —
il reste la molette, la barre de défilement et les cases vides.

## 14. Zoom vertical refait — un banc mis à jour, et deux pièges d'outillage à ne pas refaire

`zoom_coherence_test.js` décrivait l'ANCIEN contrat de l'axe vertical du séquenceur compact : V+ devait
agrandir les lignes, plancher à 0,7. Le zoom vertical agit désormais sur la DENSITÉ (hauteur de ligne
= 14px x échelle, 14px étant un plafond) et non plus sur la hauteur du volet. Le banc a donc été mis à
jour, pas contourné : il éprouve maintenant V− (les lignes s'affinent), vérifie que V+ est grisé à
100 %, et attend 80 % dans l'infobulle après un cran de dézoom. 18 PASS / 2 FAIL — les deux restants
sont les groupes « grid/x » et « grid/y » d'une vue supprimée depuis longtemps (voir §11).

DEUX PIÈGES D'OUTILLAGE, tombés dedans le même jour, même cause : `pgrep -f` / `pkill -f` comparent le
motif à la LIGNE DE COMMANDE ENTIÈRE, y compris celle du shell qui exécute la recherche et celle des
scripts de lot dont le texte contient les noms de suites.
  - `pkill -f "live_seq_update_test.js"` a tué mon propre lot de tests (son `run_*.sh` cite ce nom
    dans sa liste), puis un `pkill` voisin a emporté le serveur HTTP local — d'où des suites qui
    échouaient ensuite sur une page qui ne chargeait plus (même symptôme qu'en §10).
  - `pgrep -f "node probe_defilement"` renvoyait toujours un PID... le mien. J'en ai conclu à tort
    qu'une suite était bloquée, et je l'ai annoncée « non rejouée » à l'utilisateur alors qu'elle
    n'avait jamais planté.
Bonne méthode : arrêter un lot par son identifiant de tâche (TaskStop), pas par `pkill` ; et si l'on
doit vraiment filtrer des processus, exclure explicitement le sien (`pgrep -f motif | grep -v $$`) ou
viser le PID.

À RETENIR SUR LES DÉLAIS : dans cet environnement, un `page.goto` + `reload` coûte ~26s à lui seul.
`probe_defilement_tactile_test.js` en fait deux (ordinateur puis téléphone) plus une série de gestes :
elle a besoin de plus de 175s. Un `timeout` trop court la fait passer pour bloquée. Elle rend 23/23.

## 15. Le 14/08 (suite) — la garde `inEditor` a laissé échapper QUATRE contrôles de plus

Retour utilisateur : « des fois le séquenceur saute et redevient un séquenceur sommaire ». La vue
continue exige `editingIndex != null` (voir `continuous` dans renderSequencer) : tout ce qui fait
sortir du mode Modification la fait donc retomber en vue sommaire. Les fuites trouvées :
la poignée du volet (#seq-dock-resize), les six groupes d'échelle (.zoom-axis-group), #toggle-sidebar,
#toggle-voice-leading, le bouton d'aide de l'ajout rapide, et surtout LE TRANSPORT.

LE TRANSPORT EXPLIQUE LE « DES FOIS ». placeGlobalTransport le déménage : .col-left quand le panneau
de gauche est ouvert, .col-right quand il est replié. Ouvert, .col-left le couvrait et tout allait
bien ; replié, cliquer Lecture sortait de la modification. Le défaut dépendait donc d'un réglage
d'affichage sans rapport apparent — d'où l'intermittence, et d'où l'impossibilité de le reproduire
« à volonté » tant qu'on ne pensait pas à replier le panneau.

Nouveau banc : `sortie_edition_involontaire_test.js`. Il ne vérifie AUCUNE liste de contrôles connus :
il balaie tout ce qui est cliquable et visible pendant une modification. C'est ce qui a permis d'en
trouver quatre d'un coup au lieu d'attendre le prochain signalement.

DEUX VERSIONS DE CE BANC ONT DÛ ÊTRE JETÉES AVANT D'ÊTRE CRUES, et c'est le plus instructif :
  1. La première fabriquait ses évènements (`new PointerEvent('pointerdown')` puis `.click()`).
     Verdict : six fautifs. Un vrai `page.click()` en donnait trois de moins.
  2. La seconde faisait de vrais clics mais réutilisait la MÊME PAGE d'un contrôle au suivant. Or le
     premier fautif rencontré (#toggle-sidebar) repliait le panneau — et le repli est mémorisé dans
     localStorage. Tous les verdicts suivants étaient donc rendus dans un état contaminé, ce qui
     accusait #play-prog, #stop et #toggle-loop-section, parfaitement sains sur une page neuve.
Deux de mes propres sondes se sont ainsi contredites sur le même bouton. La règle à retenir : quand
deux mesures divergent, ce n'est pas « l'une des deux est bruitée », c'est qu'elles ne mesurent pas la
même chose — et l'écart lui-même est l'indice. Ici il désignait le repli du panneau, c'est-à-dire la
cause du bug signalé par l'utilisateur. Le banc recharge désormais la page dès qu'un contrôle a cassé
l'état.

Enfin, sur le zoom vertical : la hauteur de barre est FIXE (14px) et le doit rester (« laisser une
unique hauteur de barres », puis « les barres sont à nouveau avec une hauteur variable » quand une
tentative l'a enfreint). Le seul levier pour voir plus de notes est donc la hauteur de la fenêtre, et
c'est V− qui l'agrandit — sens inversé par rapport à un zoom ordinaire, assumé et commenté dans
hauteurVoletSequenceur. zoom_coherence_test.js a été mis à jour en conséquence.

## 8. Gestes tactiles du séquenceur — un vrai défaut, et cinq bancs qui mesuraient mal

Signalé après une campagne complète : quatre bancs de gestes étaient rouges alors que la section 3
ci-dessus les donnait verts. Un seul décrivait un VRAI défaut ; les quatre autres se trompaient de
mesure, chacun à sa façon. Le tri a demandé d'instrumenter l'appli plutôt que de relire les bancs.

### Le vrai défaut : deux doigts se battaient contre eux-mêmes

Deux doigts faisaient à la fois DÉFILER (`pan`) et ZOOMER. À chaque `pointermove`, le cran de zoom
appelait `_appliquerEchelleHorizontale`, dont le recentrage sur l'accord édité réécrivait `scrollLeft`
JUSTE AVANT que le pan n'ajoute son pas. Relevé en traçant les écritures de `scrollLeft` : la valeur
oscillait entre deux positions fixes (20, 59, 25, 59, 25...) au lieu d'avancer. Le geste était donc
inutilisable, ce qui explique le « je ne les avais peut-être pas bien utilisés » de l'utilisateur.

Correctif, et c'est un choix de conception autant qu'une réparation :
- **Le pan à deux doigts est retiré.** Le défilement à UN doigt est déjà natif (`touch-action: pan-x
  pan-y`) — mesuré avec de vrais évènements tactiles (CDP `Input.dispatchTouchEvent`) : la bande
  défile, le motif ne bouge pas. Une émulation JS ne pouvait qu'être moins bonne (ni inertie, ni
  rebond). Et deux doigts qui glissent ensemble changent toujours un peu leur écart : « défiler » et
  « zoomer » n'étaient pas départageables. Deux doigts = zoom, un doigt = défilement. Un sens par geste.
- **Le zoom au pincement est désormais ANCRÉ sous les doigts** (`_ancrageZoomH`), comme toute carte ou
  photo : le point visé au début du geste reste sous le même endroit de l'écran. Le recentrage sur
  l'accord édité reste le bon comportement pour les boutons +/−, et lui seul.

`seq_twofinger_pan_test.js` devient `seq_twofinger_zoom_test.js` (nouveau contrat, éprouvé avec de
VRAIS évènements tactiles) ; `seq_twofinger_jitter_test.js` est supprimé — il n'éprouvait que le
calcul de delta par doigt du pan, qui n'existe plus.

### Quatre bancs qui mesuraient autre chose que ce qu'ils annonçaient

- **`seq_repere_glisse_test` (0/9)** — amenait la bande à l'écran verticalement, jamais
  HORIZONTALEMENT. Or elle est déjà défilée sur l'accord édité : la case visée sortait du cadre
  (x≈11px), le clic partait à côté, `seqDrag` restait `null` et les neuf contrôles tombaient. À
  `scrollLeft = 0` : 9/9, le repère affiche bien « G3 » et le son part. Le geste n'a jamais été cassé.
- **`seq_vscroll_and_cancel_test`** — exigeait un défilement ÉMULÉ EN JS qui n'existe plus au doigt
  (la bascule est gardée par `d.pointerType !== 'touch'`, elle ne sert qu'à la souris). On vérifie
  maintenant le MÉCANISME (`touch-action` laisse passer l'axe vertical) et le fait que l'appli ne
  s'empare pas du geste. Son dernier contrôle exigeait qu'un glissé vertical immédiat change la voix :
  c'est précisément ce que le partage par la DURÉE de l'appui a retiré, et pour la raison écrite dans
  `script.js` (« à chaque fois que je veux scroller, je crée une note non voulue »). Il éprouve
  désormais LES DEUX moitiés — sans appui long, pas d'édition ; après appui long, édition.
- **`probe_defilement_tactile_test`** — deux erreurs cumulées. (1) Il relevait l'empreinte du motif
  AVANT un `touchscreen.tap` sur la case testée : ce tap pose une note, exactement comme il le doit,
  et le banc l'imputait ensuite au GLISSÉ — il accusait donc l'appli du reproche d'origine pour un
  geste qu'il avait lui-même produit. (2) Son `glisser` émettait chaque évènement par un
  `page.evaluate` séparé : chaque aller-retour CDP coûtant plus que les 260 ms de
  `SEQ_APPUI_LONG_MS`, le geste « immédiat » déclenchait en réalité l'appui long. 24/24 une fois les
  deux corrigés.
- **`probe_defilement_tactile_test`, point 5** — visait « la première case venue », qui depuis
  l'affichage de tout l'ambitus chromatique est presque toujours une case LIBRE (`data-voice="-1"`,
  la voix n'existe pas encore). On y ajoute une note d'un CLIC, on n'y peint pas au glissé : aucun
  glissé d'édition ne s'y ouvre, et c'est voulu. Le banc en concluait que « la souris attendait ».
  Il vise désormais une case de voix réelle (`caseVoixReelle`).

La leçon est la même qu'en section 3, et vaut d'être répétée : **un banc rouge n'est une accusation
recevable que si l'on a vérifié qu'il mesure bien ce qu'il prétend.** Ici, quatre bancs sur cinq
visaient à côté — et le cinquième, lui, décrivait un défaut réel que personne n'avait su nommer.

## 9. Une bande morte de 4px entre les cases du petit séquenceur

Trouvée en rebranchant un bloc de banc qui ne s'exécutait plus.

`avant_seq_short_note_body_test` annonce éprouver TROIS vues. Sa troisième cherchait le séquenceur
dans `#grid-zoom-pinned-body` — l'hôte de la vue plein écran de la grille, supprimée depuis au profit
du volet ancré (`#seq-dock-host`). La vérification échouait donc, et tout le bloc était sauté par un
`if (epingle) { ... }` : **une vue entière n'était plus testée, sans que rien ne l'annonce**. Un banc
qui renonce en silence est pire qu'un banc rouge — il compte comme une couverture qu'on n'a pas.

Une fois la vue rebranchée, un VRAI défaut est apparu, et il touchait en réalité la vue COMPACTE :

`.seq-cell-b { margin-right: 4px }` creusait l'écart visuel entre deux paires de doubles croches. Une
marge, cependant, RETIRE ces 4px de l'élément : il restait une bande morte où `elementFromPoint`
renvoyait `.seq-grid` et où aucun geste ne démarrait. Conséquence concrète, mesurée : viser le corps
d'une note de 2 croches pour la DÉPLACER tombait une fois sur deux dans ce trou — précisément le geste
que ce fichier de bancs a été écrit pour garantir.

Le même défaut avait déjà été trouvé et corrigé pour la vue continue (`.seq-grid-continuous .seq-cell
{ margin-right: 0 }`), avec ce constat en commentaire : « sur téléphone, une case sur sept qui ne
réagit pas ressemble beaucoup à *c'est aléatoire* ». Il n'avait pas été reporté sur la vue compacte
parce que là, contrairement à la vue continue, l'écart SE VOIT (les cases y ont un fond) et sert
vraiment à séparer les paires.

Correctif qui garde les deux : l'écart passe de `margin-right` à `border-right: 4px solid transparent`
+ `background-clip: padding-box`. La case garde toute sa largeur cliquable, son fond s'arrête 4px
avant. Vérifié : géométrie des notes inchangée au pixel (aucun décalage de mise en page), écart visuel
identique à l'écran, et `elementFromPoint` renvoie désormais la case sur toute la largeur.

Bilan du fichier : **35 PASS / 7 FAIL → 56 PASS / 0 FAIL**, une vue de plus réellement couverte.

## 10. Deux garde-fous pour que ça ne recommence pas

Les sections 8 et 9 ont un point commun qui compte plus que les défauts eux-mêmes : **rien, dans
l'outillage, ne signalait qu'un banc avait cessé de couvrir ce qu'il annonçait.** Il a fallu qu'un
humain relise. Deux mécanismes le disent désormais tout seuls.

### `tests/_harness.js` — un banc ne peut plus mentir sur sa couverture

Chaque banc comptait ses PASS/FAIL localement. Ce compteur mesure ce qui S'EST EXÉCUTÉ, jamais ce qui
AURAIT DÛ l'être : un banc qui perd la moitié de ses vérifications affiche « 12 PASS / 0 FAIL » et
paraît en MEILLEURE santé qu'avant. Le harnais ajoute :

- **`plan(n)`** — le banc déclare son nombre MINIMUM de vérifications. Si la campagne s'arrête avant,
  échec explicite : « COUVERTURE INCOMPLÈTE : 45 attendues, 12 exécutées ». C'est le mécanisme `plan`
  de TAP. Un PLANCHER et non un compte exact : certains bancs font légitimement varier leur nombre de
  vérifications selon la géométrie mesurée, et un compte exact y produirait de faux rouges.
- **`exiger(cond, libellé)`** — une précondition dont dépend la suite. Elle échoue BRUYAMMENT au lieu
  de faire sauter un bloc en silence, et le bilan rappelle laquelle a lâché. À utiliser partout où
  l'on écrivait `if (condition) { ...vérifications... }`.
- **un filet de sortie de processus** — un banc qui MEURT en route (exception, timeout Playwright)
  n'atteint jamais son bilan. Le harnais rend compte quand même, à la sortie du processus.

Éprouvé sur le cas réel : en remettant l'adresse morte dans `avant_seq_short_note_body_test`, le banc
passe de « 56 PASS / 0 FAIL » à « 43 PASS / 2 FAIL » avec le motif exact. Avant, la même perte ne
produisait aucun signal distinctif.

### `tests/meta_suite_test.js` — un cliquet sur la dette

Analyse statique de la suite (aucun navigateur, quelques secondes), qui relève cinq choses : méthodes
appelées mais absentes de `script.js`, identifiants DOM introuvables, erreurs d'interaction avalées
par `.catch(() => {})`, bancs sans `plan()`, vérifications enfermées dans un `if`.

État figé dans `meta_suite_reference.json` :

| Ce qui est relevé | Fichiers | Occurrences |
|---|---|---|
| Méthodes appelées mais disparues | 23 | 34 |
| Identifiants DOM introuvables | 36 | 68 |
| Erreurs d'interaction avalées | 25 | 55 |
| Vérifications sous condition | 14 | 18 |
| Bancs sans `plan()` | 154 | — |

**Le banc n'échoue que si la dette AUGMENTE.** Interdire tout net aurait fait échouer la campagne
entière, et le garde-fou aurait été désactivé le lendemain — le sort habituel des règles trop
ambitieuses. Ici la dette ne peut plus que décroître. Et quand elle décroît, le banc échoue aussi, en
demandant `node tests/meta_suite_test.js --maj` : sans ça la référence se périmerait, et un banc
réparé laisserait une place libre pour un banc cassé.

Vérifié dans les deux sens : ajouter un appel à `openGridZoom()` dans un banc sain le fait passer au
rouge en nommant le fichier et le symbole ; retirer un `.catch(() => {})` le fait rouge aussi, en
réclamant la mise à jour de la référence.

### Ce qui reste

Les 35 bancs qui visent la vue plein écran supprimée ne sont PAS réparés — ils sont désormais
seulement inventoriés et empêchés de se multiplier. Leur reprise (recibler ou supprimer, un jugement
par fichier) est le chantier suivant. La règle à tenir : un recibleage n'est acquis que s'il exerce
RÉELLEMENT la fonctionnalité. La preuve que ça vaut le coup : recibler cette vue-là a fait apparaître
un vrai défaut d'application au lieu de le masquer (§9).

## 11. Reprise des 30 bancs de la vue plein écran — le chantier annoncé en §10

Le §10 laissait 35 bancs inventoriés mais non réparés, en posant la règle : « un reciblage n'est
acquis que s'il exerce RÉELLEMENT la fonctionnalité ». Ce chantier est terminé. Répartis en quatre
familles, traités fichier par fichier, jamais en remplacement de masse — et la règle a payé.

### Ce que la campagne a fait remonter

**Trois défauts d'application**, tous invisibles jusque-là parce que le banc qui les couvrait mourait
avant sa première assertion :

1. **Le volet du séquenceur s'ouvrait sur du vide.** Avant sa suppression, la vue plein écran
   chargeait l'accord SÉLECTIONNÉ à l'ouverture — ajouté à l'époque sur retour utilisateur explicite
   (« la loupe s'ouvrait sans rien montrer, obligeant à recliquer l'accord une seconde fois »). Le
   volet reprend son rôle mais pas ce comportement : mesuré, il s'ouvrait sur 4 repères de temps et
   zéro zone de navigation. Réparé dans `toggleSequencer`.
2. **Le zoom vertical de la vue agrandie ne faisait rien.** V+/V− montaient `seqZoomLevelY` jusqu'à
   1,95 et posaient la variable CSS, sans qu'une seule ligne ne bouge : `.seq-zoomed .seq-cell` et
   `.seq-grid-continuous .seq-cell` ont la même spécificité (0,2,0), et c'est le `14px` nu, plus bas
   dans la feuille, qui l'emportait par simple ordre de déclaration. Le voisin immédiat trahissait
   l'oubli — la `line-height` du même libellé multipliait DÉJÀ ses 14px par cette variable.
3. **Du style et des commentaires morts** : trente lignes habillant une pastille octave que plus
   aucun code ne crée, et deux commentaires la décrivant comme présente.

**Sept fichiers qui n'étaient pas des bancs.** `continuous_scroll`, `highlight_diagnostic`,
`classic_grid_zoom`, `song_zoom_persist`, `zoom`, `loop_range_buttons`, `three_more_features`,
`items2345`, `three_fixes`, `pdf_fixed_scale` : des `console.log('PASS ...')` sans compteur, un
`process.exit(0)` final, et pas de ligne de bilan — donc rangés parmi les « CRASH » par `run_all.sh`
quel qu'ait été le résultat. Un échec y était invisible deux fois. Tous convertis en vraies
vérifications comptées.

**Quatre attentes fausses, corrigées et non contournées** — chacune exigeait le contraire d'une
décision prise sur retour utilisateur :

| Banc | Exigeait | Or la décision était |
|---|---|---|
| `pdf_fixed_scale` | « 4 » et « 7 » en fin de ligne | « il devrait y avoir 5 et 9 en fin de lignes » |
| `three_more_features` | « compact = pas collant » | collant dès que la vue DÉFILE, y compris un accord compact trop long |
| `probe_seq_adaptatif` | les 60 lignes chromatiques tiennent | plafond à 700px, « au-delà, le volet mangerait la grille » |
| `loupe_zoom_gestures` | Ctrl+molette zoome les 2 axes | « laisser une unique hauteur de barres », plus de zoom vertical dans le volet |

### Ce qui a été supprimé plutôt que rebranché

Cinq bancs, chaque fois parce que leur sujet a été retiré VOLONTAIREMENT et que son absence est déjà
affirmée ailleurs : `loupe_fullscreen`, `edge_alignment`, `seq_toolbar_wrap`, `pinned_seq_zoom`, et la
section « loupe grille » de `grid_beat_highlight` (qui refaisait mot pour mot les deux vérifications
de sa section 1, la grille ne déménageant plus). Deux sujets survivants ont été absorbés ailleurs
plutôt que perdus : l'alignement des boîtes de la barre de grille dans
`entete_grille_debordement_test`, la tenue de la rangée de boutons à 390px dans
`pinned_seq_toolbar_test`.

### État du cliquet

| Ce qui est relevé | Avant | Après |
|---|---|---|
| Méthodes appelées mais disparues | 23 fichiers | 9 |
| Identifiants DOM introuvables | 36 fichiers | 11 |
| Vérifications sous condition | 14 fichiers | 12 |
| Bancs sans `plan()` | 154 | 128 |

Les identifiants encore relevés dans `global_transport` et `three_fixes` sont cités À DESSEIN, pour
affirmer une absence (`!document.getElementById('quick-library-export')`) : le cliquet les compte, et
c'est correct — il mesure des citations, pas des fautes.

Le garde-fou s'est aussi retourné contre son auteur, ce qui est exactement ce qu'on lui demande : il a
signalé `_pdfDialogCancel` comme « appelé mais absent » au moment où je l'introduisais. C'était un
faux positif (une propriété recevant une fonction, `this._pdfDialogCancel = fermer`), corrigé dans le
détecteur — un outil qui traque les faux positifs ne peut pas se permettre d'en produire.

---

## Lot 0 : le filet posé avant la refonte de l'interface

La refonte remplace le volet de gauche toujours ouvert par un inspecteur contextuel, et sort le petit
séquenceur du flux de la page pour en faire un panneau volant. Trois bancs ont été écrits AVANT d'y
toucher, et vérifiés verts sur le code d'alors — ils ne décrivent aucune nouveauté, seulement ce qui
doit rester vrai après.

| Banc | Ce qu'il fige | Vérifications |
|---|---|---|
| `filet_toujours_visible_test` | nom du morceau, tonalité, tempo, fichiers, enregistrer, import, export — visibles ET cliquables, sans rien déplier, dans les quatre situations (ordinateur/téléphone × Ajout/Modification) | 33 |
| `filet_moteur_edition_test` | les dix réglages qui font un accord s'écrivent en direct dans la donnée et se reprennent au Ctrl+Z ; Entrée ajoute en mode Ajout et n'ajoute rien en Modification ; l'intensité s'applique à une sélection multiple | 28 |
| `filet_sequenceur_et_sortie_test` | clic-puis-glissé pose une note (et un clic seul n'en pose aucune), Ctrl+Z reprend, Espace reste la lecture, conduite de voix et séquenceur s'excluent, ce qui sort du mode Modification et ce qui n'en sort pas, défilement au doigt depuis le séquenceur | 24 |

### Deux couches qui ne vieillissent pas pareil

C'est le point de méthode de tout le filet, et il vaut au-delà de cette refonte :

- **Couche moteur** — on écrit dans le champ source et on émet l'évènement, sans cliquer sur aucun
  widget. Aucune adresse d'écran n'y apparaît, donc rien à réadapter d'un lot à l'autre. Elle répond
  à « la donnée suit-elle encore ? »
- **Couche câblage** — de vrais clics sur de vrais widgets. Elle doit être ADAPTÉE lot par lot,
  jamais supprimée : c'est la seule qui prouve que la commande visible touche bien le moteur.

Un filet qui ne ferait que la première laisserait passer un inspecteur entièrement débranché ; un
filet qui ne ferait que la seconde rougirait à chaque changement de maquette sans rien dire du fond.

### Ce que l'écriture du filet a appris sur le code existant

Quatre mesures faites en écrivant ces bancs, toutes contraires à ce qu'on aurait supposé :

1. **En mode Modification, les commandes de voicing ne sont pas à l'écran.** `inversion`, `drop`,
   `octave` et `bass` vivent dans un bloc replié `#advanced-fields` ; `duration` et `playStyle` sont
   carrément en `display:none`. Seuls l'instrument et l'intensité s'offrent directement. C'est
   littéralement la plainte à l'origine de la refonte : « je veux pouvoir rapidement changer une
   octave, un renversement etc... Sans avoir à ouvrir trop de menus ».
2. **Poser une note est un clic-PUIS-GLISSÉ, y compris sur les lignes de voix.** Un clic seul ne
   crée rien. Le banc a d'abord échoué en cliquant, ce qui a permis de figer les DEUX moitiés de la
   règle plutôt que la seule qu'on avait en tête.
3. **Cliquer une note existante la sélectionne**, elle ne s'efface pas — et avec le style « tenu »
   les 64 cases sont allumées, donc aucune case libre où poser quoi que ce soit. Les bancs sèment
   désormais un style détaché.
4. **`#playStyle` est déjà un `<select hidden>`.** La stratégie retenue pour la refonte — garder les
   champs actuels comme source de vérité cachée, et brancher les nouvelles commandes dessus — a donc
   déjà un précédent dans le code.

### Un faux vert attrapé au passage

Le banc du moteur a d'abord semé `playStyle = 'arpUp'`, une valeur qui n'existe pas dans les options
(elles sont des LONGUEURS de note, pas des arpèges). Un `<select>` à qui l'on donne une valeur
inconnue se met sur la chaîne vide **sans rien dire** : le banc constatait bien un changement
(« held » → «  ») et passait au vert en n'éprouvant plus rien. Une garde a été ajoutée — on relit
`el.value` après l'écriture et on refuse de conclure si le champ n'a pas accepté la valeur.

### Un piège annoncé qui n'en est pas un

En listant les pièges avant les travaux, j'avais écrit que « 71 règles CSS `order:` dépendent du
`display: contents` » du volet, ce qui en faisait le risque le plus lourd de la refonte. C'était un
mauvais comptage : le motif attrapait aussi `border:`. Il y a **quatorze** règles `order:` en tout,
dont cinq dans la seule mise en page téléphone, et `display: contents` n'apparaît qu'à quatre
endroits (`.col-left`/`.col-right`, `.sidebar-frame`, et l'en-tête de la grille sur téléphone). Le
risque reste réel — aplatir une boîte change l'ordre de ses enfants — mais il est de l'ordre d'une
poignée de règles à relire, pas d'une réécriture de la mise en page.

### Ligne de base des bancs rouges AVANT les travaux

Neuf bancs étaient déjà rouges sur le code d'avant la refonte. Ils sont notés ici pour qu'on ne les
prenne pas plus tard pour des dégâts de la refonte :

`avant_seq_snap_sticky` (cherche un sélecteur d'aimantation retiré depuis), `paroles_fixes` (dépasse
le temps imparti), `probe_clic_accord_voisin` (4/8), `probe_defilement_tactile` (23/24),
`probe_regle_voisins` (28/29), `probe_seq_finitions` (18/19 — attend une opacité volontairement
relevée depuis), `real_click_loupe_selection` (3/4), `seq_notes_libres_clavier` (32/33),
`seq_selection_et_cadre_diagrammes` (21/22 — débordement du diagramme guitare sous 300px).

`glock_full_real_ui` figurait aussi dans cette liste au premier passage : c'était le serveur de test
mono-thread qui se bloquait, pas le banc. Relancé avec un serveur multi-thread, il est vert (33/0).

---

## Lot 1 : sur téléphone, la grille remonte de 31px

Mesure d'avant-travaux sur iPhone 13 (390x664) : la grille d'accords commençait à **376px** du haut,
soit 57 % de l'écran passé avant d'apercevoir le premier accord. Après le lot : **345px**.
Retour utilisateur à l'origine : « Sur téléphone, il est également mal placé au-dessus des accords. »

**Une première version gagnait 57px, et elle a été annulée.** Elle resserrait aussi la carte Morceau
(titre « Morceau » masqué, nom remonté en première ligne, boutons dessous). Retour utilisateur : « Je
ne voyais pas de problème avant pour l'affichage du morceau, je préférais avoir les logos au niveau du
titre "morceau", c'était plus harmonieux. » La carte est donc rendue intacte, et le banc éprouve
désormais qu'elle le RESTE : titre visible, boutons sur sa ligne. Seul le titre « Grille d'accords »,
hors de la carte, est masqué.

### La solution évidente a été mesurée, puis écartée

Poser le nom du morceau sur la même ligne que les six boutons descend la grille à 310px — neuf pixels
de mieux. Elle a été abandonnée sur mesure : il ne reste alors que ~95px utiles au champ, et
« Ballade en Do mineur » (115px) y est déjà tronqué ; « Improvisation du dimanche matin » n'en montre
qu'un tiers. Or le nom du morceau fait partie de ce qui doit toujours rester lisible.

Réduire le nombre de boutons a été envisagé puis écarté aussi, après vérification dans le code :
« Renommer » existe bien ailleurs (fenêtre Fichiers, plus le double-tap sur le nom), mais **« Nouveau
morceau » n'existe nulle part ailleurs** — le retirer du téléphone y rendrait la création d'un morceau
impossible.

Conclusion mesurée : à 390px de large, six boutons de 32px plus un nom lisible ne tiennent pas sur une
ligne. La hauteur devait donc venir d'ailleurs — des deux titres redondants (« Morceau » au-dessus
d'un menu qui affiche déjà le nom, « Grille d'accords » au-dessus de la grille) et des 60px de
remplissage d'une carte qui n'avait que 106px de contenu.

Le titre de la grille est **masqué à l'œil, pas retiré** : il reste dans l'arbre d'accessibilité. Le
banc `mobile_grille_plus_haut_test` (12 vérifications) éprouve le gain ET les trois contreparties
refusées — carte Morceau intacte, nom ordinaire entièrement lisible, titre toujours annonçable —
précisément parce que les solutions écartées gagnent PLUS de place et donneront envie d'y revenir.

### Troisième recalibrage de `mobile_edit_scroll_test`, et sa vraie cause

Ce banc cherche à chaque exécution un point « ailleurs » hors de la zone d'édition, justement pour
survivre aux changements de mise en page — deux recalibrages précédents l'avaient appris. Il est
pourtant retombé, et pour une raison nouvelle : il calibrait le point de DÉPART du geste, jamais son
point d'ARRIVÉE. Le clic-fantôme du faux défilement tombe à `y - 80`, une ordonnée que rien ne
vérifiait.

Les 57px gagnés par le lot ont suffi pour que ce `y - 80` atterrisse pile sur le bouton « Mes
morceaux ». Le faux défilement OUVRAIT donc la fenêtre Fichiers, et les six vérifications suivantes se
mesuraient à travers une fenêtre modale posée par accident. L'application faisait exactement ce qu'il
fallait : un clic sur une fenêtre modale ne doit pas sortir du mode Modification.

Vérifié avant de conclure, plutôt que supposé : le banc a été relancé sur le CSS d'AVANT le lot, où il
repasse au vert (11/0) avec un point calibré à y=256 au lieu de y=200. C'est bien le déplacement qui
révèle le défaut du banc, et non le lot qui casse l'application.

Le banc exige désormais que **tous** les points qu'il touche — le départ et les deux arrivées (-80 et
+3) — soient hors de la zone d'édition.

---

## Lot 2 : les réglages du morceau deviennent un panneau flottant

Mesure qui a décidé du lot, sur iPhone 13 (390x664) : ouvrir les réglages (tempo, groove, mesure,
tonalité) repoussait la grille d'accords de 345px à **703px**, c'est-à-dire hors d'un écran de 664px.
Il ne restait plus **un seul accord en vue** pendant qu'on cherchait son tempo — alors que chercher un
tempo se fait en regardant et en écoutant sa grille. Sur ordinateur, le coût était nul (le volet
défile pour lui-même) mais le bloc y occupait 314px de colonne. Après le lot : la grille ne bouge plus
d'un pixel, sur les deux formats.

Le panneau rejoint la table `this._popups` : une ligne, et il hérite des deux façons de renoncer (clic
à côté, Échap). C'est tout l'intérêt de cette table. Le futur panneau du séquenceur, lui, n'y entrera
PAS — on veut pouvoir cliquer la grille sans le refermer.

### Le placement « sous l'ancre » était faux, et c'est un banc qui l'a dit

Poser un popover sous le bouton qui l'ouvre est le réflexe. À la mesure, sur grand écran, il
recouvrait **96 % de la carte de l'accord en cours d'édition** — juste en dessous de lui dans le
volet. Or « on peut régler le tempo sans perdre de vue l'accord qu'on est en train d'éditer » est un
acquis explicite, antérieur à ce lot (voir `toggleSongSettings`). L'œil ne l'avait pas vu sur la
capture ; `song_panel_test` l'a rattrapé.

La règle est désormais mesurée à chaque ouverture : **à côté quand il y a la place, en dessous
sinon**. Y a-t-il assez de largeur à droite de la carte Morceau pour poser le panneau en entier ? Sur
ordinateur oui — il se range à côté du volet, sur la grille. Sur téléphone la carte occupe toute la
largeur, la réponse est non, et on retombe sur le placement vertical, où le chevauchement ne se
produit pas (la carte de l'accord y est bien plus bas).

### Trois défauts de bancs corrigés au passage, dont deux à moi

1. **Mon propre banc criait au loup.** Sa vérification « le panneau ne recouvre pas la ligne de
   résumé » ne comparait que les bandes VERTICALES. Elle suffisait tant que le panneau se posait sous
   son ancre ; elle est devenue fausse dès qu'il s'est rangé à côté — mêmes hauteurs, mais 400px de
   distance horizontale. C'est maintenant un vrai croisement de rectangles, sur les deux axes.
2. **Un montage qui basculait un interrupteur à l'aveugle.** `song_panel_test` faisait
   `page.click('#song-summary')` pour ouvrir le panneau — un clic qui BASCULE, donc n'ouvre que si le
   panneau était fermé. Il dépendait silencieusement de tout ce que le banc avait fait cent lignes
   plus haut, et une ouverture ajoutée dans une section précédente l'a transformé en fermeture. Il
   force désormais l'état voulu.
3. **Deux contrats délibérément changés, écrits comme tels plutôt que contournés.** L'état déplié
   n'est plus retenu d'un lancement à l'autre : cohérent pour un bloc docké, absurde pour un panneau
   flottant qui s'ouvrirait tout seul par-dessus la grille. Et « rien ne bouge les réglages du
   morceau » devient « aucun CHANGEMENT DE MODE ne les referme, mais un clic ailleurs si » — c'est le
   contrat d'un popover, et sans lui le panneau resterait posé sur la grille sans moyen évident de
   s'en défaire.

---

## Lot 3 : l'inspecteur dit de quoi il parle

Retour utilisateur : « Pas assez de différences pour l'ajout et la modification, je confonds les
volets et je ne sais pas en quel mode je suis. »

### La mesure, avant de dessiner quoi que ce soit

Comparaison champ par champ des deux états sur grand écran : ils partagent **exactement les mêmes
commandes** — mêmes deux grands menus (fondamentale et nature, 158x38 chacun), même instrument, même
curseur d'intensité, même bouton de séquenceur. Trois choses seulement diffèrent (la croix
« terminer » et la loupe « montrer dans la grille » apparaissent, le bloc Ajouter/À la suite s'en va),
et surtout : la seule différence VISUELLE était **la couleur d'une ligne de texte de 13px de haut**,
vert contre ambre, au sommet d'une carte de 106px. La confusion signalée n'avait rien d'étonnant.

Trois marqueurs coordonnés remplacent cette unique ligne — un liseré de 4px sur toute la hauteur des
**deux** cartes, une teinte de fond, et le titre transformé en pastille encadrée. Aucun mot de plus :
« Trop d'écriture dedans, ça ne rend pas joli ni pro » interdisait la solution facile.

La marque est portée par le SUJET (classe posée par `updateChordSubject`), pas par `data-app-mode` —
même raison que celle déjà consignée dans le code : le panneau peut annoncer « Nouvel accord » alors
que le mode d'interaction n'a pas encore changé.

### Un défaut réel, masqué par un effet de bord, trouvé par un banc

`exitEditMode()` ne remettait pas à jour le sujet annoncé. C'est pourtant, de son propre aveu, le seul
endroit qui remet `editingIndex` à null. Le défaut ne se voyait presque pas tant que la marque
n'était qu'une couleur de texte, et les appelants les plus courants (`cancelEdit`, le clic ailleurs)
enchaînent un `loadProgression()` qui rafraîchissait tout derrière eux. Les autres chemins
(suppression d'une partie, changement de morceau) n'ont pas cette chance. Corrigé à la source.

### La fausse bonne idée, écartée grâce au code lui-même

Sur téléphone, l'inspecteur reste à **76 % hors écran** après une sélection (sommet à 637px sur un
écran de 664px). Le réflexe est de le faire remonter à la vue — et c'est exactement ce que faisait
l'appli, avant que ce soit **retiré sur retour utilisateur** : « ça scrolle tout de suite en bas » en
Modification, sur téléphone, parce que la grille et l'inspecteur partagent le même flux de défilement
et que la page filait loin des accords à chaque accord touché (voir la fin de `editChord`).

Le banc `inspecteur_sujet_test` garde donc une vérification qui EXIGE que sélectionner un accord au
doigt ne fasse pas défiler la page d'un pixel. La prochaine personne tentée de « corriger » ce 76 %
hors écran se heurtera à un banc rouge et à cette explication, au lieu de rejouer un aller-retour déjà
arbitré.

### Cinq assertions adaptées, aucune supprimée

Le séparateur « · » du titre (« Modifier · Cm7 ») a disparu : la pastille encadrée sépare désormais
l'état du symbole mieux qu'un point ne le faisait. Les cinq vérifications qui comparaient ce texte
collé bout à bout comparent maintenant les deux morceaux séparément — ce qui dit mieux ce qu'elles
voulaient prouver depuis le début : un état nommé ET un sujet nommé.

---

## Lot 4 : octave, renversement et drop sous la main

Retour utilisateur : « Lorsque je suis en mode édition, je veux pouvoir rapidement changer une octave,
un renversement etc... Sans avoir à ouvrir trop de menus. »

Mesuré avant : ces trois réglages vivaient tous dans `#advanced-fields`, replié par défaut derrière le
bouton « … ». Monter d'une octave demandait d'ouvrir le bloc, dérouler une liste, choisir — pour un
réglage qu'on ajuste par tâtonnement, à l'oreille, dix fois de suite. Ils occupent désormais une
rangée de 321px sur 50px, visible sans rien ouvrir, dans les deux modes.

### La forme suit ce que le réglage EST

L'octave est une échelle ordonnée qu'on parcourt de proche en proche (« un peu plus grave ») : un
pas-à-pas `− 3 +` dit ça mieux que quatre cases. Le renversement et le drop sont des CHOIX parmi trois
ou quatre possibilités qu'on veut voir toutes à la fois, y compris celles qu'on n'a pas prises : des
segments. Pas d'uniformité pour l'uniformité.

### Le vrai gain sur les listes d'avant : le grisage

Les listes offraient les quatre renversements à TOUS les accords, y compris aux accords de trois notes
qui n'en ont que trois. Choisir « 3e renv. » sur une triade ne faisait alors rien de visible — la
valeur était ramenée en silence (`Math.min` dans `Chord.effectiveInversion`). Un segment grisé dit ce
que la liste taisait. Le banc l'éprouve sur les deux cas : triade et accord de quatre notes.

### Les segments sont CONSTRUITS à partir des `<option>`, jamais écrits en dur

Deux raisons, dont une apprise à mes dépens : ajouter un drop demain ne se fera qu'à un seul endroit ;
et j'avais proposé dans une maquette un « Drop 2+4 » qui n'existe pas, relevé par l'utilisateur (« ça
ne veut rien dire »). Une commande qui LIT la liste ne peut pas inventer d'option. Le banc compare le
nombre et les valeurs des segments à ceux des `<option>` — un retour au codage en dur le ferait rougir.

### Le piège repéré AVANT d'écrire les boutons

Le raccourci « Entrée depuis un réglage d'accord ajoute l'accord » se décidait sur l'IDENTIFIANT de
l'élément ayant le focus (`CHORD_PARAM_IDS`). Un `<button>` n'a pas l'identifiant d'un `<select>` : le
raccourci serait mort **en silence** dès qu'on aurait cliqué une des nouvelles commandes avant
d'appuyer sur Entrée — aucune erreur, aucun symptôme, juste une touche qui ne fait plus rien. Le test
lit désormais aussi `closest('[data-chord-param]')`, et le banc l'éprouve avec un vrai focus sur un
vrai bouton.

### Deux bancs adaptés — et c'est un progrès, pas une concession

`ajout_modif_test` et `voice_leading_test` pilotaient l'octave et le renversement par
`page.selectOption('#octave' | '#inversion')`. Ces listes existent toujours (elles restent la source
de vérité que lit `readChord`) mais sont masquées, et Playwright ne pilote pas un élément invisible.
Les deux bancs cliquent maintenant la commande VISIBLE : ils éprouvent donc le câblage complet là où
ils ne touchaient que le moteur.

### Une surprise consignée

`Ctrl+Z` fait **sortir du mode Modification** (`appMode` repasse à « add », `editingIndex` à null).
Comportement antérieur à ce lot, mais piégeant : la suite du banc s'exécutait en mode Ajout, où
`commitLiveEdit` ne fait rien — à juste titre — et deux vérifications rougissaient en accusant les
nouvelles commandes. Le banc revient explicitement en édition après chaque annulation.

---

## Lot 4 bis-A : Ctrl+Z suit la dernière action, plus la fenêtre ouverte

L'appli tient trois historiques séparés — la grille, le séquenceur, les fichiers — mais l'utilisateur
n'a qu'un seul Ctrl+Z. Il fallait décider lequel il vise, et c'était la FENÊTRE OUVERTE qui décidait :
séquenceur ouvert, Ctrl+Z allait au séquenceur, même si la dernière chose faite était de changer le
renversement de l'accord. D'où le signalement : « mon CTRL+Z ne garde pas toujours en mémoire TOUS mes
changements. C'est important. » Le défaut ne pouvait que s'aggraver avec le panneau de rythme volant,
qui reste ouvert pendant qu'on travaille la grille.

Un **journal chronologique** note, dans l'ordre, à laquelle des trois piles chaque action est allée.
Annuler dépile le journal et va chercher dans la pile qu'il désigne : une seule ligne du temps, sans
avoir à fusionner trois formats d'instantanés incompatibles.

**Une exception gardée à dessein** : la fenêtre Fichiers est MODALE. Sans garde, l'ouvrir puis appuyer
sur Ctrl+Z sans rien y avoir fait annulerait la dernière retouche d'accord *derrière* elle, donc
invisible. Le panneau de rythme, lui, n'est pas modal — c'est toute la différence.

### Le défaut classique de ce code, une fois de plus

Le raccourci clavier n'appelait pas `globalUndo()` : il **recopiait** la règle de routage en ligne. La
modification n'a donc touché que les BOUTONS de la barre du haut, le clavier continuant d'appliquer
l'ancienne règle. Exactement la dérive « deux listes jumelles » déjà corrigée douze fois pour la sortie
d'édition (voir `ZONE_EDITION_SELECTEURS`). Le banc l'a montré immédiatement — Ctrl+Z ne faisait plus
*rien du tout*, le séquenceur ouvert le détournant vers une pile vidée entre-temps. Une règle, un
endroit : le clavier et les boutons passent désormais tous deux par `globalUndo`/`globalRedo`.

### Trois exigences fausses, dans mon propre banc

Écrites avant d'avoir lu ce que le code garantissait vraiment. Corrigées en le lisant, pas en forçant
le code à leur obéir :

1. « Le Ctrl+Z suivant remonte au motif du séquenceur. » **Faux** : les sept réglages qui changent la
   FORME de l'accord appellent `clearSeqHistory()` — « l'historique portait sur une autre forme
   d'accord ». Un motif dessiné sur un accord de quatre notes n'a plus de sens sur trois. La
   vérification éprouve désormais que ce vidage a bien lieu, et que Ctrl+Z ne reste pas coincé dessus.
2. « Ctrl+Z ne touche pas au motif du séquenceur. » **Faux** : l'instantané de la grille photographie
   tout le morceau, motif compris, et `commitLiveEdit` n'en prend qu'un seul par session d'édition —
   voulu, et déjà éprouvé ailleurs (« un seul Ctrl+Z annule toute la session d'édition »).
3. Une vérification de rétablissement qui repartait de l'état laissé par la famille précédente : un
   « rien n'a changé » y passait pour un rétablissement réussi. Elle part maintenant d'une session
   neuve et d'une valeur franche.

---

## Lot 4 bis-B : le petit séquenceur en tiroir flottant, sur téléphone seulement

Idée de l'utilisateur : « J'ai bien envie de garder l'idée du "Petit séquenceur"... Il est plus simple
à utiliser que le grand séquenceur qui demande un grand écran », puis « Le séquenceur pourrait
apparaitre dans un popover également, non ? »

### La mesure a restreint le lot à un seul format

| | grille avant ouverture | après ouverture |
|---|---|---|
| **Ordinateur** | 162px, 236px visibles | **inchangé — il ne coûte rien** |
| **Téléphone** | 345px, 230px visibles | **0px de grille visible** (la page filait à -455px) |

Sur ordinateur, le petit séquenceur vit dans la colonne de gauche, juste sous les commandes de
l'accord, et n'enlève rien à la grille : l'y faire flotter par-dessus serait une régression pure. Le
banc l'exige explicitement, pour que personne ne « complète » le lot en l'étendant au grand écran.

### L'arithmétique de l'écran, faite avant de dessiner

Sur un iPhone 13 (664px) : 345 au-dessus de la grille + 230 de grille + 221 de séquenceur + 81 de
barre de lecture = **877px à loger dans 664**. Il manque 213px, et aucune disposition ne montrera la
grille ENTIÈRE et le rythme ensemble. L'objectif retenu n'est donc pas celui-là : c'est de voir
**l'accord qu'on travaille** et son rythme. Le défilement vise désormais la case éditée au lieu de
centrer le séquenceur.

Le résultat mesuré dépasse la prévision : la page défile de 250px, la carte Morceau s'efface, et
**230px de grille** — sa hauteur entière — tiennent au-dessus du tiroir.

### Ce que le tiroir ne fait pas, et c'est voulu

- il ne rejoint **pas** la table `_popups` : un clic sur la grille ne doit pas le refermer, on
  travaille le rythme d'un accord puis d'un autre (« il reste ouvert ») ;
- il n'appelle **pas** `lockBodyScroll()` : ce n'est pas une fenêtre modale ;
- il ne détourne ni Ctrl+Z ni la barre d'espace — c'est l'objet du lot 4 bis-A, fait avant lui
  précisément pour ça.

Conséquence assumée : sans clic-à-côté pour le fermer, **son bouton doit vraiment marcher dans les
deux sens**, sinon il n'y a plus de sortie. Le banc l'éprouve.

### Deux pièges désamorcés à la source

1. `placeSequencer()` reste le SEUL endroit qui décide où vit `#arp-sequencer`. Poser la classe
   ailleurs aurait recréé la dérive « deux endroits qui déplacent le même nœud ».
2. La hauteur de la barre de lecture est **mesurée**, jamais devinée : elle change selon ce qu'elle
   contient (le bloc Ajouter/Annuler y descend en mode Modification). Un nombre en dur aurait laissé
   le tiroir flotter au-dessus d'un vide, ou recouvrir le bouton Lecture.
3. Le rang d'empilement est choisi dans le paysage existant : au-dessus de l'en-tête collant de la
   grille (30), qui sinon couperait la première ligne de cases sans qu'aucune mesure de rectangle ne
   le voie — le banc pose donc la question au navigateur (`elementFromPoint`) plutôt qu'aux
   coordonnées.

---

## Lot 4 bis-C : atteindre les motifs rythmiques depuis le tiroir

**Ce lot devait être une rangée de motifs, et il ne l'est pas.** En allant l'écrire, j'ai vérifié ce
qui existait : `PLAYSTYLE_OPTIONS` **est** exactement l'ensemble des motifs que `seqPreset()` sait
poser — tenu, rondes/blanches/noires/croches, liées ou détachées — et il est déjà offert par un menu
d'icônes groupé « Lié (son continu) » / « Détaché (staccato) », avec des têtes de notes dessinées. Une
rangée de motifs aurait été une **seconde copie des neuf mêmes choix**, dans le même panneau :
exactement le reproche « Trop de volets déroulants et de boutons ? J'ai l'impression d'avoir fait une
machine à clics ».

**Le vrai manque, lui, était mesurable** : sur iPhone 13 (fenêtre de 664px), le bouton qui ouvre ce
menu se trouve à **630px** — hors écran — et il y reste que le tiroir soit ouvert ou non. Au moment
précis où l'on travaille le rythme, on ne peut donc plus changer de motif. Le lot ajoute **un
raccourci vers le même menu** dans la barre d'outils du tiroir, et seulement là.

La moitié du lot consiste à NE PAS faire quelque chose, et le banc la garde : sur ordinateur, aucun
raccourci en double, le sélecteur d'origine étant déjà sous les yeux. Sans cette vérification,
quelqu'un « complétera » le raccourci en l'affichant partout et recréera le doublon.

### Deux pièges désamorcés avant d'écrire

1. **Le clic-à-côté du menu.** Son gestionnaire referme dès qu'on clique hors de `#playstyle-dd`. Le
   nouveau bouton étant ailleurs, il aurait refermé le menu dans la foulée du clic qui l'ouvre — le
   banc l'aurait vu comme « le menu ne s'ouvre pas », et on aurait cherché longtemps. C'est le même
   piège que le champ `ancre` de la table `_popups` résout ailleurs ; même correctif.
2. **La règle « le séquenceur est-il en tiroir ? »** est définie **une seule fois**
   (`estSequenceurEnTiroir`), lue par le placement ET par la barre d'outils. La recopier aurait suffi
   à les faire diverger — ce fichier en a déjà payé le prix plus d'une fois dans la même session.

---

## Correctif signalé : le tiroir n'avait aucune sortie atteignable

Retour utilisateur, après le lot 4 bis-B : « je n'arrive plus à fermer le petit séquenceur une fois
ouvert (test réalisé sur téléphone) ». **Ma faute deux fois**, et les deux méritent d'être écrites.

**Dans l'application.** Le tiroir ne rejoint volontairement pas la table `_popups` — un clic sur la
grille ne doit pas le refermer. Le bouton qui l'ouvre (`#toggle-sequencer`) vit dans la carte Lecture,
mesurée à **838px sur une fenêtre de 664** : hors écran avant comme après l'ouverture. Le tiroir
n'avait donc plus aucune sortie. C'est le prix du choix « pas de clic-à-côté », et il se paie là où on
l'a fait : **un panneau flottant porte sa propre fermeture**. Une croix, au bout de sa barre d'outils.

**Dans le banc, et c'est la leçon générale.** La vérification « le bouton qui l'a ouvert le referme »
appelait `window.app.toggleSequencer(...)` — un APPEL DE MÉTHODE. Elle passait au vert en n'éprouvant
jamais ce qui manquait vraiment : qu'un doigt puisse atteindre quelque chose. J'avais pourtant écrit
dans ce même document, deux lots plus tôt, qu'il faut « deux couches » et que la couche câblage est la
seule à prouver que la commande visible touche le moteur — et je l'ai oublié sur la commande la plus
importante du panneau, sa sortie.

**Règle à appliquer désormais** : pour une commande que l'utilisateur doit ATTEINDRE, on vérifie
d'abord qu'elle est à l'écran et que `elementFromPoint` la désigne, PUIS on la pilote par un vrai
geste. Jamais par la méthode qui se cache derrière. Le banc fait maintenant les trois.

---

## Lot 5 : la barre du bas fusionne, et porte deux accès de secours

### La mesure a déplacé le sujet du lot

La plainte d'origine visait l'ordinateur : « les boutons fichiers, accords, etc... ne sont pas
descendus en bas de page ». Vérifié sur quatre configurations (1440x768 et 1440x900, volet ouvert et
masqué) : **la barre du bas est en bas dans les quatre cas**, avec les 20px de marge de page pour
seul écart. Ce défaut-là a été réglé par le lot antérieur qui recalcule la hauteur du séquenceur au
repli du volet. Rien à y faire de plus.

Le problème mesurable restant est ailleurs. Sur iPhone 13 (fenêtre de 664px, page de **1314px**), un
accord en cours de modification : **six commandes sur neuf sont hors écran** — ouvrir le petit
séquenceur (838px), l'instrument (838), l'intensité (936), le motif rythmique (880), et même
« terminer la modification » (653). Tout ce qui vit dans la carte Lecture n'est atteignable qu'après
avoir fait défiler jusqu'en bas, en perdant la grille de vue — au moment précis où l'on ne veut pas la
perdre.

### Deux accès seulement, et c'est un choix

Le **rythme** (la porte d'entrée du tiroir, qui porte ensuite ses propres outils) et **terminer** (la
sortie du mode). L'instrument et l'intensité restent hors d'atteinte sur téléphone : c'est **signalé
plutôt que corrigé en douce**, faute de place dans une barre déjà courte.

Ce ne sont pas des doublons, et le banc le vérifie dans les deux sens : sur ordinateur ces boutons
n'existent pas (les originaux y sont sous les yeux), et sur téléphone les originaux sont
inatteignables au moment où l'on en a besoin. **Un doublon n'en est un que là où l'original est
atteignable.**

### La fusion est ce qui rend ces deux boutons gratuits

La barre empilait le bloc d'actions d'édition au-dessus du transport. En Modification, ce bloc a tous
ses boutons masqués (Ajouter/À la suite/Annuler n'ont plus de sens quand chaque champ s'applique déjà
seul) : il ne portait qu'une rangée vide. Les deux nouveaux boutons l'avaient fait passer de **81 à
113px** — 40px pris à la grille. Fusionnées en une seule rangée : **73px**, moins qu'avant le lot.

### Une régression de libellé, retrouvée dans l'historique

Signalée par l'utilisateur : « Tu avais également modifié l'encadré vert "Ajouter une partie" en
"Ajouter section" sous la grille, j'ai l'impression que cela a régressé. » Vérifié plutôt que supposé :
`69d70ea` avait bien renommé le bouton, et `ee19b67` — celui qui le passait en vert — a **réécrit la
ligne entière** et remis l'ancien libellé au passage. C'est le genre de retour en arrière qu'une
réécriture de ligne refait sans le vouloir : le libellé a donc désormais son propre banc.

---

## Finitions 1-4 : ce que le retrait de deux boutons a coûté et rapporté

Quatre demandes en une passe, toutes des retraits ou des conséquences de retraits.

| # | Demande (mots de l'utilisateur) | Décision |
|---|---|---|
| 1 | « Bouton repérer l'accord dans la grille : il ne me servira à rien » | retiré, rien à la place |
| 2 | « on peut enlever le bouton "..." complètement, afin de mettre directement les accords complexes dans la liste » | bouton retiré, six qualités rendues permanentes, basse sortie vers la rangée voicing |
| 3 | « ne pas afficher le "F" pour fondamental… enlever les renversements en cliquant à nouveau » | l'état initial n'a plus de bouton, le clic bascule |
| 4 | « exactement la même remarque pour l'état initial [du drop]… tous les boutons pourront être élargis » | idem, et les boutons se partagent la largeur libérée |

### La suppression qui a cassé l'application, et pourquoi `node --check` ne l'a pas vue

En retirant le bouton « … » j'ai emporté `toggleSelectOptions` — une aide **partagée** avec le bouton
des MODES (carte Morceau), qui n'était pas dans la demande — ainsi que `revealComplexModeIfNeeded`.
Résultat : `this.toggleSelectOptions is not a function` au démarrage, `window.app` jamais construit,
**page entièrement morte**. Or `node --check script.js` passait au vert : un appel de méthode absente
n'est pas une erreur de syntaxe. Le même piège avait laissé passer, quelques minutes plus tôt, un
`this.revealAdvancedIfNeeded(d)` orphelin.

**Règle appliquée depuis : une suppression ne se termine pas par une vérification syntaxique, elle se
termine par un CHARGEMENT RÉEL de la page avec les erreurs écoutées.** Le banc en fait maintenant sa
section A, dans les deux sens : les méthodes qui n'existaient QUE pour les boutons retirés doivent
avoir disparu (sinon le bouton reviendra un jour), et celles qui servent ENCORE ailleurs doivent être
là (sinon on casse une autre fonction en silence).

### Une hauteur écrite, appliquée nulle part

Le menu de basse, une fois posé dans la rangée, était rendu **18px de haut au lieu de 30**, sur tous
les écrans. La règle était pourtant écrite, correcte, et la dernière à s'appliquer. La cause : la
règle générique `select { flex: 1 }` s'applique aussi à lui, et dans un conteneur en **colonne**
« flex:1 » régit l'axe **vertical** — la base de 0 l'emporte alors sur `height`. `flex: none` corrige.

C'est invisible à la relecture de la feuille de style : il faut lire les règles **réellement
appliquées par le navigateur** (`CSS.getMatchedStylesForNode` via CDP). C'est ce même outil qui a
révélé, juste après, que mon `flex`/`padding` sur `.voicing-segment` n'étaient **pas appliqués du
tout** : en réécrivant un commentaire, j'avais supprimé son `*/`, et le commentaire avalait les deux
déclarations suivantes. Un contrôle d'équilibre des `/*` et `*/` ne l'aurait pas vu — ils étaient
équilibrés, simplement mal placés.

### Élargir des boutons : le padding fixe est le mauvais outil

Premier essai, l'évidence : padding de 9px → 12px. Mesuré ensuite sur **neuf largeurs** — la rangée
débordait de 10px sur ordinateur et de 46px sur un téléphone de 360px. Un padding fixe ne sait pas
rendre la place quand il n'y en a plus.

Deuxième version, retenue : `flex: 1 1 0` sur les boutons et des **poids** sur les groupes (3 pour
l'octave, 3 pour le renversement, 2 pour le drop, 2 pour la basse). Les boutons sont alors aussi
larges que la carte le permet, et jamais plus.

Largeur du plus petit bouton, avant → après :

| Écran | Avant | Après |
|---|---|---|
| 1440px | 23px | 29px |
| 430px | 23px | 32px |
| 390px | 23px | 28px |
| 360px | 23px | 26px |
| 320px | 23px | 20px |

À 320px (iPhone SE de 1re génération) il reste une contrainte réelle : quatre groupes et huit
contrôles dans 245px. Un palier `@media (max-width: 374px)` rabote les planchers et donne une part de
plus à la basse — seul groupe dont le contenu est un mot et non un chiffre. Sans ce rééquilibrage, la
répartition au prorata lui donnait 46px, son plancher de 55 reprenait la main, et les 9px manquants
**sortaient de la carte**.

### Le passage à la ligne, écarté et pourquoi

Deux groupes par ligne aurait donné des boutons confortables partout, mais aurait **doublé la hauteur
de la rangée** (50 → ~100px) sur les écrans qui ont le moins de hauteur à donner — l'inverse exact de
ce que demandait le lot « sur téléphone, la grille plus haut ».

### La flèche native mangeait le mot

Constaté **sur capture d'écran**, pas déduit : « Fond. » était tronqué en « Fon » dès 390px. La flèche
native de Chrome réserve une vingtaine de pixels. Remplacée par un chevron SVG inline (`appearance:
none`), qui en coûte douze — et qui, accessoirement, aligne enfin la basse sur ses trois voisins
dessinés par l'appli. Le préfixe « Basse » a aussi disparu des treize options : l'étiquette du groupe
le dit déjà une fois.

### Trois bancs adaptés, aucun supprimé

- `voicing_direct_test.js` : « autant de segments que d'options » devient « un segment par option
  **sauf la première** » ; le grisage se vérifie désormais **par la valeur** du segment et non par son
  rang — un rang bouge le jour où l'on retire un bouton, et un banc qui compte les positions se met à
  mesurer le mauvais segment sans rien signaler.
- `undo_derniere_action_test.js` : le retour à la fondamentale n'a plus de bouton propre, il se fait
  en re-cliquant le segment allumé. Le geste change, la mesure (quelle pile reçoit l'action) non.
- Le banc du Lot 4 vérifiait que le bloc « avancé » restait **replié**. La preuve reste nécessaire mais
  ne peut plus s'écrire ainsi : elle devient « plus rien n'est repliable, et les quatre listes source
  sont toujours là ».

### Une exigence de banc corrigée dans le bon sens

Ma première version exigeait que le bouton drop soit dans la fenêtre **sans défiler** sur téléphone.
Il est à 666px d'une fenêtre de 659px — la carte Accord vit sous la grille, c'est la disposition
voulue, pas un défaut. L'exigence juste est **« atteignable »** : après défilement, le bouton est dans
la fenêtre ET c'est bien lui que le doigt touche à cet endroit. C'est ce qui manquait au tiroir du
séquenceur, dont le bouton de fermeture était à 838px d'une fenêtre de 664px qu'**aucun** défilement
n'atteignait, pendant que le banc le fermait par `window.app.toggleSequencer` et voyait tout en vert.

---

## Chasse aux régressions : ce que la campagne a trouvé

Demande de l'utilisateur : « Il faudrait aussi que tu vérifies qu'il n'y ait pas eu de régressions
(par exemple comme le bouton "Ajouter section" que je t'ai montré précédemment). »

### Une vraie régression : le bouton Annuler éjectait de l'accord en cours

`sortie_edition_involontaire_test` — dont c'est tout l'objet — l'a montrée : **`#global-undo-btn`
faisait sortir du mode Modification**. Vérifiée par la méthode du dépôt (rejouer sur le commit
d'avant, servi sur un second port) : sur `f357912` aucun contrôle ne fait sortir de l'édition, sur
`a865681` (Lot 4 bis-A) `#global-undo-btn` le fait.

Le mécanisme, en trois temps :

1. `afterHistoryRestore` sort de l'édition **à dessein**, « prudemment plutôt que de risquer un
   décalage » — un index d'édition ne désigne plus forcément le même accord après restauration. Cette
   prudence est antérieure au lot et reste juste.
2. Tant que le bouton Annuler, séquenceur ouvert, visait forcément l'historique **du séquenceur**, ce
   chemin n'était pas atteignable depuis le mode Modification.
3. « La dernière action gagne » (Lot 4 bis-A) l'a rendu atteignable — et annuler une retouche éjectait
   de l'accord qu'on était en train de régler.

Correctif : on reprend l'accord **s'il existe encore** dans l'état restauré. La prudence est
conservée — l'ancien index n'est pas réutilisé tel quel, il est vérifié contre les données restaurées,
et `editChord` relit tous les champs depuis elles.

### Le correctif avait lui-même un défaut, trouvé par un banc

Première version : `afterHistoryRestore` appelait `editChord` directement. Or `editChord` redessine le
séquenceur, qui rappelle `commitLiveEdit`, qui **dépose un instantané d'annulation**. Autrement dit,
l'annulation polluait l'historique qu'elle venait de dépiler et vidait `redoStack` au passage :
mesuré, `redoStack` passait de 1 à 0 juste après l'undo, et « rétablir » ne rétablissait plus rien.
C'est `undo_derniere_action_test` qui l'a dit, à la vérification suivante.

Correctif du correctif : un garde `_restaurationHistorique` fait sortir `commitLiveEdit` en tête.
**Un état qu'on restaure n'est pas une action de l'utilisateur : il n'a rien à écrire ni à empiler.**
Le drapeau de session est remis à zéro en sortant, sans quoi la première retouche d'après une
annulation serait devenue à son tour inannulable.

### Trois angles morts du méta-banc, dont un qui punissait le bon usage

Le banc qui surveille les bancs signalait quatre aggravations. Trois étaient **ses propres
heuristiques**, et les corriger a fait tomber la dette « identifiants morts » de 11 fichiers à 1 :

- **Un identifiant vérifié ABSENT n'est pas un identifiant mort.** `check(!document.getElementById(
  'accord-goto'), …)` est la bonne façon d'écrire « ce bouton a bien été retiré » — c'est même la seule
  chose qui empêche un bouton supprimé de revenir. Le compter comme dette poussait à effacer la
  vérification, soit exactement le contraire. Même exception pour un élément que le banc **crée**
  lui-même (`s.id = 'banc-largeur'`).
- **`if (exiger(…)) { check(…) }` n'est pas une vérification perdue** : la condition EST une
  vérification enregistrée. C'est la forme que le méta-banc **recommande** dans son propre
  commentaire — et il la comptait comme dette. Un garde-fou qui punit le remède qu'il prescrit finit
  débranché. Même chose pour `if (…) { check(false, …) }` et sa branche `else` : un garde qui parle.
- **Un `plan()` CALCULÉ est un plan.** Le motif n'acceptait qu'un nombre écrit, et déclarait donc
  « sans plan » `plan(ROOTS.length * QUALITIES.length * 3 + 2)` — la meilleure forme possible,
  puisqu'elle suit la taille du jeu d'essai.

Le quatrième point, lui, était **réel** : deux `.catch(() => {})` sur des clics de mise en place dans
`sortie_edition_involontaire_test`. Ils avalaient un échec d'ouverture de la fenêtre du manche, après
quoi le banc concluait sur un état qu'il n'avait pas su préparer. Une fois l'échec enregistré au lieu
d'être jeté, la cause est apparue en une exécution : la fenêtre restait ouverte du tour précédent, et
le bouton qui l'ouvre était **derrière elle**.

### Un rouge qui était un gain

`seq_short_note_body_test` affirmait que sur téléphone les deux notes courtes restaient sous le seuil
de largeur. Ce n'était pas une règle, c'était la géométrie du jour : le tiroir flottant (Lot 4 bis-B) a
élargi le séquenceur mobile de **315 à 378px**, une double-croche est passée de 18,5 à 21,3px, et la
note de deux croches (42,6px) franchit désormais le seuil — elle devient assez large pour qu'on
l'attrape par ses bords, ce à quoi ce seuil sert précisément. Le banc éprouve maintenant la RÈGLE
(c'est le seuil qui tranche, note par note) et non la mesure d'un jour.

### Quatre rouges qui n'en étaient pas

`entete_grille_debordement`, `ghost_note`, `item1_hzoom_out`, `items2345` et `probe_touches_piano`
échouaient sur un `page.goto` expiré à 15s. Relancés en série : tous verts. C'est le bruit réseau du
bac à sable déjà documenté — un serveur HTTP mono-thread sous quatre fils parallèles.

Les sept autres rouges du balayage sont **exactement** la ligne de base d'avant les travaux
(`probe_clic_accord_voisin` 4/8, `probe_defilement_tactile` 23/24, `probe_regle_voisins` 28/29,
`probe_seq_finitions` 18/19, `real_click_loupe_selection` 3/4, `seq_notes_libres_clavier` 32/33,
`seq_selection_et_cadre_diagrammes` 21/22), inchangés.

---

## La carte Lecture prend la forme de la carte Accord

Retour utilisateur : « Le panneau lecture n'est pas harmonieux non plus, mets en place le même
principe de menu que pour accord au dessus. Tu peux définir 5 niveaux d'intensité au lieu de la barre
si tu veux gagner de la place. »

**Mesuré avant** : la carte empilait trois rangées de formes différentes — deux gros boutons de poids
inégaux (`.select-group`), puis une barre de réglage avec son étiquette **à gauche** et son nombre à
droite (`.intensity-row`). Aucune ne suivait la mise en page de la carte au-dessus : étiquettes
minuscules **au-dessus**, commandes compactes sur **une** rangée.

| | avant | après |
|---|---|---|
| Ordinateur | 160px | **124px** |
| Téléphone | 182px | **130px** |

### Les mêmes classes, pas une imitation

La rangée Lecture **est** une `.voicing-row`, ses groupes des `.voicing-group`, ses étiquettes des
`.voicing-label`, l'intensité une `.voicing-seg`. « Le même principe » ne tient que s'il n'y a qu'un
seul principe : retoucher l'un retouche l'autre, et les deux cartes ne peuvent plus diverger sans
qu'on le voie. Le banc le vérifie explicitement — si un jour quelqu'un recopie l'aspect au lieu de
réutiliser les classes, il rougit.

### Cinq niveaux, et pourquoi ils ne sont pas régulièrement espacés

35 / 55 / **75** / 90 / 100. `computeVelocity` multiplie par `percent / DEFAULT_INTENSITY` puis
**plafonne à 1** : au-dessus de 75 la marge utile se resserre (un accord tenu est déjà à fond), en
dessous elle s'étale. D'où des pas de 20/20 sous la normale et de 15/10 au-dessus.

**75 est conservé à l'identique** comme niveau central. C'est la valeur par défaut de tous les accords
existants et la référence du calcul de vélocité : la déplacer aurait changé le son de morceaux déjà
écrits.

### Une valeur héritée n'est ni réécrite, ni affichée comme exacte

Un morceau enregistré avant ce changement peut porter n'importe quelle valeur (60, 85…). Deux
tentations, toutes deux malhonnêtes : la réécrire en silence à l'ouverture de l'accord — ce qui
modifierait son son sans que personne ne l'ait demandé — ou allumer le niveau le plus proche comme
s'il était exact. On fait ni l'un ni l'autre : le plus proche s'allume **en pointillé** (`.approx`),
le nombre exact reste lisible dans l'étiquette, et la donnée n'est écrite qu'**au clic**.

### Le mode studio a trouvé sa place

Il était l'un de trois pictogrammes sans rapport entre eux dans l'en-tête, où rien ne disait à quoi il
se rapportait. Il est maintenant la **dernière case de la bande d'intensité** : c'est le réglage fin
(une intensité par croche) de ce que les cinq niveaux règlent grossièrement. Sa place est au bout de
cette échelle-là.

### Deux mesures qui ont corrigé le premier jet

1. **La bande d'intensité débordait de son groupe de 9 à 17px** selon l'écran. Je lui avais donné un
   poids flex comme aux deux autres groupes ; or ses six cases ont une largeur plancher et refusent de
   descendre en dessous — c'est le cadre qui cédait. Elle prend désormais sa largeur naturelle
   (`flex: 0 0 auto`), et le reste de la rangée se partage ce qui reste.
2. **« 1 mes. » était tronqué** de 7px sur ordinateur et 14px sur un écran de 360px. Deux pixels
   étaient vraiment redondants dans cette rangée : le chevron (il redit ce que le cadre dit déjà — une
   case qui s'ouvre) et l'icône de durée (elle redit ce que « 1 mes. » écrit juste à côté). Retirés de
   la rangée, gardés dans les menus ouverts. L'icône du **style de jeu** reste, elle : elle dessine le
   rythme, ce que le mot ne fait pas.

### Un banc adapté, aucun supprimé

`filet_sequenceur_et_sortie_test` cliquait `#intensity` pour vérifier qu'utiliser une commande ne fait
pas sortir du mode Modification. Son commentaire annonçait lui-même la suite : « quand les autres
remonteront à la surface, elles rejoindront cette liste. » Elles y sont — la liste éprouve maintenant
un menu, des segments, un pas-à-pas et un bouton, soit une commande de chaque famille.

---

## Le rythme et la durée : les définir là où c'est vraiment le geste

Retours utilisateur : « Le bouton "jeu" n'est pas clair, à travailler également » et « Je pense que je
ne me servirai pas souvent de ces options de lecture (durée accord et type de rythme) vu que je
modifie plus rapidement le séquenceur. Que penses-tu de les modifier fortement voire de les
supprimer ? »

### Trois constats, mesurés avant de décider quoi que ce soit

**1. « Jeu » n'était pas un état, c'était un tampon.** Il écrase tout le motif du séquenceur. Sa forme
— un menu qui affiche une valeur courante — mentait :

| | ce que le bouton affiche | ce que l'accord joue |
|---|---|---|
| Je choisis « 1t détaché » | `1t` | `0,1,2,3;;;;0,1,2,3;;;;…` |
| Je dessine une note | **`1t`** | `0,1,2,3;3;3t;3t;0,1,2,3;…` |

Il annonçait une **action passée**, jamais l'état présent.

**2. Ce tampon détruisait sans retour.** Il appelait `clearSeqHistory()` : pile du séquenceur **2 → 0**,
et trois Ctrl+Z de suite retombaient sur l'état du début de session, **jamais** sur le rythme dessiné.
Un bouton qui ressemble à un menu de réglage et qui efface du travail sans filet n'est pas un manque
de clarté, c'est un piège.

**3. « Durée » faisait doublon en Modification.** La poignée au bord de la case fait déjà le travail —
tiré la case, `1 mes. → 2 mes.`, et le champ source a suivi tout seul.

### Pourquoi « ne pas supprimer » malgré tout

En mode **Ajout**, ces deux réglages sont les **valeurs par défaut des accords ajoutés** :
`buildChordData(parsed, beats, playStyle, instrument)` les lit à chaque ajout, Ajout rapide compris.
Les supprimer aurait enlevé le seul moyen de dire « les accords que je vais taper durent 2 mesures ».

D'où un **partage par mode** plutôt qu'une suppression. Le masquage est en CSS et non en JS :
`data-app-mode` est déjà posé sur `<body>` par `applyAppModeTheme`, LE point de passage de tout
changement de mode. Un masquage piloté depuis le JS aurait été un second endroit à tenir à jour, donc
un second endroit à oublier — le défaut « deux listes jumelles » que ce fichier documente douze fois.

Et le mot a changé : **« Jeu » → « Rythme »**. Le bouton ne choisit pas une manière de jouer, il
remplit le séquenceur d'un motif type. Le mot nomme maintenant la chose remplie.

### Le tampon est devenu annulable

`clearSeqHistory()` remplacé par un `pushSeqUndo()` **avant** d'écraser. La raison invoquée à l'époque
(« nouveau motif de départ : l'ancien historique ne s'applique plus ») ne tenait pas : ni la forme de
l'accord ni sa durée ne changent ici, seulement le motif — les instantanés précédents restent donc
applicables. `clearSeqHistory` garde tout son sens à ses trois autres appels, qui sont de VRAIS
changements de forme. Mesuré après : pile 2 → 3, et **un seul Ctrl+Z** retrouve le rythme dessiné.

### « Ce rythme pour toute la partie »

Le pendant, côté rythme, de « ce son pour tout le morceau ». Deux décisions de fond :

- **La partie, pas le morceau.** Un couplet et un refrain n'ont presque jamais le même rythme : à
  l'échelle du morceau, ce bouton effacerait plus souvent qu'il ne servirait.
- **La durée de chaque accord est conservée.** C'est la différence avec la pipette de rythme, qui
  recopie *aussi* la durée de la source (demandé ainsi pour un accord vers un autre). Sur toute une
  partie, imposer la durée de la source aplatirait le rythme harmonique. Le motif est donc **ajusté** :
  `resizeSeqPattern` le répète sur un accord plus long, le tronque sur un plus court. Mesuré sur une
  partie 4/8/2/2 temps : durées inchangées, motifs de 8 à 32 cases selon l'accord.

Dans le **menu contextuel** et non dans une carte : l'accord cliqué EST la source, il n'y a rien
d'autre à désigner — et ça ne coûte pas un pixel, ce qui compte après tout le travail d'allègement.
L'entrée se masque quand la partie n'a qu'un accord : proposer une action sans effet est pire que ne
rien proposer.

### Deux erreurs de banc, dont une qui accusait l'application à tort

Ma première version de la section A ajoutait un accord avec **Entrée** sur une grille à **deux
parties**. Deux pièges d'un coup : l'ajout rapide se valide par le bouton ou Ctrl+Entrée (le champ est
un `<textarea>`, Entrée y insère une ligne — c'est écrit dans son infobulle), et avec plusieurs parties
un sélecteur s'interpose. Résultat : rien n'était ajouté, le banc lisait le **dernier accord déjà
présent** en croyant lire le sien, et annonçait « 2 temps au lieu de 16 » — **une accusation portée
contre du code parfaitement sain**. Corrigé en cliquant le vrai bouton, en traitant le sélecteur, et
en exigeant d'abord que le nombre d'accords ait bien augmenté.

Second banc adapté : `lecture_meme_principe_test` mesurait la taille de toutes les cibles de la
rangée. Rythme et Durée étant désormais en `display:none` en Modification, il annonçait « la plus
petite cible fait 0x0 » — une alerte sur des boutons qui, précisément, ne sont pas là. Il ne mesure
plus que les cibles **réellement proposées**.

### La conséquence que le partage par mode a révélée

Masquer le groupe « Rythme » a cassé, en silence pour l'œil mais pas pour son banc, le raccourci du
tiroir mobile ajouté au Lot 4 bis-C. Cause **structurelle** : `#playstyle-dd-menu` était un **enfant
du bouton** qu'il décore. Masquer le bouton masquait donc le menu — que le raccourci ouvrait depuis
un tout autre endroit. Un menu en `position: fixed`, placé au pixel par JS, n'a aucune raison d'être
un descendant de son bouton : les deux menus d'icônes (rythme et durée) sont désormais rangés avec
les autres menus flottants, au niveau du document. Leurs items restent des `<button>`, mot qui figure
déjà dans `ZONE_EDITION_SELECTEURS` — cliquer un motif ne fait donc pas sortir du mode Modification.

Et une **question de fond** que ce rouge a posée : sur ORDINATEUR en Modification, il n'y avait plus
aucun accès aux motifs, puisque le raccourci était réservé au tiroir mobile. Le bouton du séquenceur
n'est donc plus réservé au tiroir. C'est cohérent avec tout le raisonnement de ce chantier : **poser
un motif type est une action sur le rythme, sa place est dans l'outil du rythme**, pas dans une carte
de réglages. Son infobulle le dit maintenant en toutes lettres — « Remplir le rythme avec un motif
type (remplace le motif actuel — annulable par Ctrl+Z) ».

`seq_tiroir_motifs_test` section C vérifiait l'inverse (« pas de second bouton sur ordinateur, le
sélecteur d'origine est déjà sous les yeux »). Ses deux prémisses ont changé par décision. Elle
vérifie maintenant ce qui compte vraiment : **il y a un accès, et un seul**.

## L'intensité : d'abord réparer, ensuite cacher

> « La modification d'intensité ne semble pas fonctionner, le jeu est toujours fort. Pas besoin de
> tout le temps le laisser afficher, c'est une option pour affiner le morceau seulement. À cacher. »

Deux demandes dans une seule phrase, et l'ordre entre elles n'est pas neutre : **cacher d'abord aurait
enterré le défaut**. Une commande qui ne fait rien, rangée dans un menu, ne fait toujours rien — elle
est simplement plus difficile à mettre en cause. J'ai donc mesuré avant de déplacer quoi que ce soit.

### Le défaut, chiffré — et ma propre note qui le maquillait

Pour un accord **tenu**, c'est-à-dire le réglage par défaut de tous les accords, `computeVelocity`
partait d'une base de `1` et la multipliait par `intensité / 75`. Résultat, avant :

| Niveau | Très doux | Doux | Normal | Fort | Très fort |
|---|---|---|---|---|---|
| Vélocité **avant** | 0,467 | 0,733 | **1,000** | **1,000** | **1,000** |
| Vélocité **après** | 0,373 | 0,587 | 0,800 | 0,960 | 1,000 |

**Trois des cinq niveaux donnaient exactement la même chose**, parce que le multiplicateur écrêtait au
plafond dès « Normal ». L'utilisateur n'avait pas une impression : dans la moitié haute de l'échelle,
celle qu'on touche le plus, l'intensité était littéralement inopérante.

Le pire est ce que j'avais écrit moi-même au lot précédent, en commentaire de ce même code :
« au-dessus de 75 la marge utile se resserre ». C'est faux, et faux d'une façon dangereuse — ça
**décrit un inconvénient là où il y a une panne**, donc ça décourage précisément l'enquête qu'il
fallait mener. Une note qui atténue un symptôme au lieu de le mesurer vaut moins que pas de note.

Le correctif tient en une constante, `VELOCITE_NIVEAU_NORMAL = 0.8` : « Normal » ne joue plus au
plafond, ce qui **crée la marge** dans laquelle « Fort » et « Très fort » peuvent enfin exister.

**Le coût, accepté en connaissance de cause.** Tout ce qui est réglé sur « Normal » — c'est-à-dire
tous les morceaux déjà écrits — devient environ **2 dB plus discret** (0,8 contre 1,0). L'alternative
était de comprimer l'échelle vers le bas en gardant Normal au plafond, mais alors « Fort » et « Très
fort » n'auraient toujours rien eu au-dessus d'eux. Question posée, réponse retenue : **réparer
l'échelle**, quitte à ce que le niveau par défaut baisse un peu.

### Ensuite seulement, la cacher

L'intensité quitte la carte pour le **menu contextuel de l'accord** (choix de l'utilisateur parmi
quatre emplacements proposés) : c'est un réglage de finition, il se prend sur un accord précis, et
l'accord cliqué EST déjà la cible — rien à désigner en plus, pas un pixel de carte consommé.

`#intensity` **reste dans le DOM, masqué**. Même règle que pour `#inversion`, `#drop`, `#octave`,
`#playStyle` et `#duration` : c'est la source de vérité que lit `readChord()`, et la vider aurait
demandé de toucher `commitLiveEdit`, l'annulation, l'export MIDI et l'export PDF pour un gain nul.

Le **mode studio** a suivi l'intensité : il n'affinait la vélocité que note par note dans le
séquenceur, il n'avait plus rien à faire dans une carte de réglages d'accord. Il est désormais dans la
barre d'outils du séquenceur, rendu **avec le gabarit** `.seq-presets` et non posé une fois au
démarrage — sans quoi il disparaissait au premier redessin de la barre.

### Ce que la carte y gagne, mesuré

| | Avant les trois lots | Après |
|---|---|---|
| Ordinateur, mode Ajout | 160px | **122px** |
| Ordinateur, mode Modification | 160px | **74px** |
| Téléphone, mode Ajout | 182px | **128px** |
| Téléphone, mode Modification | 182px | **80px** |

### Un banc qui passait au vert sans rien éprouver

`lecture_meme_principe_test` ouvrait un accord (`editChord`) avant de mesurer la forme de la rangée.
Depuis que Rythme et Durée ne s'affichent qu'en mode Ajout, il mesurait donc des boîtes en
`display:none` : largeur 0, hauteur 0, et une étiquette « au-dessus » de rien du tout — car
`0 <= 0 + 1` est vrai. **Toutes ses vérifications de forme étaient devenues des tautologies**, et il
les annonçait au vert. Il mesure maintenant là où la rangée est réellement affichée, exige
explicitement `body[data-app-mode="add"]`, refuse une comparaison entre boîtes de hauteur nulle, et
consacre une vérification séparée au fait que la rangée disparaît bien en Modification.

C'est le même piège que le « la plus petite cible fait 0x0 » du lot précédent, vu de l'autre côté :
une fois qu'une partie de l'interface peut être absente, **tout banc qui la mesure doit d'abord dire
s'il l'attend présente ou absente**. Sans quoi il ne mesure plus rien, dans un sens ou dans l'autre.

Ses quatre familles consacrées à l'intensité n'ont pas été supprimées mais **déménagées** dans
`intensite_reparee_test.js`, qui les éprouve à leur nouvelle adresse et vérifie en plus les cinq
vélocités distinctes — le défaut qui les a fait bouger.

### Le code que le déménagement a laissé mort

Trois méthodes (`construireCommandesIntensite`, `syncCommandesIntensite`, `appliquerIntensite`) et
quatre règles CSS ne visaient plus que `#intensity-seg`, qui n'existe plus. Elles ne faisaient rien —
mais elles portaient de longs commentaires décrivant une interface disparue, ce qui est pire que rien :
la prochaine lecture y aurait cherché la logique des cinq niveaux, qui vit maintenant ailleurs.
Retirées, avec leurs trois appels.

Une des quatre règles méritait qu'on la regarde : `body[data-app-mode="edit"] .voicing-segment
{ max-width: 44px }` ne visait pas que l'intensité — `.voicing-segment`, c'est **aussi** la classe des
cases de renversement et de drop de la carte Accord, bien visibles en Modification. **Mesuré avant de
l'écrire** : ces cases font 28 à 30px de large de 1440px à 390px, le plafond ne mordait donc nulle
part. Ce n'était pas un défaut visible, c'était une règle qui attendait de le devenir.

**Un retrait ne se vérifie pas par `node --check`** — leçon du bouton « … », dont la suppression avait
laissé la page syntaxiquement valide et fonctionnellement morte. Ici : chargement réel de la page,
écoute des `pageerror`, appel des trois chemins qui appelaient les méthodes retirées (`refreshPreview`,
l'`oninput` de `#intensity`, `editChord`), et relevé des styles **effectivement appliqués** sur les
cases restantes. Aucune erreur, `max-width` bien retombé à `none`.

### Le balayage complet, et une ligne de base qui n'était plus à jour

187 suites jouées. 14 rouges, triés en trois familles comme d'habitude :

**1. Changement voulu, banc à adapter (1).** `intensity_test` exigeait, mot pour mot, « 75 % reproduit
EXACTEMENT le comportement d'avant » — donc une vélocité de 1,0 sur un accord tenu à « Normal ».
C'était le bon contrat le jour où l'intensité est née : elle ne devait rien changer tant qu'on n'y
touchait pas. **Ce contrat EST devenu le défaut.** Le banc éprouve maintenant la propriété qui compte
— l'échelle est linéaire, bornée à 1, et surtout `Normal < Fort < Très fort` — au lieu d'une valeur
gelée. L'aléa du temps et du contretemps reste vérifié comme « conservé puis mis à l'échelle, pas
remplacé », ce qui était déjà l'intention d'origine.

**2. Bruit du bac à sable (1).** `glock_full_real_ui` : 31/33 sous quatre fils, **33/33 rejoué seul**.

**3. Rouges PRÉEXISTANTS, et ma liste ne les connaissait pas (12).** Sept étaient documentés
(`probe_clic_accord_voisin`, `probe_defilement_tactile`, `probe_regle_voisins`, `probe_seq_finitions`,
`real_click_loupe_selection`, `seq_notes_libres_clavier`, `seq_selection_et_cadre_diagrammes`).
**Cinq ne l'étaient pas** : `avant_seq_snap_sticky` (3), `loupe_and_tap_fix` (2), `loupe_keyboard` (1),
`multirow_loop` (1), `sidebar_collapse` (1).

Rejoués **en série** : les cinq échouent pareil, ce n'est donc pas du bruit. Rejoués sur le **commit
précédent** (`092a06d`) via un worktree servi sur le port 8935 : **exactement les mêmes comptes**. Ce
ne sont pas des régressions de ce lot.

Mais « préexistant » ne veut pas dire « sans importance », et c'est le vrai enseignement : **une
ligne de base qu'on ne remesure pas devient un permis de ne pas regarder**. Ces cinq bancs portent sur
des fonctions réelles — le transport global quand le volet est replié, la plage de boucle sur une
deuxième rangée, les flèches du clavier dans la loupe, le sélecteur d'aimantation, la loupe au doigt.
Ils sont soit périmés, soit le signe de fonctions cassées ; les deux demandent d'être instruits, pas
tolérés. La question est posée à l'utilisateur avant d'y consacrer un lot, sa priorité étant ailleurs.

## Le rythme : deux boutons en moins, une préférence en plus

> « Je pense que je ne me servirai rarement du rythme. Pour diminuer le nombre de boutons, laisser
> uniquement un choix favori dans les paramètres : jouer des notes tenues tous les temps, ou jouer
> uniquement une note tenue sur le premier temps de l'accord (par défaut). Supprime les boutons dans
> "Lecture" et dans le petit séquenceur. »

### Un revirement assumé, et il faut le dire

Le lot précédent venait d'étendre le bouton de motifs du tiroir mobile à **tout** le séquenceur, avec
un argument qui tenait : « poser un motif type est une action sur le rythme, sa place est dans
l'outil du rythme ». L'argument était juste — il répondait à la mauvaise question. Le bon endroit
pour une commande dont on ne se sert pas n'est aucun endroit.

**Deux choix, pas neuf.** `PLAYSTYLE_OPTIONS` en compte neuf et reste la liste que lit `seqPreset` :
elle n'est pas réduite, elle n'est plus **proposée**. Les sept autres restent atteignables là où le
rythme se travaille vraiment — en dessinant dans le séquenceur, qui est justement le geste que
l'utilisateur dit préférer.

**Dans le groupe Son, pas dans « Options avancées ».** Première pose ratée de ma part : je l'avais
mis dans le repli. Un réglage qu'on ne pose qu'une fois n'est pas pour autant un réglage à cacher —
il remplace deux boutons qui étaient, eux, sous les yeux en permanence. L'enterrer derrière un repli
revenait à le supprimer.

### Le défaut que le banc a trouvé, et que la lecture n'aurait pas vu

`exitEditMode` ne remettait pas la préférence dans `#playStyle`. Conséquence : on ouvre un vieil
accord en croches détachées, on le referme, on ajoute un accord — **et il naît en croches détachées**,
malgré une préférence réglée sur « une note tenue ».

Ce défaut existait déjà avant ce lot. Il était simplement **visible** : le bouton Rythme affichait la
valeur restée en place. En retirant le bouton, on a retiré le témoin sans retirer la fuite. C'est le
motif exact qu'il faut retenir : **supprimer un affichage ne supprime pas ce qu'il affichait** — ça
rend muet un état qui continue d'agir. Corrigé au même endroit qui remet déjà l'intensité et les
notes libres à zéro, pour la même raison.

### Un filet sans porte, dit à voix haute

Plus rien n'émet `change` sur `#playStyle` : le champ est masqué, et `setRythmeDepart` écrit sa valeur
**sans** émettre l'évènement — exprès, sinon changer un réglage global effacerait le rythme dessiné de
l'accord ouvert. L'écouteur `onchange` (et le `pushSeqUndo` qui le rend annulable, correctif d'un
défaut mesuré au lot A) ne protège donc plus aucun geste réel.

Il est **gardé**, et c'est écrit dans le code plutôt que laissé à découvrir : c'est le seul endroit
cohérent pour « #playStyle a changé, le motif doit suivre, et ça doit rester annulable ». Le
supprimer obligerait à le réécrire au premier lot qui redonnerait un moyen de changer le rythme d'un
accord existant — et ce lot-là oublierait sans doute le `pushSeqUndo`. Le banc qui l'éprouve
(`rythme_duree_test` section D) porte le même avertissement : c'est une garantie de **moteur**, pas de
câblage.

### Le nom de classe partagé, piège invisible dans un diff

Le menu d'intensité posé au lot précédent porte les classes `.playstyle-dd-menu` et
`.playstyle-dd-item` — il avait repris l'habillage du menu de rythme. Nettoyer « tout ce qui commence
par `.playstyle-dd` » l'aurait laissé **sans fond, sans cadre et sans ombre**, en `position: fixed`
par-dessus la grille. Rien dans le diff ne l'aurait montré. Seules les cinq règles du **bouton** sont
parties ; celles du **menu** restent, avec le commentaire qui explique pourquoi le nom ment.
Une section entière du nouveau banc ne vérifie que ça.

### Un banc renommé plutôt que supprimé

`seq_tiroir_motifs_test` éprouvait le raccourci de motifs dans le tiroir. Son sujet n'existe plus.
Mais il avait établi une garantie qui ne dépendait pas du bouton : **agir depuis la barre d'outils du
tiroir ne referme pas le tiroir** — piège réel du gestionnaire de clic-à-côté, et sur téléphone un
tiroir qui se referme à chaque geste rend le séquenceur inutilisable au doigt. Il devient donc
`seq_tiroir_barre_outils_test`, recentré sur cette garantie-là, et vérifie au passage l'absence du
raccourci. Supprimer le fichier aurait emporté la garantie avec le bouton.

**Et une erreur de seuil, de mon fait.** Mon premier jet exigeait 26px de haut pour tous les boutons
de la barre : deux échouaient à 30x15. Ce n'était pas la barre qui avait tort mais le seuil — les
deux boutons de zoom horizontal sont **empilés** dans un cadre commun de 30x30, choix de conception
antérieur. Ils sont donc mis à part **en étant nommés**, pour qu'un troisième petit bouton qui
apparaîtrait un jour fasse bien rougir ce banc.

### La méta-suite lisait les commentaires comme du code

Le balayage du Lot 2 a sorti un rouge auquel je ne m'attendais pas : `meta_suite_test` signalait que
`rythme_une_preference_test` appelait `window.app.addChord()`, méthode absente de `script.js`. Le banc
ne l'appelle pas — **il explique pourquoi il ne l'appelle pas** :

> `// Le vrai bouton, pas window.app.addChord() : un bouton qu'on ne peut atteindre qu'en appelant la
> // fonction derrière n'est pas un bouton.`

C'est le pire genre de faux rouge, parce qu'il pousse à **contorsionner une phrase pour plaire à une
expression régulière**, ou pire, à effacer l'explication. Un garde-fou qui punit les commentaires
finit par les faire disparaître — et ce sont eux qui portent le *pourquoi*.

Corrigé à la source : les cinq relevés travaillent désormais sur une copie **sans commentaires**.
Une accolade citée dans un commentaire ne fausse plus le comptage de la section 5, un identifiant
donné en exemple ne compte plus comme une visée.

**Et l'ampleur était bien plus grande qu'un fichier.** Le nettoyage a fait tomber sept AUTRES bancs
de la liste — `continuous_scroll`, `grid_loupe_pinch_undo`, `pinch_smoothness_centering`,
`pinned_seq_toolbar`, `retour_a_sa_place`, `seqplay_looprange`, `three_more_features` — plus deux
« erreurs avalées » fantômes dans `sortie_edition_involontaire`. Huit améliorations d'un coup : la
dette qu'ils affichaient n'existait pas. Un relevé qui compte des choses fausses ne se contente pas
de faire du bruit, il **cache le vrai** : neuf entrées à ignorer, ce sont neuf raisons de ne plus
regarder la liste du tout.

## Le son appartient au morceau, plus à l'accord

> « On va simplifier les types d'instruments : à définir une fois dans morceau uniquement, et tout le
> morceau prendra cet instrument, je ne ferai jamais de mélange. À cacher une fois modifié (dans la
> popover morceau). »

**Trois mécanismes pour un réglage qui ne varie jamais.** Le son était écrit dans CHAQUE accord
(`data.instrument`), présélectionné par une clé d'appareil (`harmohubInstrument`), et recopiable
partout par un bouton « pot de peinture ». Il n'en reste **qu'un** : le champ `instrumentMorceau` du
morceau. Le `<select id="instrument">` a gardé son identifiant et son rôle de source de vérité ; seule
son autorité a changé — il ne décrit plus l'accord ouvert mais le morceau entier.

### Un champ NEUF, et pas l'ancien réutilisé

`song.instrument` existait déjà. Le tenter aurait été l'erreur : il voulait dire **autre chose** —
« le son du PROCHAIN accord ajouté à ce morceau », posé implicitement par le dernier accord touché.
Le relire comme le son du morceau ferait d'un choix accidentel la couleur de l'œuvre entière.

Un champ neuf distingue sans ambiguïté :
- **écrit avant** (aucun `instrumentMorceau`) → Piano, repli neutre, un geste pour en changer ;
- **enregistré depuis** → le champ fait foi.

C'est le choix retenu par l'utilisateur (« Toujours Piano » pour l'existant), et c'est aussi le plus
défendable techniquement. Les anciens champs restent dans les fichiers, **inertes** : on ne réécrit
pas des morceaux enregistrés pour effacer une donnée devenue muette.

### J'ai supprimé 4516 lignes, et `node --check` n'a rien vu

Le pire incident de ce chantier, et il est entièrement de mon fait. Mon script de retrait coupait de
`// Applique le son actuellement choisi…` jusqu'à la première occurrence de :

```
            }
        }
    }
```

Ce motif — trois fermetures d'accolade et une ligne vide — **n'a rien d'unique dans un fichier de
17 000 lignes**. Il a matché des milliers de lignes plus loin et emporté **4516 lignes**, soit un
quart de l'application. Le fichier restait syntaxiquement valide : `node --check` est passé sans
broncher, exactement comme le jour du bouton « … ».

Deux règles en sortent, et la seconde est nouvelle :

1. **Un marqueur de fin fait de ponctuation générique n'identifie rien.** Pour couper une méthode, on
   trouve sa ligne d'ouverture et on **suit ses accolades** jusqu'à l'équilibre. Le script réécrit le
   fait, et il a mesuré 31 lignes — la bonne taille.
2. **Un script de retrait doit refuser de déraper.** Il compte les lignes avant et après, et **lève une
   erreur au lieu d'écrire** si la variation dépasse un plafond plausible. Une coupe qui part de
   travers s'arrête d'elle-même. C'est ce garde-fou qui manquait : le premier script aurait été stoppé
   net par un plafond à 60 lignes.

Rattrapé par `git checkout` — le travail non commité du lot a été refait, ce qui est le vrai coût de
l'incident. Rien n'est parti dans un commit.

### Ce qui est éprouvé, et ce que ça a demandé aux bancs existants

Le nouveau banc `instrument_du_morceau_test` (19/19) va jusqu'au **bout du fil** : sa section E
intercepte `getInstrument` pendant une vraie lecture et vérifie que **rien d'autre** que le son du
morceau n'est demandé à la banque de sons. Une valeur bien rangée dans le stockage ne prouve pas
qu'elle est jouée.

Quatre bancs ont dû être adaptés, et chacun pour une raison de fond :

- `filet_moteur_edition_test` : l'instrument quitte la liste des réglages qui FONT un accord — il
  n'écrit plus rien dans un accord, il n'y a plus de champ à comparer ;
- `filet_sequenceur_et_sortie_test` : il quitte la liste des commandes de la carte, comme l'intensité
  au lot précédent — deux départs, la même raison ;
- `live_loop_update_test` : sa section 5 appelait `applyInstrumentToSong()`. Elle passe désormais par
  le **vrai évènement du sélecteur** et éprouve la même chose qu'avant, qui est ce qui compte : changer
  le son pendant la lecture ne redémarre pas la boucle ;
- `probe_instrument_tout_test` → `probe_instrument_pendant_edition_test`. Son bouton a disparu, **mais
  pas le danger qu'il gardait** : l'appel mort à `syncGridZoomPinnedSeq` s'était caché dans la branche
  « un accord est en cours d'édition », et changer le son pendant une modification touche toujours au
  séquenceur. Le banc vise donc la nouvelle porte.

**Et une erreur de banc, encore la même famille.** Ma première version de ce dernier affirmait « le
séquenceur est toujours là » sans l'avoir ouvert : `.seq-grid` était absent AVANT comme APRÈS, et le
banc accusait le changement de son d'une disparition qui n'avait jamais eu lieu. Corrigé en relevant
l'état **avant** — un relevé « avant » rend ce genre d'accusation impossible.

## Une seule carte « Accord » : la carte « Lecture » a disparu

> « Vu qu'on a bien réduit tout ça, je pense que le volet "Lecture" n'a plus trop d'intérêt. Tout
> regrouper dans un seul volet Accord. Qu'en penses-tu ? »

**Mesuré avant de répondre, et les chiffres lui donnent raison.** La carte Lecture portait quatre
réglages : le son, le rythme, la durée, l'intensité. **Trois l'ont quittée en trois lots successifs** —
l'intensité au menu contextuel de l'accord, le rythme aux Paramètres, le son aux réglages du morceau.
Il restait un titre, un en-tête, un liseré et une bordure **pour un seul réglage**. Un titre de carte
annonce un sujet ; « Lecture » n'en annonçait plus aucun.

**Et la séparation était déjà fausse.** Les deux cartes décrivaient le MÊME objet — l'accord sous les
yeux — et la feuille de style le disait déjà noir sur blanc : liseré de sujet commun, teinte de fond
commune, classe `subject-existing` posée sur leur conteneur partagé. Le banc `inspecteur_sujet_test`
vérifiait même explicitement que les deux liserés étaient **identiques**. Deux cadres autour d'un seul
sujet : la cloison ne séparait rien.

### Le gain, mesuré des deux côtés

Rejoué à l'identique sur le commit précédent (worktree servi sur le port 8935), hauteur des deux
cartes **plus leur écart**, de haut en bas :

| | Avant | Après |
|---|---|---|
| Ordinateur, Ajout | 297px | **227px** |
| Ordinateur, Modification | 249px | **179px** |
| Téléphone, Ajout | 310px | **232px** |
| Téléphone, Modification | 265px | **184px** |

Soit **70 à 81px** rendus à la grille — un en-tête de carte, une bordure et un écart entre cartes.

### Rien n'a bougé À L'INTÉRIEUR, et c'est ce qu'il fallait éprouver

La rangée de durée, les quatre champs sources masqués, la barre du séquenceur et le séquenceur
lui-même sont exactement là où ils étaient, dans le même ordre : seule la cloison a disparu. Le bouton
du séquenceur a rejoint l'en-tête d'Accord, désormais le seul.

**Une fusion qui laisse un morceau derrière ne se voit pas à l'œil** : un champ source oublié ne casse
rien tant que personne ne le lit — jusqu'au jour où l'export MIDI le cherche. La section A du banc
vérifie donc le déménagement **pièce par pièce**, y compris les quatre champs masqués.

### Le banc a changé de nom parce que son sujet a changé de nature

`lecture_meme_principe_test` → `carte_accord_unique_test`. Il éprouvait que la carte Lecture avait pris
la FORME de la carte Accord, à la demande « mets en place le même principe de menu que pour accord au
dessus ». Ce travail n'est pas annulé : **il est mené à son terme**. Deux cartes qui finissent par se
ressembler en tout point ne sont pas deux cartes.

Ses vérifications de forme (mêmes classes, étiquette au-dessus, cibles tactiles, vrai appui sur la
durée) sont conservées telles quelles — elles gardent tout leur sens à l'intérieur de la carte unique.

Trois autres bancs visaient `#lecture-card` et ont été adaptés. Le plus intéressant est
`inspecteur_sujet_test` : il vérifiait que les deux cartes portaient le **même** liseré. Cette
vérification-là ne peut pas simplement être supprimée sans perdre ce qu'elle protégeait — la teinte de
sujet descend d'une variable posée sur le conteneur commun. Elle vise donc désormais cette variable
directement, et exige qu'elle **diffère** entre Ajout et Modification : c'est le fond de l'affaire,
et ça reste vrai avec une carte comme avec deux.

### Le balayage a trouvé une régression du Lot 3, et le banc a mis quatre mesures à me la faire dire

Le balayage complet a sorti `reglages_morceau_popover` : « téléphone : le panneau recouvre 2 % de la
carte de l'accord édité ». La garantie protégée est explicite et ancienne : **on peut régler le tempo
sans perdre de vue l'accord qu'on est en train d'éditer**.

**Ce n'était pas le Lot 4.** Rejoué sur le commit du Lot 4 puis sur celui d'avant le Lot 3 (worktrees
servis sur un second port) : vert avant le Lot 3, rouge après. C'est la section « Son » ajoutée aux
réglages du morceau qui a fait passer le panneau de ~346px à **417px**.

**Et le code portait l'hypothèse en toutes lettres**, dans un commentaire de `placerReglagesMorceau` :

> « sur téléphone… on retombe sur le placement vertical, où le chevauchement ne se produit pas (la
> carte de l'accord y est bien plus bas, hors du panneau) »

Elle était vraie le jour où elle a été écrite. **Une hypothèse sur une hauteur ne survit pas au premier
réglage ajouté** — et elle tombe en silence, puisque rien ne la revérifie. Elle est remplacée par une
mesure : le panneau est plafonné à la place réellement disponible jusqu'au haut de la carte. Ça ne
coûte rien, il défile déjà en lui-même.

**Trois fausses pistes avant la bonne, et c'est la partie instructive.** Le premier correctif n'a rien
changé : toujours 2 %. J'ai cru à un ordre de calcul, puis à une carte qui bougeait d'une frame à
l'autre, et j'ai ajouté une seconde passe — toujours 2 %. En instrumentant enfin la fonction
elle-même plutôt qu'en raisonnant dessus, la cause est apparue en une ligne :

```
DBG appel: top=212px max=417px acTop=637 panH=417
```

`style.top` valait **212**, le bord rendu **224**. `.song-settings` porte un `margin-top: 12px` qui,
sur une boîte `position: fixed`, décale encore le rendu. Je calculais depuis la valeur que je venais
de POSER, pas depuis le bord réellement DESSINÉ — 12px d'écart, moins la marge de 8, soit les 4px de
chevauchement, soit les 2 %.

La leçon n'est pas « attention aux marges sur les boîtes fixes ». C'est : **j'ai passé trois
tentatives à corriger des causes que j'avais imaginées, alors qu'une seule ligne de relevé dans la
fonction donnait la réponse.** Le réflexe de mesurer l'application, appliqué partout ailleurs dans ce
journal, je ne l'avais pas appliqué à mon propre correctif.

`hautPanneau` se lit désormais dans `getBoundingClientRect()`. Chevauchement : **0 %**.

### Et la méta-suite avait raison une deuxième fois

Elle signalait `probe_instrument_pendant_edition_test` comme nouveau banc sans `plan()`. Il comptait
ses PASS/FAIL à la main — forme qu'il avait toujours eue, sauf que je venais de le **réécrire
entièrement** : l'argument « on n'y touche pas » ne tenait plus. Repousser la référence aurait été
enterrer le signal. Il est converti au harnais, avec `plan(8)` et un `exiger()` sur sa prémisse.

## Deux portes vers le séquenceur, et toutes deux portent un nom

> « Le bouton agrandir est pas mal, mais il fait la même chose que le bouton séquenceur déjà présent.
> Tu peux laisser uniquement le bouton agrandir car il est plus visible. Renomme-le en "Séquenceur".
> Il faut l'abaisser un peu, il colle d'autres boutons. Mettre le même bouton au-dessus de la grille
> au lieu du logo peu clair, mais en moins large. Par exemple "Séq." ? »

**Trois portes, aucune nommée.** Un pictogramme de barres dans l'en-tête de la carte (vue compacte),
**le même pictogramme** au-dessus de la grille (vue d'ensemble), et une loupe « Agrandir » qui
n'apparaissait qu'une fois le séquenceur déjà ouvert. Deux dessins identiques pour deux vues
différentes, et un troisième bouton dont le mot décrivait un geste, pas une destination.

Il en reste deux, et chacune dit où elle mène :

| | Où | Ce qu'elle ouvre |
|---|---|---|
| **« Séq. »** | au-dessus de la grille | la vue d'ensemble (mode continu) |
| **« Séquenceur »** | dans la carte Accord | le plein écran sur l'accord ouvert |

### Le piège de ce lot : une porte qui rend la main sans rien faire

`openSeqZoom()` commence par `if (!this.seqOpen) return`. C'était juste tant qu'un AUTRE bouton se
chargeait d'ouvrir, et que celui-ci ne faisait qu'agrandir l'existant. Ce bouton n'existe plus : sans
correctif, « Séquenceur » n'aurait **rien fait du tout** au premier clic — et rien n'est plus
silencieux qu'un bouton qui rend la main. D'où `ouvrirSequenceurPleinEcran()`, qui ouvre puis
agrandit.

Elle ne **bascule** pas, et c'est délibéré : passer par `toggleSequencer` sans condition ferait du
second appui sur un bouton nommé « Séquenceur » une fermeture, ce qu'aucun mot n'annonce. Le banc
l'éprouve explicitement.

### Encore la même famille de piège CSS

« Séq. » mesurait **120px** — presque trois fois le logo de 44px qu'il remplace, dans une barre déjà
chargée. Cause : la règle générique `button { flex: 1; min-width: 120px }` de la feuille. C'est
exactement le `select { flex: 1 }` qui avait écrasé la hauteur du menu de basse : **une règle
d'élément qui gagne en silence sur l'intention d'une classe**. Neutralisée explicitement ; le bouton
fait 47px, l'ordre de grandeur de ce qu'il remplace.

Trouvé en relevant les styles **effectivement appliqués**, pas en relisant la feuille — le `flex: none`
que j'avais posé stoppait bien l'étirement, et masquait donc la moitié du problème.

### Un seuil relevé, dit à voix haute

La fusion du lot précédent avait ramené la carte Accord à **227px**. Ce lot en reprend **39** : la
porte « Séquenceur » ne s'affichait qu'une fois le séquenceur déjà ouvert, elle est devenue
permanente, et on l'a descendue de 14px pour qu'elle ne colle plus la rangée du dessus. Le seuil du
banc passe donc de 250 à 285px.

Relever un seuil pour faire passer un banc est exactement ce qu'il ne faut pas faire **en silence** :
c'est écrit dans le banc, avec le chiffre d'avant et la raison. **266px pour une carte contre 297 pour
deux**, avec un accès nommé toujours sous les yeux au lieu d'un pictogramme qui apparaissait après
coup — c'est un choix, pas une dérive.

### Vingt-sept bancs, deux traitements

`#toggle-sequencer` était cliqué par 27 bancs. Pour **23 d'entre eux, c'était de l'échafaudage** :
ouvrir le séquenceur avant d'éprouver autre chose (glisser une note, mesurer une barre, écouter un
temps). Leur sujet n'a pas bougé ; ils passent par `toggleSequencer('compact')`, qui a exactement la
même sémantique de bascule que le clic remplacé.

Les **quatre autres avaient ce bouton pour SUJET** et ont été repris un par un — eux doivent viser les
nouvelles portes, pas les contourner. Deux détails que seul un passage à la main pouvait voir :

- `filet_sequenceur_et_sortie` clique la commande puis enchaîne. « Séquenceur » ouvrant désormais le
  **plein écran**, celui-ci recouvrait la carte et le clic suivant serait tombé sur son fond. La
  remise en état entre deux essais referme donc le plein écran.
- `probe_deux_boutons_seq` éprouve la vue **compacte** : il referme le plein écran juste après
  l'avoir ouvert, pour retrouver la vue qu'il mesure.
