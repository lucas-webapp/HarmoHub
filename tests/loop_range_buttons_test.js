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
//
// DEUXIÈME RÉÉCRITURE. La fin du banc éprouvait le « bouton jumeau de la loupe grille »
// (#grid-zoom-play-prog / #grid-zoom-play-chord) : la vue plein écran dupliquait le transport dans son
// en-tête, et il fallait vérifier que la copie suivait la même règle que l'original. La vue a été
// supprimée, ces identifiants ont zéro occurrence dans l'appli, et le banc mourait sur un
// `zp.classList` avec zp à null — après quoi sa dernière vérification, « le bouton unique joue bien la
// PLAGE », n'était plus jamais atteinte. Il n'y a plus qu'UN transport, ancré en bas de la colonne de
// gauche (voir placeGlobalTransport) : il n'y a plus de jumeau à comparer, et c'est sur lui que se
// termine désormais le scénario.
//
// C'était aussi un faux banc : ses six verdicts s'écrivaient en console.log sans compteur ni code de
// sortie, et il finissait sur process.exit(0) — un échec n'avait donc aucun effet.
const { check, exiger, plan, bilan } = require('./_harness')('plage à boucler et bouton unique');
plan(6);

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
    check(!r, "le bouton « Accord » (#play) est absent du DOM, à aucun moment il n'existe");

    console.log('--- Baseline (pas de plage à boucler) : titre normal, pas de teinte orange ---');
    r = await page.evaluate(() => {
        const playProg = document.getElementById('play-prog');
        return { hasOrange: playProg.classList.contains('btn-loop-range'), title: playProg.title };
    });
    console.log(JSON.stringify(r));
    check(!r.hasOrange && r.title === 'Lecture', `sans plage à boucler : pas de teinte, titre « ${r.title} »`);

    console.log('--- Une plage à boucler définie : le bouton se recolore et se retitre ---');
    await page.evaluate(() => window.app.setLoopRange(0, 0, 0, 2)); // accords 0..2 de la partie 0
    await page.waitForTimeout(150);
    r = await page.evaluate(() => {
        const playProg = document.getElementById('play-prog');
        return { hasOrange: playProg.classList.contains('btn-loop-range'), title: playProg.title };
    });
    console.log(JSON.stringify(r));
    check(r.hasOrange && r.title === 'Lire la plage à boucler', `plage active : le bouton se recolore et se retitre — « ${r.title} »`);

    console.log('--- Plage effacée : retour à la normale ---');
    await page.evaluate(() => { window.app.loopRange = null; window.app.loadProgression(); });
    await page.waitForTimeout(150);
    r = await page.evaluate(() => {
        const playProg = document.getElementById('play-prog');
        return { hasOrange: playProg.classList.contains('btn-loop-range'), title: playProg.title };
    });
    console.log(JSON.stringify(r));
    check(!r.hasOrange && r.title === 'Lecture', `plage effacée : retour à la normale — « ${r.title} »`);

    console.log('--- Cliquer le bouton unique joue bien la PLAGE seule (chemin playProgression) ---');
    await page.evaluate(() => window.app.setLoopRange(0, 0, 0, 1));
    await page.waitForTimeout(200);
    await page.click('#play-prog');
    await page.waitForTimeout(300);
    const mode = await page.evaluate(() => ({ playMode: window.app._playMode }));
    console.log(JSON.stringify(mode));
    check(mode.playMode === 'progression', `le bouton unique joue la progression/plage — mode « ${mode.playMode} »`);
    await page.evaluate(() => window.app.stopAll());

    console.log('Errors:', JSON.stringify(errors));
    check(errors.length === 0, 'aucune erreur JavaScript pendant tout le scénario');
    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
