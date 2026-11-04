// L'AJOUT UNIQUE (refonte, lot 7a), avec de vrais gestes.
//
// CE QUE DEMANDE LA MAQUETTE VALIDÉE (docs/refonte.md) : « Ajouter : une seule saisie (syntaxe actuelle COMPLÈTE), accords de la tonalité, suggestions
// après l'accord précédent, « + » entre deux cases au survol ».
//
// CE QUE LE BANC TIENT : « + Accord » d'une partie et le « + » entre deux cases choisissent la DESTINATION ; le panneau la dit, propose les accords de
// la tonalité (triades ou 7e, avec leur degré) et les suites habituelles de l'accord précédent ; un clic ajoute là, d'UNE annulation, et la destination
// avance ; la saisie (même syntaxe) va au même endroit, sans redemander la partie ; Échap ou un clic à côté referment et oublient la destination — la
// saisie redevient exactement celle d'avant ; le téléphone n'a pas bougé (lot 10).
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('ajout unique');
const { estBruitReseau } = require('./_harness');

plan(29);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const graine = () => {
    const mk = (r, q, b = 4) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
    const S = [
        { title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7'), mk('D', 'min7'), mk('G', 'dom7')] },
        { title: 'Refrain', chords: [mk('F', 'maj7')] },
    ];
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
    const partie = (p, s) => p.evaluate((s) => loadProgressionSections()[s].chords.map(c => c.root + ':' + c.quality).join(' '), s);
    const panneau = (p) => p.evaluate(() => {
        const a = document.getElementById('ajout-aide');
        if (!a || a.hidden) return null;
        const lbls = [...a.querySelectorAll('.rr-lbl')].map(l => l.textContent);
        const tuiles = (sel) => [...a.querySelectorAll(sel)].map(t => t.querySelector('.ajout-t1').textContent + '/' + t.querySelector('.ajout-t2').textContent);
        return { lieu: a.querySelector('.ajout-lieu').textContent, lbls, palette: tuiles('.ajout-tuile:not(.ajout-tuile-sugg)'), sugg: tuiles('.ajout-tuile-sugg') };
    });
    // Le « + » entre deux cases : un VRAI appui de souris en son centre, après survol de la case.
    const plusEntre = async (p, i) => {
        await p.hover(`#progression-sections .chord-grid[data-section="0"] .grid-cell[data-index="${i}"]`); await p.waitForTimeout(150);
        const b = await p.locator(`#progression-sections .chord-grid[data-section="0"] .grid-cell[data-index="${i}"] .cell-ins`).boundingBox();
        await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await p.waitForTimeout(100);
        await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(300);
    };
    const tuile = async (p, txt) => { await p.click(`#ajout-aide .ajout-tuile:not(.ajout-tuile-sugg) >> text="${txt}"`); await p.waitForTimeout(300); };

    // ======================================================================================================
    console.log('\n=== A. « + Accord » : la destination, et ce qu\'on peut y mettre ===');
    let p = await ouvrir({ width: 1440, height: 900 });
    check(await p.evaluate(() => document.querySelectorAll('#progression-sections .prog-section-ajout').length) === 2, 'chaque partie a son « + Accord »');
    check(await panneau(p) === null, 'au départ, pas de panneau : taper dans la saisie reste comme avant');
    await p.click('#progression-sections .prog-section-ajout[data-section="0"]'); await p.waitForTimeout(300);
    let a = await panneau(p);
    exiger(!!a, '« + Accord » ouvre le panneau d\'ajout');
    check(a.lieu === 'Couplet, à la fin, après G7', `il dit OÙ l'on ajoute : « ${a.lieu} »`);
    check(await p.evaluate(() => document.activeElement && document.activeElement.id === 'quick-add-input'), 'et met le curseur dans la saisie, prête à taper');
    check(JSON.stringify(a.palette) === JSON.stringify(['C/I', 'Dm/ii', 'Em/iii', 'F/IV', 'G/V', 'Am/vi', 'Bdim/vii°']), `les accords de C majeur, avec leur degré : ${a.palette.join(' ')}`);
    check(JSON.stringify(a.sugg) === JSON.stringify(['C/I', 'Am/vi', 'F/IV']) && a.lbls[0] === 'Souvent après G7', `« ${a.lbls[0]} » : ${a.sugg.join(' ')} (V → I, vi, IV)`);
    await p.click('#ajout-aide [data-ajout="avec7"]'); await p.waitForTimeout(200);
    a = await panneau(p);
    check(JSON.stringify(a.palette.map(t => t.split('/')[0])) === JSON.stringify(['Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bm7b5']), `« avec 7e » : ${a.palette.map(t => t.split('/')[0]).join(' ')}`);
    await p.click('#ajout-aide [data-ajout="avec7"]'); await p.waitForTimeout(200);

    // ======================================================================================================
    console.log('\n=== B. Un clic ajoute, là, et la destination avance ===');
    await p.click('#ajout-aide .ajout-tuile-sugg >> text="Am"'); await p.waitForTimeout(300);
    check(await partie(p, 0) === 'C:maj7 A:min7 D:min7 G:dom7 A:min', `Am ajouté à la fin du couplet : ${await partie(p, 0)}`);
    a = await panneau(p);
    check(a && a.lieu === 'Couplet, à la fin, après Am' && JSON.stringify(a.sugg) === JSON.stringify(['F/IV', 'Dm/ii', 'G/V']), `le panneau reste ouvert et suit : « ${a && a.lieu} », suites ${a && a.sugg.join(' ')}`);
    check(await partie(p, 1) === 'F:maj7', 'le refrain n\'a pas bougé');
    await p.keyboard.press('Control+z'); await p.waitForTimeout(300);
    check(await partie(p, 0) === 'C:maj7 A:min7 D:min7 G:dom7', 'un Ctrl+Z retire cet ajout, et lui seul');

    // ======================================================================================================
    console.log('\n=== C. La saisie va au même endroit, sans redemander la partie ===');
    await p.click('#progression-sections .prog-section-ajout[data-section="1"]'); await p.waitForTimeout(300);
    check((await panneau(p)).lieu === 'Refrain, à la fin, après Fmaj7', 'le « + Accord » du refrain vise le refrain');
    await p.fill('#quick-add-input', 'Dm7/G7');
    await p.keyboard.press('Control+Enter'); await p.waitForTimeout(400);
    check(await p.evaluate(() => { const m = document.getElementById('section-picker-menu'); return !m || m.hidden; }), 'pas de « dans quelle partie ? » : la destination est connue');
    check(await partie(p, 1) === 'F:maj7 D:min7 G:dom7', `la syntaxe habituelle (« / » = un par mesure) part au refrain : ${await partie(p, 1)}`);
    check(await p.evaluate(() => document.getElementById('quick-add-input').value) === '', 'la saisie se vide, prête pour la suite');

    // ======================================================================================================
    console.log('\n=== D. « + » entre deux cases : ajouter avant un accord ===');
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    await plusEntre(p, 2);
    a = await panneau(p);
    exiger(!!a, 'le « + » entre deux cases ouvre le panneau');
    check(a.lieu === 'Couplet, avant Dm7 (après Am7)', `« ${a.lieu} »`);
    check(await p.evaluate(() => document.querySelector('#progression-sections .chord-grid[data-section="0"] .grid-cell[data-index="2"]').classList.contains('cible-ajout')), 'la case d\'après est marquée : on voit où ça va');
    await tuile(p, 'F');
    await tuile(p, 'G');
    check(await partie(p, 0) === 'C:maj7 A:min7 F:maj G:maj D:min7 G:dom7', `F puis G, l'un après l'autre, avant Dm7 : ${await partie(p, 0)}`);
    check((await panneau(p)).lieu === 'Couplet, avant Dm7 (après G)', `la destination a avancé : « ${(await panneau(p)).lieu} »`);
    await p.keyboard.press('Control+z'); await p.waitForTimeout(300);
    check(await partie(p, 0) === 'C:maj7 A:min7 F:maj D:min7 G:dom7', 'un Ctrl+Z par ajout');
    await p.keyboard.press('Control+z'); await p.waitForTimeout(300);
    // Le « + » est posé là même où se saisit la poignée gauche (tirer le bord, lot 5d) : un glissé parti de lui doit tirer le bord, pas ajouter.
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    await p.hover(`#progression-sections .chord-grid[data-section="0"] .grid-cell[data-index="2"]`); await p.waitForTimeout(150);
    const bp = await p.locator(`#progression-sections .chord-grid[data-section="0"] .grid-cell[data-index="2"] .cell-ins`).boundingBox();
    const col = await p.evaluate(() => { const g = document.querySelector('#progression-sections .chord-grid[data-section="0"]'); return g.getBoundingClientRect().width / (parseInt(g.dataset.beatsPerRow) || 16); });
    await p.mouse.move(bp.x + bp.width / 2, bp.y + bp.height / 2); await p.mouse.down();
    await p.mouse.move(bp.x + bp.width / 2 - col * 2.1, bp.y + bp.height / 2, { steps: 4 }); await p.waitForTimeout(150);
    await p.mouse.up(); await p.waitForTimeout(300);
    const durees = await p.evaluate(() => loadProgressionSections()[0].chords.map(c => c.beats).join(' '));
    check(durees === '4 2 6 4' && await panneau(p) === null, `glisser depuis le « + » tire le bord, comme avant, sans ouvrir l'ajout (durées ${durees})`);
    await p.keyboard.press('Control+z'); await p.waitForTimeout(300);

    // ======================================================================================================
    console.log('\n=== E. Échap, clic à côté : on referme, et on oublie la destination ===');
    await p.click('#progression-sections .prog-section-ajout[data-section="0"]'); await p.waitForTimeout(300);
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    check(await panneau(p) === null && await p.evaluate(() => !window.app._cibleAjout), 'Échap ferme le panneau et oublie la destination');
    check(await p.evaluate(() => document.querySelectorAll('#progression-sections .cible-ajout').length) === 0, 'plus aucune case marquée');
    await p.click('#progression-sections .prog-section-ajout[data-section="0"]'); await p.waitForTimeout(300);
    await p.mouse.click(1380, 760); await p.waitForTimeout(200);
    check(await panneau(p) === null, 'un clic à côté le ferme aussi');
    // Sans destination, la saisie redevient EXACTEMENT celle d'avant : avec deux parties, elle demande laquelle.
    await p.fill('#quick-add-input', 'E7');
    await p.click('#quick-add-btn'); await p.waitForTimeout(300);
    check(await p.evaluate(() => { const m = document.getElementById('section-picker-menu'); return !!m && !m.hidden; }), 'sans destination choisie, la saisie demande la partie, comme avant');
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);
    await p.close();

    // ======================================================================================================
    console.log('\n=== F. Le téléphone n\'a pas bougé (lot 10) ===');
    p = await ouvrir({ width: 390, height: 844 });
    const tel = await p.evaluate(() => ({ ajout: [...document.querySelectorAll('.prog-section-ajout')].filter(b => b.getBoundingClientRect().width > 0).length,
        ins: [...document.querySelectorAll('.cell-ins')].filter(b => b.getBoundingClientRect().width > 0).length }));
    check(tel.ajout === 0 && tel.ins === 0, `ni « + Accord » ni « + » entre les cases (${JSON.stringify(tel)})`);
    await p.close();

    check(erreurs.length === 0, `aucune erreur JavaScript (${erreurs.length ? erreurs.join(' | ') : 'aucune'})`);
    await nav.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
