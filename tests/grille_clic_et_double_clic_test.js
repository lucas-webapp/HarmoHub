// Ce banc s'appelait loupe_and_tap_fix : il éprouvait la LOUPE (la vue plein écran de la grille) et
// le rythme TAPÉ. Les deux ont été retirés — la loupe parce que « les boutons masquer panneau de
// gauche et mode séquenceur grille font tous les deux quasiment pareil », le rythme tapé en entier
// (voir fc7b776). Ce qui restait à éprouver est devenu le sujet du banc, et son nom : dans la grille
// ordinaire, un clic SÉLECTIONNE et un double-clic CHARGE l'accord pour le modifier.
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// La police est chargée depuis Google Fonts : injoignable derrière le proxy du bac à sable,
// jamais un problème chez l'utilisateur. Ces échecs réseau sont donc filtrés — sinon ils font
// échouer « aucune erreur console » et masquent les vraies erreurs au milieu du bruit.

(async () => {
    const browser = await chromium.launch({
        args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const page = await browser.newPage({ viewport: { width: 1400, height: 1400 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (msg) => { if (msg.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|fonts\.googleapis|fonts\.gstatic/.test(msg.text())) errors.push('console.error: ' + msg.text()); });

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        const mk = (root, quality, beats) => ({ root, quality, beats, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' });
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [mk('C', 'maj7', 4), mk('D', 'min', 4)] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);

    // #grid-zoom n'ouvre plus une loupe : c'est désormais le bouton « Séq. » au-dessus de la grille
    // (retour utilisateur : « mets ce même bouton au-dessus de la grille à la place du logo qui n'est
    // pas clair, mais moins large »). Il ouvre le séquenceur ET laisse la grille cliquable — c'est
    // justement ce qui rend la suite du banc possible.
    console.log('=== 1. Le bouton Séq. ouvre le séquenceur sans emporter la grille ===');
    await page.click('#grid-zoom');
    await page.waitForTimeout(250);
    let r = await page.evaluate(() => ({
        appMode: window.app.appMode,
        seqOpen: window.app.seqOpen,
        grilleCliquable: !!document.querySelector('.grid-cell[data-index="0"]'),
    }));
    console.log(JSON.stringify(r));
    console.log((r.appMode === 'add' && r.seqOpen && r.grilleCliquable)
        ? 'PASS (séquenceur ouvert, mode Ajout intact, grille toujours là)' : 'FAIL');

    // UN CLIC NE CHARGE PLUS L'ACCORD, ET C'EST VOULU. Le banc exigeait editingIndex === 0 dès le
    // premier clic ; depuis, un clic SÉLECTIONNE (encadré vert) et seul un double-clic ouvre la
    // modification — sans quoi promener la sélection dans la grille rouvrait sans cesse une édition
    // qu'on n'avait pas demandée.
    console.log('=== 2. Un clic sélectionne, sans ouvrir la modification ===');
    const cell0 = await page.$('.grid-cell[data-index="0"]');
    const box0 = await cell0.boundingBox();
    await page.mouse.click(box0.x + box0.width / 2, box0.y + 8);
    await page.waitForTimeout(200);
    r = await page.evaluate(() => ({ selectedIndex: window.app.selectedIndex, editingIndex: window.app.editingIndex, appMode: window.app.appMode }));
    console.log(JSON.stringify(r));
    console.log((r.selectedIndex === 0 && r.editingIndex === null && r.appMode === 'add')
        ? 'PASS (un clic sélectionne et rien de plus)' : 'FAIL');

    console.log('=== 2 bis. Un double-clic charge bien cet accord pour le modifier ===');
    const cell1 = await page.$('.grid-cell[data-index="1"]');
    const box1 = await cell1.boundingBox();
    await page.mouse.dblclick(box1.x + box1.width / 2, box1.y + 8);
    await page.waitForTimeout(250);
    r = await page.evaluate(() => ({ editingIndex: window.app.editingIndex, appMode: window.app.appMode, seqOpen: window.app.seqOpen }));
    console.log(JSON.stringify(r));
    console.log((r.editingIndex === 1 && r.appMode === 'edit' && r.seqOpen)
        ? 'PASS (double-clic : accord chargé, séquenceur toujours ouvert dessus)' : 'FAIL');

    console.log('=== 3. Double-click on the symbol still opens inline rename (unaffected) ===');
    const cellNow = await page.$('.grid-cell[data-index="1"]');
    const symEl = await cellNow.$('.cell-sym');
    const symBox = await symEl.boundingBox();
    await page.mouse.click(symBox.x + symBox.width / 2, symBox.y + symBox.height / 2);
    await page.waitForTimeout(50);
    await page.mouse.click(symBox.x + symBox.width / 2, symBox.y + symBox.height / 2);
    await page.waitForTimeout(150);
    r = await page.evaluate(() => ({ hasInlineInput: !!document.querySelector('.cell-sym-input') }));
    console.log(JSON.stringify(r));
    console.log(r.hasInlineInput ? 'PASS (double-click on symbol still opens inline rename)' : 'FAIL');
    if (r.hasInlineInput) await page.keyboard.press('Escape');
    await page.waitForTimeout(100);

    // BLOC SUPPRIMÉ : « le rythme tapé dans la loupe garde sa session ». Le rythme tapé a été
    // retiré en entier (voir fc7b776) : ni startTapRecording, ni #seq-tap-zone, ni seqTapPhase
    // n'existent plus. Ce que ce test garde — et qui vaut toujours — est au-dessus : la loupe
    // charge bien l'accord cliqué, et le double-clic sur le symbole ouvre toujours la retape.

    console.log('Errors:', JSON.stringify(errors.filter(e => !e.includes('ERR_CONNECTION') && !e.includes('ERR_TUNNEL')), null, 2));
    await browser.close();
    process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
