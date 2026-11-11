// LA TAILLE DES DIAGRAMMES (clavier, guitare) À LA POIGNÉE — demande du 11/11 : « je n'ai pas besoin des diagrammes en plein écran. Cependant, j'aimerais pouvoir
// modifier leur taille comme je le veux avec une poignée. Pour l'instant, même si j'agrandis la fenêtre, il reste à la même taille. Et c'est un peu petit sur ordinateur. »
//
// Ce que le banc tient, par de VRAIS gestes (souris) — window.app ne sert qu'à relire l'état :
//   A. épinglé : une poignée sur le bord haut du tiroir ; la tirer vers le haut agrandit le clavier ET la guitare (et le tiroir, la grille cède), vers le bas les réduit
//      (jamais sous 0,6), double-clic = taille d'origine ;
//   B. la taille se retrouve après rechargement (par appareil) ;
//   C. agrandi, le clavier se joue encore : un clic sur une touche construit un accord, et le piano reste centré sur le manche ;
//   D. fenêtre libre : la poignée du haut disparaît, tirer le coin agrandit les diagrammes avec la fenêtre (c'était le défaut : la fenêtre grandissait, pas eux) ;
//   E. le tiroir agrandi ne mange pas plus de 60 % de l'écran ;
//   F. le téléphone n'a pas bougé : ni poignée ni échelle.
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('taille des diagrammes (poignée)');
const { estBruitReseau } = require('./_harness');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';

plan(20);

const graine = () => {
    const mk = (r, q) => ({ root: r, quality: q, beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
    const S = [{ title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7'), mk('D', 'min7'), mk('G', 'dom7')] }];
    localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), sections: S }]));
    localStorage.setItem('harmohubCurrentSongId', 's1');
    localStorage.setItem('myProgression', JSON.stringify({ sections: S }));
    sessionStorage.setItem('cc_accueil_vu', '1');
};

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    const ouvrir = async (viewport, avant) => {
        const ctx = await nav.newContext({ viewport });
        const p = await ctx.newPage();
        p.on('pageerror', e => erreurs.push(e.message));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) erreurs.push('console: ' + m.text()); });
        await p.goto(`${BASE}/index.html`);
        await p.evaluate(graine);
        if (avant) await p.evaluate(avant);
        await p.reload();
        await p.waitForTimeout(1000);
        return p;
    };
    const mesure = (p) => p.evaluate(() => {
        const r = (s) => { const e = document.querySelector(s); if (!e) return null; const q = e.getBoundingClientRect(); return { x: q.x, y: q.y, w: q.width, h: q.height, b: q.bottom }; };
        return { piano: r('#piano-viz'), guitare: r('#guitar-viz'), tiroir: r('#vues-tiroir'), poignee: r('#vues-poignee'), ph: window.innerHeight,
            poigneeVisible: !!document.getElementById('vues-poignee').offsetParent, echelle: window.app._vues ? window.app._vues.echelle : null };
    });
    const glisser = async (p, de, vers, pas = 12) => { await p.mouse.move(de.x, de.y); await p.mouse.down(); await p.mouse.move(vers.x, vers.y, { steps: pas }); await p.mouse.up(); await p.waitForTimeout(250); };
    const centre = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

    // ======================================================================================================
    console.log('\n=== A. Épinglé : la poignée du bord haut ===');
    let p = await ouvrir({ width: 1440, height: 1000 }, () => { localStorage.setItem('harmohubShowGuitar', '1'); localStorage.setItem('harmohubShowPiano', '1'); localStorage.removeItem('harmohubVuesEchelle'); });
    let m0 = await mesure(p);
    exiger(m0.poigneeVisible && !!m0.guitare && !!m0.piano, 'le tiroir est épinglé, avec sa poignée, clavier et guitare à l\'écran');
    check(Math.abs(m0.poignee.y + m0.poignee.h / 2 - m0.tiroir.y) <= 6, 'la poignée est sur le bord haut du tiroir');
    await glisser(p, centre(m0.poignee), { x: centre(m0.poignee).x, y: centre(m0.poignee).y - 100 });
    let m1 = await mesure(p);
    check(m1.piano.w > m0.piano.w * 1.15, `tirer vers le haut agrandit le clavier (${Math.round(m0.piano.w)} → ${Math.round(m1.piano.w)} px)`);
    check(m1.guitare.w > m0.guitare.w * 1.15, `...et la guitare (${Math.round(m0.guitare.w)} → ${Math.round(m1.guitare.w)} px)`);
    check(m1.tiroir.h > m0.tiroir.h + 40, `le tiroir prend la hauteur (${Math.round(m0.tiroir.h)} → ${Math.round(m1.tiroir.h)} px)`);
    const p1 = m1.poignee;
    await glisser(p, centre(p1), { x: centre(p1).x, y: centre(p1).y + 400 });
    let m2 = await mesure(p);
    check(m2.echelle >= 0.6 && m2.piano.w < m0.piano.w, `vers le bas, on réduit, sans passer sous 0,6 (échelle ${m2.echelle})`);
    await p.mouse.dblclick(centre(m2.poignee).x, centre(m2.poignee).y); await p.waitForTimeout(300);
    let m3 = await mesure(p);
    check(Math.abs(m3.piano.w - m0.piano.w) <= 2 && m3.echelle === 1, `un double-clic rend la taille d'origine (${Math.round(m3.piano.w)} px)`);

    // ======================================================================================================
    console.log('\n=== B. La taille se retrouve ===');
    await glisser(p, centre(m3.poignee), { x: centre(m3.poignee).x, y: centre(m3.poignee).y - 100 });
    const choisie = (await mesure(p)).echelle;
    await p.reload(); await p.waitForTimeout(1000);
    const m4 = await mesure(p);
    check(choisie > 1 && m4.echelle === choisie && m4.piano.w > m0.piano.w * 1.15, `après rechargement, l'échelle est celle choisie (${choisie}) : le clavier fait ${Math.round(m4.piano.w)} px`);

    // ======================================================================================================
    console.log('\n=== C. Agrandi, le clavier se joue et reste aligné ===');
    const ali = await p.evaluate(() => { const a = document.getElementById('piano-viz').getBoundingClientRect(), b = document.getElementById('guitar-viz').getBoundingClientRect(); return Math.abs((a.top + a.bottom) / 2 - (b.top + b.bottom) / 2); });
    check(ali <= 3, `le clavier reste centré sur le manche (${ali.toFixed(1)} px d'écart)`);
    const touche = await p.evaluate(() => { const k = document.querySelector('#piano-viz .key.white'); const r = k.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height - 6, midi: +k.dataset.midi }; });
    await p.mouse.click(touche.x, touche.y); await p.waitForTimeout(250);
    check(await p.evaluate(() => document.querySelectorAll('#piano-viz .key.kb-note').length === 1 && !document.getElementById('kb-construction').hidden), 'un clic sur une touche agrandie la tape : la bande de construction apparaît');
    await p.click('#kb-effacer'); await p.waitForTimeout(150);

    // ======================================================================================================
    console.log('\n=== D. Plafond : au plus 60 % de l\'écran ===');
    const mh = await mesure(p);
    await glisser(p, centre(mh.poignee), { x: centre(mh.poignee).x, y: 5 }, 25);
    const m5 = await mesure(p);
    check(m5.tiroir.h <= m5.ph * 0.6 + 40, `tiré tout en haut, le tiroir ne dépasse pas 60 % de l'écran (${Math.round(m5.tiroir.h)} / ${m5.ph} px)`);
    check(m5.echelle <= 2, `et l'échelle reste bornée (${m5.echelle})`);

    // ======================================================================================================
    console.log('\n=== E. Fenêtre libre : le coin agrandit aussi les diagrammes ===');
    await p.click('#vues-detacher'); await p.waitForTimeout(500);
    await p.evaluate(() => window.app.poserEchelleVues(1, true)); // point de départ connu (réglage, pas un geste)
    await p.waitForTimeout(200);
    const l0 = await mesure(p);
    check(!l0.poigneeVisible, 'détaché, la poignée du bord haut disparaît');
    const coin = await p.evaluate(() => { const r = document.getElementById('vues-coin').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await glisser(p, coin, { x: Math.min(1420, coin.x + 200), y: Math.min(900, coin.y + 120) });
    const l1 = await mesure(p);
    check(l1.piano.w > l0.piano.w * 1.1 && l1.echelle > 1, `tirer le coin agrandit le clavier avec la fenêtre (${Math.round(l0.piano.w)} → ${Math.round(l1.piano.w)} px)`);
    check(l1.guitare.w > l0.guitare.w * 1.1, `...et la guitare (${Math.round(l0.guitare.w)} → ${Math.round(l1.guitare.w)} px)`);
    check(l1.tiroir.w > l0.tiroir.w, `...la fenêtre elle-même grandit (${Math.round(l0.tiroir.w)} → ${Math.round(l1.tiroir.w)} px)`);
    await p.click('#vues-detacher'); await p.waitForTimeout(400);
    const l2 = await mesure(p);
    check(l2.poigneeVisible && l2.echelle === l1.echelle, 'réépinglé, la poignée revient et la taille est gardée');
    await p.context().close();

    // ======================================================================================================
    console.log('\n=== F. Le téléphone n\'a pas bougé ===');
    p = await ouvrir({ width: 390, height: 844 }, () => localStorage.setItem('harmohubVuesEchelle', '2'));
    const tel = await p.evaluate(() => ({ poignee: !!document.getElementById('vues-poignee').offsetParent, tiroir: !document.getElementById('vues-tiroir').hidden, zoom: getComputedStyle(document.querySelector('.viz-diagrams')).zoom }));
    check(!tel.poignee && !tel.tiroir, 'ni poignée ni tiroir');
    check(tel.zoom === '1', `et les diagrammes gardent leur taille d'origine malgré une échelle mémorisée (zoom ${tel.zoom})`);
    await p.context().close();

    check(erreurs.length === 0, `aucune erreur de page${erreurs.length ? ' : ' + erreurs.slice(0, 3).join(' | ') : ''}`);
    await nav.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
