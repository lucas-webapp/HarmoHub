const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// Deux séquenceurs, deux usages (retour utilisateur : « le petit séquenceur de modification rapide
// affiche des notes chromatiques, ça n'était pas le but... je voulais le garder comme avant : pas de
// séquenceur continu mais seulement durée de l'accord, afficher uniquement les notes jouées... le
// séquenceur continu en grand permettra un réglage à l'échelle du morceau »).
//  - PETIT (panneau Accord)  : durée de l'accord seule, une ligne par VOIX jouée, aucun contexte ;
//  - AGRANDI (#seq-zoom)     : vue continue, demi-tons absolus, toute la partie.
let P=0,F=0; const ck=(c,l)=>{ if(c){P++;console.log('PASS - '+l);} else {F++;console.log('FAIL - '+l);} };
(async () => {
    const b = await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
    const p = await b.newPage({viewport:{width:1500,height:1000}});
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(`${BASE}/index.html?nocache=`+Date.now(),{waitUntil:'load'});
    await p.waitForTimeout(200);
    await p.evaluate(()=>{const mk=(r,q)=>({root:r,quality:q,beats:4,inversion:0,drop:0,octave:3,bass:null,playStyle:'held'});
      const c=[]; for(let i=0;i<8;i++) c.push(mk(['C','A','F','G'][i%4], i%2?'min7':'maj'));
      localStorage.setItem('myProgression',JSON.stringify({sections:[{title:'Couplet',chords:c}]}));});
    await p.reload({waitUntil:'load'}); await p.waitForTimeout(500);

    const lire = () => p.evaluate(()=>{
        const g=document.querySelector('.seq-grid');
        return {
            continu: !!g && g.className.includes('continuous'),
            lignes: document.querySelectorAll('.seq-label').length, // une étiquette par ligne
            reperes: document.querySelectorAll('.seq-beat-label').length,
            contexte: document.querySelectorAll('.seq-ctx-note').length,
            // Les croches liées d'une même voix voisine ne forment plus qu'UNE barre (retour
            // utilisateur : « garder le séquenceur réel des accords à proximité ») : on compte donc
            // les DOUBLES CROCHES couvertes, mesure stable quel que soit le regroupement.
            contextePas: [...document.querySelectorAll('.seq-ctx-note')]
                .reduce((n, e) => n + (+(e.style.gridColumn.match(/span (\d+)/) || [0, 1])[1]), 0),
        };
    });

    console.log('--- A. PETIT séquenceur : comme avant ---');
    await p.evaluate(()=>{ window.app.editChord(0,5); if(!window.app.seqOpen) window.app.toggleSequencer(); });
    await p.waitForTimeout(800);
    const petit = await lire();
    console.log(JSON.stringify(petit));
    ck(!petit.continu, 'PAS de vue continue');
    ck(petit.contexte === 0, `aucun accord voisin affiché — ${petit.contexte} barre(s) de contexte`);
    // Am7 = 4 notes jouées. Une vue chromatique en montrerait bien davantage (l'étendue en demi-tons).
    ck(petit.lignes === 4, `une ligne par VOIX jouée (Am7 = 4 notes), pas par demi-ton — ${petit.lignes} lignes`);
    ck(petit.reperes <= 4, `la barre de temps couvre la seule durée de l'accord — ${petit.reperes} repères`);

    console.log('--- B. Séquenceur AGRANDI : vue continue à l\'échelle du morceau ---');
    // LA PORTE A CHANGÉ : « Séquenceur » (#seq-zoom) n'ouvre plus que le petit, à la demande — la
    // vue agrandie se demande depuis le séquenceur lui-même, par sa loupe. Cliquer l'ancienne porte
    // ici REFERMAIT le panneau déjà ouvert, et les quatre vérifications suivantes tombaient toutes.
    await p.click('#seq-plein-ecran'); await p.waitForTimeout(900);
    const grand = await lire();
    console.log(JSON.stringify(grand));
    ck(grand.continu, 'la vue continue est bien là');
    ck(grand.reperes === 32, `barre de temps sur TOUTE la partie — ${grand.reperes} repères`);
    ck(grand.contextePas === 384, `les accords voisins sont affichés en entier — ${grand.contextePas} doubles croches couvertes, en ${grand.contexte} barres`);
    ck(grand.lignes > petit.lignes, `axe chromatique en demi-tons — ${grand.lignes} lignes contre ${petit.lignes}`);

    console.log('--- C. Refermer la vue agrandie rend le petit séquenceur à l\'identique ---');
    await p.keyboard.press('Escape'); await p.waitForTimeout(800);
    const retour = await lire();
    console.log(JSON.stringify(retour));
    ck(!retour.continu && retour.contexte === 0 && retour.lignes === petit.lignes,
        'le petit séquenceur revient exactement comme avant');

    console.log('Errors:', JSON.stringify(errs));
    ck(errs.length===0, 'aucune erreur JavaScript');
    console.log('=== Bilan :', P, 'PASS /', F, 'FAIL ===');
    await b.close();
    process.exit(F>0?1:0);
})().catch(e=>{console.error('FATAL',e);process.exit(2);});
