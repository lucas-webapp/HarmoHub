const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', msg => { if (msg.type() === 'error' && !msg.text().includes('ERR_CONNECTION_RESET') && !msg.text().includes('ERR_TUNNEL_CONNECTION_FAILED')) errors.push('console: ' + msg.text()); });

    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(600);
    await page.waitForTimeout(150);

    // === 1. Séquenceur : le numéro de temps est maintenant centré sur la MÊME frontière que le trait
    // de contretemps voisin (son propre début de temps), donc l'écart entre "temps N" et "trait N"
    // (contretemps qui SUIT ce temps) doit être égal à l'écart entre "trait N" et "temps N+1".
    // Comparaison faite sur les temps 2 et 3 (pas le tout 1er temps de la grille, cas particulier SANS
    // voisin à gauche — rien à centrer symétriquement contre, le chiffre y déborde forcément un peu
    // hors de la piste plutôt que d'empiéter sur un temps précédent qui n'existe pas). ===
    for (const sym of ['C']) {
        await page.fill('#quick-add-input', sym).catch(() => {});
        await page.click('#quick-add-btn').catch(() => {});
        await page.waitForTimeout(120);
    }
    // 2 mesures (8 temps) pour avoir un 2e temps "interne" (voisins des deux côtés) à comparer.
    await page.evaluate(() => {
        const sections = loadProgressionSections();
        sections[app.activeSection].chords[0].beats = 8;
        saveProgressionSections(sections);
        app.loadProgression();
    });
    await page.evaluate(() => window.app.toggleSequencer('compact'));
    await page.waitForTimeout(300);

    const seqSymmetry = await page.evaluate(() => {
        const num2 = document.querySelector('.seq-beat-label[data-beat-index="1"] .seq-beat-num');
        const num3 = document.querySelector('.seq-beat-label[data-beat-index="2"] .seq-beat-num');
        const dashes = Array.from(document.querySelectorAll('.seq-beat-offbeat .offbeat-dash'));
        const dash2 = dashes[1]; // contretemps du 2e temps (entre num2 et num3)
        const c = el => { const r = el.getBoundingClientRect(); return (r.left + r.right) / 2; };
        return {
            num2: c(num2), dash2: c(dash2), num3: c(num3),
            gapNumToDash: c(dash2) - c(num2),
            gapDashToNum: c(num3) - c(dash2),
        };
    });
    console.log('seqSymmetry:', JSON.stringify(seqSymmetry));
    const diff = Math.abs(seqSymmetry.gapNumToDash - seqSymmetry.gapDashToNum);
    check(diff <= 2, `écart temps->trait (${seqSymmetry.gapNumToDash.toFixed(1)}px) ≈ écart trait->temps suivant (${seqSymmetry.gapDashToNum.toFixed(1)}px) — différence ${diff.toFixed(1)}px, plus d'asymétrie visible`);

    await page.evaluate(() => window.app.toggleSequencer('compact'));
    await page.waitForTimeout(150);

    // === 2. Grille : le numéro de fin de contenu (ex "2" après 1 mesure) apparaît SANS prolonger
    // l'accord — dérivé de cursor/beatsPerBar, pas d'un vrai accord === (repart d'1 seule mesure,
    // le test précédent ayant étendu l'accord à 2 mesures pour son propre besoin)
    await page.evaluate(() => {
        const sections = loadProgressionSections();
        sections[app.activeSection].chords[0].beats = 4;
        saveProgressionSections(sections);
        app.loadProgression();
    });
    await page.waitForTimeout(150);
    const endCheck = await page.evaluate(() => {
        const endEl = document.querySelector('.chord-grid .row-measure.row-measure-end');
        const cs = endEl ? getComputedStyle(endEl) : null;
        return {
            found: !!endEl,
            text: endEl ? endEl.textContent : null,
            pointerEvents: cs ? cs.pointerEvents : null,
        };
    });
    console.log('endCheck (1 accord d\'1 mesure):', JSON.stringify(endCheck));
    check(endCheck.found, "le numéro de fin de grille (.row-measure-end) apparaît bien SANS prolonger l'accord");
    check(endCheck.text === '2', `le numéro de fin de grille affiche bien "2" (mesure suivante) après 1 mesure écrite — obtenu ${endCheck.text}`);
    check(endCheck.pointerEvents === 'none', "le numéro de fin de grille est décoratif (pointer-events:none), pas un vrai accord glissable");

    // Vérifie qu'il DISPARAÎT proprement si on prolonge l'accord jusque-là (remplacé par le VRAI
    // numéro de départ du 2e accord, plus de doublon) et qu'un NOUVEAU numéro de fin apparaît après.
    await page.evaluate(() => {
        const sections = loadProgressionSections();
        sections[app.activeSection].chords[0].beats = 8; // 2 mesures pleines (4 temps/mesure)
        saveProgressionSections(sections);
        app.loadProgression();
    });
    await page.waitForTimeout(200);
    const afterExtend = await page.evaluate(() => {
        const marks = Array.from(document.querySelectorAll('.chord-grid .row-measure')).map(el => ({ text: el.textContent, isEnd: el.classList.contains('row-measure-end') }));
        return marks;
    });
    console.log('après extension à 2 mesures:', JSON.stringify(afterExtend));
    check(afterExtend.some(m => m.text === '1' && !m.isEnd), 'après extension à 2 mesures : le VRAI numéro "1" (départ mesure 1) est toujours là');
    check(afterExtend.some(m => m.text === '2' && !m.isEnd), 'après extension à 2 mesures : un VRAI numéro "2" (départ mesure 2, plus un aperçu) apparaît');
    check(afterExtend.some(m => m.text === '3' && m.isEnd), 'après extension à 2 mesures, le nouveau numéro de fin (aperçu) affiche "3"');
    check(afterExtend.filter(m => m.isEnd).length === 1, "un seul numéro de fin à la fois (pas de doublon laissé par l'ancien état)");

    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})();
