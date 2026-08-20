// Lot 3 de la refonte : la coquille de l'inspecteur — dire d'un coup d'œil DE QUOI il parle.
//
// RETOUR UTILISATEUR : « Pas assez de différences pour l'ajout et la modification, je confonds les
// volets et je ne sais pas en quel mode je suis. »
//
// MESURE D'AVANT-TRAVAUX, champ par champ. Les deux états partageaient EXACTEMENT les mêmes
// commandes : mêmes deux grands menus (fondamentale et nature, 158x38 chacun), même instrument, même
// curseur d'intensité, même bouton de séquenceur. Trois choses seulement différaient — la croix
// « terminer » et la loupe « montrer dans la grille » apparaissaient, le bloc Ajouter/À la suite
// s'en allait — et la seule différence VISUELLE était la couleur d'une ligne de texte de 13px de
// haut, vert contre ambre, au sommet d'une carte de 106px. La confusion signalée n'avait rien
// d'étonnant.
//
// CE QUE LE BANC ÉPROUVE. Pas « la couleur est bien celle-ci » — un banc qui recopie la feuille de
// style ne prouve rien. Il éprouve que les deux états sont RÉELLEMENT DISTINGUABLES : que les
// marqueurs existent, qu'ils changent bien entre les deux, qu'ils portent sur les DEUX cartes de
// l'inspecteur (l'instrument appartient au même sujet que la fondamentale), et qu'ils reviennent en
// arrière quand on quitte l'édition.
//
// ET UNE GARDE CONTRE UNE FAUSSE BONNE IDÉE. Sur téléphone, l'inspecteur reste à 76 % hors écran
// après une sélection (mesuré : son sommet à 637px sur un écran de 664px). Le réflexe est de le
// faire remonter à la vue. C'est exactement ce que faisait l'appli, et ça a été RETIRÉ sur retour
// utilisateur — « ça scrolle tout de suite en bas » en Modification, sur téléphone, parce que la
// grille et l'inspecteur partagent le même flux de défilement et que la page filait loin des accords
// à chaque accord touché (voir la fin de editChord dans script.js). Le banc vérifie donc que
// sélectionner un accord au doigt ne fait PAS défiler la page : la prochaine personne tentée de
// « corriger » ce 76 % hors écran se heurtera à un banc rouge et à cette explication, au lieu de
// rejouer un aller-retour déjà arbitré.
const { chromium, devices } = require('playwright');
const creerHarnais = require('./_harness');
const { plan, check, exiger, bilan } = creerHarnais('Inspecteur : dire de quoi il parle');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';

const seed = () => {
    const mk = (r, q, b) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
    const song = {
        id: 'lot3-inspecteur', name: 'Ballade', bpm: 120, timeSig: '4/4', groove: 'straight',
        sections: [{ title: 'Couplet', chords: [mk('C', 'maj7', 4), mk('F', 'maj', 4), mk('G', '7', 4)] }],
    };
    localStorage.setItem('harmohubSongs', JSON.stringify([song]));
    localStorage.setItem('harmohubCurrentSongId', song.id);
    localStorage.setItem('myProgression', JSON.stringify({ sections: song.sections }));
};

// Les marqueurs, lus tels que le navigateur les calcule — pas tels que la feuille de style les écrit.
const marqueurs = () => {
    const acc = document.getElementById('accord-card');
    const lec = document.getElementById('lecture-card');
    const lab = document.getElementById('accord-title-label');
    const sym = document.getElementById('accord-title-sym');
    const sAcc = getComputedStyle(acc), sLec = getComputedStyle(lec), sLab = lab ? getComputedStyle(lab) : null;
    return {
        liseréAccord: sAcc.borderLeftColor,
        liseréLecture: sLec.borderLeftColor,
        largeurLiseré: parseFloat(sAcc.borderLeftWidth) || 0,
        fondAccord: sAcc.backgroundImage,
        pastille: lab ? {
            texte: (lab.textContent || '').trim(),
            fond: sLab.backgroundColor,
            cadre: sLab.borderTopColor,
            encadree: parseFloat(sLab.borderTopWidth) > 0,
            large: lab.getBoundingClientRect().width,
        } : null,
        symbole: sym ? (sym.textContent || '').trim() : null,
        sujetExistant: acc.classList.contains('subject-existing'),
        mode: window.app.appMode,
    };
};

async function eprouverLesDeuxEtats(page, contexte) {
    await page.evaluate(() => { if (window.app.appMode === 'edit') window.app.exitEditMode(); });
    await page.waitForTimeout(350);
    const ajout = await page.evaluate(marqueurs);
    exiger(ajout.mode === 'add', `${contexte} : on part bien en mode Ajout`);

    await page.evaluate(() => window.app.editChord(0, 1));
    await page.waitForTimeout(400);
    const modif = await page.evaluate(marqueurs);
    exiger(modif.mode === 'edit', `${contexte} : on passe bien en Modification`);

    // 1. Le liseré existe vraiment, et il est assez large pour se voir de loin.
    check(ajout.largeurLiseré >= 3 && modif.largeurLiseré >= 3,
        `${contexte} : le liseré de sujet fait au moins 3px — ${ajout.largeurLiseré}px`);

    // 2. LE point : les deux états ne se ressemblent pas. On ne code aucune couleur en dur ici — on
    //    exige seulement qu'elles DIFFÈRENT. Une refonte de palette ne doit pas faire rougir ce banc,
    //    mais un retour à deux états identiques, si.
    check(ajout.liseréAccord !== modif.liseréAccord,
        `${contexte} : le liseré change entre Ajout et Modification — « ${ajout.liseréAccord} » puis « ${modif.liseréAccord} »`);
    check(ajout.fondAccord !== modif.fondAccord,
        `${contexte} : la teinte de fond change aussi entre les deux états`);

    // 3. Les DEUX cartes portent la marque : l'instrument et l'intensité appartiennent au même sujet
    //    que la fondamentale et la nature. N'en teinter qu'une ferait croire à deux sujets.
    check(ajout.liseréLecture === ajout.liseréAccord && modif.liseréLecture === modif.liseréAccord,
        `${contexte} : les cartes Accord et Lecture portent la MÊME marque de sujet`);

    // 4. La pastille d'état : encadrée (donc lue comme un marqueur, pas comme un intitulé), et son
    //    texte dit lequel des deux états.
    if (exiger(!!ajout.pastille && !!modif.pastille, `${contexte} : la pastille d'état existe dans les deux cas`)) {
        check(ajout.pastille.encadree && modif.pastille.encadree,
            `${contexte} : la pastille est bien encadrée, pas un simple texte coloré`);
        check(ajout.pastille.fond !== modif.pastille.fond,
            `${contexte} : le fond de la pastille change d'un état à l'autre`);
        check(ajout.pastille.texte !== modif.pastille.texte && ajout.pastille.texte.length > 0 && modif.pastille.texte.length > 0,
            `${contexte} : la pastille NOMME l'état — « ${ajout.pastille.texte} » puis « ${modif.pastille.texte} »`);
    }

    // 5. Le symbole de l'accord est à côté de la pastille, pas dedans : on lit « [MODIFIER] F », l'état
    //    d'un côté, le sujet de l'autre. En Ajout il n'y a pas de sujet, donc pas de symbole.
    check(modif.symbole && modif.symbole.length > 0 && !ajout.symbole,
        `${contexte} : le symbole de l'accord n'apparaît qu'en Modification — « ${modif.symbole || '(vide)'} »`);

    // 6. Et ça revient en arrière : un marqueur qui ne se retire pas est pire qu'aucun marqueur.
    await page.evaluate(() => window.app.exitEditMode());
    await page.waitForTimeout(400);
    const retour = await page.evaluate(marqueurs);
    check(retour.liseréAccord === ajout.liseréAccord && !retour.sujetExistant,
        `${contexte} : quitter l'édition remet la marque d'Ajout — « ${retour.liseréAccord} »`);
}

(async () => {
    plan(20);
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const erreurs = [];

    console.log('=== A. Ordinateur ===');
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', e => erreurs.push('ordinateur : ' + e.message));
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await page.waitForTimeout(300);
    await page.evaluate(seed);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(650);
    await eprouverLesDeuxEtats(page, 'ordinateur');
    await page.close();

    console.log('\n=== B. Téléphone : mêmes marqueurs ===');
    const ctx = await browser.newContext({ ...devices['iPhone 13'] });
    const m = await ctx.newPage();
    m.on('pageerror', e => erreurs.push('téléphone : ' + e.message));
    await m.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await m.waitForTimeout(300);
    await m.evaluate(seed);
    await m.reload({ waitUntil: 'load' });
    await m.waitForTimeout(700);
    await eprouverLesDeuxEtats(m, 'téléphone');

    console.log('\n=== C. GARDE : sélectionner un accord au doigt ne doit PAS faire défiler la page ===');
    // Voir l'explication en tête de fichier. Ce n'est pas une propriété qu'on a ajoutée, c'est une
    // décision déjà arbitrée qu'on protège : « ça scrolle tout de suite en bas ».
    await m.evaluate(() => { if (window.app.appMode === 'edit') window.app.exitEditMode(); });
    await m.evaluate(() => (document.scrollingElement || document.documentElement).scrollTo(0, 0));
    await m.waitForTimeout(400);
    const avant = await m.evaluate(() => Math.round((document.scrollingElement || document.documentElement).scrollTop));
    const cdp = await ctx.newCDPSession(m);
    const cible = await m.evaluate(() => {
        const c = document.querySelectorAll('.grid-cell')[1];
        if (!c) return null;
        const r = c.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height * 0.85 };
    });
    if (exiger(!!cible, 'téléphone : une case d\'accord est atteignable au doigt')) {
        // Double-tap réel : c'est le geste qui entre en Modification.
        for (let i = 0; i < 2; i++) {
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cible.x, y: cible.y }] });
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            if (i === 0) await m.waitForTimeout(120);
        }
        await m.waitForTimeout(900); // large : un défilement doux mettrait du temps à se voir
        const apres = await m.evaluate(() => Math.round((document.scrollingElement || document.documentElement).scrollTop));
        const mode = await m.evaluate(() => window.app.appMode);
        exiger(mode === 'edit', `téléphone : le double-tap entre bien en Modification — mode ${mode}`);
        check(apres === avant,
            `téléphone : la page n'a pas bougé d'un pixel — défilement ${avant} puis ${apres} (« ça scrolle tout de suite en bas », retour utilisateur)`);
    }

    check(erreurs.length === 0, `aucune erreur JavaScript — ${erreurs.join(' | ') || 'aucune'}`);
    await browser.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
