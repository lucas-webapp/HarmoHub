// Lot 4 bis-B : le petit séquenceur devient un TIROIR FLOTTANT sur téléphone.
//
// IDÉE DE L'UTILISATEUR : « J'ai bien envie de garder l'idée du "Petit séquenceur"... Il est plus
// simple à utiliser que le grand séquenceur qui demande un grand écran », puis « Le séquenceur
// pourrait apparaitre dans un popover également, non ? »
//
// LA MESURE A RESTREINT LE LOT À UN SEUL FORMAT, et c'est le point le plus important de ce banc.
// Sur ORDINATEUR, ouvrir le petit séquenceur ne coûte RIEN : la grille reste à 162px avec ses 236px
// visibles, le séquenceur vivant dans la colonne de gauche juste sous les commandes de l'accord. Le
// faire flotter par-dessus la grille y serait une régression pure — donc on n'y touche pas, et le
// banc l'exige. Sur TÉLÉPHONE, l'ouvrir laissait 0px de grille visible : le séquenceur vit tout en bas
// de la colonne empilée, et le défilement automatique qui l'amenait à l'écran emportait la grille à
// -455px.
//
// L'ARITHMÉTIQUE DE L'ÉCRAN, faite avant de dessiner : sur un iPhone 13 (664px), 345px au-dessus de la
// grille + 230px de grille + 221px de séquenceur + 81px de barre de lecture = 877px à loger dans 664.
// Il manque 213px. L'objectif n'est donc pas de tout montrer, mais de voir L'ACCORD QU'ON TRAVAILLE
// et son rythme — d'où un défilement qui vise la case éditée au lieu de centrer le séquenceur.
const { chromium, devices } = require('playwright');
const creerHarnais = require('./_harness');
const R = require('./_retrait_ancien');
const { plan, check, exiger, bilan } = creerHarnais('Petit séquenceur : tiroir flottant sur téléphone');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';

const seed = () => {
    const mk = (r, q, b, s) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: s || 'held' });
    const song = {
        id: 'lot4bisB', name: 'Ballade', bpm: 120, timeSig: '4/4', groove: 'straight',
        sections: [{ title: 'Couplet', chords: [mk('C', 'maj7', 4), mk('F', 'maj', 4), mk('G', '7', 4), mk('A', 'min', 4)] }],
    };
    localStorage.setItem('harmohubSongs', JSON.stringify([song]));
    localStorage.setItem('harmohubCurrentSongId', song.id);
    localStorage.setItem('myProgression', JSON.stringify({ sections: song.sections }));
};

const etat = () => {
    const a = document.getElementById('arp-sequencer');
    const r = a.getBoundingClientRect();
    const cell = window.app.editingIndex != null ? window.app.gridCellEl(window.app.activeSection, window.app.editingIndex) : null;
    const c = cell ? cell.getBoundingClientRect() : null;
    const dock = document.querySelector('.dock');
    const d = dock ? dock.getBoundingClientRect() : null;
    const g = document.querySelector('#progression-sections').getBoundingClientRect();
    return {
        ouvert: window.app.seqOpen,
        tiroir: a.classList.contains('seq-tiroir'),
        position: getComputedStyle(a).position,
        seq: { t: Math.round(r.top), b: Math.round(r.bottom), h: Math.round(r.height) },
        // La case de l'accord édité doit être visible AU-DESSUS du tiroir : c'est tout l'objet du lot.
        caseVisible: !!c && c.top >= 0 && c.bottom <= r.top,
        case: c ? { t: Math.round(c.top), b: Math.round(c.bottom) } : null,
        recouvreBarre: !!d && r.bottom > d.top + 1,
        grilleVisible: Math.round(Math.max(0, Math.min(g.bottom, r.top) - Math.max(g.top, 0))),
        grilleTop: Math.round(g.top),
        // Le corps ne doit PAS être verrouillé : ce n'est pas une fenêtre modale, la page continue de
        // défiler derrière le tiroir.
        corpsVerrouille: document.body.classList.contains('body-scroll-locked'),
        vh: window.innerHeight,
    };
};

(async () => {
    plan(13);
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const erreurs = [];

    console.log('=== A. Téléphone : le tiroir flotte, et il laisse voir l\'accord qu\'on travaille ===');
    const ctx = await browser.newContext({ ...devices['iPhone 13'] });
    const m = await ctx.newPage();
    m.on('pageerror', e => erreurs.push('téléphone : ' + e.message));
    await m.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await m.waitForTimeout(300);
    await m.evaluate(seed);
    await m.reload({ waitUntil: 'load' });
    await m.waitForTimeout(700);
    // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4c, 12/11, « réécriture courte ») : le tiroir flottant du petit séquenceur (lot 4 bis-B) a disparu avec lui. Ses
    // exigences passent au panneau d'accord, onglet Rythme, qui le remplace au téléphone : il laisse voir l'accord qu'on travaille, ne recouvre pas la barre de
    // lecture, ne verrouille pas la page, ses cases sont atteignables, il reste ouvert quand on change d'accord ou qu'on touche la grille, et sa sortie (×)
    // se touche pour de vrai.
    await m.tap('#progression-sections .grid-cell[data-section="0"][data-index="1"]'); await m.waitForTimeout(400);
    let rt = await R.ouvrirRythmeTel(m);
    exiger(rt.ok, `l'onglet Rythme est ouvert sur l'accord choisi (${rt.detail})`);
    const tel = await m.evaluate(() => {
        const pa = document.getElementById('panneau-accord').getBoundingClientRect(), bl = document.getElementById('barre-lecture').getBoundingClientRect();
        const haut = document.querySelector('.top-bar').getBoundingClientRect(), nom = document.querySelector('#panneau-accord .pa-nom'), ch = document.querySelector('#sq-grille .sq-nom.choisi');
        return { sur: window.app._bulle.index, recouvreBarre: pa.bottom > bl.top + 1, plein: Math.abs(pa.top - haut.bottom) <= 2, nomVisible: !!nom && nom.getBoundingClientRect().height > 0 && !!ch && ch.getBoundingClientRect().height > 0, verrou: getComputedStyle(document.body).overflow === 'hidden' };
    });
    // 13/11, PLEIN ÉCRAN (« sur portable, il serait peut-être plus simple de l'afficher en plein écran ») : le panneau Rythme couvre la grille, de la barre du haut à la barre de lecture ;
    // l'accord qu'on travaille se lit dans son en-tête et en surbrillance dans la grille de croches (avant : la case restait visible AU-DESSUS du panneau).
    check(tel.sur === 1 && tel.plein && tel.nomVisible, `il occupe tout l'écran entre les deux barres, l'accord qu'on travaille se lit dans son en-tête et dans la grille de croches (accord ${tel.sur})`);
    check(!tel.recouvreBarre, 'il ne recouvre pas la barre de lecture');
    // 13/11 : en PLEIN ÉCRAN, la page est figée derrière lui (« au lieu de scroller sur le séquenceur, c'est l'arrière-plan qui défile ») ; elle est rendue à la fermeture (parties E ci-dessous).
    check(tel.verrou, 'la page est figée derrière le séquenceur plein écran (le glissé ne la fait plus défiler)');

    console.log('\n=== B. Ses cases restent atteignables : un toucher pose, un autre enlève ===');
    rt = await R.poserCrocheTel(m);
    check(rt.ok, `un toucher atteint bien les cases (${rt.detail})`);

    console.log('\n=== C. Il RESTE ouvert quand on change d\'accord, et se recharge sur le nouveau ===');
    rt = await R.suivantTel(m);
    check(rt.ok, `› / ‹ ne referment pas le panneau, le séquenceur suit (${rt.detail})`);

    console.log('\n=== D. Toucher le nom d\'un autre accord ne le referme pas ===');
    await m.tap('#sq-grille .sq-nom[data-c="2"]'); await m.waitForTimeout(600);
    check(await m.evaluate(() => !!(window.app._bulle && window.app._bulle.rythme) && window.app._bulle.index === 2 && !document.getElementById('panneau-accord').hidden),
        'toucher le nom d\'un autre accord dans la grille de croches : le panneau l\'y suit, toujours sur Rythme (13/11 : la grille d\'accords est couverte)');

    console.log('\n=== E. LA SORTIE : atteignable, et éprouvée par un vrai geste ===');
    rt = await R.fermerRythmeTel(m);
    check(rt.ok, `un vrai toucher sur × referme le panneau (${rt.detail})`);
    await ctx.close();

    console.log('\n=== F. ORDINATEUR : rien ne doit avoir changé ===');
    // Mesuré avant le lot : ouvrir le petit séquenceur y coûte 0px de grille. Le faire flotter y
    // serait une régression, et cette vérification est là pour l'empêcher.
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', e => erreurs.push('ordinateur : ' + e.message));
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await page.waitForTimeout(300);
    await page.evaluate(seed);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(650);
    // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4b, 12/11) : à l'ordinateur, le petit séquenceur de l'inspecteur a disparu (la fenêtre d'accord n'a « pas de ligne
    // Rythme », cahier 3 bis) ; le rythme de l'accord ouvert se règle au séquenceur du bloc « Vues ». Ce que la partie gardait reste vrai pour lui : il ne flotte pas en
    // tiroir, la grille ne bouge pas d'un pixel, aucun défilement n'est déclenché. L'accord est ouvert par le vrai geste (double-clic, « Réglages du son »).
    const porteB = await R.porteInspecteurAbsente(page, 0, 1);
    exiger(porteB.ok, `ordinateur : l'inspecteur n'a plus de petit séquenceur (${porteB.detail})`);
    const grilleTop = () => page.evaluate(() => Math.round(document.querySelector('#progression-sections').getBoundingClientRect().top));
    const avantTop = await grilleTop();
    await R.cliquer(page, '#vue-sequenceur', 700);
    const apresB = await page.evaluate(() => { const q = document.getElementById('sequenceur'); return { ouvert: !q.hidden, position: getComputedStyle(q).position, tiroir: q.classList.contains('seq-tiroir') }; });
    const apresTop = await grilleTop();
    check(apresB.ouvert && !apresB.tiroir && apresB.position !== 'fixed',
        `ordinateur : le séquenceur s'ouvre dans la page, PAS en tiroir flottant — ouvert ${apresB.ouvert}, position ${apresB.position}`);
    check(apresTop === avantTop, `ordinateur : la grille ne bouge pas d'un pixel — ${avantTop}px puis ${apresTop}px`);
    check(await page.evaluate(() => Math.round((document.scrollingElement || document.documentElement).scrollTop)) === 0,
        'ordinateur : aucune page à faire défiler, donc aucun défilement déclenché');

    check(erreurs.length === 0, `aucune erreur JavaScript — ${erreurs.join(' | ') || 'aucune'}`);
    await browser.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
