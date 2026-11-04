// L'ÉDITEUR DE NOTES : LE CALQUE VOIX (refonte, lot 9c), avec de vrais gestes.
//
// CE QUE DEMANDE LA MAQUETTE VALIDÉE (docs/refonte.md) : « Calque Voix = l'ancienne conduite de voix : fonction 1/3/5/7 écrite dans la note (la
// couleur n'est plus seule), trait blanc du chemin des voix. Chaque fonction de l'ancien panneau (règles de voix, loupe, pincement) est vérifiée une
// à une AVANT de fondre. » Décisions du 05/11 : éteint au premier usage puis mémorisé par appareil ; nom et degré de chaque accord dans la règle,
// calque allumé seulement ; allumer Voix sans accord choisi ouvre le premier accord de la partie ; l'icône ⊱ quitte l'ordinateur (le téléphone la
// garde jusqu'au lot 10).
//
// CE QUE LE BANC TIENT — l'inventaire de l'ancien panneau, fonction par fonction (voir docs/dette-tests.md, lot 9c) :
//   la porte (un seul bouton, même logo, à la jauge, éteint au départ) ; toute la partie sans accord choisi ; la fonction dans chaque note, voisins
//   compris, et le vrai degré des couleurs (9) ; le chemin des voix (même appariement par rang, plein = tenue, pointillés = mouvement, posé sur la
//   frontière, du milieu d'une ligne au milieu de l'autre) ; les traits ne prennent aucun clic ; nom + degré dans la règle, au-dessus des mesures,
//   sans rien prendre aux 170px de notes ; le zoom horizontal emporte les traits ; une édition (renversement) les redessine ; mémorisé ; pas d'id
//   en double ; le téléphone n'a pas bougé (icône ⊱ et ancien panneau, aucun calque).
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('éditeur de notes : calque Voix');
const { estBruitReseau } = require('./_harness');

plan(46);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
// Une partie choisie pour son chemin des voix : C (48 52 55) → F 2e renversement (48 53 57) garde le DO en commun à la voix grave (un trait PLEIN),
// puis G7 1er renversement (47 50 53 55), puis Cadd9 (48 52 55 62, dont un 9).
const graine = () => {
    const mk = (r, q, octave, inversion = 0) => ({ root: r, quality: q, beats: 4, inversion, drop: 'none', octave, bass: null, playStyle: 'held' });
    const S = [{ title: 'Couplet', chords: [mk('C', 'maj', 3), mk('F', 'maj', 2, 2), mk('G', 'dom7', 2, 1), mk('C', 'add9', 3)] }];
    localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), sections: S }]));
    localStorage.setItem('harmohubCurrentSongId', 's1');
    localStorage.setItem('myProgression', JSON.stringify({ sections: S }));
    localStorage.removeItem('harmohubSeqDockHeight');
    localStorage.removeItem('harmohubSeqAjuster');
    localStorage.removeItem('harmohubSeqVoix');
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
    // Le calque tel qu'on le VOIT : chiffres, traits, bande des accords, légende, bouton.
    const calque = (p) => p.evaluate(() => {
        const q = (s) => [...document.querySelectorAll(s)];
        return {
            presse: document.getElementById('editeur-notes-voix').getAttribute('aria-pressed'),
            legende: !document.getElementById('editeur-notes-legende').hidden && !!document.getElementById('editeur-notes-legende').offsetParent,
            chiffres: q('#arp-sequencer .seq-note .seq-note-fn').length,
            chiffresVoisins: q('#arp-sequencer .seq-ctx-note .seq-note-fn').map(e => e.textContent),
            traits: q('#arp-sequencer .seq-voix-trait').length,
            tenues: q('#arp-sequencer .seq-voix-tenue').map(t => t.dataset.accord + ':' + t.dataset.de + '>' + t.dataset.vers),
            accords: q('#arp-sequencer .seq-voix-accord').map(e => e.textContent.trim()),
            bande: Math.round(document.querySelector('#arp-sequencer .seq-scroll').getBoundingClientRect().height),
        };
    });
    // Bord gauche d'un accord dans la vue : sa première case s'il est en cours, sinon la zone qui le désigne.
    const geometrie = (p) => p.evaluate(() => {
        const bordAccord = (i) => {
            const nav = document.querySelector(`#arp-sequencer .seq-ctx-nav[data-target-index="${i}"]`);
            const el = nav || document.querySelector('#arp-sequencer .seq-cell[data-step="0"]');
            return el.getBoundingClientRect().left;
        };
        const centreLigne = (m) => { const r = document.querySelector(`#arp-sequencer .seq-label[data-row-midi="${m}"]`).getBoundingClientRect(); return r.top + r.height / 2; };
        const mv = [...document.querySelectorAll('#arp-sequencer .seq-voix-mouvement')].map(t => {
            const r = t.getBoundingClientRect(), hi = Math.max(+t.dataset.de, +t.dataset.vers), lo = Math.min(+t.dataset.de, +t.dataset.vers);
            return { ecartX: Math.abs(r.left + r.width / 2 - bordAccord(+t.dataset.accord)), ecartHaut: Math.abs(r.top - centreLigne(hi)), ecartBas: Math.abs(r.bottom - centreLigne(lo)), pointilles: /repeating-linear-gradient/.test(getComputedStyle(t).backgroundImage) };
        });
        const tn = [...document.querySelectorAll('#arp-sequencer .seq-voix-tenue')].map(t => {
            const r = t.getBoundingClientRect(), x = bordAccord(+t.dataset.accord);
            return { enjambe: r.left < x - 2 && r.right > x + 2, ecartY: Math.abs(r.top + r.height / 2 - centreLigne(+t.dataset.de)), plein: !/gradient/.test(getComputedStyle(t).backgroundImage), horizontal: r.width > r.height };
        });
        const etiquettes = [...document.querySelectorAll('#arp-sequencer .seq-voix-accord')].map(e => ({ i: +e.dataset.accord, ecart: Math.abs(e.getBoundingClientRect().left - bordAccord(+e.dataset.accord)), bas: e.getBoundingClientRect().bottom }));
        const mesure = document.querySelector('#arp-sequencer .seq-beat-label[data-mesure] .seq-beat-num').getBoundingClientRect();
        return { mv, tn, etiquettes, mesureHaut: mesure.top };
    });

    // ======================================================================================================
    console.log('\n=== A. La porte : un seul bouton, le logo d\'avant, éteint au départ ===');
    let p = await ouvrir({ width: 1440, height: 900 });
    check(!(await p.locator('#toggle-voice-leading').isVisible()), 'l\'icône ⊱ de la rangée de réglages a quitté l\'ordinateur');
    await clic(p, '#grid-zoom', 900);
    const porte = await p.evaluate(() => {
        const b = document.getElementById('editeur-notes-voix'), r = b.getBoundingClientRect();
        return { vis: !!b.offsetParent, h: Math.round(r.height), w: Math.round(r.width), rayon: getComputedStyle(b).borderTopLeftRadius, nom: b.getAttribute('aria-label'),
            memeLogo: b.querySelector('svg').innerHTML === document.querySelector('#toggle-voice-leading svg').innerHTML,
            dansLaRangee: b.closest('#editeur-notes-tete') !== null };
    });
    exiger(porte.vis && porte.dansLaRangee, 'le bouton Voix est dans la rangée de l\'éditeur de notes');
    check(porte.memeLogo, 'il porte le logo de l\'ancienne conduite de voix, repris tel quel');
    check(porte.h === 32 && porte.w === 32 && porte.rayon === '7px' && porte.nom === 'Voix', `à la jauge, sans mot (${porte.w}×${porte.h}, ${porte.rayon}, « ${porte.nom} »)`);
    let c = await calque(p);
    check(c.presse === 'false' && !c.legende && c.chiffres === 0 && c.traits === 0 && c.accords.length === 0, 'éteint au départ : ni chiffre, ni trait, ni légende, ni bande des accords');
    const bandeEteint = c.bande;

    // ======================================================================================================
    console.log('\n=== B. Allumé sans accord choisi : le premier accord, et toute la partie ===');
    exiger(await p.evaluate(() => window.app.editingIndex == null), 'aucun accord en cours à l\'ouverture');
    await clic(p, '#editeur-notes-voix', 900);
    c = await calque(p);
    check(await p.evaluate(() => window.app.editingIndex === 0 && window.app.seqMode === 'continu'), 'Voix ouvre le premier accord de la partie, l\'éditeur reste ouvert');
    check(c.presse === 'true' && c.legende, 'le bouton dit qu\'il est allumé, la légende 1 / 3 / 5 / 7 / Autres apparaît');
    check(c.chiffresVoisins.length >= 11, `les accords voisins sont là, chacun avec ses fonctions (${c.chiffresVoisins.length} notes)`);
    check(await p.evaluate(() => !document.querySelector('.voice-leading-panel')), 'aucun ancien panneau ne s\'ouvre à côté');

    // ======================================================================================================
    console.log('\n=== C. La fonction écrite dans la note ===');
    const notes = await p.evaluate(() => [...document.querySelectorAll('#arp-sequencer .seq-note')].map(n => ({ role: (n.className.match(/role-(\w+)/) || [])[1], fn: (n.querySelector('.seq-note-fn') || {}).textContent })));
    const attendu = { root: '1', third: '3', fifth: '5', seventh: '7' };
    check(notes.length === 3 && notes.every(n => n.fn === attendu[n.role]), `chaque note de l'accord porte sa fonction, d'accord avec sa couleur (${notes.map(n => n.role + '=' + n.fn).join(', ')})`);
    check(c.chiffresVoisins.includes('9') && !c.chiffresVoisins.includes('·'), `les couleurs « Autres » disent leur vrai degré : le 9 de Cadd9 (${c.chiffresVoisins.join(' ')})`);
    check(c.chiffresVoisins.filter(x => x === '7').length === 1, 'le 7 de G7 est écrit, et lui seul (aucune septième ailleurs)');

    // ======================================================================================================
    console.log('\n=== D. Le chemin des voix ===');
    check(c.traits === 10, `un trait par voix d'un accord au suivant, jusqu'au plus petit nombre de voix : 3 + 3 + 4 = 10 (${c.traits})`);
    check(c.tenues.length === 1 && c.tenues[0] === '1:48>48', `la note commune tenue (le DO grave, de C à F) est un trait PLEIN, et c'est la seule (${c.tenues.join(', ')})`);
    const appariement = await p.evaluate(() => [...document.querySelectorAll('#arp-sequencer .seq-voix-trait[data-accord="2"]')].map(t => t.dataset.de + '>' + t.dataset.vers).sort().join(' '));
    check(appariement === '48>47 53>50 57>53', `appariement par rang, du grave à l'aigu (F → G7 : ${appariement})`);
    let g = await geometrie(p);
    check(g.mv.length === 9 && g.mv.every(t => t.pointilles), 'chaque mouvement est en pointillés');
    check(g.mv.every(t => t.ecartX <= 2), `posé sur la frontière entre les deux accords (écarts ${g.mv.map(t => t.ecartX.toFixed(1)).join(' ')} px)`);
    check(g.mv.every(t => t.ecartHaut <= 2 && t.ecartBas <= 2), 'du milieu de la ligne de départ au milieu de celle d\'arrivée');
    check(g.tn.length === 1 && g.tn[0].enjambe && g.tn[0].plein && g.tn[0].horizontal && g.tn[0].ecartY <= 2, 'la tenue enjambe la frontière, pleine, sur la ligne de sa note');
    // Un clic sur le trait plein (posé sur la fin de la note grave) doit atteindre la note dessous : le calque ne prend aucun geste.
    const tenue = await p.locator('#arp-sequencer .seq-voix-tenue').boundingBox();
    exiger(!!tenue, 'le trait plein est à l\'écran');
    await p.mouse.click(tenue.x + 3, tenue.y + tenue.height / 2); await p.waitForTimeout(500);
    check(await p.evaluate(() => window.app.seqSelections.length === 1 && window.app.seqSelections[0].voice === 0), 'un clic sur le trait choisit la note dessous : le calque ne prend aucun clic');

    // ======================================================================================================
    console.log('\n=== E. Nom et degré de chaque accord, dans la règle ===');
    check(JSON.stringify(c.accords) === JSON.stringify(['CI', 'FIV', 'G7V7', 'Cadd9I9']), `les quatre accords, nom puis degré (${c.accords.join(' | ')})`);
    check(g.etiquettes.length === 4 && g.etiquettes.every(e => e.ecart <= 2), 'chacun commence là où commence son accord');
    check(g.etiquettes.every(e => e.bas <= g.mesureHaut + 1), 'la bande est AU-DESSUS des numéros de mesure, qui restent lisibles');
    check(c.bande - bandeEteint === 14 && c.bande >= 199 && c.bande <= 214, `la règle grandit de sa bande, les notes gardent leurs ~170px (bande ${bandeEteint} → ${c.bande} px)`);

    // ======================================================================================================
    console.log('\n=== F. Le zoom horizontal emporte les traits ===');
    const largeur0 = await p.evaluate(() => document.querySelector('#arp-sequencer .seq-cell[data-step="0"]').getBoundingClientRect().width);
    await clic(p, '#seq-zoom-in-h-inline', 400);
    await clic(p, '#seq-zoom-in-h-inline', 600);
    const largeur1 = await p.evaluate(() => document.querySelector('#arp-sequencer .seq-cell[data-step="0"]').getBoundingClientRect().width);
    exiger(largeur1 > largeur0 * 1.2, `le zoom a bien élargi les cases (${largeur0.toFixed(1)} → ${largeur1.toFixed(1)} px)`);
    g = await geometrie(p);
    check(g.mv.every(t => t.ecartX <= 2) && g.tn.every(t => t.enjambe), 'les traits restent sur leurs frontières');
    check(g.etiquettes.every(e => e.ecart <= 2), 'les noms d\'accord suivent aussi');

    // ======================================================================================================
    console.log('\n=== G. Une édition redessine le calque (renversement de l\'accord en cours) ===');
    exiger(!!(await p.$('#inversion-seg .voicing-segment[data-valeur="1"]')), 'les segments de renversement sont dans l\'inspecteur');
    await clic(p, '#inversion-seg .voicing-segment[data-valeur="1"]', 800);
    c = await calque(p);
    const apres = await p.evaluate(() => [...document.querySelectorAll('#arp-sequencer .seq-voix-trait[data-accord="1"]')].map(t => t.dataset.de + '>' + t.dataset.vers).sort().join(' '));
    check(apres === '52>48 55>53 60>57', `C au 1er renversement (52 55 60) : les traits partent des nouvelles hauteurs (${apres})`);
    check(c.tenues.length === 0, 'et le DO n\'est plus tenu : plus de trait plein');
    check(await p.evaluate(() => [...document.querySelectorAll('#arp-sequencer .seq-note .seq-note-fn')].map(e => e.textContent).sort().join('')) === '135', 'les fonctions suivent les notes déplacées');

    // ======================================================================================================
    console.log('\n=== H. Mémorisé par appareil ; pas d\'id en double ===');
    check(await p.evaluate(() => { const ids = [...document.querySelectorAll('[id]')].map(e => e.id); return ids.length === new Set(ids).size; }), 'aucun id en double dans la page');
    await p.reload(); await p.waitForTimeout(900);
    await clic(p, '#progression-sections .grid-cell[data-index="2"]', 300);
    await clic(p, '#grid-zoom', 900);
    c = await calque(p);
    check(c.presse === 'true' && c.chiffres > 0 && c.traits > 0, 'rouvert après rechargement : le calque est resté allumé');
    await clic(p, '#editeur-notes-voix', 700);
    c = await calque(p);
    check(c.presse === 'false' && c.chiffres === 0 && c.traits === 0 && c.accords.length === 0 && !c.legende, 'éteint d\'un clic : tout le calque s\'en va');
    check(c.bande === bandeEteint, `la règle reprend sa hauteur d'avant (${c.bande} px)`);
    check(await p.evaluate(() => window.app.editingIndex === 2), 'éteindre ne touche pas à l\'accord en cours');
    await p.reload(); await p.waitForTimeout(900);
    await clic(p, '#grid-zoom', 900);
    c = await calque(p);
    check(c.presse === 'false' && c.chiffres === 0, 'et il reste éteint au rechargement');
    check(await p.evaluate(() => window.app.editingIndex == null), 'éteint, l\'éditeur s\'ouvre comme avant (aucun accord pris d\'office)');
    await p.close();

    // ======================================================================================================
    console.log('\n=== I. Le téléphone n\'a pas bougé (lot 10) ===');
    p = await ouvrir({ width: 860, height: 900 });
    await p.evaluate(() => localStorage.setItem('harmohubSeqVoix', '1'));
    await p.reload(); await p.waitForTimeout(900);
    exiger(await p.locator('#toggle-voice-leading').isVisible(), 'l\'icône ⊱ est toujours là sous 900px');
    await clic(p, '#toggle-voice-leading', 700);
    check(await p.evaluate(() => !!document.querySelector('.voice-leading-panel svg') && window.app.voiceLeadingOpen), 'elle ouvre toujours l\'ancien panneau de conduite de voix');
    await clic(p, '#progression-sections .grid-cell[data-index="1"]', 300);
    await clic(p, '#grid-zoom', 900);
    const tel = await p.evaluate(() => ({ tete: !!document.getElementById('editeur-notes-tete').offsetParent, fn: document.querySelectorAll('.seq-note-fn').length, traits: document.querySelectorAll('.seq-voix-trait').length, seq: window.app.seqOpen }));
    check(tel.seq && !tel.tete && tel.fn === 0 && tel.traits === 0, 'le séquenceur d\'avant s\'y ouvre, sans en-tête ni calque — même réglage Voix allumé');
    await p.close();

    // ======================================================================================================
    console.log('\n=== J. Élargir la fenêtre ne laisse pas l\'ancien panneau orphelin ===');
    p = await ouvrir({ width: 860, height: 900 });
    await clic(p, '#toggle-voice-leading', 700);
    exiger(await p.evaluate(() => !!document.querySelector('.voice-leading-panel')), 'l\'ancien panneau est ouvert sous 900px');
    await p.setViewportSize({ width: 1440, height: 900 }); await p.waitForTimeout(800);
    check(await p.evaluate(() => !document.querySelector('.voice-leading-panel') && !window.app.voiceLeadingOpen), 'passé au-dessus de 900px (où il n\'a plus de bouton), il se referme');
    await p.close();

    check(erreurs.length === 0, `aucune erreur JavaScript${erreurs.length ? ' — ' + erreurs.slice(0, 3).join(' | ') : ''}`);
    await nav.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
