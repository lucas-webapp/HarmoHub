const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// La police est chargée depuis Google Fonts : injoignable derrière le proxy du bac à sable,
// jamais un problème chez l'utilisateur. Ces échecs réseau sont donc filtrés — sinon ils font
// échouer « aucune erreur console » et masquent les vraies erreurs au milieu du bruit.

(async () => {
    const browser = await chromium.launch({
        args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (msg) => { if (msg.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|fonts\.googleapis|fonts\.gstatic/.test(msg.text())) errors.push('console.error: ' + msg.text()); });

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        const sections = [{ title: 'Couplet', chords: [
            { root: 'C', quality: 'maj', beats: 4, inversion: 0, drop: 0, octave: 4, bass: null, playStyle: 'held' },
            { root: 'A', quality: 'min7', beats: 4, inversion: 0, drop: 0, octave: 4, bass: null, playStyle: 'held' },
            { root: 'F', quality: 'maj7', beats: 4, inversion: 0, drop: 0, octave: 4, bass: null, playStyle: 'held' },
            { root: 'G', quality: '7', beats: 4, inversion: 0, drop: 0, octave: 4, bass: null, playStyle: 'held' },
        ]}];
        localStorage.setItem('myProgression', JSON.stringify({ sections }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);

    console.log('--- GRID ZOOM: open, check default row-h, beatsPerRow ---');
    await page.click('#grid-zoom');
    await page.waitForTimeout(150);
    let r = await page.evaluate(() => {
        const cg = document.querySelector('#grid-zoom-host .chord-grid');
        const cs = getComputedStyle(cg);
        return { rowH: cs.getPropertyValue('--row-h').trim() || cs.gridAutoRows, beatsPerRow: cg.dataset.beatsPerRow };
    });
    console.log('default:', JSON.stringify(r));

    console.log('--- GRID ZOOM: click V+ three times, row height should grow, beatsPerRow unchanged ---');
    await page.click('#grid-zoom-in-v'); await page.click('#grid-zoom-in-v'); await page.click('#grid-zoom-in-v');
    await page.waitForTimeout(100);
    r = await page.evaluate(() => {
        const cg = document.querySelector('#grid-zoom-host .chord-grid');
        const rowHpx = getComputedStyle(cg).getPropertyValue('grid-auto-rows');
        return { rowHpx, beatsPerRow: cg.dataset.beatsPerRow, gridZoomLevelY: window.app.gridZoomLevelY };
    });
    console.log('after V+3:', JSON.stringify(r));

    console.log('--- GRID ZOOM: click H+ three times, beatsPerRow should SHRINK (fewer per row) ---');
    await page.click('#grid-zoom-in-h'); await page.click('#grid-zoom-in-h'); await page.click('#grid-zoom-in-h');
    await page.waitForTimeout(100);
    r = await page.evaluate(() => {
        const cg = document.querySelector('#grid-zoom-host .chord-grid');
        return { beatsPerRow: cg.dataset.beatsPerRow, gridZoomLevelX: window.app.gridZoomLevelX };
    });
    console.log('after H+3:', JSON.stringify(r));
    const passGridH = +r.beatsPerRow < 32; // default was 32 (8 bars * 4 beats) for 4/4 zoomed
    console.log(passGridH ? 'PASS (grid horizontal zoom reduced beats/row)' : 'FAIL');

    await page.click('#grid-zoom-close');
    await page.waitForTimeout(100);

    console.log('--- SEQ ZOOM: open on chord 0, check default cell height ---');
    await page.evaluate(() => { window.app.editChord(0, 0); if (!window.app.seqOpen) window.app.toggleSequencer(); });
    await page.waitForTimeout(100);
    await page.click('#seq-zoom');
    await page.waitForTimeout(150);
    r = await page.evaluate(() => {
        const cell = document.querySelector('#seq-zoom-host .seq-cell');
        return { height: cell ? getComputedStyle(cell).height : null, seqZoomLevelY: window.app.seqZoomLevelY };
    });
    console.log('default seq cell height:', JSON.stringify(r));

    console.log('--- SEQ ZOOM: click V+ three times, cell height should grow ---');
    await page.click('#seq-zoom-in-v'); await page.click('#seq-zoom-in-v'); await page.click('#seq-zoom-in-v');
    await page.waitForTimeout(100);
    r = await page.evaluate(() => {
        const cell = document.querySelector('#seq-zoom-host .seq-cell');
        return { height: cell ? getComputedStyle(cell).height : null, seqZoomLevelY: window.app.seqZoomLevelY };
    });
    console.log('after V+3:', JSON.stringify(r));

    console.log('--- SEQ ZOOM: click H+ three times (4-beat chord = 1 bar/page already at min, check no crash) ---');
    await page.click('#seq-zoom-in-h'); await page.click('#seq-zoom-in-h'); await page.click('#seq-zoom-in-h');
    await page.waitForTimeout(100);
    r = await page.evaluate(() => ({ seqZoomLevelX: window.app.seqZoomLevelX, pageNavExists: !!document.querySelector('.seq-page-nav') }));
    console.log('after H+3:', JSON.stringify(r));

    console.log('--- Persistence: close+reopen page, zoom levels should survive ---');
    r = await page.evaluate(() => ({
        x: localStorage.getItem('harmohubGridZoomLevelX'),
        y: localStorage.getItem('harmohubGridZoomLevelY'),
        sx: localStorage.getItem('harmohubSeqZoomLevelX'),
        sy: localStorage.getItem('harmohubSeqZoomLevelY'),
    }));
    console.log('persisted:', JSON.stringify(r));

    console.log('Errors collected:', JSON.stringify(errors, null, 2));

    await browser.close();
    process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
