// ENVOYER DANS LA GRILLE l'accord dessiné sur le manche de la guitare.
//
// RETOUR UTILISATEUR, mot pour mot :
//   « J'ai créé un accord manuellement à la guitare en plaçant les notes sur le manche. Je n'ai pas pu
//     l'envoyer directement dans la grille. Peux-tu corriger ? Pour un Dadd11 par exemple, je ne vois pas
//     le 11 sur le piano, et il ne me semble pas entendre la note. »
//
// CE QUI ÉTAIT VRAI, mesuré avant de corriger : après « Valider », seuls « Verrouiller ce doigté » et
// « Utiliser comme substitut guitare » existaient, et ils ne touchent QUE le diagramme de la guitare. L'accord
// du piano — donc ses touches allumées, le son, la case de la grille — restait celui du panneau, jamais le
// Dadd11 dessiné. Ce banc éprouve le bouton qui envoie l'accord reconnu dans la grille, en vérifiant ce que
// l'utilisateur constate : la case, le doigté verrouillé, le 11 sur le piano, et la voix du 11 dans le rythme
// (sans elle l'extension ne sonnerait pas). Bureau ET téléphone, vrais clics.
const { chromium } = require('playwright');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('guitare : envoyer l\'accord dessiné dans la grille');
const bruit = require('./_harness').estBruitReseau;

plan(32);

// Dadd11 : D (corde 1, case 5), F# (2, 4), A (3, 2), D (4, 3), G (5, 3).
const DADD11 = [[1, 5], [2, 4], [3, 2], [4, 3], [5, 3]];

(async () => {
    const navigateur = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const erreurs = [];

    const ouvrir = async (viewport, extra = {}) => {
        const ctx = await navigateur.newContext({ viewport, ...extra });
        const page = await ctx.newPage();
        page.on('pageerror', (e) => erreurs.push('pageerror: ' + e.message));
        page.on('console', (m) => { if (m.type() === 'error' && !bruit(m.text())) erreurs.push('console: ' + m.text()); });
        await page.goto(`${BASE}/index.html?nocache=` + Date.now());
        await page.waitForTimeout(1000);
        // La fenêtre d'accueil de connexion (compte-cloud.js) passe devant : on la ferme comme l'utilisateur.
        if (await page.isVisible('#cloud-guard-modal')) await page.click('#cloud-guard-continue');
        if (!(await page.evaluate(() => document.getElementById('toggle-viz-guitar').getAttribute('aria-pressed') === 'true'))) await page.click('#toggle-viz-guitar');
        await page.waitForTimeout(200);
        return page;
    };
    const mobile = (page) => page.evaluate(() => matchMedia('(pointer: coarse)').matches);
    const ouvrirDessin = async (page) => {
        await page.click('#guitar-edit-btn'); await page.waitForTimeout(150);
        await page.click('#guitar-edit-tab-draw'); await page.waitForTimeout(120);
    };
    const poser = async (page, notes, tactile) => {
        for (const [s, fret] of notes) {
            const box = await page.evaluate(() => {
                const svg = document.querySelector('#guitar-edit-neck svg'); const r = svg.getBoundingClientRect();
                return { x: r.x, y: r.y, w: r.width, vb: svg.viewBox.baseVal.width || r.width };
            });
            // Coordonnées du SVG (voir GUITAR_SVG_LAYOUT), ramenées à l'écran : le manche est réduit sur téléphone.
            const k = box.w / box.vb;
            const x = (fret === 0 ? 11 : 20 + (fret - 0.5) * 30) * k, y = (8 + (5 - s) * 16) * k;
            if (tactile) await page.touchscreen.tap(box.x + x, box.y + y); else await page.mouse.click(box.x + x, box.y + y);
            await page.waitForTimeout(100);
        }
    };
    const valider = async (page) => { await page.click('#guitar-draw-validate'); await page.waitForTimeout(200); };
    const grille = (page) => page.evaluate(() => loadProgressionSections()[0].chords.map(c => ({
        root: c.root, quality: c.quality, bass: c.bass, lock: c.guitarLock, ov: c.guitarOverride, arp: c.arpPattern })));
    const pianoActif = (page) => page.evaluate(() => [...document.querySelectorAll('#piano-viz .key.active')].map(k => +k.dataset.midi).sort((a, b) => a - b));

    // ============ A. BUREAU : ajouter le Dadd11 reconnu à la grille ============
    const A = await ouvrir({ width: 1100, height: 1000 });
    await A.click('#quick-add-btn'); await A.waitForTimeout(200);
    await ouvrirDessin(A);
    await poser(A, DADD11);
    await valider(A);
    const candidats = await A.evaluate(() => [...document.querySelectorAll('.guitar-draw-candidate')].map(b => b.textContent.trim()));
    check(candidats[0] === 'Dadd11', `le dessin est reconnu comme Dadd11, en tête des propositions (${candidats})`);
    const libelle = await A.evaluate(() => (document.getElementById('guitar-draw-send') || {}).textContent?.trim().replace(/\s+/g, ' '));
    check(libelle === 'Ajouter Dadd11 à la grille', `un bouton annonce d'avance ce qu'il fait (${libelle})`);
    check(await A.evaluate(() => !!document.getElementById('guitar-draw-lock')), 'et « Verrouiller / substitut » reste proposé à côté');
    const avant = await grille(A);
    check(avant.length === 0, 'tant qu\'on n\'a pas cliqué, rien n\'est écrit dans la grille');
    await A.click('#guitar-draw-send'); await A.waitForTimeout(400);
    const apres = await grille(A);
    check(apres.length === 1 && apres[0].root === 'D' && apres[0].quality === 'add11', `la grille reçoit un Dadd11 (${apres.map(c => c.root + c.quality)})`);
    check(JSON.stringify(apres[0].lock) === JSON.stringify([null, 5, 4, 2, 3, 3]), `avec le doigté dessiné, verrouillé tel quel (${JSON.stringify(apres[0].lock)})`);
    check(apres[0].ov === null, 'sans substitut : l\'accord de la guitare EST maintenant celui du piano');
    check(apres[0].bass === null, 'la basse reste « fondamentale » (la corde la plus grave est le ré)');
    check(await A.evaluate(() => window.app.guitarEditOpen === false), 'la fenêtre d\'édition se referme');
    check(/Dadd11 ajouté à la grille/.test(await A.textContent('#toast')), 'et une confirmation le dit');

    // Le 11 sur le piano, et dans le son.
    await A.evaluate(() => window.app.editChord(0, 0)); await A.waitForTimeout(300);
    const touches = await pianoActif(A);
    check(touches.includes(67), `le piano montre le 11 (sol, 67) avec les autres notes — ${touches}`);
    check(await A.evaluate(() => document.querySelector('#piano-viz .key[data-midi="67"]').classList.contains('role-ext')), 'colorée comme une extension');
    check(await A.evaluate(() => document.getElementById('quality').value === 'add11' && document.getElementById('root').value === 'D'), 'et le panneau Accord est bien réglé sur Dadd11');
    // Le SON : la voix du 11 (la 4e) doit figurer dans le rythme de l'accord, sinon il ne sonnerait jamais.
    const son = await A.evaluate(() => {
        const d = loadProgressionSections()[0].chords[0];
        const chord = new Chord(d.root, d.quality, d.beats, d.inversion, d.drop, octaveFromData(d), d.bass, d.guitarLock, d.extraNotes);
        const { pattern } = window.app.resolveSeqPatternForData(chord, d);
        const midis = chord.getSeqMidiNotes();
        const jouees = new Set(pattern.flat().map(v => midis[v]));
        return { midis, voix: [...jouees].sort((a, b) => a - b) };
    });
    check(son.midis.includes(67) && son.voix.includes(67), `le 11 (67) est dans les notes JOUÉES par le rythme de la case — ${JSON.stringify(son)}`);

    // ============ B. UN AUTRE CANDIDAT ============
    const B = await ouvrir({ width: 1100, height: 1000 });
    await B.click('#quick-add-btn'); await B.waitForTimeout(200);
    await ouvrirDessin(B); await poser(B, DADD11); await valider(B);
    await B.locator('.guitar-draw-candidate', { hasText: /^D$/ }).click(); await B.waitForTimeout(150);
    check((await B.textContent('#guitar-draw-send')).trim().replace(/\s+/g, ' ') === 'Ajouter D à la grille', 'le bouton suit le candidat choisi (« Ajouter D à la grille »)');
    await B.click('#guitar-draw-send'); await B.waitForTimeout(400);
    const g2 = await grille(B);
    check(g2.length === 1 && g2[0].root === 'D' && g2[0].quality === 'maj' && JSON.stringify(g2[0].lock) === JSON.stringify([null, 5, 4, 2, 3, 3]),
        `c'est le candidat CHOISI qui part, avec le même doigté (${g2.map(c => c.root + c.quality)})`);
    // Un second envoi s'ajoute à la suite, sans toucher au premier.
    await B.selectOption('#root', 'C'); await B.selectOption('#quality', 'maj'); await B.waitForTimeout(150);
    await ouvrirDessin(B); await poser(B, DADD11); await valider(B);
    await B.click('#guitar-draw-send'); await B.waitForTimeout(400);
    const g2b = await grille(B);
    check(g2b.length === 2 && g2b[0].quality === 'maj' && g2b[1].quality === 'add11', `un second envoi s'ajoute à la suite, le premier accord ne bouge pas (${g2b.map(c => c.root + c.quality)})`);

    // ============ C. MODE MODIFICATION : remplacer, sans doublon ============
    const C = await ouvrir({ width: 1100, height: 1000 });
    await C.click('#quick-add-btn'); await C.waitForTimeout(200);
    await C.selectOption('#root', 'C'); await C.selectOption('#quality', 'maj'); await C.waitForTimeout(150);
    await C.click('#save'); await C.waitForTimeout(300);
    await C.evaluate(() => window.app.editChord(0, 0)); await C.waitForTimeout(300);
    check(await C.evaluate(() => window.app.appMode === 'edit' && window.app.editingIndex === 0), 'précondition : l\'accord de la grille est ouvert en modification');
    await ouvrirDessin(C); await poser(C, DADD11); await valider(C);
    check((await C.textContent('#guitar-draw-send')).trim().replace(/\s+/g, ' ') === 'Remplacer l\'accord de la grille par Dadd11', 'en modification, le bouton dit « Remplacer l\'accord de la grille par Dadd11 »');
    await C.click('#guitar-draw-send'); await C.waitForTimeout(400);
    const g3 = await grille(C);
    check(g3.length === 1 && g3[0].root === 'D' && g3[0].quality === 'add11' && JSON.stringify(g3[0].lock) === JSON.stringify([null, 5, 4, 2, 3, 3]),
        `l'accord ouvert est REMPLACÉ, pas dupliqué (${g3.length} accord, ${g3.map(c => c.root + c.quality)})`);

    // ============ D. LA BASSE JOUÉE ============
    const D = await ouvrir({ width: 1100, height: 1000 });
    await D.click('#quick-add-btn'); await D.waitForTimeout(200);
    await ouvrirDessin(D);
    await poser(D, [[2, 4], [3, 2], [4, 3], [5, 3]]);   // F# A D G : la basse est le fa#, une note de l'accord
    await valider(D);
    const candD = await D.evaluate(() => [...document.querySelectorAll('.guitar-draw-candidate')].map(b => b.textContent.trim()));
    const iD = candD.indexOf('Dadd11');
    if (exiger(iD >= 0, `Dadd11 est proposé pour F# A D G (${candD})`)) {
        await D.locator('.guitar-draw-candidate').nth(iD).click();
        await D.click('#guitar-draw-send'); await D.waitForTimeout(400);
        check((await grille(D))[0].bass === 'F#', 'la basse jouée (fa#, tierce de l\'accord) est reprise : Dadd11/F#');
    }
    const E = await ouvrir({ width: 1100, height: 1000 });
    await E.click('#quick-add-btn'); await E.waitForTimeout(200);
    await ouvrirDessin(E);
    await poser(E, [[2, 5], [3, 2], [4, 3], [5, 2]]);   // G A D F# : la basse est le sol, le 11 — pas une note « de base »
    await valider(E);
    const candE = await E.evaluate(() => [...document.querySelectorAll('.guitar-draw-candidate')].map(b => b.textContent.trim()));
    const iE = candE.indexOf('Dadd11');
    if (exiger(iE >= 0, `Dadd11 est proposé pour G A D F# (${candE})`)) {
        await E.locator('.guitar-draw-candidate').nth(iE).click();
        await E.click('#guitar-draw-send'); await E.waitForTimeout(400);
        check((await grille(E))[0].bass === null, 'une basse qui tombe sur le 11 ne fait pas un « Dadd11/G » : basse laissée à la fondamentale');
    }

    // ============ E. ACCORD NON RECONNU : rien à envoyer ============
    const F = await ouvrir({ width: 1100, height: 1000 });
    await F.click('#quick-add-btn'); await F.waitForTimeout(200);
    await ouvrirDessin(F);
    await poser(F, [[5, 0]]);                           // une seule note : pas d'accord
    await valider(F);
    check(await F.evaluate(() => !document.getElementById('guitar-draw-send')) && await F.isVisible('.guitar-draw-unrecognized'),
        'une seule note : « Accord non reconnu », et pas de bouton d\'envoi qui écrirait n\'importe quoi dans la grille');
    check((await grille(F)).length === 0, 'rien n\'a été ajouté');

    // ============ F. TÉLÉPHONE ============
    const T = await ouvrir({ width: 390, height: 844 }, { hasTouch: true, isMobile: true });
    check(await mobile(T), 'précondition : appareil tactile');
    await T.tap('#quick-add-btn'); await T.waitForTimeout(250);
    await T.tap('#guitar-edit-btn'); await T.waitForTimeout(250);
    await T.tap('#guitar-edit-tab-draw'); await T.waitForTimeout(150);
    await poser(T, DADD11, true);
    await T.tap('#guitar-draw-validate'); await T.waitForTimeout(250);
    const geo = await T.evaluate(() => {
        const b = document.getElementById('guitar-draw-send').getBoundingClientRect();
        return { l: b.left, r: b.right, h: b.height, larg: window.innerWidth };
    });
    check(geo.l >= 0 && geo.r <= geo.larg && geo.h >= 40, `le bouton tient dans l'écran et se vise au doigt (${JSON.stringify(geo)})`);
    await T.tap('#guitar-draw-send'); await T.waitForTimeout(500);
    const gT = await grille(T);
    check(gT.length === 1 && gT[0].quality === 'add11' && JSON.stringify(gT[0].lock) === JSON.stringify([null, 5, 4, 2, 3, 3]), `au doigt aussi : Dadd11 dans la grille avec son doigté (${gT.map(c => c.root + c.quality)})`);
    check(await T.evaluate(() => document.documentElement.scrollWidth - window.innerWidth) <= 0, 'la page ne déborde pas');

    // ============ G. LE VERROU HABITUEL N'A PAS CHANGÉ ============
    const H = await ouvrir({ width: 1100, height: 1000 });
    await H.click('#quick-add-btn'); await H.waitForTimeout(200);
    await H.selectOption('#root', 'C'); await H.selectOption('#quality', 'maj'); await H.waitForTimeout(150);
    await ouvrirDessin(H); await poser(H, DADD11); await valider(H);
    await H.click('#guitar-draw-lock'); await H.waitForTimeout(300);
    const etatH = await H.evaluate(() => ({ ov: window.app.guitarOverride, lock: window.app.guitarLock, q: document.getElementById('quality').value, n: loadProgressionSections()[0] ? loadProgressionSections()[0].chords.length : 0 }));
    check(etatH.ov && etatH.ov.quality === 'add11' && etatH.q === 'maj' && etatH.n === 0,
        '« Utiliser comme substitut » fait toujours ce qu\'il faisait : le piano reste en do majeur, rien n\'entre dans la grille');

    check(erreurs.length === 0, `aucune erreur JavaScript (${erreurs.slice(0, 2).join(' | ')})`);
    await navigateur.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
