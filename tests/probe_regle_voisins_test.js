const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// Retour utilisateur (3 points) :
// 1. « Je n'aime pas trop la représentation des accords voisins sous forme de petites barres.
//     Garder le séquenceur réel des accords à proximité. »
// 2. « La règle de mesure est complètement incohérente. Je rappelle qu'elle doit suivre la section
//     de grille en entier. »
// 3. « La règle de mesure doit être en dehors du quadrillage pour mieux la voir (cf. autres DAW) »
let PASS = 0, FAIL = 0;
const check = (c, l) => { if (c) { PASS++; console.log('PASS - ' + l); } else { FAIL++; console.log('FAIL - ' + l); } };

const SCR = __dirname + '/';

async function ouvrir(page) {
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        const mk = (r, q, b) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 0, octave: 3, bass: null, playStyle: 'held' });
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [
            mk('C', 'maj', 4), mk('A', 'min7', 4), mk('D', 'min7', 2), mk('G', '7', 6), mk('C', 'maj7', 4)] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(400);
    await page.evaluate(() => window.app.editChord(0, 1));
    await page.waitForTimeout(300);
    // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4a, 12/11) : à l'ordinateur, le séquenceur s'ouvre par le bloc « Vues » ; au téléphone, par la porte d'avant (4c).
    const ordi = await page.evaluate(() => window.matchMedia('(min-width: 900px)').matches);
    await page.click(ordi ? '#vue-sequenceur' : '#grid-zoom');
    await page.waitForTimeout(600);
}

(async () => {
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/fonts\.googleapis|fonts\.gstatic|ERR_/.test(m.text())) errors.push('console: ' + m.text()); });

    await ouvrir(page);

    // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4a, 12/11, « réécriture courte ») : les accords voisins en pastilles et la règle de mesures du séquenceur continu ont
    // disparu avec lui. Les trois demandes restent vraies dans le séquenceur du bloc « Vues » : (1) chaque accord de la partie montre son VRAI rythme (toute la partie,
    // les mêmes croches que le morceau) ; (2) la règle numérote les temps de façon cohérente sur toute la section, en reprenant au premier temps à chaque mesure ;
    // (3) la règle est EN DEHORS du quadrillage, au-dessus des lignes.
    const R = require('./_retrait_ancien');
    console.log('--- 1. Chaque accord de la partie montre son vrai rythme ---');
    let rr = await R.toutePartie(page);
    check(rr.ok, `toute la partie est à l'écran (${rr.detail})`);
    const vrais = await page.evaluate(() => loadProgressionSections()[0].chords.map((d, c) => {
        const e = SequenceurHarmo.lireAccord(d);
        const attendu = [...e.on].length;
        const vus = document.querySelectorAll(`#sq-grille .sq-case.on[data-c="${c}"]`).length;
        return attendu === vus;
    }));
    check(vrais.every(Boolean), `chaque accord montre exactement les croches du morceau (${vrais.join(' ')})`);
    console.log('--- 2. La règle numérote les temps, cohérente sur toute la section ---');
    const regle = await page.evaluate(() => {
        const bpb = window.app.beatsPerBar();
        const temps = [...document.querySelectorAll('#sq-grille .sq-temps')].filter(x => x.textContent).map(x => +x.textContent);
        const attendu = temps.map((_, n) => (n % bpb) + 1);
        return { temps: temps.join(''), attendu: attendu.join(''), mesures: document.querySelectorAll('#sq-grille .sq-case.mesure').length };
    });
    check(regle.temps === regle.attendu && regle.temps.length > 8, `de 1 à 4, puis de nouveau 1, sur toute la section — « ${regle.temps} »`);
    console.log('--- 3. La règle est EN DEHORS du quadrillage ---');
    const hors = await page.evaluate(() => {
        const r = Math.max(...[...document.querySelectorAll('#sq-grille .sq-temps')].map(x => x.getBoundingClientRect().bottom));
        const c = Math.min(...[...document.querySelectorAll('#sq-grille .sq-case[data-r]')].map(x => x.getBoundingClientRect().top));
        return { r: Math.round(r), c: Math.round(c) };
    });
    check(hors.r <= hors.c, `la règle finit (${hors.r}px) avant la première ligne de notes (${hors.c}px)`);
    rr = await R.plageBoucle(page);
    check(rr.ok, `dans la règle, c'est bien la règle qu'on touche : un glissé y tire la plage à boucler (${rr.detail})`);

    console.log('--- 5. Le petit séquenceur garde ses NUMÉROS DE TEMPS (1 2 3 4) ---');
    await R.cliquer(page, '#sq-fermer');
    await page.evaluate(() => window.app.toggleSequencer('compact'));
    await page.waitForTimeout(500);
    const petit = await page.evaluate(() => {
        const g = document.querySelector('#arp-sequencer .seq-grid');
        if (!g) return { absent: true };
        const nums = [...g.querySelectorAll('.seq-beat-label .seq-beat-num')].map(s => s.textContent);
        return {
            continu: g.classList.contains('seq-grid-continuous'),
            suite: nums.join(' '),
            visibles: [...g.querySelectorAll('.seq-beat-label .seq-beat-num')].every(s => +getComputedStyle(s).opacity > 0.5),
            bande: g.querySelectorAll('.seq-ruler-band').length,
        };
    });
    console.log(JSON.stringify(petit));
    check(!petit.continu && petit.suite === '1 2 3 4' && petit.visibles,
        `le petit séquenceur compte toujours en temps, tous visibles — « ${petit.suite} »`);
    check(petit.bande === 0, 'pas de bandeau de règle dans le petit séquenceur (il ne couvre qu\'un accord)');

    console.log('--- 6. Mobile ---');
    const mob = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    mob.on('pageerror', e => errors.push('mobile pageerror: ' + e.message));
    await ouvrir(mob);
    const surMobile = await mob.evaluate(() => {
        const grille = document.querySelector('.seq-grid-continuous');
        if (!grille) return { absent: true };
        const labels = [...grille.querySelectorAll('.seq-beat-label')];
        const lus = labels.filter(l => +getComputedStyle(l.querySelector('.seq-beat-num')).opacity > 0.05)
            .map(l => l.querySelector('.seq-beat-num').textContent);
        const bande = grille.querySelector('.seq-ruler-band');
        const cs = getComputedStyle(grille);
        const ctx = [...grille.querySelectorAll('.seq-ctx-note')];
        return {
            suite: lus.join(' '),
            bandeLargeur: bande && Math.round(bande.getBoundingClientRect().width),
            grilleLargeur: Math.round(grille.getBoundingClientRect().width),
            fondY: cs.backgroundPosition.split(',')[0].trim().split(' ')[1],
            hRegle: cs.getPropertyValue('--seq-ruler-h').trim(),
            nbCtx: ctx.length,
            ctxUnPas: ctx.filter(c => !/span/.test(c.style.gridColumn)).length,
        };
    });
    console.log(JSON.stringify(surMobile));
    check(surMobile.suite === '1 2 3 4 5', `même règle de mesures sur téléphone — « ${surMobile.suite} »`);
    check(surMobile.bandeLargeur === surMobile.grilleLargeur,
        `le bandeau couvre toute la section sur téléphone — ${surMobile.bandeLargeur}px sur ${surMobile.grilleLargeur}px`);
    check(surMobile.fondY === surMobile.hRegle, `quadrillage sous la règle sur téléphone — ${surMobile.fondY}`);
    check(surMobile.nbCtx > 0 && surMobile.ctxUnPas === 0,
        `voisins en vraies barres sur téléphone — ${surMobile.nbCtx} barres, aucune d'une seule case`);
    await mob.screenshot({ path: SCR + 'regle_APRES_mobile.png' });

    console.log('Errors:', JSON.stringify(errors));
    check(errors.length === 0, 'aucune erreur JavaScript');
    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
