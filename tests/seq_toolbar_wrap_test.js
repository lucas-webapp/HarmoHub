const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

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
            { root: 'A', quality: 'min', beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' },
        ] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);
    await page.evaluate(() => { window.app.openGridZoom(); window.app.editChordFromGridZoom(0, 0); });
    await page.waitForTimeout(200);
    await page.evaluate(() => document.getElementById('arp-sequencer').scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(100);

    const rects = await page.evaluate(() => {
        const r = (id) => { const el = document.getElementById(id); if (!el) return null; const b = el.getBoundingClientRect(); return { top: Math.round(b.top), left: Math.round(b.left), right: Math.round(b.right), width: Math.round(b.width) }; };
        return {
            play: r('seq-play'), stop: r('seq-stop'), loop: r('seq-loop-play'), addNote: r('seq-add-note'),
            inH: r('seq-zoom-in-h-pinned'), outH: r('seq-zoom-out-h-pinned'),
            inV: r('seq-zoom-in-v-pinned'), outV: r('seq-zoom-out-v-pinned'),
            tapRecord: r('seq-tap-record'), rowPipette: r('seq-row-pipette'),
        };
    });
    console.log(JSON.stringify(rects, null, 2));

    check(rects.inH && rects.inV && rects.inH.top === rects.inV.top,
        'les groupes de zoom H et V du séquenceur épinglé restent bien sur la MÊME ligne (pas scindés)');

    console.log('\n=== Bilan : ' + PASS + ' PASS / ' + FAIL + ' FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})();
