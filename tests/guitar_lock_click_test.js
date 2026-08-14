const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        localStorage.setItem('harmohubShowGuitar', '1');
        localStorage.removeItem('myProgression');
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(300);

    // Add a chord via real UI click, then double-click the grid cell to edit it
    await page.click('#save'); // "Ajouter" button in add mode
    await page.waitForTimeout(200);

    // Double click first chord chip in the grid to enter edit mode (real UI interaction)
    const chip = await page.$('.progression-sections .chord-block, .progression-sections .chord-item, .progression-sections [data-index]');
    console.log('chip found:', !!chip);

    // fall back: use app method to find selector used for chord chips
    const chipSelectorInfo = await page.evaluate(() => {
        const el = document.querySelector('#progression-sections');
        return el ? el.innerHTML.slice(0, 500) : 'NOT FOUND';
    });
    console.log(chipSelectorInfo);

    await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
