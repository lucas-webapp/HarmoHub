// RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4c, 12/11, décision « réécriture courte ») : il éprouvait Ctrl+molette et pincement sur l'ancien séquenceur du
// téléphone (quels axes zoomer, et où). L'ancien séquenceur a disparu avec ses zooms (cahier, « Ce qui disparaît » : « pas de zoom, pas de loupe »). Le
// séquenceur du téléphone est l'onglet Rythme du panneau d'accord, où l'accord tient tout entier. Le banc vérifie que l'ancienne porte n'existe plus ET que
// rien n'y est à zoomer : huit croches, une ligne par voix, des cases de 44 px dans la largeur.
// De vrais gestes (souris, toucher, clavier) ; window.app sert à relire l'état. Voir tests/_retrait_ancien.js.
const { chromium } = require('playwright');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('gestes de zoom du séquenceur');
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
    console.log('\n=== Téléphone (390 px) ===');
    p = await ouvrir({ width: 390, height: 844 }, true);
    r = await R.porteTelephoneAbsente(p);
    check(r.ok, `ni « Séq. » ni petit séquenceur au téléphone (${r.detail})`);
    r = await R.ouvrirRythmeTel(p);
    exiger(r.ok, `« Séquenceur » du panneau Lecture ouvre l'onglet Rythme (${r.detail})`);
    r = await R.tientTel(p);
    check(r.ok, `l'accord, ses huit croches et une ligne par voix tiennent, cases de 44 px : rien à zoomer, pincer ni faire défiler (${r.detail})`);
    r = await R.poserCrocheTel(p);
    check(r.ok, `un toucher pose une croche exactement sur la case visée, un autre l'enlève (${r.detail})`);
    await p.close();

    check(errs.length === 0, `aucune erreur JavaScript (${errs.slice(0, 3).join(' | ') || 'rien'})`);
    await b.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
