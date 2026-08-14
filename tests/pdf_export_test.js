const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// La police est chargée depuis Google Fonts : injoignable derrière le proxy du bac à sable,
// jamais un problème chez l'utilisateur. Ces échecs réseau sont donc filtrés — sinon ils font
// échouer « aucune erreur console » et masquent les vraies erreurs au milieu du bruit.

(async () => {
    const browser = await chromium.launch({
        args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const page = await browser.newPage({ viewport: { width: 1400, height: 1400 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (msg) => { if (msg.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|fonts\.googleapis|fonts\.gstatic/.test(msg.text())) errors.push('console.error: ' + msg.text()); });

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        const mk = (root, quality, beats, drop, inversion) => ({ root, quality, beats, inversion: inversion || 0, drop: drop || 'none', octave: 4, bass: null, playStyle: 'held' });
        const sections = [
            { title: 'Couplets et refrain', chords: [mk('F', 'maj', 2), mk('A', 'min7', 2, 'drop2'), mk('D', 'min7', 2), mk('E', 'min7', 2, 'drop3')] },
        ];
        localStorage.setItem('myProgression', JSON.stringify({ sections }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);

    console.log('--- All chord cells in a row must have identical height ---');
    let html = await page.evaluate(() => {
        const { gridInner, voicingsInner } = window.app.buildPrintExportHtml();
        return gridInner + voicingsInner;
    });
    let r = await page.evaluate((html) => {
        const host = document.getElementById('print-export');
        host.style.display = 'block';
        host.innerHTML = html;
        const cells = Array.from(host.querySelectorAll('.print-chord-cell'));
        const heights = cells.map(c => Math.round(c.getBoundingClientRect().height));
        return { heights, uniform: new Set(heights).size === 1 };
    }, html);
    console.log(JSON.stringify(r));
    console.log(r.uniform ? 'PASS (all cells same height)' : 'FAIL');

    console.log('--- Badge format: O{octave}-R{n}-D{n}, only non-default parts shown ---');
    r = await page.evaluate(() => {
        const host = document.getElementById('print-export');
        const badges = Array.from(host.querySelectorAll('.print-chord-voicing-badge')).map(b => b.textContent);
        return badges;
    });
    console.log(JSON.stringify(r));
    const expected = ['O4', 'O4-D2', 'O4', 'O4-D3'];
    console.log((JSON.stringify(r) === JSON.stringify(expected)) ? 'PASS (badges match expected O/R/D notation)' : 'FAIL');

    console.log('--- No more direction arrows (▲/▼) anywhere ---');
    r = await page.evaluate(() => document.getElementById('print-export').innerHTML.includes('▲') || document.getElementById('print-export').innerHTML.includes('▼'));
    console.log('has arrows:', r);
    console.log(!r ? 'PASS (no direction arrows)' : 'FAIL');

    console.log('--- Measure numbers still correct ---');
    r = await page.evaluate(() => {
        const host = document.getElementById('print-export');
        return Array.from(host.querySelectorAll('.print-chord-measure')).map(m => m.textContent);
    });
    console.log(JSON.stringify(r));
    console.log((JSON.stringify(r) === JSON.stringify(['1', '2'])) ? 'PASS (measure numbers correct)' : 'FAIL');

    console.log('--- Les options PDF ont quitté les Paramètres pour la boîte d\'export ---');
    // Retour utilisateur : « ça prend trop de place dans les paramètres ». On se pose la question
    // au moment d'exporter, pas trois écrans plus loin — donc c'est la boîte d'export qui porte
    // désormais ces réglages, et les Paramètres n'en gardent aucune trace.
    await page.click('#open-settings');
    await page.waitForTimeout(300);
    r = await page.evaluate(() => ({
        hasOldDirectionToggle: !!document.getElementById('toggle-show-direction-pdf'),
        voicingDansParams: !!document.getElementById('toggle-show-voicing-pdf'),
        mesuresDansParams: !!document.getElementById('pdf-measures-per-line'),
    }));
    console.log(JSON.stringify(r));
    console.log((!r.hasOldDirectionToggle && !r.voicingDansParams && !r.mesuresDansParams) ? 'PASS (settings panel updated)' : 'FAIL');
    await page.click('#settings-close');
    await page.waitForTimeout(250);

    console.log('--- La boîte d\'export porte bien l\'option, et la décocher masque le badge ---');
    await page.click('#file-menu-btn');
    await page.waitForTimeout(250);
    await page.click('[data-file-action="pdf"]');
    await page.waitForTimeout(400);
    r = await page.evaluate(() => ({
        ouverte: !document.getElementById('pdf-export-modal').hidden,
        voicing: !!document.getElementById('pdf-opt-voicing'),
        diagrammes: !!document.getElementById('pdf-opt-diagrams'),
        mesures: !!document.getElementById('pdf-opt-measures'),
    }));
    console.log(JSON.stringify(r));
    console.log((r.ouverte && r.voicing && r.diagrammes && r.mesures) ? 'PASS (export dialog carries the options)' : 'FAIL');
    // Annuler ne doit RIEN retenir : on bascule l'option, on annule, le réglage mémorisé n'a pas
    // bougé (seul « Exporter » valide, voir openPdfExportDialog). C'est le contrat d'un bouton
    // Annuler, et c'est ce qui permet d'ouvrir la boîte juste pour regarder.
    const avant = await page.evaluate(() => window.app.showVoicingPdf);
    await page.click('#pdf-opt-voicing');
    await page.waitForTimeout(150);
    await page.click('#pdf-export-cancel');
    await page.waitForTimeout(250);
    r = await page.evaluate(() => window.app.showVoicingPdf);
    console.log('showVoicingPdf avant/après annulation :', avant, r);
    console.log((r === avant) ? 'PASS (Annuler ne retient rien)' : 'FAIL');

    console.log('--- « Position d\'accord » décochée : le badge disparaît du PDF ---');
    await page.evaluate(() => window.app.setShowVoicingPdf(false));
    await page.waitForTimeout(100);
    html = await page.evaluate(() => {
        const { gridInner, voicingsInner } = window.app.buildPrintExportHtml();
        return gridInner + voicingsInner;
    });
    r = await page.evaluate((html) => {
        const host = document.getElementById('print-export');
        host.innerHTML = html;
        return document.querySelectorAll('.print-chord-voicing-badge').length;
    }, html);
    console.log('badge count with setting off:', r);
    console.log((r === 0) ? 'PASS (badge hidden when setting is off)' : 'FAIL');

    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
