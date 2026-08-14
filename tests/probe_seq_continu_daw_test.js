const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// Refonte du séquenceur continu (retour utilisateur : « j'aimerais atteindre une réelle fluidité pour
// ne pas faire d'erreurs. Sur GarageBand, j'y arrive sans problème et avec précision »).
let P=0,F=0; const ck=(c,l)=>{ if(c){P++;console.log('PASS - '+l);} else {F++;console.log('FAIL - '+l);} };
(async () => {
    const b = await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
    const p = await b.newPage({viewport:{width:1500,height:1000}});
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(`${BASE}/index.html?nocache=`+Date.now(),{waitUntil:'load'});
    await p.waitForTimeout(300);
    await p.evaluate(()=>{const mk=(r,q)=>({root:r,quality:q,beats:4,inversion:0,drop:0,octave:3,bass:null,playStyle:'held'});
      const c=[];for(let i=0;i<12;i++)c.push(mk(['C','A','F','G'][i%4], i%2?'min7':'maj'));
      localStorage.setItem('myProgression',JSON.stringify({sections:[{title:'Couplet',chords:c}]}));});
    await p.reload({waitUntil:'load'}); await p.waitForTimeout(600);
    await p.evaluate(()=>window.app.editChord(0,6)); await p.waitForTimeout(500);
    await p.click('#grid-zoom'); await p.waitForTimeout(1200);

    console.log('--- 1. Lignes chromatiques resserrées ---');
    const d = await p.evaluate(()=>{
        const g=document.querySelector('.seq-grid'); const cs=e=>getComputedStyle(e);
        return {h:parseFloat(cs(g.querySelector('.seq-cell')).height), gap:cs(g).rowGap,
                lignes:g.querySelectorAll('.seq-label').length};
    });
    console.log(JSON.stringify(d));
    ck(d.h <= 16, `une ligne fait ${d.h}px (piano-roll, contre 26px avant)`);
    ck(d.gap === '0px', `aucun écart vertical entre les lignes — ${d.gap}`);

    console.log('--- 4. Quadrillage mesure / temps / croche ---');
    const q = await p.evaluate(()=>{
        const g=document.querySelector('.seq-grid'); const cs=getComputedStyle(g);
        return {degrades: (cs.backgroundImage.match(/gradient/g)||[]).length,
                barW: cs.getPropertyValue('--seq-bar-w').trim(),
                beatW: cs.getPropertyValue('--seq-beat-w').trim(),
                caseArrondie: getComputedStyle(g.querySelector('.seq-cell')).borderRadius};
    });
    console.log(JSON.stringify(q));
    ck(q.degrades >= 3, `quadrillage à plusieurs niveaux — ${q.degrades} dégradés superposés`);
    ck(q.barW && q.beatW && parseFloat(q.barW) > parseFloat(q.beatW),
        `mesure et temps ont chacun leur pas — mesure ${q.barW}, temps ${q.beatW}`);
    ck(q.caseArrondie === '0px', `cases plates, plus d'aspect « bouton » — arrondi ${q.caseArrondie}`);

    console.log('--- 5. Règle et boutons attachés à la vue ---');
    const st = await p.evaluate(()=>{
        const g=document.querySelector('.seq-grid'); const beat=g.querySelector('.seq-beat-label');
        const sc=document.querySelector('.seq-scroll'); const pr=document.querySelector('.seq-presets');
        const cs=e=>getComputedStyle(e);
        return {beatRow:beat.style.gridRow, beatPos:cs(beat).position,
                labelPos:cs(g.querySelector('.seq-label')).position,
                defileVert: sc.scrollHeight > sc.clientHeight+2,
                prBas: Math.round(pr.getBoundingClientRect().bottom),
                voletBas: Math.round(document.getElementById('seq-dock-panel').getBoundingClientRect().bottom)};
    });
    console.log(JSON.stringify(st));
    ck(st.beatRow.startsWith('1'), `la règle est la PREMIÈRE ligne — ${st.beatRow}`);
    ck(st.beatPos === 'sticky', 'elle reste collée en haut pendant le défilement des hauteurs');
    ck(st.labelPos === 'sticky', 'l\'échelle de notes reste collée à gauche');
    ck(Math.abs(st.prBas - st.voletBas) < 12, `la rangée de boutons tient entière au bas du volet — ${st.prBas} vs ${st.voletBas}`);
    // Elle doit RESTER visible après avoir descendu dans les hauteurs. Le volet s'ouvre maintenant
    // assez haut pour que toutes les lignes tiennent (voir hauteurVoletSequenceur) : on le rétrécit
    // exprès, sinon il n'y aurait plus rien à faire défiler et le cas ne serait pas éprouvé.
    await p.evaluate(()=>{ document.getElementById('seq-dock-host').style.height = '180px'; });
    await p.waitForTimeout(300);
    await p.evaluate(()=>{ document.querySelector('.seq-scroll').scrollTop = 9999; });
    await p.waitForTimeout(400);
    const apres = await p.evaluate(()=>{
        const sc=document.querySelector('.seq-scroll');
        const beat=document.querySelector('.seq-beat-label');
        const pr=document.querySelector('.seq-presets');
        const rs=sc.getBoundingClientRect();
        return {scrollTop:Math.round(sc.scrollTop),
                regleDansLaBande: beat.getBoundingClientRect().top >= rs.top-2 && beat.getBoundingClientRect().top < rs.top+30,
                boutonsVisibles: pr.getBoundingClientRect().height>0 && pr.getBoundingClientRect().bottom<=innerHeight+2};
    });
    console.log(JSON.stringify(apres));
    ck(apres.scrollTop > 10, `on a bien descendu dans les hauteurs — scrollTop ${apres.scrollTop}px`);
    ck(apres.regleDansLaBande, '...et la règle de mesure est toujours en haut de la bande');
    ck(apres.boutonsVisibles, '...et les boutons sont toujours là');

    console.log('--- 2 et 3. Changer l\'échelle ne reconstruit plus le HTML ---');
    await p.evaluate(()=>{ const g=document.querySelector('.seq-grid'); g.dataset.temoin='1'; });
    const avant = await p.evaluate(()=>getComputedStyle(document.querySelector('.seq-grid')).getPropertyValue('--seq-col-w').trim());
    await p.click('#seq-zoom-in-h-inline'); await p.waitForTimeout(500);
    const apresZoom = await p.evaluate(()=>{
        const g=document.querySelector('.seq-grid');
        return {colW:getComputedStyle(g).getPropertyValue('--seq-col-w').trim(), temoinSurvivant:g.dataset.temoin==='1'};
    });
    console.log(JSON.stringify({avant, ...apresZoom}));
    ck(parseFloat(apresZoom.colW) > parseFloat(avant), `l'échelle change — ${avant} → ${apresZoom.colW}`);
    ck(apresZoom.temoinSurvivant,
        'la grille n\'est PAS reconstruite : le même nœud reste en place (c\'est ce qui rend le zoom fluide)');

    console.log('Errors:', JSON.stringify(errs));
    ck(errs.length===0, 'aucune erreur JavaScript');
    console.log('=== Bilan :', P, 'PASS /', F, 'FAIL ===');
    await b.close();
    process.exit(F>0?1:0);
})().catch(e=>{console.error('FATAL',e);process.exit(2);});
