const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

async function cellBox(page, section, index) {
    const sel = `.grid-cell[data-section="${section}"][data-index="${index}"]`;
    await page.waitForSelector(sel);
    return page.locator(sel).boundingBox();
}
async function dblclickCellSafe(page, section, index) {
    const box = await cellBox(page, section, index);
    await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height - 6);
    await page.waitForTimeout(250);
}

(async () => {
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
    page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        const mk = (root, quality, octave) => ({ root, quality, beats: 4, inversion: 0, drop: 'none', octave, bass: null, playStyle: 'held' });
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Section', chords: [
            mk('C#', 'min', 4), mk('G#', 'min', 3), mk('D#', 'min', 3), mk('C#', 'min', 3),
        ] }] }));
        localStorage.setItem('harmohubShowGuitar', '1');
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(300);

    // Real double-click to edit chord 2 (D#m) -- this fires selectChord (autoplay) THEN editChord (autoplay again)
    await dblclickCellSafe(page, 0, 2);
    await page.waitForTimeout(100);

    // Le cadenas vit maintenant dans la fenêtre d'édition manuelle (voir #guitar-edit-btn) : ouverture
    // minimale AVANT le clic "immédiat" ci-dessous, pour ne pas fausser le timing testé (verrou posé
    // pendant qu'un aperçu automatique est peut-être encore programmé).
    await page.click('#guitar-edit-btn');

    // Lock IMMEDIATELY (soon after entering edit, while the auto-preview from the click might still be scheduled)
    await page.click('#guitar-lock-btn');
    await page.waitForTimeout(100);
    check(await page.evaluate(() => document.getElementById('guitar-lock-btn').classList.contains('active')), "verrouillé juste après le clic");

    // Now wait several seconds to let any pending scheduled Tone.Transport/Draw callbacks from the
    // earlier auto-preview(s) fire, and see if the lock button flips back unexpectedly
    for (let i = 0; i < 6; i++) {
        await page.waitForTimeout(500);
        const active = await page.evaluate(() => document.getElementById('guitar-lock-btn').classList.contains('active'));
        const guitarLock = await page.evaluate(() => JSON.stringify(window.app.guitarLock));
        const displayLock = await page.evaluate(() => JSON.stringify(window.app.guitarDisplayLock));
        console.log(`t=${(i + 1) * 500}ms : active=${active} guitarLock=${guitarLock} displayLock=${displayLock}`);
    }
    const finalActive = await page.evaluate(() => document.getElementById('guitar-lock-btn').classList.contains('active'));
    check(finalActive, "toujours verrouillé après 3 secondes (aucune réinitialisation retardée par un aperçu audio en cours)");

    console.log('\n=== Bilan : ' + PASS + ' PASS / ' + FAIL + ' FAIL ===');
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
