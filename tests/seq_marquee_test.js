const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

(async () => {
    const browser = await chromium.launch({
        args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const page = await browser.newPage({ viewport: { width: 1400, height: 1400 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (msg) => { if (msg.type() === 'error' && !msg.text().includes('CONNECTION') && !msg.text().includes('TUNNEL')) errors.push('console.error: ' + msg.text()); });

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [
            { root: 'C', quality: 'maj7', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
        ] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        window.app.editChord(0, 0);
        if (!window.app.seqOpen) window.app.toggleSequencer();
    });
    await page.waitForTimeout(100);
    // Motif : voix 0 a une note aux pas 2-3, voix 2 a une note aux pas 2-3, voix 1 et 3 restent vides.
    await page.evaluate(() => {
        const app = window.app;
        const chord = app.readChord();
        const steps = chord.beats * 4;
        const pattern = Array.from({ length: steps }, () => []);
        const tie = Array.from({ length: steps }, () => []);
        pattern[2] = [0, 2]; pattern[3] = [0, 2]; tie[3] = [0, 2];
        app.setLiveSeqPattern(pattern, tie);
        app.renderSequencer();
    });
    await page.waitForTimeout(100);

    const cellRect = (voice, step) => page.evaluate(({ voice, step }) => {
        const el = document.querySelector(`.seq-cell[data-voice="${voice}"][data-step="${step}"]`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, { voice, step });

    console.log('=== Glisser SANS Shift sur du vide peint toujours une note (comportement inchangé) ===');
    let src = await cellRect(1, 8);
    let dst = await cellRect(1, 10);
    await page.mouse.move(src.x, src.y);
    await page.mouse.down();
    await page.mouse.move(dst.x, dst.y, { steps: 5 });
    await page.waitForTimeout(50);
    await page.mouse.up();
    await page.waitForTimeout(100);
    let painted = await page.evaluate(() => {
        const app = window.app;
        const chord = app.readChord();
        const { pattern } = app.getLiveSeqPattern(chord);
        return pattern.map(p => p.includes(1));
    });
    console.log(JSON.stringify(painted));
    console.log((painted[8] && painted[9] && painted[10]) ? 'PASS (glissé normal peint toujours une note)' : 'FAIL');
    // Nettoie ce qu'on vient de peindre pour la suite du test.
    await page.evaluate(() => { for (let s = 8; s <= 10; s++) window.app.applySeqCell(1, s, false); window.app.renderSequencer(); });

    console.log('=== Shift+glisser depuis du vide, couvrant les deux notes (voix 0 et 2) : les sélectionne toutes les deux ===');
    src = await cellRect(3, 0); // coin en haut à gauche de la zone (voix la plus basse listée en dernier visuellement, peu importe)
    dst = await cellRect(0, 5); // coin en bas à droite, au-delà des deux notes (pas 2-3 sur voix 0 et 2)
    await page.keyboard.down('Shift');
    await page.mouse.move(src.x, src.y);
    await page.mouse.down();
    await page.mouse.move(dst.x, dst.y, { steps: 8 });
    await page.waitForTimeout(50);
    const rectVisible = await page.evaluate(() => !!document.querySelector('.seq-marquee-rect'));
    const hitsWhileDragging = await page.evaluate(() => Array.from(document.querySelectorAll('.seq-note.marquee-hit')).map(n => n.dataset.voice + ':' + n.dataset.start + '-' + n.dataset.end));
    console.log('rectangle visible:', rectVisible, '| notes en surbrillance:', JSON.stringify(hitsWhileDragging));
    await page.mouse.up();
    await page.keyboard.up('Shift');
    await page.waitForTimeout(100);

    const selections = await page.evaluate(() => window.app.seqSelections.slice().sort((a, b) => a.voice - b.voice));
    console.log('sélection finale:', JSON.stringify(selections));
    console.log(rectVisible ? 'PASS (rectangle visible pendant le glissé)' : 'FAIL');
    console.log((hitsWhileDragging.length === 2) ? 'PASS (les 2 notes en surbrillance pendant le glissé)' : 'FAIL');
    const gotBoth = selections.length === 2 && selections.some(s => s.voice === 0 && s.start === 2 && s.end === 3) && selections.some(s => s.voice === 2 && s.start === 2 && s.end === 3);
    console.log(gotBoth ? 'PASS (les 2 notes sélectionnées après relâchement, sur des voix différentes)' : 'FAIL');

    const rectGone = await page.evaluate(() => !document.querySelector('.seq-marquee-rect'));
    console.log(rectGone ? 'PASS (rectangle retiré après relâchement)' : 'FAIL');

    console.log('=== Suppr sur la sélection obtenue supprime bien les 2 notes ===');
    await page.keyboard.press('Delete');
    await page.waitForTimeout(50);
    const afterDelete = await page.evaluate(() => {
        const app = window.app;
        const chord = app.readChord();
        const { pattern } = app.getLiveSeqPattern(chord);
        return { v0: pattern.map(p => p.includes(0)), v2: pattern.map(p => p.includes(2)) };
    });
    console.log((!afterDelete.v0.some(Boolean) && !afterDelete.v2.some(Boolean)) ? 'PASS (les 2 notes supprimées via la sélection rectangle)' : 'FAIL');

    console.log('=== Rétablit pour la suite : Ctrl+Z ===');
    await page.evaluate(() => window.app.seqUndo());
    await page.waitForTimeout(50);

    console.log('=== Ctrl+Shift+glisser AJOUTE à une sélection existante ===');
    await page.evaluate(() => { window.app.seqSelections = [{ voice: 0, start: 2, end: 3 }]; window.app.renderSequencer(); });
    await page.waitForTimeout(50);
    src = await cellRect(3, 0);
    dst = await cellRect(2, 5);
    await page.keyboard.down('Shift');
    await page.keyboard.down('Control');
    await page.mouse.move(src.x, src.y);
    await page.mouse.down();
    await page.mouse.move(dst.x, dst.y, { steps: 8 });
    await page.waitForTimeout(50);
    await page.mouse.up();
    await page.keyboard.up('Control');
    await page.keyboard.up('Shift');
    await page.waitForTimeout(100);
    const additiveSel = await page.evaluate(() => window.app.seqSelections.slice().sort((a, b) => a.voice - b.voice));
    console.log(JSON.stringify(additiveSel));
    const additiveOk = additiveSel.length === 2 && additiveSel.some(s => s.voice === 0) && additiveSel.some(s => s.voice === 2);
    console.log(additiveOk ? 'PASS (Ctrl+Shift+glisser ajoute à la sélection existante)' : 'FAIL');

    console.log('=== Shift+clic SANS glisser sur du vide : ne peint rien, vide juste la sélection ===');
    await page.evaluate(() => { window.app.seqSelections = [{ voice: 0, start: 2, end: 3 }]; window.app.renderSequencer(); });
    await page.waitForTimeout(50);
    const emptySpot = await cellRect(3, 14);
    await page.keyboard.down('Shift');
    await page.mouse.move(emptySpot.x, emptySpot.y);
    await page.mouse.down();
    await page.mouse.up();
    await page.keyboard.up('Shift');
    await page.waitForTimeout(50);
    const afterTap = await page.evaluate(() => ({ sel: window.app.seqSelections, painted: window.app.getLiveSeqPattern(window.app.readChord()).pattern[14].includes(3) }));
    console.log(JSON.stringify(afterTap));
    console.log((afterTap.sel.length === 0 && !afterTap.painted) ? 'PASS (tap Shift sans glisser : rien peint, sélection vidée)' : 'FAIL');

    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
