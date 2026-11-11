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
    // Depuis le lot 10d, toucher la case ouvre le panneau d'accord, et la page peut bouger de QUELQUES pixels pour garder la case entre la
    // barre-résumé (collante tant que le panneau est là) et le panneau — c'est voulu (« l'accord visible au-dessus »). Ce que ce banc interdit, le saut
    // vers le diagramme d'avant, reste interdit : le déplacement est borné à une demi-case, et la case est à l'écran, non recouverte.
    const vue = await page.evaluate(() => {
        const c = document.querySelector('.grid-cell[data-index="0"]').getBoundingClientRect();
        const dessus = document.elementFromPoint(c.left + c.width / 2, c.top + c.height / 2);
        const pa = document.getElementById('panneau-accord').getBoundingClientRect();
        return { haut: Math.round(c.top), bas: Math.round(c.bottom), libre: !!dessus && !!dessus.closest('.grid-cell[data-index="0"]'), auDessusDuPanneau: c.bottom <= pa.top + 1,
            panneauCache: document.getElementById('panneau-accord').hidden };
    });
    console.log('scrollY before:', before, 'after:', after, 'case:', JSON.stringify(vue));
    // Lot 10e : sans la carte « Nouvel accord » la page est plus courte et le panneau, plus haut que ce qui reste à défiler, la fait descendre davantage pour
    // garder la case entre la barre-résumé et lui (110px ici) : c'est le défilement voulu du lot 10d, pas le saut vers le diagramme. Borné à deux cases (128px).
    // Refonte du séquenceur, point B (11/11) : un toucher CHOISIT la case et la fait entendre, il n'ouvre plus le panneau — donc plus aucun défilement :
    // la page doit rester EXACTEMENT où elle était, la case libre à l'écran (le saut vers le diagramme reste interdit, et même le petit défilement du 10d n'a plus lieu).
    console.log((after === before && vue.libre && vue.panneauCache) ? 'PASS (no scroll jump on mobile : un toucher ne fait rien défiler)' : 'FAIL');
    await page.close();

    // Refonte du séquenceur, point C (11/11) : « il recadre l'écran à chaque fois » — editChord ne fait PLUS défiler vers la carte à l'ordinateur (la grille ne
    // doit pas bouger). Contrat inversé : le scrollIntoView ne doit plus être appelé.
    console.log('--- Desktop (1280px): opening a chord in Modification does NOT scroll the diagram into view anymore ---');
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
    console.log(!r2 ? 'PASS (desktop ne recentre plus rien à l\'ouverture)' : 'FAIL');
    await page.close();

    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
})();
