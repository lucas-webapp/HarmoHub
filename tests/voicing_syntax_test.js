const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// La police est chargée depuis Google Fonts : injoignable derrière le proxy du bac à sable,
// jamais un problème chez l'utilisateur. Ces échecs réseau sont donc filtrés — sinon ils font
// échouer « aucune erreur console » et masquent les vraies erreurs au milieu du bruit.
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (msg) => { if (msg.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|fonts\.googleapis|fonts\.gstatic/.test(msg.text())) errors.push('console.error: ' + msg.text()); });
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(300);

    console.log('--- parseChordSymbol unit checks ---');
    const cases = [
        ['C', { root: 'C', quality: 'maj', bass: null, octave: null, inversion: null, drop: null }],
        ['CM', { root: 'C', quality: 'maj', bass: null, octave: null, inversion: null, drop: null }],
        ['Cmaj', { root: 'C', quality: 'maj', bass: null, octave: null, inversion: null, drop: null }],
        ['C_O4-R1-D2', { root: 'C', quality: 'maj', bass: null, octave: 4, inversion: 1, drop: 'drop2' }],
        ['C_o4r1d2', { root: 'C', quality: 'maj', bass: null, octave: 4, inversion: 1, drop: 'drop2' }],
        ['C_D2', { root: 'C', quality: 'maj', bass: null, octave: null, inversion: null, drop: 'drop2' }],
        ['C_E', { root: 'C', quality: 'maj', bass: 'E', octave: null, inversion: null, drop: null }],
        ['C_E_O4-D2', { root: 'C', quality: 'maj', bass: 'E', octave: 4, inversion: null, drop: 'drop2' }],
        ['Cm7_D3', { root: 'C', quality: 'min7', bass: null, octave: null, inversion: null, drop: 'drop3' }],
        ['C_O9', null], // octave out of range
        ['C_R5', null], // inversion out of range
        ['C_D5', null], // invalid drop
        ['C_X', null], // nonsense token
        ['C_', null], // empty modifier block
    ];
    let allPass = true;
    for (const [input, expected] of cases) {
        const result = await page.evaluate((i) => parseChordSymbol(i), input);
        const pass = JSON.stringify(result) === JSON.stringify(expected);
        if (!pass) allPass = false;
        console.log(`${input} -> ${JSON.stringify(result)} ${pass ? 'PASS' : 'FAIL (expected ' + JSON.stringify(expected) + ')'}`);
    }
    console.log(allPass ? 'ALL PARSE CASES PASS' : 'SOME PARSE CASES FAILED');

    console.log('--- Quick-add: C_O4-R1-D2 creates a chord with that exact voicing ---');
    await page.fill('#quick-add-input', 'C_O4-R1-D2');
    await page.click('#quick-add-btn');
    await page.waitForTimeout(150);
    let r = await page.evaluate(() => {
        const sections = loadProgressionSections();
        const c = sections[0].chords[sections[0].chords.length - 1];
        return { root: c.root, quality: c.quality, octave: c.octave, inversion: c.inversion, drop: c.drop, bass: c.bass };
    });
    console.log(JSON.stringify(r));
    console.log((r.octave === 4 && r.inversion === 1 && r.drop === 'drop2' && r.bass === null) ? 'PASS' : 'FAIL');

    console.log('--- Quick-add: C_D2 only sets drop, octave/inversion stay default ---');
    await page.fill('#quick-add-input', 'C_D2');
    await page.click('#quick-add-btn');
    await page.waitForTimeout(150);
    r = await page.evaluate(() => {
        const sections = loadProgressionSections();
        const c = sections[0].chords[sections[0].chords.length - 1];
        return { octave: c.octave, inversion: c.inversion, drop: c.drop };
    });
    console.log(JSON.stringify(r));
    console.log((r.octave === 3 && r.inversion === 0 && r.drop === 'drop2') ? 'PASS' : 'FAIL');

    console.log('--- Grid inline edit (startInlineChordSymbolEdit): retyping bare "C" RESETS voicing to default ---');
    // chord at index 0 (from a prior test run it's whatever was first added); let's reset the song and build a clean chord with custom voicing first
    await page.evaluate(() => {
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: '', chords: [
            { root: 'C', quality: 'maj7', beats: 4, inversion: 2, drop: 'drop2', octave: 4, bass: 'E', playStyle: 'held', instrument: 'piano', arpPattern: '', seqEdited: false, guitarLock: null, extraNotes: [], intensity: 75, intensityPerStep: {} },
        ] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(300);
    await page.evaluate(() => window.app.startInlineChordSymbolEdit(0, 0, null, null));
    await page.waitForTimeout(100);
    let prefill = await page.evaluate(() => document.querySelector('.cell-sym-input').value);
    console.log('prefill value (should include current voicing via _):', prefill);
    // now retype bare "C" (select-all is active, so typing replaces) and commit
    await page.keyboard.type('C');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    r = await page.evaluate(() => {
        const sections = loadProgressionSections();
        const c = sections[0].chords[0];
        return { root: c.root, quality: c.quality, octave: c.octave, inversion: c.inversion, drop: c.drop, bass: c.bass };
    });
    console.log('after retyping bare C:', JSON.stringify(r));
    console.log((r.octave === 3 && r.inversion === 0 && r.drop === 'none' && r.bass === null && r.quality === 'maj') ? 'PASS (reset to default voicing)' : 'FAIL');

    console.log('--- Grid inline edit: retyping the SAME prefill (unchanged) preserves the voicing ---');
    await page.evaluate(() => {
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: '', chords: [
            { root: 'C', quality: 'maj7', beats: 4, inversion: 2, drop: 'drop2', octave: 4, bass: 'E', playStyle: 'held', instrument: 'piano', arpPattern: '', seqEdited: false, guitarLock: null, extraNotes: [], intensity: 75, intensityPerStep: {} },
        ] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(300);
    await page.evaluate(() => window.app.startInlineChordSymbolEdit(0, 0, null, null));
    await page.waitForTimeout(100);
    prefill = await page.evaluate(() => document.querySelector('.cell-sym-input').value);
    console.log('prefill:', prefill);
    await page.keyboard.press('Enter'); // commit unchanged prefill
    await page.waitForTimeout(150);
    r = await page.evaluate(() => {
        const sections = loadProgressionSections();
        const c = sections[0].chords[0];
        return { octave: c.octave, inversion: c.inversion, drop: c.drop, bass: c.bass };
    });
    console.log('after re-committing unchanged prefill:', JSON.stringify(r));
    console.log((r.octave === 4 && r.inversion === 2 && r.drop === 'drop2' && r.bass === 'E') ? 'PASS (voicing preserved via visible _ suffix)' : 'FAIL');

    console.log('--- Grid inline edit: partial edit C_D3 (from the same chord) only changes drop ---');
    await page.evaluate(() => window.app.startInlineChordSymbolEdit(0, 0, null, null));
    await page.waitForTimeout(100);
    await page.keyboard.type('C_D3'); // select-all active, replaces prefill entirely
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    r = await page.evaluate(() => {
        const sections = loadProgressionSections();
        const c = sections[0].chords[0];
        return { octave: c.octave, inversion: c.inversion, drop: c.drop, bass: c.bass };
    });
    console.log(JSON.stringify(r));
    console.log((r.octave === 3 && r.inversion === 0 && r.drop === 'drop3' && r.bass === null) ? 'PASS' : 'FAIL');

    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
})();
