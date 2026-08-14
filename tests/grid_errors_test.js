// Lot 5 : erreurs de manipulation de la grille d'accords.
// G1 = Suppr respecte la sélection multiple ; G2 = cible d'édition du symbole utilisable ;
// G3 = une édition inline sans changement ne laisse aucune trace.
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

async function roots(page) {
    return page.evaluate(() => loadProgressionSections()[0].chords.map(c => c.root));
}
async function addChords(page, syms) {
    for (const s of syms) { await page.fill('#quick-add-input', s); await page.click('#quick-add-btn'); await page.waitForTimeout(110); }
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.waitForTimeout(120);
}

(async () => {
    const browser = await chromium.launch();
    const errors = [];
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(700);

    // ============================================================
    // === G1. Suppr efface TOUT le groupe sélectionné ===
    // ============================================================
    await addChords(page, ['C', 'Am', 'F', 'G', 'Dm']);
    check(JSON.stringify(await roots(page)) === '["C","A","F","G","D"]', `5 accords au départ — obtenu ${JSON.stringify(await roots(page))}`);

    await page.evaluate(() => { const a = window.app; a.multiSelect = new Set([0, 1, 2]); a.selectedIndex = 2; a.loadProgression(); });
    await page.waitForTimeout(150);
    await page.keyboard.press('Delete');
    await page.waitForTimeout(250);
    check(JSON.stringify(await roots(page)) === '["G","D"]',
        `Suppr efface les TROIS accords sélectionnés, pas un seul — obtenu ${JSON.stringify(await roots(page))}`);
    const selAfter = await page.evaluate(() => ({ multi: window.app.multiSelect.size, sel: window.app.selectedIndex }));
    check(selAfter.multi === 0 && selAfter.sel === null,
        `la sélection est vidée après coup (plus d'index périmés pointant sur d'autres accords) — obtenu ${JSON.stringify(selAfter)}`);

    // Un seul Ctrl+Z doit tout rendre (un seul instantané pour le groupe).
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(250);
    check(JSON.stringify(await roots(page)) === '["C","A","F","G","D"]',
        `un seul Ctrl+Z rend les trois accords d'un coup — obtenu ${JSON.stringify(await roots(page))}`);

    // Sans sélection multiple, le comportement d'origine est conservé (un seul accord).
    await page.evaluate(() => { const a = window.app; a.multiSelect = new Set(); a.selectedIndex = 1; a.loadProgression(); });
    await page.waitForTimeout(150);
    await page.keyboard.press('Delete');
    await page.waitForTimeout(250);
    check(JSON.stringify(await roots(page)) === '["C","F","G","D"]',
        `sans sélection multiple, Suppr efface toujours le seul accord actif — obtenu ${JSON.stringify(await roots(page))}`);

    // ============================================================
    // === G2. La cible d'édition du symbole est utilisable ===
    // ============================================================
    // Sonde la zone RÉELLEMENT reconnue comme « symbole » (voir _isSymbolHit), en balayant les
    // coordonnées autour du texte — bien plus fiable que de relire une valeur CSS, qui pourrait très
    // bien être rognée sans qu'on le voie (c'est exactement ce qui s'était produit avec un
    // pseudo-élément, annulé par l'overflow:hidden de .cell-sym).
    const target = await page.evaluate(() => {
        const cell = document.querySelector('.grid-cell[data-index="0"]');
        const s = cell.querySelector('.cell-sym').getBoundingClientRect();
        const cx = s.left + s.width / 2, cy = s.top + s.height / 2;
        let halfW = 0, halfH = 0;
        for (let d = 0; d < 120; d++) { if (window.app._isSymbolHit(cell, cx + d, cy)) halfW = d; else break; }
        for (let d = 0; d < 120; d++) { if (window.app._isSymbolHit(cell, cx, cy + d)) halfH = d; else break; }
        return { textW: Math.round(s.width), textH: Math.round(s.height), hitW: halfW * 2, hitH: halfH * 2 };
    });
    console.log('cible symbole:', JSON.stringify(target));
    // CONTRAT CHANGÉ, et dans le sens INVERSE de la première fois. La cible était d'abord trop
    // petite (le texte seul, ~2 % de la case) : on l'avait portée à 52x38 au doigt. C'était trop —
    // sur une case de téléphone (83x56px, mesuré) elle couvrait 43 % de l'aire et ne laissait que
    // 15px de marge sur les côtés, 9px en haut et en bas, si bien qu'on ratait LA CASE en visant
    // autour (retour utilisateur : « j'ai du mal à cliquer autour »). Ramenée à 36x26 (40x28 au
    // doigt) : 24 % de l'aire, 22px et 14px de marge. On borne donc désormais des DEUX côtés — assez
    // grande pour rester visable, assez petite pour laisser la case respirer.
    check(target.hitW >= 34 && target.hitW <= 42,
        `la zone de clic du symbole reste visable sans avaler la case — obtenu ${target.hitW}px de large (texte ${target.textW}px)`);
    check(target.hitH >= 24 && target.hitH <= 30,
        `...idem en hauteur — obtenu ${target.hitH}px (texte ${target.textH}px)`);
    check(target.hitW >= target.textW * 2, `la cible ne rétrécit PAS avec le texte (elle a un plancher absolu) — cible ${target.hitW}px pour un texte de ${target.textW}px`);

    // Viser LÉGÈREMENT à côté du texte doit quand même atteindre le symbole : c'est tout l'objet du
    // halo, la cible ne doit pas se rater au pixel près.
    // CONTRAT CHANGÉ : c'était un simple clic. Le symbole ouvrait sa retape dès le PREMIER clic ;
    // trois gestes se disputaient donc une case de 83x56px au téléphone et il fallait viser pour
    // obtenir celui qu'on voulait. Désormais : premier clic = sélectionner, partout ; second clic
    // rapproché = renommer si l'on a visé le symbole. Ce qui se teste ici reste la MÊME chose — la
    // générosité de la cible — mais avec le geste qui la déclenche aujourd'hui.
    const nearMiss = await page.evaluate(() => {
        const sym = document.querySelector('.grid-cell[data-index="0"] .cell-sym');
        const r = sym.getBoundingClientRect();
        return { x: r.left - 8, y: r.top + r.height / 2 }; // 8px à gauche du texte
    });
    await page.mouse.dblclick(nearMiss.x, nearMiss.y);
    await page.waitForTimeout(250);
    check(await page.isVisible('.cell-sym-input'),
        'un double-clic 8px à côté du texte ouvre bien l\'édition (la cible ne se rate plus au pixel près)');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Le symbole se signale comme éditable sur la case active (seul repère au doigt).
    await page.evaluate(() => { const a = window.app; a.selectedIndex = 0; a.loadProgression(); });
    await page.waitForTimeout(200);
    const editableHint = await page.evaluate(() => {
        const sym = document.querySelector('.grid-cell.selected .cell-sym');
        return sym ? getComputedStyle(sym).boxShadow : null;
    });
    check(editableHint && editableHint !== 'none',
        `le symbole de la case active se signale comme éditable — obtenu ${editableHint}`);

    // ============================================================
    // === G3. Ouvrir puis refermer sans rien changer ne laisse AUCUNE trace ===
    // ============================================================
    await page.evaluate(() => { window.app.undoStack = []; window.hasUnsavedChanges = false; });
    const before = await page.evaluate(() => ({ undo: window.app.undoStack.length, roots: loadProgressionSections()[0].chords.map(c => c.root) }));
    const symBox = await page.evaluate(() => {
        const r = document.querySelector('.grid-cell[data-index="0"] .cell-sym').getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await page.mouse.dblclick(symBox.x, symBox.y); // double-clic : voir le contrat expliqué en G2
    await page.waitForTimeout(200);
    check(await page.isVisible('.cell-sym-input'), 'l\'édition inline est bien ouverte');
    const hint = await page.evaluate(() => {
        const champ = document.querySelector('.cell-sym-input');
        return champ ? champ.title : '(pas de champ ouvert)';
    });
    check(/Échap/.test(hint), `le champ rappelle qu'Échap annule — obtenu "${hint}"`);
    // Perd le focus SANS rien changer (le cas réel : on clique ailleurs).
    await page.evaluate(() => document.querySelector('.cell-sym-input').blur());
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => ({ undo: window.app.undoStack.length, roots: loadProgressionSections()[0].chords.map(c => c.root) }));
    check(after.undo === before.undo,
        `un aller-retour sans modification ne pousse AUCUNE entrée d'annulation — avant ${before.undo}, après ${after.undo}`);
    check(JSON.stringify(after.roots) === JSON.stringify(before.roots),
        `...et ne touche évidemment pas aux accords — obtenu ${JSON.stringify(after.roots)}`);

    // ...mais une vraie modification passe toujours.
    await page.mouse.dblclick(symBox.x, symBox.y);
    await page.waitForTimeout(200);
    await page.fill('.cell-sym-input', 'Bb7');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    const changed = await page.evaluate(() => {
        const c = loadProgressionSections()[0].chords[0];
        return { root: c.root, quality: c.quality, undo: window.app.undoStack.length };
    });
    check(changed.root === 'A#' || changed.root === 'Bb',
        `une VRAIE modification est bien appliquée — obtenu ${JSON.stringify(changed)}`);
    check(changed.undo === before.undo + 1, `...et pousse exactement une entrée d'annulation — obtenu ${changed.undo}`);

    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 || errors.length > 0 ? 1 : 0);
})();
