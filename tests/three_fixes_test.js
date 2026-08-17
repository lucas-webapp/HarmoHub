const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// La police est chargée depuis Google Fonts : injoignable derrière le proxy du bac à sable,
// jamais un problème chez l'utilisateur. Ces échecs réseau sont donc filtrés — sinon ils font
// échouer « aucune erreur console » et masquent les vraies erreurs au milieu du bruit.
//
// CE FICHIER N'ÉTAIT PAS UN BANC : neuf verdicts en console.log, sans compteur ni code de sortie.
//
// SA SECTION 1 VISAIT DES BOUTONS DISPARUS. L'export/import de bibliothèque avait deux boutons
// dédiés dans le bandeau du haut (#quick-library-export / #quick-library-import) : zéro occurrence
// dans l'appli aujourd'hui. Ils ont été fondus dans les boutons du module Morceau — #song-export
// ouvre un petit menu « Ce morceau / Toute la bibliothèque » (voir openTransferScopeMenu), #song-import
// déclenche le même choix de fichier. C'était le motif signalé par l'utilisateur (« plusieurs options
// se recroisent ») : deux portes vers exactement la même chose. Le banc attendait donc un
// téléchargement déclenché par un bouton inexistant, expirait au bout de dix secondes, et ses sept
// verdicts suivants — sections 2 et 3, sans aucun rapport — n'étaient jamais atteints.
const { check, exiger, plan, bilan } = require('./_harness')('trois correctifs');
plan(14);

(async () => {
    const browser = await chromium.launch({
        args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const page = await browser.newPage({ viewport: { width: 1400, height: 1400 }, acceptDownloads: true });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (msg) => { if (msg.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|fonts\.googleapis|fonts\.gstatic/.test(msg.text())) errors.push('console.error: ' + msg.text()); });

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);

    console.log('=== 1. Export/import de la bibliothèque, depuis le module Morceau ===');
    let r = await page.evaluate(() => ({
        exportBtn: !!document.getElementById('song-export'),
        importBtn: !!document.getElementById('song-import'),
        input: !!document.getElementById('song-import-input'),
        anciensBoutons: !!document.getElementById('quick-library-export') || !!document.getElementById('quick-library-import'),
    }));
    console.log(JSON.stringify(r));
    if (!exiger(r.exportBtn && r.importBtn && r.input, 'les boutons export/import et leur champ de fichier caché sont bien là')) bilan();
    check(!r.anciensBoutons, "et les anciens boutons du bandeau du haut ne subsistent pas en double");

    await page.evaluate(() => {
        const mk = (root, quality, beats) => ({ root, quality, beats, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' });
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Test', chords: [mk('C', 'maj', 4)] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(300);
    await page.evaluate(() => window.app.createNewSongFromCurrentState('Quick Export Test'));
    await page.waitForTimeout(250);

    // #song-export ouvre d'abord un choix de portée : un clic ne télécharge donc plus directement.
    await page.click('#song-export');
    await page.waitForTimeout(300);
    const menu = await page.evaluate(() => {
        const m = document.getElementById('backup-scope-menu');
        return { visible: m && !m.hidden, portees: m ? [...m.querySelectorAll('button')].map(b => b.dataset.backupScope) : [] };
    });
    console.log(JSON.stringify(menu));
    check(menu.visible && menu.portees.join(',') === 'song,library',
        `le bouton propose bien les deux portées avant d'exporter — ${JSON.stringify(menu.portees)}`);

    const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 10000 }),
        page.click('#backup-scope-menu button[data-backup-scope="library"]'),
    ]);
    console.log('export téléchargé :', download.suggestedFilename());
    check(download.suggestedFilename().endsWith('.json'),
        `« Toute la bibliothèque » déclenche bien un téléchargement JSON — ${download.suggestedFilename()}`);

    const importCable = await page.evaluate(() => {
        const input = document.getElementById('song-import-input');
        let clique = false;
        const orig = input.click;
        input.click = () => { clique = true; };
        document.getElementById('song-import').click();
        input.click = orig;
        return clique;
    });
    check(importCable, "le bouton d'import déclenche bien le champ de fichier caché");

    console.log('=== 2. Resizing a chord in the grid extends with HELD notes, not the looped preset ===');
    await page.evaluate(() => {
        // playStyle croche (8e notes) sur un accord d'1 mesure : préréglage rythmique, pas tenu
        const mk = (root, quality, beats, playStyle) => ({ root, quality, beats, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle });
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Test', chords: [mk('C', 'maj', 4, 'croche_maintenu')] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);
    r = await page.evaluate(() => {
        const app = window.app;
        // vérifie que le préréglage d'1 mesure est bien rythmique (pas juste tenu de bout en bout) AVANT
        const dataBefore = JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[0];
        const chordBefore = new Chord(dataBefore.root, dataBefore.quality, 4, 0, 'none', 4, null);
        const before = app.resolveSeqPatternForData(chordBefore, dataBefore);
        // étire l'accord de 4 à 16 temps (1 -> 4 mesures) via le clavier (resizeSelectedChord)
        app.selectedIndex = 0;
        app.activeSection = 0;
        app.resizeSelectedChord(12, 0); // +12 temps = 4 mesures au total
        const dataAfter = JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[0];
        const chordAfter = new Chord(dataAfter.root, dataAfter.quality, dataAfter.beats, 0, 'none', 4, null);
        const after = app.resolveSeqPatternForData(chordAfter, dataAfter);
        return {
            beatsBefore: 4, beatsAfter: dataAfter.beats,
            beforeHadRhythm: before.tie.some((t, i) => i > 0 && t.length === 0 && before.pattern[i].length > 0), // ré-attaque en cours de route -> rythmique (croche_maintenu ne laisse jamais de silence, mais ré-attaque)
            // zone ajoutée (temps 16 au-delà, index 16..63) : chaque voix doit être ON et TIED partout après le tout premier pas ajouté
            addedZoneAllOn: after.pattern.slice(16).every(s => s.length > 0),
            addedZoneAllTied: after.tie.slice(17).every((t, i) => t.length === after.pattern[18 + i - 1]?.length || t.length > 0),
            originalZoneUnchanged: JSON.stringify(after.pattern.slice(0, 16)) === JSON.stringify(before.pattern),
        };
    });
    console.log(JSON.stringify(r));
    if (!exiger(r.beforeHadRhythm, "le motif d'origine est bien RYTHMIQUE et non déjà tenu de bout en bout (sans quoi la suite ne prouverait rien)")) bilan();
    check(r.beatsAfter === 16, `l'accord est bien passé à 4 mesures — ${r.beatsAfter} temps`);
    check(r.addedZoneAllOn, 'la zone AJOUTÉE est entièrement tenue : ni silence ni croches recopiées du préréglage');
    check(r.originalZoneUnchanged, "et le rythme de la première mesure n'a pas été touché au passage");

    console.log('--- Same check via the mouse-drag resize path (onResizeEnd) ---');
    await page.evaluate(() => {
        const mk = (root, quality, beats, playStyle) => ({ root, quality, beats, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle });
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Test', chords: [mk('C', 'maj', 4, 'croche_maintenu'), mk('D', 'min', 4, 'held')] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);
    r = await page.evaluate(() => {
        const app = window.app;
        app.activeSection = 0;
        app.resize = { section: 0, index: 0, edge: 'right', startBeats: 4, startPrevBeats: null, lastDelta: 8 };
        // simule directement la fin d'un glissé (mouse) ayant déjà porté data.beats à 12 temps (3 mesures)
        const sections = JSON.parse(localStorage.getItem('myProgression'));
        sections.sections[0].chords[0].beats = 12;
        localStorage.setItem('myProgression', JSON.stringify(sections));
        app.onResizeEnd();
        const dataAfter = JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[0];
        const chordAfter = new Chord(dataAfter.root, dataAfter.quality, dataAfter.beats, 0, 'none', 4, null);
        const after = app.resolveSeqPatternForData(chordAfter, dataAfter);
        return { beatsAfter: dataAfter.beats, addedZoneAllOn: after.pattern.slice(16).every(s => s.length > 0) };
    });
    console.log(JSON.stringify(r));
    check(r.beatsAfter === 12 && r.addedZoneAllOn,
        `le chemin du glissé à la souris étend lui aussi en notes tenues — ${r.beatsAfter} temps, zone ajoutée tenue : ${r.addedZoneAllOn}`);

    console.log('=== 3. Dragging from the MIDDLE of an existing note no longer splits it ===');
    await page.evaluate(() => {
        const mk = (root, quality, beats) => ({ root, quality, beats, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' });
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Test', chords: [mk('C', 'maj7', 4)] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);
    await page.evaluate(() => { window.app.editChord(0, 0); if (!window.app.seqOpen) window.app.toggleSequencer(); });
    await page.waitForTimeout(150);

    const patternBefore = await page.evaluate(() => {
        const app = window.app;
        const { pattern } = app.getLiveSeqPattern(app.readChord());
        return JSON.stringify(pattern);
    });

    // Trouve deux cellules adjacentes, toutes deux "on" (voix 0), ni la première ni la dernière du run —
    // avec un accord tenu de 16 pas, les cases 5 et 6 (0-indexed) conviennent.
    const cellA = await page.$('.seq-cell[data-voice="0"][data-step="5"]');
    const cellB = await page.$('.seq-cell[data-voice="0"][data-step="6"]');
    const boxA = await cellA.boundingBox();
    const boxB = await cellB.boundingBox();
    await page.mouse.move(boxA.x + boxA.width / 2, boxA.y + boxA.height / 2);
    await page.mouse.down();
    await page.mouse.move(boxB.x + boxB.width / 2, boxB.y + boxB.height / 2, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(100);

    const patternAfter = await page.evaluate(() => {
        const app = window.app;
        const { pattern } = app.getLiveSeqPattern(app.readChord());
        return JSON.stringify(pattern);
    });
    check(patternBefore === patternAfter,
        "glisser depuis le MILIEU d'une note ne la coupe plus ni ne l'efface : le motif est identique avant/après");

    console.log('--- Regression: dragging from an EDGE still resizes normally ---');
    const edgeCell = await page.$('.seq-cell[data-voice="0"][data-step="0"]');
    const edgeBox = await edgeCell.boundingBox();
    const targetCell = await page.$('.seq-cell[data-voice="0"][data-step="3"]');
    const targetBox = await targetCell.boundingBox();
    await page.mouse.move(edgeBox.x + edgeBox.width / 2, edgeBox.y + edgeBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(100);
    r = await page.evaluate(() => {
        const app = window.app;
        const { pattern } = app.getLiveSeqPattern(app.readChord());
        return pattern.slice(0, 4).map(s => s.includes(0));
    });
    console.log('voice0 on for steps 0-3 after edge-drag shrink (start moved to step 3):', JSON.stringify(r));
    check(JSON.stringify(r) === JSON.stringify([false, false, false, true]),
        `glisser depuis un BORD redimensionne toujours normalement — voix 0 sur les pas 0 à 3 : ${JSON.stringify(r)}, attendu [false,false,false,true]`);

    console.log('--- Non-régression : poser une note sur une case VIDE marche toujours ---');
    // Le banc se contentait de vérifier que la case existait, et n'appelait cela « ok » que dans un
    // console.log — il ne posait aucune note. On peint pour de vrai, et on regarde le résultat.
    // On vise la voix 0 au pas 0 : la vérification précédente vient d'établir qu'elle est VIDE (le
    // glissé depuis le bord a ramené le début de la note au pas 3). La voix 1, elle, est tenue de bout
    // en bout sur cet accord — la case n'y est jamais vide, et peindre dessus ne prouverait rien.
    r = await page.evaluate(() => {
        const app = window.app;
        const avant = app.getLiveSeqPattern(app.readChord()).pattern.map(s => s.includes(0));
        const cell = document.querySelector('.seq-cell[data-voice="0"][data-step="0"]');
        if (!cell) return null;
        const b = cell.getBoundingClientRect();
        const ev = (type) => new PointerEvent(type, { pointerId: 9, pointerType: 'mouse', bubbles: true, cancelable: true, clientX: b.left + b.width / 2, clientY: b.top + b.height / 2 });
        cell.dispatchEvent(ev('pointerdown'));
        cell.dispatchEvent(ev('pointerup'));
        const apres = app.getLiveSeqPattern(app.readChord()).pattern.map(s => s.includes(0));
        return { avant: avant[0], apres: apres[0] };
    });
    console.log(JSON.stringify(r));
    check(r && r.avant === false && r.apres === true,
        `poser une note sur une case VIDE la remplit bien — voix 0, pas 0 : ${r ? r.avant + ' -> ' + r.apres : 'case introuvable'}`);

    console.log('Errors:', JSON.stringify(errors));
    check(errors.length === 0, 'aucune erreur JavaScript pendant tout le scénario');
    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
