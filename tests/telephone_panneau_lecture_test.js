// L7b (15/11) — TÉLÉPHONE : le panneau « Lecture » (les trois points, #bl-plus). Lettre M de docs/decisions-13-14-11.md.
//
// CE QUI A ÉTÉ DÉCIDÉ (14/11, « il y a des problèmes d'affichage ici ») : le panneau montre Tempo « ‹ 120 BPM › » + TAP + noire / croche (le contretemps du métronome, À DROITE de
// TAP), UN SEUL curseur de vitesse avec son échelle (50, 75, 100, 150, 200) sans les cinq boutons, Métronome, puis « Voir » (Clavier, Guitare, Séquenceur). La ligne « Contretemps »
// (#pl-subdivision) disparaît : elle restait vide ou seule sous le métronome.
//
// Ce que le banc éprouve, au doigt :
//   A. à 390, 360 et 320 px : la rangée du tempo tient sur UNE ligne, dans l'ordre ‹ valeur › TAP noire/croche, tout à l'écran, contretemps de 44 px ; plus de ligne « Contretemps » ;
//   B. les gestes : › monte le tempo d'un cran, ‹ le baisse, le contretemps se bascule (noire ↔ croche), TAP règle le tempo ;
//   C. UN curseur de vitesse, aimanté (un toucher près de 150 % donne 150), l'échelle de cinq graduations, aucun bouton de vitesse rapide, valeur lue à côté ;
//   D. Métronome et « Voir » : présents, rien ne déborde de ses boutons à 320 px ;
//   E. le seuil de 900 px : franchi dans les deux sens, le contretemps n'existe qu'une fois et retrouve sa place (la fenêtre du tempo à l'ordinateur).
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('téléphone : le panneau Lecture (L7b)');
const { estBruitReseau } = require('./_harness');
const V = require('./_verre_commun');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';

plan(27);

const mk = (root, quality) => ({ root, quality, beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
const SECTIONS = [{ title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7'), mk('D', 'min7'), mk('G', '7')] }];

async function ouvrir(nav, contexte, erreurs, nom) {
    const ctx = await nav.newContext(contexte);
    await ctx.addInitScript((sections) => {
        if (sessionStorage.getItem('banc-l7b')) return;
        sessionStorage.setItem('banc-l7b', '1');
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
const toucher = async (p, sel, ms = 250) => { await p.tap(sel); await p.waitForTimeout(ms); };
const bpm = (p) => p.evaluate(() => +document.getElementById('bpm').value);

// La rangée du tempo : position de chaque élément, de gauche à droite.
const rangee = (p) => p.evaluate(() => {
    const ids = ['bl-tempo-moins', 'bl-tempo-pop-val', 'bl-tempo-plus', 'bl-tap', 'toggle-metronome-subdivision'];
    // La boîte INTÉRIEURE du panneau (sans sa marge) : un élément qui mord dans la marge de 12 px est déjà un débordement.
    const panneau = document.getElementById('panneau-lecture'); const cs = getComputedStyle(panneau); const pr = panneau.getBoundingClientRect();
    const pa = { left: pr.left + parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth), right: pr.right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth) };
    const b = ids.map(id => { const e = document.getElementById(id); if (!e) return null; const r = e.getBoundingClientRect(); return { id, x: r.left, rt: r.right, cy: r.top + r.height / 2, w: r.width, h: r.height }; });
    if (b.some(x => !x || x.w < 2)) return null;
    return {
        ordre: b.every((x, i) => i === 0 || x.x >= b[i - 1].rt - 1),
        uneLigne: Math.max(...b.map(x => x.cy)) - Math.min(...b.map(x => x.cy)),
        dansPanneau: b.every(x => x.x >= pa.left && x.rt <= pa.right),
        sub: [b[4].w, b[4].h], ecartTapSub: b[4].x - b[3].rt,
    };
});

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    try {
        // ===== A. LA RANGÉE DU TEMPO, À TROIS LARGEURS ===============================================================================
        console.log('=== A. La rangée du tempo : ‹ 120 BPM ›, TAP, contretemps ===');
        for (const l of [390, 360, 320]) {
            const { p, ctx } = await ouvrir(nav, tel(l), erreurs, l + ' : ');
            await toucher(p, '#bl-plus', 400);
            const r = await rangee(p);
            exiger(!!r, `à ${l} px, la rangée du tempo est dans le panneau Lecture`);
            check(r.ordre && r.uneLigne <= 2 && r.dansPanneau && Math.abs(r.sub[0] - 44) <= 1 && Math.abs(r.sub[1] - 44) <= 1 && r.ecartTapSub >= 4 && r.ecartTapSub <= 12,
                `à ${l} px : ‹ valeur › TAP puis le contretemps de 44 px, sur une ligne, tout dans le panneau (${JSON.stringify({ ligne: Math.round(r.uneLigne), sub: r.sub.map(Math.round), ecart: Math.round(r.ecartTapSub) })})`);
            await ctx.close();
        }

        // ===== B. LES GESTES DU TEMPO ================================================================================================
        console.log('\n=== B. Au doigt : ›, ‹, contretemps, TAP ===');
        let { p, ctx } = await ouvrir(nav, tel(390), erreurs, 'téléphone : ');
        await toucher(p, '#bl-plus', 400);
        const sans = await p.evaluate(() => ({ ligne: !!document.getElementById('pl-subdivision'), mot: /Contretemps/.test(document.getElementById('panneau-lecture').textContent), hote: document.getElementById('toggle-metronome-subdivision').parentElement.id }));
        check(!sans.ligne && !sans.mot && sans.hote === 'bl-hote-subdivision', `plus de ligne « Contretemps » : le bouton est dans la rangée du tempo (${JSON.stringify(sans)})`);
        await toucher(p, '#bl-tempo-plus'); await toucher(p, '#bl-tempo-plus');
        check(await bpm(p) === 122, `› deux fois : 122 BPM (${await bpm(p)})`);
        const val = await p.evaluate(() => ({ pop: document.getElementById('bl-tempo-pop-val').textContent, bouton: document.getElementById('bl-tempo-val').textContent, resume: document.getElementById('song-summary').innerText.trim() }));
        check(val.pop === '122 BPM' && val.bouton === '122' && /122 BPM/.test(val.resume), `la valeur se lit partout : le panneau (« ${val.pop} »), la barre de lecture (« ${val.bouton} »), la barre-résumé (« ${val.resume} »)`);
        await toucher(p, '#bl-tempo-moins');
        check(await bpm(p) === 121, '‹ le baisse d\'un cran : 121 BPM');
        const avant = await p.evaluate(() => ({ etat: window.app.metronomeSubdivision, presse: document.getElementById('toggle-metronome-subdivision').getAttribute('aria-pressed') }));
        await toucher(p, '#toggle-metronome-subdivision');
        const apres = await p.evaluate(() => ({ etat: window.app.metronomeSubdivision, presse: document.getElementById('toggle-metronome-subdivision').getAttribute('aria-pressed'), logo: document.getElementById('toggle-metronome-subdivision').innerHTML.length }));
        check(apres.etat === !avant.etat && apres.presse === String(!avant.etat) && apres.logo > 20, `toucher le contretemps le bascule : noire ↔ croche (${avant.etat} → ${apres.etat})`);
        await toucher(p, '#toggle-metronome-subdivision');
        check(await p.evaluate(() => window.app.metronomeSubdivision) === avant.etat, 'un second toucher le rend');
        for (const d of [0, 500, 500, 500]) { await p.waitForTimeout(d); await toucher(p, '#bl-tap', 0); }
        const tap = await bpm(p);
        check(tap >= 100 && tap <= 140 && tap !== 121, `quatre touchers de TAP à 500 ms règlent le tempo près de 120 (${tap} BPM)`);

        // ===== C. UN SEUL CURSEUR DE VITESSE =========================================================================================
        console.log('\n=== C. Un seul curseur de vitesse, aimanté, avec son échelle ===');
        const vit = await p.evaluate(() => {
            const pa = document.getElementById('panneau-lecture');
            return { curseurs: pa.querySelectorAll('input[type="range"]').length, boutons: pa.querySelectorAll('[data-vitesse], .bl-vitesses button').length,
                echelle: [...pa.querySelectorAll('#bl-echelle span')].map(s => s.textContent.trim()).join(), val: pa.querySelector('#bl-vitesse-val').textContent };
        });
        check(vit.curseurs === 1 && vit.boutons === 0, `un seul curseur dans le panneau, aucun bouton de vitesse rapide (${vit.curseurs} curseur, ${vit.boutons} bouton)`);
        check(vit.echelle === '50,75,100,150,200' && vit.val === '100 %', `l'échelle porte cinq graduations (${vit.echelle}) et la valeur se lit (${vit.val})`);
        const boite = await p.evaluate(() => { const r = document.getElementById('bl-vitesse').getBoundingClientRect(); return { x: r.left, y: r.top + r.height / 2, w: r.width }; });
        await p.touchscreen.tap(boite.x + boite.w * 0.68, boite.y); await p.waitForTimeout(300);
        const v150 = await p.evaluate(() => ({ v: +document.getElementById('bl-vitesse').value, txt: document.getElementById('bl-vitesse-val').textContent }));
        check(v150.v === 150 && v150.txt === '150 %', `un toucher près de la graduation 150 colle à 150 (${v150.v}, « ${v150.txt} »)`);
        await p.touchscreen.tap(boite.x + boite.w * 0.02, boite.y); await p.waitForTimeout(300);
        check(await p.evaluate(() => +document.getElementById('bl-vitesse').value) === 50, 'un toucher tout à gauche donne 50 %');
        await p.touchscreen.tap(boite.x + boite.w * 0.335, boite.y); await p.waitForTimeout(300);
        check(await p.evaluate(() => +document.getElementById('bl-vitesse').value) === 100, 'et près de la graduation 100, 100 %');
        await ctx.close();

        // ===== D. MÉTRONOME ET « VOIR » ==============================================================================================
        console.log('\n=== D. Métronome et « Voir » ===');
        ({ p, ctx } = await ouvrir(nav, tel(320, 700), erreurs, '320 : '));
        await toucher(p, '#bl-plus', 400);
        const bas = await p.evaluate(() => {
            const pa = document.getElementById('panneau-lecture').getBoundingClientRect();
            const vues = [...document.querySelectorAll('#panneau-lecture .pl-vue')];
            return { n: vues.length, noms: vues.map(b => b.textContent.trim()).join(), debord: vues.filter(b => b.scrollWidth > b.clientWidth + 1 || b.getBoundingClientRect().right > pa.right).length,
                metro: !!document.querySelector('#pl-metro #bl-metro'), etiquettes: [...document.querySelectorAll('#panneau-lecture .pl-etiquette')].map(e => e.textContent.trim() + ':' + getComputedStyle(e).display).join() };
        });
        check(bas.metro && bas.n === 3 && bas.noms === 'Clavier,Guitare,Séquenceur', `Métronome et les trois vues sont là (${bas.noms})`);
        check(bas.debord === 0, `à 320 px, aucun nom de vue ne déborde de son bouton (${bas.debord})`);
        check(/Tempo:none/.test(bas.etiquettes) && /Métronome:block|Métronome:inline/.test(bas.etiquettes), `sous 360 px le mot « Tempo » s'efface, la valeur dit déjà « BPM » (${bas.etiquettes})`);
        await toucher(p, '#pl-clavier', 400);
        check(await p.evaluate(() => document.getElementById('panneau-lecture').hidden), 'toucher « Clavier » referme le panneau (la vue s\'ouvre derrière)');
        await ctx.close();

        // ===== E. LE SEUIL DE 900 PX =================================================================================================
        console.log('\n=== E. Franchir 900 px dans les deux sens ===');
        ({ p, ctx } = await ouvrir(nav, tel(390), erreurs, 'seuil : '));
        await p.setViewportSize({ width: 1440, height: 900 }); await p.waitForTimeout(500);
        const bureau = await p.evaluate(() => { const b = document.getElementById('toggle-metronome-subdivision'); return { hote: b.parentElement.id, dansFenetre: !!b.closest('#bl-tempo-pop'), n: document.querySelectorAll('#toggle-metronome-subdivision').length }; });
        check(bureau.hote === 'bl-hote-subdivision' && bureau.dansFenetre && bureau.n === 1, `à l'ordinateur, le contretemps est dans la fenêtre du tempo, une seule fois (${JSON.stringify(bureau)})`);
        await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(500);
        await toucher(p, '#bl-plus', 400);
        const retour = await rangee(p);
        exiger(!!retour, 'revenu à 390 px, la rangée du tempo est de nouveau dans le panneau');
        check(retour.ordre && retour.uneLigne <= 2 && retour.sub[0] === 44, `…avec ses quatre éléments sur une ligne, contretemps de 44 px (${retour.sub.join('×')})`);
        await ctx.close();
        ({ p, ctx } = await ouvrir(nav, { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, erreurs, 'ordinateur : '));
        const dur = await p.evaluate(() => { const b = document.getElementById('toggle-metronome-subdivision'); return { parent: b.parentElement.id, panneau: document.getElementById('panneau-lecture').hidden, plus: getComputedStyle(document.getElementById('bl-plus')).display }; });
        check(dur.parent === 'bl-hote-subdivision' && dur.panneau && dur.plus === 'none', `à l'ordinateur d'emblée : pas de panneau Lecture ni de « ⋯ » (${JSON.stringify(dur)})`);
        await ctx.close();
    } catch (e) {
        console.log('FATAL ' + e.message);
        process.exitCode = 1;
    }
    check(erreurs.length === 0, `aucune erreur de page ni de console${erreurs.length ? ' : ' + erreurs.slice(0, 3).join(' | ') : ''}`);
    await nav.close();
    bilan();
})();
