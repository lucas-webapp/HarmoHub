// RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4c, 12/11, décision « réécriture courte ») : il éprouvait le CORPS des notes courtes de l'ancien séquenceur
// (poignée / corps / poignée, seqShortNoteZone) dans ses trois vues — compacte, loupe séquenceur, épinglée dans la loupe de grille. Ces vues ont disparu ;
// au séquenceur d'aujourd'hui une case = une croche (44 px au doigt), rien à étirer ni à saisir par le corps. Le banc vérifie que l'ancienne porte n'existe
// plus ET que ce qui remplace le geste fonctionne : poser / enlever une croche seule exactement sur la case visée, peindre au glissé.
// De vrais gestes (souris, toucher, clavier) ; window.app sert à relire l'état. Voir tests/_retrait_ancien.js.
const { chromium } = require('playwright');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('seq_short_note_body');
const { estBruitReseau } = require('./_harness');
const R = require('./_retrait_ancien');

plan(8);

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
    r = await R.poserCrocheTel(p);
    check(r.ok, `un toucher pose une croche exactement sur la case visée, un autre l'enlève (${r.detail})`);
    r = await R.peindreTel(p);
    check(r.ok, `le glissé peint plusieurs croches d'une seule annulation (${r.detail})`);
    await p.close();

    console.log('\n=== Téléphone (860 px) ===');
    p = await ouvrir({ width: 860, height: 900 }, true);
    r = await R.porteTelephoneAbsente(p);
    check(r.ok, `ni « Séq. » ni petit séquenceur au téléphone (${r.detail})`);
    r = await R.ouvrirRythmeTel(p);
    exiger(r.ok, `« Séquenceur » du panneau Lecture ouvre l'onglet Rythme (${r.detail})`);
    r = await R.tientTel(p);
    check(r.ok, `l'accord, ses huit croches et une ligne par voix tiennent, cases de 44 px : rien à zoomer, pincer ni faire défiler (${r.detail})`);
    await p.close();

    check(errs.length === 0, `aucune erreur JavaScript (${errs.slice(0, 3).join(' | ') || 'rien'})`);
    await b.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
