// Lot 6 (bonus, non prioritaire) de l'édition manuelle du manche : notes fantômes. Retour utilisateur :
// « il serait intéressant d'ajouter des ghost notes, mais c'est pas l'essentiel » — deux sens
// distincts, TOUS LES DEUX demandés (choix explicite plutôt que le seul recommandé) :
//   1. Un aperçu translucide au survol de la souris, AVANT le clic — même principe que le glissé
//      fantôme du séquenceur (Alt+glisser, voir sequencer_ghost_drag_test.js).
//   2. Une frappe percussive étouffée, sans hauteur définie (sens guitare classique), qu'on peut poser
//      sur une corde comme une vraie note — bascule dédiée (#guitar-draw-ghost-toggle).
// Volontairement une aide de SESSION UNIQUE (jamais écrite dans guitarLock/le morceau, remise à zéro
// à chaque ouverture de la fenêtre) : voir le constructeur de App pour le raisonnement complet.
const { chromium, devices } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, plan, bilan } = require('./_harness')('manche : Lot 6 (bonus — notes fantômes)');
plan(18);

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
    await page.click('#quick-add-btn');
    await page.waitForTimeout(200);
    await page.selectOption('#root', 'C');
    await page.selectOption('#quality', 'maj');
    await page.waitForTimeout(200);

    await page.click('#guitar-edit-btn');
    await page.waitForTimeout(150);
    await page.click('#guitar-edit-tab-draw');
    await page.waitForTimeout(150);

    const svgBox = () => page.evaluate(() => document.querySelector('#guitar-edit-neck svg').getBoundingClientRect());
    const yFor = s => 8 + (5 - s) * 16;
    const xFor = fret => 20 + (fret - 0.5) * 30;
    const posFor = async (s, fret) => {
        const box = await svgBox();
        const x = fret === 0 ? (20 - 9) : xFor(fret);
        return { x: box.x + x, y: box.y + yFor(s) };
    };

    // ============================================================
    // === A. Aperçu au survol (interprétation 1) ===
    // ============================================================
    const p1 = await posFor(2, 3);
    await page.mouse.move(p1.x, p1.y);
    await page.waitForTimeout(150);
    const hover1 = await page.evaluate(() => window.app.guitarDrawHoverPos);
    check(!!hover1 && hover1.string === 2 && hover1.fret === 3, `survol détecté à la bonne position — obtenu ${JSON.stringify(hover1)}`);
    const previewCircle = await page.evaluate(() => !!document.querySelector('#guitar-edit-neck svg circle[opacity="0.4"]'));
    check(previewCircle, "un aperçu translucide apparaît sous le curseur AVANT tout clic");

    await page.mouse.move(10, 10);
    await page.waitForTimeout(150);
    check(await page.evaluate(() => window.app.guitarDrawHoverPos) === null, "l'aperçu disparaît quand la souris quitte le manche");

    // Le survol seul ne pose jamais rien.
    await page.mouse.move(p1.x, p1.y);
    await page.waitForTimeout(150);
    const shapesAfterHoverOnly = await page.evaluate(() => ({ shape: window.app.guitarDrawShape, ghost: window.app.guitarDrawGhostStrings }));
    check(shapesAfterHoverOnly.shape.every(f => f === null) && shapesAfterHoverOnly.ghost.every(f => f === null), "un simple survol ne pose jamais de note, réelle ou fantôme");

    // ============================================================
    // === B. Frappe percussive étouffée (interprétation 2) ===
    // ============================================================
    await page.mouse.click(p1.x, p1.y); // pose une vraie note en mode normal
    await page.waitForTimeout(150);
    check((await page.evaluate(() => window.app.guitarDrawShape))[2] === 3, "un clic hors mode fantôme pose bien une vraie note");

    await page.click('#guitar-draw-ghost-toggle');
    await page.waitForTimeout(150);
    check(await page.evaluate(() => window.app.guitarDrawGhostMode) === true, "le mode fantôme s'active bien via la bascule");
    check(await page.evaluate(() => document.getElementById('guitar-draw-ghost-toggle').classList.contains('active')), "la bascule reflète bien son état actif");

    const p2 = await posFor(4, 5);
    await page.mouse.click(p2.x, p2.y);
    await page.waitForTimeout(150);
    check((await page.evaluate(() => window.app.guitarDrawGhostStrings))[4] === 5, "une note fantôme est bien posée en mode fantôme");

    // Mutuelle exclusion dans les deux sens (une corde ne sonne qu'UNE chose à la fois).
    await page.mouse.click(p1.x, p1.y); // fantôme sur une corde qui avait une VRAIE note
    await page.waitForTimeout(150);
    const mutex1 = await page.evaluate(() => ({ shape: window.app.guitarDrawShape[2], ghost: window.app.guitarDrawGhostStrings[2] }));
    check(mutex1.shape === null && mutex1.ghost === 3, `poser un fantôme sur une corde déjà notée retire la vraie note — obtenu ${JSON.stringify(mutex1)}`);

    await page.click('#guitar-draw-ghost-toggle'); // repasse en mode normal
    await page.waitForTimeout(150);
    await page.mouse.click(p2.x, p2.y); // vraie note sur une corde qui avait un FANTÔME
    await page.waitForTimeout(150);
    const mutex2 = await page.evaluate(() => ({ shape: window.app.guitarDrawShape[4], ghost: window.app.guitarDrawGhostStrings[4] }));
    check(mutex2.shape === 5 && mutex2.ghost === null, `poser une vraie note sur une corde déjà fantôme retire le fantôme — obtenu ${JSON.stringify(mutex2)}`);

    // ============================================================
    // === C. Boutons Jouer/Valider : gating correct ===
    // ============================================================
    await page.evaluate(() => {
        window.app.guitarDrawShape = new Array(6).fill(null);
        window.app.guitarDrawGhostStrings = new Array(6).fill(null);
        window.app.guitarDrawGhostStrings[0] = 2;
        window.app.renderGuitarDrawNeck();
    });
    await page.waitForTimeout(100);
    check(!(await page.isDisabled('#guitar-draw-play')), "« Jouer » reste actif même avec SEULEMENT des notes fantômes");
    check(await page.isDisabled('#guitar-draw-validate'), "« Valider » (reconnaissance) reste désactivé sans aucune vraie note — les fantômes n'ont pas de hauteur");

    // Recognition reste indifférente aux fantômes : un Cmaj réel entouré de fantômes reste Cmaj.
    await page.evaluate(() => { window.app.guitarDrawShape = new Array(6).fill(null); window.app.guitarDrawGhostStrings = new Array(6).fill(null); });
    const c1 = await posFor(4, 1), c2 = await posFor(3, 0), c3 = await posFor(2, 2);
    await page.mouse.click(c1.x, c1.y); // C4 root
    await page.mouse.click(c2.x, c2.y); // G3 fifth
    await page.mouse.click(c3.x, c3.y); // E3 third
    await page.click('#guitar-draw-ghost-toggle');
    await page.waitForTimeout(100);
    const g1 = await posFor(0, 8);
    await page.mouse.click(g1.x, g1.y); // fantôme sur une corde sans rapport avec l'accord
    await page.waitForTimeout(150);
    await page.click('#guitar-draw-validate');
    await page.waitForTimeout(200);
    const rec = await page.evaluate(() => window.app.guitarDrawRecognition);
    check(!!rec && rec.root === 'C' && rec.quality === 'maj', `la reconnaissance ignore bien les notes fantômes (toujours Cmaj) — obtenu ${rec && rec.root}${rec && rec.quality}`);

    // ============================================================
    // === D. Aide de session : rien ne survit à la fermeture/réouverture ===
    // ============================================================
    await page.click('#guitar-edit-close');
    await page.waitForTimeout(150);
    await page.click('#guitar-edit-btn');
    await page.waitForTimeout(150);
    await page.click('#guitar-edit-tab-draw');
    await page.waitForTimeout(150);
    const stateAfterReopen = await page.evaluate(() => ({ ghost: window.app.guitarDrawGhostStrings, mode: window.app.guitarDrawGhostMode }));
    check(stateAfterReopen.ghost.every(f => f === null), `les notes fantômes repartent à zéro à la réouverture — obtenu ${JSON.stringify(stateAfterReopen.ghost)}`);
    check(stateAfterReopen.mode === false, "le mode fantôme repart désactivé à la réouverture");

    console.log('Errors:', JSON.stringify(errors));
    check(errors.length === 0, 'aucune erreur JavaScript pendant tout le scénario desktop');
    await page.close();

    // ============================================================
    // === E. Mobile : la bascule + la pose d'une note fantôme fonctionnent au tap ===
    // ============================================================
    // Pas de survol tactile (voir onGuitarNeckHover) : seule l'interprétation 2 (frappe percussive
    // via la bascule) a un sens sur mobile — l'aperçu au clic n'est testé que côté desktop ci-dessus.
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
    await mpage.tap('#guitar-edit-tab-draw');
    await mpage.waitForTimeout(150);
    await mpage.tap('#guitar-draw-ghost-toggle');
    await mpage.waitForTimeout(150);
    const mSvgBox = await mpage.evaluate(() => document.querySelector('#guitar-edit-neck svg').getBoundingClientRect());
    const mYFor = s => 8 + (5 - s) * 16, mXFor = fret => 20 + (fret - 0.5) * 30;
    await mpage.touchscreen.tap(mSvgBox.x + mXFor(3), mSvgBox.y + mYFor(2));
    await mpage.waitForTimeout(200);
    const mobileGhost = await mpage.evaluate(() => window.app.guitarDrawGhostStrings);
    check(mobileGhost[2] === 3, `note fantôme posée au tap sur mobile — obtenu ${JSON.stringify(mobileGhost)}`);
    await ctx.close();

    check(errors.length === 0, 'aucune erreur JavaScript, desktop et mobile confondus');

    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
