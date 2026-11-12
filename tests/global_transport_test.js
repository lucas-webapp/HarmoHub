// REFONTE, LOT 2 (31/10) — CONTRAT DÉPLACÉ UNE FOIS DE PLUS. Sur ORDINATEUR, le transport ne vit plus au pied du volet de gauche
// (#footer-dock) mais dans la BARRE DE LECTURE du bas (#bl-lecture, bloc « Lecture »), en plus gros (44px) et avec un bouton
// Boucle à part ; sur TÉLÉPHONE il reste dans #footer-dock (lot 10). Toujours UN SEUL nœud, déplacé, jamais dupliqué — et il se
// déplace maintenant au franchissement des 900px (sections B, E, I). Ce qui est resté vrai, et que ce banc tient toujours :
// un seul bouton Lecture, atteignable de n'importe où, qui garde sa place quand on défile, sans recouvrir la grille.
// (Historique des contrats précédents ci-dessous.)
//
// Transport global flottant : un seul bouton Lecture, atteignable de n'importe où sans traverser
// l'écran. Retour utilisateur, trois demandes liées :
//   - « laisser un seul bouton lecture pour toute la grille ? Le bouton lecture accord ne sert pas
//     à grand chose » -> #play retiré, #play-prog devient le seul bouton, icône simplifiée.
//   - « je dois trop déplacer la souris pour cliquer, quel emplacement te semble le plus adapté ? »
//     -> après un passage par l'en-tête de la grille, la réponse finale de l'utilisateur a tranché :
//     « remets-les en bas du volet à gauche, mais juste sous le module », puis « les boutons de
//     transport doivent rester ancrés ». C'est #footer-dock, dernier enfant de .col-left, hors des
//     cartes et présent quel que soit le mode.
//   - « j'ai besoin de place en hauteur pour bien voir la grille et séquenceur » -> colonne
//     verticale sur le bord DROIT plutôt qu'une barre en bas (un premier essai) : ne mange aucune
//     hauteur. Mesuré au passage : posée SANS marge réservée, elle recouvrait l'en-tête de la grille
//     (#grid-zoom devenu inatteignable) puis, centrée verticalement, .add-section-btn (pleine largeur)
//     sur un morceau court — d'où `padding-right: 100px` sur `main` en desktop (voir style.css) : la
//     marge est réservée, aucun contenu ne peut plus se retrouver DESSOUS. Vérifié ci-dessous.
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// La police vient de Google Fonts, injoignable derrière le proxy du bac à sable : bruit filtré.

// CONTRAT DÉPLACÉ, BANC PÉRIMÉ. Ses sections B, B2, C, E et I mesuraient toutes
// #grid-head-transport-host, l'ancre dans l'en-tête de la grille. Le transport n'y vit plus : mesuré,
// cette ancre est vide et en display:none sur les deux tailles d'écran, et script.js le dit
// explicitement — « gridHead n'accueille plus rien : conservé comme point d'ancrage vide ». Le banc
// échouait donc sur « visible au chargement », et sa section E cliquait en plus #grid-zoom-close, le
// bouton de fermeture de la vue plein écran supprimée : rien après n'était atteint.
const R = require('./_retrait_ancien');
const { check, exiger, plan, bilan } = require('./_harness')('transport global');
plan(40);

const mk = (root, q, beats) => ({ root, quality: q, beats, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held', instrument: 'piano', arpPattern: '', seqEdited: false, guitarLock: null, extraNotes: [], intensity: 75, intensityPerStep: {} });

(async () => {
    const browser = await chromium.launch();
    const errs = [];
    const brancher = (p, tag = '') => {
        p.on('pageerror', e => errs.push(tag + e.message));
        p.on('console', m => { if (m.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|ERR_CERT_AUTHORITY_INVALID|fonts\.googleapis|fonts\.gstatic|AudioContext/.test(m.text())) errs.push(tag + 'console: ' + m.text()); });
    };

    const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    brancher(p);
    await p.goto(`${BASE}/index.html`);
    await p.waitForTimeout(500);
    await p.evaluate((s) => {
        const mk = eval('(' + s + ')');
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet',
            chords: [mk('C', 'maj', 4), mk('A', 'min7', 4), mk('F', 'maj7', 4)] }] }));
    }, mk.toString());
    await p.reload();
    await p.waitForTimeout(900);
    await p.click('body');
    await p.evaluate(() => Tone.start());

    console.log('\n=== A. Un seul bouton de lecture, plus de bouton « Accord » ===');
    check(await p.evaluate(() => !document.getElementById('play')), '#play (Accord) a bien disparu du DOM');
    check(await p.evaluate(() => !!document.getElementById('play-prog')), '#play-prog (Lecture) existe toujours');
    const iconInfo = await p.evaluate(() => {
        const svg = document.querySelector('#play-prog svg');
        return { rects: svg.querySelectorAll('rect').length, paths: svg.querySelectorAll('path').length, title: document.getElementById('play-prog').title };
    });
    check(iconInfo.rects === 0 && iconInfo.paths === 1, `logo simplifié à un simple triangle — ${iconInfo.paths} path(s), ${iconInfo.rects} rect(s) (3 avant)`);
    // Le libellé annonce désormais le geste caché qui bascule la boucle (voir setupBoucleLecture) :
    // c'est la contrepartie assumée d'un appui long, moins découvrable qu'un bouton. On éprouve donc
    // le DÉBUT de la phrase, pas la phrase entière — la mention du geste peut être reformulée sans
    // que ce banc ait à changer.
    check(iconInfo.title.startsWith('Lecture'), `libellé simple, suivi du geste — « ${iconInfo.title} »`);

    console.log('\n=== B. Le transport est dans la BARRE DE LECTURE du bas (ordinateur) ===');
    const structure = await p.evaluate(() => {
        const transport = document.querySelector('.transport');
        const bloc = document.getElementById('bl-lecture');
        const barre = document.getElementById('barre-lecture');
        const ancreEntete = document.getElementById('grid-head-transport-host');
        const r = transport.getBoundingClientRect();
        const rb = barre.getBoundingClientRect();
        return {
            dansLaBarre: bloc.contains(transport),
            barreEnBas: Math.abs(rb.bottom - window.innerHeight) < 1.5,
            barrePleineLargeur: Math.abs(rb.left) < 1 && Math.abs(rb.right - window.innerWidth) < 1,
            barreHauteur: Math.round(rb.height),
            visible: transport.offsetParent !== null && r.width > 0 && r.height > 0,
            troisBoutons: [...transport.querySelectorAll(':scope > button')].filter(b => b.offsetParent !== null).map(b => b.id),
            tailles: [...transport.querySelectorAll(':scope > button')].map(b => Math.round(b.getBoundingClientRect().width) + 'x' + Math.round(b.getBoundingClientRect().height)),
            dockVide: document.getElementById('footer-dock').children.length === 0,
            ancreEnteteVide: ancreEntete.children.length === 0,
            ancreEnteteSansHauteur: ancreEntete.getBoundingClientRect().height === 0,
        };
    });
    console.log(JSON.stringify(structure));
    if (!exiger(structure.dansLaBarre, 'le transport vit bien dans #bl-lecture, la barre de lecture')) bilan();
    check(structure.barreEnBas && structure.barrePleineLargeur, '...une barre collée au bas de l\'écran, sur toute la largeur');
    check(structure.barreHauteur <= 61, `...de 60px de haut au plus — ${structure.barreHauteur}px (la maquette l'a fixée : « 160px de commandes autour de la grille »)`);
    check(structure.visible, 'il est visible au chargement');
    check(structure.troisBoutons.join(',') === 'play-prog,stop,boucle-btn', `Lecture, Stop et Boucle, dans cet ordre — ${structure.troisBoutons.join(',')}`);
    check(new Set(structure.tailles).size === 1 && structure.tailles[0] === '44x44', `...tous identiques, carrés de 44px — ${structure.tailles.join(' ')}`);
    check(structure.dockVide, 'le pied de colonne (#footer-dock) ne contient plus rien hors édition');
    check(structure.ancreEnteteVide && structure.ancreEnteteSansHauteur,
        "l'ancienne ancre de l'en-tête de grille reste vide et sans hauteur, elle ne repousse rien");

    console.log('\n=== B2. Aucun recouvrement avec les commandes de la grille ===');
    // Le premier essai posait le transport en colonne flottante sur le bord droit : SANS marge
    // réservée, il recouvrait l'en-tête de la grille (#grid-zoom devenu inatteignable) puis, centré
    // verticalement, .add-section-btn sur un morceau court. On mesure la boîte RÉELLE du transport,
    // plus celle d'une ancre vide qui ne peut, par construction, chevaucher quoi que ce soit.
    const chevauche = await p.evaluate(() => {
        const b = document.querySelector('.transport').getBoundingClientRect();
        const superpose = (r) => !(r.right < b.left || r.left > b.right || r.bottom < b.top || r.top > b.bottom);
        const ids = ['grid-zoom', 'toggle-voice-leading', 'classic-grid-in-h', 'classic-grid-out-h',
            'classic-grid-in-v', 'classic-grid-out-v', 'add-section', 'song-summary', 'toggle-sidebar'];
        return ids.map(id => {
            const el = document.getElementById(id);
            if (!el) return null;
            const r = el.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) return null; // pas affiché ici, rien à vérifier
            return { id, superpose: superpose(r) };
        }).filter(Boolean);
    });
    const enChevauchement = chevauche.filter(c => c.superpose).map(c => c.id);
    check(enChevauchement.length === 0,
        `aucune commande de la grille sous le transport — ${chevauche.length} vérifiées, en chevauchement : ${JSON.stringify(enChevauchement)}`);

    console.log('\n=== C. Toujours au même endroit, qu\'on défile le panneau ou la grille ===');
    // Ajoute plein d'accords pour que la grille (et le panneau) débordent largement.
    await p.evaluate((s) => {
        const mk = eval('(' + s + ')');
        const chords = [];
        for (let i = 0; i < 40; i++) chords.push(mk(['C', 'D', 'E', 'F', 'G', 'A', 'B'][i % 7], 'min7', 4));
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords }] }));
    }, mk.toString());
    await p.reload();
    await p.waitForTimeout(900);
    const posAvant = await p.evaluate(() => document.querySelector('.transport').getBoundingClientRect().toJSON());
    await p.evaluate(() => document.querySelector('.col-right').scrollBy({ top: 400 }));
    await p.mouse.wheel(0, 800); // défilement de la page elle-même au cas où
    await p.waitForTimeout(400);
    const posApres = await p.evaluate(() => document.querySelector('.transport').getBoundingClientRect().toJSON());
    check(Math.abs(posAvant.top - posApres.top) < 2 && Math.abs(posAvant.left - posApres.left) < 2,
        `le transport garde sa place à l'écran quand on défile la grille — avant (${Math.round(posAvant.top)},${Math.round(posAvant.left)}), après (${Math.round(posApres.top)},${Math.round(posApres.left)})`);
    check(await p.evaluate(() => document.querySelector('.transport').offsetParent !== null),
        '...et il reste visible après le défilement');

    console.log('\n=== D. Il fonctionne : Lecture/Boucle/Stop marchent toujours ===');
    await p.evaluate((s) => {
        const mk = eval('(' + s + ')');
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet',
            chords: [mk('C', 'maj', 4), mk('A', 'min7', 4)] }] }));
    }, mk.toString());
    await p.reload();
    await p.waitForTimeout(900);
    await p.click('body');
    await p.evaluate(() => Tone.start());
    await p.click('#play-prog');
    await p.waitForTimeout(400);
    check(await p.evaluate(() => window.app.isPlaying), 'cliquer Lecture démarre bien la lecture');
    await p.click('#stop');
    await p.waitForTimeout(200);
    check(await p.evaluate(() => !window.app.isPlaying), 'Stop arrête bien la lecture');
    // LE TROISIÈME BOUTON N'EXISTE PLUS, et c'est une décision (« le fait de mettre un 3ème bouton
    // uniquement pour les boucles alourdit un peu le visuel »). La boucle est devenue un ÉTAT du
    // bouton Lecture, à la manière de Pro Tools — l'anneau autour du triangle. Le banc éprouve donc
    // le même service, par le geste qui l'active désormais : l'appui long. Le clic attendait ici un
    // bouton disparu jusqu'à expiration, et TOUT ce qui suivait dans ce banc était perdu en silence.
    const boite = await p.locator('#play-prog').boundingBox();
    await p.mouse.move(boite.x + boite.width / 2, boite.y + boite.height / 2);
    await p.mouse.down();
    await p.waitForTimeout(750);
    await p.mouse.up();
    await p.waitForTimeout(250);
    check(await p.evaluate(() => window.app.bouclerLecture === true), 'un appui long sur Lecture allume bien la boucle');
    check(await p.evaluate(() => document.getElementById('play-prog').classList.contains('boucle-active')),
        'et le bouton Lecture porte alors son anneau');
    check(await p.evaluate(() => document.getElementById('boucle-btn').getAttribute('aria-pressed') === 'true'),
        'et le bouton Boucle de la barre est allumé avec elle (même drapeau, deux signes)');
    check(await p.evaluate(() => getComputedStyle(document.querySelector('#play-prog .transport-icon-simple')).display !== 'none'),
        'sur ordinateur le triangle de Lecture reste un triangle : la boucle a son bouton, l\'anneau est réservé au téléphone');
    await p.evaluate(() => window.app.basculerBoucle(false));
    await p.waitForTimeout(150);
    await p.click('#boucle-btn');
    await p.waitForTimeout(150);
    check(await p.evaluate(() => window.app.bouclerLecture === true), 'un clic sur le bouton Boucle allume la boucle');
    await p.click('#boucle-btn');
    await p.waitForTimeout(150);
    check(await p.evaluate(() => window.app.bouclerLecture === false), '...et un second clic l\'éteint');

    console.log('\n=== E. Une vue agrandie par-dessus ne le fait pas disparaître ni doubler ===');
    // Le banc masquait ici le transport pendant la vue plein écran de la grille, qui portait sa PROPRE
    // copie (#grid-zoom-play-prog) : il fallait éviter d'en afficher deux. Cette vue et sa copie ont
    // disparu — il n'y a plus qu'un transport, et la seule fenêtre restante est celle du séquenceur
    // agrandi, qui se pose PAR-DESSUS sans rien déplacer. On vérifie donc l'inverse de l'ancien
    // contrat : un seul transport, toujours en place, et le verrou de défilement bien posé.
    // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4a, 12/11, « réécriture courte ») : la loupe (#seq-plein-ecran) et la vue agrandie du séquenceur ont disparu avec
    // l'éditeur de notes (cahier : « pas de zoom, pas de loupe »). Le séquenceur du bloc « Vues » s'ouvre DANS la page : le contrat devient — un seul transport,
    // toujours dans la barre, aucune fenêtre par-dessus, donc aucun verrou de défilement.
    let rr = await R.porteAbsente(p);
    check(rr.ok, `plus de porte vers la vue agrandie d'avant (${rr.detail})`);
    rr = await R.ouvrirNouveau(p);
    exiger(rr.ok, `le séquenceur du bloc « Vues » s'ouvre (${rr.detail})`);
    const pendantSq = await p.evaluate(() => ({
        bodyLocked: document.body.classList.contains('body-scroll-locked'),
        nbTransports: document.querySelectorAll('.transport').length,
        toujoursDansLaBarre: document.getElementById('bl-lecture').contains(document.querySelector('.transport')),
        jumeau: !!document.getElementById('grid-zoom-play-prog') || !!document.getElementById('grid-zoom-play-chord') || !!document.getElementById('seq-play'),
    }));
    console.log(JSON.stringify(pendantSq));
    check(!pendantSq.bodyLocked, 'séquenceur ouvert : pas de verrou de défilement (il est dans la page, pas par-dessus)');
    check(pendantSq.nbTransports === 1, `un SEUL transport dans la page — ${pendantSq.nbTransports}`);
    check(pendantSq.toujoursDansLaBarre, '...toujours ancré dans la barre de lecture');
    check(!pendantSq.jumeau, 'aucun bouton de lecture jumeau (ni de la vue agrandie, ni propre au séquenceur)');
    await R.cliquer(p, '#sq-fermer', 400);

    console.log('\n=== F. Édition d\'un accord : Ajouter/Annuler restent où ils étaient (pas de régression) ===');
    await p.evaluate(() => window.app.editChord(0, 0));
    await p.waitForTimeout(300);
    const editUI = await p.evaluate(() => {
        const dock = document.getElementById('footer-dock');
        const editActions = document.getElementById('edit-actions');
        return { dansLeDock: dock.contains(editActions), dockVisible: dock.offsetParent !== null };
    });
    check(editUI.dansLeDock, 'le bloc Ajouter/À la suite/Annuler est bien ancré dans .dock pendant l\'édition');
    check(editUI.dockVisible, '...et ce pied de colonne est visible');

    console.log('\n=== G. Boucler une plage : le bouton unique se recolore, comme avant ===');
    await p.evaluate(() => window.app.cancelEdit && window.app.cancelEdit());
    await p.evaluate(() => window.app.setLoopRange && window.app.setLoopRange(0, 0, 0, 1));
    await p.waitForTimeout(300);
    const loopRangeUI = await p.evaluate(() => ({
        colored: document.getElementById('play-prog').classList.contains('btn-loop-range'),
        title: document.getElementById('play-prog').title,
    }));
    check(loopRangeUI.colored, 'le bouton Lecture se recolore quand une plage à boucler est définie');
    // Le libellé dit maintenant les DEUX moitiés : ce qui est joué, ET si ça se répète (tracer une
    // plage allume la boucle, voir setLoopRange). Un seul propriétaire l'écrit désormais —
    // syncAnneauBoucle — après qu'ils ont été deux à se le disputer en silence, ce que ce banc a
    // justement attrapé.
    check(loopRangeUI.title.startsWith('Lire la plage tracée'),
        `...et son titre l'annonce — « ${loopRangeUI.title} »`);
    await p.close();

    console.log('\n=== H. Téléphone : le transport flottant reste utilisable, sans déborder ===');
    const m = await browser.newPage({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
    brancher(m, 'mobile: ');
    await m.goto(`${BASE}/index.html`);
    await m.waitForTimeout(500);
    await m.evaluate((s) => {
        const mk = eval('(' + s + ')');
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet',
            chords: [mk('C', 'maj', 4), mk('A', 'min7', 4)] }] }));
    }, mk.toString());
    await m.reload();
    await m.waitForTimeout(900);
    // Sur téléphone comme sur ordinateur, le transport vit dans #footer-dock — bug mesuré à l'époque
    // où il flottait : centré sur un écran de 390×780, il tombait
    // pile sur #quick-add-btn ET le logo du bandeau du haut, tous deux rendus incliquables (Playwright
    // plantait littéralement dessus). Voir placeGlobalTransport dans script.js.
    // CHANGÉ DE SENS AU LOT 10b : le téléphone a sa barre de lecture, fixée en bas (maquette « Téléphone (v2) ») ; le transport y vit, Boucle comprise.
    // Le bloc Lecture et le transport s'y effacent (display: contents, chaque bouton prend sa place dans la rangée) : on mesure donc la BARRE.
    const mobileInfo = await m.evaluate(() => {
        const dock = document.getElementById('footer-dock');
        const transport = document.querySelector('.transport');
        const b = document.getElementById('barre-lecture').getBoundingClientRect();
        const superpose = (id) => {
            const el = document.getElementById(id);
            if (!el) return false;
            const r = el.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) return false;
            return !(r.right < b.left || r.left > b.right || r.bottom < b.top || r.top > b.bottom);
        };
        return {
            dansLeDock: dock.contains(transport),
            dansLaBarre: document.getElementById('bl-lecture').contains(transport),
            videDansEnteteGrille: document.getElementById('grid-head-transport-host').children.length === 0,
            deborde: b.right > window.innerWidth || b.left < 0,
            withinScreen: b.bottom <= window.innerHeight + 1,
            chevaucheQuickAdd: superpose('quick-add-btn'),
            chevaucheLogo: !!document.querySelector('.top-bar') && (() => {
                const r = document.querySelector('.top-bar').getBoundingClientRect();
                return !(r.right < b.left || r.left > b.right || r.bottom < b.top || r.top > b.bottom);
            })(),
        };
    });
    check(mobileInfo.dansLaBarre && !mobileInfo.dansLeDock, 'le transport vit dans la barre de lecture au téléphone aussi (lot 10b), plus dans #footer-dock');
    check(await m.evaluate(() => getComputedStyle(document.getElementById('boucle-btn')).display !== 'none'
        && getComputedStyle(document.getElementById('barre-lecture')).position === 'fixed'),
        '...avec son bouton Boucle, dans une barre fixée en bas de l\'écran');
    check(mobileInfo.videDansEnteteGrille, "...et l'ancre de l'en-tête de grille reste vide sur cet écran");
    check(!mobileInfo.deborde, 'ne déborde pas horizontalement de l\'écran');
    check(mobileInfo.withinScreen, 'reste dans la hauteur de l\'écran');
    check(!mobileInfo.chevaucheQuickAdd, 'ne recouvre pas #quick-add-btn (bug mesuré avant ce correctif)');
    check(!mobileInfo.chevaucheLogo, 'ne recouvre pas le bandeau du haut non plus');
    await m.tap('body').catch(() => {});
    await m.evaluate(() => Tone.start());
    await m.tap('#play-prog');
    await m.waitForTimeout(400);
    check(await m.evaluate(() => window.app.isPlaying), 'un toucher sur Lecture démarre bien la lecture au doigt');
    await m.tap('#stop');

    console.log('\n=== I. Franchir le seuil ordinateur/téléphone déplace le MÊME nœud, jamais un double ===');
    // Contrat de nouveau mobile (lot 2) : au-delà de 900px le transport rejoint la barre de lecture, en deçà il revient au
    // pied de colonne, sans rechargement — comme avant le passage par « ancrés dans le dock », mais vers la barre du bas.
    await m.setViewportSize({ width: 1440, height: 900 });
    await m.waitForTimeout(400);
    const large = await m.evaluate(() => ({
        dansLaBarre: document.getElementById('bl-lecture').contains(document.querySelector('.transport')),
        nb: document.querySelectorAll('.transport').length,
        visible: document.querySelector('.transport').offsetParent !== null,
    }));
    console.log('élargi :', JSON.stringify(large));
    check(large.dansLaBarre && large.nb === 1 && large.visible,
        'élargir la fenêtre au-delà de 900px amène le transport dans la barre de lecture, en un seul exemplaire');
    await m.setViewportSize({ width: 390, height: 780 });
    await m.waitForTimeout(400);
    // Lot 10b : rétrécir le LAISSE dans la barre de lecture, devenue celle du téléphone aussi (le bloc s'y efface : on regarde Lecture lui-même).
    const etroit = await m.evaluate(() => ({
        dansLaBarre: document.getElementById('bl-lecture').contains(document.querySelector('.transport')),
        nb: document.querySelectorAll('.transport').length,
        visible: document.getElementById('play-prog').getBoundingClientRect().width > 0,
    }));
    console.log('rétréci :', JSON.stringify(etroit));
    check(etroit.dansLaBarre && etroit.nb === 1 && etroit.visible,
        '...et le rétrécir le laisse dans la barre de lecture, celle du téléphone : un seul exemplaire, toujours visible');
    await m.close();

    await browser.close();
    check(errs.length === 0, 'aucune erreur JavaScript' + (errs.length ? ' — ' + errs[0] : ''));
    bilan();
})();
