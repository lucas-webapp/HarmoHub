// UN ÉCRAN TACTILE DE LARGEUR D'ORDINATEUR SE SERT COMME À LA SOURIS (retour de l'utilisateur, 15/11).
//
// SES MOTS : « Maintenant que je clique sur une note, elle s'efface automatiquement. On s'était mis d'accord sur le fait qu'elle devait d'abord être surlignée pour que je puisse l'entendre, et si j'ai
// envie de l'effacer, j'appuierai sur Suppr. » ; « Je n'arrive pas à créer des barres et à les étirer » ; « poser une barre d'une certaine longueur […] la créer tout en l'étirant en même temps ».
// L'ancien geste au doigt (un toucher enlève la note, un glissé fait défiler) ne vaut plus qu'au téléphone.
//
// CE QUE LE BANC TIENT (vrais évènements tactiles, fenêtre de 1440 px) : un toucher sur une note la SÉLECTIONNE sans l'enlever, Suppr l'enlève ; un glissé horizontal sur une case vide pose UNE barre de la
// longueur tirée ; le téléphone (390 px) garde son geste d'avant (un toucher enlève la note).
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('séquenceur tactile large');
const { estBruitReseau } = require('./_harness');
const R = require('./_retrait_ancien');

plan(9);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const graine = () => {
    const mk = (r, q) => ({ root: r, quality: q, beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
    const S = [{ title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7')] }];
    localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), sections: S }]));
    localStorage.setItem('harmohubCurrentSongId', 's1');
    localStorage.setItem('myProgression', JSON.stringify({ sections: S }));
    localStorage.setItem('harmohubSequenceurVue', 'voix');
    sessionStorage.setItem('cc_accueil_vu', '1');
};

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    const ouvrir = async (viewport) => {
        const ctx = await nav.newContext({ viewport, hasTouch: true });
        const p = await ctx.newPage();
        p.on('pageerror', e => erreurs.push(e.message));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) erreurs.push('console: ' + m.text()); });
        await p.goto(`${BASE}/index.html`);
        await p.evaluate(graine);
        await p.reload();
        await p.waitForTimeout(900);
        const cdp = await ctx.newCDPSession(p);
        return { p, ctx, cdp };
    };
    const notes = (p) => p.evaluate(() => document.querySelectorAll('#sq-grille .sq-case.on[data-c="0"]').length);
    const centre = async (p, sel) => { const b = await p.locator(sel).first().boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width }; };
    const doigt = async (cdp, p, pts) => {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pts[0]] });
        for (const q of pts.slice(1)) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [q] }); await p.waitForTimeout(40); }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await p.waitForTimeout(400);
    };

    console.log('\n=== A. Ordinateur tactile (1440 px) ===');
    let { p, ctx, cdp } = await ouvrir({ width: 1440, height: 900 });
    exiger((await R.ouvrirNouveau(p)).ok, 'le séquenceur s\'ouvre');
    const avant = await notes(p);
    const n = await centre(p, '#sq-grille .sq-case.on[data-c="0"][data-k="3"]');
    await doigt(cdp, p, [{ x: n.x, y: n.y }]);
    check(await notes(p) === avant, `un toucher sur une note ne l'enlève plus (${avant} → ${await notes(p)})`);
    check(await p.evaluate(() => window.app.sequenceur.sel.length) === 1, 'elle est sélectionnée (surlignée)');
    await p.keyboard.press('Delete'); await p.waitForTimeout(350);
    check(await notes(p) < avant, `Suppr l'enlève (${avant} → ${await notes(p)})`);
    await p.keyboard.press('Control+z'); await p.waitForTimeout(300);
    // Un glissé horizontal sur une case vide : une barre de la longueur tirée.
    await R.cliquer(p, '#sq-effacer', 300);
    const v = await p.evaluate(() => { const c = document.querySelector('#sq-grille .sq-case[data-c="0"][data-k="0"][data-r="0"]'); return !!c; });
    exiger(v, 'une case vide de la première ligne est là');
    const d0 = await centre(p, '#sq-grille .sq-case[data-c="0"][data-k="0"][data-r="0"]');
    await doigt(cdp, p, [{ x: d0.x, y: d0.y }, { x: d0.x + d0.w, y: d0.y }, { x: d0.x + 2 * d0.w, y: d0.y }, { x: d0.x + 3 * d0.w, y: d0.y }]);
    const barre = await p.evaluate(() => ({ on: document.querySelectorAll('#sq-grille .sq-case.on[data-c="0"][data-r="0"]').length, notes: document.querySelectorAll('#sq-grille .sq-case.on[data-c="0"][data-r="0"] .sq-note').length, soudees: document.querySelectorAll('#sq-grille .sq-case.on.soude-g[data-c="0"][data-r="0"]').length }));
    check(barre.on === 4 && barre.soudees === 3, `un glissé du doigt sur quatre croches pose UNE barre de quatre croches (${JSON.stringify(barre)})`);
    await ctx.close();

    console.log('\n=== B. Téléphone (390 px) : le geste d\'avant (un toucher enlève la note) ===');
    ({ p, ctx, cdp } = await ouvrir({ width: 390, height: 844 }));
    for (let t = 0; t < 2; t++) { const b = await p.locator('#progression-sections .grid-cell[data-index="0"]').first().boundingBox(); await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await p.waitForTimeout(600); }
    const rr = await R.ouvrirRythmeTel(p);
    exiger(rr.ok, `le séquenceur du téléphone s'ouvre (${rr.detail})`);
    const avantTel = await notes(p);
    const nt = await centre(p, '#sq-grille .sq-case.on[data-c="0"][data-k="3"]');
    await p.touchscreen.tap(nt.x, nt.y); await p.waitForTimeout(500);
    check(await notes(p) < avantTel, `au téléphone, un toucher sur une note l'enlève encore (${avantTel} → ${await notes(p)})`);
    await ctx.close();

    check(erreurs.length === 0, `aucune erreur JavaScript (${erreurs.length ? erreurs.join(' | ') : 'aucune'})`);
    await nav.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
