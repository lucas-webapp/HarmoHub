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

    console.log('--- Arrow Right: should move editing to chord 2 (F maj7), grid highlight follows ---');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(150);
    let r = await page.evaluate(() => ({
        editingIndex: window.app.editingIndex,
        cell2Editing: document.querySelector('.grid-cell[data-section="0"][data-index="2"]').classList.contains('editing'),
    }));
    console.log(JSON.stringify(r));
    console.log((r.editingIndex === 2 && r.cell2Editing) ? 'PASS (arrow-right moved editing forward in loupe)' : 'FAIL');

    console.log('--- Arrow Left: should move editing back to chord 1 ---');
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(150);
    r = await page.evaluate(() => ({ editingIndex: window.app.editingIndex }));
    console.log(JSON.stringify(r));
    console.log((r.editingIndex === 1) ? 'PASS (arrow-left moved editing back)' : 'FAIL');

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
    console.log((Number(beatsAfter) === Number(beatsBefore) + 1) ? 'PASS (shift+arrow resized the EDITED chord in loupe)' : 'FAIL');

    console.log('--- Letter key "G": should open inline rename with G already typed ---');
    await page.keyboard.press('g');
    await page.waitForTimeout(100);
    r = await page.evaluate(() => {
        const input = document.querySelector('.cell-sym-input');
        return { hasInput: !!input, value: input ? input.value : null };
    });
    console.log(JSON.stringify(r));
    console.log((r.hasInput && r.value.toUpperCase().startsWith('G')) ? 'PASS (letter key opened inline rename in loupe)' : 'FAIL');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);

    console.log('--- Delete: should remove the currently EDITED chord (not a stale selectedIndex) ---');
    let countBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords.length);
    await page.keyboard.press('Delete');
    await page.waitForTimeout(150);
    let countAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords.length);
    console.log('count before/after delete:', countBefore, countAfter);
    console.log((countAfter === countBefore - 1) ? 'PASS (Delete removed the edited chord in loupe)' : 'FAIL');

    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
