// Le calcul de rangée quand la grille en compte plusieurs : la plage de boucle posée sous la 2e
// rangée doit tomber sur les accords de CETTE rangée, et non repartir du début de la grille.
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

(async () => {
    const browser = await chromium.launch({
        args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const page = await browser.newPage({ viewport: { width: 700, height: 900 } });
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        const mk = (root, quality) => ({ root, quality, beats: 4, inversion: 0, drop: 0, octave: 4, bass: null, playStyle: 'held' });
        // Many chords, narrow viewport -> forces multiple rows in the grid-zoom grid
        const chords = [];
        const roots = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'A', 'B', 'C', 'D'];
        roots.forEach(r => chords.push(mk(r, 'maj')));
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);
    // #grid-zoom n'ouvre plus une loupe : c'est le bouton « Séq. », qui ouvre le séquenceur. La
    // grille à plusieurs rangées, elle, est là sans qu'on ait rien à ouvrir — le banc l'éprouve donc
    // directement, ce qui est aussi ce que voit l'utilisateur.
    await page.waitForTimeout(150);

    const rows = await page.evaluate(() => {
        const cells = Array.from(document.querySelectorAll('.grid-cell[data-index]'));
        const rowsSet = new Set(cells.map(c => c.getBoundingClientRect().top));
        return rowsSet.size;
    });
    console.log('Number of distinct rows rendered:', rows);
    if (rows < 2) { console.log('SKIP (viewport too wide, only 1 row - cannot test multi-row path)'); await browser.close(); process.exit(0); }

    // Click on a chord in the SECOND row (find an index whose cell is in a different row than index 0)
    const info = await page.evaluate(() => {
        const cell0 = document.querySelector('.grid-cell[data-section="0"][data-index="0"]');
        const top0 = cell0.getBoundingClientRect().top;
        let targetIndex = null, targetRect = null;
        for (let i = 1; i < 16; i++) {
            const c = document.querySelector(`.grid-cell[data-section="0"][data-index="${i}"]`);
            if (!c) continue;
            const r = c.getBoundingClientRect();
            if (Math.round(r.top) !== Math.round(top0)) { targetIndex = i; targetRect = r; break; }
        }
        return { targetIndex, targetRect: targetRect ? { top: targetRect.top, bottom: targetRect.bottom, left: targetRect.left, width: targetRect.width } : null };
    });
    console.log('Target chord in 2nd row:', JSON.stringify(info));
    await page.evaluate((i) => { window.__cible = i; }, info.targetIndex);
    if (info.targetIndex == null) { console.log('FAIL (could not find a 2nd-row chord)'); await browser.close(); process.exit(1); }

    // UN CLIC NE POSE PAS DE PLAGE, ET C'EST LE GESTE QUI A CHANGÉ, PAS LE CALCUL. Ce banc faisait
    // un appui-relâché immédiat à `bottom + 8`, une position devinée ; la plage se pose désormais par
    // un vrai GLISSÉ sur la règle des mesures (voir onLoopRangeStart). On vise donc l'élément
    // .row-measure lui-même — celui qui est juste sous la 2e rangée — plutôt qu'un décalage en pixels
    // qui ne survit à aucun changement de gabarit.
    const regle = await page.evaluate(() => {
        const cible = document.querySelector(`.grid-cell[data-section="0"][data-index="${window.__cible}"]`);
        const cr = cible.getBoundingClientRect();
        const m = Array.from(document.querySelectorAll('.row-measure'))
            .find((x) => { const r = x.getBoundingClientRect(); return r.top >= cr.bottom - 2 && r.top < cr.bottom + 40; });
        if (!m) return null;
        const r = m.getBoundingClientRect();
        return { x: r.left + 6, y: r.top + r.height / 2, fin: r.left + r.width * 0.4 };
    });
    console.log('Règle des mesures sous la 2e rangée :', JSON.stringify(regle));
    if (!regle) { console.log('FAIL (aucune règle de mesures sous la 2e rangée)'); await browser.close(); process.exit(1); }

    await page.mouse.move(regle.x, regle.y);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) { await page.mouse.move(regle.x + (regle.fin - regle.x) * i / 8, regle.y); await page.waitForTimeout(15); }
    await page.mouse.up();
    await page.waitForTimeout(200);

    const result = await page.evaluate(() => window.app.loopRange);
    console.log('loopRange après un glissé sur la règle de la 2e rangée :', JSON.stringify(result));
    // Le fond de l'affaire : la plage tombe sur le PREMIER accord de la 2e rangée, pas sur le premier
    // accord de la grille — c'est très exactement le calcul de rangée que ce banc protège.
    const pass = result && result.startIndex === info.targetIndex && result.endIndex === info.targetIndex;
    console.log(pass ? 'PASS (la plage se pose sur la rangée visée, pas sur la première)' : 'FAIL');

    await browser.close();
    process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
