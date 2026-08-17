// #seq-play : un seul bouton, deux sens selon la vue où on le regarde.
//   - séquenceur COMPACT (dans le module Ajouter/Modifier) : joue le seul accord en cours, même si
//     une plage à boucler est définie ailleurs.
//   - séquenceur CONTINU (volet sous la grille) ou vue agrandie : joue TOUTE la plage à boucler.
// Voir seqLoopRangeActive dans renderSequencer : `!!this.loopRange && (this.seqMode === 'continu' ||
// this.seqZoomOpen)`.
//
// Ce banc appelait app.openGridZoom() + app.editChordFromGridZoom() pour atteindre la seconde
// moitié : disparues avec la vue plein écran, il mourait donc juste après avoir vérifié la première.
// Le contrat n'a pas changé — seule la vue qui l'active a changé de nom (loupe grille -> mode
// 'continu' du volet). On y rebranche, et on passe par les VRAIS boutons plutôt que par des appels
// de méthode : c'est le câblage du bouton qui est en cause ici, pas la logique qu'il appelle.
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('seq-play et la plage à boucler');
plan(7);

(async () => {
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => localStorage.removeItem('myProgression'));
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(400);

    // Deux accords, une plage à boucler qui couvre les deux.
    await page.evaluate(() => { window.app.saveCurrent(); });
    await page.waitForTimeout(150);
    await page.evaluate(() => { window.app.saveCurrent(); });
    await page.waitForTimeout(150);
    await page.evaluate(() => { window.app.setLoopRange(0, 0, 0, 1); });
    await page.waitForTimeout(150);
    exiger(await page.evaluate(() => !!window.app.loopRange), 'la plage à boucler est bien posée sur les deux accords');

    // Espionne les deux chemins de lecture pour savoir lequel le bouton emprunte réellement.
    const espionner = () => page.evaluate(() => {
        window.__appels = [];
        if (window.__espionPose) return;
        window.__espionPose = true;
        const cur = window.app.playCurrent.bind(window.app);
        window.app.playCurrent = function (...a) { window.__appels.push('playCurrent'); return cur(...a); };
        const prog = window.app.playProgression.bind(window.app);
        window.app.playProgression = function (...a) { window.__appels.push('playProgression'); return prog(...a); };
    });

    console.log('=== Séquenceur COMPACT (bouton du module) : joue le seul accord en cours ===');
    await page.evaluate(() => window.app.editChord(0, 0));
    await page.waitForTimeout(250);
    await page.click('#toggle-sequencer');
    await page.waitForTimeout(500);
    const modeCompact = await page.evaluate(() => window.app.seqMode);
    exiger(modeCompact === 'compact', `le séquenceur est bien ouvert en mode compact — trouvé « ${modeCompact} »`);

    await espionner();
    await page.click('#seq-play');
    await page.waitForTimeout(300);
    const appels1 = await page.evaluate(() => window.__appels);
    console.log('appels en compact :', JSON.stringify(appels1));
    check(appels1.includes('playCurrent') && !appels1.includes('playProgression'),
        'en compact, #seq-play appelle playCurrent() (jamais playProgression) même avec une plage à boucler active');
    check(!await page.evaluate(() => document.getElementById('seq-play').classList.contains('btn-loop-range')),
        "en compact, #seq-play n'affiche pas la couleur de la plage à boucler");

    await page.evaluate(() => window.app.stopAll());
    await page.waitForTimeout(200);

    console.log('=== Séquenceur CONTINU (bouton de la barre de grille) : le MÊME bouton joue la plage ===');
    // Passer d'un mode à l'autre sans refermer : « autre bouton = on bascule de mode » (toggleSequencer).
    await page.click('#grid-zoom');
    await page.waitForTimeout(700);
    const modeContinu = await page.evaluate(() => window.app.seqMode);
    exiger(modeContinu === 'continu', `le séquenceur est bien passé en mode continu — trouvé « ${modeContinu} »`);

    check(await page.evaluate(() => document.getElementById('seq-play').classList.contains('btn-loop-range')),
        'en continu, #seq-play prend bien la couleur de la plage à boucler');

    await espionner();
    await page.click('#seq-play');
    await page.waitForTimeout(300);
    const appels2 = await page.evaluate(() => window.__appels);
    console.log('appels en continu :', JSON.stringify(appels2));
    check(appels2.includes('playProgression'),
        'en continu, #seq-play honore bien la plage à boucler (playProgression)');

    await page.evaluate(() => window.app.stopAll());
    console.log('Errors:', JSON.stringify(errors));
    check(errors.length === 0, 'aucune erreur JavaScript pendant tout le scénario');
    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
