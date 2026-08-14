const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// Retour utilisateur : « lorsque je détaille le séquenceur continu, la vue doit rester centrée sur
// l'accord en cours de modification, sinon je me perds rapidement en horizontal ».
// Le défilement était restauré en PIXELS bruts : changer l'échelle change la largeur d'une colonne,
// donc les mêmes pixels désignent un tout autre endroit de la partie.
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
    // Accord au MILIEU de la partie : c'est là qu'un décentrage se voit.
    await p.evaluate(()=>window.app.editChord(0,6)); await p.waitForTimeout(500);
    await p.click('#grid-zoom'); await p.waitForTimeout(1200);

    // Où est le centre de l'accord édité par rapport au centre de la fenêtre visible ?
    const ecart = () => p.evaluate(()=>{
        const sc = document.querySelector('.seq-scroll');
        const g = sc.querySelector('.seq-grid');
        const colPx = parseFloat(g.dataset.colPx);
        const colOffset = +g.dataset.colOffset;
        // Les cases de l'accord ÉDITÉ (pas le contexte grisé) donnent sa portée réelle.
        const cases = [...g.querySelectorAll('.seq-cell')].map(e=>parseInt((e.style.gridColumn||'').split('/')[0],10)).filter(n=>!isNaN(n));
        const steps = new Set(cases).size;
        const centreAccord = colOffset*colPx + (steps*colPx)/2;
        return {
            colPx: Math.round(colPx*100)/100,
            scrollLeft: Math.round(sc.scrollLeft),
            centreVisible: Math.round(sc.scrollLeft + sc.clientWidth/2),
            centreAccord: Math.round(centreAccord),
            ecartPx: Math.round(Math.abs((sc.scrollLeft + sc.clientWidth/2) - centreAccord)),
            largeurVisible: Math.round(sc.clientWidth),
        };
    });

    const a = await ecart();
    console.log('à l\'ouverture      :', JSON.stringify(a));
    ck(a.ecartPx < a.largeurVisible*0.15, `l'accord édité est centré à l'ouverture — ${a.ecartPx}px d'écart`);

    console.log('--- On DÉTAILLE (échelle horizontale +3 crans) ---');
    for (let i=0;i<3;i++){ await p.click('#seq-zoom-in-h-inline'); await p.waitForTimeout(400); }
    const bb = await ecart();
    console.log('après détail       :', JSON.stringify(bb));
    ck(bb.colPx > a.colPx, `l'échelle a bien augmenté — ${a.colPx}px → ${bb.colPx}px par colonne`);
    ck(bb.ecartPx < bb.largeurVisible*0.15,
        `la vue reste centrée sur l'accord édité — ${bb.ecartPx}px d'écart (tolérance ${Math.round(bb.largeurVisible*0.15)}px)`);

    console.log('--- On RESSERRE (échelle -4 crans) ---');
    // L'échelle horizontale ne descend plus sous 1 (retour utilisateur : « voir trop petit ne me
    // sert à rien ») : le bouton se grise à ce plancher. Le test part donc du niveau atteint au
    // point précédent et redescend jusqu'à la butée, au lieu de compter des clics à l'aveugle.
    for (let i=0;i<8;i++){
        if (await p.evaluate(() => document.getElementById('seq-zoom-out-h-inline').disabled)) break;
        await p.click('#seq-zoom-out-h-inline'); await p.waitForTimeout(400);
    }
    const c = await ecart();
    console.log('après resserrage   :', JSON.stringify(c));
    ck(c.colPx < bb.colPx, `l'échelle a bien diminué — ${bb.colPx}px → ${c.colPx}px`);
    ck(c.ecartPx < c.largeurVisible*0.15, `toujours centré — ${c.ecartPx}px d'écart`);

    console.log('--- Un défilement manuel N\'est PAS écrasé par une simple repeinture ---');
    await p.evaluate(()=>{ document.querySelector('.seq-scroll').scrollLeft = 0; });
    await p.waitForTimeout(200);
    await p.evaluate(()=>window.app.renderSequencer()); await p.waitForTimeout(500);
    const d = await p.evaluate(()=>Math.round(document.querySelector('.seq-scroll').scrollLeft));
    ck(d < 30, `la position choisie à la main est conservée — scrollLeft ${d}px`);

    console.log('Errors:', JSON.stringify(errs));
    ck(errs.length===0, 'aucune erreur JavaScript');
    console.log('=== Bilan :', P, 'PASS /', F, 'FAIL ===');
    await b.close();
    process.exit(F>0?1:0);
})().catch(e=>{console.error('FATAL',e);process.exit(2);});
