// L7d (15/11) — TÉLÉPHONE : « + Accord » dans l'en-tête de chaque partie, « + Section » discret, bande fixe du bas. Lettres O (5), P (2, 3, 4), Q (1), R (2).
//
// CE QUI A ÉTÉ DÉCIDÉ (14/11) : « au téléphone, je n'aime pas trop ce bouton plus à la suite qui n'est pas très compréhensible » → plus de « + » nu au bout de chaque ligne d'accords ; à la place un
// petit bouton GRIS « + Accord » (28 px) tout à droite de l'en-tête de chaque partie, après le ⋯. « Le plus section doit être un petit bouton gris, sobre comme sur ordinateur » ; « je voudrais le
// voir uniquement si je scrolle, tout en bas, juste sous la grille » ; « les boutons Fichiers et les diagrammes d'accord tout en bas, au-dessus de la barre de lecture » → une bande FIXE :
// Clavier / Guitare à gauche, Fichier à droite, au-dessus de la barre de lecture, masquée quand le panneau d'accord ou d'ajout est ouvert.
//
// Ce que le banc éprouve, au doigt :
//   A. « + Accord » : à droite de l'en-tête de chaque partie, après le ⋯, 28 px, gris ; il ouvre le panneau d'ajout sur SA partie ; plus aucun « + » nu ;
//   B. « + Section » : sous le pli au départ, visible en défilant, petit, gris, pointillé, libellé court ; caché tant que la grille n'est pas dessinée ; il ajoute une section ;
//   C. la bande du bas : Clavier / Guitare à gauche, Fichier à droite, fixes au-dessus de la barre de lecture, 12 px de la marge ; elles marchent ; elles se cachent sous un panneau ;
//   D. 320 px : rien ne se recouvre ; l'ordinateur n'a pas bougé.
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('téléphone : « + Accord », « + Section » et la bande du bas (L7d)');
const { estBruitReseau } = require('./_harness');
const V = require('./_verre_commun');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';

plan(28);

const mk = (root, quality) => ({ root, quality, beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
const SECTIONS = [
    { title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7'), mk('D', 'min7'), mk('G', '7'), mk('E', 'min7'), mk('F', 'maj7')] },
    { title: 'Refrain', chords: [mk('F', 'maj'), mk('G', 'maj'), mk('C', 'maj'), mk('A', 'min')] },
];

async function ouvrir(nav, contexte, erreurs, nom) {
    const ctx = await nav.newContext(contexte);
    await ctx.addInitScript((sections) => {
        if (sessionStorage.getItem('banc-l7d')) return;
        sessionStorage.setItem('banc-l7d', '1');
        localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Ballade', bpm: 120, timeSig: '4/4', groove: 'straight', savedAt: Date.now(), sections }]));
        localStorage.setItem('harmohubCurrentSongId', 's1');
        localStorage.setItem('myProgression', JSON.stringify({ sections }));
    }, SECTIONS);
    await ctx.route(/gstatic\.com|googleapis\.com|tonejs\.github\.io/, r => r.abort());
    const p = await ctx.newPage();
    p.on('pageerror', e => erreurs.push(nom + e.message));
    p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !V.BRUIT.test(m.text())) erreurs.push(nom + 'console: ' + m.text()); });
    await p.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await p.waitForFunction(() => !!window.app);
    await p.waitForTimeout(800);
    return { p, ctx };
}

const tel = (l, h = 844) => ({ viewport: { width: l, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
const toucher = async (p, sel, ms = 300) => { await p.tap(sel); await p.waitForTimeout(ms); };
const boite = (p, sel) => p.evaluate((s) => {
    const e = document.querySelector(s); if (!e) return null;
    const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
    return { x: r.left, y: r.top, w: r.width, h: r.height, rt: r.right, b: r.bottom, vis: r.width > 1 && r.height > 1 && cs.display !== 'none' && cs.visibility !== 'hidden', bord: cs.borderTopColor, style: cs.borderTopStyle, couleur: cs.color, police: parseFloat(cs.fontSize), fond: cs.backgroundColor, pos: cs.position };
}, sel);
const defiler = async (p, haut) => { await p.evaluate((h) => window.scrollTo(0, h ? 0 : document.documentElement.scrollHeight), haut); await p.waitForTimeout(350); };

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    try {
        // ===== A. « + ACCORD » ======================================================================================================
        console.log('=== A. « + Accord » dans l\'en-tête de chaque partie ===');
        let { p, ctx } = await ouvrir(nav, tel(390), erreurs, 'téléphone : ');
        const nb = await p.evaluate(() => ({ parties: document.querySelectorAll('.prog-section-head').length, boutons: [...document.querySelectorAll('.prog-section-ajout')].filter(b => b.getBoundingClientRect().width > 0).length,
            nus: [...document.querySelectorAll('.grid-cell-add')].filter(b => b.getBoundingClientRect().width > 0).length }));
        check(nb.parties === 2 && nb.boutons === 2, `un « + Accord » dans l'en-tête de chacune des deux parties (${nb.boutons} pour ${nb.parties})`);
        check(nb.nus === 0, `plus aucun « + » nu au bout des lignes d'accords (${nb.nus})`);
        const aj = await boite(p, '.prog-section-head .prog-section-ajout');
        const men = await boite(p, '.prog-section-head .prog-section-menu');
        const grille = await boite(p, '#progression-sections .chord-grid');
        exiger(!!aj && aj.vis && !!men && men.vis, '« + Accord » et ⋯ sont à l\'écran');
        check(Math.abs(aj.h - 28) <= 1 && aj.police === 12 && aj.style === 'solid' && /58, 64, 72/.test(aj.bord) && /139, 148, 159/.test(aj.couleur), `28 px de haut, 12 px, contour et texte gris (${Math.round(aj.h)} px, ${aj.police} px, ${aj.bord}, ${aj.couleur})`);
        check(men.rt <= aj.x + 1 && Math.abs(aj.rt - grille.rt) <= 2, `tout à droite de l'en-tête, après le ⋯ (⋯ finit à ${Math.round(men.rt)}, « + Accord » de ${Math.round(aj.x)} à ${Math.round(aj.rt)}, grille jusqu'à ${Math.round(grille.rt)})`);
        const texte = await p.evaluate(() => document.querySelector('.prog-section-ajout').textContent.trim());
        check(texte === 'Accord', `libellé « + Accord » (le plus est le logo : « ${texte} »)`);
        const second = await p.evaluate(() => document.querySelectorAll('.prog-section-ajout')[1].dataset.section);
        await p.locator('.prog-section-ajout').nth(1).tap(); await p.waitForTimeout(600);
        const ouvert = await p.evaluate(() => ({ panneau: !document.getElementById('ajout-aide').hidden, corps: document.body.classList.contains('aj-ouvert'), cible: window.app._cibleAjout && window.app._cibleAjout.section, actif: window.app.activeSection }));
        check(ouvert.panneau && ouvert.corps && ouvert.cible === +second && ouvert.actif === +second, `toucher « + Accord » du Refrain ouvre le panneau d'ajout sur SA partie (partie ${ouvert.cible}, active ${ouvert.actif})`);
        await ctx.close();

        // ===== B. « + SECTION » ======================================================================================================
        console.log('\n=== B. « + Section » ===');
        ({ p, ctx } = await ouvrir(nav, tel(390), erreurs, 'section : '));
        const haut = await boite(p, '#add-section');
        const barreLecture = await boite(p, '#barre-lecture');
        check(haut.y >= barreLecture.y, `au départ « + Section » est sous le pli : il tombe derrière la barre de lecture, on ne le voit pas sans défiler (haut à ${Math.round(haut.y)} px, barre à partir de ${Math.round(barreLecture.y)})`);
        await defiler(p, false);
        const bas = await boite(p, '#add-section');
        const mot = await p.evaluate(() => ({ apres: getComputedStyle(document.getElementById('add-section'), '::after').content, nom: document.getElementById('add-section').getAttribute('aria-label') }));
        check(bas.vis && bas.y >= 0 && bas.b <= 844, `en défilant jusqu'en bas, « + Section » est à l'écran (de ${Math.round(bas.y)} à ${Math.round(bas.b)})`);
        check(Math.abs(bas.h - 28) <= 1 && bas.style === 'dashed' && /58, 64, 72/.test(bas.bord) && /0, 0, 0, 0|transparent/.test(bas.fond) && /139, 148, 159/.test(bas.couleur), `petit, gris, en pointillés, sans fond (${Math.round(bas.h)} px, ${bas.style}, ${bas.bord})`);
        check(bas.w < 120 && mot.apres === '"Section"' && /Ajouter une section/.test(mot.nom), `libellé court « + Section » (${Math.round(bas.w)} px de large, ${mot.apres}), le nom complet dans l'aria-label (« ${mot.nom} »)`);
        const avant = await p.evaluate(() => loadProgressionSections().length);
        await toucher(p, '#add-section', 500);
        const apres = await p.evaluate(() => loadProgressionSections().length);
        check(apres === avant + 1, `toucher « + Section » ajoute une section (${avant} → ${apres})`);
        await toucher(p, '#global-undo-btn', 400);
        check(await p.evaluate(() => loadProgressionSections().length) === avant, 'une annulation la retire');
        const vide = await p.evaluate(() => { const h = document.getElementById('progression-sections'); const memo = h.innerHTML; h.innerHTML = ''; const d = getComputedStyle(document.getElementById('add-section')).display; h.innerHTML = memo; return d; });
        check(vide === 'none', `tant que la grille n'est pas dessinée, le bouton est caché (display: ${vide}) : il ne flotte plus seul en haut de la page`);
        const borne = await p.evaluate(() => { const r = document.getElementById('add-section').getBoundingClientRect(); return { sousLui: document.documentElement.scrollHeight - (window.scrollY + r.bottom), max: document.documentElement.scrollHeight - innerHeight }; });
        check(borne.max <= 400, `le défilement est borné : on ne se perd pas (${Math.round(borne.max)} px de défilement au plus)`);
        await ctx.close();

        // ===== C. LA BANDE DU BAS ====================================================================================================
        console.log('\n=== C. Clavier / Guitare à gauche, Fichier à droite, au-dessus de la barre de lecture ===');
        ({ p, ctx } = await ouvrir(nav, tel(390), erreurs, 'bande : '));
        const barre = await boite(p, '#barre-lecture');
        const bande = await boite(p, '#viz-bande');
        const piano = await boite(p, '#toggle-viz-piano');
        const guitare = await boite(p, '#toggle-viz-guitar');
        const fichier = await boite(p, '.viz-export-actions');
        exiger(!!bande && bande.vis && !!fichier && fichier.vis && !!barre, 'la bande est à l\'écran : bascule et Fichier');
        check(bande.pos === 'fixed' && fichier.pos === 'fixed' && Math.abs(bande.x - 12) <= 1 && Math.abs(fichier.rt - 378) <= 1, `fixes, Clavier / Guitare à 12 px de la marge gauche, Fichier à 12 px de la marge droite (${Math.round(bande.x)} / ${Math.round(fichier.rt)})`);
        check(Math.abs((barre.y - bande.b) - 8) <= 1.5 && Math.abs((barre.y - fichier.b) - 8) <= 1.5, `juste au-dessus de la barre de lecture, 8 px d'écart (${Math.round(barre.y - bande.b)} / ${Math.round(barre.y - fichier.b)})`);
        check(piano.rt <= guitare.x + 1 && bande.rt < fichier.x && await p.evaluate(() => document.getElementById('toggle-viz-piano').closest('#viz-bande') !== null), `à gauche le clavier puis la guitare, à droite Fichier : rien ne se recouvre`);
        const avantDefile = await boite(p, '#viz-bande');
        await defiler(p, false);
        const apresDefile = await boite(p, '#viz-bande');
        check(Math.abs(avantDefile.y - apresDefile.y) <= 1, `la bande ne bouge pas quand la page défile (${Math.round(avantDefile.y)} → ${Math.round(apresDefile.y)})`);
        const carte = await p.evaluate(() => { const c = document.querySelector('.viz-card'); const cs = getComputedStyle(c); const g = document.querySelector('#progression-sections').getBoundingClientRect(); return { pos: cs.position, sousGrille: c.getBoundingClientRect().top + scrollY >= g.bottom + scrollY - 2, affiche: cs.display !== 'none' }; });
        check(carte.pos !== 'fixed' && carte.sousGrille && carte.affiche, `les diagrammes restent empilés sous la grille, comme avant (${carte.pos})`);
        await defiler(p, true);
        await toucher(p, '#toggle-viz-guitar', 500);
        const guit = await p.evaluate(() => ({ presse: document.getElementById('toggle-viz-guitar').getAttribute('aria-pressed'), vu: (document.getElementById('guitar-viz') || {}).getBoundingClientRect ? document.getElementById('guitar-viz').getBoundingClientRect().height > 20 : false }));
        check(guit.presse === 'true', `toucher la guitare l'affiche (aria-pressed ${guit.presse})`);
        await toucher(p, '#file-menu-btn', 400);
        const menu = await p.evaluate(() => { const m = document.getElementById('file-menu'); return !!m && !m.hidden && m.getBoundingClientRect().height > 20; });
        check(menu, 'Fichier ouvre son menu depuis la bande');
        await p.keyboard.press('Escape'); await p.waitForTimeout(200);
        await toucher(p, '#tel-sequenceur', 700);   // le panneau d'accord s'ouvre sur « Rythme » (L7a)
        const sous = await p.evaluate(() => ({ pa: !document.getElementById('panneau-accord').hidden, bande: getComputedStyle(document.getElementById('viz-bande')).display, fichier: getComputedStyle(document.querySelector('.viz-export-actions')).display }));
        check(sous.pa && sous.bande === 'none' && sous.fichier === 'none', `quand le panneau d'accord s'ouvre, la bande se cache (panneau ${sous.pa}, bande ${sous.bande}, Fichier ${sous.fichier})`);
        await ctx.close();

        // Modification sans le panneau (elle continue après un redimensionnement) : le dock de secours prend le bas ; la bande monte au-dessus de lui au lieu d'être recouverte.
        ({ p, ctx } = await ouvrir(nav, tel(390), erreurs, 'dock : '));
        await p.evaluate(() => window.app.editChord(0, 0)); await p.waitForTimeout(500);
        const dock = await p.evaluate(() => {
            const dessus = (id) => { const e = document.getElementById(id), r = e.getBoundingClientRect(), t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!t && (t === e || e.contains(t)); };
            const d = document.getElementById('footer-dock').getBoundingClientRect(), b = document.getElementById('viz-bande').getBoundingClientRect();
            return { piano: dessus('toggle-viz-piano'), fichier: dessus('file-menu-btn'), dockVisible: d.height > 20, auDessus: b.bottom <= d.top + 1 };
        });
        check(dock.piano && dock.fichier && dock.auDessus, `en Modification, la bande reste atteignable au-dessus du dock de secours (${JSON.stringify(dock)})`);
        await ctx.close();

        // ===== D. 320 PX, ET L'ORDINATEUR ============================================================================================
        console.log('\n=== D. 320 px et ordinateur ===');
        ({ p, ctx } = await ouvrir(nav, tel(320, 640), erreurs, '320 : '));
        const etroit = await p.evaluate(() => { const g = (s) => document.querySelector(s).getBoundingClientRect(); const b = g('#viz-bande'), f = g('.viz-export-actions'), a = g('.prog-section-ajout'), m = g('.prog-section-menu'), n = g('.psh-nom'); return { separes: b.right <= f.left - 4, dedans: f.right <= 320 && b.left >= 0, tete: n.right <= m.left + 1 && m.right <= a.left + 1 && a.right <= 320, page: document.documentElement.scrollWidth }; });
        check(etroit.separes && etroit.dedans && etroit.tete && etroit.page <= 320, `à 320 px : bascule et Fichier séparés, en-tête de partie sans chevauchement, page sans défilement de côté (${JSON.stringify(etroit)})`);
        await ctx.close();
        ({ p, ctx } = await ouvrir(nav, { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, erreurs, 'ordinateur : '));
        const bureau = await p.evaluate(() => ({ bande: getComputedStyle(document.getElementById('viz-bande')).display, bascule: document.querySelector('.viz-toggle').parentElement.id, ajout: getComputedStyle(document.querySelector('.prog-section-ajout')).display,
            apres: getComputedStyle(document.getElementById('add-section'), '::after').content, nus: [...document.querySelectorAll('.grid-cell-add')].filter(b => getComputedStyle(b).display !== 'none').length }));
        check(bureau.bande === 'none' && bureau.bascule === 'bl-vues' && bureau.ajout === 'none' && bureau.apres === 'none' && bureau.nus > 0, `à l'ordinateur rien n'a bougé : pas de bande, la bascule dans la barre de lecture, pas de « + Accord », le « + » des lignes est là, libellé complet (${JSON.stringify(bureau)})`);
        await ctx.close();
    } catch (e) {
        console.log('FATAL ' + e.message);
        process.exitCode = 1;
    }
    check(erreurs.length === 0, `aucune erreur de page ni de console${erreurs.length ? ' : ' + erreurs.slice(0, 3).join(' | ') : ''}`);
    await nav.close();
    bilan();
})();
