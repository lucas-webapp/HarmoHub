const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// La police est chargée depuis Google Fonts : injoignable derrière le proxy du bac à sable,
// jamais un problème chez l'utilisateur. Ces échecs réseau sont donc filtrés — sinon ils font
// échouer « aucune erreur console » et masquent les vraies erreurs au milieu du bruit.
//
// RÉÉCRITE (retour utilisateur : « un seul bouton lecture pour toute la grille, le bouton lecture
// accord ne sert pas à grand chose ») — le contrat d'origine (deux boutons, celui du dessus qui se
// cache quand une plage à boucler existe) n'a plus de sens : #play n'existe plus DU TOUT, il n'y a
// donc plus rien à cacher/montrer selon this.loopRange. Ce qui reste à vérifier : le bouton UNIQUE
// se recolore/se retitre correctement selon qu'une plage est active ou non — même logique
// qu'avant, juste sur un seul bouton au lieu de deux.

(async () => {
    const browser = await chromium.launch({
        args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (msg) => { if (msg.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_CERT_AUTHORITY_INVALID|fonts\.googleapis|fonts\.gstatic/.test(msg.text())) errors.push('console.error: ' + msg.text()); });

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        const mk = (root, quality) => ({ root, quality, beats: 4, inversion: 0, drop: 0, octave: 4, bass: null, playStyle: 'held' });
        const sections = [{ title: 'Couplet', chords: [mk('C', 'maj'), mk('A', 'min7'), mk('F', 'maj7'), mk('G', '7')] }];
        localStorage.setItem('myProgression', JSON.stringify({ sections }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);

    console.log('--- Plus de bouton « Accord » du tout, à aucun moment ---');
    let r = await page.evaluate(() => !!document.getElementById('play'));
    console.log((!r) ? 'PASS (#play absent du DOM)' : 'FAIL');

    console.log('--- Baseline (pas de plage à boucler) : titre normal, pas de teinte orange ---');
    r = await page.evaluate(() => {
        const playProg = document.getElementById('play-prog');
        return { hasOrange: playProg.classList.contains('btn-loop-range'), title: playProg.title };
    });
    console.log(JSON.stringify(r));
    console.log((!r.hasOrange && r.title === 'Lecture') ? 'PASS (baseline: pas de teinte, titre normal)' : 'FAIL');

    console.log('--- Une plage à boucler définie : le bouton se recolore et se retitre ---');
    await page.evaluate(() => window.app.setLoopRange(0, 0, 0, 2)); // accords 0..2 de la partie 0
    await page.waitForTimeout(150);
    r = await page.evaluate(() => {
        const playProg = document.getElementById('play-prog');
        return { hasOrange: playProg.classList.contains('btn-loop-range'), title: playProg.title };
    });
    console.log(JSON.stringify(r));
    console.log((r.hasOrange && r.title === 'Lire la plage à boucler') ? 'PASS (plage active : orange + titre à jour)' : 'FAIL');

    console.log('--- Plage effacée : retour à la normale ---');
    await page.evaluate(() => { window.app.loopRange = null; window.app.loadProgression(); });
    await page.waitForTimeout(150);
    r = await page.evaluate(() => {
        const playProg = document.getElementById('play-prog');
        return { hasOrange: playProg.classList.contains('btn-loop-range'), title: playProg.title };
    });
    console.log(JSON.stringify(r));
    console.log((!r.hasOrange && r.title === 'Lecture') ? 'PASS (effacée : plus de teinte, titre normal)' : 'FAIL');

    console.log('--- Le bouton jumeau de la loupe grille suit la même règle ---');
    await page.click('#grid-zoom');
    await page.waitForTimeout(150);
    const zoomChordGone = await page.evaluate(() => !document.getElementById('grid-zoom-play-chord'));
    console.log(zoomChordGone ? 'PASS (jumeau « Accord » de la loupe absent lui aussi)' : 'FAIL');
    await page.evaluate(() => window.app.setLoopRange(0, 0, 0, 1));
    await page.waitForTimeout(150);
    r = await page.evaluate(() => {
        const zp = document.getElementById('grid-zoom-play-prog');
        return { zoomProgOrange: zp.classList.contains('btn-loop-range') };
    });
    console.log(JSON.stringify(r));
    console.log(r.zoomProgOrange ? 'PASS (jumeau de la loupe suit la même règle)' : 'FAIL');

    console.log('--- Cliquer le bouton unique joue bien la PLAGE seule (chemin playProgression) ---');
    await page.click('#grid-zoom-play-prog');
    await page.waitForTimeout(200);
    r = await page.evaluate(() => ({ playMode: window.app._playMode }));
    console.log(JSON.stringify(r));
    console.log((r.playMode === 'progression') ? 'PASS (le bouton unique joue la progression/plage)' : 'FAIL');
    await page.evaluate(() => window.app.stopAll());

    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
