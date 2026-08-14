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
    check(await page.evaluate(() => window.app.adjustSeqInlineZoom === undefined),
        'ses fonctions de zoom séparées ont disparu au profit de l\'API commune (setZoomLevel)');
    // Le groupe V du séquenceur a été RETIRÉ : avec une hauteur de barre fixe il faisait double emploi
    // avec la poignée du volet, en moins direct. L'assertion d'origine exigeait sa présence — elle
    // décrivait une étape intermédiaire de la conception, pas le besoin.
    check(!(await page.$('.zoom-axis-group[data-zoom-kind="seqInline"][data-zoom-axis="y"]')),
        'le groupe V du séquenceur a bien disparu (la poignée du volet le remplace)');

    // La borne basse propre à son axe H (0.3) est conservée, celle de V est la commune (0.7).
    const mins = await page.evaluate(() => ({
        inlineX: window.app.zoomMinFor('seqInline', 'x'),
        seqX: window.app.zoomMinFor('seq', 'x'),
    }));
    // Bornes basses D'AUJOURD'HUI (l'assertion d'origine décrivait un réglage abandonné depuis) :
    //   - axe H du séquenceur : plancher remonté à 1, « voir trop petit ne me sert à rien » ;
    //   - axe V du séquenceur compact : descendu à 0,45, parce que c'est devenu le seul sens utile de
    //     ce réglage — 14px de ligne étant un plafond, tout l'intérêt est d'en voir plus d'un coup.
    check(mins.inlineX === 1 && mins.seqX === 1,
        `bornes basses : les axes H du séquenceur sont bloqués à 100 % — obtenu ${JSON.stringify(mins)}`);

    // L'AXE VERTICAL NE TOUCHE PAS À LA HAUTEUR DES BARRES — c'est le contrat, deux fois énoncé par
    // l'utilisateur : « laisser une unique hauteur de barres », puis « les barres sont à nouveau avec
    // une hauteur variable » quand une tentative l'avait enfreint. Le seul levier restant pour voir
    // plus de notes est la hauteur de la FENÊTRE, et c'est V− qui l'agrandit (sens inversé par rapport
    // à un zoom ordinaire, cf. hauteurVoletSequenceur).
    // LA PAIRE V DU SÉQUENCEUR N'EXISTE PLUS. Avec une hauteur de barre fixe, elle ne pouvait que
    // redimensionner la fenêtre — ce que la poignée du volet fait déjà, d'un seul geste et sans sens
    // inversé (retour utilisateur : « il n'a peut-être plus de sens, surtout si la poignée de scroll
    // fonctionne bien »). On vérifie donc l'inverse de ce qu'affirmait ce bloc : elle est bien absente,
    // et l'axe horizontal, lui, est resté.
    check(!(await page.$('#seq-zoom-in-v-inline')) && !(await page.$('#seq-zoom-out-v-inline')),
        'la paire V du séquenceur a bien été retirée (la poignée du volet la remplace)');
    check(!!(await page.$('#seq-zoom-in-h-inline')),
        'l\'axe horizontal du séquenceur, lui, est conservé — il change vraiment l\'échelle du temps');

    // ============================================================
    // === Z4. Niveau visible + retour à 100 % ===
    // ============================================================
    // Éprouvé sur l'axe HORIZONTAL du séquenceur : c'est celui qui reste depuis le retrait de la paire
    // V. Le contrat vérifié est inchangé (étiquette qui s'allume, niveau exact annoncé, retour à 100 %
    // au clic, boutons grisés aux bornes) — seul l'axe qui le porte a changé.
    const AXE_H = '.zoom-axis-group[data-zoom-kind="seqInline"][data-zoom-axis="x"]';
    await page.click('#seq-zoom-in-h-inline');
    await page.waitForTimeout(300);
    const tagState = await page.evaluate((sel) => {
        const tag = document.querySelector(sel + ' .zoom-axis-tag');
        return { off: tag.classList.contains('zoom-axis-tag-off'), title: tag.title, role: tag.getAttribute('role') };
    }, AXE_H);
    check(tagState.off, 'l\'étiquette s\'allume dès que l\'échelle s\'écarte de 100 %');
    // 125 % : un cran vaut une PROPORTION (x1,25, voir ZOOM_LEVEL_RATIO/adjustZoom) et non plus +0,1 —
    // le plafond x4, relevé à la demande, demandait sinon trente clics.
    check(/125\s*%/.test(tagState.title), `l'infobulle annonce le niveau exact — obtenu "${tagState.title}"`);
    check(tagState.role === 'button', 'l\'étiquette est annoncée comme un bouton (atteignable au clavier)');

    await page.click(AXE_H + ' .zoom-axis-tag');
    await page.waitForTimeout(300);
    const afterReset = await page.evaluate((sel) => ({
        level: window.app.seqInlineZoomLevelX,
        off: document.querySelector(sel + ' .zoom-axis-tag').classList.contains('zoom-axis-tag-off'),
    }), AXE_H);
    check(afterReset.level === 1 && !afterReset.off,
        `cliquer l'étiquette ramène l'échelle à 100 % — obtenu ${JSON.stringify(afterReset)}`);

    // Boutons désactivés une fois la borne atteinte (plafond x4 sur cet axe).
    await page.evaluate(() => window.app.setZoomLevel('seqInline', 'x', 4));
    await page.waitForTimeout(300);
    const atMax = await page.evaluate((sel) => {
        const b = document.querySelector(sel).querySelectorAll('.zoom-axis-btn');
        return { plus: b[0].disabled, minus: b[1].disabled };
    }, AXE_H);
    check(atMax.plus && !atMax.minus, `à la borne haute, « + » est désactivé et « - » reste actif — obtenu ${JSON.stringify(atMax)}`);
    await page.evaluate(() => window.app.setZoomLevel('seqInline', 'x', 1));
    await page.waitForTimeout(200);

    // Groupes réellement déclarés aujourd'hui. « grid/x » et « grid/y » ont disparu avec la vue plein
    // écran de la grille, « seqInline/y » avec la paire V : les exiger revenait à réclamer le retour de
    // fonctionnalités supprimées à la demande.
    const groups = await page.evaluate(() => [...document.querySelectorAll('.zoom-axis-group[data-zoom-kind]')]
        .map(g => `${g.dataset.zoomKind}/${g.dataset.zoomAxis}`));
    for (const expected of ['seq/x', 'seq/y', 'classicGrid/x', 'classicGrid/y', 'seqInline/x']) {
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
