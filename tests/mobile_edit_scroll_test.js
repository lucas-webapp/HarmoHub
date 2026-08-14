const { chromium, devices } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
// Retour utilisateur (sur téléphone) : « le mode modifier s'enlève dès que je veux scroller. Il y a
// un problème de sensibilité du "toucher à côté pour basculer hors du mode modification". », répété
// TROIS fois malgré deux correctifs successifs (« toujours le problème », « je n'arrive toujours pas
// à le faire fonctionner »).
// Les deux premiers correctifs (touchmove > 10px, puis un vrai `scroll` récent) protégeaient le clic
// 'click' de setupEventListeners contre un clic-fantôme après un léger défilement — nécessaires, mais
// pas suffisants : LA VRAIE CAUSE, trouvée par instrumentation, était un SECOND mécanisme totalement
// indépendant, setupSortieEditionAuClic, sur 'pointerdown' EN PHASE DE CAPTURE — donc AU TOUT DÉBUT
// du geste, avant le moindre mouvement, invisible à toute détection de défilement construite après
// coup. Sa propre liste de zones neutres (NEUTRES) avait dérivé de celle de l'autre mécanisme
// (inEditor) : aucun des douze correctifs déjà appliqués à inEditor (voir
// sortie_edition_involontaire_test.js) ne s'y était répercuté. Fix définitif : au DOIGT, ce second
// mécanisme ne décide plus rien du tout (il ne peut pas savoir si le geste deviendra un défilement) —
// seul le clic 'click', qui attend la fin du geste, ferme l'édition sur tactile. Les deux mécanismes
// partagent maintenant une seule liste de zones neutres (ZONE_EDITION_SELECTEURS).
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
    // Un point réellement hors du panneau d'édition — vérifié via elementFromPoint, sans quoi ce test
    // resterait vrai même sans le correctif, pour la mauvaise raison. Recalé à 606px (était 620) après
    // plusieurs retouches légitimes de mise en page mobile cette session (diagrammes réduits, largeur
    // du transport en volet replié, séquenceur qui s'étire...) : 620 finissait par tomber DANS
    // #accord-card (toujours en zone d'édition), faussant ce banc pour la mauvaise raison — pas un
    // vrai retour du défaut. 606 tombe dans l'interstice MAIN entre .history-section (grille) et
    // #accord-card, revérifié à chaque exécution en pratique via ce même elementFromPoint.
    await toucherEtDefiler(200, 606, -80);
    await page.waitForTimeout(150);
    etat = await page.evaluate(() => window.app.editingIndex);
    check(etat === 1, `l'édition reste active après le défilement — editingIndex=${etat}`);

    console.log("--- ...mais un VRAI clic « ailleurs » (sans défilement au préalable) sort toujours de l'édition ---");
    await page.evaluate(({ x, y }) => {
        const el = document.elementFromPoint(x, y) || document.body;
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
    }, { x: 200, y: 606 });
    await page.waitForTimeout(150);
    etat = await page.evaluate(() => window.app.editingIndex);
    check(etat === null, `un clic « ailleurs » sans défilement sort toujours bien de l'édition — editingIndex=${etat}`);

    console.log('--- Un simple tap (déplacement < 10px) reste un clic normal, pas un défilement ---');
    await page.evaluate(() => window.app.editChord(0, 1));
    await page.waitForTimeout(150);
    await toucherEtDefiler(200, 606, 3); // 3px : sous le seuil de 10px
    await page.waitForTimeout(150);
    etat = await page.evaluate(() => window.app.editingIndex);
    check(etat === null, `un tap sous le seuil (3px) sort toujours de l'édition comme un vrai clic — editingIndex=${etat}`);

    // Persiste après le premier correctif (retour utilisateur, à nouveau) : un défilement qui continue
    // sur son ÉLAN après le lever du doigt (webkit-overflow-scrolling), ou un tap qui l'arrête net —
    // geste courant sur iOS — ne laisse plus AUCUN touchmove à mesurer, seulement un vrai `scroll`.
    console.log("--- Un défilement sur son ÉLAN (scroll réel, sans touchmove notable) après un tap tactile ne sort pas non plus ---");
    await page.evaluate(() => window.app.editChord(0, 1));
    await page.waitForTimeout(150);
    await page.evaluate(({ x, y }) => {
        const mk = (type, cx, cy) => {
            const t = new Touch({ identifier: 1, target: document.body, clientX: cx, clientY: cy });
            return new TouchEvent(type, { touches: type === 'touchend' ? [] : [t], targetTouches: type === 'touchend' ? [] : [t], changedTouches: [t], bubbles: true, cancelable: true });
        };
        document.dispatchEvent(mk('touchstart', x, y));
        document.dispatchEvent(mk('touchend', x, y)); // relâché tout de suite, sans bouger
        // Cible = document, comme un vrai défilement de PAGE (voir le commentaire de dernierDefilementA
        // dans script.js) : window.dispatchEvent aurait ciblé `window`, jamais vu par un écouteur posé
        // sur `document`, même en phase de capture — ça aurait fait échouer ce test pour la mauvaise
        // raison (le geste réel qu'il décrit, lui, cible bien document).
        document.dispatchEvent(new Event('scroll')); // l'élan continue après le lever du doigt
        const el = document.elementFromPoint(x, y) || document.body;
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
    }, { x: 200, y: 606 });
    await page.waitForTimeout(150);
    etat = await page.evaluate(() => window.app.editingIndex);
    check(etat === 1, `l'édition reste active après un défilement sur son élan — editingIndex=${etat}`);

    console.log('--- Contrôle : un vrai défilement SANS aucun toucher (molette, ordinateur) ne bloque pas le clic qui suit ---');
    // Attente > 600ms (la fenêtre « toucher récent », voir toucheActiveJusqua dans script.js) : sans
    // elle, le touchstart du cas précédent restait « actif » et faussait CE cas-ci pour la mauvaise
    // raison — même piège que documenté dans sortie_edition_involontaire_test.js (un cas contamine le
    // suivant), pas un vrai défaut du correctif.
    await page.waitForTimeout(700);
    await page.evaluate(() => window.app.editChord(0, 1));
    await page.waitForTimeout(150);
    await page.evaluate(({ x, y }) => {
        document.dispatchEvent(new Event('scroll')); // aucun touchstart avant : geste souris, pas doigt
        const el = document.elementFromPoint(x, y) || document.body;
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
    }, { x: 200, y: 606 });
    await page.waitForTimeout(150);
    etat = await page.evaluate(() => window.app.editingIndex);
    check(etat === null, `sans toucher préalable, un clic « ailleurs » sort bien de l'édition même juste après un scroll — editingIndex=${etat}`);

    // LA VRAIE CAUSE, trouvée après coup par instrumentation (retour utilisateur, un TROISIÈME
    // signalement malgré les deux correctifs précédents : « toujours le problème », « je n'arrive
    // toujours pas à le faire fonctionner ») : un SECOND mécanisme de sortie, setupSortieEditionAuClic,
    // sur 'pointerdown' EN PHASE DE CAPTURE — donc AVANT le moindre mouvement, avant que touchmove et
    // scroll ci-dessus n'aient la moindre chance d'agir. Ci-dessous : un simple pointerdown tactile
    // (le tout début d'un geste, avant de savoir s'il deviendra un défilement) sur une zone qui
    // n'était couverte par AUCUNE des deux anciennes listes séparées (NEUTRES vs inEditor).
    console.log('--- Un simple pointerdown tactile (le début d\'un geste, avant tout mouvement) ne sort PAS de l\'édition ---');
    await page.waitForTimeout(700); // hors de la fenêtre "toucher récent" des cas précédents
    await page.evaluate(() => window.app.editChord(0, 1));
    await page.waitForTimeout(150);
    await page.evaluate(({ x, y }) => {
        const el = document.elementFromPoint(x, y) || document.body;
        el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, pointerType: 'touch' }));
    }, { x: 200, y: 606 });
    await page.waitForTimeout(150);
    etat = await page.evaluate(() => window.app.editingIndex);
    check(etat === 1, `un pointerdown tactile seul (sans clic derrière) ne ferme pas l'édition — editingIndex=${etat}`);

    console.log('--- ...mais un VRAI tap complet (pointerdown + pointerup + clic tactile) sort toujours de l\'édition ---');
    await page.evaluate(({ x, y }) => {
        const el = document.elementFromPoint(x, y) || document.body;
        const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, pointerType: 'touch' };
        el.dispatchEvent(new PointerEvent('pointerdown', opts));
        el.dispatchEvent(new PointerEvent('pointerup', opts));
        el.dispatchEvent(new MouseEvent('click', opts));
    }, { x: 200, y: 606 });
    await page.waitForTimeout(150);
    etat = await page.evaluate(() => window.app.editingIndex);
    check(etat === null, `un vrai tap (pointerdown+pointerup+clic, sans défilement) ferme toujours l'édition — editingIndex=${etat}`);

    console.log('--- Contrôle : à la SOURIS (ordinateur), un pointerdown seul ferme toujours immédiatement (pas de conflit de défilement à gérer) ---');
    await page.evaluate(() => window.app.editChord(0, 1));
    await page.waitForTimeout(150);
    await page.evaluate(({ x, y }) => {
        const el = document.elementFromPoint(x, y) || document.body;
        el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, pointerType: 'mouse' }));
    }, { x: 200, y: 606 });
    await page.waitForTimeout(150);
    etat = await page.evaluate(() => window.app.editingIndex);
    check(etat === null, `à la souris, un pointerdown seul ferme toujours immédiatement — editingIndex=${etat}`);

    check(errors.length === 0, 'aucune erreur JavaScript — ' + JSON.stringify(errors));
    console.log(`\n=== Bilan : ${PASS} PASS / ${FAIL} FAIL ===`);
    await browser.close();
    process.exit(FAIL ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
