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
    page.on('console', (msg) => { if (msg.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|fonts\.googleapis|fonts\.gstatic/.test(msg.text())) errors.push('console.error: ' + msg.text()); });

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

    console.log('--- Baseline: sidebar visible ---');
    let r = await page.evaluate(() => ({
        collapsed: document.body.classList.contains('sidebar-collapsed'),
        colLeftVisible: document.querySelector('.col-left').getBoundingClientRect().width > 0,
    }));
    console.log(JSON.stringify(r));
    console.log((!r.collapsed && r.colLeftVisible) ? 'PASS (sidebar visible by default)' : 'FAIL');

    console.log('--- Click toggle: sidebar hides, col-right expands ---');
    const rightWidthBefore = await page.evaluate(() => document.querySelector('.col-right').getBoundingClientRect().width);
    await page.click('#toggle-sidebar');
    await page.waitForTimeout(150);
    r = await page.evaluate(() => ({
        collapsed: document.body.classList.contains('sidebar-collapsed'),
        colLeftWidth: document.querySelector('.col-left').getBoundingClientRect().width,
        colRightWidth: document.querySelector('.col-right').getBoundingClientRect().width,
        ariaPressed: document.getElementById('toggle-sidebar').getAttribute('aria-pressed'),
        active: document.getElementById('toggle-sidebar').classList.contains('active'),
    }));
    console.log(JSON.stringify(r));
    console.log((r.collapsed && r.colLeftWidth === 0 && r.colRightWidth > rightWidthBefore && r.ariaPressed === 'true' && r.active)
        ? 'PASS (sidebar hidden, col-right expanded, button reflects state)' : 'FAIL');

    // LE TRANSPORT EST REVENU DANS LE VOLET DE GAUCHE, et ce banc visait encore l'en-tête de la
    // grille. Retour utilisateur : « remets-les en bas du volet à gauche, mais juste sous le module
    // (sous la barre intensité, mais en dehors du module) », puis « les boutons de transport doivent
    // rester ancrés ». Il vit donc dans #footer-dock (voir placeGlobalTransport), et
    // #grid-head-transport-host n'est plus qu'un point d'ancrage vide — l'éprouver revenait à exiger
    // que le transport soit là où l'on a justement demandé qu'il ne soit plus.
    // Ce qui compte, et que ce banc protège vraiment : replier le volet ne doit pas emporter le
    // transport avec lui. #footer-dock migre alors vers .col-right (voir applySidebarCollapsed), donc
    // on éprouve le RÉSULTAT — toujours affiché, toujours entièrement dans l'écran.
    console.log('--- Le transport suit le dock hors du volet replié, et reste visible ---');
    r = await page.evaluate(() => {
        const t = document.querySelector('.transport');
        const rect = t.getBoundingClientRect();
        return {
            dansLeDock: t.parentElement.id === 'footer-dock',
            horsVoletReplie: !document.querySelector('.col-left').contains(t),
            visible: getComputedStyle(t).display !== 'none' && rect.width > 0 && rect.height > 0,
            dansEcran: rect.left >= 0 && rect.top >= 0 && rect.right <= window.innerWidth && rect.bottom <= window.innerHeight,
        };
    });
    console.log(JSON.stringify(r));
    console.log((r.dansLeDock && r.horsVoletReplie && r.visible && r.dansEcran)
        ? 'PASS (transport toujours visible et entier, panneau replié)' : 'FAIL');

    console.log('--- Le bouton Lecture fonctionne toujours, panneau replié ---');
    await page.click('#play-prog');
    await page.waitForTimeout(200);
    r = await page.evaluate(() => ({ isPlaying: window.app.isPlaying }));
    console.log(JSON.stringify(r));
    console.log(r.isPlaying ? 'PASS (playback works with sidebar collapsed)' : 'FAIL');
    await page.evaluate(() => window.app.stopAll());
    // Laisse le temps au nettoyage audio (Tone.Transport/contexte) de vraiment se terminer avant de
    // recharger — mesuré : recharger juste après stopAll() peut planter la page dans ce bac à sable
    // (reproductible même sans aucun changement du jour, un défaut préexistant de l'environnement,
    // pas de l'appli), le contexte audio semblant parfois encore en cours de désallocation.
    await page.waitForTimeout(300);

    console.log('--- Persists across reload ---');
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);
    r = await page.evaluate(() => ({
        collapsed: document.body.classList.contains('sidebar-collapsed'),
        colLeftWidth: document.querySelector('.col-left').getBoundingClientRect().width,
    }));
    console.log(JSON.stringify(r));
    console.log((r.collapsed && r.colLeftWidth === 0) ? 'PASS (persisted across reload)' : 'FAIL');

    console.log('--- Click again: sidebar comes back ---');
    await page.click('#toggle-sidebar');
    await page.waitForTimeout(150);
    r = await page.evaluate(() => ({
        collapsed: document.body.classList.contains('sidebar-collapsed'),
        colLeftWidth: document.querySelector('.col-left').getBoundingClientRect().width,
    }));
    console.log(JSON.stringify(r));
    console.log((!r.collapsed && r.colLeftWidth > 0) ? 'PASS (sidebar restored)' : 'FAIL');

    console.log('--- Dock moved back into col-left ---');
    r = await page.evaluate(() => ({
        dockInColLeft: document.querySelector('.col-left').contains(document.getElementById('footer-dock')),
    }));
    console.log(JSON.stringify(r));
    console.log(r.dockInColLeft ? 'PASS (dock restored to col-left)' : 'FAIL');

    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
