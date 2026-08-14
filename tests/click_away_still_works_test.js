const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// La police est chargée depuis Google Fonts : injoignable derrière le proxy du bac à sable,
// jamais un problème chez l'utilisateur. Ces échecs réseau sont donc filtrés — sinon ils font
// échouer « aucune erreur console » et masquent les vraies erreurs au milieu du bruit.

let PASS = 0, FAIL = 0;
function check(cond, label) {
    if (cond) { PASS++; console.log('PASS - ' + label); }
    else { FAIL++; console.log('FAIL - ' + label); }
}

(async () => {
    const browser = await chromium.launch({
        args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (msg) => { if (msg.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|fonts\.googleapis|fonts\.gstatic/.test(msg.text())) errors.push('console.error: ' + msg.text()); });

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [
            { root: 'C', quality: 'maj', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
        ] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);

    console.log('=== Un vrai clic AILLEURS (pas sur #grid-zoom/#seq-zoom) désélectionne toujours normalement ===');
    await page.evaluate(() => { window.app.selectedIndex = 0; window.app.activeSection = 0; window.app.loadProgression(); });
    await page.waitForTimeout(50);
    // Clique sur un endroit neutre de la page, hors grille/menu/éditeur (ex. le titre du panneau Morceau)
    await page.click('body', { position: { x: 5, y: 5 } });
    await page.waitForTimeout(80);
    const afterAway = await page.evaluate(() => window.app.selectedIndex);
    check(afterAway === null, "un clic ailleurs (hors grille/loupe) désélectionne toujours bien l'accord (comportement inchangé)");

    console.log('=== Édition en cours + clic ailleurs (hors .col-left) sort toujours du mode édition ===');
    await page.evaluate(() => window.app.editChord(0, 0));
    await page.waitForTimeout(50);
    await page.click('body', { position: { x: 5, y: 5 } });
    await page.waitForTimeout(80);
    const afterAwayEdit = await page.evaluate(() => window.app.editingIndex);
    check(afterAwayEdit === null, "un clic ailleurs sort toujours bien du mode édition (comportement inchangé)");

    console.log('\n=== Bilan : ' + PASS + ' PASS / ' + FAIL + ' FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
