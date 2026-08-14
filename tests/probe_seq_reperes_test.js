const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// Trois retours utilisateur : quadrillage de fond utilisable pour se repérer dans le temps, clavier
// et noms de notes toujours visibles à gauche, et clic à côté d'une note = sélection de cette note.
let P=0,F=0; const ck=(c,l)=>{ if(c){P++;console.log('PASS - '+l);} else {F++;console.log('FAIL - '+l);} };
(async () => {
    const b = await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
    const p = await b.newPage({viewport:{width:1500,height:1000}});
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(`${BASE}/index.html?nocache=`+Date.now(),{waitUntil:'load'});
    await p.waitForTimeout(300);
    await p.evaluate(()=>{const mk=(r,q)=>({root:r,quality:q,beats:4,inversion:0,drop:0,octave:3,bass:null,playStyle:'croche_staccato'});
      const c=[];for(let i=0;i<12;i++)c.push(mk(['C','A','F','G'][i%4], i%2?'min7':'maj'));
      localStorage.setItem('myProgression',JSON.stringify({sections:[{title:'Couplet',chords:c}]}));});
    await p.reload({waitUntil:'load'}); await p.waitForTimeout(600);
    await p.evaluate(()=>window.app.editChord(0,6)); await p.waitForTimeout(500);
    await p.click('#grid-zoom'); await p.waitForTimeout(1200);

    console.log('--- 1. Quadrillage de fond CALÉ sur la musique ---');
    const q = await p.evaluate(()=>{
        const g=document.querySelector('.seq-grid'); const cs=getComputedStyle(g);
        const gr=g.getBoundingClientRect();
        const prem=[...g.querySelectorAll('.seq-cell,.seq-ctx-note')].map(e=>e.getBoundingClientRect().left).sort((a,b)=>a-b)[0];
        return {posFond: parseFloat(cs.backgroundPosition), debutMusique: Math.round(prem-gr.left),
                labelW: cs.getPropertyValue('--seq-label-w').trim(),
                degrades:(cs.backgroundImage.match(/gradient/g)||[]).length};
    });
    console.log(JSON.stringify(q));
    ck(Math.abs(q.posFond - q.debutMusique) < 2,
        `le quadrillage démarre où commence la musique — fond à ${q.posFond}px, musique à ${q.debutMusique}px`);
    ck(q.degrades >= 3, `plusieurs niveaux de traits (mesure / temps / croche) — ${q.degrades}`);

    console.log('--- 2. Clavier et noms de notes toujours visibles à gauche ---');
    const g1 = await p.evaluate(()=>{
        const sc=document.querySelector('.seq-scroll'); const lab=sc.querySelector('.seq-label');
        return {scrollLeft:Math.round(sc.scrollLeft), ecart:Math.round(lab.getBoundingClientRect().left - sc.getBoundingClientRect().left),
                texte:lab.textContent.trim(), touche:/seq-key/.test(lab.className)};
    });
    console.log(JSON.stringify(g1));
    ck(g1.scrollLeft > 100, `on est bien défilé loin dans le morceau — ${g1.scrollLeft}px`);
    ck(Math.abs(g1.ecart) < 3, `...et la gouttière reste collée au bord gauche — écart ${g1.ecart}px`);
    ck(!!g1.texte && g1.touche, `elle porte le nom de note et l'aspect de la touche — « ${g1.texte} »`);
    // Elle doit tenir aussi tout au bout du morceau.
    await p.evaluate(()=>{ document.querySelector('.seq-scroll').scrollLeft = 99999; });
    await p.waitForTimeout(400);
    const g2 = await p.evaluate(()=>{
        const sc=document.querySelector('.seq-scroll'); const lab=sc.querySelector('.seq-label');
        return Math.round(lab.getBoundingClientRect().left - sc.getBoundingClientRect().left);
    });
    ck(Math.abs(g2) < 3, `...y compris tout au bout du morceau — écart ${g2}px`);

    console.log('--- 3. Clic juste à côté d\'une note : on la sélectionne ---');
    // Croches piquées : le motif comporte de vrais silences, on y trouve donc une note suivie d'une
    // case vide sans rien avoir à forcer (forcer le motif à la main ne tenait pas — le rendu le
    // resynchronise depuis l'accord).
    const prep = await p.evaluate(()=>{
        const app=window.app; const {pattern}=app.getLiveSeqPattern(app.readChord());
        for (let v=0; v<6; v++) {
            for (let s=0; s<pattern.length-2; s++) {
                if (pattern[s] && pattern[s].includes(v) && pattern[s+1] && !pattern[s+1].includes(v)) {
                    return {voice:v, fin:s, caseVide:s+1, nbNotesAvant:pattern.filter(x=>x.includes(v)).length};
                }
            }
        }
        return null;
    });
    console.log('cible :', JSON.stringify(prep));
    ck(!!prep, 'un cas de test a été trouvé (une note, puis une case vide juste après)');
    await p.evaluate(({voice,caseVide})=>{
        const c=document.querySelector(`.seq-cell[data-voice="${voice}"][data-step="${caseVide}"]`);
        c.scrollIntoView({block:'center', inline:'center'});
    }, prep);
    await p.waitForTimeout(400);
    const box = await p.evaluate(({voice,caseVide})=>{
        const c=document.querySelector(`.seq-cell[data-voice="${voice}"][data-step="${caseVide}"]`);
        const b=c.getBoundingClientRect(); return {x:b.x+b.width/2, y:b.y+b.height/2};
    }, prep);
    await p.mouse.click(box.x, box.y);
    await p.waitForTimeout(600);
    const apres = await p.evaluate(({voice})=>{
        const app=window.app; const {pattern}=app.getLiveSeqPattern(app.readChord());
        return {nbNotes:pattern.filter(x=>x.includes(voice)).length,
                selections:app.seqSelections.map(s=>({v:s.voice,d:s.start,f:s.end}))};
    }, prep);
    console.log(JSON.stringify(apres));
    ck(apres.nbNotes === prep.nbNotesAvant, `aucune note créée — ${prep.nbNotesAvant} avant, ${apres.nbNotes} après`);
    ck(apres.selections.length===1 && apres.selections[0].f === prep.fin,
        `la note voisine est SÉLECTIONNÉE — ${JSON.stringify(apres.selections)}`);

    console.log('--- ...mais un vrai glissé dessine toujours ---');
    const loin = await p.evaluate(({voice})=>{
        const app=window.app; const {pattern}=app.getLiveSeqPattern(app.readChord());
        for (let s=2; s<pattern.length-3; s++) {
            const vide=[s-1,s,s+1,s+2].every(k=>pattern[k] && !pattern[k].includes(voice));
            if (vide) return s;
        }
        return null;
    }, prep);
    if (loin != null) {
        const b2 = await p.evaluate(({voice,loin})=>{
            const c=document.querySelector(`.seq-cell[data-voice="${voice}"][data-step="${loin}"]`);
            c.scrollIntoView({block:'center',inline:'center'});
            const r=c.getBoundingClientRect(); return {x:r.x+r.width/2, y:r.y+r.height/2, w:r.width};
        }, {voice:prep.voice, loin});
        await p.waitForTimeout(300);
        await p.mouse.move(b2.x,b2.y); await p.mouse.down();
        await p.mouse.move(b2.x + b2.w*2, b2.y, {steps:8}); await p.mouse.up();
        await p.waitForTimeout(600);
        const n2 = await p.evaluate(({voice})=>{
            const app=window.app; const {pattern}=app.getLiveSeqPattern(app.readChord());
            return pattern.filter(x=>x.includes(voice)).length;
        }, prep);
        ck(n2 > apres.nbNotes, `un glissé loin de tout dessine bien — ${apres.nbNotes} → ${n2} croches`);
    }

    console.log('Errors:', JSON.stringify(errs));
    ck(errs.length===0, 'aucune erreur JavaScript');
    console.log('=== Bilan :', P, 'PASS /', F, 'FAIL ===');
    await b.close();
    process.exit(F>0?1:0);
})().catch(e=>{console.error('FATAL',e);process.exit(2);});
