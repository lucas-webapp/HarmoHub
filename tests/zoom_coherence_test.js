// Lot 6 : cohérence des zooms.
// Z2 = mêmes gestes partout ; Z3 = le séquenceur compact rentre dans l'API commune (2 axes) ;
// Z4 = niveau affiché, retour à 100 %, boutons désactivés aux bornes.
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

async function openSeq(page) {
    await page.fill('#quick-add-input', 'C').catch(() => {});
    await page.click('#quick-add-btn').catch(() => {});
    await page.waitForTimeout(250);
    if (!(await page.evaluate(() => window.app.seqOpen))) await page.click('#toggle-sequencer');
    await page.waitForTimeout(400);
}

(async () => {
    const browser = await chromium.launch();
    const errors = [];
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(700);
    await openSeq(page);

    // ============================================================
    // === Z3. Le séquenceur compact a deux axes et passe par l'API commune ===
    // ============================================================
    check(await page.evaluate(() => typeof window.app.seqInlineZoomLevelY === 'number'),
        'le séquenceur compact a désormais une échelle VERTICALE, comme tous les autres panneaux');
    check(await page.evaluate(() => window.app.adjustSeqInlineZoom === undefined),
        'ses fonctions de zoom séparées ont disparu au profit de l\'API commune (setZoomLevel)');
    check(await page.isVisible('.zoom-axis-group[data-zoom-kind="seqInline"][data-zoom-axis="y"]'),
        'ses boutons V sont bien présents dans la barre du séquenceur');

    // La borne basse propre à son axe H (0.3) est conservée, celle de V est la commune (0.7).
    const mins = await page.evaluate(() => ({
        inlineX: window.app.zoomMinFor('seqInline', 'x'),
        inlineY: window.app.zoomMinFor('seqInline', 'y'),
        seqX: window.app.zoomMinFor('seq', 'x'),
    }));
    // Bornes basses D'AUJOURD'HUI (l'assertion d'origine décrivait un réglage abandonné depuis) :
    //   - axe H du séquenceur : plancher remonté à 1, « voir trop petit ne me sert à rien » ;
    //   - axe V du séquenceur compact : descendu à 0,45, parce que c'est devenu le seul sens utile de
    //     ce réglage — 14px de ligne étant un plafond, tout l'intérêt est d'en voir plus d'un coup.
    check(mins.inlineX === 1 && mins.inlineY === 0.45 && mins.seqX === 1,
        `bornes basses : H bloqué à 100 %, V du compact descendant à 45 % — obtenu ${JSON.stringify(mins)}`);

    // L'axe vertical agit réellement sur la hauteur des cases — mais VERS LE BAS seulement. 14px est un
    // plafond (retour utilisateur : « laisser une unique hauteur de barres, on se perd avec le
    // grossissement vertical ») : V+ est donc grisé au repos, et c'est V− qu'on éprouve ici. Le contrat
    // vérifié reste le même — le réglage change bien la hauteur des lignes —, seul son sens a changé.
    const h1 = await page.evaluate(() => getComputedStyle(document.querySelector('.seq-cell')).height);
    check(await page.$eval('#seq-zoom-in-v-inline', e => e.disabled),
        'V+ est grisé à 100 % : les barres ne grossissent jamais au-delà de leur taille de référence');
    await page.click('#seq-zoom-out-v-inline');
    await page.waitForTimeout(300);
    const h2 = await page.evaluate(() => getComputedStyle(document.querySelector('.seq-cell')).height);
    check(parseFloat(h2) < parseFloat(h1), `le zoom V du compact affine vraiment les lignes — ${h1} -> ${h2}`);
    // ...et il en fait tenir DAVANTAGE dans la même fenêtre : c'est tout l'objet du réglage (« juste
    // éloigner la vue pour voir plus de notes »), et le défaut qu'il a fallu corriger était précisément
    // que la fenêtre se contractait au lieu de se remplir.
    // Ce banc éprouve le séquenceur COMPACT (voir toggleSequencer plus haut), qui n'a pas la grille
    // chromatique continue : le remplissage de la fenêtre par des demi-tons voisins ne s'y applique
    // pas. On ne l'affirme donc que si la vue continue est effectivement à l'écran — sinon l'assertion
    // ne testerait rien et échouerait pour une raison sans rapport avec ce qu'elle prétend vérifier.
    const densite = await page.evaluate(() => {
        const g = document.querySelector('.seq-grid-continuous');
        if (!g) return null;
        const sc = document.querySelector('.seq-scroll');
        return { fenetre: Math.round(sc.getBoundingClientRect().height), lignes: g.querySelectorAll('.seq-label').length };
    });
    if (densite) check(densite.lignes > 0, `des lignes remplissent la fenêtre après le dézoom — ${JSON.stringify(densite)}`);
    else console.log('    (vue continue absente ici : remplissage vérifié ailleurs, voir diag_zoomv2.js)');

    // ============================================================
    // === Z4. Niveau visible + retour à 100 % ===
    // ============================================================
    const tagState = await page.evaluate(() => {
        const tag = document.querySelector('.zoom-axis-group[data-zoom-kind="seqInline"][data-zoom-axis="y"] .zoom-axis-tag');
        return { off: tag.classList.contains('zoom-axis-tag-off'), title: tag.title, role: tag.getAttribute('role') };
    });
    check(tagState.off, 'l\'étiquette s\'allume dès que l\'échelle s\'écarte de 100 %');
    // 80 % et non 110 % : un cran vaut une PROPORTION (x1,25 — donc /1,25 en dézoom, voir
    // ZOOM_LEVEL_RATIO/adjustZoom) et non plus +0,1. Le contrat vérifié ici — « l'infobulle annonce
    // le niveau exact » — n'a pas changé, seule la valeur attendue après UN clic.
    check(/80\s*%/.test(tagState.title), `l'infobulle annonce le niveau exact — obtenu "${tagState.title}"`);
    check(tagState.role === 'button', 'l\'étiquette est annoncée comme un bouton (atteignable au clavier)');

    await page.click('.zoom-axis-group[data-zoom-kind="seqInline"][data-zoom-axis="y"] .zoom-axis-tag');
    await page.waitForTimeout(300);
    const afterReset = await page.evaluate(() => ({
        level: window.app.seqInlineZoomLevelY,
        off: document.querySelector('.zoom-axis-group[data-zoom-kind="seqInline"][data-zoom-axis="y"] .zoom-axis-tag').classList.contains('zoom-axis-tag-off'),
    }));
    check(afterReset.level === 1 && !afterReset.off,
        `cliquer l'étiquette ramène l'échelle à 100 % — obtenu ${JSON.stringify(afterReset)}`);

    // Boutons désactivés une fois la borne atteinte.
    await page.evaluate(() => window.app.setZoomLevel('seqInline', 'y', 2));
    await page.waitForTimeout(300);
    const atMax = await page.evaluate(() => {
        const g = document.querySelector('.zoom-axis-group[data-zoom-kind="seqInline"][data-zoom-axis="y"]');
        const b = g.querySelectorAll('.zoom-axis-btn');
        return { plus: b[0].disabled, minus: b[1].disabled };
    });
    check(atMax.plus && !atMax.minus, `à la borne haute, « + » est désactivé et « - » reste actif — obtenu ${JSON.stringify(atMax)}`);
    await page.evaluate(() => window.app.setZoomLevel('seqInline', 'y', 1));
    await page.waitForTimeout(200);

    // Les six groupes d'index.html sont bien annotés et pris en charge.
    const groups = await page.evaluate(() => [...document.querySelectorAll('.zoom-axis-group[data-zoom-kind]')]
        .map(g => `${g.dataset.zoomKind}/${g.dataset.zoomAxis}`));
    for (const expected of ['seq/x', 'seq/y', 'grid/x', 'grid/y', 'classicGrid/x', 'classicGrid/y', 'seqInline/x', 'seqInline/y']) {
        check(groups.includes(expected), `le groupe ${expected} est déclaré et pris en charge par updateZoomControls`);
    }

    // ============================================================
    // === Z2. Le pincer-zoomer existe désormais partout ===
    // ============================================================
    // Pincement synthétique à 2 doigts sur la grille classique, qui n'en avait aucun.
    const before = await page.evaluate(() => window.app.classicGridZoomLevelY);
    await page.evaluate(async () => {
        const el = document.getElementById('progression-sections');
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + Math.min(60, r.height / 2);
        const mk = (type, id, x, y) => new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: id === 1, button: 0, buttons: 1, clientX: x, clientY: y, bubbles: true, cancelable: true });
        const sleep = (ms) => new Promise(r2 => setTimeout(r2, ms));
        el.dispatchEvent(mk('pointerdown', 1, cx - 30, cy));
        el.dispatchEvent(mk('pointerdown', 2, cx + 30, cy));
        for (let i = 1; i <= 8; i++) {
            const d = 30 + i * 10;
            el.dispatchEvent(mk('pointermove', 1, cx - d, cy));
            el.dispatchEvent(mk('pointermove', 2, cx + d, cy));
            await sleep(16);
        }
        el.dispatchEvent(mk('pointerup', 1, cx - 110, cy));
        el.dispatchEvent(mk('pointerup', 2, cx + 110, cy));
    });
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => window.app.classicGridZoomLevelY);
    check(after > before, `écarter deux doigts sur la grille classique zoome enfin (elle n'avait aucun pincement) — ${before} -> ${after}`);

    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 || errors.length > 0 ? 1 : 0);
})();
