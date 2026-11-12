// RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4a, 12/11) : le réticule vaut désormais pour le séquenceur du bloc « Vues ».
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
const { check, exiger, plan, bilan } = require('./_harness')('séquenceur : curseur de précision (réticule)');
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
    // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4a, 12/11) : le réticule passe au séquenceur du bloc « Vues » (style.css, fin de fichier). Ses notes ne s'étirent
    // plus par le bord (pas de glisser-déposer au pixel près, cahier 3 bis : on peint) : le curseur « ew-resize » du bord n'a plus d'objet ; la case vide, la note
    // au survol et la note pendant le glissé gardent le réticule.
    const R = require('./_retrait_ancien');
    await R.ouvrirNouveau(page);
    const isReticle = cur => !!cur && cur.startsWith('url("data:image/svg+xml;base64,') && cur.endsWith('pointer');
    await R.cliquer(page, '#sq-effacer');
    const emptyCursor = await page.evaluate(() => { const cell = document.querySelector('#sq-grille .sq-case[data-r]:not(.on)'); return cell ? getComputedStyle(cell).cursor : null; });
    check(!!emptyCursor, "une case vide du séquenceur est bien trouvée");
    check(isReticle(emptyCursor), `la case vide porte le réticule personnalisé — obtenu ${JSON.stringify(emptyCursor)}`);
    await page.keyboard.press('Control+z'); await page.waitForTimeout(300); // le Plaqué d'origine revient : des notes à survoler
    const onCell = await page.$('#sq-grille .sq-case.on .sq-note');
    exiger(!!onCell, 'une note existe pour vérifier le curseur');
    const box = await onCell.boundingBox();
    await page.mouse.move(box.x + 6, box.y + box.height / 2);
    await page.waitForTimeout(120);
    const curHover = await page.evaluate(el => getComputedStyle(el).cursor, onCell);
    check(isReticle(curHover), `une note existante garde le réticule au survol (pas de "main") — obtenu ${JSON.stringify(curHover)}`);
    await page.mouse.down();
    await page.waitForTimeout(80);
    const curActive = await page.evaluate(el => getComputedStyle(el).cursor, onCell);
    await page.mouse.up();
    check(isReticle(curActive), `le réticule reste aussi pendant le geste (pas de "grabbing") — obtenu ${JSON.stringify(curActive)}`);
    check(await page.evaluate(() => !document.querySelector('#sq-grille .seq-cell-edge')), 'plus de bord de note à étirer (on peint les croches) : le curseur « ew-resize » n\'a plus d\'objet');

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
