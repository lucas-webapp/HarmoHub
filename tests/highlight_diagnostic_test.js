const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [
            { root: 'C', quality: 'maj', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
            { root: 'D', quality: 'min', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
            { root: 'E', quality: 'min', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
        ] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);

    console.log('=== Scénario A : chord SÉLECTIONNÉ (simple clic, pas Modifier), puis ouverture loupe ===');
    await page.evaluate(() => { window.app.selectedIndex = 1; window.app.activeSection = 0; });
    await page.evaluate(() => window.app.openGridZoom());
    await page.waitForTimeout(150);
    const a = await page.evaluate(() => {
        const cell = document.querySelector('#grid-zoom-host .grid-cell[data-section="0"][data-index="1"]');
        return {
            editingIndex: window.app.editingIndex,
            selectedIndex: window.app.selectedIndex,
            classes: cell ? cell.className : 'MISSING',
            computedBg: cell ? getComputedStyle(cell).backgroundColor : null,
        };
    });
    console.log(JSON.stringify(a));
    await page.evaluate(() => window.app.closeGridZoom());
    await page.evaluate(() => { window.app.editingIndex = null; window.app.selectedIndex = null; });
    await page.waitForTimeout(100);

    console.log('=== Scénario B : chord déjà en ÉDITION (via "Modifier"), puis ouverture loupe ===');
    await page.evaluate(() => window.app.editChord(0, 2));
    await page.waitForTimeout(100);
    await page.evaluate(() => window.app.openGridZoom());
    await page.waitForTimeout(150);
    const b = await page.evaluate(() => {
        const cell = document.querySelector('#grid-zoom-host .grid-cell[data-section="0"][data-index="2"]');
        return {
            editingIndex: window.app.editingIndex,
            classes: cell ? cell.className : 'MISSING',
            computedBg: cell ? getComputedStyle(cell).backgroundColor : null,
        };
    });
    console.log(JSON.stringify(b));

    await browser.close();
})();
