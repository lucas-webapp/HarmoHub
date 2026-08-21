// Ce banc s'appelait loupe_keyboard : il éprouvait les raccourcis clavier DANS LA LOUPE, la vue
// plein écran de la grille, retirée depuis. Les raccourcis, eux, n'ont pas bougé de la grille
// ordinaire — c'est donc elle que le banc surveille désormais, et son nom le dit.
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
        const sections = [{ title: 'Couplet', chords: [mk('C', 'maj'), mk('A', 'min7'), mk('F', 'maj7')] }];
        localStorage.setItem('myProgression', JSON.stringify({ sections }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);

    await page.click('#grid-zoom'); // ouvre le volet du séquenceur continu sous la grille
    await page.waitForTimeout(400);
    // editChord remplace editChordFromGridZoom, supprimée avec la vue plein écran de la grille (voir
    // le commentaire d'editChord dans script.js). L'appel à la méthode disparue faisait échouer la
    // MISE EN PLACE de ce banc : il mourait avant sa première assertion, donc ne surveillait plus rien
    // — et c'est bien la navigation au clavier, toujours présente, qu'il est censé éprouver.
    await page.evaluate(() => window.app.editChord(0, 1)); // on édite A min7
    await page.waitForTimeout(150);

    // LES FLÈCHES DÉPLACENT LA SÉLECTION VERTE, PAS L'ÉDITION, et c'est voulu : promener la
    // sélection dans la grille ne doit pas rouvrir sans cesse une modification qu'on n'a pas
    // demandée. Le banc exigeait editingIndex === 2 ; il exige maintenant ce qui se passe vraiment,
    // et que l'accord OUVERT reste ouvert pendant qu'on regarde ailleurs.
    console.log('--- Flèche droite : la sélection avance, l\'accord ouvert le reste ---');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(150);
    let r = await page.evaluate(() => ({
        selectedIndex: window.app.selectedIndex,
        editingIndex: window.app.editingIndex,
        cell2Selected: document.querySelector('.grid-cell[data-section="0"][data-index="2"]').classList.contains('selected'),
        cell1Editing: document.querySelector('.grid-cell[data-section="0"][data-index="1"]').classList.contains('editing'),
    }));
    console.log(JSON.stringify(r));
    console.log((r.selectedIndex === 2 && r.editingIndex === 1 && r.cell2Selected && r.cell1Editing)
        ? 'PASS (la sélection avance, la modification reste sur son accord)' : 'FAIL');

    // CE POINT-CI ÉTAIT UNE TAUTOLOGIE : il exigeait editingIndex === 1, qui n'avait jamais bougé.
    // Il vaut mieux qu'il éprouve ce qui était réellement cassé — les flèches repartaient de l'accord
    // en ÉDITION à chaque appui, donc le 2e appui et les suivants ne bougeaient plus rien.
    console.log('--- Flèche droite encore : la sélection continue d\'avancer ---');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(150);
    r = await page.evaluate(() => ({ selectedIndex: window.app.selectedIndex }));
    console.log(JSON.stringify(r));
    console.log((r.selectedIndex === 2) ? 'PASS (bornée au dernier accord de la partie)' : 'FAIL');

    console.log('--- Flèche gauche : la sélection recule d\'un cran ---');
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(150);
    r = await page.evaluate(() => ({ selectedIndex: window.app.selectedIndex, editingIndex: window.app.editingIndex }));
    console.log(JSON.stringify(r));
    console.log((r.selectedIndex === 1 && r.editingIndex === 1) ? 'PASS (la sélection recule d\'un cran)' : 'FAIL');

    console.log('--- Shift+ArrowRight: should extend chord 1 duration by 1 beat ---');
    let beatsBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[1].beats);
    await page.keyboard.down('Shift');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.up('Shift');
    await page.waitForTimeout(150);
    let beatsAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[1].beats);
    console.log('beats before/after:', beatsBefore, beatsAfter);
    // Number(...) : le live-apply (voir commitLiveEdit) sérialise désormais aussi ce champ depuis le
    // panneau (une <select>.value est toujours une string), comme le faisait déjà l'ancien bouton
    // "Modifier" pour tous les autres champs — beatsFromData() le relit de toute façon avec parseInt.
    console.log((Number(beatsAfter) === Number(beatsBefore) + 1) ? 'PASS (Maj+flèche étire bien la case de l'accord OUVERT)' : 'FAIL');

    console.log('--- Letter key "G": should open inline rename with G already typed ---');
    await page.keyboard.press('g');
    await page.waitForTimeout(100);
    r = await page.evaluate(() => {
        const input = document.querySelector('.cell-sym-input');
        return { hasInput: !!input, value: input ? input.value : null };
    });
    console.log(JSON.stringify(r));
    console.log((r.hasInput && r.value.toUpperCase().startsWith('G')) ? 'PASS (une lettre ouvre la retape du symbole, déjà amorcée)' : 'FAIL');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);

    console.log('--- Delete: should remove the currently EDITED chord (not a stale selectedIndex) ---');
    let countBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords.length);
    await page.keyboard.press('Delete');
    await page.waitForTimeout(150);
    let countAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords.length);
    console.log('count before/after delete:', countBefore, countAfter);
    console.log((countAfter === countBefore - 1) ? 'PASS (Suppr efface bien l'accord OUVERT)' : 'FAIL');

    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
