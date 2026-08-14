const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// La police est chargée depuis Google Fonts : injoignable derrière le proxy du bac à sable,
// jamais un problème chez l'utilisateur. Ces échecs réseau sont donc filtrés — sinon ils font
// échouer « aucune erreur console » et masquent les vraies erreurs au milieu du bruit.
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (msg) => { if (msg.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|fonts\.googleapis|fonts\.gstatic/.test(msg.text())) errors.push('console.error: ' + msg.text()); });
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    const deplieReglages = async () => {
        if (await page.evaluate(() => document.getElementById('song-settings').hidden)) {
            await page.click('#song-summary');
            await page.waitForTimeout(250);
        }
    };

    // BLOC SUPPRIMÉ : « le bouton Ajouter est masqué dans l'onglet Config ». L'onglet Config
    // n'existe plus — les réglages du morceau sont sortis du système d'onglets et vivent désormais
    // dans un bloc autonome, dépliable, qui ne masque plus rien (voir song_panel_test.js, qui
    // vérifie justement l'absence de #app-mode-config et de #config-card). Ce qui restait à
    // éprouver ici est la suggestion de tonalité, conservée telle quelle ci-dessous.
    console.log('=== 2. Key suggestion ===');
    await page.evaluate(() => {
        const mk = (root, quality) => ({ root, quality, beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
        // Progression classique en Do majeur : C, Am, F, G7
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: '', chords: [
            mk('C', 'maj'), mk('A', 'min'), mk('F', 'maj'), mk('G', 'dom7'),
        ] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);
    r = await page.evaluate(() => window.app.suggestSongKey());
    console.log(JSON.stringify(r, null, 2));
    // CONTRAT CHANGÉ : le champ s'appelait `diatonicCount` (un NOMBRE d'accords diatoniques, ici 4
    // sur 4). Les suggestions sont passées aux pourcentages — c'est une PROPORTION qui est renvoyée
    // désormais, `diatonicRatio`, et 1 veut dire « tous les accords sont dans la tonalité ». Le
    // test lisait un champ qui n'existe plus : `undefined === 4` échouait sans rien dire de l'appli,
    // qui classait pourtant bien Do majeur en tête.
    console.log((r[0].root === 'C' && r[0].mode === 'maj' && r[0].diatonicRatio === 1) ? 'PASS (C major correctly ranked first)' : 'FAIL');

    console.log('--- A minor progression should rank A minor first, not C major ---');
    await page.evaluate(() => {
        const mk = (root, quality) => ({ root, quality, beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
        // Am, F, C, G -- starts and ends on Am -> A minor is the more likely tonic
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: '', chords: [
            mk('A', 'min'), mk('F', 'maj'), mk('C', 'maj'), mk('A', 'min'),
        ] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);
    r = await page.evaluate(() => window.app.suggestSongKey());
    console.log(JSON.stringify(r.slice(0, 2), null, 2));
    console.log((r[0].root === 'A' && r[0].mode === 'min') ? 'PASS (A minor ranked first thanks to tonic-position tiebreak)' : 'FAIL');

    console.log('--- UI: clicking a suggestion applies it to global-root/global-mode ---');
    // Le bouton vivait dans l'onglet Config ; il vit maintenant dans les réglages du morceau, un
    // bloc dépliable et autonome (l'onglet a disparu, voir plus haut).
    await deplieReglages();
    await page.click('#key-suggest-btn');
    await page.waitForTimeout(100);
    r = await page.evaluate(() => document.getElementById('key-suggest-menu').hidden);
    console.log('menu hidden?', r);
    const firstBtnText = await page.evaluate(() => document.querySelector('#key-suggest-menu button .key-suggest-label').textContent);
    console.log('first suggestion label:', firstBtnText);
    await page.click('#key-suggest-menu button');
    await page.waitForTimeout(100);
    r = await page.evaluate(() => ({ root: document.getElementById('global-root').value, mode: document.getElementById('global-mode').value, menuHidden: document.getElementById('key-suggest-menu').hidden }));
    console.log(JSON.stringify(r));
    console.log((r.root === 'A' && r.mode === 'min' && r.menuHidden) ? 'PASS (applied A minor, menu closed)' : 'FAIL');

    console.log('--- Empty grid: shows a hint instead of an empty/broken menu ---');
    await page.evaluate(() => localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: '', chords: [] }] })));
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);
    // Le bouton vivait dans l'onglet Config ; il vit maintenant dans les réglages du morceau, un
    // bloc dépliable et autonome (l'onglet a disparu, voir plus haut).
    await deplieReglages();
    await page.click('#key-suggest-btn');
    await page.waitForTimeout(100);
    r = await page.evaluate(() => document.getElementById('key-suggest-menu').hidden);
    console.log('menu stayed hidden (hint shown instead)?', r);
    console.log(r ? 'PASS' : 'FAIL');

    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
})();
