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
        // 7 mesures en 4/4 (4 temps/mesure) : une section de 7 accords d'une mesure chacun.
        const mk = (root, quality, beats) => ({ root, quality, beats, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' });
        const sections = [
            { title: 'Pont & Outro', chords: [mk('F', 'maj', 4), mk('G', 'maj', 4), mk('A', 'min', 4), mk('D', 'min', 4), mk('Bb', 'maj', 4), mk('C', 'maj', 4), mk('F', 'maj', 4)] },
        ];
        localStorage.setItem('myProgression', JSON.stringify({ sections }));
        localStorage.setItem('harmohubPdfMeasuresPerLine', '4');
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);

    console.log('--- Fixed scale: first row (4 measures) and second row (3 measures) use the SAME per-beat width ---');
    let html = await page.evaluate(() => {
        const { gridInner } = window.app.buildPrintExportHtml();
        return gridInner;
    });
    let r = await page.evaluate((html) => {
        const host = document.getElementById('print-export');
        host.style.display = 'block';
        host.innerHTML = html;
        const rows = Array.from(host.querySelectorAll('.print-chord-row'));
        return rows.map(row => {
            const wraps = Array.from(row.querySelectorAll('.print-chord-wrap'));
            return wraps.map(w => w.style.width);
        });
    }, html);
    console.log(JSON.stringify(r));
    // Chaque accord fait 1 mesure = 4 temps. Ligne 1 (4 mesures/16 temps fixes) : chaque case doit faire 25%.
    // Ligne 2 (3 accords, même dénominateur fixe de 16 temps) : chaque case doit AUSSI faire 25% (PAS 33.33%).
    const row1widths = r[0].map(w => parseFloat(w));
    const row2widths = r[1].map(w => parseFloat(w));
    const row1ok = row1widths.every(w => Math.abs(w - 25) < 0.01);
    const row2ok = row2widths.every(w => Math.abs(w - 25) < 0.01);
    console.log('row1:', row1widths, 'row2:', row2widths);
    console.log((row1ok && row2ok) ? 'PASS (fixed scale, same % per beat across rows)' : 'FAIL');

    console.log('--- Ruler bars: same fixed-scale width across rows too ---');
    r = await page.evaluate(() => {
        const host = document.getElementById('print-export');
        const rulers = Array.from(host.querySelectorAll('.print-measure-ruler'));
        return rulers.map(ru => Array.from(ru.querySelectorAll('.ruler-bar')).map(b => b.style.width));
    });
    console.log(JSON.stringify(r));
    const ruler1ok = r[0].every(w => Math.abs(parseFloat(w) - 25) < 0.01);
    const ruler2ok = r[1].every(w => Math.abs(parseFloat(w) - 25) < 0.01);
    console.log((ruler1ok && ruler2ok) ? 'PASS (ruler bars match fixed scale)' : 'FAIL');

    console.log('--- End-of-line measure number present only on last bar of each row ---');
    r = await page.evaluate(() => {
        const host = document.getElementById('print-export');
        const rulers = Array.from(host.querySelectorAll('.print-measure-ruler'));
        return rulers.map(ru => {
            const bars = Array.from(ru.querySelectorAll('.ruler-bar'));
            return bars.map(b => ({
                num: b.querySelector('.ruler-num')?.textContent,
                endNum: b.querySelector('.ruler-num-end')?.textContent || null,
            }));
        });
    });
    console.log(JSON.stringify(r));
    // Ligne 1: mesures 1-4, seule la case "4" doit avoir un endNum ("4"). Ligne 2: mesures 5-7, seule la case "7".
    const row1EndOk = r[0].filter(b => b.endNum !== null).length === 1 && r[0][3].endNum === '4';
    const row2EndOk = r[1].filter(b => b.endNum !== null).length === 1 && r[1][2].endNum === '7';
    console.log((row1EndOk && row2EndOk) ? 'PASS (end-of-line number only on last bar, correct value)' : 'FAIL');

    console.log('--- Settings: select for measures-per-line present and wired ---');
    await page.click('#open-settings');
    await page.waitForTimeout(150);
    await page.click('[data-settings-tab="display"]');
    await page.waitForTimeout(150);
    r = await page.evaluate(() => {
        const sel = document.getElementById('pdf-measures-per-line');
        return { exists: !!sel, value: sel?.value };
    });
    console.log(JSON.stringify(r));
    console.log((r.exists && r.value === '4') ? 'PASS (settings select present, reflects stored value)' : 'FAIL');

    console.log('--- Changing the setting to 2 changes the layout scale ---');
    await page.selectOption('#pdf-measures-per-line', '2');
    await page.waitForTimeout(100);
    r = await page.evaluate(() => localStorage.getItem('harmohubPdfMeasuresPerLine'));
    console.log('stored:', r);
    html = await page.evaluate(() => window.app.buildPrintExportHtml().gridInner);
    r = await page.evaluate((html) => {
        const host = document.getElementById('print-export');
        host.innerHTML = html;
        const rows = Array.from(host.querySelectorAll('.print-chord-row'));
        return rows.map(row => row.querySelectorAll('.print-chord-wrap').length);
    }, html);
    console.log('cells per row with 2 measures/line:', JSON.stringify(r));
    // 7 mesures d'1 accord chacune, 2 mesures/ligne -> lignes de 2,2,2,1 accords.
    console.log((JSON.stringify(r) === JSON.stringify([2, 2, 2, 1])) ? 'PASS (setting reshapes rows)' : 'FAIL');

    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
