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

plan(39);

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
    // ======================================================================================================
    console.log('\n=== F. La règle reste visible quand on défile ; pas de jaune sur les cases ; « Note libre » a la largeur des touches ===');
    await R.cliquer(p, '#sq-vue-notes', 400);
    const t0 = await p.locator('#sq-grille .sq-temps[data-c="0"]').first().boundingBox(), t1 = await p.locator('#sq-grille .sq-temps[data-c="0"]').nth(5).boundingBox();
    await p.mouse.move(t0.x + 3, t0.y + 8); await p.mouse.down(); await p.mouse.move(t1.x + 10, t0.y + 8, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(400);
    const gg = await p.locator('#sq-grille').boundingBox();
    await p.mouse.move(gg.x + 300, gg.y + 200); await p.mouse.wheel(0, 600); await p.waitForTimeout(400);
    const fige = await p.evaluate(() => {
        const g = document.getElementById('sq-grille'), gr = g.getBoundingClientRect(), top = (s) => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().top - gr.top) : null; };
        const cases = [...document.querySelectorAll('#sq-grille .sq-case.dans-boucle')];
        return { scroll: g.scrollTop, nom: top('#sq-grille .sq-nom'), temps: top('#sq-grille .sq-temps'), boucle: top('#sq-grille .sq-boucle'), 
            teinte: cases.filter(x => getComputedStyle(x).backgroundImage !== 'none').length, nbBoucle: cases.length };
    });
    check(fige.scroll > 100 && fige.nom === 0 && fige.temps === 23 && fige.boucle === 23, `grille défilée de ${fige.scroll} px : les noms d'accords, la règle et la plage à boucler restent collés en haut (${JSON.stringify([fige.nom, fige.temps, fige.boucle])})`);
    // (une ombre ne reçoit pas le pointeur : on lit donc ce qui est PEINT — une ombre pleine de 3 px, de la couleur du fond, sous la rangée des noms)
    const ecart = await p.evaluate(() => { const nom = document.querySelector('#sq-grille .sq-nom'), t = document.querySelector('#sq-grille .sq-temps'); return { ecart: Math.round(t.getBoundingClientRect().top - nom.getBoundingClientRect().bottom), ombre: getComputedStyle(nom).boxShadow }; });
    check(ecart.ecart === 3 && ecart.ombre === 'rgb(17, 18, 20) 0px 3px 0px 0px', `l'écart de 3 px entre les noms d'accords et la règle est bouché par une ombre pleine : rien n'y défile (${JSON.stringify(ecart)})`);
    check(fige.nbBoucle > 0 && fige.teinte === 0, `la plage à boucler ne teinte plus les cases en jaune (${fige.nbBoucle} cases dans la plage, ${fige.teinte} teintées)`);
    const trait = await p.evaluate(() => { const g = document.getElementById('sq-grille'); const t = g.querySelector('.sq-temps[data-k="2"]'), c = g.querySelector('.sq-case[data-c="0"][data-k="2"]'); const bt = getComputedStyle(t); return { bord: bt.borderLeftWidth, dx: Math.round((t.getBoundingClientRect().left - c.getBoundingClientRect().left) * 10) / 10, retrait: bt.paddingLeft }; });
    check(trait.bord === '0px' && trait.dx === 0 && trait.retrait === '2px', `la règle ne dessine aucun trait ; les chiffres partent à 2 px du trait des cases, juste au-dessus (${JSON.stringify(trait)})`);
    check(await p.evaluate(() => document.querySelectorAll('#sq-grille .sq-libre-btn').length) === 0, 'en vue Piano, plus de bouton « Note libre » : toutes les notes sont déjà là');
    await R.cliquer(p, '#sq-vue-voix', 400);
    const largeurs = await p.evaluate(() => ({ btn: Math.round(document.querySelector('#sq-grille .sq-libre-btn').getBoundingClientRect().width), touche: Math.round(document.querySelector('#sq-grille .sq-etiq').getBoundingClientRect().width), top: Math.round(document.querySelector('#sq-grille .sq-libre-btn').getBoundingClientRect().top - document.getElementById('sq-grille').getBoundingClientRect().top) }));
    check(largeurs.btn === largeurs.touche, `en vue Voix, « Note libre » a la largeur des touches (${largeurs.btn} px et ${largeurs.touche} px)`);
    await R.cliquer(p, '#sq-vue-notes', 400);

    // ======================================================================================================
    console.log('\n=== G. Une barre qu\'on clique s\'entend ; des octaves en plus ou en moins ===');
    await p.mouse.move(gg.x + 300, gg.y + 200); await p.mouse.wheel(0, -3000); await p.waitForTimeout(200); await p.mouse.wheel(0, 380); await p.waitForTimeout(300);
    await p.evaluate(() => { window.__joue = []; });
    const barre = await p.evaluate(() => { const g = document.getElementById('sq-grille').getBoundingClientRect(); const x = [...document.querySelectorAll('#sq-grille .sq-case.on')].find(c => { const r = c.getBoundingClientRect(); return r.top >= g.top + 70 && r.bottom <= g.bottom - 2 && r.width > 0; }); if (!x) return null; const r = x.getBoundingClientRect(); const i = [...document.querySelectorAll('#sq-grille .sq-etiq[data-midi]')][+x.dataset.r]; return { x: r.left + r.width / 2, y: r.top + r.height / 2, midi: +i.dataset.midi }; });
    exiger(!!barre, 'une barre existante est visible');
    await p.mouse.click(barre.x, barre.y); await p.waitForTimeout(300);
    check(JSON.stringify(await p.evaluate(() => window.__joue)) === JSON.stringify([barre.midi]), `un clic sur une barre fait entendre sa note (${barre.midi} ; ${JSON.stringify(await p.evaluate(() => window.__joue))})`);
    const nbLignes = () => p.evaluate(() => document.querySelectorAll('#sq-grille .sq-etiq[data-midi]').length);
    const n1 = await nbLignes();
    await p.click('#sq-reglages'); await p.waitForTimeout(300);
    await p.click('#sq-reglages-pop [data-sq-oct="haut"][data-valeur="2"]'); await p.waitForTimeout(350);
    const n2 = await nbLignes();
    check(n2 === n1 + 12, `« Octaves au-dessus » : 2 au lieu de 1 ajoute une octave de lignes (${n1} → ${n2})`);
    await p.click('#sq-reglages-pop [data-sq-oct="bas"][data-valeur="1"]'); await p.waitForTimeout(350);
    const n3 = await nbLignes();
    check(n3 === n2 + 12, `« Octaves en dessous » : 1 ajoute une octave sous la plus grave (${n2} → ${n3})`);
    await p.click('#sq-reglages-pop [data-sq-oct="haut"][data-valeur="0"]'); await p.waitForTimeout(350);
    const n4 = await nbLignes();
    check(n4 === n3 - 24, `« Octaves au-dessus » à 0 en enlève deux : la plus aiguë jouée est tout en haut (${n3} → ${n4})`);
    await p.click('#sq-reglages-pop [data-sq-oct="bas"][data-valeur="2"]'); await p.waitForTimeout(350); // (0 au-dessus + 2 dessous ≠ le réglage d'origine : Rétablir doit les changer)
    check(await p.evaluate(() => localStorage.getItem('harmohubSequenceurOctavesHaut') === '0' && localStorage.getItem('harmohubSequenceurOctavesBas') === '2'), 'les deux réglages sont retenus par appareil');
    await p.click('#sq-r-retablir'); await p.waitForTimeout(350);
    check(await nbLignes() === n1, 'Rétablir remet une octave au-dessus et cinq demi-tons en dessous');
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);

    // ======================================================================================================
    console.log('\n=== D2. Le curseur et le survol (remarques du 15/11) ===');
    await p.mouse.move(gg.x + 300, gg.y + 200); await p.mouse.wheel(0, -3000); await p.waitForTimeout(200); await p.mouse.wheel(0, 380); await p.waitForTimeout(300);
    const pos = await p.evaluate(() => { const g = document.getElementById('sq-grille').getBoundingClientRect(); const ok = (c) => { const r = c.getBoundingClientRect(); return r.top >= g.top + 70 && r.bottom <= g.bottom - 2; }; const n = [...document.querySelectorAll('#sq-grille .sq-case.on')].find(ok), v = [...document.querySelectorAll('#sq-grille .sq-case:not(.on):not(.sans-voix)[data-c="1"]')].find(ok); const m = (c) => { const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }; return { note: m(n), vide: m(v), curN: getComputedStyle(n).cursor, curV: getComputedStyle(v).cursor, bord: !!n.querySelector('.sq-bord') && getComputedStyle(n.querySelector('.sq-bord')).cursor }; });
    check(pos.curN === 'default' && pos.curV === 'cell' && pos.bord === 'ew-resize', `le curseur n'est plus un viseur : flèche sur une note (${pos.curN}), « cellule » sur une case vide (${pos.curV}), « ⇔ » sur une poignée (${pos.bord})`);
    const avantSurvol = await p.evaluate((q) => { const e = document.elementFromPoint(q.x, q.y).closest('.sq-case'); return getComputedStyle(e.querySelector('.sq-note')).filter; }, pos.note);
    await p.mouse.move(pos.note.x, pos.note.y); await p.waitForTimeout(250);
    const survol = await p.evaluate((q) => { const e = document.elementFromPoint(q.x, q.y).closest('.sq-case'); const n = e.querySelector('.sq-note'); return { filtre: getComputedStyle(n).filter, ombre: getComputedStyle(n).boxShadow }; }, pos.note);
    check(avantSurvol === 'none' && /brightness\(1\.22\)/.test(survol.filtre) && /255, 255, 255/.test(survol.ombre), `une note survolée s'éclaire légèrement et se cerne d'un fin trait (${survol.filtre})`);
    await ctx.close();

    // ======================================================================================================
    console.log('\n=== E. Le téléphone n\'a pas bougé : seulement les hauteurs utilisées ===');
    ({ p, ctx } = await ouvrir({ width: 390, height: 844 }, { hasTouch: true, isMobile: true }));
    await p.evaluate(() => localStorage.setItem('harmohubSequenceurVue', 'notes'));
    await p.reload(); await p.waitForTimeout(900);
    for (let n = 0; n < 2; n++) { const b = await p.locator('#progression-sections .grid-cell[data-index="0"]').first().boundingBox(); await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await p.waitForTimeout(600); } // un toucher choisit, le second ouvre le panneau
    const rr = await R.ouvrirRythmeTel(p);
    exiger(rr.ok, `le séquenceur du téléphone s'ouvre (${rr.detail})`);
    const tel = await p.evaluate(() => ({ vue: window.app.sequenceur.vue, lignes: document.querySelectorAll('#sq-grille .sq-etiq').length, touches: document.querySelectorAll('#sq-grille .sq-etiq.touche, #sq-grille .sq-etiq[data-midi]').length, ov: document.getElementById('sq-grille').style.overflowY, corps: (() => { const c = document.querySelector('#panneau-accord .pa-corps'); return c.scrollHeight - c.clientHeight; })() }));
    const attendu = await p.evaluate(() => { const t = new Set(); loadProgressionSections()[0].chords.forEach(d => SequenceurHarmo.voixDe(d).voix.forEach(x => t.add(x.midi))); return t.size; });
    // RÉÉCRIT À L9c (15/11) : huit lignes de 43 px ne tiennent pas dans le panneau d'accord à 390 × 844 ; c'est maintenant la GRILLE qui défile (règle et noms d'accords collés en haut, voir
    // telephone_regle_collee) au lieu de tout le panneau. Les lignes restent « seulement les hauteurs utilisées », sans touches de piano.
    check(tel.vue === 'notes' && tel.lignes === attendu && tel.touches === 0 && tel.ov === 'auto' && tel.corps <= 1, `téléphone : ${tel.lignes} lignes (les ${attendu} hauteurs utilisées), pas de touches, la grille défile d'elle-même (${tel.ov}) et non le panneau (${tel.corps} px de trop)`);
    await ctx.close();

    check(erreurs.length === 0, `aucune erreur JavaScript (${erreurs.length ? erreurs.join(' | ') : 'aucune'})`);
    await nav.close();
    bilan();
})().catch((err) => { console.error('FATAL', err); process.exit(2); });
