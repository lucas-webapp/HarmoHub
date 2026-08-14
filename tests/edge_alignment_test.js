const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 390, height: 700 }, hasTouch: true, isMobile: true });
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [
            { root: 'G', quality: 'maj', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
        ] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);
    await page.evaluate(() => window.app.openGridZoom());
    await page.waitForTimeout(200);

    const rects = await page.evaluate(() => {
        const rightOf = (id) => Math.round(document.getElementById(id).getBoundingClientRect().right);
        const topOf = (id) => Math.round(document.getElementById(id).getBoundingClientRect().top);
        const vGroup = document.getElementById('grid-zoom-out-v').closest('.zoom-axis-group');
        return {
            vOutRight: rightOf('grid-zoom-out-v'),
            vGroupRight: Math.round(vGroup.getBoundingClientRect().right),
            closeRight: rightOf('grid-zoom-close'),
            vTop: topOf('grid-zoom-out-v'),
            closeTop: topOf('grid-zoom-close'),
        };
    });
    console.log(JSON.stringify(rects));
    check(rects.vTop !== rects.closeTop, 'V et Fermer sont bien sur 2 lignes différentes (reproduit le contexte du décalage signalé)');
    check(Math.abs(rects.vGroupRight - rects.closeRight) <= 1, `le bord droit du GROUPE V (${rects.vGroupRight}, padding inclus) est bien aligné avec celui de Fermer (${rects.closeRight})`);

    console.log('\n=== Bilan : ' + PASS + ' PASS / ' + FAIL + ' FAIL ===');
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})();
