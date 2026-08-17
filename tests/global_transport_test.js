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
const { check, exiger, plan, bilan } = require('./_harness')('transport global');
plan(24);

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

    console.log('\n=== B. Le transport est ANCRÉ en bas de la colonne de gauche ===');
    const structure = await p.evaluate(() => {
        const transport = document.querySelector('.transport');
        const dock = document.getElementById('footer-dock');
        const ancreEntete = document.getElementById('grid-head-transport-host');
        const r = transport.getBoundingClientRect();
        return {
            dansLeDock: dock.contains(transport),
            dockDansColonneGauche: !!dock.closest('.col-left'),
            dockDernierEnfant: dock.parentElement.lastElementChild === dock,
            visible: transport.offsetParent !== null && r.width > 0 && r.height > 0,
            ancreEnteteVide: ancreEntete.children.length === 0,
            ancreEnteteSansHauteur: ancreEntete.getBoundingClientRect().height === 0,
        };
    });
    console.log(JSON.stringify(structure));
    if (!exiger(structure.dansLeDock, 'le transport vit bien dans #footer-dock')) bilan();
    check(structure.dockDansColonneGauche, '...qui est dans la colonne de gauche, hors des cartes');
    check(structure.dockDernierEnfant, '...et en est le dernier enfant : sous le module, comme demandé');
    check(structure.visible, 'il est visible au chargement');
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
    await p.click('#toggle-loop-section');
    await p.waitForTimeout(200);
    check(await p.evaluate(() => window.app.loopActiveSection === true), 'Boucler la partie active bien le réglage');
    await p.click('#toggle-loop-section');

    console.log('\n=== E. Une vue agrandie par-dessus ne le fait pas disparaître ni doubler ===');
    // Le banc masquait ici le transport pendant la vue plein écran de la grille, qui portait sa PROPRE
    // copie (#grid-zoom-play-prog) : il fallait éviter d'en afficher deux. Cette vue et sa copie ont
    // disparu — il n'y a plus qu'un transport, et la seule fenêtre restante est celle du séquenceur
    // agrandi, qui se pose PAR-DESSUS sans rien déplacer. On vérifie donc l'inverse de l'ancien
    // contrat : un seul transport, toujours en place, et le verrou de défilement bien posé.
    await p.evaluate(() => window.app.editChord(0, 0));
    await p.waitForTimeout(300);
    // #seq-zoom est masqué tant que le séquenceur lui-même n'est pas ouvert (voir toggleSequencer,
    // qui pose `hidden = !this.seqOpen`) : sans cette ouverture préalable, le clic attend un bouton
    // invisible jusqu'à expiration — et tout ce qui suit dans le banc est perdu.
    await p.click('#grid-zoom');
    await p.waitForTimeout(700);
    await p.click('#seq-zoom');
    await p.waitForTimeout(700);
    const pendantAgrandi = await p.evaluate(() => ({
        bodyLocked: document.body.classList.contains('body-scroll-locked'),
        nbTransports: document.querySelectorAll('.transport').length,
        toujoursDansLeDock: document.getElementById('footer-dock').contains(document.querySelector('.transport')),
        jumeauDeLaLoupe: !!document.getElementById('grid-zoom-play-prog') || !!document.getElementById('grid-zoom-play-chord'),
    }));
    console.log(JSON.stringify(pendantAgrandi));
    check(pendantAgrandi.bodyLocked, 'body.body-scroll-locked est bien posé pendant la vue agrandie');
    check(pendantAgrandi.nbTransports === 1, `un SEUL transport dans la page — ${pendantAgrandi.nbTransports}`);
    check(pendantAgrandi.toujoursDansLeDock, "...toujours ancré au même endroit, la fenêtre se pose par-dessus sans le déplacer");
    check(!pendantAgrandi.jumeauDeLaLoupe, 'plus aucun bouton jumeau hérité de la vue plein écran');
    await p.keyboard.press('Escape');
    await p.waitForTimeout(500);
    check(await p.evaluate(() => !document.body.classList.contains('body-scroll-locked')),
        'le verrou de défilement est levé à la fermeture de la vue agrandie');
    await p.click('#grid-zoom');   // referme aussi le volet, pour repartir d'un état neutre
    await p.waitForTimeout(400);

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
    // Sur téléphone comme sur ordinateur, le transport vit dans #footer-dock — bug mesuré à l'époque
    // où il flottait : centré sur un écran de 390×780, il tombait
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
    check(mobileInfo.dansLeDock, 'le transport vit dans #footer-dock au téléphone aussi');
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

    console.log('\n=== I. Franchir le seuil ordinateur/téléphone ne le déplace plus ===');
    // ANCIEN CONTRAT : au-delà de 900px le transport rejoignait l'en-tête de la grille, en deçà il
    // revenait au pied de colonne, sans rechargement. Il ne DÉMÉNAGE plus : « les boutons de transport
    // doivent rester ancrés » (retour utilisateur). Ce qu'on vérifie donc maintenant, c'est justement
    // sa stabilité — un aller-retour de part et d'autre du seuil ne doit rien bouger.
    await m.setViewportSize({ width: 1440, height: 900 });
    await m.waitForTimeout(400);
    const large = await m.evaluate(() => ({
        dansLeDock: document.getElementById('footer-dock').contains(document.querySelector('.transport')),
        nb: document.querySelectorAll('.transport').length,
        visible: document.querySelector('.transport').offsetParent !== null,
    }));
    console.log('élargi :', JSON.stringify(large));
    check(large.dansLeDock && large.nb === 1 && large.visible,
        'élargir la fenêtre au-delà de 900px laisse le transport ancré dans #footer-dock, en un seul exemplaire');
    await m.setViewportSize({ width: 390, height: 780 });
    await m.waitForTimeout(400);
    const etroit = await m.evaluate(() => ({
        dansLeDock: document.getElementById('footer-dock').contains(document.querySelector('.transport')),
        nb: document.querySelectorAll('.transport').length,
        visible: document.querySelector('.transport').offsetParent !== null,
    }));
    console.log('rétréci :', JSON.stringify(etroit));
    check(etroit.dansLeDock && etroit.nb === 1 && etroit.visible,
        '...et le rétrécir non plus : même ancre, un seul exemplaire, toujours visible');
    await m.close();

    await browser.close();
    check(errs.length === 0, 'aucune erreur JavaScript' + (errs.length ? ' — ' + errs[0] : ''));
    bilan();
})();
