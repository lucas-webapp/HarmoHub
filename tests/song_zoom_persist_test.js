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
    await page.evaluate(() => {
        const mk = (root, quality) => ({ root, quality, beats: 4, inversion: 0, drop: 0, octave: 4, bass: null, playStyle: 'held' });
        localStorage.clear();
        const sections = [{ title: 'Couplet', chords: [mk('C', 'maj'), mk('A', 'min7')] }];
        localStorage.setItem('myProgression', JSON.stringify({ sections }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);

    console.log('--- Change zoom levels, save as a new song ---');
    await page.click('#grid-zoom');
    await page.waitForTimeout(150);
    await page.click('#grid-zoom-in-h'); await page.click('#grid-zoom-in-h'); await page.click('#grid-zoom-in-h');
    await page.click('#grid-zoom-in-v'); await page.click('#grid-zoom-in-v');
    await page.click('#grid-zoom-close');
    await page.waitForTimeout(150);

    let r = await page.evaluate(() => ({ x: window.app.gridZoomLevelX, y: window.app.gridZoomLevelY }));
    console.log('zoom before save:', JSON.stringify(r));

    await page.evaluate(() => {
        window.app.createNewSongFromCurrentState('Test Zoom Song');
    });
    await page.waitForTimeout(150);
    const songId = await page.evaluate(() => localStorage.getItem('harmohubCurrentSongId'));
    console.log('saved song id:', songId);

    let songRecord = await page.evaluate(() => {
        const songs = JSON.parse(localStorage.getItem('harmohubSongs'));
        return songs.find(s => s.name === 'Test Zoom Song');
    });
    console.log('song record zoom fields:', JSON.stringify({
        gridZoomLevelX: songRecord.gridZoomLevelX, gridZoomLevelY: songRecord.gridZoomLevelY,
    }));
    const savedCorrectly = songRecord.gridZoomLevelX === r.x && songRecord.gridZoomLevelY === r.y;
    console.log(savedCorrectly ? 'PASS (zoom saved into song record)' : 'FAIL');

    console.log('--- Simulate "another computer": wipe device-local zoom prefs, keep the song library ---');
    await page.evaluate(() => {
        localStorage.removeItem('harmohubGridZoomLevelX');
        localStorage.removeItem('harmohubGridZoomLevelY');
        localStorage.removeItem('harmohubSeqZoomLevelX');
        localStorage.removeItem('harmohubSeqZoomLevelY');
        localStorage.removeItem('harmohubSeqInlineZoomLevelX');
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);

    r = await page.evaluate(() => ({ x: window.app.gridZoomLevelX, y: window.app.gridZoomLevelY }));
    console.log('zoom after reload (device prefs wiped, song reloaded via currentSongId):', JSON.stringify(r));
    console.log((r.x === songRecord.gridZoomLevelX && r.y === songRecord.gridZoomLevelY) ? 'PASS (restored from song, not device defaults)' : 'FAIL');

    console.log('--- Explicitly load the song via loadSong (simulates picking it from the list on a fresh device) ---');
    await page.evaluate(() => {
        window.app.gridZoomLevelX = 1; window.app.gridZoomLevelY = 1; // reset to defaults first
    });
    await page.evaluate((id) => window.app.loadSong(id), songId);
    await page.waitForTimeout(150);
    r = await page.evaluate(() => ({ x: window.app.gridZoomLevelX, y: window.app.gridZoomLevelY }));
    console.log('zoom after explicit loadSong:', JSON.stringify(r));
    console.log((r.x === songRecord.gridZoomLevelX && r.y === songRecord.gridZoomLevelY) ? 'PASS (loadSong restores zoom)' : 'FAIL');

    console.log('--- A song saved WITHOUT zoom fields (legacy) should default to 1 ---');
    await page.evaluate(() => {
        const songs = JSON.parse(localStorage.getItem('harmohubSongs'));
        const legacy = { id: 'legacy1', name: 'Legacy Song', root: 'C', mode: 'maj', timeSig: '4/4', groove: 'straight', bpm: 120, instrument: 'piano', sections: [{ title: '', chords: [] }] };
        songs.push(legacy);
        localStorage.setItem('harmohubSongs', JSON.stringify(songs));
        window.app.gridZoomLevelX = 1.9; // dirty it first to make sure it actually gets reset
        window.app.loadSong('legacy1');
    });
    await page.waitForTimeout(150);
    r = await page.evaluate(() => ({ x: window.app.gridZoomLevelX, y: window.app.gridZoomLevelY, seqX: window.app.seqZoomLevelX }));
    console.log('legacy song zoom (should all be 1):', JSON.stringify(r));
    console.log((r.x === 1 && r.y === 1 && r.seqX === 1) ? 'PASS (legacy song defaults to 1)' : 'FAIL');

    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
