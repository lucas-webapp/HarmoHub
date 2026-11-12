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
    // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4b, 12/11) : le petit séquenceur de l'inspecteur, dont la barre portait l'ancien rythme tapé et ses voisins
    // (#seq-play, #seq-stop, #seq-add-note, #seq-row-pipette, « Supprimer tout », #seq-delete-selection), a quitté l'ordinateur. Le séquenceur du bloc « Vues » n'a pas
    // de lecture propre (la barre de lecture de l'appli joue) ; ce que ce point gardait — le retrait du rythme tapé n'a pas emporté ses voisins — se vérifie sur SA barre.
    const R = require('./_retrait_ancien');
    const ouvert = await R.ouvrirNouveau(page);
    check(ouvert.ok, `le séquenceur du bloc « Vues » s'ouvre par son bouton (${ouvert.detail})`);
    for (const [sel, nom] of [['#sq-effacer', 'Effacer'], ['#sq-copier', 'Copier'], ['#sq-coller', 'Coller'], ['#sq-intensite', 'Intensité'], ['#sequenceur .sq-libre-btn', 'Notes libres'], ['#sq-motif-monte', 'motif Arpège ↑']]) {
        check(await page.isVisible(sel), `${nom} est dans la barre du séquenceur (${sel})`);
    }
    check(await page.evaluate(() => !document.getElementById('seq-play') || document.getElementById('seq-play').offsetParent === null), 'pas de lecture propre au séquenceur : la barre de lecture de l\'appli joue');
    check(await page.$('#seq-tap-record') === null, "#seq-tap-record n'existe plus dans le DOM");
    check(await page.$('#seq-tap-zone') === null, "#seq-tap-zone n'existe plus dans le DOM");
    await R.cliquer(page, '#vue-sequenceur', 300);

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
    // LOT 6a : sur ordinateur, la carte Morceau n'est plus affichée ; le tap tempo y est celui de la barre du bas (lot 2), dans la fenêtre du tempo.
    if (await page.locator('#bl-tempo').isVisible()) {
        await page.click('#bl-tempo');
        await page.waitForTimeout(250);
        check(await page.isVisible('#bl-tap'), "le tap tempo (feature séparée, tap tempo pour le BPM) toujours présent — barre du bas");
        await page.keyboard.press('Escape');
        await page.waitForTimeout(150);
    } else {
        if (await page.evaluate(() => document.getElementById('song-settings').hidden)) {
            await page.click('#song-summary');
            await page.waitForTimeout(250);
        }
        check(await page.isVisible('#tap-tempo'), "#tap-tempo (feature séparée, tap tempo pour le BPM) toujours présent");
    }

    // Spacebar no longer does anything tap-recording related; should just play/stop
    await page.evaluate(() => { window.app.stopAll(); });
    await page.keyboard.press('Space');
    await page.waitForTimeout(150);
    check(pageErrors.length === 0, "aucune erreur JS après appui sur Espace (ancien raccourci du rythme tapé) — " + JSON.stringify(pageErrors));

    console.log('\n=== Bilan : ' + PASS + ' PASS / ' + FAIL + ' FAIL ===');
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
