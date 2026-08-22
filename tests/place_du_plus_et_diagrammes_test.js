// Trois retours d'un même passage : la place du « + », et deux cadrages de diagrammes.
//
// RETOURS UTILISATEUR :
//   1. « Le bouton + pour ajouter un accord est une bonne idée. Cependant, il prend une ligne entière
//      en hauteur pour rien, ce qui limite le visionnage de toutes mes sections en même temps. […]
//      Lorsqu'il est au milieu d'une ligne, il ne me gêne pas. »
//      puis, sur ma première version (une bande fine sur sa propre ligne) : « pour plus de cohérence,
//      que penses-tu de conserver la hauteur du bouton, mais de réduire sa largeur et le placer en fin
//      de ligne ? » — c'est cette seconde version qui est retenue, et elle est meilleure : zéro pixel
//      de hauteur au lieu de 42.
//   2a. « Avec un nom édité pour la guitare, les titres ne sont pas alignés en hauteur. »
//   2b. « Les boutons diagrammes seraient mieux en haut à droite de l'encadré. Là ils sont centrés,
//      c'est un peu bizarre. »
//
// RELEVÉS AVANT CORRECTIF : une partie de 4 accords (qui remplissent exactement leur ligne) mesurait
// 206 px contre 104 pour 3 accords — 102 px pour loger un bouton. Titre piano à y=732, titre guitare à
// y=722 : dix pixels d'écart pour deux chips de même hauteur. Bascules à y=762 dans une carte allant
// jusqu'à 846, flottant au milieu du bord droit.
const { chromium } = require('playwright');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('place du « + » et cadrage des diagrammes');
plan(20);

const semer = (n) => {
    const mk = r => ({ root: r, quality: 'maj', beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
    localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Section', chords: ['C', 'F', 'G', 'A', 'D', 'E', 'B', 'G'].slice(0, n).map(mk) }] }));
};

const releverPlus = () => {
    const g = document.querySelector('.chord-grid');
    const add = document.querySelector('.grid-cell-add');
    const cases = [...document.querySelectorAll('.grid-cell:not(.grid-cell-add)')];
    const ra = add.getBoundingClientRect();
    const der = cases[cases.length - 1].getBoundingClientRect();
    const sous = document.elementFromPoint(ra.left + ra.width / 2, ra.top + ra.height / 2);
    return {
        hGrille: Math.round(g.getBoundingClientRect().height),
        l: Math.round(ra.width), h: Math.round(ra.height),
        memeLigne: Math.abs(ra.top - der.top) < 4,
        aDroite: ra.left >= der.right - 1,
        chevauche: ra.left < der.right - 2 && ra.right > der.left + 2 && ra.top < der.bottom - 2 && ra.bottom > der.top + 2,
        atteignable: !!sous && (sous === add || add.contains(sous)),
        numeroFin: (document.querySelector('.row-measure-end') || {}).textContent || null,
        deborde: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
};

(async () => {
    const navigateur = await chromium.launch();
    const page = await navigateur.newPage({ viewport: { width: 1440, height: 900 } });
    const erreurs = [];
    page.on('pageerror', e => erreurs.push(e.message));
    await page.goto(`${BASE}/index.html?nocache=` + Date.now());
    await page.waitForTimeout(400);

    // ---------- 1. Le « + » ne coûte plus une ligne ----------
    const hauteurs = {};
    for (const n of [1, 3, 4, 5, 8]) {
        await page.evaluate(semer, n);
        await page.reload({ waitUntil: 'load' });
        await page.waitForTimeout(650);
        const r = await page.evaluate(releverPlus);
        hauteurs[n] = r.hGrille;
        check(r.memeLigne && r.aDroite,
            `${n} accords : le « + » est en bout de la dernière ligne d'accords, à droite du dernier`);
        check(!r.chevauche && r.atteignable && !r.deborde,
            `${n} accords : il ne chevauche rien, répond au clic, et ne fait rien déborder`);
        check(r.h > 40 && r.l <= 40,
            `${n} accords : hauteur d'une case conservée, largeur réduite (${r.l}x${r.h}) — c'est la forme demandée`);
    }

    // LE CŒUR DE LA DEMANDE : quatre accords remplissent exactement leur ligne. Avant, cela coûtait une
    // ligne entière de plus ; désormais, la hauteur doit être EXACTEMENT celle de trois accords.
    check(hauteurs[4] === hauteurs[3],
        `4 accords (ligne pleine) ne coûtent pas un pixel de plus que 3 : ${hauteurs[4]} px contre ${hauteurs[3]} (avant : 206 contre 104)`);
    check(hauteurs[8] === hauteurs[5],
        `8 accords (deux lignes pleines) idem : ${hauteurs[8]} px contre ${hauteurs[5]}`);
    // Non-régression : la grille reste PROPORTIONNELLE AU TEMPS. La gouttière est prise sur toutes les
    // lignes à la fois, donc deux accords de même durée gardent la même largeur — c'est ce qui
    // interdisait de simplement rétrécir le dernier accord.
    await page.evaluate(semer, 4);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(650);
    const largeurs = await page.evaluate(() => [...document.querySelectorAll('.grid-cell:not(.grid-cell-add)')]
        .map(c => Math.round(c.getBoundingClientRect().width)));
    check(new Set(largeurs).size === 1,
        `quatre accords de même durée gardent la même largeur (${largeurs.join(', ')}) — la grille reste proportionnelle au temps`);

    // ---------- 2. Les diagrammes ----------
    for (const id of ['toggle-viz-piano', 'toggle-viz-guitar']) {
        if (!(await page.evaluate(i => document.getElementById(i).getAttribute('aria-pressed') === 'true', id))) await page.click('#' + id);
    }
    await page.waitForTimeout(400);

    const cadre = async () => page.evaluate(() => {
        const carte = document.querySelector('.viz-card').getBoundingClientRect();
        const bt = document.querySelector('.viz-toggle').getBoundingClientRect();
        const sous = document.elementFromPoint(bt.left + bt.width / 2, bt.top + bt.height / 2);
        const chip = s => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().top) : null; };
        return {
            depuisLeHaut: Math.round(bt.top - carte.top), depuisLaDroite: Math.round(carte.right - bt.right),
            hauteurCarte: Math.round(carte.height),
            basculesAtteignables: !!sous && document.querySelector('.viz-toggle').contains(sous),
            titrePiano: chip('#current-chord-display .chord-chip'), titreGuitare: chip('#guitar-override-row .chord-chip'),
        };
    });

    // 2b — en haut à droite, dans les deux états (avec et sans substitut).
    const sans = await cadre();
    check(sans.depuisLeHaut < 20 && sans.depuisLaDroite < 20,
        `bascules ancrées en haut à droite de l'encadré : ${sans.depuisLeHaut} px du haut, ${sans.depuisLaDroite} px de la droite (avant : centrées verticalement)`);
    check(sans.basculesAtteignables, 'et elles répondent au clic à cet emplacement');

    // 2a — avec un nom édité pour la guitare, les deux titres sur la même ligne d'horizon.
    await page.evaluate(() => window.app.editChord(0, 0));
    await page.waitForTimeout(350);
    await page.click('#guitar-edit-btn');
    await page.waitForTimeout(300);
    await page.click('#guitar-edit-tab-name').catch(() => {});
    await page.fill('#guitar-name-input', 'Am');
    await page.click('#guitar-name-validate');
    await page.waitForTimeout(350);
    await page.click('#guitar-edit-close');
    await page.waitForTimeout(500);

    const avec = await cadre();
    exiger(avec.titreGuitare != null, 'le bandeau du substitut guitare est bien affiché');
    check(avec.titrePiano === avec.titreGuitare,
        `les deux titres sont sur la même ligne d'horizon : piano ${avec.titrePiano}, guitare ${avec.titreGuitare} (avant : 10 px d'écart)`);
    check(avec.depuisLeHaut < 20 && avec.depuisLaDroite < 20,
        `les bascules restent en haut à droite une fois le substitut affiché : ${avec.depuisLeHaut} / ${avec.depuisLaDroite} px`);
    // Non-régression : le piano reste centré sur le MANCHE, ce que fait une mesure réelle des deux
    // centres (voir alignPianoOnGuitarDiagram) — pas le align-items qu'on vient de changer.
    const centres = await page.evaluate(() => {
        const p = document.querySelector('#piano-viz'), g = document.querySelector('#guitar-viz');
        if (!p || !g) return null;
        const rp = p.getBoundingClientRect(), rg = g.getBoundingClientRect();
        return Math.round((rp.top + rp.height / 2) - (rg.top + rg.height / 2));
    });
    check(centres != null && Math.abs(centres) <= 3,
        `le piano reste centré sur le manche malgré le nouvel alignement (${centres} px d'écart entre les deux centres)`);

    check(erreurs.length === 0, `aucune erreur JavaScript (${erreurs.slice(0, 2).join(' | ')})`);
    await navigateur.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
