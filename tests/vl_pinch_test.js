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
const R = require('./_retrait_ancien');

plan(14);

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

    // Lot 10f : le téléphone pince le MÊME calque que l'ordinateur (l'ancien panneau ⊱ n'existe plus) : mêmes vérifications aux deux largeurs.
    // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4a, 12/11) : la passe ORDINATEUR est remplacée par le bloc court plus bas ; le téléphone garde la sienne (4c).
    for (const [nom, larg] of [['TÉLÉPHONE (860px)', 860]]) {
        // ======================================================================================================
        console.log(`\n=== ${nom} : le calque Voix de l'éditeur de notes ===`);
        const page = await ouvrir({ width: larg, height: 900 });
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
        const { cx, cy } = await centre(page, '#arp-sequencer .seq-scroll');
        await page.waitForTimeout(200);
        const doigt = pointeur(page, '#arp-sequencer .seq-scroll');
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
        check(await page.evaluate(() => !document.querySelector('.voice-leading-panel')), 'aucun ancien panneau');
        await page.close();

    }

    check(pageErrors.length === 0, "aucune erreur JS pendant les pincements — " + JSON.stringify(pageErrors));
    // ======================================================================================================
    // ORDINATEUR — RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4a, 12/11, « réécriture courte ») : le pincement de la conduite de voix (calque Voix, chemin des voix, loupe, zoom) a disparu
    // de l'ordinateur avec l'éditeur de notes (« le chemin des voix est supprimé », décision du 11/11). Restent les couleurs des rôles au séquenceur du bloc « Vues ».
    console.log('\n=== ORDINATEUR : plus de calque Voix ; le séquenceur garde les couleurs des rôles ===');
    {
        const pg = await ouvrir({ width: 1280, height: 1000 });
        let r = await R.porteAbsente(pg);
        check(r.ok, `l'éditeur de notes et son calque Voix ont quitté l'ordinateur (${r.detail})`);
        check(!(await pg.locator('#toggle-voice-leading').isVisible()), 'l\'icône ⊱ n\'y est pas non plus');
        r = await R.ouvrirNouveau(pg);
        exiger(r.ok, `le séquenceur s'ouvre (${r.detail})`);
        check(await pg.evaluate(() => document.querySelectorAll('.seq-voix-trait, .seq-note-fn, .voice-leading-panel').length === 0), 'ni trait du chemin des voix, ni chiffre de fonction, ni ancien panneau');
        r = await R.couleursRoles(pg, 0);
        check(r.ok, `les notes gardent les couleurs de leur rôle (${r.detail})`);
        await pg.close();
    }

    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
