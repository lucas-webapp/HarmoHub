const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

(async () => {
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
    page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => { localStorage.removeItem('myProgression'); localStorage.setItem('harmohubShowGuitar', '1'); });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(300);

    const roots = ['C', 'C#', 'D', 'E', 'F#', 'G', 'A', 'Bb'];
    const qualities = ['maj', 'min', 'dom7', 'maj7', 'min7', 'sus2', 'sus4'];

    for (const root of roots) {
        for (const quality of qualities) {
            await page.evaluate(({ root, quality }) => {
                document.getElementById('root').value = root;
                document.getElementById('quality').value = quality;
                window.app.refreshPreview();
            }, { root, quality });
            await page.waitForTimeout(30);
            const nFingerings = await page.evaluate(() => window.app.guitarFingerings.length);
            if (nFingerings === 0) continue; // unplayable, skip

            await page.click('#guitar-lock-btn');
            await page.waitForTimeout(60);
            const activeAfterClick = await page.evaluate(() => document.getElementById('guitar-lock-btn').classList.contains('active'));
            check(activeAfterClick, `${root}${quality} (${nFingerings} doigtés) : cadenas ACTIF juste après un clic`);
            // Unlock again for next iteration's cleanliness
            if (activeAfterClick) {
                await page.click('#guitar-lock-btn');
                await page.waitForTimeout(60);
            }
        }
    }

    console.log('\n=== Bilan : ' + PASS + ' PASS / ' + FAIL + ' FAIL ===');
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
