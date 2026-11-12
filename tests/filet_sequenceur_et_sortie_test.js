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
const R = require('./_retrait_ancien');
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
    plan(21);
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
    // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4b, 12/11) : le petit séquenceur de l'inspecteur a quitté l'ordinateur ; le rythme de l'accord ouvert s'écrit dans
    // le séquenceur du bloc « Vues » (cahier 3 bis : « le rythme se règle dans le séquenceur, sans le dire »). Ce que la partie gardait reste vrai et est éprouvé EN
    // ENTIER avec les gestes de ce séquenceur-là : un clic pose une croche dans l'accord, Ctrl+Z la reprend ; un glissé peint plusieurs croches d'une seule annulation.
    // (L'ancien contrat « un clic seul ne crée rien, la longueur se tire » et la sélection d'une note appartenaient à l'ancien séquenceur : dans le nouveau, la
    // longueur d'une note est faite de croches soudées, le clic les pose une à une.)
    await page.evaluate(() => window.app.editChord(0, 0)); // l'accord en modification (relevé d'état, pas un geste éprouvé ici)
    await page.waitForTimeout(400);
    const ouvertA = await R.ouvrirNouveau(page);
    exiger(ouvertA.ok, `le séquenceur du bloc « Vues » est ouvert (${ouvertA.detail})`);
    const choisi = await page.evaluate(() => { const n = document.querySelector('#sq-grille .sq-nom.choisi'); return n ? +n.dataset.c : null; });
    check(choisi === 0, `il montre l'accord en modification — accord choisi ${choisi}`);
    const croche = await R.poserCroche(page, 0);
    check(croche.ok, `un clic écrit une croche dans l'accord, Ctrl+Z la reprend (${croche.detail})`);
    const peint = await R.peindre(page, 0);
    check(peint.ok, `un glissé peint plusieurs croches, d'une seule annulation (${peint.detail})`);
    check(await page.evaluate(() => window.app.appMode === 'edit' && window.app.editingIndex === 0), 'écrire le rythme ne sort pas du mode Modification');

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
    // Les deux occupaient la même place sous la grille. Un séquenceur devenu flottant pourrait très
    // bien rester affiché PAR-DESSUS la conduite de voix sans que rien ne proteste : c'est
    // exactement le genre de règle qu'un déplacement de nœud fait sauter en silence.
    // LOT 9c : à l'ordinateur, la conduite de voix n'est plus un panneau voisin (l'icône ⊱ a quitté la rangée de réglages), c'est le calque Voix
    // de l'éditeur de notes. Ce qui doit rester vrai : rien de la conduite de voix ne se pose sur le PETIT séquenceur — même calque allumé dans
    // l'éditeur (le réglage est mémorisé), et aucun ancien panneau ne peut plus s'ouvrir à côté.
    // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4a, 12/11) : à l'ordinateur, l'éditeur de notes et son calque Voix ont disparu (le chemin des voix est supprimé,
    // décision du 11/11). Ce qui doit rester vrai : rien de la conduite de voix ne se pose sur le petit séquenceur, ni ne peut plus s'ouvrir à côté.
    // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4b, 12/11) : le petit séquenceur de l'inspecteur a disparu à son tour ; il ne reste qu'UN séquenceur à
    // l'ordinateur, celui du bloc « Vues », ouvert ici par son bouton (vrai clic). Ce qui doit rester vrai : rien de la conduite de voix ne s'y pose, rien ne
    // s'ouvre à côté, et aucune des deux anciennes portes (« Éditeur de notes », « Séquenceur » de l'inspecteur) n'est revenue.
    const ouvert = await R.ouvrirNouveau(page);
    exiger(ouvert.ok, `le séquenceur du bloc « Vues » est ouvert avant l'essai (${ouvert.detail})`);
    const etat = await page.evaluate(() => ({
        bouton: !!document.getElementById('toggle-voice-leading').offsetParent, panneau: !!document.querySelector('.voice-leading-panel'),
        calque: [...document.querySelectorAll('.seq-note-fn, .seq-voix-trait, .seq-voix-accord')].filter(e => e.offsetParent !== null).length,
        porte: !!document.getElementById('grid-zoom').offsetParent || !!document.getElementById('seq-zoom').offsetParent,
    }));
    check(!etat.porte && !etat.bouton && !etat.panneau && etat.calque === 0, `ni ancienne porte, ni ancien panneau, ni calque Voix — porte ${etat.porte}, bouton ⊱ ${etat.bouton}, panneau ${etat.panneau}, calque ${etat.calque}`);
    await R.cliquer(page, '#vue-sequenceur', 400); // refermé : la suite éprouve la carte Accord seule, comme avant

    console.log('\n=== D. Sortie du mode Modification : ce qui sort, ce qui ne sort pas ===');
    await page.evaluate(() => window.app.editChord(0, 0));
    await page.waitForTimeout(350);
    exiger(await page.evaluate(() => window.app.appMode === 'edit'), 'on est bien en mode Modification avant les essais');

    // D1. Toucher une COMMANDE d'accord ne doit pas sortir de l'édition. Éprouvé sur trois
    // commandes de familles différentes (menu déroulant, curseur, bouton) : la liste des sélecteurs
    // les attrape aujourd'hui par des règles distinctes ('select', 'input', 'button'), et la refonte
    // ne remplacera pas les trois par la même chose.
    // LA LISTE A GRANDI, COMME ANNONCÉ. Ce commentaire disait, avant la refonte : « Seuls l'instrument
    // et l'intensité s'offrent directement — ce qui EST le défaut que la refonte doit corriger (« je
    // veux pouvoir rapidement changer une octave, un renversement etc... Sans avoir à ouvrir trop de
    // menus »). Ce banc éprouve donc les commandes réellement à l'écran aujourd'hui ; quand les
    // autres remonteront à la surface, elles rejoindront cette liste. » Elles y sont : renversement,
    // drop et octave n'ont plus de bloc à déplier, et l'intensité est passée d'un curseur à cinq
    // niveaux (le curseur #intensity reste dans le DOM, mais masqué — on ne peut plus le cliquer).
    // On garde une commande de chaque famille : un menu, des segments, un pas-à-pas, un bouton.
    // DEUX COMMANDES ONT QUITTÉ CETTE LISTE, chacune parce qu'elle a quitté la carte :
    //  - l'intensité, partie au menu contextuel d'un accord (« c'est une option pour affiner le
    //    morceau seulement. À cacher ») ;
    //  - l'instrument, parti dans les réglages du morceau (« à définir une fois dans morceau
    //    uniquement »), où il n'est plus une commande d'ACCORD du tout.
    // Ce qu'elles éprouvaient ici — qu'une retouche ne referme pas l'édition — reste couvert par les
    // trois familles ci-dessous, qui sont toujours dans la carte.
    for (const [sel, nom] of [['#inversion-seg .voicing-segment', 'un segment de renversement'],
                              ['[data-octave-step="1"]', "le pas-à-pas d'octave"],
                              // 4b : la porte « Séquenceur » a quitté l'inspecteur de l'ordinateur ; un autre bouton de la carte la remplace (un segment de drop).
                              ['#drop-seg .voicing-segment:last-child', 'un segment de drop']]) {
        const b = await page.evaluate(boiteDe, sel);
        if (!b) { check(false, `${nom} : commande introuvable à l'écran (${sel})`); continue; }
        await page.mouse.click(b.x, b.y);
        await page.waitForTimeout(300);
        const encore = await page.evaluate(() => window.app.appMode === 'edit');
        check(encore, `cliquer ${nom} ne sort PAS du mode Modification`);
        // « Séquenceur » ouvre le panneau ET l'agrandit (voir ouvrirSequenceurPleinEcran) : on remet
        // l'état d'aplomb — plein écran refermé, mode Modification retrouvé — pour que les essais
        // suivants partent tous du même point. Le plein écran est un vrai piège ici : laissé ouvert,
        // il recouvre la carte, et le clic suivant tomberait sur son fond au lieu de la commande visée.
        await page.evaluate(() => { window.app.closeSeqZoom(); if (window.app.appMode !== 'edit') window.app.editChord(0, 0); });
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
