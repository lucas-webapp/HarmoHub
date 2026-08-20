// Lot 4 bis-B : le petit séquenceur devient un TIROIR FLOTTANT sur téléphone.
//
// IDÉE DE L'UTILISATEUR : « J'ai bien envie de garder l'idée du "Petit séquenceur"... Il est plus
// simple à utiliser que le grand séquenceur qui demande un grand écran », puis « Le séquenceur
// pourrait apparaitre dans un popover également, non ? »
//
// LA MESURE A RESTREINT LE LOT À UN SEUL FORMAT, et c'est le point le plus important de ce banc.
// Sur ORDINATEUR, ouvrir le petit séquenceur ne coûte RIEN : la grille reste à 162px avec ses 236px
// visibles, le séquenceur vivant dans la colonne de gauche juste sous les commandes de l'accord. Le
// faire flotter par-dessus la grille y serait une régression pure — donc on n'y touche pas, et le
// banc l'exige. Sur TÉLÉPHONE, l'ouvrir laissait 0px de grille visible : le séquenceur vit tout en bas
// de la colonne empilée, et le défilement automatique qui l'amenait à l'écran emportait la grille à
// -455px.
//
// L'ARITHMÉTIQUE DE L'ÉCRAN, faite avant de dessiner : sur un iPhone 13 (664px), 345px au-dessus de la
// grille + 230px de grille + 221px de séquenceur + 81px de barre de lecture = 877px à loger dans 664.
// Il manque 213px. L'objectif n'est donc pas de tout montrer, mais de voir L'ACCORD QU'ON TRAVAILLE
// et son rythme — d'où un défilement qui vise la case éditée au lieu de centrer le séquenceur.
const { chromium, devices } = require('playwright');
const creerHarnais = require('./_harness');
const { plan, check, exiger, bilan } = creerHarnais('Petit séquenceur : tiroir flottant sur téléphone');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';

const seed = () => {
    const mk = (r, q, b, s) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: s || 'held' });
    const song = {
        id: 'lot4bisB', name: 'Ballade', bpm: 120, timeSig: '4/4', groove: 'straight',
        sections: [{ title: 'Couplet', chords: [mk('C', 'maj7', 4), mk('F', 'maj', 4), mk('G', '7', 4), mk('A', 'min', 4)] }],
    };
    localStorage.setItem('harmohubSongs', JSON.stringify([song]));
    localStorage.setItem('harmohubCurrentSongId', song.id);
    localStorage.setItem('myProgression', JSON.stringify({ sections: song.sections }));
};

const etat = () => {
    const a = document.getElementById('arp-sequencer');
    const r = a.getBoundingClientRect();
    const cell = window.app.editingIndex != null ? window.app.gridCellEl(window.app.activeSection, window.app.editingIndex) : null;
    const c = cell ? cell.getBoundingClientRect() : null;
    const dock = document.querySelector('.dock');
    const d = dock ? dock.getBoundingClientRect() : null;
    const g = document.querySelector('#progression-sections').getBoundingClientRect();
    return {
        ouvert: window.app.seqOpen,
        tiroir: a.classList.contains('seq-tiroir'),
        position: getComputedStyle(a).position,
        seq: { t: Math.round(r.top), b: Math.round(r.bottom), h: Math.round(r.height) },
        // La case de l'accord édité doit être visible AU-DESSUS du tiroir : c'est tout l'objet du lot.
        caseVisible: !!c && c.top >= 0 && c.bottom <= r.top,
        case: c ? { t: Math.round(c.top), b: Math.round(c.bottom) } : null,
        recouvreBarre: !!d && r.bottom > d.top + 1,
        grilleVisible: Math.round(Math.max(0, Math.min(g.bottom, r.top) - Math.max(g.top, 0))),
        grilleTop: Math.round(g.top),
        // Le corps ne doit PAS être verrouillé : ce n'est pas une fenêtre modale, la page continue de
        // défiler derrière le tiroir.
        corpsVerrouille: document.body.classList.contains('body-scroll-locked'),
        vh: window.innerHeight,
    };
};

(async () => {
    plan(19);
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const erreurs = [];

    console.log('=== A. Téléphone : le tiroir flotte, et il laisse voir l\'accord qu\'on travaille ===');
    const ctx = await browser.newContext({ ...devices['iPhone 13'] });
    const m = await ctx.newPage();
    m.on('pageerror', e => erreurs.push('téléphone : ' + e.message));
    await m.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await m.waitForTimeout(300);
    await m.evaluate(seed);
    await m.reload({ waitUntil: 'load' });
    await m.waitForTimeout(700);
    await m.evaluate(() => { window.app.editChord(0, 1); window.app.toggleSequencer('compact'); });
    await m.waitForTimeout(1100); // le défilement est doux : il faut le laisser finir

    const tel = await m.evaluate(etat);
    exiger(tel.ouvert, 'le petit séquenceur est ouvert');
    check(tel.tiroir && tel.position === 'fixed',
        `il flotte vraiment — classe tiroir ${tel.tiroir}, position ${tel.position}`);
    check(tel.caseVisible,
        `la case de l'accord édité est visible AU-DESSUS du tiroir — case ${tel.case ? tel.case.t + '..' + tel.case.b : '?'}, tiroir dès ${tel.seq.t}`);
    // Repère d'avant-travaux : 0px. On exige nettement mieux, sans exiger la perfection que
    // l'arithmétique interdit.
    check(tel.grilleVisible >= 120,
        `la grille reste largement visible — ${tel.grilleVisible}px (0px avant ce lot)`);
    check(!tel.recouvreBarre, 'le tiroir ne recouvre pas la barre de lecture');
    check(!tel.corpsVerrouille, 'le tiroir ne verrouille pas le défilement de la page : ce n\'est pas une fenêtre modale');
    check(tel.seq.h <= tel.vh * 0.45 + 2,
        `il ne dépasse pas 45 % de la fenêtre — ${tel.seq.h}px pour ${tel.vh}px`);

    console.log('\n=== B. Ses cases restent atteignables : rien ne passe devant ===');
    // L'en-tête collant de la grille vit à un rang au-dessus de la barre de lecture ; s'il passait
    // devant le tiroir, il en couperait la première ligne de cases sans qu'aucune mesure de
    // rectangle ne le voie. On pose donc la question au navigateur : qui répond à ce point ?
    const dessus = await m.evaluate(() => {
        const c = document.querySelector('#arp-sequencer .seq-cell[data-voice][data-step]');
        if (!c) return { ok: false, pourquoi: 'aucune case' };
        const r = c.getBoundingClientRect();
        const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { ok: !!e && (e === c || c.contains(e) || e.contains(c)), qui: e ? (e.className || e.tagName) : 'rien' };
    });
    check(dessus.ok, `le clic atteint bien les cases du tiroir — ${dessus.ok ? 'oui' : 'intercepté par ' + dessus.qui}`);

    console.log('\n=== C. Il RESTE ouvert quand on change d\'accord, et se recharge sur le nouveau ===');
    // Exigence explicite de l'utilisateur pour ce panneau : « Il reste ouvert ». C'est aussi la raison
    // pour laquelle il ne rejoint PAS la table des popups, qui referme au moindre clic à côté.
    const avant = await m.evaluate(() => document.querySelectorAll('#arp-sequencer .seq-cell[data-voice][data-step]').length);
    await m.evaluate(() => window.app.editChord(0, 0)); // Cmaj7 : quatre notes au lieu de trois
    await m.waitForTimeout(700);
    const apres = await m.evaluate(() => ({
        ouvert: window.app.seqOpen,
        cases: document.querySelectorAll('#arp-sequencer .seq-cell[data-voice][data-step]').length,
        tiroir: document.getElementById('arp-sequencer').classList.contains('seq-tiroir'),
    }));
    check(apres.ouvert && apres.tiroir, 'changer d\'accord ne referme pas le tiroir');
    check(apres.cases !== avant,
        `et il s'est rechargé sur le nouvel accord — ${avant} cases pour trois notes, ${apres.cases} pour quatre`);

    console.log('\n=== D. Un clic sur la grille ne le referme pas ===');
    // Le contraire du panneau des réglages du morceau, et c'est délibéré : on travaille le rythme d'un
    // accord puis d'un autre sans avoir à le rouvrir à chaque fois.
    const boite = await m.evaluate(() => {
        const c = document.querySelectorAll('.grid-cell')[2];
        if (!c) return null;
        const r = c.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height * 0.85 };
    });
    if (exiger(!!boite, 'une autre case d\'accord est atteignable')) {
        const cdp = await ctx.newCDPSession(m);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: boite.x, y: boite.y }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await m.waitForTimeout(500);
        check(await m.evaluate(() => window.app.seqOpen === true),
            'toucher un accord dans la grille laisse le tiroir ouvert');
    }

    console.log('\n=== E. LA SORTIE : elle doit être ATTEIGNABLE, et éprouvée par un vrai geste ===');
    // DÉFAUT SIGNALÉ PAR L'UTILISATEUR APRÈS COUP : « je n'arrive plus à fermer le petit séquenceur
    // une fois ouvert (test réalisé sur téléphone) ». Et c'était ma faute deux fois.
    //   1. Dans l'application : le tiroir ne rejoint volontairement PAS la table des popups (un clic
    //      sur la grille ne doit pas le refermer), et le bouton qui l'ouvre vit dans la carte Lecture
    //      — mesuré à 838px sur une fenêtre de 664, donc hors écran AVANT comme APRÈS l'ouverture. Le
    //      tiroir n'avait donc aucune sortie atteignable. Un panneau flottant doit porter la sienne.
    //   2. Dans ce banc : la vérification d'origine appelait `window.app.toggleSequencer(...)`, un
    //      APPEL DE MÉTHODE. Elle passait au vert en n'éprouvant jamais ce qui manquait vraiment —
    //      qu'un doigt puisse atteindre quelque chose. La leçon est générale : pour une commande que
    //      l'utilisateur doit ATTEINDRE, on vérifie d'abord qu'elle est à l'écran et cliquable, puis
    //      on la pilote par un VRAI geste. Jamais par la méthode qui se cache derrière.
    const sortie = await m.evaluate(() => {
        const b = document.getElementById('seq-tiroir-close');
        if (!b) return { present: false };
        const r = b.getBoundingClientRect();
        const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return {
            present: true,
            dansEcran: r.top >= 0 && r.bottom <= window.innerHeight,
            atteignable: !!e && (e === b || b.contains(e) || e.contains(b)),
            dansTiroir: !!b.closest('.arp-seq.seq-tiroir'),
            x: r.left + r.width / 2, y: r.top + r.height / 2,
            taille: `${Math.round(r.width)}x${Math.round(r.height)}`,
        };
    });
    if (exiger(sortie.present, 'le tiroir porte sa propre fermeture')) {
        check(sortie.dansTiroir && sortie.dansEcran && sortie.atteignable,
            `cette fermeture est à l'écran et le doigt l'atteint — ${sortie.taille}`);
        // VRAI toucher, pas un appel de méthode : c'est tout l'objet de la correction.
        const cdp2 = await ctx.newCDPSession(m);
        await cdp2.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sortie.x, y: sortie.y }] });
        await cdp2.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await m.waitForTimeout(600);
        const ferme = await m.evaluate(() => ({
            ouvert: window.app.seqOpen,
            tiroir: document.getElementById('arp-sequencer').classList.contains('seq-tiroir'),
            varRestante: getComputedStyle(document.documentElement).getPropertyValue('--tiroir-bas').trim(),
        }));
        check(!ferme.ouvert && !ferme.tiroir, 'un vrai toucher dessus referme bien le tiroir');
        check(ferme.varRestante === '', 'et nettoie la variable de position derrière lui');
    }
    await m.close();

    console.log('\n=== F. ORDINATEUR : rien ne doit avoir changé ===');
    // Mesuré avant le lot : ouvrir le petit séquenceur y coûte 0px de grille. Le faire flotter y
    // serait une régression, et cette vérification est là pour l'empêcher.
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', e => erreurs.push('ordinateur : ' + e.message));
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await page.waitForTimeout(300);
    await page.evaluate(seed);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(650);
    await page.evaluate(() => window.app.editChord(0, 1));
    await page.waitForTimeout(350);
    const avantB = await page.evaluate(etat);
    await page.evaluate(() => window.app.toggleSequencer('compact'));
    await page.waitForTimeout(700);
    const apresB = await page.evaluate(etat);
    exiger(apresB.ouvert, 'ordinateur : le petit séquenceur s\'ouvre bien');
    check(!apresB.tiroir && apresB.position !== 'fixed',
        `ordinateur : PAS de tiroir flottant — classe ${apresB.tiroir}, position ${apresB.position}`);
    check(apresB.grilleTop === avantB.grilleTop,
        `ordinateur : la grille ne bouge pas d'un pixel — ${avantB.grilleTop}px puis ${apresB.grilleTop}px`);
    check(await page.evaluate(() => Math.round((document.scrollingElement || document.documentElement).scrollTop)) === 0,
        'ordinateur : aucune page à faire défiler, donc aucun défilement déclenché');

    check(erreurs.length === 0, `aucune erreur JavaScript — ${erreurs.join(' | ') || 'aucune'}`);
    await browser.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
