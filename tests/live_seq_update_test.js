const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// La police est chargée depuis Google Fonts : injoignable derrière le proxy du bac à sable,
// jamais un problème chez l'utilisateur. Ces échecs réseau sont donc filtrés — sinon ils font
// échouer « aucune erreur console » et masquent les vraies erreurs au milieu du bruit.

(async () => {
    const browser = await chromium.launch({
        args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const page = await browser.newPage({ viewport: { width: 500, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (msg) => { if (msg.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|fonts\.googleapis|fonts\.gstatic/.test(msg.text())) errors.push('console.error: ' + msg.text()); });

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        const mk = (root, quality, beats) => ({ root, quality, beats, inversion: 0, drop: 0, octave: 4, bass: null, playStyle: 'held' });
        const sections = [{ title: 'Couplet', chords: [mk('C', 'maj', 4), mk('A', 'min7', 4), mk('F', 'maj7', 4)] }];
        localStorage.setItem('myProgression', JSON.stringify({ sections }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);

    await page.click('#grid-zoom');
    await page.waitForTimeout(150);
    await page.evaluate(() => window.app.editChordFromGridZoom(0, 1)); // editing A min7
    await page.waitForTimeout(150);

    console.log('=== TEST 1: resize the EDITED chord live ===');
    let r = await page.evaluate(() => {
        const label = document.querySelector('#arp-sequencer .seq-page-label');
        return { label: label ? label.textContent : null, steps: document.querySelectorAll('#arp-sequencer .seq-cell[data-voice="0"]').length };
    });
    console.log('before resize:', JSON.stringify(r));

    const handle = await page.evaluate(() => {
        const cell = document.querySelector('.grid-cell[data-section="0"][data-index="1"]');
        const h = cell.querySelector('.cell-resize-right');
        const rect = h.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    });
    // grab column width to know how far to drag for +1 beat
    const colWidth = await page.evaluate(() => {
        const grid = document.querySelector('.chord-grid');
        const beatsPerRow = parseInt(grid.dataset.beatsPerRow) || 16;
        return grid.getBoundingClientRect().width / beatsPerRow;
    });
    await page.mouse.move(handle.x, handle.y);
    await page.mouse.down();
    await page.mouse.move(handle.x + Math.ceil(colWidth * 2.2), handle.y, { steps: 5 }); // drag right ~2 beats, MID-DRAG (no mouseup yet)
    await page.waitForTimeout(100);

    r = await page.evaluate(() => {
        const label = document.querySelector('#arp-sequencer .seq-page-label');
        const cellCount = document.querySelectorAll('#arp-sequencer .seq-cell[data-voice="0"]').length;
        return { label: label ? label.textContent : null, cellCount, liveBeats: JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[1].beats };
    });
    console.log('MID-DRAG (before mouseup):', JSON.stringify(r));
    const midDragPass = r.liveBeats > 4 && r.cellCount > 16; // more steps rendered live
    console.log(midDragPass ? 'PASS (sequencer updated live during resize drag)' : 'FAIL');

    await page.mouse.up();
    await page.waitForTimeout(150);

    console.log('=== TEST 2: move (reorder) a chord live, editingIndex should follow ===');
    // reset progression for a clean move test
    await page.evaluate(() => {
        const mk = (root, quality, beats) => ({ root, quality, beats, inversion: 0, drop: 0, octave: 4, bass: null, playStyle: 'held' });
        const sections = [{ title: 'Couplet', chords: [mk('C', 'maj', 4), mk('A', 'min7', 4), mk('F', 'maj7', 4), mk('G', '7', 4)] }];
        localStorage.setItem('myProgression', JSON.stringify({ sections }));
        window.app.closeGridZoom();
    });
    await page.click('#grid-zoom');
    await page.waitForTimeout(150);
    await page.evaluate(() => window.app.editChordFromGridZoom(0, 1)); // editing A min7 (index 1)
    await page.waitForTimeout(150);

    const src = await page.evaluate(() => {
        const cell = document.querySelector('.grid-cell[data-section="0"][data-index="1"]');
        const rect = cell.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    });
    const dst = await page.evaluate(() => {
        const cell = document.querySelector('.grid-cell[data-section="0"][data-index="3"]'); // drag A min7 (idx1) onto G7's position (idx3)
        const rect = cell.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    });
    await page.mouse.move(src.x, src.y);
    await page.mouse.down();
    await page.mouse.move((src.x + dst.x) / 2, src.y, { steps: 3 });
    await page.mouse.move(dst.x, dst.y, { steps: 5 });
    await page.waitForTimeout(100);

    r = await page.evaluate(() => {
        const chords = JSON.parse(localStorage.getItem('myProgression')).sections[0].chords;
        const pinnedTitle = document.getElementById('grid-zoom-pinned-title').textContent;
        return { editingIndex: window.app.editingIndex, order: chords.map(c => c.root + c.quality), pinnedTitle };
    });
    console.log('MID-DRAG move state:', JSON.stringify(r));
    // A min7 should have moved to wherever the array now has it, and editingIndex should point there,
    // and the pinned sequencer title should still say "Am7" (following the dragged chord, not a stale index)
    const movedIdx = r.order.indexOf('Amin7');
    const midMovePass = r.editingIndex === movedIdx && r.pinnedTitle.includes('Am');
    console.log(midMovePass ? 'PASS (editingIndex + pinned sequencer followed the dragged chord live)' : 'FAIL');

    await page.mouse.up();
    await page.waitForTimeout(150);

    r = await page.evaluate(() => {
        const chords = JSON.parse(localStorage.getItem('myProgression')).sections[0].chords;
        return { editingIndex: window.app.editingIndex, order: chords.map(c => c.root + c.quality) };
    });
    console.log('AFTER DROP:', JSON.stringify(r));
    const finalMovedIdx = r.order.indexOf('Amin7');
    const finalPass = r.editingIndex === finalMovedIdx;
    console.log(finalPass ? 'PASS (no double-shift bug after drop)' : 'FAIL');

    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
