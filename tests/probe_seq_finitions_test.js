const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// Cinq retours utilisateur sur le séquenceur continu : forme des accords voisins, aimantation fixe,
// défilement tactile, doubles croches au quadrillage, règle de mesure retravaillée.
let P=0,F=0; const ck=(c,l)=>{ if(c){P++;console.log('PASS - '+l);} else {F++;console.log('FAIL - '+l);} };
(async () => {
    const b = await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
    const p = await b.newPage({viewport:{width:1500,height:1000}});
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(`${BASE}/index.html?nocache=`+Date.now(),{waitUntil:'load'});
    await p.waitForTimeout(400);
    await p.evaluate(()=>{const mk=(r,q)=>({root:r,quality:q,beats:4,inversion:0,drop:0,octave:3,bass:null,playStyle:'croche_staccato'});
      const c=[];for(let i=0;i<12;i++)c.push(mk(['C','A','F','G'][i%4], i%2?'min7':'maj'));
      localStorage.setItem('myProgression',JSON.stringify({sections:[{title:'Couplet',chords:c}]}));});
    await p.reload({waitUntil:'load'}); await p.waitForTimeout(700);
    await p.evaluate(()=>window.app.editChord(0,6)); await p.waitForTimeout(400);
    await p.click('#grid-zoom'); await p.waitForTimeout(1300);

    console.log('--- 1. Accords voisins : même FORME que l\'accord édité, en plus pâle ---');
    const f = await p.evaluate(()=>{
        const g=document.querySelector('.seq-grid'); const cs=e=>getComputedStyle(e);
        const ctx=g.querySelector('.seq-ctx-note[class*="seq-ctx-role-"]');
        const note=g.querySelector('.seq-note[class*="role-"]');
        return {ctxArrondi:cs(ctx).borderRadius, noteArrondi:cs(note).borderRadius,
                ctxBordure:parseFloat(cs(ctx).borderTopWidth), ctxDegrade:cs(ctx).backgroundImage.includes('gradient'),
                ctxOpacite:parseFloat(cs(ctx).opacity)};
    });
    console.log(JSON.stringify(f));
    ck(f.ctxArrondi === f.noteArrondi, `même arrondi que les notes éditées — ${f.ctxArrondi} vs ${f.noteArrondi}`);
    ck(f.ctxBordure >= 1 && f.ctxDegrade, 'même langage visuel : bordure + dégradé, comme une vraie barre');
    ck(f.ctxOpacite < 0.6, `...mais nettement plus pâle — opacité ${f.ctxOpacite}`);

    console.log('--- 2. Aimantation fixe à la double croche, sélecteur retiré ---');
    const a = await p.evaluate(()=>({
        selecteur: !!document.querySelector('.seq-snap-group'),
        boutonsSnap: document.querySelectorAll('.seq-snap-btn').length,
        pas: window.app.seqSnap(),
        // Léger penchant pour la croche : une position tout près d'un début de croche y est ramenée,
        // une position au milieu d'une case reste à la double croche.
        surCroche: window.app.snapSeqBoundary(2.2),
        entreDeux: window.app.snapSeqBoundary(2.9),
        exact: window.app.snapSeqBoundary(5),
    }));
    console.log(JSON.stringify(a));
    ck(!a.selecteur && a.boutonsSnap === 0, 'le sélecteur fer à cheval a disparu de la barre');
    ck(a.pas === 1, `l'aimantation vaut une double croche — ${a.pas}`);
    ck(a.surCroche === 2, `tout près d'une croche, on s'y cale — 2.2 → ${a.surCroche}`);
    ck(a.entreDeux === 3, `ailleurs, on reste à la double croche visée — 2.9 → ${a.entreDeux}`);
    ck(a.exact === 5, `une position déjà juste ne bouge pas — 5 → ${a.exact}`);

    console.log('--- 3. Défilement possible sans toucher les notes ---');
    const d = await p.evaluate(()=>{
        const g=document.querySelector('.seq-grid'); const cs=e=>getComputedStyle(e);
        const sc=document.querySelector('.seq-scroll');
        return {regle:cs(g.querySelector('.seq-beat-label')).touchAction,
                gouttiere:cs(g.querySelector('.seq-label')).touchAction,
                case_:cs(g.querySelector('.seq-cell')).touchAction,
                barres:cs(sc).scrollbarWidth, defileH:sc.scrollWidth>sc.clientWidth};
    });
    console.log(JSON.stringify(d));
    ck(d.regle.includes('pan') && d.gouttiere.includes('pan'),
        `règle et gouttière laissent passer le glissé — ${d.regle} / ${d.gouttiere}`);
    // CONTRAT REVU depuis : les cases laissent elles aussi le navigateur défiler (pan-x pan-y). Elles
    // étaient en `none` pour que dessiner reste possible — mais comme elles couvrent la quasi-totalité
    // de la surface, plus rien ne faisait défiler au doigt et toute tentative créait une note (retour
    // utilisateur : « à chaque fois que je veux scroller, je crée une note non voulue... c'est trop
    // aléatoire »). Ce qui décide entre défiler et dessiner n'est plus l'ENDROIT touché mais la DURÉE
    // de l'appui (voir _armerAppuiLongSeq) : c'est ce que vérifie désormais
    // probe_defilement_tactile_test.js, banc dédié.
    ck(d.case_ === 'pan-x pan-y', `les cases laissent le navigateur défiler — ${d.case_}`);
    ck(d.barres !== 'none' && d.defileH, `les barres de défilement restent présentes — ${d.barres}`);

    console.log('--- 4. Doubles croches au quadrillage ---');
    const q = await p.evaluate(()=>{
        const cs=getComputedStyle(document.querySelector('.seq-grid'));
        return {degrades:(cs.backgroundImage.match(/gradient/g)||[]).length,
                colW:cs.getPropertyValue('--seq-col-w').trim(),
                citeColW: cs.backgroundImage.includes(cs.getPropertyValue('--seq-col-w').trim())};
    });
    console.log(JSON.stringify(q));
    ck(q.degrades >= 5, `un niveau de plus qu'avant — ${q.degrades} dégradés (4 avant)`);

    console.log('--- 5. Règle de mesure retravaillée ---');
    const r = await p.evaluate(()=>{
        const g=document.querySelector('.seq-grid'); const cs=e=>getComputedStyle(e);
        const mes=g.querySelector('.seq-beat-label[data-mesure]');
        const temps=[...g.querySelectorAll('.seq-beat-label:not([data-mesure])')][0];
        return {mesures:g.querySelectorAll('.seq-beat-label[data-mesure]').length,
                numeroMesure:mes?mes.textContent.trim():null,
                grasMesure:cs(mes.querySelector('.seq-beat-num')).fontWeight,
                grasTemps:cs(temps.querySelector('.seq-beat-num')).fontWeight,
                // Le bandeau est désormais un élément à part couvrant TOUTE la partie (.seq-ruler-band),
                // et non plus un dégradé peint sur chaque étiquette : entre deux chiffres, le
                // quadrillage se voyait dans les trous et la règle se lisait comme une rangée de
                // vignettes (retour utilisateur : « la règle de mesure est complètement incohérente »).
                fondRegle:(()=>{const bd=g.querySelector('.seq-ruler-band');
                    return !!bd && cs(bd).backgroundImage.includes('gradient')
                        && Math.round(bd.getBoundingClientRect().width) === Math.round(g.getBoundingClientRect().width);})(),
                teteRegle:!!g.querySelector('.seq-ruler-head')};
    });
    console.log(JSON.stringify(r));
    ck(r.mesures >= 3, `les débuts de mesure sont distingués — ${r.mesures}`);
    ck(+r.grasMesure > +r.grasTemps, `numéro de mesure en gras, temps en léger — ${r.grasMesure} vs ${r.grasTemps}`);
    ck(r.fondRegle, 'la règle a un vrai bandeau continu sur toute la section, plus une rangée de vignettes');
    ck(r.teteRegle, 'le repère de lecture orange est présent dans la règle');
    // Il doit suivre la lecture et se cacher à l'arrêt.
    await p.evaluate(()=>window.app.updateSeqPlayhead(8));
    await p.waitForTimeout(200);
    const suit = await p.evaluate(()=>{const t=document.querySelector('.seq-ruler-head');
        return {visible:!t.hidden, col:t.style.gridColumn};});
    ck(suit.visible && suit.col, `il suit la lecture — colonne ${suit.col}`);
    await p.evaluate(()=>window.app.updateSeqPlayhead(null));
    await p.waitForTimeout(200);
    ck(await p.evaluate(()=>document.querySelector('.seq-ruler-head').hidden), '...et disparaît à l\'arrêt');

    console.log('Errors:', JSON.stringify(errs));
    ck(errs.length===0, 'aucune erreur JavaScript');
    console.log('=== Bilan :', P, 'PASS /', F, 'FAIL ===');
    await b.close();
    process.exit(F>0?1:0);
})().catch(e=>{console.error('FATAL',e);process.exit(2);});
