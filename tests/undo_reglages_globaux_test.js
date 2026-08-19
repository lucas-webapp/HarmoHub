// Retour utilisateur : « mon CTRL+Z ne garde pas toujours en mémoire TOUS mes changements. C'est
// important. Par exemple quand je modifie le séquenceur, le nom des fichiers, le tempo, etc... Je dois
// tout pouvoir reprendre à l'état d'avant lorsque je fais une erreur. »
// Deux défauts distincts trouvés en débogant (voir captureGlobalSnapshot/armGlobalSettingUndo dans
// script.js) :
//   1. Les 5 réglages globaux du morceau (tempo, tonalité, mode, mesure, groove) n'appelaient JAMAIS
//      pushUndo() nulle part — leurs 'change' se contentaient de hasUnsavedChanges + re-rendu. Changer
//      le tempo SANS toucher aux accords ne laissait donc AUCUNE trace dans l'historique.
//   2. Renommer le morceau EN PLACE (bouton crayon #song-rename, PAS la fenêtre Fichiers) appelait bien
//      pushFilesUndo(), mais Ctrl+Z ne lit cet historique QUE fenêtre Fichiers ouverte (voir
//      globalUndo) — hors de cette fenêtre, où vit justement ce bouton, le renommage devenait
//      invisible pour Ctrl+Z.
// Un TROISIÈME défaut, plus subtil, est apparu en testant avec de VRAIS gestes plutôt que des appels
// directs à globalUndo() : le clavier lui-même bloquait Ctrl+Z tant qu'un <select>/curseur gardait le
// focus après le choix (garde-fou `typing`, voir setupKeyboardShortcuts) — même symptôme déjà connu et
// corrigé pour #quick-add-input (voir ajoutRapideVide). Et un clic-glissé RÉEL sur le curseur de tempo
// (pas la poignée, le rail) fait sauter la valeur DÈS le mousedown, avant même l'évènement 'focus' :
// capturer seulement sur 'focus' ratait donc ce premier saut (voir armGlobalSettingUndo/pointerdown).
const { chromium } = require('playwright')
const creerHarnais = require('./_harness');
const { plan, check, bilan } = creerHarnais('Ctrl+Z : réglages globaux (tempo, mesure, groove, tonalité, nom)');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';

(async () => {
    plan(15);
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await page.waitForTimeout(400);
    await page.evaluate(() => {
        const mk = (r, q, b) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 0, octave: 3, bass: null, playStyle: 'held' });
        const song = {
            id: 'test-song-undo-1', name: 'Ma Chanson', bpm: 120, timeSig: '4/4', groove: 'straight',
            sections: [{ title: 'Couplet', chords: [mk('C', 'maj7', 4)] }],
        };
        localStorage.setItem('harmohubSongs', JSON.stringify([song]));
        localStorage.setItem('harmohubCurrentSongId', song.id);
        localStorage.setItem('myProgression', JSON.stringify({ sections: song.sections }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(500);
    await page.click('#song-summary'); // déplie le bloc tempo/mesure/tonalité (masqué par défaut)
    await page.waitForTimeout(300);

    console.log('=== A. Glissé RÉEL de souris sur le tempo, PUIS Ctrl+Z RÉEL au clavier ===');
    const bpmBox = await page.locator('#bpm').boundingBox();
    await page.mouse.move(bpmBox.x + bpmBox.width * 0.2, bpmBox.y + bpmBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(bpmBox.x + bpmBox.width * 0.9, bpmBox.y + bpmBox.height / 2, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(150);
    const bpmAfterDrag = await page.$eval('#bpm', el => el.value);
    check(bpmAfterDrag !== '120', `le glissé a bien changé le tempo — ${bpmAfterDrag}`);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(150);
    const bpmAfterUndo = await page.$eval('#bpm', el => el.value);
    check(bpmAfterUndo === '120', `Ctrl+Z restaure le tempo d'avant le glissé — ${bpmAfterUndo}`);
    const bpmValAfterUndo = await page.$eval('#bpm-val', el => el.value);
    check(bpmValAfterUndo === '120', `le champ numérique du tempo suit la restauration — ${bpmValAfterUndo}`);

    console.log('\n=== B. Sélection RÉELLE (flèches clavier) sur la mesure, PUIS Ctrl+Z RÉEL ===');
    await page.locator('#time-sig').focus();
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(100);
    const sigAfter = await page.$eval('#time-sig', el => el.value);
    check(sigAfter !== '4/4', `la mesure a bien changé — ${sigAfter}`);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(150);
    const sigAfterUndo = await page.$eval('#time-sig', el => el.value);
    check(sigAfterUndo === '4/4', `Ctrl+Z restaure la mesure d'avant — ${sigAfterUndo}`);

    console.log('\n=== C. Groove et mode : deux changements distincts = deux annulations distinctes ===');
    // .focus() explicite avant chaque selectOption() : page.selectOption() seul ne garantit pas que
    // l'élément visé devienne document.activeElement (constaté en déboguant) — sans focus réel, l'arme
    // (armGlobalSettingUndo, posée sur 'pointerdown'/'focus') ne se déclenche jamais.
    await page.locator('#groove').focus();
    await page.selectOption('#groove', 'shuffle');
    await page.waitForTimeout(100);
    await page.locator('#global-mode').focus();
    await page.selectOption('#global-mode', 'min');
    await page.waitForTimeout(100);
    await page.evaluate(() => window.app.globalUndo()); // annule le MODE seulement
    await page.waitForTimeout(150);
    const apres1 = { mode: await page.$eval('#global-mode', el => el.value), groove: await page.$eval('#groove', el => el.value) };
    check(apres1.mode === 'maj' && apres1.groove === 'shuffle',
        `1er Ctrl+Z : le mode revient seul, le groove reste changé — ${JSON.stringify(apres1)}`);
    await page.evaluate(() => window.app.globalUndo()); // annule le GROOVE
    await page.waitForTimeout(150);
    const apres2 = await page.$eval('#groove', el => el.value);
    check(apres2 === 'straight', `2e Ctrl+Z : le groove revient aussi — ${apres2}`);

    console.log('\n=== D. Renommer EN PLACE (bouton crayon), PUIS Ctrl+Z SANS ouvrir la fenêtre Fichiers ===');
    const nameBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('harmohubSongs'))[0].name);
    await page.evaluate(() => window.app.startInlineRenameSongMain());
    await page.waitForTimeout(150);
    // Sélecteur SANS id : deux autres champs partagent la classe .inline-rename-input (la modale
    // « changements non enregistrés » et la fenêtre Fichiers, tous deux masqués ici) — seul celui créé
    // par startInlineRenameSongMain(), inséré juste après #song-select, n'a pas d'id.
    const champRenommage = 'input.inline-rename-input:not([id])';
    await page.fill(champRenommage, 'Nouveau Nom');
    await page.locator(champRenommage).blur();
    await page.waitForTimeout(150);
    const nameAfterRename = await page.evaluate(() => JSON.parse(localStorage.getItem('harmohubSongs'))[0].name);
    check(nameAfterRename === 'Nouveau Nom', `le renommage EN PLACE a bien pris — ${nameAfterRename}`);
    const filesOpen = await page.evaluate(() => window.app.filesOpen);
    check(!filesOpen, 'la fenêtre Fichiers est toujours FERMÉE au moment du Ctrl+Z (le point du test)');
    await page.evaluate(() => window.app.globalUndo());
    await page.waitForTimeout(150);
    const nameAfterUndo = await page.evaluate(() => JSON.parse(localStorage.getItem('harmohubSongs'))[0].name);
    check(nameAfterUndo === nameBefore, `Ctrl+Z restaure le nom — ${nameAfterUndo} (attendu ${nameBefore})`);
    const songSelectText = await page.$eval('#song-select', el => el.options[el.selectedIndex] ? el.options[el.selectedIndex].textContent : null);
    check(songSelectText && songSelectText.includes(nameBefore), `l'affichage du sélecteur suit aussi — ${songSelectText}`);

    console.log('\n=== E. Non-régression : ajouter un accord (grille) reste annulable comme avant ===');
    const countBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords.length);
    await page.evaluate(() => window.app.addChordFromSymbol(0, 'Dm7'));
    await page.waitForTimeout(150);
    const countAfterAdd = await page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords.length);
    check(countAfterAdd === countBefore + 1, `l'accord a bien été ajouté — ${countAfterAdd}`);
    await page.evaluate(() => window.app.globalUndo());
    await page.waitForTimeout(150);
    const countAfterUndo = await page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords.length);
    check(countAfterUndo === countBefore, `Ctrl+Z retire bien l'accord ajouté, comme avant ce correctif — ${countAfterUndo}`);

    console.log('\n=== F. Non-régression : #quick-add-input garde son exception (texte vide -> Ctrl+Z passe) ===');
    await page.fill('#quick-add-input', '');
    await page.locator('#quick-add-input').focus();
    const countBeforeF = await page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords.length);
    await page.evaluate(() => { window.app.addChordFromSymbol(0, 'Am'); });
    await page.waitForTimeout(150);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(150);
    const countAfterF = await page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords.length);
    check(countAfterF === countBeforeF, `Ctrl+Z depuis le champ Ajout rapide VIDE fonctionne toujours — ${countAfterF}`);

    check(errors.length === 0, 'aucune erreur JavaScript' + (errors.length ? ' — ' + errors[0] : ''));

    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
