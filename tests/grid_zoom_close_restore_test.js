const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [
            { root: 'C', quality: 'maj7', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
            { root: 'G', quality: 'dom7', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
        ] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);

    console.log('=== Avant toute chose : #progression-sections vit bien dans .history-section (col-right) ===');
    let location = await page.evaluate(() => {
        const grid = document.getElementById('progression-sections');
        return {
            inHistorySection: !!grid.closest('.history-section'),
            inColLeft: !!grid.closest('.col-left'),
        };
    });
    check(location.inHistorySection && !location.inColLeft, 'position initiale correcte — ' + JSON.stringify(location));

    console.log('=== Ouvre la loupe grille, édite un accord (charge le séquenceur épinglé) ===');
    await page.evaluate(() => { window.app.openGridZoom(); });
    await page.waitForTimeout(150);
    await page.evaluate(() => { window.app.editChordFromGridZoom(0, 0); });
    await page.waitForTimeout(150);
    location = await page.evaluate(() => {
        const grid = document.getElementById('progression-sections');
        return { inGridZoomHost: !!grid.closest('#grid-zoom-host') };
    });
    check(location.inGridZoomHost, 'la grille est bien déplacée dans #grid-zoom-host pendant la loupe');

    console.log('=== Ferme la loupe grille : #progression-sections doit revenir dans .history-section, PAS .col-left ===');
    await page.evaluate(() => { window.app.closeGridZoom(); });
    await page.waitForTimeout(150);
    location = await page.evaluate(() => {
        const grid = document.getElementById('progression-sections');
        const addBtn = document.getElementById('add-section');
        return {
            inHistorySection: !!grid.closest('.history-section'),
            inColLeft: !!grid.closest('.col-left'),
            inColRight: !!grid.closest('.col-right'),
            addBtnInHistorySection: !!addBtn.closest('.history-section'),
            gridImmediatelyAfterCardHead: grid.previousElementSibling && grid.previousElementSibling.classList.contains('card-head'),
        };
    });
    console.log(JSON.stringify(location));
    check(location.inHistorySection, 'la grille est bien revenue dans .history-section');
    check(location.inColRight, 'la grille est bien revenue dans .col-right');
    check(!location.inColLeft, 'la grille n\'est PLUS dans .col-left (bug corrigé)');
    check(location.addBtnInHistorySection, 'le bouton "Ajouter une partie" est bien revenu aussi');
    check(location.gridImmediatelyAfterCardHead, 'la grille est bien positionnée juste après son en-tête (card-head)');

    console.log('=== Le contenu de la grille (les 2 accords) est toujours intact après l\'aller-retour ===');
    const chordSymbols = await page.evaluate(() => [...document.querySelectorAll('#progression-sections .cell-sym')].map(el => el.textContent.trim()));
    console.log(chordSymbols);
    check(chordSymbols.length === 2, 'les 2 accords sont toujours présents — trouvé ' + chordSymbols.length);

    console.log('=== Aucune erreur JS pendant tout le scénario ===');
    check(errors.length === 0, 'aucune erreur (' + JSON.stringify(errors) + ')');

    await page.screenshot({ path: 'grid_zoom_close_restore_after.png' });

    console.log('\n=== Bilan : ' + PASS + ' PASS / ' + FAIL + ' FAIL ===');
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
