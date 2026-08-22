// CONTRAT CHANGÉ, sur retour utilisateur. La case n'est plus carrée : « il prend une ligne entière en
// hauteur pour rien, ce qui limite le visionnage de toutes mes sections en même temps » puis « conserver
// la hauteur du bouton, mais réduire sa largeur et le placer en fin de ligne ». Elle vit désormais dans
// une gouttière étroite réservée au bout de CHAQUE ligne (voir --col-plus et loadProgression), et se
// pose sur la dernière ligne d'accords : elle ne passe donc plus jamais à la ligne. Mesuré : une partie
// de quatre accords passe de 206 à 104 px, soit la totalité du coût supprimée.
// La cible tactile n'est pas oubliée pour autant : la gouttière s'élargit sur téléphone (34px contre 26),
// et c'est ce que vérifie la partie mobile plus bas.
// La case « + » en bout de grille : un signe, une cible carrée, et toujours utilisable.
// Retour utilisateur : « un "+" suffit à comprendre, et tu peux diminuer la taille de la case, je
// n'ai pas besoin de toute cette largeur pour cliquer ». Elle occupait 2 temps pleins, soit 125px
// sur ordinateur (mesuré) pour un simple signe.
// Le plafond de largeur est --row-h (la HAUTEUR d'une case) : cible carrée, qui suit le zoom
// vertical au lieu d'un nombre figé. C'est un PLAFOND, jamais un plancher — au téléphone la piste
// ne fait que 44px et la case y garde ses 44px, la cible tactile recommandée.
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// La police vient de Google Fonts, injoignable derrière le proxy du bac à sable : bruit filtré.

let PASS = 0, FAIL = 0;
function check(c, l) { if (c) { PASS++; console.log('PASS - ' + l); } else { FAIL++; console.log('FAIL - ' + l); } }

const mk = (root, q, beats) => ({ root, quality: q, beats, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held', instrument: 'piano', arpPattern: '', seqEdited: false, guitarLock: null, extraNotes: [], intensity: 75, intensityPerStep: {} });

const prep = async (p) => {
    await p.goto(`${BASE}/index.html`);
    await p.waitForTimeout(500);
    await p.evaluate((s) => {
        const mk = eval('(' + s + ')');
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet',
            chords: [mk('C', 'maj', 4), mk('A', 'min7', 4), mk('F', 'maj7', 4)] }] }));
    }, mk.toString());
    await p.reload();
    await p.waitForTimeout(900);
};
const caseP = (p) => p.evaluate(() => {
    const add = document.querySelector('.grid-cell-add');
    const inp = add.querySelector('input');
    const b = add.getBoundingClientRect();
    const grille = document.querySelector('.chord-grid').getBoundingClientRect();
    return {
        w: Math.round(b.width), h: Math.round(b.height),
        placeholder: inp.placeholder,
        aria: inp.getAttribute('aria-label'),
        titreComplet: (inp.title || '').length > 20,
        deborde: Math.round(b.right) > Math.round(grille.right) + 1,
        pageDeborde: document.documentElement.scrollWidth > window.innerWidth,
    };
});

(async () => {
    const browser = await chromium.launch();
    const errs = [];

    console.log('\n=== A. Ordinateur : un « + », une cible carrée ===');
    const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|fonts\.googleapis|fonts\.gstatic/.test(m.text())) errs.push('console: ' + m.text()); });
    await prep(p);
    let c = await caseP(p);
    check(c.placeholder === '+', `le libellé se réduit au signe — « ${c.placeholder} »`);
    check(c.w < c.h && c.h >= 40, `la case est ÉTROITE et garde la hauteur d'une case — ${c.w}x${c.h} (contrat changé : voir l'en-tête)`);
    check(c.w < 100, `...et nettement moins large qu'avant (125px mesurés) — ${c.w}px`);
    check(c.w >= 24, `...tout en restant cliquable à la souris — ${c.w}px`);
    check(!c.deborde && !c.pageDeborde, 'elle ne déborde ni de la grille ni de la page');

    console.log('\n=== B. Le sens n\'est pas perdu pour autant ===');
    check(/Ajouter un accord/.test(c.aria || ''), `le lecteur d'écran entend toujours la phrase entière — « ${c.aria} »`);
    check(c.titreComplet, 'et le survol garde l\'explication complète (syntaxe, basse, séparateur)');

    console.log('\n=== C. Elle marche toujours : on tape un accord dedans ===');
    const avant = await p.evaluate(() => loadProgressionSections()[0].chords.length);
    await p.click('.grid-cell-add input');
    await p.type('.grid-cell-add input', 'Dm7');
    await p.keyboard.press('Enter');
    await p.waitForTimeout(600);
    const apres = await p.evaluate(() => ({
        n: loadProgressionSections()[0].chords.length,
        dernier: loadProgressionSections()[0].chords.slice(-1)[0],
    }));
    check(apres.n === avant + 1, `un accord de plus dans la grille — ${avant} puis ${apres.n}`);
    check(apres.dernier.root === 'D' && apres.dernier.quality === 'min7',
        `...et c'est bien celui qu'on a tapé — ${apres.dernier.root}${apres.dernier.quality}`);

    console.log('\n=== D. Le carré suit le zoom vertical, il n\'est pas figé ===');
    const avantZoom = (await caseP(p)).w;
    await p.evaluate(() => window.app.setZoomLevel('classicGrid', 'y', 1.5));
    await p.waitForTimeout(600);
    const c2 = await caseP(p);
    // La largeur ne suit PLUS le zoom vertical : la gouttière est une largeur fixe, c'est ce qui la
    // rend prévisible d'une partie à l'autre. Seule la hauteur suit, comme celle des accords.
    check(c2.w === avantZoom, `agrandie verticalement, la gouttière garde sa largeur — ${avantZoom}px puis ${c2.w}px`);
    check(c2.h > c2.w, `...et la case reste plus haute que large — ${c2.w}x${c2.h}`);
    await p.close();

    console.log('\n=== E. Téléphone : la cible tactile n\'a pas rétréci ===');
    const m = await browser.newPage({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
    m.on('pageerror', e => errs.push('mobile: ' + e.message));
    await prep(m);
    const cm = await caseP(m);
    check(cm.w >= 32, `elle garde une cible tactile au doigt — ${cm.w}x${cm.h} (la gouttière s'élargit sur téléphone)`);
    check(cm.placeholder === '+', 'même signe qu\'ailleurs');
    check(!cm.deborde && !cm.pageDeborde, 'rien ne déborde de l\'écran du téléphone');
    await m.close();

    await browser.close();
    check(errs.length === 0, 'aucune erreur JavaScript' + (errs.length ? ' — ' + errs[0] : ''));
    console.log(`\n=== ${PASS} PASS / ${FAIL} FAIL ===`);
    process.exit(FAIL ? 1 : 0);
})();
