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
    // Auto-accept any confirm() dialogs (simulates clicking "OK")
    page.on('dialog', async (dialog) => {
        console.log('DIALOG:', dialog.type(), dialog.message());
        await dialog.accept();
    });
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);

    console.log('=== 1. Export a single song directly from the Files panel ===');
    await page.evaluate(() => {
        localStorage.setItem('harmohubSongs', JSON.stringify([
            { id: 's1', name: 'Song A', savedAt: 1, sections: [{ title: '', chords: [{ root: 'C', quality: 'maj', beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' }] }] },
            { id: 's2', name: 'Song B', savedAt: 2, sections: [] },
        ]));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);
    // Le gestionnaire de fichiers a quitté les Paramètres pour sa propre fenêtre (bouton dossier
    // du module Morceau) : c'est elle qu'on ouvre pour atteindre les lignes de morceaux.
    await page.evaluate(() => window.app.openFilesWindow());
    await page.waitForTimeout(150);
    // Plus d'onglets : « Mes morceaux » est rendu en même temps que le reste, en une seule page.
    await page.waitForTimeout(150);
    let r = await page.evaluate(() => Array.from(document.querySelectorAll('.file-row [data-action="export"]')).length);
    console.log('export buttons found:', r);
    console.log(r === 2 ? 'PASS (one export button per song row)' : 'FAIL');

    const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.click('.file-row[data-id="s1"] [data-action="export"]'),
    ]);
    console.log('downloaded filename:', download.suggestedFilename());
    console.log(download.suggestedFilename().includes('Song') ? 'PASS (exported the correct song, no need to open it first)' : 'FAIL');
    r = await page.evaluate(() => document.getElementById('current-chord-display') ? getCurrentSongId ? getCurrentSongId() : null : null);
    r = await page.evaluate(() => (typeof getCurrentSongId === 'function') ? getCurrentSongId() : 'n/a');
    console.log('current song id after export (should stay null, export must not open it):', r);
    console.log((r === null || r === 'n/a') ? 'PASS (exporting did not open/switch the current song)' : 'FAIL');

    console.log('=== 2. Import: songs already present are skipped by default, offered as copies on confirm ===');
    await page.evaluate(() => {
        localStorage.setItem('harmohubSongs', JSON.stringify([
            { id: 's1', name: 'Song A (current)', savedAt: 1, sections: [{ title: '', chords: [{ root: 'C', quality: 'maj', beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' }] }] },
        ]));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);
    // Simulate a backup file containing an OLDER version of s1 (different chords) plus a brand-new song s3
    r = await page.evaluate(async () => {
        const backupPayload = {
            app: 'HarmoHub', kind: 'library-backup', version: 1, exportedAt: Date.now(),
            songs: [
                { id: 's1', name: 'Song A (old backup)', savedAt: 0, sections: [{ title: '', chords: [
                    { root: 'C', quality: 'maj', beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' },
                    { root: 'G', quality: 'dom7', beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' },
                ] }] },
                { id: 's3', name: 'Brand New Song', savedAt: 0, sections: [] },
            ],
        };
        const file = new File([JSON.stringify(backupPayload)], 'backup.json', { type: 'application/json' });
        await window.app.importLibraryFile(file);
        return loadSongs().map(s => ({ id: s.id, name: s.name }));
    });
    console.log(JSON.stringify(r, null, 2));
    const hasNewSong = r.some(s => s.id === 's3');
    const hasRecoveredCopy = r.some(s => s.name.includes('Song A (old backup)') && s.name.includes('import du'));
    const originalUntouched = r.some(s => s.id === 's1' && s.name === 'Song A (current)');
    console.log(hasNewSong ? 'PASS (brand-new song s3 imported normally)' : 'FAIL');
    console.log(hasRecoveredCopy ? 'PASS (old version of s1 recovered as a separate named copy)' : 'FAIL');
    console.log(originalUntouched ? 'PASS (current s1 was never overwritten)' : 'FAIL');
    console.log('total songs now:', r.length, r.length === 3 ? 'PASS (3 total: original + new + recovered copy)' : 'FAIL');

    console.log('--- Declining the confirm: no copy created, original untouched, no duplication ---');
    await page.evaluate(() => {
        localStorage.setItem('harmohubSongs', JSON.stringify([
            { id: 's1', name: 'Song A (current)', savedAt: 1, sections: [] },
        ]));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);
    page.removeAllListeners('dialog');
    page.on('dialog', async (dialog) => { await dialog.dismiss(); }); // decline this time
    r = await page.evaluate(async () => {
        const backupPayload = { app: 'HarmoHub', kind: 'library-backup', version: 1, songs: [
            { id: 's1', name: 'Song A (old backup)', savedAt: 0, sections: [] },
        ] };
        const file = new File([JSON.stringify(backupPayload)], 'backup.json', { type: 'application/json' });
        await window.app.importLibraryFile(file);
        return loadSongs().map(s => ({ id: s.id, name: s.name }));
    });
    console.log(JSON.stringify(r));
    console.log((r.length === 1 && r[0].name === 'Song A (current)') ? 'PASS (declining leaves library untouched, no dupes)' : 'FAIL');

    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
})();
