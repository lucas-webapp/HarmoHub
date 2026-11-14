// LE MOTEUR DES DOIGTÉS DE GUITARE (L8, seconde moitié, 14/11) : renversements et drops en vrais doigtés, jusqu'à 8 diagrammes, triades sur 3 cordes, « sans quinte ».
//
// CE QUE DEMANDE L'UTILISATEUR (décisions du 13/11, « toutes tes idées sont bonnes ») : « Renversements et drops : les vrais doigtés d'abord » = la MÊME forme (mêmes voix, même ordre,
// mêmes écarts) n'importe où sur le manche, à l'octave près ; à défaut les « plus proches » (même note grave, même ordre au-dessus) ; une forme par position ET par jeu de cordes ;
// jusqu'à 8 diagrammes ; triades sur trois cordes, tétrades sur quatre ; et une étiquette courte « sans quinte » quand la quinte juste manque.
//
// CE QUE LE BANC TIENT : le moteur (accords construits en mémoire, relus par les fonctions du moteur) pour les décalages d'octave, l'ordre des « plus proches », le plafond de 8, les
// triades ; puis un VRAI geste (clic sur une case de la grille, clic sur le compteur) pour l'étiquette « sans quinte » de la popover ; le téléphone n'a pas bougé.
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('moteur des doigtés de guitare');
const { estBruitReseau } = require('./_harness');

plan(16);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const graine = () => {
    const mk = (r, q, bass = null) => ({ root: r, quality: q, beats: 4, inversion: 0, drop: 'none', octave: 3, bass, playStyle: 'held' });
    const S = [{ title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7'), mk('D', 'min7'), mk('G', 'dom7')] }];
    localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), sections: S }]));
    localStorage.setItem('harmohubCurrentSongId', 's1');
    localStorage.setItem('myProgression', JSON.stringify({ sections: S }));
    localStorage.setItem('harmohubMaxDoigtes', '8');
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
    const p = await ouvrir({ width: 1440, height: 900 });

    // ======================================================================================================
    console.log('\n=== A. Renversements et drops : la même forme à une autre octave ===');
    const moteur = await p.evaluate(() => {
        const ecarts = (m) => { const t = m.slice().sort((a, b) => a - b); return t.map(x => x - t[0]).join(','); };
        const cle = (f) => f.map(e => (e ? e.fret : 'x')).join('-');
        const cas = (root, q, inv, drop) => {
            const c = new Chord(root, q, 4, inv, drop, 3, null, null, []);
            const voix = c.getVoiced();
            const exacts = solveGuitarFingerings(voix, 99);
            const liste = guitarFingeringsForChord(c, null);
            const suite = liste.slice(exacts.length);
            const jouees = (f) => f.map((e, i) => (e ? i : -1)).filter(i => i >= 0);
            return {
                nExacts: exacts.length, n: liste.length,
                enTete: exacts.every((f, i) => liste[i] && cle(liste[i]) === cle(f)),
                memeForme: suite.length > 0 && suite.every(f => ecarts(f.filter(e => e).map(e => e.midi)) === ecarts(voix.map(v => v.midi))),
                voisines: suite.every(f => { const j = jouees(f); const trous = j.slice(1).reduce((t, x, k) => t + x - j[k] - 1, 0); return trous === 0 || (trous === 1 && j[1] - j[0] === 2); }),
                positionsUniques: new Set(liste.map(guitarClePosition)).size === liste.length || liste.slice(0, exacts.length).length > 0,
            };
        };
        return { drop2: cas('C', 'maj7', 0, 'drop2'), drop3: cas('C', 'maj7', 0, 'drop3'), inv1: cas('A', 'min7', 1, 'none'), inv2: cas('G', 'dom7', 2, 'none') };
    });
    exiger(moteur.drop2.n > moteur.drop2.nExacts, `Cmaj7 en drop 2 : au-delà des ${moteur.drop2.nExacts} doigtés exacts, la même forme ailleurs sur le manche (${moteur.drop2.n} en tout)`);
    check(moteur.drop2.enTete && moteur.drop2.memeForme && moteur.drop2.voisines, 'drop 2 : les exacts restent en tête, les suivants gardent exactement les écarts entre voix, sur cordes voisines');
    check(moteur.drop3.n > moteur.drop3.nExacts && moteur.drop3.enTete && moteur.drop3.memeForme && moteur.drop3.voisines, `drop 3 : même contrat, une corde sautée tolérée au-dessus de la basse (${moteur.drop3.n} dont ${moteur.drop3.nExacts} exacts)`);
    check(moteur.inv1.enTete && moteur.inv1.n >= 3, `Am7 au 1er renversement : les exacts d'abord, ${moteur.inv1.n} doigtés au total`);
    check(moteur.inv2.enTete && moteur.inv2.n >= 3, `G7 au 2e renversement : les exacts d'abord, ${moteur.inv2.n} doigtés au total`);
    const releve = await p.evaluate(() => {
        let total = 0, vides = 0, decales = 0;
        NOTES.forEach(root => ['maj7', 'min7', 'dom7', 'maj', 'min'].forEach(q => [[1, 'none'], [2, 'none'], [3, 'none'], [0, 'drop2'], [0, 'drop3']].forEach(([inv, drop]) => {
            const c = new Chord(root, q, 4, inv, drop, 3, null, null, []);
            if (inv >= c.getIntervals().length) return;
            total++;
            if (!guitarFingeringsForChord(c, null).length) vides++;
            if (solveGuitarMemeForme(c.getVoiced(), 8).length > solveGuitarFingerings(c.getVoiced(), 99).length) decales++;
        })));
        return { total, vides, decales };
    });
    check(releve.vides === 0 && releve.decales >= 60, `relevé sur ${releve.total} renversements et drops courants : aucun sans doigté, ${releve.decales} gagnent une forme décalée d'octave`);

    // ======================================================================================================
    console.log('\n=== B. Les « plus proches », le plafond de 8, les triades ===');
    const proches = await p.evaluate(() => {
        // Cmaj7 avec sol à la basse, voix attendues dans l'ordre sol do mi si : les positions qui le gardent passent avant les autres.
        const ordre = [7, 0, 4, 11];
        const liste = solveGuitarVoicings('C', 'maj7', 8, 7, ordre);
        const bons = liste.map(forme => {
            const notes = forme.map((fret, i) => (fret == null ? null : { midi: GUITAR_OPEN_MIDI[i] + fret }));
            const pres = new Set(notes.filter(Boolean).map(n => ((n.midi % 12) + 12) % 12));
            return guitarOrdreDesClasses(notes).join() === ordre.filter(pc => pres.has(pc)).join();
        });
        return { n: liste.length, bons, premiersBons: bons.every((b, i) => i === 0 || b <= bons[i - 1]) };
    });
    exiger(proches.n >= 2 && proches.bons[0], `Cmaj7/G (sol do mi si) : la première position proposée garde l'ordre des voix au-dessus de la basse (${proches.n} positions)`);
    check(proches.premiersBons, 'les positions qui gardent l\'ordre des voix passent toutes avant celles qui ne le gardent pas');
    const plafond = await p.evaluate(() => ({ n: guitarFingeringsForChord(new Chord('C', 'maj7', 4, 0, 'none', 3, null, null, []), null).length, max: GUITAR_MAX_SUGGESTIONS, c: guitarFingeringsForChord(new Chord('C', 'maj', 4, 0, 'none', 3, null, null, []), null).length }));
    check(plafond.max === 8 && plafond.n === 8 && plafond.c >= 6, `réglé sur 8, Cmaj7 propose 8 doigtés (${plafond.n}) et le simple Do majeur ${plafond.c} (il n'en trouvait que 4)`);
    const triade = await p.evaluate(() => {
        const l = guitarFingeringsForChord(new Chord('C', 'maj', 4, 0, 'none', 3, null, null, []), null);
        const n = l.map(f => f.filter(e => e).length);
        return { min: Math.min(...n), trois: n.filter(x => x === 3).length };
    });
    check(triade.min >= 3 && triade.trois >= 1, `triade de Do : au moins une forme sur 3 cordes, jamais moins de 3 (${triade.trois} formes à 3 cordes)`);
    const uniques = await p.evaluate(() => {
        const fautifs = [];
        NOTES.forEach(root => ['maj', 'min7', 'maj9', 'dom13', 'sus4'].forEach(q => {
            const l = guitarFingeringsForChord(new Chord(root, q, 4, 0, 'none', 3, null, null, []), null);
            const cles = l.map(guitarClePosition);
            if (new Set(cles).size !== cles.length) fautifs.push(root + q);
        }));
        return fautifs;
    });
    check(uniques.length === 0, `une seule proposition par position ET par corde grave (60 accords) — doublons : ${uniques.join(' ') || 'aucun'}`);

    // ======================================================================================================
    console.log('\n=== C. L\'étiquette « sans quinte » dans la popover (vrais gestes) ===');
    if ((await p.getAttribute('#toggle-viz-guitar', 'aria-pressed')) !== 'true') await p.click('#toggle-viz-guitar', { force: true });
    await p.waitForTimeout(250);
    await p.click('#progression-sections .chord-grid[data-section="0"] .grid-cell[data-index="0"]');
    await p.waitForTimeout(500);
    const b = await p.locator('#guitar-nav-label').boundingBox();
    await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(300);
    const pop = await p.evaluate(() => {
        const btns = [...document.querySelectorAll('#guitar-doigtes-pop .doigte-choix')];
        return {
            n: btns.length, total: window.app.guitarFingerings.length,
            etiq: btns.map(x => (x.querySelector('.doigte-etiq') || {}).textContent || ''),
            sansQuinte: window.app.guitarFingerings.map(f => !f.some(e => e && (((e.midi % 12) + 12) % 12) === 7)),   // Cmaj7 : la quinte est sol (7)
            titres: btns.map(x => x.title),
        };
    });
    check(pop.n === pop.total && pop.n >= 6, `la popover montre les ${pop.total} doigtés de Cmaj7`);
    check(pop.etiq.every((t, i) => (t === 'sans quinte') === pop.sansQuinte[i]) && pop.etiq.some(t => t === 'sans quinte'), `« sans quinte » sous chaque doigté qui laisse tomber le sol, et seulement sous ceux-là (${pop.etiq.filter(Boolean).length} sur ${pop.n})`);
    check(pop.etiq.every((t, i) => !t || pop.titres[i].includes(t)), 'l\'étiquette est aussi dans l\'infobulle du diagramme');

    // ======================================================================================================
    console.log('\n=== D. Le téléphone n\'a pas bougé ===');
    const tel = await ouvrir({ width: 390, height: 844 });
    check(await tel.locator('#progression-sections .chord-grid[data-section="0"] .grid-cell').count() >= 1 && await tel.evaluate(() => document.getElementById('guitar-doigtes-pop').hidden), 'à 390 px : la grille est là et la popover des doigtés reste fermée');
    check(erreurs.length === 0, 'aucune erreur de page ni de console' + (erreurs.length ? ' : ' + erreurs.slice(0, 2).join(' | ') : ''));
    await nav.close();
    bilan();
})().catch(e => { console.log('FATAL', e); process.exit(1); });
