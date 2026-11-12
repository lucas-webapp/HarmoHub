// RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4c, 12/11, décision « réécriture courte ») : il éprouvait la barre d'outils du tiroir de l'ancien petit séquenceur
// (ses boutons agissent sans refermer le tiroir). Le tiroir a disparu ; le séquenceur du téléphone est l'onglet Rythme du panneau d'accord. Le banc vérifie
// que l'ancienne porte n'existe plus ET que ses outils (44 px, sans mot) agissent sans refermer le panneau.
// De vrais gestes (souris, toucher, clavier) ; window.app sert à relire l'état. Voir tests/_retrait_ancien.js.
const { chromium } = require('playwright');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('seq_tiroir_barre_outils');
const { estBruitReseau } = require('./_harness');
const R = require('./_retrait_ancien');

plan(6);

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
    console.log('\n=== Téléphone (390 px) ===');
    p = await ouvrir({ width: 390, height: 844 }, true);
    r = await R.porteTelephoneAbsente(p);
    check(r.ok, `ni « Séq. » ni petit séquenceur au téléphone (${r.detail})`);
    r = await R.ouvrirRythmeTel(p);
    exiger(r.ok, `« Séquenceur » du panneau Lecture ouvre l'onglet Rythme (${r.detail})`);
    r = await R.outilsTel(p);
    check(r.ok, `les outils en icônes de 44 px, sans mot (${r.detail})`);
    r = await R.effacerTel(p);
    check(r.ok, `« Effacer » vide le rythme de l'accord, Ctrl+Z le rend (${r.detail})`);
    r = await R.intensiteTel(p);
    check(r.ok, `Intensité : un toucher passe la note en « fort » (${r.detail})`);
    await p.close();

    check(errs.length === 0, `aucune erreur JavaScript (${errs.slice(0, 3).join(' | ') || 'rien'})`);
    await b.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
