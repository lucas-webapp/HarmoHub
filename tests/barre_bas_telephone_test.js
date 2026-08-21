// Lot 5 : la barre du bas fusionne ses deux rangées et porte deux accès de secours (téléphone).
//
// LA MESURE QUI A DÉCIDÉ DU LOT. Sur iPhone 13 (fenêtre de 664px, page de 1314px), un accord en cours
// de modification : SIX commandes sur neuf sont hors écran — ouvrir le petit séquenceur (838px),
// l'instrument (838), l'intensité (936), le motif rythmique (880), et même « terminer la
// modification » (653). Tout ce qui vit dans la carte Lecture n'est atteignable qu'après avoir fait
// défiler jusqu'en bas, c'est-à-dire en perdant la grille de vue — au moment précis où l'on ne veut
// pas la perdre.
//
// DEUX ACCÈS SEULEMENT, ET C'EST UN CHOIX. Le RYTHME (la porte d'entrée du tiroir, qui porte ensuite
// ses propres outils) et TERMINER (la sortie du mode). L'instrument et l'intensité restent hors
// d'atteinte : c'est signalé plutôt que corrigé en douce, faute de place dans une barre déjà courte.
//
// CE NE SONT PAS DES DOUBLONS, et le banc le vérifie dans les deux sens : sur ordinateur ces boutons
// n'existent pas (les originaux y sont sous les yeux), et sur téléphone les originaux sont
// inatteignables au moment où l'on en a besoin. Un doublon n'en est un que là où l'original est
// atteignable — même raisonnement que le raccourci de motif du tiroir.
//
// LA FUSION EST CE QUI REND CES DEUX BOUTONS GRATUITS. La barre empilait le bloc d'actions d'édition
// au-dessus du transport ; en Modification ce bloc a tous ses boutons masqués et ne portait qu'une
// rangée vide. Les deux nouveaux boutons l'avaient fait passer de 81 à 113px — 40px pris à la grille.
// Fusionnées en une seule rangée, la barre revient à 73px : moins qu'AVANT le lot.
const { chromium, devices } = require('playwright');
const creerHarnais = require('./_harness');
const { plan, check, exiger, bilan } = creerHarnais('Barre du bas : fusion et accès de secours');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';

const seed = () => {
    const mk = (r, q, b, s) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: s || 'held' });
    const song = {
        id: 'lot5', name: 'Ballade', bpm: 120, timeSig: '4/4', groove: 'straight',
        sections: [{ title: 'Couplet', chords: [mk('C', 'maj7', 4), mk('F', 'maj', 4), mk('G', '7', 4)] }],
    };
    localStorage.setItem('harmohubSongs', JSON.stringify([song]));
    localStorage.setItem('harmohubCurrentSongId', song.id);
    localStorage.setItem('myProgression', JSON.stringify({ sections: song.sections }));
};

// « Atteignable » au sens fort, le même que partout dans ce filet : à l'écran ET le clic y arrive.
const sonde = (sel) => {
    const e = document.querySelector(sel);
    if (!e) return { present: false };
    const r = e.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return { present: true, visible: false };
    const dessus = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
        present: true, visible: true,
        dansEcran: r.top >= 0 && r.bottom <= window.innerHeight,
        atteignable: !!dessus && (dessus === e || e.contains(dessus) || dessus.contains(e)),
        x: r.left + r.width / 2, y: r.top + r.height / 2,
        taille: `${Math.round(r.width)}x${Math.round(r.height)}`, h: r.height, l: r.width,
    };
};

(async () => {
    plan(18);
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const erreurs = [];

    console.log('=== A. Téléphone, mode Modification : les deux accès existent et s\'atteignent ===');
    const ctx = await browser.newContext({ ...devices['iPhone 13'] });
    const m = await ctx.newPage();
    m.on('pageerror', e => erreurs.push('téléphone : ' + e.message));
    await m.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await m.waitForTimeout(300);
    await m.evaluate(seed);
    await m.reload({ waitUntil: 'load' });
    await m.waitForTimeout(700);

    // En Ajout, ils n'ont rien à faire là : il n'y a pas d'accord à terminer ni de rythme à régler.
    const enAjout = await m.evaluate(() => ({
        rythme: document.getElementById('dock-rythme').hidden,
        terminer: document.getElementById('dock-terminer').hidden,
    }));
    check(enAjout.rythme && enAjout.terminer,
        'mode Ajout : aucun accès de secours n\'encombre la barre — rien à terminer, aucun rythme à régler');

    await m.evaluate(() => window.app.editChord(0, 1));
    await m.waitForTimeout(500);
    for (const [sel, nom] of [['#dock-rythme', 'l\'accès au rythme'], ['#dock-terminer', 'la sortie du mode']]) {
        const s = await m.evaluate(sonde, sel);
        if (!exiger(s.present && s.visible, `${nom} apparaît en mode Modification`)) continue;
        check(s.dansEcran && s.atteignable, `${nom} est à l'écran et le doigt l'atteint — ${s.taille}`);
        check(s.h >= 28 && s.l >= 24, `${nom} : cible assez grande au doigt — ${s.taille}`);
    }

    console.log('\n=== B. Ils font vraiment ce qu\'ils annoncent, par un VRAI toucher ===');
    // Leçon du défaut signalé sur le tiroir : une commande que l'utilisateur doit ATTEINDRE se pilote
    // par un vrai geste, jamais par la méthode qui se cache derrière — sinon on éprouve le moteur en
    // croyant éprouver l'accès.
    const cdp = await ctx.newCDPSession(m);
    const toucher = async (sel) => {
        const s = await m.evaluate(sonde, sel);
        if (!s.atteignable) return false;
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: s.x, y: s.y }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await m.waitForTimeout(700);
        return true;
    };
    if (exiger(await toucher('#dock-rythme'), 'le bouton Rythme a bien été touché')) {
        check(await m.evaluate(() => window.app.seqOpen === true), 'il ouvre le rythme de l\'accord');
        check(await m.evaluate(() => document.getElementById('dock-rythme').classList.contains('active')),
            'et il se marque comme actif : ouvert, il referme — sans quoi on aurait deux boutons qui ouvrent et aucun qui ferme');
        await toucher('#dock-rythme');
        check(await m.evaluate(() => window.app.seqOpen === false), 'un second toucher le referme bien');
    }
    await m.evaluate(() => { if (window.app.appMode !== 'edit') window.app.editChord(0, 1); });
    await m.waitForTimeout(400);
    if (exiger(await toucher('#dock-terminer'), 'le bouton Terminer a bien été touché')) {
        check(await m.evaluate(() => window.app.appMode === 'add'), 'il termine bien la modification');
        check(await m.evaluate(() => document.getElementById('dock-rythme').hidden),
            'et les deux accès disparaissent avec le mode');
    }

    console.log('\n=== C. La fusion : deux boutons de plus, et la barre RÉTRÉCIT ===');
    // Sans la fusion des deux rangées, ces deux boutons faisaient passer la barre de 81 à 113px, soit
    // 40px pris à la grille sur un écran de 664. Le seuil vise le AVANT (81px), pas une valeur ronde.
    await m.evaluate(() => window.app.editChord(0, 1));
    await m.waitForTimeout(500);
    const barre = await m.evaluate(() => {
        const d = document.querySelector('.dock');
        const r = d.getBoundingClientRect();
        const enfants = [...d.children].filter(c => c.getBoundingClientRect().height > 0);
        // Une seule rangée = tous les enfants visibles se recoupent verticalement.
        const rects = enfants.map(c => c.getBoundingClientRect());
        const uneRangee = rects.every(a => rects.every(b => Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 4));
        return { h: Math.round(r.height), nb: enfants.length, uneRangee };
    });
    check(barre.h <= 81, `la barre ne dépasse pas sa hauteur d'avant le lot — ${barre.h}px (81px avant)`);
    check(barre.uneRangee && barre.nb >= 2,
        `ses ${barre.nb} blocs partagent bien UNE seule rangée`);

    console.log('\n=== D. Ordinateur : aucun accès de secours, les originaux y sont sous les yeux ===');
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', e => erreurs.push('ordinateur : ' + e.message));
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await page.waitForTimeout(300);
    await page.evaluate(seed);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(650);
    await page.evaluate(() => window.app.editChord(0, 1));
    await page.waitForTimeout(450);
    const bureau = await page.evaluate(() => ({
        secours: document.getElementById('dock-rythme').hidden && document.getElementById('dock-terminer').hidden,
        // L'original visé n'est plus le bouton icône de l'en-tête (disparu) mais la porte nommée
        // « Séquenceur » de la carte Accord — ce qui compte ici est qu'un accès au séquenceur soit
        // DÉJÀ à l'écran sur ordinateur, ce qui rend l'accès de secours inutile.
        originalSeq: (() => { const e = document.getElementById('seq-zoom'); const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight; })(),
        originalClose: (() => { const e = document.getElementById('accord-close'); const r = e.getBoundingClientRect(); return !e.hidden && r.top >= 0 && r.bottom <= window.innerHeight; })(),
    }));
    check(bureau.secours, 'ordinateur : aucun accès de secours — ce serait le doublon qu\'on veut éviter');
    check(bureau.originalSeq && bureau.originalClose,
        'ordinateur : et pour cause, le bouton du séquenceur ET la croix de fermeture y sont déjà à l\'écran');

    console.log('\n=== E. Non-régression de libellé : « Ajouter section » ===');
    // Signalé par l'utilisateur : « Tu avais également modifié l'encadré vert "Ajouter une partie" en
    // "Ajouter section" sous la grille, j'ai l'impression que cela a régressé. » Vérifié dans
    // l'historique : le commit 69d70ea avait bien renommé le bouton, et ee19b67 — celui qui le passait
    // en vert — a réécrit la ligne entière et remis l'ancien libellé au passage. Un banc plutôt qu'une
    // promesse : c'est le genre de retour en arrière qu'une réécriture de ligne refait sans le vouloir.
    const libelle = await page.evaluate(() => (document.getElementById('add-section').textContent || '').trim());
    check(libelle === 'Ajouter section', `le bouton sous la grille dit « ${libelle} » (attendu « Ajouter section »)`);

    check(erreurs.length === 0, `aucune erreur JavaScript — ${erreurs.join(' | ') || 'aucune'}`);
    await browser.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
