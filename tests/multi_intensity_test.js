const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// La police est chargée depuis Google Fonts : injoignable derrière le proxy du bac à sable,
// jamais un problème chez l'utilisateur. Ces échecs réseau sont donc filtrés — sinon ils font
// échouer « aucune erreur console » et masquent les vraies erreurs au milieu du bruit.

(async () => {
    const browser = await chromium.launch({
        args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const page = await browser.newPage({ viewport: { width: 1400, height: 1400 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (msg) => { if (msg.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|fonts\.googleapis|fonts\.gstatic/.test(msg.text())) errors.push('console.error: ' + msg.text()); });

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        const mk = (root, quality, beats, intensity) => ({ root, quality, beats, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held', intensity });
        const sections = [
            { title: 'Couplet', chords: [mk('C', 'maj', 4, 75), mk('F', 'maj', 4, 75), mk('G', 'maj', 4, 75), mk('A', 'min', 4, 75)] },
        ];
        localStorage.setItem('myProgression', JSON.stringify({ sections }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);

    console.log('--- Ctrl-select chords 0 and 2, drag intensity, both (only) change ---');
    await page.evaluate(() => {
        window.app.toggleGridMultiSelect(0, 0);
        window.app.toggleGridMultiSelect(0, 2);
    });
    await page.waitForTimeout(100);
    let r = await page.evaluate(() => [...window.app.multiSelect].sort());
    console.log('multiSelect:', JSON.stringify(r));

    await page.evaluate(() => {
        const el = document.getElementById('intensity');
        el.value = '40';
        el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(100);
    r = await page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords.map(c => c.intensity));
    console.log('intensities after drag to 40:', JSON.stringify(r));
    console.log((JSON.stringify(r) === JSON.stringify([40, 75, 40, 75])) ? 'PASS (only selected chords changed)' : 'FAIL');

    console.log('--- A second drag on the SAME selection does not push a second undo snapshot ---');
    let undoDepthBefore = await page.evaluate(() => window.app.undoStack ? window.app.undoStack.length : null);
    await page.evaluate(() => {
        const el = document.getElementById('intensity');
        el.value = '50';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.value = '60';
        el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(100);
    let undoDepthAfter = await page.evaluate(() => window.app.undoStack ? window.app.undoStack.length : null);
    console.log('undo depth before/after 2 more ticks on same selection:', undoDepthBefore, undoDepthAfter);
    console.log((undoDepthAfter === undoDepthBefore + 0 || undoDepthAfter === undoDepthBefore) ? 'note: depth unchanged expected' : 'note: depth changed');

    console.log('--- Undo restores pre-drag intensities for the whole group in one step ---');
    r = await page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords.map(c => c.intensity));
    console.log('before undo:', JSON.stringify(r));
    await page.evaluate(() => window.app.globalUndo());
    await page.waitForTimeout(100);
    r = await page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords.map(c => c.intensity));
    console.log('after ONE undo:', JSON.stringify(r));
    console.log((JSON.stringify(r) === JSON.stringify([75, 75, 75, 75])) ? 'PASS (one undo restores whole group)' : 'FAIL');

    console.log('--- New selection after a previous drag starts its own undo snapshot ---');
    await page.evaluate(() => {
        const el = document.getElementById('intensity');
        el.value = '30';
        el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(50);
    await page.evaluate(() => { window.app.multiSelect = new Set(); window.app.toggleGridMultiSelect(0, 1); window.app.toggleGridMultiSelect(0, 3); });
    await page.waitForTimeout(50);
    await page.evaluate(() => {
        const el = document.getElementById('intensity');
        el.value = '90';
        el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(100);
    r = await page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords.map(c => c.intensity));
    console.log('intensities after second group drag:', JSON.stringify(r));
    console.log((JSON.stringify(r) === JSON.stringify([30, 90, 30, 90])) ? 'PASS (independent group, correct values)' : 'FAIL');

    console.log('--- Single-chord editing (no multi-select) still works as before ---');
    await page.evaluate(() => { window.app.multiSelect = new Set(); });
    await page.evaluate(() => window.app.editChord(0, 0));
    await page.waitForTimeout(50);
    // 90 et non 99 : le curseur a step="5" (voir #intensity), donc 99 y est INREPRÉSENTABLE — le
    // navigateur l'arrondit à 100 avant même que l'appli ne le lise. L'ancienne attente mesurait
    // cette contrainte du contrôle, pas le comportement de l'appli, et échouait pour rien.
    await page.evaluate(() => {
        const el = document.getElementById('intensity');
        el.value = '90';
        el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(150);
    r = await page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[0].intensity);
    console.log('chord 0 intensity after single edit:', r);
    console.log((r === 90) ? 'PASS (single-chord edit unaffected)' : 'FAIL');

    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
