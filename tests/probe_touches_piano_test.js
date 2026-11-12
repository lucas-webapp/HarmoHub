const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// Retour utilisateur sur l'échelle des notes à gauche du séquenceur continu :
// 1. « Mettre la vraie couleur des touches de piano (blanc-beige et noir). »
// 2. « Le nom des notes prend trop de place sur les touches. Laisser uniquement le Do avec son
//     octave. Quand je déplace ou ajoute une barre dans l'accord, tu dois faire apparaître la note
//     sur la gauche (même pendant le déplacement pour pouvoir poser la note au bon endroit). »
let PASS = 0, FAIL = 0;
const check = (c, l) => { if (c) { PASS++; console.log('PASS - ' + l); } else { FAIL++; console.log('FAIL - ' + l); } };
const SCR = __dirname + '/';
const R = require('./_retrait_ancien');

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
    await page.waitForTimeout(700);
}

(async () => {
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/fonts\.googleapis|fonts\.gstatic|ERR_/.test(m.text())) errors.push('console: ' + m.text()); });

    await ouvrir(page);

    // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4a, 12/11, « réécriture courte ») : l'échelle chromatique du séquenceur continu (une touche par demi-ton, le DO seul
    // nommé, le nom qui réapparaît pendant un déplacement de barre) a disparu avec lui. Le nouveau séquenceur a une ligne PAR VOIX : chaque étiquette dit sa note et son
    // octave (cahier, « Étiquettes ») et se dessine comme une touche de piano — claire pour une note naturelle, sombre pour un dièse.
    console.log('--- 1. Les étiquettes du séquenceur : la note et son octave, dessinées comme des touches ---');
    const etiq = await page.evaluate(() => [...document.querySelectorAll('#sq-grille .sq-etiq')].filter(e => e.textContent.trim()).map(e => ({ nom: e.textContent.trim(), diese: e.classList.contains('diese'), fond: getComputedStyle(e).backgroundColor })));
    console.log(JSON.stringify(etiq));
    check(etiq.length >= 3 && etiq.every(e => /^[A-G][#♯b♭]?-?\d+$/.test(e.nom)), `chaque ligne nomme sa note avec son octave — ${etiq.map(e => e.nom).join(', ')}`);
    const clair = (c) => { const m = c.match(/\d+/g).map(Number); return (m[0] + m[1] + m[2]) / 3 > 150; };
    check(etiq.filter(e => !e.diese).every(e => clair(e.fond)) && etiq.filter(e => e.diese).every(e => !clair(e.fond)), 'les notes naturelles sur une touche claire, les dièses sur une touche sombre');
    // Une note posée s'entend et porte son nom au début de sa barre (le nom n'a plus à « réapparaître » : il est écrit dans la note).
    await R.cliquer(page, '#sq-effacer');
    const vAig = await page.evaluate(() => { const e = SequenceurHarmo.lireAccord(loadProgressionSections()[0].chords[window.app.selectedIndex != null ? window.app.selectedIndex : 1]); return e.info.positions[e.info.positions.length - 1]; });
    const choisi = await page.evaluate(() => +document.querySelector('#sq-grille .sq-nom.choisi').dataset.c);
    await R.cliquer(page, `#sq-grille .sq-case[data-c="${choisi}"][data-v="${vAig}"][data-k="2"]`);
    const pose = await page.evaluate(([c, v]) => { const n = document.querySelector(`#sq-grille .sq-case[data-c="${c}"][data-v="${v}"][data-k="2"] .sq-note`); return n ? n.textContent.trim() : null; }, [choisi, vAig]);
    check(!!pose && /^[A-G][#♯b♭]?-?\d+$/.test(pose), `une note posée porte son nom au début de sa barre — « ${pose} »`);
    await page.keyboard.press('Control+z'); await page.waitForTimeout(300);
    await page.keyboard.press('Control+z'); await page.waitForTimeout(300);

    console.log('--- 5. Le PETIT séquenceur garde ses noms (pas de clavier chromatique) ---');
    await R.cliquer(page, '#sq-fermer');
    await page.evaluate(() => window.app.toggleSequencer('compact'));
    await page.waitForTimeout(500);
    const petit = await page.evaluate(() => {
        const g = document.querySelector('#arp-sequencer .seq-grid');
        const labels = [...g.querySelectorAll('.seq-label')];
        return {
            touches: g.querySelectorAll('.seq-key').length,
            noms: labels.map(l => l.textContent.trim()).filter(Boolean),
            tousVisibles: labels.every(l => l.getBoundingClientRect().width > 0),
        };
    });
    console.log(JSON.stringify(petit));
    check(petit.touches === 0 && petit.noms.length >= 3 && petit.tousVisibles,
        `lignes par voix, noms tous lisibles — ${petit.noms.join(', ')}`);

    console.log('--- 6. Téléphone ---');
    const mob = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    mob.on('pageerror', e => errors.push('mobile pageerror: ' + e.message));
    await ouvrir(mob);
    const surMobile = await mob.evaluate(() => {
        const g = document.querySelector('.seq-grid-continuous');
        if (!g) return { absent: true };
        const labels = [...g.querySelectorAll('.seq-label.seq-key')];
        const vus = labels.map(l => {
            const sp = l.querySelector('.seq-key-name');
            return sp && getComputedStyle(sp).visibility === 'visible' ? sp.textContent.trim() : null;
        }).filter(Boolean);
        // Même raison qu'au point 1 : une touche jouée porte la couleur de sa fonction, pas l'ivoire.
        const b = g.querySelector('.seq-key-white:not(.seq-key-jouee)');
        return {
            visibles: vus, total: labels.length,
            teintes: (getComputedStyle(b).backgroundImage.match(/rgba?\([^)]+\)/g) || []),
            largeurGouttiere: Math.round(b.getBoundingClientRect().width),
        };
    });
    console.log(JSON.stringify(surMobile));
    check(surMobile.visibles.every(t => /^[A-G][#b]?-?\d+$/.test(t)) && surMobile.visibles.length > 0
        && surMobile.visibles.length < surMobile.total / 3,
        `DO + touches jouées sur téléphone aussi — ${surMobile.visibles.join(', ')} sur ${surMobile.total} touches`);
    check(surMobile.teintes.includes('rgb(243, 237, 224)'), 'et le même ivoire');
    await mob.screenshot({ path: SCR + 'touches_mobile.png' });

    console.log('Errors:', JSON.stringify(errors));
    check(errors.length === 0, 'aucune erreur JavaScript');
    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    await browser.close();
    process.exit(FAIL > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
