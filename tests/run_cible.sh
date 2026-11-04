#!/bin/bash
# BALAYAGE CIBLÉ (décidé le 05/11 avec l'utilisateur : « on ne peut pas se permettre d'avoir des bancs d'essai de plus d'une heure pour chaque
# modification. [...] On va cibler et raccourcir. Ils seront réalisés en fin de lot uniquement. »)
#
# PENDANT un lot : ce script, quelques minutes. EN FIN DE LOT, avant de pousser : `bash tests/run_all_fast.sh` (le balayage complet, seul à autoriser un push).
#
# Il choisit les suites SANS carte à maintenir : il lit ce que la modification a touché (git diff : identifiants HTML, classes CSS, noms de méthodes et de
# fonctions de script.js) et retient les bancs qui CITENT l'un de ces noms. À quoi s'ajoute un petit socle rapide, toujours joué.
#
#   bash tests/run_cible.sh              suites touchées par le diff (non commité) + socle
#   bash tests/run_cible.sh --liste      affiche seulement la sélection, ne lance rien
#   bash tests/run_cible.sh mot1 mot2    ajoute les bancs dont le nom contient mot1, mot2… (ex. : vues, guitar)
#   bash tests/run_cible.sh --depuis REV compare à REV (par défaut HEAD ; ex. HEAD~3 pour un lot en plusieurs commits)
#
# Les bancs sensibles au temps (liste SENSITIVE de run_all_fast.sh) restent en série, les autres tournent à quatre. Verdict : même relevé que le balayage
# complet, plus la durée de chaque suite. Un balayage ciblé vert ne dispense JAMAIS du complet avant un push.
cd "$(dirname "$0")/.."
REV=HEAD; LISTE=0; MOTS=()
while [ $# -gt 0 ]; do
    case "$1" in
        --liste) LISTE=1 ;;
        --depuis) shift; REV="$1" ;;
        *) MOTS+=("$1") ;;
    esac
    shift
done

# Le socle : rapide, et il garde ce qui casse sans bruit (adresses citées, jauge des boutons, verre, démarrage).
SOCLE="smoke_test.js meta_suite_test.js sentinelle_adresses_test.js gabarit_boutons_test.js verre_test.js"

# Les noms que la modification a ajoutés ou changés.
DIFF=$( { git diff -U0 "$REV" -- index.html script.js style.css verre-surfaces.css paroles.html paroles.js paroles.css historique.js fichiers.js synchro-harmohub.js 2>/dev/null; git ls-files --others --exclude-standard -- '*.html' '*.js' '*.css' | grep -v '^tests/' | xargs -r cat; } )
NOMS=$(printf '%s\n' "$DIFF" | grep -E '^[+-][^+-]' | {
    grep -oE 'id="[A-Za-z][A-Za-z0-9_-]{4,}"' | sed -E 's/id="(.*)"/\1/'
    printf '%s\n' "$DIFF" | grep -E '^[+-][^+-]' | grep -oE '\.[a-z][a-z0-9-]{5,}' | sed 's/^\.//'
    printf '%s\n' "$DIFF" | grep -E '^[+-]    [a-z][A-Za-z0-9]{5,}\(.*\) \{$' | sed -E 's/^[+-] +([A-Za-z0-9]+)\(.*/\1/'
    printf '%s\n' "$DIFF" | grep -E '^[+-]function [A-Za-z0-9_]{5,}' | sed -E 's/^[+-]function ([A-Za-z0-9_]+).*/\1/'
} | sort -u | grep -vE '^(function|return|const|this|style|class|title|true|false|null)$')

SEL=""
# Un nom cité par presque tous les bancs (loadProgression, un id de la barre du haut…) ne dit rien de la zone touchée : au-delà de MAX_BANCS bancs il est
# ignoré, sinon la sélection redevient le balayage complet. Ce que ce filtre laisse passer, le balayage de FIN DE LOT le rattrape.
MAX_BANCS=${MAX_BANCS:-12}
for nom in $NOMS; do
    TROUVES=$(grep -lF -- "$nom" tests/*_test.js 2>/dev/null | xargs -r -n1 basename)
    [ "$(echo "$TROUVES" | grep -c .)" -le "$MAX_BANCS" ] && SEL="$SEL $TROUVES"
done
for mot in "${MOTS[@]}"; do
    SEL="$SEL $(ls tests | grep -E "_test\.js$" | grep -F -- "$mot")"
done
SEL=$(printf '%s\n' $SEL $SOCLE | sort -u | grep -v '^$')
# Les bancs que le balayage complet ignore n'ont pas à être inventés ici : on ne garde que les fichiers qui existent.
SEL=$(for f in $SEL; do [ -f "tests/$f" ] && echo "$f"; done)

echo "=== Sélection : $(echo "$SEL" | wc -l) suite(s) sur $(ls tests/*_test.js | wc -l) — $(echo "$NOMS" | wc -w) nom(s) lu(s) dans le diff depuis $REV ==="
if [ "$LISTE" = 1 ]; then echo "$SEL" | sed 's/_test.js$//' | tr '\n' ' '; echo; exit 0; fi

SENSITIVE=$(grep -E '^SENSITIVE=' tests/run_all_fast.sh | sed -E 's/^SENSITIVE="(.*)"/\1/')
rm -rf /tmp/cible_out; mkdir -p /tmp/cible_out
cd tests
run_one() { f="$1"; d=$(date +%s); node "$f" > "/tmp/cible_out/${f}.log" 2>&1; echo "$(( $(date +%s) - d ))" > "/tmp/cible_out/${f}.sec"; }
export -f run_one
SERIE=""; PARALLELE=""
for f in $SEL; do case " $SENSITIVE " in *" $f "*) SERIE="$SERIE $f" ;; *) PARALLELE="$PARALLELE $f" ;; esac; done
for f in $SERIE; do run_one "$f"; done
[ -n "$PARALLELE" ] && echo $PARALLELE | tr ' ' '\n' | xargs -P 4 -I{} bash -c 'run_one "$@"' _ {}

echo; echo "=== RELEVÉ CIBLÉ ==="
verts=0; rouges=0; muets=0
for f in $SEL; do
    log="/tmp/cible_out/${f}.log"; sec=$(cat "/tmp/cible_out/${f}.sec" 2>/dev/null || echo "?")
    bilan=$(grep -oE "[0-9]+ PASS / [0-9]+ FAIL" "$log" | tail -1)
    if [ -n "$bilan" ]; then
        echecs=${bilan##*/ }; echecs=${echecs%% FAIL}
        if [ "$echecs" = "0" ]; then verts=$((verts+1)); else rouges=$((rouges+1)); echo "ROUGE  ${f%_test.js}  ($bilan, ${sec}s)"; grep -E "^FAIL" "$log" | head -3 | cut -c1-200; fi
    elif grep -qE "^FAIL|FAIL - " "$log"; then rouges=$((rouges+1)); echo "ROUGE  ${f%_test.js}  (banc sans bilan, ${sec}s)"
    elif grep -q "PASS" "$log"; then verts=$((verts+1))
    else muets=$((muets+1)); echo "SANS VERDICT  ${f%_test.js}  (${sec}s) -- $(tail -1 "$log" | cut -c1-70)"; fi
done
echo; echo "$verts verts, $rouges rouges, $muets sans verdict (sur $((verts+rouges+muets)) suites ciblées)"
echo "Les plus longues :"; for f in $SEL; do echo "$(cat /tmp/cible_out/${f}.sec 2>/dev/null || echo 0) ${f%_test.js}"; done | sort -rn | head -5 | sed 's/^/  /'
echo "(Ligne de base connue : voir CLAUDE.md. Ce relevé ne remplace pas le balayage complet avant un push.)"
