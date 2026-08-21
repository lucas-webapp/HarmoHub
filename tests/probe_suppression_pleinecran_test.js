const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
let P=0,F=0; const ck=(c,l)=>{ if(c){P++;console.log('PASS - '+l);} else {F++;console.log('FAIL - '+l);} };
(async () => {
    const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });
    const errs = [];
    p.on('pageerror', e => errs.push('pageerror: ' + e.message));
    p.on('console', m => { if (m.type()==='error' && !/fonts\.|ERR_/.test(m.text())) errs.push('console: '+m.text()); });
    await p.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await p.waitForTimeout(200);
    await p.evaluate(() => {
        const mk=(r,q)=>({root:r,quality:q,beats:4,inversion:0,drop:0,octave:3,bass:null,playStyle:'held'});
        const c=[]; for(let i=0;i<8;i++) c.push(mk(['C','A','F','G'][i%4], i%2?'min7':'maj'));
        localStorage.setItem('myProgression', JSON.stringify({sections:[{title:'Couplet',chords:c}]}));
    });
    await p.reload({ waitUntil: 'load' });
    await p.waitForTimeout(500);

    ck(await p.evaluate(()=>document.querySelectorAll('.grid-cell').length>0), 'la grille se charge');
    ck(await p.evaluate(()=>!document.getElementById('grid-zoom-overlay')), 'la fenêtre plein écran a disparu du DOM');
    ck(await p.evaluate(()=>typeof window.app.openGridZoom==='undefined'), 'openGridZoom n\'existe plus');
    // L'id garde son nom historique #grid-zoom : le renommer rendait le bouton introuvable pour tout
    // navigateur servant un index.html en cache, et script.js mourait alors sur un getElementById null
    // avant même de construire l'appli (reproduit). Voir le commentaire dans index.html.
    ck(await p.evaluate(()=>!!document.getElementById('grid-zoom')), 'le bouton du séquenceur existe');

    await p.click('#grid-zoom'); await p.waitForTimeout(500);
    ck(await p.evaluate(()=>window.app.seqOpen===true), 'il ouvre le séquenceur');
    await p.click('#grid-zoom'); await p.waitForTimeout(400);
    ck(await p.evaluate(()=>window.app.seqOpen===false), 'et le referme');

    // Vue continue + un seul jeu de boutons de zoom. ELLE NE VIT PLUS DANS LA VUE AGRANDIE : agrandir
    // ne change plus de vue mais de taille (retour utilisateur : « j'aimerais juste voir le petit
    // séquenceur simple, mais en plus gros […] pas besoin de voir les demi-tons ni les accords
    // adjacents »). La vue continue a sa propre porte, « Séq. » au-dessus de la grille — c'est par
    // elle qu'on y va, et le sujet de ce point ne change pas d'un pouce.
    await p.evaluate(()=>{ window.app.editChord(0,5); });
    await p.waitForTimeout(600);
    await p.click('#grid-zoom');
    await p.waitForTimeout(900);
    const r = await p.evaluate(()=>({
        continu: !!document.querySelector('.seq-grid')?.className.includes('continuous'),
        reperes: document.querySelectorAll('.seq-beat-label').length,
        contexte: document.querySelectorAll('.seq-ctx-note').length,
        // Les croches liées d'une même voix voisine ne forment plus qu'UNE barre (voir paintCtxSeg) :
        // on compte les doubles croches COUVERTES, invariant du regroupement.
        contextePas: [...document.querySelectorAll('.seq-ctx-note')]
            .reduce((n, e) => n + (+(e.style.gridColumn.match(/span (\d+)/) || [0, 1])[1]), 0),
        // Le second jeu de boutons de zoom « -pinned » n'existait que pour le séquenceur épinglé de la
        // vue plein écran : il ne doit plus en rester aucun, nulle part. (Compter les boutons DANS
        // #arp-sequencer n'aurait aucun sens ici : en vue agrandie ce sont ceux de la fenêtre, hors
        // du séquenceur, qui s'affichent.)
        zoomPinned: document.querySelectorAll('[id$="-pinned"]').length,
    }));
    console.log(JSON.stringify(r));
    ck(r.continu && r.reperes===32 && r.contextePas===384, `vue continue intacte — ${r.reperes} repères, ${r.contextePas} doubles croches de contexte en ${r.contexte} barres`);
    ck(r.zoomPinned===0, `plus aucun bouton du séquenceur épinglé — ${r.zoomPinned}`);

    await p.keyboard.press('Escape'); await p.waitForTimeout(600); // referme la vue agrandie

    // Zoom de la grille (classicGrid) toujours opérant
    const av = await p.evaluate(()=>window.app.classicGridZoomLevelX);
    await p.click('#classic-grid-in-h'); await p.waitForTimeout(400);
    ck(await p.evaluate(()=>window.app.classicGridZoomLevelX) > av, 'le zoom H de la grille fonctionne toujours');

    // Clic simple / double-clic inchangés
    await p.evaluate(()=>window.app.cancelEdit()); await p.waitForTimeout(400);
    await p.click('.grid-cell[data-index="1"]', {position:{x:40,y:40}}); await p.waitForTimeout(400);
    ck(await p.evaluate(()=>window.app.editingIndex)===null, 'simple clic : pas d\'édition');
    await p.click('.grid-cell[data-index="1"]', {position:{x:40,y:40}});
    await p.click('.grid-cell[data-index="1"]', {position:{x:40,y:40}}); await p.waitForTimeout(500);
    ck(await p.evaluate(()=>window.app.editingIndex)!==null, 'double-clic : édition ouverte');

    // Masquer le volet de gauche élargit encore le séquenceur continu, qui vit dans son volet sous la
    // grille (voir probe_deux_boutons_seq_test.js). On mesure le VOLET : #arp-sequencer défile à
    // l'intérieur, sa largeur propre est celle de son contenu, pas de la place disponible.
    // « Séq. » BASCULE : le tiroir continu est déjà ouvert depuis la section précédente, et le
    // recliquer le refermerait — mesuré, 0px de large. On s'ASSURE de l'état voulu au lieu de
    // basculer à l'aveugle : c'est le piège classique d'un bouton à bascule dans un banc qui
    // enchaîne plusieurs sections.
    await p.evaluate(() => { if (window.app.seqMode !== 'continu' || !window.app.seqOpen) window.app.toggleSequencer('continu'); });
    await p.waitForTimeout(900);
    const l1 = await p.evaluate(()=>Math.round(document.getElementById('seq-dock-panel').getBoundingClientRect().width));
    await p.click('#toggle-sidebar'); await p.waitForTimeout(700);
    const l2 = await p.evaluate(()=>Math.round(document.getElementById('seq-dock-panel').getBoundingClientRect().width));
    ck(l2 > l1 + 200, `masquer le volet de gauche élargit vraiment le séquenceur continu — ${l1}px → ${l2}px`);

    console.log('Errors:', JSON.stringify(errs));
    ck(errs.length===0, 'aucune erreur JavaScript');
    console.log('=== Bilan :', P, 'PASS /', F, 'FAIL ===');
    await b.close();
    process.exit(F>0?1:0);
})().catch(e=>{console.error('FATAL',e);process.exit(2);});
