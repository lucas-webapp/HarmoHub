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
        const sections = [{ title: 'Couplet', chords: [
            { root: 'C', quality: 'maj', beats: 4, inversion: 0, drop: 0, octave: 4, bass: null, playStyle: 'held' },
        ]}];
        localStorage.setItem('myProgression', JSON.stringify({ sections }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);

    console.log('--- Add an extra note, paint some rhythm, save, reopen: note should persist (baseline) ---');
    let r = await page.evaluate(() => {
        window.app.editChord(0, 0);
        window.app.seqOpen = true;
        window.app.addSequencerNote();
        window.app.applySeqCell(3, 2, true, false); // voice 3 = the new extra note (C maj = 3 voices, extra at index 3)
        window.app.saveCurrent();
        window.app.editChord(0, 0);
        return { extraNotesAfterReopen: window.app.extraNotes.length };
    });
    console.log(JSON.stringify(r), r.extraNotesAfterReopen === 1 ? 'PASS (kept, has rhythm)' : 'FAIL');

    console.log('--- Now erase all its cells, save, reopen: ghost note should be GONE ---');
    r = await page.evaluate(() => {
        window.app.applySeqCell(3, 2, false); // erase the only painted cell for the extra note
        window.app.saveCurrent();
        window.app.editChord(0, 0);
        return {
            extraNotesAfterReopen: window.app.extraNotes.length,
            savedExtraNotes: JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[0].extraNotes,
        };
    });
    console.log(JSON.stringify(r), r.extraNotesAfterReopen === 0 ? 'PASS (ghost removed)' : 'FAIL');

    console.log('--- Two extra notes: keep the 2nd, erase the 1st, check remapping stays correct ---');
    r = await page.evaluate(() => {
        window.app.addSequencerNote(); // extra #0 at voice 3
        window.app.addSequencerNote(); // extra #1 at voice 4
        window.app.applySeqCell(4, 5, true, false); // only the 2nd extra note gets rhythm
        window.app.saveCurrent();
        window.app.editChord(0, 0);
        const chord = window.app.readChord();
        const { pattern } = window.app.getLiveSeqPattern(chord);
        return {
            extraNotesCount: window.app.extraNotes.length,
            // after pruning, the surviving note should now be at voice 3 (extraStart), with its rhythm intact
            voice3HasNote: pattern.some(s => s.includes(3)),
            voice4HasNote: pattern.some(s => s.includes(4)),
        };
    });
    console.log(JSON.stringify(r), (r.extraNotesCount === 1 && r.voice3HasNote && !r.voice4HasNote) ? 'PASS (remapped correctly)' : 'FAIL');

    console.log('Errors collected:', JSON.stringify(errors, null, 2));

    await browser.close();
    process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
