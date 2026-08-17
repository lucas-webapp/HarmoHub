const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// La police est chargée depuis Google Fonts : injoignable derrière le proxy du bac à sable,
// jamais un problème chez l'utilisateur. Ces échecs réseau sont donc filtrés — sinon ils font
// échouer « aucune erreur console » et masquent les vraies erreurs au milieu du bruit.
//
// CE FICHIER N'ÉTAIT PAS UN BANC : cinq verdicts en console.log, sans compteur, et process.exit(0).
//
// LE RÉGLAGE A DÉMÉNAGÉ. « Mesures par ligne » vivait dans Paramètres > Affichage
// (#pdf-measures-per-line, atteint par un onglet [data-settings-tab="display"]). Deux changements
// depuis : les Paramètres n'ont plus d'onglets du tout (retour utilisateur : « vu qu'il y a peu de
// paramètres, c'est peut-être pas nécessaire »), et ce réglage-là est parti dans la fenêtre d'export
// PDF elle-même (#pdf-opt-measures, voir openPdfExportDialog) — « ils prenaient de la place pour une
// question qu'on ne se pose qu'au moment d'exporter ». Le banc cliquait donc un onglet qui n'existe
// plus : expiration au bout de 30 secondes, et ses deux dernières vérifications jamais atteintes.
const { check, exiger, plan, bilan } = require('./_harness')('échelle fixe du PDF');
plan(9);

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
    check(row1ok && row2ok,
        `échelle FIXE : une dernière ligne incomplète garde la même largeur par temps que les autres — ligne 1 ${JSON.stringify(row1widths)}, ligne 2 ${JSON.stringify(row2widths)} (25% attendu partout, surtout pas 33,33%)`);

    console.log('--- Ruler bars: same fixed-scale width across rows too ---');
    r = await page.evaluate(() => {
        const host = document.getElementById('print-export');
        const rulers = Array.from(host.querySelectorAll('.print-measure-ruler'));
        return rulers.map(ru => Array.from(ru.querySelectorAll('.ruler-bar')).map(b => b.style.width));
    });
    console.log(JSON.stringify(r));
    const ruler1ok = r[0].every(w => Math.abs(parseFloat(w) - 25) < 0.01);
    const ruler2ok = r[1].every(w => Math.abs(parseFloat(w) - 25) < 0.01);
    check(ruler1ok && ruler2ok,
        `la règle de mesures suit la même échelle fixe que les accords — ${JSON.stringify(r)}`);

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
    // ATTENTE CORRIGÉE. Le banc exigeait que la ligne 1 (mesures 1 à 4) finisse sur « 4 » et la ligne 2
    // (mesures 5 à 7) sur « 7 » — c'est-à-dire le numéro de la mesure elle-même, répété aux deux bouts.
    // C'est exactement le comportement que l'utilisateur a fait CORRIGER : « il devrait y avoir 5 et 9
    // en fin de lignes, là on a à nouveau 4 et 8 ». Le numéro de fin de ligne annonce la mesure
    // SUIVANTE, comme le repère de fin de grille à l'écran : le trait de droite est la frontière où
    // commence la mesure d'après, et c'est ce numéro-là qui a un sens. Ligne 1 -> « 5 », ligne 2 -> « 8 ».
    const row1EndOk = r[0].filter(b => b.endNum !== null).length === 1 && r[0][3].endNum === '5';
    const row2EndOk = r[1].filter(b => b.endNum !== null).length === 1 && r[1][2].endNum === '8';
    check(row1EndOk && row2EndOk,
        `le numéro de fin de ligne n'apparaît que sur la DERNIÈRE mesure de chaque ligne, et annonce la mesure SUIVANTE — ligne 1 « ${r[0][3].endNum} » (attendu 5), ligne 2 « ${r[1][2].endNum} » (attendu 8)`);

    console.log('--- Le réglage vit dans la fenêtre d\'export PDF, et reflète la valeur mémorisée ---');
    await page.evaluate(() => window.app.openPdfExportDialog());
    await page.waitForTimeout(400);
    const reglage = await page.evaluate(() => {
        const sel = document.getElementById('pdf-opt-measures');
        return {
            fenetreOuverte: !document.getElementById('pdf-export-modal').hidden,
            existe: !!sel,
            valeur: sel && sel.value,
            choix: sel ? [...sel.options].map(o => o.value) : [],
            plusDansParametres: !document.getElementById('pdf-measures-per-line'),
        };
    });
    console.log(JSON.stringify(reglage));
    if (!exiger(reglage.fenetreOuverte && reglage.existe, "la fenêtre d'export PDF s'ouvre et porte bien le réglage")) bilan();
    check(reglage.valeur === '4', `il reflète la valeur mémorisée (4 mesures par ligne) — « ${reglage.valeur} »`);
    check(reglage.plusDansParametres, "et il n'existe plus en double dans les Paramètres");

    console.log('--- Le passer à 2 remodèle vraiment les lignes du PDF ---');
    await page.selectOption('#pdf-opt-measures', '2');
    await page.waitForTimeout(200);
    // Le choix n'est appliqué qu'à la validation (voir openPdfExportDialog) : c'est la fenêtre qui
    // pose le réglage, pas le <select> lui-même. On appelle donc setPdfMeasuresPerLine comme le fait
    // « Exporter », sans déclencher le vrai export (qui rastériserait toutes les pages).
    await page.evaluate(() => {
        window.app.setPdfMeasuresPerLine(parseInt(document.getElementById('pdf-opt-measures').value, 10));
        if (window.app._pdfDialogCancel) window.app._pdfDialogCancel();
    });
    await page.waitForTimeout(200);
    const memorise = await page.evaluate(() => localStorage.getItem('harmohubPdfMeasuresPerLine'));
    check(memorise === '2', `le nouveau choix est mémorisé — « ${memorise} »`);

    html = await page.evaluate(() => window.app.buildPrintExportHtml().gridInner);
    const lignes = await page.evaluate((html) => {
        const host = document.getElementById('print-export');
        host.innerHTML = html;
        return [...host.querySelectorAll('.print-chord-row')].map(row => row.querySelectorAll('.print-chord-wrap').length);
    }, html);
    console.log('accords par ligne à 2 mesures/ligne :', JSON.stringify(lignes));
    // 7 mesures d'1 accord chacune, 2 mesures/ligne -> lignes de 2, 2, 2, 1 accords.
    check(JSON.stringify(lignes) === JSON.stringify([2, 2, 2, 1]),
        `le réglage remodèle bien les lignes — ${JSON.stringify(lignes)}, attendu [2,2,2,1]`);

    console.log('Errors:', JSON.stringify(errors));
    check(errors.length === 0, 'aucune erreur JavaScript pendant tout le scénario');
    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
