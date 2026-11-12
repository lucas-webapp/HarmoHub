// Ce banc s'appelait loupe_and_tap_fix : il éprouvait la LOUPE (la vue plein écran de la grille) et
// le rythme TAPÉ. Les deux ont été retirés — la loupe parce que « les boutons masquer panneau de
// gauche et mode séquenceur grille font tous les deux quasiment pareil », le rythme tapé en entier
// (voir fc7b776). Ce qui restait à éprouver est devenu le sujet du banc, et son nom : dans la grille
// ordinaire, un clic SÉLECTIONNE et un double-clic CHARGE l'accord pour le modifier.
const { retaperNom } = require('./_geste_accord');
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
    page.on('console', (msg) => { if (msg.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|ERR_CERT_AUTHORITY_INVALID|ERR_NAME_NOT_RESOLVED|fonts\.googleapis|fonts\.gstatic/.test(msg.text())) errors.push('console.error: ' + msg.text()); });

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
    // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4a, 12/11) : « Éditeur de notes » (#grid-zoom) a quitté l'ordinateur ; le séquenceur s'ouvre au bloc « Vues »,
    // laisse la grille cliquable, et ne met aucun accord en modification : un clic SÉLECTIONNE (et le séquenceur choisit cet accord), rien de plus.
    console.log('=== 1. Le bouton Séquenceur ouvre le séquenceur sans emporter la grille ===');
    const R = require('./_retrait_ancien');
    const porte = await R.porteAbsente(page);
    console.log(porte.ok ? 'PASS (« Éditeur de notes » a quitté l\'ordinateur, le séquenceur est au bloc « Vues »)' : 'FAIL ' + porte.detail);
    await R.ouvrirNouveau(page);
    let r = await page.evaluate(() => ({
        appMode: window.app.appMode,
        sqOuvert: !document.getElementById('sequenceur').hidden,
        grilleCliquable: !!document.querySelector('.grid-cell[data-index="0"]'),
    }));
    console.log(JSON.stringify(r));
    console.log((r.appMode === 'add' && r.sqOuvert && r.grilleCliquable)
        ? 'PASS (séquenceur ouvert, mode Ajout intact, grille toujours là)' : 'FAIL');

    console.log('=== 2. Un clic sélectionne ; le séquenceur choisit l\'accord, sans modification ===');
    const cell0 = await page.$('.grid-cell[data-index="0"]');
    const box0 = await cell0.boundingBox();
    await page.mouse.click(box0.x + box0.width / 2, box0.y + 8);
    await page.waitForTimeout(300);
    r = await page.evaluate(() => { const n = document.querySelector('#sq-grille .sq-nom.choisi'); return { selectedIndex: window.app.selectedIndex, editingIndex: window.app.editingIndex, appMode: window.app.appMode, choisi: n ? +n.dataset.c : null }; });
    console.log(JSON.stringify(r));
    console.log((r.selectedIndex === 0 && r.editingIndex == null && r.appMode === 'add' && r.choisi === 0)
        ? 'PASS (un clic sélectionne, le séquenceur le choisit, rien ne passe en modification)' : 'FAIL');

    console.log('=== 2 bis. « Réglages du son », dans la bulle, charge bien cet accord pour le modifier ===');
    // LOT 6b : sur ordinateur, le simple clic ouvre la bulle, et c'est d'elle que l'accord se charge dans le panneau (« Réglages du son ») ;
    // le double-clic retape le nom (section 3). Même vérification — accord chargé, séquenceur toujours ouvert dessus — avec le geste d'aujourd'hui.
    const cell1 = await page.$('.grid-cell[data-index="1"]');
    const box1 = await cell1.boundingBox();
    await page.mouse.dblclick(box1.x + box1.width / 2, box1.y + box1.height * 0.85); // point B : le double-clic ouvre la bulle (un clic seul fait entendre l'accord)
    await page.waitForTimeout(250);
    await page.click('#bulle-accord [data-bulle="son"]');
    await page.waitForTimeout(250);
    r = await page.evaluate(() => ({ editingIndex: window.app.editingIndex, appMode: window.app.appMode, sqOuvert: !document.getElementById('sequenceur').hidden }));
    console.log(JSON.stringify(r));
    console.log((r.editingIndex === 1 && r.appMode === 'edit' && r.sqOuvert)
        ? 'PASS (« Réglages du son » : accord chargé, séquenceur toujours ouvert dessus)' : 'FAIL');

    // B2 (12/11), DÉCISION DE L'UTILISATEUR : « double-clic sur le TEXTE du nom = renommer, SANS ouvrir la bulle » (le point B du 11/11 avait donné la bulle au
    // double-clic partout) ; la bulle reste au double-clic sur le reste de la case (section 2 bis), et « Renommer » au clic droit garde son sens.
    // Les deux moitiés du contrat sont éprouvées, avec de vrais gestes.
    console.log('=== 3. Double-clic sur le symbole : la retape du nom, pas la bulle ; « Renommer » retape le nom ===');
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    const cellNow = await page.$('.grid-cell[data-index="1"]');
    const symEl = await cellNow.$('.cell-sym');
    const symBox = await symEl.boundingBox();
    await page.mouse.click(symBox.x + symBox.width / 2, symBox.y + symBox.height / 2);
    await page.waitForTimeout(50);
    await page.mouse.click(symBox.x + symBox.width / 2, symBox.y + symBox.height / 2);
    await page.waitForTimeout(250);
    r = await page.evaluate(() => ({ hasInlineInput: !!document.querySelector('.cell-sym-input'), bulle: !document.getElementById('bulle-accord').hidden }));
    console.log(JSON.stringify(r));
    console.log(!r.bulle && r.hasInlineInput ? 'PASS (double-clic sur le symbole : la retape du nom, sans la bulle de l\'accord)' : 'FAIL');
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    await retaperNom(page, 0, 1, 250);
    r = await page.evaluate(() => ({ hasInlineInput: !!document.querySelector('.cell-sym-input') }));
    console.log(r.hasInlineInput ? 'PASS (« Renommer » au clic droit ouvre la retape du nom)' : 'FAIL');
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
