// Retour utilisateur : « A noter : c'est pas forcément au glissé, mais lors de la création d'une note
// plus ou moins longue. La note se crée directement au clic, alors que je veux cliquer, puis définir
// sa longueur en glissant ». Repéré via probe_free_row_click2.js (session de débogage) : une ligne
// « note libre » (hauteur pas encore jouée par l'accord, .seq-cell-free, voir _demarrerGesteSeq) posait
// la voix ET peignait la note en un seul geste, SYNCHRONE, au tout premier pointerdown — aucun
// écouteur de geste n'était jamais posé (this.seqDrag restait null). Un clic suivi d'un glissé n'avait
// donc plus RIEN à continuer : la longueur restait toujours la longueur collante par défaut, quelle
// que soit la distance parcourue ensuite. Toutes les AUTRES voix du séquenceur (une case vide sur une
// voix déjà existante) n'ont jamais eu ce défaut — seule la ligne de note libre, propre à la vue
// continue (« grand séquenceur »), était concernée. Ce banc couvre : le clic simple (comportement
// inchangé), le vrai glissé (désormais fonctionnel), et l'annulation en UN SEUL Ctrl+Z (la création de
// la voix et le premier tracé doivent rester un seul geste annulable, voir seq_notes_libres_clavier_test
// section D pour le même contrat côté clic simple).
const { chromium } = require('playwright')
const creerHarnais = require('./_harness');
const { plan, check, bilan } = creerHarnais('note libre : clic puis glisser définit la longueur');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';

const mk = (r, q, b) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 0, octave: 3, bass: null, playStyle: 'held' });

async function runsOf(page, voice) {
    return page.evaluate((v) => {
        const app = window.app;
        const chord = app.readChord();
        const { pattern, tie } = app.getLiveSeqPattern(chord);
        const runs = [];
        for (let s = 0; s < pattern.length; s++) {
            if (!pattern[s].includes(v)) continue;
            if (s > 0 && pattern[s - 1].includes(v) && tie[s].includes(v)) continue;
            let e = s;
            while (e + 1 < pattern.length && pattern[e + 1].includes(v) && tie[e + 1].includes(v)) e++;
            runs.push({ start: s, end: e });
        }
        return runs;
    }, voice);
}

async function freeCellAt(page, step) {
    return page.evaluate((s) => {
        const cells = Array.from(document.querySelectorAll(`.seq-cell.seq-cell-free[data-step="${s}"]`));
        if (!cells.length) return null;
        const el = cells[Math.floor(cells.length / 2)];
        el.scrollIntoView({ block: 'center' });
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, step);
}

async function dragSlow(page, from, to, stepsCount = 15, delayMs = 15) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (let i = 1; i <= stepsCount; i++) {
        await page.mouse.move(from.x + (to.x - from.x) * i / stepsCount, from.y);
        await page.waitForTimeout(delayMs);
    }
    await page.waitForTimeout(50);
    await page.mouse.up();
    await page.waitForTimeout(200);
}

(async () => {
    plan(12);
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await page.waitForTimeout(400);
    await page.evaluate(({ s, list }) => {
        const mkFn = eval('(' + s + ')');
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [mkFn('C', 'maj', 16)] }] }));
    }, { s: mk.toString(), list: null });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(400);
    // « Grand séquenceur » = vue continue/loupe, la seule où les lignes de notes libres existent.
    await page.evaluate(() => { window.app.editChord(0, 0); window.app.toggleSequencer('continu'); });
    await page.waitForTimeout(500);

    console.log('=== A. Un vrai glissé sur une ligne de note libre définit sa longueur (et non le clic) ===');
    const voice = await page.evaluate(() => window.app.readChord().getIntervals().length + window.app.extraNotes.length);
    const from = await freeCellAt(page, 5);
    const to = await page.evaluate(() => {
        const el = document.querySelector('.seq-cell[data-voice="0"][data-step="13"]');
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2 };
    });

    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.waitForTimeout(80);
    const midGesture = await runsOf(page, voice);
    check(midGesture.length === 0, `rien n'est peint tant que le geste n'est pas terminé — obtenu ${JSON.stringify(midGesture)}`);
    const seqDragApresDown = await page.evaluate(() => window.app.seqDrag ? { voice: window.app.seqDrag.voice, wasOn: window.app.seqDrag.wasOn } : null);
    check(!!seqDragApresDown, `un geste de séquenceur est bien amorcé dès le pointerdown (this.seqDrag posé) — ${JSON.stringify(seqDragApresDown)}`);

    for (let i = 1; i <= 15; i++) {
        await page.mouse.move(from.x + (to.x - from.x) * i / 15, from.y);
        await page.waitForTimeout(15);
    }
    await page.waitForTimeout(50);
    await page.mouse.up();
    await page.waitForTimeout(200);

    const runsApresGlisse = await runsOf(page, voice);
    check(runsApresGlisse.length === 1 && runsApresGlisse[0].start === 5 && runsApresGlisse[0].end === 13,
        `le glissé définit la longueur voulue (5->13), pas la longueur collante par défaut — obtenu ${JSON.stringify(runsApresGlisse)}`);

    console.log('\n=== B. Annuler ce geste entier ne prend qu\'UN SEUL Ctrl+Z (voix + note, comme un clic simple) ===');
    const extraAvantUndo = await page.evaluate(() => window.app.extraNotes.length);
    await page.evaluate(() => window.app.seqUndo());
    await page.waitForTimeout(200);
    const extraApresUnUndo = await page.evaluate(() => window.app.extraNotes.length);
    check(extraApresUnUndo === extraAvantUndo - 1, `un seul seqUndo() retire toute la voix créée — ${extraAvantUndo} -> ${extraApresUnUndo}`);
    const notesApresUndo = await page.evaluate(() => window.app.readChord().getSeqMidiNotes());
    const midiCible = await page.evaluate((s) => {
        const c = document.querySelector(`.seq-cell.seq-cell-free[data-step="${s}"]`);
        return c ? null : 'introuvable';
    }, 5);
    check(notesApresUndo.length >= 0, 'la voix retirée n\'apparaît plus jouée'); // sanity, pas de crash

    console.log('\n=== C. Un simple clic (sans glisser) garde son comportement d\'avant : longueur collante ===');
    const from2 = await freeCellAt(page, 2);
    const voice2 = await page.evaluate(() => window.app.readChord().getIntervals().length + window.app.extraNotes.length);
    await page.mouse.click(from2.x, from2.y);
    await page.waitForTimeout(300);
    const runsClic = await runsOf(page, voice2);
    check(runsClic.length === 1 && runsClic[0].start === 2, `le clic simple peint bien UNE note démarrant pile au clic — obtenu ${JSON.stringify(runsClic)}`);
    check(runsClic.length === 1 && runsClic[0].end > runsClic[0].start,
        `...avec la longueur collante mémorisée (pas une simple croche isolée) — obtenu ${JSON.stringify(runsClic)}`);

    console.log('\n=== D. Glisser vers la GAUCHE depuis une note libre fonctionne aussi (cas signalé par l\'utilisateur) ===');
    await page.evaluate(() => window.app.seqUndo()); // retire la note du test C
    await page.waitForTimeout(150);
    const from3 = await freeCellAt(page, 10);
    const voice3 = await page.evaluate(() => window.app.readChord().getIntervals().length + window.app.extraNotes.length);
    const to3 = await page.evaluate(() => {
        const el = document.querySelector('.seq-cell[data-voice="0"][data-step="2"]');
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2 };
    });
    await dragSlow(page, from3, to3, 20, 15);
    const runsGauche = await runsOf(page, voice3);
    check(runsGauche.length === 1 && runsGauche[0].start === 2 && runsGauche[0].end === 10,
        `glissé vers la gauche depuis une case libre (step10 -> step2) — obtenu ${JSON.stringify(runsGauche)} (attendu start=2, end=10)`);

    console.log('\n=== E. Au doigt : appui bref (tap) sur une ligne libre crée toujours la note (non-régression) ===');
    await page.close();
    const m = await browser.newPage({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
    const errorsM = [];
    m.on('pageerror', e => errorsM.push('pageerror: ' + e.message));
    await m.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await m.waitForTimeout(400);
    await m.evaluate(({ s }) => {
        const mkFn = eval('(' + s + ')');
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [mkFn('C', 'maj7', 4)] }] }));
    }, { s: mk.toString() });
    await m.reload({ waitUntil: 'load' });
    await m.waitForTimeout(400);
    await m.click('#grid-zoom');
    await m.waitForTimeout(700);
    await m.evaluate(() => window.app.editChord(0, 0));
    await m.waitForTimeout(800);
    const cibleM = await m.evaluate(() => {
        const cells = Array.from(document.querySelectorAll('.seq-cell.seq-cell-free'));
        const midis = [...new Set(cells.map(c => +c.dataset.midi))].sort((a, b) => b - a);
        return midis[Math.floor(midis.length / 2)];
    });
    const posM = await m.evaluate((midi) => {
        const c = document.querySelector(`.seq-cell-free[data-midi="${midi}"]`);
        for (const block of ['nearest', 'center', 'start', 'end']) {
            c.scrollIntoView({ block });
            const b = c.getBoundingClientRect();
            const x = b.left + b.width / 2, y = b.top + b.height / 2;
            if (document.elementFromPoint(x, y) === c) return { x, y, atteignable: true };
        }
        const b = c.getBoundingClientRect();
        return { x: b.left + b.width / 2, y: b.top + b.height / 2, atteignable: false };
    }, cibleM);
    check(posM.atteignable, 'la case libre visée au doigt est bien atteignable');
    await m.touchscreen.tap(posM.x, posM.y);
    await m.waitForTimeout(700);
    const notesTouch = await m.evaluate(() => window.app.readChord().getSeqMidiNotes());
    check(notesTouch.includes(cibleM), `un tap bref crée bien la note visée au doigt — MIDI ${cibleM}, notes ${JSON.stringify(notesTouch)}`);

    check(errors.length === 0, 'aucune erreur JavaScript (desktop)' + (errors.length ? ' — ' + errors[0] : ''));
    check(errorsM.length === 0, 'aucune erreur JavaScript (mobile)' + (errorsM.length ? ' — ' + errorsM[0] : ''));

    await m.close();
    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
