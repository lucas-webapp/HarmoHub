// Import MIDI, étape 3 : reconnaissance des accords.
// La question n'est pas seulement « trouve-t-il le bon accord » mais « sait-il quand il ne sait pas ».
// Un faux nom coûte cher à l'utilisateur ; un « à nommer » ne coûte presque rien. On vérifie donc les
// DEUX : les accords plaqués doivent être nommés, les mesures mélodiques doivent passer sous le seuil.
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

// Fabrique un segment d'une mesure de 4/4 (16 croches) à partir de notes {midi, from, to}.
const HELPERS = `
function seg(notes, spanSteps) {
    spanSteps = spanSteps || 16;
    const sounding = notes.map(n => ({
        note: { midi: n.midi, startStep: n.from, endStep: n.to, velocity: 100 },
        fromStep: n.from, toStep: n.to, steps: n.to - n.from,
    }));
    return { startStep: 0, endStep: spanSteps, sounding };
}
// Accord plaqué : toutes les notes ensemble, du début à la fin.
function plaque(midis, from, to) { return midis.map(m => ({ midi: m, from: from === undefined ? 0 : from, to: to === undefined ? 16 : to })); }
// Mélodie : une note à la fois, à la suite.
function melodie(midis, dur) { dur = dur || 2; return midis.map((m, i) => ({ midi: m, from: i * dur, to: (i + 1) * dur })); }
function nom(a) { return a ? a.root + ':' + a.quality : 'null'; }
`;

(async () => {
    const browser = await chromium.launch();
    const errors = [];
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(700);
    await page.addScriptTag({ content: HELPERS });

    // ============================================================
    // === A. Accords plaqués simples : le bon nom, et une confiance élevée ===
    // ============================================================
    const triads = await page.evaluate(() => {
        const cas = {
            'Do majeur':        plaque([60, 64, 67]),
            'La mineur':        plaque([57, 60, 64]),
            'Fa majeur':        plaque([53, 57, 60]),
            'Sol7':             plaque([55, 59, 62, 65]),
            'Do maj7':          plaque([60, 64, 67, 71]),
            'Ré min7':          plaque([62, 65, 69, 72]),
            'Mi bémol majeur':  plaque([63, 67, 70]),
            'Si dim':           plaque([59, 62, 65]),
            'Do sus4':          plaque([60, 65, 67]),
            'La b maj7':        plaque([56, 60, 63, 67]),
        };
        const out = {};
        for (const [k, v] of Object.entries(cas)) {
            const a = analyzeSegmentHarmony(seg(v));
            out[k] = { nom: nom(a), conf: +a.confidence.toFixed(3) };
        }
        return out;
    });
    const attendus = {
        'Do majeur': 'C:maj', 'La mineur': 'A:min', 'Fa majeur': 'F:maj', 'Sol7': 'G:dom7',
        'Do maj7': 'C:maj7', 'Ré min7': 'D:min7', 'Mi bémol majeur': 'D#:maj', 'Si dim': 'B:dim',
        'Do sus4': 'C:sus4', 'La b maj7': 'G#:maj7',
    };
    for (const [k, want] of Object.entries(attendus)) {
        check(triads[k].nom === want && triads[k].conf >= 0.62,
            `${k} est reconnu et nommé — obtenu ${triads[k].nom} (confiance ${triads[k].conf})`);
    }

    // ============================================================
    // === B. Renversements : c'est la BASSE qui tranche entre deux accords aux mêmes notes ===
    // ============================================================
    // Do-mi-sol-la = exactement les mêmes notes que la-do-mi-sol. Seule la basse les distingue :
    // c'est le cas d'école où un simple ensemble de hauteurs ne suffit pas.
    const bass = await page.evaluate(() => ({
        basseDo: nom(analyzeSegmentHarmony(seg(plaque([60, 64, 67, 69])))),   // do en bas -> C6
        basseLa: nom(analyzeSegmentHarmony(seg(plaque([57, 60, 64, 67])))),   // la en bas -> Am7
        // Un do majeur premier renversement (mi en bas) doit rester un DO majeur, pas un mi quelque chose.
        renv1: nom(analyzeSegmentHarmony(seg(plaque([64, 67, 72])))),
        renv2: nom(analyzeSegmentHarmony(seg(plaque([67, 72, 76])))),
    }));
    check(bass.basseDo === 'C:6', `do-mi-sol-la avec do à la basse est un C6 — obtenu ${bass.basseDo}`);
    check(bass.basseLa === 'A:min7', `les MÊMES notes avec la à la basse deviennent un Am7 — obtenu ${bass.basseLa}`);
    check(bass.renv1 === 'C:maj', `un do majeur avec mi à la basse reste un do majeur — obtenu ${bass.renv1}`);
    check(bass.renv2 === 'C:maj', `...et avec sol à la basse aussi — obtenu ${bass.renv2}`);

    // ============================================================
    // === C. Le plus simple gagne : pas d'accord enrichi inventé de toutes pièces ===
    // ============================================================
    const simple = await page.evaluate(() => ({
        triade: nom(analyzeSegmentHarmony(seg(plaque([60, 64, 67])))),          // ne doit PAS devenir C6/Cmaj9
        septieme: nom(analyzeSegmentHarmony(seg(plaque([60, 64, 67, 70])))),    // C7, pas C9
        neuvieme: nom(analyzeSegmentHarmony(seg(plaque([60, 64, 67, 70, 74])))),// là, c'est bien un C9
    }));
    check(simple.triade === 'C:maj', `trois notes donnent une triade, pas un accord enrichi imaginaire — obtenu ${simple.triade}`);
    check(simple.septieme === 'C:dom7', `quatre notes donnent la 7e, sans 9e ajoutée d'office — obtenu ${simple.septieme}`);
    check(simple.neuvieme === 'C:dom9', `...mais la 9e réellement jouée est bien reconnue — obtenu ${simple.neuvieme}`);

    // ============================================================
    // === D. Ce qu'on doit REFUSER de nommer (le vrai enjeu pour l'utilisateur) ===
    // ============================================================
    const refus = await page.evaluate(() => {
        const c = (s) => { const a = analyzeSegmentHarmony(s); return { nom: nom(a), conf: a ? +a.confidence.toFixed(3) : null }; };
        return {
            // Gamme de do : que des notes de do majeur, mais jouées une par une. Ce n'est PAS un accord.
            gamme: c(seg(melodie([60, 62, 64, 65, 67, 69, 71, 72]))),
            // Mélodie ordinaire avec notes étrangères.
            melodie: c(seg(melodie([60, 63, 65, 66, 67, 70, 72, 74]))),
            // Une seule note tenue toute la mesure.
            uneNote: c(seg([{ midi: 60, from: 0, to: 16 }])),
            // Deux notes seulement : ambigu, on ne devrait pas trancher.
            quinte: c(seg(plaque([60, 67]))),
            // Passage muet.
            vide: analyzeSegmentHarmony(seg([])),
        };
    });
    check(refus.gamme.conf < 0.62,
        `une GAMME de do majeur n'est pas un accord de do majeur — confiance ${refus.gamme.conf} (${refus.gamme.nom})`);
    check(refus.melodie.conf < 0.62, `une mélodie ordinaire reste sous le seuil — confiance ${refus.melodie.conf}`);
    check(refus.uneNote.conf < 0.62, `une seule note tenue n'est pas un accord — confiance ${refus.uneNote.conf}`);
    check(refus.quinte.conf < 0.62, `une simple quinte à vide est trop ambiguë pour être nommée — confiance ${refus.quinte.conf}`);
    check(refus.vide === null, `un passage muet ne rend aucun accord — obtenu ${JSON.stringify(refus.vide)}`);

    // ============================================================
    // === E. Cas réalistes de GarageBand : accord tenu SOUS une mélodie ===
    // ============================================================
    const reels = await page.evaluate(() => {
        const c = (s) => { const a = analyzeSegmentHarmony(s); return { nom: nom(a), conf: +a.confidence.toFixed(3) }; };
        return {
            // Accord de fa tenu, avec une mélodie qui court par-dessus : l'accord doit être trouvé.
            accordPlusMelodie: c(seg([
                ...plaque([53, 57, 60]),
                { midi: 72, from: 0, to: 2 }, { midi: 74, from: 2, to: 4 }, { midi: 76, from: 4, to: 8 },
                { midi: 74, from: 8, to: 12 }, { midi: 72, from: 12, to: 16 },
            ])),
            // Accord plaqué RÉPÉTÉ en croches sèches, avec une note de mélodie ÉTRANGÈRE tenue toute
            // la mesure : sans la prime d'attaque, c'est la mélodie qui gagnerait.
            stabsSousMelodie: c(seg([
                ...[0, 2, 4, 6, 8, 10, 12, 14].flatMap(t => plaque([60, 64, 67], t, t + 1)),
                { midi: 78, from: 0, to: 16 },
            ])),
            // Arpège propre de sol majeur : monophonique, mais exactement l'accord et rien d'autre.
            arpege: c(seg(melodie([55, 59, 62, 67, 71, 74, 71, 67]))),
            // Arpège avec une note de passage étrangère : plus douteux, doit retomber sous le seuil.
            arpegeSali: c(seg(melodie([55, 59, 61, 62, 67, 66, 71, 74]))),
        };
    });
    check(reels.accordPlusMelodie.nom === 'F:maj' && reels.accordPlusMelodie.conf >= 0.62,
        `un fa tenu sous une mélodie est bien reconnu — obtenu ${reels.accordPlusMelodie.nom} (${reels.accordPlusMelodie.conf})`);
    check(reels.stabsSousMelodie.nom === 'C:maj' && reels.stabsSousMelodie.conf >= 0.62,
        `des accords brefs et répétés ne se laissent pas voler la vedette par une note tenue étrangère — obtenu ${reels.stabsSousMelodie.nom} (${reels.stabsSousMelodie.conf})`);
    check(reels.arpege.nom === 'G:maj' && reels.arpege.conf >= 0.62,
        `un arpège propre est reconnu bien qu'il soit monophonique — obtenu ${reels.arpege.nom} (${reels.arpege.conf})`);
    check(reels.arpegeSali.conf < 0.62,
        `le même arpège sali de notes de passage redevient douteux — confiance ${reels.arpegeSali.conf} (${reels.arpegeSali.nom})`);

    // ============================================================
    // === F. Aller-retour sur les 12 fondamentales × les qualités de l'appli ===
    // ============================================================
    // Le test le plus large : on demande à l'appli de construire chaque accord qu'elle sait nommer,
    // sur les 12 fondamentales, puis on redemande son nom. C'est exactement le trajet aller-retour
    // que fera un utilisateur qui exporte puis réimporte.
    const sweep = await page.evaluate(() => {
        const rates = [];
        const echecs = [];
        for (const quality of Object.keys(CHORD_INTERVALS)) {
            let ok = 0;
            for (let pc = 0; pc < 12; pc++) {
                const chord = new Chord(NOTES[pc], quality, 4, 0, 0, 3);
                const midis = chord.getSeqMidiNotes();
                const a = analyzeSegmentHarmony(seg(plaque(midis)));
                const bon = a && a.rootPc === pc && a.quality === quality && a.confidence >= 0.62;
                if (bon) ok++; else echecs.push(`${NOTES[pc]}${quality} -> ${a ? a.root + a.quality : 'null'} (${a ? a.confidence.toFixed(2) : '-'})`);
            }
            rates.push({ quality, ok });
        }
        return { rates, echecs };
    });
    const parfaits = sweep.rates.filter(r => r.ok === 12).map(r => r.quality);
    const imparfaits = sweep.rates.filter(r => r.ok < 12);
    console.log('  qualités reconnues sur les 12 fondamentales :', parfaits.length, '/', sweep.rates.length);
    if (imparfaits.length) console.log('  imparfaites :', JSON.stringify(imparfaits));
    if (sweep.echecs.length) console.log('  échecs :', JSON.stringify(sweep.echecs.slice(0, 20)));
    check(imparfaits.length === 0,
        `chaque accord que l'appli sait construire est reconnu sur les 12 fondamentales — ${parfaits.length}/${sweep.rates.length} qualités parfaites`);

    // ============================================================
    // === G. Le seuil tombe-t-il dans un vide, ou frôle-t-il les cas limites ? ===
    // ============================================================
    // Un seuil qui sépare 0,63 de 0,61 ne prouve rien : le moindre réglage le ferait basculer.
    // On mesure donc l'ÉCART réel entre ce qui doit être nommé et ce qui doit être refusé.
    const marge = await page.evaluate(() => {
        const conf = (s) => { const a = analyzeSegmentHarmony(s); return a ? a.confidence : 0; };
        const aNommer = [
            conf(seg(plaque([60, 64, 67]))), conf(seg(plaque([57, 60, 64, 67]))),
            conf(seg(plaque([55, 59, 62, 65]))), conf(seg(plaque([53, 57, 60]))),
            conf(seg(melodie([55, 59, 62, 67, 71, 74, 71, 67]))),
            conf(seg([...plaque([53, 57, 60]), { midi: 72, from: 0, to: 8 }, { midi: 69, from: 8, to: 16 }])),
        ];
        const aRefuser = [
            conf(seg(melodie([60, 62, 64, 65, 67, 69, 71, 72]))),
            conf(seg(melodie([60, 63, 65, 66, 67, 70, 72, 74]))),
            conf(seg([{ midi: 60, from: 0, to: 16 }])),
            conf(seg(plaque([60, 67]))),
            conf(seg(melodie([55, 59, 61, 62, 67, 66, 71, 74]))),
            conf(seg(melodie([60, 61, 62, 63, 64, 65, 66, 67]))), // chromatisme
        ];
        return { basNomme: Math.min(...aNommer), hautRefuse: Math.max(...aRefuser) };
    });
    console.log(`  le moins sûr de ce qu'on nomme : ${marge.basNomme.toFixed(3)} | le plus sûr de ce qu'on refuse : ${marge.hautRefuse.toFixed(3)}`);
    check(marge.hautRefuse < 0.62 && marge.basNomme > 0.62,
        `le seuil sépare bien les deux familles — refusés jusqu'à ${marge.hautRefuse.toFixed(3)}, nommés à partir de ${marge.basNomme.toFixed(3)}`);
    check(marge.basNomme - marge.hautRefuse > 0.15,
        `...et il tombe dans un vide franc, pas entre deux cas qui se frôlent — écart de ${(marge.basNomme - marge.hautRefuse).toFixed(3)}`);

    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 || errors.length > 0 ? 1 : 0);
})();
