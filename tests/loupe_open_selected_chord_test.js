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

    console.log('=== Sans rien sélectionner ni éditer : ouvrir la loupe ne doit rien montrer dans le séquenceur ===');
    await page.evaluate(() => window.app.openGridZoom());
    await page.waitForTimeout(100);
    const nothingSelected = await page.evaluate(() => ({ editingIndex: window.app.editingIndex, seqOpen: window.app.seqOpen }));
    console.log(JSON.stringify(nothingSelected));
    check(nothingSelected.editingIndex == null, "sans sélection préalable, aucun accord n'est chargé (comportement inchangé)");
    await page.evaluate(() => window.app.closeGridZoom());
    await page.waitForTimeout(100);

    console.log('=== Sélectionne (simple clic, PAS "Modifier") l\'accord d\'index 2, puis ouvre la loupe ===');
    await page.evaluate(() => { window.app.selectedIndex = 2; window.app.activeSection = 0; });
    await page.evaluate(() => window.app.openGridZoom());
    await page.waitForTimeout(150);
    const afterOpen = await page.evaluate(() => ({
        editingIndex: window.app.editingIndex,
        seqOpen: window.app.seqOpen,
        pinnedVisible: !document.getElementById('grid-zoom-pinned-seq').hidden,
        seqHostInPinned: document.getElementById('grid-zoom-pinned-body').contains(document.getElementById('arp-sequencer')),
    }));
    console.log(JSON.stringify(afterOpen));
    check(afterOpen.editingIndex === 2, "l'accord SÉLECTIONNÉ (index 2, sans passer par Modifier) est bien chargé pour édition dès l'ouverture de la loupe");
    check(afterOpen.seqOpen === true, 'le séquenceur est bien ouvert');
    check(afterOpen.seqHostInPinned === true, 'le séquenceur épinglé affiche bien le vrai #arp-sequencer');

    console.log('\n=== Bilan : ' + PASS + ' PASS / ' + FAIL + ' FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
