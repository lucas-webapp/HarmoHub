const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// La police est chargée depuis Google Fonts : injoignable derrière le proxy du bac à sable,
// jamais un problème chez l'utilisateur. Ces échecs réseau sont donc filtrés — sinon ils font
// échouer « aucune erreur console » et masquent les vraies erreurs au milieu du bruit.

(async () => {
    const browser = await chromium.launch({
        args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (msg) => { if (msg.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|ERR_CERT_AUTHORITY_INVALID|ERR_NAME_NOT_RESOLVED|fonts\.googleapis|fonts\.gstatic/.test(msg.text())) errors.push('console.error: ' + msg.text()); });

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    // Une grille avec au moins un accord : le bouton Lecture unique appelle désormais TOUJOURS
    // playProgression() (voir plus bas), qui sort tôt sans rien jouer sur une grille vide
    // (`if (flat.length === 0) return;`) — contrairement à l'ancien bouton « Accord », qui retombait
    // sur playCurrent() (l'état du panneau, sans besoin d'accord dans la grille) et tolérait donc
    // une grille vide. Ce test n'en semait pas avant : ça suffisait tant qu'un des deux boutons ne
    // dépendait pas de la grille — plus vrai maintenant qu'il n'en reste qu'un seul.
    await page.evaluate(() => {
        const mk = (root, quality) => ({ root, quality, beats: 4, inversion: 0, drop: 0, octave: 4, bass: null, playStyle: 'held' });
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [mk('C', 'maj'), mk('A', 'min7')] }] }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);

    // LOT 6c : CONTRAT CHANGÉ. Le bandeau de gauche n'existe plus sur ordinateur — ni lui ni son bouton de repli. La place qu'il libérait, la grille
    // l'a désormais TOUJOURS ; le seul panneau latéral est l'inspecteur « son de l'accord », à droite, ouvert avec un accord et fermé par sa croix.
    // Ce que ce banc protégeait reste vrai, avec ce geste-là : la grille regagne sa place, le transport ne bouge pas, la lecture marche, et rien
    // ne reste « replié » au rechargement.
    const ouvrirInspecteur = async (i) => {
        await page.click(`#progression-sections .grid-cell[data-index="${i}"]`); await page.waitForTimeout(300);
        await page.click('#bulle-accord [data-bulle="son"]'); await page.waitForTimeout(400);
    };
    console.log('--- Au départ : plus de bandeau, la grille a toute la place ---');
    let r = await page.evaluate(() => ({
        cadre: document.querySelector('.sidebar-frame').getBoundingClientRect().width,
        repli: (() => { const b = document.getElementById('toggle-sidebar'); return b ? b.getBoundingClientRect().width : 0; })(),
    }));
    console.log(JSON.stringify(r));
    console.log((r.cadre === 0 && r.repli === 0) ? 'PASS (ni bandeau ni bouton de repli sur ordinateur)' : 'FAIL');

    // Refonte du séquenceur (point C) : l'inspecteur FLOTTE au bord droit, la grille ne se resserre plus (« il recadre l'écran à chaque fois »).
    console.log('--- Un accord ouvert : l\'inspecteur flotte à droite, la grille garde sa place ---');
    const largeAvant = await page.evaluate(() => document.querySelector('.col-right').getBoundingClientRect().width);
    await ouvrirInspecteur(0);
    r = await page.evaluate(() => ({
        inspecteur: document.querySelector('.sidebar-frame').getBoundingClientRect(),
        colRight: document.querySelector('.col-right').getBoundingClientRect(),
    }));
    console.log(JSON.stringify({ i: Math.round(r.inspecteur.width), c: Math.round(r.colRight.width) }));
    console.log((r.inspecteur.width === 344 && r.inspecteur.right <= r.colRight.right + 1 && r.inspecteur.left > r.colRight.left && Math.abs(r.colRight.width - largeAvant) <= 1) ? 'PASS (inspecteur à droite, grille à sa largeur)' : 'FAIL');

    // REFONTE, LOT 2 : le transport vit dans la BARRE DE LECTURE du bas (#bl-lecture), qui ne dépend d'aucun panneau — c'était le risque que ce banc
    // surveillait (un panneau qui emporte le transport avec lui). On éprouve donc toujours le résultat : transport affiché, entier, hors du panneau.
    console.log('--- Le transport (barre du bas) ne bouge pas quand l\'inspecteur s\'ouvre, et reste visible ---');
    r = await page.evaluate(() => {
        const t = document.querySelector('.transport');
        const rect = t.getBoundingClientRect();
        return {
            dansLeDock: t.parentElement.id === 'bl-lecture',
            horsPanneau: !document.querySelector('.col-left').contains(t),
            visible: getComputedStyle(t).display !== 'none' && rect.width > 0 && rect.height > 0,
            dansEcran: rect.left >= 0 && rect.top >= 0 && rect.right <= window.innerWidth && rect.bottom <= window.innerHeight,
        };
    });
    console.log(JSON.stringify(r));
    console.log((r.dansLeDock && r.horsPanneau && r.visible && r.dansEcran)
        ? 'PASS (transport toujours visible et entier, inspecteur ouvert)' : 'FAIL');

    console.log('--- Le bouton Lecture fonctionne toujours, inspecteur ouvert ---');
    await page.click('#play-prog');
    await page.waitForTimeout(200);
    r = await page.evaluate(() => ({ isPlaying: window.app.isPlaying }));
    console.log(JSON.stringify(r));
    console.log(r.isPlaying ? 'PASS (la lecture marche, inspecteur ouvert)' : 'FAIL');
    await page.evaluate(() => window.app.stopAll());
    // Laisse le temps au nettoyage audio (Tone.Transport/contexte) de vraiment se terminer avant de
    // recharger — mesuré : recharger juste après stopAll() peut planter la page dans ce bac à sable
    // (reproductible même sans aucun changement du jour, un défaut préexistant de l'environnement,
    // pas de l'appli), le contexte audio semblant parfois encore en cours de désallocation.
    await page.waitForTimeout(300);

    console.log('--- La croix le ferme : la grille reprend toute sa place ---');
    await page.click('#accord-close');
    await page.waitForTimeout(300);
    r = await page.evaluate(() => ({ cadre: document.querySelector('.sidebar-frame').getBoundingClientRect().width, colRight: document.querySelector('.col-right').getBoundingClientRect().width }));
    console.log(JSON.stringify(r));
    console.log((r.cadre === 0 && Math.abs(r.colRight - largeAvant) <= 1) ? 'PASS (inspecteur fermé, grille à sa largeur d\'origine)' : 'FAIL');

    console.log('--- Au rechargement, rien ne reste ouvert ---');
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(300);
    r = await page.evaluate(() => ({ cadre: document.querySelector('.sidebar-frame').getBoundingClientRect().width, edition: window.app.editingIndex }));
    console.log(JSON.stringify(r));
    console.log((r.cadre === 0 && r.edition == null) ? 'PASS (rechargé sans panneau : l\'inspecteur ne se mémorise pas, il suit l\'accord ouvert)' : 'FAIL');

    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
