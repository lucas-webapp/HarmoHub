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

**Suite donnée** : les cinq ont été instruits (voir la section qui clôt ce journal). Quatre étaient
périmés, un cachait une fonction réellement cassée. **La ligne de base tombe donc de 12 rouges à 7** :
`probe_clic_accord_voisin`, `probe_defilement_tactile`, `probe_regle_voisins`, `probe_seq_finitions`,
`real_click_loupe_selection`, `seq_notes_libres_clavier`, `seq_selection_et_cadre_diagrammes`.

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

## Un seul aspect de bouton dans le volet de gauche

> « Je veux que tous les boutons du volet de gauche aient l'aspect sombre que tu viens de mettre en
> place pour les nouveaux boutons, c'est plus joli. »

**Mesuré avant de dessiner quoi que ce soit**, en relevant les styles *réellement appliqués* bouton par
bouton dans le navigateur : **20 boutons visibles, DIX familles d'aspect distinctes**. Fonds `#1c2027`,
`#16191e`, rgba blanc à 3,5 %, transparent ; avec dégradé ou sans ; cadres `#333`, vert, rouge ; rayons
0, 7, 8, 10 et 999px.

Personne n'avait dessiné ça. C'est le dépôt de quinze lots successifs, chacun ajoutant sa nuance sans
regarder la précédente — et c'est exactement pourquoi l'utilisateur le voit alors que la feuille de
style, lue rule par rule, paraît cohérente.

**Résultat : trois familles**, sur ordinateur comme sur téléphone.

| Famille | Membres | Pourquoi elle existe |
|---|---|---|
| Référence sombre | 8 | `#16191e` plat, cadre 1px, rayon 7px, ni dégradé ni ombre |
| Sélecteur segmenté | 7 | cases transparentes DANS un cadre commun — c'est le cadre qui porte l'aspect |
| Actions colorées | 2 | Ajouter et Enregistrer : la couleur est un **signal**, pas une décoration |

### Ce qui garde sa couleur, et pourquoi la question a été posée

« Tous les boutons » pouvait se lire de deux façons. Question posée, réponse retenue : **Ajouter et
Enregistrer restent verts**, Stop reste rouge. Leur couleur dit ce qu'ils font — l'uniformité totale
aurait obligé à *lire* chaque bouton pour retrouver ce qu'un coup d'œil donnait. Ils adoptent en
revanche la même **forme** : fond plat, cadre 1px, rayon 7px.

### Le bandeau de lecture : exclu franchement, pas à moitié

Mon premier jet y incluait Lecture et Stop. Le dégradé disparaissait mais **pas leur rayon de 10px**,
et ils se retrouvaient à mi-chemin entre deux familles — le pire état possible. `#global-transport`
n'est pas un bouton de volet : c'est une barre **flottante** au-dessus de toute l'application, avec sa
propre échelle (52px contre 32). Elle est laissée entièrement tranquille, `#toggle-loop-section`
compris, qui y vit aussi : **une barre à moitié convertie serait pire que pas de conversion.**

### Le séquenceur exclu aussi, et c'est éprouvé plutôt qu'affirmé

`#arp-sequencer` **voyage** : il vit dans la carte Accord sur téléphone et sous la grille sur
ordinateur (`placeSequencer`). Une règle scopée `.col-left` l'aurait donc repeint **sur un format
seulement** — un même outil avec deux aspects selon la largeur de l'écran. La section D du banc relève
sa barre d'outils sur les deux formats et exige qu'elles soient identiques.

### Deux défauts que seul le relevé des familles pouvait montrer

**1. Enregistrer avait perdu son vert.** `.col-left .icon-btn` (0,2,0) l'emporte sur `.icon-btn-accent`
(0,1,0) : le bouton était passé dans la famille neutre sans que rien ne le signale. Corrigé par un
`:not(.icon-btn-accent)` explicite.

**2. « Ajouter » était devenu GRIS.** Celui-là est le plus instructif : `.btn-green` tire son vert du
**dégradé**, pas de son `background-color` — lequel vaut le gris hérité de la règle générique. Poser
`background-image: none` retirait donc la couleur en même temps que le relief, et laissait un bouton
gris à liseré vert. **Je ne l'ai pas vu en relisant la feuille** ; c'est le banc qui l'a montré, en
comptant quatre familles au lieu de trois.

### Pourquoi ce banc compte des familles plutôt que des valeurs

Vérifier « ce bouton-ci a bien tel fond » ne dit **rien** de l'homogénéité : on peut passer douze
vérifications de ce genre avec douze aspects différents. Le banc relève l'aspect de **chaque** bouton
et compte les familles distinctes. C'est la seule forme qui échoue quand un lot futur réintroduira une
nuance de plus — c'est-à-dire quand le défaut qu'on vient de corriger recommencera.

Et la référence est **lue sur le bouton que l'utilisateur désigne** (le menu de durée), pas recopiée
en valeurs dures : si elle change un jour, le banc suit au lieu de mentir.

## Les cinq bancs rouges instruits : quatre périmés, un vrai défaut

> « Continuer, instruire après. »

Les cinq rouges relevés à la fin du lot 1 étaient restés en suspens, avec une consigne claire : ne pas
les tolérer, trancher pour chacun entre **banc périmé** et **fonction cassée**. Verdict après mesure :
**quatre bancs périmés, une fonction réellement cassée** — et c'est le cinquième qui justifie à lui
seul d'avoir posé la question.

### La règle appliquée aux quatre premiers : retourner le banc vers le geste réel, jamais le supprimer

| Banc | Ce qu'il exigeait | Ce qui est vrai aujourd'hui |
|---|---|---|
| `avant_seq_snap_sticky` | régler l'aimantation sur 1/4 puis 1/8 | le sélecteur a été **retiré par décision** : le pas vaut la case |
| `sidebar_collapse` | le transport dans l'en-tête de la grille | il est **revenu dans le volet**, à la demande |
| `loupe_and_tap_fix` | un clic charge l'accord en modification | un clic **sélectionne**, un double-clic charge |
| `multirow_loop` | un appui-relâché pose une plage de boucle | la plage se pose par un **vrai glissé** sur la règle |

Aucun n'a été supprimé : chacun a été **retourné vers ce qui reste vrai** et qui compte encore. Le banc
d'aimantation, par exemple, éprouve désormais qu'**aucun recalage ne s'interpose** entre le geste et
la case visée — c'est-à-dire exactement la propriété au nom de laquelle le sélecteur avait été retiré.
Deux bancs sont renommés, parce qu'un nom qui désigne une fonction disparue (`loupe`, `tap`) est un
piège pour la prochaine lecture : `grille_clic_et_double_clic` et `grille_raccourcis_clavier`.

### Une tautologie démasquée au passage

`loupe_keyboard` avait un point « flèche gauche : la modification revient sur l'accord 1 » qui
**passait au vert**. Il passait parce que `editingIndex` valait déjà 1 et n'avait jamais bougé : le
banc n'exigeait rien. Un vert peut donc être plus creux qu'un rouge — le rouge, lui, se signale.

### Le vrai défaut : les flèches mouraient dès qu'un accord était ouvert

C'est en retournant ce banc-là que la fonction cassée est apparue. `activeGridChordIndex()` rend
`editingIndex ?? selectedIndex`, et les flèches ← → repartaient de **ce** repère à chaque appui. Une
fois un accord ouvert en modification — l'état le plus banal qui soit, il suffit d'un double-clic — le
point de départ ne bougeait plus jamais :

```
en édition, départ : {sel: null, ed: 1}
  droite x1 : {sel: 2, ed: 1}
  droite x2 : {sel: 2, ed: 1}   ← le 2e appui ne fait plus rien
  droite x3 : {sel: 2, ed: 1}
```

Le premier appui marchait, ce qui rendait le défaut discret : il fallait appuyer **deux** fois pour le
voir. Les flèches se calent maintenant sur la sélection verte (`selectedIndex ?? editingIndex`).
Mesuré : un vrai double-clic pose les deux repères sur la même case, donc **le premier appui ne change
pas**, et les suivants avancent enfin. Ce qui doit rester ancré à l'accord ouvert le reste :
Maj+← → étire bien la case **ouverte**, Suppr efface bien l'accord **ouvert**.

### Ce que cet épisode dit de la ligne de base

Ces cinq bancs étaient rouges depuis plusieurs commits, tolérés comme « préexistants ». Instruits, ils
donnent un défaut réel qui touchait un geste quotidien. **Une ligne de base n'est pas un classement,
c'est une dette** : tant qu'un rouge n'est pas expliqué, on ignore s'il garde un banc mort ou une
fonction morte.

### Deux bancs renommés, une dette qui change d'étiquette sans grossir

`meta_suite` a signalé « deux nouveaux bancs sans `plan()` » : ce sont les deux renommés, déjà comptés
comme dette sous leurs anciens noms. La référence a été refigée (`--maj`), ce que le banc réclamait
d'ailleurs lui-même au même moment — la dette avait **diminué** de deux entrées et il refusait de
laisser filer le gain sans qu'on le fige. Il reste vrai qu'ils n'ont pas de `plan()` : ils comptent
leurs PASS/FAIL eux-mêmes plutôt que de passer par l'harnais. C'est de la dette réelle, inchangée,
et elle attend son tour avec les 127 autres.

## La boucle : un état de la lecture, pas un troisième bouton

> « L'affichage des boutons de lecture n'est pas très beau, notamment le bouton boucle qui est plus
> haut que les autres, et prend trop de place. J'aurais bien vu une option du style : bouton "boucle"
> à l'intérieur du bouton "Lecture" et non à part […] Comment font les DAW professionnels ? »

### Le défaut de hauteur était réel, et sa cause est instructive

Mesuré à 1440px **avant** d'y toucher : Lecture 44px, Stop 44px, **Boucle 52px**. Sur téléphone, les
trois faisaient 52 — le défaut n'existait que sur ordinateur, ce qui explique qu'il ait survécu.

La cause est une collision de spécificité, la même famille de piège que le vert perdu du lot
précédent. La règle d'ordinateur qui rabaisse le transport est `.dock .transport > button` (0,2,1) ;
celle qui dimensionnait la boucle était `.transport #toggle-loop-section` (**1**,1,0). L'identifiant
l'emportait, donc **ce bouton-là, et lui seul, ignorait le rabaissement**. Le retrait du bouton
emporte le défaut avec lui — mais il aurait fallu le corriger de toute façon, et le nommer ici évite
qu'un futur `#quelque-chose` refasse exactement la même chose.

### Ce que font les DAW, et ce qui est repris

**Pro Tools** ne met pas de bouton boucle dans son transport : la lecture en boucle est un état du
bouton Lecture, qui dessine alors une flèche circulaire autour du triangle. **Logic**, **Cubase**,
**Ableton** et **Reaper** gardent un interrupteur, mais font l'essentiel sur la **règle** : on y trace
la zone de cycle, et l'interrupteur s'allume tout seul.

Les deux moitiés sont reprises : **l'anneau de Pro Tools**, et **l'allumage automatique de Logic**.

### Retirer la boucle « une section » a SIMPLIFIÉ la lecture

C'est le point contre-intuitif. `playProgression` construisait sa liste d'accords en trois branches :
la plage, la partie active, tout le morceau. La demande — « soit la plage tracée, soit tout le
morceau […] mais jamais *uniquement une section* » — **supprime la branche du milieu**. Une
fonctionnalité en moins, une branche en moins, et une règle plus facile à énoncer :

| | anneau éteint | anneau allumé |
|---|---|---|
| **plage tracée** | la plage, une fois | la plage, en boucle |
| **pas de plage** | tout le morceau, une fois | tout le morceau, en boucle |

La plage dit **quoi** jouer, l'anneau dit **si ça se répète**. Deux notions orthogonales là où il y en
avait trois qui se chevauchaient.

### La réserve, énoncée plutôt que masquée

Un appui long est **moins découvrable** qu'un bouton visible. C'est le prix de la solution, et il est
payé de deux façons : tracer une plage — le geste qu'on fait déjà — allume la boucle sans rien
demander, et le clic droit double l'appui long sur ordinateur. Si la boucle n'était accessible QUE
par un geste caché, ce serait indéfendable ; le banc éprouve donc explicitement l'allumage
automatique (section C), qui est la vraie porte d'entrée.

### Un dessin vérifié en capture, pas supposé

Premier jet : anneau de 2px sur un rayon de 9. Le triangle qui restait dedans se lisait comme **un
point**. Corrigé après capture à 5× — anneau de 1,7px, triangle porté à 7,4 × 9,6 dans la boîte de 24,
icône passée de 22 à 26px. Le triangle doit rester le sujet du dessin : c'est toujours le bouton
Lecture, l'anneau n'est qu'un état.

### Deux bancs qui visaient le bouton disparu, dont un qui mourait en silence

`global_transport_test` cliquait `#toggle-loop-section` : le clic attendait un bouton absent jusqu'à
expiration, et **les dix vérifications suivantes étaient perdues** — 14 exécutées sur 24 attendues.
C'est exactement ce que `plan()` existe pour attraper, et il l'a attrapé. `item1_2_test` éprouvait le
bleu de ce même bouton. Les deux ont été retournés vers le nouveau geste et le nouveau signe, pas
supprimés.

## Les portes du séquenceur, et sa barre d'outils

> « Le bouton séquenceur dans le volet de gauche ne devrait ouvrir que le "Petit séquenceur", pas le
> grand séquenceur en continu. Sinon, je ne peux jamais ouvrir le petit... »
> « Je propose d'ajouter un bouton loupe dans le petit séquenceur […] D'ailleurs, ça serait l'occasion
> de réorganiser les boutons sous le petit séquenceur. C'est brouillon à l'affichage. »

### Un blocage, pas une préférence

`ouvrirSequenceurPleinEcran()` ouvrait le compact **puis l'agrandissait aussitôt**. La vue compacte
n'était donc visible à **aucun moment** : elle existait dans le code et nulle part à l'écran. Le
rangement est maintenant celui que la demande dessine, et il se lit tout seul :

| porte | où | ce qu'elle ouvre |
|---|---|---|
| « Séquenceur » | volet de gauche | le petit, dans la carte |
| « Séq. » | au-dessus de la grille | la vue continue, en tiroir |
| loupe | **dans** le séquenceur | le plein écran |

La troisième est la bonne trouvaille de l'utilisateur : **agrandir est une opération sur le
séquenceur, sa commande lui appartient**. Et elle disparaît une fois en plein écran — il n'y a plus
rien à agrandir.

### « Brouillon » se mesure : neuf boutons à plat

La barre alignait Lecture, Stop, Boucle, +note, Studio, Pipette, 🗑 tout, 🗑 sélection et le zoom H
**sans aucune césure**, dans un ordre qui mélangeait quatre intentions. Ce n'est pas leur nombre qui
faisait désordre, c'est l'absence de groupement. Elles sont maintenant quatre familles :

**transport** (écouter) · **motif** (fabriquer) · **suppression** (défaire) · **affichage** (regarder)

Bénéfice secondaire et réel : la barre se replie désormais **par famille** au lieu de couper au hasard
entre deux boutons qui n'ont rien à voir.

### Le filet séparateur était une impasse, et la mesure l'a montré

Premier jet : `border-left` sur `.seq-groupe + .seq-groupe`. Mesuré aussitôt à 1440px — le groupe
« suppression » passe à la ligne (gauche 0, haut 40) **en gardant son filet**, soit un trait orphelin
collé au bord gauche de la barre. Exactement le genre de détail qui fait « brouillon », donc le
contraire du but.

Aucun sélecteur CSS ne sait dire « premier de sa ligne ». Le filet n'était pas un réglage à affiner,
c'était une voie sans issue. L'**espacement** ne connaît pas ce problème : 18px entre les familles
contre 8px à l'intérieur — plus du double, largement lu comme une césure, et un groupe seul sur sa
ligne reste simplement un groupe.

### Le vrai piège : deux boucles qui se ressemblent

Le séquenceur a **sa propre** boucle (`seqLoopPlay`), qui répète l'accord en cours d'édition — pas la
même que celle du transport. Les fondre en un seul drapeau aurait été le raccourci tentant : une plage
tracée sur la grille aurait alors mis l'**audition d'un accord** en boucle sans fin.

Ce qui est partagé, c'est le **geste** (appui long / clic droit) et le **signe** (l'anneau). Ce qui ne
l'est pas, c'est l'état : `basculerBoucleSequenceur` regarde ce que le bouton lance *vraiment* — la
grille quand une plage est tracée, l'accord sinon — et bascule le drapeau correspondant. Sans cela,
l'anneau aurait menti la moitié du temps.

*(À noter : le lot précédent avait posé l'anneau du séquenceur d'après l'état global. C'était faux, et
ce lot le corrige.)*

### Deux fonctions propriétaires du même titre

`updatePlayButtonsForLoopRange` écrivait `#play-prog.title`, `syncAnneauBoucle` aussi : **le dernier
appelé gagnait**. Un défaut latent, visible seulement par intermittence — le banc l'a attrapé.
`syncAnneauBoucle` est désormais seule à composer ce libellé, ce qui est cohérent : elle connaît déjà
les deux moitiés de la phrase, ce qui est joué et si ça se répète.

Elle a d'ailleurs produit au premier essai **« Lire la plage à boucler en boucle »** — deux fois le
même mot, parce que l'ancien libellé contenait déjà « à boucler ». La plage se nomme donc par ce
qu'elle est, « la plage tracée », et la répétition est dite une seule fois.

### Cinq bancs retournés vers les nouvelles portes

`portes_sequenceur` (5 rouges), `pinned_seq_toolbar` (l'ordre était lu sur les enfants directs, qui
sont désormais les groupes), `probe_deux_sequenceurs` (cliquait l'ancienne porte, ce qui **refermait**
le panneau et faisait tomber les quatre points suivants), `tap_removal` et `global_transport`. Aucun
supprimé : chacun vise le geste qui a remplacé le sien.

## La durée remonte sur la ligne de l'accord

> « Le bouton "durée" pour un accord dans le volet de gauche prend trop de place pour rien. Est-ce que
> ça te semble être une bonne idée de le remonter au niveau de la définition de l'accord (note et type
> d'accord), en réduisant la largeur des 2 boutons existants sur cette ligne ? »

Oui — et l'argument est plus fort que « ça prend de la place ». Cette rangée ne contenait **plus
qu'elle**. Elle portait trois groupes (jeu, durée, intensité) ; l'intensité est partie au menu
contextuel de l'accord, le rythme dans Paramètres > Son, deux lots plus tôt. Il restait une rangée
entière, son espacement et son étiquette pour **une seule commande**. La durée devient donc la
troisième colonne de `.accord-grid`, et la rangée disparaît.

L'étiquette « Durée » ne suit pas : ses deux voisines n'en ont pas, une seule aurait creusé la ligne —
et « 1 mes. », écrit dans le bouton, dit déjà ce que l'étiquette disait. Le mot reste dans l'infobulle
et l'`aria-label`.

### Une règle d'ordinateur imposait encore deux colonnes

Passer `.accord-grid` à trois colonnes n'a pas suffi : à 1440px la durée **repassait à la ligne**.
Mesuré — grille de 321px, trois colonnes de 157px, débordement garanti. Le bloc `@media` des écrans
larges redéclarait `grid-template-columns: repeat(2, …)` et l'emportait par ordre de cascade.

C'est la troisième fois dans ce journal qu'une règle plus spécifique ou plus tardive annule
silencieusement une intention : le `button { min-width: 120px }` sur « Séq. », le `.col-left .icon-btn`
sur le vert d'Enregistrer, celle-ci maintenant. **Le réflexe qui marche est toujours le même : mesurer
le rendu, jamais relire la feuille en espérant voir le conflit.**

### Ce que le déplacement change vraiment en Modification

En Modification, la durée s'efface (elle se règle alors en tirant le bord de la case dans la grille).
Avant, cela rendait **de la hauteur** — une rangée entière. Maintenant, cela rend de la **largeur** :
la ligne repasse à deux colonnes et les deux menus récupèrent la place, mesuré 102px → 157px.

C'est exactement ce que le lot cherchait, mais il fallait ajuster le banc : `carte_accord_unique`
exigeait encore que la carte maigrisse de 30px en Modification. Réclamer ce gain-là revenait à
réclamer la rangée qu'on venait de supprimer.

### Cinq sections de bancs retournées, et un banc qui mourait à mi-parcours

`carte_accord_unique` visait `#lecture-row` dans quatre sections différentes : la première le trouvait
absent et **le banc s'arrêtait là** — 10 vérifications sur 21 attendues. Sa section B comparait « les
deux rangées » pour montrer qu'elles partageaient les mêmes classes ; il n'en reste qu'une, donc la
comparaison n'éprouvait plus rien. Elle vérifie désormais ce qui reste le fond de l'affaire : **une
seule grammaire de rangée dans cette carte**, et la durée bien arrivée là où on l'attend.

`rythme_duree` visait `.voicing-group-duree`, le groupe disparu avec la rangée ; il vise la commande.

## Le popover Morceau : la hiérarchie était à l'envers

> « Pas besoin des titres de chapitre, il y a déjà des répétitions. […] Les flèches de transposition
> peuvent être positionnées à droite de la tonalité […] Garde à l'idée qu'il faut quelque chose
> d'harmonieux et PRO, comme un vrai DAW. On ne doit pas se perdre dans le popover. »

### La mesure explique le « on se perd » mieux que l'impression

Relevé avant d'y toucher : les **titres** de chapitre faisaient **12,8px**, les **étiquettes** de champ
**14,1px**. Les étiquettes étaient donc *plus grosses* que les titres censés les chapeauter.

C'est une hiérarchie inversée, et elle suffit à expliquer une bonne part de la sensation : dans un
panneau où le chapitre pèse moins que le nom du champ, rien ne dit ce qui commande quoi, et l'œil n'a
pas d'ordre de lecture. La gradation est maintenant celle d'un panneau de DAW — **titre (12,8) >
étiquette (11,5) > valeur** — et c'est la valeur qu'on lit, ce qu'on vient chercher.

Le banc éprouve la relation, pas les nombres : « chaque étiquette est plus petite que les titres ».
Une valeur en dur rougirait au premier changement de police ; la relation, elle, est le vrai contrat.

### Deux titres retirés, deux gardés — et le critère n'est pas le nombre

« Tempo » redisait le mot du champ juste en dessous (« Tempo : 120 BPM ») ; l'étiquette « Instrument »
redisait le titre « Son » juste au-dessus. **Un titre qui redit son premier champ ne range rien, il
ajoute une ligne.**

« Son » et « Tonalité » restent : ils nomment une **famille**, pas leur premier champ. C'est le
critère, et il vaut mieux que « en enlever le plus possible ».

### La transposition rejoint la tonalité, et un filet remplace le mot

Elle occupait une ligne à elle seule avec le mot « Transposer ». Or transposer, **c'est** changer la
tonalité : les deux gestes appartiennent à la même ligne, et c'est ainsi que les DAW les rangent. Les
deux menus se resserrent pour faire la place — fondamentale 93 → 60px, mode 131 → 67px, exactement ce
qui était demandé.

Le mot disparaît, et c'est le compromis assumé du lot : deux flèches haut/bas contre un sélecteur de
tonalité se lisent comme une transposition dans n'importe quel logiciel de musique, mais **moins vite
qu'un mot**. Deux compensations : l'infobulle en toutes lettres, et surtout un **filet** à leur
gauche. Sans lui, on aurait quatre pictogrammes d'affilée — « ⋯ », la baguette, puis les deux flèches
— que rien ne distingue, et transposer passerait pour un réglage de tonalité de plus. Le filet fait le
travail que le mot faisait : dire qu'on change de famille.

### Résultat mesuré

Le panneau passe de **396px à 330px** de haut, soit 17 % de moins, sans qu'aucune commande ne
disparaisse. Et la ligne de tonalité porte maintenant **six** commandes : c'était le vrai risque du
lot, donc le banc mesure au doigt qu'aucune ne descend sous le seuil tactile (relevé : 60×36, 67×36,
30×36, 38×38, 38×38, 38×38) et que rien ne déborde.

## Les diagrammes rangés comme un inspecteur

> « Il me semblerait logique de placer les boutons à droite de l'accord "guitare" au lieu d'en-dessous.
> Par exemple : premier niveau de boutons avec choix accord + verrou ; 2ème niveau de boutons avec le
> bouton "éditer manuellement". »
> « Je propose d'augmenter très légèrement les dimensions du diagramme Piano, qui fait petit par
> rapport au manche de guitare. »

### Le relevé justifie les deux demandes d'un coup

Manche **119×70** — haut et étroit. Piano **165×32**. Commandes du manche : larges et plates.

Deux conséquences, et l'utilisateur les avait vues toutes les deux. D'abord les commandes empilées
sous le manche **allongeaient la colonne déjà la plus haute** des deux, alors qu'un vide existait à
côté. Ensuite le piano était **deux fois moins haut** que son voisin, ce qui le faisait passer pour
l'accessoire de la paire.

Les commandes passent donc à droite — l'objet à gauche, ses réglages à droite, la disposition d'un
inspecteur de DAW — et le piano monte à **44px de haut, 210 de large**. Il reste sous les 48px d'une
passe antérieure, et bien sous les 70 du manche : « très légèrement », comme demandé. La largeur des
touches suit (11 → 14px par blanche) parce que grandir en hauteur seulement aurait donné des touches
encore plus trapues — c'est la **silhouette** qu'on corrige, pas juste la taille.

**Résultat mesuré : la carte passe de 134 à 98px de haut**, avec un piano plus grand dedans.

### Deux niveaux, et le découpage dit quelque chose

Niveau 1 : ‹ 1/3 › et le verrou — deux commandes qui parlent du **même choix**. Niveau 2 : l'édition
manuelle, seule. Les mettre tous sur une ligne mélangeait « regarder » et « modifier ».

### Quatrième collision de cascade du même genre

`.guitar-controls-cote { align-items: stretch }` ne s'appliquait pas : `.guitar-controls-row`
(même spécificité 0,1,0) pose `align-items: center` et se trouve **déclarée plus bas** dans la
feuille. Mesuré — le niveau du bouton d'édition faisait 40px au lieu des 144 de sa colonne. Résolu en
passant à deux classes (0,2,0).

C'est la quatrième fois dans ce journal : `button { min-width: 120px }` sur « Séq. », `.col-left
.icon-btn` sur le vert d'Enregistrer, le `@media` d'ordinateur sur les colonnes de la ligne d'accord,
celle-ci. **Aucune n'aurait été vue en relisant la feuille** ; toutes l'ont été en mesurant le rendu.

### Un défaut tactile préexistant, révélé par le nouveau banc

Le bouton « éditer manuellement » — l'**action principale** de ce bloc — faisait **26px de haut** au
doigt, sous le plancher confortable. Vérifié sur le commit précédent via un worktree : **26px là
aussi**. Ce n'est donc pas le déplacement qui l'a causé, c'est le banc qui l'a fait apparaître, en
mesurant enfin les trois commandes au doigt plutôt qu'à la souris. Corrigé à 32px.

C'est l'argument pour écrire un banc même sur un lot « de mise en page » : il ne protège pas seulement
ce qu'on vient de faire, il éclaire ce qui était déjà là.

## Quatre retours après essai sur téléphone

### Une régression que j'ai causée, et qui était un cul-de-sac

> « J'ai perdu mes boutons de diagrammes. »

En déplaçant les commandes du manche, j'ai ouvert une `<div>` sans la refermer au bon niveau :
`.viz-toggle` s'est retrouvé **à l'intérieur** de `.viz-diagrams`. Or `.col-right.diagrams-hidden
.viz-diagrams` passe en `display: none` quand les deux diagrammes sont masqués — les bascules
disparaissaient avec lui, et **il ne restait aucun moyen de les rouvrir**.

Ce n'est donc pas un défaut d'affichage, c'est un **état sans sortie**. Le banc du lot n'attrapait
rien parce qu'il mesurait toujours avec au moins un diagramme affiché ; il éprouve maintenant l'état
masqué, la parenté DOM, et le geste qui en sort.

**Ce que j'aurais dû faire** : à l'écriture, j'avais un doute explicite sur ces balises fermantes et
j'ai écrit « je vérifie la structure dans le navigateur plutôt qu'à l'œil » — puis j'ai vérifié la
*disposition* sans jamais vérifier la *parenté*. Le doute était le bon ; la vérification ne portait
pas sur ce qui l'avait déclenché.

### Un malentendu sur la loupe, et il était de mon côté

> « Au lieu de voir le séquenceur en continu, j'aimerais juste voir le petit séquenceur simple, mais
> en plus gros pour le modifier plus facilement. »

`const continuous = (this.seqMode === 'continu' || this.seqZoomOpen)` : agrandir faisait **changer de
vue**. La loupe ne doit que changer de **taille**. Le `|| this.seqZoomOpen` disparaît, et c'est le
mode qui décide seul — la vue continue garde sa porte, « Séq. » au-dessus de la grille.

S'y ajoute un plafond de largeur : « pour des accords très courts, il faudra limiter la largeur du
séquenceur pour que ça garde du sens ». Sans lui, `1fr` étirait seize doubles croches sur toute la
largeur de l'écran — une double croche de 80px, qui ne veut plus rien dire musicalement. Mesuré
après : cases de 19px dans le petit, **34px** dans la loupe, grille de 1058px au lieu de 1440.

### Une variable CSS qui n'existait pas, et un bouton jamais peint

> « Bouton voicing : afficher en plus sombre, comme le séquenceur, à côté du bouton séquenceur
> continu. »

**J'ai d'abord visé les mauvais boutons** : j'ai assombri les listes « C » et « Majeur » de la carte
Accord, alors que « bouton voicing » désignait « Conduite de voix », au-dessus de la grille. La
méprise est annulée — ces listes n'avaient rien demandé.

En allant voir le bon bouton, la mesure a donné ceci :

```
voicing : rgb(28,32,39) + dégradé clair
Séq.    : rgba(0,0,0,0)  + AUCUNE image
```

Le voisin n'était pas « plus sombre » : il n'avait **pas de fond du tout**. La cause tient en un mot :

```css
background: linear-gradient(…), var(--btn-neutral);   /* --btn-neutral N'EXISTE PAS */
```

La feuille définit `--btn-neutral-1`, `-2`, `-border`, `-border-hover` — jamais `--btn-neutral` tout
court. Une variable indéfinie rend la déclaration **invalide au calcul**, et la propriété retombe
alors sur sa valeur initiale : `transparent`. Le bouton montrait le fond de la page depuis sa
création. Les autres propriétés de la même règle (bordure, rayon) s'appliquaient normalement, ce qui
rendait le défaut parfaitement invisible à la relecture — la règle *avait l'air* de marcher.

**C'est le quatrième mode de défaillance CSS silencieux rencontré dans ce journal**, et le seul qui ne
soit pas une histoire de spécificité : `min-width` générique, `.col-left .icon-btn` plus spécifique,
`@media` déclaré plus bas, et maintenant une variable inexistante. Les trois premiers se voient en
comparant deux règles ; celui-ci ne se voit qu'en **lisant la valeur calculée**.

L'utilisateur avait donc raison sans pouvoir le nommer, et son œil valait mieux que ma relecture. Les
deux voisins partagent maintenant le fond plat sombre de la famille, même arrondi compris.

### Un encadré retiré sans perdre ce qu'il disait

> « Nouvel accord ou modifier (titres) : enlever les encadrés verts ou orange, je n'aime pas trop. »

La pastille servait à séparer l'**état** du **sujet** — on lit « MODIFIER Fmaj7 ». Cette distinction
ne tenait pas au cadre mais à la **couleur** (vert en Ajout, orange en Modification) et au fait que
l'intitulé nomme l'état. `inspecteur_sujet` exigeait le cadre ; il exige maintenant ces deux
propriétés-là. Exiger le cadre aurait été réclamer l'ornement qu'on venait d'enlever ; ne rien exiger
aurait laissé la distinction se perdre en silence au prochain remaniement.

## Quatre finitions, et une exception qu'on nomme au lieu de la subir

### La hauteur qu'un déplacement laisse derrière lui

> « Le bouton pour définir la durée des accords dans le volet de gauche : hauteur à homogénéiser avec
> les boutons voisins. »

Mesuré : **30px contre 38** pour « C » et « Majeur », sur la même ligne. Les 30px venaient de la
rangée d'outils d'où il vient, haute de 30px — en changeant de ligne au lot précédent, il a **emporté
sa hauteur d'origine**. Sa boîte faisant bien 38, il flottait dans un trou de 8px.

C'est le résidu type d'un déplacement : la valeur était juste là-bas, elle ne l'est plus ici. Déplacer
un élément, c'est aussi hériter des hypothèses de son ancien voisinage — et il faut aller les
chercher, elles ne se signalent pas.

### Une exception nommée vaut mieux qu'un plafond relevé

> « Le bouton petit séquenceur dans le volet de gauche : remettre en gris comme avant, il faut le
> différencier un peu des autres boutons. »

Le lot « un seul aspect de bouton » l'avait absorbé dans la famille sombre. La demande est justifiée :
ce n'est pas un réglage parmi les autres, c'est une **porte** — elle emmène ailleurs au lieu de
modifier ce qu'on regarde. Il retrouve son fond `#1c2027` et surtout son **contour en pilule** (999px)
là où toute la famille est carrée à 7px : c'est la forme, plus que la teinte, qui le distingue.

Le banc comptait « au plus trois familles » et est passé à quatre. **Relever le plafond à `<= 4`
aurait suffi à le faire taire — et l'aurait vidé de son sens** : n'importe quelle quatrième famille
apparue par accident serait passée. Il exige donc que la famille en trop soit **celle-là**, nommée. Le
garde-fou garde ses dents : une cinquième famille, ou une dérive sur un autre bouton, rougit toujours.

C'est la différence entre enregistrer une décision et désarmer un test.

### Le titre qui repart à droite

> « Mettre les instruments à droite du titre SON, pas en-dessous. »

Premier essai : « SON » s'est affiché **à droite de la liste**, l'inverse exact de la demande. Cause —
`#song-card .card-head h2 { order: 1 }`, une règle qui place le titre du morceau *après* ses boutons
dans l'en-tête principal. Ce popover vit dans `#song-card`, la règle l'atteignait donc aussi.

Cinquième mode de défaillance CSS silencieux du journal, et le premier qui ne touche ni la couleur ni
la taille mais **l'ordre**. Il a en commun avec les quatre autres de n'être visible qu'au rendu.

### Le titre retenu, et pourquoi

> « Garder un titre (par exemple Rythme, tu as des meilleures idées ?) au-dessus du métronome + types
> de rythmes/grooves. »

**« Rythme »**, la proposition de l'utilisateur, est la bonne — et elle passe le critère posé deux lots
plus tôt : elle nomme une **famille** (tempo, groove, signature) sans redire son premier champ, ce qui
était exactement le reproche fait à l'ancien « Tempo ». Les alternatives pesées valaient moins :
« Métrique » est trop technique, « Tempo et mesure » oublie le groove, « Transport » désigne déjà les
boutons de lecture ailleurs dans l'application.

## Les accords complexes : un seul doigté, et la bonne façon de savoir pourquoi

> « Je dois jouer un Cmaj9 à la guitare, je suis étonné qu'il y ait un seul diagramme proposé sur
> l'appli, alors qu'il est facilement jouable à la guitare. […] Peux-tu vérifier les accords
> complexes stp ? »

### Mesurer avant de corriger

Un seul doigté proposé peut vouloir dire deux choses opposées : soit le chercheur ne cherche pas assez
loin, soit il **rejette** des positions jouables au nom d'une règle trop stricte. On ne peut pas
trancher en lisant le code — il faut lui faire dire ce qu'il jette, et sur quel motif. D'où une sonde
qui rejoue l'énumération sans en écarter les rejets, sur trois tons et les vingt-deux qualités :

| accord | dispositions énumérées | retenues | rejetées sur l'écartement | rejetées sur les doigts |
|---|---|---|---|---|
| Cmaj9 | 13 | **1** | 8 | 4 |
| Cm9 | 7 | **0** | 4 | 3 |
| Cdom11 | 28 | **0** | 7 | 21 |
| Cdom13 | 20 | **0** | 2 | 18 |
| Cdim7 | 4 | **0** | 4 | 0 |
| Cm7b5 | 4 | **0** | 4 | 0 |

Le relevé dit deux choses que l'utilisateur ne pouvait pas voir. D'abord, il s'est arrêté au premier
symptôme : sur le seul ton de do, **cinq qualités n'affichaient rien du tout**, pas « un seul
diagramme » — et le compte sur les douze tons donnait **38 accords sans le moindre diagramme, 30 à un
seul**. Ensuite, ce ne sont ni la portée du manche ni le nombre de doigts qui bloquent, c'est
**l'écartement de la main** — et cet écartement n'est pas la faute de la guitare.

### La vraie cause : on demandait la voix du piano

`solveGuitarFingerings` reproduit les hauteurs **exactes** du voicing par défaut, c'est-à-dire un
empilement de tierces à l'octave 3 : pour Cmaj9, do3-mi3-sol3-si3-ré4. Cinq notes serrées dans une
octave et demie. Aucune main ne tient cela sur six cordes — et aucun guitariste n'essaie : il
répartit les mêmes notes sur d'autres octaves, et **laisse tomber la quinte**, que la fondamentale
sous-entend déjà. L'accord n'était pas injouable ; c'est *cette disposition précise des notes* qui
l'était. Le même diagnostic avait déjà été posé pour Am6 (voir `guitar_barre_shapes_6_9_test.js`), et
corrigé à l'époque en consignant à la main les formes de barré manquantes — un remède qui ne passe
pas à l'échelle de douze tons × douze qualités sans forme enseignée.

### Le correctif : un second chercheur, qui raisonne en classes de hauteur

`solveGuitarVoicings` ne cherche plus des hauteurs, il cherche des **positions jouables de l'accord**.
Cases autorisées corde par corde (uniquement les notes de l'accord), puis une énumération exhaustive
sous contraintes : fondamentale à la basse, quatre cordes contiguës au minimum, écartement et nombre
de doigts dans les bornes existantes. 240 accords (12 tons × 20 qualités) calculés en 120 ms — la recherche est étroite parce
que l'espace l'est.

Trois règles ont été écrites *après* avoir vu ce que la première version produisait, et c'est ce qui
les rend justes plutôt que devinées :

- **La basse se juge en hauteur, pas en numéro de corde.** `8-0-0-9-11-0` passait pour un C13 en
  position fondamentale : la corde de mi grave case 8 donne bien un do3, mais la corde de la à vide,
  *plus haut placée dans le tableau*, sonne un la2 — plus grave. Un renversement déguisé.
- **Une corde à vide veut dire main au sillet.** Elle ne coûte aucun doigt et n'entre dans aucun
  écartement : sans garde-fou, un do à la case 8 flanqué de quatre cordes à vide passait pour la forme
  la plus facile de toutes, « un seul doigt ». Les bourdons existent, mais aucun recueil n'en fait une
  position de référence.
- **Une octave de manche suffit.** Chercher jusqu'à la 15e case proposait `x-15-0-0-0-0` à côté de
  `x-3-0-0-0-0` : deux fois le même doigté, dont un injouable, au lieu de deux positions.

### Une position, une proposition

Le premier classement rangeait par case croissante, comme un recueil imprimé. Erreur d'ergonomie : un
recueil se voit page entière, alors que le navigateur sous le manche n'en montre **qu'un à la fois**,
et le premier fait office de proposition par défaut. Cmaj9 ouvrait donc sur un écartement de quatre
cases en première position, alors que `x-3-0-0-0-0` — un doigt — attendait en troisième. Le
classement va maintenant du plus facile au plus difficile, une seule forme par position de manche,
formes enseignées toujours en tête.

| | avant | après |
|---|---|---|
| accords sans aucun diagramme | 38 sur 240 | **0** |
| accords à un seul diagramme | 30 sur 240 | **0** |
| moyenne de doigtés proposés | 1,98 | **3,94** |

### Ce que le banc empêche

`accords_complexes_guitare_test.js` audite les 240 accords note à note : aucune note étrangère, aucun
degré essentiel manquant, fondamentale à la basse, cordes contiguës, bornes de main respectées. Il
réécrit exprès les règles de dispense au lieu d'appeler `guitarChordPcs` — un banc qui appelle la
fonction qu'il éprouve ne vérifie plus rien.

Et surtout il garde la porte dans l'autre sens : dès qu'un voicing est **personnalisé**
(renversement, drop, basse imposée), le doigté doit reproduire les hauteurs exactes demandées. Cette
personnalisation-là est délibérée. Le nouveau chercheur ne doit jamais s'en mêler.

## Le champ qui avait le focus mais qu'on ne voyait pas

> « J'ai essayé d'éditer un accord par son nom, c'est pas très pratique pour entrer le nom, la
> modification se passe derrière sans que je le voie. Au lieu de cela, je préfèrerais que la fenêtre
> d'écriture soit positionnée dans la fenêtre "pop-up" du menu édition manuelle, avec des boutons
> valider et choix des diagrammes sur le manche avec le cadenas. »

### Le relevé qui nomme le défaut

| | mesuré |
|---|---|
| fenêtre d'édition manuelle | y = 289 → 611 |
| champ ouvert par le crayon | y = **725** — 114 px sous le bord inférieur |
| `elementFromPoint` au centre du champ | **`guitar-edit-overlay`** |

La deuxième ligne suffisait à expliquer « derrière ». La troisième dit mieux : le champ n'était pas
seulement hors cadre, il était **recouvert par le voile de la fenêtre**. Il recevait le focus par
`input.focus()`, on pouvait donc y taper à l'aveugle — ce que l'utilisateur a fait — sans jamais
pouvoir ni le voir ni le cliquer.

La cause est un héritage assumé du lot « Manche 1 » : le crayon avait été *relocalisé* dans la
fenêtre, mais la fonction qu'il déclenchait construisait toujours son `<input>` dans
`#guitar-override-row`, resté au-dessus du petit diagramme. Le bouton avait déménagé, pas son effet.

### Ce qui change, et la seule chose qui bouge vraiment

`#guitar-override-row` **reste où il est** : son rôle est d'AFFICHER le substitut au-dessus du
diagramme, et il n'a jamais été celui de la saisie. C'est la confusion des deux qui a produit le
défaut. La saisie, elle, devient un champ permanent de l'onglet, avec un bouton Valider et, séparée
par un filet, la rangée « Doigté sur le manche » : flèches ‹ n/N › et cadenas.

Ces deux dernières sont des **jumeaux**, pas un déménagement. Le retour de l'époque — « je les
utilise souvent pour les accords simples » — vaut toujours pour les originaux restés sous le petit
diagramme. Les deux exemplaires lisent et écrivent le même état (`guitarFingeringIndex`,
`guitarDisplayLock`) : il n'y a jamais deux vérités à tenir d'accord, ce qui est précisément le piège
qu'un cadenas dupliqué tendrait — le défaut « le cadenas saute » a déjà été payé une fois.

### La validation au blur, retirée exprès

Avant, le champ disparaissait après usage : valider à la perte du focus était sans conséquence.
Maintenant qu'il reste affiché tant que l'onglet est ouvert, valider au blur signifierait appliquer
un accord au moindre clic sur le manche, sur un onglet ou sur la croix de fermeture. On valide sur
Entrée ou sur Valider, et rien d'autre. Un texte non reconnu **reste affiché** : c'est lui qu'on
vient corriger, l'effacer ferait perdre la frappe.

### Deux défauts trouvés par la mesure, pas à l'œil

**« Valider » à 410 px de large, et 51 px de haut sur téléphone** contre 38 pour le champ voisin. La
cause n'est pas dans `.btn-blue`, qui ne fixe ni taille ni flex, mais dans la règle générique
`button { flex: 1 1 0; min-width: 120px; padding: 16px 18px 16px 14px }` — le premier des cinq modes
de défaillance CSS silencieux du journal, une règle d'ensemble qui atteint un bouton qu'on croyait
libre. Relevé après correctif : 91 × 38, même ligne que le champ, sur les deux écrans.

**Deux orthographes du même accord à trente centimètres.** Taper `Bbadd9` puis revenir sur l'onglet
réaffichait `A#add9`, pendant que le bandeau voisin écrivait bien un si bémol : le champ appelait
`getBareLabel(false)` en dur là où le bandeau consulte `useFlatsForRoot`. Trouvé par le banc, pas à
l'œil. Corrigé — et vérifié dans la foulée que `parseChordSymbol` accepte le ♭ typographique aussi
bien que le `b` ASCII, sans quoi le champ aurait réaffiché un texte impossible à revalider.

### Ce que le banc empêche

`saisie_nom_dans_la_fenetre_test.js`, 39 vérifications, ordinateur et téléphone. La vérification
centrale porte sur le **point**, pas sur les coordonnées : un champ peut tenir dans le bon rectangle
et rester couvert par un voile posé au-dessus. C'est exactement ce qui se passait, et un test de
géométrie seul l'aurait laissé passer.

Cinq bancs adaptés, aucun supprimé — ils cliquaient sur un crayon qui n'existe plus. Deux méritent
d'être cités parce que l'adaptation y est un vrai changement de contrat, pas un renommage :
`guitar_override_test` vérifiait que le crayon « s'allume » quand un substitut est défini ; c'est
maintenant le **contenu du champ** qui porte cette information. Et `sortie_edition_involontaire_test`
affirmait en commentaire que flèches et cadenas étaient restés hors de la fenêtre : ce n'est plus
vrai, ses jumeaux sont désormais listés dans l'inventaire des contrôles à éprouver.

## La barre qui ne refusait pas de s'accrocher : elle n'existait pas

> « Dans le grand séquenceur, lorsque je crée une note et définis sa longueur avec la souris, j'ai des
> problèmes d'accrochage lors du survol : certains 1/4 de tons sont grisés et la barre refuse de
> s'accrocher. »

### Le relevé

| pendant un tracé de 10 croches | mesuré |
|---|---|
| cases passées à l'état « on » (donc grises) | **11** |
| barres dessinées | **0** |
| après relâchement | 11 cases « on », **1** barre, 0 → 10, correcte |

La formulation de l'utilisateur décrivait exactement ce que montre le tableau, mais l'explication
n'était pas celle qu'elle suggère : la barre ne *refusait* pas de s'accrocher, **elle n'existait pas
encore**. Les cases s'allumaient en gris (`rgba(255,255,255,0.055)`), la pilule n'apparaissait qu'au
relâchement.

### Deux pistes écartées par la mesure

C'est ce qui rend le diagnostic sûr, et ça valait le détour :

- **Ce n'est pas l'aimantation.** `seqSnap()` renvoie 1 — le sélecteur 1/4–1/8 a été retiré sur retour
  utilisateur. Aucune quantification grossière ne pouvait faire « sauter » des cases.
- **Ce n'est pas l'étirement d'une note existante.** Là, la pilule suit déjà : `onSeqResizeMove` garde
  `d.noteEl` et déplace l'élément en direct. Il manquait le pendant pour une note **neuve**, qui n'a
  pas encore de pilule à déplacer.

### La cause, qui est un choix délibéré

`applySeqCell` met à jour le modèle et bascule la classe de la case — jamais les pilules. Celles-ci ne
naissent que d'un `renderSequencer()`, qu'on se garde d'appeler pendant le geste : il détruirait les
`.seq-cell` actuellement sous les doigts, et couperait net la réception des `pointermove` suivants sur
tactile. Le correctif ne touche pas à cette règle : il fabrique une pilule d'**aperçu**, la met à jour
comme le fait l'étirement, et la jette au relâchement.

### Géométrie lue, jamais recalculée

La colonne d'une croche dépend de la page affichée et du décalage des accords voisins (`colOffset`,
`pageStart`). Refaire ce calcul dans l'aperçu, c'était s'exposer à ce qu'il diverge un jour de celui du
rendu. La case du pas visé porte déjà la bonne réponse dans son style inline : l'aperçu la lit.

### Une correction que je dois consigner

J'avais d'abord annoncé un **second défaut** : la barre d'une note étirée alterne +10 / +18 px pour des
cases de 14 px. C'était **faux**, et l'erreur venait de ma « largeur idéale ». L'interstice de 4 px
entre deux paires de doubles croches est porté par la bordure transparente de `.seq-cell-b` : une note
qui s'arrête sur cette 2e moitié doit donc laisser ces 4 px libres, et une note qui s'arrête sur la 1re
moitié doit au contraire occuper toute sa case. L'alternance est la conséquence exacte de cette règle.
Le banc l'éprouve désormais comme une règle, avec un écart attendu de 0 px à chaque pas — pas comme une
tolérance.

### Ce que le banc empêche

`apercu_barre_tracee_test.js`, 17 vérifications : une barre visible à **chaque** pas du tracé, bord
droit tombant pile sur la case visée (écarts mesurés : 0, 0, 0… onze fois), couleur constante,
`pointer-events: none` pour que l'aperçu ne vole pas le survol, aucune vraie pilule écrite avant le
relâchement, et aucun aperçu qui survive au geste.

Une vérification y est née d'une erreur de ma part : j'attendais qu'un glissé parti d'une case allumée
**efface**. L'application, elle, **déplace** la note dans le temps (`beginSeqHDrag`) — et elle a raison.
Le geste a maintenant sa propre vérification plutôt qu'une attente fausse.

## Un rouge de plus au balayage, et la bonne façon de ne pas l'attribuer trop vite

Le balayage qui suit les deux derniers lots remonte **7 rouges au lieu des 6 documentés** :
`glock_full_real_ui_test.js`, quatre vérifications tombées, toutes après un rechargement complet de
la page — le cadenas guitare de l'accord 1 et de l'accord 2.

Le réflexe aurait été de l'attribuer aux modifications du jour : elles touchent précisément le
cadenas guitare (deux exemplaires depuis que la fenêtre d'édition manuelle a le sien). Le relevé dit
autre chose.

| commit | résultat |
|---|---|
| `ccb47e3`, **avant** les deux commits du jour | 29 PASS / **4 FAIL** |
| état actuel | 31 PASS / **2 FAIL** |

Non seulement le banc était déjà rouge avant, mais il l'est **moins** après. Trois passages
consécutifs sur l'état actuel donnent 2 rouges à chaque fois : ce n'est pas non plus un tirage
instable d'un passage à l'autre.

### Ce qui a réellement changé : le banc, pas le produit

À code d'application **identique**, allonger deux attentes du banc — 150 → 700 ms après l'ouverture
d'un accord, 120 → 500 ms après sa fermeture — le fait passer de 31/2 à **33/0**, trois fois sur
trois. Aucune ligne de `script.js` n'a été touchée pour l'obtenir. C'est la preuve, et pas une
présomption.

La forme du symptôme le disait déjà : **l'accord 0 passait toujours, les suivants non**. Un défaut de
persistance ne choisirait pas ses accords par ordre d'apparition ; un enchaînement trop serré, si —
le double-clic du tour suivant arrivait pendant la fermeture du panneau précédent.

### Pourquoi ce banc redevient instable

Il portait déjà cette cicatrice : son propre commentaire consigne « le MÊME code passait 33/33, puis
29/33, puis 31/33 d'un essai à l'autre », et l'attente après rechargement avait été portée à 900 ms
pour cela. Ce qui n'avait pas été fait à l'époque, c'est de traiter **les deux autres attentes de la
même boucle** — celles qui séparent les accords entre eux. Chaque fois que l'application gagne un
rendu de plus à l'ouverture d'un accord, la marge la plus courte finit par céder.

Les deux attentes portent maintenant leur justification en commentaire, avec le relevé qui les motive.
Un banc qui varie est plus coûteux qu'un banc rouge : le rouge se corrige, la variation se rediscute
à chaque campagne.

## L'accord sur le temps de test : 15 minutes par lot, le balayage complet en fin de série

> « Il ne faut pas lancer le banc complet à chaque fois. Il dure beaucoup trop longtemps pour de
> petites modifications. » — « Cible les tests nécessaires à chaque lot de modifications (pas à chaque
> étape), et écarte ceux qui vont prendre du temps alors qu'ils n'ont pas d'intérêt. » — « Je veux
> bien garder un ensemble de tests de 15 minutes au lieu de 25-30, puis garder un banc complet en fin
> de lot. »

### Ce que coûte vraiment le balayage complet

J'avais annoncé « 12 à 15 minutes », puis « 25 » : les deux étaient faux. Relevé sur les horodatages
des 199 journaux du balayage du jour :

| | mesuré |
|---|---|
| phase 1 — 25 suites tactiles, en série | 591 s (~10 min) |
| phase 2 — 174 suites, 4 en parallèle | ~1930 s (~32 min) |
| **total** | **2524 s = 42 min** |

Le coût n'était pas où je le croyais : ce sont les 174 suites « ordinaires », à ~45 s pièce, qui pèsent
— pas les tactiles. C'est ce chiffre qui rend le ciblage indispensable, et non préférable.

### Ce que le balayage complet a rapporté, honnêtement

Deux campagnes complètes dans la même journée, 84 minutes cumulées, **zéro défaut de produit trouvé**.
La première a confirmé la ligne de base connue ; la seconde a remonté un rouge de plus, qui s'est
révélé être un banc au minutage instable, préexistant, sans rapport avec le travail du jour. Pendant
ce temps, les sous-ensembles ciblés — 2 à 4 minutes — ont attrapé tout ce qui comptait.

### Le protocole retenu

- **Par lot** (pas par étape) : un sous-ensemble borné à **15 minutes**, choisi par `tests/cibler.sh`.
- **En fin de série de lots**, et avant toute poussée vers `main` : le balayage complet.
- **Immédiatement**, sans attendre la fin du lot : dès qu'un lot touche une **règle CSS générique**
  (`button`, `.icon-btn`) ou **retire un identifiant partagé**. Ce sont les deux cas où la recherche
  par symbole est structurellement aveugle — retirer `#guitar-override-btn` a cassé cinq bancs d'un
  coup. L'outil lève l'alerte tout seul quand il les repère.

### Pourquoi un outil plutôt qu'une règle de conduite

Choisir les bancs « de tête » est un pari sur ma mémoire des dépendances, et je me suis déjà trompé
dessus — la régression des bascules de diagrammes vient exactement de là. `tests/cibler.sh` remplace
la mémoire par une recherche, et rend le pari visible : il affiche ce qu'il retient, ce qu'il coupe,
et pourquoi.

Trois choses ont été corrigées en l'écrivant, chacune parce qu'un essai l'a montrée fausse :

1. **Les symboles trop répandus ne désignent rien.** `icon-btn` apparaît partout ; le citer revenait à
   tout rejouer. Au-delà d'un huitième des bancs, un symbole est écarté comme bruit.
2. **Le budget est la contrainte, pas la conséquence.** Une version sans plafond proposait 63 bancs
   pour un lot séquenceur, soit 48 minutes — *pire* que ce qu'elle remplaçait. Un outil de ciblage qui
   peut dépasser le balayage complet ne sert à rien. On classe par pertinence et on coupe au budget.
3. **Chercher un nom de fonction dans le diff ne marche pas.** Modifier le corps d'`onSeqPointerMove`
   ne fait apparaître son nom nulle part, et le citer dans un commentaire ne veut pas dire qu'on l'a
   touchée : le lot séquenceur ne se voyait attribuer qu'UN banc, alors que huit étaient pertinents.
   L'outil remonte donc, pour chaque bloc modifié, à la méthode qui le contient **par ses numéros de
   ligne** — l'en-tête de bloc de git n'annonçant que `class HarmoHubApp`, JS n'étant pas reconnu par
   ses motifs de contexte par défaut.

### La limite qu'il faut garder en tête

Un sous-ensemble ne voit que ce qu'on pense à y mettre. Quand je livre sans balayage complet, je le
dis, avec la liste de ce qui a été joué : on sait alors sur quoi porte le pari.

## Des sentinelles tirées de l'historique des défauts, plutôt que de mon intuition

> « Tu peux travailler en off les bancs de tests que tu penses mettre en place pour qu'ils soient le
> plus efficace possible (par exemple en fonction des soucis majeurs et les plus couramment rencontrés
> au cours de la création de l'appli). Si tu as besoin de 20 minutes au lieu de 15 pour un gain
> considérable, ok pour moi. »

### Ce que dit le dépouillement

52 sections de ce journal, 196 bancs. Deux familles de défauts dominent, et ce ne sont pas celles que
les bancs existants surveillent le mieux — chacun d'eux éprouve SA fonctionnalité, aucun ne surveille
ce qui se répète d'un lot à l'autre.

**Famille 1 — le banc périmé.** « Suites supprimées », « Contrats réécrits », « 4 suites adaptées au
nouveau bouton », « deux bancs périmés et le vrai défaut qu'ils cachaient », « Reprise des 30 bancs de
la vue plein écran », « quatre périmés, un vrai défaut », et le retrait de `#guitar-override-btn` qui
en a cassé cinq d'un coup. Le coût n'est pas le rouge, c'est le DÉLAI : le banc reste vert tant qu'il
ne tourne pas, puis rougit 42 minutes plus tard — ou à la campagne suivante, quand plus personne ne
relie la cause à l'effet. Pire, un banc qui cherche une adresse morte dans un `if` ne rougit même
pas : il renonce en silence.

**Famille 2 — l'élément visible mais injoignable.** « La modification se passe derrière sans que je le
voie », « le tiroir n'avait aucune sortie atteignable », la bande morte de 4px, le bouton à 26px sur
téléphone. Aucun de ces défauts ne se voit dans les COORDONNÉES : l'élément occupe le bon rectangle.
Il faut interroger le POINT.

### Les deux sentinelles

| | ce qu'elle répond | durée |
|---|---|---|
| `sentinelle_adresses_test.js` | aucun banc n'adresse une adresse que le produit n'offre plus | **96 ms** |
| `sentinelle_atteignabilite_test.js` | ce qu'une surface ouverte propose répond au clic, et tient la cible tactile | **155 s** |

La première est **statique** — ni navigateur ni serveur. Elle peut donc tourner à chaque lot sans
entamer le budget. Dès le premier passage, elle a trouvé **quatre bancs réellement périmés**, dont
`real_click_loupe_selection_test.js`, l'un des six rouges de la ligne de base : elle explique en 96 ms
ce que le balayage complet mettait 42 minutes à signaler sans le nommer.

### Trois faux positifs corrigés, et ce qu'ils enseignent

Une sentinelle qui crie faux est pire qu'une absence de sentinelle : on apprend à l'ignorer. Les trois
familles rencontrées :

1. **La citation qui attend l'absence.** `saisie_nom_dans_la_fenetre_test.js` vérifie que
   `#guitar-override-btn` a bien disparu. Punir cette citation reviendrait à punir exactement le banc
   qui fait le mieux son travail. La sentinelle lit donc le CONTEXTE de la ligne, pas seulement
   l'adresse. Idem pour les couleurs (`#ccc` n'est pas une adresse) et pour les éléments qu'un banc
   fabrique lui-même (`#banc-largeur`).
2. **Le modal accusé d'être un modal.** La première version de la sentinelle 2 éprouvait toute la
   page : fenêtre d'édition ouverte, elle accusait 34 commandes d'être « recouvertes par
   guitar-edit-overlay ». C'est le propre d'un voile. On n'éprouve donc que la surface ACTIVE.
3. **L'écran accusé d'être un défaut.** Elle accusait `#root` d'être recouvert par la barre de
   transport sur téléphone. Vérification : la carte de l'accord va de 543 à 758 px dans une fenêtre de
   664 — le sélecteur était simplement sous la barre À CETTE POSITION DE DÉFILEMENT. Un utilisateur
   ferait défiler. La sentinelle le fait maintenant avant de juger. Ce qui reste recouvert APRÈS avoir
   été amené au centre l'est vraiment — et c'est précisément le cas du champ construit hors de sa
   fenêtre, que rien ne pouvait dégager.

Un seuil aussi a été rejeté : imposer 24px sur ordinateur produisait cinq exceptions au premier essai
(`toggle-sidebar` 16x86, un rail vertical ; les quatre chevrons de zoom 30x15, délibérément fins). Un
seuil qui demande cinq exceptions d'emblée n'est pas un seuil, c'est une opinion. La taille n'est donc
vérifiée que sur téléphone, où elle se paie.

### Une dette constatée, à trancher

Six commandes passent sous les 32px sur téléphone : `bass` (59x30), `seq-zoom` (315x25),
`quick-add-help-btn` (26x44), `add-section` (138x31), `lyrics-btn` (81x26), `file-menu-btn` (77x26).
32px est la borne que ce projet s'est donnée en corrigeant `#guitar-edit-btn`, mesuré à 26px, sur
retour utilisateur. Les corriger est une décision d'interface, pas une réparation évidente : elles
sont donc consignées nommément, et la sentinelle refuse qu'une SEPTIÈME apparaisse.

## Le « + » en gouttière, et deux cadrages de diagrammes

> 1. « Le bouton + pour ajouter un accord est une bonne idée. Cependant, il prend une ligne entière en
>    hauteur pour rien, ce qui limite le visionnage de toutes mes sections en même temps. […] Lorsqu'il
>    est au milieu d'une ligne, il ne me gêne pas. »
>    puis : « Pour plus de cohérence, que penses-tu de conserver la hauteur du bouton, mais de réduire
>    sa largeur et le placer en fin de ligne ? »
> 2a. « Avec un nom édité pour la guitare, les titres ne sont pas alignés en hauteur. »
> 2b. « Les boutons diagrammes seraient mieux en haut à droite de l'encadré. Là ils sont centrés, c'est
>    un peu bizarre. »

### Le « + » : ma première version, puis la bonne

Relevé : une partie de 4 accords (qui remplissent exactement leur ligne) mesurait **206 px** contre 104
pour 3 accords. 102 px pour loger un bouton, et autant par partie.

Raccourcir le bouton ne suffisait pas : les hauteurs de lignes sont **explicites** (`var(--row-h)`),
délibérément pas `auto`. J'ai donc d'abord changé le GABARIT de cette dernière ligne — une bande de
22 px plus le numéro de mesure : 146 px au lieu de 206.

La contre-proposition de l'utilisateur est meilleure, et c'est elle qui est retenue : le « + » vit
désormais dans une **gouttière étroite réservée au bout de chaque ligne**, posé sur la dernière ligne
d'accords. Il ne passe plus jamais à la ligne. **104 px pour 4 accords, exactement comme pour 3** — la
totalité du coût supprimée, pas réduite.

**Pourquoi une gouttière plutôt que rétrécir le dernier accord.** Cette grille est proportionnelle au
temps : la largeur d'un accord dit sa durée. Prendre la place du « + » sur le seul dernier accord lui
ferait mentir. Une gouttière de même largeur au bout de TOUTES les lignes ne change rien aux
proportions entre accords — le banc le vérifie (quatre accords de même durée, quatre largeurs égales).

### Deux fausses pistes sur les bascules, écartées par la mesure

**La position absolue en haut à droite.** Ce coin n'est pas libre : relevé, les bascules flottantes
recouvraient `.guitar-controls-cote` — les flèches de doigté et le cadenas, donc des **commandes** — en
pleine largeur, et `#piano-viz` sous 300 px.

**Le déplacement en tête de carte.** Inutile, et c'est la lecture du CSS existant qui l'a montré : la
carte est **déjà en ligne** au-dessus de 900 px, et les bascules déjà à droite des diagrammes — un lot
antérieur y gagnait 42 px de hauteur, sur un retour utilisateur d'alors. Elles n'étaient donc pas mal
placées : juste centrées verticalement. Il ne restait qu'à changer leur alignement sur l'axe
transversal, ce qui ne coûte pas un pixel et ne masque rien. Résultat : 13 px du haut, 17 px de la
droite.

### Deux erreurs à moi, consignées parce qu'elles se reproduiront

**Une accolade mal placée.** J'ai glissé un `@media` entre deux variables de `.chord-grid`, refermant
la règle trop tôt : tout le reste, `display: grid` compris, est tombé dans le bloc conditionnel. Le
« + » est passé à **1004x28** sur ordinateur. Cela ne se voit pas dans un diff, seulement au rendu — et
c'est la même famille que le `<div>` non fermé qui avait avalé les bascules de diagrammes.

**Une marge qui déborde.** `width: 100%` plus `margin-left: 4px` font 4 px de trop : la case dépassait
de la grille (mesuré : 3 px à droite, sur les deux écrans). Corrigé par `justify-self: stretch` sans
largeur imposée — et la gouttière élargie de 4 px pour que la case garde sa cible (26 px sur
ordinateur, 34 au doigt, la gouttière s'élargissant sur téléphone).

### Trois bancs adaptés, un ajouté

`place_du_plus_et_diagrammes_test.js` (25 vérifications) éprouve les trois points, dont la
proportionnalité au temps. `case_plus_test.js` et `ajout_modif_test.js` affirmaient une case CARRÉE :
contrat changé sur demande, pas défaut — chacun le dit maintenant en toutes lettres. Et
`diagrammes_inspecteur_test.js` gagne le rappel de pourquoi les bascules sont en haut.


## Correctif du même lot : j'avais touché trop de choses

> « Tes modifications ont entraîné des erreurs d'affichage. Je pense que tu as touché trop de choses.
> Je pense que tu pouvais ajouter un petit espace réservé au + uniquement en fin de ligne. Lorsque les
> accords n'atteignent pas le bout de la ligne, le + doit se mettre à la fin de l'accord comme avant. »
> — et, séparément : « des accords ont changé de taille de police, à modifier ».

### La gouttière n'existe que si la ligne est pleine

J'avais réservé la colonne du « + » au bout de **toutes** les lignes. Conséquence visible sur la
capture : une partie d'une seule mesure se retrouvait avec son « + » à l'autre bout d'une ligne vide,
et toutes les largeurs de cases changeaient — pour un problème qui ne se pose que sur une ligne pleine.

La règle est maintenant exactement celle que l'utilisateur a formulée. Mesuré :

| accords | ligne pleine ? | forme du « + » | écart au dernier accord | largeur des cases |
|---|---|---|---|---|
| 1, 2, 3, 5 | non | 64×64, d'origine | **0 px** | 251 px, inchangée |
| 4, 8 | oui | 26×64, en gouttière | 4 px | 243 px |

Aucune ligne en plus dans les deux cas.

### La police : ce n'était pas moi, mais c'était un vrai défaut

Vérifié avant d'agir, en rejouant le même morceau sur le commit précédent : les tailles sont
**identiques** de part et d'autre — `B` 14,08 px, `E♭` **8 px**, `E` 16,8 px. Mon lot ne l'avait pas
causé. Mais 8 px pour un `E♭` dans une case de 125 px, quand le `B` d'à côté tient 14,08 px dans une
case de MÊME largeur, est bel et bien un défaut.

La cause est dans `fitCellSymbols` : il comparait `scrollWidth` à `clientWidth` **du symbole
lui-même** — or `.cell-sym` est ajusté à son propre texte. Mesuré : 10 px pour « B », 7 px pour « E♭ »,
11 px pour « E », dans des cases de 125 et 251 px. Comparer un élément à lui-même n'est pas un test de
débordement, c'est une boucle : un pixel d'arrondi du navigateur suffisait à la déclencher, et le ratio
la faisait plonger jusqu'au plancher de 8 px.

La case est le vrai budget. Après correctif : `B` et `E♭` à 14,08 px tous les deux, `E` à 16,8 px dans
sa case deux fois plus large — et le filet reste armé, `B♭maj7` dans une case de 63 px rétrécissant
toujours à 11,52 px.

### Ce que ça dit de ma façon de faire

Deux fois dans ce lot, j'ai élargi la portée d'un correctif au-delà de ce qui était demandé : la
gouttière sur toutes les lignes plutôt que sur la seule ligne pleine, et les bascules déplacées dans le
DOM alors qu'un changement d'alignement suffisait. Les deux ont coûté un aller-retour. La demande
initiale — « uniquement en fin de ligne » — décrivait déjà la bonne portée.

## Lot « métronome allumé + Paroles » — décisions et mesures

Retours utilisateur traités : « 1. Le bouton qui permet de maintenir le métronome pendant la lecture
ou non doit rester "allumé" lorsqu'il est activé. C'est pas le cas aujourd'hui. 2. Outil "Paroles",
plusieurs remarques : a. Enlever le bandeau vert qui indique comment positionner les accords, pas
besoin d'aide pour cela b. Le vert des accords est trop "fluo" par rapport au texte blanc, à adoucir.
c. L'outil "taille de texte" ne suit pas les codes couleur du reste de l'appli. En plus, lorsque je
réduis le texte, l'affichage n'est pas optimal avec les pastilles d'accords. d. Sortie PDF : […] trop
d'espace entre la pastille d'accord et le texte, c'est des polices d'écriture différentes, le premier
accord peut dépasser à gauche […] Tu pourrais colorier les pastilles d'accord en bleu très foncé pour
le PDF. » puis « Il y a également des problèmes à la fermeture de "Paroles" et réouverture. Les
accords ne sont plus en place. »

### 1. Le `const` qui cassait tout Paroles au chargement (point 6)

Le défaut le plus grave du lot, et le seul qui perdait du travail. Deux pannes distinctes derrière un
seul symptôme.

**(a) Rouvrir Paroles perdait le morceau.** Mesuré : après avoir tapé des paroles et posé un accord,
le stockage contenait bien `[{"p":1,"l":27}]` (1 emplacement, 27 caractères) ; après `reload()` sans
dépôt en attente, `{"pastillesDOM":0,"vide":true}` — la page vide. `tryAutoImportFromHarmoHub()`
consomme et EFFACE `harmohub_lyrics_pending_import` dès la première lecture (c'est voulu : une visite
ultérieure ne doit pas rejouer un import fantôme), mais rien ne rouvrait le dernier morceau. Le
commentaire d'origine promettait pourtant qu'on « retombe normalement sur le morceau déjà ouvert dans
CETTE page » — l'intention était là, l'implémentation non.
Correctif : `harmohub_lyrics_last_song`, photo de la structure brute du morceau prise au début de
`loadSong` (avant que les champs de travail `_lyricsHtml`/`_placements` n'y soient ajoutés). La
session de paroles, elle, était déjà enregistrée par morceau — `loadSong` la rebranche toute seule.

**(b) Les accords revenaient DÉPLACÉS.** Mesuré, même ancre, même texte :

    POSE     : texteG=306 texteL=828 pastilleG=312 donnees=[{"type":"char","charIndex":5,…}]
    REIMPORT : texteG=306 texteL=828 pastilleG=277 donnees=[{"type":"char","charIndex":5,…}]

Gauche du texte identique, largeur identique, donnée enregistrée identique — et 35 px d'écart. Le
décalage n'était donc ni dans le texte, ni dans les données. Relevé décisif : `pill.style.left` valait
`""` après réimport, contre `"40.9219px"` après la pose. Une chaîne vide veut dire qu'on a affecté une
valeur invalide (`NaN`) — ou que l'affectation n'a jamais eu lieu. C'était la seconde : la console
crachait `ReferenceError: Cannot access 'PILL_MIN_GAP' before initialization`, levé depuis
`renderPills` appelé par `loadSong` appelé par `tryAutoImportFromHarmoHub`… qui s'exécutait ligne 452
alors que le `const PILL_MIN_GAP` est déclaré ligne 1126. **Zone morte temporelle** : un `const` n'est
pas hissé comme une fonction. L'import s'interrompait en plein vol, les pastilles restaient sans
position et retombaient à l'origine de leur conteneur.
Correctif AU BON NIVEAU : le démarrage part à la toute fin du fichier. Corriger `PILL_MIN_GAP` seul
(en le remontant) aurait refermé CE cas et laissé la porte ouverte au prochain `const` ajouté entre
les deux — le fichier contient déjà un commentaire, écrit lors d'un lot antérieur, expliquant que
`undoStack`/`MAX_UNDO` avaient dû être déclarés tout en haut pour cette raison exacte. Le vrai défaut
n'était pas la position d'une constante, c'était l'endroit d'où on démarre.

### 2. Le bouton métronome n'était pas éteint, il était invisible (point 1)

Fausse piste écartée d'emblée : le JS. Relevé après un vrai clic, la classe était bien posée
(`icon-btn icon-btn-lg active`) et la préférence bien écrite. Le défaut était dans la feuille de
style, et c'est un cas d'école du mode d'échec « règle plus spécifique » : le lot d'homogénéisation du
volet gauche pose `.col-left .icon-btn:not(…):not(…):not(…)` avec `background-image: none`, soit
(0,7,0) — qui écrase `.icon-btn.active` (0,2,0), le SEUL endroit où se disait l'état allumé. Mesuré :
`background-image` calculé « none » et cadre resté `rgb(51,51,51)`, c'est-à-dire l'aspect exact du
bouton éteint, classe `.active` posée ou non.
Correctif au niveau de la FAMILLE et non de ce bouton : la panne ne visait pas le métronome, elle
visait toutes les bascules du volet, et la prochaine ajoutée serait née éteinte. Fond vert PLEIN (pas
le retour du dégradé, qui rouvrirait la famille qu'on venait de fermer) + une règle `:hover` jumelle,
sans quoi le survol neutre reprenait la main et le bouton s'éteignait sous le curseur — au moment
précis où on le regarde. Vérifié bureau ET mobile, allumage, persistance après rechargement,
extinction.

### 3. Paroles : ce qui part, ce qui reste (points 2a–2d)

**Le bandeau vert (2a).** Ce qu'il disait était déjà lisible ailleurs : l'accord en main est surligné
dans la réserve juste au-dessus du texte, et l'enchaînement y déplace le surlignage tout seul —
« puis Fadd9 » répétait en toutes lettres ce que la réserve montrait. Ce qui NE POUVAIT PAS partir
avec : le bouton « Arrêter ». Au doigt il n'y a pas d'Échap, et cliquer un accord déjà armé le
RÉ-arme au lieu de le relâcher (correction délibérée d'un lot antérieur) — sans ce bouton, plus aucun
moyen de reposer l'accord en main sur un téléphone. Il devient un bouton ordinaire du bandeau
d'outils au lieu du prétexte d'un encadré.

**Le vert fluo (2b).** `--accent` (#00e676) est à saturation pleine ; les paroles juste en dessous
sont en #e0e0e0 quasi neutre. Sur une page entière, chaque pastille tirait l'œil plus fort que la
ligne qu'elle annote — alors que c'est le texte qu'on lit en chantant. Même teinte, saturation et
luminosité rabaissées (`--accent-pastille: #79c99a`), réservée aux pastilles : l'accent plein reste
partout ailleurs, où il marque des états ponctuels et non une trame répétée.

**Le curseur de taille (2c, couleurs).** Il était laissé au rendu natif, donc peint avec l'accent du
SYSTÈME (bleu sur la plupart des machines) au milieu d'une page verte : la seule commande de toute
l'appli à ne pas être de la maison. `accent-color`, exactement comme style.css le fait pour tous les
curseurs de HarmoHub.

**La taille de texte réduite (2c, disposition).** Mesuré avant correction : la pastille gardait
20,1 px de haut à toutes les tailles (police figée à 0.72rem) tandis que le blanc entre deux lignes
suit l'interligne — 22,7 px à 160 %, 14,8 px à 100 %, 10,8 px à 80 %. Réduire le texte réduisait donc
le logement sans réduire ce qu'on y met. Exprimée en fraction de `--lyrics-fs`, la pastille garde le
même rapport à son interligne partout : mesuré après, 16,6 / 20,2 / 31,1 px pour 80 / 100 / 160 % —
strictement proportionnel. Le réglage devient un zoom du bloc paroles+accords, pas du seul texte.

**La sortie PDF (2d).** Quatre reproches, traités ensemble :
- *l'espace* : l'interligne 2.8 existe pour loger une pastille ENCADRÉE et la saisir au doigt ; sur le
  papier elle perd cadre et fond et personne ne la déplace. Resserré au seul mode impression. Mesuré :
  écart pastille→texte 7,5 px → 2,6 px.
- *les polices* : ce n'était pas une autre famille mais 0.72rem en graisse 800 contre 1rem normal —
  assez pour se lire comme deux typographies. Rapproché : 14,08 px en graisse 700 sous un texte de
  16 px.
- *le débord à gauche* : une pastille est CENTRÉE sur son caractère, donc celle du premier caractère
  sort de la moitié de sa largeur, par construction. À l'écran la marge de la carte l'absorbait ; le
  PDF rastérise la carte à ses bords exacts et coupait l'accord. Bornée dans la zone de texte : mieux
  vaut un accord de quelques pixels à droite de sa syllabe qu'un accord coupé en deux. Mesuré : débord
  ramené à 0,2 px.
- *le bleu très foncé* : demandé, et justifié — un vert imprimé sur blanc perd son contraste, le bleu
  nuit reste franc, y compris en noir et blanc où il descend en gris sombre.

**Piège évité au passage.** Changer l'interligne en mode impression déplaçait le TEXTE sans déplacer
les pastilles, positionnées une fois en pixels absolus : la bascule de classe seule aurait aggravé
exactement le défaut qu'on corrigeait. D'où `setModeImpression()`, qui repose les pastilles à chaque
bascule, dans les deux sens. Vérifié : aller-retour écran → PDF → écran, valeurs identiques au
dixième de pixel.

## Comptabilité des bancs : réparer la dette plutôt que la figer

Retour utilisateur : « améliore la comptabilité des bancs ». La méta-suite demandait de figer un gain
avec `--maj`. C'aurait été le geste le plus court et le plus faux : trois de ses griefs n'étaient pas
un gain à enregistrer, mais des aggravations que j'avais moi-même introduites en écrivant
`sentinelle_atteignabilite_test.js` et `place_du_plus_et_diagrammes_test.js`. Le cliquet est fait pour
empêcher exactement ça.

### 1. Une sentinelle qui ne regardait pas ce qu'elle disait regarder

`sentinelle_atteignabilite_test.js` ouvre cinq surfaces et vérifie que chaque commande visible répond
au clic. Deux de ces cinq surfaces visaient `#song-settings-btn` et `#settings-btn` — des adresses qui
n'existent pas dans index.html. Les vraies sont `#song-summary` et `#open-settings`. Et comme chaque
clic portait un `.catch(() => {})`, l'échec ne se voyait pas : le relevé se faisait quand même, sur la
page de fond, et le bilan annonçait tranquillement avoir éprouvé « les réglages du morceau » et « les
Paramètres ». C'est le défaut que la méta-suite décrit dans son propre en-tête, reproduit à la lettre.

Un banc vert qui ne regarde pas ce qu'il prétend regarder est pire qu'un banc absent : il occupe la
place, et personne ne va écrire le banc manquant.

Correctif : `ouvrirPar()`, un clic qui ATTEND la commande et échoue bruyamment si elle manque. Les six
`.catch(() => {})` du fichier partent avec, sauf celui de l'Échap de nettoyage — conservé mais NOMMÉ,
il alimente désormais la liste des erreurs.

**Ce que ça a révélé, une fois les surfaces réellement ouvertes.** Quatre constats, tous inédits :
- `#metronome-sound` (sélecteur 160×35 des Paramètres) a un `<h3 class="settings-group-title">` en
  plein centre. Vérifié par clic réel : la valeur ne change pas.
- `#toggle-seq-edit-audio` est recouvert par `#toggle-show-roman` — deux bascules superposées.
- Sur téléphone, cinq bascules des Paramètres font 38×20, et `bpm-val` (30×18) et
  `toggle-complex-mode` (30×36) passent sous le plancher de 32px que le projet s'est donné.

Ces quatre-là sont de VRAIS défauts d'interface, pas de la dette de bancs. Ils ne sont pas absorbés
dans `DETTE_TACTILE` : cette liste est plafonnée à six par une vérification explicite, et la faire
passer à treize reviendrait à démonter le garde-fou pour faire taire ce qu'il vient de trouver. Le
banc reste donc rouge, avec ses mesures, en attendant une décision d'interface.

### 2. Le détecteur de surface avait un angle mort

Une fois `#song-summary` cliqué pour de bon, la sentinelle accusait seize commandes d'être
« recouvertes par control-card ». Faux positif : le panneau des réglages du morceau est
`position: fixed` (`.song-settings.flottant`) mais ne porte ni `.popover` ni `role="dialog"`, donc le
relevé retombait sur `document.body` et mesurait la page DERRIÈRE le panneau ouvert. Or être recouvert
est précisément ce qu'on attend d'une page derrière un panneau. La classe est ajoutée à la liste des
surfaces superposées. Ce défaut-là n'était visible que depuis que le panneau s'ouvre vraiment : tant
que le clic échouait en silence, le relevé portait sur une page au repos et paraissait sain.

### 3. Deux garde-fous qui punissaient les bancs exemplaires

**Méta-suite, règle 5 (« vérifications sous condition »).** Elle comptait comme dette
`if (X) { check(…) } else { check(…) }`. Or les DEUX branches enregistrent : quel que soit le chemin,
le bilan reçoit une vérification — c'est-à-dire exactement ce que la règle cherche à garantir. Quatre
bancs étaient punis pour avoir bien écrit leur `else` (manche_edition_lot1, manche_edition_lot3,
probe_clic_accord_voisin, sentinelle_atteignabilite). Un garde-fou qui punit la branche `else` bien
écrite apprend à ne plus en écrire. Reste interdit, inchangé : le `if` NU dont l'autre issue est
muette.

**Sentinelle d'adresses.** Elle déclarait périmés `paroles_pdf_test` et `paroles_repeat_test`, dont
c'est justement le rôle d'empêcher le retour d'un bouton supprimé. Deux causes cumulées :
- elle ne jugeait que la PREMIÈRE ligne citant l'adresse ;
- et l'extraction exige un guillemet collé au `#`, donc elle n'attrapait pas
  `check(!oldBtn, "l'ancien #btn-print n'existe plus")`, où le dièse suit un espace.

Résultat : elle jugeait sur la ligne qui RÉCUPÈRE l'élément, jamais sur celle qui affirme sa
disparition. L'exonération se juge désormais sur toutes les lignes de code du banc, avec une fenêtre
de deux lignes — parce que la vérification d'absence tient presque toujours sur deux instructions dont
la seconde ne répète pas l'adresse. Deux lignes et pas plus : au-delà, une vérification sans rapport
finirait par innocenter une vraie adresse morte.

### 4. Ce qui reste

`seq_short_note_body_test.js` cliquait `#grid-zoom-close`, disparu avec la refonte de la loupe, sous
un `.catch` muet — juste avant de fermer la page. Ligne retirée : il n'y avait aucun état à ranger.

`real_click_loupe_selection_test.js` cherche encore `#grid-zoom-host`. Là il n'y a pas de substitution
possible : `#grid-zoom` ouvre désormais le séquenceur continu, il n'existe plus d'hôte de loupe avec
ses propres cases. Ce banc demande une réécriture de son intention, pas un remplacement d'adresse — il
appartient au chantier « instruire les bancs rouges préexistants », pas à celui-ci.

**Bilan.** Méta-suite 3/3 → **6 PASS / 0 FAIL**, catégorie « identifiants DOM introuvables » à zéro
fichier. Sentinelle d'adresses 196/6 → **200 PASS / 2 FAIL**. Sentinelle d'atteignabilité : rouge,
mais pour la première fois avec de vraies mesures sur les surfaces qu'elle prétendait éprouver.

## Suite : ce que la sentinelle avait vraiment trouvé (et ce que je m'étais trompé à annoncer)

« Je te laisse prendre les décisions qui sont les plus logiques. » Elles ont d'abord consisté à
défaire une conclusion que j'avais annoncée trop vite.

### Deux des quatre « défauts » n'existaient pas

J'avais rapporté que `#metronome-sound` était recouvert en son centre par un titre de groupe, et
`#toggle-seq-edit-audio` par `#toggle-show-roman` — en m'appuyant sur un clic réel montrant que la
valeur ne changeait pas. Le clic ne prouvait rien : ces deux commandes vivent dans le `<details class=
"settings-advanced">` des Paramètres, **replié**. Je cliquais un réglage que l'utilisateur ne voit pas.

Le mécanisme, mesuré : Chromium 141 masque le contenu d'un `<details>` fermé via `content-visibility`
sur `::details-content`. Il saute le rendu SANS remettre les géométries à zéro. Relevé : le `<details>`
fait 51px de haut (le résumé seul) et son corps annonce pourtant 91px à y=545, hors de la boîte de son
propre parent. Les quatre filtres de la sentinelle — largeur/hauteur nulles, `display:none`,
`visibility:hidden`, `opacity:0` — ne voient rien de tout ça : toutes ces propriétés valent leurs
valeurs normales. La sentinelle mesurait donc des commandes repliées, et `elementFromPoint` lui
renvoyait ce qui occupe VRAIMENT ce point de l'écran — le titre du groupe suivant. D'où le verdict
« recouvert », qui décrivait un fait exact avec la mauvaise conclusion.

Correctif : `checkVisibility({ contentVisibilityAuto: true, … })` en plus des quatre tests. Vérifié :
il rend `false` pour les deux commandes du repli et `true` pour leurs voisines visibles, de dimensions
strictement identiques (38×20) — c'est-à-dire qu'il tranche exactement là où les dimensions ne
tranchent pas.

Leçon pour ce projet : *un banc qui mesure doit d'abord prouver que ce qu'il mesure est rendu.* Le
rectangle non nul ne suffit plus depuis `content-visibility`.

### Les trois vrais constats, corrigés

Une fois le filtre juste, il restait cinq commandes réellement visibles sous le plancher de 32px sur
téléphone : trois interrupteurs des Paramètres à 38×20, plus `bpm-val` (30×18) et
`toggle-complex-mode` (30 de large) dans les réglages du morceau. Décision : les corriger, sous
`(pointer: coarse)` uniquement. Un plancher qu'on ne tient pas n'est pas un plancher — et sur un écran
à souris, 20px se visent très bien, la densité des Paramètres n'a aucune raison d'y perdre.

C'est la PISTE de l'interrupteur qui grandit, pas la pastille : le dessin ne change pas, la cible
devient prenable. Le centrage vertical de la pastille passe de `top: 1px` à un vrai centrage, et la
variante « allumée » doit répéter ce centrage dans sa propre `transform` — une transform en écrase une
autre, et sans ça la pastille allumée resterait collée en haut d'une piste deux fois plus haute.

Résultat : `sentinelle_atteignabilite` **25 PASS / 0 FAIL**, la dette tactile reste à six, plafond
intact.

### Le banc de la loupe : réécrire l'intention, pas l'adresse

`real_click_loupe_selection_test` cherchait `#grid-zoom-host`. Aucune substitution n'était possible :
`#grid-zoom` n'ouvre plus une vue à part avec sa propre grille, il ouvre le séquenceur continu et la
grille reste la grille. Mais la QUESTION du banc n'a pas vieilli : après un vrai clic navigateur sur ce
bouton, l'accord doit rester sélectionné, rester en édition, et sa case doit le montrer. Trois de ses
quatre vérifications passaient déjà ; seule la quatrième visait un DOM disparu.

Réécrite sur la grille actuelle, et au passage rendue plus stricte : l'ancienne version concaténait
les classes et cherchait `selected` et `editing` dans la chaîne — deux cases différentes auraient
suffi à la satisfaire. La nouvelle exige les deux sur la MÊME case. `5 PASS / 0 FAIL` : un des six
rouges de la ligne de base est éteint, et le banc en dit plus qu'avant.

**Bilan de la campagne.** meta_suite 3/3 → **6/0** · sentinelle_adresses 196/6 → **202/0** ·
sentinelle_atteignabilite → **25/0** · real_click_loupe_selection → **5/0**. Ligne de base des rouges
préexistants : six → cinq.

## Versions d'un même morceau : comparer, puis choisir — et sortir la date du nom

Trois demandes liées : « une meilleure analyse des versions précédentes d'un même morceau », « lorsque
j'importe un morceau, j'aimerais que tu me demandes si je veux écraser ou non la version précédente »,
et « tous les fichiers ont aujourd'hui un titre avec la version entre parenthèses […] j'aimerais que
cela soit précisé comme une option pour pouvoir ou non voir la date de la dernière modification ».

### 1. Il manquait l'issue la plus attendue

L'import fusionnait par identifiant et n'offrait que deux sorties : ignorer (par défaut) ou dupliquer
en copie. **Écraser n'existait pas** — alors que c'est la raison la plus courante de réimporter un
morceau : on en rapporte une version plus récente et on veut qu'elle remplace l'ancienne.

La question était posée par un `confirm()`, ce qui la condamnait à être binaire. Trois issues
raisonnables n'entrent pas dans un oui/non, et surtout un `confirm()` ne sait rien montrer : il
demandait de choisir à l'aveugle entre deux versions dont rien ne disait ce qui les distinguait.

D'où une vraie fenêtre (`#import-conflict-modal`) qui, pour chaque morceau en conflit, aligne la
version **en place** et celle du **fichier** — nombre de parties, nombre d'accords, date — et marque
laquelle est la plus récente. C'est ça, l'« analyse des versions » : pas un avertissement, une
comparaison. Les trois boutons ne sont proposés qu'après.

**Deux décisions de conservation, prises parce qu'elles ne vont pas de soi :**

- *Le dossier de rangement survit à l'écrasement.* Un dossier est un classement LOCAL, propre à cette
  bibliothèque-ci ; une sauvegarde venue d'ailleurs n'a pas à défaire le rangement d'ici. Vérifié au
  banc : « Perso » est toujours là après écrasement.
- *La copie garde la date du FICHIER, pas celle de l'import.* L'ancien code écrivait `Date.now()` sur
  la copie : une vieille sauvegarde passait alors pour la plus récente des deux, ce qui détruisait
  précisément l'information dont on a besoin pour s'y retrouver entre versions.

Et un effet de bord à ne pas manquer : si le morceau ÉCRASÉ est celui qui est ouvert à l'écran, il est
rechargé. Sans ça l'écran montre l'ancienne version pendant que la bibliothèque contient la nouvelle —
deux vérités en même temps, et la première sauvegarde réécrirait l'ancienne par-dessus la neuve.

### 2. La date n'est plus soudée dans le nom

`Nom (import du 12/03/2026)` : la date entrait dans le NOM du morceau, définitivement, et se
retrouvait ensuite partout — liste déroulante, fenêtre Fichiers, exports — sans aucun moyen de
l'enlever. Un nom est un nom ; la date est une propriété du morceau.

Elle en sort donc, et devient un réglage : **Paramètres → Affichage → « Date de dernière
modification »**, allumé par défaut. Il gouverne les DEUX listes à la fois (déroulante et « Mes
morceaux ») : deux vues qui montrent la même date doivent la montrer de la même façon, sinon le même
morceau paraît daté différemment selon l'écran où on le regarde. `fmtDate` a été hissée hors de
`renderFilesPanel` pour ça.

*Pourquoi un suffixe numérique subsiste malgré tout.* Quand on garde les deux versions, la copie prend
le nom du fichier tel quel — et seulement s'il est déjà pris, un `(2)`. Sans ce garde-fou, deux
versions côte à côte porteraient un nom identique dans la liste déroulante, et **rien** ne les
distinguerait lorsque la date est masquée. C'est le minimum qui rend l'option sûre dans les deux
positions.

### 3. Le banc qui s'est mis à attendre pour toujours

`library_test` pilotait le `confirm()` par `page.on('dialog')`. Le `confirm()` disparu, le banc
attendait une fenêtre que personne ne cliquerait jamais : expiration à 280 s. Conséquence attendue
d'un changement voulu, pas une régression — mais elle valait d'être vue tout de suite plutôt que
d'être découverte au balayage suivant.

Adapté : l'import est lancé SANS être attendu, on attend que la fenêtre paraisse, on clique, puis on
attend la promesse. Et le banc couvre désormais les trois issues, dont celle qui n'existait pas :
écraser remplace en place, garde l'identifiant, ne duplique rien, et conserve le dossier local.
10 assertions, toutes vertes.

*Au passage :* `ERR_CERT_AUTHORITY_INVALID` ajouté au filtre de bruit de `settings_improvements_test`.
Le bac à sable passe par un proxy qui ré-signe le HTTPS avec une autorité inconnue du navigateur de
test ; la police Google Fonts échoue donc ici, jamais chez l'utilisateur. Les voisins de cette liste
filtraient déjà cet échec par son URL — mais ce message-ci n'en porte aucune, il passait au travers et
faisait rougir « aucune erreur JavaScript » par intermittence, selon que la police était en cache.

## Module « Structure » : une vue, pas un troisième silo

Demande : voir d'un coup d'œil la structure d'un morceau (parties, mesures), rappeler les accords dans
l'ordre, imprimer, et « que les sections de HarmoHub, Paroles, et Structure soient liées ». Avec cette
question, rare et précieuse : « je n'ai peut-être pas proposé l'option la plus intuitive de travailler ».

### Ce que l'inventaire a montré avant d'écrire une ligne

La moitié du travail existait déjà, éparpillée : `sectionMeasureCount()` (script.js) calculait le
nombre de mesures d'une partie et servait DÉJÀ à deux endroits — l'en-tête de la grille et les titres
de section du PDF. `moveSection()` savait réordonner. Ce qui manquait n'était pas un calcul, c'était
**un endroit où lire tout ça d'un coup**.

Et une chose était au mauvais endroit : `repeatCount` vivait uniquement dans Paroles, où son propre
commentaire le décrivait comme « propre à Paroles » et « repère purement indicatif ». C'est pourtant
une donnée du MORCEAU — elle décrit sa forme, pas la mise en page des paroles.

### La décision de fond : vue, pas module

Paroles est une page séparée qui reçoit un **instantané** du morceau. Cet instantané dérive déjà, et
l'appli le sait : elle affiche « Le morceau a changé dans HarmoHub depuis ta dernière session ici » et
jette les accords posés dont l'index n'existe plus. Refaire Structure sur ce modèle aurait produit une
**troisième copie** des parties, à synchroniser — exactement l'inverse de ce qui était demandé.

Structure ne possède donc aucune donnée : elle lit les parties réelles. Il n'y a rien à synchroniser
parce qu'il n'y a qu'un exemplaire. Conséquence directe et voulue : y changer l'ordre ou les
répétitions change le morceau, et c'est précisément ce que le banc vérifie — pas l'affichage, mais le
fait que le geste atteigne la grille.

### Deux longueurs pour la même partie

Paroles RECALCULAIT le nombre de mesures de son côté, avec `Math.round` là où HarmoHub fait
`toFixed(1)`. Une partie de 7,5 mesures s'affichait donc « 8 » dans un module et « 7.5 » dans l'autre.
Personne ne l'avait vu ; une vue Structure l'aurait mis en vitrine. La valeur voyage désormais dans le
fichier (`measures`), calculée une seule fois. Le repli local ne sert qu'aux fichiers exportés avant ce
changement — et reproduit alors la règle d'HarmoHub, pas l'ancien arrondi.

### Ce que j'ai ajouté à la demande, et pourquoi

La liste demandée était juste mais **statique**. Trois ajouts, tous tirés de ce qu'on cherche vraiment
en regardant une structure :

- **La mesure de départ de chaque partie.** « Le pont commence mesure 45 » est l'information qu'on
  cherche en répétition — et elle n'existait nulle part : chaque module savait dire la LONGUEUR d'une
  partie, aucun ne savait dire OÙ elle tombe. Une somme cumulée, répétitions comprises.
- **Les accords groupés par mesure**, `| C | Am | F G |`, et non à plat. Un musicien lit une grille,
  c'est-à-dire des mesures. Un accord tenu sur deux mesures n'est écrit qu'une fois, la suivante
  portant `%` — l'écrire deux fois donnerait à lire deux accords là où il n'y en a qu'un.
- **Les familles de variation.** L'exemple venait de l'utilisateur lui-même (« couplet (variation) ») :
  le regroupement se fait sur le nom AVANT la parenthèse, donc sans aucune saisie supplémentaire.

Et la réponse à « pas la plus intuitive » : **réordonner depuis cette vue**. `moveSection()` existait ;
la vue passe ainsi de résumé passif à l'endroit où l'on ARRANGE le morceau.

### L'impression, sans troisième moteur PDF

Il y a déjà deux chaînes jsPDF dans ce projet (HarmoHub et Paroles). Une troisième aurait été la
troisième copie de la même mécanique. Ici le contenu est du texte et des filets : l'impression du
navigateur le rend parfaitement, et « Enregistrer en PDF » y est une destination standard. Le corps
est remplacé le temps de l'impression — imprimer la page telle quelle n'aurait donné que la grille et
le volet, jamais cette fenêtre, qui vit dans un overlay.

### La sentinelle a attrapé mon propre bouton

`structure-btn` mesurait 90×26 sur téléphone, sous le plancher de 32px. Le réflexe aurait été de
l'inscrire dans `DETTE_TACTILE` — mais cette liste est plafonnée à six par une vérification explicite,
et l'allonger pour faire taire ce qu'elle vient de trouver reviendrait à démonter le garde-fou (c'est
l'arbitrage déjà pris au lot précédent). Corrigé à la source, sur la classe partagée : « Paroles » et
« Fichier » en profitent, et **la dette tactile passe de six entrées à quatre**.

**Bilan.** `structure_test` 16/0 · `paroles_repeat` 9/0 · `export_lyrics` 9/0 · `paroles_test` 24/0 ·
`sentinelle_atteignabilite` 25/0 · `sentinelle_adresses` 202/0 · `meta_suite` 6/0.

## Rangement des fichiers, lot A : le nommage d'abord

Demande : que les exports se rangent tout seuls dans une arborescence locale, au lieu de s'entasser
dans Téléchargements — « je me perds rapidement dans les versions », « j'ai vraiment besoin de ne pas
perdre mes morceaux », et la règle « doit fonctionner sur n'importe quel système ».

### Pourquoi le nommage vient AVANT le rangement

Le rangement automatique repose sur File System Access (`showDirectoryPicker`). Cette API n'existe que
sur Chrome et Edge en version bureau : **ni Safari, ni Firefox, ni iPhone, ni Android**. L'exigence
« sur n'importe quel système » ne peut donc pas être tenue par ce mécanisme — c'est une limite du
navigateur, pas un manque d'effort, et il valait mieux le dire avant d'écrire une ligne.

Le nommage, lui, marche partout. Même déversés en vrac dans Téléchargements, des fichiers bien nommés
se regroupent et se trient tout seuls. C'est la seule partie qui tienne la promesse sur tous les
appareils, et elle ne pourra pas régresser quand le rangement viendra par-dessus.

### La forme retenue, et le raisonnement derrière chaque segment

    HarmoHub - Ballade - Accords - 2026-09-17 1432.pdf
    HarmoHub - Bibliotheque - 2026-09-17 1432.json

- **L'appli en tête** : HarmoHub et TabHub ne se mélangent jamais, y compris dans un dossier commun.
- **Le morceau ensuite** : c'est par morceau qu'on se perd. Toutes ses pièces — accords, paroles,
  MIDI, audio — se retrouvent côte à côte dans n'importe quel explorateur trié par nom.
- **Le type, puis la date** : les versions d'un même document s'empilent dans l'ordre chronologique.
- **L'heure n'est pas décorative.** Avec la seule date, deux exports le même jour donnaient
  « (1) », « (2) » ajoutés par le navigateur — précisément ce qui fait perdre le fil. Les deux-points
  étant interdits sous Windows, l'heure s'écrit « 1432 ».
- **`aaaa-mm-jj`** parce que c'est le seul format dont le tri alphabétique donne l'ordre
  chronologique. Un banc le vérifie explicitement.

### Une règle, un endroit

Les neuf routes d'export recopiaient chacune leur propre sanitisation
(`replace(/[\\/:*?"<>|]+/g, '_')`). Neuf copies de la même règle, dans deux fichiers — et ce projet a
déjà payé ce motif : le nombre de mesures d'une partie était calculé à deux endroits avec deux
arrondis différents, si bien que le même morceau paraissait changer de longueur selon l'écran.

Tout passe désormais par `fichiers.js`, chargé par index.html ET paroles.html. Le fichier est commun
dès aujourd'hui parce que les deux applis seront servies depuis la même origine : mieux vaut un module
partagé dès le premier jour que deux copies à réconcilier au premier ajustement. La sanitisation y
gagne au passage ce qui manquait partout : caractères de contrôle retirés, points et espaces en fin de
nom supprimés (Windows les efface en silence, si bien qu'un fichier ne porte pas le nom qu'on croit),
longueur bornée, et repli sur « Sans titre » plutôt qu'un fichier anonyme.

### Mesures faites avant de promettre un « export intégral »

Sur un morceau réaliste (4 parties, 32 accords) : JSON **0 ms**, MIDI **0 ms**, PDF accords
**3 193 ms**. Le MP3 n'a pas pu être mesuré ici — il télécharge ses échantillons depuis
`tonejs.github.io`, bloqué par le bac à sable. Fragilité au passage : **l'export MP3 dépend du
réseau**, et d'un hébergeur tiers.

Conséquence pour la suite : une bibliothèque de 50 morceaux représente déjà ≈ 2 min 40 rien qu'en PDF
d'accords. Et deux types ne sont pas groupables en l'état — le PDF Structure passe par
`window.print()` (un clic humain par morceau), et le PDF Paroles vit sur une autre page. D'où la
séparation décidée : **la sauvegarde** (JSON seul, instantané, versionné) ne doit jamais dépendre du
type le plus lent et le plus fragile ; **l'export intégral** reste un geste volontaire, avec MP3
décoché par défaut.

**Banc** : `nommage_fichiers_test` 19/0 — il éprouve la forme, le tri, la sanitisation, le fait que
Paroles produise exactement le même nom qu'HarmoHub, et qu'aucune sanitisation dispersée ne subsiste.
Non-régression : `library` 10/0, `export_lyrics` 9/0, `paroles_pdf` 7/0.

## Rangement des fichiers, lot B : écrire dans un dossier choisi (2026-09-17)

### Le problème, tel qu'il a été posé

« Les exports de la bibliothèque et des morceaux se font directement dans les téléchargements, puis je
dois les ranger correctement moi-même. Je me perds rapidement dans les versions. » Et la contrainte qui
commande tout le reste : « la règle doit fonctionner sur n'importe quel système (ordinateur, mac,
téléphone, etc…) ».

Ces deux phrases tirent dans des directions opposées. Ranger automatiquement demande une API qui
n'existe que sur Chrome et Edge en version bureau — File System Access. Ni Safari (Mac **et** iPhone),
ni Firefox, ni Chrome Android ne l'ont, et aucun contournement n'existe : un site web qui pourrait
écrire où il veut sur un disque serait une faille, pas une fonctionnalité.

D'où les deux étages, décidés ensemble :

| | Étage du bas — le **nommage** (lot A) | Étage du haut — le **rangement** (ce lot) |
|---|---|---|
| Où | Partout, sans exception | Chrome / Edge bureau |
| Ce qu'on obtient | Fichiers en vrac dans Téléchargements, mais qui **se regroupent et se trient tout seuls** | Fichiers classés par type dans un dossier désigné |
| Si ça échoue | — | On retombe sur l'étage du bas |

Le second ne remplace jamais le premier : il se pose dessus. C'est ce qui rend l'exigence « n'importe
quel système » tenable sans mentir.

### Ce que le lot B ajoute

- Un **point de passage unique**, `enregistrerFichier()`, par lequel sortent désormais les **neuf**
  exports (bibliothèque, morceau, PDF accords, PDF paroles, MIDI entier, MIDI par partie, MP3, JSON
  paroles, texte). Il range si un dossier est configuré, télécharge sinon, et **dit dans son retour ce
  qui s'est réellement passé**.
- L'**arborescence** créée dès le choix du dossier : `Bibliotheque/`, `Morceaux/`, `PDF/{Accords,
  Paroles, Structure}/`, `MIDI/`, `Audio/`, `Texte/`. À plat par type, sans refléter les dossiers de la
  bibliothèque : un classement à deux dimensions oblige à choisir où chercher. Le lien entre les pièces
  d'un même morceau est porté par le **nom**, qui voyage partout — y compris sur les téléphones.
- Un **`_index.json`** à la racine, qui recense ce qui a été écrit. Il ne sert pas à retrouver les
  fichiers (l'explorateur le fait très bien) mais à savoir, sans parcourir le disque, quelles versions
  existent déjà — la base des lots C (écraser ou garder les deux) et D (ne garder que dix versions).
- Une **entrée de menu** qui annonce la destination **avant** les exports, pas après.

### Trois décisions qui méritent d'être écrites

**1. `pdf.save()` a dû disparaître.** Cette méthode de jsPDF télécharge directement, sans jamais rendre
les octets. Impossible de ranger ce qu'on ne tient pas. Les deux appels (HarmoHub et Paroles) sont
devenus `pdf.output('blob')`, le téléchargement n'étant plus qu'un des deux dénouements possibles.

**2. La permission se demande AVANT le long calcul, pas après.** Chrome ne redemande la permission
d'écrire que pendant un geste de l'utilisateur, et un geste « refroidit » en quelques secondes. Or un
export PDF passe trois secondes dans html2canvas, et un MP3 bien davantage. Demander à la fin, au
moment d'écrire, c'était retomber silencieusement dans Téléchargements **alors qu'un dossier est
configuré** — le pire des cas, parce que rien ne le signale. `preparerRangement()` est donc appelé en
tête de `exportPdf`, `exportAudio`, `exportMidi` et `exportLyricsPdf`, et la racine obtenue est passée
jusqu'à l'écriture.

**3. Le nom du dossier est doublé dans localStorage.** La poignée vit dans IndexedDB — seul magasin du
navigateur qui sache sérialiser un `FileSystemHandle`. Mais la lire demande un `await`, or les menus se
construisent d'un trait. Sans ce doublon, le menu ne pourrait pas dire quel dossier est configuré au
moment où il s'affiche. Le nom seul ne donne aucun accès ; la poignée, elle, reste dans IndexedDB.

### Ce que le banc éprouve en priorité : l'échec

`tests/rangement_fichiers_test.js` (34 contrôles). Le sélecteur système, qu'aucun navigateur piloté ne
peut manipuler, est remplacé par un dossier **OPFS** — le disque privé du navigateur, qui expose
exactement la même interface `FileSystemDirectoryHandle`. Tout ce qui est en dessous du sélecteur
(arborescence, écriture, index, persistance, permission) est donc le vrai code.

Le contrôle qui compte le plus n'est pas que le rangement marche, c'est qu'il **échoue bien**. Le banc
supprime le dossier sous les pieds de l'appli — clé USB retirée, dossier déplacé — et vérifie que
l'export repart dans Téléchargements au lieu de disparaître. Un export qui ne produit rien serait bien
pire qu'un export mal rangé. Trois autres pièges sont couverts pour la même raison : un fichier rangé
doit être **relisible** (une coquille vide serait pire qu'une absence, puisqu'on croirait l'avoir), le
sélecteur ne doit **pas** se rouvrir au rechargement (sinon la fonctionnalité serait à refaire chaque
séance), et sur un navigateur sans l'API l'entrée de menu reste **visible et éteinte** plutôt que
disparue — un menu où une fonction s'évapore sans explication laisse croire à une panne.

### Adaptation de banc, pas régression

`nommage_fichiers_test` relisait la liste des noms exportés avant que le moindre nom y soit inscrit :
les routes d'export sont devenues asynchrones (elles commencent par demander si un dossier est
configuré). Deux `await` ajoutés côté banc. La conséquence attendue d'un changement voulu, pas une
régression du produit.

### Un rouge rencontré en chemin, et qui n'est PAS de ce lot

`sortie_edition_involontaire_test` rend « 3 PASS / 1 FAIL ». Le verdict principal passe (43 contrôles
éprouvés, aucun ne fait sortir de l'édition) ; ce qui échoue est la **mise en place** des onze contrôles
qui vivent dans la fenêtre d'édition manuelle du manche : `#guitar-edit-btn` est `disabled` et hors flux
dans l'état que le banc prépare, donc la fenêtre ne s'ouvre jamais.

Vérifié plutôt que supposé : le même relevé, joué sur le commit précédent (`57f5e23`, servi à part sur
le port 8935 via `git worktree`), donne **exactement le même état** — `disabled: true`, rect 0×0,
`offsetParent` nul. Ce rouge **précède** le lot B, qui ne touche ni le manche ni le mode Modification.
Il est noté ici pour ne pas être découvert deux fois, et laissé en l'état : onze contrôles restent donc
non vérifiés par ce banc tant qu'il n'est pas repris. Le coût du diagnostic n'est pas anodin — chaque
mise en place ratée expire au bout de 30 s, ce qui porte ce banc à une douzaine de minutes.

## Le .mid exporté est-il lisible ailleurs ? (2026-09-17)

### La question posée

« Je n'ai pas MuseScore, fais en sorte que ça fonctionne, sinon je verrai plus tard lorsque je pourrai
tester. » Autrement dit : personne ne peut ouvrir le fichier exporté pour vérifier qu'il est bon.

Les bancs MIDI existants font tous un **aller-retour** : ils exportent, puis réimportent avec notre
propre analyseur. C'est utile, mais ça ne prouve rien sur MuseScore, GarageBand ou Logic — si notre
écrivain et notre lecteur partagent le même malentendu, l'aller-retour passe et le fichier reste
illisible ailleurs. Ce trou-là est exactement celui que l'utilisateur ne peut pas combler lui-même.

### Deux fausses pistes, écartées par la mesure

Un premier relevé, avec un lecteur MIDI tiers, a montré deux anomalies apparentes : un accord `G7`
sorti en triade majeure (sans la septième), et une partie entière **muette**. Les deux venaient de mes
propres données d'essai, pas du produit :

- l'identifiant interne d'une septième de dominante est `dom7` ; `'7'` n'est qu'un alias d'écriture
  accepté à la SAISIE (voir la table ligne 187), et un accord enregistré avec `'7'` retombe en accord
  majeur ;
- `playStyle: 'arp'` n'est pas un préréglage. `seqPreset` ne connaît que `held` et les couples
  cadence/articulation (`noire_staccato`…) ; l'arpège se saisit à la main dans le séquenceur, et un
  accord « arpège » non dessiné est donc silencieux — en MIDI **comme à l'écoute**. Cohérent, pas
  cassé.

De même, la piste unique alors que deux accords portaient `instrument: 'strings'` : l'instrument est
une propriété du MORCEAU (`instrumentMorceau`), pas de l'accord. Un morceau, un instrument, une piste.

Mesurer avant d'accuser, une fois de plus : trois « défauts » sur trois étaient des erreurs de banc.

### Ce que la mesure a VRAIMENT trouvé : l'encodage du texte

Le nom de piste « Cordes synthé » ressortait en « **Cordes synthÃ©** » chez le lecteur tiers.

La norme MIDI ne dit rien de l'encodage des événements de texte — titre du morceau, nom de piste,
marqueurs de partie. Elle les décrit comme du texte 8 bits, sans préciser lequel. Chaque lecteur
devine donc à sa façon, et chez MuseScore savoir lire autre chose que de l'ASCII est encore une
**demande ouverte**, pas une capacité (musescore.org/en/node/3370). Vérifié plutôt que supposé.

Aucun encodage n'étant universellement juste, on ne parie pas : `asciiPourMidi()` écrit ce qu'aucun
lecteur ne peut déformer. « Rêve d'été » devient « Reve d'ete », « Refrain à Noël » devient
« Refrain a Noel ». L'accent se perd, mais **lisiblement** — et le repère reste utilisable pour
naviguer dans le morceau, ce qui est toute sa raison d'être.

**Ce choix ne vaut que pour le MIDI.** Les noms de FICHIERS gardent leurs accents (voir
`nettoyerNomFichier`) : un système de fichiers moderne sait exactement quoi en faire, là où le MIDI ne
le sait pas. Deux médias, deux contraintes, deux réponses — et c'est volontaire, pas une incohérence.

Corrigé au passage, sans conséquence visible aujourd'hui : `if (!GM_PROGRAM[key])` renvoyait au piano
tout instrument dont le programme General MIDI vaut **0** — c'est-à-dire le piano lui-même. Sans effet
pour l'instant, mais le premier instrument ajouté avec le programme 0 aurait été muet. Devenu
`=== undefined`.

### Le banc permanent

`tests/midi_export_conformite_test.js` (27 contrôles) relit les octets avec un **lecteur SMF écrit
depuis la norme**, sans réutiliser une ligne de l'appli : chunks et longueurs annoncées, delta-times de
4 octets au plus, appariement Note On / Note Off, End of Track, tempo et métrique relus, marqueurs de
partie au bon top, bornes 0-127, canal 9 (percussions) jamais utilisé, durée totale, et l'export d'une
seule partie qui repart bien du temps 0.

Trois contrôles méritent d'être nommés :
- **la piste 0 ne porte aucune note** — convention du format 1, et plusieurs logiciels de notation
  importent mal un fichier qui l'enfreint ;
- **aucune note laissée ouverte** — une note sans Note Off sonne indéfiniment dans un synthé ;
- **aucun octet de texte hors ASCII imprimable** — la garantie mise en place ci-dessus, qui se
  reperdrait au premier `TextEncoder` réintroduit sans y penser.

Le recoupement avec `@tonejs/midi` (lecteur tiers réel) a été fait à la main, hors dépôt : le projet
n'a aucune dépendance npm et ce banc ne doit pas en introduire une. C'est le lecteur écrit depuis la
norme qui reste, et il ne demande aucune installation.

### Deux bancs restés en arrière, réparés

- `midi_persection` attendait encore `Ma Chanson - Couplet.mid`, l'ancien nommage d'avant le lot A.
  C'est une mise à jour que le lot A aurait dû faire et n'a pas faite. Il éprouve maintenant la
  RÈGLE (`HarmoHub - <morceau> - MIDI <partie> - <date>.mid`) plutôt qu'une chaîne figée — écrire la
  date en dur l'aurait condamné à devenir faux le lendemain.
- `three_more_features` figeait le libellé complet des options du sélecteur de morceaux, auxquelles
  `7ea17c0` a ajouté « — <date> » deux commits plus tôt. Il compare désormais le nom seul. Rien à voir
  avec les lots de rangement : vérifié par l'historique (`git log -S`) plutôt que supposé.

## Le balayage complet du 17/09 : 29 rouges, dont 21 qui n'en étaient pas

### Le relevé

| | Avant | Après |
|---|---|---|
| Verts | 165 | **188** |
| Rouges | 29 | **8** |
| Sans verdict | 9 | 7 |

Les 8 rouges restants : les **5 rouges de référence** déjà connus et non instruits
(`probe_clic_accord_voisin`, `probe_defilement_tactile`, `probe_regle_voisins`, `probe_seq_finitions`,
`seq_notes_libres_clavier`), `sortie_edition_involontaire` (antérieur, vérifié contre `57f5e23`), et
**deux bancs fragiles sous charge** — voir plus bas.

### La cause dominante : un mode d'échec du mandataire, pas une ligne de code

Vingt-cinq bancs échouaient sur « aucune erreur JavaScript ». Mesuré plutôt que supposé : le conteneur
de test passe par un mandataire qui intercepte le TLS, et la feuille de style Google Fonts n'aboutit
jamais. Le piège est dans le MESSAGE : Chrome écrit

    Failed to load resource: net::ERR_CERT_AUTHORITY_INVALID

**sans l'URL**. Les filtres de bruit étaient écrits sur `fonts.googleapis` — ils ne pouvaient rien
reconnaître. Il faut filtrer sur le NOM DE L'ERREUR. Le jour où le mandataire a changé de mode d'échec
(auparavant `ERR_TUNNEL_CONNECTION_FAILED`, encore filtré partout), vingt-cinq bancs sont passés au
rouge d'un coup sans qu'une ligne de l'appli ait bougé.

**Une erreur que j'ai commise en réparant, et qui mérite d'être écrite.** J'ai étendu le filtre par
`sed` en supposant que les soixante bancs concernés utilisaient tous une expression régulière. Dix
utilisaient `.includes('ERR_TUNNEL_CONNECTION_FAILED')` — une CHAÎNE. Le remplacement y a produit
`.includes('ERR_TUNNEL_CONNECTION_FAILED|ERR_CERT_AUTHORITY_INVALID')`, qui ne correspond à rien : non
seulement le nouveau bruit n'était pas filtré, mais **l'ancien ne l'était plus non plus**. Repéré au
relevé suivant, réparé en deux tests séparés. Leçon : un `sed` sur soixante fichiers doit être suivi
d'une vérification que le motif atterrit bien dans le contexte attendu — ici, `grep` des occurrences
tombées entre guillemets plutôt qu'entre barres obliques.

Un prédicat partagé `estBruitReseau` vit désormais dans `_harness.js`. Le motif reste recopié dans une
soixantaine de bancs anciens (dette notée) ; les nouveaux passent par le harnais.

### Le balayage rend maintenant son propre verdict

Il fallait jusqu'ici le reconstruire après coup avec des `grep` improvisés — et un `grep FAIL` naïf
compte les « 0 FAIL » des lignes de bilan comme des échecs. `run_all_fast.sh` imprime désormais un
relevé à **trois états**, et le troisième compte autant que les deux autres : **SANS VERDICT**. Un banc
planté, expiré, ou qui ne contient aucun contrôle ne prouve rien — et passait jusqu'ici pour un
silence rassurant.

Le lanceur **refuse aussi de démarrer** si sa liste « sensible » cite un fichier supprimé. Trois
entrées fantômes (`seq_pinch_touch_conflict`, `seq_twofinger_jitter`, `seq_twofinger_pan`) s'y
« exécutaient » depuis la disparition de leurs fichiers : `node` rendait « Cannot find module », le
balayage passait au suivant, et le relevé les comptait comme muettes.

### Deux bancs fragiles sous charge, rangés en série

`manche_edition_lot6` (1 FAIL) et `glock_full_real_ui` (2 FAIL) rendent **0 FAIL lancés seuls**. Le
premier éprouve la DISPARITION d'un aperçu au départ de la souris, le second un état relu APRÈS
RECHARGEMENT COMPLET : deux mesures sensibles au temps, qui dérivent dès que quatre navigateurs se
disputent le processeur. Déplacés dans la phase série plutôt que d'assouplir leurs contrôles — le
défaut qu'ils gardent est réel, c'est leur horloge qui ne l'est pas.

### Les 7 « sans verdict », maintenant visibles

Cinq sont des **ébauches de diagnostic abandonnées** : `guitar_lock_click` définit un `check()` et ne
l'appelle jamais, `ctx_nav_scroll`, `instrument_stress`, `item1_hzoom_out` et `smoke` impriment des
mesures sans jamais conclure. Un fichier nommé `guitar_lock_click_test.js` qui n'éprouve rien fait
paraître la couverture plus large qu'elle n'est. Deux autres (`detune`, `probe_cache_perime`) concluent
bel et bien, mais écrivent « OK : » au lieu de « PASS ». Rien n'est supprimé ici — le relevé les
montre désormais à chaque balayage, ce qui suffit à ce qu'ils ne se cachent plus.

## Les garde-fous d'écrasement (2026-09-18)

### Le constat, mesuré avant de proposer quoi que ce soit

Deux craintes exprimées : « si je réexporte une bibliothèque, les morceaux déjà présents sur le disque
et qui ne sont plus sur l'application ne doivent pas être supprimés », et « des morceaux modifiés
ailleurs (que l'appli) a "oublié" ne doivent pas être écrasés ».

**Aucune des deux n'était réalisée.** `removeEntry` n'apparaissait nulle part dans le code applicatif,
et chaque nom portant la date à la minute, un export ne réécrivait jamais un fichier existant. Une
seule fenêtre étroite existait : deux exports du même morceau dans la même minute.

Mais c'était une **sûreté par accumulation**, et c'est elle qui coûtait du temps. Rien n'étant jamais
écrasé, rien n'était jamais REMPLACÉ : dix exports de « Ballade » donnaient dix fichiers, et aucun dont
on puisse dire « c'est LE fichier de Ballade ». Le « je me perds dans les versions » revenait par la
fenêtre.

### Ce qui change

**Un nom canonique par document, les anciens dans `_versions/`.**

```
Morceaux/HarmoHub - Ballade - Morceau.json                 <- LE fichier, jamais renommé
Morceaux/_versions/HarmoHub - Ballade - Morceau - ….json   <- les dix précédents
```

Le nom stable donne un point fixe ; l'horodatage triable du lot A part dans `_versions/`, où il sert
vraiment puisque c'est là qu'on cherche « celle d'avant ». Le TÉLÉCHARGEMENT, lui, garde le nom
horodaté : dans Téléchargements il n'y a ni rotation ni dossier de versions, et deux fichiers de même
nom y deviennent « (1) », « (2) » — exactement ce qu'on évite. L'asymétrie est voulue et verrouillée
par un contrôle.

**Sources et dérivés, deux régimes.** Un JSON de morceau ou de bibliothèque est une SOURCE : l'écraser
peut perdre du travail, d'où le garde-fou de fraîcheur. Un PDF, un MIDI, un MP3, un TXT sont DÉRIVÉS :
ils se régénèrent d'un clic. Les deux profitent de la rotation ; seules les sources posent une question.

**Le garde-fou lui-même : on lit avant d'écrire, toujours.** C'est le disque qui fait foi, pas ce que
l'appli croit y avoir laissé. Trois issues, dont deux s'arrêtent :

| État du fichier en place | Ce qui se passe |
|---|---|
| absent, ou plus ancien | on écrit, l'ancien part en version |
| même morceau, **plus récent** | conflit « modifié ailleurs » |
| **autre** morceau, même nom | conflit « homonyme » |

Le second cas est le prix du nom lisible : le nom canonique est indexé sur le NOM du morceau, pas sur
son identifiant. Le payer par une vérification vaut mieux que par un nom du genre
`Ballade - song_mu5skoqp3o85.json`.

La fenêtre offre **quatre** issues, là où l'import en a trois. « Recharger depuis le disque » est
souvent la bonne quand le fichier est le plus récent, et sans elle il faudrait annuler puis aller
réimporter à la main — le temps qu'on cherche justement à faire gagner.

**Enregistrer dans l'appli = le fichier suit.** Tant que l'écriture est un geste à part, il faut y
PENSER, et c'est en n'y pensant pas qu'on perd le fil. `saveCurrentSong` écrit désormais le fichier,
garde-fou compris. Le moment est bien choisi pour poser une question : on vient d'appuyer sur
« Enregistrer », on n'est pas au milieu d'une phrase. Et l'écriture ne bloque jamais l'enregistrement
lui-même — un dossier débranché ne doit pas faire échouer un Ctrl+S, mais il le DIT.

**La sauvegarde de bibliothèque rend des comptes.** Elle ne supprime rien, ne l'a jamais fait, et le
banc le verrouille. Mais ne rien supprimer EN SILENCE ne rassure personne : les morceaux présents sur
le disque et absents de l'appli sont désormais NOMMÉS après chaque sauvegarde. C'est aussi le chemin du
retour — un morceau perdu par un vidage de cache se récupère au lieu de se chercher.

### Le défaut que le banc a trouvé

Les archives étaient datées à la MINUTE. Quatre enregistrements rapprochés ne laissaient qu'**une**
version : les quatre portaient le même nom et s'écrasaient l'une l'autre. Le filet de sécurité se
vidait tout seul, en silence, précisément dans le cas où l'on en a le plus besoin — des essais
successifs en quelques minutes. Deux Ctrl+S d'affilée suffisaient. Les versions se datent maintenant à
la SECONDE (`horodatageVersion`), avec un compteur en dernier recours.

### La purge : la seule suppression de tout le projet

`purgerVersions` est la première ligne de ce projet qui efface un fichier. Elle est volontairement
étroite — uniquement dans `_versions/`, uniquement les noms commençant par la base du morceau visé,
uniquement au-delà des dix plus récents — et le banc la met à l'épreuve sur un dossier peuplé à la
main : elle ne touche ni aux versions d'un AUTRE morceau, ni à un fichier déposé là sous un autre nom,
ni au fichier courant. Ces quatre contrôles comptent plus que celui qui vérifie qu'elle supprime bien.

`tests/garde_fous_ecrasement_test.js` : 31 contrôles.

## La racine des doublons de titre (2026-09-18)

### Le signalement

« Dans l'appli, je commence à avoir beaucoup de fois le même titre de morceau, avec seulement les dates
qui changent, et je ne sais plus lequel est le morceau correct. »

### La cause, trouvée en lisant l'import

L'import ne dédupliquait que par **identifiant**. Or chaque navigateur crée les siens de son côté
(`'song_' + Date.now()…`) : « Ballade » enregistrée séparément dans Chrome et dans Safari porte deux
identifiants différents. En réimportant la bibliothèque de l'un dans l'autre — le geste fait à *chaque*
changement de navigateur — l'appli ne voyait aucun conflit et **ajoutait** un morceau de plus, sous le
même titre. Répété, ça produit exactement le désordre décrit.

Ce n'étaient pas les copies volontaires : « garder les deux » renomme déjà en « Ballade (2) ».

### Ce qui change

**Le titre devient une identité de repli.** `apparierMorceau` cherche par identifiant, puis par titre.
La casse et les espaces ne comptent pas (« Ballade » = « ballade  »), mais un suffixe compte :
« Ballade (2) » est un nom *choisi*, il reste distinct. Quand plusieurs morceaux d'ici portent le même
titre — le désordre actuel — on apparie avec le plus récent.

**La décision devient individuelle.** Elle était globale : un seul « Écraser » pour tout le lot, y
compris les morceaux dont la version d'ici était la plus récente. Combiné à un réimport complet de la
bibliothèque à chaque changement de navigateur, c'était le dernier endroit où du travail pouvait se
perdre. Chaque ligne porte maintenant ses trois choix, **cochés d'avance sur la plus récente** — si
bien qu'« Appliquer » sans rien toucher fait déjà la bonne chose. Les quatre raccourcis (« partout : la
plus récente / écraser / garder les deux / ignorer ») gardent le cas courant à un clic.

### Deux défauts trouvés en chemin

**L'écrasement gardait l'identifiant du FICHIER.** Sans conséquence tant que l'appariement se faisait
par identifiant — les deux étaient le même. Avec l'appariement par titre, le morceau importé vient d'un
autre navigateur : `getCurrentSongId` aurait pointé dans le vide et le morceau ouvert aurait disparu de
sous les doigts. L'identifiant local l'emporte désormais.

**Et une erreur de méthode, la mienne.** Pour remplacer `demanderResolutionImport`, j'ai découpé la
méthode en cherchant le premier `\n    }\n` après une ligne repère. Ce motif apparaît AUSSI à
l'intérieur du corps : le découpage a emporté la méthode suivante, `attachContextMenuTrigger`, et
l'appli ne démarrait plus du tout. Repris par **comptage d'accolades**, avec deux assertions dans le
script de remplacement (« le découpage ne contient pas le nom de la méthode suivante », « les accolades
s'équilibrent »). Une substitution de texte sur du code structuré doit se vérifier avant d'écrire, pas
après.

`tests/import_fusion_titre_test.js` : 23 contrôles.

## Ménage, partage iOS et protections de la sauvegarde (2026-09-18)

### Le ménage des titres en double

Le lot précédent a fermé le robinet (l'import n'empile plus de doublons) ; celui-ci vide la baignoire.
Un bouton n'apparaît dans le gestionnaire de fichiers **que s'il y a du désordre**, et annonce combien
de titres sont concernés. La fenêtre montre chaque groupe avec date, parties et accords, la plus
récente cochée d'avance, plus deux raccourcis (« la plus récente », « la plus complète »).

**Rien n'est supprimé** — décision prise avec l'utilisateur. Les versions écartées vont dans un dossier
`Archives`, d'où elles restent ouvrables. C'est ce qui permet de trancher : on ne se décide bien que
quand se tromper ne coûte rien. Et c'est **réversible** : les archives sont exclues de l'appariement
par titre, donc ressortir un morceau des Archives le remet en jeu. Sans cette exclusion, une archive
plus récente que le morceau gardé aurait repris sa place au premier import, et le ménage se serait
défait tout seul.

### Un défaut de superposition, latent depuis longtemps

Les choix du milieu de la fenêtre de ménage étaient **inatteignables** : l'en-tête du gestionnaire de
fichiers, au même plan (`z-index: 100`), interceptait les clics. Le piège est vicieux — la fenêtre
s'affiche, elle a l'air normale, et seule une partie d'elle refuse le clic ; les boutons du bas, eux,
répondaient.

`#unsaved-modal` avait déjà rencontré ça et l'avait réglé **pour lui seul**. La règle valait pour ses
trois sœurs (`#import-conflict-modal`, `#export-conflict-modal`, `#dedup-modal`) sans que personne
l'ait remarqué : toutes s'ouvrent depuis une `.settings-overlay` déjà affichée. Écrite une fois, pour
la famille entière.

### Le partage système : le seul rangement possible sur iPhone

File System Access n'existe ni sur Safari ni sur Chrome Android. Mais l'iPhone a une autre porte : la
feuille de partage. `navigator.share` avec des fichiers marche depuis Safari 15, et la feuille propose
« Enregistrer dans Fichiers » — donc iCloud Drive, donc un vrai rangement, au même endroit que ce que
l'ordinateur range tout seul.

Deux pièges connus, tous deux couverts par un contrôle : il faut passer **uniquement** `files` (ajouter
`title` ou `text` fait échouer le partage de fichier sur iOS), et `canShare` doit être interrogé avec
le fichier lui-même. Renoncer à la feuille (`AbortError`) **ne déclenche pas** un téléchargement
furtif : on ne sauvegarde pas dans le dos de quelqu'un qui vient d'annuler. L'export MIDI **par
partie** coupe le partage explicitement — on n'ouvre pas cinq feuilles à la suite.

### Trois protections contre la perte silencieuse

- **`navigator.storage.persist()`** au démarrage (Safari 17+, Chrome). Honnêteté sur la portée : ça
  protège de l'éviction sous pression de stockage ; que ça neutralise *aussi* la règle des sept jours
  sans interaction n'est pas documenté clairement. Mieux que rien, pas une garantie.
- **La fraîcheur de la sauvegarde** : au-delà de cinq jours (avant l'échéance de Safari), un rappel,
  **une fois par jour au plus**, et jamais sur une bibliothèque vide.
- **Le rappel en partant** : sur `visibilitychange` et non `beforeunload` — sur iOS, seul le premier
  arrive vraiment (onglet balayé, app basculée, écran verrouillé). Le repère est posé en partant et lu
  au démarrage suivant : prévenir quelqu'un au moment où il s'en va ne sert à rien, il ne regarde déjà
  plus l'écran.

### Le défaut que « Exporter ce qui a changé » a révélé dans mon propre code

`etatMorceauSurDisque` ne connaissait que deux états après l'appariement : « le disque est plus
récent » ou « à jour ». Or « à jour » recouvrait deux situations opposées — le fichier porte déjà cette
version (rien à faire), ou **il est en retard** (c'est LE cas courant : on vient de modifier le morceau
et il faut l'écrire). Les confondre faisait que « Exporter ce qui a changé » n'exportait justement
rien. Trois états désormais : `identique`, `a-ecrire`, `plus-recent`.

Bancs : `menage_doublons` 21/0, `sauvegarde_robustesse` 17/0, `garde_fous_ecrasement` 36/0.
Ce que ces bancs **ne peuvent pas** faire, et il faut le dire : ils tournent sur Chromium. Le
comportement réel de Safari et d'iOS n'est pas mesuré. Ce qui est éprouvé, c'est que le code fait ce
qu'il annonce et, surtout, qu'il se comporte proprement quand l'API visée est **absente** — la
situation de tous les navigateurs sauf un, pour chacune de ces fonctions.

## Supprimer : dans l'appli, et sur le disque (2026-09-18)

### Ce que la relecture a trouvé avant de coder

En cherchant ce qu'il restait à améliorer, j'ai cherché les **promesses que le code fait sans les
tenir** plutôt que des idées nouvelles. Trois trouvées, dont deux de mon fait :

1. **Les morceaux supprimés revenaient.** `deleteSongById` retirait le morceau du navigateur, mais son
   fichier restait sur le disque *et* la sauvegarde de bibliothèque le contenait toujours. Comme
   l'utilisateur réimporte la totalité à chaque changement de navigateur, l'import le voyait comme un
   morceau inconnu et le **rajoutait**. Tout ce qui avait été supprimé ressuscitait, à chaque fois.
2. **`_index.json` était écrit à chaque export et lu par personne.** Je l'avais justifié comme « la
   base des lots suivants » ; ces lots ont finalement interrogé le disque directement, ce qui était le
   bon choix. Retiré. Une comptabilité parallèle qui peut diverger de la réalité est un passif, pas un
   actif : elle coûte une lecture, une analyse et une écriture par export, et le jour où elle ment,
   elle ment avec assurance.
3. **`PDF/Structure/` était créé et ne se remplirait jamais** (la vue Structure passe encore par
   l'impression du navigateur). Retiré de l'arborescence jusqu'à ce que cet export passe par jsPDF.

### La règle décidée par l'utilisateur

« Lorsque je supprime un morceau de l'appli, l'appli doit me demander si elle doit également supprimer
tous les fichiers du disque qui lui sont liés. Si je clique sur non, alors l'appli le réimportera la
prochaine fois. »

Et, dans la foulée : « je voudrais également pouvoir supprimer des morceaux directement sur le disque,
en ne passant pas par l'appli ».

### Le piège du préfixe

C'est la première fois que cette appli efface des fichiers que l'utilisateur n'a pas désignés un par
un. Le danger n'est pas théorique : les fichiers de « Ballade » commencent par `HarmoHub - Ballade - `,
et **ceux de « Ballade - live » aussi**. Supprimer le premier aurait emporté le second.

D'où la règle : un fichier qui appartient AUSSI à un autre morceau de la bibliothèque n'est jamais
retenu — on préfère laisser un fichier de trop que d'en enlever un de travers. Le banc le vérifie avec
trois morceaux dont deux aux noms imbriqués, et mesure que sans la liste des autres morceaux
l'inventaire passe de 8 à 10 fichiers : c'est elle qui protège.

**La sûreté ne vient pas de cette règle.** Elle vient de ce que la **liste exacte est affichée** avant
qu'on demande quoi que ce soit. Une règle prudente cachée dans le code ne se vérifie pas au moment où
l'on décide.

### Deux choses qu'il aurait été facile de bâcler

**« Supprimer aussi les fichiers » ne suffisait pas.** La sauvegarde de bibliothèque contient encore le
morceau : sans rafraîchissement, il serait revenu au premier réimport et l'utilisateur aurait cru
l'avoir fait disparaître. Elle est donc réécrite — et l'ancienne part dans `_versions`, donc rien n'est
réellement perdu.

**Le panneau disque passait d'abord par un `confirm()` du navigateur**, alors que c'est exactement le
même geste, avec exactement les mêmes conséquences, que la suppression depuis la bibliothèque — laquelle
affiche une vraie liste. Deux garanties différentes pour un même danger, c'est la moins bonne des deux
qui finit par s'appliquer. Une seule fenêtre pour les deux chemins désormais.

### Un défaut de robustesse trouvé par le banc

`supprimerDuDisque` déduisait le nom du morceau du **contenu** du JSON. Or c'est le nom de FICHIER qui
regroupe les fichiers entre eux sur le disque — et les PDF, MIDI et MP3 n'ont aucun contenu
interrogeable. Un fichier renommé à la main, ou dont le titre interne a divergé, ne trouvait plus rien.
Déduit du nom de fichier désormais (`nomMorceauDepuisFichier`), avec refus explicite si le nom n'est
pas reconnu.

### Le panneau « Fichiers du disque »

Il lit le DOSSIER et non la bibliothèque : il montre donc aussi ce que l'appli ne connaît plus — un
morceau laissé sur une autre machine, ou perdu par un vidage de navigateur — et permet de le reprendre
ou de l'effacer sans avoir à le faire exister ici d'abord. C'est le chemin du retour, qui n'était
jusqu'ici qu'à moitié construit : l'appli savait NOMMER les orphelins mais ne proposait rien pour eux.

`tests/suppression_disque_test.js` : 30 contrôles.

## Le reste : structure en PDF, export intégral, import direct (2026-09-18)

### Ce qui est livré

**La Structure en PDF.** C'était le dernier des trois PDF à passer par l'impression du navigateur,
laquelle ne rend jamais les octets : impossible de RANGER ce qu'on ne tient pas, d'où un dossier
`PDF/Structure` qui ne pouvait pas se remplir et qu'on avait retiré. Il revient. Le montage de la
feuille est **partagé** entre l'impression et l'export — deux montages séparés finiraient par produire
deux pages différentes.

**L'export intégral**, décidé il y a longtemps et jamais construit. Six types, chacun avec son coût
annoncé, et le **MP3 décoché par défaut** : c'est le plus long, et le cocher d'office ferait attendre
une minute pour un fichier qu'on n'a pas demandé. La fenêtre reste ouverte pendant le travail et dit
où on en est — un écran muet pendant une minute passe pour une panne. Le PDF des paroles et le texte
n'y sont pas : ils se produisent dans l'outil Paroles, une autre page. C'est **écrit dans la fenêtre**
plutôt que passé sous silence — une case qui ne ferait rien serait pire qu'une case absente.

**L'import direct.** `showOpenFilePicker` reçoit `startIn` : le sélecteur s'ouvre dans `Morceaux/` au
lieu de là où le système s'est arrêté. Repli complet sur le champ classique là où l'API n'existe pas.

### Un défaut d'architecture, et il était grave

`fichiers.js` s'est mis à appeler `asciiPourMidi`, qui vivait dans `script.js`. Or **la page Paroles
charge `fichiers.js` sans `script.js`** : elle tombait sur une fonction inexistante, et tout son
rangement repartait en téléchargement **sans un mot**. Une dépendance d'un module partagé vers un
module qui ne l'est pas ne peut pas tenir. La translittération a déménagé dans `fichiers.js`, et un
contrôle vérifie désormais depuis la page Paroles que tout ce que `fichiers.js` utilise y est bien
défini.

### Les accents dans les noms de fichiers

Mesuré en écrivant le banc : **OPFS refuse tout nom non-ASCII**, précomposé comme décomposé
(`TypeMismatchError`). Un disque ordinaire, lui, accepte les accents sans broncher — mais une clé en
FAT ou un partage réseau peuvent avoir leurs propres limites. Le code retombait alors dans
Téléchargements, en silence, alors qu'un dossier est configuré.

`nomsCandidats` réessaie donc avec le nom translittéré, et **lectures, archivage, purge et inventaire
s'appuient tous sur le nom RÉELLEMENT écrit** — sinon la rotation purgerait à côté et les messages
annonceraient un fichier inexistant. Les accents sont gardés partout où c'est possible : c'est une
appli française.

**À dire franchement** : le banc n'éprouve donc que le REPLI. Le cas nominal — un nom accentué sur un
vrai disque — n'est pas atteignable ici, faute d'autre chose qu'OPFS.

### Le MIDI était resté en arrière

Seul de tous les exports, il portait encore un nom **horodaté** dans le dossier : il passait un `nom`
tout fait à `enregistrerFichier`, ce qui court-circuite le nommage canonique. Il accumulait donc un
fichier par génération au lieu de garder le dernier avec ses versions. Trouvé par le banc de l'export
intégral, en vérifiant simplement le chemin attendu.

`tests/export_integral_test.js` : 21 contrôles.

### Le balayage complet du 18/09

**195 verts · 7 rouges · 7 sans verdict**, sur 209 suites (contre 188 / 8 / 7 au relevé précédent, pour
203 suites).

Les 7 rouges : les **5 de référence** déjà connus et non instruits, `sortie_edition_involontaire`
(antérieur, vérifié contre `57f5e23`), et `meta_suite` — le banc à cliquet, qui a attrapé **mes propres
bancs** :

- `sauvegarde_robustesse` appelait `window.app.marquerModifie`, une méthode que j'avais inventée et qui
  n'existe pas. L'appel était « protégé » par un ternaire, donc invisible : du code mort dans un banc.
- `suppression_disque` enfermait cinq contrôles dans un `if (idxLive !== null)`. Une vérification qui
  peut ne pas s'exécuter ne prouve rien, et un banc vert dont la moitié n'a pas tourné est pire qu'un
  banc rouge. Remplacé par un `exiger()`, qui échoue franchement si la ligne est introuvable.

Les deux bancs ont été corrigés, **pas la référence** : élargir la liste de dette pour faire taire une
trouvaille neuve viderait le cliquet de son sens.

Les 7 « sans verdict » sont les ébauches de diagnostic déjà recensées (`guitar_lock_click`,
`ctx_nav_scroll`, `instrument_stress`, `item1_hzoom_out`, `smoke`) et deux bancs qui concluent mais
écrivent « OK : » au lieu de « PASS » (`detune`, `probe_cache_perime`).

## Le chemin du retour : abandonner le rangement automatique (2026-09-23)

### Le constat de l'utilisateur, qui est juste

« Le fonctionnement Safari et Chrome fonctionnent quand même très différemment [...] je veux garder
quelque chose de simple. » Et la question qui suit : est-ce qu'un rangement manuel, avec tout dans
Téléchargements sur les deux navigateurs, ne serait pas plus intuitif ?

Deux choses vérifiées avant de répondre :

1. **Le mode simple existe déjà.** Sans dossier configuré, Chrome et Safari se comportent à
   l'identique — tout part dans Téléchargements, les deux boutons du gestionnaire n'apparaissent pas,
   la suppression redevient une confirmation. La divergence ne vient pas du code, mais du fait qu'un
   dossier a été désigné sur Chrome.
2. **On ne pouvait pas revenir en arrière.** `oublierRacine` existait dans `fichiers.js` et n'était
   branchée sur aucun bouton. Un réglage qu'on peut prendre sans pouvoir le défaire n'est pas un
   réglage : c'est un engagement.

### Ce qui a été ajouté, et rien de plus

Une entrée « Ne plus ranger automatiquement » dans le menu Fichier, visible uniquement quand un
dossier est configuré. Pas de confirmation : le geste n'est ni destructeur ni irréversible, et une
question de plus pour un réglage qu'on reprend d'un clic est une question de trop.

**Rien n'est arraché.** Toute la couche rangement reste en place, dormante. Le réglage se reprend dans
les deux sens, ce qui permet de décider par l'usage plutôt que par une opinion.

### Ce que le banc éprouve en priorité

Qu'abandonner le rangement **ne touche aucun fichier**. « Ne plus ranger » pourrait s'entendre comme
« effacer ce qui est rangé » — le dossier et son contenu doivent rester exactement dans l'état où on
les a laissés, et le message doit le dire plutôt que de laisser planer le doute. Le banc compare
l'inventaire du dossier avant et après, vérifie le libellé du message, puis redésigne le dossier et
retrouve les mêmes fichiers.

Il vérifie aussi que l'appli redevient vraiment uniforme : plus de dossier mémorisé, `preparerRangement`
qui ne rend plus rien, un export qui repart sous nom horodaté dans Téléchargements, les deux boutons
du gestionnaire disparus (sinon ils mèneraient à une invitation à choisir un dossier — exactement ce
qu'on vient de refuser), et une suppression redevenue simple confirmation.

### Une note de conception, pour plus tard

Ce qui a réellement réglé les problèmes signalés ne vit **pas** dans la couche rangement :

- le **nommage strict** a réglé « je me perds dans les versions », et il marche partout ;
- la **fusion par titre à l'import** et le **ménage des doublons** ont réglé « je ne sais plus lequel
  est le bon », et ils n'ont rien à voir avec les dossiers.

Le rangement automatique apporte du confort sur Chrome — l'écriture au Ctrl+S, « exporter ce qui a
changé », le panneau disque — au prix d'une divergence entre navigateurs. Et il faut noter que **tout
l'appareillage de garde-fous n'existe que parce que le mode dossier écrase** : dans Téléchargements,
chaque export est un nouveau fichier horodaté, donc le danger qui a justifié la fenêtre de conflit et
la rotation des versions ne se pose pas. Si le mode simple devait l'emporter à l'usage, c'est une
simplification à envisager — pas avant.

`tests/mode_simple_test.js` : 17 contrôles.

## Synchro cloud Firebase (2026-09-30)

### La décision

« L'enregistrement me semble trop aléatoire sur HarmoHub et TabHub : on va connecter tous les documents
à mon Firebase, comme TrainHub. Conserve des exports/imports de secours, de temps en temps je
conserverai mes données sur un disque. » Mécanique reprise de TrainHub : même projet partagé
(`lucas-apps`), même chemin `users/{uid}/apps/{slug}`, même connexion Google par fenêtre, même SDK
« compat » chargé par balises `<script>` (ce projet n'a aucune chaîne de build).

### Trois choses qui diffèrent de TrainHub, et pourquoi

**1. Fusion par morceau, pas remplacement global.** TrainHub a UN état qu'il remplace en bloc par le plus
récent. Une bibliothèque modifiée depuis Chrome, Safari et l'app du Dock se FUSIONNE : le remplacement
global ferait perdre à chaque synchro les modifications de l'appareil « perdant » — exactement ce que
l'utilisateur redoute. Règle : morceau par morceau, le plus récent gagne ; et **le perdant d'une édition
concurrente est rangé dans Archives, jamais jeté**.

**2. Chaque envoi est une transaction** : relire le cloud, fusionner avec le local, écrire. Deux appareils
qui envoient en même temps ne s'écrasent plus.

**3. L'état est toujours dit.** Six états de pastille (synchronisé, envoi, *modifications pas encore
envoyées*, hors ligne, erreur, trop volumineux), chacun avec son libellé. Le plus important est le
troisième : c'est lui qui répond à « est-ce bien parti ? ».

### Ce qui est synchronisé, et ce qui ne l'est pas

Les morceaux, les dossiers, et la trace des suppressions. **Pas** le morceau en cours d'édition ni le
morceau ouvert (états par appareil : les synchroniser ferait changer de morceau sous les doigts de
quelqu'un qui travaille sur un autre écran), **ni les réglages** — à reconsidérer plutôt qu'à sous-entendre.

### `syncAt`, à côté de `savedAt`

`savedAt` est la date d'enregistrement AFFICHÉE ; `moveSongToFolder` ne la touche pas, et pourtant un
déplacement doit voyager. `syncAt` est posée à toute modification et c'est elle qui arbitre. La date
affichée reste celle du dernier vrai enregistrement.

### Chaque morceau est stocké comme une chaîne JSON

Firestore refuse les tableaux imbriqués et `undefined`. Un morceau d'aujourd'hui n'en contient pas (le
motif du séquenceur est sérialisé en texte — vérifié), mais un champ ajouté demain pourrait en
contenir, et l'écriture échouerait chez l'utilisateur, sans prévenir. Une chaîne ne peut pas échouer.
Mesuré : ~8,6 Ko par morceau courant, soit ~120 morceaux avant le plafond de 1 Mio par document ; la
pastille prévient à 80 %, et le recours est la sauvegarde sur disque.

### Les défauts que le banc a trouvés dans mon propre code

**Une boucle d'envoi infinie.** `modifsEnAttente` n'était jamais remis à zéro au *début* d'un envoi, donc
« il reste des modifications » était toujours vrai à la fin et la synchro **se renvoyait elle-même,
une écriture toutes les 1,5 s**. Mon contrôle « une modification = une écriture » passait — parce qu'il
lisait le compteur à 2,6 s, juste avant la deuxième. **Un banc qui mesure trop tôt ne voit pas ce qu'il
cherche** : il lit désormais encore cinq secondes plus tard.

**Le perdant d'une édition concurrente n'était protégé que d'un côté.** Quand la version d'ici perdait,
elle était rangée ; quand elle gagnait, celle de l'autre appareil partait sans laisser de trace. Trouvé
en relisant la fusion, avant tout test.

**L'avertissement « 80 % du plafond » était posé puis effacé** par le `dire('synced')` de la fin de
connexion : on ne l'aurait jamais vu. « Synchronisé » est annoncé depuis quatre endroits.

**Pas de reprise après échec.** Un échec passager laissait les modifications en attente jusqu'à la
*prochaine modification* — des heures, potentiellement : c'est le « trop aléatoire » signalé. Reprise
automatique avec recul (5 s, 10 s… 5 min), l'évènement `online` passant devant.

### Ce qu'on ne peut PAS garantir, et il faut le dire

Le banc tourne contre un **faux Firebase** qui reproduit les refus de FORMAT du vrai (undefined, tableaux
imbriqués, > 1 Mio) — pas ses refus d'AUTORISATION. Ne sont donc vérifiés que sur de vrais appareils :
les **règles de sécurité Firestore**, les **domaines autorisés**, et la **fenêtre Google sur Safari et
dans l'app du Dock** (les fenêtres surgissantes y sont connues pour poser problème — TrainHub « marche
bien » selon l'utilisateur, mais on ne l'a pas vérifié ici).

Limites connues, acceptées : **l'horloge des appareils arbitre** (deux appareils très décalés peuvent se
tromper sur « le plus récent » — le perdant est rangé, pas perdu) ; **un dossier supprimé peut réapparaître
vide** si sa trace est plus ancienne que sa recréation.

**Une limite que j'avais d'abord classée « acceptée », et à tort** : enregistrer un morceau ouvert alors
qu'une version plus récente est arrivée d'ailleurs écrasait cette dernière sans trace (la synchro
prenait la version reçue pour celle que l'utilisateur avait sous les yeux, puisqu'elle figurait déjà
dans l'historique de l'appareil). C'est exactement le cas redouté — « des morceaux modifiés ailleurs ne
doivent pas être écrasés ». La version arrivée est désormais rangée dans Archives *au moment où elle
arrive*, donc avant tout enregistrement possible. Repéré en relisant ma propre documentation : écrire
une limite noir sur blanc oblige à se demander si on l'accepterait vraiment.

`tests/synchro_cloud_test.js` : 97 contrôles, plus le faux Firebase dans `tests/_firebase_faux.js`.


### Une régression de mise en page trouvée par le balayage, et ce qu'elle dit

Mon premier placement — un bouton « se connecter » puis une pastille dans la barre du morceau — a fait
passer les **boutons d'action à la ligne sur téléphone** (`mobile_grille_plus_haut` : « titre à 72 px,
boutons à 105 px »). Mesuré ensuite : à 390 px la ligne fait 318 px pour 82 + 10 + 222 = 314, soit
**4 px de marge**, et à 360 px les boutons passaient déjà à la ligne *sans moi*. Il n'y a aucune place,
pour rien, dans cette barre.

D'où le placement final : **se connecter / se déconnecter dans le menu Fichier** (où vivent déjà tous les
échanges avec l'extérieur), et la pastille **superposée au bord du titre** en position absolue, donc
sans prendre la moindre place. Le banc vérifie maintenant que l'en-tête ne bouge pas, connecté ou non.

Deux erreurs de méthode à noter : mon premier contrôle mesurait en coordonnées de *fenêtre* alors que
l'ouverture du menu fait défiler la page (il rendait -221 au lieu de 72 : la page avait bougé, pas
l'en-tête) ; et mon second exigeait « même ordonnée exacte » alors que titre et boutons diffèrent de
5 px de hauteur de ligne sans jamais avoir quitté la même ligne.

Et un avertissement console (`Firebase indisponible : mode local uniquement`, repris de TrainHub) faisait
échouer `continuous_scroll`, qui compte les avertissements comme des erreurs. Ce n'est pas une anomalie —
hors ligne, l'appli marche comme avant — donc `info`, pas `warn`.

### TabHub : la même couche, un autre piège (2026-10-01)

TabHub reprend `synchro-cloud.js` à l'identique (copié, pas réécrit), avec son propre adaptateur. Sa
structure diffère de HarmoHub : **un seul brouillon**, pas de bibliothèque. La synchro est donc celle de
TrainHub (un document, le plus récent gagne), avec des sauvegardes de secours locales pour tout ce qui est
remplacé — d'où une limite à connaître : le cloud ne garde que la tablature *en cours*.

**Le piège, trouvé en testant la fermeture d'une fenêtre, pas en lisant le code.** `normaliser` réécrit
`meta.modifieLe` à l'instant présent à *chaque* `remplacer` — restauration du brouillon au démarrage,
réception du cloud, ouverture d'un fichier. Mesuré : après un simple rechargement, un brouillon intact
depuis un mois portait la date d'aujourd'hui. Arbitrer sur cette date aurait fait gagner un appareil resté
des semaines sans y toucher, qui aurait écrasé le cloud de sa version périmée. L'arbitrage se fait sur une
horloge de synchro **à part**, qui ne bouge que pour une vraie modification (jamais pour un déplacement du
curseur ni un remplacement automatique). Le banc ne l'a vu que parce qu'un de ses scénarios — « fermer la
fenêtre sans choisir garde la plus récente » — échouait : le brouillon de 2020 s'affichait daté d'aujourd'hui.

**Dans la couche générique, pour les deux applis : plus d'écriture inutile.** La transaction écrivait
toujours son résultat, même identique à ce qui était déjà au cloud (un appareil à jour qui se connecte, un
appareil périmé qui reprend la version du cloud). L'adaptateur dit `changeDistant === false` et on n'écrit
pas.

**Une erreur de ma part, côté dépôt.** J'ai poussé sur la branche `main` de TabHub sans me poser la
question. La règle « ne jamais toucher à main » m'avait été donnée pour HarmoHub, pas pour TabHub, mais elle
exprimait un principe qui valait pour les deux.

### Balayage du 01/10 : 197 verts, 7 rouges, 7 sans verdict (211 suites)

Les 7 rouges : les 5 de référence non instruits, `sortie_edition_involontaire` (antérieur), et
`glock_unlock_and_switch` — **7/0 lancé seul**, comme `glock_full_real_ui` et `manche_edition_lot6` au
relevé précédent : sensible à la charge quand quatre navigateurs tournent en parallèle. Rangé dans la phase
série plutôt que d'assouplir ses contrôles. Trois bancs du même profil dans la même famille : la prochaine
fois qu'un `glock_*` rougit en parallèle, c'est la même explication, mais à vérifier seul avant de le dire.

## Structure modulable, et la feuille de partage sur ordinateur (2026-10-03)

### 1. « Je veux juste un "enregistrer sous" »

La fenêtre de la capture était la **feuille de partage macOS** (AirDrop, Mail, Messages…). Je l'avais mise
en place pour l'iPhone, seul chemin vers « Enregistrer dans Fichiers » — mais Safari sur Mac expose la même
API `navigator.share`, donc elle s'ouvrait aussi sur ordinateur, pour **tous** les exports sans dossier
configuré, pas seulement la Structure. Elle est désormais réservée aux appareils tactiles (`pointer: coarse`,
pointeur *principal* : un iPad avec clavier reste tactile, un Mac avec écran tactile externe garde sa souris).
Un contrôle verrouille le cas « souris + API présente = téléchargement ordinaire ».

Non traité : le bouton « Imprimer » qui n'affiche rien chez l'utilisateur. Je n'ai pas su le reproduire ici ;
l'export PDF le remplace pour l'usage visé.

### 2-4. La structure devient un ARRANGEMENT

**Le défaut de conception.** La vue Structure lisait les parties de la grille et agissait *dessus* : monter
une partie réordonnait la grille, « + » écrivait dans la partie. Pour jouer deux fois le même couplet, il
fallait donc le copier dans la grille — avec ses accords — et le placer au bon endroit.

**Le modèle.** La grille *définit* les parties, une fois chacune. La structure est une liste d'**occurrences**
qui y renvoient par identifiant : `{ id, sid, rep, label?, notes[] }`. Dupliquer une occurrence ne copie aucun
accord (le banc le mesure : la structure pèse moins de 700 octets), et corriger la partie dans la grille la
corrige à chaque endroit où elle sert. La structure voyage avec le morceau (enregistrement, import, synchro).

**Pas de migration.** Tant que rien n'est arrangé, la structure est *déduite* de la grille, comme avant. Elle
n'est écrite qu'au premier geste.

**Décision renversée, à la demande de l'utilisateur.** `structure_test` affirmait « monter une partie
réordonne la GRILLE elle-même ». Ce n'est plus vrai, par choix : deux contrôles ont été réécrits en
conséquence, avec la raison dans le commentaire.

**Identifiants.** Les parties n'en avaient pas. Ils sont posés à la demande, sans marquer le morceau modifié
(poser un identifiant n'est pas une modification de l'utilisateur). Piège évité : « dupliquer la partie » dans
la grille copie tout, identifiant compris — le doublon en reçoit un neuf, sinon deux parties se
partageraient leurs occurrences.

**Clic droit** (et appui long au doigt) : dupliquer, renommer, commenter, supprimer. *Renommer* ne change que
l'occurrence (« Couplet 2 » renvoie toujours à la partie « Couplet »). *Supprimer* retire l'occurrence, pas la
partie. Saisie par une fenêtre propre, pas un `prompt()` natif (absent ou bloqué dans l'app du Dock).

**Commentaires** : `{ mesure | null, texte }` par occurrence — « mesure 4 : batterie uniquement » — triés par
mesure, modifiables en cliquant dessus, présents dans l'impression et le PDF.

**Une partie supprimée dans la grille** reste affichée, barrée, avec la raison : la faire disparaître en
silence ferait croire à une perte.

**Paroles** reçoit pour chaque partie le nombre de passages *total* (somme des répétitions de ses
occurrences). Elle continue de fonctionner par partie, pas par occurrence : deux couplets aux paroles
différentes y restent à saisir sur une même partie. À reconsidérer si ça gêne.

### Ce qui n'est PAS fait, et il faut le dire

- **La lecture audio ne suit pas la structure.** Elle joue la grille, dans l'ordre de la grille, comme avant
  (les répétitions de la structure ne l'ont d'ailleurs jamais pilotée). La structure est, pour l'instant, un
  document de travail et d'impression. La faire piloter la lecture changerait le curseur, la boucle et la
  surbrillance : c'est une fonction à part entière.
- Pas d'annulation (Ctrl+Z) pour les gestes de la structure : retirer une occurrence se corrige en la
  rajoutant.

`tests/structure_modulable_test.js` : 44 contrôles.

## Structure : feuille claire, commentaires sur plusieurs mesures, structure qui voyage (2026-10-03)

Trois retours utilisateur d'un coup.

**3. « La structure se sauvegarde mal : ouvert dans Safari après Chrome, j'ai dû retaper le nombre de chaque
section. »** Cause mesurée, pas supposée : un réglage de structure (nombre de passages, commentaire, ordre)
n'était écrit que dans le *tampon de travail* (`myProgression`) ; il n'entrait dans le morceau qu'au prochain
« Enregistrer ». L'export de bibliothèque et la synchro cloud ne lisent que le morceau enregistré : sans Ctrl+S,
l'autre navigateur recevait l'ancienne structure. Correction : `modifierStructure` appelle maintenant
`persisterStructureDansMorceau`, qui reporte **les parties et la structure** (les `sid` des parties en
dépendent : une structure qui renvoie à des parties absentes du morceau serait orpheline) dans le morceau
ouvert. Le reste du tampon (tempo, tonalité…) n'est PAS enregistré au passage, et un morceau propre le reste
(sinon la fenêtre « enregistrer avant de partir ? » s'ouvrirait pour rien). Un morceau pas encore nommé n'a rien
où se rattacher : inchangé.
Limite connue : les réglages faits dans la **grille** (ex. le nombre de répétitions d'une partie, hors volet
Structure) restent, eux, soumis à l'enregistrement explicite — c'est le comportement historique de l'appli.

**2. Commentaires sur plusieurs mesures.** Modèle `{ mesure, mesureFin?, texte }` : une mesure seule ne change
pas (aucune migration), une plage ajoute `mesureFin`. Les mesures sont celles de la **partie** (1re mesure de la
partie = 1), parce qu'un commentaire suit la partie où qu'elle soit rejouée. Saisie tolérante, jamais bloquante :
fin ≤ début = mesure seule ; fin sans début = « toute la partie ». Affichage `mes. 1–3`, tri début puis fin.

**1. Feuille PDF / impression.** Avant, la feuille était une *copie du volet de l'écran* (thème sombre) qu'on
recolorait par-dessus. Elle est maintenant construite à part (`construireFeuilleStructure`) : fond blanc, une
couleur par famille de parties (« Couplet » et « Couplet (variation) » partagent la leur), mesure de départ en
marge, déroulé en pastilles, plages de commentaires teintées. Couleurs posées en ligne (le plus fidèle pour
html2canvas), styles scopés sous `#structure-print-zone`, donc identiques dans le PDF rastérisé et à
l'impression. Le PDF n'est plus réduit pour tenir sur UNE page : il est découpé en pages aux frontières des
cartes (`.sf-row`).

Bancs : `tests/structure_feuille_test.js` (32 contrôles, bureau + téléphone ; rejoue le vrai parcours
Chrome → fichier → contexte vierge). `structure_modulable_test` : sélecteur du champ « mesure » rendu précis
(`#struct-edit-mesure`) puisqu'il y a désormais deux champs numériques.
Piège de banc rencontré : `page.evaluate(() => app.editerCommentaireStructure(...))` attend la fermeture de la
fenêtre (promesse) — ne pas attendre cet appel.

**Retouche de la feuille (même jour).** Retours : « couleurs plus pâles et plus discrètes » ; « les numéros de
mesure en gros sur la gauche sont un peu inutiles, ce n'est pas l'information principale ». La marge colorée
avec le grand numéro disparaît : un simple filet pâle à gauche de la carte, fonds presque blancs, encre des
titres assourdie (contraste ≥ 4:1 sur blanc). La mesure de départ reste donnée, en petit et grisée, à droite
du titre (« mes. 3–18 · 8 mes. × 2 »). Le banc `structure_feuille_test` (34 contrôles) vérifie qu'aucun fond
n'est soutenu (luminance ≥ 0,93) et que rien n'est grand hors du titre.

**Aperçu avant impression (même jour).** Retour : « regarde si d'autres informations peuvent être intéressantes ;
prépare-moi, avant impression, un aperçu de la page, pour que je puisse ajuster l'affichage — par exemple pour
que tout passe sur une page. » Le bouton de la fenêtre Structure devient « Aperçu / PDF » (le bouton
« Imprimer » direct disparaît : il passe par l'aperçu, d'où l'on imprime ou enregistre le PDF).
- **Une seule fabrication** (`fabriquerPagesFeuille`) pour l'aperçu, l'impression et le PDF : le contenu est mis en
  page une fois à la taille voulue, puis coupé en pages (fenêtres décalées) aux frontières des cartes. Le PDF
  rastérise chaque `.sf-page` telle quelle, l'impression sort les mêmes pages avec `@page` (format + orientation) :
  l'aperçu EST ce qui sort.
- **Réglages** (mémorisés, `harmohub_feuille_structure`) : format A4/Lettre, orientation, 1 ou 2 colonnes, « Tout sur
  une page » (dichotomie sur la taille de police, plancher 60 % : en dessous, ce n'est plus lisible, l'aperçu dit
  alors franchement « même réduite à 60 %, ça ne tient pas » et coupe en pages), zoom manuel 50–150 %, et le contenu
  (infos, déroulé, accords, commentaires, repères de temps, accords utilisés, couleurs / gris).
- **Informations ajoutées** : repère de temps de chaque partie (« à 1:08 », d'après tempo et signature), groove s'il
  n'est pas droit, date en pied de page, liste des accords utilisés (optionnelle).
- Pièges mesurés : (1) `zoom` CSS pour réduire l'aperçu ARRONDIT les lignes — le texte remesuré dépassait de la fenêtre
  calculée (359 px au lieu de 347, dernière carte et pied coupés) ; l'aperçu utilise `transform: scale`, qui ne
  touche pas à la mise en page. (2) Pages en px arrondis VERS LE BAS : 1 px de trop et le navigateur ajoute une page
  blanche. (3) `.apercu-modal` était écrasé par la largeur de `.settings-modal` (spécificité).
- Banc : `structure_feuille_test` passe à 54 contrôles (aperçu, ajustement, colonnes, orientation, mémoire,
  impression simulée, PDF = pages de l'aperçu, téléphone).
Limite connue : l'aperçu n'est pas relu par une vraie imprimante ; la boîte d'impression du navigateur n'est pas testée.

## Commentaires de structure : notes libres, ordre au choix, autre appareil (2026-10-03)

Trois retours : « ils ne sont pas persistants lorsque j'ouvre une session sur un autre appareil » ; « finalement,
je n'ai pas besoin de définir les mesures impactées, je préfère des notes libres » ; « je veux pouvoir modifier
l'ordre des commentaires dans la liste ».

- **Notes libres.** Une note est `{ texte }`. Les champs « de la mesure / à la mesure » disparaissent (le lot
  précédent les avait ajoutés — retour d'avis de l'utilisateur, assumé). Rien n'est perdu : un ancien commentaire
  `{ mesure, mesureFin?, texte }` est converti à la lecture (`texteNoteStructure`) en « mes. 1–3 : texte », que
  l'utilisateur garde ou efface. Conversion idempotente. La feuille PDF montre le texte seul.
- **Ordre.** Deux boutons ↑ ↓ sur chaque note (grisés aux extrémités, 26 px, ne rouvrent pas la fenêtre d'édition).
  Le tableau EST l'ordre : plus aucun tri automatique (l'ancien tri par mesure aurait défait l'ordre choisi). Une
  note modifiée garde sa place, une nouvelle va à la fin. L'ordre part au morceau et au cloud comme le reste.
- **Autre appareil.** Reproduit à deux appareils sur le faux cloud : depuis la correction du lot précédent (structure
  reportée dans le morceau à chaque geste), les commentaires arrivent bien sur un appareil neuf, et au démarrage
  d'un appareil resté en retard. Ce qui manquait réellement : le volet Structure restait figé sur l'ancienne
  structure quand la synchro rechargeait le morceau (volet ouvert) — `loadSong` le redessine désormais.
  Si le défaut persiste chez l'utilisateur après ce correctif, le faux Firebase ne reproduit pas les refus
  d'AUTORISATION (règles Firestore) : à vérifier sur appareils réels.
- Le banc a attrapé une erreur de ma part en route : mon remplacement de texte avait emporté les réglages de
  l'aperçu (`lireReglagesFeuille`) — détecté au premier passage de `structure_modulable_test`.
- Bancs : `structure_feuille_test` 61 contrôles (dont la section G, deux appareils : session neuve, volet ouvert,
  retour du réseau après rechargement), `structure_modulable_test` 45.

## Compte cloud commun aux trois applis (2026-10-28)

Retours : « à chaque fois que je modifie les systèmes de connexion sur une appli, je dois refaire toute la
démarche pour les autres » ; « sur les 3 applis, les pastilles de connexion sont différentes, je veux les
mêmes » ; « propose la fenêtre connexion lorsqu'aucun utilisateur n'est connecté ». Décision prise avec
l'utilisateur : PAS de dépôt commun (il veut « ne plus trop toucher au code ») — une copie par appli, HarmoHub
fait référence, chaque fichier partagé porte une VERSION et une EMPREINTE (docs/fichiers-partages.md).

- **`compte-cloud.js` (nouveau, version 1)** : dessine tout ce qui se voit de la connexion — pilule, pastille,
  menu du compte, fenêtre de connexion. Ne connaît ni Firebase ni les données (TrainHub peut donc le brancher
  sur son propre moteur). Styles injectés, classes `cc-…`, fondés sur les seules variables communes aux trois
  applis ; fonds CALCULÉS depuis `--bg`/`--text-main` (dans les thèmes « verre » de TrainHub, `--card-bg` est
  presque transparent). Boutons en `all: unset` (la règle générale `button` de HarmoHub — flex: 1,
  min-width: 120px — avait déjà fait faire 121 px à l'ancienne pastille).
- **Fenêtre de connexion** : proposée DÈS L'OUVERTURE quand Firebase répond « personne » (jamais avant sa
  réponse : ce serait une fausse alerte pour quelqu'un déjà connecté). Une fois par onglet (sessionStorage :
  ni au rechargement, ni à la première modification ensuite), et plus jamais si l'on coche « Ne plus me le
  proposer sur cet appareil » (localStorage, clé PAR APPLI — les trois applis partagent l'origine
  lucas-webapp.github.io). Le garde-fou « Tu n'es pas connecté » à la première modification subsiste pour le
  cas où la fenêtre n'a pas été vue dans l'onglet (ex. connecté à l'ouverture, puis déconnecté).
- **`synchro-cloud.js` version 2** : ne dessine plus rien, parle au composant (`elements.ui`).
- **HarmoHub** : pilule, menu, garde-fou et leurs styles retirés de index.html/script.js/style.css au profit du
  composant (`<div id="compte-cloud">`). Les identifiants restent les mêmes (google-signin-btn, account-info,
  sync-status, cloud-menu, cloud-guard-modal…).
- **Changement VOULU d'un banc** : `synchro_cloud_test` section 14 vérifiait qu'AUCUNE question n'était posée à
  l'ouverture ; c'est désormais le contraire, à la demande de l'utilisateur. Section réécrite (fenêtre à
  l'ouverture, une fois par onglet, nouvel onglet, ne plus proposer, déconnexion puis modification). Le test
  « avant la réponse de Firebase, se taire » passe dans `compte_cloud_test`. `connecter()` passe par la fenêtre
  quand elle est ouverte, comme l'utilisateur. 126 contrôles.
- **`compte_cloud_test` (nouveau, 50 contrôles)** : le composant SEUL, sur une page qui imite le pire des trois
  applis (règle `button` hostile, barre en overflow hidden, thème clair et « verre » de TrainHub), bureau et
  téléphone. Dernière section : version de l'en-tête = constante, et empreinte SHA-256 = celle de la note.
  Piège rencontré dans mon propre banc : `color-mix()` rend ses couleurs calculées en `color(srgb 0.88 …)`
  (0 à 1) et non `rgb(224 …)` — lue comme du 0–255, la fenêtre claire paraissait noire.
- **Méta-suite** : elle ne lisait que script.js et paroles.js pour savoir quels identifiants existent, et
  déclarait donc « introuvables » les dix boutons fabriqués par compte-cloud.js. Elle lit maintenant tous les
  scripts chargés par index.html (même leçon que pour la page Paroles).
- Limites : TabHub et TrainHub ne sont pas modifiés par ce lot (consignes données à leurs sessions). Le
  composant n'a été éprouvé qu'avec le faux Firebase et sur Chromium ; le rendu Safari n'est pas vérifié ici.
- **Sentinelle des adresses** : même faux rouge que la méta-suite (elle ne lisait pas compte-cloud.js, et ne
  connaissait pas les éléments nommés par `.id = '…'`). Elle lit désormais tous les scripts de la page.

### Balayage du 28/10 : 201 verts, 6 rouges, 7 sans verdict (214 suites)

Premier passage : 200 / 7 / 7 — le 7e rouge était la sentinelle des adresses (faux rouge ci-dessus, corrigé,
217/0 relancée seule). Les 6 rouges restants sont exactement la ligne de base documentée : les 5 de référence
non instruits (`probe_clic_accord_voisin`, `probe_defilement_tactile`, `probe_regle_voisins`,
`probe_seq_finitions`, `seq_notes_libres_clavier`) et `sortie_edition_involontaire`. Après la version finale du
composant : compte_cloud 51/0, synchro_cloud 126/0, structure_feuille 61/0, méta-suite 6/0.

## Accord dessiné sur le manche : l'envoyer dans la grille (2026-10-28)

Retour : « j'ai créé un accord manuellement à la guitare en plaçant les notes sur le manche. Je n'ai pas pu
l'envoyer directement dans la grille. Pour un Dadd11, je ne vois pas le 11 sur le piano, et il ne me semble pas
entendre la note. »

- **Cause mesurée.** Après « Valider », seuls « Verrouiller ce doigté » et « Utiliser comme substitut guitare »
  existaient, et ils ne touchent QUE le diagramme de la guitare : l'accord du piano (donc ses touches, le son, la
  case de la grille) restait celui du panneau Accord. Le 11 ne s'allumait pas parce que le piano n'avait jamais
  reçu un Dadd11 — pas à cause du moteur, qui sait très bien jouer l'add11 (vérifié : D F# A + sol 67, quatre
  voix dans le rythme, 11 allumé en « extension »).
- **Correction.** Un bouton « Ajouter Dadd11 à la grille » dans le panneau de résultat
  (`sendGuitarDrawnChordToGrid`) : le panneau Accord prend l'accord choisi (par les écouteurs `change` habituels,
  donc le séquenceur ajoute la voix du 11 au rythme), le doigté dessiné est verrouillé tel quel, sans substitut
  (la guitare EST l'accord du piano), puis la case est ajoutée — à la suite de l'accord sélectionné s'il y en a
  un, sinon en fin de partie. En mode Modification, le même bouton devient « Remplacer l'accord de la grille par
  … » et remplace la case ouverte (jamais de doublon). Le libellé annonce d'avance ce qui va se passer et suit le
  candidat choisi.
- **Basse.** Reprise seulement si c'est une note de l'accord (F# → Dadd11/F#). Une corde grave qui tombe sur
  l'extension (le sol d'un Dadd11) ne fait pas un « Dadd11/G ».
- Accord non reconnu : toujours pas de bouton (rien d'écrit au hasard dans la grille). « Substitut guitare »
  inchangé.
- **Piège de banc** : `editChord(section, index)` prend DEUX arguments ; `editChord(0)` ne fait rien en silence
  (la case n'existe pas) — mes premières sondes mesuraient donc le panneau et non la case.
- Banc : `guitare_envoi_grille_test` (32 contrôles, bureau + téléphone). `manche_edition_lot3/4/5` verts ;
  `manche_edition_lot6` (« l'aperçu disparaît quand la souris quitte le manche ») rougit sous charge quand neuf
  navigateurs tournent en parallèle et passe 18/0 seul — déjà classé « sensible à la charge » dans le balayage.
  `sortie_edition_involontaire` plante de la même façon (ligne 126) sur le commit d'AVANT : antérieur à ce lot.

## L'effet « verre dépoli » repris sur la ligne à jour (2026-10-28)

Retour : « un affichage de type verre comme sur TrainHub, il est très joli, je veux le retrouver sur toutes les applis. Il doit
rester gérable en paramètres. » L'effet avait été réalisé dans une autre discussion (commit 16e1622, ligne plus ancienne de HarmoHub,
« moteur nuage ») ; il est ici REPRIS, pas réécrit : `verre.js`, `verre.css` et `tests/_verre_commun.js` copiés tels quels
(empreintes vérifiées, voir `docs/fichiers-partages.md`), `verre-surfaces.css`, `verre_module_test`, `verre_test` et `docs/verre.md`
aussi. Pas de cherry-pick : il aurait conflué sur index.html, script.js et ce journal. Refaits à la main, trois petits branchements :
les trois lignes du `<head>` d'index.html et de paroles.html (sans `defer` : l'attribut doit être posé avant le premier affichage),
le groupe « Apparence » des Paramètres (ici à côté d'« Affichage » : cette ligne n'a pas de groupe « Enregistrement ») et
`renderLookPanel()` appelée par `openSettings()`. Réglage par appareil, éteint par défaut, rien n'est envoyé au cloud.

**Ce que cette ligne a de plus que celle où le verre a été fait, et que seul un regard a trouvé** (bancs 25 + 64 verts du premier
coup, les trois fichiers partagés intacts) :
- **La pilule de connexion commune, son menu et sa fenêtre** (compte-cloud.js) n'existaient pas encore : elles restaient des plaques
  d'un gris neutre au milieu du verre bleu nuit — lisibles, mais d'un autre monde que les autres menus. Habillées dans
  `verre-surfaces.css` seulement (la pilule comme `.logo`/`.settings-btn`, menu et fenêtre comme les autres fenêtres, flou par
  `--glass-filter` jamais écrit en dur) ; `compte-cloud.js`, partagé avec TabHub et TrainHub, n'a pas bougé.
- **La page Paroles** : `paroles.css` pose un fond sur `html, body`. Le fond du verre, posé sur `body`, ne se propage alors plus à la
  toile entière : aurore sur 360 px, puis moitié basse unie. `html[data-glass="1"] { background: none }` dans `verre-surfaces.css`
  (la page principale n'a pas de fond sur `html` : rien n'y change). Piège dans `verre.css` partagé : à signaler à TabHub si sa page
  d'accueil a le même cas (on ne l'a pas modifié ici).
- Nouveau banc `verre_compte_test` (32 contrôles, bureau + téléphone) : lisibilité MESURÉE SUR LES PIXELS de la pilule, du menu et
  de la fenêtre par-dessus chacun des sept fonds (le contrôle de contraste commun ignore les dégradés, donc ces trois surfaces),
  même habillage que les autres fenêtres, repli par la variable, éteint = fond d'avant, fond de Paroles sur tout l'écran.
  La méta-suite a refusé à juste titre un `.catch(() => {})` dans la première version (« erreur avalée ») — remplacé par un enchaînement
  explicite.
- Limite connue : rendu vu dans Chromium seulement ; Safari/iPhone et la fluidité du flou sur un vieux téléphone ne sont pas vérifiés.

### Balayage du 28/10 (verre dépoli) : 205 verts, 6 rouges, 7 sans verdict (218 suites)

Comparé à la version d'AVANT (99dc117, servie à part sur un autre port, les 13 bancs rouges ou muets rejoués) : les 5 rouges de
référence ont exactement les mêmes bilans (`probe_clic_accord_voisin` 4/4, `probe_defilement_tactile` 23/1, `probe_regle_voisins` 28/1,
`probe_seq_finitions` 18/1, `seq_notes_libres_clavier` 32/1) ; les 7 sans verdict le sont aux deux endroits ; `sortie_edition_involontaire`
donne 3/1 dans le balayage (avant comme après) et plante en isolation sur les deux versions (ligne 126, antérieur). Aucun banc nouvellement
rouge. Les 4 suites de plus sont les nouvelles (`guitare_envoi_grille`, `verre_module`, `verre`, `verre_compte`).

## Tout au cloud : les paroles et les réglages (2026-10-29)

Retour : « sur HarmoHub, tu me disais qu'il y avait des éléments non enregistrés dans le firestore (paroles et structure ?). Je veux que tout
soit stocké en ligne pour retrouver mes données en changeant d'ordinateur. » Vue d'ensemble de ce qui est où : `docs/synchro-donnees.md`.

**Inventaire d'abord** (toutes les clés de stockage lues, pas ma mémoire). La **structure et ses commentaires étaient DÉJÀ au cloud** — ils font
partie du morceau, vérifié à deux appareils au lot précédent ; ma réponse précédente les rangeait à tort parmi ce qui manquait. Ce qui ne l'était
vraiment pas : (1) les **paroles**, (2) les **réglages**, (3) les **sauvegardes sur disque**, qui ne contenaient pas les paroles.

1. **Paroles** — `synchro-paroles.js` (nouveau), une instance du moteur générique `synchro-cloud.js` (inchangé, version 2) dans la page Paroles,
   avec son adaptateur sur le document `users/{uid}/apps/harmohub-paroles` (les règles du projet `users/{userId}/apps/{appId}` l'autorisent :
   rien à faire dans la console). **Pourquoi un moteur dans la page Paroles** et pas les paroles dans le document de la bibliothèque : la page est
   un document à part ; si seule la page principale envoyait, des paroles tapées puis la fenêtre fermée n'atteindraient le cloud qu'à la prochaine
   ouverture de HarmoHub — pour qui change d'ordinateur le soir même, jamais à temps. Chaque session (une par morceau) est une chaîne JSON
   (Firestore refuse les tableaux imbriqués). `paroles.js` : chaque session porte maintenant son `savedAt` (sans date, impossible d'arbitrer) et
   prévient le moteur après chaque enregistrement. La pilule de connexion est la même que dans HarmoHub (`compte-cloud.js`), sans fenêtre d'accueil
   (`accueil: false` : on arrive en général depuis HarmoHub, qui l'a déjà proposée).
   Fusion session par session, la plus récente gagne. **La version perdante est rangée** (une par session, `harmohub_lyrics_rangee_<clé>`) et un
   bandeau propose de la restaurer — dans les DEUX sens : celle d'ici qui est remplacée, et celle de l'autre appareil qui perd. Trou trouvé en
   écrivant : le moteur n'appelle `appliquer` que si l'état d'ICI change ; quand c'est la version de l'AUTRE appareil qui perd, rien n'est appelé
   et elle aurait été écrasée au cloud sans trace — le rangement se fait donc dans `fusionner` elle-même (idempotent : la transaction d'envoi la
   rejoue). À date égale mais contenu différent, la plus grande chaîne gagne (les deux appareils convergent).
2. **Réglages** — dans le document de la bibliothèque (champ `reglages`, liste d'objets `{k, v, t}`), fusionnés **réglage par réglage**
   (`fusionnerReglages`, pure) : changer le volume sur le téléphone n'écrase pas le métronome réglé le matin sur l'ordinateur. Liste BLANCHE
   (`REGLAGES_SYNCHRONISES`) : seul ce qui décrit une préférence voyage ; zooms, hauteurs de panneaux, volet replié, instruments affichés, verre,
   dossier de rangement, repères de sauvegarde, préférences de la page Paroles restent sur l'appareil (raisons dans l'en-tête du fichier). Le
   suivi passe par une accroche sur `Storage.prototype.setItem` (la liste blanche est la SEULE chose à tenir à jour, vingt écritures dans script.js
   n'ont pas été touchées) ; elle ne date un réglage que si sa VALEUR change. Un appareil qui REPREND ses données (vierge) recharge la page une fois
   pour que les réglages prennent effet (garde-fou sessionStorage contre toute boucle, jamais en plein travail) ; une réception en direct dit
   seulement « appliqués à la prochaine ouverture ».
3. **Sauvegardes** — `enveloppeSauvegarde()` : les quatre fabrications (bibliothèque, export intégral, un morceau, téléchargement) joignent un champ
   `paroles` seulement s'il y en a (un fichier sans paroles reste identique à avant). `importLibraryFile` les restaure pour les morceaux réellement
   entrés, **sans jamais écraser une version plus récente**, en suivant le nouvel identifiant d'une copie (« garder les deux ») ou l'identifiant local
   (« écraser »). Limite : « recharger depuis le dossier de rangement » (gestionnaire de fichiers) ne les restaure pas.

**Bancs.** `synchro_paroles_test` (40 : sans SDK, connexion, un navigateur vierge retrouve les paroles, en direct, édition concurrente dans les deux sens,
restauration, téléphone) et `synchro_reglages_test` (42 : vrai clic dans les Paramètres, jamais l'écran au cloud, appareil neuf, en direct, deux appareils
deux réglages, valeur répétée, sauvegardes, restauration, téléphone). **Sabotés** (une ligne cassée, le banc doit rougir) : 3 sur les paroles
(notification, « la plus ancienne gagne », pas de rangement) et 5 sur les réglages (accroche retirée, zoom ajouté à la liste, « le cloud gagne toujours »,
sauvegarde qui écrase, copie sans paroles) — les 8 font rougir. Les deux bancs passaient du premier coup, ce qui justifiait le contrôle.
`meta_suite` et `sentinelle_adresses` lisent maintenant `synchro-paroles.js`.

**Balayage du 29/10 : 206 verts, 7 rouges, 7 sans verdict (220 suites).** Les 6 rouges de la ligne de base ont les mêmes bilans (probe_clic_accord_voisin
4/4, probe_defilement_tactile 23/1, probe_regle_voisins 28/1, probe_seq_finitions 18/1, seq_notes_libres_clavier 32/1, sortie_edition_involontaire 3/1)
et les 7 muets sont les mêmes. Le 7e rouge, `glock_unlock_and_switch` (3/4), est **intermittent sur les DEUX versions** : 2 échecs sur 10 passages seuls
sur la version d'avant (99dc117, port à part), 1 sur 10 sur celle-ci — même signature (2/5 ou 7/0). Il pose des pauses fixes de 80 à 250 ms autour de la
lecture automatique ; à ranger avec les bancs sensibles au temps, non causé par ce lot.

**Reste à confirmer sur de vrais appareils** : les règles Firestore réelles pour le document `harmohub-paroles`, la fenêtre Google sur Safari/Dock, et
un changement d'ordinateur de bout en bout.

## Refonte de l'interface — lot 1 : fondations (2026-10-31)

Retour : « on a bien travaillé, tu peux commencer à monter l'application comme ça. Fais bien attention aux problèmes d'alignement, aux aspects
pas pratiques, et ne perds pas mes logos. » Cahier des charges COMPLET et feuille de route en 10 lots : `docs/refonte.md` (c'est lui qui garde les
décisions prises commentaire par commentaire sur la maquette — pour qu'une autre session ne les redécouvre pas).

**Mesuré avant de toucher** (ordinateur 1440×900, écran d'arrivée) : 43 commandes visibles, **10 hauteurs différentes** (15, 26, 27, 30, 32, 37, 39,
42, 44, 86 px) et **8 arrondis** — c'est le « boutons rangés n'importe comment » dit en chiffres.

**Ce que le lot fait.** (1) La jauge devient du code : `--bouton-h` 32px, `--bouton-h-lg` 44px, `--rayon-bouton` 7px, `--rayon-surface` 12px dans `:root`.
(2) Logo SEUL (« laisser logo mais enlever nom de l'appli ») : pastille de 32px, le nom reste en infobulle et en `aria-label` ; le dessin du logo n'est pas
touché. (3) « Structure », « Paroles » et « Fichier » passent de 26 à 32px (la règle tactile qui les protégeait devient sans objet, gardée comme filet).
Aucune icône de l'utilisateur n'est remplacée ; la règle « on reprend les logos existants » est écrite dans `docs/refonte.md`.

**Le banc : un CLIQUET.** `gabarit_boutons_test` mesure toutes les commandes visibles (arrivée + accord en modification) et tient `HORS_JAUGE`, la liste de
celles qui ne sont pas ENCORE à la jauge (18 aujourd'hui, chacune avec le lot qui la supprime). Il refuse (1) une commande hors jauge qui n'y figure pas — une commande
neuve ne peut pas être de travers —, et (2) une entrée devenue inutile : la liste ne fait que raccourcir, le lot qui supprime un bouton le retire d'ici, et c'est la
preuve que c'est fait. Liste vide = jauge tenue partout = fin de la refonte. Sabotage : `--bouton-h` à 29px → le banc rougit sur le logo et les trois boutons.

**Voisins verts** : synchro_cloud 126, compte_cloud 51, verre_compte 32, verre 64, sentinelle_atteignabilite 25, sentinelle_adresses 224, entete_grille_debordement 15,
meta_suite 6, structure_feuille 61, song_panel 31.

## Refonte de l'interface — lot 2 : la barre de lecture du bas (2026-11-01)

Retours de la maquette repris : « boutons de lecture plus gros… de la même taille », « la barre de lecture dépasse de mon écran en bas »,
« simplifier : juste le numéro de mesure », « garder une règle de lecture… avec la barre orange », « bouton 50 % à 200 % » + « molette / clic molette
+ haut ou bas », « compartimentage par blocs… déplacer le bloc des boutons de lecture au centre, à droite des parties du morceau ».

**Ce qui est fait (ordinateur seulement).** Une barre de 60px collée au bas de l'écran, trois blocs réordonnables : **Lecture** (le transport EXISTANT, déplacé
par `placeGlobalTransport`, jamais dupliqué : Lecture, Stop, + un bouton **Boucle** à part, carrés identiques de 44px, angles de 7px), **Parties** (« Mes. N » seul, la
frise des parties, la bande orange de la plage, la tête), **Tempo** (le bouton « 120 BPM » : molette ±1 / Maj ±5, clic molette + glisser, fenêtre −/+/TAP, **vitesse de
lecture 50–200 %**, et le métronome). Mode « réorganiser » : flèches ◀ ▶ par bloc, « Ordre d'origine », ordre mémorisé PAR APPAREIL (`harmohubBarreLectureOrdre`, jamais
synchronisé). Le téléphone garde son pied de colonne (lot 10). **Logos** : le métronome de la barre COPIE le dessin de la carte Rythme ; le bouton Boucle reprend l'anneau
fléché de Lecture (sans le triangle) ; aucun nouveau dessin quand un existait.

**Deux écarts avec la maquette, assumés.** (1) Pas de bouton « Début » : l'appli n'a pas de tête de lecture persistante, Stop revient déjà au départ — l'ajouter aurait été un
bouton sans effet. (2) Le bloc « Vues » (Clavier, Guitare) attend le lot 8 : ses deux boutons pilotent aujourd'hui le mini-piano.

**La vitesse, éprouvée sur le MOTEUR.** `bpmLecture()` = tempo du morceau × vitesse ; seules les trois lectures (accord, morceau, séquenceur) l'utilisent. Le banc lit les instants
que `playProgression` programme sur `Tone.Transport` : à 200 % le dernier tombe à 15,9s → 7,9s (rapport 2), et `#bpm` n'a pas bougé — le tempo ENREGISTRÉ (morceau, MIDI, PDF) est intact.

**Ce que la barre a révélé.** (a) `SEQ_DOCK_RESERVE_CONFORT` valait 190 et annonçait « une rangée d'accords » : mesuré, il en faut ~220. Personne ne le voyait tant que les écrans avaient de
la marge ; avec 60px de moins, `volet_hauteur_poignee_test` a rougi. Portée à 225 (plus petit palier qui passe : 222). (b) Un banc de la maquette lui-même appelait une méthode absente
(`clearLoopRange`) : la méta-suite l'a refusé, à raison. (c) La fenêtre du tempo sortait de l'écran quand le bloc est à droite : repérée en capture, corrigée (elle s'aligne sur le bord droit
du bouton si besoin).

**Bancs.** Nouveau `barre_lecture_test` (50 : barre en bas et pleine largeur, 60px, ordre des blocs, « Mes. N » qui suit l'accord puis la lecture, frise, bande orange, molette, clic molette,
vitesse sur le moteur, métronome miroir, réorganiser + mémoire, fenêtre du tempo à l'écran, **barre entière à 560/700/800/1000px de haut**, téléphone sans barre). **Sabotages** (4) : vitesse
ignorée, hook « Mes. N » retiré, ordre non appliqué, transport laissé au dock — chacun fait rougir ce qu'il doit. Réécrits pour le nouveau contrat (pas supprimés) : `global_transport_test`
(43), `transport_boucle_test` (25 : trois boutons au bureau, deux et l'anneau au téléphone), `item1_2_test`, `sidebar_collapse_test`, `sidebar_collapse_seq_height_test` (le pied de colonne se
mesure par rapport à la barre), `gabarit_boutons_test` (Lecture et Stop quittent `HORS_JAUGE`, 29 PASS). Une vérification vide a été repérée et corrigée en route : « l'ordre n'est pas
synchronisé » lisait `window.REGLAGES_SYNCHRONISES`, qui n'existe pas (une `const` de script n'est pas sur `window`) — elle passait sans rien prouver ; elle exige maintenant que la liste soit lisible.

**Balayage du 01/11 : 209 verts, 6 rouges, 7 sans verdict (222 suites)** — les six rouges et les sept muets sont EXACTEMENT ceux de la ligne de base (probe_clic_accord_voisin 4/4,
probe_defilement_tactile 23/1, probe_regle_voisins 28/1, probe_seq_finitions 18/1, seq_notes_libres_clavier 32/1, sortie_edition_involontaire 3/1) ; les deux suites de plus sont les deux
nouvelles. Premier balayage de la journée : 9 rouges, dont les trois ci-dessus (réserve, pied de colonne, méta-suite) — corrigés avant de pousser.

## Refonte de l'interface — lot 3 : la barre du haut, et le filet sous l'enregistrement manuel (2026-11-01)

Retours de la maquette repris : « laisser le logo, mais enlever le nom de l'appli », « ajuster la largeur de la barre avec le titre du morceau (rétrécir ou
élargir avec seuil) », « je veux bien garder le bouton enregistrer… enregistrement manuel. Mais garde quand même des enregistrements automatiques en arrière-plan
pour pouvoir revenir en arrière », « mettre versions de l'appli et récupérations historiques dans les paramètres », « pas de bouton rond ici ».

**3a — La barre (ordinateur seulement).** Une vraie barre pleine largeur de 52px, trois colonnes (`1fr auto 1fr`) : à gauche le logo SEUL, le titre du morceau (un
bouton de 128 à 280px, « … » au-delà, nom complet en infobulle) qui ouvre le **menu du morceau**, Enregistrer et son voyant ; au centre la place des onglets du lot 4
(colonne centrée sur la fenêtre, mesurée) ; à droite annuler, rétablir, Paramètres (l'engrenage existant), le compte. Le menu s'ouvre sur les 8 morceaux récents (le
morceau ouvert coché) : **changer de morceau reste à deux clics**, comme avec l'ancienne liste. Puis Mes morceaux, Nouveau, Renommer (en place, DANS la barre), Dupliquer
(nouveau : une copie de la version enregistrée, l'original ne bouge pas), Importer, Exporter (la portée « ce morceau / la bibliothèque »), Historique du morceau,
Rangement. Chaque entrée appelle le code de l'ancien bouton — aucune seconde copie. La carte Morceau du volet de gauche perd son en-tête sur ordinateur (le résumé
« tempo · mesure · tonalité » reste jusqu'au lot 6) ; sur téléphone rien ne change avant le lot 10. Le voyant : « Non enregistré » (orange) / « Enregistré à 14:32 »
(vert) / « Nouveau morceau » (gris) ; sous 1180px il garde son point et son texte passe en infobulle. Tous les boutons de la barre sont à la jauge (32px, 7px d'angle) :
le logo et le titre aussi (« pas de bouton rond »). Verre dépoli : la barre et le menu y sont, relevés par `verre_test` (nouvel état « menuMorceau »).

**3b — Les versions automatiques.** `historique.js` (nouveau) garde des instantanés du morceau dans **IndexedDB, par appareil** — jamais dans localStorage (quota de ≈ 5 Mo
PARTAGÉ avec la bibliothèque : un historique qui le remplirait ferait échouer l'enregistrement des morceaux eux-mêmes) ni dans le cloud (1 Mio par document). Quand : toutes
les 5 minutes de TRAVAIL (l'horloge part de la première modification depuis la dernière version, pas de la dernière version), en quittant la page s'il y a du neuf, à chaque
enregistrement, et AVANT chaque opération lourde — transposition, suppression d'une partie ou d'un morceau, import (bibliothèque ou MIDI), restauration, et « continuer sans
enregistrer » (le moment exact où des modifications disparaissent). Une version identique à la précédente du même morceau n'est pas gardée (le zoom n'est pas du contenu) ; 40
par morceau, au-delà de 90 jours on ne garde que les 5 plus récentes, 800 au total ; un quota plein fait de la place puis retente une fois. **Rien ne lève jamais** : IndexedDB
absent ou refusé → l'appli enregistre comme avant et les Paramètres le disent. **Paramètres › Historique et récupération** : le morceau (le ouvert d'abord, les supprimés aussi,
marqués), la carte « Maintenant » (brouillon modifié ou identique), chaque version avec son étiquette et son résumé (accords, parties, tonalité en notation internationale, BPM)
et un bouton Restaurer. **Restaurer remet la version dans le BROUILLON** : le morceau enregistré ne bouge pas tant qu'on n'a pas cliqué Enregistrer ; l'état d'avant est gardé
d'abord ; Ctrl+Z défait la restauration (même morceau) ; une version d'un autre morceau l'ouvre (avec la confirmation habituelle) ; celle d'un morceau supprimé le fait revenir dans
Mes morceaux. **À propos** : la version réellement chargée (lue sur la balise `script.js`, pas un numéro écrit en dur), sa date, « Recharger l'application ».

**Bancs.** `barre_haut_test` (71 : géométrie et jauge, centre exact, titre 128→280px, voyant, Enregistrer manuel, menu et chacune de ses entrées avec le même garde-fou
qu'avant, premier enregistrement dans la barre, carte masquée, seuils, verre, téléphone inchangé) et `historique_versions_test` (69 : moteur, 8 opérations lourdes avec leur VRAI
geste et lecture du CONTENU gardé, horloge simulée `page.clock` pour les 5 minutes, panneau, 4 restaurations, isolation localStorage/cloud, IndexedDB absent / qui lève / quota
plein, téléphone). **Sabotages — 13, tous rouges comme il faut** : barre (voyant jamais orange, titre sans plafond, en-tête de carte visible, Échap sans effet, renommage dans la
carte) ; historique (version prise APRÈS l'opération, doublons gardés, seuil de 5 minutes supprimé, plafond supprimé, restauration marquée « enregistrée », restauration sans version
d'avant, versions écrites aussi dans localStorage, abandon sans version). Un sabotage « équivalent » est resté vert et c'est une information : retirer le rappel de `marquerEnregistre`
ne change rien, parce que `refreshSongList` rafraîchit déjà le voyant juste après — le rappel est un filet de plus, pas la seule protection.
**Réécrits pour le nouveau geste, pas supprimés :** `filet_toujours_visible_test` (ordinateur : titre, Enregistrer, puis les trois entrées du menu ouvert ; téléphone : les sept adresses
d'origine), `three_fixes_test` (exporter / importer par le menu), `aspect_boutons_volet_test` (le bouton Enregistrer lu dans la barre ; la « famille dominante = la référence » était un effet
du nombre des six boutons partis : on tient maintenant directement la règle — la référence sombre porte le bouton de durée ET le résumé, et la plus nombreuse est l'une des deux décisions
nommées), `verre_test` (la barre n'est plus des pastilles flottantes : elle floute comme les autres surfaces), `gabarit_boutons_test` (`song-select` quitte `HORS_JAUGE`),
`sortie_edition_involontaire_test` (titre et Enregistrer, sorties légitimes). `sauvegarde_robustesse_test` et la synchro n'ont pas bougé.

**Ce que les bancs ont trouvé en route (vrais défauts, corrigés avant de livrer) :** une substitution en masse avait fait appeler `marquerEnregistre` par elle-même (récursion infinie
sur Enregistrer) ; le message « Clique Enregistrer pour la garder » disparaissait aussitôt, le panneau se redessinant juste après l'avoir posé ; les « 5 minutes de travail » étaient
comptées depuis la dernière version et non depuis la première modification (une version à la première retouche après une heure d'inactivité) ; la liste du menu s'écrasait à 16px par
ligne (`button { flex: 1 }` générique) et l'état « Modifications non enregistrées » se coupait en « …enregist… » (raccourci en « Non enregistré », la phrase reste en infobulle).
**Hors sujet mais vu :** dans un morceau de plusieurs parties, l'ajout rapide ouvre un menu « dans quelle partie ? » même pour un seul accord (sans doute à revoir au lot 7, « ajout
unique »). `verre_test` a rougi UNE fois sur `#open-settings` (transition de bordure en vol, 1 écart) puis passé deux fois de suite : même famille de bruit de minutage que les autres
suites sensibles — à surveiller si elle revient.

**Limites assumées.** Le comportement réel d'IndexedDB sur Safari / iOS n'est pas mesuré (Chromium ici) ; le code ne dépend d'aucune fonction rare et se replie proprement s'il est absent.
Ctrl+Z défait la restauration des accords et des réglages mais pas de la structure du morceau (elle n'est pas dans l'instantané d'annulation) : l'état d'avant, lui, est dans l'historique. La
synchro cloud qui apporterait une version d'un autre appareil n'est pas encore un déclencheur de version. Les entrées du menu « Exporter… » ne couvrent que la portée (ce morceau / la
bibliothèque) : PDF, MIDI, MP3 restent dans le bouton Fichier jusqu'au lot 4.

## Refonte de l'interface — lot 4 : les onglets Grille / Structure / Paroles (2026-11-01)

Retours de la maquette repris : « onglets Grille / Structure / Paroles EXACTEMENT au centre » (trois colonnes égales) et « Structure et Paroles deviennent des onglets (Paroles garde sa
page et sa synchro propre, ouverte depuis l'onglet) ».

**Ce qui est fait (ordinateur seulement).** Un groupe de trois onglets au centre de la barre du haut, dans la colonne `auto` réservée au lot 3 entre deux colonnes `1fr` : le centre est
celui de la FENÊTRE, pas celui de l'espace qui reste. **Ce ne sont pas de nouveaux boutons** : `#structure-btn` et `#lyrics-btn` gardent leur identifiant, leur logo (lignes de structure, micro)
et leur code ; `setupOnglets` les DÉPLACE dans la barre sur ordinateur et les remet à côté de Fichier sous 900px (un seul nœud DOM chacun, aller-retour mesuré). Seul « Grille » est neuf : il
n'avait pas de logo, il a une grille de quatre carrés. Chaque onglet est un bouton de la jauge (32px, 7px d'angle) — pas de cadre segmenté dont les cases à 26px auraient exigé une exemption : le
cliquet `HORS_JAUGE` n'a pas bougé. L'onglet allumé : texte vert + liseré vert dessous (« vert = état allumé »), jamais un aplat. **Grille** est allumée tant que la fenêtre Structure est fermée ;
**Structure** ouvre la fenêtre existante et l'allume, un second clic la referme ; **Paroles** ouvre sa page à part dans un nouvel onglet du navigateur, comme avant (et dépose toujours le transfert
des accords), sans jamais s'allumer ici. La fenêtre Structure s'ouvre désormais SOUS la barre (`top: var(--haut-barre)`) : sans cela elle couvrait les onglets, et un onglet qu'on ne peut plus cliquer
n'en est pas un. Échap la referme (elle ne répondait qu'à la croix et au clic sur le fond), l'aperçu avant impression d'abord s'il est ouvert par-dessus.

**Ce que la mesure a imposé.** (1) À 900px le groupe de droite dépassait de 26px sur les onglets (le compte vient de `compte-cloud.js`, commun aux trois applis : il ne rétrécit pas) : sous 1000px les
onglets gardent leur logo et perdent leur mot (infobulle). (2) Avec un titre de 280px, Enregistrer et son voyant, la colonne de gauche — la moitié de la fenêtre moins la moitié des onglets — débordait sur
les onglets : le titre se COMPRESSE maintenant (jusqu'à 128px), le voyant aussi. Le centre exact passe avant la largeur du titre ; le plafond de 280px ne se voit donc plus qu'à partir de ~1700px (le banc du
lot 3 a été ajusté en conséquence : il vérifie le plafond à 1920px et la compression à 1440px). Après correction : écart au centre ≤ 1px et jeu minimal de 20px avec les deux voisins, à sept largeurs de 900 à
1920px, titre court comme très long.

**Bancs.** Nouveau `onglets_test` (34 : centrage et jeux à six largeurs × titre court/long, ordre, jauge, un seul nœud par identifiant, aller-retour 600px ↔ 1440px, l'état allumé à chaque ouverture/fermeture —
clic, Grille, second clic, Échap, croix, fond—, ce que reçoivent les clics fenêtre ouverte via `elementFromPoint`, le clavier, la page Paroles ouverte et qui reçoit bien le morceau, téléphone inchangé).
**Sabotages — 8, tous rouges** : nœuds non déplacés, fenêtre qui couvre la barre, colonnes non égales, état allumé figé, Grille qui ne ferme pas, second clic qui ne ferme pas, titre non compressible, Échap sans
effet. **Un défaut réel trouvé par un ancien banc** : `structure_modulable_test` masque la fenêtre en posant `hidden = true` directement ; mon bascule se fiait à un drapeau interne (`structureOpen`) qui ne
suivait plus, et le clic suivant sur Structure FERMAIT au lieu d'ouvrir. Corrigé à la racine : l'état se lit sur la fenêtre elle-même (`fenetreStructureOuverte`), ce que l'utilisateur voit étant la seule vérité.
`barre_haut_test` ajusté (voir plus haut), aucun autre banc réécrit.

**À noter, sans y toucher (comportement d'origine).** Cliquer « Paroles » télécharge aussi un fichier `.json` (le transfert vers un autre navigateur) en plus d'ouvrir la page : pour un onglet, c'est
surprenant — à reconsidérer avec l'utilisateur, ce n'est pas une régression. La page Paroles garde son propre en-tête (« ‹ HarmoHub », logo, « Paroles ») : y reposer les trois onglets est possible
(Grille et Structure y mèneraient vers `index.html`), mais touche une page à part et ses bancs : à décider.

**Balayage du lot 4 (01/11) : 211 verts, 7 rouges, 7 sans verdict (225 suites).** Les cinq rouges de la ligne de base (probe_clic_accord_voisin 4/4, probe_defilement_tactile 23/1, probe_regle_voisins 28/1,
probe_seq_finitions 18/1, seq_notes_libres_clavier 32/1) et les sept muets sont inchangés ; `sortie_edition_involontaire` (rouge dans la base, à cause de la fenêtre du manche) est passé au vert cette fois-ci.
Deux rouges NOUVEAUX, examinés avant de pousser : (1) `meta_suite_test` — le défaut était dans MON banc : `onglets_test` avalait une erreur (`.catch(() => {})`) et portait une vérification sous
condition (`if (page2) { check… }`), deux compteurs que la méta-suite interdit d'augmenter. Corrigé : si la page Paroles ne s'ouvre pas, le banc échoue bruyamment au lieu de sauter la vérification.
(2) `manche_edition_lot6_test` (« l'aperçu disparaît quand la souris quitte le manche ») — déjà rangé dans les suites sensibles au minutage du balayage (son en-tête note 1-2 rouges en charge et 0 isolé) ;
relancé seul trois fois de suite : 18 PASS / 0 FAIL à chaque fois, et rien dans le lot 4 ne touche le manche. Traité comme du bruit de minutage, noté ici pour le cas où il reviendrait.

## Refonte de l'interface — lot 4b : Paroles et Structure intégrées au morceau (2026-11-01)

Décision de l'utilisateur, après le lot 4 : « au lieu de séparer Paroles, on peut l'intégrer directement au morceau. Ce sera plus simple. Il ne faut pas qu'elle garde sa
propre en-tête, ni le logo. On peut garder les trois onglets avec Paroles et Structure intégrées. »

**Comment, et pourquoi pas autrement.** Fusionner le code de Paroles dans script.js était hors de portée sans tout renommer : les deux fichiers déclarent les mêmes noms
globaux (`state`, `loadSong`, `undo`, `redo`, `escapeHtml`, `showBanner`…) et paroles.css habille `.top-bar`, `button`, `body` pour la page entière. La page Paroles est donc
chargée DANS HarmoHub, dans un cadre, en **mode intégré** (`paroles.html?integre=1`) : même code, mêmes données (même origine), même synchro — exactement la configuration qui
tournait déjà quand les deux étaient ouvertes dans deux onglets, moins l'onglet. En mode intégré : plus d'en-tête ni de logo ni de lien « HarmoHub », plus de bouton d'import
(le morceau vient de HarmoHub), plus de second compte ni de second annuler / rétablir (ceux de la barre du haut) ; l'état d'enregistrement des paroles et les exports texte /
copie / PDF rejoignent sa barre d'outils (déplacés, pas recopiés). Ouverte seule (favori, téléphone), la page ne change pas.

**Ce qui relie les deux.** Les accords passent par le dépôt d'origine (`harmohub_lyrics_pending_import`) — plus de fichier `.json` téléchargé ni de nouvel onglet au clic.
La vue ne se recharge que si les accords ont changé (sinon l'historique d'annulation et le défilement des paroles seraient perdus à chaque aller-retour d'onglet). En quittant la
vue ou en changeant de morceau, l'écriture des paroles est FORCÉE (`writeSessionNow`) : rien de ce qui vient d'être tapé ne reste en suspens. Annuler / rétablir de la barre du haut
agissent sur les paroles quand leur vue est ouverte (le cadre dit par `postMessage` s'il y a de quoi annuler). Un morceau jamais nommé : la vue l'explique et propose de le nommer
(les paroles sont attachées à un morceau). **Structure** : la fenêtre d'origine devient une vue (même contenu, même code) — plus de voile, de flou, de titre ni de croix ; un clic à
côté du panneau ne la ferme plus. **Les deux vues** s'arrêtent au-dessus de la barre de lecture (on joue le morceau en lisant), la grille est masquée derrière (`visibility`, sans
recalcul), leur fond est celui de l'appli. Pendant une vue, les raccourcis de la grille sont coupés (restent espace, annuler / rétablir, Ctrl+S, Échap qui ramène à la grille).
Téléphone inchangé (lot 10).

**Ce que la mesure a trouvé.** (1) Un rectangle BLANC à la place de la vue Paroles, verre éteint : HarmoHub déclare `color-scheme: dark`, la page Paroles non — quand ils diffèrent,
le navigateur peint un fond opaque derrière le document du cadre. Corrigé (même `color-scheme` en mode intégré) et tenu par une mesure en PIXELS, verre éteint et allumé. (2) La
garde du clavier : un premier banc tapait Suppr « sur un accord sélectionné » et restait vert la garde RETIRÉE — vérification vide. L'expérience témoin a montré pourquoi : ouvrir un
onglet, à la souris comme au clavier, efface déjà la sélection. Le vrai risque est **Ctrl+V**, qui colle le presse-papiers des accords SANS sélection (mesuré : 3 → 4 accords) dans une
grille qu'on ne voit pas. Le banc éprouve maintenant Ctrl+V seul (une séquence Ctrl+V puis Suppr masquait le défaut : l'accord collé, sélectionné, était aussitôt effacé), avec un TÉMOIN
vue fermée qui prouve que le même geste colle bien.

**Bancs.** Nouveau `vues_integrees_test` (40 : contenu du cadre — ni en-tête, ni logo, ni import, ni second compte, ni second annuler —, exports présents, parties du morceau, place exacte
entre les deux barres, barre de lecture utilisable, grille masquée, paroles tapées puis vue quittée aussitôt = enregistrées, annuler / rétablir et Ctrl+Z routés vers les paroles et jamais vers
la grille, Ctrl+V et autres touches sans effet vue ouverte + témoin, Échap, changement de morceau vue ouverte dans les deux sens, fond sombre mesuré en pixels avec et sans verre, morceau sans nom,
vue Structure, page Paroles seule inchangée, téléphone inchangé). **Sabotages — 10, tous rouges** : en-tête visible, pas d'écriture en quittant, annuler qui va à la grille, garde clavier Paroles
retirée, garde clavier Structure retirée, vue qui ne suit pas le morceau, fond blanc, vue qui couvre la barre de lecture, téléchargement au clic. **Réécrits pour le nouveau geste :**
`onglets_test` (Paroles ouvre la vue, exclusive avec Structure ; clic à côté de Structure ne la ferme plus ; ni titre ni croix), `export_lyrics_test`, `export_lyrics_opens_tab_test`,
`paroles_autoload_back_test` (l'export vers Paroles — fichier + nouvel onglet — reste le geste du TÉLÉPHONE : ces trois bancs passent au format téléphone pour cliquer le même bouton, au lieu
d'appeler la méthode en douce). Les 13 suites Paroles et `synchro_paroles_test` passent sans modification.

**Limites.** Le cadre a son propre défilement (celui de la page Paroles) ; Ctrl+S tapé DANS le cadre n'enregistre pas le morceau (les paroles, elles, s'enregistrent seules). Le regroupement
des frappes de Paroles (une étape d'annulation par seconde de frappe continue) est celui d'avant, inchangé.

**Balayage du lot 4b (01/11) : 214 verts, 5 rouges, 7 sans verdict (226 suites)** — les cinq rouges (probe_clic_accord_voisin 4/4, probe_defilement_tactile 23/1, probe_regle_voisins 28/1,
probe_seq_finitions 18/1, seq_notes_libres_clavier 32/1) et les sept muets sont ceux de la ligne de base ; aucun nouveau rouge.

## Refonte de l'interface — lot 5a : l'affichage de la grille (2026-11-01)

Retours de la maquette repris : « les cases sont trop grosses, ça nuit à la visibilité », « je n'ai pas besoin de toute cette largeur… fenêtre extensible, centrée, plus
petite ? », « la fenêtre fonctionne bien en largeur… trouver une astuce en hauteur aussi », « Compact / Normal / Détaillé remplace les quatre boutons de zoom ». Le lot 5
(grille) est livré en quatre sous-lots : 5a affichage (celui-ci), 5b les petits carrés du rythme et leur option, 5c l'en-tête de partie, 5d les finitions (case « + »,
pastille ambre du voicing perso, durée affichée pendant l'étirement, Maj+flèches). La règle de lecture sous les cases et la plage orange qu'on y trace EXISTAIENT déjà.

**Ce qui est fait (ordinateur).** Un groupe Compact / Normal / Détaillé (trois boutons à la jauge, l'allumé en texte vert + liseré) à la place des quatre boutons H± V±, aux
valeurs de la maquette : Compact = cases de 38px, 8 mesures par ligne, noms seuls (ni degrés ni position d'accord : c'est le RENDU qui les omet, pour ne pas laisser de rangée
vide), fenêtre de 640px ; Normal = 52px, 4 mesures, 480px ; Détaillé = 84px, 4 mesures, 640px. La grille est une fenêtre CENTRÉE (`#grille-cadre`) : poignée du bord droit
(360 à 1400px, et jamais plus que sa colonne ; les deux bords s'écartent ensemble), poignée du bord bas pour la hauteur des cases (30 à 160px, l'écart réparti sur toutes les
rangées, seule une variable CSS bouge pendant le geste), double-clic sur l'une ou l'autre = valeurs de l'affichage. **Sous le capot, rien de neuf** : les affichages sont des
préréglages des deux échelles qui existaient déjà (enregistrées dans le morceau, synchronisées) ; seule la largeur de fenêtre est une donnée nouvelle (`grilleLargeur`, par
morceau, avec `grilleDensite`). Un morceau d'avant ce lot s'ouvre en Normal ; sans morceau ouvert, l'appareil mémorise l'affichage comme il mémorise les échelles.

**Ce que la mesure a imposé.** (1) Une vraie régression trouvée par `classic_grid_zoom_test` : sans morceau ouvert, forcer « Normal » au démarrage effaçait les échelles réglées
au rechargement — corrigé par la mémoire de l'appareil (`harmohubGrilleDensite`, `harmohubGrilleLargeur`). (2) « Téléphone inchangé » était FAUX au premier jet : les échelles
étant celles du morceau, l'affichage Normal (0,8125) réduisait les cases du téléphone de 56 à 45px (`seq_tiroir_flottant_test` l'a vu : grille visible 118px au lieu de ≥120). Le
téléphone lit désormais son échelle ramenée à l'affichage Normal (`--grid-zoom-scale-v-tel`) et Compact n'y descend pas sous l'ancien plancher (0,7) : Normal y redonne exactement
l'aspect d'avant. (3) Les rangées de numéros et de degrés ont un plancher (16 / 14px) : en Compact elles seraient tombées à 12px. (4) L'échelle verticale est arrondie au
dix-millième (et non plus au centième) : 52px = 0,8125, arrondi à 0,81 la case faisait 51,84px.

**Un point à faire trancher par l'utilisateur.** En Normal (480px, valeur de la maquette), un accord d'UN temps n'a que ~28px : un symbole long (« B♭maj7 ») y descend au plancher de
8px de `fitCellSymbols` — lisible de près, pas de loin. Au format d'avant (toute la colonne) il tenait à plus de 10px. Ce n'est pas un défaut de code, c'est le prix de la largeur
choisie ; Détaillé (640px) ou la poignée droite le règlent. `place_du_plus_et_diagrammes_test` mesure désormais l'égalité des polices dans une fenêtre élargie à la poignée.

**Bancs.** Nouveau `affichage_grille_test` (29 : les trois affichages et leurs valeurs, centrage, poignée droite — écart double, plancher, plafond de la colonne, double-clic —, poignée
basse — +20px par case, 160, 30, double-clic —, mémoire dans le morceau, morceau ancien en Normal, rechargement, mémoire de l'appareil sans morceau, téléphone inchangé). **Sabotages : 8,
dont 7 rouges** ; le 8e (plafond de hauteur retiré de `borneHauteurCase`) reste vert, et c'est une information : `setZoomLevel` borne la même échelle à 160px — double protection.
**Réécrits pour le nouveau geste :** `classic_grid_zoom_test`, `song_zoom_persist_test` (les boutons H / V ne restent qu'au format téléphone : ces bancs s'y placent ; un morceau neuf
ou ancien part de Normal), `probe_suppression_pleinecran_test` (l'échelle horizontale par l'affichage Compact), `gabarit_boutons_test` (les quatre `classic-grid-*` quittent `HORS_JAUGE`),
`entete_grille_debordement_test` (trois commandes au bureau au lieu de quatre), `retour_a_sa_place_test` (l'enveloppe `#grille-cadre`), `grille_clic_et_double_clic_test` (le double-clic
« charger l'accord » vise le bas de la case : à 52px, 8px sous le haut c'est déjà la zone du symbole, qui renomme — le lot 6 refait ces gestes), `place_du_plus_et_diagrammes_test` (voir plus haut).

**Balayages du lot 5a (01/11).** Premier : 210 verts, 10 rouges — cinq nouveaux (en-tête de grille, double-clic, police des symboles, ordre de la section, tiroir du téléphone), tous
analysés ci-dessus et corrigés (dont le téléphone qui changeait). Second, après corrections : **214 verts, 6 rouges, 7 sans verdict (227 suites)** — les cinq rouges de la ligne de base,
plus `glock_unlock_and_switch_test` (2/5), suite déjà notée intermittente et rangée parmi les sensibles au minutage : relancée seule trois fois, 7 PASS / 0 FAIL à chaque fois.

## Refonte de l'interface — lot 5b : les carrés du rythme, et les accords d'un temps (2026-11-02)

Demandes reprises : « pour les petits carrés du rythme, c'est pas débile, je pense qu'on peut les garder avec une option dans les paramètres pour les afficher ou pas » ; et, sur
les accords d'un temps devenus minuscules dans la fenêtre de 480px du lot 5a : « ça peut arriver quelques fois. Fais au mieux pour l'affichage. Ça ne se règle pas en étirant la
fenêtre manuellement ? » (réponse : si — la poignée droite ; ce lot le fait aussi tout seul).

**Les carrés.** En affichage Détaillé, seize carrés par mesure sous le nom de l'accord, lus dans le MOTIF que joue réellement l'accord (`resolveSeqPatternForData`, le même que le
séquenceur et la lecture) : plein = attaque, pâle = notes tenues (liées depuis le pas d'avant), vide = silence ; un léger écart tous les quatre carrés marque le temps. Un accord coupé en
fin de ligne montre sur chaque morceau SES pas (la 2e ligne commence « tenue », pas « attaque »). Couleurs douces, jamais d'aplat vif. Ils ne prennent pas le clic. Ils n'apparaissent
qu'en Détaillé, option allumée, case d'au moins 64px (sinon ils recouvriraient le nom) — jamais sur téléphone. **L'option** « Rythme de l'accord dans les cases » est dans Paramètres ›
Affichage, allumée par défaut (choisir Détaillé est déjà un choix), mémorisée (`harmohubRythmeDansCases`) et SYNCHRONISÉE comme les degrés (ajoutée à `REGLAGES_SYNCHRONISES`).

**Les accords courts.** Quand le morceau contient un accord de moins de deux temps et que la largeur n'a pas été tirée à la main, la fenêtre de grille s'élargit d'elle-même juste assez
pour que l'accord le plus court ait ~56px (dans la limite de sa colonne) : « B♭maj7 » d'un temps passe de 8px à 11,5px, sur une ligne. Une largeur tirée à la poignée l'emporte toujours ;
un morceau sans accord court garde exactement les 480 / 640px de la maquette. Dernier recours, dans une fenêtre très étroite : le nom passe sur DEUX lignes (« B♭ » / « maj7 »), gardé
seulement s'il y est plus grand et s'il tient en hauteur ; la case repart d'une ligne à chaque nouvel ajustement (elle a pu s'élargir).

**Téléphone, encore.** Relu en codant ce lot : l'affichage étant enregistré dans le morceau, un morceau mis en Compact sur l'ordinateur aurait perdu ses degrés sur le téléphone, et un
morceau en Détaillé y aurait montré les carrés. Les deux effets sont désormais réservés à l'ordinateur ; la grille se redessine quand on change de format.

**Bancs.** Nouveau `rythme_cases_test` (27 : un motif posé à la main relu pas à pas, accord tenu, accord coupé sur deux lignes, place des carrés, clic à travers, affichages Normal / Compact
/ Normal avec des cases de 90px, hauteur insuffisante, option dans Affichage, mémoire, synchronisation, rechargement, élargissement automatique, largeur manuelle prioritaire, deux lignes à
360px, largeur de la maquette sans accord court, téléphone). **Sabotages : 8, dont 7 rouges.** Le 8e — les carrés reçoivent les clics — reste vert, et c'est juste : ils sont DANS la case,
le clic remonte jusqu'à elle ; `pointer-events: none` est un filet de plus. Un premier sabotage resté vert (carrés hors Détaillé) a montré un TROU du banc : en Normal et Compact les cases
sont trop basses, la condition « Détaillé » n'était jamais éprouvée — d'où le cas « Normal avec des cases de 90px ». **Un vrai défaut trouvé par `verre_test`** : la précision « En affichage
Détaillé. » utilisait la classe `.verre-indice`, qui vit dans `verre.css` (fichier commun aux trois applis, réservé au verre) — l'aspect d'un réglage d'Affichage dépendait donc de la présence
du verre. Classe propre à HarmoHub (`.reglage-indice`).

**Balayage du lot 5b (02/11) : 216 verts, 5 rouges, 7 sans verdict (228 suites)** — exactement la ligne de base ; aucun nouveau rouge.

## Refonte de l'interface — lot 5c : l'en-tête de partie (2026-11-02)

Demande reprise de la maquette validée : « nom et N mesures sur la même ligne de base, ×N si répétée, menu ⋯ (répéter, renommer, monter, descendre, dupliquer, supprimer — version
automatique avant suppression) ».

**L'en-tête (ordinateur).** Le nom, « 8 mesures » (en toutes lettres, au singulier sous 2, virgule décimale : « 1,5 mesure ») et l'étiquette bleue « ×N » se suivent sur la MÊME ligne de
base ; le champ du nom prend la largeur de son texte (il prenait toute la ligne, ce qui envoyait le nombre de mesures loin à droite) et grandit en tapant, sans jamais pousser le ⋯ hors de
la ligne. Les quatre petits boutons ▲▼⧉🗑 (26px, hors jauge) laissent la place au seul bouton ⋯ (32px), au bout de la ligne : l'en-tête fait 32px, comme la maquette.

**×N, une seule notion de répétition.** L'étiquette dit combien de fois la partie est JOUÉE d'après la structure (`repetitionsDansStructure`, la valeur de la vue Structure et de Paroles) —
rien à ×1. « Répéter » dans le menu est le même geste que le ×N de la vue Structure (`modifierStructure`, donc enregistré aussitôt dans le morceau, bornes 1 à 99), et le menu reste
ouvert pour enchaîner les « + ». Une partie jouée à plusieurs endroits de la structure, ou à aucun, ne se règle pas d'ici : − et + restent visibles mais grisés, la raison est écrite
(« Jouée à 2 endroits de la structure », « Absente de la structure ») et « Régler dans Structure » ouvre la vue.

**Le menu.** Celui du morceau (même aspect, même verre), posé sous le ⋯ et calé à droite ; il suit son bouton quand la page défile. Monter / Descendre / Supprimer restent visibles et
grisés quand ils sont sans objet (première ou dernière partie, partie seule). Supprimer demande confirmation et garde une version « avant suppression » (lot 3b) quand la partie avait
des accords. Clavier : flèches, Échap (rend le focus au ⋯), Tab referme.

**Téléphone : inchangé** (boutons ▲▼⧉🗑, « 8 mes. », nom pleine ligne) jusqu'au lot 10 ; seule l'étiquette ×N y apparaît aussi, c'est une information.

**Défauts trouvés en codant.** (1) **Déjà présent avant ce lot** : cliquer le nom d'une partie INACTIVE ne permettait pas de le taper — l'activer redessinait la grille et le focus
partait avec l'ancien champ ; il fallait cliquer deux fois. Le focus est rendu au champ neuf. (2) Le menu, posé en position fixe, se refermait au moindre défilement — or activer une
partie fait défiler d'un cran : il se refermait à peine ouvert. Il suit désormais son bouton. (3) Trouvé par `voice_leading_section_ops_test` : ouvrir le ⋯ ACTIVAIT la partie, ce qui
déplaçait le panneau « Conduite de voix » sous elle — la grille sautait sous la souris et le bouton sortait de l'écran. Ouvrir un menu ne déplace plus rien.

**Bancs.** Nouveau `entete_partie_test` (49 : ligne de base mesurée par sondes et par le texte, largeur du champ, nom long, singulier et virgule, 32px, ×N, ⋯ seul au bout de la ligne,
répéter ±, enregistrement dans la structure du morceau, focus quand « − » se grise, clavier, clic ailleurs, ouvrir sans activer, chaque article, article grisé sans effet, confirmation
refusée / acceptée, version avant suppression contenant la partie, partie seule, structure à plusieurs endroits, partie absente, « Régler dans Structure », défilement, téléphone).
**Sabotages : 14, tous rouges** — dont un d'abord resté vert (refermer au défilement) : le banc ne faisait rien défiler ; l'épreuve E2 l'a comblé. Adaptés : `voice_leading_section_ops_test`
(monter / dupliquer / supprimer passent par le ⋯, comme l'utilisateur sur ordinateur), `gabarit_boutons_test` (l'entrée `prog-section-duplicate` sort de HORS_JAUGE : la commande n'est plus
visible sur ordinateur, le ⋯ est à la jauge).


**Balayage du lot 5c (02/11) : 217 verts, 5 rouges, 7 sans verdict (229 suites)** — exactement la ligne de base, plus la nouvelle suite ; aucun nouveau rouge.

## Refonte de l'interface — lot 5d : les finitions de la grille (2026-11-02)

**Pastille ambre du voicing personnalisé** (« jamais le mot perso ») : un point de 6px dans le coin haut droit de la case quand l'accord ne sonne plus comme
son nom le laisse attendre — notes ajoutées à la main (notes libres) ou doigté de guitare fixé au cadenas. L'infobulle dit lequel (« 2 notes ajoutées à la
main, doigté de guitare fixé »). Renversement, drop, octave et basse ne comptent pas : ils s'écrivent déjà dans la case. Une seule pastille par accord (sur
son début s'il est coupé de ligne), à tous les affichages, Compact compris.

**La durée affichée pendant qu'on étire** : une étiquette bleue au-dessus du bord droit de l'accord, dès la prise de la poignée et à chaque cran (« 1 mesure »,
« 1 mesure et 2 temps », selon la mesure du morceau) ; une seconde après chaque Maj+flèche. Elle vit hors de la grille (la grille se redessine à chaque cran,
et la case coupe ce qui dépasse). Une seule annulation pour tout le glissé (existait déjà, désormais éprouvé).

**Maj+flèches existait déjà** (`resizeSelectedChord`, une annulation par appui, plancher d'un temps) — le banc le tient désormais.

**La case « + »** : le cahier des charges dit « largeur d'une mesure, jamais tout l'espace restant ». C'était le défaut de la MAQUETTE (sa case s'allongeait
sur le reste de la ligne). Dans HarmoHub, elle est depuis août le petit carré demandé par l'utilisateur (« je n'ai pas besoin de toute cette largeur pour
cliquer », `case_plus_test`) : gardée, et ce lot tient qu'elle ne dépasse jamais une mesure, à chaque affichage et sur une ligne presque vide.

**Banc.** Nouveau `finitions_grille_test` (33). **Sabotages : 10, tous rouges** — dont un d'abord vert (bulle posée sur le début d'un accord coupé de ligne) :
le banc n'étirait jamais un accord coupé ; le cas a été ajouté.

**Balayage du lot 5d (02/11) : 218 verts, 5 rouges, 7 sans verdict (230 suites)** — exactement la ligne de base, plus la nouvelle suite ; aucun nouveau rouge.

## Refonte de l'interface — lot 6a : la rangée de réglages du morceau (2026-11-02)

Le lot 6 (« bulle + inspecteur, suppression du bandeau de gauche et de la carte Accord ») est livré en trois sous-lots : **6a** la rangée de réglages
(celui-ci), **6b** la bulle « quel accord » au clic, **6c** l'inspecteur « son de l'accord » et la fin du bandeau de gauche.

**La rangée.** Au-dessus de la grille, des puces à la jauge : « Tonalité C majeur ▾ », « Mesure 4/4 ▾ », « Swing Droit ▾ », « Son Piano ▾ », puis
« Transposer » et ses deux flèches d'origine. Elles remplacent, sur ordinateur, la carte Morceau du bandeau de gauche (son titre et ses boutons étaient
déjà dans la barre du haut, lot 3 ; le tempo dans la barre du bas, lot 2). Le titre « Grille d'accords » disparaît aussi : l'onglet Grille le dit.
- **Une seule source.** Chaque puce règle la vraie liste du morceau (#global-root, #time-sig, #groove, #instrument) et déclenche son « change » : tout ce
  qui y était branché (morceau modifié, Ctrl+Z, lecture relancée en direct, versions) reste vrai sans être recopié.
- **Tonalité ≠ Transposer** (docs/refonte.md) : la puce Tonalité ouvre un petit panneau — douze toniques en notation internationale (E♭, F♯), sept modes,
  « Suggérer d'après les accords », et la phrase « Change seulement la lecture des degrés : les accords ne bougent pas. Pour déplacer les accords, utilise
  Transposer. » Transposer, lui, déplace tous les accords (version gardée avant, lot 3b).
- **Groove → Swing** : Droit / Shuffle léger / Ternaire, chacun expliqué en une ligne.
- **Le contretemps du métronome**, seul réglage de la carte Morceau que la barre du bas n'avait pas, passe dans la fenêtre du tempo (même bouton, déplacé).
- **Téléphone : inchangé** jusqu'au lot 10 (carte Morceau, contretemps compris).

**Défauts trouvés en route.** (1) **Existait avant ce lot** : après un Ctrl+Z sur la mesure, le swing ou le tempo, la ligne de résumé de la carte Morceau
et le tempo de la barre du bas gardaient l'ancienne valeur — seule la tonalité rafraîchissait l'affichage. `restoreHistorySettings` rafraîchit désormais
tout ce qui résume ces réglages. (2) L'annulation de ces réglages prend son instantané AU FOCUS de la liste : une puce, qui ne lui donne jamais le focus,
arme elle-même l'annulation (sauf pour le son, qui n'est pas un réglage annulable : un instantané resté armé aurait été validé à tort par le réglage
suivant). (3) Trouvé par `popups_close_test` : avec la suggestion de tonalité ouverte par-dessus la puce, Échap fermait la puce et laissait la
suggestion flotter seule — Échap ferme désormais d'abord ce qui est devant.

**Bancs.** Nouveau `rangee_reglages_test` (41). **Réécrits pour le nouveau geste** (la carte Morceau ne se déplie plus sur ordinateur) : `barre_haut`,
`aspect_boutons_volet` (la référence sombre porte le bouton de durée ; le résumé n'est plus dans le volet), `instrument_du_morceau` et
`probe_instrument_pendant_edition` (puce Son), `historique_versions` (Transposer de la rangée), `filet_toujours_visible` (la tonalité = la puce, le
tempo = la barre du bas), `undo_reglages_globaux` (tempo dans la barre du bas, mesure / swing / mode aux puces, chacun avec un VRAI Ctrl+Z),
`config_improvements` et `popups_close` (suggestion depuis la puce ; la table des menus éprouve aussi le choix d'une puce), `metronome_groove`
(swing à la puce, métronome et contretemps dans la barre du bas), `tap_removal` (TAP de la barre du bas), `sentinelle_atteignabilite` (les puces ont des
identifiants, et la surface « réglages du morceau » est la page elle-même sur ordinateur). `popover_morceau_dense`, `reglages_morceau_popover` et
`song_panel` éprouvaient la mise en page de la carte Morceau elle-même : ils se jouent désormais juste sous le seuil (860px), là où elle vit encore.
**Sabotages : 12, tous rouges** (dont un éprouvé par `popups_close_test`).
**Premier balayage du lot 6a : 216 verts, 8 rouges** — trois rouges NOUVEAUX, tous du lot lui-même : `sentinelle_adresses` et `meta_suite` ne trouvaient pas
les adresses `#rr-*` dans la page (les puces étaient fabriquées par le script) — elles sont désormais écrites dans index.html, le script ne fait que les
câbler ; `meta_suite` a aussi relevé une vérification sous condition dans le nouveau banc (rendue inconditionnelle) ; `mobile_grille_plus_haut` exigeait le
titre « Grille d'accords » sur ordinateur — il éprouve désormais que la grille reste identifiée par l'onglet Grille et que la rangée est visible.

## Refonte de l'interface — lot 6b : la bulle « quel accord » (2026-11-02)

Cahier des charges : « clic = sélectionne et ouvre la bulle » ; « une bulle (QUEL accord : fondamentale, type, basse, durée, ‹ › vers le voisin) [...] Une
bulle = UNE étape d'annulation. Modification directe, Ctrl+Z comme filet » ; « double-clic = retaper le nom » ; « Sélection BLEUE, lecture VERTE ».

**La bulle (ordinateur).** Un clic sur une case la choisit (et la fait entendre, comme avant) et ouvre, sous elle, une bulle de 404px : ‹ › vers l'accord
voisin, le nom, son degré et sa place (« mes. 2 · Couplet »), × ; douze fondamentales (orthographe de la tonalité), les vingt types de l'appli, treize basses
(« — » = fondamentale) ; la durée −/+ en mots ; « Réglages du son › » ; une ligne d'aide. Au-dessus de la case s'il n'y a pas la place en dessous. Elle suit
le défilement, se ferme par Échap, × ou un clic à côté ; un clic sur une autre case la DÉPLACE ; ← → au clavier la font suivre.

**Elle écrit l'accord directement**, comme la retape du nom au double-clic (déjà éprouvée) — elle ne fait PAS passer l'appli en « modification » : c'est
tout l'objet de la décision « plus de mode ajout / modification ». Changer de type remet renversement et drop à zéro (la maquette) ; allonger tient la
partie ajoutée (comme la poignée) ; un doigté verrouillé saute avec l'accord qu'il jouait. Toutes les retouches d'une bulle s'annulent d'UN Ctrl+Z ; deux
bulles, deux étapes. « Réglages du son » ouvre la carte Accord sur cet accord (elle deviendra l'inspecteur au lot 6c).

**Double-clic = retaper le nom**, où que tombe le clic (la bulle porte le reste). **Sélection bleue** : la case choisie et la case en modification sont
bleues ; le vert reste à la lecture. **Téléphone : inchangé** (lot 10).

**Bancs.** Nouveau `bulle_accord_test` (40). **Réécrits pour le nouveau geste** — ils entraient en modification par un double-clic sur la case, qui retape
désormais le nom : `ajout_modif` (dont sa section « une seule règle au clic », dont la règle a changé), `filet_toujours_visible`, `glock_full_real_ui`,
`grid_dblclick`, `grille_clic_et_double_clic`, `probe_instrument_pendant_edition`, `probe_suppression_pleinecran` : clic, puis « Réglages du son ».
`probe_clic_accord_voisin`, rouge depuis toujours (4 échecs), n'en garde plus qu'un — celui d'avant.
**Sabotages : 15, dont 11 rouges au premier passage.** Trois restés verts étaient des TROUS du banc, comblés puis rejoués rouges : changer de type ne remettait
plus renversement et drop à zéro (le banc partait d'accords sans renversement — l'accord d'essai en porte un désormais), l'accord retouché ne se faisait
plus entendre (l'appel au lecteur est maintenant compté), la bulle s'ouvrait sous 900px (ce cas-là reste vert : sans la garde, la bulle ne tient pas
ouverte dans la mise en page étroite — double protection, comme Échap, que la table commune des menus traite aussi).

**Balayage des lots 6a + 6b (04/11) : 220 verts, 5 rouges, 7 sans verdict (232 suites)** — exactement la ligne de base, plus les deux nouvelles suites ; `probe_clic_accord_voisin` (rouge de la ligne de base) passe de 4 échecs à 1.

## Refonte de l'interface — lot 6c : l'inspecteur « son de l'accord », la fin du bandeau de gauche (2026-11-04)

Cahier des charges : « Plus de bandeau de gauche, plus de mode ajout / modification. On agit dans la grille : une bulle (QUEL accord) et un inspecteur
(COMMENT il sonne : voicing, jeu, intensité, rythme, doigté). Rien aux deux endroits » ; « pastille ambre sur la case + « Revenir à l'automatique » dans
l'inspecteur » ; « Fini l'orange du mode modification ».

**Sur ordinateur, le bandeau de gauche a disparu.** Sans accord ouvert, la grille a toute la largeur. « Réglages du son » (dans la bulle) ouvre l'accord en
modification : le CADRE de l'ancien bandeau devient l'inspecteur, À DROITE de la grille (344px, comme la maquette) — même nœud, mêmes adresses, seule la
mise en page change, d'où un risque minimal pour tout ce qui y vivait (voicing, basse, séquenceur, doigté). La rangée « quel accord » (fondamentale, type,
durée) n'y est plus : c'est la bulle. La croix le ferme. L'ancien repli du bandeau n'a plus d'objet : son étiquette disparaît, et un repli mémorisé ne vide
pas l'inspecteur. Le sujet « accord déjà posé » passe de l'ocre au bleu éteint de la sélection.

**Voicing personnalisé.** L'inspecteur dit pourquoi la case porte une pastille ambre (« Voicing personnalisé : une note ajoutée à la main. ») et propose
« Revenir à l'automatique » (retire les notes ajoutées et le doigté fixé) — une modification de la session comme une autre, défaite par Ctrl+Z.

**Téléphone : inchangé** (carte Accord, mode Ajout compris) jusqu'au lot 10.

**Bancs.** Nouveau `inspecteur_son_test` (26). **Sabotages : 11, tous rouges** — dont un d'abord vert (l'étiquette de repli revenait avec l'inspecteur :
le banc ne la cherchait que fermé). **27 anciens bancs touchés**, en trois familles :
- **réécrits pour le nouveau geste** : `aspect_boutons_volet` (le volet est l'inspecteur, ouvert sur un accord ; référence sombre lue sur sa croix),
  `barre_haut` (le contenu sous la barre se mesure sur la colonne de la grille), `gabarit_boutons` (cinq entrées sortent de HORS_JAUGE : fondamentale,
  type, durée, « Ajouter », repli — plus à l'écran), `instrument_du_morceau` (nouvel accord par la saisie), `portes_sequenceur` (les deux portes,
  inspecteur ouvert), `rythme_duree` (plus de menu de durée « des prochains accords » sur ordinateur : chaque accord a sa durée dans sa bulle),
  `carte_accord_unique` (vérifie en plus la carte devenue inspecteur), `sidebar_collapse` et `sidebar_collapse_seq_height` (le repli n'existe plus ;
  ce qu'ils gardaient — la grille regagne sa place, le transport ne bouge pas, la hauteur automatique du séquenceur suit la largeur — est éprouvé à
  l'ouverture et à la fermeture de l'inspecteur) ;
- **joués sous le seuil (860px)**, parce qu'ils éprouvent une FONCTION de la carte en mode Ajout (même code), qui n'existe plus que là jusqu'au lot 10 :
  `manche_edition_lot4/5/6`, `rythme_une_preference`, `guitare_envoi_grille`, `glock_unlock_and_switch`, `extra_note_rhythm`, `filet_moteur_edition`,
  `avant_seq_short_note_body`, `avant_seq_snap_sticky`, `seq_short_note_body`, `seq_move_note`, `seq_handle_feedback`, `grid_beat_highlight`,
  `offbeat_dash`, `affordances`, `voicing_direct`, `seq_changement_morceau`, `carte_accord_unique` (sa partie carte). **DETTE pour le lot 10** : ces
  dix-neuf bancs seront à reprendre quand le téléphone perdra à son tour le mode Ajout.

**Balayage du lot 6c (04/11) : 221 verts, 5 rouges, 7 sans verdict (233 suites)** — exactement la ligne de base, plus la nouvelle suite ; aucun nouveau rouge (le premier balayage du lot en comptait 30, tous réécrits ou déplacés ci-dessus).

## Refonte de l'interface — lot 7a : l'ajout unique (2026-11-04)

Cahier des charges : « Ajouter : une seule saisie (syntaxe actuelle COMPLÈTE), accords de la tonalité, suggestions après l'accord précédent, « + » entre
deux cases au survol ».

**Choisir où l'on ajoute (ordinateur).** Chaque partie a son « + Accord » dans son en-tête ; au survol d'une case, un « + » se montre sur sa frontière
gauche (ajouter AVANT elle). L'un ou l'autre ouvre, sous la saisie, un panneau qui dit la destination (« Couplet, avant Dm7 (après Am7) » / « Couplet, à la
fin, après G7 ») et marque la case d'après. Il propose « Souvent après [accord précédent] » (trois suites habituelles selon son degré : V → I, vi, IV…) et les
sept accords de la tonalité avec leur degré, en triades ou « avec 7e ». Un clic ajoute là, d'UNE annulation, et la destination avance : deux clics = deux
accords dans l'ordre. La saisie (syntaxe inchangée, toute) va au même endroit, sans le « dans quelle partie ? ». Échap, × ou un clic à côté referment ET
oublient la destination : la saisie redevient exactement celle d'avant.

**Le « + » et la poignée gauche partagent la frontière.** Ils tombent au même endroit (le bord gauche se tire depuis le lot 5d, la maquette n'avait que le
droit). Appuyer-relâcher sans bouger ajoute ; appuyer puis glisser tire le bord, comme avant. Le « + » est à la jauge (32 px, arrondi 7 px).

**Téléphone : inchangé** (lot 10).

**Bancs.** Nouveau `ajout_unique_test` (29). **Sabotages : 7, tous rouges** (destination qui n'avance pas, saisie qui l'ignore, fermeture qui la garde,
pas d'annulation, « + » qui n'ouvre rien, suggestions = début de la palette, glissé depuis le « + » qui ne tire plus le bord — attrapé aussi par
`finitions_grille`). **Premier balayage : 3 nouveaux rouges, tous corrigés dans l'appli ou le banc** : `finitions_grille` (le « + » avalait le glissé de
la poignée gauche → les deux gestes cohabitent), `gabarit_boutons` (le « + » faisait 26 px → 32), `sortie_edition_involontaire` (« + Accord » d'une partie
sort de la modification : c'est une sortie LÉGITIME, comme `quick-add-btn` et `add-section` déjà déclarés ; le banc compare désormais ses exclusions à la clé
qu'il affiche, pour un bouton sans id).

**Balayage du lot 7a (04/11) : 222 verts, 5 rouges, 7 sans verdict (234 suites)** — exactement la ligne de base, plus la nouvelle suite.

## Refonte de l'interface — lot 7b : la barre de sélection, le clic droit, Tab (2026-11-04)

Cahier des charges : « Ctrl/Maj+clic = multiple (barre de sélection : copier, dupliquer, transposer, boucler, supprimer) ; double-clic = retaper le nom
(Tab = case suivante) ; clic droit = copier, coller, pipettes, insérer, dupliquer, supprimer ».

**La barre de sélection (ordinateur).** Ctrl+clic ajoute ou retire un accord du groupe ; Maj+clic prend toute la PLAGE depuis l'accord déjà choisi. Dès
deux accords, la bulle (qui ne parle que d'UN accord) s'efface et la barre apparaît en bas de la grille, centrée sur elle, juste au-dessus de la barre de
lecture : « N accords sélectionnés », Copier, Dupliquer, Transposer −/+, Boucler, Supprimer, ×. Aucun geste nouveau : Copier et Supprimer sont ceux de
Ctrl+C et Suppr ; Boucler pose la plage de la règle sur le groupe (un second appui la retire) ; Transposer et Dupliquer agissent sur ce groupe seul, d'UN
Ctrl+Z chacun. Cliquer dans la barre ne perd pas l'accord d'ancrage (Maj+clic et collage repartent de lui) ; × et Échap relâchent tout. Le message passager
(« accords dupliqués ») monte au-dessus de la barre au lieu de la couvrir.

**Clic droit.** Copier (le groupe entier si la case en fait partie), Coller après (seulement s'il y a quelque chose à coller), Insérer avant… et Insérer
après… — qui ouvrent le panneau d'ajout du lot 7a, destination déjà visée. Les pipettes, Dupliquer et Supprimer restent.

**Tab dans la retape du nom.** Tab valide la case et passe à la suivante (Maj+Tab : la précédente), d'une partie à l'autre : on retape une grille entière au
clavier. Au bout du morceau, rien ne se passe de plus.

**Téléphone : inchangé** (lot 10) — ni barre ni nouvelles lignes au menu.

**Bancs.** Nouveau `barre_selection_test` (49). **Sabotages : 9, tous rouges** (Maj+clic, transposer tout, barre jamais rafraîchie, Tab, insérer avant/après
confondus, clic dans la barre qui perd l'ancre, message sur la barre, barre au téléphone, dupliquer sans annulation). Le premier passage a montré deux défauts
réels, corrigés : cliquer dans la barre perdait l'accord d'ancrage, et le message passager couvrait la barre.

**Balayage du lot 7b (04/11) : 223 verts, 5 rouges, 7 sans verdict (235 suites)** — exactement la ligne de base, plus la nouvelle suite.

## Refonte de l'interface — lot 8 : Clavier / Guitare, tiroir épinglé ou fenêtre libre (2026-11-05)

Cahier des charges : « Clavier / Guitare : épinglés en bas par défaut, ou détachés en fenêtre libre (barre de titre qui déplace, coin qui redimensionne, punaise
pour réépingler). Construire un accord au clavier puis « Remplacer » ou « Ajouter ». Guitare : le manche actuel AU COMPLET (doigtés, verrouillage, édition,
dessin, envoi dans la grille). » (docs/refonte.md.)

**Ce qui est fait (ordinateur seulement ; le téléphone n'a pas bougé, lot 10).**
- **Bloc « Vues »** : quatrième bloc réordonnable de la barre de lecture. Il reçoit les deux boutons EXISTANTS (`#toggle-viz-piano`, `#toggle-viz-guitar`, mêmes
  adresses, 32 px), déplacés par `placerVues` comme `placeGlobalTransport` déplace le transport : un seul nœud, jamais dupliqué. Les 18 bancs qui cliquaient ces boutons
  n'ont donc pas eu à changer de geste.
- **Tiroir** (`#vues-tiroir`) : accueille la carte des diagrammes et le titre de l'accord (nœuds existants, déplacés). Épinglé : dans le flux, collé au-dessus de la
  barre de lecture (la grille cède la place, rien n'est recouvert). Détaché : fenêtre fixe de 12 px d'arrondi, barre de titre qui déplace, coin qui redimensionne, bornée
  à l'écran (jamais plus petite que 360×150, jamais sous la barre de lecture), punaise pour réépingler. Mode et géométrie mémorisés PAR APPAREIL
  (`harmohubVuesMode`, `harmohubVuesFenetre`), jamais synchronisés. « Fermer » éteint les deux instruments ; Clavier et Guitare restent indépendants (les deux côte à côte).
  Le clavier reste allumé par défaut (choix conservé : aucun changement de comportement pour qui n'y touche pas) — **à confirmer** : la maquette part tiroir fermé.
- **Construire un accord au clavier** : un clic sur une touche (20 px de large, 64 de haut dans le tiroir, 14 px au téléphone) la pose ou la retire et la fait sonner ;
  les touches tapées s'allument en bleu (la sélection est bleue) ; une bande donne les notes, le nom reconnu (même moteur que le manche : `analyzeDrawnMidis`, extrait de
  `analyzeGuitarDrawnChord`), les autres lectures en puces, puis **Remplacer <accord sélectionné>** (une seule étape d'annulation), **Ajouter en fin de partie**
  (partie de l'accord sélectionné) et **Effacer**. Rien n'est écrit avant l'un des deux boutons. Choisir un autre accord efface les notes tapées. Limite connue : la
  fenêtre du clavier suit l'accord affiché (2 à 3 octaves), on ne tape pas hors d'elle.
- **Guitare** : le manche, les doigtés, le cadenas, l'édition, le dessin et l'envoi dans la grille travaillent dans le tiroir (éprouvés à 1440 px par le nouveau banc).

**Pièges rencontrés.**
- La fermeture « au clic à côté » désélectionnait l'accord dès qu'on touchait une touche (le tiroir n'était dans aucune liste) : `#vues-tiroir` et `#bl-vues` entrent dans
  `ZONE_EDITION_SELECTEURS` et dans l'exemption de la désélection (comme la barre de sélection au lot 7b).
- La bulle « quel accord » se posait sur les touches : son plancher est maintenant le haut du tiroir épinglé, sinon celui de la barre de lecture.
- Le tiroir (z-index 31) recouvrait la fenêtre du tempo, qui s'ouvre vers le HAUT depuis la barre (30) : `rangee_reglages` a rougi, à raison. Tiroir épinglé à 29.
- Clic sur une touche pendant l'audition d'un accord : l'audition s'arrête (sinon elle repeint ses notes par-dessus celles qu'on pose).

**Bancs.** Nouveau `vues_tiroir_test` (95). **Sabotages : 12, tous rouges** (bornes de la fenêtre, touches bleues, zone d'édition, désélection au clic, annulation du
Remplacer, effacement au changement d'accord, arrêt de l'audition, plancher de la bulle, retour de la carte au téléphone, touches du téléphone, partie visée par Ajouter,
tiroir sous une vue) — dont deux d'abord VERTS (zone d'édition, tiroir sous une vue), d'où deux vérifications ajoutées ; un contrôle redondant (effacement dans
`refreshPreview`) retiré. **Bancs touchés** : `barre_lecture` (quatre blocs), `place_du_plus_et_diagrammes`, `seq_selection_et_cadre_diagrammes` (la bascule est dans la
barre, plus dans la carte), `seq_centrage_molette_diagrammes` (seuls les diagrammes de la carte sont à centrer), `volet_hauteur_poignee` (sans diagramme, plus de carte à
descendre : boutons dans la barre, colonne à ~20 px d'elle), `sidebar_collapse_seq_height` (la colonne borde le tiroir quand il est ouvert), `diagrammes_inspecteur` (piano
plafonné à 66 px au lieu de 52), `verre_test` (nouvel état « tiroir » : éteint identique, allumé lisible). `verre-surfaces.css` : le tiroir est une barre, sa version libre
une fenêtre.

**Balayage du lot 8 (05/11) : 222 verts, 7 rouges, 7 sans verdict (236 suites)** au premier relevé complet : les 5 rouges de la ligne de base, plus `verre_test` (deux vérifications
dépendantes du timing, attente ajoutée sur les commandes du manche) et `vues_integrees` (vrai défaut : la bulle, retournée vers le haut faute de place, recouvrait la barre du haut
et ses onglets — elle ne se retourne plus que si elle tient sous la barre du haut). Les deux revérifiés ensuite, seuls et sous charge (balayage ciblé de 80 suites : seuls les rouges
de la ligne de base restent). Le premier balayage complet avait été interrompu deux fois par la perte du serveur de test (un `nohup` est tué à la fin du tour) : voir `CLAUDE.md`.
**Balayage ciblé** (`tests/run_cible.sh`, décidé le 05/11) : à lancer pendant un lot ; le complet reste réservé à la fin du lot. Premier essai : 89 suites sur 236, une dizaine de minutes ;
la plus longue, `synchro_cloud`, fait 157 s. **À faire** : durées par suite dans le relevé de `run_all_fast.sh` (non modifié pendant qu'il tournait), puis raccourcir les plus lentes.


## Refonte de l'interface — lot 9a : l'éditeur de notes, ouvrir / fermer / étendre (2026-11-05)

Cahier des charges : « Ouvert par un bouton bleu libellé « Éditeur de notes » dans la rangée de réglages (pas parmi les instruments), fermé par « Fermer ».
Étendre ou non : réduit par défaut (~170 px de notes), bouton à chevrons, double-clic sur la poignée, ou poignée tirée. » Maquette : « la grille passe d'elle-même en
affichage Compact tant que l'éditeur de notes est ouvert ». (docs/refonte.md, maquette `project/Notes2.dc.html`.)

**Décisions de l'utilisateur (05/11).** Le Compact est **provisoire** (pas « modifié », pas enregistré, rendu à la fermeture ; un affichage choisi pendant ce temps est le
sien). L'icône de conduite de voix **reste** dans la rangée jusqu'au lot 9c (le panneau ne disparaît qu'une fois chaque fonction retrouvée dans le calque Voix).

**Ce qui est fait (ordinateur seulement ; le téléphone n'a pas bougé, lot 10).**
- **Le bouton** : c'est `#grid-zoom` lui-même (même nœud, même id, même `toggleSequencer('continu')` — une cinquantaine de bancs le cliquent), avec deux libellés :
  « Éditeur de notes » au-dessus de 900 px, « Séq. » en dessous. Bleu (famille `--btn-blue`), 32 px, 7 px, logo existant gardé ; ouvert, il reste bleu et s'enfonce.
  Titre et `aria-label` suivent l'écran (`majBoutonEditeurNotes`).
- **L'en-tête** `#editeur-notes-tete` (écrit dans `index.html`, entre la poignée et l'hôte du séquenceur : la barre du séquenceur est reconstruite à chaque rendu) :
  « Notes », **Fermer** (`#editeur-notes-fermer`), **chevrons** (`#editeur-notes-etendre`, écartés = étendre, rapprochés = réduire). Sans fond propre : c'est le volet,
  déjà dans `verre-surfaces.css`, qui porte la surface (aucune nouvelle surface à dépolir).
- **Hauteur** (`hauteurVoletSequenceur`) : réduit = règle + 170 px de notes + l'habillage (`EDITEUR_NOTES_REDUIT_PX`), étendu = toute la place que la poignée autorise,
  toujours plafonnée au contenu (pas de noir sous la dernière note). Réduit à CHAQUE ouverture. Le chevron et le double-clic sur la poignée basculent ; une hauteur tirée à la
  main compte comme « étendu » (maquette) et reste mémorisée comme avant ; le chevron la défait (retour au réduit, mémoire effacée).
- **Compact provisoire** (`entrerCompactProvisoire` / `sortirCompactProvisoire`) : à l'ouverture, l'affichage (densité, largeur, deux échelles) est mis de côté et la grille
  passe en Compact SANS `setZoomLevel` (qui marquerait modifié et écrirait la mémoire de l'appareil). `zoomSettingsForSong` et `memoriserAffichageGrille` donnent l'affichage
  mis de côté tant qu'il existe : Ctrl+S éditeur ouvert enregistre « Normal ». Un choix de l'utilisateur (Compact / Normal / Détaillé, poignées de la grille, échelles)
  l'efface (`abandonnerCompactProvisoire`) : son choix reste à la fermeture. Une grille déjà en Compact n'est pas touchée. Un autre morceau ouvert éditeur ouvert : son
  affichage devient celui à rendre, et le Compact repasse par-dessus. Fermeture par tous les chemins : Fermer, le bouton, la conduite de voix qui prend la place, le passage
  sous 900 px (`majEditeurNotes`, appelé par `toggleSequencer`, `toggleVoiceLeadingPanel`, `setupSequencerPlacement`).
- Corrigé au passage : ouvrir la conduite de voix pendant que le séquenceur continu était ouvert laissait `#grid-zoom` allumé.
- **Défaut du lot 8 trouvé par le balayage complet** (`verre_test`, 64/2, le même rouge qu'au relevé du lot 8, vert seul) : taper une touche du clavier PENDANT que
  l'accord sonne arrête l'audition (`stopAll`), et `stopAll` vide le manche (`clearGuitarViz`) en comptant sur une lecture suivante — qui ne vient pas : la guitare
  restait VIDE. Sous charge, l'audition lancée par le clic sur la case durait encore au moment où le banc tapait ses touches ; une des deux pages comparées n'avait
  donc pas de manche (561 éléments contre 596). Une attente plus longue n'y changeait rien (essayé, puis retiré). Corrigé : `redessinerMancheSelection` après ce
  `stopAll`. Vérification ajoutée à `vues_tiroir_test` (98), rouge au sabotage ; `verre_test` vert trois fois sous charge (trois bancs lourds en parallèle).

**Coût connu.** L'en-tête prend 39 px au volet : sur une fenêtre basse (1397×720), la hauteur automatique passe de 143 à 104 px de bande (80 px de notes). Le lot 9b
(barre d'outils en icônes, dans la même rangée que « Notes / Fermer », comme la maquette) rend cette place.

**Bancs.** Nouveau `editeur_notes_test` (45) ; `vues_tiroir_test` 96 → 98 (le manche après une touche tapée pendant l'audition). **Sabotages : 6, tous rouges** (pas de Compact provisoire, Compact enregistré, double-clic coupé, téléphone touché, bouton
pas bleu, pas de hauteur réduite). **Bancs réécrits pour le nouveau geste** : `portes_sequenceur` (libellé lu par `innerText` : « Éditeur de notes » à l'ordinateur,
« Séq. » vérifié au téléphone ; borne de largeur relevée à 150 px), `retouches_carte_accord` (à l'ordinateur le bouton est bleu, son voisin garde le fond sombre ; la paire
sombre d'avant vérifiée au téléphone), `probe_seq_adaptatif` (s'ouvre réduit ; la « vraie taille » et le « plus de hauteurs qu'un téléphone » se mesurent étendu),
`seq_glisser_molette_align_piano` (la barre cherchée pour le clic gauche doit être sous la règle collante ; la bande est recentrée sur une barre avant le clic — avec 80 px
de notes, le glissé l'avait sortie), `probe_suppression_pleinecran` (rouge AUSSI sur le commit d'avant, hors ligne de base : il cliquait `#toggle-sidebar`, masqué
depuis le lot 6c ; il vérifie maintenant que, sans bandeau de gauche, le volet prend toute la largeur ; et il choisit Normal avant Compact, la grille étant déjà en Compact
provisoire).

**Balayage du lot 9a (05/11).** Premier relevé complet : 224 verts, 6 rouges, 7 sans verdict (237 suites) : les 5 rouges de la ligne de base plus `verre_test` (le manche
vidé, ci-dessus, corrigé). Le relevé suivant a été perdu : le serveur de test, lancé en tâche de fond par une session précédente, a atteint sa durée limite en plein
balayage (toutes les suites de fin d'alphabet à « 0 PASS / 1 FAIL ») ; relancé avec la durée maximale. Dernier relevé complet : **224 verts, 6 rouges, 7 sans
verdict** : la ligne de base, `verre_test` vert, plus `glock_unlock_and_switch` (2/5), déjà noté intermittent (lots 4 et 5) et **pas une régression** : rejoué seul,
3 échecs sur 15 avec ce lot, 7 sur 12 sur le commit d'avant. Ce qu'il montre est un vrai défaut, ancien : après un aller-retour par un autre accord avec lecture
automatique, le doigté verrouillé est bien enregistré (`guitarLock` dans le morceau) mais l'édition le rouvre déverrouillé (`app.guitarLock` nul, durablement — pas
un délai). Point ouvert, hors de ce lot.


## Refonte de l'interface — lot 9b : la barre d'outils de l'éditeur de notes, en icônes (2026-11-05)

Cahier des charges : « Barre d'outils en icônes : sélection, crayon, gomme ; calage (grille + noire / croche / double) ; Voix ; Intensité ; Ajuster ; zoom ;
supprimer la note. Aucune ligne d'info sur la note, aucune phrase de résumé. » (docs/refonte.md.)

**Décisions de l'utilisateur (05/11).** Sélection (outil par défaut) garde EXACTEMENT les gestes d'avant ; Crayon ne fait que dessiner ; Gomme efface ce qu'elle touche.
**Pas de choix de calage** : la demande d'avant (« il faut que les notes s'accrochent à la double croche automatiquement ») prime sur la maquette. Les boutons d'avant
absents de la maquette (Lecture, Stop, note libre, pipette, « tout », loupe) **restent, en icônes**, dans la rangée. Voix arrive au 9c, avec le calque.

**Ce qui est fait (ordinateur, éditeur de notes seulement ; le petit séquenceur et le téléphone n'ont pas bougé).**
- **Une seule rangée** : « Notes », Fermer, les outils, la barre du séquenceur, Ajuster, chevrons. La barre est construite comme avant dans `#arp-sequencer` (et câblée
  là), puis DÉPLACÉE dans `#editeur-notes-barre` en fin de rendu ; elle est vidée en DÉBUT de rendu, sinon `getElementById` (ordre du document) attrapait les boutons
  périmés du rendu précédent. Les 39 px pris par l'en-tête au 9a reviennent aux notes (bande de 194 px au lieu de 155).
- **À la jauge** : chaque bouton de la rangée 32×32, arrondi 7 px (Lecture, Stop et les corbeilles étaient à 44 px / 8 px) ; le zoom devient deux boutons − / +. Les
  mots se taisent (« tout », « sélection ») ; chaque icône garde son infobulle et son `aria-label` (« Supprimer la note » n'en avait pas : ajouté). « Supprimer la note »
  n'apparaît que lorsqu'une note est choisie.
- **Outils** (`#editeur-notes-outils`, groupe segmenté, sélection en bleu ; icônes de la maquette, ces fonctions n'en avaient pas) : `outilSeq()` ne vaut que dans
  l'éditeur. Crayon : la case est traitée comme vide (`wasOn` faux), donc on dessine même en partant d'une note, et un tap ne « rattrape » pas une note voisine.
  Gomme (`commencerGommeSeq`) : efface la note touchée, puis toutes celles que le glissé traverse, UNE étape d'annulation par geste (posée à la première note effacée).
  `retirerNotesSeq` est partagé avec Suppr. L'outil repart sur Sélection à chaque chargement.
- **Ajuster** (`#editeur-notes-ajuster`) : les lignes se limitent aux notes jouées (accord et voisins) ± 2 demi-tons, au lieu du plancher / plafond toujours visibles.
  Éteint par défaut (« voir toutes les notes possibles » avait été demandé), mémorisé par appareil (`harmohubSeqAjuster`).

**Bancs.** Nouveau `editeur_notes_outils_test` (32). **Sabotages : 7, tous rouges** (barre non déplacée, gomme inopérante, une annulation par note, crayon qui déplace,
Ajuster ignoré, barre non vidée au début du rendu, « supprimer » toujours visible — ce dernier a révélé le nom manquant). **Bancs réécrits** : `pinned_seq_toolbar`
(la rangée se mesure dans le volet entier, en haut), `probe_seq_continu_daw` (rangée en haut du volet, au-dessus des notes ; boutons visibles mesurés sur Lecture),
`probe_deux_boutons_seq` (« en gros » : au moins 190 px, la barre n'est plus dans l'hôte mesuré).

**Balayage du lot 9b (05/11) : 225 verts, 6 rouges, 7 sans verdict (238 suites)** — la ligne de base, plus `glock_unlock_and_switch` (2/5), l'intermittent ancien
décrit au lot 9a (rouge aussi sur le commit d'avant le 9a). Aucune régression.


## Refonte de l'interface — lot 9c : le calque Voix de l'éditeur de notes (2026-11-05)

Cahier des charges : « Calque Voix = l'ancienne conduite de voix : fonction 1/3/5/7 écrite dans la note (la couleur n'est plus seule), trait blanc du chemin des
voix. Chaque fonction de l'ancien panneau (règles de voix, loupe, pincement) est vérifiée une à une AVANT de fondre. » (docs/refonte.md, maquette
`project/Notes2.dc.html`.)

**Décisions de l'utilisateur (05/11).** Calque **éteint au premier usage, puis mémorisé par appareil** (comme Ajuster). Le **nom et le degré** de chaque accord
reviennent **dans la règle, calque allumé seulement**. Allumer Voix **sans accord choisi ouvre le premier accord** de la partie active (on voit aussitôt toute la
partie). L'icône ⊱ **quitte l'ordinateur à la fin du 9c** ; le téléphone la garde jusqu'au lot 10.

**Inventaire, avant de fondre : chaque fonction de l'ancien panneau, où elle va, quel banc la tient.**

| Fonction de l'ancien panneau | Dans le calque Voix (ordinateur) | Banc |
|---|---|---|
| Un seul bouton global, état allumé | Bouton **Voix** de la rangée de l'éditeur, **même logo** (repris de `#toggle-voice-leading`), 32 px / 7 px, `aria-pressed` | `calque_voix` A, `voice_leading` B |
| Fermé par défaut | Éteint au premier usage, puis mémorisé (`harmohubSeqVoix`) | `calque_voix` A, H |
| Désactivé sur une partie d'un seul accord | Disponible : les fonctions s'écrivent, aucun trait (rien à enchaîner) | `voice_leading` B |
| Toute la partie active, sans rien choisir | Voix sans accord choisi → premier accord de la partie (décision du 05/11) | `calque_voix` B |
| Couleur par rôle | Inchangée (`.seq-note.role-*`) | `voice_leading` B |
| Nom de la note écrit dans la barre | Remplacé par la **fonction** écrite dans la note (cahier des charges) ; le nom reste à la gouttière (do écrit, nom allumé au choix d'une note) | `calque_voix` C |
| Légende 1 / 3 / 5 / 7 / Autres | La même (`.piano-legend`), dans la place libre de la rangée, calque allumé | `calque_voix` B |
| Symbole + degré au-dessus de chaque accord | Bande des accords dans la règle, au-dessus des mesures | `calque_voix` E |
| Traits : voix de même rang, plein = tenue, pointillés = mouvement | Les mêmes, en blanc, sur la frontière entre deux accords | `calque_voix` D |
| Touches à part, fixes, ivoire et noir | La gouttière collante du séquenceur | `voice_leading` B |
| Zoom horizontal (boutons, Ctrl+molette) | Le zoom de l'éditeur ; les traits, placés par la grille, suivent | `calque_voix` F, `voice_leading` B |
| Zoom vertical | **Non repris tel quel** : la hauteur des lignes est bloquée à la demande de l'utilisateur (« laisser une unique hauteur de barres ») ; Étendre et Ajuster montrent plus ou moins de hauteurs | `voice_leading` B |
| Pincement (transform de secours pendant le geste) | Le pincement de l'éditeur : plus besoin de secours, les traits suivent la variable de largeur sans rendu | `vl_pinch` B |
| Suit une édition (renversement) | Le calque est redessiné avec le séquenceur | `calque_voix` G, `voice_leading` B |
| Suit la partie active ; opérations de partie sans panneau fantôme | Idem ; une opération de partie termine l'édition (déjà vrai avant), l'éditeur montre alors l'accord seul | `voice_leading_section_ops` B |
| Exclusion avec le séquenceur (« je ne peux pas l'enlever ») | Plus d'exclusion : le calque vit DANS l'éditeur, son bouton n'est jamais recouvert, rien n'en reste à la fermeture | `vl_loupe` B, `filet_sequenceur_et_sortie` C |
| Pas d'id en double | Idem | `calque_voix` H, `voice_leading` B |
| « Règles de voix » (`new_voice_rule`) | Règle du séquenceur (la 7e ajoutée copie le motif commun) : indépendante du panneau, inchangée | `new_voice_rule`, inchangé |

**Ce qui est fait (ordinateur seulement ; le téléphone n'a pas bougé, lot 10).**
- **Le bouton** `#editeur-notes-voix` (écrit dans `index.html`) et la **légende** `#editeur-notes-legende` : Voix se range avec les commandes d'affichage (maquette :
  Voix, zoom, Ajuster, chevrons) et prend lui-même la marge automatique qui poussait le zoom à droite — sinon la légende, en apparaissant, le ferait sauter sous le
  pointeur. La légende a une base nulle et grandit dans la place libre : elle ne fait jamais passer la rangée sur deux lignes (elle se rogne plutôt que de prendre
  38 px aux notes).
- **La fonction dans la note** : `Chord.getFonctionsVoix()` (ordre des voix du séquenceur) — 1, 3, 5, 7, et pour les couleurs « Autres » leur **vrai degré** (2, 4, 6,
  9, 11, 13, avec ♭ / ♯ si altéré) plutôt qu'un point : la même teinte violette couvre une 9e et une sixte, le chiffre les distingue. « · » pour une note étrangère.
  Écrite aussi dans les notes des accords voisins.
- **Le chemin des voix** (`calqueVoixHtml`) : même appariement que l'ancien panneau (rang après tri du grave à l'aigu, jusqu'au plus petit nombre de voix). Trait
  PLEIN (un pont qui enjambe la frontière) pour une note commune tenue, POINTILLÉS (vertical, du milieu d'une ligne au milieu de l'autre) pour un mouvement. Tout est
  placé par la grille CSS, comme les notes : le zoom horizontal, qui ne change qu'une variable de largeur de colonne, emporte les traits sans rendu (mesuré : aucun
  `renderSequencer` pendant un pincement). `pointer-events: none` : la case dessous garde ses gestes.
- **La bande des accords** : nom et degré dans une bande de 14 px au-dessus des numéros de mesure (`--seq-ruler-h` passe à 38 px, mesures et graduations descendent
  et restent collées). `hauteurRegleSeq()` la compte dans la hauteur du volet : le « réduit » garde ses 170 px de notes (bande 194 → 208 px).
- **L'icône ⊱** est masquée au-dessus de 900 px ; un ancien panneau ouvert au téléphone se referme si la fenêtre passe au-dessus du seuil (il n'aurait plus de bouton).
- Aucune nouvelle surface : la légende et la bande n'ont pas de fond propre (le volet et la règle, déjà dépolis, les portent).

**Constaté, pas changé (déjà vrai sur le commit d'avant, vérifié sur une copie de `649dd77`)** : éditeur ouvert, un clic sur une AUTRE case de la grille la
sélectionne mais l'éditeur garde l'accord d'avant (on change d'accord par la zone de l'accord voisin, dans l'éditeur) ; une opération sur les parties (monter,
dupliquer, supprimer) termine l'édition de l'accord, l'éditeur montre alors l'accord seul. Notés en points ouverts dans `CLAUDE-HARMOHUB.md`.

**Bancs.** Nouveau `calque_voix_test` (46). **Sabotages : 10, tous rouges** (calque jamais actif, appariement inversé, règle sans la bande, icône ⊱ visible, pas de
premier accord, non mémorisé, couleurs en point, traits cliquables, trait décalé d'une colonne, ancien panneau orphelin à l'élargissement). **Bancs réécrits pour le
nouveau geste**, chacun gardant ses vérifications d'origine au téléphone (860 px) et rejouant chaque fonction à l'ordinateur sous sa nouvelle forme :
`voice_leading` (35), `vl_loupe` (24), `vl_pinch` (15), `voice_leading_section_ops` (19) — passés au harnais (`plan`) ; `editeur_notes` (H : Voix allume le calque
DANS l'éditeur, qui reste ouvert, grille en Compact), `filet_sequenceur_et_sortie` (C : ni ancien panneau ni calque sur le petit séquenceur, calque allumé),
`retouches_carte_accord` (à l'ordinateur, Voix garde la matière de l'ancien voisin de « Éditeur de notes »). `meta_suite` : la dette a baissé de 5, référence figée
(`--maj`).

**Balayage du lot 9c (05/11) : 226 verts, 6 rouges, 7 sans verdict (239 suites)** — les 5 rouges de la ligne de base, plus `entete_grille_debordement`, que le
balayage ciblé n'avait pas choisi (il ne cite pas l'icône ⊱) : il attendait au moins trois commandes visibles dans la barre de la grille à l'ordinateur, dont la
conduite de voix. **Réécrit pour le nouveau geste** : deux commandes, nommées (l'affichage `#grille-densites` et l'Éditeur de notes `#grid-zoom`), le téléphone
garde ses quatre ; 15/15, rouge au sabotage (Éditeur de notes masqué). Les 7 « sans verdict » sont ceux de la ligne de base ; `glock_unlock_and_switch` vert cette
fois. Après la réécriture, balayage ciblé de confirmation sur ce qui avait bougé depuis le relevé complet (ce banc, un commentaire de `script.js`) : 54 suites,
48 vertes (dont `entete_grille_debordement`, `calque_voix`, les sept bancs réécrits, `gabarit_boutons`, `verre`, `sentinelle_adresses`, `meta_suite`), les 5 rouges de
la ligne de base et `smoke` sans verdict. **Aucune régression.**


## Refonte de l'interface — lot 9d : notes manuelles et bande d'intensité (2026-11-05)

Cahier des charges : « Notes ajoutées à la main en pointillés + pastille ambre sur la case + « Revenir à l'automatique » dans l'inspecteur. Bande
d'intensité (le « mode studio » actuel) sous les notes. » (docs/refonte.md, maquette `project/Notes2.dc.html`.)

**Constaté avant de coder (sondes sur le commit d'avant).** Une note posée à la main dans l'éditeur avait l'aspect d'une note de l'accord ; la pastille ambre de
la case n'apparaissait qu'au rendu suivant de la grille (les gestes du séquenceur commitent sans redessiner la grille) ; la rangée du mode studio suivait la
dernière hauteur, 400 px sous la partie visible du volet réduit ; son bouton restait parmi les boutons du motif et s'allumait en vert. Trois défauts d'annulation
et d'enregistrement, mesurés : « Revenir à l'automatique » puis Ctrl+Z ne rendait pas la note (Ctrl+Z tombait sur le dernier geste du séquenceur) ; un glissé
sur une barre d'intensité n'avait aucune étape d'annulation ; et il n'était écrit dans le morceau qu'au rendu suivant — Ctrl+S juste après enregistrait la
valeur d'avant (`{}` au lieu de la valeur réglée).

**Décisions de l'utilisateur (05/11).** Les barres des accords **voisins** s'affichent, **pâles et non modifiables** (comme leurs notes) ; une croche dont
l'intensité est **réglée à la main passe en ambre** (le double-clic la rend à l'accord, et au bleu) ; les **pointillés valent partout à l'ordinateur** (éditeur,
petit séquenceur de l'inspecteur, accords voisins).

**Ce qui est fait (ordinateur ; le téléphone n'a pas bougé, lot 10).**
- **Notes manuelles** : classe `manuelle` sur les barres des voix libres (`extraNotes`), de l'accord en cours comme des voisins (`seq-ctx-note`) ; à
  l'ordinateur, liseré en pointillés et fond à 8 % de la teinte du rôle (maquette), la sélection garde son liseré blanc et son halo.
- **Pastille ambre en direct** : `commitLiveEdit` compare la raison « voicing personnalisé » avant / après et, si elle change sans rendu de la grille, reprend la
  seule pastille de la case en place (`majPastilleVoicing`) — redessiner la grille au milieu d'un geste reconstruirait des cases sous le pointeur.
- **« Revenir à l'automatique »** (inspecteur, lot 6c, visible éditeur ouvert) a son propre instantané dans l'historique du séquenceur, doigté compris
  (`pushSeqUndo(true)` ; l'instantané ne garde le doigté que pour ce geste, les autres annulations du séquenceur n'y touchent pas) — mais SEULEMENT quand la
  dernière action notée est un geste du séquenceur : Ctrl+Z rend alors la note et la pastille, Ctrl+Y les reprend. Sinon (réglages faits dans l'inspecteur
  seul), la dernière action est l'instantané de la session et Ctrl+Z défait déjà tout d'un coup, accord refermé compris : la première version, qui empilait
  toujours, a fait rougir `inspecteur_son` au balayage ciblé (fermer l'inspecteur puis Ctrl+Z tombait sur la pile du séquenceur d'un accord refermé, et ne
  rendait plus rien).
- **Le bouton Intensité** : `#toggle-studio-mode` lui-même (même id, même logo), construit dans le groupe d'affichage quand l'éditeur est ouvert — juste après
  Voix, comme la maquette (« Voix, Intensité, zoom, Ajuster ») ; `aria-label` « Intensité », `aria-pressed`, allumé en bleu comme Voix et Ajuster. Ailleurs il
  garde sa place parmi le motif et son nom « Mode studio ».
- **La bande** (`.seq-grid-intensite`) : la rangée du mode studio devient une bande collée en BAS de la vue, comme la règle l'est en haut — fond plein
  (`.seq-vel-band`), « Int. » dans la gouttière, barres de 32 px dans 40. Sa hauteur (`SEQ_BANDE_INTENSITE_PX`) s'ajoute au volet : les 170 px de notes du
  réduit restent 170 px (`hauteurBandeIntensite`, comptée dans `hauteurVoletSequenceur`). Elle prend les clics qui tombent entre deux barres (sinon ils
  dessineraient une note dans la case cachée dessous). Décalée de −2 px : la vue défilante a 2 px de marge intérieure en bas, où `sticky` s'arrête, et 2 px de
  notes passaient dessous.
- **Les voisins** (`.seq-vel-ctx`) : une barre par croche d'attaque, à la valeur qu'ils jouent (réglage propre, sinon leur intensité), pâles (opacité 0,5),
  sans clic ; jamais la classe `.seq-vel-bar` (celle qui se règle).
- **Les marques** : `.reglee` (croche réglée à la main) = ambre de la pastille (`#e0b36a`, en dégradé) ; posée pendant le glissé, pas au rendu suivant ;
  `.choisie` = la barre de la note choisie, cerclée de blanc comme la note.
- **Le geste sur une barre** : une étape d'annulation par geste (`pushSeqUndo` au premier appui ; le second appui d'un double-clic, sur la même barre moins
  d'une demi-seconde après le relâchement, n'empile rien) ; l'intensité par croche entre dans l'instantané du séquenceur ; écrit dans le morceau dès le
  relâchement (`commitLiveEdit(false)`, sans rendu : un rendu remplacerait la barre entre les deux appuis d'un double-clic). Ces deux corrections valent
  partout, téléphone compris : ce sont une perte de données et une annulation manquante, pas une mise en page.
- **Verre dépoli** : la bande et son étiquette sont opaques verre allumé (`verre-surfaces.css`, fond des listes `--glass-select`), comme les titres collants des
  Paramètres : `--card-bg` est translucide verre allumé, et les notes qui défilent dessous auraient traversé les barres. Contrôle ajouté à `verre_test` (66 → 67).

**Bancs.** Nouveau `notes_manuelles_intensite_test` (57) : la porte (logo repris, après Voix, jauge, bleu), la bande collée en haut comme en bas du défilement,
+40 px sans rien prendre aux notes, « Int. », voisins pâles sans clic et à leur vraie valeur, l'ambre, la barre visible sans défiler, le glissé (ambre pendant le
geste, écrit au relâchement, Ctrl+S, une annulation, Ctrl+Z / Ctrl+Y, vrai double-clic = une annulation), un clic sur la bande ne dessine rien, la barre de la
note choisie, la note posée à la main (pointillés, 8 %, pastille aussitôt, infobulle, écrite, voisin en pointillés), « Revenir à l'automatique » éditeur ouvert
(Ctrl+Z / Ctrl+Y), la gomme (pastille éteinte en direct), le petit séquenceur (pointillés, rangée d'avant), mémorisé, pas d'id en double, téléphone inchangé.
`verre_test` 66 → 67 (la bande opaque verre allumé).
**Sabotages : 17, tous rouges** (pas de classe `manuelle`, pas de pointillés, pastille pas en direct, « Revenir » sans annulation, bande non collée, bande non
comptée dans la hauteur, pas de voisins avant, pas de voisins après, pas écrit au relâchement, glissé sans annulation, double-clic = deux annulations, pas
d'ambre, bande transparente aux clics, bouton resté dans le motif, pointillés au téléphone, note choisie sans repère ; bande translucide verre allumé →
`verre_test`). Deux sont d'abord restés VERTS et ont fait compléter le banc : les voisins d'avant (le banc n'ouvrait que le premier accord, qui n'en a pas :
il passe maintenant par G7, au milieu) et les pointillés au téléphone (ouvert sans accord choisi, il n'y avait aucune note manuelle à l'écran, et « toutes en
trait plein » était vrai sur une liste vide : il ouvre maintenant le premier accord et EXIGE la note du voisin à l'écran). Banc 57 → 59.

**Balayage ciblé (05/11)** : 55 suites (avec `editeur_notes`, `pinned_seq_toolbar`, `probe_seq_continu_daw`, `entete_grille_debordement` ajoutés à la main) —
premier passage, `inspecteur_son` rouge (ci-dessus, corrigé) ; second passage, 51 verts, les 3 rouges de la ligne de base qu'il a choisis
(`probe_regle_voisins`, `probe_seq_finitions`, `seq_notes_libres_clavier`) et `smoke` sans verdict.

**Constaté, pas changé (déjà vrai avant le lot, vérifié sur le commit d'avant)** : l'éditeur s'ouvre au-dessus des notes d'un accord grave (`scrollTop` 0,
notes 416 px plus bas qu'une vue de 194 px) — point ouvert du 9c, plus visible avec la bande allumée ; verre allumé, la bande de la RÈGLE (`.seq-ruler-band`)
est à 5,5 % d'opacité (`--card-bg`), les notes qui défilent dessous se devinent. Notés dans `CLAUDE-HARMOHUB.md`.

**Balayage du lot 9d (05/11) : 227 verts, 6 rouges, 7 sans verdict (240 suites)** — les 5 rouges de la ligne de base, plus `glock_unlock_and_switch`
(3/4), l'intermittent ancien décrit au lot 9a : rejoué six fois de chaque côté, 2 rouges sur 6 avec ce lot, 3 sur 6 sur le commit d'avant. Les 7 « sans
verdict » sont ceux de la ligne de base. **Aucune régression.** Le lot 9 (éditeur de notes) est livré ; reste le téléphone (lot 10).

## Refonte de l'interface — lot 10a : la barre du haut et les onglets au téléphone (2026-11-05)

**Découpage du lot 10** (fait en début de session, d'après la page « Téléphone (v2) » de la maquette) : 10a barre du haut et onglets ; 10b barre de lecture
(et vues Structure / Paroles intégrées au-dessus d'elle) ; 10c réglages du morceau et Affichage ; 10d panneau d'accord ; 10e panneau d'ajout (les 19 bancs
à 860 px) ; 10f éditeur de notes (fin de l'icône ⊱). Détail dans `CLAUDE-HARMOHUB.md`. L'ordre suit les dépendances : les vues intégrées masquent `main`, où vit
encore le transport du téléphone (`#footer-dock`) — elles attendent donc la barre de lecture.

**Ce qui change (téléphone, < 900 px).**
- **La barre du haut est celle de l'ordinateur**, mêmes nœuds, en 44 px, sur deux rangées (`.top-bar` en grille de six colonnes, `.tb-gauche` / `.tb-droite`
  en `display: contents`) : logo à gauche, titre (menu du morceau), voyant (son point seul), Enregistrer (icône seule), Paramètres, compte ; rangée 2 : les
  onglets, Annuler sous Paramètres, Rétablir sous le compte. **Décision du 05/11** (question posée) : la maquette n'a ni Rétablir ni Paramètres ; tout sur la
  1re rangée laissait ~75 px au titre (« Ba… »). Le titre garde ~175 px à 390 px ; chevron masqué et corps à 14 px pour que « Ballade en Do mineur » y tienne
  en entier (exigence de `mobile_grille_plus_haut`).
- **Le compte, carré** : la pilule de `compte-cloud.js` (fichier commun, pas touché) habillée par `#compte-cloud .cc-pilule` (44 × 44, 7 px).
- **Les onglets** (`#tb-onglets`) : groupe segmenté de 44 px, segments de 38, trois parts égales ; allumé = texte vert + liseré. `setupOnglets` laisse
  `#structure-btn` / `#lyrics-btn` dans le groupe à toutes les largeurs (avant : redescendus à côté de Fichier). Sous 400 px le mot seul (comme la maquette),
  sous 350 px un corps de 12 px. La fenêtre Structure s'ouvre SOUS la barre (`--haut-barre` : 111 px au téléphone) ; elle reste une fenêtre (croix, fond) et
  Paroles ouvre encore sa page, jusqu'au 10b.
- **La carte Morceau perd son en-tête** (liste, six icônes) : tout est dans le menu du titre, dont les lignes passent à 44 px et qui défile s'il dépasse
  l'écran. Les règles du titre, d'Enregistrer, du voyant et du menu sont sorties de la media query ordinateur (`@media all`) plutôt que recopiées.
- **Verre dépoli** : le groupe d'onglets est un creux (`--glass-inp`) verre allumé, téléphone seulement (`verre-surfaces.css`).

**Bancs.** Nouveau `telephone_barre_haut_test` (31) : jauge (six commandes à 44 px / 7 px, compte carré, groupe de 44 et segments de 38, parts égales), les
deux rangées et l'ordre, le titre ≥ 160 px, rien sous la barre, pas de débordement, rien en double ; menu du titre dans l'écran, lignes à 44 px, ouvre un autre
morceau, renommer (champ à 44 px, Entrée) ; un accord ajouté allume le voyant, Enregistrer l'éteint, Annuler / Rétablir de la 2e rangée, Paramètres ; Structure
sous la barre, Grille atteignable et qui la referme, liseré sans aplat ; verre (creux translucide, aucun contraste perdu) ; 360 et 320 px ; ordinateur inchangé.
**Réécrits pour le nouveau geste** (ils vérifiaient que le téléphone n'avait pas bougé) : `barre_haut` (H : la barre à 44 px, renommer dans le titre),
`onglets` (B : à 600 px les boutons restent dans les onglets ; E : groupe de 44 px, Structure sous la barre, Grille la referme), `filet_toujours_visible`
(le téléphone éprouve le titre, Enregistrer et les trois entrées du menu, comme l'ordinateur), `historique_versions` (H : `#tb-save`),
`mobile_grille_plus_haut` (la carte « intacte » du retour d'août → le nom en entier dans le titre, Enregistrer sur sa ligne ; 11 → 12).
`synchro_cloud` (partie 13, téléphone : « se connecter ne bouge rien dans la carte Morceau » et « ne chevauche pas le logo », écrits quand le logo était à droite
du compte → rien ne bouge dans la barre du haut, compte carré de 44 px, sans chevaucher Paramètres ni le bord ; trouvé par le balayage complet).
**Sabotages : 6, tous rouges** (grille dissoute, menu à 32 px, onglets redescendus, page sous la barre, verre oublié, Structure plein écran). Le dernier est
d'abord resté vert : le sabotage avait frappé la règle `#structure-overlay` de l'ordinateur, au texte identique ; rejoué sur celle du téléphone, rouge.

**Balayage ciblé (05/11)** : 49 suites (le diff, plus `telephone`, `filet`, `onglets`, `mobile_`, `slider_`, `export_lyrics`, `paroles_autoload`,
`sentinelle_atteignabilite`, `vues_tiroir`, `synchro_reglages`, `midi_import`, `grid_loupe`, `rythme_cases` ajoutés à la main) : 46 verts ;
`seq_notes_libres_clavier` (ligne de base) rouge, `smoke` sans verdict (ligne de base) ; `verre` rouge une fois sur un écart de toast (`#toast` affiché pendant
la capture « tiroir », quatre navigateurs en parallèle), vert 67/67 rejoué seul.

**Balayage du lot 10a (05/11) : 227 verts, 7 rouges, 7 sans verdict (241 suites)** — les 5 rouges de la ligne de base, plus `synchro_cloud` (réécrit, ci-dessus :
vert 126/126 rejoué) et `verre` (66/67, l'écart de toast de l'état « tiroir »). **`verre` : défaut ancien, sensible à la charge, pas une régression** — six
passages en série, verts des deux côtés (lot 10a et commit d'avant `f512e55`) ; quatre passages simultanés de chaque côté, rouges 4 sur 4 des deux côtés, même
écart (`#588 div#toast.toast`). L'état « tiroir » (ordinateur, clavier détaché, accord construit touche par touche) fait paraître un toast dont la durée
d'affichage dépasse ou non la capture selon la charge. À traiter hors lot (attendre la fin du toast dans l'état, ou passer `verre` dans la liste SENSITIVE de
`run_all_fast.sh`). Les 7 « sans verdict » sont ceux de la ligne de base. **Aucune régression.**


## Hors lot : `verre_test` rougissait sous charge, l'écart du toast de l'état « tiroir » (2026-11-05)

**Cause.** Les échantillons du piano sont coupés exprès (`_verre_commun.js` bloque `tonejs.github.io`) : la première note jouée — la case touchée au début de
l'état « tiroir » — fait paraître « Sons du piano pas encore chargés (réseau) — son de secours en attendant » (`warnIfFallbackInstrument`, une fois par session,
4,2 s). Les deux pages comparées (sans verre.css / verre.css éteint) sont menées L'UNE APRÈS L'AUTRE, puis relevées : seule, la seconde finit avant que le toast
de la première s'éteigne ; quatre navigateurs en parallèle, non, et le relevé comparait un toast éteint (opacité 0) à un toast allumé (opacité 1). Ce n'était
pas un défaut de l'appli : un défaut de minutage du banc, sur toutes les versions qui ont l'état « tiroir » (lot 8 et après).

**Remède (le banc seul, aucun fichier servi ne change).** `toastEteint(page)` attend, sur chaque page, que le toast soit éteint (classe `show` retirée,
opacité calculée 0) avant chaque relevé des sections 2 (éteint = avant) et 4 (lisibilité). Le toast reste dans la page : ses couleurs, son ombre, son flou
restent comparés, seule l'opacité est figée. Sa LISIBILITÉ verre allumé, que le banc ne mesurait qu'à la faveur de ce hasard de minutage (en série, toast
allumé sur les deux pages au moment du relevé), a désormais son contrôle propre : vrai geste (clic droit sur une case, « Copier l'accord »), mesure pendant
qu'il est affiché, relu allumé après la mesure (trois essais si la charge l'éteint entre-temps). `verre_test` 67 → 68. Écarté : passer `verre` dans la
liste SENSITIVE de `run_all_fast.sh` (70 s de plus en série, et le minutage serait resté faux, seulement moins souvent visible).

**Épreuves.** Seul : 68/68 (74 s, contre 70 s avant : l'attente du toast coûte environ 4 s par section). Quatre passages simultanés : **4 verts sur 4** ;
l'ancienne version, dans la même charge juste après : **4 rouges sur 4**, même écart (`#588 div#toast.toast`). **Sabotages : 2, tous rouges** — une règle qui
fuit hors du verre sur le toast (`html[data-glass="1"] .sabotage-rien, .toast { box-shadow: none }`, que le contrôle statique laisse passer) : rouge aux états
« tiroir » et « apercu », preuve que l'attente ne masque pas la comparaison du toast ; un toast illisible verre allumé (texte à 12 % d'opacité) : le nouveau
contrôle rougit (rapport 1,34). `sentinelle_adresses` 244/244 et `meta_suite` 6/6 verts.

## Refonte de l'interface — lot 10b : la barre de lecture du téléphone, Structure et Paroles intégrées (2026-11-05)

**Ce qui change (téléphone, < 900 px).**
- **La barre de lecture est celle de l'ordinateur** (`#barre-lecture`), fixée en bas, en 68 px comme la maquette : Lecture, Stop, « Mes. N » au-dessus
  de la frise des parties (réduite à une bande de 8 px : partie en cours en vert, plage à boucler en orange, tête de lecture), Boucle, « ⋯ ». Le
  transport y entre aux deux largeurs (`placeGlobalTransport`) et **quitte `#footer-dock`**. Les boutons ne sont pas réordonnés dans le DOM : le bloc
  Lecture et `.transport` s'effacent (`display: contents`) et chaque bouton prend sa place par `order` (la Boucle après la frise). Les blocs Tempo et
  Vues, « réorganiser » et ses flèches sont masqués. Le bouton Boucle existe désormais au téléphone : le triangle de Lecture y reste un triangle
  (l'anneau était l'état « boucle » d'un téléphone sans bouton Boucle) ; l'appui long reste.
- **« ⋯ » ouvre le panneau Lecture** (`#panneau-lecture`, `setupPanneauLecture`), qui monte du bas et se pose sur la barre : Tempo (la rangée −/valeur/+
  et Tap de la fenêtre du tempo d'ordinateur, `#bl-tempo-ligne`, **déplacée** par `placerPanneauLecture`, comme `placerVues`), Métronome (`#bl-metro`
  déplacé, avec le mot « Activé » / « Coupé » de la maquette, masqué à l'ordinateur), Voir : Clavier / Guitare / Notes. **Décision prise en séance** :
  ces trois-là PILOTENT les boutons d'origine (`#toggle-viz-piano`, `#toggle-viz-guitar`, `#grid-zoom`) sur le modèle de `#bl-metro` (lot 2), logo
  recopié de l'original, état en miroir ; ouvrir un diagramme ou l'éditeur le fait venir à l'écran (`scrollIntoView`, marges de la barre). Déplacer les
  bascules elles-mêmes aurait cassé une douzaine de bancs du manche joués à 860 px pour un plein écran qui n'est pas encore là (aide de la maquette :
  « s'ouvrent en plein écran au-dessus de la barre ») — reste à faire, avec le lot 10f. Le panneau est dans `this._popups` (Échap, clic à côté) et dans
  `ZONE_EDITION_SELECTEURS` (le toucher n'y sort pas de la Modification). Tout à 44 px.
- **Le dock** (`#footer-dock`) ne porte plus que les accès de secours de la Modification (Rythme, Terminer), sur une rangée de 45 px calée à droite et
  posée SUR la barre ; il s'efface quand il est vide (`:has`). Le tiroir du petit séquenceur mesure désormais le haut de ce qui occupe le bas de
  l'écran (dock ou barre) : mesurer le seul dock le posait sur les accès de secours (trouvé par `barre_bas_telephone`). **Dette connue jusqu'au 10d** :
  en Modification, le bas de l'écran prend 45 + 68 px (73 avant le lot) ; en Ajout, 68 (73 avant).
- **Structure et Paroles sont des vues intégrées** à toutes les largeurs (`vuesIntegrees()` vrai partout) : entre la barre du haut et la barre de
  lecture, grille masquée derrière, fond transparent ; Structure perd sa croix et son titre (l'onglet le dit, Grille ramène, Échap referme), le clic sur
  son fond ne la ferme plus ; Paroles charge `paroles.html?integre=1` dans la page. Le panneau Lecture passe au-dessus des vues (z 40 contre 35).
  **À confirmer avec l'utilisateur** : le geste « fichier .json téléchargé + Paroles dans un nouvel onglet » n'existe plus à aucune largeur (il était
  resté au téléphone depuis le lot 4b) ; le fichier reste produit par l'export intégral (menu Fichier). La page Paroles seule s'ouvre par son adresse.
- **Verre dépoli** : le panneau Lecture est une surface flottante (fond des menus, flou), téléphone seulement (`verre-surfaces.css`) ; la barre l'était déjà.

**Bancs.** Nouveau `telephone_barre_lecture_test` (48) : barre fixée en bas, 68 px, ordre de la maquette, carrés de 44 px à 7 px, frise en bande, rien du
bureau, transport hors du dock, fin de page au-dessus de la barre ; Lecture joue et avance « Mes. N » et la tête, Stop, Boucle ; panneau posé sur la barre,
nœuds déplacés et non copiés, 44 px partout, tempo −/+ et une annulation par geste, Tap, métronome et son mot, logos repris, Guitare et Notes qui ouvrent et
amènent à l'écran, quatre façons de refermer ; Modification par double toucher, accès de secours sur la barre et atteignables ; Structure et Paroles entre
les deux barres, barre jouable dessous, fond qui ne ferme pas, accords dans le cadre sans onglet, panneau au-dessus de la vue ; verre (flou 24 px,
sous-couche, aucun contraste perdu) ; 320 px ; ordinateur inchangé et seuil franchi dans les deux sens.
**Sabotages : 8, tous rouges** (barre non fixée, transport resté au dock, tempo non déplacé, diagramme ouvert hors de vue, vues non intégrées, panneau
sous les vues, verre du panneau oublié, dock sous la barre).
**Réécrits pour le nouveau geste** (ils vérifiaient que le téléphone n'avait pas bougé, ou cliquaient un élément disparu) : `vues_integrees` (F : Paroles
en vue intégrée au téléphone, sans onglet), `onglets` (E : Structure sans croix, Échap la referme), `barre_lecture` (H : le logo du métronome comparé
sans le mot d'état, masqué à l'ordinateur ; K : la barre fixée au téléphone, le transport dedans), `global_transport` (H : on mesure la barre, le
transport s'y efface ; I : rétrécir le laisse dans la barre), `transport_boucle` (E : trois boutons, toucher Boucle, le triangle reste un triangle),
`barre_bas_telephone` (C : une rangée d'accès de secours posée sur la barre ; le seuil des 81 px reste), `export_lyrics`, `export_lyrics_opens_tab`,
`paroles_autoload_back` (l'onglet Paroles à 800 px ouvre la vue ; le contenu transmis est relu dans le dépôt au moment où HarmoHub l'écrit, mêmes
contrôles qu'au fichier ; ni fichier ni onglet ; le lien de retour est éprouvé sur la page Paroles ouverte seule). `meta_suite` : référence mise à jour
(une erreur avalée de moins dans `export_lyrics`).
**Constat en passant, déjà vrai avant le lot (vérifié sur `270173e`)** : `ajout_modif` plante (délai dépassé à la ligne 156, `#quality` invisible) et le
relevé de `run_all_fast.sh` / `run_cible.sh` le compte VERT, parce qu'un journal sans bilan qui contient des PASS et aucun FAIL passe pour vert. À traiter
hors lot : un banc sans bilan devrait être « sans verdict ».

**Balayages du lot 10b (05/11).** Ciblé n°1 (66 suites : le diff et les bancs du téléphone) : les neuf changements de sens attendus, réécrits ci-dessus,
plus `barre_bas_telephone` qui a trouvé le tiroir du séquenceur posé sur les accès de secours (corrigé). Ciblé n°2 (129 suites, dont les 75 bancs joués
sous 900 px pas encore rejoués — risque d'un recouvrement par la barre fixée) : 123 verts, rouges et « sans verdict » de la ligne de base seulement.
**Complet : 229 verts, 6 rouges, 7 sans verdict (242 suites)** au second passage. Le premier a été arrêté et relancé : le serveur de test (tâche
d'arrière-plan d'une session précédente) avait atteint sa limite de durée en pleine phase série, 15 suites tombées sur `ERR_CONNECTION_REFUSED`.
Les 5 rouges et 7 « sans verdict » de la ligne de base, plus `telephone_barre_lecture` (47/48) : le contrôle du Tap supposait des touchers toutes
les 500 ms, que la charge allonge (94 BPM au lieu de ~120). **Défaut du banc, pas de l'appli** : il compare désormais le tempo obtenu au rythme
réellement tapé, relevé dans la page à chaque toucher ; vert seul, **4 sur 4 en quatre passages simultanés**, rouge au sabotage (Tap qui ne fait rien :
122 contre 108). Aucun fichier servi n'a changé depuis le balayage complet. `verre` vert (corrigé hors lot juste avant), `glock_unlock_and_switch` vert
cette fois. **Aucune régression.**

## Suite du lot 10b : la vitesse de lecture au téléphone, les paroles suivent la copie d'un morceau (2026-11-05)

**Réponses de l'utilisateur aux points ouverts du 10b.** « Vitesse de lecture : intègre-la au téléphone. » « Paroles : elles doivent être connectées
au firestore directement, et doivent fonctionner comme la grille ou la structure. Le but est d'avoir un fonctionnement homogène. Donc fais au mieux,
je n'ai pas tranché. »

**La vitesse de lecture au téléphone.** Ses trois éléments de la fenêtre du tempo (nom et valeur, curseur 50–200 %, vitesses rapides) sont regroupés
dans `#bl-vitesse-bloc` (sans boîte à l'ordinateur, `display: contents` : la fenêtre du tempo y reste identique) et DÉPLACÉS dans le panneau Lecture
au téléphone (`placerPanneauLecture`), sous le tempo ; vitesses rapides en groupe segmenté de 44 px. La barre du téléphone n'a pas de bouton BPM pour
porter la mention dorée « · 60 % » : `#bl-vitesse-tel` la pose à côté de « Mes. N » tant que la vitesse n'est pas 100 % (même règle : « un réglage
oublié à 60 % se verrait sinon trop tard »).

**Les paroles, ce qui est déjà vrai et ce qui ne l'est pas.** Elles SONT connectées à Firestore : document `users/{uid}/apps/harmohub-paroles`
(`synchro-paroles.js`), envoyé et relu par la page Paroles elle-même — y compris quand elle est la vue intégrée (le cadre charge Firebase et son
moteur). Le fichier .json n'était qu'un passage entre deux pages ; avec la vue intégrée il ne sert plus : **décision prise (« fais au mieux »)** :
pas d'entrée « Paroles (.json) » au menu Fichier, l'export intégral garde le fichier comme archive. Écarts restants avec la grille et la structure,
à reprendre dans un sous-lot « Paroles homogènes » (proposé dans `CLAUDE-HARMOHUB.md`) :
- **corrigé ici** : dupliquer un morceau copiait sa grille et sa structure (elles sont DANS le morceau), pas ses paroles. `copierParolesDuMorceau`
  recopie la session sous l'identifiant de la copie, datée de maintenant (gardée par la synchro), après avoir fait écrire la frappe en suspens du
  cadre, et demande au cadre de l'envoyer ;
- supprimer un morceau laisse ses paroles (localement et au cloud) : la synchro des paroles ne connaît pas les suppressions (une session effacée
  ici reviendrait du cloud) — il faut une trace des suppressions dans `synchro-paroles.js`, comme celle des morceaux ;
- la synchro des paroles ne démarre qu'à la première ouverture de l'onglet Paroles dans la session (le moteur commun n'admet qu'une instance par
  page : la page principale ne peut pas porter aussi celle des paroles sans toucher au fichier partagé `synchro-cloud.js`) ;
- les paroles s'enregistrent toutes seules, la grille et la structure à la main (Enregistrer, voyant « non enregistré ») ; les versions
  automatiques (Historique) ne gardent pas les paroles ; la vue Paroles a son propre « Enregistré ✓ ».

**Bancs.** `telephone_barre_lecture` 48 → 50 : la vitesse dans le panneau (nœuds déplacés, groupe de 44 px), 75 % règle la lecture et pas le tempo du
morceau, mention dorée après « Mes. N », effacée à 100 % ; ordinateur : le bloc de vitesse dans la fenêtre du tempo, juste après la rangée du tempo,
mention du téléphone masquée ; le seuil franchi dans les deux sens. Le toucher « à côté » du panneau, plus haut désormais, vise la marge sous la
barre du haut (il tombait sur le panneau). `vues_integrees` 40 → 43 (partie G : « Dupliquer » du menu du morceau emporte les paroles, sous le nom de
la copie, l'original intact ; la copie ouverte montre ses paroles dans la vue). **Sabotages : 4, tous rouges** (vitesse non déplacée, mention dorée
muette, vitesse non rendue à l'ordinateur, paroles non copiées).

**Balayages (05/11).** Ciblé : 52 suites, 51 vertes, `smoke` sans verdict (ligne de base). **Complet : 230 verts, 5 rouges, 7 sans verdict (242
suites)** — exactement la ligne de base, aucune suite tombée sur le serveur (relancé avec son chien de garde avant le balayage). **Aucune régression.**


## Refonte de l'interface — lot 10c : réglages du morceau, affichage de la grille, en-tête de partie au téléphone (2026-11-05)

Demande (docs/refonte.md, « Téléphone » ; maquette `project/Telephone2.dc.html`) : « infos du morceau (tonalité, mesure, swing, son) repliées dans UNE
barre-résumé pleine largeur → quatre grosses cases sur deux colonnes ; bouton carré "Affichage" à côté : Compact (4 mesures/ligne, noms seuls, 44 px),
Normal (4 mesures/ligne + degrés, 64 px), Large (2 mesures/ligne, 72 px). Pincement conservé » ; les zooms H / V s'effacent ; l'en-tête de partie :
nom + « N mesures » + ×N + menu ⋯ (celui du lot 5c).

**Ce qui change (téléphone, < 900 px).**
- **La barre-résumé** est le même bouton qu'avant (`#song-summary`), sur une ligne de 44 px avec le bouton carré Affichage ; la carte Morceau perd son
  cadre. Elle dit « C majeur · 120 BPM · 4/4 · Droit · Piano ». **Écart voulu avec la maquette, qui n'a pas le tempo dans cette barre** : l'exigence de
  l'utilisateur « voici ce que je veux toujours voir apparaître : nom du morceau, tonalité, tempo » (`filet_toujours_visible`) l'emporte — le tempo se
  règle dans le panneau Lecture depuis le 10b, il restait donc à le LIRE sans un toucher. Tonalité et tempo en tête : à 320 px, ce sont le swing et le
  son qui s'abrègent.
- **Les quatre cases** sont les puces de l'ordinateur (`#rangee-reglages`, lot 6a), DÉPLACÉES dans `#tel-reglages-cases` (`placerRangeeReglages`) et
  rendues à la rangée au-dessus du seuil — mêmes choix (`#rr-pop`, à 44 px, jamais plus large que l'écran, qui suit sa case quand la page défile),
  même annulation. 52 px de haut comme la maquette, nom au-dessus de la valeur ; elles sont DANS la page et poussent la grille (rien ne la recouvre).
  **Transposer** garde sa ligne pleine largeur sous les cases : la maquette ne l'a pas, mais il était dans la carte Morceau (règle 1, rien ne se perd).
  L'ancien panneau de listes déroulantes (`#song-settings`) ne s'ouvre plus à aucune largeur ; le **contretemps du métronome**, qui n'avait que lui au
  téléphone, rejoint le panneau Lecture (ligne « Contretemps », `#pl-subdivision`), comme à l'ordinateur dans la fenêtre du tempo.
- **Affichage** (`#tel-affichage`, icône de la maquette : aucune n'existait pour cette fonction) ouvre dans la page, sous la ligne, un groupe segmenté de
  44 px Compact / Normal / Large et une phrase qui dit ce que fait le choix. Croix, Échap, le bouton lui-même et le toucher à côté le referment
  (`this._popups`). **Décision prise en séance : une préférence de l'APPAREIL** (`harmohubGrilleTelephone`), pas un réglage du morceau — les échelles du
  morceau (`classicGridZoomLevelX/Y`) sont celles de l'ordinateur, dont l'écran n'a rien de commun ; un morceau réglé en Détaillé (84 px) donnait
  jusqu'ici des cases de 103 px au téléphone. Choisir un affichage ne marque donc pas le morceau modifié, et survit au rechargement.
- **Le pincement** règle, au téléphone, les échelles du téléphone (`gridTelZoomLevelX/Y`, via `genreZoomGeste` dans le pincement et la molette), plus
  celles du morceau ; choisir un affichage remet ses valeurs. Les boutons H± V± s'effacent (comme à l'ordinateur depuis le lot 5a). En 3/4, « 4 mesures
  par ligne » reste la règle de `beatsPerRowFor` (une ligne vaut ~16 temps : 5 mesures de 3), comme à l'ordinateur.
- **Les cases de la grille** : `--row-h` = la hauteur de l'affichage (la règle « 56 px sous 480 px » disparaît, Normal fait 64 px) ; rangées de numéros
  et de degrés bornées (16–20 / 14–18 px). **Défaut ancien corrigé en passant** : la ligne du nom d'accord (hauteur 1, débordement masqué) coupait le
  jambage — « Cmaj7 » se lisait « Cmai7 » au téléphone (vérifié sur le commit d'avant) ; 1,25 au téléphone.
- **L'en-tête de partie** prend celui de l'ordinateur à 44 px : « 8 mesures » en toutes lettres, ×N, le ⋯ au bout de la ligne ; ▲▼⧉🗑 passent dans
  le menu (lignes de 44 px, jamais plus large que l'écran).
- **Verre dépoli** : la carte reste sans fond ni ombre verre allumé ; le panneau Affichage et son groupe sont des creux (`--glass-inp`) ; les choix des
  cases et le menu ⋯ sont des `.tb-menu` (fond des menus déjà posé).

**Défaut trouvé par un banc réécrit** (`reglages_morceau_popover`) : régler le tempo par −, + ou Tap (`reglerTempo`) ne rafraîchissait que la barre de
lecture — le « change » envoyé au curseur ne remonte pas jusqu'à l'écouteur du conteneur des réglages. La barre-résumé restait à « 120 BPM ». Déjà vrai
avant le lot pour l'ancien résumé de la carte (invisible : le panneau était fermé). `reglerTempo` rafraîchit tout le résumé (`updateSongSummary`).

**Bancs.** Nouveau `telephone_reglages_test` (47) : la ligne (44 px, 7 px, pleine largeur, les cinq valeurs, sans cadre) ; les cases (ordre, deux
colonnes, 52 px, déplacées, poussent la grille, Transposer à 44 px) ; les choix (dans l'écran, lignes de 44 px, 3/4 avec résumé, grille et voyant, une
annulation ; E♭ sans toucher aux accords, Échap ; Swing, Son, Transposer ; toucher à côté ; suit au défilement ; replier) ; le contretemps dans le
panneau Lecture ; Affichage (Normal 64 px / 16 temps / degrés, Compact 44 px sans degrés, Large 72 px / 8 temps, aide et nom du bouton, morceau ni
modifié ni ses échelles changées, trois façons de fermer, rechargement) ; le pincement (grille du téléphone agrandie, morceau intact, Normal remet) ;
zooms effacés ; l'en-tête (« 8 mesures », ⋯ 44 px au bout, anciens boutons disparus, menu de 44 px collé à son bouton page défilée, Dupliquer, Répéter ×2, Échap) ; verre (sans cadre,
creux, aucun contraste perdu) ; 320 px ; ordinateur inchangé (puces à 32 px dans la rangée, Normal à 52 px malgré Large choisi au téléphone) et seuil
franchi dans les deux sens.
**Réécrits pour le nouveau geste** (ils éprouvaient l'ancien panneau, les H± V± ou l'en-tête d'avant au téléphone, ou vérifiaient qu'il n'avait pas bougé) :
`song_panel` (la barre-résumé et ses cases : valeurs lisibles, résumé fidèle — le swing est toujours dit, comme la maquette —, rien de masqué, Transposer
et le Tap depuis leur nouvelle place, rien ne se rouvre seul, et le contrat d'origine « rien ne bouge les réglages » redevient vrai : les cases ne se
referment qu'à la demande) ; `reglages_morceau_popover` (l'intention d'origine — la grille reste à l'écran pendant qu'on règle — mesurée sur la première
rangée d'accords ; fermetures, rechargement, circuit par de vrais clics sur « + » puis Ctrl+Z, Modification, suggestion devant, carte de l'accord jamais
recouverte, sur ce qui flotte aujourd'hui ; 21 → 25) ; `popover_morceau_dense` (densité et hiérarchie des cases : pas de titre redondant, nom plus petit
que la valeur, Transposer sur sa ligne sans passer pour une case, vingt commandes tactiles dans le choix de tonalité ; 20 → 21) ; `classic_grid_zoom`
(les deux échelles du morceau par la poignée du bas et Ctrl+molette, à l'ordinateur ; plan rendu exact, 9 → 12) ; `song_zoom_persist` (Ctrl+molette) ;
`grid_loupe_pinch_undo` (le pincement règle les échelles du téléphone) ; `affichage_grille` (F), `entete_partie` (F), `entete_grille_debordement`
(téléphone : ⊱ et Séq.), `rangee_reglages` (I : les puces dans les cases, le contretemps dans le panneau), `instrument_du_morceau` (G : la case Son),
`filet_toujours_visible` (la tonalité et le tempo lus sur la barre-résumé), `voice_leading_section_ops` (A : monter, dupliquer, supprimer par le ⋯).
**Sabotages : 13, tous rouges** (résumé masqué, puces non déplacées, affichage ignoré, pincement sur les échelles du morceau, contretemps resté dans la
carte, anciens boutons de partie gardés, verre du panneau oublié, choix qui ne suit pas sa case, affichage qui marque le morceau modifié, hauteur de Large
non posée, tempo réglé sans rafraîchir le résumé → `reglages_morceau_popover`, tempo sorti de la barre → `filet_toujours_visible`, menu ⋯ non fixé). Le
dernier est d'abord resté VERT : le banc ouvrait toujours le menu en haut de page, où un menu non fixé tombe juste par hasard. Il fait désormais défiler
la page et exige le menu collé à son bouton ; rouge au sabotage.
**Constat en passant, déjà vrai avant le lot (rejoué sur `66ee339`)** : `duree_sur_la_ligne_accord` plante (`#duration-dd-toggle` invisible, délai
dépassé) puis imprime un bilan « 16 PASS / 0 FAIL » : le relevé le compte vert. Même défaut de règle que `ajout_modif` (lot 10b), à traiter hors lot.
**Balayages (05/11).** Ciblé n°1 (78 suites : le diff et les bancs du téléphone) : 62 verts, les changements de sens attendus (réécrits ci-dessus) et
un vrai défaut à moi dans `verre` (un « backdrop-filter: none » écrit en dur, puis une carte exclue du flou qui faussait sa mesure : la carte garde son
flou, invisible sans fond). Bancs réécrits rejoués un à un : tous verts. **Complet : 230 verts, 6 rouges, 7 sans verdict (243 suites)** — les 5 rouges
et 7 « sans verdict » de la ligne de base, plus `meta_suite`, rouge parce que la dette avait DIMINUÉ (deux erreurs avalées de moins dans `song_panel`) :
référence figée (`--maj`), vert 6/6. Aucun fichier servi n'a changé depuis. **Aucune régression.**

## Sous-lot « Paroles homogènes » : les paroles suivent le morceau, se synchronisent dès l'ouverture, gardent leurs versions (2026-11-05)

Demandes du 05/11 : les paroles « doivent être connectées au firestore directement, et doivent fonctionner comme la grille ou la structure. Le but
est d'avoir un fonctionnement homogène » ; « Oui tu peux enregistrer les paroles automatiquement » ; « Garde en mémoire des sauvegardes précédentes ».

- **Supprimer un morceau supprime ses paroles**, par tous les chemins (menu, fenêtre Fichiers, ménage, Ctrl+Z, restauration) : `saveSongs` appelle
  `parolesSuivreBibliotheque` (script.js). Un morceau qui part : sa session est retirée, rangée dans une corbeille de l'appareil
  (`harmohub_lyrics_corbeille`, 30 jours, pour Ctrl+Z), gardée comme version, et une **trace de suppression** (`harmohub_lyrics_sync_deleted`) part
  dans le document `harmohub-paroles` (champ `supprimes`, six mois, même règle que les morceaux : la suppression l'emporte sur toute version plus
  ancienne, une version plus récente la lève). Un morceau qui revient sous le même identifiant (Ctrl+Z) retrouve ses paroles, datées de maintenant.
  Ce qui arrive par la synchro n'est pas suivi là : le document des paroles porte ses propres suppressions. Restaurer un morceau supprimé depuis
  Paramètres › Historique (nouvel identifiant) ramène aussi ses paroles (corbeille, sinon dernière version).
- **Le cadre Paroles oublie un morceau supprimé** (`oublierMorceauOuvert`, ici ou reçu d'un autre appareil) : il ne peut plus le réécrire. Et la vue
  le recharge quand il revient (`idMorceauOuvert`, demandé par `chargerParoles`) — sans quoi, après Ctrl+Z, la vue restait vide : trouvé par le banc.
- **Défaut ancien corrigé** : `writeSessionNow` réécrivait la session (datée de maintenant) à chaque sortie de la vue, même sans frappe. C'est ce qui
  ressuscitait les paroles d'un morceau supprimé (sabotage S3 : B les récupère). Elle n'écrit plus que s'il y a une écriture en attente.
- **Synchro dès l'ouverture** : une fois connecté (`surCompte` de synchro-harmohub.js), `prechargerParoles` charge le cadre Paroles en arrière-plan,
  vue fermée. `synchro-cloud.js` intouché (une instance par page). Sans compte, rien n'est chargé.
- **Versions des paroles** : historique.js devient une fabrique (`creerHistorique`) ; `HistoriqueParoles` a sa base à part
  (`harmohub-historique-paroles`, pour ne pas monter la version de celle des morceaux). Versions prises avant d'écraser la session (au plus une
  toutes les 5 minutes par morceau, donc toujours l'état d'avant la première frappe), avant une version reçue d'un autre appareil (« Avant synchro »),
  avant la suppression du morceau, avant un import, avant une restauration ; doublons écartés. Paramètres › Historique : intertitre « Paroles de ce
  morceau », cartes avec mots, parties, accords posés et un extrait, bouton Restaurer (en place, l'état actuel gardé d'abord, envoyé au cloud).
- **Faux Firebase des bancs** : une écoute venue d'un cadre reçoit ses notifications dans ce cadre (`frame`), et non dans la page qui le contient.

- **Une seule mise en garde à la fermeture** : le cadre préchargé a son moteur, qui prévenait lui aussi quand un envoi était en attente — deux boîtes,
  le navigateur refusait la seconde (erreur de console, trouvée par `structure_feuille` au premier balayage complet). Intégrée, la page Paroles arrête
  l'écouteur de synchro-cloud.js (posé avant lui, sans toucher le fichier partagé) ; HarmoHub prévient à sa place en lisant l'état du moteur du cadre.

**Banc.** Nouveau `paroles_homogenes_test` (36), deux appareils sur le même nuage simulé (A ordinateur, B téléphone 390 px tactile), vrais gestes :
préchargement (cadre chargé, vue fermée, document au cloud) ; B reçoit les paroles sans ouvrir la vue ; suppression par la fenêtre Fichiers (session,
trace, cloud, cadre qui oublie, version gardée ; B supprimée et sa vue ouverte qui oublie) ; Ctrl+Z (morceau, paroles, trace levée, cloud, B) ;
réouverture de la vue ; vue ouverte puis quittée sans frappe : rien de réécrit ; versions (pas de doublon, version automatique, liste et extrait,
Restaurer, version avant restauration, message, cloud, B, vue) ; fermeture hors ligne : une seule mise en garde ; sans compte, rien de préchargé.
**Sabotages : 8, tous rouges** (session laissée, pas de préchargement, réécriture sans frappe, traces ignorées par la fusion, vue non rechargée, pas
de version avant restauration, cadre qui prévient aussi, HarmoHub qui ne prévient pas pour le cadre).
**Réécrit** : `paroles_hardening` (6) corrompait la session pendant l'anti-rebond qui suit l'export ; charger un morceau écrit maintenant d'abord la
frappe en attente du précédent (rien ne se perd), qui remplaçait la session corrompue. Le banc attend la fin de l'anti-rebond, son intention reste.
`_firebase_faux.js` notifie le cadre d'où vient l'écoute.
**Balayages (05/11).** Ciblé (44 suites) : 42 verts, `probe_regle_voisins` rouge et `smoke` sans verdict (ligne de base). Complet n°1 : 229 verts, 8 rouges —
la ligne de base plus `paroles_hardening` et `structure_feuille` (corrigés ci-dessus) et `verre` (écart sur `#tb-titre`, vert rejoué seul : l'intermittence
connue sous charge). **Complet n°2 : 232 verts, 5 rouges, 7 sans verdict (244 suites), exactement la ligne de base. Aucune régression.**

## Sous-lot « Versions au cloud » : les versions des morceaux et des paroles dans Firestore, sur tous les appareils (2026-11-05)

Décisions du 05/11 (soir) : « toutes les versions stockées dans le firestore », celles des morceaux ET des paroles ; « s'il y a un problème de place,
il faut garder moins de versions que prévu […] le minimum acceptable (environ 3 à 5 versions) » ; la page Paroles ouverte seule doit aussi lister et
restaurer ses versions (« oui on restaure »).

- **Nouveau `synchro-versions.js`** (propre à HarmoHub, chargé par `index.html` et `paroles.html`). Un document par morceau,
  `users/{uid}/apps/harmohub-versions-{songId}` : les 5 plus récentes versions du morceau et les 5 de ses paroles, `charge` et `resume` en texte JSON
  (tableaux imbriqués). Trop lourd (plus de 900 Kio) : on retire la plus ancienne de la liste la plus longue jusqu'à une de chaque ; une version seule
  plus lourde que le plafond reste sur l'appareil. Un index `harmohub-versions` (morceau, dernière date, nombre) : un appareil n'ouvre que les documents
  qui ont du neuf, et retrouve les versions d'un morceau supprimé ailleurs. Écriture en transaction (relire, fusionner, écrire), sans écriture quand rien
  ne change. `synchro-cloud.js` intouché : il synchronise un document par instance, en écoute continue — une écoute par morceau aurait coûté trop cher ;
  le module réutilise seulement la connexion du moteur de la page (`SYNCHRO.etat`).
- **Quand** : une version prise ici part 3 s après (anti-rebond), ou en masquant la page ; prise hors ligne ou déconnecté, elle est notée dans
  `harmohub_versions_a_envoyer` (des identifiants seulement) et part à l'ouverture de l'historique ou au battement de 20 s une fois connecté. Celles des
  autres appareils sont lues à l'ouverture de Paramètres › Historique et des Options de la page Paroles (le panneau se dessine d'abord avec ce qui est
  ici, puis se redessine s'il en est arrivé ; un même document n'est pas relu plus d'une fois toutes les 30 s).
- **`historique.js`** : `importer` (verse les versions du cloud, sans doublon : même id ou même contenu pour ce morceau, puis élagage habituel),
  `surAjout` (le module apprend chaque version posée ici), `appareil` (identifiant tiré au sort une fois par navigateur, `harmohub_appareil`) : la liste
  dit « autre appareil » d'une version reçue. La copie locale garde toujours 40 versions par morceau.
- **Fusion sans doublon** au cloud : union par id, puis par empreinte (la plus récente gagne), coupée à 5.
- **Page Paroles** : Options › « Versions précédentes » (liste, extrait, « autre appareil », Restaurer en 32 px, 44 px au doigt) ; restaurer garde d'abord
  l'état actuel, remet la version datée de maintenant et la relit à l'écran. Pas de nouvelle surface (la liste vit dans `.options-panel`).
- **Paramètres › Historique** : le texte d'aide dit, connecté, que les 5 plus récentes sont aussi au cloud ; « Vider l'historique de cet appareil »
  prévient que celles du cloud reviendront.
- **Un échec réseau** de l'envoi des versions est un avertissement de console, pas une erreur : rien n'est perdu, la version attend.

**Banc.** Nouveau `versions_cloud_test` (37), deux appareils sur le même nuage simulé (A ordinateur 1440 px, B téléphone 390 px tactile), vrais gestes :
enregistrer envoie la version (document du morceau, charge complète en texte, index, rien dans le document de la bibliothèque) ; sept enregistrements :
toutes gardées ici, les 5 plus récentes au cloud, dans l'ordre ; versions des paroles au cloud ; la page Paroles SEULE sur B liste la version de l'ordinateur
(« autre appareil »), Restaurer (44 px au doigt) remet le texte à l'écran et dans la session, garde l'état remplacé, bandeau ; cet état au cloud une seule
fois (l'ordinateur, en recevant la restauration, le garde aussi « avant synchro » : même contenu, un seul gardé) ; Paramètres › Historique au téléphone :
les versions de l'ordinateur, marquées, aide « cloud », pas de débordement, Restaurer, la version d'avant part au cloud, jamais plus de 5 + 5, aucun
doublon au cloud ni dans le téléphone ; hors ligne : la version attend, part au retour du réseau, sort de la file ; import d'un contenu déjà là refusé ;
morceau trop lourd : moins de versions, les plus récentes, au moins une de chaque ; version seule trop lourde gardée sur l'appareil.
**Sabotages : 5, tous rouges** (pas d'envoi, plafond de 5 retiré, import sans dédoublonnage, liste absente de la page Paroles, pas de réduction de taille).
**Réécrits** (le sens a changé, l'intention reste) : `historique_versions` (partie F : la seule clé localStorage admise est la file d'envoi, des
identifiants) ; `synchro_paroles` (la page Paroles écrit aussi les documents de versions, et rien d'autre que ses paroles).
**Balayages (05/11).** Ciblé (33 suites) : 30 verts, `probe_defilement_tactile` rouge et `smoke` sans verdict (ligne de base), `synchro_paroles` rouge
(2, réécrit ci-dessus ; l'échec réseau de l'envoi des versions passé en avertissement). Complet n°1 sans valeur (serveur de test arrêté en route).
**Complet n°2 : 233 verts, 5 rouges, 7 sans verdict (245 suites), exactement la ligne de base. Aucune régression.**
