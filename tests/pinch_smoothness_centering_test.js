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
    // Une progression avec PLUSIEURS accords pour que le séquenceur ait vraiment une pagination
    // horizontale sensible au zoom H (measures per page), et une partie assez longue pour tester le
    // centrage de la vue grille.
    await page.evaluate(() => {
        const chords = [];
        for (let i = 0; i < 12; i++) {
            chords.push({ root: ['C', 'D', 'E', 'F', 'G', 'A'][i % 6], quality: 'maj7', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' });
        }
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);
    // Ouvre la loupe grille avec le 6e accord (index 5) déjà sélectionné pour édition.
    await page.evaluate(() => {
        window.app.openGridZoom();
        window.app.editChordFromGridZoom(0, 5);
    });
    await page.waitForTimeout(150);

    console.log('=== Pincement PROLONGÉ (plusieurs vagues de mouvement, avec de vraies pauses) sur le séquenceur épinglé ===');
    const zoomLevelsSeen = await page.evaluate(async () => {
        const el = document.getElementById('grid-zoom-pinned-body');
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
        const mk = (type, id, dx, dy) => new PointerEvent(type, {
            pointerId: id, pointerType: 'touch', clientX: cx + dx, clientY: cy + dy, bubbles: true, cancelable: true,
        });
        el.dispatchEvent(mk('pointerdown', 1, -20, 0));
        el.dispatchEvent(mk('pointerdown', 2, 20, 0));
        const seen = [];
        const sleep = (ms) => new Promise(r => setTimeout(r, ms));
        // Écarte progressivement les doigts sur plusieurs vagues, avec de vraies pauses entre chaque
        // (laisse le temps à requestAnimationFrame de tourner, contrairement à un dispatch tout d'un bloc).
        for (let i = 1; i <= 6; i++) {
            el.dispatchEvent(mk('pointermove', 1, -20 - i * 15, 0));
            el.dispatchEvent(mk('pointermove', 2, 20 + i * 15, 0));
            await sleep(80);
            seen.push({ t: i, seqRenderPending: window.app._seqZoomRenderPending, zoomX: window.app.seqZoomLevelX });
        }
        el.dispatchEvent(mk('pointerup', 1, -110, 0));
        el.dispatchEvent(mk('pointerup', 2, 110, 0));
        return seen;
    });
    console.log(JSON.stringify(zoomLevelsSeen));
    // Au moins un des points intermédiaires doit avoir DÉJÀ rattrapé le rendu (seqRenderPending===false)
    // AVANT la fin du geste, preuve que le rattrapage périodique a bien tourné pendant le pincement,
    // pas seulement au tout dernier moment (relâchement).
    const caughtUpMidGesture = zoomLevelsSeen.some((s, i) => i < zoomLevelsSeen.length - 1 && s.seqRenderPending === false);
    check(caughtUpMidGesture, 'le rattrapage périodique du rendu horizontal a bien eu lieu PENDANT le pincement (pas seulement à la fin)');

    console.log('=== L\'accord en édition (index 5) reste bien celui affiché/centré après le pincement ===');
    const finalState = await page.evaluate(() => ({
        editingIndex: window.app.editingIndex,
        seqOpen: window.app.seqOpen,
    }));
    console.log(JSON.stringify(finalState));
    check(finalState.editingIndex === 5, "l'accord en édition (index 5) est resté le même après tout le pincement");

    console.log('=== La cellule grille de l\'accord en édition est bien visible/centrée dans #grid-zoom-host après ouverture ===');
    const visibility = await page.evaluate(() => {
        const cell = document.querySelector('#grid-zoom-host .grid-cell[data-section="0"][data-index="5"]');
        if (!cell) return null;
        const cellRect = cell.getBoundingClientRect();
        const hostRect = document.getElementById('grid-zoom-host').getBoundingClientRect();
        return {
            cellVisible: cellRect.top < hostRect.bottom && cellRect.bottom > hostRect.top && cellRect.left < hostRect.right && cellRect.right > hostRect.left,
        };
    });
    console.log(JSON.stringify(visibility));
    check(visibility && visibility.cellVisible, "la cellule de l'accord en édition est bien visible dans la fenêtre de la loupe grille");

    console.log('\n=== Bilan : ' + PASS + ' PASS / ' + FAIL + ' FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
