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
plan(9);

(async () => {
    const browser = await chromium.launch({
        args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (msg) => { if (msg.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|fonts\.googleapis|fonts\.gstatic/.test(msg.text())) errors.push('console.error: ' + msg.text()); });

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
        voletVisible: !document.getElementById('seq-dock-panel').hidden,
        seqDansVolet: document.getElementById('seq-dock-host').contains(document.getElementById('arp-sequencer')),
        // Nombre de repères de temps affichés : c'est la mesure de « le volet montre-t-il vraiment
        // quelque chose ». Sans accord chargé, le séquenceur continu se réduit au début de la partie.
        reperes: document.querySelectorAll('#arp-sequencer .seq-beat-label').length,
        // Zones de navigation vers l'accord précédent/suivant : elles n'existent que si un accord est
        // en édition (voir .seq-ctx-nav dans renderSequencer).
        ctxNav: document.querySelectorAll('#arp-sequencer .seq-ctx-nav').length,
    }));

    console.log('=== Sans rien sélectionner ni éditer : ouvrir le volet ne charge aucun accord ===');
    await page.click('#grid-zoom');
    await page.waitForTimeout(600);
    const vierge = await etat();
    console.log(JSON.stringify(vierge));
    check(vierge.editingIndex == null, "sans sélection préalable, aucun accord n'est chargé (comportement inchangé)");
    check(vierge.seqOpen === true && vierge.seqMode === 'continu', 'le volet est bien ouvert en mode continu');
    check(vierge.voletVisible && vierge.seqDansVolet, 'le volet affiche bien le VRAI #arp-sequencer (déplacé, pas dupliqué)');
    await page.click('#grid-zoom');
    await page.waitForTimeout(400);
    const ferme = await etat();
    check(ferme.seqOpen === false && !ferme.voletVisible, 'un second clic sur le même bouton referme le volet');

    console.log('=== VRAI simple clic (pas « Modifier ») sur l\'accord d\'index 2, puis ouverture du volet ===');
    await page.click('.grid-cell[data-index="2"]', { position: { x: 40, y: 40 } });
    await page.waitForTimeout(400);
    const apresClic = await etat();
    console.log('après le clic simple :', JSON.stringify(apresClic));
    if (!exiger(apresClic.selectedIndex === 2 && apresClic.editingIndex == null,
        'le simple clic SÉLECTIONNE l\'accord 2 sans le passer en édition (la scène est bien celle du scénario)')) {
        console.log('Scène impossible à monter, on ne peut rien conclure de la suite.');
        bilan();
    }

    await page.click('#grid-zoom');
    await page.waitForTimeout(800);
    const apresOuverture = await etat();
    console.log('après ouverture du volet :', JSON.stringify(apresOuverture));
    check(apresOuverture.editingIndex === 2,
        "l'accord SÉLECTIONNÉ (index 2, sans passer par « Modifier ») est bien chargé pour édition dès l'ouverture du volet");
    check(apresOuverture.ctxNav > 0,
        `le volet montre les zones de navigation vers les accords voisins — donc il montre bien un accord (${apresOuverture.ctxNav})`);
    check(apresOuverture.reperes > vierge.reperes,
        `le volet affiche plus de temps qu'à vide, il ne s'ouvre plus sur du néant (${vierge.reperes} -> ${apresOuverture.reperes} repères)`);

    console.log('=== Un accord DÉJÀ en édition n\'est pas remplacé par la sélection ===');
    await page.click('#grid-zoom'); await page.waitForTimeout(300);   // referme
    await page.evaluate(() => window.app.editChord(0, 1));            // édite l'accord 1
    await page.waitForTimeout(300);
    await page.click('#grid-zoom'); await page.waitForTimeout(700);   // rouvre
    const dejaEnEdition = await etat();
    console.log(JSON.stringify(dejaEnEdition));
    check(dejaEnEdition.editingIndex === 1,
        "l'accord déjà en édition reste celui affiché, la sélection ne le supplante pas");

    console.log('Errors:', JSON.stringify(errors));
    check(errors.length === 0, 'aucune erreur JavaScript pendant tout le scénario');
    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
