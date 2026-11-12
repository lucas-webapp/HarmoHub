// Lot 3 : affordances. C = curseurs + repères de bord dans le séquenceur ; H = poignées de durée de
// la grille visibles et élargies au doigt ; D = étiquette Copier/Déplacer sur le fantôme de glissé.
const { chromium } = require('playwright')
const { ajouterAccord, editerAccord } = require('./_ajout');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

// RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4c, 12/11) : le petit séquenceur (ses bords de note, ses curseurs ew-resize / grab, son liseré au survol, ses
// poignées de note sélectionnée, sa barre continue) a disparu. Le séquenceur du téléphone est l'onglet Rythme du panneau d'accord, ouvert ici par de vrais
// clics (⋯, « Séquenceur ») ; ses affordances : le réticule de précision sur chaque case (« je veux ce curseur uniquement dans le séquenceur »), et les
// couleurs des rôles sur les notes. Les affordances de la GRILLE (poignées de durée, fantôme de glissé) restent éprouvées telles quelles.
const R = require('./_retrait_ancien');
async function openSeqWithNote(page) {
    await ajouterAccord(page, 'C');
    await page.waitForTimeout(250);
    await editerAccord(page); // lot 10e : plus de séquenceur compact en mode Ajout
    await R.cliquer(page, '#bl-plus', 400); await R.cliquer(page, '#pl-notes', 700);
}

(async () => {
    const browser = await chromium.launch();
    const errors = [];

    // ============================================================
    // === ORDINATEUR (souris : survol + curseurs) ===
    // ============================================================
    // LOT 6c : sur ordinateur (≥ 900px), il n'y a plus de mode Ajout ni de carte Accord à préparer — QUEL accord se règle dans la bulle, COMMENT il
    // sonne dans l'inspecteur, qui n'existe qu'en modification. Ce banc éprouve une FONCTION de la carte (le même code), pas sa mise en page :
    // il se joue donc sous le seuil (860px), où la carte garde son mode Ajout jusqu'au lot 10. DETTE : à reprendre au lot 10 (docs/dette-tests.md).
    const page = await browser.newPage({ viewport: { width: 860, height: 1000 } });
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(700);
    await openSeqWithNote(page);

    const seqC = await page.evaluate(() => {
        const c = document.querySelector('#pa-rythme #sq-grille .sq-case[data-r]');
        return { rythme: !!(window.app._bulle && window.app._bulle.rythme), ancien: window.app.seqOpen, curseur: c ? getComputedStyle(c).cursor : null };
    });
    check(seqC.rythme && !seqC.ancien, 'le séquenceur s\'ouvre dans l\'onglet Rythme, l\'ancien reste fermé');
    check(/url\(/.test(seqC.curseur || ''), `chaque case du séquenceur porte le réticule de précision — ${seqC.curseur}`);
    const roles = await R.couleursRoles(page, 0);
    check(roles.ok, `les notes portent les couleurs de leur rôle (${roles.detail})`);
    await R.cliquer(page, '#panneau-accord [data-bulle="fermer"]', 400);

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
    // RÉÉCRIT (4c) : la barre continue de l'ancien séquenceur a disparu ; au séquenceur d'aujourd'hui, un glissé peint d'un geste les croches d'une note tenue.
    await R.cliquer(page, '#bl-plus', 400); await R.cliquer(page, '#pl-notes', 700);
    const peint = await R.peindreTel(page);
    check(peint.ok, `un glissé peint d'un geste les croches d'une note tenue, d'une seule annulation (${peint.detail})`);
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
        await ajouterAccord(mob, sym);
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
    // Depuis le 06/11 (« oui il faut réduire les poignées ») la cible est PROPORTIONNELLE à la case : 25 %, entre 12 et 22px. À 320px une case fait 60px et
    // deux poignées de 22px en laissaient 16 au centre — le ciblage tactile y volait le toucher. Elle reste plus large que celle de l'ordinateur (14px)
    // dès que la case dépasse 56px, et jamais au-dessous de 12px.
    const largeurCase = await mob.evaluate(() => document.querySelector('.grid-cell').getBoundingClientRect().width);
    const attendue = Math.min(22, Math.max(12, largeurCase * 0.25));
    const larg = handleMobile && parseFloat(handleMobile.width);
    check(handleMobile && Math.abs(larg - attendue) < 1.5 && larg > 14,
        `au doigt, la cible de la poignée est élargie, proportionnelle à la case (${attendue.toFixed(1)}px pour une case de ${Math.round(largeurCase)}px) — obtenu ${JSON.stringify(handleMobile)}`);
    check(handleMobile && handleMobile.widthAutre === handleMobile.width,
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
