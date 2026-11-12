// LE SÉQUENCEUR AU DOIGT : UN GLISSÉ FAIT DÉFILER, IL NE CRÉE NI NE MODIFIE AUCUNE NOTE (12/11), avec de vrais gestes tactiles (évènements du protocole DevTools).
//
// LE RETOUR (séquenceur du téléphone, « comme avant ») : « problème d'interférence entre scroll horizontal et création / modification d'une note ». Mesuré avant : la grille était
// en `touch-action: none`, donc aucun glissé ne pouvait faire défiler le panneau depuis elle, et le même glissé pouvait peindre ou effacer des notes.
//
// CE QUE LE BANC TIENT : la grille laisse défiler (touch-action pan-x pan-y), sa règle garde `none` (on y trace la plage à boucler) ; un glissé vertical ou horizontal qui part d'une case
// ne change AUCUNE note ; un appui bref pose une croche (une seule) ou enlève une note (en entier) ; l'appui long sur une note ouvre son menu ; l'appui long sur une case vide, suivi
// d'un glissé, peint UNE note tenue sans faire défiler la page ; l'ordinateur n'a pas bougé (la souris peint et défile comme avant : banc `sequenceur_notes`).
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('séquenceur au doigt');
const { estBruitReseau } = require('./_harness');

plan(17);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const graine = () => {
    const mk = (r, q, b = 4) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
    const S = [{ title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7'), mk('D', 'min7'), mk('G', 'dom7')] }];
    localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), sections: S }]));
    localStorage.setItem('harmohubCurrentSongId', 's1');
    localStorage.setItem('myProgression', JSON.stringify({ sections: S }));
    sessionStorage.setItem('cc_accueil_vu', '1');
};

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    const ctx = await nav.newContext({ viewport: { width: 390, height: 664 }, hasTouch: true, isMobile: true });
    const p = await ctx.newPage();
    p.on('pageerror', e => erreurs.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) erreurs.push('console: ' + m.text()); });
    const cdp = await ctx.newCDPSession(p);
    await p.goto(`${BASE}/index.html`); await p.evaluate(graine); await p.reload(); await p.waitForTimeout(1000);

    const toucher = async (sel, ms = 450) => { const r = await p.locator(sel).boundingBox(); await p.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); await p.waitForTimeout(ms); };
    const centre = async (sel) => { const r = await p.locator(sel).boundingBox(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; };
    const caseSq = (v, k) => `#sq-grille .sq-case[data-c="0"][data-v="${v}"][data-k="${k}"]`;
    const etat = () => p.evaluate(() => {
        const d = loadProgressionSections()[0].chords[0];
        const e = SequenceurHarmo.lireAccord(d);
        const par = (v) => { const r = []; for (let k = 0; k < e.info.croches; k++) if (e.on.has(v + ':' + k)) r.push(k); return r.join(','); };
        return { pos: e.info.positions.map(par), soude: [...e.soude].length, positions: e.info.positions, notes: e.on.size };
    });
    const lateral = () => p.evaluate(() => document.getElementById('sq-grille').scrollLeft);
    const defile = () => p.evaluate(() => scrollY + [...document.querySelectorAll('#panneau-accord, #panneau-accord *')].reduce((s, x) => s + x.scrollTop, 0));
    const menu = () => p.evaluate(() => { const m = document.getElementById('sq-menu-note'); return m.hidden ? null : Object.fromEntries([...m.querySelectorAll('button')].map(b => [b.dataset.sqActe, !b.disabled])); });
    const geste = async (points, attente = 0) => {
        // Un doigt : appui, (attente), déplacements, relâchement — évènements tactiles réels envoyés au navigateur.
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [points[0]] });
        if (attente) await p.waitForTimeout(attente);
        for (const q of points.slice(1)) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [q] }); await p.waitForTimeout(30); }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await p.waitForTimeout(400);
    };

    // Le séquenceur dans le panneau d'accord, sur le premier accord (« Plaqué » : une longue note par voix).
    const b0 = await p.locator('#progression-sections .grid-cell[data-section="0"][data-index="0"]').boundingBox();
    await p.touchscreen.tap(b0.x + b0.width / 2, b0.y + b0.height - 6); await p.waitForTimeout(600);
    await toucher('#bl-plus'); await toucher('#pl-notes', 800);
    let e = await etat();
    exiger(e.notes === 32 && e.soude === 28, `le panneau Rythme est ouvert sur un accord « Plaqué » (${e.notes} croches, ${e.soude} soudures)`);
    const v0 = e.positions[0], v2 = e.positions[2], v3 = e.positions[3]; // v3 : la ligne du haut ; v2 : celle d'en dessous (les deux seules visibles à 664 px)

    console.log('\n=== A. La grille laisse défiler ===');
    const ta = await p.evaluate(() => ({ grille: getComputedStyle(document.getElementById('sq-grille')).touchAction, regle: getComputedStyle(document.querySelector('#sq-grille .sq-temps')).touchAction }));
    check(ta.grille === 'pan-x pan-y' && ta.regle === 'none', `la grille laisse défiler dans les deux sens (${ta.grille}), sa règle garde « none » pour tracer la boucle (${ta.regle})`);

    console.log('\n=== B. Un glissé fait défiler, il ne touche à aucune note ===');
    const avant = await etat();
    const d0 = await defile();
    const c = await centre(caseSq(v3, 3));
    await geste([{ x: c.x, y: c.y }, ...Array.from({ length: 8 }, (_, i) => ({ x: c.x, y: c.y - 16 * (i + 1) }))]);
    const d1 = await defile();
    check(d1 > d0, `un glissé vertical qui part d'une case fait défiler le panneau (${d0} → ${d1} px)`);
    e = await etat();
    check(JSON.stringify(e.pos) === JSON.stringify(avant.pos) && e.soude === avant.soude, `et ne change aucune note (${e.notes} croches, ${e.soude} soudures)`);
    const cb = await centre(caseSq(v3, 2));
    const l0 = await lateral();
    await geste([{ x: cb.x, y: cb.y }, ...Array.from({ length: 8 }, (_, i) => ({ x: cb.x - 15 * (i + 1), y: cb.y }))]);
    const l1 = await lateral();
    e = await etat();
    check(l1 > l0 && JSON.stringify(e.pos) === JSON.stringify(avant.pos) && e.soude === avant.soude, `un glissé de côté qui part d'une case fait défiler la grille (${l0} → ${l1} px) sans changer aucune note`);
    const cr = await centre(caseSq(v3, 6));
    await geste([{ x: cr.x, y: cr.y }, ...Array.from({ length: 10 }, (_, i) => ({ x: cr.x + 20 * (i + 1), y: cr.y }))]); // on revient
    await geste([{ x: 195, y: 420 }, ...Array.from({ length: 8 }, (_, i) => ({ x: 195, y: 420 + 20 * (i + 1) }))]); // on remonte (depuis la barre d'outils)

    console.log('\n=== C. Un appui bref pose une croche ou enlève une note entière ===');
    await toucher(caseSq(v3, 3));
    e = await etat();
    check(e.pos[3] === '' && e.pos[0] === '0,1,2,3,4,5,6,7', `un toucher sur une note longue l'enlève EN ENTIER (${e.pos[3]}), les autres voix ne bougent pas`);
    await toucher(caseSq(v3, 2)); await toucher(caseSq(v3, 3));
    e = await etat();
    check(e.pos[3] === '2,3' && e.soude === 28 - 7, `deux touchers côte à côte : deux croches, pas une note tenue (${e.pos[3]}, ${e.soude} soudures)`);

    console.log('\n=== D. L\'appui long ouvre le menu de la note ===');
    const cl = await centre(caseSq(v2, 4));
    await geste([{ x: cl.x, y: cl.y }], 650);
    let m = await menu();
    exiger(m !== null, 'le doigt resté posé sur une note ouvre son menu');
    check(m.scinder === true && m.supprimer === true, `Scinder la note et Supprimer la note sont proposés (${JSON.stringify(m)})`);
    check((await etat()).pos[2] === '0,1,2,3,4,5,6,7', 'et rien n\'a bougé à la levée du doigt (la note n\'est pas enlevée)');
    await toucher('#sq-menu-note [data-sq-acte="scinder"]');
    e = await etat();
    check(e.soude === 28 - 7 - 1 && await menu() === null, `« Scinder la note » au doigt : la note se coupe à cette croche (${e.soude} soudures), le menu se ferme`);

    console.log('\n=== E. Le mode « Dessiner » : le doigt peint UNE note tenue, sans faire défiler ===');
    // Mesuré avant : un appui long suivi d'un glissé ne peut pas peindre au doigt, le navigateur annule le geste (pointercancel) dès que le doigt bouge sur une zone qui défile
    // (la peinture s'arrêtait à la 2e croche). D'où un mode explicite : le crayon de la barre d'outils met la grille en touch-action: none.
    await toucher('#sq-dessin');
    const mode = await p.evaluate(() => ({ appuye: document.getElementById('sq-dessin').getAttribute('aria-pressed'), ta: getComputedStyle(document.getElementById('sq-grille')).touchAction }));
    check(mode.appuye === 'true' && mode.ta === 'none', `le crayon s'allume et la grille ne défile plus (touch-action ${mode.ta})`);
    const y0 = await defile();
    const p1 = await centre(caseSq(v3, 4)), p2 = await centre(caseSq(v3, 7));
    const trait = [{ x: p1.x, y: p1.y }];
    for (let i = 1; i <= 6; i++) trait.push({ x: Math.round(p1.x + (p2.x - p1.x) * i / 6), y: p1.y + (i % 2 ? 3 : -3) });
    await geste(trait);
    e = await etat();
    check(e.pos[3] === '2,3,4,5,6,7', `de la croche 5 à la 8 : le trait peint les croches traversées (${e.pos[3]})`);
    const soudee = await p.evaluate((v) => { const d = loadProgressionSections()[0].chords[0]; const s = SequenceurHarmo.lireAccord(d).soude; return [4, 5, 6, 7].map(k => s.has(v + ':' + k)).join(','); }, v3);
    check(soudee === 'false,true,true,true', `d'un trait : une seule note tenue de quatre croches, sans être soudée à la note de 3 (${soudee})`);
    check(await defile() === y0 && await lateral() === l0, 'et ni la page ni la grille n\'ont défilé pendant le trait');
    await toucher('#sq-dessin');
    check((await p.evaluate(() => getComputedStyle(document.getElementById('sq-grille')).touchAction)) === 'pan-x pan-y', 'le crayon éteint, la grille laisse de nouveau défiler');

    check(erreurs.length === 0, `aucune erreur de page${erreurs.length ? ' : ' + erreurs.slice(0, 3).join(' | ') : ''}`);
    await ctx.close();
    await nav.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
