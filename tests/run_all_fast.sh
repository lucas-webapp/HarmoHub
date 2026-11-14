#!/bin/bash
# Balayage hybride : les suites qui manipulent des gestes tactiles/glissés minutés (deux doigts,
# pincer, marquee, drag...) restent en SÉRIE — jouées en parallèle, elles se disputent le serveur
# de test et produisent de faux échecs (voir _DETTE_TESTS.md, section « bruit réseau du bac à
# sable » + campagne du 12/08). Tout le reste tourne en parallèle (4 threads = nproc) pour aller
# plus vite, retour utilisateur du 12/08 : « accélère, travaille en série seulement pour les
# tâches qui le nécessitent ».
cd "$(dirname "$0")"
DEBUT_MUR=$(date +%s)
# DURÉE (14/11) : lancé SEUL, ce balayage dure ~15 min sur 4 cœurs (mesuré : 888 s de mur pour 3 046 s cumulées). Les « une heure » venaient de la concurrence : un autre navigateur ou un
# autre banc lancé pendant le balayage lui vole du processeur (et peut donner de faux échecs, voir plus haut). On le dit en tête plutôt que de laisser croire que les bancs sont lents.
AUTRES=$(pgrep -fc "headless_shell|chrome-linux|/chromium" 2>/dev/null || true)
[ "${AUTRES:-0}" -gt 0 ] && echo "!! ATTENTION : ${AUTRES} processus de navigateur déjà en cours. Le balayage sera plus lent et peut donner de faux échecs : ne rien lancer d'autre pendant qu'il tourne."
rm -rf /tmp/sweep_out
mkdir -p /tmp/sweep_out

# AJOUTS DU 17/09, mesures à l'appui : ces deux-là rendaient 1 et 2 FAIL en parallèle et 0 FAIL
# lancés seuls. manche_edition_lot6 éprouve la DISPARITION d'un aperçu au départ de la souris, et
# glock_full_real_ui un état relu APRÈS RECHARGEMENT COMPLET : deux mesures sensibles au temps, qui
# dérivent dès que quatre navigateurs se disputent le processeur. Les ranger ici plutôt que relâcher
# leurs contrôles — le défaut qu'ils gardent est réel, c'est leur horloge qui ne l'est pas.
SENSITIVE="manche_edition_lot6_test.js glock_full_real_ui_test.js glock_unlock_and_switch_test.js affordances_test.js ctx_nav_scroll_test.js ctx_nav_test.js grid_beat_highlight_test.js grid_loupe_pinch_undo_test.js grid_multidrag_test.js grid_pipettes_test.js mobile_scroll_test.js paroles_drag_test.js pinch_smoothness_centering_test.js pipette_all_test.js seq_beat_highlight_test.js seq_dup_drag_test.js seq_handle_feedback_test.js seq_hscroll_test.js seq_marquee_test.js seq_row_pipette_clear_test.js seq_row_pipette_test.js seq_voicedrag_test.js seq_vscroll_and_cancel_test.js vl_pinch_test.js"

# La durée de chaque suite est notée à côté de son journal (.sec) : le relevé donne les plus lentes, pour savoir où raccourcir (demande du
# 05/11 : « durées par suite dans le relevé »).
run_one() {
    f="$1"
    d=$(date +%s)
    node "$f" > "/tmp/sweep_out/${f}.log" 2>&1
    echo "$(( $(date +%s) - d ))" > "/tmp/sweep_out/${f}.sec"
}
export -f run_one

# GARDE-FOU : une suite citée ici mais SUPPRIMÉE du dépôt s'exécutait en silence — node rendait
# « Cannot find module », le balayage l'ignorait, et le relevé la comptait comme « sans verdict ».
# Trois entrées fantômes ont ainsi survécu à la suppression de leurs fichiers (constat du 17/09).
FANTOMES=""
for f in $SENSITIVE; do [ -f "$f" ] || FANTOMES="$FANTOMES $f"; done
if [ -n "$FANTOMES" ]; then
    echo "!! SUITES CITÉES MAIS ABSENTES DU DÉPÔT :$FANTOMES"
    echo "!! Corrige la liste SENSITIVE ci-dessus avant de te fier à ce balayage."
    exit 2
fi

echo "=== Phase 1/2 : suites sensibles aux gestes, en SÉRIE ($(echo $SENSITIVE | wc -w) suites) ==="
for f in $SENSITIVE; do
    run_one "$f"
done
echo "Phase 1 terminée."

echo "=== Phase 2/2 : reste des suites, en PARALLÈLE (4 threads) ==="
ALL_SORTED=$(ls *_test.js | sort)
SENSITIVE_SORTED=$(echo "$SENSITIVE" | tr ' ' '\n' | sort)
REST=$(comm -23 <(echo "$ALL_SORTED") <(echo "$SENSITIVE_SORTED"))
# LES PLUS LONGUES D'ABORD (05/11, sous-lot « Bancs fiables », demande : raccourcir le balayage « uniquement si cela n'altère pas la qualité
# des bancs »). Par ordre alphabétique, synchro_cloud (~160 s), verre (~70 s) et verre_compte (~66 s) partaient parmi les dernières : les trois
# autres fils avaient fini, et le balayage attendait ces suites seules. On ne touche à aucun banc, on change seulement l'ordre de départ :
# d'abord selon les durées du balayage précédent (/tmp/sweep_durees.txt, réécrit à chaque relevé), sinon selon la liste connue ci-dessous.
LONGUES_CONNUES="synchro_cloud_test.js verre_test.js verre_compte_test.js structure_feuille_test.js song_panel_test.js"
if [ -s /tmp/sweep_durees.txt ]; then
    ORDRE=$(sort -rn /tmp/sweep_durees.txt | awk '{print $2}')
else
    ORDRE=$(echo "$LONGUES_CONNUES" | tr ' ' '\n')
fi
REST=$( { echo "$ORDRE" | grep -Fxf <(echo "$REST"); echo "$REST" | grep -vFxf <(echo "$ORDRE"); } )
echo "$REST" | xargs -P 4 -I{} bash -c 'run_one "$@"' _ {}
echo "Phase 2 terminée."

echo "=== SWEEP DONE ==="

# LE BALAYAGE REND SON PROPRE VERDICT. Il fallait jusqu'ici le reconstruire à la main avec des `grep`
# improvisés après coup — et un `grep FAIL` naïf compte « 0 FAIL » des lignes de bilan comme un échec.
# Trois états, et le troisième compte autant que les deux autres : un banc SANS VERDICT (planté,
# expiré, ou qui ne contient aucun contrôle) ne prouve rien, et passait jusqu'ici pour un silence
# rassurant.
echo
# PLANTAGE = ROUGE (décision du 05/11) : un banc qui meurt en route (« FATAL » de son .catch, ou trace d'exception non rattrapée de Node)
# n'est pas allé au bout, même s'il imprime ensuite un bilan sans échec — le filet de sortie de _harness rend compte des seuls contrôles
# joués. Deux cas réels : ajout_modif (plantage ligne 156, compté vert sur ses PASS) et duree_sur_la_ligne_accord (FATAL puis « 16 PASS /
# 0 FAIL »), tous deux verts au relevé pendant des lots entiers.
echo "=== RELEVÉ ==="
verts=0; rouges=0; muets=0
for log in /tmp/sweep_out/*.log; do
    nom=$(basename "$log" .log)
    bilan=$(grep -oE "[0-9]+ PASS / [0-9]+ FAIL" "$log" | tail -1)
    if grep -qE "^FATAL|^Node\.js v[0-9]" "$log"; then
        rouges=$((rouges+1)); echo "ROUGE  $nom  (plantage : $(grep -m1 -E "^FATAL|Error|^Node\.js v" "$log" | cut -c1-90))"
    elif [ -n "$bilan" ]; then
        echecs=${bilan##*/ }; echecs=${echecs%% FAIL}
        if [ "$echecs" = "0" ]; then verts=$((verts+1)); else rouges=$((rouges+1)); echo "ROUGE  $nom  ($bilan)"; fi
    elif grep -qE "^FAIL|FAIL - |FAIL \\(" "$log"; then
        rouges=$((rouges+1)); echo "ROUGE  $nom  ($(grep -cE "^FAIL|FAIL - |FAIL \\(" "$log") FAIL, banc sans bilan)"
    elif grep -q "PASS" "$log"; then
        verts=$((verts+1))
    else
        muets=$((muets+1)); echo "SANS VERDICT  $nom  -- $(tail -1 "$log" | cut -c1-70)"
    fi
done
echo
echo "Les plus lentes (secondes) :"
for s in /tmp/sweep_out/*.sec; do echo "$(cat "$s") $(basename "$s" .sec)"; done | sort -rn | head -12 | sed 's/_test.js$//; s/^/  /'
for s in /tmp/sweep_out/*.sec; do echo "$(cat "$s") $(basename "$s" .sec)"; done > /tmp/sweep_durees.txt
echo "Temps cumulé des suites : $(cat /tmp/sweep_out/*.sec | awk '{s+=$1} END {print s}') s"
echo "Durée réelle du balayage : $(( ($(date +%s) - DEBUT_MUR) / 60 )) min $(( ($(date +%s) - DEBUT_MUR) % 60 )) s (seul, ~15 min ; une heure veut dire qu'autre chose tournait en même temps)"
echo
echo "$verts verts, $rouges rouges, $muets sans verdict (sur $((verts+rouges+muets)) suites)"
[ "$rouges" -eq 0 ] && [ "$muets" -eq 0 ]
