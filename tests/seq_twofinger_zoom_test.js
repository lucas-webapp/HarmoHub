// DEUX DOIGTS = ZOOM, ET RIEN D'AUTRE.
// Ce banc s'appelait seq_twofinger_pan_test : deux doigts faisaient alors DÉFILER le séquenceur (en
// plus de le zoomer). Cette moitié-là a été retirée, pour deux raisons mesurées :
//   1. Elle était redondante. Le défilement à UN doigt est déjà assuré nativement par le navigateur
//      (touch-action: pan-x pan-y sur la bande et ses cases) — vérifié ici même : un vrai glissé à un
//      doigt fait défiler sans jamais toucher au motif. Une émulation en JS ne pouvait qu'être moins
//      bonne que l'originale (ni inertie, ni rebond, ni cohérence avec le système).
//   2. Elle se battait avec le zoom du MÊME geste. Chaque pointermove appliquait un cran de zoom, dont
//      le recentrage sur l'accord édité (_appliquerEchelleHorizontale) réécrivait scrollLeft juste
//      avant que le pan n'ajoute son pas : le défilement oscillait entre deux valeurs fixes au lieu
//      d'avancer (relevé : 20, 59, 25, 59, 25...). Et deux doigts qui glissent ensemble modifient
//      toujours un peu leur écart — impossible de deviner « il voulait défiler, pas zoomer ».
// Un seul sens par geste, plus rien à départager. Le zoom, lui, est désormais ANCRÉ sous les doigts
// (comme toute carte ou photo sur téléphone) plutôt que recentré sur l'accord édité.
//
// Les gestes sont émis via CDP (Input.dispatchTouchEvent), donc de VRAIS évènements tactiles : un
// PointerEvent de synthèse ne déclenche jamais le défilement natif du navigateur, et n'aurait donc
// pas pu éprouver le point 1.
const { chromium, devices } = require('playwright');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';

let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ ...devices['iPhone X'] });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|fonts\.googleapis|fonts\.gstatic/.test(m.text())) errors.push('console: ' + m.text()); });

    await page.goto(`${BASE}/index.html?nocache=` + Date.now());
    await page.waitForTimeout(600);
    // Accord long : la bande déborde vraiment, donc elle peut défiler ET se zoomer.
    await page.evaluate(() => { const s = document.getElementById('duration'); s.value = '8'; s.dispatchEvent(new Event('change')); });
    await page.waitForTimeout(200);
    await page.evaluate(() => window.app.toggleSequencer('compact'));
    await page.waitForTimeout(500);

    const client = await page.context().newCDPSession(page);
    const etat = () => page.evaluate(() => {
        const sc = document.querySelector('#arp-sequencer .seq-scroll');
        const g = sc.querySelector('.seq-grid-continuous, .seq-grid-wide');
        const colPx = +g.dataset.colPx;
        const chord = window.app.readChord();
        const { pattern } = window.app.getLiveSeqPattern(chord);
        return {
            zoom: window.app.seqInlineZoomLevelX,
            scrollLeft: sc.scrollLeft,
            // Colonne de contenu visée par le MILIEU de la bande : c'est elle qui doit rester stable
            // pendant un pincement centré là (l'ancrage), quelle que soit l'échelle.
            colonneAuMilieu: (sc.scrollLeft + sc.getBoundingClientRect().width / 2) / colPx,
            motif: JSON.stringify(pattern.map(v => v.includes(0))),
            drag: !!window.app.seqDrag,
        };
    });
    const centre = await page.evaluate(() => {
        const r = document.querySelector('#arp-sequencer .seq-scroll').getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });

    console.log('=== A. Écarter deux doigts : ça zoome, ancré sous les doigts ===');
    const avant = await etat();
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [
        { x: centre.x - 30, y: centre.y, id: 1 }, { x: centre.x + 30, y: centre.y, id: 2 }] });
    for (const e of [45, 60, 80, 100, 120]) {
        await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [
            { x: centre.x - e, y: centre.y, id: 1 }, { x: centre.x + e, y: centre.y, id: 2 }] });
        await page.waitForTimeout(30);
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(500);
    const apres = await etat();
    console.log(`zoom ${avant.zoom} -> ${apres.zoom} | colonne au milieu ${avant.colonneAuMilieu.toFixed(2)} -> ${apres.colonneAuMilieu.toFixed(2)}`);
    check(apres.zoom > avant.zoom, `écarter deux doigts agrandit — ${avant.zoom} -> ${apres.zoom}`);
    check(Math.abs(apres.colonneAuMilieu - avant.colonneAuMilieu) < 1.5,
        `la musique sous les doigts ne glisse pas pendant le zoom — dérive ${Math.abs(apres.colonneAuMilieu - avant.colonneAuMilieu).toFixed(2)} colonne`);
    check(apres.motif === avant.motif, "le pincement n'a modifié AUCUNE note (pas de peinture/effacement accidentel)");
    check(!apres.drag, "aucun glissé d'édition (seqDrag) ne reste armé après le pincement");

    console.log('\n=== B. Rapprocher deux doigts : ça dézoome ===');
    const avantB = await etat();
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [
        { x: centre.x - 120, y: centre.y, id: 1 }, { x: centre.x + 120, y: centre.y, id: 2 }] });
    for (const e of [100, 80, 60, 45, 30]) {
        await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [
            { x: centre.x - e, y: centre.y, id: 1 }, { x: centre.x + e, y: centre.y, id: 2 }] });
        await page.waitForTimeout(30);
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(500);
    const apresB = await etat();
    check(apresB.zoom < avantB.zoom, `rapprocher deux doigts réduit — ${avantB.zoom} -> ${apresB.zoom}`);
    check(apresB.motif === avantB.motif, "le dézoom n'a modifié aucune note non plus");

    console.log('\n=== C. UN doigt fait défiler nativement, sans rien éditer ===');
    // Le vrai remplaçant du pan à deux doigts. Sans CDP ce cas serait intestable : un PointerEvent
    // fabriqué ne déclenche jamais le défilement natif du navigateur.
    await page.evaluate(() => { document.querySelector('#arp-sequencer .seq-scroll').scrollLeft = 0; });
    await page.waitForTimeout(150);
    const avantC = await etat();
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: centre.x, y: centre.y, id: 1 }] });
    for (let i = 1; i <= 8; i++) {
        await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: centre.x - i * 12, y: centre.y, id: 1 }] });
        await page.waitForTimeout(16);
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(500);
    const apresC = await etat();
    console.log(`scrollLeft ${avantC.scrollLeft} -> ${apresC.scrollLeft}`);
    check(apresC.scrollLeft > avantC.scrollLeft,
        `un glissé à UN doigt fait défiler la bande (nativement) — ${avantC.scrollLeft} -> ${apresC.scrollLeft}`);
    check(apresC.motif === avantC.motif, "...sans peindre ni effacer la moindre note");
    check(apresC.zoom === avantC.zoom, '...et sans toucher au zoom (un doigt ne zoome jamais)');

    check(errors.length === 0, 'aucune erreur JavaScript — ' + JSON.stringify(errors));
    console.log('\n=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})();
