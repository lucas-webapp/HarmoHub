// Le zoom de la VUE AGRANDIE du séquenceur a-t-il un effet VISIBLE ? Pas seulement « la variable a
// changé » : la hauteur et la largeur réellement calculées des cases doivent suivre.
//
// CE FICHIER N'ÉTAIT PAS UN BANC. Sept blocs de mesures affichées en JSON pour UN seul verdict, écrit
// en console.log, et `process.exit(0)` à la fin : rien ne pouvait échouer. Sa première moitié visait
// en plus la vue plein écran supprimée (#grid-zoom-host, #grid-zoom-in-v, #grid-zoom-close) et il
// mourait dès la troisième ligne utile, sur un getComputedStyle(null).
//
// CE QU'IL NE FAIT PLUS, ET QUI LE FAIT À SA PLACE. Sa moitié « zoom de la grille » est devenue le
// sujet entier de classic_grid_zoom_test (crans, temps par ligne, mémorisation par appareil et par
// morceau), et les règles d'axes du séquenceur en volet sont couvertes par zoom_coherence_test. Ce qui
// n'était couvert nulle part, et reste donc ici : l'EFFET MESURÉ des deux axes dans la vue agrandie.
// Vérifier la variable seule laisserait passer un zoom qui ne se voit pas — précisément le genre de
// défaut qu'un banc doit attraper.
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
// La police est chargée depuis Google Fonts : injoignable derrière le proxy du bac à sable,
// jamais un problème chez l'utilisateur. Ces échecs réseau sont donc filtrés — sinon ils font
// échouer « aucune erreur console » et masquent les vraies erreurs au milieu du bruit.
const { check, exiger, plan, bilan } = require('./_harness')('zoom de la vue agrandie');
const R = require('./_retrait_ancien');
plan(8);

(async () => {
    const browser = await chromium.launch({
        args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (msg) => { if (msg.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|ERR_CERT_AUTHORITY_INVALID|ERR_NAME_NOT_RESOLVED|fonts\.googleapis|fonts\.gstatic/.test(msg.text())) errors.push('console.error: ' + msg.text()); });

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        const sections = [{ title: 'Couplet', chords: [
            { root: 'C', quality: 'maj', beats: 4, inversion: 0, drop: 0, octave: 4, bass: null, playStyle: 'held' },
            { root: 'A', quality: 'min7', beats: 4, inversion: 0, drop: 0, octave: 4, bass: null, playStyle: 'held' },
            { root: 'F', quality: 'maj7', beats: 4, inversion: 0, drop: 0, octave: 4, bass: null, playStyle: 'held' },
            { root: 'G', quality: '7', beats: 4, inversion: 0, drop: 0, octave: 4, bass: null, playStyle: 'held' },
        ] }];
        localStorage.setItem('myProgression', JSON.stringify({ sections }));
        // Échelles neuves : mémorisées par appareil, elles seraient sinon déjà au plafond et les crans
        // mesurés ici ne bougeraient plus — le banc accuserait le zoom au lieu de sa propre scène.
        for (const k of ['harmohubSeqZoomLevelX', 'harmohubSeqZoomLevelY']) localStorage.removeItem(k);
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(400);

    // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4b, 12/11, décision « réécriture courte ») : le petit séquenceur de l'inspecteur, sa vue agrandie (#seq-plein-ecran,
    // #seq-zoom-host) et ses zooms H / V ont quitté l'ordinateur — « pas de zoom, pas de loupe […] toute la partie tient à l'écran » ; la hauteur des lignes se règle
    // à la poignée du séquenceur (docs/refonte-sequenceur.md, section D). Ce que le banc gardait — un réglage qui SE VOIT, mesuré sur la case réellement calculée, et
    // retenu par l'appareil — est éprouvé sur le séquenceur du bloc « Vues », par de vrais gestes.
    console.log('--- Plus de petit séquenceur ni de vue agrandie ; le séquenceur du bloc Vues ---');
    const porte = await R.porteInspecteurAbsente(page, 0, 0);
    check(porte.ok, `plus de porte « Séquenceur » ni de petit séquenceur dans l'inspecteur (${porte.detail})`);
    check(await page.evaluate(() => !document.getElementById('seq-plein-ecran') && !document.getElementById('seq-zoom-overlay')), 'ni loupe, ni vue agrandie à ouvrir (A2, 13/11 : la fenêtre agrandie a quitté la page)');
    const ouvert = await R.ouvrirNouveau(page);
    exiger(ouvert.ok, `le séquenceur du bloc « Vues » s'ouvre par son bouton (${ouvert.detail})`);
    const hauteur = () => page.evaluate(() => Math.round(document.querySelector('#sq-grille .sq-case[data-r]').getBoundingClientRect().height * 10) / 10);
    const h0 = await hauteur();
    const q = await R.centre(page, '#sq-poignee');
    await page.mouse.move(q.x, q.y); await page.mouse.down(); await page.mouse.move(q.x, q.y - 60, { steps: 10 }); await page.mouse.up(); await page.waitForTimeout(400);
    const h1 = await hauteur();
    check(h1 > h0, `la poignée agrandit la hauteur CALCULÉE des lignes (remplace le zoom V) — ${h0}px → ${h1}px`);
    const tout = await R.toutePartie(page);
    check(tout.ok, `la largeur suit la place disponible, toute la partie à l'écran (remplace le zoom H) — ${tout.detail}`);
    await R.cliquer(page, '#vue-sequenceur', 400);
    await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(600);
    await R.ouvrirNouveau(page);
    const h2 = await hauteur();
    check(Math.abs(h2 - h1) <= 1, `la hauteur choisie est retenue par l'appareil, après rechargement — ${h1}px puis ${h2}px`);
    const poignee = await R.poigneeLignes(page);
    check(poignee.ok, `le double-clic sur la poignée rend la hauteur d'origine (${poignee.detail})`);

    console.log('Errors:', JSON.stringify(errors));
    check(errors.length === 0, 'aucune erreur JavaScript pendant tout le scénario');
    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
