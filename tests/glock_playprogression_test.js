const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

(async () => {
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        localStorage.setItem('harmohubShowGuitar', '1');
        localStorage.removeItem('myProgression');
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(300);

    await page.evaluate(() => { window.app.saveCurrent(); }); // chord 0 = C maj
    await page.waitForTimeout(150);

    await page.evaluate(() => { window.app.editChord(0, 0); });
    await page.waitForTimeout(150);
    await page.evaluate(() => { window.app.cycleGuitarFingering(1); });
    await page.waitForTimeout(100);
    await page.evaluate(() => { window.app.toggleGuitarLock(); });
    await page.waitForTimeout(150);
    const lockedShape = await page.evaluate(() => {
        const sections = JSON.parse(localStorage.getItem('myProgression')).sections;
        return sections[0].chords[0].guitarLock;
    });
    console.log('lockedShape:', JSON.stringify(lockedShape));

    await page.evaluate(() => { window.app.cancelEdit(); window.app.appMode = 'add'; window.app.editingIndex = null; });
    await page.waitForTimeout(100);

    // Play the whole progression (uses scheduleProgressionChord, not playSavedChord)
    await page.evaluate(() => { window.app.playProgression(); });
    await page.waitForTimeout(3000);

    const shownFingering = await page.evaluate(() => window.app.guitarFingerings[window.app.guitarFingeringIndex] ? window.app.guitarFingerings[window.app.guitarFingeringIndex].map(f => f ? f.fret : null) : null);
    console.log('shown during playProgression:', JSON.stringify(shownFingering));
    check(JSON.stringify(shownFingering) === JSON.stringify(lockedShape), "la lecture de toute la grille (playProgression) affiche bien le doigté verrouillé de l'accord en cours");
    const lockBtnActive = await page.evaluate(() => document.getElementById('guitar-lock-btn').classList.contains('active'));
    check(lockBtnActive, "cadenas actif pendant la lecture de la grille");

    await page.evaluate(() => { window.app.stopAll(); });

    console.log('\n=== Bilan : ' + PASS + ' PASS / ' + FAIL + ' FAIL ===');
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
