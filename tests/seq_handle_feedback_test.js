// Retour visuel des poignées du séquenceur : trois signaux qui répondent à trois questions
// différentes — QUEL geste (curseur), QUEL bord (liseré), QUELLE note (la barre entière s'éclaire),
// plus la durée qui en résultera pendant le glissé.
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

// Deux notes VOISINES et courtes sur la même voix, séparées par une seule croche : le cas où l'on se
// trompe de cible, et donc celui qui doit prouver l'utilité du surlignage.
async function poser(page) {
    await page.fill('#quick-add-input', 'C').catch(() => {});
    await page.click('#quick-add-btn').catch(() => {});
    await page.waitForTimeout(250);
    if (!(await page.evaluate(() => window.app.seqOpen))) await page.click('#toggle-sequencer');
    await page.waitForTimeout(400);
    await page.evaluate(() => {
        const app = window.app;
        const { pattern, tie } = app.getLiveSeqPattern(app.readChord());
        for (let s = 0; s < pattern.length; s++) { pattern[s] = []; tie[s] = []; }
        // note A : croches 0-3 ; note B : croches 5-6
        for (let s = 0; s <= 3; s++) { pattern[s].push(0); if (s > 0) tie[s].push(0); }
        for (let s = 5; s <= 6; s++) { pattern[s].push(0); if (s > 5) tie[s].push(0); }
        app.setLiveSeqPattern(pattern, tie);
        app.seqTouched = true;
        app.seqSelections = [];
        app.renderSequencer();
    });
    await page.waitForTimeout(300);
}

const centre = (page, sel) => page.evaluate((s) => {
    const e = document.querySelector(s);
    const r = e.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}, sel);

(async () => {
    const browser = await chromium.launch();
    const errors = [];
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(800);
    await poser(page);

    const etatNotes = () => page.evaluate(() => [...document.querySelectorAll('.seq-note')].map(n => ({
        start: +n.dataset.start, end: +n.dataset.end,
        survolee: n.classList.contains('hovered'),
    })));

    // ============================================================
    console.log('=== A. La note SURVOLÉE s\'éclaire, et elle seule ===');
    // ============================================================
    check((await etatNotes()).every(n => !n.survolee), 'au départ, aucune note n\'est marquée comme survolée');

    let p = await centre(page, '.seq-cell[data-voice="0"][data-step="1"]');
    await page.mouse.move(p.x, p.y);
    await page.waitForTimeout(200);
    let notes = await etatNotes();
    const surA = notes.filter(n => n.survolee);
    check(surA.length === 1 && surA[0].start === 0 && surA[0].end === 3,
        `survoler le CORPS de la 1re note l'éclaire elle, entièrement — obtenu ${JSON.stringify(surA)}`);
    check(notes.filter(n => n.survolee).length === 1,
        'la note voisine, elle, reste éteinte : on sait laquelle on va toucher');

    // On passe sur la note voisine : le surlignage doit suivre.
    p = await centre(page, '.seq-cell[data-voice="0"][data-step="6"]');
    await page.mouse.move(p.x, p.y);
    await page.waitForTimeout(200);
    notes = await etatNotes();
    const surB = notes.filter(n => n.survolee);
    check(surB.length === 1 && surB[0].start === 5,
        `passer sur la note voisine déplace le surlignage — obtenu ${JSON.stringify(surB)}`);

    // Case VIDE : plus rien de surligné (on ne s'apprête à toucher aucune note existante).
    p = await centre(page, '.seq-cell[data-voice="0"][data-step="10"]');
    await page.mouse.move(p.x, p.y);
    await page.waitForTimeout(200);
    check((await etatNotes()).every(n => !n.survolee),
        'sur une case vide, aucune note n\'est éclairée — on va dessiner, pas modifier');

    // ============================================================
    console.log('\n=== B. Les poignées apparaissent aux deux bouts de la note survolée ===');
    // ============================================================
    p = await centre(page, '.seq-cell[data-voice="0"][data-step="1"]');
    await page.mouse.move(p.x, p.y);
    await page.waitForTimeout(200);
    const poignees = await page.evaluate(() => {
        const n = document.querySelector('.seq-note.hovered');
        if (!n) return null;
        const av = getComputedStyle(n, '::before'), ap = getComputedStyle(n, '::after');
        return {
            debut: av.content !== 'none', fin: ap.content !== 'none',
            largeur: av.width,
            eclat: getComputedStyle(n).filter,
        };
    });
    check(poignees && poignees.debut && poignees.fin,
        `la note survolée montre une poignée à CHAQUE extrémité — ${JSON.stringify(poignees)}`);
    check(poignees && poignees.eclat !== 'none',
        `...et la barre elle-même s'éclaire — filtre : ${poignees && poignees.eclat}`);

    // Même dessin que pour la note sélectionnée : une seule grammaire visuelle.
    const memeDessin = await page.evaluate(() => {
        // Valeurs LUES tout de suite en chaînes : getComputedStyle rend un objet VIVANT, et le
        // re-rendu ci-dessous détache l'élément — le relire après aurait donné des valeurs vides.
        const av = getComputedStyle(document.querySelector('.seq-note.hovered'), '::before');
        const survol = { largeur: av.width, fond: av.backgroundColor };
        window.app.seqSelections = [{ voice: 0, start: 5, end: 6 }];
        window.app.renderSequencer();
        const ap = getComputedStyle(document.querySelector('.seq-note.selected'), '::before');
        return { largeurSurvol: survol.largeur, largeurSel: ap.width, fondSurvol: survol.fond, fondSel: ap.backgroundColor,
                 // Le surlignage doit AUSSI avoir survécu à ce re-rendu : la souris n'a pas bougé.
                 survolSurvitAuRendu: !!document.querySelector('.seq-note.hovered') };
    });
    check(memeDessin.largeurSurvol === memeDessin.largeurSel && memeDessin.fondSurvol === memeDessin.fondSel,
        `poignée de survol et poignée de sélection sont dessinées pareil — ${JSON.stringify(memeDessin)}`);
    check(memeDessin.survolSurvitAuRendu,
        'le surlignage survit à une reconstruction du séquenceur, la souris n\'ayant pas bougé');

    // ============================================================
    console.log('\n=== C. Le curseur dit quel geste partira d\'ici ===');
    // ============================================================
    const curseurs = await page.evaluate(() => {
        const q = (s) => document.querySelector(s);
        return {
            bordDebut: q('.seq-cell[data-voice="0"][data-step="0"]').matches('.seq-cell-edge'),
            corps: q('.seq-cell[data-voice="0"][data-step="1"]').matches('.seq-cell.on:not(.seq-cell-edge)'),
            bordFin: q('.seq-cell[data-voice="0"][data-step="3"]').matches('.seq-cell-edge'),
            vide: q('.seq-cell[data-voice="0"][data-step="10"]').matches('.seq-cell-edge, .seq-cell.on'),
        };
    });
    check(curseurs.bordDebut && curseurs.bordFin, 'les deux bords de la note relèvent bien de la règle d\'étirement (ew-resize)');
    check(curseurs.corps, 'son corps relève de la règle de déplacement (grab)');
    check(!curseurs.vide, 'une case vide ne relève d\'aucune des deux : on y dessine');

    // ============================================================
    console.log('\n=== D. La durée obtenue s\'affiche PENDANT l\'étirement ===');
    // ============================================================
    await page.evaluate(() => { window.app.seqSelections = []; window.app.renderSequencer(); });
    await page.waitForTimeout(200);
    const bordFin = await centre(page, '.seq-cell[data-voice="0"][data-step="3"]');
    const cible = await centre(page, '.seq-cell[data-voice="0"][data-step="1"]');
    const pasLargeur = bordFin.x - cible.x; // 2 croches d'écart

    await page.mouse.move(bordFin.x, bordFin.y);
    await page.mouse.down();
    await page.mouse.move(bordFin.x + pasLargeur, bordFin.y, { steps: 6 });
    await page.waitForTimeout(200);
    // L'ÉTIQUETTE FLOTTANTE DE DURÉE N'EXISTE PLUS (retour utilisateur : « lorsque j'étire une note,
    // je n'ai pas besoin de voir écrit dans une fenêtre la longueur de la note pendant l'étirement »).
    // Les quatre assertions qui la décrivaient sont donc supprimées, et non « réparées » : la
    // fonctionnalité a été retirée à la demande, pas cassée. On vérifie à la place qu'aucune étiquette
    // ne reparaît — c'est désormais ÇA, le contrat.
    const pendant = await page.evaluate(() => !!document.querySelector('.seq-length-tag'));
    check(pendant === false, 'aucune étiquette de durée ne s\'affiche pendant l\'étirement (retirée à la demande)');

    await page.mouse.up();
    await page.waitForTimeout(300);

    // La durée annoncée doit être la VRAIE, pas une approximation : on la recalcule depuis le motif.
    const coherence = await page.evaluate(() => {
        const app = window.app;
        const { pattern } = app.getLiveSeqPattern(app.readChord());
        const actives = pattern.reduce((acc, v, i) => (v.includes(0) ? [...acc, i] : acc), []);
        // Longueur de la première note (croches contiguës depuis 0)
        let n = 0;
        while (actives.includes(n)) n++;
        return { croches: n };
    });
    console.log('    note obtenue :', JSON.stringify(coherence));
    check(coherence.croches > 4,
        `l'étirement a bien allongé la note — ${coherence.croches} croches`);

    // SECTION E SUPPRIMÉE : elle vérifiait le vocabulaire de l'étiquette de durée (« 1 ½ temps »…),
    // c'est-à-dire seqLengthLabel, retiré du produit avec l'étiquette elle-même à la demande de
    // l'utilisateur. Plus rien à tester ici : ce n'est pas un test cassé, c'est un test devenu
    // sans objet.

    // ============================================================
    console.log('\n=== F. Au doigt, rien de tout ça ne se déclenche à tort ===');
    // ============================================================
    await page.close();
    const mob = await browser.newPage({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });
    mob.on('pageerror', e => errors.push('pageerror(mobile): ' + e.message));
    await mob.goto(`${BASE}/index.html`);
    await mob.waitForTimeout(800);
    await poser(mob);
    const b = await centre(mob, '.seq-cell[data-voice="0"][data-step="1"]');
    await mob.touchscreen.tap(b.x, b.y);
    await mob.waitForTimeout(300);
    const auDoigt = await mob.evaluate(() => ({
        survolees: document.querySelectorAll('.seq-note.hovered').length,
        selectionnees: document.querySelectorAll('.seq-note.selected').length,
    }));
    check(auDoigt.survolees === 0,
        `un tap ne laisse pas de surlignage de survol collé derrière lui — ${auDoigt.survolees}`);
    check(auDoigt.selectionnees > 0,
        `...c'est la SÉLECTION qui montre les poignées au doigt, comme avant — ${auDoigt.selectionnees}`);
    await mob.close();

    console.log('\n=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 || errors.length > 0 ? 1 : 0);
})();

// Recalcul indépendant du libellé attendu, pour ne pas comparer la fonction à elle-même.

