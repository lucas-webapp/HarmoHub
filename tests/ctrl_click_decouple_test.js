const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// La police est chargée depuis Google Fonts : injoignable derrière le proxy du bac à sable,
// jamais un problème chez l'utilisateur. Ces échecs réseau sont donc filtrés — sinon ils font
// échouer « aucune erreur console » et masquent les vraies erreurs au milieu du bruit.
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (msg) => { if (msg.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|fonts\.googleapis|fonts\.gstatic/.test(msg.text())) errors.push('console.error: ' + msg.text()); });
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        const mk = (root, quality) => ({ root, quality, beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: '', chords: [
            mk('C', 'maj'), mk('D', 'min'), mk('E', 'min'), mk('F', 'maj'),
        ] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);

    const cellCenter = async (index) => page.evaluate((i) => {
        const el = document.querySelector(`.grid-cell[data-index="${i}"]`);
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, index);

    console.log('--- Ctrl+click with an 8px tremor (below new 18px copy threshold) should still toggle multi-select, not copy ---');
    let p0 = await cellCenter(0);
    await page.keyboard.down('Control');
    await page.mouse.move(p0.x, p0.y);
    await page.mouse.down();
    await page.mouse.move(p0.x + 8, p0.y, { steps: 3 }); // 8px tremor: below 18px copy threshold, above old 6px
    await page.mouse.up();
    await page.keyboard.up('Control');
    await page.waitForTimeout(100);
    let r = await page.evaluate(() => ({ multiSelect: [...window.app.multiSelect], count: loadProgressionSections()[0].chords.length }));
    console.log(JSON.stringify(r));
    console.log((r.multiSelect.includes(0) && r.count === 4) ? 'PASS (tremor stayed a selection toggle, no accidental copy)' : 'FAIL');

    console.log('--- A genuine Ctrl+drag past 18px should still copy ---');
    await page.keyboard.down('Control');
    await page.mouse.move(p0.x, p0.y);
    await page.mouse.down();
    await page.mouse.move(p0.x + 30, p0.y, { steps: 5 });
    let p2 = await cellCenter(2);
    await page.mouse.move(p2.x, p2.y, { steps: 5 });
    await page.mouse.up();
    await page.keyboard.up('Control');
    await page.waitForTimeout(100);
    r = await page.evaluate(() => ({ count: loadProgressionSections()[0].chords.length }));
    console.log(JSON.stringify(r));
    console.log(r.count === 5 ? 'PASS (deliberate Ctrl+drag still copies)' : 'FAIL');

    console.log('--- Plain (no Ctrl) drag: still reorders past the smaller 10px threshold ---');
    await page.evaluate(() => {
        const mk = (root, quality) => ({ root, quality, beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: '', chords: [
            mk('C', 'maj'), mk('D', 'min'), mk('E', 'min'), mk('F', 'maj'),
        ] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);
    p0 = await cellCenter(0);
    const p3 = await cellCenter(3);
    await page.mouse.move(p0.x, p0.y);
    await page.mouse.down();
    await page.mouse.move(p0.x + 15, p0.y, { steps: 3 });
    await page.mouse.move(p3.x, p3.y, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(100);
    r = await page.evaluate(() => loadProgressionSections()[0].chords.map(c => c.root));
    console.log(JSON.stringify(r));
    console.log((r[0] !== 'C' && r.includes('C')) ? 'PASS (plain drag still reorders)' : 'FAIL');

    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
})();
