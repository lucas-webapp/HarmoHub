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

    await page.evaluate(() => {
        const sel = document.getElementById('duration');
        sel.value = '8';
        sel.dispatchEvent(new Event('change'));
    });
    await page.waitForTimeout(200);
    await page.click('#toggle-sequencer');
    await page.waitForTimeout(300);

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

    // === Test 1 : glissé à 2 doigts avec évènements DÉLIBÉRÉMENT DÉSYNCHRONISÉS (comme un vrai
    // matériel tactile qui n'envoie jamais les deux doigts au même instant) : chaque doigt avance
    // TOUR À TOUR de 10px, jamais ensemble dans le même tick. Avec l'ancien calcul par point milieu
    // recalculé à chaque évènement, ce motif produisait des sauts irréguliers (mélange d'une position
    // fraîche et d'une périmée) ; avec le calcul par delta propre à chaque doigt (÷2), la progression
    // doit rester monotone (jamais un pas dans le mauvais sens) et le total doit correspondre au
    // déplacement physique réel des deux doigts.
    const scrollHistory = await page.evaluate(({ x1start, x2start, y }) => {
        const fire = (el, type, id, x, y2) => el.dispatchEvent(new PointerEvent(type, {
            bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch',
            clientX: x, clientY: y2, isPrimary: id === 1,
        }));
        const cellA = document.elementFromPoint(x1start, y);
        const cellB = document.elementFromPoint(x2start, y);
        fire(cellA, 'pointerdown', 1, x1start, y);
        fire(cellB, 'pointerdown', 2, x2start, y);
        const scrollEl = document.querySelector('#arp-sequencer .seq-scroll');
        const history = [scrollEl.scrollLeft];
        let ax = x1start, bx = x2start;
        // 10 pas, chaque doigt avance de 10px À TOUR DE RÔLE (jamais les deux dans le même tick)
        for (let i = 0; i < 10; i++) {
            if (i % 2 === 0) { ax -= 10; fire(cellA, 'pointermove', 1, ax, y); }
            else { bx -= 10; fire(cellB, 'pointermove', 2, bx, y); }
            history.push(scrollEl.scrollLeft);
        }
        fire(cellA, 'pointerup', 1, ax, y);
        fire(cellB, 'pointerup', 2, bx, y);
        // finalScroll n'est PAS lu ici : la fin du geste déclenche une repeinture (voir
        // _flushZoomPinchRender), qui remplace .seq-scroll — `scrollEl` désigne alors un nœud
        // détaché, dont le scrollLeft vaut 0 quoi qu'il arrive. On le relit plus bas, sur l'élément
        // réellement à l'écran, une fois la frame de restauration passée.
        return { history, totalPhysicalMove: (x1start - ax) }; // les deux ont bougé pareil au total
    }, { x1start, x2start, y });

    await page.waitForTimeout(200); // laisse passer la repeinture de fin de geste et sa frame
    scrollHistory.finalScroll = await page.evaluate(() => document.querySelector('#arp-sequencer .seq-scroll').scrollLeft);

    console.log('historique scrollLeft (désynchronisé):', JSON.stringify(scrollHistory.history));

    // Monotone croissant (jamais de retour en arrière) : chaque pas doit avancer ou stagner, jamais reculer.
    let monotonic = true;
    for (let i = 1; i < scrollHistory.history.length; i++) {
        if (scrollHistory.history[i] < scrollHistory.history[i - 1] - 0.01) { monotonic = false; break; }
    }
    check(monotonic, "le défilement reste monotone (jamais de petit à-coup en sens inverse) même avec des évènements désynchronisés");

    // Total : chaque doigt a bougé de 100px (10 pas de 10px répartis sur les 2, 5 chacun -> 50px par
    // doigt en réalité ici vu l'alternance) — le total attendu est le delta MOYEN des deux doigts.
    console.log('scroll final:', scrollHistory.finalScroll, '| déplacement physique par doigt:', scrollHistory.totalPhysicalMove);
    const expectedTotal = scrollHistory.totalPhysicalMove; // les deux doigts ont fait le même déplacement total
    check(Math.abs(scrollHistory.finalScroll - expectedTotal) < 2, `le défilement final (${scrollHistory.finalScroll}) correspond au déplacement réel des doigts (${expectedTotal}), sans sur/sous-comptage`);

    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})();
