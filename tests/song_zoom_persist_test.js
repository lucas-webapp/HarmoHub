// Les échelles de zoom voyagent AVEC le morceau, pas seulement avec l'appareil.
//
// Retour utilisateur à l'origine de la fonction : rouvrir un morceau doit le retrouver cadré comme on
// l'avait laissé, même sur une autre machine. Les échelles sont donc écrites dans l'enregistrement du
// morceau (voir zoomSettingsForSong) en plus des préférences locales — et un morceau ancien, qui n'a
// pas ces champs, doit repartir de 1 plutôt que d'hériter du cadrage du morceau précédent.
//
// CE FICHIER N'ÉTAIT PAS UN BANC. Cinq `console.log('PASS ...')` / `console.log('FAIL')` sans compteur,
// et `process.exit(0)` à la fin : aucun échec ne pouvait remonter. Il n'atteignait de toute façon
// jamais son premier verdict, cliquant #grid-zoom-in-h puis #grid-zoom-close — les commandes de zoom
// et le bouton de fermeture de l'ancienne vue plein écran, tous à zéro occurrence dans l'appli : le
// clic Playwright expirait sur un élément qui n'arriverait jamais.
//
// Les champs surveillés changent donc de nom : gridZoomLevelX/Y (la vue supprimée) laissent la place
// aux échelles qui existent — classicGridZoomLevelX/Y pour la grille, seqInlineZoomLevelX pour le
// séquenceur en volet, seqZoomLevelX/Y pour la vue agrandie. Et les crans se règlent depuis la barre de
// la grille (#classic-grid-in-h / -in-v), qui est là en permanence : il n'y a plus rien à ouvrir ni à
// refermer.
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
// La police est chargée depuis Google Fonts : injoignable derrière le proxy du bac à sable,
// jamais un problème chez l'utilisateur. Ces échecs réseau sont donc filtrés — sinon ils font
// échouer « aucune erreur console » et masquent les vraies erreurs au milieu du bruit.
const { check, exiger, plan, bilan } = require('./_harness')('échelles mémorisées par morceau');
plan(8);

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
        const mk = (root, quality) => ({ root, quality, beats: 4, inversion: 0, drop: 0, octave: 4, bass: null, playStyle: 'held' });
        localStorage.clear();
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [mk('C', 'maj'), mk('A', 'min7')] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(400);

    const echelles = () => page.evaluate(() => ({
        x: window.app.classicGridZoomLevelX,
        y: window.app.classicGridZoomLevelY,
        seqInlineX: window.app.seqInlineZoomLevelX,
    }));

    console.log('--- Change les échelles depuis la barre de la grille, puis enregistre un nouveau morceau ---');
    for (let i = 0; i < 3; i++) await page.click('#classic-grid-in-h');
    for (let i = 0; i < 2; i++) await page.click('#classic-grid-in-v');
    await page.waitForTimeout(300);
    const reglees = await echelles();
    console.log('échelles réglées :', JSON.stringify(reglees));
    if (!exiger(reglees.x > 1 && reglees.y > 1, `les deux échelles ont bien changé avant l'enregistrement — ${reglees.x}/${reglees.y}`)) bilan();

    const morceauId = await page.evaluate(() => {
        window.app.createNewSongFromCurrentState('Test Zoom Song');
        return localStorage.getItem('harmohubCurrentSongId');
    });
    await page.waitForTimeout(300);
    console.log('morceau enregistré :', morceauId);

    const fiche = await page.evaluate(() => {
        const morceaux = JSON.parse(localStorage.getItem('harmohubSongs'));
        const m = morceaux.find(s => s.name === 'Test Zoom Song');
        return m && {
            classicGridZoomLevelX: m.classicGridZoomLevelX, classicGridZoomLevelY: m.classicGridZoomLevelY,
            seqInlineZoomLevelX: m.seqInlineZoomLevelX, seqZoomLevelX: m.seqZoomLevelX, seqZoomLevelY: m.seqZoomLevelY,
        };
    });
    console.log('champs de zoom de la fiche :', JSON.stringify(fiche));
    if (!exiger(!!fiche, "la fiche du morceau a bien été écrite")) bilan();
    check(fiche.classicGridZoomLevelX === reglees.x && fiche.classicGridZoomLevelY === reglees.y,
        `les échelles de la grille sont écrites dans la fiche du morceau — ${fiche.classicGridZoomLevelX}/${fiche.classicGridZoomLevelY}`);
    check(fiche.seqInlineZoomLevelX !== undefined && fiche.seqZoomLevelX !== undefined && fiche.seqZoomLevelY !== undefined,
        `celles du séquenceur y sont aussi, volet et vue agrandie — ${fiche.seqInlineZoomLevelX} / ${fiche.seqZoomLevelX}-${fiche.seqZoomLevelY}`);

    console.log('--- « Une autre machine » : on efface les préférences locales, on garde la bibliothèque ---');
    await page.evaluate(() => {
        for (const k of ['harmohubClassicGridZoomLevelX', 'harmohubClassicGridZoomLevelY',
            'harmohubSeqZoomLevelX', 'harmohubSeqZoomLevelY', 'harmohubSeqInlineZoomLevelX']) localStorage.removeItem(k);
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(500);
    const apresRechargement = await echelles();
    console.log('après rechargement, préférences locales effacées :', JSON.stringify(apresRechargement));
    check(apresRechargement.x === fiche.classicGridZoomLevelX && apresRechargement.y === fiche.classicGridZoomLevelY,
        `les échelles viennent du MORCEAU, pas des réglages par défaut de l'appareil — ${apresRechargement.x}/${apresRechargement.y}`);

    console.log('--- Ouverture explicite depuis la liste (loadSong) ---');
    await page.evaluate(() => { window.app.classicGridZoomLevelX = 1; window.app.classicGridZoomLevelY = 1; });
    await page.evaluate((id) => window.app.loadSong(id), morceauId);
    await page.waitForTimeout(300);
    const apresLoadSong = await echelles();
    console.log(JSON.stringify(apresLoadSong));
    check(apresLoadSong.x === fiche.classicGridZoomLevelX && apresLoadSong.y === fiche.classicGridZoomLevelY,
        `loadSong restaure les échelles du morceau même après les avoir remises à 1 — ${apresLoadSong.x}/${apresLoadSong.y}`);

    console.log('--- Un morceau ANCIEN, enregistré sans champ de zoom, repart de 1 ---');
    // Le piège : sans remise à 1 explicite, il hériterait du cadrage du morceau précédent.
    await page.evaluate(() => {
        const morceaux = JSON.parse(localStorage.getItem('harmohubSongs'));
        morceaux.push({ id: 'legacy1', name: 'Legacy Song', root: 'C', mode: 'maj', timeSig: '4/4', groove: 'straight', bpm: 120, instrument: 'piano', sections: [{ title: '', chords: [] }] });
        localStorage.setItem('harmohubSongs', JSON.stringify(morceaux));
        window.app.classicGridZoomLevelX = 1.9; // on salit d'abord, pour être sûr que la remise à 1 a bien lieu
        window.app.loadSong('legacy1');
    });
    await page.waitForTimeout(300);
    const ancien = await page.evaluate(() => ({
        x: window.app.classicGridZoomLevelX, y: window.app.classicGridZoomLevelY,
        seqX: window.app.seqZoomLevelX, seqInlineX: window.app.seqInlineZoomLevelX,
    }));
    console.log('morceau ancien :', JSON.stringify(ancien));
    check(ancien.x === 1 && ancien.y === 1 && ancien.seqX === 1 && ancien.seqInlineX === 1,
        `toutes les échelles reviennent à 1 pour un morceau sans champ de zoom — ${JSON.stringify(ancien)}`);

    console.log('Errors:', JSON.stringify(errors));
    check(errors.length === 0, 'aucune erreur JavaScript pendant tout le scénario');
    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
