// L'ÉDITEUR DE NOTES : LA BARRE D'OUTILS EN ICÔNES (refonte, lot 9b), avec de vrais gestes.
//
// CE QUE DEMANDE LA MAQUETTE VALIDÉE (docs/refonte.md) : « Barre d'outils en icônes : sélection, crayon, gomme ; calage ; Voix ; Intensité ; Ajuster ;
// zoom ; supprimer la note. Aucune ligne d'info sur la note, aucune phrase de résumé. » Décisions du 05/11 : Sélection (par défaut) garde EXACTEMENT
// les gestes d'avant, Crayon ne fait que dessiner, Gomme efface ce qu'elle touche ; pas de choix de calage (la double croche automatique demandée
// plus tôt prime) ; tous les boutons d'avant restent, en icônes, dans la rangée « Notes / Fermer ». Voix arrive au lot 9c.
//
// CE QUE LE BANC TIENT : une seule rangée, à la jauge (32×32, 7px), sans mot ; « supprimer la note » seulement quand une note est choisie ; les trois
// outils (et une seule annulation par coup de gomme) ; Ajuster (lignes réduites aux notes, mémorisé) ; la barre revient dans le séquenceur hors de
// l'éditeur, sans id en double ; le téléphone n'a pas bougé (lot 10).
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('éditeur de notes : barre d\'outils');
const { estBruitReseau } = require('./_harness');

plan(32);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const graine = () => {
    const mk = (r, q, b = 4) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
    const S = [{ title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7'), mk('D', 'min7'), mk('G', 'dom7')] }];
    localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), sections: S }]));
    localStorage.setItem('harmohubCurrentSongId', 's1');
    localStorage.setItem('myProgression', JSON.stringify({ sections: S }));
    localStorage.removeItem('harmohubSeqDockHeight');
    localStorage.removeItem('harmohubSeqAjuster');
    sessionStorage.setItem('cc_accueil_vu', '1');
};

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    const ouvrir = async (viewport, reseme = true) => {
        const p = await nav.newPage({ viewport });
        p.on('pageerror', e => erreurs.push(e.message));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) erreurs.push('console: ' + m.text()); });
        await p.goto(`${BASE}/index.html`);
        if (reseme) await p.evaluate(graine);
        await p.reload();
        await p.waitForTimeout(900);
        return p;
    };
    const clic = async (p, sel, ms = 500) => { await p.click(sel); await p.waitForTimeout(ms); };
    // `defiler` à faux pour la seconde extrémité d'un glissé : ramener une case à l'écran déplacerait la première, déjà mesurée.
    const casePos = (p, v, s, defiler = true) => p.evaluate(([v, s, defiler]) => {
        const c = document.querySelector(`#arp-sequencer .seq-cell[data-voice="${v}"][data-step="${s}"]`);
        if (!c) return null;
        if (defiler) c.scrollIntoView({ block: 'center', inline: 'nearest' });
        const r = c.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, [v, s, defiler]);
    // Le motif de l'accord en édition, relu (jamais écrit) : pour chaque voix, les pas où elle sonne.
    const motif = (p) => p.evaluate(() => {
        const { pattern } = window.app.getLiveSeqPattern(window.app.readChord());
        const parVoix = {};
        pattern.forEach((pas, s) => pas.forEach(v => { (parVoix[v] = parVoix[v] || []).push(s); }));
        return parVoix;
    });
    const glisser = async (p, a, b) => { await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 }); await p.mouse.move(b.x, b.y, { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(500); };

    // ======================================================================================================
    console.log('\n=== A. Une seule rangée, à la jauge, sans mot ===');
    let p = await ouvrir({ width: 1440, height: 900 });
    await clic(p, '#progression-sections .grid-cell[data-index="1"]', 300);
    await clic(p, '#grid-zoom', 900);
    const r = await p.evaluate(() => {
        const tete = document.getElementById('editeur-notes-tete');
        const btns = [...tete.querySelectorAll('button')].filter(b => b.offsetParent);
        return {
            dansTete: !!tete.querySelector('.seq-presets #seq-play'), dansSeq: !!document.querySelector('#arp-sequencer .seq-presets'),
            h: Math.round(tete.getBoundingClientRect().height),
            horsJauge: btns.filter(b => Math.round(b.getBoundingClientRect().height) !== 32 || getComputedStyle(b).borderTopLeftRadius !== '7px').map(b => b.id || b.className),
            mots: btns.filter(b => b.id !== 'editeur-notes-fermer' && b.innerText.trim() !== '').map(b => (b.id || b.className) + ' « ' + b.innerText.trim() + ' »'),
            sansNom: btns.filter(b => !b.getAttribute('aria-label')).map(b => b.id || b.className),
            bande: Math.round(document.querySelector('#arp-sequencer .seq-scroll').getBoundingClientRect().height),
            supprVisible: !!document.getElementById('seq-delete-selection').offsetParent,
        };
    });
    check(r.dansTete && !r.dansSeq, 'la barre du séquenceur a rejoint la rangée « Notes / Fermer »');
    check(r.h <= 40, `une seule rangée (${r.h}px de haut)`);
    check(r.horsJauge.length === 0, `tous ses boutons à la jauge, 32px et 7px${r.horsJauge.length ? ' — hors jauge : ' + r.horsJauge.join(', ') : ''}`);
    check(r.mots.length === 0, `uniquement des logos, aucun mot (hors « Fermer »)${r.mots.length ? ' — ' + r.mots.join(', ') : ''}`);
    check(r.sansNom.length === 0, `chaque icône a son nom pour les lecteurs d'écran${r.sansNom.length ? ' — sans : ' + r.sansNom.join(', ') : ''}`);
    check(r.bande >= 185 && r.bande <= 200, `les notes gardent leurs ~170px, la rangée ne leur prend plus rien (${r.bande}px de bande)`);
    check(!r.supprVisible, '« supprimer la note » n\'apparaît pas tant qu\'aucune note n\'est choisie');
    check(await p.evaluate(() => document.querySelectorAll('[id="seq-play"]').length === 1 && document.querySelectorAll('[id="seq-delete-selection"]').length === 1), 'aucun bouton en double dans la page');
    check(await p.evaluate(() => document.getElementById('en-outil-selection').getAttribute('aria-pressed') === 'true'), 'outil par défaut : Sélection');

    // ======================================================================================================
    console.log('\n=== B. Ajuster : seulement les hauteurs utiles, mémorisé ===');
    const lignes = () => p.evaluate(() => document.querySelectorAll('#arp-sequencer .seq-label').length);
    const avant = await lignes();
    await clic(p, '#editeur-notes-ajuster', 700);
    const apres = await lignes();
    check(apres < avant && apres >= 5, `Ajuster réduit les lignes aux notes présentes ± 2 demi-tons (${avant} → ${apres})`);
    check(await p.getAttribute('#editeur-notes-ajuster', 'aria-pressed') === 'true', 'le bouton dit qu\'il est allumé');

    // ======================================================================================================
    console.log('\n=== C. Sélection : les gestes d\'avant ===');
    const m0 = await motif(p);
    let c = await casePos(p, 3, 5);
    exiger(!!c, 'une case de la voix aiguë est à l\'écran');
    await p.mouse.click(c.x, c.y); await p.waitForTimeout(500);
    check(await p.evaluate(() => window.app.seqSelections.length) === 1 && JSON.stringify(await motif(p)) === JSON.stringify(m0), 'un clic sur une note la choisit, sans rien changer au motif');
    check(await p.evaluate(() => { const b = document.getElementById('seq-delete-selection'); return !!b.offsetParent && /Supprimer la note/.test(b.getAttribute('aria-label') || ''); }), '« supprimer la note » apparaît alors, avec son nom');
    await clic(p, '#seq-delete-selection', 500);
    check(!(await motif(p))[3], 'et la supprime');
    await p.keyboard.press('Control+z'); await p.waitForTimeout(500);
    check(JSON.stringify(await motif(p)) === JSON.stringify(m0), 'Ctrl+Z la rend');

    // ======================================================================================================
    console.log('\n=== D. Gomme : efface ce qu\'elle touche, d\'une seule annulation ===');
    await clic(p, '#en-outil-gomme', 300);
    check(await p.evaluate(() => document.getElementById('en-outil-gomme').getAttribute('aria-pressed') === 'true' && document.getElementById('en-outil-selection').getAttribute('aria-pressed') === 'false'), 'Gomme choisie (un choix parmi trois)');
    c = await casePos(p, 3, 6);
    await p.mouse.click(c.x, c.y); await p.waitForTimeout(500);
    let m = await motif(p);
    check(!m[3] && !!m[2], 'un clic efface la note touchée, et elle seule');
    const a = await casePos(p, 2, 4), b = await casePos(p, 1, 4, false);
    await glisser(p, a, b);
    m = await motif(p);
    check(!m[2] && !m[1] && !!m[0], 'un glissé efface toutes les notes qu\'il traverse');
    await p.keyboard.press('Control+z'); await p.waitForTimeout(500);
    m = await motif(p);
    check(!!m[2] && !!m[1] && !m[3], 'un seul Ctrl+Z rend tout le glissé (une étape d\'annulation par geste)');
    await p.keyboard.press('Control+z'); await p.waitForTimeout(500);
    check(JSON.stringify(await motif(p)) === JSON.stringify(m0), 'un second rend le premier clic');

    // ======================================================================================================
    console.log('\n=== E. Crayon : ne fait que dessiner ===');
    await clic(p, '[data-preset="clear"]', 500); // la corbeille « tout » (icône seule désormais) vide le rythme
    check(Object.keys(await motif(p)).length === 0, 'la corbeille « tout », en icône, vide toujours le rythme');
    await clic(p, '#en-outil-crayon', 300);
    await glisser(p, await casePos(p, 1, 2), await casePos(p, 1, 7, false));
    m = await motif(p);
    check(JSON.stringify(m[1]) === JSON.stringify([2, 3, 4, 5, 6, 7]), `un glissé dessine la note de bout en bout (${JSON.stringify(m[1])})`);
    await glisser(p, await casePos(p, 1, 4), await casePos(p, 1, 11, false));
    m = await motif(p);
    check(m[1].includes(2) && m[1].includes(11) && m[1].length === 10, `partir d'une note ne la DÉPLACE pas : le crayon dessine par-dessus et prolonge (${JSON.stringify(m[1])})`);
    c = await casePos(p, 2, 13);
    await p.mouse.click(c.x, c.y); await p.waitForTimeout(500);
    m = await motif(p);
    check(!!m[2] && m[2].includes(13), 'un clic pose une note là où l\'on clique');

    // ======================================================================================================
    console.log('\n=== F. Intensité, depuis la rangée ===');
    const studio0 = await p.evaluate(() => window.app.studioMode);
    await clic(p, '#toggle-studio-mode', 500);
    check(await p.evaluate(() => window.app.studioMode) === !studio0, 'le bouton Intensité (mode studio) agit depuis la rangée');
    await clic(p, '#toggle-studio-mode', 500);

    // ======================================================================================================
    console.log('\n=== G. Hors de l\'éditeur, la barre revient dans le séquenceur ===');
    await clic(p, '#editeur-notes-fermer', 700);
    check(await p.evaluate(() => document.getElementById('editeur-notes-barre').children.length === 0), 'éditeur fermé, la rangée se vide');
    await p.reload(); await p.waitForTimeout(900);
    await clic(p, '#grid-zoom', 900);
    check(await p.getAttribute('#editeur-notes-ajuster', 'aria-pressed') === 'true' && await lignes() < avant, 'Ajuster est resté allumé après un rechargement (mémorisé sur l\'appareil)');
    check(await p.evaluate(() => document.getElementById('en-outil-selection').getAttribute('aria-pressed') === 'true'), 'l\'outil, lui, repart sur Sélection');
    await p.close();

    // ======================================================================================================
    console.log('\n=== H. Le téléphone n\'a pas bougé (lot 10) ===');
    p = await ouvrir({ width: 390, height: 844 });
    await p.locator('#grid-zoom').scrollIntoViewIfNeeded();
    await clic(p, '#grid-zoom', 900);
    const t = await p.evaluate(() => ({
        dansSeq: !!document.querySelector('#arp-sequencer .seq-presets #seq-play'),
        tete: Math.round(document.getElementById('editeur-notes-tete').getBoundingClientRect().height),
        tout: (document.querySelector('#arp-sequencer [data-preset="clear"]') || {}).innerText,
    }));
    check(t.dansSeq && t.tete === 0, 'la barre reste dans le séquenceur, sans en-tête d\'éditeur');
    check(/tout/.test(t.tout || ''), `la corbeille garde son mot « tout » (« ${(t.tout || '').trim()} »)`);
    await p.close();

    check(erreurs.length === 0, `aucune erreur de page${erreurs.length ? ' : ' + erreurs.slice(0, 3).join(' | ') : ''}`);
    await nav.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
