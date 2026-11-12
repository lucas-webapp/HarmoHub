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

plan(11);

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
    const ouvrir = async (viewport, extra = {}) => {
        const page = await browser.newPage({ viewport, hasTouch: true, ...extra });
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

    // TÉLÉPHONE — RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4c, 12/11, « réécriture courte ») : la feuille « Notes » du téléphone emportait le dernier calque
    // Voix (fonctions dans les notes, chemin des voix, son zoom et son pincement). Comme à l'ordinateur (plus bas), ce qui reste : les couleurs des rôles, dans
    // le séquenceur de l'onglet Rythme du panneau d'accord, ouvert par « Séquenceur » du panneau Lecture.
    console.log('\n=== TÉLÉPHONE (860px) : plus de calque Voix ; l\'onglet Rythme garde les couleurs des rôles ===');
    {
        const pt = await ouvrir({ width: 860, height: 1000 }, { hasTouch: true, isMobile: true });
        let r = await R.porteTelephoneAbsente(pt);
        check(r.ok, `la feuille « Notes » et son calque Voix ont quitté le téléphone (${r.detail})`);
        check(!(await pt.locator('#toggle-voice-leading').isVisible()), 'l\'icône ⊱ n\'y est pas non plus');
        r = await R.ouvrirRythmeTel(pt);
        exiger(r.ok, `« Séquenceur » du panneau Lecture ouvre l'onglet Rythme (${r.detail})`);
        check(await pt.evaluate(() => document.querySelectorAll('.seq-voix-trait, .seq-note-fn, .voice-leading-panel').length === 0), 'ni trait du chemin des voix, ni chiffre de fonction, ni ancien panneau');
        r = await R.couleursRoles(pt, 0);
        check(r.ok, `les notes y gardent les couleurs de leur rôle (${r.detail})`);
        await pt.close();
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
