// Ajouter / modifier SANS onglet ni mode.
// Remplace mode_banner_test.js et edit_cards_visibility_test.js, dont le sujet même a disparu :
// le bandeau Ajout/Modification et l'état « mode Modification armé mais aucun accord chargé ».
// Le nouveau contrat tient en trois points :
//   1. le panneau NOMME son sujet (« Nouvel accord » / « Modifier · X », + où ça se situe) ;
//   2. l'ajout a ses PROPRES cibles (case « + », ajout rapide), qui reprennent la main sur le sujet ;
//   3. appMode est DÉDUIT de editingIndex, et ce qui restait de la bascule est un réglage.
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

const PROG = { sections: [{ title: 'Couplet', chords: [
    { root: 'C', quality: 'maj', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
    { root: 'D', quality: 'min', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
    { root: 'E', quality: 'min', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
] }] };

// Le CENTRE d'une case n'est pas cliquable comme « la case » : le symbole (édition inline) l'occupe,
// et les deux bords sont les poignées de durée. On cherche donc un point réellement nu.
const pointNu = (page, idx) => page.evaluate((i) => {
    const c = document.querySelector(`.grid-cell[data-index="${i}"]`);
    const r = c.getBoundingClientRect();
    for (let j = 0; j < 9; j++) for (let k = 0; k < 21; k++) {
        const x = r.left + 2 + (r.width - 4) * k / 20, y = r.top + 2 + (r.height - 4) * j / 8;
        const el = document.elementFromPoint(x, y);
        if (el && String(el.className).includes('grid-cell')) return { x, y };
    }
    return null;
}, idx);

const etat = (page) => page.evaluate(() => ({
    titre: document.getElementById('accord-title').textContent,
    titreRendu: (() => { const s = document.getElementById('accord-title-sym'); return s ? getComputedStyle(s).textTransform : null; })(),
    couleurTitre: getComputedStyle(document.getElementById('accord-title')).color,
    sujetExistant: document.getElementById('accord-card').classList.contains('subject-existing'),
    gotoVisible: !document.getElementById('accord-goto').hidden,
    mode: window.app.appMode,
    ed: window.app.editingIndex,
    sel: window.app.selectedIndex,
}));

(async () => {
    const browser = await chromium.launch();
    const errors = [];
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(500);
    await page.evaluate((p) => localStorage.setItem('myProgression', JSON.stringify(p)), PROG);
    await page.reload();
    await page.waitForTimeout(900);

    // ============================================================
    console.log('\n=== A. Le bandeau a disparu, et rien ne le remplace en haut du panneau ===');
    // ============================================================
    check(await page.evaluate(() => !document.querySelector('.app-mode-banner')), 'plus de bandeau Ajout/Modification');
    check(await page.evaluate(() => !document.getElementById('app-mode-add') && !document.getElementById('app-mode-edit')),
        'plus de segments Ajout/Modif dans le DOM');
    check(await page.evaluate(() => !document.getElementById('edit-empty-hint')),
        'plus de carte « Touchez un accord » : cet état est devenu impossible');
    check(await page.evaluate(() => !document.getElementById('accord-card').hidden && !document.getElementById('lecture-card').hidden),
        'Accord et Lecture sont toujours affichées, sans état vide');
    check(await page.evaluate(() => !document.getElementById('quick-add-panel').hidden),
        'l\'ajout rapide est visible (il ne se masque plus : c\'est une cible d\'ajout)');
    // Il vit SOUS LE TITRE DE LA GRILLE, avec ce qu'il alimente — plus dans le panneau de réglages
    // d'accord, à l'autre bout de l'écran sur téléphone (retour utilisateur).
    check(await page.evaluate(() => {
        const qa = document.getElementById('quick-add-panel');
        const sec = document.querySelector('.history-section');
        const tete = sec.querySelector('.card-head'), grille = document.getElementById('progression-sections');
        return sec.contains(qa)
            && qa.getBoundingClientRect().top >= tete.getBoundingClientRect().bottom
            && qa.getBoundingClientRect().bottom <= grille.getBoundingClientRect().top;
    }), 'l\'ajout rapide est dans la carte de la grille, entre son titre et la grille elle-même');
    // Aucun titre de carte ne doit plus porter la marge haute par défaut du <h2> (~13px), invisible
    // en bloc mais bien réelle dans un .card-head, qui est un flex.
    check(await page.evaluate(() => [...document.querySelectorAll('.card-head h2')]
        .every(h => getComputedStyle(h).marginTop === '0px')),
        'plus de marge haute par défaut sur les titres de carte');

    // ============================================================
    console.log('\n=== B. Le panneau nomme son sujet ===');
    // ============================================================
    let e = await etat(page);
    check(e.titre === 'Nouvel accord', `au repos, le panneau annonce « Nouvel accord » (${e.titre})`);
    // Le titre EST le signal : deux mots colorés, pas une phrase. Une ligne détaillée (« Sera ajouté
    // à la fin de Couplet · mesure 5 ») a été essayée puis retirée — trop de texte pour une
    // information déjà visible dans la grille (retour utilisateur).
    check(await page.evaluate(() => !document.getElementById('accord-where')),
        'pas de ligne de détail sous le titre : le titre seul porte l\'information');
    check(/rgb\(0, 230, 118\)|rgb\(0,230,118\)/.test(e.couleurTitre), `titre en vert (${e.couleurTitre})`);
    check(!e.sujetExistant, 'teinte « nouvel accord » (verte), pas celle d\'un accord existant');
    check(!e.gotoVisible, 'pas de bouton « montrer dans la grille » : il n\'y a rien à montrer');

    const p0 = await pointNu(page, 0);
    await page.mouse.click(p0.x, p0.y); await page.waitForTimeout(400);
    e = await etat(page);
    check(e.ed === null && e.sel === 0, 'un clic simple sélectionne sans ouvrir la modification (réglage par défaut)');
    check(e.titre === 'Nouvel accord', 'sélectionner n\'est pas modifier : le sujet ne change pas');

    await page.mouse.dblclick(p0.x, p0.y); await page.waitForTimeout(600);
    e = await etat(page);
    check(e.ed === 0, 'le double-clic charge l\'accord');
    check(e.titre === 'Modifier · C', `le panneau nomme l'accord qu'il pilote (${e.titre})`);
    check(/rgb\(255, 179, 0\)|rgb\(255,179,0\)/.test(e.couleurTitre), `titre passé en ambre (${e.couleurTitre})`);
    check(e.sujetExistant, 'teinte « accord existant » (ambre)');
    check(e.gotoVisible, 'le bouton « montrer dans la grille » apparaît');
    // Les titres de carte sont mis en capitales par le CSS : « Am » y devenait « AM », soit un autre
    // accord. Le symbole doit donc être exempté — c'est de la musique, pas de la décoration.
    check(e.titreRendu === 'none', `le symbole garde sa casse (text-transform ${e.titreRendu})`);

    // Le titre suit les modifications en direct
    await page.selectOption('#quality', 'min7'); await page.waitForTimeout(500);
    e = await etat(page);
    check(e.titre === 'Modifier · Cm7', `le titre suit la modification en direct (${e.titre})`);
    await page.mouse.dblclick((await pointNu(page, 1)).x, (await pointNu(page, 1)).y); await page.waitForTimeout(600);
    e = await etat(page);
    check(e.titre === 'Modifier · Dm', `passer à un autre accord renomme le sujet (${e.titre})`);

    // ============================================================
    console.log('\n=== C. Le fil panneau → grille ===');
    // ============================================================
    await page.click('#accord-goto'); await page.waitForTimeout(250);
    check(await page.evaluate(() => {
        const f = document.querySelector('.grid-cell.cell-flash');
        return !!f && f.dataset.index === '1';
    }), 'le bouton fait clignoter LA case en cours d\'édition');
    // Le clic sur un bouton du panneau désélectionne et reconstruit la grille : le clignotement doit y survivre
    await page.evaluate(() => window.app.loadProgression());
    await page.waitForTimeout(150);
    check(await page.evaluate(() => !!document.querySelector('.grid-cell.cell-flash')),
        'le clignotement survit à une reconstruction de la grille');
    await page.waitForTimeout(1300);
    check(await page.evaluate(() => !document.querySelector('.grid-cell.cell-flash')),
        'puis il s\'éteint tout seul (ce n\'est pas un état de plus)');

    // ============================================================
    console.log('\n=== D. L\'ajout a ses propres cibles, qui reprennent le sujet ===');
    // ============================================================
    check((await etat(page)).ed === 1, 'on est bien encore en train de modifier un accord');
    await page.click('.cell-add-input'); await page.waitForTimeout(400);
    e = await etat(page);
    check(e.ed === null, 'engager la case « + » referme l\'accord en cours');
    check(e.titre === 'Nouvel accord', 'le panneau repasse aussitôt sur « Nouvel accord »');
    check(!e.sujetExistant, 'et reprend la teinte « nouvel accord »');
    check(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('cell-add-input')),
        'le champ garde le focus (la grille n\'a pas été reconstruite sous les doigts)');
    check(await page.evaluate(() => document.querySelectorAll('.grid-cell.editing').length === 0),
        'plus aucune case marquée « en édition » dans la grille');

    // même chose depuis l'ajout rapide
    await page.mouse.dblclick((await pointNu(page, 2)).x, (await pointNu(page, 2)).y); await page.waitForTimeout(600);
    check((await etat(page)).ed === 2, 'on rouvre un accord pour la suite');
    await page.click('#quick-add-input'); await page.waitForTimeout(400);
    e = await etat(page);
    check(e.ed === null && e.titre === 'Nouvel accord', 'engager l\'ajout rapide fait la même chose');

    // la case « + » se voit
    check(await page.evaluate(() => {
        const c = document.querySelector('.grid-cell-add');
        const s = getComputedStyle(c);
        return s.borderStyle === 'dashed' && /230, 118/.test(s.borderColor);
    }), 'la case « + » porte la teinte verte de l\'ajout, en pointillés');
    // CONTRAT CHANGÉ : le libellé était MESURÉ au rendu — « + Accord » là où il tenait, « + » en
    // dessous de 84px, sinon il se coupait en « + Ac ». Le « + » seul est devenu la règle partout
    // (retour utilisateur : « un "+" suffit à comprendre »), et la case est passée de 125x64 à un
    // carré de 64x64 (« je n'ai pas besoin de toute cette largeur pour cliquer »). Il n'y a donc
    // plus rien à mesurer ni à raccourcir : ce qui reste à éprouver, c'est que le signe est bien
    // là, entier, et que le sens n'est pas perdu — il vit dans l'aria-label.
    const caseAjout = await page.evaluate(() => {
        const i = document.querySelector('.cell-add-input');
        return { w: Math.round(i.getBoundingClientRect().width), ph: i.placeholder, coupe: i.scrollWidth > i.clientWidth,
                 aria: i.getAttribute('aria-label'),
                 carree: (() => { const b = i.closest('.grid-cell-add').getBoundingClientRect();
                     return Math.abs(b.width - b.height) <= 1; })() };
    });
    // Sur TÉLÉPHONE, l'ordre demandé est titre → ajout rapide → outils de grille → grille. L'en-tête
    // y est aplati (display:contents) pour que les trois puissent s'ordonner entre eux ; sur
    // ordinateur titre et outils partagent une ligne et la barre reste dessous.
    {
        const tel = await browser.newPage({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
        await tel.goto(`${BASE}/index.html`);
        await tel.waitForTimeout(800);
        await tel.fill('#quick-add-input', 'C/Am');
        await tel.click('#quick-add-btn');
        await tel.waitForTimeout(700);
        const ordre = await tel.evaluate(() => [
            ['titre', '.history-section h2'],
            ['ajout', '#quick-add-panel'],
            ['outils', '.history-section .card-head-actions'],
            ['grille', '#progression-sections'],
        ].map(([n, s]) => ({ n, y: document.querySelector(s).getBoundingClientRect().top }))
            .sort((a, b) => a.y - b.y).map(o => o.n).join(' → '));
        check(ordre === 'titre → ajout → outils → grille', `téléphone : ${ordre}`);
        await tel.close();
    }
    check(caseAjout.ph === '+' && !caseAjout.coupe,
        `le signe seul, entier, sans être coupé : « ${caseAjout.ph} » sur ${caseAjout.w}px`);
    check(caseAjout.carree, 'la case est carrée : on ne réserve plus deux temps de large pour un signe');
    check(/Ajouter un accord/.test(caseAjout.aria || ''),
        `le sens reste dit au lecteur d'écran — « ${caseAjout.aria} »`);

    // ============================================================
    console.log('\n=== E. appMode est DÉDUIT, plus jamais contredit ===');
    // ============================================================
    check(await page.evaluate(() => window.app.appMode === 'add' && window.app.editingIndex === null),
        'aucun accord ouvert → mode « add »');
    await page.evaluate(() => window.app.editChord(0, 0)); await page.waitForTimeout(400);
    check(await page.evaluate(() => window.app.appMode === 'edit' && document.body.dataset.appMode === 'edit'),
        'un accord ouvert → mode « edit », et le thème du corps suit');
    // Le large bouton « Fermer » du bas de colonne a été supprimé (retour utilisateur : « ne sert à
    // rien et est mal placé »). Ce qu'il faisait vit dans la croix de l'en-tête du panneau, et dans le
    // clic hors zone d'édition — l'assertion, elle, ne change pas : fermer doit ramener en « add ».
    await page.click('#accord-close'); await page.waitForTimeout(400);
    check(await page.evaluate(() => window.app.appMode === 'add' && document.body.dataset.appMode === 'add'),
        'fermer la modification → retour à « add » (avant, le mode restait bloqué sur « edit »)');
    // Accesseur sans mutateur : l'affectation ne PREND PAS EFFET. (Elle ne lève pas ici — le code
    // d'une page n'est pas en mode strict —, ce qui compte est que la valeur reste déduite.)
    check(await page.evaluate(() => {
        window.app.appMode = 'edit';
        return window.app.appMode === 'add' && window.app.editingIndex === null;
    }), 'appMode ne peut pas être contredit à la main : il reste déduit de editingIndex');

    // ============================================================
    console.log('\n=== F. Une seule règle au clic : simple = sélectionner, double = modifier ===');
    // ============================================================
    // Le réglage « Un clic sur un accord » a été retiré (retour utilisateur : « certaines options
    // ne servent à rien... je veux une seule possibilité : double clic pour modifier »). Ce qui se
    // vérifie désormais, c'est que la règle est bien UNIQUE et qu'il ne reste rien de l'ancien
    // réglage pour la contredire.
    await page.click('#open-settings'); await page.waitForTimeout(400);
    check(await page.evaluate(() => !document.getElementById('grid-click-action')),
        'le réglage a bien disparu des Paramètres');
    await page.click('#settings-close'); await page.waitForTimeout(400);
    check(await page.evaluate(() => window.app.gridClickEdits === undefined),
        'et l\'état qui le portait n\'existe plus non plus');

    const p2 = await pointNu(page, 2);
    await page.mouse.click(p2.x, p2.y); await page.waitForTimeout(600);
    e = await etat(page);
    check(e.ed === null, 'un simple clic n\'ouvre PAS l\'édition');
    check(e.sel === 2, '...il sélectionne l\'accord (pour l\'écouter et le voir aux diagrammes)');

    await page.mouse.click(p2.x, p2.y); await page.waitForTimeout(80);
    await page.mouse.click(p2.x, p2.y); await page.waitForTimeout(600);
    e = await etat(page);
    check(e.ed === 2, 'un double-clic, lui, charge l\'accord dans le panneau');
    check(e.titre === 'Modifier · Em', `et le panneau le nomme (${e.titre})`);
    await page.click('#accord-close'); await page.waitForTimeout(400);

    await page.reload(); await page.waitForTimeout(900);
    check(await page.evaluate(() => window.app.appMode === 'add'),
        'au rechargement on repart sans accord ouvert, donc en « add » (le mode ne se mémorise pas : il se déduit)');

    // ============================================================
    console.log('\n=== G. Application en direct (inchangée) ===');
    // ============================================================
    await page.evaluate(() => window.app.editChord(0, 1)); await page.waitForTimeout(400);
    await page.selectOption('#root', 'F'); await page.waitForTimeout(300);
    check(await page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[1].root === 'F'),
        'changer la fondamentale s\'écrit tout de suite, sans bouton Valider');
    await page.selectOption('#octave', '5'); await page.waitForTimeout(300);
    await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control');
    await page.waitForTimeout(400);
    const apres = await page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[1]);
    check(apres.root === 'D' && String(apres.octave) === '4',
        `un seul Ctrl+Z annule toute la session d'édition (${apres.root}, octave ${apres.octave})`);

    await browser.close();
    console.log('\nErreurs page : ' + (errors.length ? errors.join(' | ') : 'aucune'));
    check(errors.length === 0, 'aucune erreur JavaScript');
    console.log(`\n=== ${PASS} PASS / ${FAIL} FAIL ===`);
    process.exit(FAIL ? 1 : 0);
})();
