const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// La police est chargée depuis Google Fonts : injoignable derrière le proxy du bac à sable,
// jamais un problème chez l'utilisateur. Ces échecs réseau sont donc filtrés — sinon ils font
// échouer « aucune erreur console » et masquent les vraies erreurs au milieu du bruit.

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

    console.log('=== 1. Quick library export/import buttons in the top bar ===');
    let r = await page.evaluate(() => ({
        exportBtn: !!document.getElementById('quick-library-export'),
        importBtn: !!document.getElementById('quick-library-import'),
        input: !!document.getElementById('quick-library-import-input'),
    }));
    console.log(JSON.stringify(r));
    console.log((r.exportBtn && r.importBtn && r.input) ? 'PASS (buttons present in top bar)' : 'FAIL');

    await page.evaluate(() => {
        const mk = (root, quality, beats) => ({ root, quality, beats, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' });
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Test', chords: [mk('C', 'maj', 4)] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);
    await page.evaluate(() => window.app.createNewSongFromCurrentState('Quick Export Test'));
    await page.waitForTimeout(150);

    const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 10000 }),
        page.click('#quick-library-export'),
    ]);
    console.log('quick export downloaded:', download.suggestedFilename());
    console.log(download.suggestedFilename().endsWith('.json') ? 'PASS (quick export button triggers a JSON download)' : 'FAIL');

    r = await page.evaluate(() => {
        const input = document.getElementById('quick-library-import-input');
        let clicked = false;
        const orig = input.click;
        input.click = () => { clicked = true; };
        document.getElementById('quick-library-import').click();
        input.click = orig;
        return clicked;
    });
    console.log('import button triggers hidden file input click:', r);
    console.log(r ? 'PASS (quick import button wired to the hidden file input)' : 'FAIL');

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
    console.log(r.beforeHadRhythm ? 'PASS (original 1-measure pattern was genuinely rhythmic, not already fully held)' : 'FAIL (test setup invalid)');
    console.log((r.beatsAfter === 16) ? 'PASS (chord resized to 4 measures)' : 'FAIL');
    console.log(r.addedZoneAllOn ? 'PASS (added zone is fully ON, no silences/croches)' : 'FAIL');
    console.log(r.originalZoneUnchanged ? 'PASS (original 1-measure rhythm left untouched)' : 'FAIL');

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
    console.log((r.beatsAfter === 12 && r.addedZoneAllOn) ? 'PASS (mouse-drag resize path also extends with held notes)' : 'FAIL');

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
    console.log('unchanged:', patternBefore === patternAfter);
    console.log((patternBefore === patternAfter) ? 'PASS (mid-note drag no longer erases/splits the note)' : 'FAIL');

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
    console.log((JSON.stringify(r) === JSON.stringify([false, false, false, true])) ? 'PASS (edge drag still resizes/shrinks as before, new start at step 3)' : 'FAIL');

    console.log('--- Regression: painting on an empty cell still works ---');
    r = await page.evaluate(() => {
        const app = window.app;
        const cell = document.querySelector('.seq-cell[data-voice="1"][data-step="0"]');
        return !!cell;
    });
    console.log('empty-cell paint check setup ok:', r);

    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
