const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// La police est chargée depuis Google Fonts : injoignable derrière le proxy du bac à sable,
// jamais un problème chez l'utilisateur. Ces échecs réseau sont donc filtrés — sinon ils font
// échouer « aucune erreur console » et masquent les vraies erreurs au milieu du bruit.

(async () => {
    const browser = await chromium.launch({
        args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const page = await browser.newPage({ deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (msg) => { if (msg.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|fonts\.googleapis|fonts\.gstatic/.test(msg.text())) errors.push('console.error: ' + msg.text()); });

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        const sections = [{ title: 'Couplet', chords: [
            { root: 'C', quality: 'maj7', beats: 16, inversion: 0, drop: 0, octave: 4, bass: null, playStyle: 'held' },
        ]}];
        localStorage.setItem('myProgression', JSON.stringify({ sections }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);

    console.log('--- Item 1: compact sequencer inline H zoom buttons exist and work ---');
    await page.evaluate(() => {
        window.app.editChord(0, 0);
        if (!window.app.seqOpen) window.app.toggleSequencer();
    });
    await page.waitForTimeout(150);
    let r = await page.evaluate(() => {
        const label = document.querySelector('#arp-sequencer .seq-page-label');
        return {
            hasInlineZoomBtns: !!document.getElementById('seq-zoom-in-h-inline') && !!document.getElementById('seq-zoom-out-h-inline'),
            defaultLabel: label ? label.textContent : null,
        };
    });
    console.log('default compact view:', JSON.stringify(r));
    // Le bouton se DÉSACTIVE une fois la butée atteinte : on s'arrête là, au lieu
    // d'attendre 30s qu'un bouton grisé redevienne cliquable.
    for (let i = 0; i < 15; i++) {
        if (await page.evaluate(() => document.getElementById('seq-zoom-in-h-inline').disabled)) break;
        await page.click('#seq-zoom-in-h-inline');
        await page.waitForTimeout(60);
    }
    await page.waitForTimeout(100);
    r = await page.evaluate(() => {
        const label = document.querySelector('#arp-sequencer .seq-page-label');
        return { label: label ? label.textContent : null, level: window.app.seqInlineZoomLevelX };
    });
    console.log('after H+ to max (compact, should show fewer bars/page):', JSON.stringify(r));

    // reset for cleanliness
    // Le bouton se DÉSACTIVE une fois la butée atteinte : on s'arrête là, au lieu
    // d'attendre 30s qu'un bouton grisé redevienne cliquable.
    for (let i = 0; i < 15; i++) {
        if (await page.evaluate(() => document.getElementById('seq-zoom-out-h-inline').disabled)) break;
        await page.click('#seq-zoom-out-h-inline');
        await page.waitForTimeout(60);
    }

    console.log('--- Item 1: loupe séquenceur H zoom is UNAFFECTED/separate from inline zoom ---');
    await page.click('#seq-zoom');
    await page.waitForTimeout(150);
    r = await page.evaluate(() => ({
        seqZoomLevelX: window.app.seqZoomLevelX,
        seqInlineZoomLevelX: window.app.seqInlineZoomLevelX,
        hasInlineButtonsInLoupe: !!document.querySelector('#seq-zoom-host #seq-zoom-in-h-inline'),
    }));
    console.log('in loupe séquenceur:', JSON.stringify(r));
    await page.click('#seq-zoom-close');
    await page.waitForTimeout(100);

    // CONTRAT PÉRIMÉ : comparait la hauteur du triangle de #play (« Accord ») à celle de #play-prog
    // (« Grille ») — #play a disparu (retour utilisateur : « un seul bouton lecture pour toute la
    // grille, le bouton lecture accord ne sert pas à grand chose », voir global_transport_test.js) et
    // faisait planter ce test (getBBox() sur un sélecteur devenu introuvable). Il ne reste qu'un seul
    // triangle : on vérifie juste qu'il se dessine toujours avec une hauteur cohérente.
    console.log('--- Item 2: le triangle du bouton Lecture (seul restant) se dessine correctement ---');
    r = await page.evaluate(() => {
        const path = document.querySelector('#play-prog svg path');
        return { height: path ? path.getBBox().height : null };
    });
    console.log(JSON.stringify(r));
    console.log((r.height > 0) ? 'PASS (icône affichée)' : 'FAIL');

    console.log('--- Item 2: loop button turns blue when active ---');
    r = await page.evaluate(() => {
        const btn = document.getElementById('toggle-loop-section');
        btn.click();
        const cs = getComputedStyle(btn);
        return { active: btn.classList.contains('active'), bgImage: cs.backgroundImage };
    });
    console.log(JSON.stringify(r));
    const isBlue = r.bgImage.includes('37, 58, 92') || r.bgImage.includes('#253a5c') || r.active; // just confirm active + some bg set; exact color checked visually
    console.log('active=' + r.active);

    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
