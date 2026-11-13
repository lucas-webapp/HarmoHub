// L'ÉDITEUR DE NOTES : LA BARRE D'OUTILS EN ICÔNES (refonte, lot 9b), avec de vrais gestes.
// RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4a, 12/11, « réécriture courte ») : voir le bloc ordinateur plus bas ; les parties téléphone restent jusqu'à l'étape 4c.
//
// CE QUE DEMANDE LA MAQUETTE VALIDÉE (docs/refonte.md) : « Barre d'outils en icônes : sélection, crayon, gomme ; calage ; Voix ; Intensité ; Ajuster ;
// zoom ; supprimer la note. Aucune ligne d'info sur la note, aucune phrase de résumé. » Décisions du 05/11 : Sélection (par défaut) garde EXACTEMENT
// les gestes d'avant, Crayon ne fait que dessiner, Gomme efface ce qu'elle touche ; pas de choix de calage (la double croche automatique demandée
// plus tôt prime) ; tous les boutons d'avant restent, en icônes, dans la rangée « Notes / Fermer ». Voix arrive au lot 9c.
//
// CE QUE LE BANC TIENT : une seule rangée, à la jauge (32×32, 7px), sans mot ; « supprimer la note » seulement quand une note est choisie ; les trois
// outils (et une seule annulation par coup de gomme) ; Ajuster (lignes réduites aux notes, mémorisé) ; la barre revient dans le séquenceur hors de
// l'éditeur, sans id en double ; le téléphone n'a pas bougé (lot 10).
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('éditeur de notes : barre d\'outils');
const R = require('./_retrait_ancien');
const { estBruitReseau } = require('./_harness');

plan(11);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const graine = () => {
    const mk = (r, q, b = 4) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
    const S = [{ title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7'), mk('D', 'min7'), mk('G', 'dom7')] }];
    localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), sections: S }]));
    localStorage.setItem('harmohubCurrentSongId', 's1');
    localStorage.setItem('myProgression', JSON.stringify({ sections: S }));
    localStorage.removeItem('harmohubSeqDockHeight');
    localStorage.removeItem('harmohubSeqAjuster');
    sessionStorage.setItem('cc_accueil_vu', '1');
};

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    const ouvrir = async (viewport, reseme = true) => {
        const p = await nav.newPage({ viewport });
        p.on('pageerror', e => erreurs.push(e.message));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) erreurs.push('console: ' + m.text()); });
        await p.goto(`${BASE}/index.html`);
        if (reseme) await p.evaluate(graine);
        await p.reload();
        await p.waitForTimeout(900);
        return p;
    };
    const clic = async (p, sel, ms = 500) => { await p.click(sel); await p.waitForTimeout(ms); };
    // Le motif de l'accord en édition, relu (jamais écrit) : pour chaque voix, les pas où elle sonne.
    const motif = (p) => p.evaluate(() => {
        const { pattern } = window.app.getLiveSeqPattern(window.app.readChord());
        const parVoix = {};
        pattern.forEach((pas, s) => pas.forEach(v => { (parVoix[v] = parVoix[v] || []).push(s); }));
        return parVoix;
    });
    const glisser = async (p, a, b) => { await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 }); await p.mouse.move(b.x, b.y, { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(500); };

    // ======================================================================================================
    // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4a, 12/11, « réécriture courte ») : la barre de l'éditeur de notes (sélection, crayon, gomme, Ajuster, zoom,
    // supprimer la note) a quitté l'ordinateur avec lui (cahier, « Ce qui disparaît » : « outils crayon / gomme / sélection »). Ce qui la remplace dans le séquenceur
    // du bloc « Vues » : un clic pose ou enlève (Ctrl+Z défait), Intensité (logo du mode studio), copier / coller / effacer — une rangée d'icônes à la jauge, sans mot.
    console.log('\n=== A. Ordinateur : les outils du séquenceur remplacent ceux de l\'éditeur ===');
    let p = await ouvrir({ width: 1440, height: 900 });
    let r = await R.porteAbsente(p);
    check(r.ok, `plus d'éditeur de notes à l'ordinateur (${r.detail})`);
    r = await R.ouvrirNouveau(p);
    exiger(r.ok, `le séquenceur s'ouvre (${r.detail})`);
    const jauge = await p.evaluate(() => ['sq-intensite', 'sq-copier', 'sq-coller', 'sq-effacer', 'sq-forme-enregistrer'].map(id => { const b = document.getElementById(id), q = b.getBoundingClientRect(); return { id, h: Math.round(q.height), w: Math.round(q.width), rayon: getComputedStyle(b).borderTopLeftRadius, mot: b.textContent.trim() }; }));
    check(jauge.every(b => b.h === 32 && b.w === 32 && b.rayon === '7px' && b.mot === ''), `icônes à la jauge (32 × 32, 7 px), sans mot (${JSON.stringify(jauge.map(b => b.id + ':' + b.w + 'x' + b.h))})`);
    check(await p.evaluate(() => document.querySelector('#sq-intensite svg').innerHTML.includes('M5 21v-6')), 'Intensité porte le logo du mode studio, repris tel quel');
    r = await R.poserCroche(p, 0);
    check(r.ok, `un clic pose une croche, Ctrl+Z la retire (le crayon et la gomme d'avant) (${r.detail})`);
    r = await R.intensite(p, 1);
    check(r.ok, `Intensité allumée, un clic passe la note en « fort » (${r.detail})`);
    check(await p.evaluate(() => { const ids = [...document.querySelectorAll('[id]')].map(e => e.id); return ids.length === new Set(ids).size; }), 'aucun id en double dans la page');
    await p.close();

    // ======================================================================================================
    // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4c, 12/11, « réécriture courte ») : la feuille « Notes » du téléphone et sa barre d'outils ont disparu ; le
    // séquenceur du téléphone (onglet Rythme du panneau d'accord) a ses outils en icônes de 44 px, sans mot.
    console.log('\n=== H. Le téléphone : les outils de l\'onglet Rythme ===');
    p = await nav.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    p.on('pageerror', e => erreurs.push(e.message));
    await p.goto(`${BASE}/index.html`); await p.evaluate(graine); await p.reload(); await p.waitForTimeout(900);
    r = await R.porteTelephoneAbsente(p);
    check(r.ok, `ni « Notes » ni petit séquenceur au téléphone (${r.detail})`);
    r = await R.ouvrirRythmeTel(p);
    exiger(r.ok, `« Séquenceur » du panneau Lecture ouvre l'onglet Rythme (${r.detail})`);
    r = await R.outilsTel(p);
    check(r.ok, `ses outils en icônes de 44 px, sans mot (${r.detail})`);
    await p.close();

    check(erreurs.length === 0, `aucune erreur de page${erreurs.length ? ' : ' + erreurs.slice(0, 3).join(' | ') : ''}`);
    await nav.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
