// Les diagrammes rangés comme un inspecteur de DAW : l'objet à gauche, ses réglages à droite.
//
// RETOUR UTILISATEUR :
//   « Il me semblerait logique de placer les boutons à droite de l'accord "guitare" au lieu
//     d'en-dessous. Par exemple : premier niveau de boutons avec choix accord + verrou ; 2ème niveau
//     de boutons avec le bouton "éditer manuellement". Placer les boutons de manière logique pour que
//     ça rende comme sur un logiciel DAW professionnel. »
//   « Je propose d'augmenter très légèrement les dimensions du diagramme Piano, qui fait petit par
//     rapport au manche de guitare. » (avec une capture annotée)
//
// LE RELEVÉ QUI JUSTIFIE LES DEUX : manche 119x70 — haut et étroit —, piano 165x32. Le piano était
// DEUX FOIS moins haut que son voisin, et les commandes du manche, larges et plates, allongeaient
// encore une colonne déjà la plus haute des deux. Poser les commandes à droite occupe un vide qui
// existait déjà ; agrandir le piano rééquilibre la paire.
const { chromium, devices } = require('playwright');
const creerHarnais = require('./_harness');
const { plan, check, exiger, bilan } = creerHarnais('Diagrammes : disposition d\'inspecteur');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';

const seed = () => {
    const mk = (r) => ({ root: r, quality: 'maj', beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
    localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: ['C', 'D'].map(mk) }] }));
};

const lire = () => {
    const q = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { l: Math.round(r.width), h: Math.round(r.height), g: Math.round(r.left), d: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom) }; };
    const wrap = document.querySelector('.guitar-viz-wrap');
    return {
        carte: q('.viz-card'), piano: q('#piano-viz'), manche: q('#guitar-viz'),
        colManche: q('.guitar-viz-col'), commandes: q('.guitar-controls-cote'),
        nav: q('#guitar-nav'), edit: q('#guitar-edit-btn'), bascules: q('.viz-toggle'),
        niveaux: [...document.querySelectorAll('.guitar-controls-cote .guitar-niveau')]
            .map(n => ({ h: Math.round(n.getBoundingClientRect().top), boutons: [...n.querySelectorAll('button')].map(b => b.id) })),
        debordePage: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        debordeCarte: (() => { const c = document.querySelector('.viz-card'); return c.scrollWidth - c.clientWidth; })(),
    };
};

async function avecGuitare(page) {
    await page.evaluate(() => {
        const b = document.getElementById('toggle-viz-guitar');
        if (b.getAttribute('aria-pressed') !== 'true') b.click();
    });
    await page.waitForTimeout(700);
}

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
    await avecGuitare(page);

    const m = await page.evaluate(lire);

    // === A. Les commandes sont à DROITE du manche, pas dessous ===
    exiger(!!m.manche && !!m.commandes, 'le manche et ses commandes sont là');
    check(m.commandes.g >= m.manche.d, `les commandes commencent à droite du manche — manche finit à ${m.manche.d}, commandes à ${m.commandes.g}`);
    // Le vrai test du « à droite » : elles chevauchent le manche VERTICALEMENT. Un bloc posé plus bas
    // et décalé à droite passerait le test précédent tout en restant, à l'œil, « en dessous ».
    check(m.commandes.t < m.manche.b && m.commandes.b > m.manche.t,
        `et à la même hauteur que lui — manche ${m.manche.t}..${m.manche.b}, commandes ${m.commandes.t}..${m.commandes.b}`);

    // === B. Deux niveaux, et le découpage dit quelque chose ===
    check(m.niveaux.length === 2, `il y a bien deux niveaux — ${m.niveaux.length}`);
    check(m.niveaux[0].h < m.niveaux[1].h, 'le choix du doigté est au-dessus, l\'action en dessous');
    // Niveau 1 = les commandes qui parlent du MÊME choix ; niveau 2 = l'action, isolée.
    check(m.niveaux[0].boutons.includes('guitar-prev') && m.niveaux[0].boutons.includes('guitar-next')
        && m.niveaux[0].boutons.includes('guitar-lock-btn'),
        `niveau 1 : choix du doigté et verrou — ${m.niveaux[0].boutons.join(', ')}`);
    check(m.niveaux[1].boutons.length === 1 && m.niveaux[1].boutons[0] === 'guitar-edit-btn',
        `niveau 2 : la seule action, isolée — ${m.niveaux[1].boutons.join(', ')}`);
    // L'action principale prend toute la largeur de sa colonne, ce qui la distingue des icônes du
    // dessus. Mesuré au premier jet : 40px au lieu de 144 — `.guitar-controls-row` (0,1,0) posait
    // `align-items: center` et, déclarée PLUS BAS dans la feuille, l'emportait à spécificité égale.
    check(m.edit.l >= m.commandes.l - 2,
        `l'action prend toute la largeur de sa colonne — bouton ${m.edit.l}px, colonne ${m.commandes.l}px`);

    // === C. Les bascules d'affichage restent à part, en bord de carte ===
    // Décision prise avec l'utilisateur : elles commandent QUELS diagrammes s'affichent, pas le
    // contenu de l'un d'eux. Les mêler aux réglages du manche brouillerait les deux familles.
    check(m.bascules.g >= m.commandes.d - 2,
        `les bascules piano/guitare restent à l'extrême droite — commandes finissent à ${m.commandes.d}, bascules à ${m.bascules.g}`);

    // === D. Le piano a grandi, et se compare enfin au manche ===
    // AVANT : piano 165x32 contre manche 119x70 — moitié moins haut que son voisin.
    check(m.piano.h >= 40 && m.piano.h <= 52, `le piano a grandi sans devenir encombrant — ${m.piano.h}px de haut (32 avant, 70 pour le manche)`);
    check(m.piano.l > 165, `et s'est élargi dans le même mouvement — ${m.piano.l}px (165 avant)`);
    // « Très légèrement » : il ne doit pas dépasser le manche, qui reste le plus grand des deux.
    check(m.piano.h < m.manche.h, `il reste plus bas que le manche — ${m.piano.h} contre ${m.manche.h}`);

    // === E. Rien ne déborde, et les gestes marchent toujours ===
    check(m.debordeCarte <= 0 && m.debordePage <= 0,
        `rien ne déborde — carte ${m.debordeCarte}px, page ${m.debordePage}px`);
    const avant = await page.evaluate(() => document.getElementById('guitar-nav-label').textContent.trim());
    await page.click('#guitar-next');
    await page.waitForTimeout(400);
    check(await page.evaluate(() => document.getElementById('guitar-nav-label').textContent.trim()) !== avant,
        `un vrai clic sur ▸ change bien de doigté — depuis « ${avant} »`);

    // === F. Au doigt : les commandes doivent repasser SOUS le manche plutôt que l'écraser ===
    // C'est le risque de la disposition en ligne : sur un écran étroit, manche + commandes côte à côte
    // ne tiennent pas. .viz-diagrams passe à la ligne, on vérifie que c'est bien ce qui se produit.
    const ctx = await browser.newContext({ ...devices['iPhone 13'], hasTouch: true });
    const tel = await ctx.newPage();
    tel.on('pageerror', e => erreurs.push('téléphone : ' + e.message));
    await tel.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await tel.waitForTimeout(250);
    await tel.evaluate(seed);
    await tel.reload({ waitUntil: 'load' });
    await tel.waitForTimeout(900);
    await avecGuitare(tel);
    const t = await tel.evaluate(lire);
    check(t.debordeCarte <= 0 && t.debordePage <= 0,
        `téléphone : rien ne déborde — carte ${t.debordeCarte}px, page ${t.debordePage}px`);
    const cibles = await tel.evaluate(() => ['#guitar-prev', '#guitar-next', '#guitar-edit-btn']
        .map(s => { const e = document.querySelector(s); const r = e.getBoundingClientRect(); return { s, l: Math.round(r.width), h: Math.round(r.height) }; }));
    check(cibles.every(c => c.l >= 28 && c.h >= 28),
        `téléphone : les commandes restent tactiles — ${cibles.map(c => c.l + 'x' + c.h).join(' ')}`);

    // === G. LES BASCULES SURVIVENT AUX DIAGRAMMES MASQUÉS ===
    // RÉGRESSION RÉELLE, signalée par l'utilisateur : « j'ai perdu mes boutons de diagrammes ».
    // En déplaçant les commandes du manche, une <div> ouverte sans fermeture au bon niveau avait mis
    // .viz-toggle À L'INTÉRIEUR de .viz-diagrams. Or `.col-right.diagrams-hidden .viz-diagrams` passe
    // en display:none quand les deux diagrammes sont masqués : les bascules disparaissaient avec lui,
    // et il ne restait AUCUN moyen de les rouvrir — un cul-de-sac, pas seulement un défaut d'affichage.
    // Ce point garde les deux choses : la parenté (structurelle) et le résultat (visible au doigt).
    await tel.evaluate(() => {
        const pi = document.getElementById('toggle-viz-piano'), gu = document.getElementById('toggle-viz-guitar');
        if (pi.getAttribute('aria-pressed') === 'true') pi.click();
        if (gu.getAttribute('aria-pressed') === 'true') gu.click();
    });
    await tel.waitForTimeout(800);
    const masques = await tel.evaluate(() => {
        const t = document.querySelector('.viz-toggle');
        const r = t.getBoundingClientRect();
        return {
            etatMasque: document.querySelector('.col-right').classList.contains('diagrams-hidden'),
            dansVizDiagrams: !!t.closest('.viz-diagrams'),
            visible: t.offsetParent !== null && r.width > 2 && r.height > 2,
            taille: `${Math.round(r.width)}x${Math.round(r.height)}`,
        };
    });
    exiger(masques.etatMasque, 'téléphone : les deux diagrammes sont bien masqués');
    check(!masques.dansVizDiagrams,
        'les bascules ne sont PAS dans .viz-diagrams : c\'est lui qui disparaît, elles doivent rester');
    check(masques.visible, `et elles restent visibles pour pouvoir rouvrir un diagramme — ${masques.taille}`);
    // Le geste qui sort du cul-de-sac : un vrai appui doit ramener un diagramme.
    await tel.tap('#toggle-viz-piano');
    await tel.waitForTimeout(700);
    check(await tel.evaluate(() => !document.querySelector('.col-right').classList.contains('diagrams-hidden')),
        'un appui sur la bascule piano ramène bien le diagramme');

    check(erreurs.length === 0, `aucune erreur JavaScript — ${erreurs.join(' | ') || 'aucune'}`);
    await browser.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
