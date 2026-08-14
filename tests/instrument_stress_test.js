const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(300);
    const result = await page.evaluate(async () => {
        const keys = Object.keys(INSTRUMENT_BANKS).filter(k => k !== 'piano');
        const out = {};
        // Accord dense de 6 notes à vélocité MAX (1.0), cas extrême (accord complexe + basse + note libre)
        const notes = ['C3', 'E3', 'G3', 'B3', 'D4', 'F4'];
        for (const key of keys) {
            const buf = await Tone.Offline(async () => {
                const limiter = new Tone.Limiter(-2).toDestination();
                const masterBus = new Tone.Freeverb({ roomSize: 0.55, dampening: 3000, wet: 0.15 }).connect(limiter);
                const inst = INSTRUMENT_BANKS[key].build(masterBus);
                // PAS de `await Tone.loaded()` ici. Ce test écarte volontairement 'piano', le SEUL
                // banc échantillonné : tous les autres sont des synthés, prêts dès leur
                // construction, rien à attendre. Or Tone.loaded() attend TOUS les tampons en cours de
                // chargement, y compris le sampler du piano construit au démarrage de l'appli — dont
                // les échantillons viennent de tonejs.github.io, injoignable derrière le proxy du bac
                // à sable. La promesse était donc rejetée (« Failed to fetch ») avant même qu'une
                // seule note soit rendue. Chez l'utilisateur, ce chargement aboutit ; ici il ne peut
                // pas, et il n'a de toute façon rien à voir avec ce qu'on mesure : la crête d'un
                // accord dense par synthé.
                inst.triggerAttackRelease(notes, 1.2, 0.05, 1.0);
            }, 2.0, 2, 44100);
            const data = buf.get();
            const left = data.getChannelData(0);
            let peak = 0;
            for (let i = 0; i < left.length; i++) { const v = Math.abs(left[i]); if (v > peak) peak = v; }
            out[key] = { peakDb: Math.round(20 * Math.log10(peak || 1e-9) * 10) / 10, clipped: peak >= 0.999 };
        }
        return out;
    });
    console.log(JSON.stringify(result, null, 2));
    await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
