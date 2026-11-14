// LES NOMS DES NOTES SUR LE MANCHE VIDE DE DESSIN (L8, fin, 14/11), avec de vrais gestes.
//
// CE QUE DEMANDE L'UTILISATEUR (13/11, « toutes tes idées sont bonnes ») : « Nom des notes en petit sur les diagrammes ET sur le manche vide de dessin (case à cocher dans les Paramètres),
// dièses/bémols selon la tonalité. » Les pastilles des diagrammes l'ont depuis le 14/11 (banc `vignettes_guitare`) ; ce banc tient l'autre moitié : le manche de la fenêtre « Dessiner ».
//
// CE QUE LE BANC TIENT : éteint par défaut ; l'interrupteur de Paramètres › Affichage l'allume (mémorisé par appareil) ; le manche de 24 cases écrit un nom sur CHAQUE case libre (6 × 25 avec
// les cordes à vide), dièses dans une tonalité à dièses, bémols dans une tonalité à bémols ; une note posée ou survolée remplace le nom de sa case ; les noms ne reçoivent aucun clic ; ils
// ne passent ni sur les diagrammes du tiroir ni ailleurs ; éteint, ils disparaissent ; le téléphone n'a pas bougé (rien d'écrit tant que le réglage est éteint).
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('noms des notes du manche de dessin');
const { estBruitReseau } = require('./_harness');

plan(27);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const graine = () => {
    const mk = (r, q, bass = null) => ({ root: r, quality: q, beats: 4, inversion: 0, drop: 'none', octave: 3, bass, playStyle: 'held' });
    const S = [{ title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7'), mk('D', 'min7'), mk('G', 'dom7')] }];
    localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), sections: S }]));
    localStorage.setItem('harmohubCurrentSongId', 's1');
    localStorage.setItem('myProgression', JSON.stringify({ sections: S }));
    sessionStorage.setItem('cc_accueil_vu', '1');
};

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    const ouvrir = async (viewport) => {
        const p = await nav.newPage({ viewport });
        p.on('pageerror', e => erreurs.push(e.message));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) erreurs.push('console: ' + m.text()); });
        await p.goto(`${BASE}/index.html`);
        await p.evaluate(graine);
        await p.reload();
        await p.waitForTimeout(900);
        return p;
    };
    // Les noms écrits sur le manche, dans l'ordre du dessin : corde 0 (Mi grave) à 5, case 0 à 24 pour chacune.
    const noms = (p) => p.evaluate(() => [...document.querySelectorAll('#guitar-edit-neck svg .guitar-neck-nom')].map(t => t.textContent));
    const ouvrirDessin = async (p) => {
        if ((await p.getAttribute('#toggle-viz-guitar', 'aria-pressed')) !== 'true') await p.click('#toggle-viz-guitar', { force: true });
        await p.waitForTimeout(250);
        await p.click('#guitar-edit-btn', { force: true });
        await p.waitForTimeout(250);
        await p.click('#guitar-edit-tab-draw');
        await p.waitForTimeout(250);
    };
    const fermerDessin = async (p) => { await p.click('#guitar-edit-close'); await p.waitForTimeout(250); };
    const ouvrirReglages = async (p) => { await p.click('#open-settings'); await p.waitForTimeout(400); };
    const fermerReglages = async (p) => { await p.click('#settings-close'); await p.waitForTimeout(250); };
    // Centre de la case (corde s, case f) à l'écran, d'après le rectangle RÉEL du <svg> (même géométrie que guitarDrawPositionAt).
    const centre = (p, s, f) => p.evaluate(([s, f]) => {
        const r = document.querySelector('#guitar-edit-neck svg').getBoundingClientRect(), vb = document.querySelector('#guitar-edit-neck svg').viewBox.baseVal;
        const k = r.width / vb.width;
        return { x: r.left + (f === 0 ? 11 : 20 + (f - 0.5) * 30) * k, y: r.top + (8 + (5 - s) * 16) * k };
    }, [s, f]);
    const clic = async (p, s, f) => { const c = await centre(p, s, f); await p.mouse.move(c.x, c.y); await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(200); };

    // ======================================================================================================
    console.log('\n=== A. Éteint par défaut ===');
    const p = await ouvrir({ width: 1440, height: 900 });
    await ouvrirReglages(p);
    exiger(await p.locator('#toggle-neck-note-names').count() === 1, 'Paramètres › Affichage a l\'interrupteur « Notes du manche de dessin »');
    check(await p.getAttribute('#toggle-neck-note-names', 'aria-checked') === 'false', 'éteint par défaut');
    await fermerReglages(p);
    await ouvrirDessin(p);
    check((await noms(p)).length === 0, 'manche vide de dessin : aucun nom écrit tant que le réglage est éteint');
    await fermerDessin(p);

    // ======================================================================================================
    console.log('\n=== B. L\'interrupteur l\'allume : un nom par case libre ===');
    await ouvrirReglages(p);
    await p.click('#toggle-neck-note-names'); await p.waitForTimeout(250);
    check(await p.getAttribute('#toggle-neck-note-names', 'aria-checked') === 'true' && await p.evaluate(() => localStorage.getItem('harmohubNomsMancheDessin')) === '1', 'allumé : l\'interrupteur se marque et se mémorise');
    await fermerReglages(p);
    await ouvrirDessin(p);
    let n = await noms(p);
    const cerclesAllume = await p.evaluate(() => document.querySelectorAll('#guitar-edit-neck svg circle').length);
    check(n.length === 150, `un nom sur chaque case du manche : 6 cordes × 25 (cordes à vide comprises) = ${n.length}`);
    check(n[0] === 'E' && n[5 * 25] === 'E' && n[1 * 25 + 3] === 'C' && n[0 * 25 + 12] === 'E', `les noms sont justes : Mi grave à vide = E, Mi aigu à vide = E, la case 3 de la corde de La = C, case 12 = E à l'octave (${n[0]} ${n[125]} ${n[28]} ${n[12]})`);
    check(n[0 * 25 + 2] === 'F#' && n[0 * 25 + 1] === 'F', `en do majeur (dièses) : F puis F# sur la corde grave (${n[1]} ${n[2]})`);
    check(await p.evaluate(() => document.getElementById('guitar-viz') && document.querySelectorAll('#guitar-viz .guitar-neck-nom, .viz-diagrams .guitar-neck-nom').length === 0), 'les diagrammes du tiroir n\'ont pas ces noms (ils ont leurs pastilles)');

    // ======================================================================================================
    console.log('\n=== C. Une note posée ou survolée remplace le nom de sa case ===');
    // Par petits pas, comme une main : d'un seul saut, le navigateur ne signale pas la sortie (le dessin du manche remplace le nœud sous le pointeur).
    const ecarter = async () => { await p.mouse.move(720, 150, { steps: 10 }); await p.waitForTimeout(250); };
    await clic(p, 0, 2);
    exiger(await p.evaluate(() => window.app.guitarDrawShape[0]) === 2, 'un vrai clic sur une case posée par-dessus un nom la prend : la note est posée (le nom ne reçoit pas le clic)');
    await ecarter();
    n = await noms(p);
    check(n.length === 149, `la case tenue ne porte plus son nom, pointeur écarté : 149 noms (${n.length})`);
    await clic(p, 0, 2);
    exiger(await p.evaluate(() => window.app.guitarDrawShape[0]) === null, 'recliquer la même case retire la note');
    await ecarter();
    n = await noms(p);
    check(n.length === 150, `et son nom revient, pointeur écarté : 150 (${n.length})`);
    const c = await centre(p, 1, 5);
    await p.mouse.move(c.x, c.y, { steps: 8 }); await p.waitForTimeout(250);
    check((await noms(p)).length === 149, 'la case survolée montre l\'aperçu de la note à la place du nom (149)');
    await ecarter();
    n = await noms(p);
    check(n.length === 150, `le pointeur part : le nom de la case survolée est revenu (150 : ${n.length}, survol ${JSON.stringify(await p.evaluate(() => window.app.guitarDrawHoverPos))})`);
    check(await p.evaluate(() => { const t = document.querySelector('#guitar-edit-neck svg .guitar-neck-nom'); const cs = getComputedStyle(t); return cs.pointerEvents === 'none' && parseFloat(cs.fontSize) < 10; }), 'les noms sont petits (moins de 10 px) et ne reçoivent aucun clic');
    await fermerDessin(p);

    // ======================================================================================================
    console.log('\n=== D. Dièses ou bémols selon la tonalité ===');
    const tonalite = () => p.evaluate(() => document.getElementById('global-root').value);
    const transposer = async (sens, fois) => { for (let i = 0; i < fois; i++) { await p.click(sens); await p.waitForTimeout(150); } await p.waitForTimeout(300); };
    await transposer('#rr-transposer-haut', 5);
    exiger(await tonalite() === 'F', `la tonalité du morceau est F après cinq demi-tons vers le haut (${await tonalite()})`);
    await ouvrirDessin(p);
    n = await noms(p);
    check(n[0 * 25 + 2] === 'G♭' && n[0 * 25 + 1] === 'F' && n[1 * 25 + 1] === 'B♭', `en fa majeur (bémols) : G♭ sur la corde grave case 2, B♭ sur la corde de La case 1 (${n[2]} ${n[26]})`);
    check(!n.some(x => x.includes('#')), 'aucun dièse écrit dans une tonalité à bémols');
    await fermerDessin(p);
    await transposer('#rr-transposer-haut', 4);
    exiger(await tonalite() === 'A', `puis A après quatre de plus (${await tonalite()})`);
    await ouvrirDessin(p);
    n = await noms(p);
    check(n[0 * 25 + 2] === 'F#' && !n.some(x => x.includes('♭')), `en la majeur (dièses) : F# et aucun bémol (${n[2]})`);
    await fermerDessin(p);

    // ======================================================================================================
    console.log('\n=== E. Éteint, les noms disparaissent ===');
    await ouvrirReglages(p);
    await p.click('#toggle-neck-note-names'); await p.waitForTimeout(250);
    check(await p.getAttribute('#toggle-neck-note-names', 'aria-checked') === 'false' && await p.evaluate(() => localStorage.getItem('harmohubNomsMancheDessin')) === '0', 'éteint : l\'interrupteur se marque et se mémorise');
    await fermerReglages(p);
    await ouvrirDessin(p);
    check((await noms(p)).length === 0, 'plus aucun nom sur le manche vide');
    check(await p.evaluate(() => document.querySelectorAll('#guitar-edit-neck svg circle').length) === cerclesAllume, `et le réglage n'ajoute aucune pastille : le manche garde ses ${cerclesAllume} repères (cases 3, 5, 7…) allumé comme éteint`);
    await fermerDessin(p);
    await p.close();

    // ======================================================================================================
    console.log('\n=== F. Téléphone : rien n\'a bougé tant que le réglage est éteint ===');
    const t = await ouvrir({ width: 390, height: 844 });
    await ouvrirDessin(t);
    exiger(await t.locator('#guitar-edit-neck svg').count() === 1, 'téléphone : l\'éditeur du manche s\'ouvre sur l\'onglet « Dessiner »');
    check((await noms(t)).length === 0, 'téléphone : le manche de dessin s\'affiche sans aucun nom (réglage éteint)');
    await fermerDessin(t);
    await ouvrirReglages(t);
    await t.click('#toggle-neck-note-names'); await t.waitForTimeout(250);
    await fermerReglages(t);
    await ouvrirDessin(t);
    check((await noms(t)).length === 150, 'téléphone : allumé dans Paramètres, le même manche écrit les mêmes 150 noms (le réglage est partagé)');
    await t.close();

    check(erreurs.length === 0, `aucune erreur de page ni de console${erreurs.length ? ' : ' + erreurs.slice(0, 3).join(' | ') : ''}`);
    await nav.close();
    bilan();
})().catch(e => { console.log('FATAL', e); process.exit(1); });
