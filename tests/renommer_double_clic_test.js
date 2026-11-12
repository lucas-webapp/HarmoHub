// RENOMMER UN ACCORD AU DOUBLE-CLIC SUR LE TEXTE DE SON NOM (B2 de la session du 12/11), avec de vrais gestes.
//
// LE RETOUR : « souvent je clique sur la case et je me retrouve dans l'encart de modification de texte ; sa zone de fonctionnement semble trop large ». Mesuré avant de
// corriger (12/11, ordinateur 1440 × 900, case 110 × 52, nom 37 × 17) : AUCUN clic simple n'ouvrait l'encart (depuis le point B du 11/11) ; il s'ouvrait par une lettre A–G
// tapée après un clic, et la zone du nom (36 × 26 px mini, halo de 7 px) était bien plus large que le texte.
//
// LA DÉCISION (12/11) : « double-clic sur le TEXTE du nom = renommer, SANS ouvrir la bulle (c'est pour aller plus vite) » ; la bulle s'ouvre par le double-clic sur le reste de
// la case. La zone active se limite donc au texte (quelques pixels de tolérance), et le halo qu'on voit autour du nom ne la dépasse pas : on voit ce qui réagit.
//
// CE QUE LE BANC TIENT : ordinateur — double-clic sur le nom = champ de saisie, pas de bulle, un seul son ; on tape, Entrée, l'accord est renommé ; un clic simple sur le nom
// (même sur la case déjà choisie) ne l'ouvre jamais ; juste à côté du texte (2 px) la saisie s'ouvre encore, plus loin (6 px) c'est la bulle ; le halo ne dépasse pas la zone ;
// une bulle ouverte se referme quand on retape un nom ; Échap annule. Téléphone — rien n'a bougé : un second toucher sur le nom ouvre le panneau, il ne retape pas.
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('renommer au double-clic sur le nom');
const { estBruitReseau } = require('./_harness');

plan(16);

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
    const ouvrir = async (viewport, tactile = false) => {
        const ctx = await nav.newContext({ viewport, hasTouch: tactile, isMobile: tactile });
        const p = await ctx.newPage();
        p.on('pageerror', e => erreurs.push(e.message));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) erreurs.push('console: ' + m.text()); });
        await p.goto(`${BASE}/index.html`);
        await p.evaluate(graine);
        await p.reload();
        await p.waitForTimeout(1000);
        await p.evaluate(() => { window.__ecoutes = 0; const o = window.app.playSavedChord.bind(window.app); window.app.playSavedChord = (...a) => { window.__ecoutes++; return o(...a); }; });
        return p;
    };
    const caseSel = (i) => `#progression-sections .grid-cell[data-section="0"][data-index="${i}"]`;
    // Le texte du nom (ce qui est visé) et la case qui le contient, relus à chaque geste : un rendu de la grille peut les avoir recréés.
    const mesure = async (p, i) => {
        const t = await p.locator(caseSel(i) + ' .cell-sym').boundingBox();
        const b = await p.locator(caseSel(i)).boundingBox();
        return { t, b, cx: t.x + t.width / 2, cy: t.y + t.height / 2 };
    };
    const etat = (p) => p.evaluate(() => ({
        champ: !!document.querySelector('#progression-sections .cell-sym-input'),
        bulle: !document.getElementById('bulle-accord').hidden && document.getElementById('bulle-accord').getBoundingClientRect().height > 0,
        panneau: !document.getElementById('panneau-accord').hidden && document.getElementById('panneau-accord').getBoundingClientRect().height > 0,
        ecoutes: window.__ecoutes,
    }));
    // Remet la page au calme entre deux gestes : la saisie s'annule (Échap), la bulle se ferme (Échap), la sélection tombe (clic à côté).
    const calme = async (p) => {
        await p.keyboard.press('Escape'); await p.waitForTimeout(200);
        await p.keyboard.press('Escape'); await p.waitForTimeout(200);
        await p.mouse.click(1300, 300); await p.waitForTimeout(400);
        await p.mouse.click(1300, 300); await p.waitForTimeout(400);
    };
    const nomEnBase = (p, i) => p.evaluate((k) => { const c = JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[k]; return c.root + c.quality; }, i);

    // ======================================================================================================
    console.log('\n=== A. Ordinateur : le double-clic sur le texte du nom le renomme, sans la bulle ===');
    let p = await ouvrir({ width: 1440, height: 900 });
    let m = await mesure(p, 1);
    await p.mouse.dblclick(m.cx, m.cy); await p.waitForTimeout(700);
    let e = await etat(p);
    exiger(e.champ, 'le double-clic sur le texte du nom ouvre la saisie du nom');
    check(!e.bulle, 'sans ouvrir la bulle de l\'accord');
    check(e.ecoutes === 1, `l'accord ne sonne qu'une fois pour un double-clic (${e.ecoutes} écoute)`);
    await p.keyboard.press('Control+a'); await p.keyboard.type('Em7'); await p.keyboard.press('Enter'); await p.waitForTimeout(600);
    const nom = await nomEnBase(p, 1);
    check(nom === 'Emin7', `taper Em7 puis Entrée renomme l'accord (${nom})`);
    await calme(p);

    // « Un clic simple ne l'ouvre JAMAIS » (le retour de l'utilisateur) : sur le nom, puis encore sur la case déjà choisie, lentement.
    m = await mesure(p, 2);
    await p.mouse.click(m.cx, m.cy); await p.waitForTimeout(800);
    await p.mouse.click(m.cx, m.cy); await p.waitForTimeout(800);
    e = await etat(p);
    check(!e.champ && !e.bulle, 'un clic simple sur le nom, même recliqué sur la case choisie, n\'ouvre ni la saisie ni la bulle');
    await calme(p);

    // La zone : le texte plus quelques pixels. À 6 px du texte, c'est le double-clic de la bulle ; à 2 px, le texte réagit encore.
    m = await mesure(p, 2);
    await p.mouse.dblclick(m.t.x + m.t.width + 6, m.cy); await p.waitForTimeout(700);
    e = await etat(p);
    check(e.bulle && !e.champ, 'double-clic à 6 px à droite du texte : la bulle, pas la saisie');
    await calme(p);
    m = await mesure(p, 2);
    await p.mouse.dblclick(m.t.x - 6, m.cy); await p.waitForTimeout(700);
    e = await etat(p);
    check(e.bulle && !e.champ, 'double-clic à 6 px à gauche du texte : la bulle, pas la saisie');
    await calme(p);
    m = await mesure(p, 2);
    await p.mouse.dblclick(m.cx, m.b.y + m.b.height - 5); await p.waitForTimeout(700);
    e = await etat(p);
    check(e.bulle && !e.champ, 'double-clic au bas de la case, loin du texte : la bulle, pas la saisie');
    await calme(p);
    m = await mesure(p, 2);
    await p.mouse.dblclick(m.t.x + m.t.width + 2, m.cy); await p.waitForTimeout(700);
    e = await etat(p);
    check(e.champ && !e.bulle, 'double-clic à 2 px du texte : la saisie s\'ouvre encore (la zone n\'est pas au pixel près)');
    await p.keyboard.press('Escape'); await p.waitForTimeout(400);
    const intact = await nomEnBase(p, 2);
    check(intact === 'Dmin7', `Échap annule la saisie : l'accord garde son nom (${intact})`);
    await calme(p);

    // Le halo qu'on voit autour du nom (case choisie) ne doit pas promettre plus que la zone : mesuré sur l'ombre portée du texte.
    m = await mesure(p, 3);
    await p.mouse.click(m.cx, m.cy); await p.waitForTimeout(600);
    const halo = await p.evaluate((sel) => {
        const s = getComputedStyle(document.querySelector(sel + ' .cell-sym')).boxShadow;
        const rayons = [...s.matchAll(/0px 0px 0px (\d+(?:\.\d+)?)px/g)].map(x => parseFloat(x[1]));
        return rayons.length ? Math.max(...rayons) : -1;
    }, caseSel(3));
    check(halo >= 2 && halo <= 4, `le halo du nom ne dépasse pas la zone qui réagit (${halo}px, au plus 4)`);
    await calme(p);

    // Bulle ouverte : retaper un nom la referme (une seule fenêtre à la fois).
    m = await mesure(p, 0);
    await p.mouse.dblclick(m.cx, m.b.y + m.b.height - 5); await p.waitForTimeout(700);
    exiger((await etat(p)).bulle, 'la bulle s\'ouvre au double-clic sur le reste de la case');
    m = await mesure(p, 3);
    await p.mouse.dblclick(m.cx, m.cy); await p.waitForTimeout(700);
    e = await etat(p);
    check(e.champ && !e.bulle, 'bulle ouverte : le double-clic sur le nom d\'une autre case la referme et ouvre la saisie');
    await p.context().close();

    // ======================================================================================================
    console.log('\n=== B. Téléphone : rien n\'a bougé, un second toucher sur le nom ouvre le panneau ===');
    p = await ouvrir({ width: 390, height: 844 }, true);
    m = await mesure(p, 1);
    await p.touchscreen.tap(m.cx, m.cy); await p.waitForTimeout(900);
    m = await mesure(p, 1);
    await p.touchscreen.tap(m.cx, m.cy); await p.waitForTimeout(900);
    e = await etat(p);
    check(e.panneau && !e.champ, 'deux touchers lents sur le nom : le panneau d\'accord s\'ouvre, la saisie reste fermée');
    await p.keyboard.press('Escape'); await p.waitForTimeout(600);
    m = await mesure(p, 3);
    await p.touchscreen.tap(m.cx, m.cy); await p.waitForTimeout(120);
    m = await mesure(p, 3);
    await p.touchscreen.tap(m.cx, m.cy); await p.waitForTimeout(900);
    e = await etat(p);
    check(e.panneau && !e.champ, 'double toucher rapide sur le nom : le panneau s\'ouvre, la saisie reste fermée');
    await p.context().close();

    check(erreurs.length === 0, `aucune erreur de page${erreurs.length ? ' : ' + erreurs.slice(0, 3).join(' | ') : ''}`);
    await nav.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
