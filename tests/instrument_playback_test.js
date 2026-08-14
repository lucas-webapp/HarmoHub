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
    await page.evaluate(() => {
        const mk = (root, quality, beats, instrument) => ({ root, quality, beats, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held', instrument });
        const sections = [{ title: 'Test', chords: [
            mk('C', 'maj7', 2, 'epiano'),
            mk('D', 'min7', 2, 'pad'),
            mk('E', 'min7', 2, 'strings'),
            mk('F', 'maj', 2, 'organ'),
            mk('G', '7', 2, 'bell'),
        ] }];
        localStorage.setItem('myProgression', JSON.stringify({ sections }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);

    console.log('--- getMasterBus() lazily builds a shared Freeverb+Limiter chain, reused across instruments ---');
    let r = await page.evaluate(() => {
        const bus1 = window.app.getMasterBus();
        const bus2 = window.app.getMasterBus();
        return { sameInstance: bus1 === bus2, isFreeverb: bus1 instanceof Tone.Freeverb };
    });
    console.log(JSON.stringify(r));
    console.log((r.sameInstance && r.isFreeverb) ? 'PASS (shared Freeverb bus, built once)' : 'FAIL');

    console.log('--- Each non-piano instrument builds without throwing, chained through the shared bus ---');
    r = await page.evaluate(() => {
        const out = {};
        for (const key of Object.keys(INSTRUMENT_BANKS)) {
            if (key === 'piano') continue; // échantillons réseau, hors de portée ici (voir note plus bas)
            try {
                const inst = window.app.getInstrument(key);
                out[key] = { ok: true, hasTrigger: typeof inst.triggerAttackRelease === 'function' };
            } catch (e) {
                out[key] = { ok: false, error: e.message };
            }
        }
        return out;
    });
    console.log(JSON.stringify(r));
    const allOk = Object.values(r).every(v => v.ok && v.hasTrigger);
    console.log(allOk ? 'PASS (all 5 synths build cleanly)' : 'FAIL');

    console.log('--- Playing the whole progression (each chord a different instrument) does not throw ---');
    await page.evaluate(() => window.app.createNewSongFromCurrentState('Instrument Test Song'));
    await page.waitForTimeout(150);
    await page.evaluate(() => window.app.playProgression());
    await page.waitForTimeout(3500);
    await page.evaluate(() => window.app.stopAll());
    await page.waitForTimeout(150);

    console.log('Errors:', JSON.stringify(errors));
    const relevantErrors = errors.filter(e => !e.includes('ERR_CONNECTION_RESET') && !e.includes('ERR_TUNNEL_CONNECTION_FAILED') && !e.includes('Failed to load resource'));
    console.log(relevantErrors.length === 0 ? 'PASS (no audio-related console errors during real playback)' : 'FAIL: ' + JSON.stringify(relevantErrors));

    await browser.close();
    process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
