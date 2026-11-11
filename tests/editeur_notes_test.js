// L'ÉDITEUR DE NOTES : OUVRIR, FERMER, ÉTENDRE (refonte, lot 9a), avec de vrais gestes.
//
// CE QUE DEMANDE LA MAQUETTE VALIDÉE (docs/refonte.md, « Éditeur de notes ») : « ouvert par un bouton bleu libellé Éditeur de notes dans la rangée
// de réglages (pas parmi les instruments), fermé par Fermer » ; « Étendre ou non : réduit par défaut (~170 px de notes), bouton à chevrons,
// double-clic sur la poignée, ou poignée tirée ». Le Compact provisoire du lot 9a (« la grille passe d'elle-même en Compact ») est ANNULÉ par la
// refonte du séquenceur (11/11, point A) : « ouvrir le séquenceur ne doit jamais changer l'affichage de la grille […] je ne veux absolument pas ça ».
//
// CE QUE LE BANC TIENT : le bouton (bleu, 32px, 7px, son libellé) ouvre et referme ; l'en-tête Notes / Fermer / chevrons ; la hauteur réduite à
// l'ouverture, étendue au chevron et au double-clic, défaite au chevron après une poignée tirée ; la grille garde EXACTEMENT son affichage
// (affichage, largeur de la fenêtre, taille de chaque case) à l'ouverture, pendant et à la fermeture, sans rien marquer « modifié » ; un affichage
// choisi éditeur ouvert est un vrai réglage ; le téléphone (feuille du lot 10f) garde aussi sa grille.
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('éditeur de notes');
const { estBruitReseau } = require('./_harness');

plan(45);

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
    localStorage.removeItem('harmohubSeqDockHeight');
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
    // Ce que l'écran montre (relu, jamais déclenché par window.app).
    const etat = (p) => p.evaluate(() => {
        const panneau = document.getElementById('seq-dock-panel');
        const bande = document.querySelector('#seq-dock-host .seq-scroll');
        const tete = document.getElementById('editeur-notes-tete');
        const ext = document.getElementById('editeur-notes-etendre');
        const btn = document.getElementById('grid-zoom');
        const cs = getComputedStyle(btn);
        const cas = document.querySelector('#progression-sections .grid-cell');
        const densiteEcran = ['compact', 'normal', 'detail'].find(d => document.querySelector('.history-section').classList.contains('densite-' + d));
        const presse = [...document.querySelectorAll('#grille-densites [data-densite]')].find(b => b.getAttribute('aria-pressed') === 'true');
        return {
            ouvert: !panneau.hidden && panneau.getBoundingClientRect().height > 0,
            bande: bande && !panneau.hidden ? Math.round(bande.getBoundingClientRect().height) : 0,
            hote: Math.round(document.getElementById('seq-dock-host').getBoundingClientRect().height),
            tete: Math.round(tete.getBoundingClientRect().height),
            titre: tete.querySelector('.editeur-notes-titre').textContent.trim(),
            etenduPresse: ext.getAttribute('aria-pressed'), etenduLabel: ext.getAttribute('aria-label'),
            btnTexte: btn.innerText.trim(), btnLabel: btn.getAttribute('aria-label'), btnPresse: btn.getAttribute('aria-pressed'),
            btnH: Math.round(btn.getBoundingClientRect().height), btnRayon: cs.borderTopLeftRadius, btnBord: cs.borderTopColor,
            caseH: cas ? Math.round(cas.getBoundingClientRect().height) : 0,
            densiteEcran, densitePressee: presse ? presse.dataset.densite : null,
            modifie: hasUnsavedChanges,
            memoire: localStorage.getItem('harmohubGrilleDensite'),
            hauteurTiree: localStorage.getItem('harmohubSeqDockHeight'),
        };
    });
    // L'empreinte de la grille : affichage, largeur de la fenêtre et taille de CHAQUE case — ce qui ne doit jamais changer à l'ouverture du séquenceur.
    const empreinte = (p) => p.evaluate(() => JSON.stringify({
        d: ['compact', 'normal', 'detail'].find(d => document.querySelector('.history-section').classList.contains('densite-' + d)),
        w: Math.round(document.getElementById('grille-cadre').getBoundingClientRect().width),
        cases: [...document.querySelectorAll('#progression-sections .grid-cell')].map(c => { const r = c.getBoundingClientRect(); return Math.round(r.width) + 'x' + Math.round(r.height); }),
    }));
    const clic = async (p, sel, ms = 600) => { await p.click(sel); await p.waitForTimeout(ms); };
    const centre = async (p, sel) => { const b = await p.locator(sel).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };

    // ======================================================================================================
    console.log('\n=== A. Le bouton « Éditeur de notes », dans la rangée de réglages ===');
    let p = await ouvrir({ width: 1440, height: 900 });
    let e = await etat(p);
    check(e.btnTexte === 'Éditeur de notes' && e.btnLabel === 'Éditeur de notes', `libellé « Éditeur de notes » (« ${e.btnTexte} », aria « ${e.btnLabel} »)`);
    check(e.btnBord === 'rgb(51, 80, 124)', `bouton BLEU, la famille ajouter / modifier (bord ${e.btnBord})`);
    check(e.btnH === 32 && e.btnRayon === '7px', `à la jauge : 32px, arrondi 7px (${e.btnH}px, ${e.btnRayon})`);
    check(await p.evaluate(() => !!document.getElementById('grid-zoom').closest('.grid-head-sticky') && !document.getElementById('grid-zoom').closest('#barre-lecture')),
        'dans la rangée de réglages au-dessus de la grille, pas parmi les instruments de la barre de lecture');
    check(!e.ouvert && e.btnPresse === 'false', 'au départ, l\'éditeur est fermé');

    // ======================================================================================================
    console.log('\n=== B. Ouvrir : réduit, en-tête, la grille ne bouge pas ===');
    const avant = await empreinte(p);
    await clic(p, '#grid-zoom', 800);
    e = await etat(p);
    exiger(e.ouvert, 'un clic sur le bouton ouvre l\'éditeur de notes');
    check(e.btnPresse === 'true', 'le bouton dit qu\'il est ouvert (aria-pressed)');
    check(e.tete > 0 && e.titre === 'Notes', `l'en-tête « Notes » est là (${e.tete}px)`);
    check(await p.locator('#editeur-notes-fermer').innerText() === 'Fermer', 'avec son bouton « Fermer »');
    check(e.bande >= 185 && e.bande <= 200, `réduit par défaut : ~170px de notes + la règle (${e.bande}px de bande)`);
    check(e.etenduPresse === 'false' && e.etenduLabel === 'Étendre l\'éditeur de notes', `le chevron propose d'étendre (« ${e.etenduLabel} »)`);
    const reduit = e.bande;
    const pendant = await empreinte(p);
    check(pendant === avant && e.densiteEcran === 'normal' && e.caseH === 52 && e.densitePressee === 'normal',
        `la grille garde exactement son affichage (Normal, cases de ${e.caseH}px${pendant === avant ? '' : ' — avant ' + avant + ' / après ' + pendant})`);
    check(e.modifie === false, 'ouvrir l\'éditeur n\'est pas une retouche : le morceau n\'est PAS marqué modifié');
    check(e.memoire === 'normal', `l'appareil garde l'affichage choisi (« ${e.memoire} »)`);
    const barreLecture = await p.evaluate(() => { const r = document.getElementById('barre-lecture').getBoundingClientRect(); return { bas: r.bottom, haut: window.innerHeight }; });
    check(barreLecture.bas <= barreLecture.haut + 1, 'la barre de lecture reste entièrement visible');

    // ======================================================================================================
    console.log('\n=== C. Enregistrer pendant que l\'éditeur est ouvert : l\'affichage de la grille, inchangé ===');
    await p.keyboard.press('Control+s'); await p.waitForTimeout(600);
    const enr = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('harmohubSongs')).find(x => x.id === 's1'); return { d: s.grilleDensite, y: s.classicGridZoomLevelY }; });
    check(enr.d === 'normal' && Math.abs(enr.y - 52 / 64) < 0.001, `le morceau enregistré garde « Normal » et ses cases de 52px (${enr.d}, ${enr.y})`);
    check(await empreinte(p) === avant, 'et l\'écran garde la même grille, éditeur ouvert');

    // ======================================================================================================
    console.log('\n=== D. Étendre / réduire : chevrons, double-clic sur la poignée ===');
    await clic(p, '#editeur-notes-etendre', 800);
    e = await etat(p);
    check(e.bande > reduit + 120, `le chevron étend l'éditeur (${reduit} → ${e.bande}px)`);
    check(e.etenduPresse === 'true' && e.etenduLabel === 'Réduire l\'éditeur de notes', `le chevron propose alors de réduire (« ${e.etenduLabel} »)`);
    const etendu = e.bande;
    await clic(p, '#editeur-notes-etendre', 800);
    check((await etat(p)).bande === reduit, 'un second clic le réduit à nouveau');
    let g = await centre(p, '#seq-dock-resize');
    await p.mouse.dblclick(g.x, g.y); await p.waitForTimeout(800);
    check((await etat(p)).bande === etendu, `double-clic sur la poignée : étendu (${(await etat(p)).bande}px)`);
    g = await centre(p, '#seq-dock-resize');
    await p.mouse.dblclick(g.x, g.y); await p.waitForTimeout(800);
    check((await etat(p)).bande === reduit, 'second double-clic : réduit');

    // ======================================================================================================
    console.log('\n=== E. Poignée tirée, puis chevron : retour à la hauteur d\'origine ===');
    const h0 = (await etat(p)).hote;
    g = await centre(p, '#seq-dock-resize');
    await p.mouse.move(g.x, g.y); await p.mouse.down();
    await p.mouse.move(g.x, g.y - 60, { steps: 4 }); await p.mouse.move(g.x, g.y - 120, { steps: 4 });
    await p.mouse.up(); await p.waitForTimeout(800);
    e = await etat(p);
    check(Math.abs(e.hote - (h0 + 120)) <= 4, `tirer la poignée de 120px vers le haut agrandit d'autant (${h0} → ${e.hote}px)`);
    check(e.etenduPresse === 'true' && e.hauteurTiree !== null, 'une hauteur tirée compte comme « étendu », et elle est mémorisée (comme avant)');
    await clic(p, '#editeur-notes-etendre', 800);
    e = await etat(p);
    check(e.bande === reduit && e.hauteurTiree === null, `le chevron défait la hauteur tirée et revient au réduit (${e.bande}px, mémoire ${e.hauteurTiree})`);

    // ======================================================================================================
    console.log('\n=== F. Fermer : la grille n\'a toujours pas bougé ===');
    await clic(p, '#editeur-notes-etendre', 600); // étendu au moment de fermer : la prochaine ouverture doit repartir réduite
    await clic(p, '#editeur-notes-fermer', 800);
    e = await etat(p);
    check(!e.ouvert && e.btnPresse === 'false', '« Fermer » referme l\'éditeur');
    check(await empreinte(p) === avant && e.caseH === 52, `la grille est la même qu'avant l'ouverture (${e.densiteEcran}, cases de ${e.caseH}px)`);
    check(e.modifie === false, 'toujours rien de modifié : ouvrir puis fermer n\'est pas une retouche du morceau');
    await clic(p, '#grid-zoom', 800);
    e = await etat(p);
    check(e.ouvert && e.bande === reduit && e.etenduPresse === 'false', `rouvert, il repart RÉDUIT (${e.bande}px)`);
    await clic(p, '#grid-zoom', 800);
    e = await etat(p);
    check(!e.ouvert && e.densiteEcran === 'normal', 'le bouton lui-même referme aussi, sans toucher la grille');

    // ======================================================================================================
    console.log('\n=== G. Un affichage choisi pendant que l\'éditeur est ouvert est le sien ===');
    await clic(p, '#grid-zoom', 800);
    await clic(p, '#grille-densites [data-densite="detail"]', 600);
    e = await etat(p);
    check(e.densiteEcran === 'detail' && e.ouvert, 'Détaillé choisi éditeur ouvert : la grille passe en Détaillé, l\'éditeur reste');
    check(e.modifie === true && e.memoire === 'detail', 'c\'est un vrai réglage du morceau : marqué modifié, mémorisé');
    await clic(p, '#editeur-notes-fermer', 800);
    check((await etat(p)).densiteEcran === 'detail', 'à la fermeture, Détaillé reste : la fermeture ne rend aucun affichage « d\'avant »');
    await clic(p, '#grille-densites [data-densite="compact"]', 600);
    await clic(p, '#grid-zoom', 800);
    await clic(p, '#editeur-notes-fermer', 800);
    check((await etat(p)).densiteEcran === 'compact', 'une grille déjà en Compact le reste à la fermeture');

    // ======================================================================================================
    console.log('\n=== H. Lot 9c : la conduite de voix est devenue le calque Voix de l\'éditeur ===');
    // Jusqu'au lot 9c, l'icône ⊱ restait à côté et son panneau prenait la place de l'éditeur. Elle a quitté l'ordinateur une fois chaque fonction
    // retrouvée dans le calque (décision du 05/11) : la conduite de voix s'allume DANS l'éditeur, qui reste ouvert, la grille inchangée.
    await clic(p, '#grille-densites [data-densite="normal"]', 600);
    await clic(p, '#grid-zoom', 800);
    check(!(await p.locator('#toggle-voice-leading').isVisible()) && await p.locator('#editeur-notes-voix').isVisible(), 'l\'icône ⊱ a quitté la rangée ; sa porte est le bouton Voix de l\'éditeur');
    await clic(p, '#editeur-notes-voix', 800);
    e = await etat(p);
    check(e.ouvert && e.btnPresse === 'true' && await p.evaluate(() => document.getElementById('grid-zoom').classList.contains('active')),
        'l\'allumer ne prend PAS la place de l\'éditeur : il reste ouvert, son bouton enfoncé');
    check(e.densiteEcran === 'normal', `la grille garde l'affichage choisi (${e.densiteEcran})`);
    check(await p.evaluate(() => !document.querySelector('.voice-leading-panel') && document.querySelectorAll('#arp-sequencer .seq-note-fn').length > 0), 'aucun ancien panneau : le calque est dans les notes');
    await clic(p, '#editeur-notes-voix', 500); // on le rend éteint, comme on l'a trouvé (réglage mémorisé par appareil)
    await p.close();

    // ======================================================================================================
    console.log('\n=== I. Le téléphone : l\'éditeur de notes est une feuille plein écran (lot 10f) ===');
    p = await ouvrir({ width: 390, height: 844 });
    e = await etat(p);
    check(e.btnTexte === 'Notes', `la porte dit « Notes » (« ${e.btnTexte} »)`);
    check(e.btnLabel === 'Éditeur de notes', 'et son aria-label est celui de l\'ordinateur');
    await p.locator('#grid-zoom').scrollIntoViewIfNeeded();
    await clic(p, '#grid-zoom', 900);
    e = await etat(p);
    exiger(e.ouvert, 'elle ouvre l\'éditeur');
    check(e.tete > 40, `avec son en-tête (${e.tete}px)`);
    check(e.densiteEcran === 'normal' && e.modifie === false, `la grille garde l\'affichage de l\'appareil (${e.densiteEcran})`);
    check(e.bande > 230, `la feuille donne toute la place aux notes (${e.bande}px de bande)`);
    await p.close();

    check(erreurs.length === 0, `aucune erreur de page${erreurs.length ? ' : ' + erreurs.slice(0, 3).join(' | ') : ''}`);
    await nav.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
