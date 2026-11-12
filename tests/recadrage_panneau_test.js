// OUVRIR LE PANNEAU D'UN ACCORD NE RECADRE PLUS L'ÉCRAN (refonte du séquenceur, point C, 11/11), avec de vrais gestes.
//
// LE CONSTAT DE L'UTILISATEUR : « cliquer un accord ouvre le panneau, mais il recadre l'écran à chaque fois : sauts d'affichage ».
// LA RÈGLE (docs/refonte-sequenceur.md, C) : « ne bouger l'écran que si la case touchée finit cachée sous le panneau, et du strict minimum (jamais de recentrage) ».
//
// CE QUI SAUTAIT, MESURÉ : à l'ordinateur, l'inspecteur réservait une colonne de 344px — la zone de la grille passait de 1400 à 1020px (à 1440px de large), la
// rangée de réglages passait sur deux lignes (+42px) et la grille centrée partait de 190px vers la gauche ; séquenceur ouvert, chaque clic sur un accord le
// mettait en modification, donc à chaque clic. Au téléphone, le panneau (jusqu'à 500px) ne laisse qu'une rangée au-dessus de lui : la page défile, mais
// seulement du nécessaire (assurerCaseVisiblePanneau).
//
// CE QUE LE BANC TIENT : la case cliquée (et ses voisines) ne bouge pas d'un pixel à l'écran — ouverture de la bulle, « Réglages du son », ‹ ›, Échap, fermeture ;
// séquenceur ouvert, un clic sur un accord le suit sans faire apparaître l'inspecteur ; l'inspecteur flotte à droite de la fenêtre de grille sans la recouvrir
// et la rangée de réglages garde une ligne ; au téléphone, une case qui reste visible au-dessus du panneau ne fait rien défiler, une case qui finirait dessous
// défile JUSTE assez pour se poser au-dessus de lui (jamais plus).
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('ouvrir sans recadrer');
const { estBruitReseau } = require('./_harness');

plan(37);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const graine = () => {
    const mk = (r, q, b = 4) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
    const P = (t) => ({ title: t, chords: [mk('C', 'maj7'), mk('A', 'min7'), mk('D', 'min7'), mk('G', 'dom7'), mk('E', 'min7'), mk('A', 'dom7'), mk('D', 'min7'), mk('G', 'dom7')] });
    const S = [P('Intro'), P('Couplet'), P('Refrain'), P('Pont'), P('Fin'), P('Coda')];
    localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), sections: S }]));
    localStorage.setItem('harmohubCurrentSongId', 's1');
    localStorage.setItem('myProgression', JSON.stringify({ sections: S }));
    localStorage.removeItem('harmohubSeqDockHeight');
    sessionStorage.setItem('cc_accueil_vu', '1');
};

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    const ouvrir = async (viewport, tactile = false) => {
        const ctx = await nav.newContext({ viewport, hasTouch: tactile, isMobile: tactile });
        const p = await ctx.newPage();
        p.on('pageerror', e => erreurs.push(e.message));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) erreurs.push('console: ' + m.text()); });
        await p.goto(`${BASE}/index.html`);
        await p.evaluate(graine);
        await p.reload();
        await p.waitForTimeout(1000);
        return p;
    };
    const SEL = '#progression-sections .grid-cell[data-index]'; // les cases d'accord, sans les cases « + » d'ajout
    // Où sont, à l'écran, les cases d'accord (relu, jamais déclenché par window.app) : la position de CHACUNE, et la hauteur de la rangée de réglages.
    const ecran = (p) => p.evaluate((sel) => JSON.stringify({
        cases: [...document.querySelectorAll(sel)].slice(0, 12).map(c => { const r = c.getBoundingClientRect(); return Math.round(r.left) + ',' + Math.round(r.top) + ',' + Math.round(r.width); }),
        tete: Math.round(document.querySelector('.grid-head-sticky').getBoundingClientRect().height),
    }), SEL);
    const centre = async (p, i) => { const b = await p.locator(SEL).nth(i).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, b }; };
    const cliquer = async (p, i, ms = 700) => { const c = await centre(p, i); await p.mouse.click(c.x, c.y); await p.waitForTimeout(ms); };
    // LE GESTE QUI OUVRE LA BULLE (ordinateur) : le double-clic depuis le point B (un clic seul ne fait qu'entendre l'accord).
    const ouvrirBulle = async (p, i) => { const c = await centre(p, i); await p.mouse.dblclick(c.x, c.y); await p.waitForTimeout(700); };
    const inspecteur = (p) => p.evaluate(() => {
        const f = document.querySelector('.sidebar-frame'), r = f.getBoundingClientRect(), g = document.getElementById('grille-cadre').getBoundingClientRect();
        return { visible: r.width > 0 && r.height > 0 && getComputedStyle(f).display !== 'none', g: Math.round(r.left), d: Math.round(r.right), haut: Math.round(r.top), grilleD: Math.round(g.right), edition: window.app.editingIndex };
    });

    // ======================================================================================================
    for (const vp of [{ width: 1440, height: 900 }, { width: 1280, height: 760 }]) {
        console.log(`\n=== A. Ordinateur ${vp.width}×${vp.height} : bulle, Réglages du son, ‹ ›, Échap — rien ne bouge ===`);
        const p = await ouvrir(vp);
        const t0 = await ecran(p);
        await ouvrirBulle(p, 1);
        exiger(await p.locator('#bulle-accord').isVisible(), 'la bulle s\'ouvre sur l\'accord');
        check(await ecran(p) === t0, 'ouvrir la bulle ne déplace aucune case');
        await p.click('#bulle-accord [data-bulle="son"]'); await p.waitForTimeout(900);
        const i1 = await inspecteur(p);
        exiger(i1.visible && i1.edition === 1, '« Réglages du son » ouvre l\'inspecteur sur cet accord');
        const t1 = await ecran(p);
        check(t1 === t0, `l'inspecteur ne déplace aucune case, la rangée de réglages garde sa hauteur${t1 === t0 ? '' : ' — avant ' + t0 + ' / après ' + t1}`);
        check(i1.g >= i1.grilleD && i1.d <= vp.width, `il flotte à droite de la fenêtre de grille sans la recouvrir (grille jusqu'à ${i1.grilleD}, inspecteur ${i1.g}-${i1.d})`);
        // Piège relevé par sentinelle_atteignabilite : flottant tout en haut, il cachait Ajouter et l'aide au bout de l'ajout rapide.
        const ajout = await p.evaluate(() => Math.round(document.getElementById('quick-add-panel').getBoundingClientRect().bottom));
        check(i1.haut >= ajout, `il part sous la rangée de réglages et l'ajout rapide, sans cacher leurs boutons (haut ${i1.haut}, ajout rapide jusqu'à ${ajout})`);
        await cliquer(p, 3);
        check(await ecran(p) === t0, 'un clic sur un autre accord, inspecteur ouvert : rien ne bouge');
        await p.keyboard.press('Escape'); await p.waitForTimeout(500);
        await p.keyboard.press('Escape'); await p.waitForTimeout(500);
        check(await ecran(p) === t0, 'Échap referme : toujours rien de déplacé');
        await p.context().close();
    }

    // ======================================================================================================
    console.log('\n=== B. Ordinateur : séquenceur ouvert, un clic sur un accord le suit sans recadrer ===');
    let p = await ouvrir({ width: 1440, height: 900 });
    // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4a, 12/11) : le séquenceur est celui du bloc « Vues » ; il suit l'accord cliqué sans le mettre en modification.
    const choisiSq = () => p.evaluate(() => { const n = document.querySelector('#sq-grille .sq-nom.choisi'); return n ? +n.dataset.c : null; });
    { const v = await p.locator('#vue-sequenceur').boundingBox(); await p.mouse.click(v.x + v.width / 2, v.y + v.height / 2); await p.waitForTimeout(900); }
    const s0 = await ecran(p);
    await cliquer(p, 1);
    let i = await inspecteur(p);
    exiger(await choisiSq() === 1 && i.edition == null, 'le séquenceur suit l\'accord cliqué, sans le mettre en modification');
    check(!i.visible, 'sans faire apparaître l\'inspecteur (il recouvrait la droite de l\'éditeur)');
    let s1 = await ecran(p);
    check(s1 === s0, `aucune case ne bouge${s1 === s0 ? '' : ' — avant ' + s0 + ' / après ' + s1}`);
    await p.keyboard.press('Escape'); await p.waitForTimeout(400);
    await cliquer(p, 3);
    i = await inspecteur(p);
    check(await choisiSq() === 3 && !i.visible && await ecran(p) === s0, 'un autre accord : même chose, la grille reste en place');
    check(await p.evaluate(() => document.getElementById('sequenceur').getBoundingClientRect().width) >= 1390, 'le séquenceur garde toute la largeur');
    // Inspecteur demandé, séquenceur ouvert : il apparaît, puis suit les accords suivants sans rien déplacer.
    await p.keyboard.press('Escape'); await p.waitForTimeout(400);
    await ouvrirBulle(p, 2);
    const bulleOk = await p.locator('#bulle-accord').isVisible();
    exiger(bulleOk, 'la bulle s\'ouvre aussi séquenceur ouvert');
    await p.click('#bulle-accord [data-bulle="son"]'); await p.waitForTimeout(900);
    check((await inspecteur(p)).visible && await ecran(p) === s0, '« Réglages du son » montre l\'inspecteur, sans rien déplacer');
    await cliquer(p, 0);
    i = await inspecteur(p);
    check(i.visible && i.edition === 0 && await ecran(p) === s0, 'déjà ouvert, il suit l\'accord suivant');
    { const f = await p.locator('#sq-fermer').boundingBox(); await p.mouse.click(f.x + f.width / 2, f.y + f.height / 2); await p.waitForTimeout(700); }
    check(await ecran(p) === s0, 'fermer le séquenceur ne déplace rien');
    await p.context().close();

    // ======================================================================================================
    console.log('\n=== C. Téléphone : la page ne défile que si la case finirait sous le panneau, et du strict minimum ===');
    p = await ouvrir({ width: 390, height: 844 }, true);
    const toucher = async (i) => { const c = await centre(p, i); await p.touchscreen.tap(c.x, c.y); await p.waitForTimeout(800); };
    // LE GESTE QUI OUVRE LE PANNEAU (téléphone) : depuis le point B, toucher une case déjà choisie (le premier toucher la choisit et la fait entendre).
    const ouvrirPanneau = async (i) => { await toucher(i); await toucher(i); };
    const mesure = (i) => p.evaluate(([sel, i]) => {
        const c = document.querySelectorAll(sel)[i].getBoundingClientRect(), pa = document.getElementById('panneau-accord'), r = pa.getBoundingClientRect();
        const resume = document.getElementById('song-card').getBoundingClientRect(), barre = document.querySelector('.top-bar').getBoundingClientRect();
        return { y: Math.round(scrollY), haut: Math.round(c.top), bas: Math.round(c.bottom), panneau: pa.hidden ? null : Math.round(r.top), plafond: Math.round(Math.max(barre.bottom, resume.height ? resume.bottom : 0)) };
    }, [SEL, i]);
    // On mesure d'abord le haut du panneau ouvert, puis on le referme : c'est lui qui décide quelle case « finirait dessous ».
    await ouvrirPanneau(1);
    const ref = await mesure(1);
    exiger(ref.panneau != null, `le panneau d'accord s'ouvre (haut à ${ref.panneau}px)`);
    await p.keyboard.press('Escape'); await p.waitForTimeout(600);
    // Une case posée juste sous la barre-résumé, assez haut pour tenir au-dessus du panneau : rien ne doit défiler.
    const cible = 9;
    await p.evaluate(([sel, i, y]) => { const c = document.querySelectorAll(sel)[i].getBoundingClientRect(); window.scrollBy(0, c.top - y); }, [SEL, cible, ref.plafond + 14]);
    await p.waitForTimeout(500);
    let m0 = await mesure(cible);
    exiger(m0.bas < ref.panneau - 8, `la case visée tient au-dessus du panneau (${m0.haut}-${m0.bas}px, panneau à ${ref.panneau}px)`);
    await ouvrirPanneau(cible);
    let m1 = await mesure(cible);
    check(m1.panneau != null && m1.y === m0.y && m1.haut === m0.haut, `case visible au-dessus du panneau : la page ne bouge pas (défilement ${m0.y} → ${m1.y})`);
    await p.keyboard.press('Escape'); await p.waitForTimeout(600);
    // Une case plus bas, qui finirait sous le panneau : la page défile juste assez pour la poser au-dessus de lui.
    const basse = 26;
    m0 = await mesure(basse);
    exiger(m0.haut > ref.panneau && m0.bas < 844 - 70, `une case visible, plus bas que le haut du panneau (${m0.haut}px)`);
    await ouvrirPanneau(basse);
    m1 = await mesure(basse);
    exiger(m1.panneau != null, 'le panneau s\'ouvre sur elle');
    check(m1.bas <= m1.panneau - 7 && m1.bas >= m1.panneau - 10, `elle se pose JUSTE au-dessus du panneau (bas de la case ${m1.bas}px, panneau ${m1.panneau}px)`);
    check(m1.y - m0.y === m0.bas - m1.bas, `et la page n'a défilé que de ce qu'il fallait (${m1.y - m0.y}px)`);
    // Toucher la même case, panneau ouvert, ne refait rien défiler.
    const m2 = await mesure(basse);
    await toucher(basse);
    const m3 = await mesure(basse);
    check(m3.y === m2.y, `retoucher la même case ne fait rien défiler (${m2.y} → ${m3.y})`);
    // ‹ › vers un voisin de la même rangée : déjà au-dessus du panneau, rien ne bouge.
    const avantNav = await mesure(basse + 1);
    await p.click('#panneau-accord [data-bulle="suiv"]'); await p.waitForTimeout(700);
    const apresNav = await mesure(basse + 1);
    check(await p.evaluate(() => window.app._bulle && window.app._bulle.index) === (basse + 1) % 8, '› passe à l\'accord suivant');
    check(apresNav.y === avantNav.y, `le voisin est déjà visible : rien ne défile (${avantNav.y} → ${apresNav.y})`);
    check(await p.evaluate(() => getComputedStyle(document.querySelector('.sidebar-frame')).position) !== 'absolute', 'le téléphone ne prend pas l\'inspecteur flottant');
    await p.context().close();

    check(erreurs.length === 0, `aucune erreur de page${erreurs.length ? ' : ' + erreurs.slice(0, 3).join(' | ') : ''}`);
    await nav.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
