// TÉLÉPHONE : L'ADAPTATION DES REMARQUES DE L'UTILISATEUR SUR L'ARTEFACT ORDINATEUR (L9c, 15/11 — « je te laisse faire les meilleurs choix pour l'adaptation téléphone »).
//
// CE QUI EST ADAPTÉ, avec de vrais gestes au doigt (tap) à 390 × 844 :
//   A. LA PROPOSITION DE RENOMMER (« Cmaj7 + D : renommer en Cmaj9 ? ») apparaît aussi au téléphone : posée au-dessus de la barre de lecture, sur la largeur, boutons de 44 px ;
//      « Renommer » change la qualité, « Annuler » (du haut) la défait, le × ignore ;
//   B. LE CYCLE D'INTENSITÉ BOUCLE au doigt aussi : normal → fort → doux → normal (« je ne peux plus revenir à une intensité haute ; si je reclique dessus elle se supprime ») ;
//   C. POSER UNE CROCHE LA FAIT ENTENDRE ; en toucher une l'enlève sans bruit (le geste du téléphone ne change pas).
// Ce qui n'est PAS porté au téléphone (décidé à la reprise du 15/11, voir CLAUDE-HARMOHUB.md) : octaves au-dessus / en dessous (pas de vue Piano de demi-tons), en-tête de partie à gauche,
// séquenceur étirable (le panneau d'accord est déjà plein écran).
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('téléphone : adaptations de L9c');
const { estBruitReseau } = require('./_harness');
const V = require('./_verre_commun');

plan(26);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const mk = (root, quality) => ({ root, quality, beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
const SECTIONS = [{ title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7')] }];
const TEL = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 };

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    const ouvrir = async () => {
        const ctx = await nav.newContext(TEL);
        await ctx.addInitScript((sections) => {
            if (sessionStorage.getItem('banc-l9c')) return;
            sessionStorage.setItem('banc-l9c', '1');
            localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Ballade', bpm: 120, timeSig: '4/4', groove: 'straight', savedAt: Date.now(), sections }]));
            localStorage.setItem('harmohubCurrentSongId', 's1');
            localStorage.setItem('myProgression', JSON.stringify({ sections }));
            sessionStorage.setItem('cc_accueil_vu', '1');
        }, SECTIONS);
        await ctx.route(/gstatic\.com|googleapis\.com|tonejs\.github\.io/, r => r.abort());
        const p = await ctx.newPage();
        p.on('pageerror', e => erreurs.push(e.message));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !V.BRUIT.test(m.text())) erreurs.push('console: ' + m.text()); });
        await p.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
        await p.waitForFunction(() => !!window.app);
        await p.waitForTimeout(800);
        await p.tap('#tel-sequenceur'); await p.waitForTimeout(700);   // le panneau d'accord sur « Rythme »
        return { p, ctx };
    };
    const toucher = async (p, sel, ms = 300) => { await p.tap(sel); await p.waitForTimeout(ms); };
    const accord = (p, c = 0) => p.evaluate((c) => { const d = loadProgressionSections()[0].chords[c]; return { q: d.quality, libres: (d.extraNotes || []).length, iv: JSON.stringify(d.intensiteVoix || {}) }; }, c);
    const prop = (p) => p.evaluate(() => {
        const b = document.getElementById('proposition-nom');
        if (b.hidden) return null;
        const r = b.getBoundingClientRect(), bl = document.getElementById('barre-lecture').getBoundingClientRect();
        const ok = document.getElementById('proposition-nom-ok').getBoundingClientRect(), x = document.getElementById('proposition-nom-fermer').getBoundingClientRect();
        return { texte: document.getElementById('proposition-nom-texte').textContent, g: r.left, d: r.right, b: r.bottom, hl: bl.top, larg: window.innerWidth, hOk: ok.height, hX: x.height, lX: x.width };
    });
    const centre = async (p, sel) => { const b = await p.locator(sel).first().boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };

    // ======================================================================================================
    console.log('\n=== A. La proposition de renommer, au doigt ===');
    let { p, ctx } = await ouvrir();
    exiger(await p.evaluate(() => document.getElementById('sequenceur').parentElement.id === 'pa-rythme' && !document.getElementById('sequenceur').hidden), 'le séquenceur est dans le panneau d\'accord (onglet Rythme)');
    await toucher(p, '#sq-grille .sq-libre-btn', 350);
    await toucher(p, '#sq-libre-bande [data-sq-note="D"]', 250);
    await toucher(p, '#sq-libre-ajouter', 600);
    check(await p.evaluate(() => [...document.querySelectorAll('#sq-grille .sq-etiq.libre')].some(e => /^D4/.test(e.textContent.trim()))), 'la note D4 est ajoutée : une ligne « note libre » de plus sous les quatre voix');
    // Une seule croche (une note de passage) ne propose rien ; deux croches côte à côte (une note tenue) la proposent.
    const ligneLibre = await p.evaluate(() => { const l = [...document.querySelectorAll('#sq-grille .sq-etiq')].findIndex(e => e.classList.contains('libre')); return l; });
    exiger(ligneLibre >= 0, `la ligne de la note libre est à l'écran (rang ${ligneLibre})`);
    await toucher(p, `#sq-grille .sq-case[data-c="0"][data-r="${ligneLibre}"][data-k="0"]`, 1300);
    check(await prop(p) === null, 'une seule croche (une note de passage) ne propose rien');
    // Au doigt, des croches touchées une à une ne se soudent pas : la note compte comme TENUE quand elle occupe la moitié de l'accord (quatre croches sur huit), la règle de l'ordinateur.
    for (const k of [1, 2, 3]) await toucher(p, `#sq-grille .sq-case[data-c="0"][data-r="${ligneLibre}"][data-k="${k}"]`, 250);
    await p.waitForTimeout(1300);
    let pr = await prop(p);
    exiger(pr !== null, 'quatre croches posées (la moitié de l\'accord) : la proposition apparaît au téléphone');
    check(/Cmaj7/.test(pr.texte) && /D/.test(pr.texte) && /Cmaj9/.test(pr.texte), `« ${pr.texte} »`);
    check(pr.g >= 0 && pr.d <= pr.larg && pr.b <= pr.hl + 0.5 && pr.hl - pr.b < 40, `elle tient dans l'écran, juste au-dessus de la barre de lecture (bas ${Math.round(pr.b)} pour ${Math.round(pr.hl)}, largeur ${Math.round(pr.g)}–${Math.round(pr.d)} sur ${pr.larg})`);
    check(pr.hOk >= 44 && pr.hX >= 44 && pr.lX >= 44, `ses boutons font 44 px au moins (Renommer ${pr.hOk}, × ${pr.hX} × ${pr.lX})`);
    check((await accord(p)).q === 'maj7', 'rien n\'est renommé sans le toucher');
    await toucher(p, '#proposition-nom-ok', 600);
    let a = await accord(p);
    check(a.q === 'maj9' && a.libres === 0, `« Renommer » : l'accord devient maj9, la note n'est plus une note libre (${JSON.stringify(a)})`);
    check(await prop(p) === null, 'la proposition se referme');
    await toucher(p, '#global-undo-btn', 500);
    a = await accord(p);
    check(a.q === 'maj7' && a.libres === 1, `« Annuler » défait le renommage seul : la note redevient libre (${JSON.stringify(a)})`);
    // L'annulation referme le panneau d'accord (comme avant) : on le rouvre. Le × ignore : une croche de plus sur la même note (sa ligne, la dernière qui s'appelle D4).
    if (!await p.evaluate(() => { const s = document.getElementById('sequenceur'); return !s.hidden && s.getBoundingClientRect().width > 0; })) await toucher(p, '#tel-sequenceur', 700);
    const ligneD4 = await p.evaluate(() => { const l = [...document.querySelectorAll('#sq-grille .sq-etiq')].map((e, i) => /^D4/.test(e.textContent.trim()) ? i : -1).filter(i => i >= 0); return l[l.length - 1]; });
    await toucher(p, `#sq-grille .sq-case[data-c="0"][data-r="${ligneD4}"][data-k="4"]`, 1300);
    exiger(await prop(p) !== null, 'la proposition revient pour une croche de plus sur la même note');
    await toucher(p, '#proposition-nom-fermer', 300);
    check(await prop(p) === null && (await accord(p)).q === 'maj7', 'le × ignore la proposition, l\'accord garde son nom');
    await p.close(); await ctx.close();

    // ======================================================================================================
    console.log('\n=== B. Le cycle d\'intensité boucle aussi au doigt ===');
    ({ p, ctx } = await ouvrir());
    await toucher(p, '#sq-intensite', 300);
    check(await p.evaluate(() => document.getElementById('sq-intensite').getAttribute('aria-pressed') === 'true'), 'le bouton Intensité est allumé');
    const note = '#sq-grille .sq-case.on[data-c="0"][data-r="0"][data-k="0"]';
    exiger(await p.locator(note).count() === 1, 'une note à régler (première croche de la première ligne)');
    const nivo = async () => { const d = JSON.parse((await accord(p)).iv); const k = Object.keys(d); return k.length ? d[k[0]] : undefined; };
    await toucher(p, note, 400);
    check(await nivo() === 90, `premier toucher : « fort » (${await nivo()})`);
    await toucher(p, note, 400);
    check(await nivo() === 55, `deuxième toucher : « doux » (${await nivo()})`);
    await toucher(p, note, 400);
    check(await nivo() === undefined && await p.locator(note).count() === 1, `troisième toucher : retour à « normal », la note n'est PAS enlevée (${await nivo()})`);
    await toucher(p, note, 400);
    check(await nivo() === 90, 'quatrième toucher : « fort » de nouveau — on revient à une intensité haute');
    await toucher(p, '#sq-intensite', 300);
    await toucher(p, note, 400);
    check(await p.locator(note).count() === 0, 'Intensité éteinte, toucher la note l\'enlève (le geste du téléphone ne change pas)');
    await p.close(); await ctx.close();

    // ======================================================================================================
    console.log('\n=== C. Poser une croche la fait entendre ===');
    ({ p, ctx } = await ouvrir());
    await p.evaluate(() => {
        window.__sons = [];
        const a = window.app, f = a.getInstrument.bind(a);
        a.getInstrument = (...x) => {
            const inst = f(...x);
            return new Proxy(inst, { get(t, k) { if (k === 'triggerAttackRelease') return (...y) => { window.__sons.push(y[0]); return t[k](...y); }; const v = t[k]; return typeof v === 'function' ? v.bind(t) : v; } });
        };
    });
    // « Effacer » vide d'abord l'accord : toutes les cases sont alors vides (le rythme de départ tient la mesure entière).
    await toucher(p, '#sq-effacer', 400);
    const vide = '#sq-grille .sq-case[data-c="0"][data-r="0"]:not(.on)';
    exiger(await p.locator(vide).count() > 0, 'une case vide à toucher');
    const premiere = await p.evaluate((s) => { const e = document.querySelector(s); return { k: +e.dataset.k, r: +e.dataset.r }; }, vide);
    await p.evaluate(() => { window.__sons = []; });
    const cible = `#sq-grille .sq-case[data-c="0"][data-r="${premiere.r}"][data-k="2"]`;
    await toucher(p, cible, 500);
    check(await p.locator(cible + '.on').count() === 1, 'toucher une case vide pose la croche');
    check(await p.evaluate(() => window.__sons.length) === 1, `et on l'entend (${await p.evaluate(() => window.__sons.length)} note jouée)`);
    await p.evaluate(() => { window.__sons = []; });
    await toucher(p, cible, 500);
    check(await p.locator(cible + '.on').count() === 0 && await p.evaluate(() => window.__sons.length) === 0, 'toucher une croche posée l\'enlève, sans bruit');
    await p.close(); await ctx.close();

    check(erreurs.length === 0, `aucune erreur de page ni de console (${erreurs.slice(0, 3).join(' | ')})`);
    await nav.close();
    bilan();
})().catch(e => { console.log('FATAL ' + (e && e.stack || e)); process.exit(1); });
