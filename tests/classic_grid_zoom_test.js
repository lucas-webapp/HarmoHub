// Les deux échelles de la grille d'accords (H et V) : ce qu'elles changent, ce qu'elles ne touchent
// pas, et où elles sont mémorisées.
//
// CE FICHIER N'ÉTAIT PAS UN BANC. Il écrivait `console.log('PASS ...')` ou `console.log('FAIL')` sans
// rien compter et se terminait par `process.exit(0)` : ses sept verdicts n'avaient aucun effet, et
// run_all.sh, qui cherche une ligne de bilan, le rangeait de toute façon parmi les « CRASH ». Un vrai
// échec y était donc invisible deux fois.
//
// Il cliquait en plus #grid-zoom-close, le bouton de fermeture de l'ancienne vue plein écran : zéro
// occurrence dans l'appli, donc le clic Playwright attendait un élément qui n'arrivait jamais et le
// banc mourait sur une expiration — après quoi plus rien ne s'exécutait, y compris les trois derniers
// verdicts, pourtant tous portés sur des sujets bien vivants (persistance, mémorisation par morceau,
// icône du bouton).
//
// L'INDÉPENDANCE VÉRIFIÉE A CHANGÉ D'OBJET. Le banc contrôlait que zoomer la grille classique ne
// touchait pas à gridZoomLevelX/Y, l'échelle de la vue plein écran — supprimée avec elle. La paire qui
// reste à ne pas confondre est bien réelle : la grille (classicGrid) et le séquenceur en volet
// (seqInline) ont chacun leur échelle, mémorisée séparément.
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
// La police est chargée depuis Google Fonts : injoignable derrière le proxy du bac à sable,
// jamais un problème chez l'utilisateur. Ces échecs réseau sont donc filtrés — sinon ils font
// échouer « aucune erreur console » et masquent les vraies erreurs au milieu du bruit.
const { check, exiger, plan, bilan } = require('./_harness')('échelles de la grille classique');
plan(9);

(async () => {
    const browser = await chromium.launch({
        args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (msg) => { if (msg.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|fonts\.googleapis|fonts\.gstatic/.test(msg.text())) errors.push('console.error: ' + msg.text()); });

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        const mk = (root) => ({ root, quality: 'maj', beats: 4, inversion: 0, drop: 0, octave: 4, bass: null, playStyle: 'held' });
        const chords = Array.from({ length: 10 }, (_, i) => mk(['C', 'D', 'E', 'F', 'G', 'A', 'B'][i % 7]));
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords }] }));
        // Échelles neuves : elles sont mémorisées par appareil, une campagne précédente aurait sinon
        // laissé la grille déjà zoomée et les crans mesurés ici ne partiraient pas de 1.
        for (const k of ['harmohubClassicGridZoomLevelX', 'harmohubClassicGridZoomLevelY', 'harmohubSeqInlineZoomLevelX']) localStorage.removeItem(k);
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(400);

    const etat = () => page.evaluate(() => ({
        x: window.app.classicGridZoomLevelX,
        y: window.app.classicGridZoomLevelY,
        seqInlineX: window.app.seqInlineZoomLevelX,
        rowH: getComputedStyle(document.querySelector('.chord-grid')).getPropertyValue('--row-h'),
        beatsPerRow: +document.querySelector('.chord-grid').dataset.beatsPerRow,
    }));

    const depart = await etat();
    console.log('départ :', JSON.stringify(depart));
    if (!exiger(depart.x === 1 && depart.y === 1, `les deux échelles partent bien de 1 — ${depart.x}/${depart.y}`)) bilan();

    console.log('--- V+ trois fois : la hauteur de ligne grandit, le nombre de temps par ligne ne bouge pas ---');
    for (let i = 0; i < 3; i++) await page.click('#classic-grid-in-v');
    await page.waitForTimeout(250);
    const apresV = await etat();
    console.log(JSON.stringify(apresV));
    check(apresV.y > depart.y, `l'échelle VERTICALE a bien augmenté (${depart.y} -> ${apresV.y})`);
    check(apresV.beatsPerRow === depart.beatsPerRow,
        `le nombre de temps par ligne est inchangé : le zoom V ne touche pas à la mise en page horizontale (${apresV.beatsPerRow})`);
    check(apresV.x === depart.x, `et l'échelle horizontale n'a pas bougé non plus (${apresV.x})`);

    console.log('--- H+ trois fois : MOINS de temps par ligne (les cases s\'élargissent) ---');
    for (let i = 0; i < 3; i++) await page.click('#classic-grid-in-h');
    await page.waitForTimeout(250);
    const apresH = await etat();
    console.log(JSON.stringify(apresH));
    check(apresH.x > apresV.x, `l'échelle HORIZONTALE a bien augmenté (${apresV.x} -> ${apresH.x})`);
    check(apresH.beatsPerRow < depart.beatsPerRow,
        `élargir les cases fait tenir moins de temps par ligne (${depart.beatsPerRow} -> ${apresH.beatsPerRow})`);

    console.log('--- Le séquenceur garde SA propre échelle, indépendante de celle de la grille ---');
    check(apresH.seqInlineX === depart.seqInlineX,
        `l'échelle du séquenceur en volet n'a pas suivi celle de la grille (${apresH.seqInlineX})`);

    console.log('--- Les échelles survivent à un rechargement (mémorisées sur l\'appareil) ---');
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(500);
    const apresRechargement = await etat();
    console.log(JSON.stringify(apresRechargement));
    check(apresRechargement.x === apresH.x && apresRechargement.y === apresH.y,
        `échelles retrouvées après rechargement — ${apresRechargement.x}/${apresRechargement.y}`);

    console.log('--- Et elles sont mémorisées PAR MORCEAU (createNewSongFromCurrentState / loadSong) ---');
    const morceau = await page.evaluate(() => {
        window.app.createNewSongFromCurrentState('Zoom Test Song');
        return localStorage.getItem('harmohubCurrentSongId');
    });
    await page.waitForTimeout(200);
    await page.evaluate(() => { window.app.classicGridZoomLevelX = 1; window.app.classicGridZoomLevelY = 1; });
    await page.evaluate((id) => window.app.loadSong(id), morceau);
    await page.waitForTimeout(300);
    const apresChargement = await etat();
    console.log(JSON.stringify(apresChargement));
    check(apresChargement.x === apresH.x && apresChargement.y === apresH.y,
        `recharger le morceau restaure ses échelles, même après les avoir remises à 1 — ${apresChargement.x}/${apresChargement.y}`);

    console.log('--- Icône du bouton : des barres de séquenceur, plus une loupe ---');
    // Le bouton a gardé son identifiant historique #grid-zoom (le renommer cassait l'appli pour tout
    // navigateur servant un index.html en cache, voir le commentaire dans index.html), mais il ouvre le
    // séquenceur : son dessin ne doit donc plus être une loupe.
    const icone = await page.evaluate(() => {
        const svg = document.getElementById('grid-zoom').querySelector('svg');
        return { cercle: !!svg.querySelector('circle'), rectangles: svg.querySelectorAll('rect').length };
    });
    console.log(JSON.stringify(icone));
    check(!icone.cercle && icone.rectangles === 9,
        `l'icône est bien une grille de 9 barres, sans cercle de loupe — ${icone.rectangles} rectangles, cercle : ${icone.cercle}`);

    console.log('Errors:', JSON.stringify(errors));
    check(errors.length === 0, 'aucune erreur JavaScript pendant tout le scénario');
    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
