const { chromium } = require('playwright');
// RÉGRESSION, même famille que le clic sur un accord voisin : « Appliquer à tout le morceau »
// appelait syncGridZoomPinnedSeq, méthode partie avec la vue plein écran de la grille. L'appel a
// survécu : la méthode levait une TypeError juste après avoir écrit les données, et tout ce qui
// suivait (report sur une lecture en cours) ne s'exécutait jamais.
let PASS = 0, FAIL = 0;
const check = (c, l) => { if (c) { PASS++; console.log('PASS - ' + l); } else { FAIL++; console.log('FAIL - ' + l); } };
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
(async () => {
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    await page.goto(BASE + '/index.html?nocache=' + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.evaluate(() => {
        const mk = (r, q) => ({ root: r, quality: q, beats: 4, inversion: 0, drop: 0, octave: 3, bass: null, playStyle: 'held', instrument: 'piano' });
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [mk('C','maj'), mk('A','min7'), mk('G','7')] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(500);
    // Un accord EN COURS D'ÉDITION : c'est la seule branche qui touchait la méthode disparue.
    const cellule = i => page.click(`.grid-cell[data-index="${i}"]`, { position: { x: 40, y: 40 } });
    await cellule(1); await cellule(1); await page.waitForTimeout(400);
    check(await page.evaluate(() => window.app.editingIndex) === 1, 'un accord est bien en cours de modification');

    const avant = errors.length;
    await page.selectOption('#instrument', 'organ');
    await page.waitForTimeout(300);
    await page.click('#apply-instrument-all');
    await page.waitForTimeout(600);
    const etat = await page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem('myProgression'));
        return { instruments: s.sections[0].chords.map(c => c.instrument), seqPresent: !!document.querySelector('.seq-grid') };
    });
    console.log(JSON.stringify(etat), JSON.stringify(errors.slice(avant)));
    check(etat.instruments.every(i => i === 'organ'), `tous les accords ont reçu l'instrument — ${etat.instruments.join(', ')}`);
    check(errors.length === avant, `aucune erreur levée par « Appliquer à tout le morceau » — ${JSON.stringify(errors.slice(avant))}`);

    console.log('Errors:', JSON.stringify(errors));
    check(errors.length === 0, 'aucune erreur JavaScript');
    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
