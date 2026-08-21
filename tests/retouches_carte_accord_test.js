// Deux retouches demandées sur la carte Accord, et le raisonnement derrière chacune.
//
// RETOURS UTILISATEUR :
//   « Bouton voicing : afficher en plus sombre, comme le séquenceur, à côté du bouton séquenceur
//     continu. »
//   « Nouvel accord ou modifier (titres) : enlever les encadrés verts ou orange, je n'aime pas trop. »
//
// J'AVAIS D'ABORD VISÉ LES MAUVAIS BOUTONS : j'ai assombri les listes « C » et « Majeur » de la carte
// Accord, alors que « bouton voicing » désignait « Conduite de voix », au-dessus de la grille. Cette
// méprise est annulée, et la vraie demande a fait apparaître un défaut plus ancien :
//   `.btn-seq-court { background: …, var(--btn-neutral) }` — et --btn-neutral N'EXISTE PAS. La feuille
//   définit --btn-neutral-1, -2, -border, -border-hover, jamais --btn-neutral tout court. Toute la
//   déclaration était donc invalide au calcul et `background` retombait sur sa valeur initiale :
//   TRANSPARENT. Le bouton « Séq. » n'a jamais porté de fond, il montrait celui de la page.
//   D'où l'impression de l'utilisateur, exacte et jamais nommée : son voisin paraissait plus sombre
//   parce qu'il n'avait pas de fond du tout.
const { chromium, devices } = require('playwright');
const creerHarnais = require('./_harness');
const { plan, check, exiger, bilan } = creerHarnais('Carte Accord : fonds sombres, titres sans cadre');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';

const seed = () => {
    const mk = (r) => ({ root: r, quality: 'maj', beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
    localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: ['C', 'D'].map(mk) }] }));
};

(async () => {
    plan(10);
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const erreurs = [];
    const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
    page.on('pageerror', e => erreurs.push('ordinateur : ' + e.message));
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await page.waitForTimeout(250);
    await page.evaluate(seed);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(800);

    // === A. La barre au-dessus de la grille parle d'une seule voix ===
    const barre = await page.evaluate(() => {
        const f = (s) => { const e = document.querySelector(s); if (!e) return null; const c = getComputedStyle(e);
            return { fond: c.backgroundColor, image: c.backgroundImage, rayon: c.borderTopLeftRadius }; };
        return { voicing: f('#toggle-voice-leading'), seq: f('#grid-zoom') };
    });
    exiger(!!barre.voicing && !!barre.seq, 'les deux boutons voisins de la barre sont là');
    // LE POINT QUI COMPTE VRAIMENT : « Séq. » ne doit plus être transparent par accident. Un fond
    // transparent passerait ce banc si l'on se contentait de comparer les deux entre eux — d'où le
    // contrôle explicite qu'il est PEINT.
    check(barre.seq.fond !== 'rgba(0, 0, 0, 0)' && barre.seq.fond !== 'transparent',
        `« Séq. » a enfin un fond peint, au lieu de montrer celui de la page — ${barre.seq.fond}`);
    check(barre.voicing.fond === barre.seq.fond,
        `« Conduite de voix » a le même fond que son voisin « Séq. » — ${barre.voicing.fond} contre ${barre.seq.fond}`);
    check(barre.voicing.image === 'none' && barre.seq.image === 'none',
        `tous deux à plat, sans dégradé clair — ${barre.voicing.image} / ${barre.seq.image}`);
    check(barre.voicing.rayon === barre.seq.rayon,
        `et le même arrondi, pour qu'ils se lisent comme une paire — ${barre.voicing.rayon} / ${barre.seq.rayon}`);
    // La méprise annulée : les listes de la carte Accord n'avaient PAS à changer, aucun retour ne
    // l'avait demandé. Ce point garde la trace de ce retour en arrière.
    const listes = await page.evaluate(() => getComputedStyle(document.getElementById('root')).backgroundImage);
    check(listes !== 'none', `les listes de la carte Accord gardent leur habillage d'origine — ${listes.slice(0, 30)}`);

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
        const e = document.getElementById('grid-zoom');
        const cs = getComputedStyle(e);
        const l1 = lum(cs.color), l2 = lum(cs.backgroundColor);
        return Math.round(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)) * 10) / 10;
    });
    check(contraste >= 4.5, `téléphone : « Séq. » garde un texte lisible sur son nouveau fond — ${contraste}:1 (seuil AA : 4.5)`);

    check(erreurs.length === 0, `aucune erreur JavaScript — ${erreurs.join(' | ') || 'aucune'}`);
    await browser.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
