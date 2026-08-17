// Deux sujets qui vivaient dans l'en-tête de l'ancienne vue plein écran de la grille et qui ont
// simplement changé d'adresse :
//   1. Annuler / Rétablir doivent s'activer après une modification de la grille et faire leur travail.
//      L'en-tête plein écran portait ses propres #grid-zoom-undo / #grid-zoom-redo ; il n'y a plus
//      qu'UNE paire, globale, dans la barre du haut (#global-undo-btn / #global-redo-btn).
//   2. Pincer à deux doigts sur de VRAIES cases de la grille doit zoomer, jamais déclencher un
//      glisser-réordonner parasite. Ce défaut-là est indépendant de toute loupe : il vient du fait que
//      les cases sont à la fois zoomables et déplaçables. Le pincement s'applique à la grille classique
//      (voir setupPinchZoom(#progression-sections, 'classicGrid')), donc aux niveaux
//      classicGridZoomLevelX/Y — l'ancien banc lisait gridZoomLevelX/Y, l'échelle de la vue supprimée,
//      qui n'existe plus : ses deux assertions de zoom lisaient `undefined > undefined`, toujours faux.
//
// Il montait sa scène par app.openGridZoom(), disparue : il mourait avant tout le reste.
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('annuler/rétablir + pincer la grille');
plan(12);

(async () => {
    const browser = await chromium.launch({
        args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const page = await browser.newPage({ viewport: { width: 390, height: 700 }, hasTouch: true, isMobile: true });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (msg) => { if (msg.type() === 'error' && !msg.text().includes('CONNECTION') && !msg.text().includes('TUNNEL')) errors.push('console.error: ' + msg.text()); });

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [
            { root: 'C', quality: 'maj', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
            { root: 'F', quality: 'maj', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
            { root: 'G', quality: 'maj', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
        ] }] }));
        // Échelles remises à 1 : elles sont mémorisées par appareil, une campagne précédente aurait
        // sinon laissé la grille déjà zoomée au maximum, où un pincement ne peut plus rien changer.
        localStorage.removeItem('harmohubClassicGridZoomLevelX');
        localStorage.removeItem('harmohubClassicGridZoomLevelY');
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(400);

    console.log('=== 1. Annuler / Rétablir globaux après une modification de la grille ===');
    const boutons = () => page.evaluate(() => ({
        annulerLa: !!document.getElementById('global-undo-btn'),
        retablirLa: !!document.getElementById('global-redo-btn'),
        annulerEteint: document.getElementById('global-undo-btn').disabled,
        retablirEteint: document.getElementById('global-redo-btn').disabled,
        cases: document.querySelectorAll('#progression-sections .grid-cell').length,
    }));

    const depart = await boutons();
    console.log(JSON.stringify(depart));
    if (!exiger(depart.annulerLa && depart.retablirLa, 'les boutons annuler/rétablir existent bien dans la barre du haut')) bilan();
    check(depart.annulerEteint === true, 'annuler est désactivé au départ (aucun historique)');
    const nbDepart = depart.cases;

    await page.evaluate(() => window.app.removeChord(0, 0)); // vraie modif de grille -> peuple l'historique
    await page.waitForTimeout(250);
    const apresSuppr = await boutons();
    console.log('après suppression :', JSON.stringify(apresSuppr));
    check(apresSuppr.cases === nbDepart - 1, `removeChord a bien retiré un accord de la grille (${nbDepart} -> ${apresSuppr.cases})`);
    check(apresSuppr.annulerEteint === false, "annuler s'active bien après une modification de la grille");

    await page.click('#global-undo-btn');
    await page.waitForTimeout(300);
    const apresAnnuler = await boutons();
    console.log('après annuler :', JSON.stringify(apresAnnuler));
    check(apresAnnuler.cases === nbDepart, "« Annuler » restaure bien l'accord supprimé");
    check(apresAnnuler.retablirEteint === false, "rétablir s'active bien après un annuler");

    await page.click('#global-redo-btn');
    await page.waitForTimeout(300);
    const apresRetablir = await boutons();
    console.log('après rétablir :', JSON.stringify(apresRetablir));
    check(apresRetablir.cases === nbDepart - 1, "« Rétablir » réapplique bien la suppression");
    await page.click('#global-undo-btn'); // remet l'état d'origine pour la suite
    await page.waitForTimeout(300);

    console.log('=== 2. Pincer à deux doigts sur de VRAIES cases : zoome, ne réordonne pas ===');
    const ordreAvant = await page.evaluate(() => [...document.querySelectorAll('#progression-sections .grid-cell .cell-sym')].map(e => e.textContent.trim()));
    const zoomAvant = await page.evaluate(() => ({ x: window.app.classicGridZoomLevelX, y: window.app.classicGridZoomLevelY }));
    exiger(typeof zoomAvant.x === 'number' && typeof zoomAvant.y === 'number',
        `les deux échelles de la grille classique sont bien lisibles — ${JSON.stringify(zoomAvant)}`);

    const pincement = await page.evaluate(() => {
        const cases = document.querySelectorAll('#progression-sections .grid-cell');
        const a = cases[0], b = cases[1];
        const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        const ev = (type, id, r, dx = 0, dy = 0) => new PointerEvent(type, {
            pointerId: id, pointerType: 'touch', clientX: r.left + r.width / 2 + dx, clientY: r.top + r.height / 2 + dy, bubbles: true, cancelable: true,
        });
        a.dispatchEvent(ev('pointerdown', 1, ra));
        b.dispatchEvent(ev('pointerdown', 2, rb));
        // Écarte les deux doigts par paliers largement supérieurs au pas de zoom.
        a.dispatchEvent(ev('pointermove', 1, ra, -30, 0));
        b.dispatchEvent(ev('pointermove', 2, rb, 30, 0));
        a.dispatchEvent(ev('pointermove', 1, ra, -60, 0));
        b.dispatchEvent(ev('pointermove', 2, rb, 60, 0));
        a.dispatchEvent(ev('pointerup', 1, ra));
        b.dispatchEvent(ev('pointerup', 2, rb));
        return {
            x: window.app.classicGridZoomLevelX, y: window.app.classicGridZoomLevelY,
            glisser: window.app.drag, doigtsActifs: [...window.app._gridActiveTouchIds],
        };
    });
    await page.waitForTimeout(250);
    const ordreApres = await page.evaluate(() => [...document.querySelectorAll('#progression-sections .grid-cell .cell-sym')].map(e => e.textContent.trim()));
    console.log(JSON.stringify({ ordreAvant, ordreApres, zoomAvant, pincement }));

    check(JSON.stringify(ordreAvant) === JSON.stringify(ordreApres),
        `l'ordre des accords n'a PAS changé pendant le pincement — ${JSON.stringify(ordreApres)}`);
    check(pincement.x > zoomAvant.x && pincement.y > zoomAvant.y,
        `le pincement a bien zoomé les 2 axes de la grille (${zoomAvant.x} -> ${pincement.x} en H, ${zoomAvant.y} -> ${pincement.y} en V)`);
    check(pincement.glisser === null, 'aucun glisser de case ne reste actif après le pincement');
    check(pincement.doigtsActifs.length === 0, 'plus aucun doigt suivi comme actif après le relâchement des deux');

    console.log('Errors:', JSON.stringify(errors));
    check(errors.length === 0, 'aucune erreur JavaScript pendant tout le scénario');
    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
