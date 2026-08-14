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
    const page = await browser.newPage({ viewport: { width: 1400, height: 1400 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (msg) => { if (msg.type() === 'error' && !msg.text().includes('CONNECTION') && !msg.text().includes('TUNNEL')) errors.push('console.error: ' + msg.text()); });

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        const mk = (root, quality, beats) => ({ root, quality, beats, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' });
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [
            mk('C', 'maj7', 4), mk('G', 'maj', 4),
        ] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);

    console.log('=== Aucun bouton pipette/copier/coller dans la barre du séquenceur ===');
    await page.evaluate(() => { window.app.editChord(0, 0); if (!window.app.seqOpen) window.app.toggleSequencer(); });
    await page.waitForTimeout(100);
    const noButtons = await page.evaluate(() => !document.getElementById('seq-pipette') && !document.getElementById('seq-copy-pattern') && !document.getElementById('seq-paste-pattern') && !document.getElementById('seq-paintbrush'));
    check(noButtons, 'aucun bouton copier/coller/pinceau/pipette dans la barre du séquenceur');

    // Motif distinctif sur l'accord 0.
    await page.evaluate(() => {
        const app = window.app;
        const chord = app.readChord();
        const steps = chord.beats * 4;
        const pattern = Array.from({ length: steps }, () => []);
        const tie = Array.from({ length: steps }, () => []);
        pattern[0] = [0]; pattern[1] = [0]; pattern[2] = [0]; pattern[3] = [0];
        tie[1] = [0]; tie[2] = [0]; tie[3] = [0];
        app.setLiveSeqPattern(pattern, tie);
        app.intensityPerStep = { 0: 60 };
        app.seqTouched = true;
        app.renderSequencer();
    });

    console.log('=== Ctrl+C avec le séquenceur ouvert copie le MOTIF (pas tout l\'accord) ===');
    await page.keyboard.down('Control');
    await page.keyboard.press('c');
    await page.keyboard.up('Control');
    await page.waitForTimeout(50);
    const clip = await page.evaluate(() => window.app.seqPatternClipboard);
    check(!!clip && clip.pattern[0].includes(0), 'Ctrl+C (séquenceur ouvert) copie le motif rythmique');
    const wholeChordClipboardUntouched = await page.evaluate(() => window.app.clipboard === null || window.app.clipboard === undefined);
    check(wholeChordClipboardUntouched, 'Ctrl+C (séquenceur ouvert) ne touche pas au presse-papier "accord entier"');

    console.log('=== Ouvre l\'accord 1, Ctrl+V colle le motif ===');
    await page.evaluate(() => window.app.editChord(0, 1));
    await page.waitForTimeout(100);
    await page.keyboard.down('Control');
    await page.keyboard.press('v');
    await page.keyboard.up('Control');
    await page.waitForTimeout(100);
    const chord1 = await page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[1]);
    console.log(JSON.stringify({ arpPattern: chord1.arpPattern, intensityPerStep: chord1.intensityPerStep }));
    check(chord1.seqEdited === true && chord1.arpPattern.startsWith('0;0t;0t;0t'), 'Ctrl+V (séquenceur ouvert) colle le motif sur l\'accord 1');
    check(chord1.intensityPerStep && chord1.intensityPerStep['0'] === 60, 'intensité par croche collée aussi via Ctrl+V');

    console.log('=== Séquenceur FERMÉ : Ctrl+C/Ctrl+V retombent sur le comportement grille (accord entier) ===');
    await page.evaluate(() => { if (window.app.seqOpen) window.app.toggleSequencer(); window.app.selectChord(0, 0); });
    await page.waitForTimeout(100);
    await page.keyboard.down('Control');
    await page.keyboard.press('c');
    await page.keyboard.up('Control');
    await page.waitForTimeout(50);
    const wholeClip = await page.evaluate(() => window.app.clipboard);
    check(Array.isArray(wholeClip) && wholeClip.length === 1 && wholeClip[0].root === 'C', 'Ctrl+C séquenceur fermé copie bien tout l\'accord sélectionné (comportement grille inchangé)');

    const beforeCount = await page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords.length);
    await page.keyboard.down('Control');
    await page.keyboard.press('v');
    await page.keyboard.up('Control');
    await page.waitForTimeout(100);
    const afterCount = await page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords.length);
    check(afterCount === beforeCount + 1, 'Ctrl+V séquenceur fermé insère bien une copie de l\'accord entier (comportement grille inchangé)');

    console.log('\n=== Bilan : ' + PASS + ' PASS / ' + FAIL + ' FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
