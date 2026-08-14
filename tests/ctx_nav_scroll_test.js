const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

// Ces zones de navigation contextuelle sont VASTES (224x213px mesurés en 420px de large) et
// débordent la partie visible du séquenceur, qui défile horizontalement. Playwright vise le CENTRE
// d'un élément : ici, ce centre tombe hors de la zone visible, sur le corps de la loupe — d'où un
// « intercepts pointer events » qui n'a rien à voir avec la fonctionnalité. Elle marche : vérifié
// en cliquant un point réellement atteignable, ce que fait ce helper. On teste le geste de
// l'utilisateur (il vise ce qu'il voit), pas la géométrie interne de l'élément.
const cliqueZone = async (page, sel) => {
    const pt = await page.evaluate((s) => {
        const z = document.querySelector(s);
        if (!z) return null;
        // Un accord lointain peut être entierement hors de la partie visible : le sequenceur defile
        // horizontalement. L'utilisateur fait defiler avant de viser, on fait pareil.
        z.scrollIntoView({ block: 'nearest', inline: 'center' });
        const r = z.getBoundingClientRect();
        for (let j = 1; j < 20; j++) for (let i = 1; i < 20; i++) {
            const x = r.left + r.width * i / 20, y = r.top + r.height * j / 20;
            const el = document.elementFromPoint(x, y);
            if (el && el.closest(s.split('[')[0])) return { x, y };
        }
        return null;
    }, sel);
    if (!pt) throw new Error('aucun point atteignable dans ' + sel);
    await page.mouse.click(pt.x, pt.y);
};

(async () => {
    const browser = await chromium.launch({
        args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const page = await browser.newPage({ viewport: { width: 420, height: 800 } });
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        const mk = (root, quality) => ({ root, quality, beats: 4, inversion: 0, drop: 0, octave: 4, bass: null, playStyle: 'held' });
        const sections = [{ title: 'Couplet', chords: [mk('C', 'maj'), mk('A', 'min7'), mk('F', 'maj7'), mk('G', '7')] }];
        localStorage.setItem('myProgression', JSON.stringify({ sections }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);
    await page.click('#grid-zoom');
    await page.waitForTimeout(150);
    await page.evaluate(() => window.app.editChordFromSequencer(0, 1));
    await page.waitForTimeout(200);

    const check = async (label) => {
        const r = await page.evaluate(() => {
            const scrollEl = document.querySelector('#arp-sequencer .seq-scroll');
            const grid = document.querySelector('#arp-sequencer .seq-grid');
            const colOffset = +grid.dataset.colOffset;
            return {
                scrollLeft: scrollEl.scrollLeft,
                expectedCentered: colOffset * 14,
                scrollWidth: scrollEl.scrollWidth,
                clientWidth: scrollEl.clientWidth,
            };
        });
        console.log(label, JSON.stringify(r));
        return r;
    };
    await check('after opening chord 1 (initial)');

    await cliqueZone(page, '.seq-ctx-nav-next');
    await page.waitForTimeout(150);
    await check('after clicking NEXT to chord 2');

    await browser.close();
    process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
