const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

(async () => {
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => localStorage.removeItem('myProgression'));
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(300);

    check(pageErrors.length === 0, "aucune erreur JS au chargement de la page — " + JSON.stringify(pageErrors));

    // Add a chord and open sequencer
    await page.evaluate(() => { window.app.saveCurrent(); });
    await page.waitForTimeout(150);
    await page.evaluate(() => { window.app.editChord(0, 0); });
    await page.waitForTimeout(150);
    await page.evaluate(() => { window.app.toggleSequencer(); });
    await page.waitForTimeout(200);

    check(await page.isVisible('#seq-play'), "#seq-play visible");
    check(await page.isVisible('#seq-stop'), "#seq-stop visible");
    // LE BOUTON BOUCLE DU SÉQUENCEUR A DISPARU, remplacé par l'anneau du bouton Lecture (même
    // traitement que le transport, façon Pro Tools — retour utilisateur : « c'est brouillon à
    // l'affichage »). Ce point-ci ne servait qu'à s'assurer que le retrait du rythme tapé n'avait pas
    // emporté ses voisins : il vise donc le voisin qui a pris sa place, sinon il ne garde plus rien.
    check(await page.isVisible('#seq-play'), '#seq-play est bien là, et porte désormais la boucle');
    check(await page.evaluate(() => !document.getElementById('seq-loop-play')),
        'le bouton boucle séparé a bien disparu de la barre');
    check(await page.isVisible('#seq-add-note'), "#seq-add-note visible");
    check(await page.isVisible('#seq-row-pipette'), "#seq-row-pipette visible");
    check(await page.$('[data-preset="clear"]') !== null, "bouton Supprimer tout présent");
    check(await page.isVisible('#seq-delete-selection'), "#seq-delete-selection visible");
    check(await page.$('#seq-tap-record') === null, "#seq-tap-record n'existe plus dans le DOM");
    check(await page.$('#seq-tap-zone') === null, "#seq-tap-zone n'existe plus dans le DOM");

    // Check the button order in .seq-presets
    const order = await page.evaluate(() => {
        const row = document.querySelector('.seq-presets');
        return Array.from(row.children).map(el => el.id || el.dataset.preset || el.className).filter(Boolean);
    });
    console.log('Ordre des boutons .seq-presets:', JSON.stringify(order));

    // Open Settings > Son (audio tab)
    await page.evaluate(() => { window.app.settingsOpen = true; document.getElementById('settings-overlay').hidden = false; window.app.renderAudioPanel(); });
    await page.waitForTimeout(150);
    check(await page.$('#tap-latency-offset') === null, "#tap-latency-offset n'existe plus dans le DOM (Paramètres > Son)");
    check(await page.$('#tap-calib-btn') === null, "#tap-calib-btn n'existe plus dans le DOM");
    check(await page.$('#tap-calib-zone') === null, "#tap-calib-zone n'existe plus dans le DOM");

    // Verify tap-tempo (separate, unrelated feature) is untouched
    await page.evaluate(() => { window.app.settingsOpen = false; document.getElementById('settings-overlay').hidden = true; });
    // Le tap tempo a déménagé : il vit dans les réglages du morceau, repliés par défaut depuis
    // qu'ils sont sortis du système d'onglets. Il n'a pas disparu — il faut déplier pour le voir,
    // c'est tout, et c'est bien ce que ce test veut vérifier (« la fonctionnalité voisine est
    // intacte »), pas qu'il soit affiché en permanence.
    if (await page.evaluate(() => document.getElementById('song-settings').hidden)) {
        await page.click('#song-summary');
        await page.waitForTimeout(250);
    }
    check(await page.isVisible('#tap-tempo'), "#tap-tempo (feature séparée, tap tempo pour le BPM) toujours présent");

    // Spacebar no longer does anything tap-recording related; should just play/stop
    await page.evaluate(() => { window.app.stopAll(); });
    await page.keyboard.press('Space');
    await page.waitForTimeout(150);
    check(pageErrors.length === 0, "aucune erreur JS après appui sur Espace (ancien raccourci du rythme tapé) — " + JSON.stringify(pageErrors));

    console.log('\n=== Bilan : ' + PASS + ' PASS / ' + FAIL + ' FAIL ===');
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
