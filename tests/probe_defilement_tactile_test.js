// RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4a, 12/11) : la partie ORDINATEUR porte sur le séquenceur du bloc « Vues » ; la partie téléphone reste (4c).
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// Retour utilisateur : « j'ai encore beaucoup de mal à scroller dans le séquenceur sur le téléphone.
// À chaque fois que je veux scroller, je crée une note non voulue ou je modifie une note sans faire
// exprès. Des fois ça fonctionne bien et la barre de défilement apparaît. C'est trop aléatoire.
// Regarder ce que ça donne sur ordinateur également. »
let PASS = 0, FAIL = 0;
const check = (c, l) => { if (c) { PASS++; console.log('PASS - ' + l); } else { FAIL++; console.log('FAIL - ' + l); } };
const SCR = __dirname + '/';

(async () => {
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const errors = [];

    // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4c, 12/11, « réécriture courte ») : au téléphone, la feuille « Séq. » (sa bande qui défilait de côté, l'appui
    // maintenu qui donnait la main à l'édition, le glissé qui faisait défiler) a disparu. Le séquenceur du téléphone est l'onglet Rythme du panneau d'accord :
    // l'accord seul, ses huit croches dans la largeur — RIEN à faire défiler sous le doigt, donc plus d'ambiguïté entre défiler et poser (le retour de
    // l'utilisateur ci-dessus). Un toucher pose, un autre enlève.
    console.log('=== TÉLÉPHONE ===');
    const R = require('./_retrait_ancien');
    const mob = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    mob.on('pageerror', e => errors.push('mobile pageerror: ' + e.message));
    mob.on('console', m => { if (m.type() === 'error' && !/fonts\.googleapis|fonts\.gstatic|ERR_/.test(m.text())) errors.push('mobile console: ' + m.text()); });
    await mob.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await mob.evaluate(() => {
        const mk = (r, q, b) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 0, octave: 3, bass: null, playStyle: 'held' });
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [mk('C', 'maj', 4), mk('A', 'min7', 4), mk('D', 'min7', 2), mk('G', '7', 6), mk('C', 'maj7', 4)] }] }));
    });
    await mob.reload({ waitUntil: 'load' }); await mob.waitForTimeout(500);
    let rt = await R.porteTelephoneAbsente(mob);
    check(rt.ok, `la feuille « Séq. » n'a plus de porte au téléphone (${rt.detail})`);
    rt = await R.ouvrirRythmeTel(mob);
    check(rt.ok, `« Séquenceur » du panneau Lecture ouvre l'onglet Rythme (${rt.detail})`);
    const largeur = await mob.evaluate(() => { const g = document.getElementById('sq-grille'); return { deborde: g.scrollWidth - g.clientWidth, droite: Math.max(...[...g.querySelectorAll('.sq-case[data-r]')].map(c => c.getBoundingClientRect().right)) }; });
    check(largeur.deborde <= 1 && largeur.droite <= 390, `rien à faire défiler de côté sous le doigt (débord ${largeur.deborde}, bord droit ${Math.round(largeur.droite)})`);
    rt = await R.poserCrocheTel(mob);
    check(rt.ok, `un toucher pose une croche, un autre l'enlève (${rt.detail})`);
    await mob.close();

    // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4a, 12/11, « réécriture courte ») : à l'ordinateur, le séquenceur continu (ses bandes mortes, sa molette, sa barre de
    // défilement, sa règle à empoigner) a disparu. Le séquenceur du bloc « Vues » ne défile JAMAIS de côté (toute la partie à l'écran) ; à la souris, un clic pose
    // tout de suite et un glissé peint tout de suite. Le téléphone garde sa feuille d'avant, éprouvée plus haut, jusqu'à l'étape 4c.
    console.log('=== ORDINATEUR ===');
    const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
    page.on('pageerror', e => errors.push('ordinateur: ' + e.message));
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.evaluate(() => {
        const mk = (r, q, b) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 0, octave: 3, bass: null, playStyle: 'held' });
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [mk('C', 'maj', 4), mk('A', 'min7', 4), mk('D', 'min7', 2), mk('G', '7', 6), mk('C', 'maj7', 4)] }] }));
    });
    await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(500);
    let rr = await R.porteAbsente(page);
    check(rr.ok, `l'ancien séquenceur continu n'a plus de porte (${rr.detail})`);
    rr = await R.ouvrirNouveau(page);
    check(rr.ok, `le séquenceur du bloc « Vues » s'ouvre (${rr.detail})`);
    rr = await R.toutePartie(page);
    check(rr.ok, `rien à faire défiler de côté : toute la partie est à l'écran (${rr.detail})`);
    rr = await R.poserCroche(page, 1);
    check(rr.ok, `la souris n'attend pas : un clic pose tout de suite (${rr.detail})`);
    rr = await R.peindre(page, 1);
    check(rr.ok, `un glissé peint tout de suite, d'une seule annulation (${rr.detail})`);

    console.log('Errors:', JSON.stringify(errors));
    check(errors.length === 0, 'aucune erreur JavaScript');
    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
