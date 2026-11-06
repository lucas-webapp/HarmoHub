const { chromium } = require('playwright')
const { ajouterAccord } = require('./_ajout');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));

    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(600);
    // Tempo, groove et métronome vivaient dans l'onglet Config, qui n'existe plus : ils sont dans le
    // bloc « Morceau », replié par défaut. On déplie s'il le faut — #song-summary est une bascule,
    // un clic de trop refermerait.
    const deplieReglages = async () => {
        if (await page.evaluate(() => document.getElementById('song-settings').hidden)) {
            await page.click('#song-summary');
            await page.waitForTimeout(250);
        }
    };

    // Un accord de 4 temps, tempo rond (60 BPM = 1s/temps, calculs faciles).
    await ajouterAccord(page, 'C');
    await page.waitForTimeout(150);

    // LOT 6a : sur ordinateur, la carte Morceau n'est plus affichée — le swing (« groove ») se choisit à la puce au-dessus de la grille, le
    // métronome est dans la barre du bas, et son clic de contretemps dans la fenêtre du tempo. Sur un écran étroit, tout reste dans la carte.
    const bureau = await page.locator('#rr-swing').isVisible();
    if (!bureau) await deplieReglages();
    await page.waitForTimeout(150);

    await page.evaluate(() => {
        const bpm = document.getElementById('bpm');
        bpm.value = '60';
        bpm.dispatchEvent(new Event('input'));
        bpm.dispatchEvent(new Event('change'));
    });
    await page.waitForTimeout(100);

    if (bureau) {
        await page.click('#rr-swing');
        await page.waitForTimeout(150);
        await page.click('#rr-pop [data-rr-valeur="shuffle"]');
    } else {
        await page.selectOption('#groove', 'shuffle');
    }
    await page.waitForTimeout(100);
    check(await page.evaluate(() => document.getElementById('groove').value) === 'shuffle', 'le swing « Shuffle léger » est réglé par le vrai geste');

    // Active métronome pendant la lecture + clic faible sur le contretemps.
    if (!(await page.evaluate(() => window.app.metronomeDuringPlayback))) await page.click(bureau ? '#bl-metro' : '#toggle-metronome');
    await page.waitForTimeout(100);
    const subActive = await page.evaluate(() => document.getElementById('toggle-metronome-subdivision').classList.contains('active'));
    if (!subActive) {
        if (bureau) { await page.click('#bl-tempo'); await page.waitForTimeout(200); }
        await page.click('#toggle-metronome-subdivision');
        if (bureau) { await page.keyboard.press('Escape'); }
    }
    await page.waitForTimeout(100);
    check(await page.evaluate(() => window.app.metronomeDuringPlayback && window.app.metronomeSubdivision), 'métronome et contretemps allumés par leurs vrais boutons');

    // Désactive le décompte pour ne pas polluer le journal capturé.
    await page.click('#open-settings').catch(() => {});
    await page.waitForTimeout(200);
    const countinChecked = await page.evaluate(() => {
        const btn = document.getElementById('toggle-metronome-countin');
        return btn ? btn.getAttribute('aria-checked') === 'true' : null;
    });
    if (countinChecked) await page.click('#toggle-metronome-countin').catch(() => {});
    await page.waitForTimeout(100);
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(100);

    // Intercepte Tone.Transport.schedule : exécute chaque callback SYNCHRONEMENT (temps factice) pour
    // capturer les appels à playMetronomeClick sans dépendre du vrai temps audio qui s'écoule.
    await page.evaluate(() => {
        window.__log = [];
        const orig = app.playMetronomeClick.bind(app);
        app.playMetronomeClick = (accent, t, sub) => { window.__log.push({ accent: !!accent, t, sub: !!sub }); };
        const origSchedule = Tone.Transport.schedule.bind(Tone.Transport);
        Tone.Transport.schedule = (cb, time) => {
            try { cb(time); } catch (e) { /* le reste (audio/dessin) peut échouer hors contexte réel, sans importance ici */ }
            return origSchedule(() => {}, time);
        };
    });

    await page.click('#play-prog');
    await page.waitForTimeout(300);

    const log = await page.evaluate(() => window.__log);
    console.log('journal capturé:', JSON.stringify(log));

    const mainClicks = log.filter(e => !e.sub).sort((a, b) => a.t - b.t);
    const subClicks = log.filter(e => e.sub).sort((a, b) => a.t - b.t);
    check(mainClicks.length >= 1 && subClicks.length >= 1, `au moins un clic principal et un clic faible capturés — obtenu ${mainClicks.length} / ${subClicks.length}`);

    if (mainClicks.length && subClicks.length) {
        const secPerBeat = 1; // 60 BPM
        const beatStart = mainClicks[0].t;
        const subOffset = subClicks[0].t - beatStart;
        const ratio = subOffset / secPerBeat;
        console.log(`décalage du clic faible : ${subOffset.toFixed(4)}s (ratio ${ratio.toFixed(4)}) — attendu ~0.58 (shuffle), PAS 0.5 (droit)`);
        check(Math.abs(ratio - 0.58) < 0.02, `le clic faible du métronome suit bien le groove shuffle (~0.58), pas un milieu de temps fixe (0.5) — obtenu ratio=${ratio.toFixed(4)}`);
    }

    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})();
