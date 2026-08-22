#!/bin/bash
# Quels bancs rejouer après CE lot, dans un budget de temps donné ?
#
# POURQUOI. Le balayage complet dure 42 minutes MESURÉES (591 s pour les 25 suites tactiles en série,
# ~1930 s pour les 174 autres à 4 en parallèle, 199 suites au total). Le rejouer après chaque
# correctif est intenable. Retour utilisateur : « cible les tests nécessaires à chaque lot de
# modifications (pas à chaque étape), et écarte ceux qui vont prendre du temps alors qu'ils n'ont pas
# d'intérêt » puis « je veux bien garder un ensemble de tests de 15 minutes ».
#
# LE BUDGET EST LA CONTRAINTE, PAS UNE CONSÉQUENCE. Une première version classait les bancs sans
# plafond : elle en proposait 63 pour un lot séquenceur, soit 48 minutes — PIRE que le balayage
# complet. Un outil de ciblage qui peut dépasser ce qu'il remplace ne sert à rien. On classe donc par
# pertinence, et on coupe au budget, en DISANT ce qu'on a coupé.
#
# TROIS SOURCES DE PERTINENCE, de la plus sûre à la plus grossière :
#   3 pts — le banc nomme un symbole que ce lot a ajouté ou retiré (identifiant, classe, méthode) ;
#   1 pt  — le banc appartient à une ZONE dont ce lot touche une fonction partagée. Ce filet existe
#           parce que modifier le CORPS d'une fonction ne change aucun identifiant : éprouvé sur le
#           lot « séquenceur », la recherche par symbole seule ne proposait QU'UN banc alors que huit
#           étaient pertinents.
# Les symboles présents dans plus d'un huitième des bancs sont écartés d'office : `icon-btn` est
# partout, le citer reviendrait à tout rejouer.
#
# CE QU'IL NE REMPLACE PAS. Un lot qui touche une règle CSS GÉNÉRIQUE (button, .icon-btn), ou qui
# RETIRE un identifiant partagé, mérite le balayage complet — ce sont les deux cas où la recherche
# par symbole est structurellement aveugle. L'outil le signale quand il les repère.
#
# Usage :  tests/cibler.sh                    # modifications en cours, budget 15 min
#          tests/cibler.sh HEAD~1             # un commit précis
#          tests/cibler.sh --budget 25        # autre budget, en minutes
#          tests/cibler.sh --lancer           # cherche PUIS lance
cd "$(dirname "$0")/.."

BUDGET=15; LANCER=0; REF=""; ATTEND_BUDGET=0
for arg in "$@"; do
    if [ "$ATTEND_BUDGET" = "1" ]; then BUDGET="$arg"; ATTEND_BUDGET=0; continue; fi
    case "$arg" in
        --lancer) LANCER=1 ;;
        --budget) ATTEND_BUDGET=1 ;;
        *) REF="$arg" ;;
    esac
done
SEC_PAR_BANC=45                       # moyenne relevée sur le balayage du jour
PLACES=$(( BUDGET * 60 / SEC_PAR_BANC ))

if [ -n "$REF" ]; then DIFF=$(git diff "$REF" -- . ':!tests/'); else DIFF=$(git diff HEAD -- . ':!tests/'); fi
[ -z "$DIFF" ] && { echo "Aucune modification hors tests/ — rien à cibler."; exit 0; }
LIGNES=$(echo "$DIFF" | grep -E '^[+-]' | grep -vE '^(\+\+\+|---)')

# --- Alerte : les deux cas où le ciblage est structurellement aveugle -------------------------
ALERTE=""
echo "$LIGNES" | grep -qE '^\+(button|\.icon-btn|input|select|\*)\s*[,{]' && ALERTE="une règle CSS générique"
echo "$LIGNES" | grep -qE '^-.*id="[a-zA-Z0-9_-]+"' && ALERTE="${ALERTE:+$ALERTE et }un identifiant retiré"

# --- Symboles touchés (ajoutés ET retirés : un id supprimé casse autant qu'un id ajouté) ------
SYMBOLES=$( {
    echo "$LIGNES" | grep -oE 'id="[a-zA-Z0-9_-]+"'              | sed 's/id="//; s/"//'
    echo "$LIGNES" | grep -oE "getElementById\('[a-zA-Z0-9_-]+'"  | sed "s/getElementById('//"
    echo "$LIGNES" | grep -oE 'class="[a-zA-Z0-9 _-]+"'          | sed 's/class="//; s/"//' | tr ' ' '\n'
    echo "$LIGNES" | grep -oE '^\+\.[a-zA-Z][a-zA-Z0-9_-]+'      | sed 's/^\+\.//'
    echo "$LIGNES" | grep -oE '^\+    [a-zA-Z_][a-zA-Z0-9_]+\('  | sed 's/^\+    //; s/(//'
  } | sort -u | grep -E '.{5,}' )

TOTAL=$(ls tests/*_test.js | wc -l)
PLAFOND=$(( TOTAL / 8 ))
SCORES=$(mktemp); ECARTES=""
for sym in $SYMBOLES; do
    esc=$(printf '%s' "$sym" | sed 's/[.[\*^$()+?{|]/\\&/g')
    fichiers=$(grep -lE "$esc" tests/*_test.js 2>/dev/null)
    n=$(echo "$fichiers" | grep -c .)
    [ "$n" -eq 0 ] && continue
    if [ "$n" -gt "$PLAFOND" ]; then ECARTES="$ECARTES $sym($n)"; continue; fi
    for f in $fichiers; do echo "3 $(basename "$f")" >> "$SCORES"; done
done

# --- Filet par zone : 1 point, pour ce que la recherche par symbole ne peut pas voir ----------
# Les MÉTHODES RÉELLEMENT MODIFIÉES, pas celles dont le nom traîne dans le diff. Modifier le corps
# d'une fonction ne fait apparaître son nom nulle part — et le citer dans un commentaire ne veut pas
# dire qu'on l'a touchée. On remonte donc, pour chaque bloc modifié, à la méthode qui le contient, par
# ses numéros de ligne. L'en-tête de bloc de git ne sert à rien ici : il n'annonce que
# « class HarmoHubApp », JS n'étant pas reconnu par ses motifs de contexte par défaut.
FONCTIONS=$(git diff ${REF:-HEAD} -U0 -- script.js 2>/dev/null | python3 -c '
import re, sys, io
lignes = io.open("script.js", encoding="utf-8").read().split("\n")
definition = re.compile(r"^    ([a-zA-Z_][a-zA-Z0-9_]*)\s*\(")
vues = set()
for entete in re.finditer(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@", sys.stdin.read(), re.M):
    debut = int(entete.group(1)); longueur = int(entete.group(2) or 1)
    for i in range(min(debut + longueur, len(lignes)) - 1, -1, -1):
        m = definition.match(lignes[i])
        if m: vues.add(m.group(1)); break
print("\n".join(sorted(vues)))
')
zone() { if echo "$FONCTIONS" | grep -qE "^($1)$"; then ls tests/ | grep -E "$2" | grep '_test\.js$' | sed 's/^/1 /' >> "$SCORES"; fi; }
zone 'onSeqPointerMove|onSeqPointerUp|onSeqResizeMove|applySeqCell|findSeqStepAt|beginSeqHDrag|beginSeqVoiceDrag' '^(seq_|avant_seq_|continuous_scroll|filet_sequenceur)'
zone 'guitarFingeringsForChord|updateGuitarLockButton|toggleGuitarLock|renderGuitarDiagram|applyGuitarOverride|solveGuitarVoicings' '^(glock_|guitar_|manche_|accords_complexes|saisie_nom)'
zone 'renderGrid|editChord|loadProgression|commitLiveEdit' '^(grid_|ajout_modif|carte_accord|sortie_edition)'
zone 'renderSequencer|toggleSequencer|openSeqZoom|ouvrirSequenceurPleinEcran' '^(portes_sequenceur|classic_grid_zoom|zoom_|loupe_)'

[ -s "$SCORES" ] || { echo "Aucun banc désigné — juger à la main, ou balayage complet."; rm -f "$SCORES"; exit 0; }
CLASSEMENT=$(awk '{s[$2]+=$1} END {for (b in s) print s[b], b}' "$SCORES" | sort -rn -k1,1 -k2,2)
rm -f "$SCORES"
N_TOTAL=$(echo "$CLASSEMENT" | wc -l)
RETENUS=$(echo "$CLASSEMENT" | head -n "$PLACES")
COUPES=$(echo "$CLASSEMENT" | tail -n +$((PLACES + 1)))
N_RET=$(echo "$RETENUS" | grep -c .)

[ -n "$ECARTES" ] && { echo "=== Symboles écartés, trop répandus pour désigner quoi que ce soit (>$PLAFOND bancs) ==="; echo "$ECARTES" | fold -s -w 100; echo; }
echo "=== Retenus : $N_RET bancs sur $N_TOTAL désignés — ~$((N_RET * SEC_PAR_BANC / 60)) min (budget $BUDGET) ==="
echo "$RETENUS" | awk '{printf "  %-46s (pertinence %s)\n", $2, $1}'
if [ -n "$COUPES" ] && [ "$(echo "$COUPES" | grep -c .)" -gt 0 ]; then
    echo; echo "=== Coupés faute de budget : $(echo "$COUPES" | grep -c .) bancs, tous de pertinence $(echo "$COUPES" | head -1 | cut -d' ' -f1) ou moins ==="
    echo "$COUPES" | awk '{print $2}' | tr '\n' ' ' | fold -s -w 100; echo
fi
[ -n "$ALERTE" ] && { echo; echo "!!! Ce lot touche $ALERTE : le ciblage est structurellement aveugle ici, BALAYAGE COMPLET conseillé."; }

if [ "$LANCER" = "1" ]; then
    echo; echo "=== Lancement ==="
    export NODE_PATH=${NODE_PATH:-/opt/node22/lib/node_modules}
    NODE=${NODE:-/opt/node22/bin/node}
    echo "$RETENUS" | awk '{print $2}' | while read -r b; do
        r=$($NODE "tests/$b" 2>&1)
        printf '%-46s rouges=%s  %s\n' "$b" "$(echo "$r" | grep -cE '^FAIL|FAIL - |FAIL \(')" "$(echo "$r" | grep -E '===' | tail -1)"
    done
fi
