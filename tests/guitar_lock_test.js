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
        const sections = [{ title: 'Couplet', chords: [mk('F', 'maj7')] }];
        localStorage.setItem('myProgression', JSON.stringify({ sections }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);
    await page.click('#toggle-viz-guitar');
    await page.waitForTimeout(200);
    await page.evaluate(() => window.app.editChord(0, 0));
    await page.waitForTimeout(200);

    // Flèches de doigté + cadenas vivent maintenant dans la fenêtre d'édition manuelle (voir
    // #guitar-edit-btn/openGuitarEditor) : ouverte une fois, elle reste ouverte pour tout ce test
    // (rien d'autre n'est cliqué en dehors de la fenêtre avant le prochain rechargement de page).
    await page.click('#guitar-edit-btn');
    await page.waitForTimeout(150);

    console.log('--- Cycle to a non-default fingering, then lock it ---');
    await page.click('#guitar-next');
    await page.waitForTimeout(100);
    let r = await page.evaluate(() => ({ idx: window.app.guitarFingeringIndex, before: JSON.stringify(window.app.guitarFingerings[window.app.guitarFingeringIndex]) }));
    console.log('fingering before lock:', JSON.stringify(r));
    await page.click('#guitar-lock-btn');
    await page.waitForTimeout(150);
    r = await page.evaluate(() => ({
        locked: !!window.app.guitarLock,
        lockActive: document.getElementById('guitar-lock-btn').classList.contains('active'),
        index: window.app.guitarFingeringIndex,
    }));
    console.log(JSON.stringify(r));
    console.log((r.locked && r.lockActive && r.index === 0) ? 'PASS (locked, shown first)' : 'FAIL');

    console.log('--- Paint a free/passing note in the sequencer: lock must survive ---');
    await page.evaluate(() => window.app.addSequencerNote());
    await page.waitForTimeout(150);
    r = await page.evaluate(() => ({ locked: !!window.app.guitarLock, lockActive: document.getElementById('guitar-lock-btn').classList.contains('active') }));
    console.log(JSON.stringify(r));
    console.log((r.locked && r.lockActive) ? 'PASS (lock survived adding a free note)' : 'FAIL');

    console.log('--- Edit the free note text: lock must still survive ---');
    await page.evaluate(() => window.app.commitExtraNoteLabel(0, 'E3'));
    await page.waitForTimeout(150);
    r = await page.evaluate(() => ({ locked: !!window.app.guitarLock }));
    console.log(JSON.stringify(r));
    console.log(r.locked ? 'PASS (lock survived editing the free note)' : 'FAIL');

    console.log('--- Save the chord: guitarLock must persist into the saved data ---');
    await page.evaluate(() => window.app.saveCurrent());
    await page.waitForTimeout(150);
    r = await page.evaluate(() => {
        const data = JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[0];
        return { savedLock: data.guitarLock };
    });
    console.log(JSON.stringify(r));
    console.log((Array.isArray(r.savedLock)) ? 'PASS (lock persisted to saved chord data)' : 'FAIL');

    console.log('--- Re-open for edit: lock should be restored and shown first ---');
    await page.evaluate(() => window.app.editChord(0, 0));
    await page.waitForTimeout(150);
    r = await page.evaluate(() => ({
        locked: !!window.app.guitarLock,
        index: window.app.guitarFingeringIndex,
        lockActive: document.getElementById('guitar-lock-btn').classList.contains('active'),
    }));
    console.log(JSON.stringify(r));
    console.log((r.locked && r.index === 0 && r.lockActive) ? 'PASS (lock restored on reopen, shown first)' : 'FAIL');

    console.log('--- Manually unlock: should clear it ---');
    await page.click('#guitar-lock-btn');
    await page.waitForTimeout(150);
    r = await page.evaluate(() => ({ locked: !!window.app.guitarLock }));
    console.log(JSON.stringify(r));
    console.log(!r.locked ? 'PASS (manual unlock cleared it)' : 'FAIL');

    console.log('--- Lock again, then actually change the chord quality: should reset ---');
    await page.click('#guitar-lock-btn');
    await page.waitForTimeout(100);
    r = await page.evaluate(() => ({ locked: !!window.app.guitarLock }));
    console.log('locked before quality change:', JSON.stringify(r));
    await page.evaluate(() => {
        const sel = document.getElementById('quality');
        sel.value = 'min7';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(150);
    r = await page.evaluate(() => ({ locked: !!window.app.guitarLock }));
    console.log(JSON.stringify(r));
    console.log(!r.locked ? 'PASS (changing quality reset the lock)' : 'FAIL');

    console.log('--- PDF export path: guitarFingeringsForChord(chord) puts the saved lock first ---');
    await page.evaluate(() => {
        const mk = (root, quality) => ({ root, quality, beats: 4, inversion: 0, drop: 0, octave: 4, bass: null, playStyle: 'held' });
        const sections = [{ title: 'Couplet', chords: [mk('F', 'maj7')] }];
        localStorage.setItem('myProgression', JSON.stringify({ sections }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);
    if (!(await page.evaluate(() => window.app.showGuitarViz()))) await page.click('#toggle-viz-guitar');
    await page.waitForTimeout(200);
    await page.evaluate(() => window.app.editChord(0, 0));
    await page.waitForTimeout(150);
    await page.click('#guitar-edit-btn'); // rechargée : la fenêtre d'édition repart fermée
    await page.waitForTimeout(150);
    await page.click('#guitar-next');
    await page.waitForTimeout(100);
    const lockedShapeKey = await page.evaluate(() => {
        const cur = window.app.guitarFingerings[window.app.guitarFingeringIndex];
        return cur.map(f => f ? f.fret : 'x').join(',');
    });
    await page.click('#guitar-lock-btn');
    await page.waitForTimeout(100);
    await page.evaluate(() => window.app.saveCurrent());
    await page.waitForTimeout(150);
    r = await page.evaluate((expectedKey) => {
        const sections = JSON.parse(localStorage.getItem('myProgression')).sections;
        const data = sections[0].chords[0];
        const chord = new Chord(data.root, data.quality, data.beats, data.inversion, data.drop, data.octave, data.bass, data.guitarLock, data.extraNotes);
        const fingerings = guitarFingeringsForChord(chord);
        const firstKey = fingerings[0].map(f => f ? f.fret : 'x').join(',');
        return { firstKey, expectedKey, match: firstKey === expectedKey };
    }, lockedShapeKey);
    console.log(JSON.stringify(r));
    console.log(r.match ? 'PASS (PDF-path fingering list puts the locked shape first)' : 'FAIL');

    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
