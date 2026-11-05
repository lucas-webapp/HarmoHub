// LA RANGÉE DE RÉGLAGES DU MORCEAU (refonte, lot 6a), avec de vrais clics.
//
// CE QUE DEMANDE LA MAQUETTE VALIDÉE (docs/refonte.md) : au-dessus de la grille, des puces Tonalité / Mesure / Swing / Son et « Transposer − + »,
// qui remplacent la carte Morceau du bandeau de gauche. « Tonalité ≠ Transposer : la puce Tonalité change seulement la référence (degrés, modes,
// suggestion) ; Transposer déplace les accords (version automatique avant) » ; « Groove → Swing : Droit / Shuffle léger / Ternaire ».
//
// CE QUE LE BANC TIENT : chaque puce dit la valeur réelle et la règle ; un choix marque le morceau modifié et s'annule par Ctrl+Z comme avant ;
// la tonalité ne bouge aucun accord, Transposer les bouge tous et garde une version avant ; la suggestion de tonalité marche depuis la puce ;
// clavier (Échap, flèches) ; le contretemps du métronome a trouvé place dans la fenêtre du tempo ; le téléphone n'a pas bougé (lot 10).
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('rangée de réglages du morceau');
const { estBruitReseau } = require('./_harness');

plan(40);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const graine = () => {
    const mk = (r, q, b = 4) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
    const S = [{ title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7'), mk('D', 'min7'), mk('G', '7')] }];
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
    const puces = (p) => p.evaluate(() => Object.fromEntries([...document.querySelectorAll('#rangee-reglages .rr-puce')].map(b => [b.dataset.puce, b.querySelector('.rr-val').textContent])));
    const popOuvert = (p) => p.evaluate(() => !document.getElementById('rr-pop').hidden);
    const ouvrirPuce = async (p, id) => { await p.click(`#rangee-reglages .rr-puce[data-puce="${id}"]`); await p.waitForTimeout(150); };
    const modifie = (p) => p.evaluate(() => hasUnsavedChanges);
    const degres = (p) => p.evaluate(() => [...document.querySelectorAll('#progression-sections .row-roman')].map(r => r.textContent.trim()));
    const racines = (p) => p.evaluate(() => loadProgressionSections()[0].chords.map(c => c.root));

    // ======================================================================================================
    console.log('\n=== A. Les puces, au-dessus de la grille ===');
    let p = await ouvrir({ width: 1440, height: 900 });
    const geo = await p.evaluate(() => {
        const r = document.getElementById('rangee-reglages').getBoundingClientRect(), g = document.querySelector('#progression-sections').getBoundingClientRect();
        const b = [...document.querySelectorAll('#rangee-reglages .rr-puce, #rangee-reglages .rr-seg')].map(x => x.getBoundingClientRect());
        return { dessus: r.bottom <= g.top, hauteurs: b.map(x => Math.round(x.height)), uneLigne: new Set(b.map(x => Math.round(x.top))).size === 1,
            carteMorceau: document.getElementById('song-card').getBoundingClientRect().height };
    });
    check(JSON.stringify(await puces(p)) === JSON.stringify({ tonalite: 'C majeur', mesure: '4/4', swing: 'Droit', son: 'Piano' }), `les puces disent les vraies valeurs : ${JSON.stringify(await puces(p))}`);
    check(geo.dessus && geo.uneLigne, 'sur une seule ligne, au-dessus de la grille');
    check(geo.hauteurs.length === 5 && geo.hauteurs.every(h => h === 32), `à la jauge : 32px (${geo.hauteurs.join(', ')})`);
    check(geo.carteMorceau === 0, `la carte Morceau du bandeau de gauche n'est plus affichée (${geo.carteMorceau}px)`);
    check(await modifie(p) === false, 'le morceau s\'ouvre enregistré');

    // ======================================================================================================
    console.log('\n=== B. Mesure ===');
    await ouvrirPuce(p, 'mesure');
    const optM = await p.evaluate(() => [...document.querySelectorAll('#rr-pop [role="option"]')].map(o => ({ v: o.dataset.rrValeur, sel: o.getAttribute('aria-selected') })));
    check(optM.length === 8 && optM.find(o => o.v === '4/4').sel === 'true', `huit mesures, 4/4 cochée (${optM.map(o => o.v + (o.sel === 'true' ? '✓' : '')).join(' ')})`);
    check(await p.evaluate(() => document.activeElement && document.activeElement.dataset.rrValeur === '4/4'), 'le focus est sur le choix actuel');
    await p.click('#rr-pop [data-rr-valeur="3/4"]'); await p.waitForTimeout(250);
    check(await p.evaluate(() => document.getElementById('time-sig').value) === '3/4' && (await puces(p)).mesure === '3/4', 'choisir 3/4 règle la mesure du morceau, et la puce le dit');
    check(!(await popOuvert(p)) && await p.evaluate(() => document.activeElement && document.activeElement.dataset.puce === 'mesure'), 'le choix se referme, le focus revient à la puce');
    check(await p.evaluate(() => window.app.beatsPerBar()) === 3, 'la grille compte désormais 3 temps par mesure');
    check(await modifie(p) === true, 'le morceau est marqué modifié');
    await p.keyboard.press('Control+z'); await p.waitForTimeout(250);
    check(await p.evaluate(() => document.getElementById('time-sig').value) === '4/4' && (await puces(p)).mesure === '4/4', `Ctrl+Z défait le choix fait à la puce (${(await puces(p)).mesure})`);

    // ======================================================================================================
    console.log('\n=== C. Swing ===');
    await ouvrirPuce(p, 'swing');
    const optS = await p.evaluate(() => [...document.querySelectorAll('#rr-pop [role="option"]')].map(o => ({ l: o.querySelector('.tb-mi-libelle').textContent, d: (o.querySelector('.rr-option-desc') || {}).textContent || '' })));
    check(JSON.stringify(optS.map(o => o.l)) === '["Droit","Shuffle léger","Ternaire"]' && optS.every(o => o.d.length > 10), `Droit / Shuffle léger / Ternaire, chacun expliqué (${optS.map(o => o.l).join(', ')})`);
    await p.click('#rr-pop [data-rr-valeur="ternary"]'); await p.waitForTimeout(200);
    check(await p.evaluate(() => document.getElementById('groove').value) === 'ternary' && (await puces(p)).swing === 'Ternaire', 'Ternaire : le swing du morceau est réglé');
    await p.keyboard.press('Control+z'); await p.waitForTimeout(200);
    check(await p.evaluate(() => document.getElementById('groove').value) === 'straight', 'Ctrl+Z le défait aussi');

    // ======================================================================================================
    console.log('\n=== D. Son ===');
    await ouvrirPuce(p, 'son');
    await p.click('#rr-pop [data-rr-valeur="pad"]'); await p.waitForTimeout(200);
    check(await p.evaluate(() => document.getElementById('instrument').value === 'pad' && window.app.songInstrument === 'pad') && (await puces(p)).son === 'Nappe', 'Nappe : le son de tout le morceau change');
    // Le son n'est pas un réglage annulable : choisir ici ne doit pas laisser d'instantané en attente qui fausserait le prochain Ctrl+Z.
    check(await p.evaluate(() => !window.app._pendingSettingUndo), 'aucun instantané d\'annulation laissé en attente');

    // ======================================================================================================
    console.log('\n=== E. Tonalité : la référence, pas les accords ===');
    const degAvant = await degres(p), racAvant = await racines(p);
    await ouvrirPuce(p, 'tonalite');
    check(await p.evaluate(() => document.getElementById('rr-pop').getAttribute('role')) === 'dialog', 'la puce Tonalité ouvre un petit panneau (tonique, mode, suggestion)');
    const toniques = await p.evaluate(() => [...document.querySelectorAll('#rr-pop [data-rr-action="tonique"]')].map(b => b.textContent));
    check(toniques.length === 12 && toniques.includes('E♭') && toniques.includes('B♭') && toniques.includes('F♯') && !toniques.some(t => t.includes('#')), `douze toniques, en notation internationale (${toniques.join(' ')})`);
    check(await p.evaluate(() => document.querySelectorAll('#rr-pop [data-rr-action="mode"]').length) === 7, 'sept modes, les modes rares compris');
    await p.click('#rr-pop [data-rr-action="tonique"][data-rr-valeur="A"]'); await p.waitForTimeout(200);
    await p.click('#rr-pop [data-rr-action="mode"][data-rr-valeur="min"]'); await p.waitForTimeout(250);
    check((await puces(p)).tonalite === 'A mineur' && await popOuvert(p), `A mineur, et le panneau reste ouvert pour enchaîner (${(await puces(p)).tonalite})`);
    check(JSON.stringify(await racines(p)) === JSON.stringify(racAvant), `aucun accord n'a bougé (${(await racines(p)).join(' ')})`);
    const degApres = await degres(p);
    check(JSON.stringify(degApres) !== JSON.stringify(degAvant) && /i/.test(degApres[1] || ''), `les degrés suivent la nouvelle référence (${degAvant.join(' ')} → ${degApres.join(' ')})`);
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);
    check(!(await popOuvert(p)) && await p.evaluate(() => document.activeElement && document.activeElement.dataset.puce === 'tonalite'), 'Échap referme, le focus revient à la puce');
    await p.keyboard.press('Control+z'); await p.waitForTimeout(200);
    await p.keyboard.press('Control+z'); await p.waitForTimeout(200);
    check((await puces(p)).tonalite === 'C majeur', `deux Ctrl+Z : retour à C majeur (${(await puces(p)).tonalite})`);
    // La suggestion d'après les accords, depuis la puce.
    await ouvrirPuce(p, 'tonalite');
    await p.click('#rr-pop .rr-suggerer'); await p.waitForTimeout(250);
    const sugg = await p.evaluate(() => { const m = document.getElementById('key-suggest-menu'); return { ouvert: !!m && !m.hidden, n: m ? m.querySelectorAll('button').length : 0 }; });
    check(sugg.ouvert && sugg.n >= 1, `« Suggérer d'après les accords » propose des tonalités (${sugg.n})`);
    exiger(sugg.n > 0, 'au moins une suggestion à choisir');
    {
        const choisie = await p.evaluate(() => { const b = document.querySelector('#key-suggest-menu button'); return b.dataset.keyRoot + '/' + b.dataset.keyMode; });
        await p.click('#key-suggest-menu button'); await p.waitForTimeout(250);
        check(await p.evaluate(() => document.getElementById('global-root').value + '/' + document.getElementById('global-mode').value) === choisie && (await puces(p)).tonalite === await p.evaluate(() => window.app.libelleTonalite()),
            `en choisir une règle la tonalité, et la puce suit (${choisie} → « ${(await puces(p)).tonalite} »)`);
    }

    // ======================================================================================================
    console.log('\n=== F. Transposer : les accords bougent, une version est gardée avant ===');
    await p.evaluate(() => { document.getElementById('global-root').value = 'C'; document.getElementById('global-mode').value = 'maj'; window.app.updateSongSummary(); });
    const vAvant = await p.evaluate(() => HistoriqueVersions.lister('s1').then(l => l.filter(v => v.motif === 'avant-transposition').length));
    await p.click('#rangee-reglages [data-rr-transposer="1"]'); await p.waitForTimeout(400);
    check(JSON.stringify(await racines(p)) === '["C#","A#","D#","G#"]', `+ : tous les accords montent d'un demi-ton (${(await racines(p)).join(' ')})`);
    check((await puces(p)).tonalite === await p.evaluate(() => window.app.libelleTonalite()) && (await puces(p)).tonalite !== 'C majeur', `la tonalité suit la transposition (${(await puces(p)).tonalite})`);
    check(await p.evaluate(() => HistoriqueVersions.lister('s1').then(l => l.filter(v => v.motif === 'avant-transposition').length)) === vAvant + 1, 'une version « avant transposition » est gardée');
    await p.click('#rangee-reglages [data-rr-transposer="-1"]'); await p.waitForTimeout(400);
    check(JSON.stringify(await racines(p)) === '["C","A","D","G"]', `− : retour aux accords d'origine (${(await racines(p)).join(' ')})`);
    const icones = await p.evaluate(() => [...document.querySelectorAll('#rangee-reglages [data-rr-transposer] svg')].map(s => s.innerHTML));
    const origine = await p.evaluate(() => ['transpose-song-down', 'transpose-song-up'].map(id => document.querySelector(`#${id} svg`).innerHTML));
    check(JSON.stringify(icones) === JSON.stringify(origine), 'les flèches de Transposer sont les dessins d\'origine (« les logos ne se perdent pas »)');

    // ======================================================================================================
    console.log('\n=== G. Clavier, clic ailleurs ===');
    await ouvrirPuce(p, 'mesure');
    await p.keyboard.press('ArrowDown'); await p.waitForTimeout(50);
    check(await p.evaluate(() => document.activeElement && document.activeElement.dataset.rrValeur) === '5/4', 'Flèche bas : le choix suivant');
    await p.keyboard.press('Enter'); await p.waitForTimeout(200);
    check(await p.evaluate(() => document.getElementById('time-sig').value) === '5/4', 'Entrée le choisit');
    await ouvrirPuce(p, 'son');
    await p.mouse.click(1300, 700); await p.waitForTimeout(150);
    check(!(await popOuvert(p)), 'un clic ailleurs referme le choix');
    await ouvrirPuce(p, 'son');
    await ouvrirPuce(p, 'son');
    check(!(await popOuvert(p)), 'recliquer la puce le referme');

    // ======================================================================================================
    console.log('\n=== H. Le contretemps du métronome ===');
    const sub = await p.evaluate(() => { const b = document.getElementById('toggle-metronome-subdivision'); return { dansTempo: !!b.closest('#bl-tempo-pop'), actif: b.classList.contains('active') }; });
    check(sub.dansTempo, 'sur ordinateur, il est dans la fenêtre du tempo (barre du bas)');
    await p.click('#bl-tempo'); await p.waitForTimeout(200);
    await p.click('#toggle-metronome-subdivision'); await p.waitForTimeout(150);
    check(await p.evaluate(() => window.app.metronomeSubdivision) === !sub.actif, 'et il marche toujours (un clic l\'allume ou l\'éteint)');
    await p.close();

    // ======================================================================================================
    // Réécrit au lot 10c : au téléphone, ces puces deviennent les quatre cases que déplie la barre-résumé (déplacées, pas copiées), et le contretemps
    // passe dans le panneau Lecture — la carte Morceau ne s'ouvre plus (voir telephone_reglages_test).
    console.log('\n=== I. Le téléphone : les puces sont ses quatre cases, le contretemps est dans le panneau Lecture (lot 10c) ===');
    p = await ouvrir({ width: 390, height: 844 });
    const tel = await p.evaluate(() => ({ rangee: document.getElementById('rangee-reglages').getBoundingClientRect().height, carte: document.getElementById('song-card').getBoundingClientRect().height,
        hote: document.getElementById('rangee-reglages').parentElement.id, sub: document.getElementById('toggle-metronome-subdivision').parentElement.id }));
    check(tel.rangee === 0 && tel.carte > 0 && tel.hote === 'tel-reglages-cases', `les puces sont rangées dans les cases repliées, la barre-résumé est là (${tel.rangee}px / ${Math.round(tel.carte)}px, ${tel.hote})`);
    check(tel.sub === 'pl-subdivision', `le contretemps est dans le panneau Lecture (${tel.sub})`);
    await p.close();

    check(erreurs.length === 0, `aucune erreur JavaScript (${erreurs.length ? erreurs.join(' | ') : 'aucune'})`);
    await nav.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
