const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

let PASS = 0, FAIL = 0;
function check(cond, label) {
    if (cond) { PASS++; console.log('PASS - ' + label); }
    else { FAIL++; console.log('FAIL - ' + label); }
}

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (msg) => { if (msg.type() === 'error' && !msg.text().includes('CONNECTION')) errors.push('console.error: ' + msg.text()); });

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [
            { root: 'C', quality: 'maj7', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
        ] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);
    await page.evaluate(() => { window.app.editChord(0, 0); window.app.seqOpen = true; window.app.renderSequencer(); window.app.openSeqZoom(); });
    await page.waitForTimeout(200);

    const info = await page.evaluate(() => {
        const viewportWidth = window.innerWidth;
        const ids = ['seq-zoom-in-h', 'seq-zoom-out-h', 'seq-zoom-in-v', 'seq-zoom-out-v', 'seq-zoom-close'];
        const results = {};
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (!el) { results[id] = 'MISSING'; return; }
            const r = el.getBoundingClientRect();
            results[id] = r.left >= 0 && r.right <= viewportWidth + 1 && r.width > 0 && r.height > 0;
        });
        return results;
    });
    console.log(JSON.stringify(info));
    Object.entries(info).forEach(([id, ok]) => check(ok === true, `${id} reste visible dans la largeur de l'écran (loupe séquenceur, non régressé)`));

    console.log('\n=== Bilan : ' + PASS + ' PASS / ' + FAIL + ' FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
