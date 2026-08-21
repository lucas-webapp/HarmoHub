// Le popover Morceau : densité et hiérarchie de DAW.
//
// RETOUR UTILISATEUR :
//   « Pas besoin des titres de chapitre, il y a déjà des répétitions. Enlève le titre "Tempo",
//     "Instrument" (remplacé par "Son" déjà existant). »
//   « Les flèches de transposition peuvent être positionnées à droite de la tonalité, par exemple en
//     réduisant la largeur des menus déroulants de la fondamentale et majeur/mineur. »
//   « Tu peux réduire un peu la taille des écritures (titres) si tu estimes que ça sera plus
//     harmonieux. Garde à l'idée qu'il faut quelque chose d'harmonieux et PRO, comme un vrai DAW. On
//     ne doit pas se perdre dans le popover comme c'est le cas actuellement. »
//
// CE QUE LA MESURE A MONTRÉ, et qui explique le « on se perd » mieux que l'impression : les TITRES de
// chapitre faisaient 12,8px, les ÉTIQUETTES de champ 14,1px. Les étiquettes étaient donc PLUS GROSSES
// que les titres censés les chapeauter — une hiérarchie à l'envers. Ce banc l'éprouve dans le bon
// sens (section C) : c'est le genre de défaut qui revient tout seul dès qu'on retouche une police.
const { chromium, devices } = require('playwright');
const creerHarnais = require('./_harness');
const { plan, check, exiger, bilan } = creerHarnais('Popover Morceau : dense et hiérarchisé');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';

const seed = () => {
    const mk = (r) => ({ root: r, quality: 'maj', beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
    localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: ['C', 'D'].map(mk) }] }));
};

const lirePopover = () => {
    const pan = document.getElementById('song-settings');
    const r = pan.getBoundingClientRect();
    const px = (el) => parseFloat(getComputedStyle(el).fontSize);
    const boite = (s) => { const e = pan.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { l: Math.round(b.width), h: Math.round(b.height), t: Math.round(b.top), d: Math.round(b.right) }; };
    return {
        hauteur: Math.round(r.height),
        titres: [...pan.querySelectorAll('h2')].map(h => h.textContent.trim()),
        taillesTitres: [...pan.querySelectorAll('h2')].map(px),
        taillesEtiquettes: [...pan.querySelectorAll('label')].map(px),
        etiquetteInstrument: !!pan.querySelector('label[for="instrument"]'),
        ancienneRangeeTranspo: !!pan.querySelector('.transpose-field'),
        root: boite('#global-root'), mode: boite('#global-mode'),
        bas: boite('#transpose-song-down'), haut: boite('#transpose-song-up'),
        filet: (() => { const e = pan.querySelector('.transpose-inline'); return e ? getComputedStyle(e).borderLeftWidth : null; })(),
        debordePage: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        deborde: pan.scrollWidth - pan.clientWidth,
    };
};

(async () => {
    plan(20);
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const erreurs = [];
    const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
    page.on('pageerror', e => erreurs.push('ordinateur : ' + e.message));
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await page.waitForTimeout(250);
    await page.evaluate(seed);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(800);
    await page.click('#song-summary');
    await page.waitForTimeout(500);

    const m = await page.evaluate(lirePopover);

    // === A. Les répétitions sont parties ===
    check(!m.titres.includes('Tempo'), `le titre « Tempo » a disparu — reste ${m.titres.join(', ')}`);
    check(!m.etiquetteInstrument, 'l\'étiquette « Instrument » a disparu : le titre « Son » la disait déjà');
    // UN TITRE EST REVENU, MAIS IL NOMME LA FAMILLE (retour utilisateur : « garder un titre (par
    // exemple Rythme…) au-dessus du métronome + types de rythmes/grooves »). C'est exactement le
    // critère du lot : « Tempo » redisait son premier champ, « Rythme » coiffe les trois — tempo,
    // groove, signature.
    check(m.titres.length === 3 && m.titres[0] === 'Rythme' && m.titres[1] === 'Son' && m.titres[2] === 'Tonalité',
        `trois titres, chacun nommant une famille — ${m.titres.join(', ')}`);
    // « Son » et sa liste sur UNE ligne (« mettre les instruments à droite du titre SON, pas
    // en-dessous, trop de place occupée pour rien ») : une section à un seul champ n'a pas besoin de
    // deux lignes. Et le titre doit être À GAUCHE — au premier essai il s'affichait à droite, la
    // règle `#song-card .card-head h2 { order: 1 }` du titre de morceau atteignant aussi ce popover.
    const son = await page.evaluate(() => {
        const t = document.querySelector('.card-head-inline');
        if (!t) return null;
        const h = t.querySelector('h2').getBoundingClientRect();
        const sel = t.querySelector('select').getBoundingClientRect();
        return { memeLigne: Math.abs((h.top + h.height / 2) - (sel.top + sel.height / 2)) <= 3,
                 titreAGauche: h.left < sel.left, titre: t.querySelector('h2').textContent.trim() };
    });
    exiger(!!son, 'la section Son est bien en ligne');
    check(son.memeLigne, `« ${son.titre} » et sa liste tiennent sur une seule ligne`);
    check(son.titreAGauche, 'et le titre est à GAUCHE de la liste, pas après elle');

    // === B. La transposition a rejoint la ligne de tonalité ===
    check(!m.ancienneRangeeTranspo, 'la rangée « Transposer » à elle seule a disparu');
    exiger(!!m.bas && !!m.haut && !!m.root, 'les flèches et le sélecteur de tonalité sont là');
    // « Même ligne » se mesure sur les CENTRES, pas sur les bords hauts : les flèches font 38px et
    // les menus 36, tous centrés — leurs bords hauts diffèrent donc d'un pixel alors qu'ils sont
    // parfaitement alignés. Comparer les bords aurait fait rougir ce banc pour une différence de
    // hauteur voulue, ce qui est le contraire de ce qu'il doit surveiller.
    const centre = (b) => b.t + b.h / 2;
    const ecart = Math.max(Math.abs(centre(m.bas) - centre(m.root)), Math.abs(centre(m.haut) - centre(m.root)));
    check(ecart <= 2,
        `les flèches sont sur la MÊME ligne que la tonalité — ${ecart}px d'écart entre les centres`);
    check(m.bas.d > m.mode.d, 'et bien à DROITE des deux menus, pas avant eux');
    // Le filet qui remplace le mot « Transposer » : sans lui, quatre pictogrammes d'affilée se
    // liraient comme une seule famille, et transposer passerait pour un réglage de tonalité de plus.
    check(m.filet === '1px', `un filet sépare les flèches des commandes de tonalité — ${m.filet}`);
    // « En réduisant la largeur des menus déroulants » : c'est ce qui libère la place, et c'était
    // explicitement demandé. On éprouve donc que les deux menus ont bien maigri.
    check(m.root.l <= 70 && m.mode.l <= 80,
        `les deux menus se sont resserrés pour faire la place — fondamentale ${m.root.l}px, mode ${m.mode.l}px`);

    // === C. La hiérarchie est dans le bon sens ===
    // MESURÉ AVANT : titres 12,8px, étiquettes 14,1px. Les étiquettes étaient plus grosses que les
    // titres. Un panneau où le chapitre pèse moins que le nom du champ ne se lit pas de haut en bas —
    // c'est une bonne part du « on se perd ».
    const maxEtiquette = Math.max(...m.taillesEtiquettes);
    const minTitre = Math.min(...m.taillesTitres);
    check(maxEtiquette < minTitre,
        `chaque étiquette est plus petite que les titres — étiquettes ≤ ${maxEtiquette}px, titres ≥ ${minTitre}px`);

    // === D. Rien ne déborde, nulle part ===
    check(m.deborde <= 0 && m.debordePage <= 0,
        `le popover ne déborde pas — panneau ${m.deborde}px, page ${m.debordePage}px`);

    // === E. Les commandes marchent toujours, au clic RÉEL ===
    // Une réorganisation qui déplace des boutons doit être éprouvée par le geste, pas par le DOM :
    // un bouton recouvert par un voisin serait invisible à un test qui se contente de le trouver.
    const avant = await page.evaluate(() => document.getElementById('global-root').value);
    await page.click('#transpose-song-up');
    await page.waitForTimeout(400);
    const apres = await page.evaluate(() => document.getElementById('global-root').value);
    check(apres !== avant, `un vrai clic sur ↑ transpose bien le morceau — ${avant} -> ${apres}`);
    await page.click('#transpose-song-down');
    await page.waitForTimeout(400);
    check(await page.evaluate(() => document.getElementById('global-root').value) === avant,
        'et ↓ le ramène où il était');

    // Le champ dont l'étiquette a disparu doit rester utilisable ET annoncé aux lecteurs d'écran :
    // retirer un mot à l'écran ne doit pas le retirer à l'accessibilité.
    check(await page.evaluate(() => {
        const i = document.getElementById('instrument');
        return !!(i.getAttribute('aria-label') || i.title);
    }), 'l\'instrument garde son nom pour les lecteurs d\'écran, même sans étiquette visible');
    await page.selectOption('#instrument', 'epiano');
    await page.waitForTimeout(300);
    check(await page.evaluate(() => window.app.songInstrument === 'epiano'),
        'et changer l\'instrument agit toujours sur le morceau');

    // === F. Au doigt : la ligne de tonalité porte maintenant six commandes ===
    // C'est le vrai risque de ce lot : à six, sur un écran étroit, elles pourraient se tasser sous le
    // seuil tactile ou déborder. On mesure plutôt que d'espérer.
    const ctx = await browser.newContext({ ...devices['iPhone 13'], hasTouch: true });
    const tel = await ctx.newPage();
    tel.on('pageerror', e => erreurs.push('téléphone : ' + e.message));
    await tel.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await tel.waitForTimeout(250);
    await tel.evaluate(seed);
    await tel.reload({ waitUntil: 'load' });
    await tel.waitForTimeout(900);
    await tel.tap('#song-summary');
    await tel.waitForTimeout(600);
    const t = await tel.evaluate(lirePopover);
    check(t.deborde <= 0 && t.debordePage <= 0,
        `téléphone : rien ne déborde — panneau ${t.deborde}px, page ${t.debordePage}px`);
    const cibles = await tel.evaluate(() => ['#global-root', '#global-mode', '#toggle-complex-mode', '#key-suggest-btn', '#transpose-song-down', '#transpose-song-up']
        .map(s => { const e = document.querySelector(s); const r = e.getBoundingClientRect(); return { s, l: Math.round(r.width), h: Math.round(r.height) }; }));
    const troppetit = cibles.filter(c => c.l < 28 || c.h < 28);
    check(troppetit.length === 0,
        `téléphone : les six commandes de la ligne restent tactiles — ${troppetit.length ? troppetit.map(c => c.s + ' ' + c.l + 'x' + c.h).join(', ') : cibles.map(c => c.l + 'x' + c.h).join(' ')}`);

    check(erreurs.length === 0, `aucune erreur JavaScript — ${erreurs.join(' | ') || 'aucune'}`);
    await browser.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
