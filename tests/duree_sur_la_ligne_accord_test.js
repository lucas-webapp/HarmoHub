// La durée remonte sur la ligne de définition de l'accord.
//
// RETOUR UTILISATEUR : « Le bouton "durée" pour un accord dans le volet de gauche prend trop de place
// pour rien. Est-ce que ça te semble être une bonne idée de le remonter au niveau de la définition de
// l'accord (note et type d'accord), en réduisant la largeur des 2 boutons existants sur cette ligne ? »
//
// CE QUI JUSTIFIE LE DÉPLACEMENT, au-delà de la place gagnée : la rangée qui l'accueillait ne
// contenait PLUS QU'ELLE. Elle portait trois groupes (jeu, durée, intensité) ; l'intensité est partie
// au menu contextuel de l'accord, le rythme dans Paramètres > Son — deux lots précédents. Il restait
// une rangée entière, son espacement et son étiquette pour une seule commande.
//
// DEUX COUCHES :
//   - CÂBLAGE (A-C) : la ligne se tient vraiment sur UNE ligne, à trois largeurs d'écran, sans rien
//     tronquer, et le menu s'ouvre encore au clic réel.
//   - MOTEUR (D) : choisir une durée écrit toujours dans #duration, la source de vérité que lisent
//     readChord et les exports. Déplacer un bouton ne doit rien changer à ce qu'il commande.
const { chromium } = require('playwright');
const creerHarnais = require('./_harness');
const { plan, check, exiger, bilan } = creerHarnais('La durée sur la ligne de l\'accord');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';

const seed = () => {
    const mk = (r) => ({ root: r, quality: 'maj', beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
    localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: ['C', 'D'].map(mk) }] }));
};

// Mesure la ligne : les trois commandes sont-elles côte à côte, et de la même hauteur ?
const mesurer = () => {
    const q = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { l: Math.round(r.width), h: Math.round(r.height), t: Math.round(r.top) }; };
    const lbl = document.querySelector('#duration-dd-toggle [data-label-slot]');
    return {
        root: q('#root'), quality: q('#quality'), duree: q('#duration-dd'),
        grille: q('.accord-grid'),
        libelle: lbl ? lbl.textContent.trim() : null,
        // scrollWidth > clientWidth = le texte est coupé par l'ellipsis, donc illisible en entier.
        tronque: lbl ? lbl.scrollWidth > lbl.clientWidth + 1 : null,
        ancienneRangee: !!document.getElementById('lecture-row'),
        colonnes: getComputedStyle(document.querySelector('.accord-grid')).gridTemplateColumns.split(' ').length,
    };
};

async function ouvrir(page, vp) {
    const p = await page.newPage({ viewport: vp });
    await p.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await p.waitForTimeout(250);
    await p.evaluate(seed);
    await p.reload({ waitUntil: 'load' });
    await p.waitForTimeout(800);
    return p;
}

(async () => {
    plan(16);
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const erreurs = [];

    // === A. La ligne tient sur UNE ligne, aux trois largeurs qui comptent ===
    // 1440 (ordinateur), 390 (téléphone courant), 320 (le plus étroit qu'on vise).
    for (const vp of [{ width: 1440, height: 950 }, { width: 390, height: 844 }, { width: 320, height: 640 }]) {
        const p = await ouvrir(browser, vp);
        p.on('pageerror', e => erreurs.push(vp.width + 'px : ' + e.message));
        const m = await p.evaluate(mesurer);
        exiger(!!m.root && !!m.quality && !!m.duree, `${vp.width}px : les trois commandes sont présentes`);
        check(m.root.t === m.quality.t && m.root.t === m.duree.t,
            `${vp.width}px : fondamentale, type et durée sur la MÊME ligne — hauts ${m.root.t}/${m.quality.t}/${m.duree.t}`);
        check(m.root.h === m.duree.h,
            `${vp.width}px : la durée a la même hauteur que ses voisines — ${m.root.h} contre ${m.duree.h}`);
        check(!m.tronque, `${vp.width}px : « ${m.libelle} » se lit en entier`);
        await p.close();
    }

    // === B. Le libellé le PLUS LONG, à la largeur la plus étroite ===
    // « 4 mes. » est le pire cas de la liste (voir #duration dans index.html). C'est lui qu'il faut
    // éprouver à 320px, pas « 1 mes. » qui passe partout — mesurer le cas facile ne prouve rien.
    const etroit = await ouvrir(browser, { width: 320, height: 640 });
    etroit.on('pageerror', e => erreurs.push('320px : ' + e.message));
    await etroit.click('#duration-dd-toggle');
    await etroit.waitForTimeout(250);
    await etroit.click('.duration-dd-item[data-beats="16"]');
    await etroit.waitForTimeout(300);
    const pire = await etroit.evaluate(mesurer);
    check(pire.libelle === '4 mes.', `le pire libellé est bien affiché — « ${pire.libelle} »`);
    check(!pire.tronque, `et il se lit en entier à 320px — « ${pire.libelle} »`);
    await etroit.close();

    // === C. La rangée d'origine a disparu, et le clic réel marche toujours ===
    const p = await ouvrir(browser, { width: 1440, height: 950 });
    p.on('pageerror', e => erreurs.push('ordinateur : ' + e.message));
    const m = await p.evaluate(mesurer);
    check(!m.ancienneRangee, 'la rangée #lecture-row a bien disparu : elle ne portait plus qu\'une commande');
    check(m.colonnes === 3, `la ligne d'accord compte trois colonnes — ${m.colonnes}`);
    await p.click('#duration-dd-toggle');
    await p.waitForTimeout(300);
    check(await p.evaluate(() => !document.getElementById('duration-dd-menu').hidden),
        'un vrai clic ouvre toujours le menu des durées');

    // === D. Couche MOTEUR : la source de vérité reçoit bien le choix ===
    // Déplacer un bouton ne doit RIEN changer à ce qu'il commande. #duration est lu par readChord,
    // l'annulation et les exports MIDI/PDF : c'est lui qu'on regarde, pas l'apparence du bouton.
    const avant = await p.evaluate(() => document.getElementById('duration').value);
    await p.evaluate(() => {
        const items = [...document.querySelectorAll('#duration-dd-menu .duration-dd-item')];
        items.find(i => i.dataset.beats !== document.getElementById('duration').value).click();
    });
    await p.waitForTimeout(300);
    const apres = await p.evaluate(() => document.getElementById('duration').value);
    check(apres !== avant, `choisir une durée écrit bien dans #duration — ${avant} -> ${apres}`);
    check(await p.evaluate(() => document.getElementById('duration-dd-menu').hidden), 'et le menu se referme');

    // === E. En Modification, la durée s'efface — et la ligne se referme sur deux colonnes ===
    // Elle se règle alors en tirant le bord de la case dans la grille (voir l'infobulle du bouton).
    // Sans le rattrapage du gabarit, la ligne garderait une 3e colonne vide et les deux menus
    // resteraient étroits pour rien.
    await p.evaluate(() => window.app.editChord(0, 0));
    await p.waitForTimeout(500);
    const enEdition = await p.evaluate(() => ({
        dureeVisible: getComputedStyle(document.getElementById('duration-dd')).display !== 'none',
        colonnes: getComputedStyle(document.querySelector('.accord-grid')).gridTemplateColumns.split(' ').length,
        largeurRoot: Math.round(document.getElementById('root').getBoundingClientRect().width),
    }));
    check(!enEdition.dureeVisible, 'en Modification, la durée s\'efface de la ligne');
    check(enEdition.colonnes === 2, `et la ligne se referme sur deux colonnes — ${enEdition.colonnes}`);
    check(enEdition.largeurRoot > m.root.l,
        `les deux menus restants reprennent la place libérée — ${m.root.l}px en Ajout, ${enEdition.largeurRoot}px en Modification`);

    check(erreurs.length === 0, `aucune erreur JavaScript — ${erreurs.join(' | ') || 'aucune'}`);
    await browser.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
