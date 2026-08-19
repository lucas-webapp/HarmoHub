// Curseur de précision du séquenceur — retour utilisateur : « j'arrive mal à gérer les séquenceurs
// et clics, je pense que ça peut être à cause de la forme des pointeurs souris... j'ai besoin de
// quelque chose de fin pour le séquenceur ». Choix fait après essai en direct de 5 candidats
// (artifact de comparaison) : le réticule à espace central (voir --seq-cursor-reticle dans
// style.css), scopé UNIQUEMENT au séquenceur — retour utilisateur explicite : « je veux ce curseur
// uniquement dans le séquenceur » (pas le manche guitare, pas la grille d'accords, envisagés puis
// écartés). Second retour, pris en compte AVANT de livrer : « il faut bien que ça reste visible sur
// le séquenceur » — vérifié en composant le curseur réellement rendu par-dessus une vraie capture du
// séquenceur (case vide, séparateur de temps, ET directement sur une note colorée) avant de
// considérer ce point réglé ; ce banc verrouille seulement la partie automatisable (la règle CSS
// s'applique bien, et seulement là où elle doit).
//
// TROISIÈME retour, une fois la 1re version (réticule sur case vide, "main" grab sur une note
// existante) livrée : « le curseur change de forme (main) lorsque je suis sur une barre pour la
// sélectionner. Il faut garder le curseur que tu viens de mettre en place. » — le réticule couvre
// donc maintenant AUSSI le corps d'une note existante (survol ET pendant le glissé), pas seulement
// la case vide. Seul le BORD garde encore son propre curseur ew-resize (direction de l'étirement,
// une information que le réticule ne porte pas).
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, plan, bilan } = require('./_harness')('séquenceur : curseur de précision (réticule)');
plan(6);

(async () => {
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await page.waitForTimeout(400);
    await page.evaluate(() => {
        const mk = (r, q, b) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 0, octave: 3, bass: null, playStyle: 'held' });
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [mk('C', 'maj', 4)] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(400);
    await page.evaluate(() => window.app.editChord(0, 0));
    await page.waitForTimeout(300);
    await page.click('#grid-zoom');
    await page.waitForTimeout(400);

    const isReticle = cur => !!cur && cur.startsWith('url("data:image/svg+xml;base64,') && cur.endsWith('pointer');

    // Case VIDE : porte bien le réticule personnalisé (pas le pointer/flèche par défaut).
    const emptyCursor = await page.evaluate(() => {
        const cell = document.querySelector('#arp-sequencer .seq-cell:not(.on)');
        return cell ? getComputedStyle(cell).cursor : null;
    });
    check(!!emptyCursor, "une case vide du séquenceur est bien trouvée");
    check(isReticle(emptyCursor), `la case vide porte le réticule personnalisé — obtenu ${JSON.stringify(emptyCursor)}`);

    // Note EXISTANTE (corps) : garde AUSSI le réticule au survol — retour utilisateur, ne DOIT PLUS
    // basculer sur la "main" (grab) comme dans la première version.
    const onCell = await page.$('#arp-sequencer .seq-cell.on:not(.seq-cell-edge)');
    if (onCell) {
        const box = await onCell.boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(120);
        const curHover = await page.evaluate(el => getComputedStyle(el).cursor, onCell);
        check(isReticle(curHover), `une note existante garde le réticule au survol (plus de "main") — obtenu ${JSON.stringify(curHover)}`);

        // Pendant le glissé (mousedown maintenu) aussi, pas seulement au survol.
        await page.mouse.down();
        await page.waitForTimeout(80);
        const curActive = await page.evaluate(el => getComputedStyle(el).cursor, onCell);
        await page.mouse.up();
        check(isReticle(curActive), `le réticule reste aussi pendant le glissé d'une note (plus de "grabbing") — obtenu ${JSON.stringify(curActive)}`);
    } else {
        check(false, "aucune case notée trouvée pour vérifier le curseur (motif inattendu)");
        check(false, "aucune case notée trouvée pour vérifier le curseur pendant le glissé (motif inattendu)");
    }

    // Bord d'une note : garde son curseur ew-resize, inchangé — seule info que le réticule ne porte pas.
    const edgeCell = await page.$('#arp-sequencer .seq-cell-edge');
    if (edgeCell) {
        const box = await edgeCell.boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(120);
        const cur = await page.evaluate(el => getComputedStyle(el).cursor, edgeCell);
        check(cur === 'ew-resize', `le bord d'une note garde bien son curseur "ew-resize" au survol — obtenu ${cur}`);
    } else {
        check(false, "aucun bord de note trouvé pour vérifier le curseur ew-resize (motif inattendu)");
    }

    // Manche guitare / grille d'accords : PAS le réticule (scope explicitement limité au séquenceur).
    const gridCellCursor = await page.evaluate(() => {
        const cell = document.querySelector('.grid-cell');
        return cell ? getComputedStyle(cell).cursor : null;
    });
    check(!gridCellCursor || !gridCellCursor.includes('base64'), `la grille d'accords n'a PAS le réticule (scope séquenceur uniquement) — obtenu ${JSON.stringify(gridCellCursor)}`);

    console.log('Errors:', JSON.stringify(errors));

    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
