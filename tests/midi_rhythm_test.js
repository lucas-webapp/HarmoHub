// Import MIDI, étape 4 : le rythme réellement joué doit se retrouver dans le séquenceur.
// L'épreuve décisive n'est pas « le motif ressemble-t-il » mais « RÉENTEND-ON les mêmes notes aux
// mêmes instants » : on reconstruit donc, depuis la case de grille produite, la liste des notes que
// l'appli jouerait, et on la compare à celle du fichier d'origine.
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

const HELPERS = `
function barOf(notes, stepsPerBar) {
    stepsPerBar = stepsPerBar || 16;
    const sounding = notes.map(n => ({
        note: { midi: n.midi, startStep: n.from, endStep: n.to, velocity: 100 },
        fromStep: n.from, toStep: n.to, steps: n.to - n.from,
    }));
    return { index: 0, startStep: 0, endStep: stepsPerBar, sounding, attacks: sounding.map(s => s.note) };
}
function plaque(midis, from, to) { return midis.map(m => ({ midi: m, from: from === undefined ? 0 : from, to: to === undefined ? 16 : to })); }
// Ce que l'appli jouerait pour cette case : la liste { midi, début, durée } déduite du motif stocké,
// avec le MÊME regroupement des croches liées que la lecture et l'export MIDI.
function rejoue(data) {
    const chord = new Chord(data.root, data.quality, data.beats, data.inversion, data.drop, data.octave, data.bass, null, data.extraNotes);
    const midis = chord.getSeqMidiNotes();
    const { pattern, tie } = parseSeqPattern(data.arpPattern);
    const steps = pattern.length;
    const out = [];
    for (let v = 0; v < midis.length; v++) {
        let s = 0;
        while (s < steps) {
            if (!pattern[s].includes(v)) { s++; continue; }
            const start = s; s++;
            while (s < steps && pattern[s].includes(v) && tie[s].includes(v)) s++;
            out.push({ midi: midis[v], from: start, to: s });
        }
    }
    return out.sort((a, b) => (a.from - b.from) || (a.midi - b.midi));
}
function cle(l) { return JSON.stringify(l.map(n => [n.midi, n.from, n.to])); }
`;

(async () => {
    const browser = await chromium.launch();
    const errors = [];
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(700);
    await page.addScriptTag({ content: HELPERS });

    const OPTS = { beats: 4, stepsPerBar: 16, instrument: 'piano' };

    // ============================================================
    // === A. Un accord plaqué : on doit réentendre exactement les mêmes notes ===
    // ============================================================
    const simple = await page.evaluate((opts) => {
        const joue = plaque([60, 64, 67]);
        const bar = barOf(joue);
        const data = buildImportedChordData(bar, analyzeSegmentHarmony(bar), opts);
        return { data, attendu: cle(joue.map(n => ({ midi: n.midi, from: n.from, to: n.to }))), obtenu: cle(rejoue(data)) };
    }, OPTS);
    check(simple.data.root === 'C' && simple.data.quality === 'maj',
        `l'accord est nommé do majeur — obtenu ${simple.data.root}${simple.data.quality}`);
    check(simple.data.seqEdited === true,
        `le motif est marqué comme venant du fichier, pour ne jamais être remplacé par un style de jeu — seqEdited=${simple.data.seqEdited}`);
    check(simple.obtenu === simple.attendu,
        `on réentend exactement les notes du fichier — obtenu ${simple.obtenu} vs ${simple.attendu}`);
    check(simple.data.extraNotes.length === 0,
        `aucune note libre inutile n'est créée pour un accord tout simple — obtenu ${JSON.stringify(simple.data.extraNotes)}`);

    // ============================================================
    // === B. Le rythme est REPRIS, pas remplacé par un motif tout fait ===
    // ============================================================
    const rythme = await page.evaluate((opts) => {
        // Un rythme reconnaissable : croche - silence - deux doubles - blanche.
        const joue = [
            ...plaque([60, 64, 67], 0, 2),
            ...plaque([60, 64, 67], 4, 5),
            ...plaque([60, 64, 67], 5, 6),
            ...plaque([60, 64, 67], 8, 16),
        ];
        const bar = barOf(joue);
        const data = buildImportedChordData(bar, analyzeSegmentHarmony(bar), opts);
        const p = parseSeqPattern(data.arpPattern);
        return {
            actives: p.pattern.map((v, i) => (v.length ? i : -1)).filter(i => i >= 0),
            obtenu: cle(rejoue(data)), attendu: cle(joue),
            // La 5e croche est une NOUVELLE attaque (deux doubles séparées) : surtout pas liée,
            // sinon les deux se fondraient en une seule note deux fois plus longue.
            liee5: p.tie[5].length > 0,
            // La 9e à la 16e ne forment qu'une tenue : elles DOIVENT être liées.
            liee9: p.tie[9].length > 0,
            liee1: p.tie[1].length > 0,
        };
    }, OPTS);
    check(JSON.stringify(rythme.actives) === JSON.stringify([0, 1, 4, 5, 8, 9, 10, 11, 12, 13, 14, 15]),
        `les silences du fichier restent des silences — cases actives ${JSON.stringify(rythme.actives)}`);
    check(rythme.obtenu === rythme.attendu,
        `chaque note retrouve son instant ET sa durée — obtenu ${rythme.obtenu}`);
    check(rythme.liee1 === true && rythme.liee9 === true,
        `les croches d'une même note tenue sont liées, sans rattaque parasite — 1:${rythme.liee1} 9:${rythme.liee9}`);
    check(rythme.liee5 === false,
        `...et deux doubles distinctes ne sont PAS liées, sans quoi elles n'en feraient plus qu'une — 5:${rythme.liee5}`);

    // Deux attaques SÉPARÉES de la même hauteur, collées l'une à l'autre : elles doivent rester deux
    // notes rejouées, pas fusionner en une seule tenue — c'est tout l'intérêt des liaisons.
    const rattaque = await page.evaluate((opts) => {
        const joue = [...plaque([60, 64, 67], 0, 8), ...plaque([60, 64, 67], 8, 16)];
        const bar = barOf(joue);
        const data = buildImportedChordData(bar, analyzeSegmentHarmony(bar), opts);
        return { obtenu: cle(rejoue(data)), attendu: cle(joue), lie8: parseSeqPattern(data.arpPattern).tie[8].length };
    }, OPTS);
    check(rattaque.lie8 === 0 && rattaque.obtenu === rattaque.attendu,
        `deux attaques successives de la même note restent deux notes — obtenu ${rattaque.obtenu}`);

    // ============================================================
    // === C. Notes étrangères : conservées à leur hauteur EXACTE, en notes libres ===
    // ============================================================
    const melodie = await page.evaluate((opts) => {
        const joue = [
            ...plaque([53, 57, 60]),                            // fa majeur tenu
            { midi: 72, from: 0, to: 4 }, { midi: 74, from: 4, to: 8 },   // do puis ré (le ré est étranger)
            { midi: 76, from: 8, to: 16 },                                // mi (étranger aussi)
        ];
        const bar = barOf(joue);
        const data = buildImportedChordData(bar, analyzeSegmentHarmony(bar), opts);
        return {
            accord: data.root + data.quality,
            extras: data.extraNotes,
            obtenu: cle(rejoue(data)), attendu: cle(joue),
        };
    }, OPTS);
    check(melodie.accord === 'Fmaj', `l'accord reste un fa majeur — obtenu ${melodie.accord}`);
    // Octaves à la convention de l'appli (do3 = 48, voir _computeVoices) : le ré 74 est donc un ré5.
    check(JSON.stringify(melodie.extras) === JSON.stringify([{ note: 'C', octave: 5 }, { note: 'D', octave: 5 }, { note: 'E', octave: 5 }]),
        `les notes de la mélodie deviennent des notes libres, à leur hauteur exacte — obtenu ${JSON.stringify(melodie.extras)}`);
    check(melodie.obtenu === melodie.attendu,
        `...et on réentend l'ensemble à l'identique, accord ET mélodie — obtenu ${melodie.obtenu} vs ${melodie.attendu}`);

    // Le do aigu (72) est le do de l'accord une octave plus haut. Le replier sur la voix du do était
    // tentant (une ligne de moins dans le séquenceur), mais l'accord tient DÉJÀ ce do toute la
    // mesure : la note de mélodie disparaissait alors purement et simplement, absorbée par une voix
    // qui sonnait déjà. Elle doit donc rester une note à part entière.
    const octaveDoublee = await page.evaluate((opts) => {
        const joue = [...plaque([60, 64, 67]), { midi: 72, from: 0, to: 8 }];
        const bar = barOf(joue);
        const data = buildImportedChordData(bar, analyzeSegmentHarmony(bar), opts);
        return { extras: data.extraNotes, obtenu: cle(rejoue(data)), attendu: cle(joue) };
    }, OPTS);
    check(octaveDoublee.obtenu === octaveDoublee.attendu,
        `un do doublé à l'octave reste audible au lieu d'être absorbé par la voix du do — obtenu ${octaveDoublee.obtenu} vs ${octaveDoublee.attendu}`);

    // ============================================================
    // === C bis. Renversements : le voicing de l'accord se cale sur ce qui a été joué ===
    // ============================================================
    // Un do majeur joué en 1er renversement (mi-sol-do). Importé en position fondamentale, aucune de
    // ses voix ne tomberait juste : les trois notes deviendraient des lignes libres par-dessus trois
    // voix muettes. Même son, mais séquenceur illisible — c'est ce que chooseImportVoicing évite.
    const renversements = await page.evaluate((opts) => {
        const essai = (midis) => {
            const bar = barOf(plaque(midis));
            const data = buildImportedChordData(bar, analyzeSegmentHarmony(bar), opts);
            return {
                nom: data.root + data.quality, renv: data.inversion, oct: data.octave,
                extras: data.extraNotes.length, obtenu: cle(rejoue(data)),
                attendu: cle(midis.map(m => ({ midi: m, from: 0, to: 16 }))),
            };
        };
        return { fond: essai([60, 64, 67]), renv1: essai([64, 67, 72]), renv2: essai([67, 72, 76]), sept: essai([64, 67, 70, 72]) };
    }, OPTS);
    for (const [k, r] of Object.entries(renversements)) {
        check(r.extras === 0 && r.obtenu === r.attendu,
            `${k} : l'accord se replace tout seul sur les notes jouées (${r.nom}, renv. ${r.renv}, oct. ${r.oct}) — ${r.extras} note(s) libre(s)`);
    }

    // ============================================================
    // === D. Case « à nommer » : aucun accord plaqué par-dessus, rien que les vraies notes ===
    // ============================================================
    const aNommer = await page.evaluate((opts) => {
        // Une mélodie : la reconnaissance doit refuser de la nommer (voir étape 3).
        const joue = [60, 62, 64, 65, 67, 69, 71, 72].map((m, i) => ({ midi: m, from: i * 2, to: i * 2 + 2 }));
        const bar = barOf(joue);
        const analyse = analyzeSegmentHarmony(bar);
        const data = buildImportedChordData(bar, analyse, opts);
        const chord = new Chord(data.root, data.quality, data.beats, data.inversion, data.drop, data.octave, data.bass, null, data.extraNotes);
        const bodyVoices = chord.getIntervals().length;
        const { pattern } = parseSeqPattern(data.arpPattern);
        return {
            confiance: analyse.confidence,
            extras: data.extraNotes.length,
            obtenu: cle(rejoue(data)), attendu: cle(joue),
            // AUCUNE voix du corps de l'accord ne doit sonner : sinon un do majeur fantôme
            // s'ajouterait à la mélodie qu'on voulait justement laisser telle quelle.
            corpsJoue: pattern.some(v => v.some(x => x < bodyVoices)),
        };
    }, OPTS);
    check(aNommer.confiance < 0.62, `la mélodie est bien refusée par la reconnaissance — confiance ${aNommer.confiance.toFixed(3)}`);
    check(aNommer.extras === 8, `ses 8 notes deviennent toutes des notes libres — obtenu ${aNommer.extras}`);
    check(aNommer.corpsJoue === false,
        `aucune voix de l'accord de remplissage ne sonne par-dessus — corps joué : ${aNommer.corpsJoue}`);
    check(aNommer.obtenu === aNommer.attendu,
        `on réentend EXACTEMENT la mélodie jouée, ni plus ni moins — obtenu ${aNommer.obtenu} vs ${aNommer.attendu}`);

    // ============================================================
    // === E. Registre : l'accord importé retombe dans l'octave du morceau d'origine ===
    // ============================================================
    const registre = await page.evaluate((opts) => {
        const bas = barOf(plaque([36, 40, 43]));   // do grave
        const aigu = barOf(plaque([72, 76, 79]));  // do aigu
        return {
            bas: buildImportedChordData(bas, analyzeSegmentHarmony(bas), opts).octave,
            aigu: buildImportedChordData(aigu, analyzeSegmentHarmony(aigu), opts).octave,
            graveJoue: cle(rejoue(buildImportedChordData(bas, analyzeSegmentHarmony(bas), opts))),
            aiguJoue: cle(rejoue(buildImportedChordData(aigu, analyzeSegmentHarmony(aigu), opts))),
        };
    }, OPTS);
    check(registre.bas === 2 && registre.aigu === 5,
        `l'octave choisie suit le registre joué — grave: ${registre.bas}, aigu: ${registre.aigu}`);
    check(registre.graveJoue === '[[36,0,16],[40,0,16],[43,0,16]]',
        `un accord grave est rejoué grave, sans être remonté d'office — obtenu ${registre.graveJoue}`);
    check(registre.aiguJoue === '[[72,0,16],[76,0,16],[79,0,16]]',
        `un accord aigu est rejoué aigu — obtenu ${registre.aiguJoue}`);

    // ============================================================
    // === F. Une note tenue par-dessus la barre est réattaquée, pas perdue ===
    // ============================================================
    const traverse = await page.evaluate((opts) => {
        // Note commencée AVANT la mesure (startStep négatif vu d'ici) et qui la traverse en entier.
        const sounding = [
            { note: { midi: 60, startStep: -8, endStep: 16 }, fromStep: 0, toStep: 16, steps: 16 },
            { note: { midi: 64, startStep: 0, endStep: 16 }, fromStep: 0, toStep: 16, steps: 16 },
            { note: { midi: 67, startStep: 0, endStep: 16 }, fromStep: 0, toStep: 16, steps: 16 },
        ];
        const bar = { index: 1, startStep: 0, endStep: 16, sounding, attacks: [] };
        const data = buildImportedChordData(bar, analyzeSegmentHarmony(bar), opts);
        const p = parseSeqPattern(data.arpPattern);
        return { premiere: p.pattern[0].length, lieeAuDebut: p.tie[0].length, obtenu: cle(rejoue(data)) };
    }, OPTS);
    check(traverse.premiere === 3 && traverse.lieeAuDebut === 0,
        `une note venue de la mesure précédente est réattaquée au premier temps plutôt que perdue — ${traverse.premiere} voix, ${traverse.lieeAuDebut} liée(s)`);
    check(traverse.obtenu === '[[60,0,16],[64,0,16],[67,0,16]]',
        `...et elle sonne bien toute la mesure — obtenu ${traverse.obtenu}`);

    // ============================================================
    // === G. Beaucoup de notes libres : aucune ne doit être perdue ===
    // ============================================================
    // Le dimensionnement des tableaux de voix dépend du nombre de notes libres créées en cours de
    // route. On pousse donc volontairement bien au-delà de ce qu'un accord contient.
    const beaucoup = await page.evaluate((opts) => {
        const joue = [];
        for (let i = 0; i < 16; i++) joue.push({ midi: 48 + i, from: i, to: i + 1 }); // 16 hauteurs différentes
        const bar = barOf(joue);
        const data = buildImportedChordData(bar, analyzeSegmentHarmony(bar), opts);
        return { extras: data.extraNotes.length, obtenu: cle(rejoue(data)), attendu: cle(joue) };
    }, OPTS);
    check(beaucoup.obtenu === beaucoup.attendu,
        `seize hauteurs différentes dans une mesure sont toutes conservées — ${beaucoup.extras} notes libres`);

    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 || errors.length > 0 ? 1 : 0);
})();
