// LES NOTES DU SÉQUENCEUR : DEUX NOTES VOISINES NE FONT PAS UNE NOTE TENUE, UNE NOTE LONGUE SE SUPPRIME EN ENTIER, ON LA SCINDE AU CLIC DROIT (12/11), avec de vrais gestes.
//
// LE RETOUR (séquenceur du téléphone, « comme avant » : le défaut existait déjà dans l'ancien séquenceur) :
//   - « 2 notes créées côte à côte = une note longue de 2 temps au lieu de 2 temps staccato. 2 notes consécutives ne doivent pas constituer une note tenue. »
//   - « Il est difficile de supprimer une note longue : elle se scinde en plusieurs notes au lieu de se supprimer complètement. Si je veux scinder : clic droit / scinder la note. »
// Avant : une croche posée à côté d'une autre s'y soudait (poserCroche), et en enlever une coupait la barre en deux.
//
// CE QUE LE BANC TIENT : un clic pose UNE croche qui reste une attaque à part, même collée à une autre (les données ET la lecture : la case suivante n'est pas liée) ; un
// glissé peint UNE note tenue (dans les deux sens, en sautant des cases), sans souder la note déjà là au bout du trait ; un clic sur n'importe quelle croche d'une note longue
// la supprime en entier (une annulation la rend), un glissé qui part d'une note aussi ; le clic droit sur une note ouvre son menu — Scinder la note (grisé sur une attaque),
// Prolonger d'une croche (grisé sans place), Supprimer la note — chaque action sous une seule annulation, Échap et le clic à côté le ferment ; un clic droit à vide n'en ouvre pas.
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('notes du séquenceur');
const { estBruitReseau } = require('./_harness');

plan(31);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const mk = (r, q) => ({ root: r, quality: q, beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
const PARTIE = [{ title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7')] }];
const graine = (S) => {
    localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), sections: S }]));
    localStorage.setItem('harmohubCurrentSongId', 's1');
    localStorage.setItem('myProgression', JSON.stringify({ sections: S }));
    sessionStorage.setItem('cc_accueil_vu', '1');
};

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    const ouvrir = async () => {
        const p = await nav.newPage({ viewport: { width: 1440, height: 900 } });
        p.on('pageerror', e => erreurs.push(e.message));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) erreurs.push('console: ' + m.text()); });
        await p.goto(`${BASE}/index.html`);
        await p.evaluate(graine, PARTIE);
        await p.reload();
        await p.waitForTimeout(900);
        return p;
    };
    // Lecture de l'état (jamais pour agir) : les croches de chaque position, les soudures, et la lecture (la case suivante est-elle liée ?).
    const etat = (p, c = 0) => p.evaluate((c) => {
        const d = loadProgressionSections()[0].chords[c];
        const e = SequenceurHarmo.lireAccord(d);
        const par = (v) => { const r = []; for (let k = 0; k < e.info.croches; k++) if (e.on.has(v + ':' + k)) r.push(k); return r.join(','); };
        const lect = window.app.resolveSeqPatternForData(SequenceurHarmo.voixDe(d).chord, d);
        const v0 = e.info.positions[0];
        return { pos: e.info.positions.map(par), soude: [...e.soude].filter(x => x.startsWith(v0 + ':')).map(x => +x.split(':')[1]).sort((a, b) => a - b).join(','),
                 positions: e.info.positions, lie: [0, 1, 2, 3, 4, 5, 6, 7].map(k => (lect.tie[2 * k] || []).includes(v0) ? 1 : 0).join('') };
    }, c);
    const caseSq = (c, v, k) => `#sq-grille .sq-case[data-c="${c}"][data-v="${v}"][data-k="${k}"]`;
    const centre = async (p, sel) => { const b = await p.locator(sel).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
    const cliquer = async (p, sel, bouton = 'left') => { const q = await centre(p, sel); await p.mouse.click(q.x, q.y, { button: bouton }); await p.waitForTimeout(250); };
    const glisser = async (p, de, vers, pas = 6) => {
        const a = await centre(p, de), b = await centre(p, vers);
        await p.mouse.move(a.x, a.y); await p.mouse.down();
        for (let i = 1; i <= pas; i++) await p.mouse.move(a.x + (b.x - a.x) * i / pas, a.y, { steps: 2 });
        await p.mouse.up(); await p.waitForTimeout(300);
    };
    const ctrlZ = async (p) => { await p.keyboard.press('Control+z'); await p.waitForTimeout(300); };
    const menu = (p) => p.evaluate(() => {
        const m = document.getElementById('sq-menu-note');
        return m.hidden ? null : Object.fromEntries([...m.querySelectorAll('button')].map(b => [b.dataset.sqActe, !b.disabled]));
    });
    const demarrer = async () => {
        const p = await ouvrir();
        await cliquer(p, '#vue-sequenceur');
        await cliquer(p, '#sq-grille .sq-nom[data-c="0"]');
        return p;
    };

    // ======================================================================================================
    console.log('\n=== A. Deux notes voisines = deux attaques, pas une note tenue ===');
    let p = await demarrer();
    let e = await etat(p);
    const vB = e.positions[0]; // la voix la plus grave
    exiger(e.pos[0] === '0,1,2,3,4,5,6,7' && e.soude === '1,2,3,4,5,6,7', 'au départ, l\'accord est « Plaqué » : une longue note par voix (croches soudées)');
    await cliquer(p, '#sq-effacer');
    exiger((await etat(p)).pos.every(x => x === ''), '« Effacer » vide le rythme de l\'accord');
    await cliquer(p, caseSq(0, vB, 1));
    await cliquer(p, caseSq(0, vB, 2));
    e = await etat(p);
    check(e.pos[0] === '1,2', `deux clics côte à côte posent deux croches (${e.pos[0]})`);
    check(e.soude === '', `elles ne sont PAS soudées : deux notes, pas une note tenue (soudures « ${e.soude} »)`);
    check(e.lie.charAt(2) === '0', `et la lecture les joue en deux attaques : la case de la seconde n'est pas liée (${e.lie})`);
    check(await p.evaluate(() => document.querySelectorAll('#sq-grille .sq-case[data-c="0"].soude-g, #sq-grille .sq-case[data-c="0"].soude-d').length) === 0, 'elles se dessinent en deux plots séparés, pas en une barre');
    await cliquer(p, caseSq(0, vB, 3));
    check((await etat(p)).soude === '', 'une troisième croche de plus, toujours rien de soudé');
    await p.context().close();

    // ======================================================================================================
    console.log('\n=== B. Un glissé peint UNE note tenue ===');
    p = await demarrer();
    await cliquer(p, '#sq-effacer');
    const v1 = (await etat(p)).positions[0];
    await glisser(p, caseSq(0, v1, 2), caseSq(0, v1, 5));
    e = await etat(p);
    check(e.pos[0] === '2,3,4,5' && e.soude === '3,4,5', `de la croche 3 à la 6 : une note tenue de quatre croches (${e.pos[0]}, soudures ${e.soude})`);
    await ctrlZ(p);
    check((await etat(p)).pos[0] === '', 'un seul Ctrl+Z défait tout le glissé');
    await glisser(p, caseSq(0, v1, 6), caseSq(0, v1, 3));
    e = await etat(p);
    check(e.pos[0] === '3,4,5,6' && e.soude === '4,5,6', `le glissé de droite à gauche donne la même note tenue (${e.pos[0]}, soudures ${e.soude})`);
    await ctrlZ(p);
    // Un pointeur rapide saute des cases : celles du milieu sont peintes aussi.
    { const a = await centre(p, caseSq(0, v1, 0)), b = await centre(p, caseSq(0, v1, 4));
      await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(b.x, b.y, { steps: 1 }); await p.mouse.up(); await p.waitForTimeout(300); } // UN seul évènement de mouvement : trois cases sautées
    e = await etat(p);
    check(e.pos[0] === '0,1,2,3,4' && e.soude === '1,2,3,4', `un glissé rapide ne laisse pas de trou (${e.pos[0]})`);
    await ctrlZ(p);
    // Le bout du trait ne soude pas la note qui était déjà là, juste à côté.
    await cliquer(p, caseSq(0, v1, 6));
    await glisser(p, caseSq(0, v1, 2), caseSq(0, v1, 5));
    e = await etat(p);
    check(e.pos[0] === '2,3,4,5,6' && e.soude === '3,4,5', `la note déjà posée en 7 n'est pas soudée au bout du trait (${e.pos[0]}, soudures ${e.soude})`);
    await p.context().close();

    // ======================================================================================================
    console.log('\n=== C. Une note longue se supprime en entier ===');
    p = await demarrer();
    e = await etat(p);
    const v2 = e.positions[0];
    await cliquer(p, caseSq(0, v2, 3));
    e = await etat(p);
    check(e.pos[0] === '' && e.pos[1] === '0,1,2,3,4,5,6,7', `un clic sur la croche 4 d'une note de huit croches l'enlève EN ENTIER (${e.pos[0]}), les autres voix ne bougent pas`);
    await ctrlZ(p);
    e = await etat(p);
    check(e.pos[0] === '0,1,2,3,4,5,6,7' && e.soude === '1,2,3,4,5,6,7', 'une annulation rend la note tenue, soudures comprises');
    await glisser(p, caseSq(0, v2, 6), caseSq(0, v2, 4), 4);
    check((await etat(p)).pos[0] === '', 'un glissé qui part d\'une note enlève la note touchée en entier, pas seulement les croches traversées');
    await p.context().close();

    // ======================================================================================================
    console.log('\n=== D. Clic droit sur une note : Scinder la note, Prolonger, Supprimer ===');
    p = await demarrer();
    e = await etat(p);
    const v3 = e.positions[0];
    await cliquer(p, caseSq(0, v3, 3), 'right');
    let m = await menu(p);
    exiger(m !== null, 'le clic droit sur une note ouvre son menu');
    check(m.scinder === true && m.supprimer === true && m.prolonger === false, `trois actions : Scinder la note, Supprimer la note, et Prolonger grisé (rien après la dernière croche) — ${JSON.stringify(m)}`);
    await p.click('#sq-menu-note [data-sq-acte="scinder"]'); await p.waitForTimeout(300);
    e = await etat(p);
    check(e.pos[0] === '0,1,2,3,4,5,6,7' && e.soude === '1,2,4,5,6,7', `« Scinder la note » : la croche 4 devient l'attaque d'une seconde note, rien n'est enlevé (soudures ${e.soude})`);
    check(await menu(p) === null, 'le menu se referme après l\'action');
    await ctrlZ(p);
    check((await etat(p)).soude === '1,2,3,4,5,6,7', 'une seule annulation recolle la note');
    await cliquer(p, caseSq(0, v3, 0), 'right');
    m = await menu(p);
    check(m !== null && m.scinder === false, 'sur l\'attaque d\'une note, « Scinder la note » est grisé (il n\'y a rien à scinder)');
    await p.keyboard.press('Escape'); await p.waitForTimeout(250);
    check(await menu(p) === null, 'Échap ferme le menu');
    await cliquer(p, caseSq(0, v3, 5), 'right');
    exiger(await menu(p) !== null, 'rouvert');
    await p.mouse.click(700, 150); await p.waitForTimeout(300);
    check(await menu(p) === null, 'un clic à côté ferme le menu');

    await cliquer(p, '#sq-effacer');
    await cliquer(p, caseSq(0, v3, 2));
    await cliquer(p, caseSq(0, v3, 2), 'right');
    m = await menu(p);
    check(m !== null && m.prolonger === true && m.scinder === false, 'une croche seule : on peut la prolonger, pas la scinder');
    await p.click('#sq-menu-note [data-sq-acte="prolonger"]'); await p.waitForTimeout(300);
    e = await etat(p);
    check(e.pos[0] === '2,3' && e.soude === '3', `« Prolonger d'une croche » : la note tient une croche de plus (${e.pos[0]}, soudures ${e.soude})`);
    await cliquer(p, caseSq(0, v3, 3), 'right');
    await p.click('#sq-menu-note [data-sq-acte="prolonger"]'); await p.waitForTimeout(300);
    check((await etat(p)).pos[0] === '2,3,4', 'depuis n\'importe quelle croche de la note, encore une croche');
    await cliquer(p, caseSq(0, v3, 3), 'right');
    await p.click('#sq-menu-note [data-sq-acte="supprimer"]'); await p.waitForTimeout(300);
    check((await etat(p)).pos[0] === '', '« Supprimer la note » enlève la note entière');
    await ctrlZ(p);
    check((await etat(p)).pos[0] === '2,3,4', 'une annulation la rend');
    await cliquer(p, caseSq(0, v3, 7), 'right');
    check(await menu(p) === null, 'un clic droit sur une case vide n\'ouvre pas de menu');
    await p.context().close();

    check(erreurs.length === 0, `aucune erreur de page${erreurs.length ? ' : ' + erreurs.slice(0, 3).join(' | ') : ''}`);
    await nav.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
