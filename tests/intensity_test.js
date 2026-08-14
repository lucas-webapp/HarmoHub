const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// La police est chargée depuis Google Fonts : injoignable derrière le proxy du bac à sable,
// jamais un problème chez l'utilisateur. Ces échecs réseau sont donc filtrés — sinon ils font
// échouer « aucune erreur console » et masquent les vraies erreurs au milieu du bruit.

(async () => {
    const browser = await chromium.launch({
        args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const page = await browser.newPage({ viewport: { width: 1400, height: 1400 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (msg) => { if (msg.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|fonts\.googleapis|fonts\.gstatic/.test(msg.text())) errors.push('console.error: ' + msg.text()); });

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);

    console.log('--- computeVelocity: 75% reproduces today\'s EXACT unchanged behavior ---');
    let r = await page.evaluate(() => {
        // held (base=1) : jamais d'aléa, vérifiable exactement
        const held75 = computeVelocity(true, false, 75, null);
        // à 50% et 100%, le multiplicateur doit être exactement 50/75 et 100/75 (borné à 1)
        const held50 = computeVelocity(true, false, 50, null);
        const held100 = computeVelocity(true, false, 100, null);
        const held0 = computeVelocity(true, false, 0, null);
        // undefined -> DEFAULT_INTENSITY (75), donc identique à held75
        const heldDefault = computeVelocity(true, false, undefined, null);
        return { held75, held50, held100, held0, heldDefault };
    });
    console.log(JSON.stringify(r));
    const pass1 = r.held75 === 1 && Math.abs(r.held50 - (50 / 75)) < 1e-9 && r.held100 === 1 && r.held0 === 0 && r.heldDefault === 1;
    console.log(pass1 ? 'PASS (75% = today\'s exact behavior, scaling correct, clamped to 1)' : 'FAIL');

    console.log('--- computeVelocity: a per-step override wins over the chord-wide intensity ---');
    r = await page.evaluate(() => ({
        withOverride: computeVelocity(true, false, 75, 30),
        withoutOverride: computeVelocity(true, false, 75, null),
    }));
    console.log(JSON.stringify(r));
    console.log((Math.abs(r.withOverride - (30 / 75)) < 1e-9 && r.withoutOverride === 1) ? 'PASS (step override takes priority)' : 'FAIL');

    console.log('--- Existing onBeat/offBeat randomization still layered on top (not replaced) ---');
    r = await page.evaluate(() => {
        const samples = Array.from({ length: 30 }, () => computeVelocity(false, true, 75, null));
        const allInRange = samples.every(v => v >= 0.78 && v <= 0.88);
        const varied = new Set(samples).size > 1; // toujours un peu d'aléa
        return { allInRange, varied };
    });
    console.log(JSON.stringify(r));
    console.log((r.allInRange && r.varied) ? 'PASS (onBeat randomization preserved, unscaled at 75%)' : 'FAIL');

    console.log('--- UI: slider defaults to 75, DOM round-trips through save/edit ---');
    await page.evaluate(() => {
        const mk = (root, quality, beats) => ({ root, quality, beats, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' });
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Test', chords: [mk('C', 'maj7', 4)] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);
    r = await page.evaluate(() => document.getElementById('intensity').value);
    console.log('default slider value on a chord with no saved intensity:', r);
    console.log((+r === 75) ? 'PASS (defaults to 75)' : 'FAIL');

    await page.evaluate(() => {
        window.app.editChord(0, 0);
        document.getElementById('intensity').value = '40';
        document.getElementById('intensity').dispatchEvent(new Event('input'));
    });
    await page.waitForTimeout(100);
    await page.evaluate(() => window.app.saveCurrent());
    await page.waitForTimeout(100);
    r = await page.evaluate(() => {
        const sections = JSON.parse(localStorage.getItem('myProgression')).sections;
        return sections[0].chords[0].intensity;
    });
    console.log('saved intensity:', r);
    console.log((r === 40) ? 'PASS (custom intensity persisted)' : 'FAIL');

    await page.evaluate(() => window.app.editChord(0, 0));
    await page.waitForTimeout(100);
    r = await page.evaluate(() => document.getElementById('intensity').value);
    console.log('re-opened chord slider value:', r);
    console.log((+r === 40) ? 'PASS (round-trips back into the slider on re-edit)' : 'FAIL');

    console.log('--- Studio mode: bars appear only on attack steps, drag sets a per-step override ---');
    await page.evaluate(() => {
        // motif net et connu : voix 0 attaque au pas 0 (tenue 4 pas), rien ensuite
        const app = window.app;
        const chord = app.readChord();
        const voices = chord.getSeqMidiNotes().length;
        const steps = chord.beats * 4;
        const pattern = Array.from({ length: steps }, () => []);
        const tie = Array.from({ length: steps }, () => []);
        for (let s = 0; s < 4; s++) { pattern[s].push(0); if (s > 0) tie[s].push(0); }
        app.setLiveSeqPattern(pattern, tie);
        if (!app.seqOpen) app.toggleSequencer();
        document.getElementById('toggle-studio-mode').click();
    });
    await page.waitForTimeout(150);
    r = await page.evaluate(() => Array.from(document.querySelectorAll('.seq-vel-bar')).map(b => +b.dataset.step));
    console.log('bars rendered at steps:', JSON.stringify(r));
    console.log((JSON.stringify(r) === JSON.stringify([0])) ? 'PASS (exactly one bar, at the attack step, none on tied continuations)' : 'FAIL');

    // Glissé simulé : pointerdown près du haut de la barre (haute intensité), vérifie intensityPerStep
    const bar = await page.$('.seq-vel-bar');
    const box = await bar.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + 2);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(50);
    r = await page.evaluate(() => window.app.intensityPerStep[0]);
    console.log('intensityPerStep[0] after drag near the top:', r);
    console.log((r >= 90) ? 'PASS (drag near top sets a high value)' : 'FAIL');

    // Double-clic efface le réglage
    await page.evaluate(() => {
        const bar = document.querySelector('.seq-vel-bar');
        bar.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });
    await page.waitForTimeout(100);
    r = await page.evaluate(() => window.app.intensityPerStep[0]);
    console.log('intensityPerStep[0] after double-click:', r);
    console.log((r === undefined) ? 'PASS (double-click clears the per-step override)' : 'FAIL');

    console.log('--- Toggling studio mode off removes the lane ---');
    await page.evaluate(() => document.getElementById('toggle-studio-mode').click());
    await page.waitForTimeout(100);
    r = await page.evaluate(() => document.querySelectorAll('.seq-vel-bar').length);
    console.log('bars after closing studio mode:', r);
    console.log((r === 0) ? 'PASS (lane removed when studio mode is off)' : 'FAIL');

    console.log('--- MIDI export does not throw with a custom intensity + per-step override set ---');
    await page.evaluate(() => {
        window.app.intensityPerStep = { 0: 20 };
        document.getElementById('intensity').value = '60';
        document.getElementById('intensity').dispatchEvent(new Event('input'));
        window.app.saveCurrent();
    });
    r = await page.evaluate(() => {
        try {
            const bytes = window.app.buildMidiFile();
            return { ok: true, size: bytes.length };
        } catch (e) { return { ok: false, error: e.message }; }
    });
    console.log(JSON.stringify(r));
    console.log((r.ok && r.size > 0) ? 'PASS (MIDI export handles custom intensity without throwing)' : 'FAIL');

    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
