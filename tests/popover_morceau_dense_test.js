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

// LOT 10c : l'ancien panneau (trois titres Rythme / Son / Tonalité, listes déroulantes, flèches de transposition au bout de la ligne de tonalité)
// ne s'ouvre plus à aucune largeur. Sous 900px, la barre-résumé déplie les quatre CASES de la maquette, et chaque case ouvre son choix (#rr-pop).
// Ce banc garde ses exigences d'origine — pas de répétition, une hiérarchie dans le bon sens, la transposition rangée avec la tonalité sans se
// confondre avec elle, rien qui déborde, des commandes qui marchent au vrai clic et restent tactiles — éprouvées sur ce qui les porte désormais.
const lirePopover = () => {
    const pan = document.getElementById('tel-reglages-cases');
    const r = pan.getBoundingClientRect();
    const px = (el) => parseFloat(getComputedStyle(el).fontSize);
    const boite = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { l: Math.round(b.width), h: Math.round(b.height), t: Math.round(b.top), g: Math.round(b.left), d: Math.round(b.right) }; };
    return {
        hauteur: Math.round(r.height),
        noms: [...pan.querySelectorAll('.rr-nom')].map(h => h.textContent.trim()),
        taillesNoms: [...pan.querySelectorAll('.rr-nom')].map(px),
        taillesValeurs: [...pan.querySelectorAll('.rr-val')].map(px),
        titres: [...pan.querySelectorAll('h2')].map(h => h.textContent.trim()),
        etiquetteInstrument: [...pan.querySelectorAll('label, .rr-nom')].some(e => /Instrument/i.test(e.textContent)),
        cap: boite('#tel-reglages-cases .rr-cap'), grille: boite('#tel-reglages-cases .rangee-reglages'),
        tonalite: boite('#rr-tonalite'), son: boite('#rr-son'),
        bas: boite('#rr-transposer-bas'), haut: boite('#rr-transposer-haut'),
        debordePage: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        deborde: pan.scrollWidth - pan.clientWidth,
    };
};

(async () => {
    plan(21);
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const erreurs = [];
    // LOT 6a : sur ordinateur (≥ 900px), ces réglages sont des puces au-dessus de la grille (rangee_reglages_test). Sous le seuil, les cases du
    // lot 10c : ce banc se joue juste sous le seuil, puis au téléphone.
    const page = await browser.newPage({ viewport: { width: 860, height: 950 } });
    page.on('pageerror', e => erreurs.push('860px : ' + e.message));
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await page.waitForTimeout(250);
    await page.evaluate(seed);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(800);
    await page.click('#song-summary');
    await page.waitForTimeout(500);

    const m = await page.evaluate(lirePopover);

    // === A. Les répétitions sont parties ===
    check(!m.titres.includes('Tempo') && m.titres.length === 0, `plus aucun titre de chapitre au-dessus des cases (« pas besoin des titres de chapitre ») — ${m.titres.join(', ') || 'aucun'}`);
    check(!m.etiquetteInstrument, 'pas d\'étiquette « Instrument » : la case s\'appelle « Son »');
    // Un nom par case, chacun nommant une famille — ceux de la maquette.
    check(m.noms.join() === 'Tonalité,Mesure,Swing,Son', `quatre cases, chacune nommant une famille — ${m.noms.join(', ')}`);
    // « Son » : le nom et la valeur dans UNE case (une section à un seul champ n'a pas besoin de deux blocs), le nom calé à GAUCHE comme la valeur
    // — au premier essai de l'ancien panneau, une règle de cascade l'avait envoyé à droite.
    const son = await page.evaluate(() => {
        const t = document.getElementById('rr-son');
        const h = t.querySelector('.rr-nom').getBoundingClientRect(), v = t.querySelector('.rr-val').getBoundingClientRect(), c = t.getBoundingClientRect();
        return { dedans: h.top >= c.top && v.bottom <= c.bottom + 0.5, dessus: h.bottom <= v.top + 1, gauche: Math.abs(h.left - v.left) <= 1, titre: t.querySelector('.rr-nom').textContent.trim() };
    });
    exiger(!!son, 'la case Son est bien là');
    check(son.dedans && son.dessus, `« ${son.titre} » et sa valeur tiennent dans une seule case, le nom au-dessus`);
    check(son.gauche, 'et le nom est calé à GAUCHE, aligné sur la valeur');

    // === B. La transposition est rangée avec la tonalité, sans se confondre avec elle ===
    check(!!m.cap && !!m.bas && !!m.haut, 'la ligne « Transposer » est là, sous les cases');
    exiger(!!m.bas && !!m.haut && !!m.tonalite, 'les flèches et la case Tonalité sont là');
    // « Même ligne » se mesure sur les CENTRES : le mot et les flèches n'ont pas la même hauteur.
    const centre = (b) => b.t + b.h / 2;
    const ecart = Math.max(Math.abs(centre(m.bas) - centre(m.cap)), Math.abs(centre(m.haut) - centre(m.cap)));
    check(ecart <= 2, `les flèches sont sur la MÊME ligne que leur mot — ${ecart}px d'écart entre les centres`);
    check(m.bas.g > m.cap.g && m.haut.d <= m.grille.d + 0.5 && Math.abs(m.haut.d - m.grille.d) <= 1, 'et bien à DROITE du mot, au bord des cases');
    // Ce qui empêche de prendre Transposer pour un cinquième réglage de tonalité : il n'est PAS une case (ni le nom au-dessus d'une valeur, ni la
    // même hauteur), il a sa propre ligne sous les quatre.
    check(m.bas.t >= m.son.t + m.son.h && m.bas.h !== m.tonalite.h, `Transposer n'est pas une case de plus : sa ligne vient sous les quatre, à sa hauteur à lui (${m.bas.h}px contre ${m.tonalite.h}px)`);
    // Densité : les quatre réglages et Transposer en peu de place — deux rangées de cases et une ligne.
    check(m.hauteur <= 52 * 2 + 44 + 6 * 2 + 2, `les réglages restent denses — ${m.hauteur}px pour quatre cases et Transposer`);

    // === C. La hiérarchie est dans le bon sens ===
    // MESURÉ AVANT (ancien panneau) : titres 12,8px, étiquettes 14,1px — le chapitre pesait moins que le nom du champ. Dans une case, c'est la
    // VALEUR qu'on cherche d'un coup d'œil : le nom (en petites capitales) doit peser moins qu'elle.
    const maxNom = Math.max(...m.taillesNoms);
    const minValeur = Math.min(...m.taillesValeurs);
    check(maxNom < minValeur, `chaque nom de case est plus petit que les valeurs — noms ≤ ${maxNom}px, valeurs ≥ ${minValeur}px`);

    // === D. Rien ne déborde, nulle part ===
    check(m.deborde <= 0 && m.debordePage <= 0, `les cases ne débordent pas — cases ${m.deborde}px, page ${m.debordePage}px`);

    // === E. Les commandes marchent toujours, au clic RÉEL ===
    // Une réorganisation qui déplace des boutons doit être éprouvée par le geste, pas par le DOM : un bouton recouvert par un voisin serait
    // invisible à un test qui se contente de le trouver.
    const avant = await page.evaluate(() => document.getElementById('global-root').value);
    await page.click('#rr-transposer-haut');
    await page.waitForTimeout(400);
    const apres = await page.evaluate(() => document.getElementById('global-root').value);
    check(apres !== avant, `un vrai clic sur ↑ transpose bien le morceau — ${avant} -> ${apres}`);
    await page.click('#rr-transposer-bas');
    await page.waitForTimeout(400);
    check(await page.evaluate(() => document.getElementById('global-root').value) === avant, 'et ↓ le ramène où il était');

    // La case dont le mot a changé (« Son ») doit rester annoncée aux lecteurs d'écran : retirer un mot à l'écran ne doit pas le retirer à
    // l'accessibilité.
    check(await page.evaluate(() => { const i = document.getElementById('rr-son'); return /Son|Instrument/i.test(i.getAttribute('aria-label') || i.title || i.textContent); }),
        'la case Son garde son nom pour les lecteurs d\'écran');
    await page.click('#rr-son'); await page.waitForTimeout(200);
    await page.click('#rr-pop [data-rr-valeur="epiano"]'); await page.waitForTimeout(300);
    check(await page.evaluate(() => window.app.songInstrument === 'epiano'), 'et changer le son depuis sa case agit toujours sur le morceau');

    // === F. Au doigt : le choix de la tonalité porte dix-neuf commandes ===
    // C'est le vrai risque : douze toniques et sept modes sur un écran étroit pourraient se tasser sous le seuil tactile ou déborder. On mesure.
    const ctx = await browser.newContext({ ...devices['iPhone 13'], hasTouch: true });
    const tel = await ctx.newPage();
    tel.on('pageerror', e => erreurs.push('téléphone : ' + e.message));
    await tel.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await tel.waitForTimeout(250);
    await tel.evaluate(seed);
    await tel.reload({ waitUntil: 'load' });
    await tel.waitForTimeout(900);
    await tel.tap('#song-summary');
    await tel.waitForTimeout(400);
    const t = await tel.evaluate(lirePopover);
    check(t.deborde <= 0 && t.debordePage <= 0, `téléphone : rien ne déborde — cases ${t.deborde}px, page ${t.debordePage}px`);
    await tel.tap('#rr-tonalite');
    await tel.waitForTimeout(300);
    const cibles = await tel.evaluate(() => [...document.querySelectorAll('#rr-pop .rr-grille button, #rr-pop .rr-suggerer')]
        .map(e => { const r = e.getBoundingClientRect(); return { s: e.textContent.trim(), l: Math.round(r.width), h: Math.round(r.height), dedans: r.left >= 0 && r.right <= innerWidth + 0.5 }; }));
    const troppetit = cibles.filter(c => c.l < 28 || c.h < 38 || !c.dedans);
    check(cibles.length === 20 && troppetit.length === 0,
        `téléphone : les vingt commandes du choix de tonalité restent tactiles et dans l'écran — ${troppetit.length ? troppetit.map(c => c.s + ' ' + c.l + 'x' + c.h).join(', ') : cibles.length + ' commandes, ' + Math.min(...cibles.map(c => c.h)) + 'px de haut au moins'}`);

    check(erreurs.length === 0, `aucune erreur JavaScript — ${erreurs.join(' | ') || 'aucune'}`);
    await browser.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
