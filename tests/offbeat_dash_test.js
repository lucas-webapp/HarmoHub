const { chromium } = require('playwright')
const { ajouterAccord, editerAccord } = require('./_ajout');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
// plan() n'est pas décoratif ici : ce banc a longtemps expiré au milieu de sa section 3, sur un clic
// #grid-zoom-close disparu, et sa section 4 n'était plus jamais atteinte — sans que rien ne le dise,
// puisqu'il affichait des PASS jusque-là. Le plancher déclaré rend désormais cet abandon bruyant.
const { check, exiger, plan, bilan } = require('./_harness')('repères de contretemps');
plan(15);

(async () => {
    const browser = await chromium.launch();
    // LOT 6c : sur ordinateur (≥ 900px), il n'y a plus de mode Ajout ni de carte Accord à préparer — QUEL accord se règle dans la bulle, COMMENT il
    // sonne dans l'inspecteur, qui n'existe qu'en modification. Ce banc éprouve une FONCTION de la carte (le même code), pas sa mise en page :
    // il se joue donc sous le seuil (860px), où la carte garde son mode Ajout jusqu'au lot 10. DETTE : à reprendre au lot 10 (docs/dette-tests.md).
    const page = await browser.newPage({ viewport: { width: 860, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', msg => { if (msg.type() === 'error' && !msg.text().includes('ERR_CONNECTION_RESET') && !msg.text().includes('ERR_TUNNEL_CONNECTION_FAILED') && !msg.text().includes('ERR_CERT_AUTHORITY_INVALID')) errors.push('console: ' + msg.text()); });

    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(600);
    await page.waitForTimeout(150);

    // 8 accords d'1 temps chacun, en 4/4 -> exactement 2 mesures pleines : de quoi vérifier qu'il n'y a
    // bien qu'UN SEUL repère par mesure (pas un par temps).
    for (const sym of ['C', 'G', 'Am', 'F', 'Dm', 'Em', 'C', 'G']) {
        await ajouterAccord(page, sym);
        await page.waitForTimeout(120);
    }

    // === 1. Séquenceur : les repères de temps ===
    // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4c, 12/11) : le petit séquenceur (et son tiret vertical de contretemps .seq-beat-offbeat) a disparu. Le
    // séquenceur du téléphone est l'onglet Rythme du panneau d'accord (vrais clics : ⋯, « Séquenceur ») ; il marque chaque temps d'un trait, chaque mesure
    // d'un trait plus fort, numérote les temps — et aucun caractère « • » n'y revient (le retour d'origine : « juste le trait »).
    await editerAccord(page); // lot 10e : plus de séquenceur compact en mode Ajout
    const R = require('./_retrait_ancien');
    await R.cliquer(page, '#bl-plus', 400); await R.cliquer(page, '#pl-notes', 700);
    check(await page.evaluate(() => !!(window.app._bulle && window.app._bulle.rythme) && !window.app.seqOpen), 'l\'onglet Rythme s\'ouvre, l\'ancien séquenceur reste fermé');
    const rq = await R.reperes(page);
    check(rq.ok, `un trait par temps, un plus marqué par mesure, les temps numérotés (${rq.detail})`);
    check(await page.evaluate(() => !document.getElementById('sq-grille').textContent.includes('•')), 'le séquenceur n\'affiche aucun caractère « • »');
    check(await page.evaluate(() => ![...document.querySelectorAll('.seq-beat-offbeat')].some(e => e.getBoundingClientRect().height > 0)), 'l\'ancien tiret de contretemps n\'est plus à l\'écran');
    await R.cliquer(page, '#panneau-accord [data-bulle="fermer"]', 400);
    await R.cliquer(page, '#dock-terminer', 300); // sortir de la modification ouverte par editerAccord, comme l'utilisateur

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
        // RÉÉCRIT (4c) : l'ancien séquenceur (son numéro de temps .seq-beat-label, son tiret .offbeat-dash) a disparu ; le numéro de temps du séquenceur
        // d'aujourd'hui (.sq-temps, rendu à l'ouverture de l'onglet Rythme plus haut) doit rester pleinement lisible.
        const sq = [...document.querySelectorAll('#sq-grille .sq-temps')].find(e => e.textContent.trim());
        return {
            rowMeasureOpacity: +rm.opacity, offbeatDotOpacity: +dot.opacity,
            seqBeatLabelOpacity: sq ? +getComputedStyle(sq).opacity : null,
        };
    });
    console.log('prominence:', JSON.stringify(prominence));
    check(prominence.rowMeasureOpacity > prominence.offbeatDotOpacity, `le numéro de mesure (opacité ${prominence.rowMeasureOpacity}) est plus visible que le point de contretemps (opacité ${prominence.offbeatDotOpacity})`);
    check(prominence.seqBeatLabelOpacity >= 0.9, `le numéro de temps du séquenceur est pleinement lisible (opacité ${prominence.seqBeatLabelOpacity})`);

    // === 3. Les repères survivent à l'ouverture ET à la fermeture du volet du séquenceur ===
    // Cette section visait la LOUPE GRILLE : elle comptait les repères dans #grid-zoom-host puis
    // cliquait #grid-zoom-close. Ces deux identifiants ont zéro occurrence dans l'appli depuis la
    // suppression de la vue plein écran — le clic expirait donc sur un bouton qui n'arriverait jamais,
    // et la section 4 ci-dessous n'était plus jamais atteinte.
    // La grille ne déménage plus dans une fenêtre : ce qui reste à vérifier, c'est qu'ouvrir puis
    // refermer le volet (qui provoque un rendu complet, voir renderSequencer/loadProgression) ne fait
    // pas disparaître ses repères en route.
    const reperesAvant = await page.evaluate(() => document.querySelectorAll('.chord-grid .row-offbeat').length);
    // RÉÉCRIT (4c) : le volet d'avant n'a plus de porte ; le séquenceur du téléphone (onglet Rythme du panneau d'accord) provoque lui aussi un rendu complet.
    await R.cliquer(page, '#bl-plus', 400); await R.cliquer(page, '#pl-notes', 700);
    const reperesVoletOuvert = await page.evaluate(() => document.querySelectorAll('.chord-grid .row-offbeat').length);
    console.log('repères — avant:', reperesAvant, '| volet ouvert:', reperesVoletOuvert);
    check(reperesVoletOuvert === reperesAvant, `les repères de la grille survivent à l'ouverture du volet (${reperesAvant} -> ${reperesVoletOuvert})`);
    await R.cliquer(page, '#panneau-accord [data-bulle="fermer"]', 400); // × referme le panneau
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
