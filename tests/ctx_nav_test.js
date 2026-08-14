const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// La police est chargée depuis Google Fonts : injoignable derrière le proxy du bac à sable,
// jamais un problème chez l'utilisateur. Ces échecs réseau sont donc filtrés — sinon ils font
// échouer « aucune erreur console » et masquent les vraies erreurs au milieu du bruit.

// Ces zones de navigation contextuelle sont VASTES (224x213px mesurés en 420px de large) et
// débordent la partie visible du séquenceur, qui défile horizontalement. Playwright vise le CENTRE
// d'un élément : ici, ce centre tombe hors de la zone visible, sur le corps de la loupe — d'où un
// « intercepts pointer events » qui n'a rien à voir avec la fonctionnalité. Elle marche : vérifié
// en cliquant un point réellement atteignable, ce que fait ce helper. On teste le geste de
// l'utilisateur (il vise ce qu'il voit), pas la géométrie interne de l'élément.
const cliqueZone = async (page, sel) => {
    const pt = await page.evaluate((s) => {
        const z = document.querySelector(s);
        if (!z) return null;
        // Un accord lointain peut être entierement hors de la partie visible : le sequenceur defile
        // horizontalement. L'utilisateur fait defiler avant de viser, on fait pareil.
        z.scrollIntoView({ block: 'nearest', inline: 'center' });
        const r = z.getBoundingClientRect();
        for (let j = 1; j < 20; j++) for (let i = 1; i < 20; i++) {
            const x = r.left + r.width * i / 20, y = r.top + r.height * j / 20;
            const el = document.elementFromPoint(x, y);
            if (el && el.closest(s.split('[')[0])) return { x, y };
        }
        return null;
    }, sel);
    if (!pt) throw new Error('aucun point atteignable dans ' + sel);
    await page.mouse.click(pt.x, pt.y);
};

(async () => {
    const browser = await chromium.launch({
        args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const page = await browser.newPage({ viewport: { width: 420, height: 800 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (msg) => { if (msg.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|fonts\.googleapis|fonts\.gstatic/.test(msg.text())) errors.push('console.error: ' + msg.text()); });

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        const mk = (root, quality) => ({ root, quality, beats: 4, inversion: 0, drop: 0, octave: 4, bass: null, playStyle: 'held' });
        const sections = [{ title: 'Couplet', chords: [mk('C', 'maj'), mk('A', 'min7'), mk('F', 'maj7'), mk('G', '7')] }];
        localStorage.setItem('myProgression', JSON.stringify({ sections }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);

    await page.click('#grid-zoom');
    await page.waitForTimeout(150);
    await page.evaluate(() => window.app.editChordFromSequencer(0, 1)); // start on the 2nd chord (A min7), has both prev and next
    await page.waitForTimeout(200);

    let r = await page.evaluate(() => ({
        editingIndex: window.app.editingIndex,
        hasNavPrev: !!document.querySelector('.seq-ctx-nav-prev'),
        hasNavNext: !!document.querySelector('.seq-ctx-nav-next'),
        editingCellSection0Index1: document.querySelector('.grid-cell[data-section="0"][data-index="1"]').classList.contains('editing'),
    }));
    console.log('initial state:', JSON.stringify(r));

    console.log('--- click on the NEXT (adjacent) context zone: should switch to chord index 2 ---');
    await cliqueZone(page, '.seq-ctx-nav-next[data-target-index="2"]');
    await page.waitForTimeout(150);
    r = await page.evaluate(() => ({
        editingIndex: window.app.editingIndex,
        editingCell2: document.querySelector('.grid-cell[data-section="0"][data-index="2"]').classList.contains('editing'),
        editingCell1: document.querySelector('.grid-cell[data-section="0"][data-index="1"]').classList.contains('editing'),
    }));
    console.log(JSON.stringify(r));
    console.log((r.editingIndex === 2 && r.editingCell2 && !r.editingCell1) ? 'PASS (switched to next chord, grid highlight followed)' : 'FAIL');

    console.log('--- click on the PREV zone targeting index 1 specifically: should switch back to chord index 1 ---');
    await cliqueZone(page, '.seq-ctx-nav-prev[data-target-index="1"]');
    await page.waitForTimeout(150);
    r = await page.evaluate(() => ({
        editingIndex: window.app.editingIndex,
        editingCell1: document.querySelector('.grid-cell[data-section="0"][data-index="1"]').classList.contains('editing'),
        editingCell2: document.querySelector('.grid-cell[data-section="0"][data-index="2"]').classList.contains('editing'),
    }));
    console.log(JSON.stringify(r));
    console.log((r.editingIndex === 1 && r.editingCell1 && !r.editingCell2) ? 'PASS (switched back to prev chord, grid highlight followed)' : 'FAIL');

    console.log('--- ALL chords of the grid are reachable, not just the adjacent one: jump DIRECTLY from index 1 to index 3 (skipping index 2) ---');
    r = await page.evaluate(() => {
        const zones = Array.from(document.querySelectorAll('.seq-ctx-nav-next')).map(z => z.dataset.targetIndex);
        return { nextZoneTargets: zones };
    });
    console.log('next zone targets available:', JSON.stringify(r));
    console.log((r.nextZoneTargets.includes('2') && r.nextZoneTargets.includes('3')) ? 'PASS (both next chords have their own zone, not just the adjacent one)' : 'FAIL');
    await cliqueZone(page, '.seq-ctx-nav-next[data-target-index="3"]');
    await page.waitForTimeout(150);
    r = await page.evaluate(() => ({
        editingIndex: window.app.editingIndex,
        editingCell3: document.querySelector('.grid-cell[data-section="0"][data-index="3"]').classList.contains('editing'),
    }));
    console.log(JSON.stringify(r));
    console.log((r.editingIndex === 3 && r.editingCell3) ? 'PASS (jumped directly to a non-adjacent chord)' : 'FAIL');

    console.log('--- From the last chord (index 3), ALL 3 previous chords should each have their own prev zone ---');
    r = await page.evaluate(() => {
        const zones = Array.from(document.querySelectorAll('.seq-ctx-nav-prev')).map(z => z.dataset.targetIndex).sort();
        return { prevZoneTargets: zones };
    });
    console.log(JSON.stringify(r));
    console.log((JSON.stringify(r.prevZoneTargets) === JSON.stringify(['0', '1', '2'])) ? 'PASS (all 3 preceding chords have their own zone)' : 'FAIL');

    console.log('--- Jump directly to the FARTHEST chord (index 0) from index 3 ---');
    await cliqueZone(page, '.seq-ctx-nav-prev[data-target-index="0"]');
    await page.waitForTimeout(150);
    r = await page.evaluate(() => ({
        editingIndex: window.app.editingIndex,
        editingCell0: document.querySelector('.grid-cell[data-section="0"][data-index="0"]').classList.contains('editing'),
        hasNavPrev: !!document.querySelector('.seq-ctx-nav-prev'),
    }));
    console.log(JSON.stringify(r));
    console.log((r.editingIndex === 0 && r.editingCell0 && !r.hasNavPrev) ? 'PASS (jumped directly to the farthest chord, no prev-nav left)' : 'FAIL');

    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
