const { chromium, devices } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
// Retour utilisateur (sur téléphone) : « le mode modifier s'enlève dès que je veux scroller. Il y a
// un problème de sensibilité du "toucher à côté pour basculer hors du mode modification". » —
// certains navigateurs mobiles laissent passer un clic de synthèse même après un léger défilement
// (page ou grille, dont les cases sont volontairement en touch-action:none, voir .grid-cell) ; ce
// clic-fantôme tombait hors du panneau Accord/séquenceur et sortait silencieusement du mode
// Modification (editingIndex retombait à null), exactement le symptôme déjà documenté pour les douze
// contrôles échappés à la garde `inEditor` (voir sortie_edition_involontaire_test.js) — sauf qu'ici
// rien n'échappe à la garde : c'est le CLIC LUI-MÊME qui n'aurait jamais dû compter.
// Fix : setupEventListeners repère un vrai geste de défilement (>10px entre touchstart et touchmove,
// même seuil que le menu contextuel, voir attachContextMenuTrigger) et ignore le clic qui suit.
let PASS = 0, FAIL = 0;
const check = (c, l) => { if (c) { PASS++; console.log('PASS - ' + l); } else { FAIL++; console.log('FAIL - ' + l); } };

(async () => {
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const errors = [];
    const page = await browser.newPage({ ...devices['iPhone X'] });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        const mk = (root, quality) => ({ root, quality, beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [
            mk('C', 'maj'), mk('D', 'min'), mk('E', 'min'),
        ] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(300);

    // touchstart -> touchmove (dy) -> touchend, puis un clic de synthèse à l'arrivée : reproduit le
    // clic-fantôme que certains navigateurs mobiles laissent passer après un léger défilement.
    async function toucherEtDefiler(x, y, dy) {
        await page.evaluate(({ x, y, dy }) => {
            const mk = (type, cx, cy) => {
                const t = new Touch({ identifier: 1, target: document.body, clientX: cx, clientY: cy });
                return new TouchEvent(type, { touches: type === 'touchend' ? [] : [t], targetTouches: type === 'touchend' ? [] : [t], changedTouches: [t], bubbles: true, cancelable: true });
            };
            document.dispatchEvent(mk('touchstart', x, y));
            document.dispatchEvent(mk('touchmove', x, y + dy));
            document.dispatchEvent(mk('touchend', x, y + dy));
            const el = document.elementFromPoint(x, y + dy) || document.body;
            el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y + dy }));
        }, { x, y, dy });
    }

    console.log("--- En modification, un défilement (>10px) suivi d'un clic-fantôme ne sort PAS de l'édition ---");
    await page.evaluate(() => window.app.editChord(0, 1));
    await page.waitForTimeout(150);
    let etat = await page.evaluate(() => window.app.editingIndex);
    check(etat === 1, `édition bien amorcée avant le test — editingIndex=${etat}`);
    // Un point réellement hors du panneau d'édition (pas juste « en bas » : à cette hauteur, sur ce
    // format de téléphone, un accord en cours d'édition remplit la page jusqu'à ~700px avec ses
    // propres champs — vérifié via elementFromPoint, sans quoi ce test resterait vrai même sans le
    // correctif, pour la mauvaise raison).
    await toucherEtDefiler(200, 620, -80);
    await page.waitForTimeout(150);
    etat = await page.evaluate(() => window.app.editingIndex);
    check(etat === 1, `l'édition reste active après le défilement — editingIndex=${etat}`);

    console.log("--- ...mais un VRAI clic « ailleurs » (sans défilement au préalable) sort toujours de l'édition ---");
    await page.evaluate(({ x, y }) => {
        const el = document.elementFromPoint(x, y) || document.body;
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
    }, { x: 200, y: 620 });
    await page.waitForTimeout(150);
    etat = await page.evaluate(() => window.app.editingIndex);
    check(etat === null, `un clic « ailleurs » sans défilement sort toujours bien de l'édition — editingIndex=${etat}`);

    console.log('--- Un simple tap (déplacement < 10px) reste un clic normal, pas un défilement ---');
    await page.evaluate(() => window.app.editChord(0, 1));
    await page.waitForTimeout(150);
    await toucherEtDefiler(200, 620, 3); // 3px : sous le seuil de 10px
    await page.waitForTimeout(150);
    etat = await page.evaluate(() => window.app.editingIndex);
    check(etat === null, `un tap sous le seuil (3px) sort toujours de l'édition comme un vrai clic — editingIndex=${etat}`);

    check(errors.length === 0, 'aucune erreur JavaScript — ' + JSON.stringify(errors));
    console.log(`\n=== Bilan : ${PASS} PASS / ${FAIL} FAIL ===`);
    await browser.close();
    process.exit(FAIL ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
