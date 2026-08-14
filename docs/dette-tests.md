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
