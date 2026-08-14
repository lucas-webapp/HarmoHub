const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

let PASS = 0, FAIL = 0;
function check(cond, label) {
    if (cond) { PASS++; console.log('PASS - ' + label); }
    else { FAIL++; console.log('FAIL - ' + label); }
}

(async () => {
    const browser = await chromium.launch({
        args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const page = await browser.newPage({ viewport: { width: 390, height: 700 }, hasTouch: true, isMobile: true });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (msg) => { if (msg.type() === 'error' && !msg.text().includes('CONNECTION') && !msg.text().includes('TUNNEL')) errors.push('console.error: ' + msg.text()); });

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [
            { root: 'C', quality: 'maj', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
            { root: 'F', quality: 'maj', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
            { root: 'G', quality: 'maj', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
        ] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);
    await page.evaluate(() => window.app.openGridZoom());
    await page.waitForTimeout(150);

    console.log('=== Undo/Redo relayés dans l\'en-tête de la loupe grille ===');
    const btnsExist = await page.evaluate(() => ({
        undo: !!document.getElementById('grid-zoom-undo'),
        redo: !!document.getElementById('grid-zoom-redo'),
        undoDisabledInitially: document.getElementById('grid-zoom-undo').disabled,
    }));
    check(btnsExist.undo && btnsExist.redo, 'les boutons annuler/rétablir existent dans la loupe grille');
    check(btnsExist.undoDisabledInitially === true, 'annuler désactivé au départ (aucun historique)');

    const beforeCount = await page.evaluate(() => document.querySelectorAll('.grid-cell').length);
    await page.evaluate(() => window.app.removeChord(0, 0)); // vraie modif de grille -> peuple l'historique
    await page.waitForTimeout(80);
    const afterDeleteCount = await page.evaluate(() => document.querySelectorAll('.grid-cell').length);
    const afterUndoBtnState = await page.evaluate(() => document.getElementById('grid-zoom-undo').disabled);
    console.log('cells before/after delete:', beforeCount, afterDeleteCount, 'undoDisabled after edit:', afterUndoBtnState);
    check(afterDeleteCount === beforeCount - 1, 'removeChord a bien supprimé un accord de la grille');
    check(afterUndoBtnState === false, "le bouton annuler de la loupe s'active bien après une modification de la grille");

    await page.evaluate(() => document.getElementById('grid-zoom-undo').click());
    await page.waitForTimeout(80);
    const afterUndoCount = await page.evaluate(() => document.querySelectorAll('.grid-cell').length);
    check(afterUndoCount === beforeCount, "cliquer sur « Annuler » dans la loupe restaure bien l'accord supprimé");

    const redoDisabledAfterUndo = await page.evaluate(() => document.getElementById('grid-zoom-redo').disabled);
    check(redoDisabledAfterUndo === false, "le bouton rétablir de la loupe s'active bien après un annuler");
    await page.evaluate(() => document.getElementById('grid-zoom-redo').click());
    await page.waitForTimeout(80);
    const afterRedoCount = await page.evaluate(() => document.querySelectorAll('.grid-cell').length);
    check(afterRedoCount === beforeCount - 1, "cliquer sur « Rétablir » dans la loupe réapplique bien la suppression");
    // Remet dans l'état d'origine pour la suite du test (pincement)
    await page.evaluate(() => document.getElementById('grid-zoom-undo').click());
    await page.waitForTimeout(80);

    console.log('=== Pincer-zoomer (2 doigts) sur de VRAIES .grid-cell dans la loupe grille : pas de réordonnancement parasite ===');
    const beforeOrder = await page.evaluate(() => Array.from(document.querySelectorAll('.grid-cell .cell-sym')).map(e => e.textContent.trim()));
    const beforeZoom = await page.evaluate(() => ({ x: window.app.gridZoomLevelX, y: window.app.gridZoomLevelY }));
    const pinchResult = await page.evaluate(() => {
        const cells = document.querySelectorAll('.grid-cell');
        const cellA = cells[0], cellB = cells[1];
        const rA = cellA.getBoundingClientRect(), rB = cellB.getBoundingClientRect();
        const mk = (type, id, r, dx=0, dy=0) => new PointerEvent(type, {
            pointerId: id, pointerType: 'touch', clientX: r.left + r.width/2 + dx, clientY: r.top + r.height/2 + dy, bubbles: true, cancelable: true,
        });
        cellA.dispatchEvent(mk('pointerdown', 1, rA));
        cellB.dispatchEvent(mk('pointerdown', 2, rB));
        cellA.dispatchEvent(mk('pointermove', 1, rA, -30, 0));
        cellB.dispatchEvent(mk('pointermove', 2, rB, 30, 0));
        cellA.dispatchEvent(mk('pointermove', 1, rA, -60, 0));
        cellB.dispatchEvent(mk('pointermove', 2, rB, 60, 0));
        cellA.dispatchEvent(mk('pointerup', 1, rA));
        cellB.dispatchEvent(mk('pointerup', 2, rB));
        return { zoomX: window.app.gridZoomLevelX, zoomY: window.app.gridZoomLevelY, drag: window.app.drag, activeTouches: [...window.app._gridActiveTouchIds] };
    });
    await page.waitForTimeout(80);
    const afterOrder = await page.evaluate(() => Array.from(document.querySelectorAll('.grid-cell .cell-sym')).map(e => e.textContent.trim()));
    console.log(JSON.stringify({ beforeOrder, afterOrder, beforeZoom, pinchResult }));

    check(JSON.stringify(beforeOrder) === JSON.stringify(afterOrder), "l'ordre des accords n'a PAS changé pendant le pincement (pas de glisser-réordonner parasite)");
    check(pinchResult.zoomX > beforeZoom.x && pinchResult.zoomY > beforeZoom.y, 'le pincement a bien zoomé les 2 axes (H et V) sur la grille en loupe');
    check(pinchResult.drag === null, "aucun glisser de case ne reste actif après le pincement");
    check(pinchResult.activeTouches.length === 0, 'plus aucun doigt suivi comme actif après le relâchement des deux');

    console.log('\n=== Bilan : ' + PASS + ' PASS / ' + FAIL + ' FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
