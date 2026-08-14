// Import MIDI, étape 2 : découpage temporel.
// On vérifie la traduction ticks -> croches de la grille de l'appli, la découpe en mesures, et les
// décisions qui ont un vrai effet musical : mesures vides du début enlevées d'un nombre ENTIER de
// mesures (une levée reste une levée), notes très brèves conservées, doublons fusionnés, et notes
// tenues par-dessus une barre comptées des DEUX côtés.
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

// Construit un .mid minimal à partir d'une liste de notes en ticks : {midi, start, dur, ch}.
const BUILDER = `
function mkMidi(notes, opts) {
    opts = opts || {};
    const ppq = opts.ppq || 480;
    const ev = [];
    if (opts.bpm) { const us = Math.round(60000000 / opts.bpm); ev.push({ t: 0, b: [0xff,0x51,0x03,(us>>16)&0xff,(us>>8)&0xff,us&0xff] }); }
    if (opts.sig) ev.push({ t: 0, b: [0xff,0x58,0x04,opts.sig[0],Math.round(Math.log2(opts.sig[1])),24,8] });
    notes.forEach(n => {
        ev.push({ t: n.start, b: [0x90 | (n.ch || 0), n.midi, n.vel || 100] });
        ev.push({ t: n.start + n.dur, b: [0x80 | (n.ch || 0), n.midi, 0] });
    });
    ev.sort((a, b) => a.t - b.t);
    const trk = [];
    let prev = 0;
    ev.forEach(e => { trk.push(...midiVarLen(e.t - prev), ...e.b); prev = e.t; });
    trk.push(0, 0xff, 0x2f, 0x00);
    return new Uint8Array([0x4d,0x54,0x68,0x64,0,0,0,6,0,0,0,1,(ppq>>8)&0xff,ppq&0xff,
        0x4d,0x54,0x72,0x6b, ...midiU32(trk.length), ...trk]);
}
`;

(async () => {
    const browser = await chromium.launch();
    const errors = [];
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(700);
    await page.addScriptTag({ content: BUILDER });

    // ============================================================
    // === A. Grille : une noire = SEQ_STEPS_PER_BEAT croches, quel que soit le PPQ du fichier ===
    // ============================================================
    const gridA = await page.evaluate(() => {
        // Trois PPQ différents, la MÊME musique : deux rondes (do puis fa), une par mesure de 4/4.
        const at = (ppq) => {
            const seg = segmentMidiNotes(parseMidiFile(mkMidi([
                { midi: 60, start: 0, dur: 4 * ppq },
                { midi: 65, start: 4 * ppq, dur: 4 * ppq },
            ], { ppq, bpm: 120, sig: [4, 4] })));
            return { steps: seg.stepsPerBar, total: seg.totalSteps, bars: seg.bars.length,
                     notes: seg.notes.map(n => [n.midi, n.startStep, n.endStep]) };
        };
        return { p96: at(96), p480: at(480), p960: at(960), spb: SEQ_STEPS_PER_BEAT };
    });
    check(gridA.p480.steps === 4 * gridA.spb, `une mesure de 4/4 fait bien 4 temps de croches — obtenu ${gridA.p480.steps}`);
    check(JSON.stringify(gridA.p96) === JSON.stringify(gridA.p480) && JSON.stringify(gridA.p960) === JSON.stringify(gridA.p480),
        `un fichier à 96, 480 ou 960 ticks par noire donne EXACTEMENT le même résultat musical — 96:${JSON.stringify(gridA.p96.notes)} / 960:${JSON.stringify(gridA.p960.notes)}`);
    check(gridA.p480.bars === 2 && gridA.p480.total === 2 * gridA.p480.steps,
        `deux rondes = deux mesures — obtenu ${gridA.p480.bars} mesures / ${gridA.p480.total} croches`);

    // ============================================================
    // === B. Tempo, signature, et ce qu'on ne sait pas faire (annoncé, pas caché) ===
    // ============================================================
    const meta = await page.evaluate(() => {
        const seg = (opts) => segmentMidiNotes(parseMidiFile(mkMidi([{ midi: 60, start: 0, dur: 480 }], opts)));
        const s44 = seg({ bpm: 92, sig: [4, 4] });
        const s34 = seg({ bpm: 120, sig: [3, 4] });
        const s68 = seg({ bpm: 120, sig: [6, 8] });
        const sNone = seg({});
        // Deux tempos : on doit être prévenu qu'un seul est retenu.
        const trk = [0x00,0xff,0x51,0x03,0x07,0xa1,0x20, 0x00,0x90,60,100, 0x40,0xff,0x51,0x03,0x05,0x16,0x15, 0x00,0x80,60,0, 0x00,0xff,0x2f,0x00];
        const twoTempos = segmentMidiNotes(parseMidiFile(new Uint8Array([0x4d,0x54,0x68,0x64,0,0,0,6,0,0,0,1,0x01,0xe0,0x4d,0x54,0x72,0x6b,...midiU32(trk.length),...trk])));
        return {
            bpm44: s44.bpm, sig44: s44.timeSig,
            sig34: s34.timeSig, steps34: s34.stepsPerBar,
            sig68: s68.timeSig, steps68: s68.stepsPerBar, warn68: s68.warnings,
            sigNone: sNone.timeSig, bpmNone: sNone.bpm,
            warnTempo: twoTempos.warnings, bpmTempo: twoTempos.bpm,
        };
    });
    check(meta.bpm44 === 92 && meta.sig44 === '4/4', `le tempo et la mesure du fichier sont repris tels quels — ${meta.bpm44} BPM, ${meta.sig44}`);
    check(meta.sig34 === '3/4' && meta.steps34 === 12, `une mesure à 3/4 donne 3 temps — obtenu ${meta.sig34} / ${meta.steps34} croches`);
    // 6/8 : l'appli compte ses temps en noires, une mesure de 6/8 en vaut trois. On garde la DURÉE
    // juste (les barres tombent au bon endroit) et on annonce l'étiquette différente.
    check(meta.sig68 === '3/4' && meta.steps68 === 12,
        `une mesure de 6/8 garde sa vraie durée (3 noires) — obtenu ${meta.sig68} / ${meta.steps68} croches`);
    check(meta.warn68.some(w => w.includes('6/8')), `...et l'écart d'étiquette est annoncé — obtenu ${JSON.stringify(meta.warn68)}`);
    check(meta.sigNone === '4/4' && meta.bpmNone === 120, `sans méta-événement, on retombe sur 4/4 à 120 — obtenu ${meta.sigNone} / ${meta.bpmNone}`);
    check(meta.warnTempo.some(w => w.includes('tempo')) && meta.bpmTempo === 120,
        `un changement de tempo est signalé, et c'est le premier qui est retenu — ${meta.bpmTempo} BPM, ${JSON.stringify(meta.warnTempo)}`);

    // ============================================================
    // === C. Silence initial : on retire des mesures ENTIÈRES, jamais des croches ===
    // ============================================================
    const shifted = await page.evaluate(() => {
        // Deux mesures de silence, puis une levée (dernière croche de la 3e mesure), puis le do sur
        // le temps fort de la 4e. Si on recalait sur la 1re note, la levée deviendrait le temps fort.
        const seg = segmentMidiNotes(parseMidiFile(mkMidi([
            { midi: 67, start: 2 * 1920 + 1800, dur: 120 },  // levée, juste avant la barre
            { midi: 60, start: 3 * 1920, dur: 1920 },        // temps fort de la mesure suivante
        ], { bpm: 120, sig: [4, 4] })));
        return { notes: seg.notes.map(n => [n.midi, n.startStep, n.endStep]), bars: seg.bars.length, spb: seg.stepsPerBar };
    });
    check(shifted.bars === 2, `les deux mesures muettes du début sont retirées — reste ${shifted.bars} mesures`);
    check(shifted.notes[0][1] % shifted.spb !== 0 && shifted.notes[1][1] === shifted.spb,
        `la levée reste une levée (avant la barre) et le do reste sur le temps fort — obtenu ${JSON.stringify(shifted.notes)}`);

    // ============================================================
    // === D. Aimantation : une attaque légèrement en avance ou en retard tombe sur la bonne croche ===
    // ============================================================
    const quantized = await page.evaluate(() => {
        const t = 480; // 1 noire = 4 croches de 120 ticks
        const seg = segmentMidiNotes(parseMidiFile(mkMidi([
            { midi: 60, start: 0, dur: t },
            { midi: 62, start: t + 18, dur: t },        // 18 ticks en retard -> même croche
            { midi: 64, start: 2 * t - 22, dur: t },    // 22 ticks en avance  -> croche suivante
            { midi: 65, start: 3 * t, dur: 9 },         // note minuscule (9 ticks) : ne doit PAS disparaître
        ], { bpm: 120, sig: [4, 4] })));
        return seg.notes.map(n => [n.midi, n.startStep, n.endStep - n.startStep]);
    });
    check(JSON.stringify(quantized.map(q => q[1])) === JSON.stringify([0, 4, 8, 12]),
        `les attaques jouées « à la main » retombent sur la bonne croche — obtenu ${JSON.stringify(quantized)}`);
    check(quantized[3] && quantized[3][2] >= 1,
        `une note trop brève pour la grille garde au moins une croche, au lieu de disparaître — obtenu ${JSON.stringify(quantized[3])}`);

    // ============================================================
    // === E. Doublons exacts fusionnés (piste doublée dans le DAW) ===
    // ============================================================
    const dupes = await page.evaluate(() => {
        const seg = segmentMidiNotes(parseMidiFile(mkMidi([
            { midi: 60, start: 0, dur: 480 },
            { midi: 60, start: 0, dur: 1920 },  // même note, même instant, plus longue
            { midi: 64, start: 0, dur: 480 },
        ], { bpm: 120, sig: [4, 4] })));
        return { notes: seg.notes.map(n => [n.midi, n.startStep, n.endStep]), warnings: seg.warnings };
    });
    check(dupes.notes.length === 2, `deux fois la même note au même instant n'en font qu'une — obtenu ${dupes.notes.length}`);
    check(dupes.notes.some(n => n[0] === 60 && n[2] === 16),
        `...et c'est la PLUS LONGUE qui est gardée (sinon on perdrait la tenue) — obtenu ${JSON.stringify(dupes.notes)}`);
    check(dupes.warnings.some(w => w.includes('double')), `le doublon est signalé — obtenu ${JSON.stringify(dupes.warnings)}`);

    // ============================================================
    // === F. Une note tenue par-dessus une barre sonne dans les DEUX mesures ===
    // ============================================================
    const across = await page.evaluate(() => {
        const seg = segmentMidiNotes(parseMidiFile(mkMidi([
            { midi: 60, start: 0, dur: 2 * 1920 },   // do tenu sur 2 mesures entières
            { midi: 64, start: 1920, dur: 1920 },    // mi seulement sur la 2e
        ], { bpm: 120, sig: [4, 4] })));
        return seg.bars.map(b => ({
            index: b.index,
            attaques: b.attacks.map(n => n.midi),
            resonnent: b.sounding.map(s => [s.note.midi, s.steps]),
        }));
    });
    check(across.length === 2, `deux mesures découpées — obtenu ${across.length}`);
    check(JSON.stringify(across[0].resonnent) === JSON.stringify([[60, 16]]) &&
          JSON.stringify(across[1].resonnent.sort()) === JSON.stringify([[60, 16], [64, 16]]),
        `le do tenu compte dans les deux mesures, avec sa durée réelle DANS chacune — obtenu ${JSON.stringify(across)}`);
    check(JSON.stringify(across[0].attaques) === JSON.stringify([60]) && JSON.stringify(across[1].attaques) === JSON.stringify([64]),
        `...mais il n'est ATTAQUÉ que dans la première : c'est ce qui distingue un accord rejoué d'un accord tenu — obtenu ${JSON.stringify(across.map(b => b.attaques))}`);

    // ============================================================
    // === G. Aller-retour complet sur un vrai morceau de l'appli ===
    // ============================================================
    const roundTrip = await page.evaluate(() => {
        const app = window.app;
        const sections = [{ title: 'T', chords: [
            { root: 'C', quality: 'maj', beats: 4, inversion: 0, drop: 0, octave: 3, instrument: 'piano' },
            { root: 'G', quality: 'maj', beats: 4, inversion: 0, drop: 0, octave: 3, instrument: 'piano' },
            { root: 'A', quality: 'min', beats: 4, inversion: 0, drop: 0, octave: 3, instrument: 'piano' },
            { root: 'F', quality: 'maj', beats: 4, inversion: 0, drop: 0, octave: 3, instrument: 'piano' },
        ] }];
        const seg = segmentMidiNotes(parseMidiFile(app.buildMidiFile(sections)));
        return {
            bars: seg.bars.length,
            bpm: seg.bpm, timeSig: seg.timeSig,
            // Classes de hauteur qui résonnent dans chaque mesure : c'est la matière que l'étape 3
            // va devoir reconnaître. On vérifie ici qu'elle arrive intacte, mesure par mesure.
            pcs: seg.bars.map(b => [...new Set(b.sounding.map(s => s.note.midi % 12))].sort((x, y) => x - y)),
            warnings: seg.warnings,
        };
    });
    check(roundTrip.bars === 4, `quatre accords d'une mesure -> quatre mesures — obtenu ${roundTrip.bars}`);
    check(roundTrip.warnings.length === 0, `aucun avertissement sur un fichier propre — obtenu ${JSON.stringify(roundTrip.warnings)}`);
    const attendu = [[0, 4, 7], [2, 7, 11], [0, 4, 9], [0, 5, 9]]; // C, G, Am, F
    check(JSON.stringify(roundTrip.pcs) === JSON.stringify(attendu),
        `chaque mesure rend exactement les notes de son accord d'origine (C, G, Am, F) — obtenu ${JSON.stringify(roundTrip.pcs)}`);

    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 || errors.length > 0 ? 1 : 0);
})();
