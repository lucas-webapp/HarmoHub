// LA VUE PIANO DU SÉQUENCEUR : DE VRAIS DEMI-TONS, DES TOUCHES QU'ON JOUE (L6bis, décidé par l'utilisateur le 15/11).
//
// SES MOTS : « j'aimerais avoir une vue globale d'un vrai séquenceur, sans notes invisibles. Par exemple si je cherche une note aiguë qui n'est pas encore jouée ailleurs, aujourd'hui je ne
// peux pas tâtonner pour la trouver, car je suis obligé d'ajouter son nom manuellement […] Le plus compliqué est de bien gérer les gestes, scroll et zooms » ; sa réponse à la variante légère :
// « Je te propose de mettre en place ta version simplifiée effectivement. »
//
// CE QUE LE BANC TIENT, avec de vrais gestes (clics, molette, glisser de la poignée, Ctrl+Z) :
//   A. la vue Piano montre TOUS les demi-tons d'une fenêtre BORNÉE (cinq sous la plus grave, une octave au-dessus de la plus aiguë), de l'aigu au grave, les hauteurs de la partie repérées ;
//      douze lignes visibles, la grille posée sur la note la plus aiguë utilisée, les Do marqués, les touches noires sombres ;
//   B. l'étiquette est une TOUCHE : un clic la fait entendre, sans rien écrire ; la molette fait défiler les lignes dans la grille (rien d'autre ne bouge : ni zoom, ni défilement de côté) ;
//   C. une case VIDE sur une ligne que personne ne joue pose une note libre (une annulation) : on peut tâtonner pour trouver une note aiguë ;
//   D. le nombre de lignes visibles se retient PAR VUE (la poignée du haut) ; la vue Voix est inchangée ;
//   E. le téléphone n'a pas bougé : « seulement les hauteurs utilisées », pas de touches.
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('vue Piano du séquenceur');
const { estBruitReseau } = require('./_harness');
const R = require('./_retrait_ancien');

plan(24);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const graine = () => {
    const mk = (r, q, b = 4) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
    const S = [{ title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7')] }];
    localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), sections: S }]));
    localStorage.setItem('harmohubCurrentSongId', 's1');
    localStorage.setItem('myProgression', JSON.stringify({ sections: S }));
    localStorage.removeItem('harmohubSequenceurVue');
    sessionStorage.setItem('cc_accueil_vu', '1');
};

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    const ouvrir = async (viewport, opts = {}) => {
        const ctx = await nav.newContext({ viewport, ...opts });
        const p = await ctx.newPage();
        p.on('pageerror', e => erreurs.push(e.message));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) erreurs.push('console: ' + m.text()); });
        await p.goto(`${BASE}/index.html`);
        await p.evaluate(graine);
        await p.reload();
        await p.waitForTimeout(900);
        return { p, ctx };
    };
    const etat = (p) => p.evaluate(() => {
        const g = document.getElementById('sq-grille'), r = g.getBoundingClientRect();
        const et = [...g.querySelectorAll('.sq-etiq[data-midi]')];
        const premiere = g.querySelector('.sq-case[data-r]');
        const regle = r.top + (premiere ? premiere.offsetTop - g.offsetTop : 0); // sous les noms d'accords et la règle, collés en haut : ce qui est dessous est réellement à l'écran
        const dans = (x) => { const q = x.getBoundingClientRect(); return q.top >= regle - 1 && q.bottom <= r.bottom + 1; };
        const used = [];
        loadProgressionSections()[0].chords.forEach(d => SequenceurHarmo.voixDe(d).voix.forEach(x => used.push(x.midi)));
        return {
            midis: et.map(x => +x.dataset.midi), marquees: et.filter(x => x.classList.contains('utilisee')).map(x => +x.dataset.midi),
            utilisees: [...new Set(used)].sort((a, b) => b - a), visibles: et.filter(dans).map(x => +x.dataset.midi), scroll: Math.round(g.scrollTop), page: Math.round(scrollY),
            noires: et.filter(x => x.classList.contains('diese')).length, dos: et.filter(x => x.classList.contains('do')).map(x => +x.dataset.midi), overflow: g.style.overflowY,
            sansNom: et.filter(x => !x.textContent.trim()).length,
        };
    });

    // ======================================================================================================
    console.log('\n=== A. De vrais demi-tons, une fenêtre bornée, douze lignes visibles ===');
    let { p, ctx } = await ouvrir({ width: 1440, height: 900 });
    exiger((await R.ouvrirNouveau(p)).ok, 'le séquenceur s\'ouvre');
    await R.cliquer(p, '#sq-vue-notes', 600);
    let e = await etat(p);
    const haut = Math.min(96, e.utilisees[0] + 12), bas = Math.max(36, e.utilisees[e.utilisees.length - 1] - 5);
    check(e.midis.length === haut - bas + 1 && e.midis[0] === haut && e.midis[e.midis.length - 1] === bas, `la fenêtre va de cinq demi-tons sous la plus grave à une octave au-dessus de la plus aiguë (${e.midis.length} lignes : ${e.midis[0]} → ${e.midis[e.midis.length - 1]})`);
    check(e.midis.every((m, i) => i === 0 || m === e.midis[i - 1] - 1), 'tous les demi-tons, sans trou, de l\'aigu au grave');
    check(JSON.stringify(e.marquees) === JSON.stringify(e.utilisees), `les hauteurs que la partie joue sont repérées (${e.marquees.length} sur ${e.midis.length})`);
    check(e.overflow === 'auto' && e.visibles.length >= 11 && e.visibles.length <= 13, `douze lignes visibles, la grille défile pour le reste (${e.visibles.length} visibles)`);
    check(e.visibles.includes(e.utilisees[0]) && e.visibles[0] - e.utilisees[0] <= 2, `posée sur la note la plus aiguë jouée (${e.visibles[0]} en haut, ${e.utilisees[0]} la plus aiguë)`);
    check(JSON.stringify(e.dos) === JSON.stringify(e.midis.filter(m => m % 12 === 0)) && e.dos.length > 0, `les Do sont marqués (${e.dos.join(', ')})`);
    check(e.noires === e.midis.filter(m => [1, 3, 6, 8, 10].includes(m % 12)).length && e.sansNom === 0, `les touches noires sont sombres, toutes les touches portent leur nom (${e.noires} noires)`);

    // ======================================================================================================
    console.log('\n=== B. L\'étiquette est une touche qu\'on joue ; la molette défile dans la grille ===');
    await p.evaluate(() => { const s = window.app.sequenceur; window.__joue = []; const f = s.jouerNote.bind(s); s.jouerNote = (c, m, n) => { window.__joue.push(m); return f(c, m, n); }; });
    const avantNotes = await p.evaluate(() => JSON.stringify(loadProgressionSections()));
    const g0 = await p.locator('#sq-grille').boundingBox();
    await p.mouse.move(g0.x + g0.width / 2, g0.y + g0.height / 2);
    await p.mouse.wheel(0, -400); await p.waitForTimeout(350);
    let e2 = await etat(p);
    check(e2.scroll < e.scroll && e2.visibles[0] > e.visibles[0] && e2.page === e.page, `la molette fait défiler les lignes vers l'aigu (${e.visibles[0]} → ${e2.visibles[0]} en haut), la page ne bouge pas`);
    check(e2.midis.length === e.midis.length, 'défiler ne change rien aux lignes (ni zoom, ni redessin d\'une autre fenêtre)');
    const hautMidi = e2.visibles[0];
    const et = await p.locator(`#sq-grille .sq-etiq[data-midi="${hautMidi}"]`).boundingBox();
    await p.mouse.click(et.x + et.width / 2, et.y + et.height / 2); await p.waitForTimeout(250);
    check(JSON.stringify(await p.evaluate(() => window.__joue)) === JSON.stringify([hautMidi]), `un clic sur la touche ${hautMidi} la fait entendre (${JSON.stringify(await p.evaluate(() => window.__joue))})`);
    check(await p.evaluate(() => JSON.stringify(loadProgressionSections())) === avantNotes, 'et n\'écrit rien dans le morceau');

    // ======================================================================================================
    console.log('\n=== C. Une case vide sur une ligne que personne ne joue pose une note libre ===');
    const cible = await p.evaluate(() => {
        const g = document.getElementById('sq-grille').getBoundingClientRect();
        const rows = [...document.querySelectorAll('#sq-grille .sq-etiq[data-midi]:not(.utilisee)')].filter(x => { const r = x.getBoundingClientRect(); return r.top >= g.top + 70 && r.bottom <= g.bottom - 2; });
        const et = rows[0]; if (!et) return null;
        const midi = +et.dataset.midi, rIdx = [...document.querySelectorAll('#sq-grille .sq-etiq[data-midi]')].indexOf(et);
        const c = document.querySelector(`#sq-grille .sq-case[data-c="0"][data-r="${rIdx}"][data-k="1"]`);
        if (!c) return null; const r = c.getBoundingClientRect();
        return { midi, x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    exiger(!!cible, 'une ligne vide est visible dans la grille');
    await p.mouse.click(cible.x, cible.y); await p.waitForTimeout(450);
    const libres = await p.evaluate(() => (loadProgressionSections()[0].chords[0].extraNotes || []).map(x => (NOTES.indexOf(x.note) + 12 * (+x.octave + 1))));
    check(libres.length === 1 && libres[0] === cible.midi, `une croche posée sur la ligne ${cible.midi} ajoute cette note libre à l'accord (${JSON.stringify(libres)})`);
    e2 = await etat(p);
    check(e2.marquees.includes(cible.midi) && e2.midis.length >= e.midis.length, 'la ligne est maintenant repérée comme utilisée par la partie');
    await p.keyboard.press('Control+z'); await p.waitForTimeout(400);
    check((await p.evaluate(() => (loadProgressionSections()[0].chords[0].extraNotes || []).length)) === 0, 'Ctrl+Z la retire d\'un coup');

    // ======================================================================================================
    console.log('\n=== D. Le nombre de lignes visibles se retient PAR VUE ; la vue Voix est inchangée ===');
    let q = await p.locator('#sq-poignee').boundingBox();
    const pas = 26 + 3;
    await p.mouse.move(q.x + q.width / 2, q.y + q.height / 2); await p.mouse.down(); await p.mouse.move(q.x + q.width / 2, q.y + q.height / 2 + 4 * pas, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(350);
    const apresPoignee = await p.evaluate(() => window.app.sequenceur._visibles);
    check(apresPoignee === 8, `la poignée du haut tirée de quatre lignes : huit lignes visibles en Piano (${apresPoignee})`);
    await R.cliquer(p, '#sq-vue-voix', 500);
    const voix = await p.evaluate(() => ({ vis: window.app.sequenceur._visibles, lignes: document.querySelectorAll('#sq-grille .sq-etiq').length, touches: document.querySelectorAll('#sq-grille .sq-etiq.touche').length, ov: document.getElementById('sq-grille').style.overflowY }));
    check(voix.vis === 0 && voix.lignes === 4 && voix.touches === 0 && voix.ov === '', `la vue Voix : ses quatre lignes, toutes visibles, pas de touches (${JSON.stringify(voix)})`);
    await R.cliquer(p, '#sq-vue-notes', 500);
    check(await p.evaluate(() => window.app.sequenceur._visibles) === 8, 'de retour en Piano : les huit lignes sont retrouvées');
    q = await p.locator('#sq-poignee').boundingBox();
    await p.mouse.dblclick(q.x + q.width / 2, q.y + q.height / 2); await p.waitForTimeout(350);
    check(await p.evaluate(() => window.app.sequenceur._visibles) === 0 && (await etat(p)).visibles.length >= 11 && (await etat(p)).visibles.length <= 13, 'double-clic sur la poignée : retour aux douze lignes d\'origine');
    // Un redessin (poser une croche) garde la place où l'on est : la grille ne saute pas.
    await p.mouse.move(g0.x + g0.width / 2, g0.y + g0.height / 2); await p.mouse.wheel(0, -200); await p.waitForTimeout(300);
    const avantPose = JSON.stringify((await etat(p)).visibles);
    const c0 = await p.evaluate(() => { const g = document.getElementById('sq-grille').getBoundingClientRect(); const c = [...document.querySelectorAll('#sq-grille .sq-case[data-r]:not(.on)')].find(x => { const r = x.getBoundingClientRect(); return r.top >= g.top + 70 && r.bottom <= g.bottom - 2; }); if (!c) return null; const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await p.mouse.click(c0.x, c0.y); await p.waitForTimeout(400);
    // (une note posée tout en haut agrandit la fenêtre vers l'aigu : les lignes d'avant descendent d'autant, la grille les suit — ce qu'on regarde ne bouge pas)
    check(JSON.stringify((await etat(p)).visibles) === avantPose, `poser une croche ne fait pas sauter la grille : les mêmes lignes restent à l'écran (${avantPose})`);
    await ctx.close();

    // ======================================================================================================
    console.log('\n=== E. Le téléphone n\'a pas bougé : seulement les hauteurs utilisées ===');
    ({ p, ctx } = await ouvrir({ width: 390, height: 844 }, { hasTouch: true, isMobile: true }));
    await p.evaluate(() => localStorage.setItem('harmohubSequenceurVue', 'notes'));
    await p.reload(); await p.waitForTimeout(900);
    for (let n = 0; n < 2; n++) { const b = await p.locator('#progression-sections .grid-cell[data-index="0"]').first().boundingBox(); await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await p.waitForTimeout(600); } // un toucher choisit, le second ouvre le panneau
    const rr = await R.ouvrirRythmeTel(p);
    exiger(rr.ok, `le séquenceur du téléphone s'ouvre (${rr.detail})`);
    const tel = await p.evaluate(() => ({ vue: window.app.sequenceur.vue, lignes: document.querySelectorAll('#sq-grille .sq-etiq').length, touches: document.querySelectorAll('#sq-grille .sq-etiq.touche, #sq-grille .sq-etiq[data-midi]').length, ov: document.getElementById('sq-grille').style.overflowY }));
    const attendu = await p.evaluate(() => { const t = new Set(); loadProgressionSections()[0].chords.forEach(d => SequenceurHarmo.voixDe(d).voix.forEach(x => t.add(x.midi))); return t.size; });
    check(tel.vue === 'notes' && tel.lignes === attendu && tel.touches === 0 && tel.ov === '', `téléphone : ${tel.lignes} lignes (les ${attendu} hauteurs utilisées), pas de touches, pas de défilement interne`);
    await ctx.close();

    check(erreurs.length === 0, `aucune erreur JavaScript (${erreurs.length ? erreurs.join(' | ') : 'aucune'})`);
    await nav.close();
    bilan();
})().catch((err) => { console.error('FATAL', err); process.exit(2); });
