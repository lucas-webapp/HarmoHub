// Transport global flottant : un seul bouton Lecture, atteignable de n'importe où sans traverser
// l'écran. Retour utilisateur, trois demandes liées :
//   - « laisser un seul bouton lecture pour toute la grille ? Le bouton lecture accord ne sert pas
//     à grand chose » -> #play retiré, #play-prog devient le seul bouton, icône simplifiée.
//   - « je dois trop déplacer la souris pour cliquer, quel emplacement te semble le plus adapté ? »
//     -> #grid-head-transport-host, en-tête COLLANT de la grille, toujours visible quel que soit le
//     défilement ou la colonne travaillée.
//   - « j'ai besoin de place en hauteur pour bien voir la grille et séquenceur » -> colonne
//     verticale sur le bord DROIT plutôt qu'une barre en bas (un premier essai) : ne mange aucune
//     hauteur. Mesuré au passage : posée SANS marge réservée, elle recouvrait l'en-tête de la grille
//     (#grid-zoom devenu inatteignable) puis, centrée verticalement, .add-section-btn (pleine largeur)
//     sur un morceau court — d'où `padding-right: 100px` sur `main` en desktop (voir style.css) : la
//     marge est réservée, aucun contenu ne peut plus se retrouver DESSOUS. Vérifié ci-dessous.
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
// La police vient de Google Fonts, injoignable derrière le proxy du bac à sable : bruit filtré.

let PASS = 0, FAIL = 0;
function check(c, l) { if (c) { PASS++; console.log('PASS - ' + l); } else { FAIL++; console.log('FAIL - ' + l); } }

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
    check(iconInfo.title === 'Lecture', `libellé simple — « ${iconInfo.title} »`);

    // CONTRAT MIS À JOUR : le transport n'est plus une colonne flottante isolée sur le bord droit
    // (retour utilisateur : « les boutons de lecture / stop n'ont pas de cohérence là où ils sont
    // positionnés sur ordi (tout à droite) ») — il vit dans l'en-tête de la grille, avec les autres
    // commandes de celle-ci (zoom, loupe), et c'est CET EN-TÊTE qui est collant.
    console.log('\n=== B. Le transport vit dans l\'en-tête COLLANT de la grille ===');
    const structure = await p.evaluate(() => {
        const gt = document.getElementById('grid-head-transport-host');
        const head = document.querySelector('.grid-head-sticky');
        return {
            existe: !!gt,
            dansEntete: !!(head && head.contains(gt)),
            positionEntete: head ? getComputedStyle(head).position : null,
            visible: gt ? (getComputedStyle(gt).display !== 'none' && gt.getBoundingClientRect().width > 0) : false,
        };
    });
    check(structure.existe, '#grid-head-transport-host existe');
    check(structure.dansEntete, "...et vit bien DANS l'en-tête de la grille, avec ses autres commandes");
    check(structure.positionEntete === 'sticky', `cet en-tête est collant — ${structure.positionEntete}`);
    check(structure.visible, 'visible au chargement');

    console.log('\n=== B2. Aucun recouvrement avec les commandes de la grille (bug mesuré, corrigé par la marge réservée) ===');
    const chevauche = await p.evaluate(() => {
        const gt = document.getElementById('grid-head-transport-host');
        const gtRect = gt.getBoundingClientRect();
        const superpose = (r) => !(r.right < gtRect.left || r.left > gtRect.right || r.bottom < gtRect.top || r.top > gtRect.bottom);
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
    const posAvant = await p.evaluate(() => document.getElementById('grid-head-transport-host').getBoundingClientRect());
    await p.evaluate(() => document.querySelector('.col-right').scrollBy({ top: 400 }));
    await p.mouse.wheel(0, 800); // défilement de la page elle-même au cas où
    await p.waitForTimeout(300);
    const posApres = await p.evaluate(() => document.getElementById('grid-head-transport-host').getBoundingClientRect());
    check(Math.abs(posAvant.top - posApres.top) < 1 && Math.abs(posAvant.left - posApres.left) < 1,
        `même position à l'écran avant/après défilement — avant (${Math.round(posAvant.top)},${Math.round(posAvant.left)}), après (${Math.round(posApres.top)},${Math.round(posApres.left)})`);

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
    await p.click('#toggle-loop-section');
    await p.waitForTimeout(200);
    check(await p.evaluate(() => window.app.loopActiveSection === true), 'Boucler la partie active bien le réglage');
    await p.click('#toggle-loop-section');

    console.log('\n=== E. Masqué pendant qu\'une fenêtre plein écran est ouverte (pas de double transport) ===');
    await p.click('#grid-zoom');
    await p.waitForTimeout(700);
    const pendantLoupe = await p.evaluate(() => ({
        bodyLocked: document.body.classList.contains('body-scroll-locked'),
        transportVisible: getComputedStyle(document.getElementById('grid-head-transport-host')).display !== 'none',
        loupeATransport: document.getElementById('grid-zoom-play-prog').offsetParent !== null,
    }));
    check(pendantLoupe.bodyLocked, 'body.body-scroll-locked posé pendant la loupe');
    check(!pendantLoupe.transportVisible, 'le transport global se masque pour ne pas doubler celui de la loupe');
    check(pendantLoupe.loupeATransport, '...et celui de la loupe, lui, reste visible et utilisable');
    check(!(await p.evaluate(() => !!document.getElementById('grid-zoom-play-chord'))),
        'le bouton « Accord » de la loupe a disparu lui aussi');
    await p.click('#grid-zoom-close');
    await p.waitForTimeout(500);
    check(await p.evaluate(() => getComputedStyle(document.getElementById('grid-head-transport-host')).display !== 'none'),
        'le transport global réapparaît à la fermeture de la loupe');

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
    check(loopRangeUI.title === 'Lire la plage à boucler', `...et son titre l'annonce — « ${loopRangeUI.title} »`);
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
    // Sur téléphone, le transport reste dans .dock (pied de colonne collant), PAS dans
    // #grid-head-transport-host (qui reste vide) — bug mesuré : centré sur un écran de 390×780, il tombait
    // pile sur #quick-add-btn ET le logo du bandeau du haut, tous deux rendus incliquables (Playwright
    // plantait littéralement dessus). Voir placeGlobalTransport dans script.js.
    const mobileInfo = await m.evaluate(() => {
        const dock = document.getElementById('footer-dock');
        const transport = document.querySelector('.transport');
        const b = transport.getBoundingClientRect();
        const superpose = (id) => {
            const el = document.getElementById(id);
            if (!el) return false;
            const r = el.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) return false;
            return !(r.right < b.left || r.left > b.right || r.bottom < b.top || r.top > b.bottom);
        };
        return {
            dansLeDock: dock.contains(transport),
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
    check(mobileInfo.dansLeDock, 'le transport vit dans .dock au téléphone, pas dans #grid-head-transport-host');
    check(mobileInfo.videDansEnteteGrille, '...et #grid-head-transport-host, lui, reste vide sur cet écran');
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

    console.log('\n=== I. Franchir le seuil ordinateur/téléphone replace le transport en direct ===');
    await m.setViewportSize({ width: 1440, height: 900 });
    await m.waitForTimeout(300);
    const apresElargissement = await m.evaluate(() => ({
        dansEnteteGrille: document.getElementById('grid-head-transport-host').contains(document.querySelector('.transport')),
    }));
    check(apresElargissement.dansEnteteGrille,
        'élargir la fenêtre au-delà de 900px replace le transport dans #grid-head-transport-host sans recharger');
    await m.setViewportSize({ width: 390, height: 780 });
    await m.waitForTimeout(300);
    const apresRetrecissement = await m.evaluate(() => ({
        dansLeDock: document.getElementById('footer-dock').contains(document.querySelector('.transport')),
    }));
    check(apresRetrecissement.dansLeDock, '...et le rétrécir le ramène dans .dock, toujours sans recharger');
    await m.close();

    await browser.close();
    check(errs.length === 0, 'aucune erreur JavaScript' + (errs.length ? ' — ' + errs[0] : ''));
    console.log(`\n=== ${PASS} PASS / ${FAIL} FAIL ===`);
    process.exit(FAIL ? 1 : 0);
})();
