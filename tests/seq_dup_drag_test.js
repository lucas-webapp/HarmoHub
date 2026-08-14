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
    // Motif propre : voix 0 a une seule note de 4 croches aux pas 2-5 (assez longue pour avoir un
    // vrai "corps" au milieu, distinct de ses deux bords — voir pas 3/4 utilisés comme point de
    // départ du glissé ci-dessous, jamais le tout premier ni le tout dernier pas de la note).
    await page.evaluate(() => {
        const app = window.app;
        const chord = app.readChord();
        const steps = chord.beats * 4;
        const pattern = Array.from({ length: steps }, () => []);
        const tie = Array.from({ length: steps }, () => []);
        pattern[2] = [0]; pattern[3] = [0]; pattern[4] = [0]; pattern[5] = [0];
        tie[3] = [0]; tie[4] = [0]; tie[5] = [0];
        app.setLiveSeqPattern(pattern, tie);
        app.renderSequencer();
    });
    await page.waitForTimeout(100);

    // On vise toujours le centre d'une VRAIE case, jamais le centre géométrique de la barre de note :
    // les cases vont par deux avec 4 px de vide entre les groupes (voir .seq-cell-b/margin-right en
    // CSS), et sur une note de longueur paire ce centre-là tombe pile dans ce vide — l'évènement part
    // alors de .seq-grid, sans case dessous, et le geste ne démarre même pas.
    const cellRect = (voice, step) => page.evaluate(({ voice, step }) => {
        const el = document.querySelector(`.seq-cell[data-voice="${voice}"][data-step="${step}"]`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, { voice, step });
    const patternOfVoice0 = () => page.evaluate(() => {
        const app = window.app;
        const chord = app.readChord();
        const { pattern, tie } = app.getLiveSeqPattern(chord);
        return { on: pattern.map(p => p.includes(0)), tied: tie.map(t => t.includes(0)) };
    });

    console.log('=== Sans Alt : glisser depuis le corps DÉPLACE la note (voir beginSeqHDrag) ===');
    // CONTRAT CHANGÉ depuis l'écriture de ce test : ce geste ne faisait rien à l'époque, il déplace
    // désormais la note dans le temps — c'est le geste de base d'un séquenceur type GarageBand.
    // Point de départ : le pas 3, un vrai pas INTÉRIEUR de la note 2-5 (ni son premier 2, ni son
    // dernier 5) — sinon onSeqPointerDown le lirait comme un bord, donc un étirement.
    let src = await cellRect(0, 3);
    let dst = await cellRect(0, 10);
    await page.mouse.move(src.x, src.y);
    await page.mouse.down();
    await page.mouse.move(dst.x, dst.y, { steps: 5 });
    await page.waitForTimeout(50);
    await page.mouse.up();
    await page.waitForTimeout(100);
    let p = await patternOfVoice0();
    console.log(JSON.stringify(p));
    // delta = 10-3 = 7 : la note 2-5 arrive en 9-12, longueur intacte, et rien ne reste au départ.
    const noAltMoved = p.on[9] && p.on[10] && p.on[11] && p.on[12] && !p.on[2] && !p.on[5]
        && p.on.filter(Boolean).length === 4;
    console.log(noAltMoved ? 'PASS (la note est déplacée, longueur intacte)' : 'FAIL');
    // Remet le motif de départ pour la suite
    await page.evaluate(() => {
        const app = window.app;
        const steps = app.readChord().beats * 4;
        const pattern = Array.from({ length: steps }, () => []);
        const tie = Array.from({ length: steps }, () => []);
        pattern[2] = [0]; pattern[3] = [0]; pattern[4] = [0]; pattern[5] = [0];
        tie[3] = [0]; tie[4] = [0]; tie[5] = [0];
        app.setLiveSeqPattern(pattern, tie);
        app.renderSequencer();
    });
    await page.waitForTimeout(100);

    console.log('=== Avec Alt : glisser depuis le corps duplique la note plus loin, sur la même voix ===');
    const undoBefore = await page.evaluate(() => window.app.seqUndoStack.length);
    src = await cellRect(0, 3);
    dst = await cellRect(0, 10);
    await page.keyboard.down('Alt');
    await page.mouse.move(src.x, src.y);
    await page.mouse.down();
    await page.mouse.move(dst.x, dst.y, { steps: 8 });
    await page.waitForTimeout(50);
    const ghostInfo = await page.evaluate(() => {
        const g = document.querySelector('.seq-note-dup-ghost');
        return g ? { gridColumn: g.style.gridColumn } : null;
    });
    console.log('fantôme pendant le glissé:', JSON.stringify(ghostInfo));
    await page.mouse.up();
    await page.keyboard.up('Alt');
    await page.waitForTimeout(100);

    p = await patternOfVoice0();
    console.log(JSON.stringify(p));
    // L'originale (2-5) doit toujours être là intacte, ET une copie de 4 pas doit être apparue à
    // l'endroit relâché (delta = 10-3 = 7, donc 9-12).
    const origIntact = p.on[2] && p.on[3] && p.on[4] && p.on[5];
    const dupAppeared = p.on[9] && p.on[10] && p.on[11] && p.on[12] && p.tied[10] && p.tied[11] && p.tied[12];
    console.log((origIntact && dupAppeared) ? 'PASS (originale intacte + copie posée plus loin)' : 'FAIL');
    console.log((ghostInfo && ghostInfo.gridColumn) ? 'PASS (fantôme visible et calé sur la grille pendant le glissé)' : 'FAIL');

    const ghostGone = await page.evaluate(() => !document.querySelector('.seq-note-dup-ghost'));
    console.log(ghostGone ? 'PASS (fantôme retiré après dépôt)' : 'FAIL');

    const undoAfter = await page.evaluate(() => window.app.seqUndoStack.length);
    console.log((undoAfter === undoBefore + 1) ? 'PASS (un seul instantané annuler ajouté)' : 'FAIL');

    console.log('=== Annuler (Ctrl+Z du séquenceur) retire la copie, garde l\'originale ===');
    await page.evaluate(() => window.app.seqUndo());
    await page.waitForTimeout(50);
    p = await patternOfVoice0();
    console.log(JSON.stringify(p));
    console.log((p.on[2] && p.on[3] && p.on[4] && p.on[5] && !p.on[9] && !p.on[10]) ? 'PASS (annuler retire bien la copie seule)' : 'FAIL');

    console.log('=== Alt+glisser vers une zone qui chevaucherait l\'originale : ignoré jusqu\'à en ressortir ===');
    src = await cellRect(0, 3);
    const dstNear = await cellRect(0, 4); // delta=1, |1| < len(4) : chevauche l'originale
    await page.keyboard.down('Alt');
    await page.mouse.move(src.x, src.y);
    await page.mouse.down();
    await page.mouse.move(dstNear.x, dstNear.y, { steps: 3 });
    await page.waitForTimeout(50);
    // hDrag (et non plus dupDrag) : déplacement et duplication passent désormais par le même état,
    // distingués par son drapeau `copy` (voir beginSeqHDrag).
    const appliedDeltaMid = await page.evaluate(() => window.app.seqDrag && window.app.seqDrag.hDrag ? window.app.seqDrag.hDrag.appliedDelta : null);
    console.log('delta pendant chevauchement:', appliedDeltaMid);
    console.log((appliedDeltaMid === 0) ? 'PASS (fantôme reste sur place tant que ça chevaucherait l\'originale)' : 'FAIL');
    await page.mouse.up();
    await page.keyboard.up('Alt');
    await page.waitForTimeout(50);
    p = await patternOfVoice0();
    console.log((p.on.filter(Boolean).length === 4) ? 'PASS (rien dupliqué, delta resté à 0)' : 'FAIL');

    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
