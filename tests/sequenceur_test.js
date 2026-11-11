// LE NOUVEAU SÉQUENCEUR (refonte du séquenceur, point D, premier sous-lot : module sequenceur.js + intégration à l'ordinateur), avec de vrais gestes.
//
// CE QUE DEMANDE LE CAHIER (docs/refonte-sequenceur.md, sections 3 et 3 bis ; maquette v17, planche A v26) : UN séquenceur, une ligne par voix, huit
// croches par mesure, toute la partie à l'écran ; en bas, au-dessus des diagrammes et de la barre de lecture, ouvert par un bouton du bloc « Vues » ;
// motifs fournis écrits PAR POSITION (basse, voix 2, voix 3, aiguë) appliqués à « Toute la partie » ou « Cet accord » ; un clic pose ou enlève, un
// glissé PEINT ; Intensité allumée : normal → fort → doux → enlevée ; Copier / Coller / Effacer ; la plage à boucler se tire sur la règle et se retire
// d'un clic ; la poignée ne règle que la hauteur des lignes (22 à 48, 30 par défaut, double-clic = d'origine) et ne cache jamais rien.
//
// CE QUE LE BANC TIENT : tout ce qui précède, avec la règle des accords de 3 et 5 notes et de la basse différente, une annulation par geste, la grille
// qui garde son affichage, l'accord qui reste choisi, l'édition ouverte qui ne réécrit pas l'ancien rythme, la tête de lecture verte, et le téléphone
// qui n'a pas bougé.
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('séquenceur');
const { estBruitReseau } = require('./_harness');
const { ouvrirSon } = require('./_geste_accord');

plan(76);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const graine = (S) => {
    localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), sections: S }]));
    localStorage.setItem('harmohubCurrentSongId', 's1');
    localStorage.setItem('myProgression', JSON.stringify({ sections: S }));
    sessionStorage.setItem('cc_accueil_vu', '1');
};
const mk = (r, q, extra = {}) => ({ root: r, quality: q, beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held', ...extra });
const PARTIE = [{ title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7'), mk('D', 'min7'), mk('G', 'dom7')] }];

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    const ouvrir = async (viewport, S = PARTIE, avant = null) => {
        const p = await nav.newPage({ viewport });
        p.on('pageerror', e => erreurs.push(e.message));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) erreurs.push('console: ' + m.text()); });
        await p.goto(`${BASE}/index.html`);
        await p.evaluate(graine, S);
        if (avant) await p.evaluate(avant);
        await p.reload();
        await p.waitForTimeout(900);
        return p;
    };
    // Lecture de l'état (jamais pour agir) : les croches de chaque position (de la basse à l'aiguë) d'un accord enregistré.
    const croches = (p, c, s = 0) => p.evaluate(({ c, s }) => {
        const d = loadProgressionSections()[s].chords[c];
        const e = SequenceurHarmo.lireAccord(d);
        const par = (v) => { const r = []; for (let k = 0; k < e.info.croches; k++) if (e.on.has(v + ':' + k)) r.push(k); return r.join(','); };
        return { pos: e.info.positions.map(par), basse: e.info.basse != null ? par(e.info.basse) : null, motif: d.motifSeq || null,
            soude: [...e.soude].sort().join(' '), iv: JSON.stringify(d.intensiteVoix || {}), positions: e.info.positions,
            roleGrave: e.info.voix[e.info.positions[0]].role };
    }, { c, s });
    const caseSq = (c, v, k) => `#sq-grille .sq-case[data-c="${c}"][data-v="${v}"][data-k="${k}"]`;
    const centre = async (p, sel) => { const b = await p.locator(sel).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
    const cliquer = async (p, sel) => { const q = await centre(p, sel); await p.mouse.click(q.x, q.y); await p.waitForTimeout(250); };
    const ctrlZ = async (p) => { await p.keyboard.press('Control+z'); await p.waitForTimeout(300); };
    const presse = (p, id) => p.evaluate((id) => document.getElementById(id).getAttribute('aria-pressed'), id);
    const empreinteGrille = (p) => p.evaluate(() => [...document.querySelectorAll('#progression-sections .grid-cell')].map(c => { const r = c.getBoundingClientRect(); return Math.round(r.width) + 'x' + Math.round(r.height); }).join(' '));

    // ======================================================================================================
    console.log('\n=== A. Ouverture par le bloc « Vues », place en bas, grille inchangée ===');
    let p = await ouvrir({ width: 1440, height: 900 });
    const avant = await empreinteGrille(p);
    exiger(await p.evaluate(() => document.getElementById('vue-sequenceur').closest('#bl-vues') !== null && document.getElementById('sequenceur').hidden), 'le bouton Séquenceur est dans le bloc « Vues » de la barre de lecture, le séquenceur fermé au départ');
    await cliquer(p, '#vue-sequenceur');
    exiger(await p.evaluate(() => !document.getElementById('sequenceur').hidden), 'un clic sur le bouton ouvre le séquenceur');
    check(await presse(p, 'vue-sequenceur') === 'true', 'le bouton dit qu\'il est allumé (aria-pressed)');
    const place = await p.evaluate(() => {
        const s = document.getElementById('sequenceur').getBoundingClientRect(), t = document.getElementById('vues-tiroir').getBoundingClientRect(), l = document.getElementById('barre-lecture').getBoundingClientRect();
        const g = document.getElementById('grille-cadre').getBoundingClientRect();
        return { sBas: s.bottom, tHaut: t.top, tH: t.height, lHaut: l.top, sHaut: s.top, gHaut: g.top };
    });
    check(place.tH > 0 && Math.abs(place.sBas - place.tHaut) < 2, `le séquenceur se pose juste au-dessus du tiroir des diagrammes (bas ${Math.round(place.sBas)}, tiroir ${Math.round(place.tHaut)})`);
    check(place.sBas <= place.lHaut && place.sHaut > place.gHaut, 'il reste au-dessus de la barre de lecture et sous la grille');
    check(await empreinteGrille(p) === avant, 'la grille garde exactement son affichage séquenceur ouvert (règle A)');

    console.log('\n=== B. Une ligne par voix, huit croches par mesure, étiquettes de l\'accord choisi ===');
    const forme = await p.evaluate(() => {
        const rangs = new Set([...document.querySelectorAll('#sq-grille .sq-case[data-v]')].map(c => c.dataset.r));
        const parAccord = [0, 1, 2, 3].map(c => document.querySelectorAll(`#sq-grille .sq-case[data-c="${c}"][data-r="0"], #sq-grille .sq-case.sans-voix`).length);
        const huit = [0, 1, 2, 3].map(c => new Set([...document.querySelectorAll(`#sq-grille [data-c="${c}"][data-k]`)].map(x => x.dataset.k)).size);
        return { lignes: document.querySelectorAll('#sq-grille .sq-etiq').length, rangs: rangs.size, huit, etiq: [...document.querySelectorAll('#sq-grille .sq-etiq')].map(e => e.textContent).join(' ') };
    });
    check(forme.lignes === 4 && forme.rangs === 4, `quatre lignes pour des accords de quatre sons (${forme.lignes})`);
    check(forme.huit.every(n => n === 8), `huit croches par accord d'une mesure (${forme.huit.join(',')})`);
    check(forme.etiq === 'B3 G3 E3 C3', `étiquettes : les notes de l'accord choisi, de l'aiguë à la basse, avec l'octave (« ${forme.etiq} »)`);
    check(await presse(p, 'sq-motif-plaque') === 'true', 'un accord jamais retouché, joué tenu, montre « Plaqué » enfoncé');
    check(await p.evaluate(() => !!document.querySelector('#sq-grille .sq-case.on.soude-d') && document.querySelectorAll('#sq-grille .sq-note').length > 0), 'un accord tenu se dessine en barres continues (croches soudées)');

    console.log('\n=== C. Un motif sur toute la partie, une annulation ===');
    check(await presse(p, 'sq-portee-partie') === 'true', '« Toute la partie » est la portée de départ');
    await cliquer(p, '#sq-motif-monte');
    const cm = await Promise.all([0, 1, 2].map(c => croches(p, c)));
    check(cm.every(x => x.pos.join('|') === '0,1,2,3,4,5,6,7|1,5|2,6|3,7' && x.motif === 'monte'), `Arpège ↑ écrit par position sur chaque accord (${cm[0].pos.join('|')})`);
    check(await presse(p, 'sq-motif-monte') === 'true' && await presse(p, 'sq-motif-plaque') === 'false', 'la vignette du motif suivi s\'enfonce');
    const c3 = await croches(p, 3);
    check(c3.pos.join('|') === '0,1,2,3,4,5,6,7|1,5|2,6|3,7', `G7 (quatre sons) prend aussi les quatre positions (${c3.pos.join('|')})`);
    await ctrlZ(p);
    check((await croches(p, 1)).motif === null && (await croches(p, 1)).pos[1] === '0,1,2,3,4,5,6,7', 'un seul Ctrl+Z ramène toute la partie à Plaqué');

    console.log('\n=== D. « Cet accord » : seul l\'accord choisi change ===');
    await cliquer(p, '#sq-portee-accord');
    await cliquer(p, '#sq-grille .sq-nom[data-c="2"]');
    check(await p.evaluate(() => window.app.selectedIndex) === 2, 'un clic sur le nom d\'un accord, au-dessus de la règle, le choisit');
    await cliquer(p, '#sq-motif-pompe');
    const d2 = await croches(p, 2), d1 = await croches(p, 1);
    check(d2.pos.join('|') === '0,1,4,5|2,6|2,6|2,6' && d2.motif === 'pompe', `Pompe sur l'accord choisi seulement (${d2.pos.join('|')})`);
    check(d1.motif === null && d1.pos[0] === '0,1,2,3,4,5,6,7', 'l\'accord voisin n\'a pas bougé');
    check(d2.soude.includes(d2.positions[0] + ':1') && !d2.soude.includes(d2.positions[0] + ':4'), 'la basse de Pompe : deux notes tenues d\'un temps (croches 1-2 et 5-6 soudées, deux attaques)');

    console.log('\n=== E. Un clic pose ou enlève une note, à côté d\'une autre elle s\'y soude ===');
    const vAigu = d2.positions[3];
    await cliquer(p, caseSq(2, vAigu, 3));
    let e2 = await croches(p, 2);
    check(e2.pos[3] === '2,3,6' && e2.motif === null, `clic sur une case vide : la note est posée (aiguë ${e2.pos[3]}), l'accord passe « À la main »`);
    check(await presse(p, 'sq-motif-main') === 'true', 'la vignette « À la main » s\'enfonce');
    check(e2.soude.split(' ').includes(vAigu + ':3'), 'posée juste après une autre, elle s\'y soude : une seule note tenue');
    check(await p.evaluate(() => window.app.selectedIndex) === 2, 'toucher une note garde l\'accord choisi (rien n\'est désélectionné)');
    await cliquer(p, caseSq(2, vAigu, 3));
    e2 = await croches(p, 2);
    check(e2.pos[3] === '2,6', `second clic : la note est enlevée (${e2.pos[3]})`);
    await ctrlZ(p);
    check((await croches(p, 2)).pos[3] === '2,3,6', 'Ctrl+Z la remet (une annulation par clic)');

    console.log('\n=== F. Un glissé peint plusieurs croches, d\'une seule annulation ===');
    const vBasse = d2.positions[0];
    await cliquer(p, '#sq-portee-partie');
    await cliquer(p, '#sq-grille .sq-nom[data-c="2"]'); // Ctrl+Z ne garde pas forcément l'accord choisi : on le rechoisit
    await cliquer(p, '#sq-effacer'); // efface l'accord choisi (2) — on repart d'une ligne vide sur l'accord 2
    exiger((await croches(p, 2)).pos.every(x => x === ''), '« Effacer » vide le rythme de l\'accord choisi');
    check(await presse(p, 'sq-motif-main') === 'true', 'un accord effacé suit « À la main »');
    const a = await centre(p, caseSq(2, vBasse, 1)), b = await centre(p, caseSq(2, vBasse, 4));
    await p.mouse.move(a.x, a.y); await p.mouse.down();
    for (let i = 1; i <= 6; i++) await p.mouse.move(a.x + (b.x - a.x) * i / 6, a.y, { steps: 2 });
    await p.mouse.up(); await p.waitForTimeout(300);
    const f2 = await croches(p, 2);
    check(f2.pos[0] === '1,2,3,4', `le glissé de la croche 2 à la 5 peint exactement ces quatre croches (${f2.pos[0]})`);
    check(f2.soude.split(' ').filter(x => x.startsWith(vBasse + ':')).length === 3, 'peintes d\'un trait, elles forment une seule note tenue');
    check(f2.pos[1] === '' && f2.pos[2] === '', 'le glissé reste sur la ligne de départ');
    await ctrlZ(p);
    check((await croches(p, 2)).pos[0] === '', 'un seul Ctrl+Z défait tout le glissé');
    // Un glissé qui part d'une note EFFACE (on enlève selon l'état de la première case).
    const g0 = await centre(p, caseSq(1, d1.positions[1], 2)), g1 = await centre(p, caseSq(1, d1.positions[1], 5));
    await p.mouse.move(g0.x, g0.y); await p.mouse.down();
    for (let i = 1; i <= 6; i++) await p.mouse.move(g0.x + (g1.x - g0.x) * i / 6, g0.y, { steps: 2 });
    await p.mouse.up(); await p.waitForTimeout(300);
    check((await croches(p, 1)).pos[1] === '0,1,6,7', `parti d'une note, le glissé enlève les croches traversées (${(await croches(p, 1)).pos[1]})`);

    console.log('\n=== G. Intensité : normal → fort → doux → enlevée ===');
    await cliquer(p, '#sq-intensite');
    check(await presse(p, 'sq-intensite') === 'true', 'le bouton Intensité (logo du mode studio) s\'allume');
    const vB1 = d1.positions[0];
    await cliquer(p, caseSq(1, vB1, 3));
    let g = await croches(p, 1);
    check(JSON.parse(g.iv)[vB1 + ':0'] === 90, `un clic sur une note : « fort » (intensiteVoix ${g.iv}), porté par l'attaque de la barre`);
    check(await p.evaluate((s) => document.querySelector(s).classList.contains('niv-fort'), caseSq(1, vB1, 3)), 'la note « fort » se dessine plus appuyée (niv-fort)');
    check(await p.evaluate(({ v }) => reglageIntensiteCroche(loadProgressionSections()[0].chords[1].intensiteVoix, {}, v, 0), { v: vB1 }) === 90, 'la lecture lit ce réglage pour CETTE voix (reglageIntensiteCroche)');
    await cliquer(p, caseSq(1, vB1, 3));
    check(JSON.parse((await croches(p, 1)).iv)[vB1 + ':0'] === 55, 'second clic : « doux »');
    await cliquer(p, caseSq(1, vB1, 3));
    g = await croches(p, 1);
    check(!g.pos[0].split(',').includes('3') && g.pos[0].split(',').includes('2') && g.pos[0].split(',').includes('4'), `troisième clic : la croche est enlevée, la barre coupée en deux (${g.pos[0]})`);
    check(JSON.parse(g.iv)[vB1 + ':8'] === 55, 'la suite de la barre garde le niveau de la barre dont elle sort');
    await cliquer(p, '#sq-intensite');
    check(await presse(p, 'sq-intensite') === 'false' && JSON.parse((await croches(p, 1)).iv)[vB1 + ':0'] === 55, 'éteinte, les intensités réglées restent');

    console.log('\n=== H. Copier, coller sur un autre accord ===');
    check(await p.evaluate(() => document.getElementById('sq-coller').disabled), 'Coller est grisé tant que rien n\'est copié');
    await cliquer(p, '#sq-grille .sq-nom[data-c="2"]');
    await cliquer(p, '#sq-portee-accord');
    await cliquer(p, '#sq-motif-ballade');
    await cliquer(p, '#sq-copier');
    await cliquer(p, '#sq-grille .sq-nom[data-c="0"]');
    await cliquer(p, '#sq-coller');
    const h0 = await croches(p, 0);
    check(h0.pos.join('|') === '0,1,2,3,4,5,6,7|1,4,7|2,5|0,3,6', `le rythme de Dm7 (Ballade) collé sur Cmaj7, position pour position (${h0.pos.join('|')})`);
    check(h0.motif === null, 'un rythme collé suit « À la main »');

    console.log('\n=== I. La plage à boucler : tirer sur la règle, cliquer pour la retirer ===');
    const r0 = await centre(p, '#sq-grille .sq-temps[data-c="0"][data-k="2"]'), r1 = await centre(p, '#sq-grille .sq-temps[data-c="1"][data-k="5"]');
    await p.mouse.move(r0.x, r0.y); await p.mouse.down();
    await p.mouse.move(r1.x, r1.y, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(400);
    check(await p.evaluate(() => JSON.stringify(window.app.loopRange)) === JSON.stringify({ startSection: 0, startIndex: 0, endSection: 0, endIndex: 1 }), 'tirer sur la règle du premier au deuxième accord pose la plage à boucler sur eux');
    const bande = await p.evaluate(() => { const b = document.querySelector('#sq-grille .sq-boucle'); if (!b) return null; const r = b.getBoundingClientRect(), t = document.querySelector('#sq-grille .sq-temps[data-c="0"][data-k="0"]').getBoundingClientRect(); return { top: Math.round(r.top), tTop: Math.round(t.top), bg: getComputedStyle(b).backgroundImage }; });
    exiger(bande !== null, 'la bande orange est dessinée');
    check(bande.top === bande.tTop && /255, 179, 0, 0\.5/.test(bande.bg), 'elle est DANS la règle, au droit des numéros, orange translucide');
    check(await p.evaluate(() => window.app.bouclerLecture === true), 'tracer une plage allume la boucle (même règle que la règle des mesures)');
    await cliquer(p, '#sq-grille .sq-boucle');
    check(await p.evaluate(() => window.app.loopRange === null && !document.querySelector('#sq-grille .sq-boucle')), 'un clic sur la bande la retire');

    console.log('\n=== J. L\'édition ouverte ne réécrit pas le rythme posé au séquenceur ===');
    await ouvrirSon(p, 0, 3);
    exiger(await p.evaluate(() => window.app.editingIndex) === 3, 'double-clic sur G7 puis « Réglages du son » : l\'accord est en modification (motif vivant chargé)');
    await cliquer(p, '#sq-motif-descend');
    await p.keyboard.press('Escape'); await p.waitForTimeout(400);
    await p.mouse.click(700, 420); await p.waitForTimeout(400);
    const j3 = await croches(p, 3);
    check(j3.motif === 'descend' && j3.pos.join('|') === '0,1,2,3,4,5,6,7|3,7|2,6|1,5', `G7 garde Arpège ↓ après la fermeture de sa fenêtre (${j3.pos.join('|')})`);
    // Les intensités posées au séquenceur survivent à une retouche dans la fenêtre d'accord.
    await cliquer(p, '#sq-intensite');
    await cliquer(p, '#sq-grille .sq-nom[data-c="3"]');
    await cliquer(p, caseSq(3, j3.positions[3], 1));
    await cliquer(p, '#sq-intensite');
    const ivAvant = (await croches(p, 3)).iv;
    await ouvrirSon(p, 0, 3);
    // Une vraie retouche dans l'inspecteur (une octave plus haut) : le motif ne change pas, l'accord est réécrit depuis son édition vivante.
    await p.click('.control-card [aria-label="Monter d\'une octave"]'); await p.waitForTimeout(400);
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    await p.mouse.click(700, 420); await p.waitForTimeout(400);
    const j3b = await p.evaluate(() => String(loadProgressionSections()[0].chords[3].octave));
    exiger(j3b === '4', `l'octave a bien changé dans l'inspecteur (${j3b})`);
    check(ivAvant !== '{}' && (await croches(p, 3)).iv === ivAvant, `une retouche dans la fenêtre de l'accord garde ses intensités par voix (${ivAvant})`);
    await p.close();

    console.log('\n=== K. Accords de 3 et 5 notes, basse différente ===');
    p = await ouvrir({ width: 1440, height: 900 }, [{ title: 'Riches', chords: [mk('C', 'maj'), mk('C', 'maj9'), mk('C', 'maj7', { bass: 'D' }), mk('C', 'maj7', { inversion: 1 })] }],
        () => localStorage.setItem('harmohubSequenceurOuvert', '1'));
    exiger(await p.evaluate(() => !document.getElementById('sequenceur').hidden), 'ouvert au rechargement : l\'appareil se souvient du séquenceur ouvert');
    check(await p.evaluate(() => document.querySelectorAll('#sq-grille .sq-etiq').length) === 5, 'la partie affiche autant de lignes que son accord le plus riche (cinq voix)');
    check(await p.evaluate(() => document.querySelectorAll('#sq-grille .sq-case.sans-voix[style*="grid-row:3"]').length) >= 8, 'un accord plus pauvre laisse ses lignes du haut vides');
    await cliquer(p, '#sq-motif-monte');
    const k0 = await croches(p, 0), k1 = await croches(p, 1), k2 = await croches(p, 2), k3 = await croches(p, 3);
    check(k0.pos.join('|') === '0,1,2,3,4,5,6,7|1,2,5,6|3,7', `trois sons : la basse et l'aiguë gardées, les voix du milieu fondues (${k0.pos.join('|')})`);
    check(k1.pos.join('|') === '0,1,2,3,4,5,6,7|1,5|0,1,2,3,4,5,6,7|2,6|3,7', `cinq sons en arpège : la note en plus suit la basse (${k1.pos.join('|')})`);
    check(k2.basse === '0,1,2,3,4,5,6,7' && k2.positions[0] === 4 && k2.pos.slice(1).join('|') === '0,1,2,3,4,5,6,7|1,5|2,6|3,7', `basse différente : la voix la plus grave, au rythme de la basse ; le corps au-dessus (${k2.pos.join('|')})`);
    check(k3.roleGrave === 'third' && k3.pos.join('|') === '0,1,2,3,4,5,6,7|1,5|2,6|3,7', 'renversement : le rythme de la basse va à la note la plus grave (la tierce), pas à la fondamentale');
    await cliquer(p, '#sq-motif-pompe');
    const k1b = await croches(p, 1);
    check(k1b.pos[2] === '2,6', `cinq sons en Pompe (voix du haut ensemble) : la note en plus prend leur rythme commun (${k1b.pos[2]})`);
    await p.close();

    console.log('\n=== L. La poignée ne règle que la hauteur des lignes, sans jamais rien cacher ===');
    // Tire la poignée de `dy` px (négatif = vers le haut) et relève la place de chaque morceau.
    const tirer = async (p, dy) => {
        const pg = await centre(p, '#sq-poignee');
        await p.mouse.move(pg.x, pg.y); await p.mouse.down();
        await p.mouse.move(pg.x, pg.y + dy, { steps: 12 }); await p.mouse.up(); await p.waitForTimeout(300);
        return p.evaluate(() => {
            const s = document.getElementById('sequenceur').getBoundingClientRect(), haut = document.querySelector('.top-bar').getBoundingClientRect().bottom;
            const t = document.getElementById('vues-tiroir').getBoundingClientRect(), pg = document.getElementById('sq-poignee').getBoundingClientRect();
            const ligne = document.querySelector('#sq-grille .sq-case[data-v]').getBoundingClientRect().height;
            return { haut: s.top, bas: s.bottom, barre: haut, tiroir: t.top, poignee: pg.top, ligne, outils: document.querySelector('.sq-outils button').getBoundingClientRect().height, vh: innerHeight };
        });
    };
    const ouvrirHaut = (h) => ouvrir({ width: 1440, height: h }, PARTIE, () => { localStorage.setItem('harmohubSequenceurOuvert', '1'); localStorage.removeItem('harmohubSequenceurLigne'); });
    for (const h of [600, 700]) {
        p = await ouvrirHaut(h);
        const m = await tirer(p, -600);
        check(m.haut >= m.barre && m.bas <= m.tiroir + 1 && m.poignee >= m.barre && m.poignee < m.vh, `fenêtre de ${h} px : séquenceur entre la barre du haut et le tiroir, poignée atteignable (${Math.round(m.haut)}–${Math.round(m.bas)})`);
        await p.close();
    }
    // Écran trop court : six lignes réglées hautes (48 px, réglage de l'appareil) sur 600 px. Le séquenceur ne déborde pas : il défile en interne,
    // barre d'outils collée en haut.
    p = await ouvrir({ width: 1440, height: 600 }, [{ title: 'Riche', chords: [mk('C', 'maj9', { extraNotes: [{ note: 'F', octave: 5 }] }), mk('A', 'min7')] }],
        () => { localStorage.setItem('harmohubSequenceurOuvert', '1'); localStorage.setItem('harmohubSequenceurLigne', '48'); });
    const court = await p.evaluate(() => {
        const s = document.getElementById('sequenceur'), r = s.getBoundingClientRect(), t = document.getElementById('vues-tiroir').getBoundingClientRect();
        const haut = document.querySelector('.top-bar').getBoundingClientRect().bottom;
        return { lignes: document.querySelectorAll('#sq-grille .sq-etiq').length, deborde: s.scrollHeight > s.clientHeight + 4, haut: r.top, bas: r.bottom, tiroir: t.top, barre: haut };
    });
    check(court.lignes === 6 && court.deborde && court.haut >= court.barre && court.bas <= court.tiroir + 1, `600 px et six lignes de 48 : le séquenceur reste entre la barre du haut et le tiroir et défile en interne (${Math.round(court.haut)}–${Math.round(court.bas)})`);
    await p.evaluate(() => { document.getElementById('sequenceur').scrollTop = 9999; });
    await p.waitForTimeout(150);
    const colle = await p.evaluate(() => { const s = document.getElementById('sequenceur').getBoundingClientRect(), o = document.querySelector('.sq-outils').getBoundingClientRect(); return Math.round(o.top - s.top); });
    check(colle >= 0 && colle <= 2, `défilé jusqu'en bas, la barre d'outils reste collée en haut (${colle} px)`);
    await p.close();
    p = await ouvrirHaut(900);
    const outilsAvant = await p.evaluate(() => document.querySelector('.sq-outils button').getBoundingClientRect().height);
    let m = await tirer(p, -600);
    check(m.haut >= m.barre && m.bas <= m.tiroir + 1 && m.poignee >= m.barre && m.poignee < m.vh, `fenêtre de 900 px : séquenceur entre la barre du haut et le tiroir, poignée atteignable (${Math.round(m.haut)}–${Math.round(m.bas)})`);
    check(Math.round(m.ligne) === 48, `tirée tout en haut, les lignes s'arrêtent à 48 px (${m.ligne})`);
    check(m.outils === outilsAvant && m.outils === 32, 'la barre d\'outils garde ses boutons de 32 px');
    const q = await centre(p, '#sq-poignee');
    await p.mouse.dblclick(q.x, q.y); await p.waitForTimeout(300);
    check(Math.round(await p.evaluate(() => document.querySelector('#sq-grille .sq-case[data-v]').getBoundingClientRect().height)) === 30, 'double-clic sur la poignée : hauteur d\'origine (30 px)');
    m = await tirer(p, 300);
    check(Math.round(m.ligne) === 22, `tirée vers le bas, les lignes s'arrêtent à 22 px (${m.ligne})`);
    check(await p.evaluate(() => getComputedStyle(document.querySelector('#sq-grille .sq-note')).fontSize) === '0px', 'sous 24 px, les noms de notes disparaissent des cases');
    await p.close();

    console.log('\n=== M. La lecture allume la croche qui sonne ===');
    p = await ouvrir({ width: 1440, height: 900 }, PARTIE, () => localStorage.setItem('harmohubSequenceurOuvert', '1'));
    await cliquer(p, '#play-prog');
    const tete = await p.waitForFunction(() => document.querySelector('#sq-grille .sq-case.tete'), null, { timeout: 4000 }).then(() => true, () => false);
    check(tete, 'pendant la lecture, la colonne de la croche jouée s\'allume en vert');
    await cliquer(p, '#stop');
    check(await p.evaluate(() => !document.querySelector('#sq-grille .tete')), 'Stop éteint la tête de lecture du séquenceur');
    await cliquer(p, '#sq-fermer');
    check(await p.evaluate(() => document.getElementById('sequenceur').hidden) && await presse(p, 'vue-sequenceur') === 'false', '× ferme le séquenceur, le bouton du bloc « Vues » s\'éteint');
    await p.close();

    console.log('\n=== N. Le téléphone n\'a pas bougé ===');
    p = await ouvrir({ width: 390, height: 844 }, PARTIE, () => localStorage.setItem('harmohubSequenceurOuvert', '1'));
    const tel = await p.evaluate(() => ({ seq: getComputedStyle(document.getElementById('sequenceur')).display, bouton: getComputedStyle(document.getElementById('vue-sequenceur')).display }));
    check(tel.seq === 'none' && tel.bouton === 'none', `au téléphone : ni séquenceur ni bouton, même s'il était ouvert à l'ordinateur (${tel.seq}, ${tel.bouton})`);
    await p.close();

    check(erreurs.length === 0, 'aucune erreur JavaScript (' + (erreurs.join(' | ') || 'rien') + ')');
    await nav.close();
    bilan();
})();
