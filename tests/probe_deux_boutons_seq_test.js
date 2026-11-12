const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// Retour utilisateur : « il faut différencier les 2 boutons séquenceurs.
//  1. Bouton dans le module ajouter ou modifier (petit séquenceur) : il doit faire apparaître le
//     séquenceur simplifié dans le module.
//  2. Bouton au-dessus de la grille d'accords : il doit afficher le séquenceur continu en gros sous
//     la grille (avec volet ajustable en hauteur), comme il faisait avant dans le mode loupe. »
const R = require('./_retrait_ancien');
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
        if (!vp.mob) {
            // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4b, 12/11) : à l'ordinateur, la porte « Séquenceur » de la carte Accord et le petit séquenceur ont disparu —
            // la fenêtre d'accord n'a « pas de ligne Rythme » (cahier 3 bis). Réécriture courte : l'inspecteur, ouvert par le vrai geste, n'a plus ni l'une ni l'autre ;
            // le rythme se règle au séquenceur du bloc « Vues » (sections 2 à 4 ci-dessous).
            console.log('--- 1. L\'inspecteur n\'a plus de porte « Séquenceur » ni de petit séquenceur ---');
            const insp = await R.porteInspecteurAbsente(p, 0, 5);
            ck(insp.ok, `plus de petit séquenceur dans l'inspecteur — ${insp.detail}`);
        } else {
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
        }

        if (!vp.mob) {
            // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4a, 12/11) : à l'ordinateur, le « bouton au-dessus de la grille » (Éditeur de notes) et son volet continu
            // ont disparu. Le second bouton est désormais « Séquenceur », dans le bloc « Vues » : le séquenceur s'ouvre en GROS sous la grille (au-dessus du
            // tiroir), une ligne par voix, sa poignée règle la hauteur des lignes, et le même bouton le referme.
            console.log('--- 2. Bouton « Séquenceur » du bloc Vues -> le séquenceur sous la grille ---');
            const porte = await R.porteAbsente(p);
            ck(porte.ok, `le bouton au-dessus de la grille a disparu, « Séquenceur » est au bloc Vues — ${porte.detail}`);
            await R.cliquer(p, '#vue-sequenceur', 900);
            const s = await p.evaluate(() => { const q = document.getElementById('sequenceur').getBoundingClientRect(), g = document.querySelector('.history-section').getBoundingClientRect();
                return { ouvert: !document.getElementById('sequenceur').hidden, sous: q.top >= g.top, visible: q.height > 0 && q.top < innerHeight && q.bottom > 0, lignes: new Set([...document.querySelectorAll('#sq-grille .sq-case[data-r]')].map(x => x.dataset.r)).size, h: Math.round(q.height) }; });
            console.log(JSON.stringify(s));
            ck(s.ouvert && s.visible && s.sous, 'il s\'ouvre, visible, sous la grille');
            ck(s.lignes === 4, `une ligne par voix (${s.lignes} lignes pour une partie dont l'accord le plus riche a quatre sons)`);
            console.log('--- 3. Sa poignée règle la hauteur des lignes ---');
            const l0 = await p.evaluate(() => document.querySelector('#sq-grille .sq-case[data-r]').getBoundingClientRect().height);
            const q = await R.centre(p, '#sq-poignee');
            await p.mouse.move(q.x, q.y); await p.mouse.down(); await p.mouse.move(q.x, q.y - 60, { steps: 10 }); await p.mouse.up(); await p.waitForTimeout(400);
            const l1 = await p.evaluate(() => document.querySelector('#sq-grille .sq-case[data-r]').getBoundingClientRect().height);
            ck(l1 > l0 + 5, `tirer la poignée vers le haut agrandit les lignes — ${Math.round(l0)}px → ${Math.round(l1)}px`);
            console.log('--- 4. Rappuyer sur le même bouton referme ---');
            await R.cliquer(p, '#vue-sequenceur', 600);
            ck(await p.evaluate(() => document.getElementById('sequenceur').hidden), 'tout est refermé');
        } else {
            console.log('--- 2. Bouton au-dessus de la grille -> séquenceur CONTINU sous la grille ---');
            await taper('#grid-zoom'); await p.waitForTimeout(1200);
            r = await lire(); console.log(JSON.stringify(r));
            ck(r.mode==='continu', `mode « continu » — ${r.mode}`);
            ck(r.dansVolet && r.voletVisible, 'il passe dans le volet, qui s\'affiche');
            // Lot 10f : au téléphone l'éditeur est une feuille plein écran (fixe, au-dessus de la grille) ; à l'ordinateur il reste sous la grille.
            const feuille = await p.evaluate(() => getComputedStyle(document.getElementById('seq-dock-panel')).position === 'fixed');
            ck(vp.mob ? feuille : r.sousLaGrille, vp.mob ? 'l\'éditeur est une feuille plein écran' : 'le volet est bien SOUS la grille d\'accords');
            ck(r.continu && r.contexte>0 && r.lignes>4,
                `continu : ${r.lignes} lignes (demi-tons), ${r.contexte} barres de contexte`);
            ck(r.visible, 'il est visible à l\'écran');
            // Lot 9a/9b : l'éditeur de notes s'ouvre RÉDUIT (« ~170 px de notes ») + la règle, soit ~194px, et sa barre est passée dans l'en-tête, hors de
            // cet hôte. « En gros » se juge donc face au petit séquenceur de la carte (une poignée de lignes) : au moins les 170px de notes et la règle.
            ck(r.hauteurVolet >= 190, `volet en GROS — ${r.hauteurVolet}px de haut`);

            console.log('--- 3. Le volet est ajustable en hauteur ---');
            const h0 = r.hauteurVolet;
            if (vp.mob) {
                // Téléphone : la feuille prend toute la place, sa poignée n'existe pas.
                ck(await p.evaluate(() => document.getElementById('seq-dock-resize').offsetParent === null) && h0 > 250, `la feuille donne déjà toute la hauteur (${h0}px), sans poignée`);
            } else {
                const box = await p.evaluate(()=>{const e=document.getElementById('seq-dock-resize');const b=e.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2};});
                await p.mouse.move(box.x, box.y); await p.mouse.down();
                await p.mouse.move(box.x, box.y-120, {steps:10}); await p.mouse.up();
                await p.waitForTimeout(600);
                const h1 = await p.evaluate(()=>Math.round(document.getElementById('seq-dock-host').getBoundingClientRect().height));
                ck(h1 > h0 + 60, `tirer la poignée vers le haut agrandit — ${h0}px → ${h1}px`);
            }

            console.log('--- 4. Rappuyer sur le même bouton referme ---');
            await taper(vp.mob ? '#editeur-notes-fermer' : '#grid-zoom'); await p.waitForTimeout(900); // lot 10f : au téléphone, la feuille recouvre la porte
            r = await lire(); console.log(JSON.stringify({mode:r.mode, voletVisible:r.voletVisible}));
            ck(r.mode===null && !r.voletVisible, 'tout est refermé');
        }
        ck(errs.length===0, `aucune erreur JavaScript — ${JSON.stringify(errs)}`);
        await ctx.close();
    }
    console.log('\n=== Bilan :', P, 'PASS /', F, 'FAIL ===');
    await b.close();
    process.exit(F>0?1:0);
})().catch(e=>{console.error('FATAL',e);process.exit(2);});
