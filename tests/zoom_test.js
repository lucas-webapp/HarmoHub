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
plan(8);

(async () => {
    const browser = await chromium.launch({
        args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (msg) => { if (msg.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|fonts\.googleapis|fonts\.gstatic/.test(msg.text())) errors.push('console.error: ' + msg.text()); });

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

    console.log('--- Ouvre la vue agrandie du séquenceur sur le 1er accord ---');
    await page.evaluate(() => { window.app.editChord(0, 0); if (!window.app.seqOpen) window.app.toggleSequencer(); });
    await page.waitForTimeout(300);
    await page.click('#seq-zoom');
    await page.waitForTimeout(600);

    // On mesure la case RÉELLEMENT calculée, pas la variable : c'est ce que voit l'utilisateur.
    const mesure = () => page.evaluate(() => {
        const cell = document.querySelector('#seq-zoom-host .seq-cell');
        if (!cell) return null;
        const r = cell.getBoundingClientRect();
        return {
            hauteur: Math.round(r.height * 10) / 10,
            largeur: Math.round(r.width * 10) / 10,
            x: window.app.seqZoomLevelX,
            y: window.app.seqZoomLevelY,
        };
    });

    const depart = await mesure();
    console.log('départ :', JSON.stringify(depart));
    if (!exiger(depart && depart.hauteur > 0 && depart.largeur > 0,
        `la vue agrandie est ouverte et ses cases sont mesurables — ${JSON.stringify(depart)}`)) bilan();
    check(depart.x === 1 && depart.y === 1, `les deux échelles partent bien de 1 — ${depart.x}/${depart.y}`);

    console.log('--- V+ trois fois : la HAUTEUR de case doit grandir pour de vrai ---');
    for (let i = 0; i < 3; i++) await page.click('#seq-zoom-in-v');
    await page.waitForTimeout(400);
    const apresV = await mesure();
    console.log(JSON.stringify(apresV));
    check(apresV.y > depart.y, `l'échelle verticale a augmenté (${depart.y} -> ${apresV.y})`);
    check(apresV.hauteur > depart.hauteur,
        `et la hauteur CALCULÉE de la case a suivi — ${depart.hauteur}px -> ${apresV.hauteur}px (un zoom qui ne se voit pas serait un défaut)`);

    console.log('--- H+ trois fois : la LARGEUR de case doit grandir, la hauteur rester où elle est ---');
    for (let i = 0; i < 3; i++) await page.click('#seq-zoom-in-h');
    await page.waitForTimeout(400);
    const apresH = await mesure();
    console.log(JSON.stringify(apresH));
    check(apresH.x > depart.x, `l'échelle horizontale a augmenté (${depart.x} -> ${apresH.x})`);
    check(apresH.largeur > depart.largeur,
        `et la largeur CALCULÉE de la case a suivi — ${depart.largeur}px -> ${apresH.largeur}px`);
    check(Math.abs(apresH.hauteur - apresV.hauteur) <= 1,
        `le zoom horizontal n'a pas touché à la hauteur (${apresV.hauteur}px -> ${apresH.hauteur}px) : les deux axes restent indépendants`);

    console.log('--- Les échelles de la vue agrandie sont bien mémorisées sur l\'appareil ---');
    const memorise = await page.evaluate(() => ({
        sx: parseFloat(localStorage.getItem('harmohubSeqZoomLevelX')),
        sy: parseFloat(localStorage.getItem('harmohubSeqZoomLevelY')),
    }));
    console.log(JSON.stringify(memorise));
    check(memorise.sx === apresH.x && memorise.sy === apresH.y,
        `les deux échelles sont écrites en mémoire locale — ${memorise.sx}/${memorise.sy}`);

    console.log('Errors:', JSON.stringify(errors));
    check(errors.length === 0, 'aucune erreur JavaScript pendant tout le scénario');
    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
