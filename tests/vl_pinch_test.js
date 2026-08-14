const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, hasTouch: true });
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        const mk = (root, quality, octave) => ({ root, quality, beats: 4, inversion: 0, drop: 'none', octave, bass: null, playStyle: 'held' });
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Section', chords: [
            mk('C', 'maj7', 3), mk('A', 'min7', 3), mk('D', 'min7', 3), mk('G', 'dom7', 3),
        ] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(300);

    await page.evaluate(() => { window.app.toggleVoiceLeadingPanel(); });
    await page.waitForTimeout(200);

    const panelBox = await page.locator('.voice-leading-panel').boundingBox();
    check(!!panelBox, "le panneau Conduite de voix est bien ouvert");

    // Coordonnées prises DANS la page (getBoundingClientRect), pas via boundingBox() de Playwright :
    // la première est relative à la FENÊTRE, la seconde à la PAGE entière. Dès que la page a défilé,
    // les deux divergent — et elementFromPoint, juste en dessous, raisonne en coordonnées de fenêtre :
    // il désignait alors le mauvais élément, et le pincement partait à côté du panneau.
    const { cx, cy } = await page.evaluate(() => {
        const el = document.querySelector('.voice-leading-scroll');
        el.scrollIntoView({ block: 'center' });
        const r = el.getBoundingClientRect();
        return { cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
    });
    await page.waitForTimeout(200);

    // Simulate a real 2-finger pinch-out (zoom in) using raw pointer events, matching setupPinchZoom's
    // implementation (pointerdown x2, pointermove with growing separation, pointerup x2).
    await page.evaluate(() => window.app.setZoomLevel('voiceLeading', 'x', 1));
    await page.evaluate(() => window.app.setZoomLevel('voiceLeading', 'y', 1));
    await page.waitForTimeout(100);

    const dispatchPointer = async (type, id, x, y) => {
        await page.evaluate(({ type, id, x, y }) => {
            const el = document.elementFromPoint(x, y);
            const ev = new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true });
            (el || document.querySelector('.voice-leading-scroll')).dispatchEvent(ev);
        }, { type, id, x, y });
    };

    await dispatchPointer('pointerdown', 1, cx - 20, cy);
    await dispatchPointer('pointerdown', 2, cx + 20, cy);
    await page.waitForTimeout(20);

    // Grow the separation gradually (zoom in) -- check the CSS var updates BEFORE the 150ms periodic
    // rebuild fires, proving the instant-feedback transform is active mid-gesture.
    await dispatchPointer('pointermove', 1, cx - 40, cy);
    await dispatchPointer('pointermove', 2, cx + 40, cy);
    await page.waitForTimeout(30); // well under the 150ms rebuild flush interval

    const midGestureScaleX = await page.evaluate(() => document.querySelector('.voice-leading-panel').style.getPropertyValue('--vl-zoom-scale-x'));
    const midGestureScaleY = await page.evaluate(() => document.querySelector('.voice-leading-panel').style.getPropertyValue('--vl-zoom-scale-y'));
    console.log('mid-gesture --vl-zoom-scale-x/-y:', midGestureScaleX, midGestureScaleY);
    check(parseFloat(midGestureScaleX) > 1, "le transform de secours (--vl-zoom-scale-x) grandit IMMÉDIATEMENT pendant le geste, avant tout nouveau rendu réel");
    check(parseFloat(midGestureScaleY) > 1, "idem pour --vl-zoom-scale-y");

    const zoomPinchActiveDuring = await page.evaluate(() => window.app._zoomPinchActive);
    check(zoomPinchActiveDuring, "_zoomPinchActive bien vrai pendant le geste (donc rendu complet différé)");

    // Release both fingers
    await dispatchPointer('pointerup', 1, cx - 40, cy);
    await dispatchPointer('pointerup', 2, cx + 40, cy);
    await page.waitForTimeout(150);

    const finalScaleX = await page.evaluate(() => document.querySelector('.voice-leading-panel').style.getPropertyValue('--vl-zoom-scale-x'));
    console.log('after release, --vl-zoom-scale-x on the FRESH panel:', JSON.stringify(finalScaleX));
    check(finalScaleX === '', "après relâchement, le panneau reconstruit n'a plus de transform de secours (repart de 1 par défaut)");

    const finalZoomX = await page.evaluate(() => window.app.voiceLeadingZoomLevelX);
    console.log('final voiceLeadingZoomLevelX:', finalZoomX);
    check(finalZoomX > 1, "l'échelle horizontale réelle a bien augmenté après le pincement");

    check(pageErrors.length === 0, "aucune erreur JS pendant le pincement — " + JSON.stringify(pageErrors));

    console.log('\n=== Bilan : ' + PASS + ' PASS / ' + FAIL + ' FAIL ===');
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
