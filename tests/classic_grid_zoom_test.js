const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// La police est chargée depuis Google Fonts : injoignable derrière le proxy du bac à sable,
// jamais un problème chez l'utilisateur. Ces échecs réseau sont donc filtrés — sinon ils font
// échouer « aucune erreur console » et masquent les vraies erreurs au milieu du bruit.

(async () => {
    const browser = await chromium.launch({
        args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (msg) => { if (msg.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|fonts\.googleapis|fonts\.gstatic/.test(msg.text())) errors.push('console.error: ' + msg.text()); });

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        const mk = (root, quality) => ({ root, quality, beats: 4, inversion: 0, drop: 0, octave: 4, bass: null, playStyle: 'held' });
        const chords = Array.from({ length: 10 }, (_, i) => mk(['C', 'D', 'E', 'F', 'G', 'A', 'B'][i % 7], 'maj'));
        const sections = [{ title: 'Couplet', chords }];
        localStorage.setItem('myProgression', JSON.stringify({ sections }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);

    console.log('--- Baseline: classic grid zoom levels default to 1 ---');
    let r = await page.evaluate(() => ({
        x: window.app.classicGridZoomLevelX, y: window.app.classicGridZoomLevelY,
        rowH: getComputedStyle(document.querySelector('.chord-grid')).getPropertyValue('--row-h'),
        beatsPerRow: document.querySelector('.chord-grid').dataset.beatsPerRow,
    }));
    console.log(JSON.stringify(r));

    console.log('--- Click V+ 3 times: row height should grow, beatsPerRow unchanged ---');
    await page.click('#classic-grid-in-v'); await page.click('#classic-grid-in-v'); await page.click('#classic-grid-in-v');
    await page.waitForTimeout(100);
    let r2 = await page.evaluate(() => ({
        y: window.app.classicGridZoomLevelY,
        beatsPerRow: document.querySelector('.chord-grid').dataset.beatsPerRow,
    }));
    console.log(JSON.stringify(r2));
    console.log((r2.y === 1.3 && r2.beatsPerRow === r.beatsPerRow) ? 'PASS (V zoom changed level, beatsPerRow unaffected)' : 'FAIL');

    console.log('--- Click H+ 3 times: beatsPerRow should SHRINK (fewer beats per row) ---');
    await page.click('#classic-grid-in-h'); await page.click('#classic-grid-in-h'); await page.click('#classic-grid-in-h');
    await page.waitForTimeout(100);
    let r3 = await page.evaluate(() => ({
        x: window.app.classicGridZoomLevelX,
        beatsPerRow: document.querySelector('.chord-grid').dataset.beatsPerRow,
    }));
    console.log(JSON.stringify(r3));
    console.log((r3.x === 1.3 && +r3.beatsPerRow < +r.beatsPerRow) ? 'PASS (H zoom reduced beats/row)' : 'FAIL');

    console.log('--- Loupe grid zoom is INDEPENDENT: opening loupe should show levels still at 1 ---');
    await page.click('#grid-zoom');
    await page.waitForTimeout(150);
    let r4 = await page.evaluate(() => ({ x: window.app.gridZoomLevelX, y: window.app.gridZoomLevelY }));
    console.log(JSON.stringify(r4));
    console.log((r4.x === 1 && r4.y === 1) ? 'PASS (loupe zoom untouched by classic zoom)' : 'FAIL');
    await page.click('#grid-zoom-close');
    await page.waitForTimeout(150);

    console.log('--- Classic grid zoom persists across reload (device localStorage) ---');
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);
    let r5 = await page.evaluate(() => ({ x: window.app.classicGridZoomLevelX, y: window.app.classicGridZoomLevelY }));
    console.log(JSON.stringify(r5));
    console.log((r5.x === 1.3 && r5.y === 1.3) ? 'PASS (persisted across reload)' : 'FAIL');

    console.log('--- Persists PER SONG (createNewSongFromCurrentState / loadSong) ---');
    const songId = await page.evaluate(() => {
        window.app.createNewSongFromCurrentState('Zoom Test Song');
        return localStorage.getItem('harmohubCurrentSongId');
    });
    await page.evaluate(() => { window.app.classicGridZoomLevelX = 1; window.app.classicGridZoomLevelY = 1; });
    await page.evaluate((id) => window.app.loadSong(id), songId);
    await page.waitForTimeout(150);
    let r6 = await page.evaluate(() => ({ x: window.app.classicGridZoomLevelX, y: window.app.classicGridZoomLevelY }));
    console.log(JSON.stringify(r6));
    console.log((r6.x === 1.3 && r6.y === 1.3) ? 'PASS (restored from song via loadSong)' : 'FAIL');

    console.log('--- Icon check: #grid-zoom no longer uses the magnifying-glass icon ---');
    let r7 = await page.evaluate(() => {
        const svg = document.getElementById('grid-zoom').querySelector('svg');
        return { hasCircle: !!svg.querySelector('circle'), rectCount: svg.querySelectorAll('rect').length };
    });
    console.log(JSON.stringify(r7));
    console.log((!r7.hasCircle && r7.rectCount === 9) ? 'PASS (grid-zoom icon changed to sequencer bars)' : 'FAIL');

    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
