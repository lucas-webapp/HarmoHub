const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// La police est chargée depuis Google Fonts : injoignable derrière le proxy du bac à sable,
// jamais un problème chez l'utilisateur. Ces échecs réseau sont donc filtrés — sinon ils font
// échouer « aucune erreur console » et masquent les vraies erreurs au milieu du bruit.

(async () => {
    const browser = await chromium.launch({
        args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (msg) => { if (msg.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|fonts\.googleapis|fonts\.gstatic/.test(msg.text())) errors.push('console.error: ' + msg.text()); });

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);

    console.log('=== TEST A: UNIFORM existing voices -> new voice should COPY the same pattern ===');
    await page.evaluate(() => {
        // A min, 4 beats (16 steps), voices 0/1/2 all staccato on the beat (steps 0,4,8,12), no ties
        const steps = 16;
        const pattern = Array.from({ length: steps }, (_, s) => (s % 4 === 0) ? [0, 1, 2] : []);
        const tie = pattern.map(() => []);
        const arpPattern = serializeSeqPattern(pattern, tie);
        const sections = [{ title: 'Couplet', chords: [
            { root: 'A', quality: 'min', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held', arpPattern, seqEdited: true, extraNotes: [] },
        ] }];
        localStorage.setItem('myProgression', JSON.stringify({ sections }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);
    await page.evaluate(() => window.app.openSequencerFor(0, 0));
    await page.waitForTimeout(100);

    // change quality min -> min7 (adds the 7th, voice index 3)
    await page.evaluate(() => {
        const sel = document.getElementById('quality');
        sel.value = 'min7';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(150);

    let r = await page.evaluate(() => {
        const { pattern, tie } = parseSeqPattern(document.getElementById('arpPattern').value);
        const voice3On = pattern.map(s => s.includes(3));
        const voice0On = pattern.map(s => s.includes(0));
        const voice3Tie = tie.map(s => s.includes(3));
        const voice0Tie = tie.map(s => s.includes(0));
        return { voice3On, voice0On, voice3Tie, voice0Tie, voices: window.app.readChord().getSeqMidiNotes().length };
    });
    console.log('voices:', r.voices);
    console.log('voice0On:', JSON.stringify(r.voice0On));
    console.log('voice3On:', JSON.stringify(r.voice3On));
    const matchesOn = JSON.stringify(r.voice0On) === JSON.stringify(r.voice3On);
    const matchesTie = JSON.stringify(r.voice0Tie) === JSON.stringify(r.voice3Tie);
    console.log((matchesOn && matchesTie) ? 'PASS (new 7th copies the uniform existing pattern)' : 'FAIL');

    console.log('=== TEST B: DIFFERING existing voices -> new voice should be a FULL HOLD ===');
    await page.evaluate(() => {
        const steps = 16;
        // voice0: staccato on the beat; voice1 & voice2: held throughout (different from voice0)
        const pattern = Array.from({ length: steps }, (_, s) => {
            const v = [];
            if (s % 4 === 0) v.push(0);
            v.push(1, 2);
            return v;
        });
        const tie = pattern.map((v, s) => s === 0 ? [] : [1, 2]);
        const arpPattern = serializeSeqPattern(pattern, tie);
        const sections = [{ title: 'Couplet', chords: [
            { root: 'A', quality: 'min', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held', arpPattern, seqEdited: true, extraNotes: [] },
        ] }];
        localStorage.setItem('myProgression', JSON.stringify({ sections }));
        window.app.closeGridZoom && window.app.closeGridZoom();
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);
    await page.evaluate(() => window.app.openSequencerFor(0, 0));
    await page.waitForTimeout(100);

    await page.evaluate(() => {
        const sel = document.getElementById('quality');
        sel.value = 'min7';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(150);

    r = await page.evaluate(() => {
        const { pattern, tie } = parseSeqPattern(document.getElementById('arpPattern').value);
        const voice3On = pattern.map(s => s.includes(3));
        const voice3Tie = tie.map(s => s.includes(3));
        return { voice3On, voice3Tie };
    });
    console.log('voice3On:', JSON.stringify(r.voice3On));
    console.log('voice3Tie:', JSON.stringify(r.voice3Tie));
    const allOn = r.voice3On.every(Boolean);
    const tieOk = r.voice3Tie[0] === false && r.voice3Tie.slice(1).every(Boolean);
    console.log((allOn && tieOk) ? 'PASS (new 7th held for the full chord duration)' : 'FAIL');

    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
