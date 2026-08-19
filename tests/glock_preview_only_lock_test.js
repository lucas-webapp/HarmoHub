const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

async function cellBox(page, section, index) {
    const sel = `.grid-cell[data-section="${section}"][data-index="${index}"]`;
    await page.waitForSelector(sel);
    return page.locator(sel).boundingBox();
}
async function clickCellSafe(page, section, index) {
    const box = await cellBox(page, section, index);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height - 6);
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

    console.log('appMode:', await page.evaluate(() => window.app.appMode));
    console.log('editingIndex:', await page.evaluate(() => window.app.editingIndex));
    console.log('panel root/quality BEFORE clicking any cell:', await page.evaluate(() => document.getElementById('root').value + ' ' + document.getElementById('quality').value));

    // SINGLE click (real, not double) on chord index 2 (D#m) -- preview only, stays in 'Ajout' mode,
    // matches the exact scenario from the user's screenshot (panel still shows default C/Majeur while
    // the big display/grid selection shows D#m).
    await clickCellSafe(page, 0, 2);
    await page.waitForTimeout(200);

    console.log('appMode after single click:', await page.evaluate(() => window.app.appMode));
    console.log('panel root/quality after single click:', await page.evaluate(() => document.getElementById('root').value + ' ' + document.getElementById('quality').value));
    console.log('big title shown:', await page.evaluate(() => document.querySelector('.chord-title')?.textContent));

    const nFingerings = await page.evaluate(() => window.app.guitarFingerings.length);
    console.log('fingerings shown:', nFingerings);

    // Le cadenas vit maintenant dans la fenêtre d'édition manuelle (voir #guitar-edit-btn) : l'ouvrir
    // n'affecte pas this.guitarPreviewPos (ensureGuitarDiagram ne le remet à null qu'en LIVE, pas en
    // simple aperçu) — le scénario testé ici (clic cadenas EN APERÇU) reste donc intact.
    await page.click('#guitar-edit-btn');
    await page.waitForTimeout(120);

    // Now click the lock button WHILE merely previewing (not editing) -- this is the suspected buggy path
    await page.click('#guitar-lock-btn');
    await page.waitForTimeout(200);

    const activeAfterClick = await page.evaluate(() => document.getElementById('guitar-lock-btn').classList.contains('active'));
    console.log('lock button active after clicking while merely previewing:', activeAfterClick);

    const savedLockForD_sharp_m = await page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[2].guitarLock);
    console.log('guitarLock actually saved for D#m (chord index 2) in storage:', JSON.stringify(savedLockForD_sharp_m));
    check(!!savedLockForD_sharp_m, "le verrou cliqué en simple aperçu (sans double-clic pour éditer) est bien sauvegardé sur LE BON accord (D#m)");

    // Re-preview it (single click elsewhere then back) to see if it now shows correctly locked
    await clickCellSafe(page, 0, 0);
    await page.waitForTimeout(150);
    await clickCellSafe(page, 0, 2);
    await page.waitForTimeout(150);
    const reshowActive = await page.evaluate(() => document.getElementById('guitar-lock-btn').classList.contains('active'));
    check(reshowActive, "en revenant sur l'accord D#m (simple clic), le cadenas montre bien verrouillé");

    console.log('\n=== Bilan : ' + PASS + ' PASS / ' + FAIL + ' FAIL ===');
    await browser.close();
    process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
