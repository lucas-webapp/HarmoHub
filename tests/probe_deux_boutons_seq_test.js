const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// Retour utilisateur : « il faut différencier les 2 boutons séquenceurs.
//  1. Bouton dans le module ajouter ou modifier (petit séquenceur) : il doit faire apparaître le
//     séquenceur simplifié dans le module.
//  2. Bouton au-dessus de la grille d'accords : il doit afficher le séquenceur continu en gros sous
//     la grille (avec volet ajustable en hauteur), comme il faisait avant dans le mode loupe. »
let P=0,F=0; const ck=(c,l)=>{ if(c){P++;console.log('PASS - '+l);} else {F++;console.log('FAIL - '+l);} };
(async () => {
    const b = await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
    for (const vp of [{w:1500,h:1000,nom:'ordinateur',mob:false},{w:390,h:844,nom:'téléphone',mob:true}]) {
        const ctx = await b.newContext({viewport:{width:vp.w,height:vp.h}, isMobile:vp.mob, hasTouch:vp.mob, deviceScaleFactor:vp.mob?2:1});
        const p = await ctx.newPage();
        const errs=[]; p.on('pageerror',e=>errs.push(e.message));
        await p.goto(`${BASE}/index.html?nocache=`+Date.now(),{waitUntil:'load'});
        await p.waitForTimeout(300);
        await p.evaluate(()=>{const mk=(r,q)=>({root:r,quality:q,beats:4,inversion:0,drop:0,octave:3,bass:null,playStyle:'held'});
          const c=[];for(let i=0;i<8;i++)c.push(mk(['C','A','F','G'][i%4], i%2?'min7':'maj'));
          localStorage.setItem('myProgression',JSON.stringify({sections:[{title:'Couplet',chords:c}]}));});
        await p.reload({waitUntil:'load'}); await p.waitForTimeout(600);
        await p.evaluate(()=>window.app.editChord(0,5)); await p.waitForTimeout(500);
        const taper = (sel) => vp.mob ? p.tap(sel) : p.click(sel);

        const lire = () => p.evaluate(()=>{
            const seq=document.getElementById('arp-sequencer');
            const g=document.querySelector('.seq-grid');
            const dock=document.getElementById('seq-dock-host');
            const panneau=document.getElementById('seq-dock-panel');
            // La CARTE de la grille, pas #progression-sections : celui-ci défile à l'intérieur d'elle,
            // son rectangle déborde donc sa propre carte et fausserait la comparaison.
            const grille=document.querySelector('.history-section');
            const r=seq.getBoundingClientRect();
            return {
                mode: window.app.seqMode,
                hote: seq.parentElement.id || seq.parentElement.className,
                dansVolet: dock.contains(seq),
                voletVisible: !panneau.hidden && panneau.getBoundingClientRect().height>0,
                continu: !!g && g.className.includes('continuous'),
                lignes: document.querySelectorAll('.seq-label').length,
                contexte: document.querySelectorAll('.seq-ctx-note').length,
                visible: r.height>0 && r.top<innerHeight && r.bottom>0,
                // Mesurer le VOLET, pas #arp-sequencer : celui-ci défile à l'intérieur du volet, son
                // rectangle peut donc remonter au-dessus de lui et fausser la comparaison.
                sousLaGrille: !panneau.hidden && panneau.getBoundingClientRect().top >= grille.getBoundingClientRect().bottom - 2,
                hauteurVolet: Math.round(dock.getBoundingClientRect().height),
            };
        });

        console.log(`\n======== ${vp.nom} ========`);
        console.log('--- 1. Porte « Séquenceur » de la carte Accord -> petit séquenceur DANS la carte ---');
        // Elle s'appelait « Agrandir » et ne faisait qu'agrandir ce qu'un bouton icône avait ouvert.
        // Ce bouton-là n'existe plus (retour utilisateur : « tu peux laisser uniquement le bouton
        // agrandir car il est plus visible ») : « Séquenceur » ouvre ET agrandit. On referme donc le
        // plein écran juste après, pour retrouver la vue compacte que cette section éprouve.
        await taper('#seq-zoom'); await p.waitForTimeout(1200);
        await p.evaluate(() => window.app.closeSeqZoom()); await p.waitForTimeout(600);
        let r = await lire(); console.log(JSON.stringify(r));
        ck(r.mode==='compact', `mode « compact » — ${r.mode}`);
        ck(!r.dansVolet, 'il reste dans le module, pas dans le volet sous la grille');
        ck(!r.voletVisible, '...et le volet sous la grille reste fermé');
        ck(!r.continu && r.contexte===0 && r.lignes===4,
            `simplifié : ${r.lignes} lignes (une par voix), ${r.contexte} case(s) de contexte`);
        ck(r.visible, 'il est visible à l\'écran');

        console.log('--- 2. Bouton au-dessus de la grille -> séquenceur CONTINU sous la grille ---');
        await taper('#grid-zoom'); await p.waitForTimeout(1200);
        r = await lire(); console.log(JSON.stringify(r));
        ck(r.mode==='continu', `mode « continu » — ${r.mode}`);
        ck(r.dansVolet && r.voletVisible, 'il passe dans le volet, qui s\'affiche');
        ck(r.sousLaGrille, 'le volet est bien SOUS la grille d\'accords');
        ck(r.continu && r.contexte>0 && r.lignes>4,
            `continu : ${r.lignes} lignes (demi-tons), ${r.contexte} barres de contexte`);
        ck(r.visible, 'il est visible à l\'écran');
        ck(r.hauteurVolet > 200, `volet en GROS — ${r.hauteurVolet}px de haut`);

        console.log('--- 3. Le volet est ajustable en hauteur ---');
        const h0 = r.hauteurVolet;
        const box = await p.evaluate(()=>{const e=document.getElementById('seq-dock-resize');const b=e.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2};});
        await p.mouse.move(box.x, box.y); await p.mouse.down();
        await p.mouse.move(box.x, box.y-120, {steps:10}); await p.mouse.up();
        await p.waitForTimeout(600);
        const h1 = await p.evaluate(()=>Math.round(document.getElementById('seq-dock-host').getBoundingClientRect().height));
        ck(h1 > h0 + 60, `tirer la poignée vers le haut agrandit — ${h0}px → ${h1}px`);

        console.log('--- 4. Rappuyer sur le même bouton referme ---');
        await taper('#grid-zoom'); await p.waitForTimeout(900);
        r = await lire(); console.log(JSON.stringify({mode:r.mode, voletVisible:r.voletVisible}));
        ck(r.mode===null && !r.voletVisible, 'tout est refermé');

        ck(errs.length===0, `aucune erreur JavaScript — ${JSON.stringify(errs)}`);
        await ctx.close();
    }
    console.log('\n=== Bilan :', P, 'PASS /', F, 'FAIL ===');
    await b.close();
    process.exit(F>0?1:0);
})().catch(e=>{console.error('FATAL',e);process.exit(2);});
