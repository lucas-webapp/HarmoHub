const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

let PASS = 0, FAIL = 0;
function check(cond, label) {
    if (cond) { PASS++; console.log('PASS - ' + label); }
    else { FAIL++; console.log('FAIL - ' + label); }
}

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 480, height: 900 } }); // mobile-ish, plus susceptible de déborder
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', msg => { if (msg.type() === 'error' && !msg.text().includes('ERR_CONNECTION_RESET') && !msg.text().includes('ERR_TUNNEL_CONNECTION_FAILED')) errors.push('console: ' + msg.text()); });

    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(600);
    await page.waitForTimeout(200);

    // Accord de 2 mesures (8 croches/mesure en 4/4 -> 16 croches -> 8 temps = 2 mesures)
    await page.evaluate(() => {
        const sel = document.getElementById('duration');
        sel.value = '8';
        sel.dispatchEvent(new Event('change'));
    });
    await page.waitForTimeout(200);

    await page.click('#toggle-sequencer');
    await page.waitForTimeout(300);

    const info = await page.evaluate(() => {
        const scrollEl = document.querySelector('#arp-sequencer .seq-scroll');
        const gridEl = document.querySelector('#arp-sequencer .seq-grid');
        return {
            hasWideScrollCls: scrollEl ? scrollEl.classList.contains('seq-scroll-wide') : null,
            hasWideGridCls: gridEl ? gridEl.classList.contains('seq-grid-wide') : null,
            scrollWidth: scrollEl ? scrollEl.scrollWidth : null,
            clientWidth: scrollEl ? scrollEl.clientWidth : null,
            hasPageNav: !!document.getElementById('seq-page-nav') || !!document.querySelector('.seq-page-nav'),
        };
    });
    console.log('info:', JSON.stringify(info));
    check(info.hasWideScrollCls === true, 'accord de 2 mesures -> .seq-scroll-wide posée (mode scrollable)');
    check(info.hasWideGridCls === true, '.seq-grid-wide posée sur la grille');
    check(info.scrollWidth > info.clientWidth, 'le contenu déborde réellement (scrollWidth > clientWidth)');

    // Molette SANS ctrl -> scroll horizontal
    // Le séquenceur est plus bas que l'écran de 480x900 utilisé ici : sans l'amener à l'écran, la
    // molette est envoyée dans le vide (elementFromPoint y renvoie null) et rien ne défile — un
    // faux négatif, vérifié en envoyant l'événement directement sur l'élément, qui défile bien.
    await page.evaluate(() => document.querySelector('#arp-sequencer .seq-scroll').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(250);
    const before = await page.evaluate(() => document.querySelector('#arp-sequencer .seq-scroll').scrollLeft);
    const scrollBox = await page.$eval('#arp-sequencer .seq-scroll', el => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await page.mouse.move(scrollBox.x, scrollBox.y);
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(200);
    const afterWheel = await page.evaluate(() => document.querySelector('#arp-sequencer .seq-scroll').scrollLeft);
    console.log('scrollLeft before/after wheel:', before, afterWheel);
    check(afterWheel > before, 'la molette (sans Ctrl) fait défiler horizontalement');

    // Bouton "Mesure suivante" : reparti du tout début (le test précédent a pu déjà scroller jusqu'au
    // bout, ce qui désactiverait légitimement ce bouton — comportement correct, pas un bug).
    await page.evaluate(() => { document.querySelector('#arp-sequencer .seq-scroll').scrollLeft = 0; });
    await page.waitForTimeout(250);
    const beforeBtn = await page.evaluate(() => document.querySelector('#arp-sequencer .seq-scroll').scrollLeft);
    await page.click('#seq-page-next');
    await page.waitForTimeout(500);
    const afterBtn = await page.evaluate(() => document.querySelector('#arp-sequencer .seq-scroll').scrollLeft);
    console.log('scrollLeft before/after next button:', beforeBtn, afterBtn);
    check(afterBtn > beforeBtn, 'le bouton "mesure suivante" fait défiler');
    const label = await page.$eval('#seq-page-label', el => el.textContent).catch(() => null);
    const diag = await page.evaluate(() => {
        const cells = Array.from(document.querySelectorAll('.seq-cell[data-voice="0"]'));
        const r0 = cells[0].getBoundingClientRect(), r1 = cells[1].getBoundingClientRect();
        return { stepPx: r1.left - r0.left, totalSteps: cells.length, scrollLeft: document.querySelector('#arp-sequencer .seq-scroll').scrollLeft };
    });
    console.log('label après clic suivant:', label, '| diag:', JSON.stringify(diag));
    check(!!label && !label.includes('1 /') , 'le label de mesure se met à jour après le clic (plus "1")');

    // Revenir au début pour le test d'étirement auto-scroll
    await page.evaluate(() => { document.querySelector('#arp-sequencer .seq-scroll').scrollLeft = 0; });
    await page.waitForTimeout(200);

    // Peins une note de 4 croches en tout début de voix 0, puis étire son bord droit vers le bord
    // droit du conteneur pour déclencher l'auto-scroll et vérifier qu'elle peut s'étendre jusque sur
    // la 2e mesure sans qu'on ait eu besoin de zoomer/scroller manuellement au préalable.
    await page.evaluate(() => {
        // Le style de lecture par défaut ("Tenu") peint déjà TOUTE la durée de l'accord comme une
        // seule note continue liée : il faut d'abord l'effacer pour isoler une note COURTE avec un
        // vrai bord à étirer, sinon le clic sur la "croche 3" tombe en plein milieu d'une note qui va
        // en réalité jusqu'à la toute dernière croche (aucun bord là où on croit cliquer).
        const steps = document.querySelectorAll('.seq-cell[data-voice="0"]').length;
        for (let s = 0; s < steps; s++) app.applySeqCell(0, s, false);
        for (let s = 0; s < 4; s++) app.applySeqCell(0, s, true, s !== 0);
        app.renderSequencer();
    });
    await page.waitForTimeout(200);

    // Clique précisément sur la CASE (.seq-cell) de la dernière croche peinte (step 3), pas sur le
    // bord visuel de la pilule .seq-note (pointer-events:none de toute façon, voir style.css) — même
    // élément que onSeqPointerDown lit réellement (e.target.closest('.seq-cell')).
    const patternDiag = await page.evaluate(() => {
        const chord = app.readChord();
        const { pattern, tie } = app.getLiveSeqPattern(chord);
        return { voice0steps: pattern.slice(0, 6).map(v => v.includes(0)), voices: chord.getSeqMidiNotes().length };
    });
    console.log('patternDiag:', JSON.stringify(patternDiag));
    const lastCellBox = await page.$eval('.seq-cell[data-voice="0"][data-step="3"]', el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, height: r.height, hasOn: el.classList.contains('on'), cls: el.className }; }).catch(() => null);
    const scrollRect = await page.$eval('#arp-sequencer .seq-scroll', el => el.getBoundingClientRect());
    console.log('lastCellBox:', JSON.stringify(lastCellBox), 'scrollRect right:', scrollRect.right);

    if (lastCellBox) {
        const startX = lastCellBox.right - 3, startY = lastCellBox.top + lastCellBox.height / 2;
        const edgeX = scrollRect.right - 10; // tout près du bord droit du conteneur
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(startX + 6, startY, { steps: 2 });
        await page.waitForTimeout(50);
        const dragState1 = await page.evaluate(() => {
            const d = app.seqDrag;
            return d ? { hasResize: !!d.resize, edge: d.resize && d.resize.edge, crossedThreshold: d.crossedThreshold, voice: d.voice } : null;
        });
        console.log('état du glissé après le 1er mouvement:', JSON.stringify(dragState1));
        check(dragState1 && dragState1.hasResize, "le glissé démarré sur la dernière croche de la note déclenche bien un étirement (resize)");

        await page.mouse.move(edgeX, startY, { steps: 3 });
        await page.waitForTimeout(100);
        const dragState2 = await page.evaluate(() => {
            const d = app.seqDrag;
            return d ? { scrollElFound: !!d.scrollEl, lastX: d._lastClientX, autoScrollRAF: !!d._autoScrollRAF, dir: d._autoScrollDir, speed: d._autoScrollSpeed, curEnd: d.curEnd } : null;
        });
        console.log('état du glissé près du bord droit:', JSON.stringify(dragState2));
        // Le contenu total ne déborde ici que de 55px (voir scrollWidth/clientWidth plus haut) : la
        // boucle RAF peut déjà avoir atteint le bout et s'être arrêtée d'elle-même (correctement) dans
        // les 100ms qui précèdent cette lecture — d'où curEnd déjà avancé, un signal plus fiable que
        // "la RAF est active pile à cet instant", intrinsèquement dépendant du minutage exact des frames.
        check(dragState2 && dragState2.curEnd > 3, "l'étirement a déjà progressé au-delà de la croche cliquée grâce à l'auto-scroll");

        // Reste immobile près du bord un moment pour laisser l'auto-scroll (boucle RAF) agir
        await page.waitForTimeout(900);
        const scrollDuringDrag = await page.evaluate(() => document.querySelector('#arp-sequencer .seq-scroll').scrollLeft);
        console.log('scrollLeft pendant le glissé (immobile près du bord):', scrollDuringDrag);
        check(scrollDuringDrag > 0, "l'auto-scroll avance tout seul quand on reste près du bord pendant l'étirement");
        await page.mouse.up();
        await page.waitForTimeout(300);

        const finalEnd = await page.evaluate(() => {
            const sels = app.seqSelections;
            return sels && sels.length ? sels[0].end : null;
        });
        console.log('fin de la note étirée:', finalEnd);
        check(finalEnd != null && finalEnd >= 8, "la note s'est bien étendue au-delà de la 1ère mesure (>= croche 8) grâce à l'auto-scroll");
    } else {
        check(false, 'case introuvable pour le test d\'étirement');
    }

    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})();
