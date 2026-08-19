// Curseur de précision du séquenceur — retour utilisateur : « j'arrive mal à gérer les séquenceurs
// et clics, je pense que ça peut être à cause de la forme des pointeurs souris... j'ai besoin de
// quelque chose de fin pour le séquenceur ». Choix fait après essai en direct de 5 candidats
// (artifact de comparaison) : le réticule à espace central (voir .seq-cell dans style.css), scopé
// UNIQUEMENT au séquenceur — retour utilisateur explicite : « je veux ce curseur uniquement dans le
// séquenceur » (pas le manche guitare, pas la grille d'accords, envisagés puis écartés). Second
// retour, pris en compte AVANT de livrer : « il faut bien que ça reste visible sur le séquenceur » —
// vérifié en composant le curseur réellement rendu par-dessus une vraie capture du séquenceur (case
// vide, séparateur de temps, ET directement sur une note colorée) avant de considérer ce point réglé ;
// ce banc verrouille seulement la partie automatisable (la règle CSS s'applique bien, et seulement là
// où elle doit).
//
// Remplace le `cursor: pointer` de base de .seq-cell — donc UNIQUEMENT la case VIDE (le 3e des trois
// gestes documentés dans style.css : bord = ew-resize, corps d'une note = grab, case vide = dessiner).
// Ce banc vérifie donc autant que la règle s'applique QUE les deux curseurs sémantiques déjà en place
// (grab sur une note existante, ew-resize sur son bord) restent, eux, intacts.
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

    // Case VIDE : porte bien le réticule personnalisé (pas le pointer/flèche par défaut).
    const emptyCursor = await page.evaluate(() => {
        const cell = document.querySelector('#arp-sequencer .seq-cell:not(.on)');
        return cell ? getComputedStyle(cell).cursor : null;
    });
    check(!!emptyCursor, "une case vide du séquenceur est bien trouvée");
    check(!!emptyCursor && emptyCursor.startsWith('url("data:image/svg+xml;base64,'), `la case vide porte le réticule personnalisé — obtenu ${JSON.stringify(emptyCursor)}`);
    check(!!emptyCursor && emptyCursor.endsWith('pointer'), "le mot-clé pointer reste en secours si l'image ne charge pas");

    // Note EXISTANTE (corps) : garde son curseur grab au survol, inchangé.
    const onCell = await page.$('#arp-sequencer .seq-cell.on:not(.seq-cell-edge)');
    if (onCell) {
        const box = await onCell.boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(120);
        const cur = await page.evaluate(el => getComputedStyle(el).cursor, onCell);
        check(cur === 'grab', `une note existante garde bien son curseur "grab" au survol — obtenu ${cur}`);
    } else {
        check(false, "aucune case notée trouvée pour vérifier le curseur grab (motif inattendu)");
    }

    // Bord d'une note : garde son curseur ew-resize, inchangé.
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
