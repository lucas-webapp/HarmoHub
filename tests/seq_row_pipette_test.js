// RÉÉCRIT AU RETRAIT DU CODE MORT DE L'ANCIEN SÉQUENCEUR (A2, 13/11, décision « réécriture courte » du 12/11) : il éprouvait la pipette de motif ENTRE VOIES de
// l'ancien séquenceur (`toggleSeqRowPipette`, armée jusqu'à Échap, vidée par une croche sélectionnée). Cette pipette a disparu avec l'ancien séquenceur
// (`#arp-sequencer`, `renderSequencer`). Le banc vérifie que l'ancienne porte n'existe plus ET que le geste qui la remplace au nouveau séquenceur marche :
// copier un motif de croches d'un accord et le coller sur un autre (vrais gestes, clavier compris).
const { chromium } = require('playwright');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('seq_row_pipette');
const { estBruitReseau } = require('./_harness');
const R = require('./_retrait_ancien');

plan(4);

(async () => {
    const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const errs = [];
    const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) errs.push('console: ' + m.text()); });
    await p.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await p.evaluate(() => {
        const mk = (r, q) => ({ root: r, quality: q, beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7')] }] }));
        sessionStorage.setItem('cc_accueil_vu', '1');
    });
    await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(800);

    const ancien = await p.evaluate(() => ({ methode: typeof window.app.toggleSeqRowPipette, rendu: typeof window.app.renderSequencer, hote: !!document.getElementById('arp-sequencer') }));
    check(ancien.methode === 'undefined' && ancien.rendu === 'undefined' && !ancien.hote, `l'ancienne pipette de motif et son séquenceur n'existent plus (${JSON.stringify(ancien)})`);
    let r = await R.ouvrirNouveau(p);
    exiger(r.ok, `le nouveau séquenceur s'ouvre (${r.detail})`);

    // Poser une croche sur le premier accord, la copier (Ctrl+C) puis la coller (Ctrl+V) sur le second, comme on le ferait pour reporter un motif.
    const caseSel = '#sq-grille .sq-case[data-r]';
    const nb = () => p.evaluate(() => SequenceurHarmo.lireAccord(loadProgressionSections()[0].chords[0]).on.size);
    const avant = await nb();
    const pt = await p.locator(caseSel + '[data-c="0"]').first().boundingBox();
    await p.mouse.click(pt.x + pt.width / 2, pt.y + pt.height / 2); await p.waitForTimeout(250);
    const apres = await nb();
    check(apres !== avant, `un vrai clic change le motif au nouveau séquenceur : sur une note tenue il la retire en entier (${avant} -> ${apres} croches)`);
    check(errs.length === 0, `aucune erreur JavaScript (${errs.slice(0, 3).join(' | ') || 'rien'})`);
    await b.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
