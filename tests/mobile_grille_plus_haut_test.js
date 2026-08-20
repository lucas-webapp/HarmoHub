// Lot 1 de la refonte : faire remonter la grille d'accords sur téléphone.
//
// Retour utilisateur à l'origine : « Le volet de gauche n'est pas très joli, harmonieux, ni pratique.
// Sur téléphone, il est également mal placé au-dessus des accords. »
//
// MESURE D'AVANT-TRAVAUX : sur un iPhone 13 (390x664), la grille commençait à 376px du haut, soit
// 57 % de l'écran occupé avant d'apercevoir le premier accord. Ce banc fige le résultat obtenu ET,
// surtout, les deux contreparties qu'on a refusé de payer pour l'obtenir.
//
// POURQUOI CE BANC VÉRIFIE AUSSI CE QU'ON N'A PAS FAIT. La solution évidente — poser le nom du
// morceau sur la même ligne que les six boutons — descendait la grille à 310px, neuf pixels de mieux
// que la solution retenue. Elle a été écartée sur mesure : il ne restait que ~95px utiles au nom, et
// « Ballade en Do mineur » y était déjà tronqué. Comme le gain est plus alléchant que la solution
// retenue, quelqu'un (moi le premier, dans six mois) sera tenté d'y revenir : le banc éprouve donc
// explicitement qu'un nom de morceau ordinaire reste ENTIÈREMENT lisible, pour que ce retour en
// arrière soit bruyant.
const { chromium, devices } = require('playwright');
const creerHarnais = require('./_harness');
const { plan, check, exiger, bilan } = creerHarnais('Téléphone : la grille remonte');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';

// Repère d'avant-travaux, mesuré sur le code du 20/08 : la grille démarrait ici. Le banc exige une
// amélioration NETTE (au moins 40px), pas une amélioration quelconque — un gain de 3px passerait
// sinon pour un succès.
const AVANT = 376;
const GAIN_MINIMUM = 40;

const seed = (nom) => {
    const mk = (r, q, b) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
    const song = {
        id: 'lot1-mobile', name: nom, bpm: 120, timeSig: '4/4', groove: 'straight',
        sections: [{ title: 'Couplet', chords: [mk('C', 'maj7', 4), mk('F', 'maj', 4), mk('G', '7', 4), mk('A', 'min', 4)] }],
    };
    localStorage.setItem('harmohubSongs', JSON.stringify([song]));
    localStorage.setItem('harmohubCurrentSongId', song.id);
    localStorage.setItem('myProgression', JSON.stringify({ sections: song.sections }));
};

const mesurer = () => {
    const g = document.querySelector('#progression-sections');
    const c = document.querySelector('#song-card');
    const s = document.querySelector('#song-select');
    // Largeur qu'il FAUDRAIT au nom, mesurée avec la police réellement appliquée au champ.
    const sonde = document.createElement('span');
    sonde.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font:' + getComputedStyle(s).font;
    sonde.textContent = s.options[s.selectedIndex] ? s.options[s.selectedIndex].text : '';
    document.body.appendChild(sonde);
    const besoin = sonde.getBoundingClientRect().width;
    sonde.remove();
    return {
        grille: Math.round(g.getBoundingClientRect().top),
        carte: Math.round(c.getBoundingClientRect().height),
        champ: Math.round(s.getBoundingClientRect().width),
        besoin: Math.round(besoin),
        vh: window.innerHeight,
        debordeLargeur: document.documentElement.scrollWidth > window.innerWidth + 1,
        // Les titres masqués doivent rester ANNONÇABLES : présents, avec leur texte, et non
        // display:none — c'est la différence entre « masqué à l'œil » et « retiré ».
        titres: ['#song-card .card-head h2', '.history-section h2'].map(q => {
            const e = document.querySelector(q);
            if (!e) return { q, present: false };
            const st = getComputedStyle(e);
            const r = e.getBoundingClientRect();
            return { q, present: true, texte: (e.textContent || '').trim(),
                     annoncable: st.display !== 'none' && st.visibility !== 'hidden',
                     invisible: r.width <= 2 && r.height <= 2 };
        }),
    };
};

(async () => {
    plan(12);
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const erreurs = [];
    const ctx = await browser.newContext({ ...devices['iPhone 13'] });
    const m = await ctx.newPage();
    m.on('pageerror', e => erreurs.push(e.message));

    await m.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await m.waitForTimeout(300);
    await m.evaluate(seed, 'Ballade en Do mineur');
    await m.reload({ waitUntil: 'load' });
    await m.waitForTimeout(700);

    const r = await m.evaluate(mesurer);
    exiger(r.vh > 0 && r.vh < 900, `on mesure bien sur un écran de téléphone — ${r.vh}px de haut`);

    const gain = AVANT - r.grille;
    check(gain >= GAIN_MINIMUM,
        `la grille remonte d'au moins ${GAIN_MINIMUM}px — elle commençait à ${AVANT}px, elle commence à ${r.grille}px (gain ${gain}px)`);
    check(r.grille / r.vh < 0.52,
        `moins de 52 % de l'écran avant le premier accord — ${Math.round(r.grille / r.vh * 100)} %`);
    check(r.carte < 160, `la carte Morceau s'est resserrée — ${r.carte}px (166px avant)`);

    console.log('\n=== La contrepartie qu\'on a REFUSÉ de payer ===');
    // ~22px pour la flèche du menu déroulant : le texte n'a jamais toute la largeur du champ.
    const utile = r.champ - 22;
    check(r.besoin <= utile,
        `« Ballade en Do mineur » tient en entier dans le champ — il faut ${r.besoin}px, il y en a ${utile}px d'utiles`);
    check(!r.debordeLargeur, 'aucun débordement horizontal de la page');

    console.log('\n=== Les titres sont masqués à l\'œil, pas retirés ===');
    for (const t of r.titres) {
        if (!t.present) { check(false, `${t.q} : le titre a disparu du document — il devait rester annonçable`); continue; }
        check(t.annoncable && t.invisible && t.texte.length > 0,
            `${t.q} « ${t.texte} » : invisible à l'œil mais toujours annonçable (display ${t.annoncable ? 'conservé' : 'none'}, taille ${t.invisible ? 'réduite' : 'pleine'})`);
    }

    console.log('\n=== Un nom très long tronque proprement, sans casser la mise en page ===');
    await m.evaluate(seed, 'Improvisation du dimanche matin au bord de la rivière');
    await m.reload({ waitUntil: 'load' });
    await m.waitForTimeout(700);
    const r2 = await m.evaluate(mesurer);
    check(!r2.debordeLargeur, 'un nom très long ne fait pas déborder la page en largeur');
    check(Math.abs(r2.grille - r.grille) <= 4,
        `un nom très long ne repousse pas la grille vers le bas — ${r.grille}px puis ${r2.grille}px`);

    console.log('\n=== Sur ORDINATEUR, rien ne doit avoir bougé ===');
    // Les règles du lot vivent toutes dans la requête max-width:899px. Un titre qui disparaîtrait
    // aussi sur grand écran serait une régression silencieuse : le volet de gauche y a besoin de ses
    // intitulés, les cartes n'y étant pas identifiables autrement.
    const bureau = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    bureau.on('pageerror', e => erreurs.push('bureau : ' + e.message));
    await bureau.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await bureau.waitForTimeout(300);
    await bureau.evaluate(seed, 'Ballade en Do mineur');
    await bureau.reload({ waitUntil: 'load' });
    await bureau.waitForTimeout(600);
    const b = await bureau.evaluate(() => ['#song-card .card-head h2', '.history-section h2'].map(q => {
        const e = document.querySelector(q);
        const r = e.getBoundingClientRect();
        return { q, texte: (e.textContent || '').trim(), l: Math.round(r.width), h: Math.round(r.height) };
    }));
    for (const t of b) check(t.l > 20 && t.h > 8, `ordinateur : le titre « ${t.texte} » reste bien visible — ${t.l}x${t.h}px`);

    check(erreurs.length === 0, `aucune erreur JavaScript — ${erreurs.join(' | ') || 'aucune'}`);
    await browser.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
