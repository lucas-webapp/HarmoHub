// L'EN-TÊTE DE PARTIE À GAUCHE DES ACCORDS QUAND IL Y A LA PLACE (test demandé par l'utilisateur sur l'artefact, 15/11).
//
// SES MOTS : « Lorsque j'ai la place, je pense que ça peut être intéressant de gagner un peu de place en hauteur. Tu pourrais placer le mot couplet et le nombre de mesures sur la gauche.
// […] S'il n'y a plus la place, il faut les remettre au-dessus. Le problème est souvent le manque de place verticalement. »
//
// CE QUE LE BANC TIENT (vrais redimensionnements de la fenêtre) : fenêtre large (1920) : le nom de la partie, le nombre de mesures et le ⋯ sont À GAUCHE du cadre des accords, sur sa première
// ligne, sans rien déplacer dans la grille, et la partie est plus basse ; fenêtre de 1440 : ils sont AU-DESSUS comme avant ; le titre reste retapable ; le téléphone n'a pas bougé.
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('en-tête de partie à gauche');
const { estBruitReseau } = require('./_harness');

plan(10);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const graine = () => {
    const mk = (r, q) => ({ root: r, quality: q, beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
    const S = [{ title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7'), mk('D', 'min7'), mk('G', 'dom7')] }, { title: 'Refrain', chords: [mk('F', 'maj7')] }];
    localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), sections: S }]));
    localStorage.setItem('harmohubCurrentSongId', 's1');
    localStorage.setItem('myProgression', JSON.stringify({ sections: S }));
    sessionStorage.setItem('cc_accueil_vu', '1');
};

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    const ouvrir = async (viewport, opts = {}) => {
        const p = await nav.newPage({ viewport, ...opts });
        p.on('pageerror', e => erreurs.push(e.message));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) erreurs.push('console: ' + m.text()); });
        await p.goto(`${BASE}/index.html`);
        await p.evaluate(graine);
        await p.reload();
        await p.waitForTimeout(900);
        return p;
    };
    const mesures = (p) => p.evaluate(() => {
        const r = (e) => { const q = e.getBoundingClientRect(); return { x: Math.round(q.left), y: Math.round(q.top), r: Math.round(q.right), b: Math.round(q.bottom), w: Math.round(q.width), h: Math.round(q.height) }; };
        const s = document.querySelector('#progression-sections .prog-section');
        return { sec: r(s), head: r(s.querySelector('.prog-section-head')), grid: r(s.querySelector('.chord-grid')), titre: r(s.querySelector('.prog-title')), mes: r(s.querySelector('.prog-section-measures')), menu: r(s.querySelector('.prog-section-menu')), classe: document.body.classList.contains('entetes-gauche') };
    });

    console.log('\n=== A. Fenêtre large : à gauche des accords ===');
    let p = await ouvrir({ width: 1920, height: 900 });
    const large = await mesures(p);
    check(large.classe && large.head.r + 8 <= large.grid.x, `l'en-tête est à gauche du cadre des accords (il finit à ${large.head.r}, les accords commencent à ${large.grid.x})`);
    check(Math.abs(large.head.y - large.grid.y) <= 2, `à la hauteur de la première ligne d'accords (${large.head.y} et ${large.grid.y})`);
    check(large.titre.y < large.mes.y && large.menu.y <= large.titre.y + 2 && large.mes.r <= large.head.r, 'le nom, puis le nombre de mesures dessous, le ⋯ à côté du nom');
    check(large.sec.b - large.sec.y === large.grid.h, `la partie ne perd plus la hauteur de son en-tête (${large.sec.h} px, les accords seuls : ${large.grid.h})`);
    await p.fill('#progression-sections .prog-title', 'Pont'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
    check(await p.evaluate(() => loadProgressionSections()[0].title) === 'Pont', 'le titre se retape toujours depuis sa nouvelle place');
    await p.close();

    console.log('\n=== B. Fenêtre de 1440 : au-dessus comme avant ===');
    p = await ouvrir({ width: 1440, height: 900 });
    const moyen = await mesures(p);
    check(!moyen.classe && moyen.head.b <= moyen.grid.y + 1 && moyen.head.w === moyen.grid.w, `l'en-tête reste au-dessus des accords, sur toute la largeur (${moyen.head.y}-${moyen.head.b} puis ${moyen.grid.y})`);
    await p.setViewportSize({ width: 1920, height: 900 }); await p.waitForTimeout(500);
    check((await mesures(p)).classe, 'agrandir la fenêtre le met à gauche');
    await p.setViewportSize({ width: 1440, height: 900 }); await p.waitForTimeout(500);
    check(!(await mesures(p)).classe, 'la rétrécir le remet au-dessus');
    await p.close();

    console.log('\n=== C. Le téléphone n\'a pas bougé ===');
    p = await ouvrir({ width: 390, height: 844 }, { hasTouch: true, isMobile: true });
    const tel = await mesures(p);
    check(!tel.classe && tel.head.b <= tel.grid.y + 1, 'au téléphone, l\'en-tête reste au-dessus');

    check(erreurs.length === 0, `aucune erreur JavaScript (${erreurs.length ? erreurs.join(' | ') : 'aucune'})`);
    await nav.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
