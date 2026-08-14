const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// index.html ne porte pas de ?v= sur lui-même : un navigateur peut en servir une version ANTÉRIEURE
// avec le script.js à jour. Ce banc sert ce mélange depuis mix/ (port 8936) et vérifie que l'appli
// démarre quand même. Renommer #grid-zoom avait suffi à tout figer : getElementById null en plein
// setupEventListeners, window.app jamais construit, page entièrement morte — pas seulement ce bouton.
(async () => {
    const b = await chromium.launch(); const p = await b.newPage({viewport:{width:1500,height:1000}});
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(`${BASE}/index.html?nocache=`+Date.now(),{waitUntil:'load'});
    await p.waitForTimeout(600);
    console.log('erreurs au chargement :', JSON.stringify(errs));
    const avant = await p.evaluate(()=>window.app && window.app.seqOpen);
    const clic = await p.evaluate(()=>{ const b=document.getElementById('grid-zoom'); if(!b) return 'bouton absent'; b.click(); return 'cliqué'; });
    await p.waitForTimeout(600);
    const apres = await p.evaluate(()=>window.app && window.app.seqOpen);
    console.log(`clic sur l'ancien bouton #grid-zoom : ${clic} — seqOpen ${avant} -> ${apres}`);
    console.log(apres === true ? 'OK : le séquenceur s\'ouvre' : 'REPRODUIT : le bouton ne fait RIEN');
    await b.close();
})();
