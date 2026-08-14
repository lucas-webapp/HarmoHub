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

    console.log('--- Simple pop progression: C - Am - F - G (I-vi-IV-V), clearly C major ---');
    await page.evaluate(() => {
        const mk = (root, quality, beats) => ({ root, quality, beats: beats || 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: '', chords: [
            mk('C', 'maj'), mk('A', 'min'), mk('F', 'maj'), mk('G', 'maj'),
        ] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);
    let r = await page.evaluate(() => window.app.suggestSongKey());
    console.log(JSON.stringify(r.slice(0, 3), null, 2));
    console.log((r[0].root === 'C' && r[0].mode === 'maj') ? 'PASS' : 'FAIL');

    console.log('--- ii-V-I jazz in Bb: Cm7 - F7 - Bbmaj7, all extended/altered-ish chords ---');
    await page.evaluate(() => {
        const mk = (root, quality, beats) => ({ root, quality, beats: beats || 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: '', chords: [
            mk('C', 'min7'), mk('F', 'dom7'), mk('A#', 'maj7'), mk('A#', 'maj7'),
        ] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);
    r = await page.evaluate(() => window.app.suggestSongKey());
    console.log(JSON.stringify(r.slice(0, 3), null, 2));
    console.log((r[0].root === 'A#' && r[0].mode === 'maj') ? 'PASS (Bb major correctly identified from a ii-V-I)' : 'FAIL');

    console.log('--- Jazz progression with 9ths/13ths and a tritone substitution: Dm9 - Db13 - Cmaj9 (still key of C) ---');
    await page.evaluate(() => {
        const mk = (root, quality, beats) => ({ root, quality, beats: beats || 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: '', chords: [
            mk('D', 'm9'), mk('C#', 'dom13'), mk('C', 'maj9'), mk('C', 'maj9'),
        ] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);
    r = await page.evaluate(() => window.app.suggestSongKey());
    console.log(JSON.stringify(r.slice(0, 3), null, 2));
    console.log((r[0].root === 'C' && r[0].mode === 'maj') ? 'PASS (tritone sub jazz cadence still resolves to C major)' : 'FAIL');

    console.log('--- Minor key: Am - Dm - E7 - Am (i-iv-V7-i, harmonic minor cadence) ---');
    await page.evaluate(() => {
        const mk = (root, quality, beats) => ({ root, quality, beats: beats || 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: '', chords: [
            mk('A', 'min'), mk('D', 'min'), mk('E', 'dom7'), mk('A', 'min'),
        ] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);
    r = await page.evaluate(() => window.app.suggestSongKey());
    console.log(JSON.stringify(r.slice(0, 3), null, 2));
    console.log((r[0].root === 'A' && r[0].mode === 'min') ? 'PASS (minor key with dominant V7 correctly identified)' : 'FAIL');

    console.log('--- Score is an absolute Pearson correlation, not a top-relative percentage ---');
    r = await page.evaluate(() => window.app.suggestSongKey());
    const allInRange = r.every(c => c.score >= -1 && c.score <= 1);
    console.log('scores:', JSON.stringify(r.map(c => c.score)));
    console.log(allInRange ? 'PASS (all scores are valid correlation coefficients)' : 'FAIL');

    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
})();
