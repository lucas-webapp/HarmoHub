// Lot 4 de l'édition manuelle du manche : verrouillage du candidat choisi dans le morceau (retour
// utilisateur : « une fois l'accord reconnu... verrouillage et coloration par fonction, branchement
// cadenas/substitut... ne jamais perdre le substitut manuscrit existant »). Réutilise TEL QUEL le
// mécanisme déjà en place pour les accords simples (this.guitarLock/this.guitarOverride, voir
// toggleGuitarLock/applyGuitarOverride dans script.js) plutôt qu'un second mécanisme parallèle :
// même accord que le piano (racine + qualité) -> verrou seul ; accord différent -> substitut, mais
// verrouillé sur EXACTEMENT la forme dessinée (pas une forme communément enseignée recalculée).
const { chromium, devices } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, plan, bilan } = require('./_harness')('manche : Lot 4 (verrouillage cadenas/substitut)');
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

    const openDrawTab = async () => {
        await page.click('#guitar-edit-btn');
        await page.waitForTimeout(150);
        await page.click('#guitar-edit-tab-draw');
        await page.waitForTimeout(120);
    };
    const svgBox = () => page.evaluate(() => document.querySelector('#guitar-edit-neck svg').getBoundingClientRect());
    const yFor = s => 8 + (5 - s) * 16;   // corde s (0=grave..5=aigu)
    const xFor = fret => 20 + (fret - 0.5) * 30;
    const clickString = async (s, fret) => {
        const box = await svgBox();
        const x = fret === 0 ? (20 - 9) : xFor(fret);
        await page.mouse.click(box.x + x, box.y + yFor(s));
        await page.waitForTimeout(120);
    };

    // ============================================================
    // === A. Même accord que le piano (Am) -> verrou seul, aucun substitut ===
    // ============================================================
    await page.click('#quick-add-btn');
    await page.waitForTimeout(200);
    await page.selectOption('#root', 'A');
    await page.selectOption('#quality', 'min');
    await page.waitForTimeout(200);
    await openDrawTab();

    // Dessiner sans valider ne doit RIEN écrire — pas d'écriture prématurée avant le geste explicite.
    await clickString(1, 0); // A2, root
    await page.waitForTimeout(100);
    const beforeValidate = await page.evaluate(() => ({ lock: window.app.guitarLock, override: window.app.guitarOverride }));
    check(beforeValidate.lock === null && beforeValidate.override === null, 'dessiner (sans valider ni verrouiller) ne touche ni au verrou ni au substitut');

    await clickString(4, 1); // C4, third
    await clickString(5, 0); // E4, fifth
    await page.click('#guitar-draw-validate');
    await page.waitForTimeout(200);

    const lockBtnLabelSame = await page.evaluate(() => document.getElementById('guitar-draw-lock').textContent.trim());
    check(lockBtnLabelSame.includes('Verrouiller'), `le bouton annonce "Verrouiller" quand le candidat EST l'accord du piano — obtenu ${JSON.stringify(lockBtnLabelSame)}`);

    await page.click('#guitar-draw-lock');
    await page.waitForTimeout(300);
    const stateA = await page.evaluate(() => ({
        lock: window.app.guitarLock, override: window.app.guitarOverride, editOpen: window.app.guitarEditOpen,
    }));
    check(JSON.stringify(stateA.lock) === JSON.stringify([null, 0, null, null, 1, 0]), `guitarLock = exactement la forme dessinée — obtenu ${JSON.stringify(stateA.lock)}`);
    check(stateA.override === null, 'guitarOverride reste null (même accord que le piano)');
    check(stateA.editOpen === false, 'la fenêtre se referme après verrouillage');

    // Coloration par fonction sur le petit diagramme : plus de neutre, des couleurs de rôle réelles.
    const roleColors = await page.evaluate(() => [...document.querySelectorAll('#guitar-viz [fill]')].map(e => e.getAttribute('fill')));
    const ROLE_COLOR_NEUTRAL = '#9e9e9e';
    check(roleColors.some(c => c && c !== ROLE_COLOR_NEUTRAL && c !== '#3a3a3a' && c !== '#ccc' && c !== '#999'),
        `le petit diagramme affiche des couleurs de rôle (pas neutre) après verrouillage — obtenu ${JSON.stringify(roleColors)}`);

    // ============================================================
    // === B. Accord différent du piano (piano=C, dessiné=G) -> substitut verrouillé sur SA forme ===
    // ============================================================
    await page.click('#quick-add-btn');
    await page.waitForTimeout(200);
    await page.selectOption('#root', 'C');
    await page.selectOption('#quality', 'maj');
    await page.waitForTimeout(200);
    await openDrawTab();

    // G majeur (G-B-D) : corde0(E2=40)fret3->G2(43,pc7,root) ; corde2(D3=50)fret0->D3(50,pc2,fifth) ;
    // corde4(B3=59)fret0->B3(59,pc11,third).
    await clickString(0, 3);
    await clickString(2, 0);
    await clickString(4, 0);
    await page.click('#guitar-draw-validate');
    await page.waitForTimeout(200);

    const lockBtnLabelDiff = await page.evaluate(() => document.getElementById('guitar-draw-lock').textContent.trim());
    check(lockBtnLabelDiff.includes('substitut'), `le bouton annonce "substitut" quand le candidat DIFFÈRE du piano — obtenu ${JSON.stringify(lockBtnLabelDiff)}`);

    await page.click('#guitar-draw-lock');
    await page.waitForTimeout(300);
    const stateB = await page.evaluate(() => ({ lock: window.app.guitarLock, override: window.app.guitarOverride }));
    check(!!stateB.override && stateB.override.root === 'G' && stateB.override.quality === 'maj', `guitarOverride = G majeur — obtenu ${JSON.stringify(stateB.override)}`);
    check(JSON.stringify(stateB.lock) === JSON.stringify([3, null, 0, null, 0, null]), `guitarLock = exactement la forme dessinée (pas une forme recalculée) — obtenu ${JSON.stringify(stateB.lock)}`);

    const banner = await page.evaluate(() => document.getElementById('guitar-override-row')?.textContent || '');
    check(banner.includes('G'), `le bandeau de substitution affiche bien le nouvel accord — obtenu ${JSON.stringify(banner)}`);

    // Réouverture de la fenêtre : ne repart PAS de zéro, précharge la forme déjà verrouillée (retour
    // utilisateur : « ne jamais perdre ce qui était déjà défini »).
    await openDrawTab();
    const reloaded = await page.evaluate(() => window.app.guitarDrawShape);
    check(JSON.stringify(reloaded) === JSON.stringify([3, null, 0, null, 0, null]), `réouverture précharge bien la forme verrouillée (pas de manche vierge) — obtenu ${JSON.stringify(reloaded)}`);
    await page.click('#guitar-edit-close');
    await page.waitForTimeout(150);

    // ============================================================
    // === C. Simple écoute d'un accord de la grille (pas d'édition ouverte) -> écrit dans les données ===
    // ============================================================
    await page.evaluate(() => {
        const mk = (r, q, b) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 0, octave: 3, bass: null, playStyle: 'held' });
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [
            mk('C', 'maj', 4), mk('D', 'min', 4)] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(400);
    await page.evaluate(() => window.app.selectChord(0, 1)); // simple écoute du Dmin, aucune édition
    await page.waitForTimeout(250);
    check(await page.evaluate(() => window.app.appMode) === 'add', 'toujours en mode Ajout — aucune édition ouverte par une simple écoute');

    await openDrawTab();
    // Dmin (D-F-A) : corde1(A2=45)fret0->A2(45,pc9,fifth) ; corde2(D3=50)fret0->D3(50,pc2,root) ;
    // corde3(G3=55)fret10->F4(65,pc5,third).
    await clickString(1, 0);
    await clickString(2, 0);
    await clickString(3, 10);
    await page.click('#guitar-draw-validate');
    await page.waitForTimeout(200);
    await page.click('#guitar-draw-lock');
    await page.waitForTimeout(300);

    const dataAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[1]);
    check(dataAfter.guitarOverride === null, 'simple écoute : guitarOverride écrit dans les DONNÉES (même accord que le piano)');
    check(JSON.stringify(dataAfter.guitarLock) === JSON.stringify([null, 0, 0, 10, null, null]), `simple écoute : guitarLock écrit dans les DONNÉES — obtenu ${JSON.stringify(dataAfter.guitarLock)}`);

    // ============================================================
    // === D. Survit à un aller-retour de navigation entre doigtés (flèches précédent/suivant) ===
    // ============================================================
    await page.evaluate(() => window.app.selectChord(0, 1));
    await page.waitForTimeout(200);
    const beforeNav = await page.evaluate(() => window.app.guitarDisplayLock);
    await page.click('#guitar-next');
    await page.waitForTimeout(150);
    await page.click('#guitar-prev');
    await page.waitForTimeout(150);
    const afterNav = await page.evaluate(() => window.app.guitarDisplayLock);
    check(JSON.stringify(beforeNav) === JSON.stringify(afterNav) && beforeNav !== null, `le verrou survit à la navigation entre doigtés — avant ${JSON.stringify(beforeNav)}, après ${JSON.stringify(afterNav)}`);
    const dataFinal = await page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[1].guitarLock);
    check(JSON.stringify(dataFinal) === JSON.stringify([null, 0, 0, 10, null, null]), 'les données enregistrées restent inchangées après navigation');
    await page.close();

    // ============================================================
    // === E. Mobile : tap réel jusqu'au verrouillage ===
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
    await mpage.selectOption('#root', 'A');
    await mpage.selectOption('#quality', 'min');
    await mpage.waitForTimeout(200);
    await mpage.tap('#guitar-edit-btn');
    await mpage.waitForTimeout(200);
    await mpage.tap('#guitar-edit-tab-draw');
    await mpage.waitForTimeout(150);

    const mSvgBox = await mpage.evaluate(() => document.querySelector('#guitar-edit-neck svg').getBoundingClientRect());
    const mTapString = async (s, fret) => {
        const x = fret === 0 ? (20 - 9) : xFor(fret);
        await mpage.touchscreen.tap(mSvgBox.x + x, mSvgBox.y + yFor(s));
        await mpage.waitForTimeout(150);
    };
    await mTapString(1, 0); // A2 root
    await mTapString(4, 1); // C4 third
    await mTapString(5, 0); // E4 fifth
    await mpage.tap('#guitar-draw-validate');
    await mpage.waitForTimeout(250);
    await mpage.tap('#guitar-draw-lock');
    await mpage.waitForTimeout(300);
    const mobileLock = await mpage.evaluate(() => window.app.guitarLock);
    check(JSON.stringify(mobileLock) === JSON.stringify([null, 0, null, null, 1, 0]), `verrouillage au tap fonctionne sur mobile — obtenu ${JSON.stringify(mobileLock)}`);
    await ctx.close();

    console.log('Errors:', JSON.stringify(errors));
    check(errors.length === 0, 'aucune erreur JavaScript, desktop et mobile confondus');

    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
