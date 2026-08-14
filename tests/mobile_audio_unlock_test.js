const { chromium, devices } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

async function cellBox(page, section, index) {
    const sel = `.grid-cell[data-section="${section}"][data-index="${index}"]`;
    await page.waitForSelector(sel);
    return page.locator(sel).boundingBox();
}

(async () => {
    const iphone = devices['iPhone 13'];
    const browser = await chromium.launch();
    const context = await browser.newContext({ ...iphone });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(300);
    await page.evaluate(() => { localStorage.removeItem('myProgression'); });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(300);

    console.log('Tone.context.state BEFORE any touch:', await page.evaluate(() => Tone.context.state));
    await page.evaluate(() => { window.app.saveCurrent(); });
    await page.waitForTimeout(150);

    // Simulate a real touch tap (not a mouse click) on the first grid cell, using touchscreen input
    const box = await cellBox(page, 0, 0);
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height - 6);
    await page.waitForTimeout(300);

    const contextStateAfterTap = await page.evaluate(() => Tone.context.state);
    console.log('Tone.context.state after first real touch tap:', contextStateAfterTap);
    check(contextStateAfterTap === 'running', "l'AudioContext est bien débloqué (running) après le tout premier tap tactile");

    check(pageErrors.length === 0, "aucune erreur JS pendant le scénario tactile — " + JSON.stringify(pageErrors));

    console.log('\n=== Bilan : ' + PASS + ' PASS / ' + FAIL + ' FAIL ===');
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
