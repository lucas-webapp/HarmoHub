// L6a + L6b — LA FENÊTRE D'ACCORD À TROIS ONGLETS : Accord | Voicing | Rythme (refonte, lettres N, O, R des décisions des 13 et 14/11).
//
// CE QUE DEMANDE L'UTILISATEUR (docs/decisions-13-14-11.md) : « au lieu de Son, appelle cela Voicing » ; « il ne faut pas réafficher la fondamentale et le type d'accord sur l'onglet
// Voicing » ; « le bouton Réglages du son n'est pas compréhensible […] une fenêtre flottante apparaît ailleurs sur l'écran, c'est pas du tout logique : si quelque chose s'affiche, c'est dans
// un autre onglet » ; « modifier la couleur bleue pour la modification d'un accord : blanc ou vert » ; « j'ai deux fois l'information […] la partie à côté du nom de l'accord, puis à gauche des
// petites barres » (un repère d'UNE ligne : le nom de la partie et un segment par accord) ; onglet Rythme = les rythmes types, un clic applique, « Autres +n » ouvre tous les rythmes.
// CE QUE LE BANC TIENT : de vrais gestes (double-clic sur une case, clics sur les onglets et sur les commandes, Échap, Ctrl+Z), l'état relu dans la page ; le téléphone a ses trois onglets
// et le même repère.
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('fenêtre d\'accord à trois onglets');
const { estBruitReseau } = require('./_harness');
const { dblclickHorsNom } = require('./_geste_accord');

plan(39);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const graine = () => {
    const mk = (r, q, b = 4) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
    const S = [{ title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7'), mk('D', 'min7'), mk('G', 'dom7')] }, { title: 'Refrain', chords: [mk('F', 'maj7'), mk('E', 'min7')] }];
    localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), sections: S }]));
    localStorage.setItem('harmohubCurrentSongId', 's1');
    localStorage.setItem('myProgression', JSON.stringify({ sections: S }));
    sessionStorage.setItem('cc_accueil_vu', '1');
};

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    const ouvrir = async (viewport, opts = {}) => {
        const p = await nav.newPage({ viewport, ...opts });
        p.on('pageerror', e => erreurs.push(e.message));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) erreurs.push('console: ' + m.text()); });
        await p.goto(`${BASE}/index.html`);
        await p.evaluate(graine);
        await p.reload();
        await p.waitForTimeout(900);
        return p;
    };
    const ouvrirBulle = async (p, i, s = 0) => { await dblclickHorsNom(p, `#progression-sections .grid-cell[data-section="${s}"][data-index="${i}"]`); await p.waitForTimeout(300); };
    const onglet = async (p, v) => { await p.click(`#bulle-accord [data-bulle="onglet"][data-valeur="${v}"]`); await p.waitForTimeout(300); };
    const accord = (p, i, s = 0) => p.evaluate(([i, s]) => { const c = loadProgressionSections()[s].chords[i]; return { root: c.root, quality: c.quality, octave: String(c.octave), inversion: c.inversion, drop: c.drop, motif: c.motifSeq || null }; }, [i, s]);
    const etat = (p) => p.evaluate(() => ({ onglet: window.app._bulle && window.app._bulle.onglet, edition: window.app.editingIndex, bulle: !document.getElementById('bulle-accord').hidden,
        rangeeDans: document.getElementById('voicing-row').closest('#bulle-accord') ? 'bulle' : (document.getElementById('voicing-row').closest('#accord-card') ? 'carte' : '?'),
        rangeeLarg: Math.round(document.getElementById('voicing-row').getBoundingClientRect().width) }));

    // ======================================================================================================
    console.log('\n=== A. Trois onglets, l\'en-tête « mes. N », le repère d\'une ligne ===');
    let p = await ouvrir({ width: 1440, height: 900 });
    await ouvrirBulle(p, 1);
    const a = await p.evaluate(() => {
        const b = document.getElementById('bulle-accord'), tabs = [...b.querySelectorAll('.bulle-onglets button')], rep = b.querySelector('.bulle-repere'), segs = [...b.querySelectorAll('.bulle-repere-segs > i')];
        const cs = (e) => getComputedStyle(e);
        return {
            tabs: tabs.map(t => t.textContent + ':' + t.getAttribute('aria-pressed')).join(' '), couleurActif: cs(tabs[0]).color, traitActif: cs(tabs[0]).boxShadow, couleurInactif: cs(tabs[1]).color,
            ou: b.querySelector('.bulle-ou').textContent, ouAvecPartie: /Couplet|Refrain|Partie/.test(b.querySelector('.bulle-tete').textContent.replace(b.querySelector('.bulle-nom').textContent, '')),
            repereTitre: rep.title, repereNom: rep.querySelector('.bulle-repere-nom').textContent, repereH: Math.round(rep.getBoundingClientRect().height), segs: segs.length, enCours: segs.map((s, k) => s.classList.contains('en-cours') ? k : -1).filter(k => k >= 0).join(),
            largeurs: new Set(segs.map(s => Math.round(s.getBoundingClientRect().width))).size, segH: Math.round(segs[0].getBoundingClientRect().height),
            son: b.querySelectorAll('[data-bulle="son"], .bulle-son').length, aide: b.querySelectorAll('.rr-aide').length,
            panneAccord: [...b.querySelectorAll('.rr-lbl')].map(x => x.textContent).join(' · '),
        };
    });
    check(a.tabs === 'Accord:true Voicing:false Rythme:false', `trois onglets, Accord d'abord : ${a.tabs}`);
    check(/rgb\(0, 230, 118\)/.test(a.couleurActif) && /0px -3px 0px 0px/.test(a.traitActif.replace(/rgb\([^)]*\) /, '')) , `l'onglet actif est VERT, soulignement de 3 px (${a.couleurActif}, ${a.traitActif})`);
    check(!/rgb\(0, 230, 118\)/.test(a.couleurInactif), 'les autres onglets ne sont pas verts');
    check(a.ou === 'mes. 2' && !a.ouAvecPartie, `l'en-tête dit « ${a.ou} » sans nom de partie`);
    check(a.repereNom === 'Couplet' && a.repereTitre === 'Couplet · accord 2 sur 4', `le repère dit la partie une fois : « ${a.repereTitre} »`);
    check(a.repereH === 14 && a.segs === 4 && a.enCours === '1' && a.largeurs === 1 && a.segH === 6, `une ligne de 14 px, 4 segments égaux de 6 px, l'accord en cours en clair (n°${a.enCours})`);
    check(a.son === 0 && a.aide === 0, 'plus de bouton « Réglages du son », plus de phrase d\'aide sous la bulle');
    check(a.panneAccord === 'Fondamentale · Type · Basse · Durée', `l'onglet Accord : ${a.panneAccord}`);
    const e0 = await etat(p);
    check(e0.edition === null && e0.rangeeDans === 'carte' && e0.rangeeLarg === 0, 'au départ rien n\'est ouvert en modification : la rangée du voicing reste dans sa carte cachée');
    check(await p.evaluate(() => getComputedStyle(document.querySelector('.sidebar-frame')).display === 'none'), 'il n\'y a plus d\'inspecteur flottant à l\'ordinateur');
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    await ouvrirBulle(p, 0, 1);
    check(await p.evaluate(() => document.querySelector('#bulle-accord .bulle-repere').title) === 'Refrain · accord 1 sur 2', 'dans le Refrain, le repère change de partie et de nombre de segments');
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);

    // ======================================================================================================
    console.log('\n=== B. L\'onglet Voicing : la rangée dans la bulle, une seule annulation, plus de fenêtre ailleurs ===');
    await ouvrirBulle(p, 1);
    const avant = await accord(p, 1);
    await onglet(p, 'voicing');
    const b1 = await etat(p);
    const v = await p.evaluate(() => ({ labels: [...document.querySelectorAll('#bulle-accord #voicing-row .voicing-label')].map(x => x.textContent).join(' '), racine: document.querySelectorAll('#bulle-accord .bulle-g12').length, bulleH: Math.round(document.getElementById('bulle-accord').getBoundingClientRect().height),
        dedans: (() => { const r = document.getElementById('voicing-row').getBoundingClientRect(), b = document.getElementById('bulle-accord').getBoundingClientRect(); return r.left >= b.left && r.right <= b.right; })(),
        carte: document.getElementById('accord-card').getBoundingClientRect().width }));
    check(b1.onglet === 'voicing' && b1.edition === 1 && b1.rangeeDans === 'bulle' && b1.rangeeLarg > 200, `Voicing : la rangée est DANS la bulle (${b1.rangeeLarg} px), la modification est ouverte sur l'accord ${b1.edition}`);
    check(v.dedans && v.racine === 0 && /Octave/.test(v.labels), `elle tient dans la bulle, sans fondamentale ni type (${v.labels})`);
    check(v.carte === 0, 'et rien ne s\'affiche ailleurs : la carte Accord / l\'inspecteur reste cachée');
    await p.click('#bulle-accord #voicing-row .voicing-step[data-octave-step="1"]'); await p.waitForTimeout(300);
    check((await accord(p, 1)).octave === '4', 'le « + » d\'octave règle l\'accord en direct');
    await onglet(p, 'accord');
    const b2 = await etat(p);
    check(b2.edition === null && b2.rangeeDans === 'carte', 'quitter Voicing referme la modification et rend la rangée à sa carte');
    await p.click('#bulle-accord [data-bulle="root"][data-valeur="D"]'); await p.waitForTimeout(300);
    check((await accord(p, 1)).root === 'D' && (await accord(p, 1)).octave === '4', 'dans Accord, on change la fondamentale : les deux retouches sont faites');
    await p.keyboard.press('Control+z'); await p.waitForTimeout(300);
    const apresUndo = await accord(p, 1);
    check(apresUndo.root === avant.root && apresUndo.octave === avant.octave, `UNE annulation défait toute la bulle (voicing + fondamentale) : ${JSON.stringify(apresUndo)}`);
    await onglet(p, 'voicing');
    await p.click('#bulle-accord [data-bulle="suiv"]'); await p.waitForTimeout(300);
    const b3 = await etat(p);
    check(b3.onglet === 'voicing' && b3.edition === 2 && b3.rangeeDans === 'bulle', `‹ › garde l'onglet : Voicing suit l'accord suivant (modification sur ${b3.edition})`);
    await p.keyboard.press('Escape'); await p.waitForTimeout(250);
    const b4 = await etat(p);
    check(!b4.bulle && b4.edition === null && b4.rangeeDans === 'carte', `Échap ferme la bulle, la modification et rend la rangée (${JSON.stringify(b4)})`);
    await ouvrirBulle(p, 3);
    await onglet(p, 'voicing');
    await p.mouse.click(60, 560); await p.waitForTimeout(300); // un clic à côté, dans le vide
    const b5 = await etat(p);
    check(!b5.bulle && b5.edition === null && b5.rangeeDans === 'carte', 'un clic à côté ferme tout aussi proprement');
    // Le menu « Modifier » d'une case ouvre la bulle (plus d'inspecteur).
    const c = await p.locator('#progression-sections .grid-cell[data-index="2"]').first().boundingBox();
    await p.mouse.click(c.x + c.width / 2, c.y + c.height / 2, { button: 'right' }); await p.waitForTimeout(250);
    await p.click('#context-menu [data-ctx-action="rename"]'); await p.waitForTimeout(350);
    check(await p.evaluate(() => !document.getElementById('bulle-accord').hidden && getComputedStyle(document.querySelector('.sidebar-frame')).display === 'none'), 'le clic droit › « Modifier » ouvre la bulle, plus l\'inspecteur');
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);

    // ======================================================================================================
    console.log('\n=== C. L\'onglet Rythme : les rythmes types, « Autres +n », un clic applique ===');
    await ouvrirBulle(p, 2);
    await onglet(p, 'rythme');
    const r = await p.evaluate(() => {
        const b = document.getElementById('bulle-accord'), bs = [...b.querySelectorAll('.bulle-rythme')], ys = bs.map(x => Math.round(x.getBoundingClientRect().top));
        return { noms: bs.map(x => x.textContent.trim()), colonnes: ys.filter(y => y === ys[0]).length, rangees: new Set(ys).size, vignettes: b.querySelectorAll('.bulle-rythme .sq-vignette').length, ouvrir: !!b.querySelector('.bulle-ouvrir-seq'), aide: b.querySelectorAll('.rr-aide, p').length,
            seqOuvert: !document.getElementById('sequenceur').hidden, derniere: bs[bs.length - 1].classList.contains('bulle-autres'), ed: window.app.editingIndex };
    });
    check(JSON.stringify(r.noms) === JSON.stringify(['Libre', 'Plaqué', 'Arpège ↑', 'Arpège ↓', 'Pompe', 'Ballade', 'Autres']), `les six rythmes puis « Autres » : ${r.noms.join(' · ')}`);
    check(r.colonnes === 4 && r.rangees === 2 && r.derniere, 'sur 4 colonnes, « Autres » toujours la dernière case');
    check(r.vignettes === 7 && r.aide === 0, 'chaque case porte sa vignette ; aucune phrase d\'aide');
    check(r.ouvrir && !r.seqOuvert && r.ed === null, '« Ouvrir le séquenceur » est proposé tant qu\'il est fermé (et l\'onglet n\'ouvre aucune modification)');
    await p.click('#bulle-accord .bulle-ouvrir-seq'); await p.waitForTimeout(600);
    check(await p.evaluate(() => !document.getElementById('sequenceur').hidden && !document.querySelector('#bulle-accord .bulle-ouvrir-seq')), 'un clic ouvre le séquenceur, et le bouton s\'en va');
    await p.click('#bulle-accord .bulle-rythme[data-valeur="monte"]'); await p.waitForTimeout(700);
    check((await accord(p, 2)).motif === 'monte', `un clic sur « Arpège ↑ » donne ce rythme à l'accord (${(await accord(p, 2)).motif})`);
    check(await p.evaluate(() => document.querySelector('#sequenceur [data-sq-motif="monte"]').getAttribute('aria-pressed') === 'true' && document.querySelector('#bulle-accord .bulle-rythme[data-valeur="monte"]').getAttribute('aria-pressed') === 'true'), 'le séquenceur en bas ET la case de la bulle montrent le rythme choisi');
    await p.click('#bulle-accord .bulle-rythme[data-valeur="pompe"]'); await p.waitForTimeout(600);
    check((await accord(p, 2)).motif === 'pompe' && (await accord(p, 1)).motif !== 'pompe', 'un autre rythme remplace le premier, sur CET accord seulement');
    await p.keyboard.press('Control+z'); await p.waitForTimeout(400);
    check((await accord(p, 2)).motif !== 'pompe', 'Ctrl+Z défait le dernier rythme');
    await p.click('#bulle-accord .bulle-autres'); await p.waitForTimeout(400);
    const au = await p.evaluate(() => ({ biblio: !document.getElementById('sq-biblio').hidden, bulle: !document.getElementById('bulle-accord').hidden, lignes: document.querySelectorAll('#sq-biblio .bi-item').length,
        sousLaCase: document.getElementById('sq-biblio').getBoundingClientRect().left >= 0 }));
    check(au.biblio && au.bulle && au.lignes >= 5, `« Autres » ouvre la liste de tous les rythmes sans fermer la bulle (${au.lignes} rythmes)`);
    await p.keyboard.press('Escape'); await p.waitForTimeout(250);
    await p.keyboard.press('Escape'); await p.waitForTimeout(250);
    await p.close();

    // ======================================================================================================
    console.log('\n=== D. Retaper le nom : texte sélectionné blanc, contour vert ===');
    p = await ouvrir({ width: 1440, height: 900 });
    await p.dblclick('#progression-sections .grid-cell[data-index="1"] .cell-sym'); await p.waitForTimeout(350);
    const n4 = await p.evaluate(() => { const i = document.querySelector('.cell-sym-input'); if (!i) return null; const sel = getComputedStyle(i, '::selection'); return { fond: sel.backgroundColor, texte: sel.color, bord: getComputedStyle(i).borderTopColor, selection: i.selectionStart + '-' + i.selectionEnd, long: i.value.length }; });
    exiger(!!n4, 'le double-clic sur le nom ouvre la retape du nom');
    check(n4.fond === 'rgb(255, 255, 255)' && n4.bord === 'rgb(0, 230, 118)', `le texte sélectionné est BLANC (${n4.fond}) et le contour du champ VERT (${n4.bord})`);
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    await p.close();

    // ======================================================================================================
    console.log('\n=== E. Téléphone : mêmes trois onglets (Voicing), même repère, rien d\'autre n\'a bougé (lot 7) ===');
    p = await ouvrir({ width: 390, height: 844 }, { hasTouch: true, isMobile: true });
    const centre = async (i) => { const bb = await p.locator(`#progression-sections .grid-cell[data-index="${i}"]`).first().boundingBox(); return { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 }; };
    let ct = await centre(1); await p.touchscreen.tap(ct.x, ct.y); await p.waitForTimeout(450);
    ct = await centre(1); await p.touchscreen.tap(ct.x, ct.y); await p.waitForTimeout(800);
    const t = await p.evaluate(() => {
        const pa = document.getElementById('panneau-accord'), tabs = [...pa.querySelectorAll('.pa-onglets button')], rep = pa.querySelector('.bulle-repere');
        return { ouvert: !pa.hidden, tabs: tabs.map(x => x.textContent).join(' · '), ou: pa.querySelector('.pa-ou').textContent, repere: rep && rep.title, segs: pa.querySelectorAll('.bulle-repere-segs > i').length, vert: getComputedStyle(tabs[0]).color, sonBtn: !!document.getElementById('pa-son-btn') };
    });
    exiger(t.ouvert, 'un second toucher ouvre le panneau d\'accord du téléphone');
    check(t.tabs === 'Accord · Voicing · Rythme' && /rgb\(0, 230, 118\)/.test(t.vert), `trois onglets, l'actif en vert : ${t.tabs}`);
    check(t.repere === 'Couplet · accord 2 sur 4' && t.segs === 4 && !/Couplet/.test(t.ou), `le repère est là aussi, l'en-tête dit « ${t.ou} » sans la partie`);
    await p.touchscreen.tap(...Object.values(await (async () => { const bb = await p.locator('#panneau-accord .pa-onglets button[data-valeur="son"]').boundingBox(); return { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 }; })())); await p.waitForTimeout(600);
    check(await p.evaluate(() => window.app._bulle.etendu === true && document.getElementById('panneau-accord').querySelector('.pa-onglets button[data-valeur="son"]').getAttribute('aria-pressed') === 'true'), 'l\'onglet Voicing du téléphone ouvre toujours les réglages du son (panneau agrandi)');
    await p.close();

    check(erreurs.length === 0, `aucune erreur JavaScript (${erreurs.length ? erreurs.join(' | ') : 'aucune'})`);
    await nav.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
