const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// La police est chargée depuis Google Fonts : injoignable derrière le proxy du bac à sable,
// jamais un problème chez l'utilisateur. Ces échecs réseau sont donc filtrés — sinon ils font
// échouer « aucune erreur console » et masquent les vraies erreurs au milieu du bruit.

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
    page.on('console', (msg) => { if (msg.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|fonts\.googleapis|fonts\.gstatic/.test(msg.text())) errors.push('console.error: ' + msg.text()); });

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
        window.app.seqOpen = true;
        window.app.editingIndex = 0;
        window.app.activeSection = 0;
        window.app.renderSequencer();
    });
    await page.waitForTimeout(100);

    console.log('=== Prépare : voix 0 = petit motif au milieu (croches 4-5 seulement), voix 1 = du son partout ailleurs ===');
    await page.evaluate(() => {
        window.app.pushSeqUndo();
        const chord = window.app.readChord();
        const { pattern, tie } = window.app.getLiveSeqPattern(chord);
        // Vide tout, puis pose un petit motif isolé sur la voix 0 aux croches 4-5
        for (let s = 0; s < pattern.length; s++) {
            [0, 1].forEach(v => {
                const at = pattern[s].indexOf(v);
                if (at >= 0) pattern[s].splice(at, 1);
                const ti = tie[s].indexOf(v);
                if (ti >= 0) tie[s].splice(ti, 1);
            });
        }
        pattern[4] = pattern[4] || []; pattern[4].push(0);
        pattern[5] = pattern[5] || []; pattern[5].push(0); tie[5] = tie[5] || []; tie[5].push(0);
        // La voix 1 (la ligne CIBLE) a du son AVANT (croches 0-1) et APRÈS (croches 10-11) la plage du motif
        pattern[0] = pattern[0] || []; pattern[0].push(1);
        pattern[1] = pattern[1] || []; pattern[1].push(1); tie[1] = tie[1] || []; tie[1].push(1);
        pattern[10] = pattern[10] || []; pattern[10].push(1);
        pattern[11] = pattern[11] || []; pattern[11].push(1); tie[11] = tie[11] || []; tie[11].push(1);
        window.app.setLiveSeqPattern(pattern, tie);
        window.app.seqTouched = true;
        window.app.renderSequencer();
    });
    const before = await page.evaluate(() => {
        const chord = window.app.readChord();
        const { pattern } = window.app.getLiveSeqPattern(chord);
        return { voice0: pattern.map(s => s.includes(0)), voice1: pattern.map(s => s.includes(1)) };
    });
    console.log('voice0 before:', JSON.stringify(before.voice0));
    console.log('voice1 before:', JSON.stringify(before.voice1));
    check(before.voice1[0] === true && before.voice1[10] === true, 'préparation ok : la voix cible a bien du son avant et après le motif à venir');

    console.log('=== Sélectionne le motif de la voix 0 (croches 4-5), l\'arme, puis l\'applique sur la voix 1 ===');
    await page.evaluate(() => {
        window.app.selectSeqNoteAt(0, 4, false);
        window.app.toggleSeqRowPipette();
    });
    const armed = await page.evaluate(() => window.app.seqRowPipette);
    check(JSON.stringify(armed) === JSON.stringify([{ start: 4, end: 5 }]), 'motif prélevé correspond bien à la plage 4-5');

    await page.evaluate(() => {
        const cell = document.querySelector('.seq-cell[data-voice="1"][data-step="0"]');
        cell.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }));
    });
    await page.waitForTimeout(80);

    const after = await page.evaluate(() => {
        const chord = window.app.readChord();
        const { pattern, tie } = window.app.getLiveSeqPattern(chord);
        return { voice1: pattern.map(s => s.includes(1)), tie1: tie.map(s => s.includes(1)) };
    });
    console.log('voice1 after:', JSON.stringify(after.voice1));

    check(after.voice1[0] === false && after.voice1[1] === false, "les croches AVANT le motif (0-1) sur la ligne cible ont bien été effacées");
    check(after.voice1[10] === false && after.voice1[11] === false, "les croches APRÈS le motif (10-11) sur la ligne cible ont bien été effacées");
    check(after.voice1[4] === true && after.voice1[5] === true, "le motif collé (4-5) est bien présent sur la ligne cible");
    check(after.tie1[5] === true, "la liaison du motif collé est bien reproduite");
    const totalOn = after.voice1.filter(Boolean).length;
    check(totalOn === 2, "plus AUCUNE autre croche que le motif collé ne reste allumée sur la ligne cible (total=" + totalOn + ")");

    console.log('\n=== Bilan : ' + PASS + ' PASS / ' + FAIL + ' FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
