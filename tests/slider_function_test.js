const { chromium, devices } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

(async () => {
    const browser = await chromium.launch();
    const iphone = devices['iPhone 13'];
    const context = await browser.newContext({ ...iphone });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    // Tempo, groove et métronome vivaient dans l'onglet Config, qui n'existe plus : ils sont dans le
    // bloc « Morceau », replié par défaut. On déplie s'il le faut — #song-summary est une bascule,
    // un clic de trop refermerait.
    const deplieReglages = async () => {
        if (await page.evaluate(() => document.getElementById('song-settings').hidden)) {
            await page.click('#song-summary');
            await page.waitForTimeout(250);
        }
    };
    await page.evaluate(() => { localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'S', chords: [{ root: 'C', quality: 'maj', beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' }] }] })); });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(300);

    await deplieReglages();
    await page.waitForTimeout(150);
    await page.evaluate(() => { document.getElementById('open-settings').click(); });
    await page.waitForTimeout(200);

    const before = await page.inputValue('#general-volume');
    console.log('general-volume before:', before);

    const box = await page.locator('#general-volume').boundingBox();
    // Real touch drag on the thumb (currently near the right end since value=100) toward the middle
    await page.touchscreen.tap(box.x + box.width * 0.5, box.y + box.height / 2);
    await page.waitForTimeout(150);
    const after = await page.inputValue('#general-volume');
    console.log('general-volume after tapping mid-track:', after);
    check(after !== before, "taper au milieu du rail déplace bien le curseur (valeur changée)");

    // Verify #intensity thumb color reflects edit mode
    await page.evaluate(() => { document.getElementById('settings-overlay').hidden = true; window.app.settingsOpen = false; });
    await deplieReglages(); // no-op, just ensure state; now go edit a chord
    await page.evaluate(() => { window.app.editChord(0, 0); });
    await page.waitForTimeout(150);
    const thumbColorEdit = await page.evaluate(() => {
        const el = document.getElementById('intensity');
        return getComputedStyle(el, '::-webkit-slider-thumb').backgroundColor;
    });
    console.log('intensity thumb color in edit mode (pseudo-element, may be empty depending on engine):', thumbColorEdit);

    check(pageErrors.length === 0, "aucune erreur JS — " + JSON.stringify(pageErrors));

    console.log('\n=== Bilan : ' + PASS + ' PASS / ' + FAIL + ' FAIL ===');
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
