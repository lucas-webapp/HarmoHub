const { chromium } = require('playwright');
// RÉGRESSION : cliquer sur un accord voisin dans le séquenceur continu doit basculer l'édition sur
// LUI. La suppression de la vue plein écran de la grille avait emporté editChordFromGridZoom, mais
// pas son appel : le clic levait « editChordFromGridZoom is not a function » et ne faisait rien.
// Les bancs qui couvraient ce chemin appelaient eux-mêmes la méthode disparue pour préparer leur
// scène — ils tombaient à la mise en place, avant l'assertion, et masquaient le défaut.
// Ce banc-ci ne passe QUE par l'interface : un vrai clic, et rien d'autre.
let PASS = 0, FAIL = 0;
const check = (c, l) => { if (c) { PASS++; console.log('PASS - ' + l); } else { FAIL++; console.log('FAIL - ' + l); } };
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';

(async () => {
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/fonts\.googleapis|fonts\.gstatic|ERR_/.test(m.text())) errors.push('console: ' + m.text()); });

    await page.goto(BASE + '/index.html?nocache=' + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        const mk = (r, q, b) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 0, octave: 3, bass: null, playStyle: 'held' });
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [
            mk('C', 'maj', 4), mk('A', 'min7', 4), mk('D', 'min7', 4), mk('G', '7', 4)] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(400);
    // Mise en scène par l'INTERFACE uniquement : double-clic sur la 2e case, puis bouton du volet.
    const cellule = i => page.click(`.grid-cell[data-index="${i}"]`, { position: { x: 40, y: 40 } });
    await cellule(1); await cellule(1); await page.waitForTimeout(400);
    await page.click('#grid-zoom');
    await page.waitForTimeout(700);
    check(await page.evaluate(() => window.app.editingIndex) === 1, 'on édite bien le 2e accord au départ');

    console.log('--- Clic sur la zone d\'un accord voisin ---');
    const avant = errors.length;
    const cible = await page.evaluate(() => {
        const z = document.querySelector('.seq-ctx-nav[data-target-index="3"]');
        if (!z) return null;
        const r = z.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + Math.min(r.height / 2, 60), titre: z.title };
    });
    console.log(JSON.stringify(cible));
    check(!!cible, 'la zone du 4e accord est bien présente et cliquable');
    await page.mouse.click(cible.x, cible.y);
    await page.waitForTimeout(600);
    const apres = await page.evaluate(() => ({
        edite: window.app.editingIndex,
        // Le rectangle orangé de la grille doit suivre, comme pour un clic direct dans la grille.
        surligne: [...document.querySelectorAll('.grid-cell')].findIndex(c => c.classList.contains('editing')),
        // Et le séquenceur doit s'être reconstruit autour de CE nouvel accord.
        colonneAccord: document.querySelector('.seq-grid-continuous')?.dataset.colOffset,
    }));
    console.log(JSON.stringify(apres));
    check(apres.edite === 3, `le clic bascule l'édition sur l'accord voisin — editingIndex=${apres.edite}`);
    check(errors.length === avant, `aucune erreur levée par ce clic — ${JSON.stringify(errors.slice(avant))}`);
    check(apres.surligne === 3, `la grille d'accords suit — case surlignée n°${apres.surligne}`);
    // colOffset compte des DOUBLES CROCHES, pas des temps : 3 accords x 4 temps x SEQ_STEPS_PER_BEAT.
    check(+apres.colonneAccord === 48, `le séquenceur s'est reconstruit autour de lui — décalage ${apres.colonneAccord} doubles croches (3 accords de 4 temps)`);

    console.log('--- Et dans l\'autre sens (accord AVANT celui édité) ---');
    const gauche = await page.evaluate(() => {
        const z = document.querySelector('.seq-ctx-nav[data-target-index="0"]');
        if (!z) return null;
        const r = z.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + Math.min(r.height / 2, 60) };
    });
    if (gauche && gauche.x > 0) {
        await page.mouse.click(gauche.x, gauche.y);
        await page.waitForTimeout(600);
        check(await page.evaluate(() => window.app.editingIndex) === 0, 'un accord précédent se sélectionne aussi');
    } else {
        // Hors champ après recentrage : on le ramène à l'écran avant de cliquer.
        await page.evaluate(() => { document.querySelector('.seq-scroll-continuous').scrollLeft = 0; });
        await page.waitForTimeout(300);
        const g2 = await page.evaluate(() => {
            const z = document.querySelector('.seq-ctx-nav[data-target-index="0"]');
            const r = z.getBoundingClientRect();
            return { x: r.left + 20, y: r.top + Math.min(r.height / 2, 60) };
        });
        await page.mouse.click(g2.x, g2.y);
        await page.waitForTimeout(600);
        check(await page.evaluate(() => window.app.editingIndex) === 0, 'un accord précédent se sélectionne aussi (après remise à gauche)');
    }

    console.log('Errors:', JSON.stringify(errors));
    check(errors.length === 0, 'aucune erreur JavaScript sur tout le parcours');
    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
