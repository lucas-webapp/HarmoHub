const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// La police est chargée depuis Google Fonts : injoignable derrière le proxy du bac à sable,
// jamais un problème chez l'utilisateur. Ces échecs réseau sont donc filtrés — sinon ils font
// échouer « aucune erreur console » et masquent les vraies erreurs au milieu du bruit.
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1000, height: 1200 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (msg) => { if (msg.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|fonts\.googleapis|fonts\.gstatic/.test(msg.text())) errors.push('console.error: ' + msg.text()); });

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        // Reproduit le cas du screenshot : G(1 mesure), D(1 mesure), Am(2 mesures) sur une même ligne,
        // puis G, D, C(2 mesures) sur la suivante (8 mesures au total, comme la capture utilisateur).
        const mk = (root, quality, beats) => ({ root, quality, beats, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
        const sections = [{ title: '', chords: [
            mk('G', 'maj', 4), mk('D', 'maj', 4), mk('A', 'min', 8),
            mk('G', 'maj', 4), mk('D', 'maj', 4), mk('C', 'maj', 8),
        ] }];
        localStorage.setItem('myProgression', JSON.stringify({ sections }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);

    const html = await page.evaluate(() => {
        const { gridInner } = window.app.buildPrintExportHtml();
        return gridInner;
    });
    await page.evaluate((html) => {
        const host = document.getElementById('print-export');
        host.style.display = 'block';
        host.style.width = '800px';
        host.innerHTML = html;
    }, html);
    await page.waitForTimeout(100);

    const r = await page.evaluate(() => {
        const host = document.getElementById('print-export');
        const rows = Array.from(host.querySelectorAll('.print-chord-row'));
        const rulers = Array.from(host.querySelectorAll('.print-measure-ruler'));
        const out = [];
        rows.forEach((row, ri) => {
            const wraps = Array.from(row.querySelectorAll('.print-chord-wrap'));
            const bars = Array.from(rulers[ri].querySelectorAll('.ruler-bar'));
            out.push({
                row: ri,
                wrapEdges: wraps.map(w => { const r = w.getBoundingClientRect(); return { left: Math.round(r.left * 100) / 100, right: Math.round(r.right * 100) / 100 }; }),
                barEdges: bars.map(b => { const r = b.getBoundingClientRect(); return { left: Math.round(r.left * 100) / 100, right: Math.round(r.right * 100) / 100 }; }),
            });
        });
        return out;
    });
    console.log(JSON.stringify(r, null, 2));

    // Row 0: G(1 measure) | D(1 measure) | Am(2 measures) => wraps: [G, D, Am], bars: [m1, m2, m3, m4]
    // Expect: wrap[0].right ~= bar[0].right (G ends at measure 1 boundary)
    //         wrap[1].right ~= bar[1].right (D ends at measure 2 boundary)
    //         wrap[2].right ~= bar[3].right (Am ends at measure 4 boundary, spans bar2+bar3)
    const row0 = r[0];
    const tol = 1.0; // px tolerance
    const checks = [
        ['G right == measure1 right', row0.wrapEdges[0].right, row0.barEdges[0].right],
        ['D right == measure2 right', row0.wrapEdges[1].right, row0.barEdges[1].right],
        ['Am right == measure4 (last bar) right', row0.wrapEdges[2].right, row0.barEdges[3].right],
        ['first wrap left == first bar left', row0.wrapEdges[0].left, row0.barEdges[0].left],
    ];
    let allPass = true;
    for (const [label, a, b] of checks) {
        const diff = Math.abs(a - b);
        const pass = diff <= tol;
        if (!pass) allPass = false;
        console.log(`${label}: ${a} vs ${b} (diff ${diff.toFixed(2)}px) ${pass ? 'PASS' : 'FAIL'}`);
    }
    console.log(allPass ? 'ALL ALIGNMENT CHECKS PASS' : 'SOME ALIGNMENT CHECKS FAILED');

    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
})();
