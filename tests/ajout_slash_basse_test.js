// LA RÈGLE DU « // » ET LA BASSE QUI SONNE (retour de l'utilisateur du 15/11, deux défauts vus dans l'ancienne version).
//
// SES MOTS : « L'entrée rapide Bbadd9/C a été comprise comme deux accords consécutifs en ajout rapide. On s'était mis d'accord sur la règle du // pour changer d'accord. »
// et « L'ajout de la basse (C) n'a pas été comprise par l'appli : pas de C mis à la basse. » (le séquenceur montrait la ligne C3, mais aucune croche allumée dessus).
//
// CE QUE LE BANC TIENT, avec de vrais gestes (taper dans le « + » ou dans l'ajout rapide, Entrée, la fenêtre d'accord, le sélecteur de basse) :
//   1. « Bbadd9/C » est UN accord (Bbadd9, basse C) ; « // » change d'accord ; l'ancienne liste « C/Am/F/G » marche encore ; « Dm7/F//G7 » mêle les deux ;
//   2. la retape du nom d'une case comprend aussi « Dm7/F » ;
//   3. une basse AJOUTÉE à un accord qui suit un rythme (Plaqué, Monte, À la main) SONNE : sa ligne a des croches allumées — par l'onglet Accord ET par le sélecteur de l'onglet Voicing ;
//   4. le téléphone n'a pas bougé : taper « Bbadd9/C » dans son panneau d'ajout donne le même accord.
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('règle du // et basse qui sonne');
const { estBruitReseau } = require('./_harness');
const { dblclickHorsNom } = require('./_geste_accord');
const { ajouterAccord } = require('./_ajout');

plan(27);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const graine = () => {
    const mk = (r, q, b = 4) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
    const S = [{ title: 'Couplet', chords: [mk('A#', 'maj7')] }];
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
    const accords = (p) => p.evaluate(() => loadProgressionSections()[0].chords.map(c => `${c.root}:${c.quality}${c.bass ? '/' + c.bass : ''}(${c.beats})`).join(' '));
    const vider = async (p) => { await p.evaluate(() => { const s = loadProgressionSections(); s[0].chords = []; saveProgressionSections(s); window.app.loadProgression(); }); await p.waitForTimeout(250); };
    // Les croches allumées de chaque voix du premier accord, relues dans le modèle du séquenceur (c'est ce que montre le séquenceur, ligne par ligne).
    const croches = (p) => p.evaluate(() => {
        const d = loadProgressionSections()[0].chords[0], e = SequenceurHarmo.lireAccord(d);
        const par = {};
        e.on.forEach(k => { const v = k.split(':')[0]; par[v] = (par[v] || 0) + 1; });
        return { basse: e.info.basse, voix: e.info.voix.length, bassesAllumees: e.info.basse != null ? (par[e.info.basse] || 0) : null, autres: Object.keys(par).length };
    });

    // ======================================================================================================
    console.log('\n=== A. Saisie dans le « + » : « / » = basse, « // » = autre accord ===');
    let p = await ouvrir({ width: 1440, height: 900 });
    await vider(p);
    await ajouterAccord(p, 'Bbadd9/C'); await p.waitForTimeout(300);
    check(await accords(p) === 'A#:add9/C(4)', `« Bbadd9/C » est UN accord, basse C (${await accords(p)})`);
    await vider(p);
    await ajouterAccord(p, 'C//Am//F'); await p.waitForTimeout(300);
    check(await accords(p) === 'C:maj(4) A:min(4) F:maj(4)', `« C//Am//F » : trois accords, un par mesure (${await accords(p)})`);
    await vider(p);
    await ajouterAccord(p, 'Dm7/F//G7'); await p.waitForTimeout(300);
    check(await accords(p) === 'D:min7/F(4) G:dom7(4)', `« Dm7/F//G7 » : un accord sur basse PUIS un autre accord (${await accords(p)})`);
    await vider(p);
    await ajouterAccord(p, 'C/Am/F/G'); await p.waitForTimeout(300);
    check(await accords(p) === 'C:maj(4) A:min(4) F:maj(4) G:maj(4)', `l'ancienne liste « C/Am/F/G » marche encore (${await accords(p)})`);
    await vider(p);
    await ajouterAccord(p, 'C/G'); await p.waitForTimeout(300);
    check(await accords(p) === 'C:maj/G(4)', `« C/G » : C sur G, un seul accord — pour deux accords on écrit C//G (${await accords(p)})`);
    await vider(p);
    await ajouterAccord(p, 'Em7_B'); await p.waitForTimeout(300);
    check(await accords(p) === 'E:min7/B(4)', `la notation « _ » de la basse marche toujours (${await accords(p)})`);
    await vider(p);
    await ajouterAccord(p, 'C/Zz'); await p.waitForTimeout(300);
    check(await accords(p) === '', `« C/Zz » n'est pas un accord : rien n'est ajouté (${await accords(p)})`);

    // ======================================================================================================
    console.log('\n=== B. L\'ajout rapide (la saisie sous la rangée de réglages) ===');
    await vider(p);
    await p.evaluate(() => window.app.ouvrirAideAjout(0, null)); await p.waitForTimeout(300);
    await p.fill('#quick-add-input', 'Bbadd9/C'); await p.click('#quick-add-btn'); await p.waitForTimeout(400);
    check(await accords(p) === 'A#:add9/C(4)', `ajout rapide : « Bbadd9/C » est un accord (${await accords(p)})`);
    await p.fill('#quick-add-input', 'Fmaj7//Dm7/F'); await p.click('#quick-add-btn'); await p.waitForTimeout(400);
    check(await accords(p) === 'A#:add9/C(4) F:maj7(4) D:min7/F(4)', `ajout rapide : « Fmaj7//Dm7/F » ajoute deux accords (${await accords(p)})`);
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);

    // ======================================================================================================
    console.log('\n=== C. Retaper le nom d\'une case ===');
    await vider(p);
    await ajouterAccord(p, 'Dm7'); await p.waitForTimeout(300);
    await p.click('#progression-sections .grid-cell[data-index="0"]'); await p.waitForTimeout(250);
    await p.keyboard.type('d'); await p.waitForTimeout(250); // une lettre tapée sur l'accord choisi ouvre la retape (lettre de note)
    const champ = await p.evaluate(() => { const i = document.querySelector('.cell-sym-input'); return i ? i.value : null; });
    exiger(champ !== null, 'la retape du nom est ouverte par une lettre tapée');
    await p.keyboard.press('Control+a'); await p.keyboard.type('Dm7/F'); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
    check(await accords(p) === 'D:min7/F(4)', `retaper « Dm7/F » donne Dm7 avec F à la basse (${await accords(p)})`);
    // Même geste sur un accord qui SUIT UN RYTHME enregistré (Pompe) : la basse neuve sonne, avec le rythme de la basse du motif.
    await vider(p);
    await ajouterAccord(p, 'Dm7'); await p.waitForTimeout(300);
    await p.evaluate(() => { const s = loadProgressionSections(), d = s[0].chords[0]; SequenceurHarmo.ecrireAccord(d, SequenceurHarmo.etatAvecMotif(SequenceurHarmo.lireAccord(d), SequenceurHarmo.motifParId('pompe'))); d.motifSeq = 'pompe'; saveProgressionSections(s); window.app.loadProgression(); });
    await p.waitForTimeout(300);
    await p.click('#progression-sections .grid-cell[data-index="0"]'); await p.waitForTimeout(250);
    await p.keyboard.type('d'); await p.waitForTimeout(250);
    await p.keyboard.press('Control+a'); await p.keyboard.type('Dm7/F'); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
    const pompe = await p.evaluate(() => {
        const d = loadProgressionSections()[0].chords[0], e = SequenceurHarmo.lireAccord(d);
        const attendu = SequenceurHarmo.etatAvecMotif(SequenceurHarmo.lireAccord({ ...d, arpPattern: '', seqEdited: false }), SequenceurHarmo.motifParId('pompe'));
        return { bass: d.bass, pareil: [...e.on].sort().join() === [...attendu.on].sort().join(), basse: e.info.basse, nBasse: [...e.on].filter(k => k.split(':')[0] == e.info.basse).length };
    });
    check(pompe.bass === 'F' && pompe.pareil && pompe.nBasse > 0, `retape d'un accord au rythme Pompe : la basse F sonne et tout le rythme est celui du motif sur les voix neuves (${JSON.stringify(pompe)})`);

    // ======================================================================================================
    console.log('\n=== D. Une basse AJOUTÉE sonne, quel que soit le rythme de l\'accord ===');
    await p.close();
    p = await ouvrir({ width: 1440, height: 900 });
    await p.click('#vue-sequenceur'); await p.waitForTimeout(600);
    for (const [motif, nom] of [['plaque', 'Plaqué'], ['monte', 'Monte']]) {
        await p.evaluate(() => { const s = loadProgressionSections(); const d = s[0].chords[0]; d.bass = null; delete d.motifSeq; delete d.arpPattern; d.seqEdited = false; saveProgressionSections(s); window.app.loadProgression(); });
        await p.waitForTimeout(300);
        await dblclickHorsNom(p, '#progression-sections .grid-cell[data-index="0"]'); await p.waitForTimeout(350);
        await p.click(`#sq-motif-${motif}`); await p.waitForTimeout(400);
        const avant = await croches(p);
        exiger(avant.basse === null && avant.autres === 4, `${nom} : quatre voix allumées, pas de basse (${JSON.stringify(avant)})`);
        // Par l'onglet Accord de la fenêtre : la basse C.
        await p.click('#bulle-accord [data-bulle="onglet"][data-valeur="accord"]'); await p.waitForTimeout(250);
        await p.click('#bulle-accord [data-bulle="bass"][data-valeur="C"]'); await p.waitForTimeout(500);
        const apres = await croches(p);
        check(apres.basse != null && apres.bassesAllumees > 0 && apres.autres === 5, `${nom} + basse C par l'onglet Accord : la ligne de la basse a des croches allumées (${JSON.stringify(apres)})`);
        // Par le sélecteur de basse de l'onglet Voicing : retirer puis remettre la basse.
        await p.click('#bulle-accord [data-bulle="onglet"][data-valeur="voicing"]'); await p.waitForTimeout(400);
        await p.selectOption('#bass', ''); await p.waitForTimeout(400);
        check((await croches(p)).basse === null, `${nom} : la basse retirée par l'onglet Voicing ne laisse plus de voix de basse`);
        await p.selectOption('#bass', 'E'); await p.waitForTimeout(500);
        const voicing = await croches(p);
        check(voicing.basse != null && voicing.bassesAllumees > 0, `${nom} + basse E par le sélecteur de l'onglet Voicing : elle sonne aussi (${JSON.stringify(voicing)})`);
        await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    }
    // « À la main » : la basse reprend le rythme de la voix la plus grave de l'accord.
    // (le motif Plaqué est écrit sur les quatre voix, puis le chord « oublie » son nom de motif : un rythme à la main dont la basse n'a pas de croche)
    await p.evaluate(() => { const s = loadProgressionSections(); const d = s[0].chords[0]; d.bass = null; delete d.motifSeq; delete d.arpPattern; d.seqEdited = false; saveProgressionSections(s); window.app.loadProgression(); });
    await p.waitForTimeout(300);
    await dblclickHorsNom(p, '#progression-sections .grid-cell[data-index="0"]'); await p.waitForTimeout(350);
    await p.click('#sq-motif-plaque'); await p.waitForTimeout(400);
    await p.evaluate(() => { const s = loadProgressionSections(); delete s[0].chords[0].motifSeq; saveProgressionSections(s); window.app.loadProgression(); });
    await p.waitForTimeout(300);
    exiger(await p.evaluate(() => SequenceurHarmo.motifActuel(loadProgressionSections()[0].chords[0]) === 'main'), 'l\'accord est « à la main » (rythme écrit, sans nom de motif)');
    await dblclickHorsNom(p, '#progression-sections .grid-cell[data-index="0"]'); await p.waitForTimeout(350);
    await p.click('#bulle-accord [data-bulle="onglet"][data-valeur="accord"]'); await p.waitForTimeout(250);
    await p.click('#bulle-accord [data-bulle="bass"][data-valeur="C"]'); await p.waitForTimeout(500);
    const main = await croches(p);
    check(main.basse != null && main.bassesAllumees > 0, `rythme « à la main » : la basse neuve reprend le rythme de la voix la plus grave (${JSON.stringify(main)})`);
    // Ctrl+Z : tout revient d'un coup (une annulation par fenêtre).
    await p.keyboard.press('Control+z'); await p.waitForTimeout(400);
    check((await croches(p)).basse === null, 'Ctrl+Z retire la basse, rythme compris (une annulation par fenêtre)');

    // Un rythme NOMMÉ aux voix qui ne se ressemblent pas (Pompe) : la basse neuve prend la basse du motif, le corps se range au-dessus — pas une simple copie de la voix grave.
    await p.evaluate(() => { const s = loadProgressionSections(), d = s[0].chords[0]; d.bass = null; delete d.arpPattern; d.seqEdited = false; saveProgressionSections(s); SequenceurHarmo.ecrireAccord(d, SequenceurHarmo.etatAvecMotif(SequenceurHarmo.lireAccord(d), SequenceurHarmo.motifParId('pompe'))); d.motifSeq = 'pompe'; saveProgressionSections(s); window.app.loadProgression(); });
    await p.waitForTimeout(300);
    await dblclickHorsNom(p, '#progression-sections .grid-cell[data-index="0"]'); await p.waitForTimeout(350);
    await p.click('#bulle-accord [data-bulle="onglet"][data-valeur="accord"]'); await p.waitForTimeout(250);
    await p.click('#bulle-accord [data-bulle="bass"][data-valeur="C"]'); await p.waitForTimeout(500);
    const pompe2 = await p.evaluate(() => {
        const d = loadProgressionSections()[0].chords[0], e = SequenceurHarmo.lireAccord(d);
        const attendu = SequenceurHarmo.etatAvecMotif(SequenceurHarmo.lireAccord({ ...d, arpPattern: '', seqEdited: false }), SequenceurHarmo.motifParId('pompe'));
        return { pareil: [...e.on].sort().join() === [...attendu.on].sort().join(), nBasse: [...e.on].filter(k => k.split(':')[0] == e.info.basse).length };
    });
    check(pompe2.pareil && pompe2.nBasse > 0, `rythme Pompe + basse C par la fenêtre : le rythme est celui du motif sur les voix neuves (${JSON.stringify(pompe2)})`);
    // Même défaut, autre voix neuve : un TYPE plus riche (maj7 → maj9) sur un accord au rythme Plaqué : la 9e ne reste pas muette.
    await p.evaluate(() => { const s = loadProgressionSections(), d = s[0].chords[0]; d.bass = null; d.quality = 'maj7'; delete d.arpPattern; d.seqEdited = false; saveProgressionSections(s); SequenceurHarmo.ecrireAccord(d, SequenceurHarmo.etatAvecMotif(SequenceurHarmo.lireAccord(d), SequenceurHarmo.motifParId('plaque'))); d.motifSeq = 'plaque'; saveProgressionSections(s); window.app.loadProgression(); });
    await p.waitForTimeout(300);
    await dblclickHorsNom(p, '#progression-sections .grid-cell[data-index="0"]'); await p.waitForTimeout(350);
    await p.click('#bulle-accord [data-bulle="onglet"][data-valeur="accord"]'); await p.waitForTimeout(250);
    await p.click('#bulle-accord [data-bulle="quality"][data-valeur="maj9"]'); await p.waitForTimeout(500);
    const neuvieme = await croches(p);
    check(neuvieme.voix === 5 && neuvieme.autres === 5, `Plaqué + type maj9 : les cinq voix sonnent, la 9e aussi (${JSON.stringify(neuvieme)})`);
    await p.close();

    // ======================================================================================================
    console.log('\n=== E. Le téléphone n\'a pas bougé ===');
    p = await ouvrir({ width: 390, height: 844 }, { hasTouch: true, isMobile: true });
    await vider(p);
    await ajouterAccord(p, 'Bbadd9/C'); await p.waitForTimeout(400);
    check(await accords(p) === 'A#:add9/C(4)', `téléphone : « Bbadd9/C » dans le panneau d'ajout donne le même accord (${await accords(p)})`);
    await p.close();

    check(erreurs.length === 0, `aucune erreur JavaScript (${erreurs.length ? erreurs.join(' | ') : 'aucune'})`);
    await nav.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
