const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

(async () => {
    const browser = await chromium.launch();

    // ---- Setup commun : une seule partie, un seul accord court (peu de temps) ----
    const seedProgression = async (page) => {
        await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
        await page.waitForTimeout(200);
        await page.evaluate(() => {
            localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [
                { root: 'C', quality: 'maj7', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
            ] }] }));
        });
        await page.reload({ waitUntil: 'load' });
        await page.waitForTimeout(200);
    };

    console.log('=== Écran DESKTOP (>= 900px) : cases 2x plus larges qu\'en mobile ===');
    const pageDesktop = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    await seedProgression(pageDesktop);
    await pageDesktop.evaluate(() => { window.app.openGridZoom(); });
    await pageDesktop.waitForTimeout(150);
    await pageDesktop.evaluate(() => { window.app.editChordFromGridZoom(0, 0); });
    await pageDesktop.waitForTimeout(150);
    const desktopColWidth = await pageDesktop.evaluate(() => {
        const grid = document.querySelector('#grid-zoom-pinned-body .seq-grid-continuous');
        if (!grid) return null;
        const template = getComputedStyle(grid).gridTemplateColumns.split(' ');
        return parseFloat(template[1]); // 1re colonne = max-content (label), 2e = largeur de case
    });
    console.log('largeur de case (desktop):', desktopColWidth);
    check(desktopColWidth !== null, 'grille continue trouvée sur desktop');

    console.log('=== Ordre des boutons : transport -> actions -> zoom H/V EN DERNIER ===');
    const order = await pageDesktop.evaluate(() => {
        return [...document.querySelectorAll('.seq-presets > *')].map(el => el.id || el.className.split(' ')[0]);
    });
    console.log('ordre:', JSON.stringify(order));
    const zoomGroupIndex = order.findIndex(x => x === 'btn-wrap-group');
    const lastActionIndex = order.findIndex(x => x === 'seq-delete-selection');
    check(zoomGroupIndex > lastActionIndex, 'le groupe de zoom H/V arrive bien APRÈS seq-delete-selection (dernier bouton d\'action)');
    check(order[0] === 'seq-play', 'seq-play toujours en premier (transport)');

    console.log('=== Toolbar reste visible même après réduction de la hauteur du panneau épinglé ===');
    await pageDesktop.evaluate(() => {
        const body = document.getElementById('grid-zoom-pinned-body');
        body.style.height = '120px'; // simule la poignée de redimensionnement tirée vers le haut
    });
    await pageDesktop.waitForTimeout(100);
    const stickyCheck = await pageDesktop.evaluate(() => {
        const body = document.getElementById('grid-zoom-pinned-body');
        const presets = document.querySelector('.seq-presets');
        const bodyRect = body.getBoundingClientRect();
        const presetsRect = presets.getBoundingClientRect();
        const style = getComputedStyle(presets);
        return {
            position: style.position,
            bottom: style.bottom,
            presetsBottom: presetsRect.bottom,
            bodyBottom: bodyRect.bottom,
            visible: presetsRect.bottom <= bodyRect.bottom + 1 && presetsRect.top >= bodyRect.top - 1,
        };
    });
    console.log(JSON.stringify(stickyCheck));
    check(stickyCheck.position === 'sticky', '.seq-presets a bien position:sticky');
    check(stickyCheck.visible, 'la rangée de boutons reste dans la zone visible du panneau réduit (' + stickyCheck.presetsBottom.toFixed(0) + ' vs ' + stickyCheck.bodyBottom.toFixed(0) + ')');

    await pageDesktop.close();

    console.log('\n=== Écran MOBILE (< 900px) : comportement INCHANGÉ (case 14px de base) ===');
    const pageMobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await seedProgression(pageMobile);
    // Sur mobile, .col-left/.col-right s'aplatissent en une seule colonne ; la loupe grille reste
    // accessible pareil (même bouton), on vérifie juste que la largeur de base reste 14px.
    await pageMobile.evaluate(() => { window.app.openGridZoom(); });
    await pageMobile.waitForTimeout(150);
    await pageMobile.evaluate(() => { window.app.editChordFromGridZoom(0, 0); });
    await pageMobile.waitForTimeout(150);
    const mobileColWidth = await pageMobile.evaluate(() => {
        const grid = document.querySelector('#grid-zoom-pinned-body .seq-grid-continuous');
        if (!grid) return null;
        const template = getComputedStyle(grid).gridTemplateColumns.split(' ');
        return parseFloat(template[1]);
    });
    console.log('largeur de case (mobile):', mobileColWidth);
    check(mobileColWidth === 14, 'case toujours à 14px de base sur mobile (inchangé) — trouvé ' + mobileColWidth);
    check(desktopColWidth === 28, 'case bien à 28px (2x) sur desktop — trouvé ' + desktopColWidth);
    await pageMobile.close();

    console.log('\n=== Bilan : ' + PASS + ' PASS / ' + FAIL + ' FAIL ===');
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
