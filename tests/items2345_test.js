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
        const mk = (root, quality) => ({ root, quality, beats: 4, inversion: 0, drop: 0, octave: 4, bass: null, playStyle: 'held' });
        const sections = [{ title: 'Couplet', chords: [mk('C', 'maj'), mk('D', 'min'), mk('E', 'min'), mk('F', 'maj'), mk('G', '7'), mk('A', 'min')] }];
        localStorage.setItem('myProgression', JSON.stringify({ sections }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);

    console.log('--- Item 2: reverse button removed ---');
    let r = await page.evaluate(() => ({
        hasReverseBtn: !!document.querySelector('.prog-section-reverse'),
        hasReverseMethod: typeof window.app.reverseSectionChords,
    }));
    console.log(JSON.stringify(r));
    console.log((!r.hasReverseBtn && r.hasReverseMethod === 'undefined') ? 'PASS (removed)' : 'FAIL');

    console.log('--- Item 4: no orange/gold cell tint when loop range is set ---');
    await page.click('#grid-zoom');
    await page.waitForTimeout(150);
    // Define a loop range spanning chords 0-2 (drag on the measure-number row)
    await page.evaluate(() => window.app.setLoopRange(0, 0, 0, 2));
    await page.waitForTimeout(100);
    r = await page.evaluate(() => {
        const cell = document.querySelector('.grid-cell[data-section="0"][data-index="1"]');
        const bg = cell.style.backgroundImage;
        return { hasGoldTint: bg.includes('255, 213, 79') || bg.includes('rgba(255,213,79'), bg };
    });
    console.log(JSON.stringify(r));
    console.log(!r.hasGoldTint ? 'PASS (no gold tint on cell)' : 'FAIL');

    console.log('--- Item 3: clicking an EXISTING loop range at a bar-start position grabs it (not "new") ---');
    r = await page.evaluate(() => {
        // range is 0..2; find the row-measure or bar for chord index 1 (a bar-start, likely overlapped
        // by both .row-measure and .loop-range-bar at the same grid cell)
        const cell = document.querySelector('.grid-cell[data-section="0"][data-index="1"]');
        const rect = cell.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.bottom + 8 }; // measure-number row just below the cell
    });
    // Simulate pointerdown/up (tap, no movement) exactly on that spot - should DELETE the range (bar-tap), not create a fresh 1-chord range
    await page.mouse.move(r.x, r.y);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(100);
    r = await page.evaluate(() => ({ loopRange: window.app.loopRange }));
    console.log('after tap on existing range:', JSON.stringify(r));
    console.log(r.loopRange === null ? 'PASS (tap on existing range deleted it, not redefined to a single chord)' : 'FAIL');

    console.log('--- Item 5: octave float hidden by default, appears above selected/editing chord ---');
    r = await page.evaluate(() => ({
        hiddenByDefault: document.getElementById('grid-cell-octave-float').hidden,
        hasPerCellOctaveBtn: !!document.querySelector('.grid-cell .cell-octave-btn'),
    }));
    console.log(JSON.stringify(r));
    await page.evaluate(() => window.app.editChordFromGridZoom(0, 2));
    await page.waitForTimeout(150);
    r = await page.evaluate(() => {
        const float = document.getElementById('grid-cell-octave-float');
        const cell = document.querySelector('.grid-cell[data-section="0"][data-index="2"]');
        const cellRect = cell.getBoundingClientRect();
        const floatRect = float.getBoundingClientRect();
        return {
            visible: !float.hidden,
            aboveCell: floatRect.bottom <= cellRect.top + 2, // roughly above
            horizontallyAligned: Math.abs((floatRect.left + floatRect.width/2) - (cellRect.left + cellRect.width/2)) < 5,
        };
    });
    console.log(JSON.stringify(r));
    console.log((r.visible && r.aboveCell) ? 'PASS (float shown above editing chord)' : 'FAIL');

    // test the up/down buttons actually work
    r = await page.evaluate(() => {
        const before = JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[2].octave;
        document.getElementById('grid-cell-octave-up').click();
        const after = JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[2].octave;
        return { before, after };
    });
    console.log('octave up click:', JSON.stringify(r));
    console.log((r.after === (r.before||3) + 1) ? 'PASS (octave button works)' : 'FAIL');

    console.log('Errors collected:', JSON.stringify(errors, null, 2));
    await browser.close();
    process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
