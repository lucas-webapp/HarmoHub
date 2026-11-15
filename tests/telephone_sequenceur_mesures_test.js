// L7c (15/11) — TÉLÉPHONE : le séquenceur du panneau d'accord montre PLUSIEURS mesures, et ses rangées d'outils s'alignent. Lettres O (4) et P (1).
//
// CE QUI A ÉTÉ DÉCIDÉ (14/11) : « sur tablette, mettre au minimum 2 mesures dans le séquenceur » → sous 900 px le séquenceur du panneau d'accord montre les accords de la LIGNE de la grille
// de l'accord choisi, par pages de N, où N = ⌊(largeur du panneau − 56) / 240⌋ (croche tactile de 30 px, 240 px la mesure, 56 px la colonne des notes et la marge) : 1 mesure sous ~560 px,
// 2 de 560 à 800 px, 3 au-delà. Et « à droite de la corbeille, il n'y a pas le même espace qu'à gauche » → les trois rangées d'outils vont de la marge gauche (12 px) à la marge droite.
//
// Ce que le banc éprouve, au doigt :
//   A. N par largeur : 390 px → 1 accord, 600 px → 2, 820 px → 3 ; les croches restent à 30 px au moins, aucun défilement de côté ;
//   B. les pages : la page contient l'accord choisi, dans SA ligne de la grille ; › du panneau tourne la page de lui-même, et passe à la ligne suivante ;
//   C. toucher le nom d'un autre accord de la page change l'accord du panneau (le séquenceur le suit) ;
//   D. redimensionner (rotation de la tablette) recompose les pages ; « Cet accord » à 390 px garde un seul accord, comme avant ;
//   E. les rangées d'outils : premier bouton à 12 px de la marge gauche, dernier à 12 px de la marge droite, à 390, 360 et 320 px ; la tablette garde ses boutons à leur taille ;
//   F. l'ordinateur n'a pas bougé : le séquenceur montre toujours la ligne de la grille, sans le retour à la ligne des outils.
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('téléphone : séquenceur sur plusieurs mesures, outils alignés (L7c)');
const { estBruitReseau } = require('./_harness');
const V = require('./_verre_commun');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';

plan(23);

const mk = (root, quality) => ({ root, quality, beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
// Six accords dans le Couplet : à quatre par ligne la grille a deux lignes, [0 1 2 3] et [4 5] ; le Refrain en a deux.
const SECTIONS = [
    { title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7'), mk('D', 'min7'), mk('G', '7'), mk('E', 'min7'), mk('F', 'maj7')] },
    { title: 'Refrain', chords: [mk('F', 'maj'), mk('G', 'maj')] },
];

async function ouvrir(nav, contexte, erreurs, nom) {
    const ctx = await nav.newContext(contexte);
    await ctx.addInitScript((sections) => {
        if (sessionStorage.getItem('banc-l7c')) return;
        sessionStorage.setItem('banc-l7c', '1');
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

const tel = (l, h = 900) => ({ viewport: { width: l, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
const toucher = async (p, sel, ms = 300) => { await p.tap(sel); await p.waitForTimeout(ms); };
// Ouvre le panneau d'accord sur « Rythme » : un toucher sur le bouton Séquenceur de la rangée du haut (L7a).
const ouvrirRythme = async (p) => { await toucher(p, '#tel-sequenceur', 600); };
const montres = (p) => p.evaluate(() => ({
    noms: [...document.querySelectorAll('#sq-grille .sq-nom')].map(n => n.textContent.trim().replace(/\s+/g, ' ')).join(' | '),
    n: document.querySelectorAll('#sq-grille .sq-nom').length,
    indices: [...document.querySelectorAll('#sq-grille .sq-nom')].map(n => +n.dataset.c).join(),
    defile: document.getElementById('sq-grille').scrollWidth - document.getElementById('sq-grille').clientWidth,
    croche: Math.round(Math.min(...[...document.querySelectorAll('#sq-grille .sq-case')].slice(0, 40).map(c => c.getBoundingClientRect().width).filter(w => w > 4))),
    panneau: window.app._bulle ? window.app._bulle.index : null,
}));
// Les bords de chaque rangée d'outils : premier bouton, dernier bouton (rangées lues d'après leur ordonnée).
const bords = (p) => p.evaluate(() => {
    const ids = ['#sq-motif-main', '#sq-motif-plaque', '#sq-motif-monte', '#sq-motif-descend', '#sq-motif-pompe', '#sq-motif-ballade', '#sq-forme-enregistrer', '.sq-outils > .sq-seg', '.sq-outils > .sq-seg.sq-portee', '#sq-intensite', '#sq-dessin', '#sq-copier', '#sq-coller', '#sq-effacer'];
    const e = ids.map(s => { const el = document.querySelector('#pa-rythme ' + s); if (!el) return null; const r = el.getBoundingClientRect(); return { s, l: Math.round(r.left), r: Math.round(r.right), y: Math.round(r.top) }; }).filter(x => x && x.r > x.l);
    const rangees = {};
    e.forEach(x => { (rangees[x.y] = rangees[x.y] || []).push(x); });
    return Object.keys(rangees).map(Number).sort((a, b) => a - b).map(y => ({ y, gauche: Math.min(...rangees[y].map(x => x.l)), droite: Math.max(...rangees[y].map(x => x.r)), n: rangees[y].length }));
});

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    try {
        // ===== A. N PAR LARGEUR ======================================================================================================
        console.log('=== A. Une, deux, trois mesures selon la largeur ===');
        for (const [l, attendu] of [[390, 1], [600, 2], [820, 3]]) {
            const { p, ctx } = await ouvrir(nav, tel(l), erreurs, l + ' : ');
            await ouvrirRythme(p);
            const m = await montres(p);
            check(m.n === attendu && m.indices === [0, 1, 2].slice(0, attendu).join(), `à ${l} px, ${attendu} mesure${attendu > 1 ? 's' : ''} : ${m.noms} (accords ${m.indices})`);
            check(m.defile <= 1 && m.croche >= 29, `…sans défilement de côté (${m.defile} px), croches de ${m.croche} px au moins`);
            await ctx.close();
        }

        // ===== B. LES PAGES ==========================================================================================================
        console.log('\n=== B. Les pages de la ligne de la grille ===');
        let { p, ctx } = await ouvrir(nav, tel(600), erreurs, 'pages : ');
        await p.evaluate(() => { window.app.activeSection = 0; window.app.selectedIndex = 2; window.app.loadProgression(); });
        await p.waitForTimeout(300);
        await ouvrirRythme(p);
        let m = await montres(p);
        check(m.indices === '2,3' && m.panneau === 2, `l'accord 3 choisi : la page est [3, 4] de SA ligne (accords ${m.indices}, panneau sur ${m.panneau})`);
        await toucher(p, '#pa-quel [data-bulle="suiv"]');
        m = await montres(p);
        check(m.indices === '2,3' && m.panneau === 3, `› passe à l'accord 4 : la page ne bouge pas (accords ${m.indices}, panneau sur ${m.panneau})`);
        await toucher(p, '#pa-quel [data-bulle="suiv"]');
        m = await montres(p);
        check(m.indices === '4,5' && m.panneau === 4, `› encore : on passe à la ligne suivante, page [5, 6] (accords ${m.indices}, panneau sur ${m.panneau})`);
        await toucher(p, '#pa-quel [data-bulle="prec"]');
        m = await montres(p);
        check(m.indices === '2,3' && m.panneau === 3, `‹ revient à la ligne du dessus (accords ${m.indices}, panneau sur ${m.panneau})`);
        await ctx.close();

        ({ p, ctx } = await ouvrir(nav, tel(820), erreurs, 'trois : '));
        await p.evaluate(() => { window.app.activeSection = 0; window.app.selectedIndex = 3; window.app.loadProgression(); });
        await p.waitForTimeout(300);
        await ouvrirRythme(p);
        m = await montres(p);
        check(m.indices === '3' && m.n === 1, `à 820 px, la ligne [1 2 3 4] est en deux pages de trois : l'accord 4 est seul sur la seconde (accords ${m.indices})`);

        // ===== C. TOUCHER LE NOM D'UN AUTRE ACCORD ===================================================================================
        console.log('\n=== C. Toucher le nom d\'un autre accord de la page ===');
        await p.tap('#panneau-accord [data-bulle="prec"]'); await p.waitForTimeout(300);
        m = await montres(p);
        exiger(m.indices === '0,1,2' && m.panneau === 2, `‹ ramène la page [1 2 3] (accords ${m.indices}, panneau sur ${m.panneau})`);
        await toucher(p, '#sq-grille .sq-nom[data-c="0"]');
        m = await montres(p);
        check(m.panneau === 0 && m.indices === '0,1,2', `toucher le nom du 1er accord met le panneau sur lui (panneau sur ${m.panneau}, page ${m.indices})`);
        await ctx.close();

        // ===== D. LA ROTATION, ET « CET ACCORD » =====================================================================================
        console.log('\n=== D. Redimensionner, et « Cet accord » ===');
        ({ p, ctx } = await ouvrir(nav, tel(820), erreurs, 'rotation : '));
        await ouvrirRythme(p);
        check((await montres(p)).n === 3, 'à 820 px : trois mesures');
        await p.setViewportSize({ width: 390, height: 900 }); await p.waitForTimeout(600);
        m = await montres(p);
        check(m.n === 1 && m.defile <= 1, `réduit à 390 px, le séquenceur se recompose sur une mesure (${m.n} accord, défilement ${m.defile})`);
        await toucher(p, '.sq-portee button:not([aria-pressed="true"])');
        const portee = await p.evaluate(() => ({ portee: window.app.sequenceur.portee, seule: window.app.sequenceur.uneSeule() }));
        await p.setViewportSize({ width: 820, height: 900 }); await p.waitForTimeout(600);
        m = await montres(p);
        check(portee.portee === 'accord' && portee.seule && m.n === 3, `« Cet accord » : un seul accord à 390 px (${portee.seule}), et trois mesures à 820 px (${m.n}) : la portée règle l'effet, pas la page`);
        await ctx.close();

        // ===== E. LES RANGÉES D'OUTILS ALIGNÉES ======================================================================================
        console.log('\n=== E. Marges de 12 px des deux côtés ===');
        for (const l of [390, 360, 320]) {
            ({ p, ctx } = await ouvrir(nav, tel(l), erreurs, l + ' outils : '));
            await ouvrirRythme(p);
            const r = await bords(p);
            check(r.length >= 3 && r.every(x => Math.abs(x.gauche - 12) <= 1 && Math.abs(x.droite - (l - 12)) <= 1),
                `à ${l} px, chaque rangée d'outils (trois, ou quatre quand les deux groupes segmentés ne tiennent plus côte à côte) va de 12 à ${l - 12} (${r.map(x => `${x.gauche}→${x.droite}`).join(' / ')})`);
            await ctx.close();
        }
        ({ p, ctx } = await ouvrir(nav, tel(600), erreurs, 'tablette : '));
        await ouvrirRythme(p);
        const tab = await p.evaluate(() => ({ apres: getComputedStyle(document.querySelector('#pa-rythme .sq-outils'), '::after').content, copier: Math.round(document.getElementById('sq-copier').getBoundingClientRect().width), noms: [...document.querySelectorAll('#pa-rythme .sq-motif > span:not(.sq-vignette)')].filter(s => s.getBoundingClientRect().width > 0).length }));
        check(tab.copier <= 48 && tab.apres === 'none', `une tablette de 600 px garde ses boutons à leur taille (copier : ${tab.copier} px) et son retour à la ligne naturel`);
        check(tab.noms === 0, `…et les noms des rythmes sont retirés sous 900 px (${tab.noms} nom visible)`);
        await ctx.close();

        // ===== F. L'ORDINATEUR N'A PAS BOUGÉ =========================================================================================
        console.log('\n=== F. Ordinateur ===');
        ({ p, ctx } = await ouvrir(nav, { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, erreurs, 'ordinateur : '));
        await p.click('#vue-sequenceur'); await p.waitForTimeout(500);
        await p.evaluate(() => { window.app.selectedIndex = 1; window.app.loadProgression(); }); await p.waitForTimeout(300);
        const bureau = await p.evaluate(() => ({ noms: document.querySelectorAll('#sq-grille .sq-nom').length, apres: getComputedStyle(document.querySelector('.sq-outils'), '::after').content, nbMes: window.app.sequenceur.nbMesuresTel() }));
        check(bureau.noms === 4 && bureau.apres === 'none', `à l'ordinateur : la ligne de quatre mesures de la grille (${bureau.noms} accords), outils sans le retour à la ligne du téléphone (${bureau.apres})`);
        await ctx.close();
    } catch (e) {
        console.log('FATAL ' + e.message);
        process.exitCode = 1;
    }
    check(erreurs.length === 0, `aucune erreur de page ni de console${erreurs.length ? ' : ' + erreurs.slice(0, 3).join(' | ') : ''}`);
    await nav.close();
    bilan();
})();
