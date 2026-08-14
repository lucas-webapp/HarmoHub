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
        const sections = [{ title: 'Couplet', chords: [mk('C', 'maj'), mk('A', 'min7'), mk('F', 'maj7')] }];
        localStorage.setItem('myProgression', JSON.stringify({ sections }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);

    console.log('--- Open grid-zoom + edit a chord: pinned zoom buttons should exist ---');
    await page.click('#grid-zoom');
    await page.waitForTimeout(150);
    await page.evaluate(() => window.app.editChordFromGridZoom(0, 1));
    await page.waitForTimeout(150);
    let r = await page.evaluate(() => ({
        hHasOut: !!document.getElementById('seq-zoom-out-h-pinned'),
        hHasIn: !!document.getElementById('seq-zoom-in-h-pinned'),
        vHasOut: !!document.getElementById('seq-zoom-out-v-pinned'),
        vHasIn: !!document.getElementById('seq-zoom-in-v-pinned'),
        seqZoomed: document.getElementById('arp-sequencer').classList.contains('seq-zoomed'),
        cellHeightBefore: getComputedStyle(document.querySelector('.seq-cell')).height,
        colWidthBefore: getComputedStyle(document.querySelector('.seq-grid')).gridTemplateColumns.split(' ')[1],
    }));
    console.log(JSON.stringify(r));
    console.log((r.hHasOut && r.hHasIn && r.vHasOut && r.vHasIn && r.seqZoomed) ? 'PASS (pinned zoom buttons present, seq-zoomed applied)' : 'FAIL');

    console.log('--- Click V+ 3 times: cell height should grow ---');
    await page.click('#seq-zoom-in-v-pinned'); await page.click('#seq-zoom-in-v-pinned'); await page.click('#seq-zoom-in-v-pinned');
    await page.waitForTimeout(150);
    let r2 = await page.evaluate(() => ({
        y: window.app.seqZoomLevelY,
        cellHeight: getComputedStyle(document.querySelector('.seq-cell')).height,
    }));
    console.log(JSON.stringify(r2));
    console.log((r2.y === 1.3 && parseFloat(r2.cellHeight) > parseFloat(r.cellHeightBefore)) ? 'PASS (V zoom grew cell height)' : 'FAIL');

    console.log('--- Click H+ 3 times: continuous column width should grow ---');
    await page.click('#seq-zoom-in-h-pinned'); await page.click('#seq-zoom-in-h-pinned'); await page.click('#seq-zoom-in-h-pinned');
    await page.waitForTimeout(150);
    let r3 = await page.evaluate(() => ({
        x: window.app.seqZoomLevelX,
        colWidth: getComputedStyle(document.querySelector('.seq-grid')).gridTemplateColumns.split(' ')[1],
    }));
    console.log(JSON.stringify(r3));
    console.log((r3.x === 1.3 && parseFloat(r3.colWidth) > parseFloat(r.colWidthBefore)) ? 'PASS (H zoom grew column width)' : 'FAIL');

    console.log('--- Standalone seq-zoom overlay shares the SAME seqZoomLevelX/Y (same state) ---');
    r = await page.evaluate(() => ({ x: window.app.seqZoomLevelX, y: window.app.seqZoomLevelY }));
    console.log(JSON.stringify(r));
    console.log((r.x === 1.3 && r.y === 1.3) ? 'PASS (shared state confirmed)' : 'FAIL');

    console.log('--- Unpin (close grid-zoom): seq-zoomed class removed from compact host ---');
    await page.click('#grid-zoom-close');
    await page.waitForTimeout(150);
    r = await page.evaluate(() => ({ seqZoomed: document.getElementById('arp-sequencer').classList.contains('seq-zoomed') }));
    console.log(JSON.stringify(r));
    console.log((!r.seqZoomed) ? 'PASS (seq-zoomed removed after unpinning)' : 'FAIL');

    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
