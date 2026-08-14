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
        const mk = (root, quality) => ({ root, quality, beats: 4, inversion: 0, drop: 0, octave: 4, bass: null, playStyle: 'held' });
        const sections = [{ title: 'Couplet', chords: [mk('C', 'maj'), mk('D', 'min'), mk('E', 'min'), mk('F', 'maj'), mk('G', '7'), mk('A', 'min')] }];
        localStorage.setItem('myProgression', JSON.stringify({ sections }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);

    const cellRect = async (index) => page.evaluate((i) => {
        const cell = document.querySelector(`.grid-cell[data-index="${i}"]`);
        const r = cell.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, index);

    console.log('--- Ctrl+click chord 0 and chord 2 to build a multi-selection ---');
    let p0 = await cellRect(0);
    await page.keyboard.down('Control');
    await page.mouse.move(p0.x, p0.y);
    await page.mouse.down();
    await page.mouse.up();
    let p2 = await cellRect(2);
    await page.mouse.move(p2.x, p2.y);
    await page.mouse.down();
    await page.mouse.up();
    await page.keyboard.up('Control');
    let r = await page.evaluate(() => ({ multiSelect: [...window.app.multiSelect].sort(), selectedIndex: window.app.selectedIndex }));
    console.log('selection:', JSON.stringify(r));

    console.log('--- Ctrl+drag from chord 0 (part of selection) to the position of chord 4 ---');
    p0 = await cellRect(0);
    const p4 = await cellRect(4);
    await page.keyboard.down('Control');
    await page.mouse.move(p0.x, p0.y);
    await page.mouse.down();
    // move in a few steps past the 6px threshold, ending over chord 4's cell
    await page.mouse.move(p0.x + 20, p0.y, { steps: 3 });
    await page.mouse.move(p4.x, p4.y, { steps: 5 });
    await page.waitForTimeout(50);
    r = await page.evaluate(() => {
        const ghost = document.querySelector('.drag-ghost');
        return { ghostBadge: ghost ? (ghost.querySelector('.drag-ghost-badge') || {}).textContent : null };
    });
    console.log('mid-drag:', JSON.stringify(r));
    await page.mouse.up();
    await page.keyboard.up('Control');
    await page.waitForTimeout(100);

    r = await page.evaluate(() => {
        const chords = JSON.parse(localStorage.getItem('myProgression')).sections[0].chords;
        return {
            count: chords.length,
            symbols: chords.map(c => c.root + c.quality),
            multiSelect: [...window.app.multiSelect].sort((a, b) => a - b),
        };
    });
    console.log('after drop:', JSON.stringify(r));
    // Original: C E- (Csuffix)... wait quality strings: mk('C','maj')->Cmaj, mk('D','min')->Dmin, mk('E','min')->Emin,
    // mk('F','maj')->Fmaj, mk('G','7')->G7, mk('A','min')->Amin
    // Expect: original 6 chords + 2 copies (Cmaj, Emin) inserted somewhere around index 4/5 (where chord 4, Gmaj7, was)
    const expectedCopies = ['Cmaj', 'Emin'];
    const hasBothCopies = expectedCopies.every(sym => r.symbols.filter(s => s === sym).length === 2);
    console.log(hasBothCopies && r.count === 8 ? 'PASS (both selected chords copied as a group)' : 'FAIL');

    console.log('Errors collected:', JSON.stringify(errors, null, 2));

    await browser.close();
    process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
