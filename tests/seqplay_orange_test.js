const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// La police est chargée depuis Google Fonts : injoignable derrière le proxy du bac à sable,
// jamais un problème chez l'utilisateur. Ces échecs réseau sont donc filtrés — sinon ils font
// échouer « aucune erreur console » et masquent les vraies erreurs au milieu du bruit.

(async () => {
    const browser = await chromium.launch({
        args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (msg) => { if (msg.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|fonts\.googleapis|fonts\.gstatic/.test(msg.text())) errors.push('console.error: ' + msg.text()); });

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        const mk = (root, quality) => ({ root, quality, beats: 4, inversion: 0, drop: 0, octave: 4, bass: null, playStyle: 'held' });
        const sections = [{ title: 'Couplet', chords: [mk('C', 'maj'), mk('A', 'min7'), mk('F', 'maj7'), mk('G', '7')] }];
        localStorage.setItem('myProgression', JSON.stringify({ sections }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);

    console.log('--- Open the grid-zoom pinned sequencer (baseline: no loop range) ---');
    await page.click('#grid-zoom');
    await page.waitForTimeout(150);
    // editChord remplace editChordFromGridZoom, supprimée avec la vue plein écran de la grille (voir
    // le commentaire d'editChord dans script.js). L'appel à la méthode disparue faisait échouer la
    // MISE EN PLACE de ce banc, qui mourait donc avant sa première assertion : il ne surveillait plus
    // rien, sans le dire.
    await page.evaluate(() => window.app.editChord(0, 0));
    await page.waitForTimeout(150);
    let r = await page.evaluate(() => {
        const btn = document.getElementById('seq-play');
        return { exists: !!btn, orange: btn && btn.classList.contains('btn-loop-range'), title: btn && btn.title };
    });
    console.log(JSON.stringify(r));
    // LE LIBELLÉ DIT MAINTENANT DEUX CHOSES DE PLUS, et c'est voulu : ce que le bouton joue (l'accord,
    // ou la plage tracée) et le geste qui bascule la boucle — l'anneau ayant remplacé le bouton dédié
    // (voir syncAnneauBoucle). On éprouve donc le SUJET du libellé, pas sa formulation exacte : ce
    // banc surveille la teinte orange et ce qui est joué, pas la rédaction de l'infobulle.
    console.log((r.exists && !r.orange && /accord/i.test(r.title)) ? 'PASS (baseline: normal green seq-play)' : 'FAIL');

    console.log('--- Set a loop range WHILE the pinned sequencer is open: seq-play should react live ---');
    await page.evaluate(() => window.app.setLoopRange(0, 0, 0, 2));
    await page.waitForTimeout(150);
    r = await page.evaluate(() => {
        const btn = document.getElementById('seq-play');
        return { orange: btn.classList.contains('btn-loop-range'), title: btn.title };
    });
    console.log(JSON.stringify(r));
    console.log((r.orange && r.title.includes('plage')) ? 'PASS (seq-play turned orange live when range was set)' : 'FAIL');

    console.log('--- Clicking seq-play now plays the RANGE (playProgression), not just the current chord ---');
    await page.click('#seq-play');
    await page.waitForTimeout(200);
    r = await page.evaluate(() => ({ playMode: window.app._playMode }));
    console.log(JSON.stringify(r));
    console.log((r.playMode === 'progression') ? 'PASS (seq-play triggered playProgression)' : 'FAIL');
    await page.evaluate(() => window.app.stopAll());
    await page.waitForTimeout(100);

    console.log('--- Clearing the range: seq-play reverts to normal ---');
    await page.evaluate(() => { window.app.loopRange = null; window.app.loadProgression(); window.app.renderSequencer(); });
    await page.waitForTimeout(150);
    r = await page.evaluate(() => {
        const btn = document.getElementById('seq-play');
        return { orange: btn.classList.contains('btn-loop-range'), title: btn.title };
    });
    console.log(JSON.stringify(r));
    console.log((!r.orange && /accord/i.test(r.title)) ? 'PASS (reverted to normal)' : 'FAIL');

    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
