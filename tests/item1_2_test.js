const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
const R = require('./_retrait_ancien');
// La police est chargée depuis Google Fonts : injoignable derrière le proxy du bac à sable,
// jamais un problème chez l'utilisateur. Ces échecs réseau sont donc filtrés — sinon ils font
// échouer « aucune erreur console » et masquent les vraies erreurs au milieu du bruit.

(async () => {
    const browser = await chromium.launch({
        args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const page = await browser.newPage({ deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (msg) => { if (msg.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|ERR_CERT_AUTHORITY_INVALID|ERR_NAME_NOT_RESOLVED|fonts\.googleapis|fonts\.gstatic/.test(msg.text())) errors.push('console.error: ' + msg.text()); });

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        const sections = [{ title: 'Couplet', chords: [
            { root: 'C', quality: 'maj7', beats: 16, inversion: 0, drop: 0, octave: 4, bass: null, playStyle: 'held' },
        ]}];
        localStorage.setItem('myProgression', JSON.stringify({ sections }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);

    // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4b, 12/11, décision « réécriture courte ») : le petit séquenceur de l'inspecteur, ses boutons de zoom horizontal
    // (#seq-zoom-in-h-inline / #seq-zoom-out-h-inline) et sa loupe ont quitté l'ordinateur — « pas de zoom, pas de loupe : toute la partie tient à l'écran » (cahier,
    // section D). L'item 1 vérifie désormais que la porte a disparu de l'inspecteur ET que le séquenceur du bloc « Vues » montre toute la partie sans zoom.
    console.log('--- Item 1: plus de petit séquenceur ni de zoom H ; le séquenceur du bloc Vues montre toute la partie ---');
    let r = await R.porteInspecteurAbsente(page, 0, 0);
    console.log((r.ok ? 'PASS' : 'FAIL') + ' - plus de porte « Séquenceur » ni de petit séquenceur dans l\'inspecteur (' + r.detail + ')');
    r = await R.ouvrirNouveau(page);
    console.log((r.ok ? 'PASS' : 'FAIL') + ' - le séquenceur du bloc « Vues » s\'ouvre par son bouton (' + r.detail + ')');
    r = await R.toutePartie(page);
    console.log((r.ok ? 'PASS' : 'FAIL') + ' - toute la partie à l\'écran, sans zoom ni défilement de côté (' + r.detail + ')');
    await R.cliquer(page, '#vue-sequenceur', 400); // refermé pour la suite

    // CONTRAT PÉRIMÉ : comparait la hauteur du triangle de #play (« Accord ») à celle de #play-prog
    // (« Grille ») — #play a disparu (retour utilisateur : « un seul bouton lecture pour toute la
    // grille, le bouton lecture accord ne sert pas à grand chose », voir global_transport_test.js) et
    // faisait planter ce test (getBBox() sur un sélecteur devenu introuvable). Il ne reste qu'un seul
    // triangle : on vérifie juste qu'il se dessine toujours avec une hauteur cohérente.
    console.log('--- Item 2: le triangle du bouton Lecture (seul restant) se dessine correctement ---');
    r = await page.evaluate(() => {
        const path = document.querySelector('#play-prog svg path');
        return { height: path ? path.getBBox().height : null };
    });
    console.log(JSON.stringify(r));
    console.log((r.height > 0) ? 'PASS (icône affichée)' : 'FAIL');

    // L'ÉTAT « BOUCLE » NE SE DIT PLUS PAR LA COULEUR D'UN BOUTON À PART. Ce point éprouvait le bleu
    // de #toggle-loop-section, retiré : la boucle est devenue un état du bouton Lecture, qui échange
    // son triangle contre un anneau fléché (façon Pro Tools). Le banc éprouve donc la même chose —
    // « l'état se voit » — à l'endroit où elle se voit maintenant, et sur le DESSIN plutôt que sur
    // une teinte, qui ne disait de toute façon pas ce qui allait être bouclé.
    console.log('--- Item 2: l\'état boucle se voit sur le bouton Lecture lui-même ---');
    r = await page.evaluate(() => {
        window.app.basculerBoucle(true);
        const b = document.getElementById('play-prog');
        const simple = document.querySelector('#play-prog .transport-icon-simple');
        const anneau = document.querySelector('#play-prog .transport-icon-boucle');
        return {
            classe: b.classList.contains('boucle-active'),
            simpleVisible: getComputedStyle(simple).display !== 'none',
            anneauVisible: getComputedStyle(anneau).display !== 'none',
            boucleBtn: document.getElementById('boucle-btn').getAttribute('aria-pressed'),
        };
    });
    console.log(JSON.stringify(r));
    // REFONTE, LOT 2 : sur ordinateur, la boucle a son bouton dans la barre de lecture du bas ; le triangle de Lecture reste un
    // triangle (l'anneau est réservé au téléphone — voir transport_boucle_test, section E). « L'état se voit » : ici, sur Boucle.
    console.log((r.classe && r.boucleBtn === 'true' && r.simpleVisible && !r.anneauVisible) ? 'PASS (le bouton Boucle s\'allume, le triangle reste)' : 'FAIL');

    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
