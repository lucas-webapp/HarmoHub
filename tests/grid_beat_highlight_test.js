const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', msg => { if (msg.type() === 'error' && !msg.text().includes('ERR_CONNECTION_RESET') && !msg.text().includes('ERR_TUNNEL_CONNECTION_FAILED')) errors.push('console: ' + msg.text()); });

    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(600);
    await page.waitForTimeout(150);

    // === 0. Contretemps du séquenceur : le repère est bien là et bien visible ===
    // CONTRAT CHANGÉ : ce test attendait le CARACTÈRE « • » dans le texte de l'élément. Le repère
    // n'est plus un caractère depuis qu'il a été redessiné : c'est une forme en CSS (.offbeat-dash),
    // un petit trait VERTICAL pour le séquenceur — un caractère typographique ne se centrait pas au
    // pixel près sur la colonne, et l'utilisateur a tranché entre cinq propositions (« j'aime bien
    // le petit rond pour la grille d'accords, mais laisse un tiret pour le séquenceur »). Ce qui
    // reste à éprouver est le besoin, pas le moyen : le repère existe, et il se voit.
    await page.click('#toggle-sequencer');
    await page.waitForTimeout(250);
    const offbeatCss = await page.evaluate(() => {
        const el = document.querySelector('.seq-beat-offbeat');
        if (!el) return null;
        const trait = el.querySelector('.offbeat-dash');
        const cs = getComputedStyle(trait || el);
        const r = (trait || el).getBoundingClientRect();
        return {
            opacity: cs.opacity, forme: trait ? 'CSS' : 'texte',
            taille: [Math.round(r.width), Math.round(r.height)],
            couleurPosee: cs.backgroundColor,
        };
    });
    console.log('offbeat css:', JSON.stringify(offbeatCss));
    check(offbeatCss && parseFloat(offbeatCss.opacity) >= 0.5, 'le repère de contretemps est nettement opaque (>= 0.5)');
    check(offbeatCss && offbeatCss.forme === 'CSS' && offbeatCss.taille[0] > 0 && offbeatCss.taille[1] > 0,
        `le repère est une forme dessinée, pas un caractère — ${JSON.stringify(offbeatCss && offbeatCss.taille)}`);
    check(offbeatCss && offbeatCss.taille[1] > offbeatCss.taille[0],
        `...et c'est bien un trait VERTICAL pour le séquenceur, comme demandé — ${JSON.stringify(offbeatCss && offbeatCss.taille)}`);
    await page.click('#toggle-sequencer'); // referme
    await page.waitForTimeout(150);

    // Ajoute plusieurs accords pour avoir de la marge d'étirement (case "+" toujours présente après)
    for (const sym of ['C', 'G', 'Am', 'F']) {
        await page.fill('#quick-add-input', sym).catch(() => {});
        await page.click('#quick-add-btn').catch(() => {});
        await page.waitForTimeout(150);
    }

    // === 1. Étirement d'un accord dans la grille CLASSIQUE (hors loupe) ===
    const cellsBefore = await page.$$('.grid-cell');
    console.log('cellules avant étirement:', cellsBefore.length);
    const firstCell = cellsBefore[0];
    const handle = await firstCell.$('.cell-resize-right');
    if (!handle) {
        const html = await firstCell.evaluate(el => el.outerHTML);
        console.log('PAS de poignée cell-resize-right trouvée, HTML de la case:', html);
    }
    const handleBox = await handle.boundingBox();

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x + 120, handleBox.y + handleBox.height / 2, { steps: 6 });
    await page.waitForTimeout(150);

    const duringGridResize = await page.evaluate(() => {
        const reached = document.querySelector('.row-measure.row-measure-reached');
        const beatTicks = document.querySelectorAll('.cell-beat-tick').length;
        return { reachedText: reached ? reached.textContent : null, beatTicks };
    });
    console.log('pendant l\'étirement (grille classique):', JSON.stringify(duringGridResize));
    check(duringGridResize.reachedText !== null, "un numéro de mesure est mis en évidence (.row-measure-reached) pendant l'étirement d'un accord (grille classique)");
    check(duringGridResize.beatTicks > 0, "des traits de temps (.cell-beat-tick) apparaissent sur l'accord étiré (grille classique)");

    await page.mouse.up();
    await page.waitForTimeout(250);

    const afterGridResize = await page.evaluate(() => ({
        reached: !!document.querySelector('.row-measure.row-measure-reached'),
        beatTicks: document.querySelectorAll('.cell-beat-tick').length,
    }));
    console.log('après relâchement (grille classique):', JSON.stringify(afterGridResize));
    check(afterGridResize.reached === false, "le repère de mesure s'éteint bien une fois l'étirement de grille terminé");
    check(afterGridResize.beatTicks === 0, "les traits de temps disparaissent bien une fois l'étirement de grille terminé");

    // === 2. Même vérification en LOUPE GRILLE ===
    await page.click('#grid-zoom');
    await page.waitForTimeout(300);
    const cellsZoom = await page.$$('#grid-zoom-host .grid-cell');
    const firstCellZoom = cellsZoom[0];
    const handleZoom = await firstCellZoom.$('.cell-resize-right');
    const handleZoomBox = await handleZoom.boundingBox();

    await page.mouse.move(handleZoomBox.x + handleZoomBox.width / 2, handleZoomBox.y + handleZoomBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleZoomBox.x + 150, handleZoomBox.y + handleZoomBox.height / 2, { steps: 6 });
    await page.waitForTimeout(150);

    const duringLoupeResize = await page.evaluate(() => {
        const reached = document.querySelector('#grid-zoom-host .row-measure.row-measure-reached');
        const beatTicks = document.querySelectorAll('#grid-zoom-host .cell-beat-tick').length;
        return { reachedText: reached ? reached.textContent : null, beatTicks };
    });
    console.log('pendant l\'étirement (loupe grille):', JSON.stringify(duringLoupeResize));
    check(duringLoupeResize.reachedText !== null, "le repère de mesure fonctionne aussi en LOUPE GRILLE pendant l'étirement");
    check(duringLoupeResize.beatTicks > 0, "les traits de temps fonctionnent aussi en LOUPE GRILLE pendant l'étirement");

    await page.mouse.up();
    await page.waitForTimeout(250);
    await page.click('#grid-zoom-close');
    await page.waitForTimeout(200);

    // === 3. Vérifie que le repère de temps du SÉQUENCEUR fonctionne aussi en LOUPE SÉQUENCEUR ===
    // Édite le 1er accord, ouvre la loupe séquenceur, isole une note courte, étire son bord.
    const gridCellsNow = await page.$$('.grid-cell');
    await gridCellsNow[0].dblclick();
    await page.waitForTimeout(300);
    await page.click('#toggle-sequencer');
    await page.waitForTimeout(300);
    await page.click('#seq-zoom');
    await page.waitForTimeout(300);

    await page.evaluate(() => {
        const steps = document.querySelectorAll('#seq-zoom-host .seq-cell[data-voice="0"]').length;
        for (let s = 0; s < steps; s++) app.applySeqCell(0, s, false);
        for (let s = 0; s < 4; s++) app.applySeqCell(0, s, true, s !== 0);
        app.renderSequencer();
    });
    await page.waitForTimeout(200);

    const noteEndBox = await page.evaluate(() => {
        const note = document.querySelector('#seq-zoom-host .seq-note[data-voice="0"]');
        if (!note) return null;
        const end = +note.dataset.end;
        const cell = document.querySelector(`#seq-zoom-host .seq-cell[data-voice="0"][data-step="${end}"]`);
        const r = cell.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
    if (noteEndBox) {
        const sx = noteEndBox.x + noteEndBox.width - 2, sy = noteEndBox.y + noteEndBox.height / 2;
        await page.mouse.move(sx, sy);
        await page.mouse.down();
        await page.mouse.move(sx + 150, sy, { steps: 6 });
        await page.waitForTimeout(150);
        const reachedInLoupeSeq = await page.evaluate(() => {
            const el = document.querySelector('#seq-zoom-host .seq-beat-label.seq-beat-reached');
            return el ? el.textContent : null;
        });
        console.log('temps allumé en loupe séquenceur:', reachedInLoupeSeq);
        check(reachedInLoupeSeq !== null, "le repère de temps du séquenceur fonctionne aussi en LOUPE SÉQUENCEUR");
        await page.mouse.up();
        await page.waitForTimeout(200);
    } else {
        check(false, 'note introuvable en loupe séquenceur pour le test');
    }

    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})();
