const { chromium, devices } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
(async () => {
    const browser = await chromium.launch();
    const errors = [];

    console.log('--- Mobile (iPhone X, 375px): clicking a chord in Modification does NOT jump the page scroll ---');
    let page = await browser.newPage({ ...devices['iPhone X'] });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        const mk = (root, quality) => ({ root, quality, beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: '', chords: [
            mk('C', 'maj'), mk('D', 'min'), mk('E', 'min'),
        ] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);
    // Scroll down a bit first so we can detect an unwanted jump
    await page.evaluate(() => window.scrollTo(0, 200));
    await page.waitForTimeout(100);
    const before = await page.evaluate(() => window.scrollY);
    // `appMode` n'est plus une variable qu'on pose : c'est un getter déduit de editingIndex — on
    // ne peut plus le contredire. Et `updateAppModeBanner` a disparu avec le bandeau lui-même. Se
    // mettre « en Modification » se fait donc par le seul geste qui l'a jamais vraiment fait :
    // ouvrir un accord.
    await page.evaluate(() => window.app.editChord(0, 0));
    await page.click('.grid-cell[data-index="0"]');
    await page.waitForTimeout(400); // let any smooth-scroll animation finish
    const after = await page.evaluate(() => window.scrollY);
    console.log('scrollY before:', before, 'after:', after);
    console.log((Math.abs(after - before) < 5) ? 'PASS (no scroll jump on mobile)' : 'FAIL');
    await page.close();

    console.log('--- Desktop (1280px): clicking a chord in Modification STILL scrolls the diagram into view ---');
    page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        const mk = (root, quality) => ({ root, quality, beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: '', chords: [
            mk('C', 'maj'), mk('D', 'min'), mk('E', 'min'),
        ] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);
    const spy = await page.evaluate(() => {
        let called = false;
        const el = document.getElementById('current-chord-display');
        const orig = el.scrollIntoView.bind(el);
        el.scrollIntoView = (...args) => { called = true; return orig(...args); };
        window.app.editChord(0, 0); // voir plus haut : le mode se DÉDUIT de l'accord ouvert
        return true;
    });
    await page.click('.grid-cell[data-index="0"]');
    await page.waitForTimeout(200);
    const wasCalled = await page.evaluate(() => document.getElementById('current-chord-display').scrollIntoView.toString().includes('called'));
    // simpler: re-check via a flag set on window
    const r2 = await page.evaluate(() => {
        return new Promise((resolve) => {
            let called = false;
            const el = document.getElementById('current-chord-display');
            const origFn = Element.prototype.scrollIntoView;
            el.scrollIntoView = function(...args) { called = true; };
            window.app.editChord(0, 1);
            setTimeout(() => resolve(called), 50);
        });
    });
    console.log('scrollIntoView called on desktop:', r2);
    console.log(r2 ? 'PASS (desktop still scrolls to the diagram)' : 'FAIL');
    await page.close();

    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
})();
