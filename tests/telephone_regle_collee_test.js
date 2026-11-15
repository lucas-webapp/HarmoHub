// TÉLÉPHONE : LA RÈGLE DES TEMPS ET LES NOMS D'ACCORDS RESTENT COLLÉS EN HAUT QUAND LES LIGNES DÉFILENT (L9c, 15/11).
//
// SES MOTS (sur l'artefact ordinateur, adaptés au téléphone « à ma discrétion ») : « Il faut que la règle en haut reste toujours visible. Il faut figer cette règle. Quand je scrolle, je dois
// pouvoir la voir. » Au téléphone, avec beaucoup de notes libres (quatorze lignes), c'était tout le panneau d'accord qui défilait et la règle partait avec elle ; maintenant la barre d'outils reste,
// la GRILLE défile dessous, les noms d'accords et la règle collés en haut. Quand tout tient (quatre voix, le cas courant), rien ne change : pas de défilement, pas de plafond.
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('téléphone : règle collée en haut');
const { estBruitReseau } = require('./_harness');
const V = require('./_verre_commun');

plan(14);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const mk = (root, quality) => ({ root, quality, beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
const NOTES = ['D', 'E', 'F', 'G', 'A', 'B', 'C#', 'D#', 'F#', 'G#'].map((note, i) => ({ note, octave: 4 + (i > 5 ? 1 : 0) }));
const MAIGRE = [{ title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7')] }];
const DENSE = [{ title: 'Couplet', chords: [{ ...mk('C', 'maj7'), extraNotes: NOTES }, mk('A', 'min7')] }];

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    const ouvrir = async (sections, viewport) => {
        const ctx = await nav.newContext({ viewport, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
        await ctx.addInitScript((S) => {
            if (sessionStorage.getItem('banc-l9c-regle')) return;
            sessionStorage.setItem('banc-l9c-regle', '1');
            localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Ballade', bpm: 120, timeSig: '4/4', groove: 'straight', savedAt: Date.now(), sections: S }]));
            localStorage.setItem('harmohubCurrentSongId', 's1');
            localStorage.setItem('myProgression', JSON.stringify({ sections: S }));
            sessionStorage.setItem('cc_accueil_vu', '1');
        }, sections);
        await ctx.route(/gstatic\.com|googleapis\.com|tonejs\.github\.io/, r => r.abort());
        const p = await ctx.newPage();
        p.on('pageerror', e => erreurs.push(e.message));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !V.BRUIT.test(m.text())) erreurs.push('console: ' + m.text()); });
        await p.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
        await p.waitForFunction(() => !!window.app);
        await p.waitForTimeout(800);
        await p.tap('#tel-sequenceur'); await p.waitForTimeout(800);
        return { p, ctx };
    };
    const mesures = (p) => p.evaluate(() => {
        const g = document.getElementById('sq-grille'), corps = document.querySelector('#panneau-accord .pa-corps');
        const r = (e) => { const b = e.getBoundingClientRect(); return { t: Math.round(b.top), b: Math.round(b.bottom), l: Math.round(b.left) }; };
        const nom = g.querySelector('.sq-nom'), temps = g.querySelector('.sq-temps'), etiq = [...g.querySelectorAll('.sq-etiq')];
        return {
            grille: r(g), nom: nom && r(nom), temps: temps && r(temps), etiqs: etiq.map(r), lignes: etiq.length,
            plafond: g.style.maxHeight, overflow: getComputedStyle(g).overflowY, defileGrille: g.scrollHeight - g.clientHeight, scrollTopGrille: g.scrollTop,
            corpsDefile: corps.scrollHeight - corps.clientHeight, corpsHaut: corps.scrollTop, bas: corps.getBoundingClientRect().bottom,
            posNom: nom && getComputedStyle(nom).position, posTemps: temps && getComputedStyle(temps).position,
            outils: r(document.querySelector('#pa-rythme .sq-outils')),
        };
    });

    // ======================================================================================================
    console.log('\n=== A. Quatorze lignes : la grille défile, la règle reste ===');
    let { p, ctx } = await ouvrir(DENSE, { width: 390, height: 844 });
    let m = await mesures(p);
    exiger(m.lignes >= 12, `beaucoup de lignes (${m.lignes}) : elles ne tiennent pas dans le panneau`);
    check(m.overflow === 'auto' && m.defileGrille > 100 && m.grille.b <= m.bas - 9, `la grille défile d'elle-même (plafonnée à ${m.grille.b - m.grille.t} px, ${m.defileGrille} px à parcourir)`);
    check(m.corpsDefile <= 1, `le panneau d'accord, lui, ne défile plus (${m.corpsDefile} px de trop)`);
    check(m.posNom === 'sticky' && m.posTemps === 'sticky', 'les noms d\'accords et la règle sont collés (sticky)');
    const dessus = m.outils.b <= m.grille.t;
    const g = await p.locator('#sq-grille').boundingBox();
    await p.mouse.move(g.x + 150, g.y + 150); await p.mouse.wheel(0, 260); await p.waitForTimeout(350);
    const m2 = await mesures(p);
    check(m2.scrollTopGrille >= 200, `un glissé vertical fait défiler les lignes (${m2.scrollTopGrille} px)`);
    check(m2.nom.t === m2.grille.t && m2.temps.t === m2.grille.t + 24, `les noms d'accords et la règle sont restés tout en haut de la grille (noms ${m2.nom.t}, règle ${m2.temps.t}, grille ${m2.grille.t})`);
    check(dessus && m2.outils.t === m.outils.t, 'la barre d\'outils reste en place au-dessus : rien d\'autre ne bouge');
    check(m2.etiqs.filter(e => e.t >= m2.temps.b - 1 && e.b <= m2.grille.b + 1).length >= 5 && m2.etiqs.every(e => e.t >= m2.temps.b - 1 || e.b <= m2.temps.b + 1 || e.t < m2.grille.t), 'les lignes passent SOUS la règle (aucune ne la recouvre)');
    await p.mouse.wheel(0, -600); await p.waitForTimeout(300);
    check((await mesures(p)).scrollTopGrille === 0, 'on remonte tout en haut au même geste');
    await p.close(); await ctx.close();

    // ======================================================================================================
    console.log('\n=== B. Quatre voix : rien ne change ===');
    ({ p, ctx } = await ouvrir(MAIGRE, { width: 390, height: 844 }));
    m = await mesures(p);
    check(m.lignes === 4 && m.plafond === '' && m.defileGrille <= 1, `tout tient (${m.lignes} lignes) : pas de plafond (« ${m.plafond} »), pas de défilement`);
    check(m.overflow === 'hidden', 'la grille garde son défilement de côté seulement (overflow-y masqué), comme avant');
    await p.close(); await ctx.close();

    // ======================================================================================================
    console.log('\n=== C. Un écran plus court : le plafond suit ===');
    ({ p, ctx } = await ouvrir(DENSE, { width: 390, height: 700 }));
    m = await mesures(p);
    check(m.overflow === 'auto' && m.grille.b <= m.bas - 9 && m.corpsDefile <= 1, `à 700 px de haut la grille est plus courte (${m.grille.b - m.grille.t} px) et tient toujours dans le panneau`);
    await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(600);
    const m3 = await mesures(p);
    check(m3.grille.b - m3.grille.t > m.grille.b - m.grille.t + 50 && m3.corpsDefile <= 1, `et se rallonge quand l'écran grandit (${m.grille.b - m.grille.t} → ${m3.grille.b - m3.grille.t} px)`);
    await p.close(); await ctx.close();

    check(erreurs.length === 0, `aucune erreur de page ni de console (${erreurs.slice(0, 3).join(' | ')})`);
    await nav.close();
    bilan();
})().catch(e => { console.log('FATAL ' + (e && e.stack || e)); process.exit(1); });
