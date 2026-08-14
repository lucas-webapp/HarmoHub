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
    await page.click('#toggle-sequencer');
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
    // Le doigt descend (clientY croissant) -> le contenu suit le doigt -> scrollTop DIMINUE (on
    // remonte vers le haut de la page), convention tactile standard.
    check(afterPageScroll < startPageScroll, "un glissé vertical à 1 doigt sur une case VIDE fait défiler la page (fallback JS)");
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
    check(scrollAfterR < scrollBeforeR, "un glissé vertical démarré sur le BORD d'une note fait aussi défiler");
    check(JSON.stringify(patternBeforeR) === JSON.stringify(patternAfterR), "la note n'a PAS été redimensionnée par ce glissé vertical");

    await page.evaluate(() => document.getElementById('arp-sequencer').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(100);

    // === Test 3 (non-régression) : glissé vertical démarré sur le CORPS d'une note déclenche
    // toujours le changement de voix (comportement existant, ne doit pas être détourné vers un scroll). ===
    const midCell = await page.$('.seq-cell[data-voice="0"][data-step="1"]');
    const boxMid = await midCell.boundingBox();
    await page.evaluate(({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        const fire = (type, cy) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 53, pointerType: 'touch', clientX: x, clientY: cy, isPrimary: true }));
        fire('pointerdown', y);
        for (let i = 1; i <= 3; i++) fire('pointermove', y + i * 15);
    }, { x: boxMid.x + boxMid.width / 2, y: boxMid.y + boxMid.height / 2 });
    await page.waitForTimeout(100);
    const voiceDragActive = await page.evaluate(() => !!(app.seqDrag && app.seqDrag.voiceDrag));
    console.log('voiceDrag actif après glissé vertical sur le CORPS d\'une note:', voiceDragActive);
    check(voiceDragActive, "un glissé vertical sur le CORPS d'une note déclenche toujours le changement de voix (non régression)");
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
