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

    console.log('=== 1. Song select grouped by folder (<optgroup>) ===');
    await page.evaluate(() => {
        localStorage.setItem('harmohubSongs', JSON.stringify([
            { id: 's1', name: 'Song A', savedAt: 3, folder: 'Rock', sections: [] },
            { id: 's2', name: 'Song B', savedAt: 4, folder: 'Rock', sections: [] },
            { id: 's3', name: 'Song C', savedAt: 2, folder: 'Jazz', sections: [] },
            { id: 's4', name: 'Song D', savedAt: 1, folder: null, sections: [] },
        ]));
        localStorage.setItem('harmohubFolders', JSON.stringify(['Rock', 'Jazz']));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);
    let r = await page.evaluate(() => {
        const select = document.getElementById('song-select');
        const groups = Array.from(select.querySelectorAll('optgroup')).map(g => ({
            label: g.label,
            options: Array.from(g.querySelectorAll('option')).map(o => o.textContent),
        }));
        return { groups, totalOptions: select.querySelectorAll('option').length };
    });
    console.log(JSON.stringify(r, null, 2));
    const expectGroups = [
        { label: 'Jazz', options: ['Song C'] },
        { label: 'Rock', options: ['Song B', 'Song A'] },
        { label: 'Sans dossier', options: ['Song D'] },
    ];
    console.log(JSON.stringify(r.groups) === JSON.stringify(expectGroups) ? 'PASS (grouped correctly, folders alpha-sorted, songs recent-first)' : 'FAIL');

    console.log('--- No folders at all -> flat list, no optgroup ---');
    await page.evaluate(() => {
        localStorage.setItem('harmohubSongs', JSON.stringify([
            { id: 's1', name: 'Song A', savedAt: 1, folder: null, sections: [] },
        ]));
        localStorage.setItem('harmohubFolders', JSON.stringify([]));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);
    r = await page.evaluate(() => {
        const select = document.getElementById('song-select');
        return { hasOptgroup: !!select.querySelector('optgroup'), optionCount: select.querySelectorAll('option').length };
    });
    console.log(JSON.stringify(r));
    console.log((!r.hasOptgroup && r.optionCount === 2) ? 'PASS (flat list when no folders used)' : 'FAIL');

    console.log('=== 2. MIDI export: single vs per-section prompt ===');
    await page.evaluate(() => {
        const mk = (root, quality, beats) => ({ root, quality, beats, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held', instrument: 'piano', arpPattern: '', seqEdited: false, guitarLock: null, extraNotes: [], intensity: 75, intensityPerStep: {} });
        localStorage.setItem('myProgression', JSON.stringify({ sections: [
            { title: 'Couplet', chords: [mk('C', 'maj', 4)] },
            { title: '', chords: [mk('G', 'maj', 4)] },
        ] }));
        localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 'song1', name: 'MultiSection', savedAt: 1, sections: [
            { title: 'Couplet', chords: [mk('C', 'maj', 4)] },
            { title: '', chords: [mk('G', 'maj', 4)] },
        ] }]));
        localStorage.setItem('harmohubCurrentSongId', 'song1');
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);
    // Trigger exportMidi() manually (avoids dealing with real download dialogs) and check the modal opens
    page.evaluate(() => { window.app.exportMidi(); });
    await page.waitForTimeout(150);
    r = await page.evaluate(() => document.getElementById('midi-export-modal').hidden);
    console.log('modal hidden?', r);
    console.log(!r ? 'PASS (prompt shown for multi-section song)' : 'FAIL');
    // cancel it
    await page.click('#midi-export-cancel');
    await page.waitForTimeout(100);

    console.log('--- Marker fallback name for untitled section (buildMidiFile) ---');
    r = await page.evaluate(() => {
        const bytes = window.app.buildMidiFile();
        // decode as latin1 to find marker text bytes crudely
        let str = '';
        for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
        return { hasCouplet: str.includes('Couplet'), hasPartie2: str.includes('Partie 2') };
    });
    console.log(JSON.stringify(r));
    console.log((r.hasCouplet && r.hasPartie2) ? 'PASS (marker present for titled AND untitled section)' : 'FAIL');

    console.log('--- Single-section song: no prompt, direct export ---');
    await page.evaluate(() => {
        const mk = (root, quality, beats) => ({ root, quality, beats, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held', instrument: 'piano', arpPattern: '', seqEdited: false, guitarLock: null, extraNotes: [], intensity: 75, intensityPerStep: {} });
        localStorage.setItem('myProgression', JSON.stringify({ sections: [
            { title: '', chords: [mk('C', 'maj', 4)] },
        ] }));
        localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 'song2', name: 'SingleSection', savedAt: 1, sections: [
            { title: '', chords: [mk('C', 'maj', 4)] },
        ] }]));
        localStorage.setItem('harmohubCurrentSongId', 'song2');
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);
    let downloadHappened = false;
    page.once('download', () => { downloadHappened = true; });
    await page.evaluate(() => { window.app.exportMidi(); });
    await page.waitForTimeout(200);
    r = await page.evaluate(() => document.getElementById('midi-export-modal').hidden);
    console.log('modal hidden (should stay hidden, no prompt):', r, 'download happened:', downloadHappened);
    console.log((r === true && downloadHappened) ? 'PASS (single section skips the prompt)' : 'FAIL');

    console.log('=== 3. Sequencer: sticky note labels in continuous (loupe grille) mode ===');
    await page.evaluate(() => {
        const mk = (root, quality, beats) => ({ root, quality, beats, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held', instrument: 'piano', arpPattern: '', seqEdited: false, guitarLock: null, extraNotes: [], intensity: 75, intensityPerStep: {} });
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: '', chords: [mk('C', 'maj7', 16), mk('G', 'maj', 4)] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);
    await page.evaluate(() => { window.app.openGridZoom(); window.app.editChordFromGridZoom(0, 0); });
    await page.waitForTimeout(200);
    r = await page.evaluate(() => {
        const label = document.querySelector('.seq-scroll-continuous .seq-label');
        if (!label) return { found: false };
        const cs = getComputedStyle(label);
        return { found: true, position: cs.position, left: cs.left, background: cs.backgroundColor };
    });
    console.log(JSON.stringify(r));
    console.log((r.found && r.position === 'sticky') ? 'PASS (labels sticky in continuous mode)' : 'FAIL');

    console.log('--- Compact (non-continuous) sequencer: labels NOT sticky (nothing to fix) ---');
    await page.evaluate(() => { window.app.closeGridZoom(); });
    await page.waitForTimeout(150);
    await page.evaluate(() => { window.app.editChord(0, 0); if (!window.app.seqOpen) window.app.toggleSequencer(); });
    await page.waitForTimeout(150);
    r = await page.evaluate(() => {
        const label = document.querySelector('.seq-label');
        return label ? getComputedStyle(label).position : null;
    });
    console.log('position:', r);
    console.log((r === 'static') ? 'PASS (compact mode unaffected)' : 'FAIL');

    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
})();
