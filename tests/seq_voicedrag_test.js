const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// La police est chargée depuis Google Fonts : injoignable derrière le proxy du bac à sable,
// jamais un problème chez l'utilisateur. Ces échecs réseau sont donc filtrés — sinon ils font
// échouer « aucune erreur console » et masquent les vraies erreurs au milieu du bruit.

(async () => {
    const browser = await chromium.launch({
        args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (msg) => { if (msg.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|fonts\.googleapis|fonts\.gstatic/.test(msg.text())) errors.push('console.error: ' + msg.text()); });

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        const sections = [{ title: 'Couplet', chords: [
            { root: 'C', quality: 'maj7', beats: 4, inversion: 0, drop: 0, octave: 4, bass: null, playStyle: 'held' },
        ]}];
        localStorage.setItem('myProgression', JSON.stringify({ sections }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);

    await page.evaluate(() => {
        window.app.editChord(0, 0);
        if (!window.app.seqOpen) window.app.toggleSequencer();
        // efface tout, puis peint 2 croches staccato sur la voix 0, steps 2-3
        window.app.applySeqCell2 = null;
    });
    await page.waitForTimeout(100);
    // clear voice0 pattern entirely and paint just steps 2,3
    await page.evaluate(() => {
        for (let s = 0; s < 16; s++) window.app.applySeqCell(0, s, false);
        window.app.applySeqCell(0, 2, true, false);
        window.app.applySeqCell(0, 3, true, true);
        window.app.renderSequencer();
    });
    await page.waitForTimeout(100);

    const noteRect = async (voice, start, end) => page.evaluate(({ voice, start, end }) => {
        const el = document.querySelector(`.seq-note[data-voice="${voice}"][data-start="${start}"][data-end="${end}"]`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, { voice, start, end });

    const cellRect = async (voice, step) => page.evaluate(({ voice, step }) => {
        const el = document.querySelector(`.seq-cell[data-voice="${voice}"][data-step="${step}"]`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, { voice, step });

    console.log('--- MOVE: drag voice0[2,3] straight down onto voice2 (no Ctrl) ---');
    let src = await noteRect(0, 2, 3);
    let dst = await cellRect(2, 2); // land on voice2's step-2 cell (same column, different row)
    console.log('src:', JSON.stringify(src), 'dst:', JSON.stringify(dst));
    await page.mouse.move(src.x, src.y);
    await page.mouse.down();
    await page.mouse.move(src.x, src.y - 10, { steps: 2 }); // small vertical move to cross the 8px threshold, mostly vertical
    await page.waitForTimeout(30);
    let mid = await page.evaluate(() => {
        const ghost = document.querySelector('.seq-note-ghost');
        return { hasGhost: !!ghost, cls: ghost ? ghost.className : null };
    });
    console.log('mid-drag (after small vertical move):', JSON.stringify(mid));
    await page.mouse.move(dst.x, dst.y, { steps: 5 });
    await page.waitForTimeout(30);
    mid = await page.evaluate(() => {
        const ghost = document.querySelector('.seq-note-ghost');
        return { cls: ghost ? ghost.className : null };
    });
    console.log('over target row:', JSON.stringify(mid));
    await page.mouse.up();
    await page.waitForTimeout(100);

    let r = await page.evaluate(() => {
        const chord = window.app.readChord();
        const { pattern, tie } = window.app.getLiveSeqPattern(chord);
        return {
            voice0: pattern.map(s => s.includes(0)),
            voice2on: pattern.map(s => s.includes(2)),
            voice2tie: tie.map(s => s.includes(2)),
        };
    });
    console.log('after move:', JSON.stringify(r));
    const movePass = !r.voice0.some(Boolean) && r.voice2on[2] && r.voice2on[3] && !r.voice2tie[2] && r.voice2tie[3] && !r.voice2on[4];
    console.log(movePass ? 'PASS (moved to voice 2, source cleared)' : 'FAIL');

    console.log('--- COPY (Ctrl held): drag voice2[2,3] onto voice1 ---');
    src = await noteRect(2, 2, 3);
    dst = await cellRect(1, 2);
    await page.keyboard.down('Control');
    await page.mouse.move(src.x, src.y);
    await page.mouse.down();
    await page.mouse.move(src.x, src.y - 10, { steps: 2 });
    await page.mouse.move(dst.x, dst.y, { steps: 5 });
    await page.waitForTimeout(30);
    await page.mouse.up();
    await page.keyboard.up('Control');
    await page.waitForTimeout(100);

    r = await page.evaluate(() => {
        const chord = window.app.readChord();
        const { pattern } = window.app.getLiveSeqPattern(chord);
        return {
            voice1: pattern.map(s => s.includes(1)),
            voice2: pattern.map(s => s.includes(2)),
        };
    });
    console.log('after copy:', JSON.stringify(r));
    const copyPass = r.voice1[2] && r.voice1[3] && r.voice2[2] && r.voice2[3]; // both source AND target retain the pattern
    console.log(copyPass ? 'PASS (copied to voice 1, source kept on voice 2)' : 'FAIL');

    console.log('--- Fix (retour utilisateur) : horizontal drag from the MIDDLE of a note (not an edge) no longer erases/splits it — it MOVES it ---');
    await page.evaluate(() => {
        for (let s = 0; s < 16; s++) window.app.applySeqCell(3, s, false);
        window.app.applySeqCell(3, 4, true, false);
        window.app.applySeqCell(3, 5, true, true);
        window.app.applySeqCell(3, 6, true, true);
        window.app.applySeqCell(3, 7, true, true);
        window.app.applySeqCell(3, 8, true, true);
        window.app.renderSequencer();
    });
    await page.waitForTimeout(80);
    const c6 = await cellRect(3, 6); // middle of the 4..8 run: neither start nor end
    const c8 = await cellRect(3, 8);
    await page.mouse.move(c6.x, c6.y);
    await page.mouse.down();
    await page.mouse.move(c6.x + 10, c6.y, { steps: 2 }); // mostly horizontal
    await page.mouse.move(c8.x, c8.y, { steps: 5 });
    await page.waitForTimeout(30);
    await page.mouse.up();
    await page.waitForTimeout(80);
    r = await page.evaluate(() => {
        const chord = window.app.readChord();
        const { pattern } = window.app.getLiveSeqPattern(chord);
        return { voice3: pattern.map(s => s.includes(3)) };
    });
    console.log('after horizontal drag from middle (must stay ONE intact 5-step run, moved by +2):', JSON.stringify(r));
    // CONTRAT CHANGÉ depuis l'écriture de ce test : ce geste ne faisait rien à l'époque, il DÉPLACE
    // désormais la note (voir beginSeqHDrag). Ce qui compte ici reste le fond du retour utilisateur :
    // la note ne doit jamais être érodée ni scindée. On vérifie donc qu'elle est toujours d'un seul
    // tenant et de la même longueur — et, le glissé allant de la croche 6 à la 8, qu'elle est arrivée
    // deux croches plus loin (6..10).
    const allumees = r.voice3.map((v, i) => (v ? i : -1)).filter(i => i >= 0);
    const dUnSeulTenant = allumees.length === 5 && allumees[4] - allumees[0] === 4;
    const erasePass = dUnSeulTenant && allumees[0] === 6;
    console.log(erasePass ? 'PASS (mid-note drag moves the note whole, never erases or splits it)' : 'FAIL');

    console.log('--- Regression: horizontal drag from an EDGE still resizes (existing behavior) ---');
    await page.evaluate(() => {
        for (let s = 0; s < 16; s++) window.app.applySeqCell(3, s, false);
        window.app.applySeqCell(3, 5, true, false);
        window.app.applySeqCell(3, 6, true, true);
        window.app.applySeqCell(3, 7, true, true);
        window.app.renderSequencer();
    });
    await page.waitForTimeout(80);
    const c5 = await cellRect(3, 5);
    const c9 = await cellRect(3, 9);
    await page.mouse.move(c5.x, c5.y);
    await page.mouse.down();
    await page.mouse.move(c5.x - 10, c5.y, { steps: 2 }); // mostly horizontal, away from the note (extend)
    await page.mouse.move(c9.x, c9.y, { steps: 5 });
    await page.waitForTimeout(30);
    await page.mouse.up();
    await page.waitForTimeout(80);
    r = await page.evaluate(() => {
        const chord = window.app.readChord();
        const { pattern } = window.app.getLiveSeqPattern(chord);
        return { voice3: pattern.map(s => s.includes(3)) };
    });
    console.log('after edge resize attempt (dragged start edge away from note, then to step 9):', JSON.stringify(r));

    console.log('Errors collected:', JSON.stringify(errors, null, 2));

    await browser.close();
    process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
