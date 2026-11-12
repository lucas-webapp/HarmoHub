// LE TIROIR CLAVIER / GUITARE (refonte, lot 8), avec de vrais gestes.
//
// CE QUE DEMANDE LA MAQUETTE VALIDÉE (docs/refonte.md) : « Clavier / Guitare : épinglés en bas par défaut, ou détachés en fenêtre libre (barre de titre qui
// déplace, coin qui redimensionne, punaise pour réépingler). Construire un accord au clavier puis « Remplacer » ou « Ajouter ». Guitare : le manche
// actuel AU COMPLET (doigtés, verrouillage, édition, dessin, envoi dans la grille). » Le bloc « Vues » (Clavier, Guitare) est le quatrième de la barre de lecture.
//
// CE QUE LE BANC TIENT : les deux boutons sont dans la barre ; le tiroir est épinglé au-dessus d'elle (la grille cède la place) ; détaché il se déplace, se
// redimensionne, reste dans l'écran, se retrouve après rechargement et se réépingle ; « Fermer » éteint les deux instruments ; un accord se construit touche
// par touche SANS rien écrire dans le morceau tant qu'on n'a pas cliqué Remplacer / Ajouter (une seule étape d'annulation) ; changer d'accord efface les
// notes tapées ; le manche travaille dans le tiroir comme dans son ancienne carte (doigtés, cadenas, dessin, envoi dans la grille) ; le téléphone n'a pas bougé.
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('tiroir clavier / guitare');
const { dblclickHorsNom } = require('./_geste_accord');
const { estBruitReseau } = require('./_harness');

plan(98);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const graine = () => {
    const mk = (r, q, b = 4) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
    const S = [
        { title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7'), mk('D', 'min7'), mk('G', 'dom7')] },
        { title: 'Refrain', chords: [mk('F', 'maj7'), mk('E', 'min7')] },
    ];
    localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), sections: S }]));
    localStorage.setItem('harmohubCurrentSongId', 's1');
    localStorage.setItem('myProgression', JSON.stringify({ sections: S }));
    sessionStorage.setItem('cc_accueil_vu', '1');
};
const DADD11 = [[1, 5], [2, 4], [3, 2], [4, 3], [5, 3]];

(async () => {
    const nav = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const erreurs = [];
    const ouvrir = async (viewport, avant) => {
        const ctx = await nav.newContext({ viewport });
        const p = await ctx.newPage();
        p.on('pageerror', e => erreurs.push(e.message));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) erreurs.push('console: ' + m.text()); });
        await p.goto(`${BASE}/index.html`);
        await p.evaluate(graine);
        if (avant) await p.evaluate(avant);
        await p.reload();
        await p.waitForTimeout(1000);
        return p;
    };
    const cellule = (s, i) => `#progression-sections .chord-grid[data-section="${s}"] .grid-cell[data-index="${i}"]`;
    const partie = (p, s) => p.evaluate((s) => loadProgressionSections()[s].chords.map(c => c.root + c.quality + (c.bass ? '/' + c.bass : '')).join(' '), s);
    const rect = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e || e.hidden) return null; const r = e.getBoundingClientRect(); if (!r.width && !r.height) return null; return { x: r.x, y: r.y, w: r.width, h: r.height, b: r.bottom, r: r.right }; }, sel);
    const touche = async (p, midi) => { await p.click(`#piano-viz .key[data-midi="${midi}"]`); await p.waitForTimeout(80); };
    // La fenêtre du clavier commence toujours sur un Do (computePianoWindow) : c'est la touche 0 de nos accords.
    const doDeLaFenetre = (p) => p.evaluate(() => Math.min(...[...document.querySelectorAll('#piano-viz .key')].map(k => +k.dataset.midi)));
    const ctrlZ = async (p) => { await p.keyboard.press('Control+z'); await p.waitForTimeout(300); };
    const bleues = (p) => p.evaluate(() => document.querySelectorAll('#piano-viz .key.kb-note').length);

    // ======================================================================================================
    console.log('\n=== A. Le bloc « Vues » de la barre de lecture ===');
    let p = await ouvrir({ width: 1440, height: 900 });
    const barre = await rect(p, '#barre-lecture');
    const bk = await rect(p, '#toggle-viz-piano'), bg = await rect(p, '#toggle-viz-guitar');
    exiger(!!bk && !!bg && !!barre, 'les boutons Clavier et Guitare sont à l\'écran');
    check(await p.evaluate(() => !!document.querySelector('#bl-vues #toggle-viz-piano') && !!document.querySelector('#bl-vues #toggle-viz-guitar')), 'ce sont les boutons EXISTANTS (mêmes adresses), dans le bloc « Vues »');
    check(bk.y >= barre.y && bk.b <= barre.b && bg.y >= barre.y && bg.b <= barre.b, 'entièrement dans la barre de lecture');
    check(Math.round(bk.h) === 32 && Math.round(bk.w) === 32 && Math.round(bg.h) === 32, `à la jauge de 32 px (${Math.round(bk.w)}×${Math.round(bk.h)})`);
    check(await p.evaluate(() => document.querySelectorAll('#barre-lecture .bl-bloc').length === 4 && window.app._blOrdre.includes('vues')), 'quatre blocs réordonnables, « vues » compris');
    check(await p.evaluate(() => !!document.querySelector('#bl-vues .bl-fleches')), 'le bloc porte ses flèches ◀ ▶ en mode « réorganiser » comme les autres');
    check(await p.evaluate(() => document.getElementById('toggle-viz-piano').getAttribute('aria-pressed') === 'true' && document.getElementById('toggle-viz-guitar').getAttribute('aria-pressed') === 'false'), 'le clavier est allumé au départ, la guitare éteinte (comme avant)');

    // ======================================================================================================
    console.log('\n=== B. Épinglé : au-dessus de la barre, la grille cède la place ===');
    let t = await rect(p, '#vues-tiroir');
    exiger(!!t, 'le tiroir est visible, épinglé');
    check(Math.abs(t.b - barre.y) <= 1, `collé au-dessus de la barre de lecture (bas ${Math.round(t.b)}, barre ${Math.round(barre.y)})`);
    check(t.x === 0 && Math.round(t.w) === 1440, 'sur toute la largeur');
    const grille = await rect(p, '#grille-cadre');
    check(grille.b <= t.y + 1, `la grille ne passe pas dessous (bas de la grille ${Math.round(grille.b)}, haut du tiroir ${Math.round(t.y)})`);
    check(await p.evaluate(() => !!document.querySelector('#vues-corps #piano-viz') && !!document.querySelector('#vues-corps #current-chord-display')), 'il porte le clavier et le titre de l\'accord (les nœuds existants, pas des copies)');
    check(await p.evaluate(() => document.querySelectorAll('#piano-viz').length === 1 && document.querySelectorAll('#current-chord-display').length === 1), 'un seul clavier, un seul titre dans la page');
    const pb = await rect(p, '#piano-viz');
    check(pb.y >= t.y && pb.b <= t.b, 'le clavier est entièrement dans le tiroir');
    await p.click('#toggle-viz-guitar'); await p.waitForTimeout(400);
    check(await p.evaluate(() => getComputedStyle(document.getElementById('guitar-viz-wrap')).display !== 'none' && !!document.querySelector('#vues-corps #guitar-viz svg')), 'Guitare : le manche s\'ouvre dans le même tiroir, à côté du clavier');
    check(await p.evaluate(() => document.getElementById('vues-titre').textContent === 'Clavier et guitare'), 'le titre le dit');
    await p.click('#toggle-viz-piano'); await p.waitForTimeout(300);
    check(await p.evaluate(() => document.getElementById('vues-titre').textContent === 'Guitare') && await rect(p, '#vues-tiroir') !== null, 'clavier éteint : le tiroir reste ouvert pour la guitare seule');
    await p.click('#toggle-viz-guitar'); await p.waitForTimeout(300);
    check(await rect(p, '#vues-tiroir') === null, 'les deux éteints : plus de tiroir');
    check(await rect(p, '#grille-cadre') !== null && (await rect(p, '#grille-cadre')).b > grille.b - 1, 'et la grille reprend la place');
    await p.click('#toggle-viz-piano'); await p.waitForTimeout(300);
    await p.click('#toggle-viz-guitar'); await p.waitForTimeout(300);
    await p.click('#vues-fermer'); await p.waitForTimeout(300);
    check(await rect(p, '#vues-tiroir') === null && await p.evaluate(() => document.getElementById('toggle-viz-piano').getAttribute('aria-pressed') === 'false' && document.getElementById('toggle-viz-guitar').getAttribute('aria-pressed') === 'false'), '« Fermer » éteint les deux instruments');
    await p.click('#toggle-viz-piano'); await p.waitForTimeout(300);

    // ======================================================================================================
    console.log('\n=== C. Fenêtre libre : se déplace, se redimensionne, reste dans l\'écran, se retrouve, se réépingle ===');
    check(await p.evaluate(() => document.getElementById('vues-detacher').getAttribute('aria-pressed') === 'false' && document.getElementById('vues-coin').hidden), 'épinglé : pas de coin de redimensionnement');
    await p.click('#vues-detacher'); await p.waitForTimeout(300);
    t = await rect(p, '#vues-tiroir');
    exiger(!!t && await p.evaluate(() => getComputedStyle(document.getElementById('vues-tiroir')).position === 'fixed'), 'détaché : une fenêtre fixe');
    check(t.b <= barre.y + 1 && t.y >= 0 && t.x >= 0 && t.r <= 1440, `elle est dans l'écran, au-dessus de la barre de lecture (${Math.round(t.x)},${Math.round(t.y)} ${Math.round(t.w)}×${Math.round(t.h)})`);
    check(await p.evaluate(() => getComputedStyle(document.getElementById('vues-tiroir')).borderTopLeftRadius === '12px'), 'arrondi de 12 px, comme tout ce qui flotte');
    check(await p.evaluate(() => document.getElementById('vues-detacher').getAttribute('aria-pressed') === 'true' && /Épingler/.test(document.getElementById('vues-detacher').title)), 'le bouton devient la punaise : « Épingler en bas de l\'écran »');
    check(await rect(p, '#vues-aide') !== null && await rect(p, '#vues-coin') !== null, 'la barre de titre explique le geste, le coin est là');
    const barreTitre = await rect(p, '#vues-barre');
    await p.mouse.move(t.x + 60, barreTitre.y + barreTitre.h / 2);
    await p.mouse.down(); await p.mouse.move(t.x + 60 - 150, barreTitre.y + barreTitre.h / 2 - 120, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(200);
    let t2 = await rect(p, '#vues-tiroir');
    check(Math.abs((t2.x - t.x) + 150) <= 2 && Math.abs((t2.y - t.y) + 120) <= 2, `la barre de titre DÉPLACE la fenêtre (de ${Math.round(t2.x - t.x)}, ${Math.round(t2.y - t.y)})`);
    check(Math.round(t2.w) === Math.round(t.w) && Math.round(t2.h) === Math.round(t.h), 'sans changer sa taille');
    const coin = await rect(p, '#vues-coin');
    await p.mouse.move(coin.x + 10, coin.y + 10);
    await p.mouse.down(); await p.mouse.move(coin.x + 10 + 120, coin.y + 10 + 50, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(200);
    let t3 = await rect(p, '#vues-tiroir');
    check(Math.abs((t3.w - t2.w) - 120) <= 2 && Math.abs((t3.h - t2.h) - 50) <= 2, `le coin REDIMENSIONNE (+${Math.round(t3.w - t2.w)}, +${Math.round(t3.h - t2.h)})`);
    check(Math.round(t3.x) === Math.round(t2.x) && Math.round(t3.y) === Math.round(t2.y), 'sans la déplacer');
    // Trop petit, trop loin : bornée.
    const c2 = await rect(p, '#vues-coin');
    await p.mouse.move(c2.x + 10, c2.y + 10); await p.mouse.down(); await p.mouse.move(c2.x - 900, c2.y - 700, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(200);
    let t4 = await rect(p, '#vues-tiroir');
    check(t4.w >= 360 && t4.h >= 150, `jamais plus petite que ses commandes (${Math.round(t4.w)}×${Math.round(t4.h)})`);
    const b4 = await rect(p, '#vues-barre');
    await p.mouse.move(t4.x + 40, b4.y + b4.h / 2); await p.mouse.down(); await p.mouse.move(-400, 2000, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(200);
    let t5 = await rect(p, '#vues-tiroir');
    check(t5.x >= 0 && t5.y >= 0 && t5.r <= 1440 && t5.b <= barre.y + 1, `tirée hors de l'écran, elle reste entièrement visible, au-dessus de la barre (${Math.round(t5.x)},${Math.round(t5.y)} → ${Math.round(t5.r)},${Math.round(t5.b)})`);
    await p.reload(); await p.waitForTimeout(1000);
    let t6 = await rect(p, '#vues-tiroir');
    exiger(!!t6, 'après rechargement le tiroir est là');
    check(Math.round(t6.x) === Math.round(t5.x) && Math.round(t6.y) === Math.round(t5.y) && Math.round(t6.w) === Math.round(t5.w) && Math.round(t6.h) === Math.round(t5.h), 'toujours détaché, au même endroit, à la même taille (mémoire PAR APPAREIL)');
    check(!require('fs').readFileSync(require('path').join(__dirname, '..', 'synchro-harmohub.js'), 'utf8').includes('harmohubVues'), 'et ces réglages ne sont pas synchronisés dans le nuage');
    check(await p.evaluate(() => getComputedStyle(document.getElementById('vues-tiroir')).zIndex === '45'), 'au-dessus de la grille et de la barre de sélection, sous les fenêtres');
    await p.click('#vues-detacher'); await p.waitForTimeout(300);
    t = await rect(p, '#vues-tiroir');
    check(Math.abs(t.b - barre.y) <= 1 && Math.round(t.w) === 1440, 'la punaise le réépingle : de nouveau collé au-dessus de la barre');
    check(await p.evaluate(() => localStorage.getItem('harmohubVuesMode') === 'epingle'), 'et le choix est mémorisé');

    // ======================================================================================================
    console.log('\n=== D. Construire un accord au clavier ===');
    await p.click(cellule(0, 1)); await p.waitForTimeout(300);
    const selAvant = await p.evaluate(() => window.app.selectedIndex);
    const photo = await partie(p, 0);
    check(await rect(p, '#kb-construction') === null, 'avant le premier clic, pas de bande de construction');
    const dod = await doDeLaFenetre(p);
    await touche(p, dod + 2);
    check(await p.evaluate(() => window.app.selectedIndex) === selAvant, 'cliquer une touche ne désélectionne pas l\'accord');
    exiger(await rect(p, '#kb-construction') !== null, 'un clic sur une touche ouvre la bande de construction');
    check(await bleues(p) === 1, 'la touche tapée s\'allume en bleu (la sélection est bleue)');
    check(/Tu joues : D/.test(await p.textContent('#kb-notes')), `elle dit ce qu'on joue (« ${await p.textContent('#kb-notes')} »)`);
    check(await p.evaluate(() => document.getElementById('kb-nom').classList.contains('kb-non-reconnu')), 'une seule note : « Accord non reconnu »');
    check(await p.evaluate(() => document.getElementById('kb-remplacer').disabled && document.getElementById('kb-ajouter').disabled), 'et ni Remplacer ni Ajouter ne sont proposés');
    await touche(p, dod + 6); await touche(p, dod + 9); await touche(p, dod + 12);
    check(await bleues(p) === 4, 'quatre touches bleues');
    check(await p.textContent('#kb-nom') === 'D7', `le nom reconnu : ${await p.textContent('#kb-nom')} (D · F♯ · A · C)`);
    check(await p.evaluate(() => (document.getElementById('kb-remplacer').textContent || '').trim() === 'Remplacer Am7'), 'Remplacer dit QUEL accord il remplace (celui qui est sélectionné)');
    check(await partie(p, 0) === photo, 'rien n\'est écrit dans le morceau tant qu\'on n\'a pas cliqué');
    check(await p.evaluate(() => document.querySelectorAll('#piano-viz .key.active:not(.kb-note)').length === 0), 'le clavier montre ce qu\'on construit, plus l\'accord de la grille');
    await touche(p, dod + 12);
    check(await bleues(p) === 3 && /Tu joues : D · F♯ · A/.test((await p.textContent('#kb-notes')).replace('#', '♯')), 'recliquer une touche allumée la retire');
    await touche(p, dod + 12);
    const lectures = await p.evaluate(() => [...document.querySelectorAll('.kb-lecture')].map(b => b.textContent));
    check(lectures.length >= 2 && lectures[0] === 'D7', `plusieurs lectures possibles, la plus cohérente d'abord (${lectures})`);
    await p.click('#kb-effacer'); await p.waitForTimeout(200);
    check(await rect(p, '#kb-construction') === null && await bleues(p) === 0, '« Effacer » vide les notes et ferme la bande');
    check(await p.evaluate(() => document.querySelectorAll('#piano-viz .key.active.role-root').length > 0), 'le clavier remontre l\'accord de la grille');
    await touche(p, dod + 2); await touche(p, dod + 6); await touche(p, dod + 9); await touche(p, dod + 12);
    await p.click('#kb-remplacer'); await p.waitForTimeout(500);
    check(await partie(p, 0) === 'Cmaj7 Ddom7 Dmin7 Gdom7', `Remplacer : Am7 devient D7 (${await partie(p, 0)})`);
    check(await rect(p, '#kb-construction') === null && await bleues(p) === 0, 'la bande se referme');
    await ctrlZ(p);
    check(await partie(p, 0) === photo, 'UN Ctrl+Z rend l\'accord remplacé');
    // Un autre accord choisi efface les notes tapées.
    await touche(p, dod + 4); await touche(p, dod + 7);
    check(await bleues(p) === 2, 'deux notes tapées');
    await p.click(cellule(0, 2)); await p.waitForTimeout(300);
    check(await rect(p, '#kb-construction') === null && await bleues(p) === 0, 'choisir un autre accord de la grille efface les notes tapées');
    // Ajouter en fin de partie : celle de l'accord sélectionné.
    await p.click(cellule(1, 0)); await p.waitForTimeout(300);
    // Refonte du séquenceur, point B : un clic sélectionne et fait entendre sans ouvrir la bulle (~430 px, qui descendait jusque sur les touches et qu'il
    // fallait fermer d'abord). Les touches restent donc libres, l'accord est choisi.
    check(await p.evaluate(() => window.app.selectedIndex === 0 && window.app.activeSection === 1 && document.getElementById('bulle-accord').hidden),
        'un clic choisit l\'accord sans ouvrir de bulle sur les touches (Remplacer / Ajouter le visent)');
    await touche(p, dod); await touche(p, dod + 4); await touche(p, dod + 7);
    check(await p.textContent('#kb-nom') === 'C', `Do · Mi · Sol : ${await p.textContent('#kb-nom')}`);
    await p.click('#kb-ajouter'); await p.waitForTimeout(500);
    check(await partie(p, 1) === 'Fmaj7 Emin7 Cmaj', `Ajouter en fin de partie : l'accord arrive à la fin du Refrain (${await partie(p, 1)})`);
    check(await partie(p, 0) === photo, 'la première partie n\'a pas bougé');
    await ctrlZ(p);
    check(await partie(p, 1) === 'Fmaj7 Emin7', 'UN Ctrl+Z le retire');
    // Une autre lecture, choisie à la souris.
    await p.click(cellule(0, 1)); await p.waitForTimeout(300);
    await touche(p, dod + 2); await touche(p, dod + 6); await touche(p, dod + 9); await touche(p, dod + 12);
    await p.locator('.kb-lecture', { hasText: /^D$/ }).click(); await p.waitForTimeout(200);
    check(await p.textContent('#kb-nom') === 'D', 'une autre lecture se choisit d\'un clic (D)');
    check(/Remplacer Am7/.test(await p.textContent('#kb-remplacer')), 'et Remplacer reste sur le bon accord');
    await p.click('#kb-remplacer'); await p.waitForTimeout(400);
    check((await partie(p, 0)).split(' ')[1] === 'Dmaj', `c'est la lecture CHOISIE qui est écrite (${await partie(p, 0)})`);
    // Sans accord sélectionné : on peut seulement ajouter.
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    await p.mouse.click(1300, 300); await p.waitForTimeout(300);
    check(await p.evaluate(() => window.app.selectedIndex === null), 'plus d\'accord sélectionné');
    await touche(p, dod); await touche(p, dod + 4); await touche(p, dod + 7);
    check(await p.evaluate(() => document.getElementById('kb-remplacer').disabled && !document.getElementById('kb-ajouter').disabled), 'sans accord choisi : Remplacer est grisé, Ajouter reste possible');
    check(/Sélectionne/.test(await p.getAttribute('#kb-remplacer', 'title')), 'et l\'infobulle dit pourquoi');
    await p.click('#kb-effacer');

    // Pendant une modification (inspecteur ouvert) : taper une touche n'en fait pas sortir, et ne désélectionne pas.
    await dblclickHorsNom(p, cellule(0, 1)); await p.waitForTimeout(300); // B2 (12/11) : hors du texte du nom ; point B : le double-clic ouvre la bulle (un clic seul fait entendre l'accord)
    await p.click('[data-bulle="son"]'); await p.waitForTimeout(400);
    const enEdition = await p.evaluate(() => window.app.editingIndex);
    exiger(enEdition === 1, 'l\'inspecteur « son de l\'accord » est ouvert sur l\'accord 2');
    await touche(p, await doDeLaFenetre(p) + 4);
    check(await p.evaluate(() => window.app.editingIndex === 1 && window.app.selectedIndex === 1), 'taper une touche pendant la modification n\'en fait pas sortir');
    await p.click('#kb-effacer');
    await p.click('#accord-close'); await p.waitForTimeout(300); // la croix de l'inspecteur : la modification se ferme
    // Structure et Paroles recouvrent la grille : le tiroir attend derrière elles.
    await p.click('#structure-btn'); await p.waitForTimeout(500);
    check(await rect(p, '#vues-tiroir') === null, 'sous la vue Structure le tiroir est masqué');
    await p.click('#tab-grille'); await p.waitForTimeout(500);
    check(await rect(p, '#vues-tiroir') !== null, 'et il revient avec la grille');

    // ======================================================================================================
    console.log('\n=== E. Guitare : le manche au complet, dans le tiroir ===');
    await p.click(cellule(0, 1)); await p.waitForTimeout(300);
    await p.click('#toggle-viz-guitar'); await p.waitForTimeout(500);
    exiger(await p.evaluate(() => !!document.querySelector('#vues-corps #guitar-viz svg')), 'le manche est dans le tiroir');
    // Une touche tapée PENDANT que l'accord sonne : l'audition s'arrête (stopAll), et stopAll vide le manche en comptant sur une lecture suivante
    // qui n'arrive pas. Le manche doit rester dessiné (défaut trouvé au lot 9a, sous la charge du balayage, par verre_test).
    await p.click(cellule(0, 2)); await p.waitForTimeout(120);
    exiger(await p.evaluate(() => window.app.isPlaying), 'cliquer une case fait entendre l\'accord (il sonne encore)');
    await touche(p, await doDeLaFenetre(p) + 4);
    await p.waitForTimeout(300);
    check(await p.evaluate(() => !window.app.isPlaying && !!document.querySelector('#vues-corps #guitar-viz svg')), 'une touche tapée pendant qu\'il sonne arrête l\'audition, et le manche reste dessiné');
    await p.click('#kb-effacer'); await p.waitForTimeout(200);
    await p.click(cellule(0, 1)); await p.waitForTimeout(2300); // retour sur l'accord 2, que la suite feuillette (l'audition du clic se termine)
    const lab1 = await p.textContent('#guitar-nav-label');
    await p.click('#guitar-next'); await p.waitForTimeout(250);
    check(await p.textContent('#guitar-nav-label') !== lab1, `les doigtés se feuillettent (${lab1} → ${await p.textContent('#guitar-nav-label')})`);
    await p.click('#guitar-prev'); await p.waitForTimeout(250);
    check(await p.textContent('#guitar-nav-label') === lab1, 'et reviennent');
    check(await p.evaluate(() => document.getElementById('guitar-lock-btn').getAttribute('aria-pressed')) === 'false', 'cadenas ouvert');
    await p.click('#guitar-lock-btn'); await p.waitForTimeout(300);
    check(await p.evaluate(() => document.getElementById('guitar-lock-btn').getAttribute('aria-pressed')) === 'true', 'le cadenas verrouille le doigté');
    check(await p.evaluate(() => window.app.selectedIndex === 1), 'sans désélectionner l\'accord');
    await p.click('#guitar-lock-btn'); await p.waitForTimeout(300);
    await p.click('#guitar-edit-btn'); await p.waitForTimeout(250);
    exiger(await p.evaluate(() => !document.getElementById('guitar-edit-overlay').hidden), 'l\'édition du manche s\'ouvre');
    check(await p.evaluate(() => getComputedStyle(document.getElementById('guitar-edit-overlay')).zIndex !== '' && document.getElementById('guitar-edit-overlay').getBoundingClientRect().width > 0), 'par-dessus le tiroir');
    await p.click('#guitar-edit-tab-draw'); await p.waitForTimeout(150);
    for (const [s, fret] of DADD11) {
        const b = await p.evaluate(() => { const svg = document.querySelector('#guitar-edit-neck svg'); const r = svg.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, vb: svg.viewBox.baseVal.width || r.width }; });
        const k = b.w / b.vb;
        await p.mouse.click(b.x + (fret === 0 ? 11 : 20 + (fret - 0.5) * 30) * k, b.y + (8 + (5 - s) * 16) * k); await p.waitForTimeout(90);
    }
    await p.click('#guitar-draw-validate'); await p.waitForTimeout(250);
    const cands = await p.evaluate(() => [...document.querySelectorAll('.guitar-draw-candidate')].map(b => b.textContent.trim()));
    check(cands[0] === 'Dadd11', `le dessin est reconnu (${cands})`);
    const nAvant = await p.evaluate(() => loadProgressionSections()[0].chords.length);
    await p.click('#guitar-draw-send'); await p.waitForTimeout(500);
    const apres = await partie(p, 0);
    check(await p.evaluate(() => loadProgressionSections()[0].chords.length) === nAvant + 1 && /Dadd11/.test(apres), `envoyé dans la grille depuis le tiroir (${apres})`);
    check(await p.evaluate(() => document.getElementById('guitar-edit-overlay').hidden), 'la fenêtre d\'édition se referme');
    await ctrlZ(p);
    check(await p.evaluate(() => loadProgressionSections()[0].chords.length) === nAvant, 'un Ctrl+Z défait l\'envoi');

    // ======================================================================================================
    console.log('\n=== F. Le tiroir passe sous le seuil du téléphone et revient ===');
    await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(500);
    check(await rect(p, '#vues-tiroir') === null, 'sous 900 px le tiroir n\'existe plus');
    check(await p.evaluate(() => !!document.querySelector('.viz-wrap > .viz-card #piano-viz') && !!document.querySelector('.viz-card > .viz-diagrams') && !!document.querySelector('.viz-card > .viz-toggle #toggle-viz-piano')), 'la carte des diagrammes et ses deux boutons reprennent leur place d\'origine');
    check(await p.evaluate(() => !!document.querySelector('.col-right > .chord-header-row') && document.querySelector('.chord-header-row').nextElementSibling.classList.contains('viz-wrap')), 'le titre de l\'accord aussi, juste avant la carte');
    check(await p.evaluate(() => !document.querySelector('#bl-vues .viz-toggle, #bl-vues button[id^="toggle-viz"]')), 'le bloc « Vues » ne porte plus les boutons (la barre est masquée)');
    await p.setViewportSize({ width: 1440, height: 900 }); await p.waitForTimeout(500);
    check(await rect(p, '#vues-tiroir') !== null && await p.evaluate(() => !!document.querySelector('#bl-vues #toggle-viz-piano') && !!document.querySelector('#vues-corps .viz-card')), 'revenu sur ordinateur : tout est reparti dans la barre et le tiroir');
    await p.context().close();

    // ======================================================================================================
    console.log('\n=== G. Le téléphone n\'a pas bougé ===');
    p = await ouvrir({ width: 390, height: 844 });
    check(await rect(p, '#vues-tiroir') === null, 'pas de tiroir');
    check(await p.evaluate(() => { const c = document.querySelector('.viz-card'); const r = c.getBoundingClientRect(); return r.width > 0 && !!c.querySelector('#piano-viz') && !!c.querySelector('#toggle-viz-guitar') && c.parentElement.classList.contains('viz-wrap'); }), 'la carte est sous la grille, avec ses boutons, comme avant');
    await p.click('#toggle-viz-guitar'); await p.waitForTimeout(400);
    check(await p.evaluate(() => getComputedStyle(document.getElementById('guitar-viz-wrap')).display !== 'none'), 'le bouton Guitare agit toujours');
    const kPhone = await p.evaluate(() => document.querySelector('#piano-viz').style.maxWidth);
    check(/^\d+px$/.test(kPhone) && parseInt(kPhone, 10) % 14 === 0, `touches du téléphone à 14 px (${kPhone})`);
    await p.context().close();

    check(erreurs.length === 0, `aucune erreur JavaScript (${erreurs.length}) ${erreurs.slice(0, 2).join(' | ')}`);
    await nav.close();
    bilan();
})();
