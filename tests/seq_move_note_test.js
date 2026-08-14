// Lot 1-E : glisser une note horizontalement doit la DÉPLACER dans le temps (geste GarageBand),
// sans casser l'étirement depuis un bord, le changement de voix (vertical) ni Alt+glisser (copie).
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

// Renvoie les "runs" (notes) d'une voix : [{start, end}, ...], lus depuis le motif vivant.
async function runsOf(page, voice) {
    return page.evaluate((v) => {
        const app = window.app;
        const chord = app.readChord();
        const { pattern, tie } = app.getLiveSeqPattern(chord);
        const runs = [];
        for (let s = 0; s < pattern.length; s++) {
            if (!pattern[s].includes(v)) continue;
            if (s > 0 && pattern[s - 1].includes(v) && tie[s].includes(v)) continue; // milieu d'une note
            let e = s;
            while (e + 1 < pattern.length && pattern[e + 1].includes(v) && tie[e + 1].includes(v)) e++;
            runs.push({ start: s, end: e });
        }
        return runs;
    }, voice);
}

async function cellCenter(page, voice, step) {
    return page.evaluate(({ v, s }) => {
        const el = document.querySelector(`.seq-cell[data-voice="${v}"][data-step="${s}"]`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, { v: voice, s: step });
}

// Glissé pointeur en plusieurs étapes (le code exige un vrai franchissement de seuil de 10px).
async function drag(page, from, to, opts = {}) {
    await page.mouse.move(from.x, from.y);
    if (opts.alt) await page.keyboard.down('Alt');
    await page.mouse.down();
    const steps = 12;
    for (let i = 1; i <= steps; i++) {
        await page.mouse.move(from.x + (to.x - from.x) * i / steps, from.y + (to.y - from.y) * i / steps);
        await page.waitForTimeout(8);
    }
    await page.mouse.up();
    if (opts.alt) await page.keyboard.up('Alt');
    await page.waitForTimeout(180);
}

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));

    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(700);

    // Ouvre le séquenceur sur un accord neuf.
    await page.fill('#quick-add-input', 'C').catch(() => {});
    await page.click('#quick-add-btn').catch(() => {});
    await page.waitForTimeout(250);
    const seqOpen = await page.evaluate(() => window.app.seqOpen);
    if (!seqOpen) await page.click('#toggle-sequencer');
    await page.waitForTimeout(400);
    check(await page.evaluate(() => window.app.seqOpen), 'le séquenceur est bien ouvert');

    // Table rase sur la voix 0 pour partir d'un état connu.
    await page.evaluate(() => {
        const app = window.app;
        const chord = app.readChord();
        const { pattern } = app.getLiveSeqPattern(chord);
        for (let s = 0; s < pattern.length; s++) app.applySeqCell(0, s, false);
        app.seqSelections = [];
        app.renderSequencer();
    });
    await page.waitForTimeout(150);

    // ============================================================
    // === A. Pose une note de 4 croches (pas 0->3) en peignant ===
    // ============================================================
    await drag(page, await cellCenter(page, 0, 0), await cellCenter(page, 0, 3));
    let runs = await runsOf(page, 0);
    check(runs.length === 1 && runs[0].start === 0 && runs[0].end === 3,
        `note de départ posée sur 0-3 — obtenu ${JSON.stringify(runs)}`);

    // ============================================================
    // === B. LE GESTE NOUVEAU : glisser le CORPS (pas 1) vers la droite déplace la note ===
    // ============================================================
    await drag(page, await cellCenter(page, 0, 1), await cellCenter(page, 0, 5));
    runs = await runsOf(page, 0);
    check(runs.length === 1 && runs[0].start === 4 && runs[0].end === 7,
        `glisser le corps de +4 déplace la note entière sur 4-7, longueur inchangée — obtenu ${JSON.stringify(runs)}`);

    const selAfterMove = await page.evaluate(() => JSON.parse(JSON.stringify(window.app.seqSelections)));
    check(selAfterMove.length === 1 && selAfterMove[0].start === 4 && selAfterMove[0].end === 7,
        `la note déplacée reste sélectionnée à sa NOUVELLE position — obtenu ${JSON.stringify(selAfterMove)}`);

    // ============================================================
    // === C. Déplacement vers la gauche, de MOINS que sa propre longueur (chevauchement avec soi) ===
    // ============================================================
    await drag(page, await cellCenter(page, 0, 5), await cellCenter(page, 0, 4));
    runs = await runsOf(page, 0);
    check(runs.length === 1 && runs[0].start === 3 && runs[0].end === 6,
        `décalage d'UNE seule croche vers la gauche possible (pas de « résistance » comme pour une copie) — obtenu ${JSON.stringify(runs)}`);

    // ============================================================
    // === D. Ctrl+Z rend bien la position d'avant le déplacement ===
    // ============================================================
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(220);
    runs = await runsOf(page, 0);
    check(runs.length === 1 && runs[0].start === 4 && runs[0].end === 7,
        `Ctrl+Z annule le déplacement en un coup — obtenu ${JSON.stringify(runs)}`);
    await page.keyboard.press('Control+y');
    await page.waitForTimeout(220);

    // ============================================================
    // === E. NON-RÉGRESSION : étirer depuis un BORD étire toujours (ne déplace pas) ===
    // ============================================================
    runs = await runsOf(page, 0);
    const before = runs[0];
    await drag(page, await cellCenter(page, 0, before.end), await cellCenter(page, 0, before.end + 2));
    runs = await runsOf(page, 0);
    check(runs.length === 1 && runs[0].start === before.start && runs[0].end === before.end + 2,
        `glisser depuis le BORD DROIT étire toujours la note (début inchangé) — obtenu ${JSON.stringify(runs)}`);

    // ============================================================
    // === F. NON-RÉGRESSION : Alt+glisser horizontal duplique toujours (2 notes) ===
    // ============================================================
    runs = await runsOf(page, 0);
    const body = Math.floor((runs[0].start + runs[0].end) / 2);
    const len = runs[0].end - runs[0].start + 1;
    await drag(page, await cellCenter(page, 0, body), await cellCenter(page, 0, body + len + 1), { alt: true });
    runs = await runsOf(page, 0);
    check(runs.length === 2, `Alt+glisser duplique toujours : 2 notes sur la voix — obtenu ${JSON.stringify(runs)}`);

    // ============================================================
    // === G. NON-RÉGRESSION : glisser VERTICALEMENT depuis le corps change toujours de voix ===
    // ============================================================
    await page.evaluate(() => {
        const app = window.app;
        const chord = app.readChord();
        const { pattern } = app.getLiveSeqPattern(chord);
        for (let s = 0; s < pattern.length; s++) { app.applySeqCell(0, s, false); app.applySeqCell(1, s, false); }
        for (let s = 0; s < 4; s++) app.applySeqCell(0, s, true, s !== 0);
        app.seqSelections = [];
        app.renderSequencer();
    });
    await page.waitForTimeout(200);
    await drag(page, await cellCenter(page, 0, 1), await cellCenter(page, 1, 1));
    const v0 = await runsOf(page, 0), v1 = await runsOf(page, 1);
    check(v0.length === 0 && v1.length === 1 && v1[0].start === 0 && v1[0].end === 3,
        `glisser vers le BAS déplace toujours la note vers l'autre voix — voix0=${JSON.stringify(v0)} voix1=${JSON.stringify(v1)}`);

    // ============================================================
    // === H. NON-RÉGRESSION : un simple clic sur une note la sélectionne sans rien déplacer ===
    // ============================================================
    const c = await cellCenter(page, 1, 1);
    await page.mouse.click(c.x, c.y);
    await page.waitForTimeout(200);
    const v1after = await runsOf(page, 1);
    const sel = await page.evaluate(() => JSON.parse(JSON.stringify(window.app.seqSelections)));
    check(v1after.length === 1 && v1after[0].start === 0 && v1after[0].end === 3,
        `un simple clic ne déplace rien — obtenu ${JSON.stringify(v1after)}`);
    check(sel.length === 1 && sel[0].voice === 1, `un simple clic sélectionne bien la note — obtenu ${JSON.stringify(sel)}`);

    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 || errors.length > 0 ? 1 : 0);
})();
