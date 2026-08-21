// Lot 3 : affordances. C = curseurs + repères de bord dans le séquenceur ; H = poignées de durée de
// la grille visibles et élargies au doigt ; D = étiquette Copier/Déplacer sur le fantôme de glissé.
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

async function openSeqWithNote(page) {
    await page.fill('#quick-add-input', 'C').catch(() => {});
    await page.click('#quick-add-btn').catch(() => {});
    await page.waitForTimeout(250);
    if (!(await page.evaluate(() => window.app.seqOpen))) await page.evaluate(() => window.app.toggleSequencer('compact'));
    await page.waitForTimeout(400);
    // Note de 4 croches sur la voix 0 : il lui faut un corps (croches 1 et 2) en plus de ses bords.
    await page.evaluate(() => {
        const app = window.app;
        const { pattern } = app.getLiveSeqPattern(app.readChord());
        for (let s = 0; s < pattern.length; s++) app.applySeqCell(0, s, false);
        for (let s = 0; s < 4; s++) app.applySeqCell(0, s, true, s !== 0);
        app.seqSelections = [];
        app.renderSequencer();
    });
    await page.waitForTimeout(200);
}

(async () => {
    const browser = await chromium.launch();
    const errors = [];

    // ============================================================
    // === ORDINATEUR (souris : survol + curseurs) ===
    // ============================================================
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(700);
    await openSeqWithNote(page);

    const cls = await page.evaluate(() => {
        const at = (s) => document.querySelector(`.seq-cell[data-voice="0"][data-step="${s}"]`).className;
        return { s0: at(0), s1: at(1), s3: at(3), s8: at(8) };
    });
    check(cls.s0.includes('seq-cell-edge-start') && !cls.s0.includes('seq-cell-edge-end'),
        `la 1re croche est marquée bord GAUCHE seulement — obtenu ${cls.s0}`);
    check(cls.s3.includes('seq-cell-edge-end') && !cls.s3.includes('seq-cell-edge-start'),
        `la dernière croche est marquée bord DROIT seulement — obtenu ${cls.s3}`);
    check(!cls.s1.includes('seq-cell-edge') && cls.s1.includes('on'),
        `le CORPS de la note n'est marqué d'aucun bord — obtenu ${cls.s1}`);

    // Curseurs : ew-resize sur un bord, grab sur le corps, pointer sur une case vide.
    const cursors = await page.evaluate(() => {
        const cur = (s) => {
            const el = document.querySelector(`.seq-cell[data-voice="0"][data-step="${s}"]`);
            // getComputedStyle ne tient pas compte de :hover ; on lit donc la règle applicable en
            // simulant la spécificité via matches() sur les sélecteurs qu'on a écrits.
            return {
                edge: el.matches('.seq-cell-edge'),
                bodyGrab: el.matches('.seq-cell.on:not(.seq-cell-edge)'),
            };
        };
        return { s0: cur(0), s1: cur(1), s8: cur(8) };
    });
    check(cursors.s0.edge, 'un bord de note correspond bien à la règle de curseur ew-resize');
    check(cursors.s1.bodyGrab, 'le corps de la note correspond bien à la règle de curseur grab (déplacement)');
    check(!cursors.s8.edge && !cursors.s8.bodyGrab, 'une case vide ne correspond à aucune des deux (curseur pointer par défaut)');

    // Repère visible du bord au survol (pseudo-élément ::before/::after).
    const hoverMarker = await page.evaluate(() => {
        const el = document.querySelector('.seq-cell[data-voice="0"][data-step="0"]');
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await page.mouse.move(hoverMarker.x, hoverMarker.y);
    await page.waitForTimeout(150);
    const markerShown = await page.evaluate(() => {
        const el = document.querySelector('.seq-cell[data-voice="0"][data-step="0"]');
        return getComputedStyle(el, '::before').content !== 'none';
    });
    check(markerShown, 'au survol d\'un bord, un liseré apparaît bien (pseudo-élément ::before actif)');

    // Poignées de la note sélectionnée (équivalent tactile du survol).
    await page.evaluate(() => {
        window.app.seqSelections = [{ voice: 0, start: 0, end: 3 }];
        window.app.renderSequencer();
    });
    await page.waitForTimeout(200);
    const grips = await page.evaluate(() => {
        const note = document.querySelector('.seq-note.selected');
        if (!note) return null;
        return {
            before: getComputedStyle(note, '::before').content !== 'none',
            after: getComputedStyle(note, '::after').content !== 'none',
        };
    });
    check(grips && grips.before && grips.after,
        `la note sélectionnée montre une poignée à CHAQUE extrémité — obtenu ${JSON.stringify(grips)}`);

    // ============================================================
    // === H. Poignées de durée de la grille ===
    // ============================================================
    const handleDesktop = await page.evaluate(() => {
        const h = document.querySelector('.cell-resize-right');
        if (!h) return null;
        return { width: getComputedStyle(h).width, hasMarker: getComputedStyle(h, '::after').content !== 'none' };
    });
    check(handleDesktop && handleDesktop.width === '14px',
        `à la souris, la poignée de durée garde sa largeur compacte — obtenu ${JSON.stringify(handleDesktop)}`);
    check(handleDesktop && handleDesktop.hasMarker, 'la poignée de durée a désormais un repère visuel (::after)');

    // ============================================================
    // === D. Étiquette Copier / Déplacer sur le fantôme ===
    // ============================================================
    await page.evaluate(() => {
        const app = window.app;
        const cell = document.querySelector('.grid-cell[data-index="0"]');
        app._testGhostMove = app.createDragGhost(cell, 80, 40, 1, false);
        app._testGhostCopy = app.createDragGhost(cell, 80, 40, 3, true);
    });
    const badges = await page.evaluate(() => {
        const t = (g) => g.querySelector('.drag-ghost-badge').textContent;
        const res = {
            move: t(window.app._testGhostMove),
            copy: t(window.app._testGhostCopy),
            moveIsCopy: window.app._testGhostMove.classList.contains('drag-ghost-copy'),
            copyIsCopy: window.app._testGhostCopy.classList.contains('drag-ghost-copy'),
            // L'étiquette déborde volontairement en haut à droite du fantôme : .grid-cell est en
            // overflow:hidden, hérité par le clone, ce qui la rognait.
            overflow: getComputedStyle(window.app._testGhostMove).overflow,
            moveBorder: getComputedStyle(window.app._testGhostMove).borderTopColor,
            copyBorder: getComputedStyle(window.app._testGhostCopy).borderTopColor,
        };
        window.app._testGhostMove.remove();
        window.app._testGhostCopy.remove();
        return res;
    });
    check(badges.move === 'Déplacer', `un glissé normal annonce « Déplacer » — obtenu ${badges.move}`);
    check(badges.copy === 'Copier ×3', `un glissé-copie de 3 accords annonce « Copier ×3 » — obtenu ${badges.copy}`);
    check(!badges.moveIsCopy && badges.copyIsCopy, 'seul le fantôme de COPIE porte la classe de mise en avant');
    check(badges.overflow === 'visible', `le fantôme ne rogne plus son étiquette — obtenu overflow:${badges.overflow}`);
    check(badges.moveBorder !== badges.copyBorder,
        `le cadre distingue vraiment les deux modes — déplacer=${badges.moveBorder} / copier=${badges.copyBorder}`);

    // ============================================================
    // === Lot 4 : une note tenue se lit comme UNE barre continue ===
    // ============================================================
    await openSeqWithNote(page);
    const barLook = await page.evaluate(() => {
        const host = document.getElementById('arp-sequencer');
        const body = document.querySelector('.seq-cell[data-voice="0"][data-step="1"]');
        return {
            liveOff: !host.classList.contains('seq-live'),
            // Hors geste, une case couverte par une barre ne repeint plus son propre fond vert :
            // c'est la barre seule qui représente la note (sinon l'intérieur des cases ressortait
            // plus clair que les 4px qui les séparent, et une note tenue se lisait en morceaux).
            bodyBg: getComputedStyle(body).backgroundColor,
        };
    });
    check(barLook.liveOff, 'hors geste, le séquenceur n\'est pas en mode « retour visuel direct » (.seq-live)');
    check(!barLook.bodyBg.includes('0, 230, 118'),
        `hors geste, une case sous une barre ne repeint plus de vert par-dessus — obtenu ${barLook.bodyBg}`);
    await page.close();

    // ============================================================
    // === TÉLÉPHONE (pointeur grossier : cible élargie, repère toujours visible) ===
    // ============================================================
    const mob = await browser.newPage({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });
    mob.on('pageerror', e => errors.push('pageerror(mobile): ' + e.message));
    await mob.goto(`${BASE}/index.html`);
    await mob.waitForTimeout(700);
    // PLUSIEURS accords : il faut au moins une case NON sélectionnée pour vérifier qu'elle n'affiche
    // justement pas de repère — avec un seul accord, le sélecteur ne trouvait rien et l'assertion ne
    // prouvait rien.
    for (const sym of ['C', 'Am7', 'F']) {
        await mob.fill('#quick-add-input', sym).catch(() => {});
        await mob.click('#quick-add-btn').catch(() => {});
        await mob.waitForTimeout(120);
    }
    await mob.waitForTimeout(200);
    // CONTRAT MIS À JOUR. La première version rendait le repère visible sur TOUTES les cases au doigt,
    // faute de survol pour le révéler à la demande : deux barres blanches par accord, soit douze traits
    // sur une grille de six — un bruit visuel qui noyait la grille (constaté en examinant l'interface,
    // puis signalé par l'utilisateur). Il est désormais réservé à la case SÉLECTIONNÉE, celle qu'on
    // s'apprête à retoucher. La CIBLE tactile, elle, reste élargie sur toutes les cases : c'est elle
    // qui doit être généreuse au doigt, pas le dessin — cette distinction est le cœur du correctif.
    await mob.evaluate(() => { const a = window.app; a.selectedIndex = 0; a.loadProgression(); });
    await mob.waitForTimeout(250);
    const handleMobile = await mob.evaluate(() => {
        const any = document.querySelector('.grid-cell:not(.selected) .cell-resize-right');
        const sel = document.querySelector('.grid-cell.selected .cell-resize-right');
        return {
            width: sel ? getComputedStyle(sel).width : null,
            widthAutre: any ? getComputedStyle(any).width : null,
            opaciteSelection: sel ? getComputedStyle(sel, '::after').opacity : null,
            opaciteAutre: any ? getComputedStyle(any, '::after').opacity : null,
        };
    });
    check(handleMobile && handleMobile.width === '22px',
        `au doigt, la cible de la poignée est bien élargie à 22px — obtenu ${JSON.stringify(handleMobile)}`);
    check(handleMobile && handleMobile.widthAutre === '22px',
        `...sur TOUTES les cases, pas seulement l'active — obtenu ${handleMobile && handleMobile.widthAutre}`);
    check(handleMobile && parseFloat(handleMobile.opaciteSelection) > 0,
        `le repère est visible sur la case sélectionnée (seul canal au doigt) — obtenu ${handleMobile && handleMobile.opaciteSelection}`);
    check(handleMobile && parseFloat(handleMobile.opaciteAutre) === 0,
        `...et PAS sur les autres, qui encombraient la grille de traits blancs — obtenu ${handleMobile && handleMobile.opaciteAutre}`);
    await mob.close();

    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 || errors.length > 0 ? 1 : 0);
})();
