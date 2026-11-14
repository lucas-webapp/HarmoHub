// LES DOIGTÉS DE GUITARE DU TIROIR : popover en grand, noms des notes, cadenas, alignements, fenêtre flottante (L8, affichage, 14/11), avec de vrais gestes.
//
// CE QUE DEMANDE L'UTILISATEUR (13/11 « toutes tes idées sont bonnes », 14/11 « on peut commencer par l'affichage », puis une quinzaine de commentaires posés sur l'appli en
// direct) : voir les doigtés proposés, le nom des notes en petit sur les diagrammes, un cadenas qui se lit (orange libre, vert verrouillé) et qui BLOQUE les flèches, des
// boutons alignés, le nom de l'accord calé sur la barre de lecture, des écarts qui suivent la taille de l'écran, et une fenêtre flottante qui garde tout visible quand on la réduit.
// (Ce banc s'appelait « vignettes » : la rangée de petits diagrammes sous le manche a été remplacée par la popover, à la demande de l'utilisateur ; il est réécrit, pas supprimé.)
//
// CE QUE LE BANC TIENT : le compteur « 1/4 » ouvre tous les doigtés EN GRAND (un clic en choisit un, Échap ou un clic à côté referme, la grille et l'historique ne bougent pas) ;
// les noms des notes sont éteints par défaut, s'allument dans Paramètres › Affichage (mémorisé), et ne passent pas sur les petits diagrammes ; le cadenas est orange puis vert,
// et verrouillé il grise les flèches et le compteur et le dit au toucher ; la deuxième rangée de boutons (cadenas, crayon) a les mêmes bords que celle des flèches, le crayon est
// un bouton comme les autres ; l'écart clavier / manche est de 120, 80 ou 40 px selon l'écran ; le nom de l'accord est centré sur Stop, son trait sur le bord de Boucle ;
// détaché et réduit, le tiroir garde boutons, nom et clavier visibles ; les touches du clavier ne sont plus rondes ; le téléphone n'a pas bougé.
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('doigtés de guitare');
const { estBruitReseau } = require('./_harness');

plan(64);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const graine = () => {
    const mk = (r, q, bass = null) => ({ root: r, quality: q, beats: 4, inversion: 0, drop: 'none', octave: 3, bass, playStyle: 'held' });
    const S = [{ title: 'Couplet', chords: [mk('C', 'maj7', 'E'), mk('A', 'min7'), mk('D', 'min7'), mk('G', 'dom7')] }];
    localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), sections: S }]));
    localStorage.setItem('harmohubCurrentSongId', 's1');
    localStorage.setItem('myProgression', JSON.stringify({ sections: S }));
    sessionStorage.setItem('cc_accueil_vu', '1');
};

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    const ouvrir = async (viewport) => {
        const p = await nav.newPage({ viewport });
        p.on('pageerror', e => erreurs.push(e.message));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) erreurs.push('console: ' + m.text()); });
        await p.goto(`${BASE}/index.html`);
        await p.evaluate(graine);
        await p.reload();
        await p.waitForTimeout(900);
        return p;
    };
    const guitareAffichee = async (p, on) => {
        if ((await p.getAttribute('#toggle-viz-guitar', 'aria-pressed')) !== String(on)) await p.click('#toggle-viz-guitar', { force: true });
        await p.waitForTimeout(250);
    };
    // Un vrai appui de souris au centre de l'élément (les boutons du tiroir sont parfois recouverts d'un autre calque : Playwright refuserait le clic).
    const appui = async (p, sel) => {
        const b = await p.locator(sel).boundingBox();
        await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(300);
    };
    const choisirCase = async (p) => { await p.click('#progression-sections .chord-grid[data-section="0"] .grid-cell[data-index="0"]'); await p.waitForTimeout(500); };
    const etat = (p) => p.evaluate(() => ({
        index: window.app.guitarFingeringIndex, total: window.app.guitarFingerings.length,
        label: document.getElementById('guitar-nav-label').textContent,
        ouverte: !document.getElementById('guitar-doigtes-pop').hidden,
        grand: document.getElementById('guitar-viz').innerHTML,
    }));
    const noms = (p, sel) => p.evaluate((sel) => [...document.querySelectorAll(sel + ' svg text')].filter(t => t.getAttribute('font-weight') === '700' && t.textContent !== 'X').map(t => t.textContent), sel);
    const rect = (p, sel) => p.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; }, sel);

    // ======================================================================================================
    console.log('\n=== A. Le compteur ouvre tous les doigtés en grand ===');
    const p = await ouvrir({ width: 1440, height: 900 });
    await guitareAffichee(p, true);
    await choisirCase(p);
    let e = await etat(p);
    exiger(e.total >= 2, `Cmaj7/E propose plusieurs doigtés (${e.total})`);
    check(await p.locator('#guitar-vignettes').count() === 0, 'plus de rangée de petites vignettes sous le manche');
    check(!e.ouverte, 'la popover est fermée au départ');
    await appui(p, '#guitar-nav-label');
    e = await etat(p);
    check(e.ouverte && await p.locator('#guitar-doigtes-pop .doigte-choix').count() === e.total, `un clic sur « ${e.label} » l'ouvre, avec ${e.total} diagrammes`);
    check(await p.evaluate(() => [...document.querySelectorAll('#guitar-doigtes-pop .doigte-choix')].map(b => b.getAttribute('aria-pressed')).join()) === 'true' + ',false'.repeat(e.total - 1), 'le doigté affiché est le seul marqué');
    const geo = await p.evaluate(() => {
        const pop = document.getElementById('guitar-doigtes-pop').getBoundingClientRect(), c = document.getElementById('guitar-nav-label').getBoundingClientRect();
        const larg = [...document.querySelectorAll('#guitar-doigtes-pop .doigte-choix svg')].map(s => s.getBoundingClientRect().width);
        return { auDessus: pop.bottom <= c.top, dedans: pop.left >= 0 && pop.right <= window.innerWidth && pop.top >= 0, minLarg: Math.min(...larg) };
    });
    check(geo.auDessus && geo.dedans, 'elle s\'ouvre au-dessus du compteur, entièrement dans la fenêtre');
    check(geo.minLarg >= 150, `les diagrammes sont lisibles : ${Math.round(geo.minLarg)} px de large au moins (50 px pour l'ancienne vignette)`);
    const avant = await p.evaluate(() => JSON.stringify(loadProgressionSections()));
    const annul0 = await p.evaluate(() => window.app.undoStack.length);
    const grand0 = e.grand;
    await appui(p, '#guitar-doigtes-pop .doigte-choix:nth-child(3)');
    const e2 = await etat(p);
    check(e2.index === 2 && e2.label === `3/${e.total}` && !e2.ouverte, `choisir le 3e le met sur le manche et referme (index ${e2.index}, compteur ${e2.label})`);
    check(e2.grand !== grand0, 'le grand diagramme a changé');
    check(await p.evaluate(() => JSON.stringify(loadProgressionSections())) === avant && await p.evaluate(() => window.app.undoStack.length) === annul0, 'la grille et l\'historique d\'annulation n\'ont pas bougé');
    await p.click('#guitar-next'); await p.waitForTimeout(250);
    check((await etat(p)).index === 3, '‹ › marche toujours (index 3 après « › »)');
    await appui(p, '#guitar-nav-label');
    await p.keyboard.press('Escape'); await p.waitForTimeout(250);
    check(!(await etat(p)).ouverte, 'Échap referme la popover');
    await appui(p, '#guitar-nav-label');
    await p.mouse.click(300, 300); await p.waitForTimeout(250);
    check(!(await etat(p)).ouverte, 'un clic à côté la referme aussi');

    // ======================================================================================================
    console.log('\n=== B. Pastilles : écriture dedans, couleurs, taille ===');
    check((await noms(p, '#guitar-viz')).length === 0, 'écriture éteinte par défaut : rien d\'écrit dans les pastilles (ni « O » dans celles des cordes à vide)');
    check(await p.evaluate(() => { const t = [...document.querySelectorAll('#guitar-viz svg text')].find(x => /^\d+$/.test(x.textContent)); return !!t && t.getAttribute('font-size') === '10' && t.getAttribute('fill') === '#d6d6d6'; }), 'les numéros de case sont plus grands (10) et plus clairs');
    // Un doigté avec des cordes à vide (le premier de la liste) pour voir les deux sortes de pastilles.
    await appui(p, '#guitar-nav-label'); await appui(p, '#guitar-doigtes-pop .doigte-choix:nth-child(1)');
    const disques = await p.evaluate(() => [...document.querySelectorAll('#guitar-viz svg circle')].map(c => c.getAttribute('r')));
    check(disques.includes('8.5') && disques.includes('8'), `pastilles pleines et plus grandes (le texte passe) : 8,5 de rayon sur les cases, 8 sur les cordes à vide (${[...new Set(disques)].join(' ')})`);
    check(await p.evaluate(() => { const x = [...document.querySelectorAll('#guitar-viz svg text')].find(t => t.textContent === 'X'); return !!x && x.getAttribute('font-size') === '12'; }), 'les X des cordes étouffées sont agrandis (12)');
    await p.click('#open-settings'); await p.waitForTimeout(400);
    exiger(await p.locator('#guitar-label-mode button').count() === 3, 'Paramètres › Affichage a le choix « Pastilles de la guitare » : Rien | Notes | Degrés');
    await p.click('#guitar-label-mode [data-mode="notes"]'); await p.waitForTimeout(300);
    check(await p.getAttribute('#guitar-label-mode [data-mode="notes"]', 'aria-checked') === 'true' && await p.evaluate(() => localStorage.getItem('harmohubNomsNotesGuitare')) === 'notes', 'Notes : le choix se marque et se mémorise');
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    const n1 = await noms(p, '#guitar-viz');
    check(n1.length >= 3 && n1.every(n => ['C', 'E', 'G', 'B'].includes(n)), `les noms écrits dans les pastilles sont ceux des notes de Cmaj7 : ${n1.join(' ')}`);
    check(await p.evaluate(() => document.querySelectorAll('.key[data-etiquette]').length) === 0, 'le clavier a son propre réglage : écrire les notes à la guitare n\'écrit rien sur ses touches');
    await appui(p, '#guitar-nav-label');
    check((await noms(p, '#guitar-doigtes-pop')).length === 0, 'rien n\'est écrit dans les petits diagrammes de la popover');
    await p.keyboard.press('Escape'); await p.waitForTimeout(250);
    // La roue des diagrammes règle la même chose, et le nombre de doigtés proposés.
    await appui(p, '#vues-reglages');
    check(await p.evaluate(() => !document.getElementById('vues-reglages-pop').hidden) && await p.locator('#vues-mode-piano button').count() === 3 && await p.locator('#vues-mode-guitare button').count() === 3 && await p.locator('#vues-max-doigtes button').count() === 5, 'la roue ouvre « Diagrammes » : affichage piano (3 choix), affichage guitare (3 choix) et nombre de diagrammes (5 choix)');
    check((await p.textContent('#vues-reglages-pop')).includes('Nb diagrammes') && !(await p.textContent('#vues-reglages-pop')).includes('Écriture'), 'libellés courts : « Affichage piano », « Affichage guitare », « Nb diagrammes »');
    // Deux affichages DIFFÉRENTS à la fois : les notes au piano, les degrés à la guitare (« j'aimerais bien repérer les degrés à la guitare et les notes au piano »).
    await appui(p, '#vues-mode-piano [data-mode="notes"]');
    await appui(p, '#vues-mode-guitare [data-mode="degres"]');
    const n2 = await noms(p, '#guitar-viz');
    check(n2.length >= 3 && n2.every(n => ['1', '3', '5', '7'].includes(n)) && n2.includes('1') && n2.includes('7'), `guitare en degrés : 1, 3, 5, 7 de Cmaj7 dans les pastilles (${n2.join(' ')})`);
    check(await p.evaluate(() => { const k = [...document.querySelectorAll('.key[data-etiquette]')].map(x => x.dataset.etiquette); return k.length >= 4 && k.every(n => ['C', 'E', 'G', 'B'].includes(n)); }), 'et, en même temps, le piano écrit des notes (C, E, G, B)');
    await appui(p, '#vues-mode-piano [data-mode="degres"]');
    check(await p.evaluate(() => document.querySelector('.key.active.role-root').dataset.etiquette) === '1' && await p.getAttribute('#vues-mode-piano [data-mode="degres"]', 'aria-checked') === 'true', 'piano en degrés : la tonique porte « 1 »');
    // Un accord mineur : le degré de la tierce s'écrit avec le signe bémol (« ♭3 »), jamais avec un B.
    await p.click('#progression-sections .chord-grid[data-section="0"] .grid-cell[data-index="1"]'); await p.waitForTimeout(500);
    const nm = await noms(p, '#guitar-viz');
    check(nm.includes('♭3') && nm.includes('♭7') && !nm.some(n => /^b/i.test(n)), `Am7 : tierce « ♭3 » et septième « ♭7 » avec le signe bémol (${nm.join(' ')})`);
    await p.click('#progression-sections .chord-grid[data-section="0"] .grid-cell[data-index="0"]'); await p.waitForTimeout(500);
    await appui(p, '#vues-reglages'); // cliquer une case de la grille a refermé la roue (clic à côté) : on la rouvre
    await appui(p, '#vues-max-doigtes [data-max="2"]');
    check((await etat(p)).total <= 2 && await p.evaluate(() => localStorage.getItem('harmohubMaxDoigtes')) === '2', `« 2 » doigtés proposés au plus : la liste passe à ${(await etat(p)).total}, et le réglage se mémorise`);
    await appui(p, '#vues-max-doigtes [data-max="4"]');
    await p.keyboard.press('Escape'); await p.waitForTimeout(250);
    check(await p.evaluate(() => document.getElementById('vues-reglages-pop').hidden), 'Échap referme la roue');
    await p.click('#open-settings'); await p.waitForTimeout(400);
    check(await p.getAttribute('#guitar-label-mode [data-mode="degres"]', 'aria-checked') === 'true' && await p.getAttribute('#piano-label-mode [data-mode="degres"]', 'aria-checked') === 'true', 'Paramètres › Affichage montre les mêmes choix que la roue (touches du piano, pastilles de la guitare)');
    await p.click('#guitar-label-mode [data-mode="rien"]'); await p.click('#piano-label-mode [data-mode="rien"]'); await p.waitForTimeout(300);
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    check((await noms(p, '#guitar-viz')).length === 0 && await p.evaluate(() => document.querySelectorAll('.key[data-etiquette]').length) === 0, 'Rien : plus rien d\'écrit, ni dans les pastilles ni sur les touches');
    await p.reload(); await p.waitForTimeout(900);
    await choisirCase(p);
    check(await p.evaluate(() => localStorage.getItem('harmohubNomsNotesGuitare')) === 'rien' && (await noms(p, '#guitar-viz')).length === 0, 'le réglage survit au rechargement');
    check(await p.evaluate(() => { const bg = getComputedStyle(document.querySelector('.key.active.role-root')).backgroundImage; return bg.includes('rgba(44, 190, 138, 0.65)'); }), 'les touches actives sont à 65 % d\'opacité, aux couleurs ni flashy ni pâles');

    // ======================================================================================================
    console.log('\n=== C. Le cadenas : orange libre, vert verrouillé, flèches bloquées ===');
    const couleur = () => p.evaluate(() => getComputedStyle(document.getElementById('guitar-lock-btn')).color);
    check(await couleur() === 'rgb(240, 180, 90)', `libre : cadenas orange (${await couleur()})`);
    await appui(p, '#guitar-lock-btn');
    check(await couleur() === 'rgb(0, 230, 118)' && await p.getAttribute('#guitar-lock-btn', 'aria-pressed') === 'true', 'verrouillé : cadenas vert');
    const iv = (await etat(p)).index;
    await appui(p, '#guitar-next');
    check((await etat(p)).index === iv && (await p.textContent('#toast')).includes('Doigté verrouillé'), 'verrouillé, « › » ne change rien et dit pourquoi');
    check(await p.evaluate(() => ['guitar-prev', 'guitar-next', 'guitar-nav-label'].every(id => document.getElementById(id).getAttribute('aria-disabled') === 'true')), 'les flèches et le compteur sont marqués bloqués');
    await appui(p, '#guitar-nav-label');
    check(!(await etat(p)).ouverte, 'le compteur n\'ouvre pas la popover tant que le doigté est verrouillé');
    await appui(p, '#guitar-lock-btn');
    await appui(p, '#guitar-next');
    check(await couleur() !== 'rgb(0, 230, 118)' && (await etat(p)).index !== iv, 'libéré : les flèches marchent de nouveau');

    // ======================================================================================================
    console.log('\n=== D. Alignements du tiroir (1440 px) ===');
    const nv = await rect(p, '#guitar-nav'), lk = await rect(p, '#guitar-lock-btn'), ed = await rect(p, '#guitar-edit-btn'), gv = await rect(p, '#guitar-viz svg');
    check(Math.abs(lk.t - ed.t) < 1 && lk.r <= ed.l, 'le cadenas est sur la même ligne que le crayon, à sa gauche');
    check(Math.abs(lk.l - nv.l) < 1.5 && Math.abs(ed.r - nv.r) < 1.5, 'les deux rangées ont les mêmes bords gauche et droit');
    check(Math.abs(ed.h - 32) < 1 && await p.evaluate(() => getComputedStyle(document.getElementById('guitar-edit-btn')).borderRadius) === '7px', 'le crayon est un bouton de 32 px à 7 px d\'arrondi, comme les autres');
    check(Math.round(gv.w) === 170, `le manche est agrandi : ${Math.round(gv.w)} px de large (119 avant)`);
    check(await p.evaluate(() => { const w = getComputedStyle(document.querySelector('.key.white')), k = getComputedStyle(document.querySelector('.key.black')); return w.borderBottomLeftRadius === '3px' && k.borderBottomLeftRadius === '2px'; }), 'les touches du clavier ont un chanfrein de 3 / 2 px (6 / 5 avant : elles paraissaient rondes)');
    const ecart = (q) => p.evaluate(() => Math.round(document.getElementById('guitar-viz').getBoundingClientRect().left - document.getElementById('piano-viz').getBoundingClientRect().right));
    check(await ecart() === 80, `écart clavier / manche à 1440 px : 80 px (${await ecart()})`);
    const surBarre = () => p.evaluate(() => {
        const q = s => document.querySelector(s).getBoundingClientRect(), c = q('.vues-corps .chord-chip'), t = q('.vues-corps .chord-header-row'), s = q('#stop'), b = q('#boucle-btn');
        return { centre: Math.abs((c.left + c.right) / 2 - (s.left + s.right) / 2), trait: Math.abs(t.right - b.right) };
    });
    let sb = await surBarre();
    check(sb.centre <= 1.5 && sb.trait <= 1.5, `le nom est centré sur Stop (${sb.centre.toFixed(1)} px d'écart) et le trait tombe sur le bord de Boucle (${sb.trait.toFixed(1)})`);
    await p.close();

    const gros = await ouvrir({ width: 1440, height: 900 });
    await gros.evaluate(() => { localStorage.setItem('harmohubShowGuitar', '1'); localStorage.setItem('harmohubShowPiano', '1'); localStorage.setItem('harmohubVuesEchelle', '2'); });
    await gros.reload(); await gros.waitForTimeout(900);
    await choisirCase(gros);
    const fixes = await gros.evaluate(() => {
        const q = s => document.querySelector(s).getBoundingClientRect();
        const barre = ['#vues-reglages', '#vues-detacher', '#vues-fermer'].map(q), ctl = ['#guitar-prev', '#guitar-next', '#guitar-nav-label', '#guitar-lock-btn', '#guitar-edit-btn'].map(q);
        const inter = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        return { grossi: window.app._vues.echelleVue, hauteurBouton: Math.round(q('#guitar-prev').height), chevauche: barre.some(x => ctl.some(y => inter(x, y))) };
    });
    check(fixes.grossi > 1.2 && fixes.hauteurBouton === 32 && !fixes.chevauche, `diagrammes agrandis (échelle ${fixes.grossi}) : les boutons à droite du manche restent à 32 px et ne recouvrent pas ceux de la barre`);
    await gros.close();

    const grand = await ouvrir({ width: 1920, height: 1080 });
    await guitareAffichee(grand, true); await choisirCase(grand);
    check(await grand.evaluate(() => Math.round(document.getElementById('guitar-viz').getBoundingClientRect().left - document.getElementById('piano-viz').getBoundingClientRect().right)) === 120, 'écart clavier / manche à 1920 px : 120 px');
    await grand.close();
    const petit = await ouvrir({ width: 1024, height: 768 });
    await guitareAffichee(petit, true); await choisirCase(petit);
    check(await petit.evaluate(() => Math.round(document.getElementById('guitar-viz').getBoundingClientRect().left - document.getElementById('piano-viz').getBoundingClientRect().right)) === 40, 'écart clavier / manche à 1024 px : 40 px');
    sb = await petit.evaluate(() => {
        const q = s => document.querySelector(s).getBoundingClientRect(), c = q('.vues-corps .chord-chip'), t = q('.vues-corps .chord-header-row'), s = q('#stop'), b = q('#boucle-btn');
        return { centre: Math.abs((c.left + c.right) / 2 - (s.left + s.right) / 2), trait: Math.abs(t.right - b.right) };
    });
    check(sb.centre <= 1.5 && sb.trait <= 1.5, 'à 1024 px aussi, le nom est centré sur Stop et son trait sur Boucle');
    check(await petit.evaluate(() => { const c = document.getElementById('vues-corps'); return c.scrollWidth <= c.clientWidth + 1 && c.scrollHeight <= c.clientHeight + 1; }), 'à 1024 px, rien ne dépasse du tiroir');
    await petit.close();

    // ======================================================================================================
    console.log('\n=== E. Fenêtre flottante réduite : tout reste visible ===');
    const f = await ouvrir({ width: 1440, height: 900 });
    await guitareAffichee(f, true); await choisirCase(f);
    check(await f.evaluate(() => document.querySelector('#vues-detacher svg path[d^="M12 17v5"]') !== null && document.querySelector('#vues-detacher svg path[d="m2 2 20 20"]') === null), 'épinglé, le bouton de détachement montre une épingle (plus la flèche de sortie)');
    await appui(f, '#vues-detacher');
    check(await f.evaluate(() => document.getElementById('vues-tiroir').classList.contains('vues-libre')), 'le tiroir est détaché en fenêtre libre');
    check(await f.evaluate(() => document.querySelector('#vues-detacher svg path[d="m2 2 20 20"]') !== null), 'détaché, le bouton montre l\'épingle barrée (cliquer l\'épingle)');
    const toutVisible = () => f.evaluate(() => {
        const c = document.getElementById('vues-corps'), cr = c.getBoundingClientRect();
        const dans = (sel) => { const e = document.querySelector(sel); if (!e) return false; const x = e.getBoundingClientRect(); return x.width > 0 && x.top >= cr.top - 1 && x.bottom <= cr.bottom + 1 && x.left >= cr.left - 1 && x.right <= cr.right + 1; };
        return { tout: ['#guitar-lock-btn', '#guitar-edit-btn', '#guitar-nav-label', '#piano-viz', '#guitar-viz', '#current-chord-display'].every(dans), sansDefilement: c.scrollHeight <= c.clientHeight + 2 && c.scrollWidth <= c.clientWidth + 1, echelle: window.app._vues.echelleVue };
    });
    let tv = await toutVisible();
    check(tv.tout && tv.sansDefilement, 'à la taille de départ, tout est visible sans défiler');
    const reduire = async (dx, dy) => {
        const c = await f.locator('#vues-coin').boundingBox();
        await f.mouse.move(c.x + c.width / 2, c.y + c.height / 2); await f.mouse.down();
        await f.mouse.move(c.x + c.width / 2 + dx, c.y + c.height / 2 + dy, { steps: 8 }); await f.mouse.up(); await f.waitForTimeout(500);
    };
    await reduire(-160, -50);
    tv = await toutVisible();
    check(tv.tout && tv.sansDefilement && tv.echelle < 1, `fenêtre réduite une fois : tout est visible, les diagrammes ont rapetissé (échelle ${tv.echelle})`);
    await reduire(-200, -60);
    tv = await toutVisible();
    check(tv.tout && tv.sansDefilement, `fenêtre réduite au plus petit : boutons, nom et clavier encore visibles (échelle ${tv.echelle})`);
    // Puis on l'agrandit en tirant le coin : les diagrammes grandissent avec la fenêtre (« trop petits alors que l'écran est large »), sans à-coup (« d'un coup, les diagrammes deviennent gros »).
    const echelles = [tv.echelle];
    for (let i = 0; i < 4; i++) { await reduire(150, 40); echelles.push((await toutVisible()).echelle); }
    tv = await toutVisible();
    check(echelles.every((e, i) => i === 0 || e >= echelles[i - 1] - 0.005) && echelles.every((e, i) => i === 0 || e - echelles[i - 1] < 0.45) && tv.echelle > echelles[0] + 0.5, `la fenêtre grandit en tirant le coin : les diagrammes grandissent avec elle, par petites marches (${echelles.join(' → ')})`);
    check(tv.tout && tv.sansDefilement, 'agrandie, tout reste visible, sans défiler');
    const air = await f.evaluate(() => { const t = document.querySelector('.vues-corps .chord-header-row').getBoundingClientRect(), c = document.querySelector('.vues-corps .chord-chip').getBoundingClientRect(); return Math.round(t.right - c.right); });
    check(air >= 10, `le nom de l'accord ne touche pas le trait vertical : ${air} px d'écart`);
    await f.close();

    // ======================================================================================================
    console.log('\n=== F. Le téléphone n\'a pas bougé ===');
    const t = await ouvrir({ width: 390, height: 844 });
    check(await t.evaluate(() => document.getElementById('guitar-nav-label').getBoundingClientRect().width) === 0, 'au téléphone, ni compteur ni popover de doigtés (le tiroir n\'existe pas sous 900 px)');
    check(await t.evaluate(() => document.getElementById('guitar-doigtes-pop').hidden), 'la popover reste fermée');
    await t.close();

    check(erreurs.length === 0, `aucune erreur de page (${erreurs.slice(0, 2).join(' | ')})`);
    await nav.close();
    bilan();
})();
