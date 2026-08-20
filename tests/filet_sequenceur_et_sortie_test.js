// FILET DE REFONTE — Lot 0. Deux familles d'acquis que la refonte met en danger, réunies ici parce
// qu'elles se déclenchent au même moment : quand on touche un accord.
//
// FAMILLE 1 — LE SÉQUENCEUR. Le petit séquenceur doit devenir un « panneau volant » (idée de
// l'utilisateur : « J'ai bien envie de garder l'idée du Petit séquenceur... Il est plus simple à
// utiliser que le grand séquenceur qui demande un grand écran »). Le sortir du flux de la page met
// en jeu quatre choses qui marchent aujourd'hui et qu'on ne verrait pas casser tout de suite :
// l'écriture du rythme dans l'accord, Ctrl+Z, la barre d'espace, et l'exclusion mutuelle avec la
// conduite de voix.
//
// FAMILLE 2 — LA SORTIE D'ÉDITION. Une seule liste, ZONE_EDITION_SELECTEURS, décide ce qui sort du
// mode Modification et ce qui n'en sort pas. Son commentaire dans script.js dit qu'elle a été
// corrigée DOUZE fois, et la dernière correction a consisté à fusionner deux listes qui avaient
// divergé. La refonte remplace la moitié de ses entrées (.col-left, .control-card...) par des
// commandes neuves : le risque n'est pas théorique, c'est le défaut le plus récurrent du projet.
// Retour utilisateur d'origine : « le mode modifier s'enlève dès que je veux scroller, sur
// téléphone ». Et son symétrique, tout aussi voulu : « Je voudrais sortir du mode modification
// lorsque je clique dans un endroit vide dans la grille d'accords. »
//
// LE RÉGLAGE DE Ctrl+Z EST ÉPROUVÉ ICI TEL QU'IL EST AUJOURD'HUI, PAS TEL QU'IL SERA. L'utilisateur
// a demandé de le faire évoluer vers « la dernière action gagne ». Ce banc fige donc uniquement
// l'acquis qui doit survivre à ce changement : séquenceur ouvert, Ctrl+Z reprend bien la dernière
// retouche DU SÉQUENCEUR. Le nouveau cas (retoucher un réglage d'accord séquenceur ouvert) sera
// éprouvé par son propre banc, écrit rouge d'abord, au lot qui l'implémente.
const { chromium, devices } = require('playwright');
const creerHarnais = require('./_harness');
const { plan, check, exiger, bilan } = creerHarnais('Filet : séquenceur volant et sortie d\'édition');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';

const seed = () => {
    const mk = (r, q, b, style) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: style || 'held' });
    const song = {
        id: 'filet-seq-1', name: 'Morceau du filet', bpm: 120, timeSig: '4/4', groove: 'straight',
        // Premier accord en NOIRES DÉTACHÉES, pas en tenu : le style « tenu » allume les 64 cases du
        // séquenceur, et il ne resterait alors aucune case éteinte où poser une note (mesuré). Un
        // style détaché laisse des trous, ce qui permet d'éprouver les DEUX gestes — poser une note
        // sur une case vide, et sélectionner une note existante.
        sections: [{ title: 'Couplet', chords: [mk('C', 'maj7', 4, 'noire_staccato'), mk('F', 'maj', 4), mk('G', '7', 4)] }],
    };
    localStorage.setItem('harmohubSongs', JSON.stringify([song]));
    localStorage.setItem('harmohubCurrentSongId', song.id);
    localStorage.setItem('myProgression', JSON.stringify({ sections: song.sections }));
};
const motif = () => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[0].arpPattern;

// Recherche de case SANS attente : les locators Playwright patientent trente secondes avant
// d'abandonner, ce qui transforme « cette case n'existe pas » en un banc qui meurt en route plutôt
// qu'en une vérification rouge lisible. Ici on lit le DOM tel qu'il est, tout de suite, et on rend
// null si rien ne correspond — au banc de le dire proprement.
const boiteDe = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return null;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

(async () => {
    plan(19);
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const erreurs = [];

    const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
    page.on('pageerror', e => erreurs.push('ordinateur : ' + e.message));
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await page.waitForTimeout(300);
    await page.evaluate(seed);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(500);

    console.log('=== A. Le séquenceur écrit le rythme dans l\'accord, et Ctrl+Z le reprend ===');
    await page.evaluate(() => { window.app.editChord(0, 0); window.app.toggleSequencer('compact'); });
    await page.waitForTimeout(600);
    exiger(await page.evaluate(() => window.app.seqOpen === true), 'le petit séquenceur est bien ouvert');

    const avantMotif = await page.evaluate(motif);
    // VRAI clic de souris sur une case, pas un appel de méthode : c'est la chaîne pointerdown →
    // seqDrag → écriture qu'on veut éprouver, et c'est elle qui traverse tout le code déplacé.
    const nbCases = await page.evaluate(() => document.querySelectorAll('#arp-sequencer .seq-cell[data-voice][data-step]').length);
    if (exiger(nbCases > 0, `des cases du séquenceur sont atteignables — ${nbCases} trouvée(s)`)) {
        // N'IMPORTE QUELLE case : avec le style de jeu « tenu » (celui de l'accord semé), les 64
        // cases sont allumées d'emblée — chercher une case éteinte ferait attendre le banc pour rien.
        // Le clic éteint donc au lieu d'allumer, ce qui convient : on compare deux motifs, pas un sens.
        // Une case ÉTEINTE, et pas une case de bord (.seq-cell-edge). Les deux exclusions viennent
        // de mesures, pas de suppositions : sur une case ALLUMÉE le clic SÉLECTIONNE la note au lieu
        // de l'effacer (comportement voulu, façon station audio — voir plus bas, il est éprouvé
        // aussi), et les cases de bord portent la poignée d'étirement de durée, où un clic lance un
        // redimensionnement.
        const cible = await page.evaluate(boiteDe, '#arp-sequencer .seq-cell[data-voice][data-step]:not(.on):not(.seq-cell-edge)');
        if (exiger(!!cible, 'une case éteinte est disponible pour y poser une note')) {
            // LES DEUX MOITIÉS DE LA RÈGLE, dans l'ordre. Poser une note est un clic-PUIS-GLISSÉ :
            // « c'est pas forcément au glissé, mais lors de la création d'une note plus ou moins
            // longue. La note se crée directement au clic, alors que je veux cliquer, puis définir sa
            // longueur en glissant ». Un clic seul ne doit donc RIEN créer — c'est la moitié qu'on
            // oublie de tester et celle qui reviendrait la première si le panneau volant remettait
            // un raccourci « clic = note ».
            await page.mouse.click(cible.x, cible.y);
            await page.waitForTimeout(350);
            check(await page.evaluate(motif) === avantMotif, 'un clic SEUL ne crée aucune note (la longueur se définit en glissant)');

            const largeurCase = await page.evaluate(() => {
                const c = document.querySelector('#arp-sequencer .seq-cell[data-voice][data-step]');
                return c ? c.getBoundingClientRect().width : 20;
            });
            await page.mouse.move(cible.x, cible.y);
            await page.mouse.down();
            await page.mouse.move(cible.x + largeurCase * 1.5, cible.y, { steps: 6 });
            await page.mouse.up();
            await page.waitForTimeout(400);
            const apresMotif = await page.evaluate(motif);
            check(apresMotif !== avantMotif, `le clic-puis-glissé écrit bien le rythme dans l'accord — motif ${apresMotif === avantMotif ? 'inchangé' : 'modifié'}`);

            await page.keyboard.press('Control+z');
            await page.waitForTimeout(350);
            check(await page.evaluate(motif) === avantMotif, 'Ctrl+Z reprend la retouche du séquenceur');

            // Acquis récent à ne pas perdre : cliquer une note EXISTANTE la sélectionne, elle ne
            // disparaît pas (« sélection de barre ne doit plus déplacer la vue », façon GarageBand).
            // Un panneau volant qui reposerait ses cases à chaque rendu ferait sauter la sélection
            // sans le moindre bruit.
            // Ici on NE peut PAS exclure les cases de bord : une note d'arpège dure un seul pas,
            // elle est donc à la fois son propre début et sa propre fin, et porte les deux classes
            // de bord (mesuré — l'exclure ne laissait plus une seule note à cliquer). On vise le
            // CENTRE de la case, où la poignée d'étirement n'agit pas.
            const existante = await page.evaluate(boiteDe, '#arp-sequencer .seq-cell.on[data-voice][data-step]');
            if (existante) {
                const motifAvantSel = await page.evaluate(motif);
                await page.mouse.click(existante.x, existante.y);
                await page.waitForTimeout(300);
                const sel = await page.evaluate(() => (window.app.seqSelections || []).length);
                check(sel > 0, `cliquer une note existante la SÉLECTIONNE — ${sel} sélection(s)`);
                check(await page.evaluate(motif) === motifAvantSel, 'sélectionner une note ne change pas le rythme de l\'accord');
            } else {
                check(false, 'aucune note existante trouvée pour éprouver la sélection');
                check(false, 'aucune note existante trouvée pour éprouver la sélection (rythme inchangé)');
            }
        }
    }

    console.log('\n=== B. La barre d\'espace reste la lecture, même séquenceur ouvert ===');
    // Piège : un panneau volant qui capterait le clavier (ou un bouton qui garderait le focus)
    // transformerait Espace en « réactiver le dernier bouton cliqué ». L'utilisateur a tranché :
    // « le rythme ouvert ne doit pas détourner le ctrl+Z et la barre espace ».
    await page.evaluate(() => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); });
    const motifAvantEspace = await page.evaluate(motif);
    const lectureAvant = await page.evaluate(() => window.app.isPlaying === true);
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);
    const lectureApres = await page.evaluate(() => window.app.isPlaying === true);
    check(lectureApres !== lectureAvant, `Espace bascule la lecture — ${lectureAvant} → ${lectureApres}`);
    check(await page.evaluate(motif) === motifAvantEspace, 'Espace ne pose aucune note dans le séquenceur');
    await page.keyboard.press('Space'); // on arrête la lecture avant la suite
    await page.waitForTimeout(400);

    console.log('\n=== C. Conduite de voix et séquenceur ne cohabitent pas ===');
    // Les deux occupent la même place sous la grille. Un séquenceur devenu flottant pourrait très
    // bien rester affiché PAR-DESSUS la conduite de voix sans que rien ne proteste : c'est
    // exactement le genre de règle qu'un déplacement de nœud fait sauter en silence.
    await page.evaluate(() => { if (!window.app.seqOpen) window.app.toggleSequencer('compact'); });
    await page.waitForTimeout(300);
    exiger(await page.evaluate(() => window.app.seqOpen === true), 'le séquenceur est rouvert avant l\'essai');
    await page.click('#toggle-voice-leading');
    await page.waitForTimeout(450);
    const etat = await page.evaluate(() => ({ vl: window.app.voiceLeadingOpen, seq: window.app.seqOpen }));
    check(etat.vl === true && etat.seq === false, `ouvrir la conduite de voix referme le séquenceur — conduite ${etat.vl}, séquenceur ${etat.seq}`);
    await page.click('#toggle-voice-leading'); // on referme
    await page.waitForTimeout(350);

    console.log('\n=== D. Sortie du mode Modification : ce qui sort, ce qui ne sort pas ===');
    await page.evaluate(() => window.app.editChord(0, 0));
    await page.waitForTimeout(350);
    exiger(await page.evaluate(() => window.app.appMode === 'edit'), 'on est bien en mode Modification avant les essais');

    // D1. Toucher une COMMANDE d'accord ne doit pas sortir de l'édition. Éprouvé sur trois
    // commandes de familles différentes (menu déroulant, curseur, bouton) : la liste des sélecteurs
    // les attrape aujourd'hui par des règles distinctes ('select', 'input', 'button'), et la refonte
    // ne remplacera pas les trois par la même chose.
    // Ce ne sont PAS les commandes de voicing (renversement, drop, octave, basse) : mesuré en
    // sondant la page, elles vivent aujourd'hui dans un bloc replié #advanced-fields, et la durée
    // comme le style de jeu sont même en display:none en mode Modification. Seuls l'instrument et
    // l'intensité s'offrent directement — ce qui EST le défaut que la refonte doit corriger (« je
    // veux pouvoir rapidement changer une octave, un renversement etc... Sans avoir à ouvrir trop de
    // menus »). Ce banc éprouve donc les commandes réellement à l'écran aujourd'hui ; quand les
    // autres remonteront à la surface, elles rejoindront cette liste.
    for (const [sel, nom] of [['#instrument', "le menu d'instrument"], ['#intensity', "le curseur d'intensité"], ['#toggle-sequencer', 'le bouton du séquenceur']]) {
        const b = await page.evaluate(boiteDe, sel);
        if (!b) { check(false, `${nom} : commande introuvable à l'écran (${sel})`); continue; }
        await page.mouse.click(b.x, b.y);
        await page.waitForTimeout(300);
        const encore = await page.evaluate(() => window.app.appMode === 'edit');
        check(encore, `cliquer ${nom} ne sort PAS du mode Modification`);
        // Le clic sur #toggle-sequencer ouvre/ferme le panneau : on remet l'état d'aplomb pour que
        // les essais suivants partent tous du même point.
        await page.evaluate(() => { if (window.app.appMode !== 'edit') window.app.editChord(0, 0); });
        await page.waitForTimeout(200);
    }

    // D2. Cliquer dans le VIDE de la grille doit, lui, sortir de l'édition — le pendant exact du
    // précédent, et une correction demandée explicitement (.chord-grid est volontairement absent de
    // la liste des sélecteurs pour ça).
    await page.evaluate(() => { if (window.app.appMode !== 'edit') window.app.editChord(0, 0); });
    await page.waitForTimeout(250);
    const vide = await page.evaluate(() => {
        // Un point de la grille situé APRÈS la dernière case, donc sur le fond : on part du bas de la
        // dernière case et on descend, en s'assurant que ce qui répond au clic n'est pas une case.
        const cellules = [...document.querySelectorAll('.grid-cell, .cell-add')];
        if (!cellules.length) return null;
        const derniere = cellules[cellules.length - 1].getBoundingClientRect();
        const grille = document.querySelector('.chord-grid');
        if (!grille) return null;
        const g = grille.getBoundingClientRect();
        for (let y = derniere.bottom + 8; y < g.bottom - 2; y += 6) {
            const x = g.left + g.width / 2;
            const sous = document.elementFromPoint(x, y);
            if (sous && !sous.closest('.grid-cell, .cell-add, .section-head, button, input, select')) return { x, y };
        }
        return null;
    });
    if (exiger(!!vide, 'un point vraiment vide a été trouvé dans la grille d\'accords')) {
        await page.mouse.click(vide.x, vide.y);
        await page.waitForTimeout(400);
        check(await page.evaluate(() => window.app.appMode === 'add'), 'cliquer dans le vide de la grille SORT du mode Modification');
    }

    await page.close();

    console.log('\n=== E. Téléphone : faire défiler au doigt depuis le séquenceur ===');
    // Le défaut historique : « le mode modifier s'enlève dès que je veux scroller, sur téléphone ».
    // Les cases du séquenceur sont en touch-action:none, donc le défilement y est reproduit à la
    // main en JS (voir _scrollableSeqAncestor). Un panneau volant change forcément l'ancêtre
    // défilant trouvé par cette recherche — c'est le point de rupture le plus probable de tout le
    // lot, et il est invisible sur ordinateur.
    const ctx = await browser.newContext({ ...devices['iPhone 13'] });
    const m = await ctx.newPage();
    m.on('pageerror', e => erreurs.push('téléphone : ' + e.message));
    await m.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await m.waitForTimeout(300);
    await m.evaluate(seed);
    await m.reload({ waitUntil: 'load' });
    await m.waitForTimeout(600);
    await m.evaluate(() => { window.app.editChord(0, 0); window.app.toggleSequencer('compact'); });
    await m.waitForTimeout(700);
    exiger(await m.evaluate(() => window.app.seqOpen === true), 'téléphone : le petit séquenceur est ouvert');

    const cdp = await ctx.newCDPSession(m);
    const boite = await m.evaluate(boiteDe, '#arp-sequencer .seq-cell[data-voice][data-step]');
    if (exiger(!!boite, 'téléphone : une case du séquenceur est atteignable au doigt')) {
        const motifAvant = await m.evaluate(motif);
        const posAvant = await m.evaluate(() => {
            const a = window.app._scrollableSeqAncestor();
            return { defile: a.scrollTop, page: (document.scrollingElement || document.documentElement).scrollTop };
        });
        const x = boite.x, y = boite.y;
        // VRAI toucher via CDP : un element.dispatchEvent(new TouchEvent(...)) ne synthétise pas les
        // évènements pointeur dans Chromium, et tout le code de geste serait contourné.
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        for (let d = 8; d <= 120; d += 14) {
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - d }] });
            await m.waitForTimeout(20);
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await m.waitForTimeout(450);

        const posApres = await m.evaluate(() => {
            const a = window.app._scrollableSeqAncestor();
            return { defile: a.scrollTop, page: (document.scrollingElement || document.documentElement).scrollTop };
        });
        const aDefile = posApres.defile !== posAvant.defile || posApres.page !== posAvant.page;
        check(aDefile, `téléphone : le glissé vertical fait défiler — conteneur ${posAvant.defile}→${posApres.defile}, page ${posAvant.page}→${posApres.page}`);
        check(await m.evaluate(motif) === motifAvant, 'téléphone : ce glissé de défilement ne pose AUCUNE note');
        check(await m.evaluate(() => window.app.appMode === 'edit'), 'téléphone : ce glissé ne sort PAS du mode Modification');
    }

    check(erreurs.length === 0, `aucune erreur JavaScript pendant le parcours — ${erreurs.join(' | ') || 'aucune'}`);
    await browser.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
