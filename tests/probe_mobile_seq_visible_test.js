const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// Sur téléphone, le séquenceur vit dans la carte Lecture, bien plus bas que le bouton de la barre de
// grille qui l'ouvre : mesuré à ~560px sous un écran de 844px. Le bouton paraissait ne RIEN faire
// (retour utilisateur : « le séquenceur ne veut pas s'ouvrir avec le bouton au-dessus de la grille »).
let P=0,F=0; const ck=(c,l)=>{ if(c){P++;console.log('PASS - '+l);} else {F++;console.log('FAIL - '+l);} };
(async () => {
    const b = await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
    for (const vp of [{w:390,h:844,nom:'téléphone',mob:true},{w:1500,h:1000,nom:'ordinateur',mob:false}]) {
        const ctx = await b.newContext({viewport:{width:vp.w,height:vp.h}, isMobile:vp.mob, hasTouch:vp.mob, deviceScaleFactor:vp.mob?2:1});
        const p = await ctx.newPage();
        const errs=[]; p.on('pageerror',e=>errs.push(e.message));
        await p.goto(`${BASE}/index.html?nocache=`+Date.now(),{waitUntil:'load'});
        await p.waitForTimeout(300);
        await p.evaluate(()=>{const mk=(r,q)=>({root:r,quality:q,beats:4,inversion:0,drop:0,octave:3,bass:null,playStyle:'held'});
          localStorage.setItem('myProgression',JSON.stringify({sections:[{title:'Couplet',chords:[mk('C','maj'),mk('A','min7')]}]}));});
        await p.reload({waitUntil:'load'}); await p.waitForTimeout(600);
        console.log(`--- ${vp.nom} ---`);
        if (vp.mob) await p.tap('#grid-zoom'); else await p.click('#grid-zoom');
        await p.waitForTimeout(1400); // le défilement est animé (smooth)
        const r = await p.evaluate(()=>{
            const s=document.getElementById('arp-sequencer'); const b=s.getBoundingClientRect();
            return {seqOpen:window.app.seqOpen, haut:Math.round(b.top), bas:Math.round(b.bottom),
                    hauteur:Math.round(b.height), ecran:window.innerHeight};
        });
        console.log(JSON.stringify(r));
        ck(r.seqOpen === true, `${vp.nom} : le séquenceur s'ouvre`);
        ck(r.hauteur > 0 && r.haut < r.ecran && r.bas > 0,
            `${vp.nom} : ...et il est VISIBLE à l'écran (haut ${r.haut}px, écran ${r.ecran}px)`);
        ck(errs.length===0, `${vp.nom} : aucune erreur JavaScript`);
        await ctx.close();
    }
    console.log('=== Bilan :', P, 'PASS /', F, 'FAIL ===');
    await b.close();
    process.exit(F>0?1:0);
})().catch(e=>{console.error('FATAL',e);process.exit(2);});
