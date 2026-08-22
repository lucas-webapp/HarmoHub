// La saisie du nom d'accord vit DANS la fenêtre d'édition manuelle, plus derrière elle.
//
// RETOUR UTILISATEUR :
//   « j'ai essayé d'éditer un accord par son nom, c'est pas très pratique pour entrer le nom, la
//     modification se passe derrière sans que je le voie. Au lieu de cela, je préfèrerais que la
//     fenêtre d'écriture soit positionnée dans la fenêtre "pop-up" du menu édition manuelle, avec des
//     boutons valider et choix des diagrammes sur le manche avec le cadenas. »
//
// LE RELEVÉ QUI NOMME LE DÉFAUT, pris avant de toucher au code : la fenêtre occupait y = 289 → 611 ;
// le champ ouvert par le crayon atterrissait à y = 725, soit 114 px SOUS son bord inférieur. Et
// document.elementFromPoint() au centre du champ renvoyait #guitar-edit-overlay : le champ n'était
// pas seulement hors cadre, il était RECOUVERT par le voile de la fenêtre. Il avait le focus — on
// pouvait donc taper dedans à l'aveugle, ce que l'utilisateur a fait — mais ni le voir ni le cliquer.
//
// C'est la vérification centrale de ce banc, et elle porte sur le POINT, pas sur les coordonnées :
// un champ peut être dans le bon rectangle et rester couvert par un voile posé au-dessus.
const { chromium, devices } = require('playwright');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('saisie du nom dans la fenêtre d\'édition manuelle');
plan(31);

const semer = () => {
    const mk = (root, quality) => ({ root, quality, beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
    localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [mk('F', 'maj7'), mk('G', 'maj')] }] }));
};

// Ouvre la fenêtre sur l'onglet « Taper le nom », en partant d'un accord RÉELLEMENT enregistré
// (editChord) — c'est le seul contexte où le verrou s'écrit dans les données, donc le seul où l'on
// peut prouver que le cadenas de la fenêtre fait bien son travail.
async function ouvrirSurUnAccordEnregistre(page) {
    await page.evaluate(semer);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(400);
    if (!(await page.evaluate(() => document.getElementById('toggle-viz-guitar').getAttribute('aria-pressed') === 'true'))) {
        await page.click('#toggle-viz-guitar');
    }
    await page.evaluate(() => window.app.editChord(0, 0));
    await page.waitForTimeout(200);
    await page.click('#guitar-edit-btn');
    await page.waitForTimeout(250);
    await page.click('#guitar-edit-tab-name');
    await page.waitForTimeout(200);
}

const releverGeometrie = () => {
    const modale = document.querySelector('.guitar-edit-modal').getBoundingClientRect();
    const champ = document.getElementById('guitar-name-input');
    const rc = champ.getBoundingClientRect();
    const valider = document.getElementById('guitar-name-validate').getBoundingClientRect();
    const sous = document.elementFromPoint(rc.left + rc.width / 2, rc.top + rc.height / 2);
    return {
        champDansLaModale: document.querySelector('.guitar-edit-modal').contains(champ),
        champDansLeCadre: rc.top >= modale.top && rc.bottom <= modale.bottom,
        elementAuPointDuChamp: sous ? (sous.id || sous.className || sous.tagName) : null,
        champ: { l: Math.round(rc.width), h: Math.round(rc.height), t: Math.round(rc.top) },
        valider: { l: Math.round(valider.width), h: Math.round(valider.height), t: Math.round(valider.top) },
        navVisible: getComputedStyle(document.getElementById('guitar-edit-nav')).display !== 'none',
        cadenasVisible: getComputedStyle(document.getElementById('guitar-edit-lock')).display !== 'none',
        debordeHorizontal: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
};

(async () => {
    const navigateur = await chromium.launch();
    const erreurs = [];

    for (const [ecran, options] of [['ordinateur', { viewport: { width: 1440, height: 900 } }], ['téléphone', devices['iPhone 13']]]) {
        const page = await navigateur.newPage(options);
        page.on('pageerror', e => erreurs.push(`${ecran} : ${e.message}`));
        await page.goto(`${BASE}/index.html?nocache=` + Date.now());
        await page.waitForTimeout(400);
        await ouvrirSurUnAccordEnregistre(page);

        const g = await page.evaluate(releverGeometrie);
        exiger(g.champDansLaModale, `${ecran} : le champ est un descendant de la fenêtre — pas seulement posé par-dessus`);
        check(g.champDansLeCadre, `${ecran} : le champ tient dans le cadre de la fenêtre (avant : 114 px sous son bord)`);
        check(g.elementAuPointDuChamp === 'guitar-name-input',
            `${ecran} : le point au centre du champ atteint LE CHAMP — avant, il atteignait guitar-edit-overlay (obtenu : ${g.elementAuPointDuChamp})`);
        check(g.champ.h === g.valider.h && g.champ.t === g.valider.t,
            `${ecran} : « Valider » a la même hauteur et la même ligne que le champ (${g.champ.h}/${g.valider.h} px, y ${g.champ.t}/${g.valider.t})`);
        check(g.valider.l < 200, `${ecran} : « Valider » ne s'étire pas sur toute la largeur (${g.valider.l} px — la règle générique button{flex:1} le poussait à 410)`);
        check(g.navVisible && g.cadenasVisible, `${ecran} : le choix du doigté et le cadenas sont présents dans la fenêtre, comme demandé`);
        check(!g.debordeHorizontal, `${ecran} : rien ne déborde horizontalement`);

        await page.close();
    }

    // ---------- Le reste sur ordinateur : le comportement, une fois la géométrie acquise ----------
    const page = await navigateur.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', e => erreurs.push(`comportement : ${e.message}`));
    await page.goto(`${BASE}/index.html?nocache=` + Date.now());
    await page.waitForTimeout(400);
    await ouvrirSurUnAccordEnregistre(page);

    // Le crayon a disparu : il n'existait que pour FAIRE APPARAÎTRE le champ, qui est maintenant là.
    check(await page.locator('#guitar-override-btn').count() === 0,
        'le crayon qui ouvrait la saisie a disparu — le champ est là en permanence, il n\'y a plus rien à déplier');
    // Le bandeau, lui, reste à sa place : il AFFICHE le substitut au-dessus du diagramme. Rôle
    // différent, emplacement différent — c'est la confusion des deux qui avait produit le défaut.
    check(await page.evaluate(() => !!document.querySelector('.guitar-viz-col > #guitar-override-row')),
        'le bandeau d\'affichage du substitut reste, lui, au-dessus du petit diagramme');

    // --- Valider à la souris ---
    await page.fill('#guitar-name-input', 'Em');
    await page.click('#guitar-name-validate');
    await page.waitForTimeout(300);
    let r = await page.evaluate(() => ({
        enregistre: loadProgressionSections()[0].chords[0].guitarOverride,
        bandeau: document.querySelector('#guitar-override-row .chord-title')?.textContent,
        champ: document.getElementById('guitar-name-input').value,
        fenetre: !document.getElementById('guitar-edit-overlay').hidden,
    }));
    check(r.enregistre && r.enregistre.root === 'E' && r.enregistre.quality === 'min', `le bouton Valider écrit bien le substitut (${JSON.stringify(r.enregistre)})`);
    check(r.bandeau === 'Em', `le bandeau au-dessus du diagramme affiche Em (obtenu ${r.bandeau})`);
    check(r.champ === 'Em', 'le champ garde ce qui vient d\'être appliqué, il ne se vide pas sous les doigts');
    check(r.fenetre, 'la fenêtre reste ouverte après validation — on peut enchaîner sur le doigté');

    // --- Valider au clavier : même effet, autre geste ---
    await page.fill('#guitar-name-input', 'Bbadd9');
    await page.locator('#guitar-name-input').press('Enter');
    await page.waitForTimeout(300);
    r = await page.evaluate(() => loadProgressionSections()[0].chords[0].guitarOverride);
    check(r && r.root === 'A#' && r.quality === 'add9', `Entrée valide aussi (${JSON.stringify(r)})`);

    // --- Perdre le focus ne valide RIEN : le champ ne disparaît plus après usage, valider au blur
    //     appliquerait un accord au moindre clic ailleurs dans la fenêtre. ---
    await page.fill('#guitar-name-input', 'Dm');
    await page.click('#guitar-edit-title');
    await page.waitForTimeout(250);
    r = await page.evaluate(() => loadProgressionSections()[0].chords[0].guitarOverride);
    check(r && r.quality === 'add9', `cliquer ailleurs n'applique rien — le substitut reste Bbadd9 (${JSON.stringify(r)})`);

    // --- Échap remet le champ au diapason, sans rien appliquer ---
    await page.fill('#guitar-name-input', 'Zz9');
    await page.locator('#guitar-name-input').press('Escape');
    await page.waitForTimeout(200);
    r = await page.evaluate(() => ({ champ: document.getElementById('guitar-name-input').value, donnees: loadProgressionSections()[0].chords[0].guitarOverride }));
    // Le champ réaffiche l'accord dans l'ORTHOGRAPHE DE L'APPLI, celle du bandeau juste à côté : « B♭ »
    // avec un vrai bémol typographique, là où l'on avait tapé « Bb ». C'est voulu — deux orthographes
    // pour un même accord à trente centimètres l'une de l'autre, ce serait le défaut. Et c'est sans
    // danger pour la suite : parseChordSymbol accepte le ♭ typographique aussi bien que le b ASCII
    // (vérifié), donc le contenu réaffiché reste re-validable tel quel.
    check(/^(Bb|B♭)add9$/.test(r.champ), `Échap remet le nom réellement en vigueur (obtenu ${r.champ})`);
    const relu = await page.evaluate(() => !!parseChordSymbol(document.getElementById('guitar-name-input').value));
    check(relu, 'ce que le champ réaffiche est relisible tel quel — pas un texte qu\'il faudrait retaper');
    check(r.donnees && r.donnees.quality === 'add9', 'Échap n\'applique rien');

    // --- Texte non reconnu : on prévient, on n'applique pas, ET on laisse le texte fautif à corriger ---
    await page.fill('#guitar-name-input', 'XyzPasUnAccord');
    await page.click('#guitar-name-validate');
    await page.waitForTimeout(250);
    r = await page.evaluate(() => ({ donnees: loadProgressionSections()[0].chords[0].guitarOverride, champ: document.getElementById('guitar-name-input').value }));
    check(r.donnees && r.donnees.quality === 'add9', 'un texte non reconnu n\'applique aucun substitut');
    check(r.champ === 'XyzPasUnAccord', 'le texte fautif reste affiché — c\'est lui qu\'on vient corriger, l\'effacer ferait perdre la frappe');

    // --- Champ vidé : on revient à l'accord du morceau ---
    await page.fill('#guitar-name-input', '');
    await page.click('#guitar-name-validate');
    await page.waitForTimeout(300);
    r = await page.evaluate(() => ({ donnees: loadProgressionSections()[0].chords[0].guitarOverride, bandeau: document.getElementById('guitar-override-row').hidden }));
    check(!r.donnees, 'un champ vidé retire le substitut');
    check(r.bandeau, 'et le bandeau au-dessus du diagramme disparaît avec lui');

    // --- Le champ se remet au diapason quand on revient sur l'onglet ---
    await page.fill('#guitar-name-input', 'Em');
    await page.locator('#guitar-name-input').press('Enter');
    await page.waitForTimeout(250);
    await page.click('#guitar-edit-tab-draw');
    await page.waitForTimeout(150);
    await page.click('#guitar-edit-tab-name');
    await page.waitForTimeout(200);
    check(await page.inputValue('#guitar-name-input') === 'Em', 'revenir sur l\'onglet réaffiche le substitut en vigueur, pas un champ vide');

    // --- Les JUMEAUX : choix du doigté et cadenas, demandés dans la fenêtre ---
    const compteurs = await page.evaluate(() => ({
        fenetre: document.getElementById('guitar-edit-nav-label').textContent,
        petit: document.getElementById('guitar-nav-label').textContent,
    }));
    check(compteurs.fenetre === compteurs.petit, `les deux compteurs de doigté disent la même chose (${compteurs.fenetre} / ${compteurs.petit})`);

    const mancheAvant = await page.evaluate(() => document.getElementById('guitar-edit-neck').innerHTML);
    await page.click('#guitar-edit-next');
    await page.waitForTimeout(250);
    const apresSuivant = await page.evaluate(() => ({
        manche: document.getElementById('guitar-edit-neck').innerHTML,
        fenetre: document.getElementById('guitar-edit-nav-label').textContent,
        petit: document.getElementById('guitar-nav-label').textContent,
        index: window.app.guitarFingeringIndex,
    }));
    check(apresSuivant.manche !== mancheAvant, 'la flèche « suivant » de la fenêtre redessine réellement le manche');
    check(apresSuivant.index === 1, `elle avance bien d'un doigté (index ${apresSuivant.index})`);
    check(apresSuivant.fenetre === apresSuivant.petit, `et le compteur du petit diagramme suit (${apresSuivant.petit})`);

    await page.click('#guitar-edit-lock');
    await page.waitForTimeout(300);
    const verrou = await page.evaluate(() => ({
        enregistre: loadProgressionSections()[0].chords[0].guitarLock,
        fenetre: document.getElementById('guitar-edit-lock').getAttribute('aria-pressed'),
        petit: document.getElementById('guitar-lock-btn').getAttribute('aria-pressed'),
    }));
    check(Array.isArray(verrou.enregistre), `le cadenas de la fenêtre écrit bien le verrou dans les données de l'accord (${JSON.stringify(verrou.enregistre)})`);
    check(verrou.fenetre === 'true' && verrou.petit === 'true', `les deux cadenas s'accordent (fenêtre ${verrou.fenetre}, petit ${verrou.petit})`);

    await page.click('#guitar-edit-lock');
    await page.waitForTimeout(300);
    const libere = await page.evaluate(() => ({
        enregistre: loadProgressionSections()[0].chords[0].guitarLock,
        fenetre: document.getElementById('guitar-edit-lock').getAttribute('aria-pressed'),
        petit: document.getElementById('guitar-lock-btn').getAttribute('aria-pressed'),
    }));
    check(!libere.enregistre, 'un second clic libère le verrou');
    check(libere.fenetre === 'false' && libere.petit === 'false', 'et les deux cadenas se rouvrent ensemble');

    check(erreurs.length === 0, `aucune erreur JavaScript (${erreurs.slice(0, 2).join(' | ')})`);
    await navigateur.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
