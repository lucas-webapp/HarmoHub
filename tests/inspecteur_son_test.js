// L'INSPECTEUR « SON DE L'ACCORD » ET LA FIN DU BANDEAU DE GAUCHE (refonte, lot 6c), avec de vrais clics.
//
// CE QUE DEMANDE LA MAQUETTE VALIDÉE (docs/refonte.md) : « Plus de bandeau de gauche [...] une bulle (QUEL accord) et un inspecteur (COMMENT il
// sonne : voicing, jeu, intensité, rythme, doigté). Rien aux deux endroits » ; « pastille ambre sur la case + « Revenir à l'automatique » dans
// l'inspecteur » ; « Fini l'orange du mode modification ».
//
// CE QUE LE BANC TIENT : sans accord ouvert, plus de bandeau — la grille a toute la place ; « Réglages du son » ouvre l'inspecteur À DROITE de la
// grille, sur cet accord, sans ce que la bulle règle déjà ; il modifie en direct ; il dit pourquoi un voicing est personnalisé et sait en revenir
// (Ctrl+Z comme filet) ; sa croix le ferme ; un ancien repli mémorisé ne le vide pas ; le téléphone garde sa colonne (lot 10).
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('inspecteur « son de l\'accord »');
const { dblclickHorsNom } = require('./_geste_accord');
const { estBruitReseau } = require('./_harness');

plan(25);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const graine = (opts) => {
    const mk = (r, q, b = 4, x = {}) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held', ...x });
    const S = [{ title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7', 4, { extraNotes: [{ note: 'D', octave: 5 }] }), mk('D', 'min7'), mk('G', 'dom7')] }];
    localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), sections: S }]));
    localStorage.setItem('harmohubCurrentSongId', 's1');
    localStorage.setItem('myProgression', JSON.stringify({ sections: S }));
    if (opts && opts.replie) localStorage.setItem('harmohubSidebarCollapsed', '1'); else localStorage.removeItem('harmohubSidebarCollapsed');
    sessionStorage.setItem('cc_accueil_vu', '1');
};

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    const ouvrir = async (viewport, opts = {}) => {
        const p = await nav.newPage({ viewport });
        p.on('pageerror', e => erreurs.push(e.message));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) erreurs.push('console: ' + m.text()); });
        await p.goto(`${BASE}/index.html`);
        await p.evaluate(graine, opts);
        await p.reload();
        await p.waitForTimeout(900);
        return p;
    };
    const boite = (p, sel) => p.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { g: r.left, d: r.right, h: r.top, l: Math.round(r.width), haut: Math.round(r.height) }; }, sel);
    const visible = async (p, sel) => { const b = await boite(p, sel); return !!b && b.l > 0 && b.haut > 0; };
    const ouvrirSon = async (p, i) => {
        await dblclickHorsNom(p, `#progression-sections .grid-cell[data-index="${i}"]`); await p.waitForTimeout(300); // point B : le double-clic ouvre la bulle (un clic seul fait entendre l'accord)
        await p.click('#bulle-accord [data-bulle="onglet"][data-valeur="voicing"]'); await p.waitForTimeout(500);
    };

    // ======================================================================================================
    console.log('\n=== A. Sans accord ouvert : plus de bandeau ===');
    let p = await ouvrir({ width: 1440, height: 900 });
    check(!(await visible(p, '.sidebar-frame')) && !(await visible(p, '#accord-card')), 'ni bandeau de gauche ni carte Accord');
    check(!(await visible(p, '#toggle-sidebar')), 'plus d\'étiquette de repli : il n\'y a plus rien à replier');
    const colonne = await boite(p, '.col-right'), principal = await boite(p, 'main');
    check(colonne.l >= principal.l - 60, `la grille a toute la place (${colonne.l}px sur ${principal.l})`);
    const sansInsp = await boite(p, '#grille-cadre');

    // ======================================================================================================
    // L6a : l'inspecteur flottant a disparu à l'ordinateur ; son contenu (« comment il sonne ») est l'onglet Voicing de la fenêtre d'accord. Le banc garde TOUT ce qu'il tenait
    // (rien aux deux endroits, modification en direct, voicing personnalisé et retour à l'automatique, une annulation, fermeture, ancien repli) pour ce nouvel endroit.
    console.log('\n=== B. L\'onglet Voicing de la fenêtre d\'accord, sur cet accord ===');
    await ouvrirSon(p, 1);
    exiger(await p.evaluate(() => window.app.editingIndex === 1), 'l\'accord est ouvert');
    const bul = await boite(p, '#bulle-accord'), cadre = await boite(p, '#grille-cadre');
    check(bul && bul.l > 200 && !(await visible(p, '.sidebar-frame')), `le COMMENT il sonne est dans la fenêtre d'accord (${bul && bul.l}px), plus dans un panneau flottant à droite`);
    check(Math.abs(cadre.g - sansInsp.g) <= 1 && Math.abs(sansInsp.l - cadre.l) <= 1, `la fenêtre de grille ne bouge pas d'un pixel, à sa largeur (${Math.round(sansInsp.g)} → ${Math.round(cadre.g)})`);
    check(!(await visible(p, '#toggle-sidebar')), 'et l\'ancienne étiquette de repli ne revient pas');
    const titre = await p.evaluate(() => document.querySelector('#bulle-accord .bulle-nom').textContent.replace(/\s+/g, ''));
    check(titre === 'Am7', `elle nomme l'accord qu'elle règle (« ${titre} »)`);
    check(!(await visible(p, '#root')) && !(await visible(p, '#quality')) && !(await visible(p, '#duration-dd')), '« rien aux deux endroits » : ni fondamentale, ni type, ni durée de l\'ancienne carte — l\'onglet Accord les porte');
    // RETRAIT DE L'ANCIEN SÉQUENCEUR (4b, 12/11) : la porte « Séquenceur » et le petit séquenceur ont quitté la fenêtre ; le rythme se règle au séquenceur du bloc « Vues » ou dans l'onglet Rythme.
    check(await visible(p, '#bulle-accord #voicing-row') && !(await visible(p, '#seq-zoom')) && !(await p.evaluate(() => !!document.getElementById('arp-sequencer'))) && await visible(p, '#vue-sequenceur'),
        'le petit séquenceur n\'existe plus ; le voicing (octave, renversement, drop, basse) est là, dans la fenêtre');
    check(await p.evaluate(() => { const t = document.querySelector('#bulle-accord .bulle-onglets [data-valeur="voicing"]'); return t.getAttribute('aria-pressed') === 'true' && /0, 230, 118|rgb\(1[0-9]{2}, 2[0-9]{2}/.test(getComputedStyle(t).color); }), 'l\'onglet Voicing est l\'actif, en vert — fini l\'orange et le bleu');

    // ======================================================================================================
    console.log('\n=== C. Il modifie en direct ===');
    await p.click('#bulle-accord #voicing-row [data-octave-step="1"]'); await p.waitForTimeout(300);
    check(await p.evaluate(() => Number(loadProgressionSections()[0].chords[1].octave)) === 4, 'octave + : l\'accord passe à l\'octave 4, sans bouton à valider');

    // ======================================================================================================
    console.log('\n=== D. Voicing personnalisé : dire pourquoi, et savoir en revenir ===');
    const perso = await p.evaluate(() => { const b = document.getElementById('voicing-perso'); return { vu: !b.hidden && b.getBoundingClientRect().height > 0, dans: !!b.closest('#bulle-accord'), texte: document.getElementById('voicing-perso-texte').textContent }; });
    check(perso.vu && perso.dans && /une note ajoutée à la main/.test(perso.texte), `la fenêtre dit pourquoi la case porte une pastille ambre (« ${perso.texte} »)`);
    await p.click('#voicing-perso-auto'); await p.waitForTimeout(400);
    const apres = await p.evaluate(() => ({ libres: (loadProgressionSections()[0].chords[1].extraNotes || []).length, bloc: document.getElementById('voicing-perso').hidden,
        pastille: !!document.querySelector('#progression-sections .grid-cell[data-index="1"] .cell-perso'), octave: Number(loadProgressionSections()[0].chords[1].octave) }));
    check(apres.libres === 0 && apres.bloc && !apres.pastille, `« Revenir à l'automatique » : la note ajoutée part, le bloc et la pastille aussi (${JSON.stringify(apres)})`);
    check(apres.octave === 4, 'le reste du réglage (l\'octave) est gardé');
    await p.click('#bulle-accord [data-bulle="fermer"]'); await p.waitForTimeout(300);
    await p.keyboard.press('Control+z'); await p.waitForTimeout(400);
    const repris = await p.evaluate(() => { const c = loadProgressionSections()[0].chords[1]; return { libres: (c.extraNotes || []).length, octave: Number(c.octave) }; });
    check(repris.libres === 1 && repris.octave === 3, `Ctrl+Z défait la session de la fenêtre d'un coup : la note revient, l'octave aussi (${JSON.stringify(repris)})`);
    check(await p.evaluate(() => !!document.querySelector('#progression-sections .grid-cell[data-index="1"] .cell-perso')), 'et la pastille ambre avec elle');

    // ======================================================================================================
    console.log('\n=== E. La croix la ferme ===');
    await ouvrirSon(p, 2);
    check(await visible(p, '#bulle-accord #voicing-row'), 'rouverte sur un autre accord');
    check(await p.evaluate(() => document.getElementById('voicing-perso').hidden), 'un accord au voicing automatique n\'a pas le bloc « personnalisé »');
    await p.click('#bulle-accord [data-bulle="fermer"]'); await p.waitForTimeout(300);
    check(!(await visible(p, '#bulle-accord')) && await p.evaluate(() => window.app.editingIndex == null && !document.getElementById('voicing-row').closest('#bulle-accord')), '× : la fenêtre se ferme, l\'accord n\'est plus en modification, la rangée est rentrée dans sa carte');
    check(Math.abs((await boite(p, '#grille-cadre')).g - sansInsp.g) <= 1, 'la grille reprend sa place d\'origine');
    await p.close();

    // ======================================================================================================
    console.log('\n=== F. Un ancien repli du bandeau, mémorisé, ne vide pas la fenêtre ===');
    p = await ouvrir({ width: 1440, height: 900 }, { replie: true });
    await ouvrirSon(p, 0);
    const replie = await p.evaluate(() => document.body.classList.contains('sidebar-collapsed'));
    exiger(replie, 'le repli mémorisé est bien appliqué');
    check(await visible(p, '#bulle-accord #voicing-row') && (await boite(p, '#voicing-row')).l > 100, 'la rangée du voicing est là, entière, malgré le repli d\'avant');
    await p.close();

    // ======================================================================================================
    console.log('\n=== G. Le téléphone garde sa colonne (lot 10) ===');
    p = await ouvrir({ width: 390, height: 844 });
    // Lot 10e : en mode Ajout la carte « Nouvel accord » a quitté la page ; elle reste l'inspecteur d'un accord ouvert en modification.
    const auRepos = await visible(p, '#accord-card');
    await p.evaluate(() => window.app.editChord(0, 0));
    await p.waitForTimeout(400);
    check(!auRepos && await visible(p, '#accord-card') && await visible(p, '#root'), 'la carte Accord n\'est plus là au repos, et revient avec sa fondamentale quand un accord est ouvert');
    await p.close();

    check(erreurs.length === 0, `aucune erreur JavaScript (${erreurs.length ? erreurs.join(' | ') : 'aucune'})`);
    await nav.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
