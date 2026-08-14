const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// La police est chargée depuis Google Fonts : injoignable derrière le proxy du bac à sable,
// jamais un problème chez l'utilisateur. Ces échecs réseau sont donc filtrés — sinon ils font
// échouer « aucune erreur console » et masquent les vraies erreurs au milieu du bruit.

let PASS = 0, FAIL = 0;
function check(cond, label) {
    if (cond) { PASS++; console.log('PASS - ' + label); }
    else { FAIL++; console.log('FAIL - ' + label); }
}

(async () => {
    const browser = await chromium.launch({
        args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (msg) => { if (msg.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|fonts\.googleapis|fonts\.gstatic/.test(msg.text())) errors.push('console.error: ' + msg.text()); });

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [
            { root: 'C', quality: 'maj', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
            { root: 'D', quality: 'min', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
            { root: 'E', quality: 'min', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
        ] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);

    console.log('=== Scénario RÉEL : accord déjà sélectionné, puis VRAI clic navigateur sur le bouton loupe ===');
    // this.selectedIndex posé directement (le clic réel sur la case elle-même n'est pas ce qu'on teste
    // ici, voir selectChord/onGridPointerUp — simple tap = écouter/sélectionner) : ce qui compte pour
    // reproduire le bug signalé, c'est que le clic sur #grid-zoom soit un VRAI évènement navigateur
    // (Playwright .click()), pas un appel direct à openGridZoom() via script — sinon l'écouteur
    // document-level "clic ailleurs" (voir setupEventListeners) n'est jamais authentiquement dans la
    // boucle, comme il l'est sur un vrai appareil (le même clic déclenche D'ABORD le onclick du bouton,
    // PUIS remonte jusqu'à ce même écouteur document).
    await page.evaluate(() => { window.app.selectedIndex = 1; window.app.activeSection = 0; });
    await page.waitForTimeout(50);

    // Vrai clic sur le VRAI bouton loupe (#grid-zoom) — celui-ci déclenche SON PROPRE onclick
    // (openGridZoom), PUIS le même clic remonte au document (écouteur "clic ailleurs" : c'est
    // exactement l'ordre qui posait problème en usage réel, jamais reproduit par un appel direct à
    // openGridZoom() via script).
    await page.click('#grid-zoom');
    await page.waitForTimeout(150);

    const afterZoomClick = await page.evaluate(() => {
        const cell = document.querySelector('#grid-zoom-host .grid-cell[data-section="0"][data-index="1"]');
        return {
            editingIndex: window.app.editingIndex,
            selectedIndex: window.app.selectedIndex,
            seqOpen: window.app.seqOpen,
            cellClasses: cell ? cell.className : 'MISSING',
        };
    });
    console.log('after real loupe button click:', JSON.stringify(afterZoomClick));

    check(afterZoomClick.editingIndex === 1, "l'accord reste bien EN ÉDITION après un vrai clic sur le bouton loupe (pas annulé par le clic-ailleurs)");
    check(afterZoomClick.selectedIndex === 1, "l'accord reste bien SÉLECTIONNÉ après un vrai clic sur le bouton loupe");
    check(afterZoomClick.seqOpen === true, 'le séquenceur est bien ouvert sur cet accord');
    check(afterZoomClick.cellClasses.includes('selected') && afterZoomClick.cellClasses.includes('editing'),
        "la case de la grille dans la loupe porte bien les classes selected ET editing (surbrillance visible)");

    console.log('\n=== Bilan : ' + PASS + ' PASS / ' + FAIL + ' FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
