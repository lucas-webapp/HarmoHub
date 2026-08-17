const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
// plan() n'est pas décoratif ici : ce banc a longtemps expiré au milieu de sa section 3, sur un clic
// #grid-zoom-close disparu, et sa section 4 n'était plus jamais atteinte — sans que rien ne le dise,
// puisqu'il affichait des PASS jusque-là. Le plancher déclaré rend désormais cet abandon bruyant.
const { check, exiger, plan, bilan } = require('./_harness')('repères de contretemps');
plan(15);

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', msg => { if (msg.type() === 'error' && !msg.text().includes('ERR_CONNECTION_RESET') && !msg.text().includes('ERR_TUNNEL_CONNECTION_FAILED')) errors.push('console: ' + msg.text()); });

    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(600);
    await page.waitForTimeout(150);

    // 8 accords d'1 temps chacun, en 4/4 -> exactement 2 mesures pleines : de quoi vérifier qu'il n'y a
    // bien qu'UN SEUL repère par mesure (pas un par temps).
    for (const sym of ['C', 'G', 'Am', 'F', 'Dm', 'Em', 'C', 'G']) {
        await page.fill('#quick-add-input', sym).catch(() => {});
        await page.click('#quick-add-btn').catch(() => {});
        await page.waitForTimeout(120);
    }

    // === 1. Séquenceur : le repère est un trait (span), plus le caractère "•", et bien centré ===
    await page.click('#toggle-sequencer');
    await page.waitForTimeout(300);

    const seqCheck = await page.evaluate(() => {
        const off = document.querySelector('.seq-beat-offbeat');
        if (!off) return null;
        const dash = off.querySelector('.offbeat-dash');
        const offRect = off.getBoundingClientRect();
        const dashRect = dash ? dash.getBoundingClientRect() : null;
        // Colonne du 1er temps (step 0) et de la 2e croche (step 2, où débute l'ancien repère)
        const cell0 = document.querySelector('.seq-cell[data-voice="0"][data-step="0"]');
        const cell1 = document.querySelector('.seq-cell[data-voice="0"][data-step="1"]');
        const cell2 = document.querySelector('.seq-cell[data-voice="0"][data-step="2"]');
        const cell3 = document.querySelector('.seq-cell[data-voice="0"][data-step="3"]');
        const r0 = cell0.getBoundingClientRect(), r3 = cell3.getBoundingClientRect();
        // Bord droit VISIBLE du temps, pas le bord de la boîte. L'écart de 4px après la 2e croche d'un
        // binôme se fait par une bordure transparente (voir .seq-cell-b : elle remplace une marge, qui
        // laissait une bande morte non cliquable). Le rectangle englobe donc cette bordure, alors que
        // le fond — ce que l'œil voit, et ce dont parlait le retour utilisateur « le tiret n'est pas
        // complètement centré, très légèrement à droite » — s'arrête 4px avant. Mesurer r3.right
        // brut déplacerait la référence de 2px et accuserait le trait d'un décalage qu'il n'a pas :
        // c'est précisément l'interstice VISUEL que compense le translateX(-2px) de .seq-beat-offbeat.
        const bordD = parseFloat(getComputedStyle(cell3).borderRightWidth) || 0;
        const beatLeft = r0.left, beatRight = r3.right - bordD;
        const trueMid = (beatLeft + beatRight) / 2;
        return {
            text: off.textContent,
            hasDash: !!dash,
            offCenter: offRect ? (offRect.left + offRect.right) / 2 : null,
            dashCenter: dashRect ? (dashRect.left + dashRect.right) / 2 : null,
            trueMid,
        };
    });
    console.log('seqCheck:', JSON.stringify(seqCheck));
    check(seqCheck && seqCheck.text.trim() === '', "le séquenceur n'affiche plus le caractère « • » (texte vide, juste le trait CSS)");
    check(seqCheck && seqCheck.hasDash, 'le trait .offbeat-dash est bien présent dans .seq-beat-offbeat');
    check(seqCheck && Math.abs(seqCheck.dashCenter - seqCheck.trueMid) <= 2, `le trait est centré sur le VRAI milieu du temps (écart <= 2px, obtenu ${seqCheck ? Math.abs(seqCheck.dashCenter - seqCheck.trueMid).toFixed(1) : '?'}px)`);

    // Orientation : trait vertical (haut > large), pas horizontal (retour utilisateur : "je veux un
    // trait vertical, pas horizontal").
    const seqDashSize = await page.evaluate(() => {
        const d = document.querySelector('.seq-beat-offbeat .offbeat-dash');
        const r = d.getBoundingClientRect();
        return { w: r.width, h: r.height };
    });
    console.log('seqDashSize:', JSON.stringify(seqDashSize));
    check(seqDashSize.h > seqDashSize.w, `le trait du séquenceur est bien VERTICAL (hauteur ${seqDashSize.h} > largeur ${seqDashSize.w})`);

    await page.click('#toggle-sequencer');
    await page.waitForTimeout(150);

    // === 2. Grille d'accords (classique) : UN SEUL repère .row-offbeat par mesure, à son vrai milieu ===
    // 8 accords d'1 temps en 4/4 -> exactement 2 mesures pleines -> exactement 2 repères attendus,
    // pas 8 (retour utilisateur : "je veux seulement des tirets au niveau des milieux de mesure").
    const gridCheck = await page.evaluate(() => {
        const marks = Array.from(document.querySelectorAll('.chord-grid .row-offbeat'));
        if (!marks.length) return { count: 0 };
        const gridEl = marks[0].closest('.chord-grid');
        const colsPx = getComputedStyle(gridEl).gridTemplateColumns.split(' ').map(parseFloat);
        const gridRect = gridEl.getBoundingClientRect();
        const results = marks.map(m => {
            const style = m.getAttribute('style');
            const colMatch = /grid-column:\s*(\d+)\s*\/\s*span\s*(\d+)/.exec(style);
            const colStart = +colMatch[1], span = +colMatch[2]; // 1-based
            let left = gridRect.left;
            for (let i = 0; i < colStart - 1; i++) left += colsPx[i];
            let width = 0;
            for (let i = 0; i < span; i++) width += colsPx[colStart - 1 + i];
            const expectedCenter = left + width / 2;
            const markRect = m.getBoundingClientRect();
            const dot = m.querySelector('.offbeat-dot');
            const dotRect = dot ? dot.getBoundingClientRect() : null;
            const dotCs = dot ? getComputedStyle(dot) : null;
            return {
                expectedCenter,
                markCenter: (markRect.left + markRect.right) / 2,
                hasDot: !!dot,
                dotW: dotRect ? dotRect.width : null, dotH: dotRect ? dotRect.height : null,
                borderRadius: dotCs ? dotCs.borderRadius : null,
                pointerEvents: getComputedStyle(m).pointerEvents,
            };
        });
        return { count: marks.length, results };
    });
    // Nombre de mesures ATTENDU dérivé des données réelles (pas une supposition sur la durée par
    // défaut d'un accord ajouté via Ajout rapide) : total de temps de la section active / temps par
    // mesure, arrondi au-dessus — doit correspondre EXACTEMENT au nombre de repères, un par mesure.
    const expectedBars = await page.evaluate(() => {
        const sections = loadProgressionSections();
        const sec = sections[app.activeSection];
        const totalBeats = sec.chords.reduce((sum, h) => sum + beatsFromData(h), 0);
        return Math.ceil(totalBeats / app.beatsPerBar());
    });
    console.log('gridCheck:', JSON.stringify(gridCheck), 'expectedBars:', expectedBars);
    check(gridCheck.count === expectedBars, `exactement ${expectedBars} repère(s) de contretemps (1 par mesure, pas 1 par temps) — obtenu ${gridCheck.count}`);
    if (exiger(!!gridCheck.results, 'les repères de la grille sont mesurables (grid-column lisible sur chacun)')) {
        const allCentered = gridCheck.results.every(r => Math.abs(r.markCenter - r.expectedCenter) <= 2);
        check(allCentered, `chaque repère est bien centré sur le milieu RÉEL de sa mesure (écarts: ${gridCheck.results.map(r => Math.abs(r.markCenter - r.expectedCenter).toFixed(1)).join(', ')}px)`);
        const allDots = gridCheck.results.every(r => r.hasDot && r.dotW === r.dotH && r.borderRadius !== '0px');
        check(allDots, `la grille utilise bien un petit POINT ROND (.offbeat-dot), pas un trait (retour utilisateur : "j'aime bien le petit rond pour la grille") — obtenu ${JSON.stringify(gridCheck.results.map(r => ({ w: r.dotW, h: r.dotH, br: r.borderRadius })))}`);
        const allDecorative = gridCheck.results.every(r => r.pointerEvents === 'none');
        check(allDecorative, "chaque repère est décoratif (pointer-events:none), n'intercepte pas le glisser de la plage à boucler");
    }

    // === 2b. Les numéros (mesure/temps) doivent être plus mis en valeur que les repères de contretemps
    // (retour utilisateur : "je veux mettre plus en valeur les numéros de temps que les tirets") ===
    const prominence = await page.evaluate(() => {
        const rm = getComputedStyle(document.querySelector('.row-measure'));
        const dot = getComputedStyle(document.querySelector('.offbeat-dot'));
        const sbl = getComputedStyle(document.querySelector('.seq-beat-label'));
        const dash = getComputedStyle(document.querySelector('.offbeat-dash'));
        return {
            rowMeasureOpacity: +rm.opacity, offbeatDotOpacity: +dot.opacity,
            seqBeatLabelOpacity: +sbl.opacity, offbeatDashOpacity: +dash.opacity,
        };
    });
    console.log('prominence:', JSON.stringify(prominence));
    check(prominence.rowMeasureOpacity > prominence.offbeatDotOpacity, `le numéro de mesure (opacité ${prominence.rowMeasureOpacity}) est plus visible que le point de contretemps (opacité ${prominence.offbeatDotOpacity})`);
    check(prominence.seqBeatLabelOpacity > prominence.offbeatDashOpacity, `le numéro de temps du séquenceur (opacité ${prominence.seqBeatLabelOpacity}) est plus visible que son trait de contretemps (opacité ${prominence.offbeatDashOpacity})`);

    // === 3. Les repères survivent à l'ouverture ET à la fermeture du volet du séquenceur ===
    // Cette section visait la LOUPE GRILLE : elle comptait les repères dans #grid-zoom-host puis
    // cliquait #grid-zoom-close. Ces deux identifiants ont zéro occurrence dans l'appli depuis la
    // suppression de la vue plein écran — le clic expirait donc sur un bouton qui n'arriverait jamais,
    // et la section 4 ci-dessous n'était plus jamais atteinte.
    // La grille ne déménage plus dans une fenêtre : ce qui reste à vérifier, c'est qu'ouvrir puis
    // refermer le volet (qui provoque un rendu complet, voir renderSequencer/loadProgression) ne fait
    // pas disparaître ses repères en route.
    const reperesAvant = await page.evaluate(() => document.querySelectorAll('.chord-grid .row-offbeat').length);
    await page.click('#grid-zoom');
    await page.waitForTimeout(500);
    const reperesVoletOuvert = await page.evaluate(() => document.querySelectorAll('.chord-grid .row-offbeat').length);
    console.log('repères — avant:', reperesAvant, '| volet ouvert:', reperesVoletOuvert);
    check(reperesVoletOuvert === reperesAvant, `les repères de la grille survivent à l'ouverture du volet (${reperesAvant} -> ${reperesVoletOuvert})`);
    await page.click('#grid-zoom');   // même bouton = referme (voir toggleSequencer)
    await page.waitForTimeout(400);
    const reperesApres = await page.evaluate(() => document.querySelectorAll('.chord-grid .row-offbeat').length);
    console.log('| volet refermé:', reperesApres);
    check(reperesApres === reperesAvant, `et à sa fermeture (${reperesApres})`);

    // === 4. Vérifie que le glisser sur la ligne des numéros de mesure fonctionne toujours (loop range) ===
    const loopDragOk = await page.evaluate(() => {
        const rm = document.querySelector('.row-measure');
        if (!rm) return false;
        const r = rm.getBoundingClientRect();
        const evDown = new PointerEvent('pointerdown', { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerId: 1 });
        rm.dispatchEvent(evDown);
        return true;
    });
    check(loopDragOk, "un pointerdown sur .row-measure est toujours reçu normalement (repère décoratif ne bloque rien)");
    // relâche proprement
    await page.mouse.up().catch(() => {});

    console.log('Errors:', JSON.stringify(errors));
    check(errors.length === 0, 'aucune erreur JavaScript pendant tout le scénario');
    await browser.close();
    bilan();
})();
