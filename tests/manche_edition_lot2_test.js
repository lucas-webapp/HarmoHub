// Lot 2 de l'édition manuelle du manche : onglet « Dessiner sur le manche » — clic direct sur une
// frette pour poser une note (retour utilisateur, point 1 : « je pourrai cliquer directement sur les
// frettes de la guitare, une à une »). Neutre au départ (point 2 : « au début, les notes seront donc
// de couleur neutre »), écoute immédiate au clic, bouton « jouer » pour l'accord en cours de
// construction. Toute corde jamais touchée reste X (pas de 3e état — voir #guitar-edit-tab-draw dans
// script.js). Testé desktop ET mobile (tap réel).
const { chromium, devices } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, plan, bilan } = require('./_harness')('manche : Lot 2 (dessiner au clic)');
plan(15);

(async () => {
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const errors = [];

    // ---------- Desktop ----------
    const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));

    await page.goto(`${BASE}/index.html?nocache=` + Date.now());
    await page.waitForTimeout(500);
    if (!(await page.evaluate(() => document.getElementById('toggle-viz-guitar').getAttribute('aria-pressed') === 'true'))) {
        await page.click('#toggle-viz-guitar');
    }
    await page.waitForTimeout(200);
    await page.click('#guitar-edit-btn');
    await page.waitForTimeout(200);
    await page.click('#guitar-edit-tab-draw');
    await page.waitForTimeout(150);

    check(await page.isDisabled('#guitar-draw-play'), "bouton Jouer désactivé, manche vide au départ");
    const initial = await page.evaluate(() => window.app.guitarDrawShape.slice());
    check(initial.every(f => f === null), `toutes les cordes X par défaut (${JSON.stringify(initial)})`);

    // Géométrie connue (voir GUITAR_SVG_LAYOUT dans script.js : marginLeft=20, fretGap=30, marginTop=8,
    // stringGap=16) : corde 0 (grave, en bas) -> y=88 ; case 2 -> x=65 ; case 4 -> x=125.
    const svgBox = await page.evaluate(() => document.querySelector('#guitar-edit-neck svg').getBoundingClientRect());
    const clickAt = (fx, sy) => page.mouse.click(svgBox.x + fx, svgBox.y + sy);

    await clickAt(65, 88);
    await page.waitForTimeout(200);
    let shape = await page.evaluate(() => window.app.guitarDrawShape.slice());
    check(shape[0] === 2, `clic pose bien une note à la case cliquée (obtenu ${JSON.stringify(shape)})`);
    check(!(await page.isDisabled('#guitar-draw-play')), "bouton Jouer réactivé dès une note posée");

    await clickAt(65, 88); // reclic
    await page.waitForTimeout(200);
    shape = await page.evaluate(() => window.app.guitarDrawShape.slice());
    check(shape[0] === null, `reclic au même endroit retire la note (obtenu ${JSON.stringify(shape)})`);

    await clickAt(65, 88);
    await page.waitForTimeout(150);
    await clickAt(125, 88); // autre case, même corde
    await page.waitForTimeout(200);
    shape = await page.evaluate(() => window.app.guitarDrawShape.slice());
    check(shape[0] === 4 && shape.filter(f => f != null).length === 1, `clic sur une autre case DÉPLACE (une seule note par corde) — obtenu ${JSON.stringify(shape)}`);

    // Zone corde à vide (avant le sillet)
    await clickAt(20 - 9, 88 - 16); // corde 1
    await page.waitForTimeout(200);
    shape = await page.evaluate(() => window.app.guitarDrawShape.slice());
    check(shape[1] === 0, `clic avant le sillet pose une corde à vide (fret=0) — obtenu ${JSON.stringify(shape)}`);

    // Couleur neutre, pas une couleur de fonction
    const colors = await page.evaluate(() => [...document.querySelectorAll('#guitar-edit-neck svg circle')]
        .filter(c => ['4.6', '2.4'].includes(c.getAttribute('r')))
        .map(c => c.getAttribute('fill')));
    check(colors.length > 0 && colors.every(c => c === '#9e9e9e'), `notes posées en couleur neutre grise (${JSON.stringify(colors)})`);

    // Clic sur la toute dernière case (24) — centre exact : marginLeft + (24-0.5)*fretGap = 20+23.5*30 = 725.
    await clickAt(725, 88);
    await page.waitForTimeout(200);
    shape = await page.evaluate(() => window.app.guitarDrawShape.slice());
    check(shape[0] === 24, `clic sur la toute dernière case (24) l'atteint bien, sans planter — obtenu ${JSON.stringify(shape)}`);

    // Le clic sur le manche ne doit RIEN faire sur l'onglet "Taper le nom" (pas de conflit entre les deux modes)
    await page.click('#guitar-edit-tab-name');
    await page.waitForTimeout(150);
    const shapeBeforeNameClick = await page.evaluate(() => window.app.guitarDrawShape.slice());
    await clickAt(65, 40); // un clic quelconque sur le manche, maintenant affiché en mode résolu
    await page.waitForTimeout(200);
    const shapeAfterNameClick = await page.evaluate(() => window.app.guitarDrawShape.slice());
    check(JSON.stringify(shapeBeforeNameClick) === JSON.stringify(shapeAfterNameClick), "cliquer le manche sur l'onglet « Taper le nom » ne modifie PAS le dessin (les deux modes restent cloisonnés)");

    // Le bouton "Jouer" ne doit lever aucune erreur
    await page.click('#guitar-edit-tab-draw');
    await page.waitForTimeout(150);
    await page.click('#guitar-draw-play');
    await page.waitForTimeout(300);
    check(errors.length === 0, "le bouton « Jouer » ne lève aucune erreur JS");

    await page.close();

    // ---------- Mobile (tap réel) ----------
    const iphone = devices['iPhone 13'];
    const ctx = await browser.newContext({ ...iphone });
    const mpage = await ctx.newPage();
    mpage.on('pageerror', e => errors.push('pageerror(mobile): ' + e.message));

    await mpage.goto(`${BASE}/index.html?nocache=` + Date.now());
    await mpage.waitForTimeout(500);
    if (!(await mpage.evaluate(() => document.getElementById('toggle-viz-guitar').getAttribute('aria-pressed') === 'true'))) {
        await mpage.tap('#toggle-viz-guitar');
    }
    await mpage.waitForTimeout(200);
    await mpage.tap('#guitar-edit-btn');
    await mpage.waitForTimeout(200);
    await mpage.tap('#guitar-edit-tab-draw');
    await mpage.waitForTimeout(150);

    const mSvgBox = await mpage.evaluate(() => document.querySelector('#guitar-edit-neck svg').getBoundingClientRect());
    await mpage.touchscreen.tap(mSvgBox.x + 65, mSvgBox.y + 88);
    await mpage.waitForTimeout(250);
    const mShape = await mpage.evaluate(() => window.app.guitarDrawShape.slice());
    check(mShape[0] === 2, `tap tactile réel pose bien une note sur mobile (obtenu ${JSON.stringify(mShape)})`);
    check(!(await mpage.isDisabled('#guitar-draw-play')), "bouton Jouer réactivé sur mobile aussi");

    await mpage.touchscreen.tap(mSvgBox.x + 65, mSvgBox.y + 88);
    await mpage.waitForTimeout(250);
    const mShape2 = await mpage.evaluate(() => window.app.guitarDrawShape.slice());
    check(mShape2[0] === null, `reclic (tap) retire la note sur mobile (obtenu ${JSON.stringify(mShape2)})`);

    await ctx.close();

    console.log('Errors:', JSON.stringify(errors));
    check(errors.length === 0, 'aucune erreur JavaScript, desktop et mobile confondus');

    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
