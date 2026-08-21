const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

(async () => {
    const browser = await chromium.launch();
    // Viewport mobile (iPhone-like), là où le bug a été signalé.
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', msg => { if (msg.type() === 'error' && !msg.text().includes('ERR_CONNECTION_RESET') && !msg.text().includes('ERR_TUNNEL_CONNECTION_FAILED')) errors.push('console: ' + msg.text()); });

    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(600);
    await page.waitForTimeout(150);
    for (const sym of ['C', 'G', 'Am', 'F']) {
        await page.fill('#quick-add-input', sym).catch(() => {});
        await page.click('#quick-add-btn').catch(() => {});
        await page.waitForTimeout(120);
    }
    await page.evaluate(() => window.app.toggleSequencer('compact'));
    await page.waitForTimeout(2000); // laisse le toast "X ajouté" disparaître avant la capture

    const info = await page.evaluate(() => {
        const label = document.querySelector('.seq-beat-label[data-beat-index="0"]');
        const num = label.querySelector('.seq-beat-num');
        const labelRect = label.getBoundingClientRect();
        const numRect = num.getBoundingClientRect();
        // La ligne (.seq-beat-label) doit avoir une hauteur RÉELLE (pas quasi nulle) : c'était
        // exactement le bug (position:absolute retirait le chiffre du flux, la ligne s'écrasait).
        return {
            labelHeight: labelRect.height,
            numHeight: numRect.height,
            numTop: numRect.top, numBottom: numRect.bottom,
            labelTop: labelRect.top, labelBottom: labelRect.bottom,
            text: num.textContent,
        };
    });
    console.log('mobile info:', JSON.stringify(info));
    check(info.labelHeight >= info.numHeight - 1, `la ligne des numéros a une hauteur réelle (${info.labelHeight.toFixed(1)}px) qui contient le chiffre (${info.numHeight.toFixed(1)}px), pas écrasée à presque 0`);
    // Le chiffre entier doit être visuellement DANS les bornes de sa ligne (pas coupé en haut/bas).
    const fullyInside = info.numTop >= info.labelTop - 1 && info.numBottom <= info.labelBottom + 1;
    check(fullyInside, `le chiffre "${info.text}" est entièrement contenu dans sa ligne (haut ${info.numTop.toFixed(1)} >= ${info.labelTop.toFixed(1)}, bas ${info.numBottom.toFixed(1)} <= ${info.labelBottom.toFixed(1)}), pas coupé`);

    // Capture pour vérification visuelle directe.
    const box = await page.evaluate(() => {
        const el = document.querySelector('.seq-scroll');
        const r = el.getBoundingClientRect();
        return { x: Math.max(0, r.x - 4), y: Math.max(0, r.y - 4), width: r.width + 8, height: Math.min(r.height + 8, 260) };
    });
    await page.screenshot({ path: 'seq_mobile_numbers.png', clip: box });

    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})();
