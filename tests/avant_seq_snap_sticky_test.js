// Lot 2 : aimantation (1/4, 1/8, 1/16) et durée « collante » des nouvelles notes.
// Vérifie aussi que le réglage par défaut (1/16, aucune durée mémorisée) laisse le comportement
// historique rigoureusement inchangé.
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

async function runsOf(page, voice) {
    return page.evaluate((v) => {
        const app = window.app;
        const { pattern, tie } = app.getLiveSeqPattern(app.readChord());
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

async function clearVoice(page, voice) {
    await page.evaluate((v) => {
        const app = window.app;
        const { pattern } = app.getLiveSeqPattern(app.readChord());
        for (let s = 0; s < pattern.length; s++) app.applySeqCell(v, s, false);
        app.seqSelections = [];
        app.renderSequencer();
    }, voice);
    await page.waitForTimeout(120);
}

async function cellCenter(page, voice, step) {
    return page.evaluate(({ v, s }) => {
        const el = document.querySelector(`.seq-cell[data-voice="${v}"][data-step="${s}"]`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, { v: voice, s: step });
}

async function drag(page, from, to) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (let i = 1; i <= 12; i++) {
        await page.mouse.move(from.x + (to.x - from.x) * i / 12, from.y + (to.y - from.y) * i / 12);
        await page.waitForTimeout(8);
    }
    await page.mouse.up();
    await page.waitForTimeout(180);
}

async function setSnap(page, steps) {
    await page.click(`.seq-snap-btn[data-snap="${steps}"]`);
    await page.waitForTimeout(200);
}

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));

    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(700);
    await page.fill('#quick-add-input', 'C').catch(() => {});
    await page.click('#quick-add-btn').catch(() => {});
    await page.waitForTimeout(250);
    if (!(await page.evaluate(() => window.app.seqOpen))) await page.evaluate(() => window.app.toggleSequencer('compact'));
    await page.waitForTimeout(400);

    // ============================================================
    // === A. Le sélecteur existe et démarre sur 1/16 (aucune aimantation) ===
    // ============================================================
    check(await page.isVisible('.seq-snap-group'), 'le sélecteur d\'aimantation est bien présent dans la barre du séquenceur');
    const activeLabel = await page.evaluate(() => document.querySelector('.seq-snap-btn.active')?.textContent.trim());
    check(activeLabel === '1/16', `par défaut, l'aimantation est sur 1/16 (aucune) — obtenu ${activeLabel}`);
    check(await page.evaluate(() => window.app.seqSnap() === 1), 'seqSnap() vaut bien 1 croche par défaut');

    // ============================================================
    // === B. Sans aimantation : comportement historique inchangé ===
    // ============================================================
    await clearVoice(page, 0);
    await page.mouse.click(...Object.values(await cellCenter(page, 0, 5)));
    await page.waitForTimeout(200);
    let runs = await runsOf(page, 0);
    check(runs.length === 1 && runs[0].start === 5 && runs[0].end === 5,
        `sans aimantation, un clic pose bien UNE croche isolée pile où on clique — obtenu ${JSON.stringify(runs)}`);

    await clearVoice(page, 0);
    await drag(page, await cellCenter(page, 0, 3), await cellCenter(page, 0, 6));
    runs = await runsOf(page, 0);
    check(runs.length === 1 && runs[0].start === 3 && runs[0].end === 6,
        `sans aimantation, un glissé peint exactement 3->6 — obtenu ${JSON.stringify(runs)}`);

    // ============================================================
    // === C. Durée collante : après avoir dessiné une note de 4, un clic en repose une de 4 ===
    // ============================================================
    await clearVoice(page, 0);
    await drag(page, await cellCenter(page, 0, 0), await cellCenter(page, 0, 3)); // note de 4 croches
    await page.mouse.click(...Object.values(await cellCenter(page, 0, 8)));
    await page.waitForTimeout(200);
    runs = await runsOf(page, 0);
    const sticky = runs.find(r => r.start === 8);
    check(sticky && sticky.end === 11,
        `la nouvelle note reprend la durée de la dernière dessinée (4 croches) — obtenu ${JSON.stringify(runs)}`);

    // ...mais sans jamais empiéter sur une note déjà là
    await clearVoice(page, 0);
    await drag(page, await cellCenter(page, 0, 0), await cellCenter(page, 0, 3)); // mémorise 4
    await page.evaluate(() => { const a = window.app; a.applySeqCell(0, 10, true, false); a.renderSequencer(); });
    await page.waitForTimeout(150);
    await page.mouse.click(...Object.values(await cellCenter(page, 0, 8)));
    await page.waitForTimeout(200);
    runs = await runsOf(page, 0);
    const clipped = runs.find(r => r.start === 8);
    check(clipped && clipped.end === 9,
        `la durée collante est rabotée avant la note suivante, jamais écrasée — obtenu ${JSON.stringify(runs)}`);

    // ============================================================
    // === D. Aimantation 1/4 : le clic se cale sur le temps, et pose une noire ===
    // ============================================================
    await setSnap(page, 4);
    check(await page.evaluate(() => window.app.seqSnap() === 4), 'seqSnap() vaut bien 4 croches après avoir choisi 1/4');
    check(await page.evaluate(() => window.app.seqStickyLen === null),
        'changer d\'aimantation remet la durée collante à zéro (sinon 1/4 ne donnerait pas des noires)');

    await clearVoice(page, 0);
    await page.mouse.click(...Object.values(await cellCenter(page, 0, 6)));
    await page.waitForTimeout(200);
    runs = await runsOf(page, 0);
    check(runs.length === 1 && runs[0].start === 4 && runs[0].end === 7,
        `en 1/4, un clic sur la croche 6 pose une NOIRE calée sur le temps (4->7) — obtenu ${JSON.stringify(runs)}`);

    // ============================================================
    // === E. Aimantation 1/4 : un glissé se cale sur des temps entiers ===
    // ============================================================
    await clearVoice(page, 0);
    await drag(page, await cellCenter(page, 0, 1), await cellCenter(page, 0, 9));
    runs = await runsOf(page, 0);
    check(runs.length === 1 && runs[0].start === 0 && runs[0].end % 4 === 3,
        `en 1/4, un glissé 1->9 donne une note calée début ET fin sur le temps — obtenu ${JSON.stringify(runs)}`);

    // ============================================================
    // === F. Aimantation 1/4 : étirer un bord ne peut pas descendre sous le temps ===
    // ============================================================
    await clearVoice(page, 0);
    await drag(page, await cellCenter(page, 0, 0), await cellCenter(page, 0, 7)); // deux temps
    runs = await runsOf(page, 0);
    const twoBeats = runs[0];
    check(twoBeats.start === 0 && twoBeats.end === 7, `note de deux temps posée — obtenu ${JSON.stringify(runs)}`);
    // Ramené DANS le 1er temps : la règle est « le cran survolé est couvert en entier », donc la note
    // s'arrête à la fin de ce temps-là (croche 3), jamais au milieu.
    await drag(page, await cellCenter(page, 0, 7), await cellCenter(page, 0, 2));
    runs = await runsOf(page, 0);
    check(runs.length === 1 && runs[0].start === 0 && runs[0].end === 3,
        `étirer le bord droit en 1/4 s'arrête pile sur un temps entier (0->3) — obtenu ${JSON.stringify(runs)}`);
    // ...et rester DANS le 2e temps le laisse couvert en entier, sans rétrécissement à la croche près.
    await drag(page, await cellCenter(page, 0, 3), await cellCenter(page, 0, 5));
    runs = await runsOf(page, 0);
    check(runs.length === 1 && runs[0].start === 0 && runs[0].end === 7,
        `survoler le 2e temps le couvre en entier (0->7), jamais un bout de temps — obtenu ${JSON.stringify(runs)}`);

    // ============================================================
    // === G. Aimantation 1/8 : déplacer une note la recale sur la demi-mesure ===
    // ============================================================
    await setSnap(page, 2);
    await clearVoice(page, 0);
    // Note de 4 croches : elle a des cases de CORPS (ni au début ni à la fin), depuis lesquelles le
    // glissé horizontal déplace.
    await drag(page, await cellCenter(page, 0, 0), await cellCenter(page, 0, 3));
    runs = await runsOf(page, 0);
    check(runs.length === 1 && runs[0].start === 0 && runs[0].end === 3, `note de 4 croches posée en 1/8 — obtenu ${JSON.stringify(runs)}`);
    await drag(page, await cellCenter(page, 0, 1), await cellCenter(page, 0, 6));
    runs = await runsOf(page, 0);
    check(runs.length === 1 && runs[0].start % 2 === 0 && (runs[0].end - runs[0].start) === 3,
        `en 1/8, la note déplacée retombe sur un multiple de 2 croches, longueur intacte — obtenu ${JSON.stringify(runs)}`);

    // CONTRAT CHANGÉ (à la demande : « mettre un corps aux notes qui n'en ont pas »). Une note de deux
    // croches n'avait que des bords : le centre de sa seconde case ÉTIRAIT, faute de mieux. Elle se
    // découpe désormais au pixel (voir seqShortNoteZone) — ce point-là tombe dans son CORPS, donc le
    // même geste la DÉPLACE, en respectant l'aimantation comme n'importe quel déplacement.
    await clearVoice(page, 0);
    await drag(page, await cellCenter(page, 0, 0), await cellCenter(page, 0, 1));
    await drag(page, await cellCenter(page, 0, 1), await cellCenter(page, 0, 5));
    runs = await runsOf(page, 0);
    check(runs.length === 1 && runs[0].start % 2 === 0 && (runs[0].end - runs[0].start) === 1,
        `en 1/8, une note de 2 croches saisie par son corps se DÉPLACE sur un multiple de 2 croches, longueur intacte — obtenu ${JSON.stringify(runs)}`);

    // ...et depuis sa vraie POIGNÉE (les tout derniers pixels), elle s'étire toujours, aimantée pareil.
    await clearVoice(page, 0);
    await drag(page, await cellCenter(page, 0, 0), await cellCenter(page, 0, 1));
    const b2c = await page.evaluate(() => {
        const n = document.querySelector('.seq-note[data-voice="0"][data-start="0"][data-end="1"]');
        const r = n.getBoundingClientRect();
        return { x: r.right - 2, y: r.top + r.height / 2 };
    });
    await drag(page, b2c, await cellCenter(page, 0, 5));
    runs = await runsOf(page, 0);
    check(runs.length === 1 && runs[0].start === 0 && runs[0].end === 5,
        `une note de 2 croches s'étire toujours depuis sa poignée de fin (0->5) — obtenu ${JSON.stringify(runs)}`);

    // ============================================================
    // === H. Le réglage survit à un rechargement ===
    // ============================================================
    await page.reload();
    await page.waitForTimeout(600);
    check(await page.evaluate(() => window.app.seqSnap() === 2),
        `le pas d'aimantation choisi (1/8) survit bien à un rechargement — obtenu ${await page.evaluate(() => window.app.seqSnap())}`);
    // Remet le défaut, pour ne pas polluer les autres suites qui partagent ce profil de navigateur.
    await page.evaluate(() => localStorage.removeItem('harmohubSeqSnap'));

    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 || errors.length > 0 ? 1 : 0);
})();
