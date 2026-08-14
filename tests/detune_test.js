const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    const r = await page.evaluate(async () => {
        try {
            const synth = new Tone.PluckSynth().toDestination();
            synth.triggerAttack(444.5, 0); // Hz brut au lieu d'un nom de note
            return 'OK: triggerAttack accepte un nombre (Hz) sans lever d\'erreur';
        } catch (e) { return 'ERROR: ' + e.message; }
    });
    console.log(r);
    await browser.close();
})();
