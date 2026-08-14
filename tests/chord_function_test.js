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
    await page.waitForTimeout(200);

    console.log('=== chordFunction unit checks (key of C major) ===');
    const cases = [
        ['C', 'maj', 'T'],
        ['D', 'min', 'SD'],   // ii
        ['E', 'min', null],   // iii -> zone grise
        ['F', 'maj', 'SD'],   // IV
        ['G', 'maj', 'D'],    // V
        ['G', 'dom7', 'D'],   // V7
        ['A', 'min', null],   // vi -> zone grise
        ['B', 'dim', 'D'],    // vii° (major key) -> dominant substitute
        ['D', 'dom7', 'D'],   // V7/V (secondary dominant, root diatonic but dominant quality)
        ['C', 'dom7', null],  // I7 in blues context: excluded from secondary-dominant, ambiguous -> zone grise
        ['F#', 'dim', null],  // chromatic, not a recognized secondary dominant -> zone grise
        ['A', 'dom7', 'D'],   // V7/ii (A7 resolves to Dm = ii)
    ];
    let allPass = true;
    for (const [root, quality, expected] of cases) {
        const result = await page.evaluate(({ root, quality }) => window.app.chordFunction('C', 'maj', root, quality), { root, quality });
        const pass = result === expected;
        if (!pass) allPass = false;
        console.log(`${root} ${quality} -> ${result} (expected ${expected}) ${pass ? 'PASS' : 'FAIL'}`);
    }
    console.log(allPass ? 'ALL FUNCTION CASES PASS' : 'SOME FAILED');

    console.log('--- Natural minor key: bVII (subtonic) must NOT be labeled Dominante (unlike major vii°) ---');
    let r = await page.evaluate(() => window.app.chordFunction('A', 'min', 'G', 'maj')); // bVII in A minor
    console.log('A minor, G major (bVII):', r);
    console.log(r === null ? 'PASS (bVII in natural minor is grey zone, not falsely labeled D)' : 'FAIL');

    console.log('--- Minor key: i, iv, V(7) still reliably labeled ---');
    r = await page.evaluate(() => ({
        i: window.app.chordFunction('A', 'min', 'A', 'min'),
        iv: window.app.chordFunction('A', 'min', 'D', 'min'),
        V7: window.app.chordFunction('A', 'min', 'E', 'dom7'),
    }));
    console.log(JSON.stringify(r));
    console.log((r.i === 'T' && r.iv === 'SD' && r.V7 === 'D') ? 'PASS' : 'FAIL');

    console.log('=== UI: toggle + grid badge rendering ===');
    await page.evaluate(() => {
        const mk = (root, quality) => ({ root, quality, beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: '', chords: [
            mk('C', 'maj'), mk('A', 'min'), mk('F', 'maj'), mk('G', 'dom7'),
        ] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);
    r = await page.evaluate(() => document.querySelectorAll('.row-function').length);
    console.log('function badges before enabling toggle:', r);
    console.log(r === 0 ? 'PASS (off by default)' : 'FAIL');

    await page.evaluate(() => window.app.setShowChordFunction(true));
    await page.waitForTimeout(150);
    r = await page.evaluate(() => Array.from(document.querySelectorAll('.row-function')).map(el => el.textContent));
    console.log('badges after enabling:', JSON.stringify(r));
    console.log((JSON.stringify(r) === JSON.stringify(['T', '?', 'SD', 'D'])) ? 'PASS (C-Am-F-G7 -> T,?,SD,D)' : 'FAIL');

    console.log('--- Combined with roman numerals: separator appears ---');
    await page.evaluate(() => window.app.setShowRomanNumerals(true));
    await page.waitForTimeout(150);
    r = await page.evaluate(() => document.querySelector('.row-roman').innerHTML);
    console.log('combined row-roman html:', r);
    console.log(r.includes('row-extra-sep') ? 'PASS (roman + function combined with separator)' : 'FAIL');

    console.log('--- PDF export includes function badge ---');
    r = await page.evaluate(() => {
        const { gridInner } = window.app.buildPrintExportHtml();
        const host = document.getElementById('print-export');
        host.innerHTML = gridInner;
        return Array.from(host.querySelectorAll('.print-chord-function')).map(el => el.textContent);
    });
    console.log(JSON.stringify(r));
    console.log((JSON.stringify(r) === JSON.stringify(['T', '?', 'SD', 'D'])) ? 'PASS (PDF shows the same function badges)' : 'FAIL');

    console.log('=== Key-suggest popup: "confirmed" marker ===');
    r = await page.evaluate(() => window.app.suggestSongKey());
    console.log(JSON.stringify(r.slice(0, 2), null, 2));
    console.log(r[0].confirmed !== undefined ? 'PASS (confirmed field present)' : 'FAIL');

    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
})();
