const { chromium } = require('playwright');
// CE BANC S'APPELAIT probe_instrument_tout_test, ET SON BOUTON A DISPARU.
//
// Il gardait une régression précise, de la même famille que le clic sur un accord voisin :
// « Appliquer à tout le morceau » appelait syncGridZoomPinnedSeq, méthode partie avec la vue plein
// écran de la grille. L'appel avait survécu — la méthode levait une TypeError juste APRÈS avoir écrit
// les données, si bien que tout ce qui suivait (report sur une lecture en cours) ne s'exécutait
// jamais, sans que rien ne le signale à l'écran.
//
// Le bouton n'existe plus : le son est un réglage UNIQUE du morceau (retour utilisateur : « à définir
// une fois dans morceau uniquement, et tout le morceau prendra cet instrument, je ne ferai jamais de
// mélange »), il n'y a donc plus rien à propager.
//
// MAIS LE DANGER, LUI, N'A PAS DISPARU — il a seulement changé de porte. Changer le son PENDANT
// qu'un accord est ouvert en modification touche toujours au séquenceur et à l'aperçu sonore ; c'est
// exactement le terrain où l'appel mort s'était caché. Ce banc garde donc sa raison d'être et vise la
// nouvelle porte : le sélecteur des réglages du morceau.
const creerHarnais = require('./_harness');
const { plan, check, exiger, bilan } = creerHarnais('Instrument : le changer pendant une modification');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
(async () => {
    plan(8);
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    await page.goto(BASE + '/index.html?nocache=' + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.evaluate(() => {
        const mk = (r, q) => ({ root: r, quality: q, beats: 4, inversion: 0, drop: 0, octave: 3, bass: null, playStyle: 'held' });
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [mk('C','maj'), mk('A','min7'), mk('G','7')] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(500);
    // Un accord EN COURS D'ÉDITION : c'est la seule branche qui touchait la méthode disparue.
    const cellule = i => page.click(`.grid-cell[data-index="${i}"]`, { position: { x: 40, y: 40 } });
    await cellule(1); await cellule(1); await page.waitForTimeout(400);
    exiger(await page.evaluate(() => window.app.editingIndex) === 1, 'un accord est bien en cours de modification');

    // Le sélecteur vit maintenant dans les réglages du morceau, repliés par défaut : on les déplie
    // par le vrai bouton, comme le ferait quelqu'un.
    const avant = errors.length;
    await page.click('#song-summary');
    await page.waitForTimeout(400);
    check(await page.evaluate(() => {
        const s = document.getElementById('instrument');
        return !!s && s.offsetParent !== null && !!s.closest('#song-settings');
    }), 'le son du morceau est atteignable dans les réglages dépliés');

    // LE SÉQUENCEUR DOIT ÊTRE OUVERT pour que cette section éprouve quoi que ce soit. Ma première
    // version affirmait « le séquenceur est toujours là » sans l'avoir ouvert : .seq-grid était
    // absent AVANT comme APRÈS, et le banc accusait le changement de son d'une disparition qui
    // n'avait jamais eu lieu. Le relevé « avant » ci-dessous rend l'erreur impossible à refaire.
    await page.evaluate(() => { if (!window.app.seqOpen) window.app.toggleSequencer('compact'); });
    await page.waitForTimeout(800);
    const seqAvant = await page.evaluate(() => !!document.querySelector('.seq-grid'));
    check(seqAvant, 'le séquenceur de l\'accord ouvert est bien affiché AVANT le changement');

    await page.selectOption('#instrument', 'organ');
    await page.waitForTimeout(600);
    const etat = await page.evaluate(() => ({
        son: window.app.songInstrument,
        // Le séquenceur de l'accord ouvert doit avoir survécu : c'est lui que l'appel mort empêchait
        // de se redessiner, et son absence était le symptôme visible du défaut d'origine.
        seqPresent: !!document.querySelector('.seq-grid'),
        editeToujours: window.app.editingIndex === 1,
        // Aucun accord ne porte de son à lui : le réglage est unique pour le morceau.
        parAccord: JSON.parse(localStorage.getItem('myProgression')).sections[0].chords.filter(c => 'instrument' in c).length,
    }));
    console.log(JSON.stringify(etat), JSON.stringify(errors.slice(avant)));
    check(etat.son === 'organ', `le son du morceau a bien changé — ${etat.son}`);
    check(etat.seqPresent && etat.editeToujours, 'le séquenceur est toujours là et l\'accord toujours en modification');
    check(etat.parAccord === 0, `aucun son n'est écrit dans les accords — ${etat.parAccord} en portent un`);
    check(errors.length === avant, `aucune erreur levée en changeant le son pendant une modification — ${JSON.stringify(errors.slice(avant))}`);

    check(errors.length === 0, `aucune erreur JavaScript — ${errors.join(' | ') || 'aucune'}`);
    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
