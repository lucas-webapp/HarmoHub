const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

(async () => {
    const browser = await chromium.launch({
        args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0,5).join('\n')));
    page.on('console', (msg) => {
        const t = msg.type();
        if (t === 'error' || t === 'warning') {
            const text = msg.text();
            if (text.includes('Failed to load resource') || text.includes('AudioContext was not allowed')) return;
            errors.push(t + ': ' + text);
        }
    });

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        const sections = [{ title: 'Couplet', chords: [
            { root: 'C', quality: 'maj', beats: 4, inversion: 0, drop: 0, octave: 4, bass: null, playStyle: 'held' },
            { root: 'A', quality: 'min7', beats: 4, inversion: 0, drop: 0, octave: 4, bass: null, playStyle: 'held' },
            { root: 'F', quality: 'maj7', beats: 4, inversion: 0, drop: 0, octave: 4, bass: null, playStyle: 'held' },
        ]}];
        localStorage.setItem('myProgression', JSON.stringify({ sections }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);

    console.log('--- Open grid zoom, click middle chord, inspect continuous layout ---');
    await page.click('#grid-zoom');
    await page.waitForTimeout(150);
    await page.evaluate(() => window.app.editChordFromSequencer(0, 1));
    await page.waitForTimeout(200);

    let r = await page.evaluate(() => {
        const host = document.getElementById('arp-sequencer');
        const grid = host.querySelector('.seq-grid');
        const scrollEl = host.querySelector('.seq-scroll');
        const ctxCells = host.querySelectorAll('.seq-ctx-cell');
        const realCells = host.querySelectorAll('.seq-cell');
        return {
            colOffset: grid.dataset.colOffset,
            gridTemplateColumns: grid.style.gridTemplateColumns.slice(0, 80),
            scrollLeft: scrollEl.scrollLeft,
            scrollWidth: scrollEl.scrollWidth,
            clientWidth: scrollEl.clientWidth,
            hasContinuousClass: !!host.querySelector('.seq-grid-continuous'),
            hasScrollContinuousClass: !!host.querySelector('.seq-scroll-continuous'),
            ctxCellCount: ctxCells.length,
            realCellCount: realCells.length,
        };
    });
    console.log(JSON.stringify(r, null, 2));

    console.log('--- Body scroll lock check ---');
    r = await page.evaluate(() => ({
        bodyLocked: document.body.classList.contains('body-scroll-locked'),
        overflowComputed: getComputedStyle(document.body).overflow,
    }));
    console.log(JSON.stringify(r));

    await page.evaluate(() => window.app.closeGridZoom());
    await page.waitForTimeout(100);
    r = await page.evaluate(() => ({ bodyLocked: document.body.classList.contains('body-scroll-locked') }));
    console.log('After closing grid zoom:', JSON.stringify(r));

    console.log('Errors collected (filtered):', JSON.stringify(errors, null, 2));

    await browser.close();
    process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
