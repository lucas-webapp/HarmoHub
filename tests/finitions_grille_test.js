// LES FINITIONS DE LA GRILLE (refonte, lot 5d), avec de vrais gestes.
//
// CE QUE DEMANDE LA MAQUETTE VALIDÉE (docs/refonte.md, « Grille (bureau) ») :
//   • « Voicing personnalisé : petite pastille ambre (infobulle), jamais le mot perso » ;
//   • « Durée : le bord droit d'une case se tire (poignée au survol, DURÉE AFFICHÉE, une seule annulation) ; Maj+flèches » ;
//   • « La case + de fin de ligne a la largeur d'une mesure, jamais tout l'espace restant » — elle est restée le petit carré demandé en août
//     (« je n'ai pas besoin de toute cette largeur pour cliquer », voir case_plus_test) : ce banc tient qu'elle ne dépasse JAMAIS une mesure.
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('finitions de la grille');
const { estBruitReseau } = require('./_harness');

plan(32);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const graine = () => {
    const mk = (r, q, b = 4, x = {}) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held', ...x });
    const chords = [
        mk('C', 'maj7', 4, { extraNotes: [{ note: 'D', octave: 5 }] }),
        mk('A', 'min7'),
        mk('D', 'min7', 4, { guitarLock: { frets: [-1, 5, 7, 5, 6, 5] } }),
        mk('G', '7', 2, { extraNotes: [{ note: 'A', octave: 5 }, { note: 'E', octave: 5 }], guitarLock: { frets: [3, 2, 0, 0, 0, 1] } }),
        mk('E', 'min7', 12, { extraNotes: [{ note: 'F#', octave: 5 }] }),   // coupée sur deux lignes en Normal (4 mesures par ligne)
    ];
    const S = [{ title: 'Couplet', chords }];
    localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), sections: S }]));
    localStorage.setItem('harmohubCurrentSongId', 's1');
    localStorage.setItem('myProgression', JSON.stringify({ sections: S }));
    sessionStorage.setItem('cc_accueil_vu', '1');
};

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    const p = await nav.newPage({ viewport: { width: 1440, height: 900 } });
    p.on('pageerror', e => erreurs.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) erreurs.push('console: ' + m.text()); });
    await p.goto(`${BASE}/index.html`);
    await p.evaluate(graine);
    await p.reload();
    await p.waitForTimeout(900);
    exiger(await p.evaluate(() => window.app.grilleDensite === 'normal'), 'le morceau s\'ouvre en Normal');

    // ======================================================================================================
    console.log('\n=== A. La pastille ambre du voicing personnalisé ===');
    const pastilles = () => p.evaluate(() => [...document.querySelectorAll('#progression-sections .grid-cell:not(.grid-cell-add)')].map(c => {
        const d = c.querySelector('.cell-perso');
        if (!d) return { i: +c.dataset.index, n: 0 };
        const r = d.getBoundingClientRect(), k = c.getBoundingClientRect(), cs = getComputedStyle(d);
        return { i: +c.dataset.index, n: c.querySelectorAll('.cell-perso').length, titre: d.title, l: Math.round(r.width), h: Math.round(r.height), rond: cs.borderRadius, fond: cs.backgroundColor,
            coin: r.top - k.top <= 10 && k.right - r.right <= 12 && r.right <= k.right && r.top >= k.top, texte: c.textContent };
    }));
    let pa = await pastilles();
    const de = (i) => pa.filter(x => x.i === i && x.n);
    check(de(0).length === 1 && /une note ajoutée à la main/.test(de(0)[0].titre), `notes ajoutées à la main : une pastille, l'infobulle dit pourquoi (« ${de(0)[0] && de(0)[0].titre} »)`);
    check(de(2).length === 1 && /doigté de guitare fixé/.test(de(2)[0].titre), `doigté de guitare fixé au cadenas : une pastille (« ${de(2)[0] && de(2)[0].titre} »)`);
    check(de(3).length === 1 && /2 notes ajoutées à la main, doigté de guitare fixé/.test(de(3)[0].titre), `les deux à la fois : une seule pastille, les deux raisons (« ${de(3)[0] && de(3)[0].titre} »)`);
    check(de(1).length === 0, 'un accord au voicing automatique n\'en a pas');
    const coupe = pa.filter(x => x.i === 4);
    check(coupe.length === 2 && coupe.filter(x => x.n).length === 1 && coupe[0].n === 1, `un accord coupé sur deux lignes : une seule pastille, sur son début (${coupe.map(x => x.n).join(' + ')})`);
    const une = de(0)[0];
    check(une.l === 6 && une.h === 6 && une.rond === '50%' && une.coin, `une petite pastille ronde de 6px dans le coin haut droit (${une.l}x${une.h}, ${une.rond})`);
    check(une.fond === 'rgb(224, 179, 106)', `ambre (${une.fond})`);
    check(pa.every(x => !/perso/i.test(x.texte)), 'jamais le mot « perso » dans une case');
    await p.click('#grille-densites [data-densite="compact"]'); await p.waitForTimeout(300);
    pa = await pastilles();
    check(pa.filter(x => x.n).length === 4, `en Compact (noms seuls) aussi : c'est une information sur le son, pas un détail (${pa.filter(x => x.n).length} pastilles)`);
    await p.click('#grille-densites [data-densite="normal"]'); await p.waitForTimeout(300);

    // ======================================================================================================
    console.log('\n=== B. La durée affichée pendant qu\'on étire ===');
    const bulle = (idx = 1) => p.evaluate((idx) => {
        const b = document.getElementById('duree-etirement');
        if (!b || b.hidden) return null;
        const r = b.getBoundingClientRect();
        const segs = [...document.querySelectorAll(`#progression-sections .grid-cell[data-index="${idx}"]`)];
        const k = segs[segs.length - 1].getBoundingClientRect();
        return { t: b.textContent, dessus: r.bottom <= k.top + 1, droite: Math.abs(r.right - k.right) <= 1, visible: r.width > 0 };
    }, idx);
    const poignee = await p.locator('.grid-cell[data-index="1"] .cell-resize-right').boundingBox();
    const col = await p.evaluate(() => { const g = document.querySelector('.chord-grid'); return g.getBoundingClientRect().width / (+g.dataset.beatsPerRow); });
    const x0 = poignee.x + poignee.width / 2, y0 = poignee.y + poignee.height / 2;
    await p.mouse.move(x0, y0); await p.mouse.down(); await p.waitForTimeout(100);
    let b = await bulle();
    check(b && b.t === '1 mesure', `dès la prise de la poignée, la durée s'affiche : « ${b && b.t} »`);
    await p.mouse.move(x0 + col * 1.1, y0); await p.waitForTimeout(150);
    b = await bulle();
    check(b && b.t === '1 mesure et 1 temps', `un temps de plus : « ${b && b.t} »`);
    await p.mouse.move(x0 + col * 4.1, y0, { steps: 3 }); await p.waitForTimeout(150);
    b = await bulle();
    check(b && b.t === '2 mesures', `une mesure de plus : « ${b && b.t} »`);
    check(b && b.dessus && b.droite, `au-dessus du bord droit de l'accord, qui a bougé avec lui (${JSON.stringify(b)})`);
    await p.mouse.up(); await p.waitForTimeout(200);
    check(await bulle() === null, 'relâchée, la bulle disparaît');
    check(await p.evaluate(() => loadProgressionSections()[0].chords[1].beats) === 8, 'et la durée est bien posée (8 temps)');
    await p.keyboard.press('Control+z'); await p.waitForTimeout(250);
    check(await p.evaluate(() => loadProgressionSections()[0].chords[1].beats) === 4, 'UNE seule annulation rend la durée d\'origine (tout le glissé d\'un coup)');

    // Bord gauche : c'est la durée de l'accord qu'on étire qui s'affiche (il prend des temps à son voisin).
    const gauche = await p.locator('.grid-cell[data-index="1"] .cell-resize-left').boundingBox();
    await p.mouse.move(gauche.x + gauche.width / 2, gauche.y + gauche.height / 2); await p.mouse.down();
    await p.mouse.move(gauche.x + gauche.width / 2 - col * 2.1, gauche.y + gauche.height / 2, { steps: 3 }); await p.waitForTimeout(150);
    b = await bulle();
    check(b && b.t === '1 mesure et 2 temps', `bord gauche tiré de deux temps : « ${b && b.t} » (l'accord étiré, pas son voisin)`);
    await p.mouse.up(); await p.waitForTimeout(200);
    await p.keyboard.press('Control+z'); await p.waitForTimeout(250);
    check(JSON.stringify(await p.evaluate(() => loadProgressionSections()[0].chords.slice(0, 2).map(c => c.beats))) === '[4,4]', 'annulé d\'un coup, les deux accords reprennent leur durée');

    // ======================================================================================================
    console.log('\n=== C. Maj+flèches ===');
    await p.click('.grid-cell[data-index="1"]'); await p.waitForTimeout(250);
    exiger(await p.evaluate(() => window.app.selectedIndex === 1 || window.app.editingIndex === 1), 'un clic sélectionne l\'accord');
    await p.keyboard.press('Shift+ArrowRight'); await p.waitForTimeout(150);
    b = await bulle();
    check(await p.evaluate(() => loadProgressionSections()[0].chords[1].beats) === 5 && b && b.t === '1 mesure et 1 temps', `Maj+→ : un temps de plus, et la durée s'affiche (« ${b && b.t} »)`);
    await p.keyboard.press('Shift+ArrowRight'); await p.waitForTimeout(150);
    b = await bulle();
    check(b && b.t === '1 mesure et 2 temps', `à chaque appui, la bulle suit (« ${b && b.t} »)`);
    await p.waitForTimeout(1400);
    check(await bulle() === null, 'une seconde après le dernier appui, elle s\'efface toute seule');
    for (let k = 0; k < 8; k++) await p.keyboard.press('Shift+ArrowLeft');
    await p.waitForTimeout(150);
    b = await bulle();
    check(await p.evaluate(() => loadProgressionSections()[0].chords[1].beats) === 1 && b && b.t === '1 temps', `Maj+← s'arrête à un temps (« ${b && b.t} »)`);
    await p.keyboard.press('Control+z'); await p.waitForTimeout(200);
    check(await p.evaluate(() => loadProgressionSections()[0].chords[1].beats) === 2, 'chaque appui est une annulation (Ctrl+Z : 1 → 2 temps)');
    // Un accord coupé sur deux lignes : la bulle se pose sur la FIN de l'accord (son dernier morceau, là où est le bord qu'on tire), pas sur son début.
    await p.click('.grid-cell[data-index="4"]'); await p.waitForTimeout(250);
    await p.keyboard.press('Shift+ArrowRight'); await p.waitForTimeout(150);
    const fin = await bulle(4);
    const nbSegs = await p.evaluate(() => document.querySelectorAll('#progression-sections .grid-cell[data-index="4"]').length);
    exiger(nbSegs === 2, `l'accord de 13 temps est bien coupé sur deux lignes (${nbSegs} morceaux)`);
    check(fin && fin.t === '3 mesures et 1 temps' && fin.droite && fin.dessus, `accord coupé : la bulle est au-dessus de son DERNIER morceau (${JSON.stringify(fin)})`);
    await p.keyboard.press('Control+z'); await p.waitForTimeout(200);

    // ======================================================================================================
    console.log('\n=== D. La durée en mots ===');
    const mots = await p.evaluate(() => [dureeEnMots(4, 4), dureeEnMots(8, 4), dureeEnMots(3, 4), dureeEnMots(6, 4), dureeEnMots(3, 3), dureeEnMots(5, 3), dureeEnMots(1, 4)]);
    check(JSON.stringify(mots) === JSON.stringify(['1 mesure', '2 mesures', '3 temps', '1 mesure et 2 temps', '1 mesure', '1 mesure et 2 temps', '1 temps']),
        `mesures et temps, selon la mesure du morceau (4/4, 3/4) : ${JSON.stringify(mots)}`);

    // ======================================================================================================
    console.log('\n=== E. La case « + » ne dépasse jamais une mesure ===');
    for (const d of ['compact', 'normal', 'detail']) {
        await p.click(`#grille-densites [data-densite="${d}"]`); await p.waitForTimeout(300);
        const m = await p.evaluate(() => {
            const g = document.querySelector('.chord-grid'), plus = g.querySelector('.grid-cell-add').getBoundingClientRect();
            const mesure = g.getBoundingClientRect().width / (+g.dataset.beatsPerRow) * window.app.beatsPerBar();
            return { plus: Math.round(plus.width), mesure: Math.round(mesure) };
        });
        check(m.plus <= m.mesure && m.plus >= 24, `${d} : la case « + » fait ${m.plus}px, une mesure fait ${m.mesure}px`);
    }
    // Une partie avec un seul accord : beaucoup de place libre sur la ligne, la case ne la prend pas.
    await p.evaluate(() => { const s = loadProgressionSections(); s.push({ title: 'Pont', chords: [{ ...s[0].chords[1], beats: 4 }] }); saveProgressionSections(s); window.app.loadProgression(); });
    await p.click('#grille-densites [data-densite="normal"]'); await p.waitForTimeout(300);
    const libre = await p.evaluate(() => {
        const g = document.querySelectorAll('.chord-grid')[1], plus = g.querySelector('.grid-cell-add').getBoundingClientRect(), gr = g.getBoundingClientRect();
        return { plus: Math.round(plus.width), reste: Math.round(gr.right - plus.left), mesure: Math.round(gr.width / (+g.dataset.beatsPerRow) * window.app.beatsPerBar()) };
    });
    check(libre.plus <= libre.mesure && libre.plus < libre.reste / 2, `trois mesures libres sur la ligne : la case en prend ${libre.plus}px sur ${libre.reste}px (une mesure : ${libre.mesure}px)`);

    check(erreurs.length === 0, `aucune erreur JavaScript (${erreurs.length ? erreurs.join(' | ') : 'aucune'})`);
    await nav.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
