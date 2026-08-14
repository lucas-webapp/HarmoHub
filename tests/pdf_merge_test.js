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

    console.log('--- SMALL progression (few chords, few voicings): should MERGE onto one page ---');
    await page.evaluate(() => {
        const mk = (root, quality, beats) => ({ root, quality, beats, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' });
        const sections = [{ title: 'Couplet', chords: [mk('F', 'maj', 4), mk('A', 'min7', 4), mk('D', 'min7', 4), mk('E', 'min7', 4)] }];
        localStorage.setItem('myProgression', JSON.stringify({ sections }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);
    // needs a saved song name for exportPdf() to proceed without prompting
    await page.evaluate(() => window.app.createNewSongFromCurrentState('Small Test Song'));
    await page.waitForTimeout(150);

    const [download1] = await Promise.all([
        page.waitForEvent('download', { timeout: 60000 }),
        page.evaluate(() => window.app.exportPdf()),
    ]);
    console.log('download suggested filename:', download1.suggestedFilename());
    let r = await page.evaluate(() => ({
        pageCount: document.getElementById('print-export').querySelectorAll('.print-page').length,
        hasVoicingsTitle: document.getElementById('print-export').innerHTML.includes('Voicings'),
    }));
    console.log(JSON.stringify(r));
    console.log((r.pageCount === 1 && r.hasVoicingsTitle) ? 'PASS (merged onto a single page)' : 'FAIL');

    console.log('--- LARGE progression (many chords/sections): should stay on TWO separate pages ---');
    await page.evaluate(() => {
        const mk = (root, quality, beats) => ({ root, quality, beats, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' });
        const roots = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
        const qualities = ['maj', 'min7', 'maj7', '7', 'min', 'dim'];
        const chords = [];
        for (let i = 0; i < 24; i++) chords.push(mk(roots[i % 7], qualities[i % 6], 4));
        const sections = [
            { title: 'Couplet', chords: chords.slice(0, 12) },
            { title: 'Refrain', chords: chords.slice(12, 24) },
        ];
        localStorage.setItem('myProgression', JSON.stringify({ sections }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);
    await page.evaluate(() => window.app.createNewSongFromCurrentState('Large Test Song'));
    await page.waitForTimeout(150);

    const [download2] = await Promise.all([
        page.waitForEvent('download', { timeout: 60000 }),
        page.evaluate(() => window.app.exportPdf()),
    ]);
    console.log('download suggested filename:', download2.suggestedFilename());
    r = await page.evaluate(() => ({
        pageCount: document.getElementById('print-export').querySelectorAll('.print-page').length,
    }));
    console.log(JSON.stringify(r));
    console.log((r.pageCount === 2) ? 'PASS (kept as two separate pages)' : 'FAIL');

    console.log('--- Voicing badge appears next to chord name on the voicings page ---');
    r = await page.evaluate(() => {
        const labels = Array.from(document.querySelectorAll('.print-piano-label')).map(l => l.innerHTML);
        return labels.slice(0, 3);
    });
    console.log(JSON.stringify(r));
    const hasBadge = r.every(l => l.includes('print-piano-voicing-badge'));
    console.log(hasBadge ? 'PASS (voicing badge present next to chord name)' : 'FAIL');

    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
