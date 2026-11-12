// Le séquenceur CONTINU dans son volet sous la grille : mise en page attendue, et surtout aucun
// verrouillage du défilement de la page.
//
// CE FICHIER N'ÉTAIT PAS UN BANC. Il affichait sept mesures en JSON et se terminait par
// `process.exit(0)` : pas une seule assertion, aucun chemin d'échec. Il ne pouvait donc RIEN
// signaler, quoi qu'il arrive — et il comptait pourtant dans l'inventaire comme un banc de plus. Il
// appelait en outre app.closeGridZoom(), disparue avec la vue plein écran, ce qui aurait fait mourir
// n'importe quel banc réel à cet endroit. Les mesures qu'il prenait étaient les bonnes ; il ne leur
// manquait qu'un verdict. C'est ce qu'on ajoute ici.
//
// L'ENJEU DU VERROUILLAGE. Les fenêtres agrandies posent .body-scroll-locked pour empêcher la page
// de défiler derrière elles (voir lockBodyScroll). Le volet, lui, vit DANS la page : s'il verrouillait
// aussi, la page entière deviendrait immobile alors que rien ne la recouvre — l'appli paraîtrait
// figée. C'est exactement ce que ce fichier mesurait sans jamais l'affirmer.
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('séquenceur continu en volet');
const R = require('./_retrait_ancien');
plan(9);

(async () => {
    const browser = await chromium.launch({
        args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')));
    page.on('console', (msg) => {
        const t = msg.type();
        if (t === 'error' || t === 'warning') {
            const text = msg.text();
            if (text.includes('Failed to load resource') || text.includes('AudioContext was not allowed')) return;
            errors.push(t + ': ' + text);
        }
    });

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        const sections = [{ title: 'Couplet', chords: [
            { root: 'C', quality: 'maj', beats: 4, inversion: 0, drop: 0, octave: 4, bass: null, playStyle: 'held' },
            { root: 'A', quality: 'min7', beats: 4, inversion: 0, drop: 0, octave: 4, bass: null, playStyle: 'held' },
            { root: 'F', quality: 'maj7', beats: 4, inversion: 0, drop: 0, octave: 4, bass: null, playStyle: 'held' },
        ] }];
        localStorage.setItem('myProgression', JSON.stringify({ sections }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(400);

    const verrou = () => page.evaluate(() => ({
        classe: document.body.classList.contains('body-scroll-locked'),
        overflow: getComputedStyle(document.body).overflow,
    }));

    const avant = await verrou();
    check(!avant.classe, `au repos, .body-scroll-locked n'est pas posée sur le corps de page (overflow calculé : « ${avant.overflow} »)`);

    // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4a, 12/11, « réécriture courte ») : le volet continu d'avant (« Éditeur de notes », #seq-dock-panel) n'existe plus à
    // l'ordinateur. L'ENJEU DU BANC RESTE : le séquenceur du bloc « Vues » vit lui aussi DANS la page (au-dessus du tiroir) et ne doit jamais verrouiller son défilement.
    console.log('--- Ouvre le séquenceur : toute la partie, aucun verrou ---');
    let r = await R.porteAbsente(page);
    check(r.ok, `l'ancien volet n'a plus de porte à l'ordinateur (${r.detail})`);
    r = await R.ouvrirNouveau(page);
    exiger(r.ok, `le séquenceur du bloc « Vues » s'ouvre (${r.detail})`);
    r = await R.toutePartie(page);
    check(r.ok, `il montre toute la partie, chaque accord à sa place, sans défilement de côté (${r.detail})`);
    const place = await page.evaluate(() => {
        const s = document.getElementById('sequenceur');
        return { pos: getComputedStyle(s).position, dansLeFlux: s.parentElement === document.getElementById('vues-tiroir').parentElement };
    });
    check(place.pos !== 'fixed' && place.dansLeFlux, `il est posé dans la page, pas en fenêtre par-dessus (position ${place.pos})`);
    const pendant = await verrou();
    check(!pendant.classe, `séquenceur ouvert, .body-scroll-locked n'est pas posée (overflow calculé : « ${pendant.overflow} »)`);
    r = await R.poserCroche(page, 1);
    check(r.ok, `on y pose une croche sur l'accord du milieu, Ctrl+Z la retire (${r.detail})`);

    console.log('--- Referme par son × ---');
    await R.cliquer(page, '#sq-fermer', 400);
    const apres = await page.evaluate(() => ({ verrou: document.body.classList.contains('body-scroll-locked'), cache: document.getElementById('sequenceur').hidden, presse: document.getElementById('vue-sequenceur').getAttribute('aria-pressed') }));
    check(!apres.verrou && apres.cache && apres.presse === 'false', `refermé, le séquenceur est masqué, son bouton éteint, aucun verrou (${JSON.stringify(apres)})`);

    console.log('Errors:', JSON.stringify(errors, null, 2));
    check(errors.length === 0, 'aucune erreur JavaScript pendant tout le scénario');

    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
