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

## Lot 1 : sur téléphone, la grille remonte de 57px

Mesure d'avant-travaux sur iPhone 13 (390x664) : la grille d'accords commençait à **376px** du haut,
soit 57 % de l'écran passé avant d'apercevoir le premier accord. Après le lot : **319px** (48 %).
Retour utilisateur à l'origine : « Sur téléphone, il est également mal placé au-dessus des accords. »

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

Les deux titres sont **masqués à l'œil, pas retirés** : ils restent dans l'arbre d'accessibilité. Le
banc `mobile_grille_plus_haut_test` (13 vérifications) éprouve aussi bien le gain que les deux
contreparties refusées — un nom ordinaire entièrement lisible, et les titres toujours annonçables —
précisément parce que la solution écartée est plus alléchante en chiffres et donnera envie d'y revenir.

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
