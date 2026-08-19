// Lot 1 de l'édition manuelle du manche (retour utilisateur : « j'ai déjà beaucoup de boutons... un
// seul bouton d'édition manuelle sous les diagrammes »). Ce lot ne fait QUE relocaliser l'existant
// (flèches de doigté, substitut manuscrit, cadenas) dans une fenêtre agrandie qui montre en plus le
// manche COMPLET (24 cases, toujours depuis le sillet — voir GUITAR_NECK_DISPLAY_FRETS et
// buildGuitarDiagramSVG `wide`), synchronisé en permanence avec le doigté prévisualisé. Aucune
// nouvelle logique de dessin/reconnaissance ici (Lots suivants) : seulement la coquille, testée
// desktop ET mobile, avec le flux "Taper le nom" existant vérifié bout en bout à son nouvel endroit.
const { chromium, devices } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, plan, bilan } = require('./_harness')('manche : Lot 1 (bouton unique + fenêtre agrandie)');
plan(20);

(async () => {
    const browser = await chromium.launch();
    const errors = [];

    // ---------- Desktop ----------
    const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));

    await page.goto(`${BASE}/index.html?nocache=` + Date.now());
    await page.waitForTimeout(600);
    if (!(await page.evaluate(() => document.getElementById('toggle-viz-guitar').getAttribute('aria-pressed') === 'true'))) {
        await page.click('#toggle-viz-guitar');
    }
    await page.waitForTimeout(200);

    check(await page.locator('#guitar-edit-btn').count() === 1, "le bouton unique #guitar-edit-btn existe sous les diagrammes");
    check(await page.locator('.guitar-viz-wrap > .guitar-controls-row #guitar-nav').count() === 0, "les flèches de doigté ne sont plus dans la zone principale (relocalisées)");
    check(await page.locator('.guitar-viz-wrap > .guitar-controls-row #guitar-lock-btn').count() === 0, "le cadenas n'est plus dans la zone principale (relocalisé)");

    check(await page.isHidden('#guitar-edit-overlay'), "la fenêtre d'édition est fermée au départ");
    await page.click('#guitar-edit-btn');
    await page.waitForTimeout(200);
    check(await page.isVisible('#guitar-edit-overlay'), "la fenêtre s'ouvre au clic");
    check(await page.isVisible('#guitar-edit-neck svg'), "le manche complet affiche un SVG");

    const w = await page.evaluate(() => +document.querySelector('#guitar-edit-neck svg').getAttribute('viewBox').split(' ')[2]);
    check(w > 600, `le manche large couvre bien plus qu'une fenêtre de 5 cases (viewBox width=${w})`);

    check(await page.locator('#guitar-edit-pane-name').isVisible(), "l'onglet « Taper le nom » est actif par défaut");
    check(await page.locator('#guitar-edit-pane-draw').isHidden(), "l'onglet « Dessiner » est masqué par défaut");
    check(await page.locator('#guitar-edit-pane-name #guitar-nav').count() === 1, "les flèches de doigté sont bien dans l'onglet « Taper le nom »");
    check(await page.locator('#guitar-edit-pane-name #guitar-lock-btn').count() === 1, "le cadenas est bien dans l'onglet « Taper le nom »");

    await page.click('#guitar-edit-tab-draw');
    await page.waitForTimeout(100);
    check(await page.locator('#guitar-edit-pane-draw').isVisible(), "l'onglet « Dessiner » devient visible après clic");
    check(await page.locator('#guitar-edit-pane-name').isHidden(), "l'onglet « Taper le nom » se masque en retour");
    await page.click('#guitar-edit-tab-name');
    await page.waitForTimeout(100);

    // Flux existant, à son nouvel endroit : taper un substitut DANS la fenêtre doit toujours écrire au
    // bon endroit (this.guitarOverride) et se refléter dans le bandeau resté hors fenêtre.
    await page.click('#guitar-override-btn');
    await page.waitForTimeout(150);
    await page.fill('.guitar-override-input', 'Em');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    const overrideRowText = await page.evaluate(() => document.getElementById('guitar-override-row').textContent);
    check(overrideRowText.includes('Em'), `le substitut tapé DANS la fenêtre s'applique bien (bandeau: ${JSON.stringify(overrideRowText)})`);
    check(await page.isVisible('#guitar-override-row'), "le bandeau substitut (hors fenêtre) reflète bien le nouveau substitut");

    if (await page.isVisible('#guitar-lock-btn')) {
        await page.click('#guitar-lock-btn');
        await page.waitForTimeout(200);
        check(await page.getAttribute('#guitar-lock-btn', 'aria-pressed') === 'true', "le cadenas se ferme bien au clic depuis la fenêtre");
    } else {
        check(true, "(cadenas non pertinent pour ce doigté, ignoré)");
    }

    await page.click('#guitar-edit-close');
    await page.waitForTimeout(150);
    check(await page.isHidden('#guitar-edit-overlay'), "la fenêtre se ferme au clic sur la croix");

    await page.click('#guitar-edit-btn');
    await page.waitForTimeout(150);
    await page.mouse.click(5, 5);
    await page.waitForTimeout(150);
    check(await page.isHidden('#guitar-edit-overlay'), "la fenêtre se ferme au clic sur le fond");

    await page.click('#guitar-edit-btn');
    await page.waitForTimeout(150);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    check(await page.isHidden('#guitar-edit-overlay'), "la fenêtre se ferme avec Échap");

    // Nettoyage : retire le substitut posé plus haut.
    await page.click('#guitar-edit-btn');
    await page.waitForTimeout(150);
    await page.click('#guitar-override-btn');
    await page.waitForTimeout(150);
    await page.fill('.guitar-override-input', '');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    await page.close();

    // ---------- Mobile ----------
    const iphone = devices['iPhone 13'];
    const ctx = await browser.newContext({ ...iphone });
    const mpage = await ctx.newPage();
    mpage.on('pageerror', e => errors.push('pageerror(mobile): ' + e.message));

    await mpage.goto(`${BASE}/index.html?nocache=` + Date.now());
    await mpage.waitForTimeout(600);
    if (!(await mpage.evaluate(() => document.getElementById('toggle-viz-guitar').getAttribute('aria-pressed') === 'true'))) {
        await mpage.tap('#toggle-viz-guitar');
    }
    await mpage.waitForTimeout(300);

    check(await mpage.isVisible('#guitar-edit-btn'), "bouton édition manuelle visible sur mobile");
    await mpage.tap('#guitar-edit-btn');
    await mpage.waitForTimeout(300);
    check(await mpage.isVisible('#guitar-edit-overlay'), "la fenêtre s'ouvre au tap sur mobile");

    const modalBox = await mpage.evaluate(() => {
        const r = document.querySelector('.guitar-edit-modal').getBoundingClientRect();
        return { w: r.width, vw: window.innerWidth };
    });
    check(modalBox.w <= modalBox.vw + 1, `la fenêtre tient dans la largeur de l'écran (${Math.round(modalBox.w)} <= ${modalBox.vw})`);

    const neckScroll = await mpage.evaluate(() => {
        const n = document.getElementById('guitar-edit-neck');
        return { scrollWidth: n.scrollWidth, clientWidth: n.clientWidth };
    });
    check(neckScroll.scrollWidth > neckScroll.clientWidth, `le manche large défile bien horizontalement sur mobile (${neckScroll.scrollWidth} > ${neckScroll.clientWidth})`);

    await mpage.tap('#guitar-edit-close');
    await mpage.waitForTimeout(200);
    check(await mpage.isHidden('#guitar-edit-overlay'), "la fenêtre se ferme au tap sur la croix, sur mobile");
    await ctx.close();

    console.log('Errors:', JSON.stringify(errors));
    check(errors.length === 0, 'aucune erreur JavaScript, desktop et mobile confondus');

    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
