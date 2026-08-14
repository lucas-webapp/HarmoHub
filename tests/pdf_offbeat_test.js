const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
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

    const result = await page.evaluate(() => {
        const { gridInner } = app.buildPrintExportHtml();
        const div = document.createElement('div');
        div.innerHTML = gridInner;
        const firstBar = div.querySelector('.ruler-bar');
        const majorTicks = firstBar.querySelectorAll('.ruler-tick-major').length;
        const offbeatTicks = firstBar.querySelectorAll('.ruler-tick-offbeat');
        const minorTicks = firstBar.querySelectorAll('.ruler-tick:not(.ruler-tick-major):not(.ruler-tick-offbeat)').length;
        const lefts = Array.from(offbeatTicks).map(t => t.style.left);
        return { majorTicks, offbeatCount: offbeatTicks.length, minorTicks, lefts };
    });
    console.log('pdf ruler:', JSON.stringify(result));
    // UN SEUL repère par mesure (pas un par temps, retour utilisateur), pile au milieu (50%).
    check(result.offbeatCount === 1, `un seul .ruler-tick-offbeat par mesure (pas un par temps) — obtenu ${result.offbeatCount}`);
    check(JSON.stringify(result.lefts) === JSON.stringify(['50%']), `le repère est exactement au milieu de la mesure (50%), obtenu ${JSON.stringify(result.lefts)}`);

    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})();
