const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 480, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', msg => { if (msg.type() === 'error' && !msg.text().includes('ERR_CONNECTION_RESET') && !msg.text().includes('ERR_TUNNEL_CONNECTION_FAILED')) errors.push('console: ' + msg.text()); });

    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(600);
    await page.waitForTimeout(150);

    // Accord de 2 mesures pour avoir un vrai débordement scrollable (voir wideCompact)
    await page.evaluate(() => {
        const sel = document.getElementById('duration');
        sel.value = '8';
        sel.dispatchEvent(new Event('change'));
    });
    await page.waitForTimeout(200);
    await page.click('#toggle-sequencer');
    await page.waitForTimeout(300);

    // Isole une note courte (voix 0, croches 0-3) comme dans le test d'auto-scroll — sinon "Tenu"
    // couvre toute la durée et il n'y a aucun bord franc à observer pour la sécurité anti-édition.
    await page.evaluate(() => {
        const steps = document.querySelectorAll('.seq-cell[data-voice="0"]').length;
        for (let s = 0; s < steps; s++) app.applySeqCell(0, s, false);
        for (let s = 0; s < 4; s++) app.applySeqCell(0, s, true, s !== 0);
        app.renderSequencer();
    });
    await page.waitForTimeout(200);

    const patternBefore = await page.evaluate(() => {
        const chord = app.readChord();
        const { pattern } = app.getLiveSeqPattern(chord);
        return pattern.map(v => v.includes(0));
    });

    // === Glissé à DEUX doigts (simulé, pointerType 'touch') sur les cases : doit faire défiler
    // .seq-scroll SANS modifier une seule note. Dispatché directement sur les éléments concernés
    // (bulle jusqu'à #arp-sequencer, où setupPinchZoom({pan:true}) est posé) plutôt que via l'API
    // souris de Playwright, qui ne simule pas nativement le multi-touch.
    const cellsRow0 = await page.$$('.seq-cell[data-voice="0"]');
    // Le séquenceur est plus bas que l'écran sur ce petit gabarit : sans l'amener à l'écran,
    // elementFromPoint renvoie null et le geste part dans le vide (« Cannot read properties of null
    // (reading 'dispatchEvent') ») — un faux négatif, pas un défaut de l'appli.
    await page.evaluate(() => {
        const el = document.querySelector('#arp-sequencer .seq-scroll') || document.getElementById('arp-sequencer');
        if (el) el.scrollIntoView({ block: 'center' });
    });
    await page.waitForTimeout(250);
    // Coordonnées prises DANS la page (getBoundingClientRect), pas via boundingBox() de Playwright :
    // la première est relative à la fenêtre, la seconde à la page entière. Tant que rien n'avait
    // défilé les deux coïncidaient ; depuis qu'on amène le séquenceur à l'écran (voir juste au-
    // dessus), elles divergent — et elementFromPoint, qui raisonne en coordonnées de fenêtre,
    // désignait alors le mauvais élément. Le geste partait à côté et rien ne défilait.
    const { x1start, x2start, y } = await page.evaluate(() => {
        const cells = document.querySelectorAll('.seq-cell[data-voice="0"]');
        const b0 = cells[0].getBoundingClientRect(), b5 = cells[5].getBoundingClientRect();
        return { x1start: b0.x + b0.width / 2, x2start: b5.x + b5.width / 2, y: b0.y + b0.height / 2 };
    });

    const beforeScroll = await page.evaluate(() => document.querySelector('#arp-sequencer .seq-scroll').scrollLeft);

    await page.evaluate(({ x1start, x2start, y }) => {
        const seqEl = document.getElementById('arp-sequencer');
        const cellA = document.elementFromPoint(x1start, y);
        const cellB = document.elementFromPoint(x2start, y);
        const fire = (el, type, id, x, y2) => {
            el.dispatchEvent(new PointerEvent(type, {
                bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch',
                clientX: x, clientY: y2, isPrimary: id === 1,
            }));
        };
        fire(cellA, 'pointerdown', 1, x1start, y);
        fire(cellB, 'pointerdown', 2, x2start, y);
        // 6 pas de glissé, les deux doigts se déplacent ENSEMBLE de 20px vers la gauche à chaque pas
        // (écart constant entre eux -> un pan pur, pas un pincement).
        for (let i = 1; i <= 6; i++) {
            const dx = -20 * i;
            fire(cellA, 'pointermove', 1, x1start + dx, y);
            fire(cellB, 'pointermove', 2, x2start + dx, y);
        }
        fire(cellA, 'pointerup', 1, x1start - 120, y);
        fire(cellB, 'pointerup', 2, x2start - 120, y);
    }, { x1start, x2start, y });
    await page.waitForTimeout(150);

    const afterScroll = await page.evaluate(() => document.querySelector('#arp-sequencer .seq-scroll').scrollLeft);
    console.log('scrollLeft avant/après pan à 2 doigts:', beforeScroll, afterScroll);
    check(afterScroll > beforeScroll, 'le glissé à 2 doigts fait bien défiler la vue (scrollLeft augmente)');

    const patternAfter = await page.evaluate(() => {
        const chord = app.readChord();
        const { pattern } = app.getLiveSeqPattern(chord);
        return pattern.map(v => v.includes(0));
    });
    const patternUnchanged = JSON.stringify(patternBefore) === JSON.stringify(patternAfter);
    console.log('motif avant:', JSON.stringify(patternBefore.slice(0, 8)));
    console.log('motif après:', JSON.stringify(patternAfter.slice(0, 8)));
    check(patternUnchanged, "le glissé à 2 doigts n'a modifié AUCUNE note (pas de peinture/effacement accidentel)");

    const dragStateAfter = await page.evaluate(() => app.seqDrag);
    check(!dragStateAfter, "aucun glissé d'édition (seqDrag) ne reste armé après le geste à 2 doigts");

    // === Sanity : un glissé à UN SEUL doigt (touch) continue de peindre normalement (non régression) ===
    await page.evaluate(() => { document.querySelector('#arp-sequencer .seq-scroll').scrollLeft = 0; });
    await page.waitForTimeout(150);
    const emptyCell = await page.$('.seq-cell[data-voice="0"][data-step="10"]');
    const box10 = await emptyCell.boundingBox();
    await page.evaluate(({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        const fire = (type, cx) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 99, pointerType: 'touch', clientX: cx, clientY: y, isPrimary: true }));
        fire('pointerdown', x);
        for (let i = 1; i <= 4; i++) fire('pointermove', x + i * 4);
        fire('pointerup', x + 20);
    }, { x: box10.x + box10.width / 2, y: box10.y + box10.height / 2 });
    await page.waitForTimeout(200);
    const patternSingleFinger = await page.evaluate(() => {
        const chord = app.readChord();
        const { pattern } = app.getLiveSeqPattern(chord);
        return pattern[10].includes(0);
    });
    check(patternSingleFinger === true, 'un glissé à 1 seul doigt continue de peindre normalement (non régression)');

    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})();
