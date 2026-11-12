// RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4c, 12/11, décision « réécriture courte ») : il éprouvait la hauteur du volet du séquenceur continu quand on
// ferme l'inspecteur (retour utilisateur : « je perds de la place sur le séquenceur ») et la hauteur manuelle retenue. Il ouvrait ce volet par
// toggleSequencer('continu'), un appel de programme : le volet n'avait plus de porte depuis la 4a, et l'appel ouvre désormais le séquenceur du bloc « Vues ».
// Là, toute la partie tient à l'écran et la poignée règle la hauteur des lignes, retenue par l'appareil. Le banc vérifie que l'ancienne porte n'existe plus ET
// ces deux points.
// De vrais gestes (souris, toucher, clavier) ; window.app sert à relire l'état. Voir tests/_retrait_ancien.js.
const { chromium } = require('playwright');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('sidebar_collapse_seq_height');
const { estBruitReseau } = require('./_harness');
const R = require('./_retrait_ancien');

plan(5);

(async () => {
    const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const errs = [];
    const ouvrir = async (viewport, tel) => {
        const p = await b.newPage(tel ? { viewport, hasTouch: true, isMobile: true } : { viewport });
        p.on('pageerror', e => errs.push(e.message));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) errs.push('console: ' + m.text()); });
        await p.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
        await p.evaluate(() => {
            const mk = (r, q) => ({ root: r, quality: q, beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
            localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7'), mk('F', 'maj7'), mk('G', 'dom7')] }] }));
            sessionStorage.setItem('cc_accueil_vu', '1');
        });
        await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(800);
        return p;
    };
    let p, r;
    console.log('\n=== Ordinateur (1366 px) ===');
    p = await ouvrir({ width: 1366, height: 768 }, false);
    r = await R.porteAbsente(p);
    check(r.ok, `plus d'ancienne porte à l'ordinateur (${r.detail})`);
    r = await R.ouvrirNouveau(p);
    exiger(r.ok, `le séquenceur du bloc « Vues » s'ouvre (${r.detail})`);
    r = await R.toutePartie(p);
    check(r.ok, `toute la partie est à l'écran, sans zoom ni défilement de côté (${r.detail})`);
    r = await R.poigneeLignes(p);
    check(r.ok, `la poignée règle la hauteur des lignes (22 à 48 px), double-clic 30 px (${r.detail})`);
    await p.close();

    check(errs.length === 0, `aucune erreur JavaScript (${errs.slice(0, 3).join(' | ') || 'rien'})`);
    await b.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
