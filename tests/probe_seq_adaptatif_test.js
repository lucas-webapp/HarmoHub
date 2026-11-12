const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// Le volet et l'échelle par défaut étaient les mêmes partout, calibrés pour un téléphone : sur un
// écran de 1080px, 222px restaient inutilisés sous le volet et seules 2,5 mesures tenaient dans la
// vue continue — l'inverse de ce qu'on attend d'un « réglage à l'échelle du morceau en grand écran ».
// RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4a, 12/11) : à l'ordinateur, le volet d'avant (« Éditeur de notes », réduit / étendu, hauteur automatique) a disparu.
// L'ENJEU RESTE ENTIER pour le séquenceur du bloc « Vues » : sur un grand écran comme sur un portable, il tient ENTIER dans l'écran (rien n'est caché, cahier 3 bis),
// montre TOUTE la partie (« pas de zoom »), et la hauteur des lignes réglée à la main se retrouve. Le téléphone : sa feuille d'avant a disparu à l'étape 4c, voir plus bas.
const { check: ck, exiger, plan, bilan } = require('./_harness')('volet adaptatif');
const R = require('./_retrait_ancien');
plan(12);
(async () => {
    const b = await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
    const graine = ([n, ligne]) => { const mk=(r,q)=>({root:r,quality:q,beats:4,inversion:0,drop:0,octave:3,bass:null,playStyle:'croche_staccato'});
        const c=[];for(let i=0;i<n;i++)c.push(mk(['C','A','F','G'][i%4], i%2?'min7':'maj'));
        localStorage.setItem('myProgression',JSON.stringify({sections:[{title:'Couplet',chords:c}]}));
        localStorage.removeItem('harmohubSeqDockHeight');
        if (ligne) localStorage.setItem('harmohubSequenceurLigne', String(ligne)); else localStorage.removeItem('harmohubSequenceurLigne'); };
    for (const vp of [{w:1920,h:1080,nom:'ordi-large'},{w:1366,h:768,nom:'portable'}]) {
        const p = await (await b.newContext({viewport:{width:vp.w,height:vp.h}})).newPage();
        const errs=[]; p.on('pageerror',e=>errs.push(e.message));
        await p.goto(`${BASE}/index.html?nocache=`+Date.now(),{waitUntil:'load'});
        await p.evaluate(graine, [12, null]);
        await p.reload({waitUntil:'load'}); await p.waitForTimeout(700);
        await p.click('.grid-cell[data-index="6"]', { position: { x: 30, y: 30 } }); await p.waitForTimeout(300);
        const o = await R.ouvrirNouveau(p);
        exiger(o.ok, `${vp.nom} : le séquenceur s'ouvre (${o.detail})`);
        const m = await p.evaluate(() => { const s = document.getElementById('sequenceur').getBoundingClientRect(), l = document.getElementById('barre-lecture').getBoundingClientRect(), h = document.querySelector('.top-bar').getBoundingClientRect();
            return { haut: Math.round(s.top), bas: Math.round(s.bottom), barre: Math.round(l.top), plafond: Math.round(h.bottom), deborde: Math.round(document.documentElement.scrollHeight - innerHeight) }; });
        console.log(vp.nom.padEnd(11), JSON.stringify(m));
        ck(m.haut >= m.plafond && m.bas <= m.barre + 1 && m.deborde <= 0, `${vp.nom} : le séquenceur tient ENTIER entre la barre du haut et la barre de lecture, sans faire déborder la page (${m.haut}→${m.bas}, barre à ${m.barre})`);
        const tp = await R.toutePartie(p);
        ck(tp.ok, `${vp.nom} : on voit la structure du morceau, les 12 accords de la partie (${tp.detail})`);
        ck(errs.length===0, `${vp.nom} : aucune erreur JavaScript`);
        await p.context().close();
    }

    console.log('\n--- Le téléphone : l\'onglet Rythme du panneau d\'accord (4c) ---');
    {
        const ctx = await b.newContext({viewport:{width:390,height:844}, isMobile:true, hasTouch:true});
        const p = await ctx.newPage();
        const errs=[]; p.on('pageerror',e=>errs.push(e.message));
        await p.goto(`${BASE}/index.html?nocache=`+Date.now(),{waitUntil:'load'});
        await p.evaluate(graine, [12, null]);
        await p.reload({waitUntil:'load'}); await p.waitForTimeout(700);
        // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4c, 12/11) : la feuille « Notes » a disparu. Le séquenceur du téléphone est l'onglet Rythme du panneau
        // d'accord : il tient entre le haut du panneau et la barre de lecture, et ses croches font 44 px au doigt.
        await p.tap('.grid-cell[data-index="6"]'); await p.waitForTimeout(400);
        const o = await R.ouvrirRythmeTel(p);
        // Le panneau défile en interne sur un écran court (accepté au 10e : « ça me convient ») : on mesure le PANNEAU, et on amène la dernière ligne du
        // séquenceur à l'écran comme le ferait le doigt, en faisant défiler le panneau.
        const t = await p.evaluate(()=>{ const pa=document.getElementById('panneau-accord').getBoundingClientRect(), l=document.getElementById('barre-lecture').getBoundingClientRect();
            const cs=[...document.querySelectorAll('#sq-grille .sq-case[data-r]')], der=cs[cs.length-1]; der.scrollIntoView({ block: 'nearest' });
            const d=der.getBoundingClientRect(), c=cs[0].getBoundingClientRect();
            return { sur: window.app._bulle && window.app._bulle.index, haut: Math.round(pa.top), bas: Math.round(pa.bottom), barre: Math.round(l.top), derniere: Math.round(d.bottom), colW: Math.round(c.width), colH: Math.round(c.height), page: document.documentElement.scrollTop }; });
        console.log('telephone  ', JSON.stringify(t));
        ck(o.ok && t.sur === 6 && t.haut >= 0 && t.bas <= t.barre + 1 && t.derniere <= t.bas + 1, `téléphone : l'onglet Rythme s'ouvre sur l'accord choisi, le panneau tient au-dessus de la barre de lecture et sa dernière ligne s'y atteint en le faisant défiler (${o.detail}, panneau ${t.haut}→${t.bas}, barre ${t.barre}, dernière ligne ${t.derniere}, page ${t.page})`);
        ck(t.colH === 40 && t.colW >= 30, `téléphone (plein écran, 13/11 : lignes de 40 px) : les croches restent atteignables au doigt — ${t.colW}×${t.colH}px par croche`);
        ck(errs.length===0, 'téléphone : aucune erreur JavaScript');
        await ctx.close();
    }

    console.log('\n--- Un réglage à la main l\'emporte et se mémorise (hauteur des lignes) ---');
    const p2 = await (await b.newContext({viewport:{width:1920,height:1080}})).newPage();
    await p2.goto(`${BASE}/index.html?nocache=`+Date.now(),{waitUntil:'load'});
    await p2.evaluate(graine, [8, 40]);
    await p2.reload({waitUntil:'load'}); await p2.waitForTimeout(700);
    await R.ouvrirNouveau(p2);
    const h = await p2.evaluate(()=>Math.round(document.querySelector('#sq-grille .sq-case[data-r]').getBoundingClientRect().height));
    ck(h === 40, `la hauteur de lignes réglée à la main est respectée — ${h}px pour 40 mémorisés`);
    await p2.context().close();

    await b.close();
    bilan();
})().catch(e=>{console.error('FATAL',e);process.exit(2);});
