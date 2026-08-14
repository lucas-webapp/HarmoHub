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

SENSITIVE="affordances_test.js ctx_nav_scroll_test.js ctx_nav_test.js glock_full_real_ui_test.js grid_beat_highlight_test.js grid_loupe_pinch_undo_test.js grid_multidrag_test.js grid_pipettes_test.js mobile_scroll_test.js paroles_drag_test.js pinch_smoothness_centering_test.js pipette_all_test.js seq_beat_highlight_test.js seq_dup_drag_test.js seq_handle_feedback_test.js seq_hscroll_test.js seq_marquee_test.js seq_pinch_touch_conflict_test.js seq_row_pipette_clear_test.js seq_row_pipette_test.js seq_twofinger_jitter_test.js seq_twofinger_pan_test.js seq_voicedrag_test.js seq_vscroll_and_cancel_test.js vl_pinch_test.js"

run_one() {
    f="$1"
    node "$f" > "/tmp/sweep_out/${f}.log" 2>&1
}
export -f run_one

echo "=== Phase 1/2 : suites sensibles aux gestes, en SÉRIE (${SENSITIVE_COUNT:-24} suites) ==="
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
