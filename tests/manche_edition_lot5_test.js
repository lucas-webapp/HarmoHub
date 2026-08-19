// Lot 5 de l'édition manuelle du manche : non-régression entre le dessin manuel (onglets « Dessiner »)
// et la saisie manuscrite existante (onglet « Taper le nom ») — retour utilisateur : « ne jamais
// perdre le substitut manuscrit existant ». Les deux onglets écrivent dans les MÊMES champs
// (this.guitarLock/this.guitarOverride, voir lockGuitarDrawnChord/applyGuitarOverride) : ce banc
// vérifie que ce partage ne fait jamais perdre ou afficher périmé ce que l'autre onglet a posé.
//
// BUG TROUVÉ EN ÉCRIVANT CE BANC (corrigé avant de le committer, voir syncGuitarDrawShapeFromLock
// dans script.js) : verrouiller un substitut via le cadenas CLASSIQUE (hors fenêtre), rouvrir la
// fenêtre sur l'onglet Dessiner (préchargement OK, Lot 4), puis taper un NOUVEAU substitut sur
// l'onglet « Taper le nom » (qui remet guitarLock à null) SANS refermer la fenêtre, puis revenir sur
// l'onglet Dessiner : l'ANCIENNE forme verrouillée restait affichée — rien ne revenait plus jamais la
// resynchroniser une fois la fenêtre déjà ouverte. Corrigé par un rechargement au moment même du
// clic sur l'onglet Dessiner, mais SEULEMENT si aucun dessin manuel n'est en cours (this.guitarDrawDirty)
// — sinon l'inverse se produirait : taper un nom sur l'autre onglet effacerait un dessin en train
// d'être posé.
const { chromium, devices } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, plan, bilan } = require('./_harness')('manche : Lot 5 (non-régression dessin/manuscrit)');
plan(13);

(async () => {
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));

    await page.goto(`${BASE}/index.html?nocache=` + Date.now());
    await page.waitForTimeout(500);
    if (!(await page.evaluate(() => document.getElementById('toggle-viz-guitar').getAttribute('aria-pressed') === 'true'))) {
        await page.click('#toggle-viz-guitar');
    }
    await page.waitForTimeout(200);

    const svgBox = () => page.evaluate(() => document.querySelector('#guitar-edit-neck svg').getBoundingClientRect());
    const yFor = s => 8 + (5 - s) * 16;
    const xFor = fret => 20 + (fret - 0.5) * 30;
    const clickString = async (s, fret) => {
        const box = await svgBox();
        const x = fret === 0 ? (20 - 9) : xFor(fret);
        await page.mouse.click(box.x + x, box.y + yFor(s));
        await page.waitForTimeout(120);
    };

    await page.click('#quick-add-btn');
    await page.waitForTimeout(200);
    await page.selectOption('#root', 'C');
    await page.selectOption('#quality', 'maj');
    await page.waitForTimeout(200);

    // ============================================================
    // === A. Substitut manuscrit posé -> dessiner (sans verrouiller) puis fermer -> intact ===
    // ============================================================
    await page.click('#guitar-edit-btn');
    await page.waitForTimeout(150);
    await page.click('#guitar-edit-tab-name');
    await page.waitForTimeout(150);
    await page.click('#guitar-override-btn');
    await page.waitForTimeout(150);
    await page.fill('.guitar-override-input', 'Dm');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    const overrideAfterType = await page.evaluate(() => window.app.guitarOverride);
    check(!!overrideAfterType && overrideAfterType.root === 'D' && overrideAfterType.quality === 'min', `substitut manuscrit Dm posé — obtenu ${JSON.stringify(overrideAfterType)}`);

    await page.click('#guitar-edit-tab-draw');
    await page.waitForTimeout(150);
    await clickString(0, 3); // gribouille une note quelconque, jamais validée ni verrouillée
    await page.click('#guitar-edit-close');
    await page.waitForTimeout(150);
    const overrideStillThere = await page.evaluate(() => window.app.guitarOverride);
    check(JSON.stringify(overrideStillThere) === JSON.stringify(overrideAfterType), `dessiner sans verrouiller ne touche pas au substitut manuscrit existant — obtenu ${JSON.stringify(overrideStillThere)}`);

    // ============================================================
    // === B. Verrouillage du substitut via le cadenas CLASSIQUE (hors fenêtre) -> préchargé au dessin ===
    // ============================================================
    await page.click('#guitar-lock-btn');
    await page.waitForTimeout(200);
    const lockViaCadenas = await page.evaluate(() => window.app.guitarLock);
    check(!!lockViaCadenas, `le cadenas classique verrouille bien une forme pour ce substitut — obtenu ${JSON.stringify(lockViaCadenas)}`);

    await page.click('#guitar-edit-btn');
    await page.waitForTimeout(150);
    await page.click('#guitar-edit-tab-draw');
    await page.waitForTimeout(150);
    const preloaded = await page.evaluate(() => window.app.guitarDrawShape);
    check(JSON.stringify(preloaded) === JSON.stringify(lockViaCadenas), `l'onglet Dessiner précharge la forme verrouillée via le cadenas classique (pas seulement via ce même onglet) — obtenu ${JSON.stringify(preloaded)}`);

    // ============================================================
    // === C. L'onglet "Taper le nom" reflète bien le substitut courant ===
    // ============================================================
    await page.click('#guitar-edit-tab-name');
    await page.waitForTimeout(150);
    await page.click('#guitar-override-btn');
    await page.waitForTimeout(150);
    const inputValue = await page.evaluate(() => document.querySelector('.guitar-override-input')?.value);
    check(!!inputValue && inputValue.includes('D'), `le champ de saisie reflète bien le substitut courant — obtenu ${JSON.stringify(inputValue)}`);

    // ============================================================
    // === D. Taper un NOUVEAU substitut réinitialise le verrou, ET l'onglet Dessiner s'actualise ===
    // ============================================================
    await page.fill('.guitar-override-input', 'Bbmaj7');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    const stateAfterRetype = await page.evaluate(() => ({ override: window.app.guitarOverride, lock: window.app.guitarLock }));
    check(stateAfterRetype.lock === null, `taper un nouveau substitut remet bien guitarLock à null — obtenu ${JSON.stringify(stateAfterRetype.lock)}`);

    // BUG (voir en-tête de fichier) : sans le correctif, l'ancienne forme restait affichée ici.
    await page.click('#guitar-edit-tab-draw');
    await page.waitForTimeout(150);
    const blankNow = await page.evaluate(() => window.app.guitarDrawShape);
    check(JSON.stringify(blankNow) === JSON.stringify([null, null, null, null, null, null]), `l'onglet Dessiner s'actualise (vierge) après un nouveau substitut sans verrou, pas de forme périmée — obtenu ${JSON.stringify(blankNow)}`);
    await page.click('#guitar-edit-close');
    await page.waitForTimeout(150);

    // ============================================================
    // === E. Un dessin EN COURS (brouillon, jamais verrouillé) survit à un détour par l'autre onglet ===
    // ============================================================
    await page.click('#quick-add-btn');
    await page.waitForTimeout(200);
    await page.selectOption('#root', 'C');
    await page.selectOption('#quality', 'maj');
    await page.waitForTimeout(200);
    await page.click('#guitar-edit-btn');
    await page.waitForTimeout(150);
    await page.click('#guitar-edit-tab-draw');
    await page.waitForTimeout(150);
    await clickString(1, 0); // une seule note posée, brouillon non validé
    const draftBefore = await page.evaluate(() => window.app.guitarDrawShape);
    check(draftBefore.some(f => f != null), `brouillon en cours posé — obtenu ${JSON.stringify(draftBefore)}`);

    await page.click('#guitar-edit-tab-name');
    await page.waitForTimeout(150);
    await page.click('#guitar-override-btn');
    await page.waitForTimeout(150);
    await page.fill('.guitar-override-input', 'Em');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    await page.click('#guitar-edit-tab-draw');
    await page.waitForTimeout(150);
    const draftAfter = await page.evaluate(() => window.app.guitarDrawShape);
    check(JSON.stringify(draftAfter) === JSON.stringify(draftBefore), `le brouillon en cours n'est JAMAIS écrasé par un changement sur l'autre onglet — avant ${JSON.stringify(draftBefore)}, après ${JSON.stringify(draftAfter)}`);
    await page.click('#guitar-edit-close');
    await page.waitForTimeout(150);

    // ============================================================
    // === F. Un accord verrouillé DEPUIS le dessin (Lot 4) survit lui aussi à la réouverture ===
    // ============================================================
    await page.click('#quick-add-btn');
    await page.waitForTimeout(200);
    await page.selectOption('#root', 'A');
    await page.selectOption('#quality', 'min');
    await page.waitForTimeout(200);
    await page.click('#guitar-edit-btn');
    await page.waitForTimeout(150);
    await page.click('#guitar-edit-tab-draw');
    await page.waitForTimeout(150);
    await clickString(1, 0); // A2 root
    await clickString(4, 1); // C4 third
    await clickString(5, 0); // E4 fifth
    await page.click('#guitar-draw-validate');
    await page.waitForTimeout(200);
    await page.click('#guitar-draw-lock');
    await page.waitForTimeout(300);

    // "Taper le nom" doit désormais aussi refléter cet accord (même verrou, quelle que soit sa source).
    await page.click('#guitar-edit-btn');
    await page.waitForTimeout(150);
    await page.click('#guitar-edit-tab-name');
    await page.waitForTimeout(150);
    const lockAfterDraw = await page.evaluate(() => window.app.guitarLock);
    check(JSON.stringify(lockAfterDraw) === JSON.stringify([null, 0, null, null, 1, 0]), `le verrou posé DEPUIS le dessin est bien celui affiché (peu importe l'onglet ouvert) — obtenu ${JSON.stringify(lockAfterDraw)}`);
    await page.click('#guitar-edit-close');
    await page.waitForTimeout(150);

    console.log('Errors:', JSON.stringify(errors));
    check(errors.length === 0, 'aucune erreur JavaScript pendant tout le scénario desktop');

    // ============================================================
    // === G. Mobile : le même détour (substitut tapé puis onglet Dessiner) tient au tap ===
    // ============================================================
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
    await mpage.tap('#quick-add-btn');
    await mpage.waitForTimeout(200);
    await mpage.selectOption('#root', 'C');
    await mpage.selectOption('#quality', 'maj');
    await mpage.waitForTimeout(200);
    await mpage.tap('#guitar-edit-btn');
    await mpage.waitForTimeout(200);
    await mpage.tap('#guitar-edit-tab-name');
    await mpage.waitForTimeout(150);
    await mpage.tap('#guitar-override-btn');
    await mpage.waitForTimeout(150);
    await mpage.fill('.guitar-override-input', 'Dm');
    await mpage.locator('.guitar-override-input').press('Enter');
    await mpage.waitForTimeout(300);
    await mpage.tap('#guitar-edit-close'); // le cadenas classique vit HORS de la fenêtre (voir index.html)
    await mpage.waitForTimeout(150);
    await mpage.tap('#guitar-lock-btn');
    await mpage.waitForTimeout(200);
    await mpage.tap('#guitar-edit-btn');
    await mpage.waitForTimeout(200);
    await mpage.tap('#guitar-edit-tab-draw');
    await mpage.waitForTimeout(150);
    const mobileDrawShape = await mpage.evaluate(() => window.app.guitarDrawShape);
    const mobileLock = await mpage.evaluate(() => window.app.guitarLock);
    check(JSON.stringify(mobileDrawShape) === JSON.stringify(mobileLock), `sur mobile aussi, l'onglet Dessiner précharge bien le verrou posé via le cadenas classique — obtenu ${JSON.stringify(mobileDrawShape)}`);
    await ctx.close();

    check(errors.length === 0, 'aucune erreur JavaScript, desktop et mobile confondus');

    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
