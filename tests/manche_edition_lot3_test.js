// Lot 3 de l'édition manuelle du manche : reconnaissance automatique de l'accord dessiné (retour
// utilisateur, point 3 : « le logiciel doit ensuite reconnaître lui-même le ou les accords dessinés
// sur le manche... il peut y en avoir plusieurs avec les mêmes notes, proposer les plus cohérents en
// premier » ; point 4 : « quand l'accord ne peut pas être reconnu... ne pas afficher de nom d'accord
// au-dessus du diagramme guitare »). Réutilise le moteur de reconnaissance de l'import MIDI
// (analyzeGuitarDrawnChord, voir script.js), adapté à un ensemble de notes SANS dimension temporelle.
const { chromium, devices } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, plan, bilan } = require('./_harness')('manche : Lot 3 (reconnaissance automatique)');
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
    const closeEditor = async () => { await page.click('#guitar-edit-close'); await page.waitForTimeout(120); };

    // Géométrie connue (voir GUITAR_SVG_LAYOUT dans script.js).
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
    // === A. Un accord clair (C majeur : root/tierce/quinte) doit être reconnu ===
    // ============================================================
    await openDrawTab();
    check(await page.isDisabled('#guitar-draw-validate'), "Valider désactivé, manche vide au départ");
    check(await page.isHidden('#guitar-draw-result'), "aucun résultat affiché avant validation");

    // corde4 (B3=59) fret1 -> C4(60,pc=0,root) ; corde3 (G3=55) fret0 -> G3(55,pc=7,fifth) ;
    // corde2 (D3=50) fret2 -> E3(52,pc=4,third).
    await clickString(4, 1);
    await clickString(3, 0);
    await clickString(2, 2);

    await page.click('#guitar-draw-validate');
    await page.waitForTimeout(200);
    check(await page.isVisible('#guitar-draw-result'), "le panneau de résultat s'affiche après validation");
    const rec1 = await page.evaluate(() => window.app.guitarDrawRecognition);
    check(!!rec1 && rec1.root === 'C' && rec1.quality === 'maj', `C majeur (racine+tierce+quinte) est bien reconnu comme Cmaj — obtenu ${rec1 && rec1.root}${rec1 && rec1.quality}`);
    const firstActiveLabel = await page.evaluate(() => document.querySelector('.guitar-draw-candidate.active')?.textContent);
    check(firstActiveLabel === 'C', `le meilleur candidat (C) est bien sélectionné par défaut (obtenu ${firstActiveLabel})`);
    const nCandidates1 = await page.evaluate(() => document.querySelectorAll('.guitar-draw-candidate').length);
    check(nCandidates1 >= 1, `au moins un candidat proposé (${nCandidates1})`);

    // Changer de candidat sélectionné (même s'il n'y en a qu'un ou plusieurs) ne doit lever aucune erreur
    if (nCandidates1 > 1) {
        await page.click('.guitar-draw-candidate:not(.active)');
        await page.waitForTimeout(150);
        const idx = await page.evaluate(() => window.app.guitarDrawSelectedIndex);
        check(idx !== 0, `cliquer un autre candidat change bien la sélection (index=${idx})`);
    } else {
        check(true, "(un seul candidat cohérent ici, rien à comparer)");
    }

    // Modifier le dessin après validation doit invalider/masquer le résultat (plus valable)
    await clickString(2, 2); // reclic -> retire la tierce posée plus haut
    await page.waitForTimeout(150);
    check(await page.isHidden('#guitar-draw-result'), "modifier le dessin après validation masque bien l'ancien résultat (périmé)");
    const recAfterEdit = await page.evaluate(() => window.app.guitarDrawRecognition);
    check(recAfterEdit === null, "la reconnaissance est bien remise à null après un changement du dessin");

    await closeEditor();

    // ============================================================
    // === B. Pas assez de notes (2 seulement) -> non reconnu, aucun nom ===
    // ============================================================
    await openDrawTab();
    // Juste root + fifth (pas de tierce) : C sans tierce, ambigu (ni majeur ni mineur).
    await clickString(4, 1); // C4, root
    await clickString(3, 0); // G3, fifth
    await page.click('#guitar-draw-validate');
    await page.waitForTimeout(200);
    check(await page.isVisible('#guitar-draw-result'), "le panneau s'affiche même pour un résultat négatif");
    const recSparse = await page.evaluate(() => window.app.guitarDrawRecognition);
    console.log('reconnaissance (root+fifth seuls) :', JSON.stringify(recSparse));
    check(!recSparse || recSparse.confidence < 0.62, `root+quinte seuls (pas de tierce) ne suffisent pas à nommer un accord avec confiance — obtenu ${recSparse && recSparse.confidence}`);
    const bodyText = await page.evaluate(() => document.getElementById('guitar-draw-result').textContent);
    check(bodyText.includes('non reconnu'), `le message « non reconnu » s'affiche bien (${JSON.stringify(bodyText)})`);
    check(await page.evaluate(() => document.querySelectorAll('.guitar-draw-candidate').length) === 0, "aucun candidat cliquable n'est proposé quand l'accord n'est pas reconnu");

    await closeEditor();

    // ============================================================
    // === C. Un accord riche (Cmaj7 : root/tierce/quinte/7e) doit être reconnu, PAS juste Cmaj ===
    // ============================================================
    await openDrawTab();
    await clickString(4, 1); // C4, root
    await clickString(3, 0); // G3, fifth
    await clickString(2, 2); // E3, third
    // Corde5 (E4=64) fret7 -> B4(71,pc=11) : 7e MAJEURE de C, pour distinguer Cmaj7 de Cmaj.
    await clickString(5, 7);

    await page.click('#guitar-draw-validate');
    await page.waitForTimeout(200);
    const rec2 = await page.evaluate(() => window.app.guitarDrawRecognition);
    console.log('reconnaissance (C+tierce+quinte+7e maj) :', JSON.stringify(rec2));
    check(!!rec2 && rec2.root === 'C' && rec2.quality === 'maj7', `C+tierce+quinte+7e majeure est bien reconnu comme Cmaj7 (le plus complet), pas juste Cmaj — obtenu ${rec2 && rec2.root}${rec2 && rec2.quality}`);

    await closeEditor();
    await page.close();

    // ============================================================
    // === D. Mobile : tap tactile réel jusqu'au bout ===
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
    await mTapString(4, 1); // C4 root
    await mTapString(3, 0); // G3 fifth
    await mTapString(2, 2); // E3 third
    await mpage.tap('#guitar-draw-validate');
    await mpage.waitForTimeout(250);
    check(await mpage.isVisible('#guitar-draw-result'), "résultat visible après tap sur Valider (mobile)");
    const recMobile = await mpage.evaluate(() => window.app.guitarDrawRecognition);
    check(!!recMobile && recMobile.root === 'C' && recMobile.quality === 'maj', `Cmaj reconnu au tap sur mobile — obtenu ${recMobile && recMobile.root}${recMobile && recMobile.quality}`);
    const chipH = await mpage.evaluate(() => document.querySelector('.guitar-draw-candidate').getBoundingClientRect().height);
    check(chipH >= 24, `la puce candidat a une hauteur tactile raisonnable sur mobile (${chipH}px)`);
    await ctx.close();

    console.log('Errors:', JSON.stringify(errors));
    check(errors.length === 0, 'aucune erreur JavaScript, desktop et mobile confondus');

    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
