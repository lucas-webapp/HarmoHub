const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

let PASS = 0, FAIL = 0;
function check(cond, label) {
    if (cond) { PASS++; console.log('PASS - ' + label); }
    else { FAIL++; console.log('FAIL - ' + label); }
}

(async () => {
    const browser = await chromium.launch({
        args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const page = await browser.newPage({ viewport: { width: 390, height: 700 }, hasTouch: true, isMobile: true });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (msg) => { if (msg.type() === 'error' && !msg.text().includes('CONNECTION') && !msg.text().includes('TUNNEL')) errors.push('console.error: ' + msg.text()); });

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [
            { root: 'C', quality: 'maj7', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
        ] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);
    await page.evaluate(() => { window.app.openGridZoom(); window.app.editChordFromGridZoom(0, 0); });
    await page.waitForTimeout(150);

    console.log('=== Ctrl+molette sur le séquenceur ÉPINGLÉ de la loupe grille : zoome les 2 axes à la fois ===');
    const beforeWheel = await page.evaluate(() => ({ x: window.app.seqZoomLevelX, y: window.app.seqZoomLevelY }));
    await page.evaluate(() => {
        const el = document.getElementById('grid-zoom-pinned-body');
        el.dispatchEvent(new WheelEvent('wheel', { ctrlKey: true, deltaY: -100, bubbles: true, cancelable: true }));
    });
    await page.waitForTimeout(50);
    const afterWheelY = await page.evaluate(() => ({ x: window.app.seqZoomLevelX, y: window.app.seqZoomLevelY }));
    console.log(JSON.stringify({ beforeWheel, afterWheelY }));
    check(afterWheelY.y > beforeWheel.y && afterWheelY.x > beforeWheel.x, 'Ctrl+molette zoome bien les 2 axes (H et V) en même temps sur le séquenceur épinglé');

    await page.evaluate(() => {
        const el = document.getElementById('grid-zoom-pinned-body');
        el.dispatchEvent(new WheelEvent('wheel', { ctrlKey: true, deltaY: -100, bubbles: true, cancelable: true }));
    });
    await page.waitForTimeout(50);
    const afterWheelX = await page.evaluate(() => ({ x: window.app.seqZoomLevelX, y: window.app.seqZoomLevelY }));
    console.log(JSON.stringify(afterWheelX));
    check(afterWheelX.x > afterWheelY.x && afterWheelX.y > afterWheelY.y, 'un second Ctrl+molette continue de zoomer les 2 axes ensemble');

    console.log('=== Molette SANS Ctrl : ne doit rien changer ===');
    await page.evaluate(() => {
        const el = document.getElementById('grid-zoom-pinned-body');
        el.dispatchEvent(new WheelEvent('wheel', { ctrlKey: false, deltaY: -100, bubbles: true, cancelable: true }));
    });
    await page.waitForTimeout(50);
    const afterPlainWheel = await page.evaluate(() => ({ x: window.app.seqZoomLevelX, y: window.app.seqZoomLevelY }));
    check(afterPlainWheel.x === afterWheelX.x && afterPlainWheel.y === afterWheelX.y, 'molette sans Ctrl ne zoome pas (laisse le scroll normal faire son travail)');

    console.log('=== Pincer-zoomer (2 doigts) sur le séquenceur épinglé : écart qui grandit -> zoom avant, les 2 axes ===');
    const beforePinch = await page.evaluate(() => ({ x: window.app.seqZoomLevelX, y: window.app.seqZoomLevelY }));
    const pinchResult = await page.evaluate(() => {
        const el = document.getElementById('grid-zoom-pinned-body');
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
        const mkEvent = (type, id, dx, dy) => new PointerEvent(type, {
            pointerId: id, pointerType: 'touch', clientX: cx + dx, clientY: cy + dy, bubbles: true, cancelable: true,
        });
        el.dispatchEvent(mkEvent('pointerdown', 1, -20, 0));
        el.dispatchEvent(mkEvent('pointerdown', 2, 20, 0));
        // Écarte progressivement les deux doigts (dépasse largement PINCH_STEP_PX=32 à chaque pas).
        el.dispatchEvent(mkEvent('pointermove', 1, -60, 0));
        el.dispatchEvent(mkEvent('pointermove', 2, 60, 0));
        el.dispatchEvent(mkEvent('pointermove', 1, -100, 0));
        el.dispatchEvent(mkEvent('pointermove', 2, 100, 0));
        el.dispatchEvent(mkEvent('pointerup', 1, -100, 0));
        el.dispatchEvent(mkEvent('pointerup', 2, 100, 0));
        return { x: window.app.seqZoomLevelX, y: window.app.seqZoomLevelY };
    });
    console.log(JSON.stringify({ beforePinch, pinchResult }));
    check(pinchResult.x > beforePinch.x && pinchResult.y > beforePinch.y, 'pincer en écartant les doigts zoome bien les 2 axes à la fois');

    console.log('=== Pincer en resserrant les doigts : dézoome ===');
    const beforePinchIn = pinchResult;
    const pinchInResult = await page.evaluate(() => {
        const el = document.getElementById('grid-zoom-pinned-body');
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
        const mkEvent = (type, id, dx, dy) => new PointerEvent(type, {
            pointerId: id, pointerType: 'touch', clientX: cx + dx, clientY: cy + dy, bubbles: true, cancelable: true,
        });
        el.dispatchEvent(mkEvent('pointerdown', 3, -100, 0));
        el.dispatchEvent(mkEvent('pointerdown', 4, 100, 0));
        el.dispatchEvent(mkEvent('pointermove', 3, -60, 0));
        el.dispatchEvent(mkEvent('pointermove', 4, 60, 0));
        el.dispatchEvent(mkEvent('pointermove', 3, -20, 0));
        el.dispatchEvent(mkEvent('pointermove', 4, 20, 0));
        el.dispatchEvent(mkEvent('pointerup', 3, -20, 0));
        el.dispatchEvent(mkEvent('pointerup', 4, 20, 0));
        return { x: window.app.seqZoomLevelX, y: window.app.seqZoomLevelY };
    });
    console.log(JSON.stringify({ beforePinchIn, pinchInResult }));
    check(pinchInResult.x < beforePinchIn.x && pinchInResult.y < beforePinchIn.y, 'pincer en resserrant les doigts dézoome bien les 2 axes');

    console.log('=== Un seul doigt (pas 2) : aucun effet ===');
    const beforeOneFinger = await page.evaluate(() => ({ x: window.app.seqZoomLevelX, y: window.app.seqZoomLevelY }));
    await page.evaluate(() => {
        const el = document.getElementById('grid-zoom-pinned-body');
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
        const mkEvent = (type, id, dx, dy) => new PointerEvent(type, {
            pointerId: id, pointerType: 'touch', clientX: cx + dx, clientY: cy + dy, bubbles: true, cancelable: true,
        });
        el.dispatchEvent(mkEvent('pointerdown', 5, 0, 0));
        el.dispatchEvent(mkEvent('pointermove', 5, 200, 0));
        el.dispatchEvent(mkEvent('pointerup', 5, 200, 0));
    });
    await page.waitForTimeout(50);
    const afterOneFinger = await page.evaluate(() => ({ x: window.app.seqZoomLevelX, y: window.app.seqZoomLevelY }));
    check(afterOneFinger.x === beforeOneFinger.x && afterOneFinger.y === beforeOneFinger.y, 'un seul doigt ne déclenche jamais de zoom');

    console.log('\n=== Bilan : ' + PASS + ' PASS / ' + FAIL + ' FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
