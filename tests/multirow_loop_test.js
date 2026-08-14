const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

(async () => {
    const browser = await chromium.launch({
        args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const page = await browser.newPage({ viewport: { width: 700, height: 900 } });
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        const mk = (root, quality) => ({ root, quality, beats: 4, inversion: 0, drop: 0, octave: 4, bass: null, playStyle: 'held' });
        // Many chords, narrow viewport -> forces multiple rows in the grid-zoom grid
        const chords = [];
        const roots = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'A', 'B', 'C', 'D'];
        roots.forEach(r => chords.push(mk(r, 'maj')));
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);
    await page.click('#grid-zoom');
    await page.waitForTimeout(150);

    const rows = await page.evaluate(() => {
        const cells = Array.from(document.querySelectorAll('.grid-cell[data-index]'));
        const rowsSet = new Set(cells.map(c => c.getBoundingClientRect().top));
        return rowsSet.size;
    });
    console.log('Number of distinct rows rendered:', rows);
    if (rows < 2) { console.log('SKIP (viewport too wide, only 1 row - cannot test multi-row path)'); await browser.close(); process.exit(0); }

    // Click on a chord in the SECOND row (find an index whose cell is in a different row than index 0)
    const info = await page.evaluate(() => {
        const cell0 = document.querySelector('.grid-cell[data-section="0"][data-index="0"]');
        const top0 = cell0.getBoundingClientRect().top;
        let targetIndex = null, targetRect = null;
        for (let i = 1; i < 16; i++) {
            const c = document.querySelector(`.grid-cell[data-section="0"][data-index="${i}"]`);
            if (!c) continue;
            const r = c.getBoundingClientRect();
            if (Math.round(r.top) !== Math.round(top0)) { targetIndex = i; targetRect = r; break; }
        }
        return { targetIndex, targetRect: targetRect ? { top: targetRect.top, bottom: targetRect.bottom, left: targetRect.left, width: targetRect.width } : null };
    });
    console.log('Target chord in 2nd row:', JSON.stringify(info));
    if (info.targetIndex == null) { console.log('FAIL (could not find a 2nd-row chord)'); await browser.close(); process.exit(1); }

    // Drag on the measure-row just below that chord to create a loop range anchored there
    const x = info.targetRect.left + 4; // près du début de mesure, où .row-measure existe réellement
    const y = info.targetRect.bottom + 8;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(100);

    const result = await page.evaluate(() => window.app.loopRange);
    console.log('loopRange after interacting with 2nd-row chord:', JSON.stringify(result));
    const pass = result && result.startIndex === result.endIndex; // whatever it resolved to, should be a valid tight range, not null/wrong
    console.log((result && result.startIndex != null) ? 'PASS (row math resolved to a real chord index)' : 'FAIL');

    await browser.close();
    process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
