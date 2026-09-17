#!/bin/bash
# Balayage hybride : les suites qui manipulent des gestes tactiles/glissés minutés (deux doigts,
# pincer, marquee, drag...) restent en SÉRIE — jouées en parallèle, elles se disputent le serveur
# de test et produisent de faux échecs (voir _DETTE_TESTS.md, section « bruit réseau du bac à
# sable » + campagne du 12/08). Tout le reste tourne en parallèle (4 threads = nproc) pour aller
# plus vite, retour utilisateur du 12/08 : « accélère, travaille en série seulement pour les
# tâches qui le nécessitent ».
cd "$(dirname "$0")"
rm -rf /tmp/sweep_out
mkdir -p /tmp/sweep_out

SENSITIVE="affordances_test.js ctx_nav_scroll_test.js ctx_nav_test.js glock_full_real_ui_test.js grid_beat_highlight_test.js grid_loupe_pinch_undo_test.js grid_multidrag_test.js grid_pipettes_test.js mobile_scroll_test.js paroles_drag_test.js pinch_smoothness_centering_test.js pipette_all_test.js seq_beat_highlight_test.js seq_dup_drag_test.js seq_handle_feedback_test.js seq_hscroll_test.js seq_marquee_test.js seq_row_pipette_clear_test.js seq_row_pipette_test.js seq_voicedrag_test.js seq_vscroll_and_cancel_test.js vl_pinch_test.js"

run_one() {
    f="$1"
    node "$f" > "/tmp/sweep_out/${f}.log" 2>&1
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
echo "$REST" | xargs -P 4 -I{} bash -c 'run_one "$@"' _ {}
echo "Phase 2 terminée."

echo "=== SWEEP DONE ==="

# LE BALAYAGE REND SON PROPRE VERDICT. Il fallait jusqu'ici le reconstruire à la main avec des `grep`
# improvisés après coup — et un `grep FAIL` naïf compte « 0 FAIL » des lignes de bilan comme un échec.
# Trois états, et le troisième compte autant que les deux autres : un banc SANS VERDICT (planté,
# expiré, ou qui ne contient aucun contrôle) ne prouve rien, et passait jusqu'ici pour un silence
# rassurant.
echo
echo "=== RELEVÉ ==="
verts=0; rouges=0; muets=0
for log in /tmp/sweep_out/*.log; do
    nom=$(basename "$log" .log)
    bilan=$(grep -oE "[0-9]+ PASS / [0-9]+ FAIL" "$log" | tail -1)
    if [ -n "$bilan" ]; then
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
echo "$verts verts, $rouges rouges, $muets sans verdict (sur $((verts+rouges+muets)) suites)"
[ "$rouges" -eq 0 ] && [ "$muets" -eq 0 ]
