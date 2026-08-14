const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

let PASS = 0, FAIL = 0;
function check(cond, label) {
    if (cond) { PASS++; console.log('PASS - ' + label); }
    else { FAIL++; console.log('FAIL - ' + label); }
}

(async () => {
    const browser = await chromium.launch({
        args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
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

    // Ouvre le séquenceur de l'accord (mode Modification)
    await page.evaluate(() => {
        window.app.setMode ? window.app.setMode('modify') : null;
    });
    await page.click('.chord-card, .chord-block, [data-index="0"]').catch(() => {});
    await page.waitForTimeout(100);
    // Ouvre directement via l'API pour rester robuste au DOM exact
    await page.evaluate(() => {
        window.app.activeSection = 0;
        window.app.openSequencerFor ? window.app.openSequencerFor(0, 0) : window.app.editChord(0, 0);
    }).catch(() => {});
    await page.waitForTimeout(150);
    const seqOpen = await page.evaluate(() => window.app.seqOpen);
    console.log('seqOpen after attempt:', seqOpen);

    if (!seqOpen) {
        // Repli : ouvrir via clic réel sur l'accord puis sur "Modifier"
        await page.evaluate(() => {
            window.app.seqOpen = true;
            window.app.editingIndex = 0;
            window.app.activeSection = 0;
            window.app.renderSequencer();
        });
        await page.waitForTimeout(100);
    }

    console.log('=== État initial : motif "held" par défaut, voix 0..2 toutes actives sur toute la durée ===');
    const before = await page.evaluate(() => {
        const chord = window.app.readChord();
        const { pattern, tie } = window.app.getLiveSeqPattern(chord);
        return { steps: pattern.length, voices: chord.getSeqMidiNotes().length, pattern, tie };
    });
    console.log(JSON.stringify(before));

    console.log('=== Sélectionne un motif sur la voix 0 (les 2 premières croches) via selectSeqNoteAt ===');
    await page.evaluate(() => {
        // Motif "held" par défaut = 1 seule note couvrant tout -> on la resélectionne telle quelle
        window.app.selectSeqNoteAt(0, 0, false);
    });
    const sel1 = await page.evaluate(() => window.app.seqSelections);
    console.log(JSON.stringify(sel1));
    check(sel1.length === 1 && sel1[0].voice === 0, 'sélection initiale sur la voix 0 capturée');

    console.log('=== Bouton pipette désactivé sans sélection, activé avec ===');
    const btnDisabledNoSel = await page.evaluate(() => {
        window.app.seqSelections = [];
        window.app.renderSequencer();
        const btn = document.getElementById('seq-row-pipette');
        return btn ? btn.disabled : 'MISSING';
    });
    check(btnDisabledNoSel === true, 'bouton pipette désactivé sans sélection');

    // Re-sélectionne pour la suite du test
    await page.evaluate(() => { window.app.selectSeqNoteAt(0, 0, false); window.app.renderSequencer(); });

    console.log('=== toggleSeqRowPipette arme la pipette avec la sélection courante ===');
    await page.evaluate(() => window.app.toggleSeqRowPipette());
    const armed = await page.evaluate(() => window.app.seqRowPipette);
    console.log(JSON.stringify(armed));
    check(Array.isArray(armed) && armed.length === 1, 'pipette armée avec le motif capturé');

    const hostClass = await page.evaluate(() => document.getElementById('arp-sequencer').classList.contains('seq-row-pipette-active'));
    check(hostClass === true, 'classe CSS seq-row-pipette-active posée sur #arp-sequencer');

    console.log('=== Modifie manuellement voix 1 pour la vider avant de coller (pour vérifier le remplacement) ===');
    await page.evaluate(() => {
        window.app.pushSeqUndo();
        const chord = window.app.readChord();
        const { pattern, tie } = window.app.getLiveSeqPattern(chord);
        for (let s = 0; s < pattern.length; s++) {
            const at = pattern[s].indexOf(1);
            if (at >= 0) pattern[s].splice(at, 1);
            const ti = tie[s].indexOf(1);
            if (ti >= 0) tie[s].splice(ti, 1);
        }
        // Recrée un petit motif différent sur la voix 1 : note isolée à la croche 4 seulement
        pattern[4] = pattern[4] || [];
        pattern[4].push(1);
        window.app.setLiveSeqPattern(pattern, tie);
        window.app.renderSequencer();
    });
    const voice1Before = await page.evaluate(() => {
        const chord = window.app.readChord();
        const { pattern } = window.app.getLiveSeqPattern(chord);
        return pattern.map(s => s.includes(1));
    });
    console.log('voice1 before apply:', JSON.stringify(voice1Before));

    console.log('=== Clique une case de la voix 1 pendant que la pipette est armée : applique le motif dessus ===');
    await page.evaluate(() => {
        const cell = document.querySelector('.seq-cell[data-voice="1"][data-step="0"]');
        cell.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }));
    });
    await page.waitForTimeout(100);
    const afterApply = await page.evaluate(() => {
        const chord = window.app.readChord();
        const { pattern, tie } = window.app.getLiveSeqPattern(chord);
        return { voice0: pattern.map(s => s.includes(0)), voice1: pattern.map(s => s.includes(1)), tie1: tie.map(s => s.includes(1)) };
    });
    console.log(JSON.stringify(afterApply));
    check(JSON.stringify(afterApply.voice1) === JSON.stringify(afterApply.voice0), 'le motif de la voix 0 a bien été appliqué sur la voix 1 (mêmes croches actives)');

    console.log('=== La pipette reste armée après application (pour enchaîner d\'autres lignes) ===');
    const stillArmed = await page.evaluate(() => window.app.seqRowPipette);
    check(Array.isArray(stillArmed), 'pipette toujours armée après un premier collage');

    console.log('=== Échap désarme la pipette ===');
    await page.evaluate(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    });
    await page.waitForTimeout(50);
    const afterEscape = await page.evaluate(() => window.app.seqRowPipette);
    check(afterEscape === null, 'Échap désarme bien la pipette');

    console.log('=== Sans pipette armée, un clic sur une case vide peint normalement (comportement inchangé) ===');
    const voices = await page.evaluate(() => window.app.readChord().getSeqMidiNotes().length);
    console.log('voices:', voices);
    if (voices > 2) {
        const emptyCellCheck = await page.evaluate(() => {
            window.app.pushSeqUndo();
            const chord = window.app.readChord();
            const { pattern, tie } = window.app.getLiveSeqPattern(chord);
            const v = 2;
            for (let s = 0; s < pattern.length; s++) {
                const at = pattern[s].indexOf(v);
                if (at >= 0) pattern[s].splice(at, 1);
            }
            window.app.setLiveSeqPattern(pattern, tie);
            window.app.renderSequencer();
            return true;
        });
        await page.evaluate(() => {
            const cell = document.querySelector('.seq-cell[data-voice="2"][data-step="0"]');
            cell.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, clientX: 10, clientY: 10 }));
            window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
        });
        await page.waitForTimeout(80);
        const paintedNormally = await page.evaluate(() => {
            const chord = window.app.readChord();
            const { pattern } = window.app.getLiveSeqPattern(chord);
            return pattern[0].includes(2);
        });
        check(paintedNormally === true, 'sans pipette armée, un clic peint bien normalement une case vide');
    } else {
        console.log('SKIP - pas assez de voix pour ce test annexe');
    }

    console.log('\n=== Bilan : ' + PASS + ' PASS / ' + FAIL + ' FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
