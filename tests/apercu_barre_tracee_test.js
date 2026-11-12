// RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4c, 12/11, décision « réécriture courte ») : il éprouvait l'aperçu de la barre PENDANT qu'on trace une note dans
// le grand séquenceur (« lorsque je crée une note et définis sa longueur avec la souris, j'ai des problèmes d'accrochage lors du survol »). Il l'ouvrait par
// toggleSequencer('continu'), un appel de programme : le grand séquenceur n'avait plus de porte depuis la 4a, et l'appel ouvre désormais le séquenceur du
// bloc « Vues ». Là, plus de note à tracer : un glissé PEINT chaque croche qu'il traverse, au fil du geste, d'une seule annulation. Le banc vérifie que
// l'ancienne porte n'existe plus ET que ce geste fonctionne.
// De vrais gestes (souris, toucher, clavier) ; window.app sert à relire l'état. Voir tests/_retrait_ancien.js.
const { chromium } = require('playwright');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('aperçu de la barre pendant le tracé');
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
    console.log('\n=== Ordinateur (1440 px) ===');
    p = await ouvrir({ width: 1440, height: 900 }, false);
    r = await R.porteAbsente(p);
    check(r.ok, `plus d'ancienne porte à l'ordinateur (${r.detail})`);
    r = await R.ouvrirNouveau(p);
    exiger(r.ok, `le séquenceur du bloc « Vues » s'ouvre (${r.detail})`);
    r = await R.peindre(p);
    check(r.ok, `un glissé peint plusieurs croches d'une seule annulation (${r.detail})`);
    r = await R.poserCroche(p);
    check(r.ok, `un clic pose une croche, Ctrl+Z la retire (${r.detail})`);
    await p.close();

    check(errs.length === 0, `aucune erreur JavaScript (${errs.slice(0, 3).join(' | ') || 'rien'})`);
    await b.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
