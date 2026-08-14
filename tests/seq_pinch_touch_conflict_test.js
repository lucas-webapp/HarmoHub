const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

let PASS = 0, FAIL = 0;
function check(cond, label) {
    if (cond) { PASS++; console.log('PASS - ' + label); }
    else { FAIL++; console.log('FAIL - ' + label); }
}

(async () => {
    const browser = await chromium.launch({
        args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const page = await browser.newPage({ viewport: { width: 390, height: 700 }, hasTouch: true, isMobile: true });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (msg) => { if (msg.type() === 'error' && !msg.text().includes('CONNECTION') && !msg.text().includes('TUNNEL')) errors.push('console.error: ' + msg.text()); });

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [
            { root: 'C', quality: 'maj7', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
        ] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);
    await page.evaluate(() => { window.app.openGridZoom(); window.app.editChordFromGridZoom(0, 0); });
    await page.waitForTimeout(150);

    const before = await page.evaluate(() => {
        const chord = window.app.readChord();
        const { pattern, tie } = window.app.getLiveSeqPattern(chord);
        return { pattern: pattern.map(s => s.slice()), tie: tie.map(s => s.slice()) };
    });
    console.log('pattern before:', JSON.stringify(before.pattern));

    console.log('=== Pincer à 2 doigts, chacun posé sur une VRAIE .seq-cell (hit-test réel, pas synthétique sur le conteneur) ===');
    const result = await page.evaluate(() => {
        const cellA = document.querySelector('.seq-cell[data-voice="0"][data-step="2"]');
        const cellB = document.querySelector('.seq-cell[data-voice="1"][data-step="10"]');
        const rA = cellA.getBoundingClientRect(), rB = cellB.getBoundingClientRect();
        const mk = (type, id, el, r) => new PointerEvent(type, {
            pointerId: id, pointerType: 'touch', clientX: r.left + r.width / 2, clientY: r.top + r.height / 2,
            bubbles: true, cancelable: true,
        });
        // Doigt A se pose sur une case (déclenche normalement onSeqPointerDown -> paint drag)
        cellA.dispatchEvent(mk('pointerdown', 1, cellA, rA));
        // Doigt B se pose sur une AUTRE case peu après (2e doigt : doit annuler le glissé de A, voir
        // cancelSeqGestureForPinch, et alimenter le pincer-zoomer, voir setupPinchZoom)
        cellB.dispatchEvent(mk('pointerdown', 2, cellB, rB));
        // Les deux doigts s'écartent : mouvement realiste passant par un point intermédiaire
        const mkMove = (id, el, r, dx, dy) => new PointerEvent('pointermove', {
            pointerId: id, pointerType: 'touch', clientX: r.left + r.width / 2 + dx, clientY: r.top + r.height / 2 + dy,
            bubbles: true, cancelable: true,
        });
        cellA.dispatchEvent(mkMove(1, cellA, rA, -40, -40));
        cellB.dispatchEvent(mkMove(2, cellB, rB, 40, 40));
        cellA.dispatchEvent(mkMove(1, cellA, rA, -80, -80));
        cellB.dispatchEvent(mkMove(2, cellB, rB, 80, 80));
        cellA.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, pointerType: 'touch', bubbles: true, cancelable: true }));
        cellB.dispatchEvent(new PointerEvent('pointerup', { pointerId: 2, pointerType: 'touch', bubbles: true, cancelable: true }));
        const chord = window.app.readChord();
        const { pattern, tie } = window.app.getLiveSeqPattern(chord);
        return {
            pattern: pattern.map(s => s.slice()),
            tie: tie.map(s => s.slice()),
            seqDrag: window.app.seqDrag,
            activeTouches: [...window.app._seqActiveTouchIds],
            zoomX: window.app.seqZoomLevelX, zoomY: window.app.seqZoomLevelY,
        };
    });
    console.log('pattern after pinch:', JSON.stringify(result.pattern));
    console.log('zoom after:', result.zoomX, result.zoomY, 'seqDrag:', result.seqDrag, 'activeTouches:', result.activeTouches);

    check(JSON.stringify(result.pattern) === JSON.stringify(before.pattern), "le motif n'a PAS été modifié par le pincement (pas de peinture parasite)");
    check(JSON.stringify(result.tie) === JSON.stringify(before.tie), "les liaisons n'ont pas été modifiées non plus");
    check(result.seqDrag === null, 'aucun glissé de peinture ne reste actif après le pincement');
    check(result.activeTouches.length === 0, 'plus aucun doigt suivi comme actif après le relâchement des deux');
    check(result.zoomX > 1 && result.zoomY > 1, 'le zoom (H et V) a bien augmenté grâce au pincement');

    console.log('=== Après le pincement, un simple tap à un seul doigt peint de nouveau normalement ===');
    const singleFingerResult = await page.evaluate(() => {
        const cell = document.querySelector('.seq-cell[data-voice="2"][data-step="0"]');
        const r = cell.getBoundingClientRect();
        cell.dispatchEvent(new PointerEvent('pointerdown', {
            pointerId: 99, pointerType: 'touch', clientX: r.left + r.width / 2, clientY: r.top + r.height / 2,
            bubbles: true, cancelable: true,
        }));
        window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 99, pointerType: 'touch', bubbles: true, cancelable: true }));
        const chord = window.app.readChord();
        const { pattern } = window.app.getLiveSeqPattern(chord);
        return { voice2Step0: pattern[0].includes(2), selections: window.app.seqSelections };
    });
    console.log(JSON.stringify(singleFingerResult));
    check(Array.isArray(singleFingerResult.selections), 'un tap simple après le pincement retombe bien sur le comportement normal (sélection)');

    console.log('\n=== Bilan : ' + PASS + ' PASS / ' + FAIL + ' FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
