// Deux retouches demandées sur la carte Accord, et le raisonnement derrière chacune.
//
// RETOURS UTILISATEUR :
//   « Bouton voicing : afficher en plus sombre, comme le séquenceur. »
//   « Nouvel accord ou modifier (titres) : enlever les encadrés verts ou orange, je n'aime pas trop. »
//
// CE QUE LA CAPTURE MONTRAIT, et qui explique le premier point mieux que la mesure isolée : sur UNE
// MÊME LIGNE, « C » et « Majeur » portaient le fond générique des <select> (#222 plus un dégradé
// clair) tandis que « 1 mes. », juste à côté, portait le #16191e des commandes du séquenceur. Trois
// commandes de même rang, deux habillages. C'est le lot précédent — la durée remontée sur cette
// ligne — qui a rendu l'écart visible en les mettant côte à côte.
const { chromium, devices } = require('playwright');
const creerHarnais = require('./_harness');
const { plan, check, exiger, bilan } = creerHarnais('Carte Accord : fonds sombres, titres sans cadre');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';

const seed = () => {
    const mk = (r) => ({ root: r, quality: 'maj', beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
    localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: ['C', 'D'].map(mk) }] }));
};

// Couleur réellement PEINTE derrière un élément : un fond transparent laisse voir celui du parent,
// et comparer des `rgba(0,0,0,0)` entre eux ne prouverait rien.
const fondPeint = (sel) => {
    let e = document.querySelector(sel);
    if (!e) return null;
    while (e) {
        const c = getComputedStyle(e).backgroundColor;
        if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c;
        e = e.parentElement;
    }
    return null;
};

(async () => {
    plan(11);
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const erreurs = [];
    const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
    page.on('pageerror', e => erreurs.push('ordinateur : ' + e.message));
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await page.waitForTimeout(250);
    await page.evaluate(seed);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(800);

    // === A. La ligne d'accord parle d'une seule voix ===
    const fonds = await page.evaluate((src) => {
        const f = new Function('sel', 'return (' + src + ')(sel)');
        return {
            root: f('#root'), quality: f('#quality'), duree: f('.duration-dd-toggle'),
            basse: f('#bass'), groupeVoicing: f('.voicing-seg'),
            degradeRoot: getComputedStyle(document.getElementById('root')).backgroundImage,
        };
    }, fondPeint.toString());
    exiger(!!fonds.root && !!fonds.duree, 'les fonds sont mesurables');
    check(fonds.root === fonds.duree,
        `« C » a le même fond que « 1 mes. », la commande de la famille séquenceur — ${fonds.root} contre ${fonds.duree}`);
    check(fonds.quality === fonds.duree, `« Majeur » aussi — ${fonds.quality}`);
    check(fonds.groupeVoicing === fonds.duree,
        `et les segments de voicing, qui l'avaient déjà — ${fonds.groupeVoicing}`);
    // Le dégradé clair du haut des <select> partait avec : c'est LUI qui éclaircissait le champ,
    // le fond seul n'aurait pas suffi.
    check(fonds.degradeRoot === 'none', `plus de dégradé clair sur les listes — ${fonds.degradeRoot}`);

    // === B. Le titre n'a plus d'encadré, mais garde sa couleur ===
    // La pastille distinguait l'ÉTAT (ajout/modification) du SUJET (le symbole). Cette distinction
    // doit survivre sans cadre, sinon on aurait retiré une information au lieu d'un ornement.
    const enAjout = await page.evaluate(() => {
        const l = document.getElementById('accord-title-label');
        const c = getComputedStyle(l);
        return { texte: l.textContent.trim(), fond: c.backgroundColor, cadre: c.borderTopWidth, couleur: c.color };
    });
    check(enAjout.fond === 'rgba(0, 0, 0, 0)', `aucun fond derrière l'intitulé — ${enAjout.fond}`);
    check(enAjout.cadre === '0px', `aucun cadre autour — ${enAjout.cadre}`);
    check(/rgb/.test(enAjout.couleur) && enAjout.couleur !== 'rgb(255, 255, 255)',
        `mais l'intitulé garde sa couleur d'état — « ${enAjout.texte} » en ${enAjout.couleur}`);

    // En Modification, la couleur doit CHANGER : c'est elle qui porte désormais toute la distinction.
    const couleurAjout = enAjout.couleur;
    await page.evaluate(() => window.app.editChord(0, 0));
    await page.waitForTimeout(600);
    const enModif = await page.evaluate(() => {
        const l = document.getElementById('accord-title-label');
        const c = getComputedStyle(l);
        return { texte: l.textContent.trim(), fond: c.backgroundColor, cadre: c.borderTopWidth, couleur: c.color };
    });
    check(enModif.fond === 'rgba(0, 0, 0, 0)' && enModif.cadre === '0px',
        `en Modification non plus, ni fond ni cadre — « ${enModif.texte} »`);
    check(enModif.couleur !== couleurAjout,
        `et la couleur distingue toujours les deux états — ${couleurAjout} en Ajout, ${enModif.couleur} en Modification`);

    // === C. Au doigt : les listes restent lisibles sur fond sombre ===
    // Assombrir un champ ne doit pas le rendre illisible : on vérifie que le texte garde du contraste.
    const ctx = await browser.newContext({ ...devices['iPhone 13'], hasTouch: true });
    const tel = await ctx.newPage();
    tel.on('pageerror', e => erreurs.push('téléphone : ' + e.message));
    await tel.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await tel.waitForTimeout(250);
    await tel.evaluate(seed);
    await tel.reload({ waitUntil: 'load' });
    await tel.waitForTimeout(900);
    const contraste = await tel.evaluate(() => {
        const lum = (c) => { const [r, v, b] = c.match(/\d+/g).map(Number).map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * v + 0.0722 * b; };
        const e = document.getElementById('root');
        const cs = getComputedStyle(e);
        const l1 = lum(cs.color), l2 = lum(cs.backgroundColor);
        return Math.round(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)) * 10) / 10;
    });
    check(contraste >= 4.5, `téléphone : le texte des listes garde un contraste lisible — ${contraste}:1 (seuil AA : 4.5)`);

    check(erreurs.length === 0, `aucune erreur JavaScript — ${erreurs.join(' | ') || 'aucune'}`);
    await browser.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
