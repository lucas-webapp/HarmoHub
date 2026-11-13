// RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4a, 12/11) : le séquenceur est désormais celui du bloc « Vues » (voir le corps du banc).
// Ouvrir le VOLET du séquenceur continu (bouton #grid-zoom, au-dessus de la grille) doit charger
// l'accord déjà SÉLECTIONNÉ, sans obliger à le recliquer une seconde fois.
//
// Ce banc visait l'ancienne vue plein écran (app.openGridZoom/closeGridZoom, supprimées). Il mourait
// donc à la mise en place, avant sa première assertion — et pendant ce temps le comportement qu'il
// gardait, lui, avait bel et bien disparu de l'appli : le volet s'ouvrait sur du vide. Rebranché sur
// le vrai bouton, il a rougi aussitôt, et c'est en le réparant qu'on a remis le chargement de
// l'accord sélectionné dans toggleSequencer(). Un banc qui échoue à sa mise en place ne protège rien.
//
// Le scénario passe par un VRAI clic sur la case, pas par `app.selectedIndex = 2` : affecter l'état
// directement laisse la grille non redessinée (la case n'a même pas la classe .selected) et la scène
// ne ressemble alors à rien de ce que fait l'utilisateur.
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
// La police est chargée depuis Google Fonts : injoignable derrière le proxy du bac à sable,
// jamais un problème chez l'utilisateur. Ces échecs réseau sont donc filtrés — sinon ils font
// échouer « aucune erreur console » et masquent les vraies erreurs au milieu du bruit.
const { check, exiger, plan, bilan } = require('./_harness')('ouverture sur l\'accord sélectionné');
plan(8);

(async () => {
    const browser = await chromium.launch({
        args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (msg) => { if (msg.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|ERR_CERT_AUTHORITY_INVALID|ERR_NAME_NOT_RESOLVED|fonts\.googleapis|fonts\.gstatic/.test(msg.text())) errors.push('console.error: ' + msg.text()); });

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [
            { root: 'C', quality: 'maj', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
            { root: 'D', quality: 'min', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
            { root: 'E', quality: 'min', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
        ] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(400);

    const etat = () => page.evaluate(() => ({
        editingIndex: window.app.editingIndex,
        selectedIndex: window.app.selectedIndex,
        seqOpen: window.app.seqOpen,
        seqMode: window.app.seqMode,
        // A2 (13/11) : le volet d'avant (#seq-dock-panel) et le séquenceur d'avant (#arp-sequencer) ne sont plus dans la page.
        voletVisible: !!document.getElementById('seq-dock-panel'),
        seqDansVolet: !!document.getElementById('arp-sequencer'),
        reperes: 0,
        ctxNav: 0,
    }));

    // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4a, 12/11) : le volet d'avant (« Éditeur de notes ») a quitté l'ordinateur. L'ENJEU RESTE — le séquenceur ne doit
    // jamais s'ouvrir « sur du vide » ni sur un autre accord que celui qu'on a choisi — et vaut pour le séquenceur du bloc « Vues », qui montre la partie et
    // CHOISIT l'accord sélectionné (sans le mettre en édition).
    const R = require('./_retrait_ancien');
    const sq = () => page.evaluate(() => { const n = document.querySelector('#sq-grille .sq-nom.choisi'); return { ouvert: !document.getElementById('sequenceur').hidden, choisi: n ? +n.dataset.c : null, noms: document.querySelectorAll('#sq-grille .sq-nom').length, cases: document.querySelectorAll('#sq-grille .sq-case[data-r]').length, editingIndex: window.app.editingIndex, selectedIndex: window.app.selectedIndex }; });
    console.log('=== Sans rien sélectionner : le séquenceur s\'ouvre sur la partie, premier accord choisi ===');
    const porte = await R.porteAbsente(page);
    check(porte.ok, `l'ancien volet n'a plus de porte (${porte.detail})`);
    await R.ouvrirNouveau(page);
    const vierge = await sq();
    console.log(JSON.stringify(vierge));
    const nb = await page.evaluate(() => loadProgressionSections()[0].chords.length);
    check(vierge.ouvert && vierge.noms === nb && vierge.cases > 0 && vierge.choisi === 0, `il montre toute la partie, le premier accord choisi, jamais du vide (${JSON.stringify(vierge)})`);
    check(vierge.editingIndex == null, "aucun accord n'est chargé en édition");
    await R.cliquer(page, '#vue-sequenceur', 400);
    check(!(await sq()).ouvert, 'un second clic sur le même bouton le referme');

    console.log('=== VRAI simple clic sur l\'accord d\'index 2, puis ouverture ===');
    await page.click('.grid-cell[data-index="2"]', { position: { x: 40, y: 40 } });
    await page.waitForTimeout(400);
    const apresClic = await etat();
    if (!exiger(apresClic.selectedIndex === 2 && apresClic.editingIndex == null,
        'le simple clic SÉLECTIONNE l\'accord 2 sans le passer en édition (la scène est bien celle du scénario)')) bilan();
    await R.ouvrirNouveau(page);
    const apresOuverture = await sq();
    console.log('après ouverture :', JSON.stringify(apresOuverture));
    check(apresOuverture.choisi === 2, `l'accord SÉLECTIONNÉ (index 2) est celui que le séquenceur choisit dès l'ouverture (${apresOuverture.choisi})`);

    // Le séquenceur règle le rythme de l'accord SÉLECTIONNÉ dans la grille (ce que montre le cadre bleu), même si un autre est ouvert dans l'inspecteur.
    console.log('=== Un accord en édition pendant qu\'un autre est sélectionné ===');
    await R.cliquer(page, '#sq-fermer', 300);
    await page.evaluate(() => window.app.editChord(0, 1));
    await page.waitForTimeout(300);
    await R.ouvrirNouveau(page);
    const dejaEnEdition = await sq();
    console.log(JSON.stringify(dejaEnEdition));
    check(dejaEnEdition.choisi === dejaEnEdition.selectedIndex && dejaEnEdition.editingIndex === 1, `le séquenceur suit la sélection de la grille (${dejaEnEdition.choisi} = ${dejaEnEdition.selectedIndex}), l'accord 1 reste en édition`);

    console.log('Errors:', JSON.stringify(errors));
    check(errors.length === 0, 'aucune erreur JavaScript pendant tout le scénario');
    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
