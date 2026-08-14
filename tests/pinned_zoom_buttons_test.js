const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [
            { root: 'C', quality: 'maj7', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
        ] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);
    await page.evaluate(() => { window.app.openGridZoom(); });
    await page.waitForTimeout(150);
    await page.evaluate(() => { window.app.editChordFromGridZoom(0, 0); });
    await page.waitForTimeout(150);

    const colWidthBefore = await page.evaluate(() => {
        const grid = document.querySelector('#grid-zoom-pinned-body .seq-grid-continuous');
        return parseFloat(getComputedStyle(grid).gridTemplateColumns.split(' ')[1]);
    });
    await page.click('#seq-zoom-in-h-pinned');
    await page.waitForTimeout(150);
    const colWidthAfter = await page.evaluate(() => {
        const grid = document.querySelector('#grid-zoom-pinned-body .seq-grid-continuous');
        return parseFloat(getComputedStyle(grid).gridTemplateColumns.split(' ')[1]);
    });
    check(colWidthAfter > colWidthBefore, 'zoom H+ (bouton déplacé en fin de rangée) augmente bien la largeur des cases (' + colWidthBefore + ' -> ' + colWidthAfter + ')');

    const cellHeightBefore = await page.evaluate(() => {
        const cell = document.querySelector('#grid-zoom-pinned-body .seq-cell');
        return cell.getBoundingClientRect().height;
    });
    await page.click('#seq-zoom-in-v-pinned');
    await page.waitForTimeout(150);
    const cellHeightAfter = await page.evaluate(() => {
        const cell = document.querySelector('#grid-zoom-pinned-body .seq-cell');
        return cell.getBoundingClientRect().height;
    });
    check(cellHeightAfter > cellHeightBefore, 'zoom V+ augmente bien la hauteur des cases (' + cellHeightBefore + ' -> ' + cellHeightAfter + ')');

    check(errors.length === 0, 'aucune erreur JS (' + JSON.stringify(errors) + ')');

    console.log('\n=== Bilan : ' + PASS + ' PASS / ' + FAIL + ' FAIL ===');
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
