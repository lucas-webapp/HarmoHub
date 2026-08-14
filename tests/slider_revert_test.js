const { chromium, devices } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

(async () => {
    const browser = await chromium.launch();
    const pageErrors = [];

    // Desktop: verify no padding added, exact old look preserved (no pointer:coarse match)
    const dp = await browser.newPage({ viewport: { width: 900, height: 700 } });
    dp.on('pageerror', (e) => pageErrors.push(e.message));
    await dp.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await dp.waitForTimeout(200);
    // (l'onglet Config n'existe plus ; ce test veut la fenêtre Paramètres, ouverte juste après)
    await dp.evaluate(() => { document.getElementById('open-settings').click(); });
    await dp.waitForTimeout(200);
    const desktopPadding = await dp.evaluate(() => getComputedStyle(document.getElementById('general-volume')).paddingTop);
    console.log('desktop padding-top:', desktopPadding);
    check(desktopPadding === '0px', "aucun padding ajouté sur ordinateur (souris) — apparence identique à l'ancien design");

    // Mobile: verify padding present + grab works from an edge of the padded zone, not just the thin line
    const iphone = devices['iPhone 13'];
    const context = await browser.newContext({ ...iphone });
    const mp = await context.newPage();
    mp.on('pageerror', (e) => pageErrors.push(e.message));
    await mp.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await mp.waitForTimeout(200);
    // (idem : plus d'onglet Config, on va directement aux Paramètres)
    await mp.evaluate(() => { document.getElementById('open-settings').click(); });
    await mp.waitForTimeout(200);

    const mobilePadding = await mp.evaluate(() => getComputedStyle(document.getElementById('general-volume')).paddingTop);
    console.log('mobile padding-top:', mobilePadding);
    check(mobilePadding === '14px', "padding tactile bien appliqué sur mobile (pointer: coarse)");

    await mp.evaluate(() => { document.getElementById('metronome-volume').value = 50; document.getElementById('metronome-volume').dispatchEvent(new Event('input')); });
    await mp.waitForTimeout(100);
    const box = await mp.locator('#metronome-volume').boundingBox();
    console.log('metronome-volume box:', JSON.stringify(box));
    // Tap near the TOP edge of the padded box (well away from the thin visible line, which sits near
    // vertical center) at ~85% horizontal -- should still grab/jump the slider if the touch target
    // truly extends through the padding, not just the rendered thumb pixels.
    await mp.touchscreen.tap(box.x + box.width * 0.85, box.y + 4);
    await mp.waitForTimeout(150);
    const afterVal = await mp.inputValue('#metronome-volume');
    console.log('metronome-volume value after tapping near top edge, 85% x:', afterVal);
    check(+afterVal > 70, "un tap près du bord haut de la zone tactile (loin du trait visible) saisit quand même le curseur");

    check(pageErrors.length === 0, "aucune erreur JS — " + JSON.stringify(pageErrors));

    console.log('\n=== Bilan : ' + PASS + ' PASS / ' + FAIL + ' FAIL ===');
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
