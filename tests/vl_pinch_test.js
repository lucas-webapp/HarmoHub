// LE PINCEMENT DE LA CONDUITE DE VOIX — deux surfaces depuis le lot 9c.
//
// RÉÉCRIT POUR LE NOUVEAU GESTE (lot 9c : « chaque fonction de l'ancien panneau (règles de voix, loupe, pincement) est vérifiée une à une AVANT
// de fondre », docs/refonte.md).
// A. TÉLÉPHONE (860px) — le panneau d'avant, rien ne bouge avant le lot 10 : pendant le geste, un transform de secours (--vl-zoom-scale-x/-y)
//    grandit IMMÉDIATEMENT, avant le rendu réel (différé, _zoomPinchActive) ; au relâchement, le panneau reconstruit repart de 1 et l'échelle réelle
//    a grandi. Les vérifications d'origine, telles quelles (seule l'ouverture passe par un vrai clic sur le bouton au lieu d'un appel direct).
// B. ORDINATEUR (1280px) — le calque Voix de l'éditeur de notes. Il n'a plus besoin de transform de secours : le zoom horizontal de l'éditeur ne
//    change qu'une variable de largeur de colonne, et les traits, placés par la grille CSS comme les notes, la suivent sans rendu. C'est ce que le
//    banc tient : PENDANT le geste déjà, les colonnes s'élargissent et chaque trait reste sur sa frontière ; après, l'échelle réelle a grandi.
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('pincement de la conduite de voix');

plan(15);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const graine = () => {
    const mk = (root, quality, octave) => ({ root, quality, beats: 4, inversion: 0, drop: 'none', octave, bass: null, playStyle: 'held' });
    localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Section', chords: [
        mk('C', 'maj7', 3), mk('A', 'min7', 3), mk('D', 'min7', 3), mk('G', 'dom7', 3),
    ] }] }));
    localStorage.removeItem('harmohubSeqVoix');
    localStorage.removeItem('harmohubSeqInlineZoomLevelX');
    sessionStorage.setItem('cc_accueil_vu', '1');
};

(async () => {
    const browser = await chromium.launch();
    const pageErrors = [];
    const ouvrir = async (viewport) => {
        const page = await browser.newPage({ viewport, hasTouch: true });
        page.on('pageerror', (e) => pageErrors.push(e.message));
        await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
        await page.evaluate(graine);
        await page.reload({ waitUntil: 'load' });
        await page.waitForTimeout(500);
        return page;
    };
    // Un vrai pincement à deux doigts, en événements de pointeur bruts (Playwright n'a pas de geste multi-doigts) : appui x2, écart qui grandit,
    // relâché x2 — exactement ce qu'écoute setupPinchZoom. Coordonnées de FENÊTRE (getBoundingClientRect), comme elementFromPoint.
    const pointeur = (page, repli) => async (type, id, x, y) => {
        await page.evaluate(({ type, id, x, y, repli }) => {
            const el = document.elementFromPoint(x, y);
            const ev = new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true });
            (el || document.querySelector(repli)).dispatchEvent(ev);
        }, { type, id, x, y, repli });
    };
    const centre = (page, sel) => page.evaluate((sel) => {
        const el = document.querySelector(sel);
        el.scrollIntoView({ block: 'center' });
        const r = el.getBoundingClientRect();
        return { cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
    }, sel);

    // ======================================================================================================
    console.log('\n=== A. TÉLÉPHONE (860px) : le panneau d\'avant ===');
    let page = await ouvrir({ width: 860, height: 900 });
    await page.click('#toggle-voice-leading');
    await page.waitForTimeout(200);
    exiger(!!(await page.locator('.voice-leading-panel').boundingBox()), 'le panneau Conduite de voix est bien ouvert');
    let { cx, cy } = await centre(page, '.voice-leading-scroll');
    await page.waitForTimeout(200);
    await page.evaluate(() => window.app.setZoomLevel('voiceLeading', 'x', 1)); // point de départ connu (réglage, pas un geste)
    await page.evaluate(() => window.app.setZoomLevel('voiceLeading', 'y', 1));
    await page.waitForTimeout(100);
    let doigt = pointeur(page, '.voice-leading-scroll');
    await doigt('pointerdown', 1, cx - 20, cy);
    await doigt('pointerdown', 2, cx + 20, cy);
    await page.waitForTimeout(20);
    await doigt('pointermove', 1, cx - 40, cy);
    await doigt('pointermove', 2, cx + 40, cy);
    await page.waitForTimeout(30); // bien sous l'intervalle de reconstruction (150ms)
    const midGestureScaleX = await page.evaluate(() => document.querySelector('.voice-leading-panel').style.getPropertyValue('--vl-zoom-scale-x'));
    const midGestureScaleY = await page.evaluate(() => document.querySelector('.voice-leading-panel').style.getPropertyValue('--vl-zoom-scale-y'));
    check(parseFloat(midGestureScaleX) > 1, "le transform de secours (--vl-zoom-scale-x) grandit IMMÉDIATEMENT pendant le geste, avant tout nouveau rendu réel");
    check(parseFloat(midGestureScaleY) > 1, "idem pour --vl-zoom-scale-y");
    check(await page.evaluate(() => window.app._zoomPinchActive), "_zoomPinchActive bien vrai pendant le geste (donc rendu complet différé)");
    await doigt('pointerup', 1, cx - 40, cy);
    await doigt('pointerup', 2, cx + 40, cy);
    await page.waitForTimeout(150);
    const finalScaleX = await page.evaluate(() => document.querySelector('.voice-leading-panel').style.getPropertyValue('--vl-zoom-scale-x'));
    check(finalScaleX === '', "après relâchement, le panneau reconstruit n'a plus de transform de secours (repart de 1 par défaut)");
    check(await page.evaluate(() => window.app.voiceLeadingZoomLevelX) > 1, "l'échelle horizontale réelle a bien augmenté après le pincement");
    await page.close();

    // ======================================================================================================
    console.log('\n=== B. ORDINATEUR (1280px) : le calque Voix de l\'éditeur de notes ===');
    page = await ouvrir({ width: 1280, height: 900 });
    await page.click('#progression-sections .grid-cell[data-index="1"]');
    await page.waitForTimeout(300);
    await page.click('#grid-zoom');
    await page.waitForTimeout(900);
    await page.click('#editeur-notes-voix');
    await page.waitForTimeout(700);
    exiger(await page.evaluate(() => document.querySelectorAll('#arp-sequencer .seq-voix-mouvement').length > 0), 'le calque Voix est posé, avec ses traits');
    // Écart maximal entre un trait et la frontière qu'il marque (le bord gauche de l'accord suivant).
    const ecartTraits = () => page.evaluate(() => Math.max(...[...document.querySelectorAll('#arp-sequencer .seq-voix-mouvement')].map(t => {
        const nav = document.querySelector(`#arp-sequencer .seq-ctx-nav[data-target-index="${t.dataset.accord}"]`);
        const x = (nav || document.querySelector('#arp-sequencer .seq-cell[data-step="0"]')).getBoundingClientRect().left;
        const r = t.getBoundingClientRect(); return Math.abs(r.left + r.width / 2 - x);
    })));
    const colonne = () => page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#arp-sequencer .seq-grid-continuous')).getPropertyValue('--seq-col-w')));
    const gen0 = await page.evaluate(() => window.app.seqRenderGen);
    const col0 = await colonne();
    ({ cx, cy } = await centre(page, '#arp-sequencer .seq-scroll'));
    await page.waitForTimeout(200);
    doigt = pointeur(page, '#arp-sequencer .seq-scroll');
    await doigt('pointerdown', 1, cx - 20, cy);
    await doigt('pointerdown', 2, cx + 20, cy);
    await page.waitForTimeout(20);
    await doigt('pointermove', 1, cx - 45, cy);
    await doigt('pointermove', 2, cx + 45, cy);
    await page.waitForTimeout(30);
    const col1 = await colonne();
    check(col1 > col0, `pendant le geste, les colonnes s'élargissent aussitôt (${col0.toFixed(1)} → ${col1.toFixed(1)} px)`);
    check(await ecartTraits() <= 2, 'et chaque trait reste sur sa frontière, sans attendre un rendu');
    check(await page.evaluate((g) => window.app.seqRenderGen === g, gen0), 'aucun rendu n\'a eu lieu pour ça : les traits suivent la grille d\'eux-mêmes');
    await doigt('pointerup', 1, cx - 45, cy);
    await doigt('pointerup', 2, cx + 45, cy);
    await page.waitForTimeout(400);
    check(await page.evaluate(() => window.app.seqInlineZoomLevelX) > 1, 'l\'échelle horizontale réelle a bien augmenté après le pincement');
    check(await ecartTraits() <= 2, 'après le geste, les traits sont toujours sur leurs frontières');
    check(await page.evaluate(() => document.querySelectorAll('#arp-sequencer .seq-voix-accord').length === 4 && document.querySelectorAll('#arp-sequencer .seq-note-fn').length > 0),
        'le calque est intact : les quatre accords dans la règle, les fonctions dans les notes');
    check(await page.evaluate(() => !document.querySelector('.voice-leading-panel')), 'aucun ancien panneau à l\'ordinateur');
    await page.close();

    check(pageErrors.length === 0, "aucune erreur JS pendant les pincements — " + JSON.stringify(pageErrors));
    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
