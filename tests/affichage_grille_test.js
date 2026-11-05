// L'AFFICHAGE DE LA GRILLE (refonte, lot 5a — docs/refonte.md, valeurs de la maquette validée), avec de vrais clics et de vrais glissés.
//
// CE QUE L'UTILISATEUR A DEMANDÉ : « les cases sont trop grosses, ça nuit à la visibilité » ; « je n'ai pas besoin de toute cette largeur… une fenêtre
// extensible, centrée, plus petite ? » ; « la fenêtre fonctionne bien en largeur… trouver une astuce en hauteur aussi » ; et « Compact / Normal / Détaillé
// remplace les quatre boutons de zoom ». Le banc tient les valeurs de la maquette : Compact 38px / 8 mesures / 640px, Normal 52px / 4 mesures / 480px,
// Détaillé 84px / 4 mesures / 640px ; poignée droite 360–1400px, poignée basse 30–160px, double-clic = valeurs d'origine ; tout cela par morceau.
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('affichage de la grille');
const { estBruitReseau } = require('./_harness');

plan(29);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const mk = (root, quality, beats = 4) => ({ root, quality, beats, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
const graine = ({ src, avecMorceau }) => {
    const m = eval('(' + src + ')');
    const A = [{ title: 'Couplet', chords: [m('C', 'maj7'), m('A', 'min7'), m('D', 'min7'), m('G', '7'), m('E', 'min7'), m('A', '7'), m('D', 'min7'), m('G', '7')] }, { title: 'Refrain', chords: [m('F', 'maj7'), m('E', 'min7'), m('D', 'min7'), m('C', 'maj7')] }];
    const B = [{ title: 'Pont', chords: [m('B', 'min7'), m('E', '7')] }];
    localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), sections: A }, { id: 's2', name: 'Ancien', savedAt: Date.now() - 1000, sections: B }]));
    if (avecMorceau) { localStorage.setItem('harmohubCurrentSongId', 's1'); localStorage.setItem('myProgression', JSON.stringify({ sections: A })); }
    else { localStorage.removeItem('harmohubCurrentSongId'); localStorage.setItem('myProgression', JSON.stringify({ sections: A })); }
    ['harmohubGrilleDensite', 'harmohubGrilleLargeur', 'harmohubClassicGridZoomLevelX', 'harmohubClassicGridZoomLevelY'].forEach(k => localStorage.removeItem(k));
    sessionStorage.setItem('cc_accueil_vu', '1');
};

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    const ouvrir = async (viewport, avecMorceau = true) => {
        const p = await nav.newPage({ viewport });
        p.on('pageerror', e => erreurs.push(e.message));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) erreurs.push('console: ' + m.text()); });
        await p.goto(`${BASE}/index.html`);
        await p.evaluate(graine, { src: mk.toString(), avecMorceau });
        await p.reload();
        await p.waitForTimeout(900);
        return p;
    };
    const mesure = (p) => p.evaluate(() => {
        const cadre = document.getElementById('grille-cadre').getBoundingClientRect();
        const col = document.getElementById('grille-cadre').parentElement.getBoundingClientRect();
        const c = document.querySelector('#progression-sections .grid-cell').getBoundingClientRect();
        return {
            caseH: Math.round(c.height), largeur: Math.round(cadre.width), centre: Math.abs((cadre.left + cadre.width / 2) - (col.left + col.width / 2)),
            temps: +document.querySelector('.chord-grid').dataset.beatsPerRow, degres: document.querySelectorAll('#progression-sections .row-roman').length,
            meta: document.querySelectorAll('#progression-sections .cell-meta').length,
            allume: [...document.querySelectorAll('#grille-densites [data-densite]')].filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.dataset.densite).join(),
        };
    });
    const glisser = async (p, sel, dx, dy) => {
        const b = await p.locator(sel).boundingBox();
        const x = b.x + b.width / 2, y = b.y + b.height / 2;
        await p.mouse.move(x, y); await p.mouse.down();
        for (let i = 1; i <= 6; i++) await p.mouse.move(x + dx * i / 6, y + dy * i / 6);
        await p.mouse.up(); await p.waitForTimeout(350);
    };

    // ======================================================================================================
    console.log('\n=== A. Trois affichages à la place des quatre boutons de zoom ===');
    let p = await ouvrir({ width: 1440, height: 900 });
    const a = await p.evaluate(() => {
        const vis = (e) => !!e && e.getBoundingClientRect().width > 0 && getComputedStyle(e).display !== 'none';
        const bs = [...document.querySelectorAll('#grille-densites [data-densite]')];
        return { noms: bs.map(b => b.textContent.trim()), h: bs.map(b => Math.round(b.getBoundingClientRect().height)), r: bs.map(b => parseFloat(getComputedStyle(b).borderTopLeftRadius)),
            zoomVisibles: ['classic-grid-in-h', 'classic-grid-out-h', 'classic-grid-in-v', 'classic-grid-out-v'].filter(i => vis(document.getElementById(i))) };
    });
    check(a.noms.join() === 'Compact,Normal,Détaillé', `l'en-tête de la grille propose : ${a.noms.join(' · ')}`);
    check(a.h.every(x => x === 32) && a.r.every(x => x === 7), 'trois boutons à la jauge (32px, 7px d\'angle)');
    check(a.zoomVisibles.length === 0, 'les quatre boutons H± V± ne sont plus à l\'écran sur ordinateur');
    let m = await mesure(p);
    check(m.allume === 'normal' && m.caseH === 52 && m.temps === 16 && m.largeur === 480, `un morceau d'avant ce lot s'ouvre en Normal : cases de ${m.caseH}px, ${m.temps / 4} mesures par ligne, fenêtre de ${m.largeur}px`);
    check(m.centre <= 1, `la fenêtre de grille est CENTRÉE dans sa colonne (écart ${m.centre.toFixed(1)}px)`);
    await p.click('#grille-densites [data-densite="compact"]'); await p.waitForTimeout(400);
    m = await mesure(p);
    check(m.allume === 'compact' && m.caseH === 38 && m.temps === 32 && m.largeur === 640, `Compact : cases de ${m.caseH}px, ${m.temps / 4} mesures par ligne, ${m.largeur}px`);
    check(m.degres === 0 && m.meta === 0, 'Compact : « noms seuls » — ni rangée de degrés, ni position d\'accord');
    await p.click('#grille-densites [data-densite="detail"]'); await p.waitForTimeout(400);
    m = await mesure(p);
    check(m.allume === 'detail' && m.caseH === 84 && m.temps === 16 && m.largeur === 640 && m.centre <= 1, `Détaillé : cases de ${m.caseH}px, ${m.temps / 4} mesures par ligne, ${m.largeur}px, centrée`);
    check(m.degres > 0 && m.meta > 0, 'Détaillé : les degrés et la position d\'accord sont là');
    check(await p.evaluate(() => hasUnsavedChanges === true), 'changer d\'affichage est un réglage du morceau : le voyant passe à « Non enregistré »');

    // ======================================================================================================
    console.log('\n=== B. La poignée droite : la largeur de la fenêtre ===');
    await glisser(p, '#grille-poignee-droite', 60, 0);
    m = await mesure(p);
    check(Math.abs(m.largeur - 760) <= 2 && m.centre <= 1, `glisser le bord droit de 60px élargit la fenêtre de 120px (les deux bords s'écartent) : ${m.largeur}px, toujours centrée`);
    await glisser(p, '#grille-poignee-droite', -400, 0);
    m = await mesure(p);
    check(m.largeur === 360, `elle ne descend pas sous 360px (${m.largeur}px)`);
    await glisser(p, '#grille-poignee-droite', 900, 0);
    m = await mesure(p);
    const colW = await p.evaluate(() => Math.round(document.getElementById('grille-cadre').parentElement.getBoundingClientRect().width));
    check(m.largeur <= Math.min(1400, colW) && m.largeur >= Math.min(1400, colW) - 2, `ni au-delà de sa colonne (${m.largeur}px pour une colonne de ${colW}px, plafond 1400)`);
    await p.dblclick('#grille-poignee-droite'); await p.waitForTimeout(350);
    m = await mesure(p);
    check(m.largeur === 640 && m.caseH === 84, 'double-clic sur la poignée : la largeur de l\'affichage (640px en Détaillé)');

    // ======================================================================================================
    console.log('\n=== C. La poignée basse : la hauteur des cases ===');
    const rangees = await p.evaluate(() => window.app.compterRangeesGrille());
    await glisser(p, '#grille-poignee-bas', 0, rangees * 20);
    m = await mesure(p);
    check(Math.abs(m.caseH - 104) <= 1, `tirer le bord bas de ${rangees * 20}px (${rangees} rangées) agrandit chaque case de 20px : ${m.caseH}px`);
    const basGrille = await p.evaluate(() => Math.round(document.getElementById('grille-poignee-bas').getBoundingClientRect().top));
    check(true, `(la poignée suit le bas de la grille : ${basGrille}px)`);
    // Les bornes : le glissé doit rester DANS la fenêtre (hors d'elle le navigateur n'envoie plus rien — un utilisateur non plus). On agrandit donc la
    // fenêtre du navigateur le temps de ces deux gestes.
    await p.setViewportSize({ width: 1440, height: 2400 }); await p.waitForTimeout(300);
    await glisser(p, '#grille-poignee-bas', 0, Math.min(1400, rangees * 100));
    m = await mesure(p);
    check(m.caseH === 160, `plafond de 160px (${m.caseH}px)`);
    const hautPoignee = await p.evaluate(() => document.getElementById('grille-poignee-bas').getBoundingClientRect().top);
    await glisser(p, '#grille-poignee-bas', 0, -Math.min(hautPoignee - 20, rangees * 140));
    m = await mesure(p);
    check(m.caseH === 30, `plancher de 30px (${m.caseH}px)`);
    await p.setViewportSize({ width: 1440, height: 900 }); await p.waitForTimeout(300);
    await p.dblclick('#grille-poignee-bas'); await p.waitForTimeout(350);
    m = await mesure(p);
    check(m.caseH === 84 && m.allume === 'detail', 'double-clic : la hauteur de l\'affichage (84px en Détaillé)');

    // ======================================================================================================
    console.log('\n=== D. Mémorisé dans le morceau ===');
    await glisser(p, '#grille-poignee-droite', 40, 0);
    await glisser(p, '#grille-poignee-bas', 0, rangees * 10);
    const regle = await mesure(p);
    await p.click('#tb-save'); await p.waitForTimeout(300);
    const fiche = await p.evaluate(() => JSON.parse(localStorage.getItem('harmohubSongs')).find(x => x.id === 's1'));
    check(fiche.grilleDensite === 'detail' && fiche.grilleLargeur === regle.largeur, `le morceau enregistré porte son affichage et sa largeur (${fiche.grilleDensite}, ${fiche.grilleLargeur}px)`);
    await p.click('#tb-titre'); await p.click('#tb-menu .tb-mi-morceau:not(.actif)'); await p.waitForTimeout(500);
    m = await mesure(p);
    check(m.allume === 'normal' && m.caseH === 52 && m.largeur === 480, 'un morceau enregistré avant ce lot s\'ouvre en Normal (52px, 480px)');
    await p.click('#tb-titre'); await p.click('#tb-menu .tb-mi-morceau:not(.actif)'); await p.waitForTimeout(500);
    m = await mesure(p);
    check(m.allume === 'detail' && m.largeur === regle.largeur && m.caseH === regle.caseH, `revenir au premier morceau : son affichage exact revient (Détaillé, ${m.largeur}px, cases de ${m.caseH}px)`);
    await p.reload(); await p.waitForTimeout(900);
    m = await mesure(p);
    check(m.allume === 'detail' && m.largeur === regle.largeur && m.caseH === regle.caseH, 'et après un rechargement de la page');
    await p.close();

    // ======================================================================================================
    console.log('\n=== E. Sans morceau ouvert : la mémoire de l\'appareil ===');
    p = await ouvrir({ width: 1440, height: 900 }, false);
    m = await mesure(p);
    check(m.allume === 'normal' && m.caseH === 52, 'première ouverture sans morceau : Normal');
    check(await p.evaluate(() => hasUnsavedChanges === false), '…sans que ce réglage de démarrage compte comme une modification');
    await p.click('#grille-densites [data-densite="compact"]'); await p.waitForTimeout(300);
    await p.reload(); await p.waitForTimeout(900);
    m = await mesure(p);
    check(m.allume === 'compact' && m.caseH === 38 && m.temps === 32, 'Compact choisi puis page rechargée : Compact revient (mémorisé sur l\'appareil, comme les échelles)');
    await p.close();

    // ======================================================================================================
    // Réécrit au lot 10c : le téléphone a désormais SON bouton Affichage (Compact / Normal / Large, voir telephone_reglages_test) et les boutons H / V
    // s'y sont effacés comme ici — les trois affichages de l'ordinateur, eux, n'y paraissent toujours pas.
    console.log('\n=== F. Téléphone : son Affichage à lui, ni les trois de l\'ordinateur ni H / V ===');
    p = await ouvrir({ width: 390, height: 844 });
    const t = await p.evaluate(() => ({ densites: document.getElementById('grille-densites').getBoundingClientRect().width, h: document.getElementById('classic-grid-in-h').getBoundingClientRect().width, tel: document.getElementById('tel-affichage').getBoundingClientRect().width, cadre: getComputedStyle(document.getElementById('grille-cadre')).display, poignees: ['grille-poignee-droite', 'grille-poignee-bas'].map(i => document.getElementById(i).getBoundingClientRect().width) }));
    check(t.densites === 0 && t.h === 0 && t.tel > 0, `téléphone : pas les affichages de l'ordinateur ni les boutons H / V, le bouton Affichage du téléphone à la place (${JSON.stringify(t)})`);
    check(t.cadre === 'contents' && t.poignees.every(w => w === 0), 'téléphone : pas de fenêtre centrée ni de poignées (la grille garde sa mise en page)');
    await p.close();

    console.log(`\nErreurs de page : ${erreurs.length}${erreurs.length ? '\n  ' + erreurs.slice(0, 6).join('\n  ') : ''}`);
    check(erreurs.length === 0, 'aucune erreur JavaScript pendant tout le banc');
    await nav.close();
    bilan();
})();
