// LE VERRE ET LE COMPTE CLOUD — ce que verre_test ne pouvait pas voir.
//
// POURQUOI UN BANC À PART. L'effet verre a été fait et éprouvé sur une ligne de HarmoHub qui n'avait pas encore la pilule de
// connexion commune (compte-cloud.js, classes cc-…), ni son menu ni sa fenêtre. Ces trois surfaces sont dessinées par un fichier
// PARTAGÉ avec TabHub et TrainHub : elles ne connaissent pas le verre, et ne doivent jamais le connaître. Leur habillage en verre
// vit donc dans verre-surfaces.css (propre à HarmoHub) — et c'est CE FICHIER-LÀ que ce banc surveille.
// Mesuré à la main avant d'écrire ce banc : sans habillage, pilule, menu et fenêtre restaient des plaques d'un gris neutre au milieu
// d'un verre bleu nuit (lisibles, mais d'un autre monde que les autres menus).
//
// Deuxième trouvaille, même méthode (capture d'écran de la page Paroles, verre allumé) : Paroles pose son propre fond sur <html>, ce
// qui empêchait le fond du verre, posé sur <body>, de couvrir la fenêtre — une aurore sur 360 px puis une moitié basse unie.
//
// LA LISIBILITÉ SE MESURE SUR LES PIXELS, pas sur les règles : le fond de ces surfaces est un DÉGRADÉ translucide, que le contrôle de
// contraste ordinaire (voir _verre_commun.js, qui ignore les dégradés) ne peut pas juger. On capture l'élément réel, par-dessus
// chacun des sept fonds de couleur, et on mesure la luminance médiane de ce que le texte a derrière lui.
const V = require('./_verre_commun.js');
const { creerNuage, installer } = require('./_firebase_faux');
const { check, exiger, plan, bilan } = require('./_harness')('verre : compte cloud et fond de Paroles');

plan(32);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const VERRE = { 'harmohub.glass.v1': '1' };
const FONDS = ['aurora', 'blue', 'green', 'violet', 'rose', 'amber', 'grey'];

(async () => {
    const { chromium } = V.chargerPlaywright();
    const nav = await chromium.launch();
    const erreurs = [];

    // Ouvre HarmoHub avec le faux Firebase (compte connecté ou non), verre allumé ou éteint, sur le fond demandé.
    const ouvrir = async ({ verre, fond = 'aurora', connecte = false, viewport = { width: 1300, height: 820 }, tactile = false }) => {
        const ctx = await nav.newContext({ viewport, ...(tactile ? { hasTouch: true, isMobile: true } : {}) });
        await installer(ctx, creerNuage(), { appareil: 'x' + Math.random(), uid: 'u1', nom: 'Lucas Delmas', email: 'lucas@example.com', persister: true });
        await ctx.addInitScript(([v, f, c]) => {
            if (v) { localStorage.setItem('harmohub.glass.v1', '1'); localStorage.setItem('harmohub.glassBg.v1', f); }
            if (c) localStorage.setItem('__fauxSession', '1');
        }, [verre, fond, connecte]);
        const page = await ctx.newPage();
        page.on('pageerror', (e) => erreurs.push('pageerror: ' + e.message));
        page.on('console', (m) => { if (m.type() === 'error' && !V.BRUIT.test(m.text())) erreurs.push('console: ' + m.text()); });
        await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 25000 });
        await page.waitForTimeout(1300);
        return { ctx, page };
    };
    // Luminance médiane (0 à 1) et part de pixels clairs d'un élément, mesurées sur sa capture réelle.
    const pixels = async (page, locator) => {
        const b64 = (await locator.screenshot()).toString('base64');
        return page.evaluate(async (b64) => {
            const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
            const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
            const g = c.getContext('2d'); g.drawImage(img, 0, 0);
            const d = g.getImageData(0, 0, c.width, c.height).data; const L = [];
            const lin = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
            for (let i = 0; i < d.length; i += 4) L.push(0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]));
            L.sort((a, b) => a - b);
            return { mediane: L[Math.floor(L.length / 2)], claires: L.filter((x) => x > 0.35).length / L.length };
        }, b64);
    };
    const style = (page, sel, prop) => page.evaluate(([s, p]) => { const e = document.querySelector(s); return e ? getComputedStyle(e)[p] : null; }, [sel, prop]);
    const ouvrirMenu = async (page) => { await page.click('#account-info'); await page.waitForTimeout(350); };

    // ============ A. LISIBILITÉ SUR LES SEPT FONDS ============
    const pires = { pilule: 0, menu: 0, fenetre: 0 }; let claires = 0, mesures = 0;
    for (const fond of FONDS) {
        const { ctx, page } = await ouvrir({ verre: true, fond, connecte: true });
        const pil = await pixels(page, page.locator('#account-info'));
        await ouvrirMenu(page);
        const men = await pixels(page, page.locator('#cloud-menu'));
        pires.pilule = Math.max(pires.pilule, pil.mediane); pires.menu = Math.max(pires.menu, men.mediane);
        claires = Math.max(claires, men.claires); mesures += 2;
        await ctx.close();
        const o = await ouvrir({ verre: true, fond });
        const fen = await pixels(o.page, o.page.locator('#cloud-guard-modal .cc-fenetre'));
        pires.fenetre = Math.max(pires.fenetre, fen.mediane);
        await o.ctx.close();
    }
    check(pires.pilule < 0.05, `verre, sept fonds : l'arrière-plan du nom du compte reste SOMBRE (luminance médiane la pire : ${pires.pilule.toFixed(3)})`);
    check(pires.menu < 0.05, `verre, sept fonds : le menu du compte reste sombre derrière son texte (${pires.menu.toFixed(3)})`);
    check(pires.fenetre < 0.05, `verre, sept fonds : la fenêtre de connexion reste sombre derrière son texte (${pires.fenetre.toFixed(3)})`);
    check(claires < 0.25, `et le menu n'est pas plus qu'un quart de pixels clairs (texte compris) : ${(claires * 100).toFixed(1)} %`);
    check(mesures === 14, `les ${mesures} mesures (7 fonds × pilule/menu) ont bien eu lieu`);

    // ============ B. HABILLAGE : DU VERRE, PAS UN GRIS NEUTRE ============
    const on = await ouvrir({ verre: true, connecte: true });
    // La référence : une fenêtre ordinaire (les Paramètres), à laquelle le menu du compte doit ressembler.
    await on.page.evaluate(() => { document.getElementById('open-settings').click(); });
    await on.page.waitForTimeout(400);
    const refFiltre = await style(on.page, '.settings-modal', 'backdropFilter');
    const refFond = await style(on.page, '.settings-modal', 'backgroundImage');
    await on.page.evaluate(() => window.app.closeSettings());
    await on.page.waitForTimeout(250);
    await ouvrirMenu(on.page);
    const filtreMenu = await style(on.page, '#cloud-menu', 'backdropFilter');
    const fondMenu = await style(on.page, '#cloud-menu', 'backgroundImage');
    check(filtreMenu !== 'none' && filtreMenu === refFiltre, `verre : le menu du compte floute comme les autres fenêtres (${filtreMenu})`);
    check(fondMenu === refFond && /gradient/.test(fondMenu), 'et prend LE MÊME fond translucide que les autres fenêtres (--glass-pop-fond)');
    check(/rgba?\([^)]*\)/.test(await style(on.page, '#cloud-menu', 'boxShadow')) && (await style(on.page, '#cloud-menu', 'boxShadow')) !== 'none', 'avec son reflet et son ombre');
    const piluleOn = await style(on.page, '#account-info', 'backgroundColor');
    const logoOn = await style(on.page, '.logo', 'backgroundColor');
    check(piluleOn === logoOn, `la pilule du compte a le fond des autres pastilles de la barre du haut (${piluleOn} = ${logoOn})`);
    await on.page.keyboard.press('Escape');
    await on.ctx.close();
    const accueil = await ouvrir({ verre: true });
    check(await style(accueil.page, '#cloud-guard-modal .cc-fenetre', 'backdropFilter') !== 'none', 'verre : la fenêtre de connexion floute ce qu\'elle recouvre');
    check(/gradient/.test(await style(accueil.page, '#cloud-guard-modal .cc-fenetre', 'backgroundImage')), 'et prend le fond translucide du verre');
    // LE REPLI : le flou ne dépend QUE de --glass-filter. La couper (« moins de transparence », navigateur sans flou) coupe aussi ces trois.
    await accueil.page.evaluate(() => document.documentElement.style.setProperty('--glass-filter', 'none'));
    check(await style(accueil.page, '#cloud-guard-modal .cc-fenetre', 'backdropFilter') === 'none', 'repli : --glass-filter à « none » coupe le flou de la fenêtre de connexion');
    const sources = require('fs').readFileSync(require('path').join(__dirname, '..', 'verre-surfaces.css'), 'utf8');
    check(!/blur\(/.test(sources.slice(sources.indexOf('COMPTE CLOUD'), sources.indexOf('titres de groupe collants'))),
        'et verre-surfaces.css n\'écrit jamais blur() en dur pour le compte : tout passe par la variable');
    await accueil.ctx.close();

    // ============ C. ÉTEINT, RIEN NE CHANGE ============
    const eteint = await ouvrir({ verre: false, connecte: true });
    await ouvrirMenu(eteint.page);
    const ref = await V.signature(eteint.page);   // éteint : signature relevée telle quelle
    const noir = await ouvrir({ verre: false, connecte: true });
    await ouvrirMenu(noir.page);
    check(await style(eteint.page, '#cloud-menu', 'backdropFilter') === 'none' && await style(eteint.page, '#account-info', 'backdropFilter') === 'none',
        'éteint : ni le menu ni la pilule ne floutent');
    check(await eteint.page.evaluate(() => document.documentElement.hasAttribute('data-glass')) === false, 'éteint : aucun attribut data-glass sur <html>');
    const gris = await style(eteint.page, '#cloud-menu', 'backgroundColor');
    check(/color\(srgb|rgb\(/.test(gris) && !/gradient/.test(await style(eteint.page, '#cloud-menu', 'backgroundImage')),
        `éteint : le menu garde son fond d'avant, uni (${gris})`);
    check(ref.length > 20, `éteint : la page a bien été relevée (${ref.length} éléments)`);
    const accueilOff = await ouvrir({ verre: false });
    check(!/gradient/.test(await style(accueilOff.page, '#cloud-guard-modal .cc-fenetre', 'backgroundImage')), 'éteint : la fenêtre de connexion garde son fond d\'avant');
    await eteint.ctx.close(); await noir.ctx.close(); await accueilOff.ctx.close();

    // ============ D. LA PAGE PAROLES : LE FOND COUVRE TOUT L'ÉCRAN ============
    for (const [nom, viewport, tactile] of [['bureau', { width: 1300, height: 820 }, false], ['téléphone', { width: 390, height: 780 }, true]]) {
        const ctx = await nav.newContext({ viewport, ...(tactile ? { hasTouch: true, isMobile: true } : {}) });
        await ctx.addInitScript(() => { localStorage.setItem('harmohub.glass.v1', '1'); });
        const p = await ctx.newPage();
        p.on('pageerror', (e) => erreurs.push('paroles pageerror: ' + e.message));
        await p.goto(`${BASE}/paroles.html?nocache=` + Date.now(), { waitUntil: 'load' }); await p.waitForTimeout(900);
        const mesure = await p.evaluate(() => {
            const h = getComputedStyle(document.documentElement), b = getComputedStyle(document.body);
            return { htmlImage: h.backgroundImage, htmlCouleur: h.backgroundColor, bodyImage: b.backgroundImage, hauteurBody: document.body.getBoundingClientRect().height, fenetre: window.innerHeight };
        });
        check(mesure.htmlImage === 'none' && mesure.htmlCouleur === 'rgba(0, 0, 0, 0)', `Paroles (${nom}), verre : <html> n'a plus de fond propre — celui du <body> couvre toute la fenêtre`);
        check(/gradient/.test(mesure.bodyImage), `Paroles (${nom}) : le fond du verre est bien celui du <body>`);
        // Le bas de la fenêtre est AUSSI coloré : on échantillonne le pixel du bas, qui doit être éclairci par un fond de couleur (≠ le fond uni d'avant).
        const png = (await p.screenshot({ clip: { x: 0, y: mesure.fenetre - 8, width: 1, height: 1 } })).toString('base64');
        const coul = await p.evaluate(async (b64) => {
            const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
            const c = document.createElement('canvas'); c.width = 1; c.height = 1; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
            return [...g.getImageData(0, 0, 1, 1).data].slice(0, 3);
        }, png);
        check(coul.some((x) => x > 0) && !(coul[0] === 10 && coul[1] === 10 && coul[2] === 10), `Paroles (${nom}) : le bas de la fenêtre n'est pas le gris uni d'avant (${coul})`);
        await ctx.close();
    }
    const parolesOff = await nav.newContext({ viewport: { width: 1300, height: 820 } });
    const po = await parolesOff.newPage();
    await po.goto(`${BASE}/paroles.html?nocache=` + Date.now(), { waitUntil: 'load' }); await po.waitForTimeout(700);
    const htmlOff = await po.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
    check(htmlOff === 'rgb(10, 10, 10)', `Paroles, verre éteint : <html> garde son fond d'avant (${htmlOff})`);
    await parolesOff.close();

    // ============ E. TÉLÉPHONE : PILULE, MENU, FENÊTRE, EN VERRE ============
    const T = await ouvrir({ verre: true, connecte: true, viewport: { width: 390, height: 780 }, tactile: true });
    const geoPil = await T.page.evaluate(() => { const r = document.getElementById('account-info').getBoundingClientRect(); return { w: r.width, h: r.height }; });
    check(geoPil.w >= 32 && geoPil.w <= 60 && geoPil.h >= 32, `téléphone, verre : la pilule garde sa taille (${Math.round(geoPil.w)}×${Math.round(geoPil.h)})`);
    await T.page.tap('#account-info'); await T.page.waitForTimeout(350);
    const mT = await pixels(T.page, T.page.locator('#cloud-menu'));
    check(mT.mediane < 0.05, `téléphone, verre : le menu reste sombre derrière son texte (${mT.mediane.toFixed(3)})`);
    const geoMenu = await T.page.evaluate(() => { const r = document.getElementById('cloud-menu').getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth; });
    check(geoMenu, 'et tient dans la largeur');
    await T.ctx.close();
    const T2 = await ouvrir({ verre: true, viewport: { width: 390, height: 780 }, tactile: true });
    const fT = await pixels(T2.page, T2.page.locator('#cloud-guard-modal .cc-fenetre'));
    check(fT.mediane < 0.05, `téléphone, verre : la fenêtre de connexion reste sombre derrière son texte (${fT.mediane.toFixed(3)})`);
    check(await T2.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth) <= 0, 'et la page ne déborde pas');
    await T2.ctx.close();

    // ============ F. LES PASTILLES D'ÉTAT RESTENT DISTINGUABLES EN VERRE ============
    const S = await ouvrir({ verre: true, connecte: true });
    const couleurs = {};
    for (const m of ['synced', 'syncing', 'pending', 'offline', 'error']) {
        await S.page.evaluate((mode) => window.SYNCHRO.ui.etat(mode), m);
        couleurs[m] = await style(S.page, '#sync-status', 'backgroundColor');
    }
    check(new Set(Object.values(couleurs)).size === 5, `verre : les cinq états de la pastille gardent cinq couleurs différentes (${JSON.stringify(couleurs)})`);
    await S.ctx.close();

    check(erreurs.length === 0, `aucune erreur JavaScript (${erreurs.slice(0, 2).join(' | ')})`);
    await nav.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
