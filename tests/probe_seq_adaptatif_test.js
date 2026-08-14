const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// Le volet et l'échelle par défaut étaient les mêmes partout, calibrés pour un téléphone : sur un
// écran de 1080px, 222px restaient inutilisés sous le volet et seules 2,5 mesures tenaient dans la
// vue continue — l'inverse de ce qu'on attend d'un « réglage à l'échelle du morceau en grand écran ».
let P=0,F=0; const ck=(c,l)=>{ if(c){P++;console.log('PASS - '+l);} else {F++;console.log('FAIL - '+l);} };
(async () => {
    const b = await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
    const mesures = {};
    for (const vp of [{w:1920,h:1080,nom:'ordi-large',mob:false},{w:1366,h:768,nom:'portable',mob:false},{w:390,h:844,nom:'telephone',mob:true}]) {
        const ctx = await b.newContext({viewport:{width:vp.w,height:vp.h}, isMobile:vp.mob, hasTouch:vp.mob});
        const p = await ctx.newPage();
        const errs=[]; p.on('pageerror',e=>errs.push(e.message));
        await p.goto(`${BASE}/index.html?nocache=`+Date.now(),{waitUntil:'load'});
        await p.waitForTimeout(400);
        await p.evaluate(()=>{const mk=(r,q)=>({root:r,quality:q,beats:4,inversion:0,drop:0,octave:3,bass:null,playStyle:'croche_staccato'});
          const c=[];for(let i=0;i<12;i++)c.push(mk(['C','A','F','G'][i%4], i%2?'min7':'maj'));
          localStorage.setItem('myProgression',JSON.stringify({sections:[{title:'Couplet',chords:c}]}));
          localStorage.removeItem('harmohubSeqDockHeight');});
        await p.reload({waitUntil:'load'}); await p.waitForTimeout(700);
        await p.evaluate(()=>window.app.editChord(0,6)); await p.waitForTimeout(400);
        if (vp.mob) await p.tap('#grid-zoom'); else await p.click('#grid-zoom');
        await p.waitForTimeout(1300);
        const r = await p.evaluate(()=>{
            const sc=document.querySelector('.seq-scroll'), g=sc.querySelector('.seq-grid');
            const pan=document.getElementById('seq-dock-panel').getBoundingClientRect();
            const cs=getComputedStyle(g);
            const colW=parseFloat(cs.getPropertyValue('--seq-col-w'));
            const barW=parseFloat(cs.getPropertyValue('--seq-bar-w'));
            const rs=sc.getBoundingClientRect();
            const hLigne=parseFloat(getComputedStyle(g.querySelector('.seq-cell')).height);
            return {
                voletH: Math.round(pan.height),
                // Ce qui suit le volet n'est PAS de la place perdue : le nom de l'accord, le clavier
                // et le pied de page y vivent. Mesurer « innerHeight - bas du volet » et l'appeler
                // espace libre était une erreur de mon diagnostic initial. Ce qui compte vraiment :
                // le volet tient-il entier dans l'écran, et toutes les lignes tiennent-elles dedans.
                voletEntierVisible: pan.bottom <= innerHeight + 2 && pan.top >= -2,
                debordePage: Math.round(document.documentElement.scrollHeight - innerHeight),
                colW: Math.round(colW*10)/10,
                mesuresVisibles: Math.round((rs.width-40)/barW*10)/10,
                lignesVisibles: Math.round((rs.height-18)/hLigne),
                lignesTotales: g.querySelectorAll('.seq-label').length,
            };
        });
        mesures[vp.nom]=r;
        console.log(vp.nom.padEnd(11), JSON.stringify(r));
        ck(errs.length===0, `${vp.nom} : aucune erreur JavaScript`);
        await ctx.close();
    }

    console.log('\n--- Ce qui doit avoir changé ---');
    const o=mesures['ordi-large'], pt=mesures['portable'], t=mesures['telephone'];
    ck(o.voletH > 400, `ordinateur : le volet s'ouvre à sa vraie taille — ${o.voletH}px (300px avant)`);
    ck(o.voletEntierVisible, 'ordinateur : le volet agrandi tient entier dans l\'écran');
    ck(o.debordePage <= 0, `...sans faire déborder la page — ${o.debordePage}px de dépassement`);
    ck(o.lignesVisibles >= o.lignesTotales, `...toutes les lignes chromatiques tiennent — ${o.lignesVisibles}/${o.lignesTotales}`);
    ck(o.mesuresVisibles >= 4.5, `ordinateur : on voit la structure du morceau — ${o.mesuresVisibles} mesures (2,5 avant)`);
    ck(pt.mesuresVisibles > 3, `portable : idem à sa mesure — ${pt.mesuresVisibles} mesures (2 avant)`);
    ck(t.voletH === 300 || t.voletH < 400, `téléphone : le volet garde une taille raisonnable — ${t.voletH}px`);
    ck(t.colW >= 14, `téléphone : les croches restent atteignables au doigt — ${t.colW}px par croche`);

    console.log('\n--- Un réglage à la main l\'emporte et se mémorise ---');
    const ctx2 = await b.newContext({viewport:{width:1920,height:1080}});
    const p2 = await ctx2.newPage();
    await p2.goto(`${BASE}/index.html?nocache=`+Date.now(),{waitUntil:'load'});
    await p2.waitForTimeout(400);
    await p2.evaluate(()=>{const mk=(r,q)=>({root:r,quality:q,beats:4,inversion:0,drop:0,octave:3,bass:null,playStyle:'croche_staccato'});
      const c=[];for(let i=0;i<8;i++)c.push(mk('C','maj'));
      localStorage.setItem('myProgression',JSON.stringify({sections:[{title:'C',chords:c}]}));
      localStorage.setItem('harmohubSeqDockHeight','380');});
    await p2.reload({waitUntil:'load'}); await p2.waitForTimeout(700);
    await p2.evaluate(()=>window.app.editChord(0,4)); await p2.waitForTimeout(400);
    await p2.click('#grid-zoom'); await p2.waitForTimeout(1200);
    const h = await p2.evaluate(()=>Math.round(document.getElementById('seq-dock-host').getBoundingClientRect().height));
    ck(Math.abs(h-380) < 6, `la hauteur réglée à la main est respectée — ${h}px pour 380 mémorisés`);
    await ctx2.close();

    console.log('\n=== Bilan :', P, 'PASS /', F, 'FAIL ===');
    await b.close();
    process.exit(F>0?1:0);
})().catch(e=>{console.error('FATAL',e);process.exit(2);});
