const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
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

    const dims = await page.evaluate(() => {
        const modal = document.querySelector('.grid-zoom-modal');
        const r = modal.getBoundingClientRect();
        return { width: r.width, height: r.height, viewportW: window.innerWidth, viewportH: window.innerHeight };
    });
    console.log(JSON.stringify(dims));
    check(dims.width > dims.viewportW - 50, 'la fenêtre remplit quasiment toute la largeur de l\'écran (' + dims.width + ' / ' + dims.viewportW + ')');
    check(dims.height > dims.viewportH - 50, 'la fenêtre remplit quasiment toute la hauteur de l\'écran (' + dims.height + ' / ' + dims.viewportH + ')');

    await page.screenshot({ path: 'loupe_fullscreen_1920.png' });

    // Re-test avec peu d'accords sur un écran encore plus large, pile le cas signalé par l'utilisateur
    await page.setViewportSize({ width: 2400, height: 1300 });
    await page.waitForTimeout(150);
    const dims2 = await page.evaluate(() => {
        const modal = document.querySelector('.grid-zoom-modal');
        const r = modal.getBoundingClientRect();
        return { width: r.width, height: r.height, viewportW: window.innerWidth, viewportH: window.innerHeight };
    });
    console.log(JSON.stringify(dims2));
    check(dims2.width > dims2.viewportW - 50, 'reste plein écran même sur un écran très large (2400px) — ' + dims2.width);

    console.log('\n=== Bilan : ' + PASS + ' PASS / ' + FAIL + ' FAIL ===');
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
