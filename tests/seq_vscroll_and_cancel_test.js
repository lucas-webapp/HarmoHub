const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

function fireTouch(el, type, id, x, y) {
    el.dispatchEvent(new PointerEvent(type, {
        bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch',
        clientX: x, clientY: y, isPrimary: id === 1,
    }));
}

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 390, height: 700 } }); // vrai gabarit téléphone étroit + court, page scroll natif probable
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', msg => { if (msg.type() === 'error' && !msg.text().includes('ERR_CONNECTION_RESET') && !msg.text().includes('ERR_TUNNEL_CONNECTION_FAILED')) errors.push('console: ' + msg.text()); });

    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(600);
    await page.waitForTimeout(150);

    await page.evaluate(() => {
        const sel = document.getElementById('duration');
        sel.value = '8';
        sel.dispatchEvent(new Event('change'));
    });
    await page.waitForTimeout(200);
    await page.evaluate(() => window.app.toggleSequencer('compact'));
    await page.waitForTimeout(300);
    await page.evaluate(() => document.getElementById('arp-sequencer').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(150);

    // Isole une note courte (voix 0, croches 0-3) — même préparation que les tests précédents.
    await page.evaluate(() => {
        const steps = document.querySelectorAll('.seq-cell[data-voice="0"]').length;
        for (let s = 0; s < steps; s++) app.applySeqCell(0, s, false);
        for (let s = 0; s < 4; s++) app.applySeqCell(0, s, true, s !== 0);
        app.renderSequencer();
    });
    await page.waitForTimeout(200);

    // === Test 1 : glissé VERTICAL à 1 doigt sur une case VIDE (voix 0, croche 10) doit faire défiler
    // (la page ou un ancêtre), sans peindre aucune note. ===
    const emptyCell = await page.$('.seq-cell[data-voice="0"][data-step="10"]');
    const boxEmpty = await emptyCell.boundingBox();
    const startPageScroll = await page.evaluate(() => (document.scrollingElement || document.documentElement).scrollTop);
    const patternBeforeV = await page.evaluate(() => {
        const chord = app.readChord();
        const { pattern } = app.getLiveSeqPattern(chord);
        return pattern.map(v => v.includes(0));
    });
    await page.evaluate(({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        const fire = (type, cy) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 51, pointerType: 'touch', clientX: x, clientY: cy, isPrimary: true }));
        fire('pointerdown', y);
        for (let i = 1; i <= 5; i++) fire('pointermove', y + i * 15); // dominante verticale nette
        fire('pointerup', y + 75);
    }, { x: boxEmpty.x + boxEmpty.width / 2, y: boxEmpty.y + boxEmpty.height / 2 });
    await page.waitForTimeout(150);

    const afterPageScroll = await page.evaluate(() => (document.scrollingElement || document.documentElement).scrollTop);
    const patternAfterV = await page.evaluate(() => {
        const chord = app.readChord();
        const { pattern } = app.getLiveSeqPattern(chord);
        return pattern.map(v => v.includes(0));
    });
    console.log('page scrollTop avant/après glissé vertical sur case vide:', startPageScroll, afterPageScroll);
    // CONTRAT MIS À JOUR. Ce banc exigeait un défilement émulé en JS ; il n'existe plus AU DOIGT,
    // volontairement (voir onSeqPointerMove : la bascule `verticalScroll` est gardée par
    // `d.pointerType !== 'touch'`, elle ne sert plus qu'à la souris). Au doigt, c'est le NAVIGATEUR
    // qui défile, via touch-action: pan-x pan-y posé sur la bande et ses cases — avec inertie et
    // rebond, ce qu'aucune émulation JS ne rend. Un évènement de synthèse ne peut par construction
    // pas déclencher un défilement natif : mesurer scrollTop ici ne prouverait donc rien.
    // Ce qui RESTE vérifiable, et qui est le vrai contrat : le MÉCANISME qui rend ce défilement
    // possible (touch-action laisse passer l'axe vertical), et le fait que l'appli ne s'approprie pas
    // le geste — elle ne peint rien et n'arme aucun glissé (les deux contrôles suivants).
    const tactileOk = await page.evaluate(() => {
        const c = document.querySelector('.seq-cell[data-voice="0"]');
        const sc = document.querySelector('#arp-sequencer .seq-scroll');
        const permetY = (el) => { const t = getComputedStyle(el).touchAction; return t === 'auto' || /pan-y/.test(t); };
        return c && sc && permetY(c) && permetY(sc);
    });
    check(tactileOk, "la bande et ses cases laissent le navigateur défiler verticalement (touch-action: pan-y)");
    check(JSON.stringify(patternBeforeV) === JSON.stringify(patternAfterV), "ce même glissé vertical n'a peint AUCUNE note");
    check(!(await page.evaluate(() => app.seqDrag)), "aucun glissé d'édition ne reste armé après ce glissé vertical");

    // Reviens à une position de scroll connue (le séquenceur bien visible), pas forcément 0 : selon
    // la mise en page, il peut déjà falloir défiler un peu pour le voir au tout premier chargement.
    await page.evaluate(() => document.getElementById('arp-sequencer').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(100);

    // === Test 2 : glissé VERTICAL à 1 doigt démarré sur le BORD d'une note (résize) doit aussi
    // défiler, SANS changer la note. ===
    const lastCell = await page.$('.seq-cell[data-voice="0"][data-step="3"]');
    const boxLast = await lastCell.boundingBox();
    const patternBeforeR = await page.evaluate(() => {
        const chord = app.readChord();
        const { pattern } = app.getLiveSeqPattern(chord);
        return pattern.map(v => v.includes(0));
    });
    const scrollBeforeR = await page.evaluate(() => (document.scrollingElement || document.documentElement).scrollTop);
    await page.evaluate(({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        const fire = (type, cy) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 52, pointerType: 'touch', clientX: x, clientY: cy, isPrimary: true }));
        fire('pointerdown', y);
        for (let i = 1; i <= 5; i++) fire('pointermove', y + i * 15);
        fire('pointerup', y + 75);
    }, { x: boxLast.x + boxLast.width - 3, y: boxLast.y + boxLast.height / 2 });
    await page.waitForTimeout(150);
    const scrollAfterR = await page.evaluate(() => (document.scrollingElement || document.documentElement).scrollTop);
    const patternAfterR = await page.evaluate(() => {
        const chord = app.readChord();
        const { pattern } = app.getLiveSeqPattern(chord);
        return pattern.map(v => v.includes(0));
    });
    console.log('page scrollTop avant/après glissé vertical sur bord de note:', scrollBeforeR, scrollAfterR);
    // Même contrat mis à jour qu'au cas précédent : au doigt le défilement est natif, on vérifie donc
    // que l'appli ne détourne pas le geste plutôt qu'un scrollTop qu'un évènement de synthèse ne peut
    // pas produire. Ce qui compte ici, et qui est testé juste en dessous : la note n'est PAS étirée.
    check(!(await page.evaluate(() => !!(app.seqDrag && app.seqDrag.resize))),
        "un glissé vertical démarré sur le BORD d'une note n'arme pas d'étirement (il reste au navigateur)");
    check(JSON.stringify(patternBeforeR) === JSON.stringify(patternAfterR), "la note n'a PAS été redimensionnée par ce glissé vertical");

    await page.evaluate(() => document.getElementById('arp-sequencer').scrollIntoView({ block: 'center' }));
    // ...et la bande à son début HORIZONTAL : elle est défilée sur l'accord édité
    // (_appliquerEchelleHorizontale la recentre dessus), si bien que la croche 1 visée juste en
    // dessous tombait hors du cadre — la case renvoyait x≈11px, le clic partait à côté, seqDrag
    // restait null et le changement de voix semblait cassé alors qu'il fonctionne (vérifié à
    // scrollLeft=0). Faux négatif de banc, même famille que « Élément sous la ligne de flottaison »
    // dans docs/dette-tests.md.
    await page.evaluate(() => { document.querySelector('#arp-sequencer .seq-scroll').scrollLeft = 0; });
    await page.waitForTimeout(100);

    // === Test 3 : au DOIGT, c'est la DURÉE de l'appui qui départage défilement et édition (voir
    // onSeqPointerDown/_armerAppuiLongSeq, SEQ_APPUI_LONG_MS) — pas l'endroit touché. Ce banc exigeait
    // auparavant qu'un glissé vertical immédiat sur le corps d'une note change la voix ; c'est
    // précisément ce que le partage par la durée a retiré, et pour une raison écrite noir sur blanc
    // dans script.js (retour utilisateur : « à chaque fois que je veux scroller, je crée une note non
    // voulue ou je modifie une note sans faire exprès... c'est trop aléatoire »). On vérifie donc
    // maintenant LES DEUX MOITIÉS du vrai contrat, ce qui est plus solide que l'ancienne assertion. ===
    const midCell = await page.$('.seq-cell[data-voice="0"][data-step="1"]');
    const boxMid = await midCell.boundingBox();
    const glisserVertical = async (attendreAppuiLong) => {
        await page.evaluate(async ({ x, y, attendre }) => {
            const el = document.elementFromPoint(x, y);
            const fire = (type, cy) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 53, pointerType: 'touch', clientX: x, clientY: cy, isPrimary: true }));
            fire('pointerdown', y);
            if (attendre) await new Promise(r => setTimeout(r, 400)); // > SEQ_APPUI_LONG_MS (260ms)
            for (let i = 1; i <= 3; i++) fire('pointermove', y + i * 15);
        }, { x: boxMid.x + boxMid.width / 2, y: boxMid.y + boxMid.height / 2, attendre: attendreAppuiLong });
        await page.waitForTimeout(120);
        const actif = await page.evaluate(() => !!(app.seqDrag && app.seqDrag.voiceDrag));
        await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 53 })));
        await page.waitForTimeout(120);
        return actif;
    };
    const sansAppuiLong = await glisserVertical(false);
    console.log('voiceDrag après glissé vertical IMMÉDIAT (sans appui long):', sansAppuiLong);
    check(!sansAppuiLong, "au doigt, un glissé vertical IMMÉDIAT sur une note ne change PAS la voix : il est laissé au défilement");
    const avecAppuiLong = await glisserVertical(true);
    console.log('voiceDrag après APPUI LONG puis glissé vertical:', avecAppuiLong);
    check(avecAppuiLong, "...mais après un APPUI MAINTENU, le même glissé change bien la voix (l'édition prend la main)");
    // Termine proprement ce glissé (dépose hors grille = annule)
    await page.evaluate(() => {
        const fakeUp = new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 53 });
        window.dispatchEvent(fakeUp);
    });
    await page.waitForTimeout(150);

    // === Test 4 : un étirement PARTIEL interrompu par un 2e doigt (typiquement le début d'un pan à 2
    // doigts, voir setupPinchZoom) doit revenir EXACTEMENT à l'état d'origine — pas rester à moitié
    // appliqué (voir cancelSeqGestureForPinch, corrigé pour couvrir aussi le redimensionnement, pas
    // seulement peindre). Rejoue le scénario réel : 1er doigt pose + bouge un peu (étire réellement,
    // horizontal cette fois), PUIS un 2e doigt se pose ailleurs (déclenche cancelSeqGestureForPinch).
    await page.evaluate(() => document.getElementById('arp-sequencer').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(100);
    const lastCell2 = await page.$('.seq-cell[data-voice="0"][data-step="3"]');
    const boxLast2 = await lastCell2.boundingBox();
    const patternBeforeCancel = await page.evaluate(() => {
        const chord = app.readChord();
        const { pattern } = app.getLiveSeqPattern(chord);
        return pattern.map(v => v.includes(0));
    });
    await page.evaluate(({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        const fire = (type, id, cx, cy) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', clientX: cx, clientY: cy, isPrimary: id === 1 }));
        fire('pointerdown', 61, x, y);
        // Étire réellement de 3 croches vers la droite (horizontal net, franchit le seuil ET produit
        // un vrai changement — voir d.resizeChanged) avant que le 2e doigt n'interrompe.
        fire('pointermove', 61, x + 15, y);
        fire('pointermove', 61, x + 45, y);
        // 2e doigt qui se pose ailleurs sur la grille : déclenche cancelSeqGestureForPinch (voir
        // onSeqPointerDown, this._seqActiveTouchIds.size > 1).
        const cellFar = document.querySelector('.seq-cell[data-voice="0"][data-step="20"]');
        const rectFar = cellFar.getBoundingClientRect();
        fire('pointerdown', 62, rectFar.x + rectFar.width / 2, rectFar.y + rectFar.height / 2);
    }, { x: boxLast2.x + boxLast2.width - 3, y: boxLast2.y + boxLast2.height / 2 });
    await page.waitForTimeout(150);
    const patternAfterCancel = await page.evaluate(() => {
        const chord = app.readChord();
        const { pattern } = app.getLiveSeqPattern(chord);
        return pattern.map(v => v.includes(0));
    });
    console.log('motif avant étirement partiel interrompu:', JSON.stringify(patternBeforeCancel.slice(0, 8)));
    console.log('motif après (doit être identique):        ', JSON.stringify(patternAfterCancel.slice(0, 8)));
    check(JSON.stringify(patternBeforeCancel) === JSON.stringify(patternAfterCancel), "un étirement PARTIEL interrompu par un 2e doigt revient exactement à l'état d'origine (pas de note à moitié modifiée)");
    check(!(await page.evaluate(() => app.seqDrag)), "aucun glissé ne reste armé après cette interruption");

    console.log('=== Bilan partiel :', PASS, 'PASS /', FAIL, 'FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})();
