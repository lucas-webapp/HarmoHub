// LOT 10d DE LA REFONTE — le panneau d'accord du TÉLÉPHONE (docs/refonte.md, section « Téléphone » ; maquette « Téléphone (v2) »,
// page project/Telephone2.dc.html ; CLAUDE-HARMOHUB.md, « Lot 10 »).
//
// « Toucher une case → panneau à mi-hauteur, l'accord visible au-dessus ; contenu de la bulle (‹ ›, fondamentales 2 × 6, type, durée) puis
// "Réglages du son" = contenu de l'inspecteur ; Supprimer, Dupliquer ; une annulation par panneau. » Il remplace sous 900px la carte Accord dans
// la page et le mode Modification (et son dock de secours de 45px au-dessus de la barre de lecture).
//
// Ce que le banc tient, par de VRAIS gestes (toucher, clavier) — window.app ne sert qu'à relire l'état :
//   A. toucher une case : le panneau se pose sur la barre de lecture, à mi-hauteur, la case reste visible au-dessus ; 12 fondamentales en 2 × 6,
//      les types, la durée ; 44px et 7px ; rien n'est modifié par le toucher lui-même (le clic fantôme) ; pas de mode Modification ;
//   B. les réglages écrivent l'accord, une seule annulation pour tout le panneau ;
//   C. ‹ › passent au voisin (la sélection suit), un autre panneau = une autre annulation ; toucher une autre case l'y amène ;
//   D. « Réglages du son » : le panneau s'agrandit, l'accord est en modification, la carte Accord (l'inspecteur) est DANS le panneau, sans
//      fondamentale/type/durée ; la basse ; l'octave ; toujours une seule annulation ; « Moins » rend la carte à la page ;
//   E. le double toucher hors du nom agrandit le panneau (il ouvrait la carte Accord) ; agrandi, il suit une autre case et reste agrandi ;
//      le dock de secours de la Modification a disparu ;
//   F. Supprimer et Dupliquer, chacun d'une seule annulation ;
//   G. ✕, Échap et le toucher à côté le referment ; agrandi, le refermer termine la modification ;
//   H. le verre : le fond des menus, aucun texte illisible ;
//   I. 320px : tout tient ;
//   J. l'ordinateur n'a pas bougé (bulle, inspecteur), et franchir le seuil ne perd pas la modification en cours.
const { chromium } = require('playwright');
const V = require('./_verre_commun');
const { check, exiger, plan, bilan } = require('./_harness')('téléphone : panneau d\'accord (lot 10d)');
const { estBruitReseau } = require('./_harness');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';

plan(37);

const mk = (root, quality) => ({ root, quality, beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
const SECTIONS = [
    { title: 'Couplet', chords: ['C', 'A', 'F', 'G', 'C', 'A', 'D', 'G'].map((r, i) => mk(r, i % 2 ? 'min' : 'maj7')) },
    { title: 'Refrain', chords: [mk('F', 'maj'), mk('G', 'maj'), mk('E', 'min7'), mk('A', 'min')] },
];

async function ouvrir(nav, contexte, erreurs, nom, reglages = {}) {
    const ctx = await nav.newContext(contexte);
    await ctx.addInitScript(([sections, reglages]) => {
        if (sessionStorage.getItem('banc-10d')) return;
        sessionStorage.setItem('banc-10d', '1');
        localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Ballade', bpm: 120, timeSig: '4/4', groove: 'straight', savedAt: Date.now(), sections }]));
        localStorage.setItem('harmohubCurrentSongId', 's1');
        localStorage.setItem('myProgression', JSON.stringify({ sections }));
        for (const k of Object.keys(reglages)) localStorage.setItem(k, reglages[k]);
    }, [SECTIONS, reglages]);
    await ctx.route(/gstatic\.com|googleapis\.com|tonejs\.github\.io/, r => r.abort());
    const p = await ctx.newPage();
    p.on('pageerror', e => erreurs.push(nom + e.message));
    p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !V.BRUIT.test(m.text())) erreurs.push(nom + 'console: ' + m.text()); });
    await p.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await p.waitForFunction(() => !!window.app);
    await p.waitForTimeout(800);
    return { p, ctx };
}

const TEL = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 };
const CASE = (s, i) => `#progression-sections .grid-cell[data-section="${s}"][data-index="${i}"]`;
const toucher = async (p, sel, ms = 300) => { await p.tap(sel); await p.waitForTimeout(ms); };
// Toucher une case HORS de son nom (la rangée d'octave, en bas de la case) : le second toucher y veut dire « modifier », sur le nom « renommer ».
const toucherBas = async (p, sel, ms = 300) => {
    const b = await p.locator(sel).boundingBox();
    await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height - 6);
    await p.waitForTimeout(ms);
};
const etat = (p) => p.evaluate(() => {
    const a = window.app, pa = document.getElementById('panneau-accord');
    const z = a._bulle;
    return {
        ouvert: !pa.hidden && pa.getBoundingClientRect().height > 0, etendu: !!(z && z.etendu), sur: z ? [z.section, z.index] : null,
        edit: a.editingIndex, sel: [a.activeSection, a.selectedIndex], mode: document.body.dataset.appMode,
        carte: document.getElementById('accord-card').parentElement.id || document.getElementById('accord-card').parentElement.className,
        undo: a.undoStack.length, secs: JSON.parse(localStorage.getItem('myProgression')).sections,
    };
});
const accord = (e, s, i) => e.secs[s].chords[i];

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    try {
        const { p, ctx } = await ouvrir(nav, TEL, erreurs, 'téléphone : ');
        const e0 = await etat(p);

        // ===== A. TOUCHER UNE CASE ==================================================================================================
        await toucher(p, CASE(1, 2), 500);
        const a1 = await etat(p);
        exiger(a1.ouvert && JSON.stringify(a1.sur) === '[1,2]', `toucher une case ouvre le panneau d'accord sur elle (${JSON.stringify(a1.sur)})`);
        const g = await p.evaluate((sel) => {
            const pa = document.getElementById('panneau-accord').getBoundingClientRect(), bl = document.getElementById('barre-lecture').getBoundingClientRect();
            const c = document.querySelector(sel).getBoundingClientRect(), haut = document.querySelector('.top-bar').getBoundingClientRect().bottom;
            return { bas: Math.round(pa.bottom), barre: Math.round(bl.top), h: Math.round(pa.height), ih: innerHeight, l: Math.round(pa.left), r: Math.round(pa.right),
                caseHaut: Math.round(c.top), caseBas: Math.round(c.bottom), paHaut: Math.round(pa.top), barreHaut: Math.round(haut),
                rayon: getComputedStyle(document.getElementById('panneau-accord')).borderTopLeftRadius };
        }, CASE(1, 2));
        check(Math.abs(g.bas - g.barre) <= 1 && g.l === 0 && g.r === 390 && g.rayon === '12px', `posé sur la barre de lecture, pleine largeur, 12px d'arrondi (${JSON.stringify(g)})`);
        check(g.h <= 0.6 * g.ih && g.h >= 300, `à mi-hauteur : ${g.h}px sur ${g.ih}`);
        check(g.caseBas <= g.paHaut && g.caseHaut >= g.barreHaut, `la case touchée reste visible au-dessus du panneau (case ${g.caseHaut}-${g.caseBas}, entre ${g.barreHaut} et ${g.paHaut})`);
        const c = await p.evaluate(() => {
            const q = (s) => [...document.querySelectorAll(s)];
            const f = q('#pa-quel [data-bulle="root"]');
            const rangs = new Set(f.map(b => Math.round(b.getBoundingClientRect().top)));
            return { n: f.length, rangs: rangs.size, parRang: f.filter(b => Math.round(b.getBoundingClientRect().top) === Math.round(f[0].getBoundingClientRect().top)).length,
                choisi: (f.find(b => b.getAttribute('aria-pressed') === 'true') || {}).textContent, types: q('#pa-quel [data-bulle="quality"]').length,
                typeChoisi: (q('#pa-quel [data-bulle="quality"]').find(b => b.getAttribute('aria-pressed') === 'true') || {}).dataset,
                duree: (document.querySelector('#pa-quel .pa-duree') || {}).textContent, nom: (document.querySelector('#pa-quel .pa-nom') || {}).textContent,
                basse: q('#pa-quel [data-bulle="bass"]').length };
        });
        check(c.n === 12 && c.rangs === 2 && c.parRang === 6 && c.choisi === 'E' && c.types >= 17 && c.typeChoisi && c.typeChoisi.valeur === 'min7' && /mesure/.test(c.duree) && c.nom === 'Em7' && c.basse === 0,
            `la bulle à la jauge du téléphone : 12 fondamentales en 2 × 6, les types, la durée ; la basse attend les réglages du son (${JSON.stringify(c)})`);
        const tailles = await p.evaluate(() => [...document.querySelectorAll('#panneau-accord .pa-nav, #panneau-accord .pa-actions button')].map(b => {
            const r = b.getBoundingClientRect(); return { id: b.id || b.dataset.bulle, h: Math.round(r.height), w: Math.round(r.width), rayon: getComputedStyle(b).borderTopLeftRadius, dedans: r.left >= 0 && r.right <= innerWidth + 0.5 && b.scrollWidth <= b.clientWidth + 1 };
        }));
        check(tailles.length === 6 && tailles.every(t => t.h === 44 && t.rayon === '7px' && t.dedans) && tailles.filter(t => t.id !== 'pa-son-btn').every(t => t.w === 44),
            `‹ › ✕ Supprimer Dupliquer carrés de 44px (logos), Réglages du son de 44px, angles de 7px, tous entiers dans l'écran (${JSON.stringify(tailles)})`);
        check(JSON.stringify(a1.secs) === JSON.stringify(e0.secs) && a1.undo === e0.undo && a1.mode !== 'edit' && a1.edit == null && JSON.stringify(a1.sel) === '[1,2]',
            `le toucher n'a rien modifié (le clic de synthèse ne tombe pas sur le panneau), l'accord est sélectionné, pas en modification (${a1.mode})`);

        // ===== B. LES RÉGLAGES, UNE SEULE ANNULATION ================================================================================
        await toucher(p, '#pa-quel [data-bulle="root"][data-valeur="D"]');
        await toucher(p, '#pa-quel [data-bulle="quality"][data-valeur="dom7"]');
        await toucher(p, '#pa-quel [data-bulle="duree-plus"]');
        const b1 = await etat(p);
        const ch = accord(b1, 1, 2);
        check(ch.root === 'D' && ch.quality === 'dom7' && ch.beats === 5 && await p.evaluate(() => document.querySelector('#pa-quel .pa-nom').textContent) === 'D7',
            `fondamentale, type et durée écrivent l'accord, le panneau suit (${JSON.stringify({ root: ch.root, q: ch.quality, beats: ch.beats })})`);
        check(b1.undo === e0.undo + 1, `trois réglages, UNE annulation (${b1.undo - e0.undo})`);
        await toucher(p, '#global-undo-btn', 400);
        const b2 = await etat(p);
        check(JSON.stringify(accord(b2, 1, 2)) === JSON.stringify(accord(e0, 1, 2)), `Annuler rend l'accord d'avant le panneau d'un coup (${JSON.stringify(accord(b2, 1, 2))})`);

        // ===== C. ‹ › ET UNE AUTRE CASE ==============================================================================================
        await toucher(p, CASE(1, 2), 400);
        await toucher(p, '#pa-quel [data-bulle="suiv"]');
        const c1 = await etat(p);
        check(JSON.stringify(c1.sur) === '[1,3]' && JSON.stringify(c1.sel) === '[1,3]' && await p.evaluate(() => document.querySelector('#pa-quel .pa-nom').textContent) === 'Am',
            `› passe à l'accord suivant, la sélection suit (${JSON.stringify({ sur: c1.sur, sel: c1.sel })})`);
        await toucher(p, '#pa-quel [data-bulle="prec"]');
        await toucher(p, '#pa-quel [data-bulle="root"][data-valeur="B"]');
        await toucher(p, '#pa-quel [data-bulle="suiv"]');
        await toucher(p, '#pa-quel [data-bulle="root"][data-valeur="C"]');
        const c2 = await etat(p);
        check(accord(c2, 1, 2).root === 'B' && accord(c2, 1, 3).root === 'C' && c2.undo === c1.undo + 2, `deux accords retouchés par ‹ ›, deux panneaux, deux annulations (${c2.undo - c1.undo})`);
        await toucher(p, CASE(1, 0), 400);
        const c3 = await etat(p);
        check(c3.ouvert && JSON.stringify(c3.sur) === '[1,0]' && JSON.stringify(c3.sel) === '[1,0]', `toucher une autre case y amène le panneau, sans le refermer (${JSON.stringify(c3.sur)})`);

        // ===== D. RÉGLAGES DU SON ====================================================================================================
        await toucher(p, '#pa-son-btn', 500);
        const d1 = await etat(p);
        const d1v = await p.evaluate(() => {
            const vu = (s) => { const e = document.querySelector(s); return !!e && e.getBoundingClientRect().height > 0; };
            const pa = document.getElementById('panneau-accord').getBoundingClientRect();
            return { octave: vu('#pa-son #octave-value'), voicing: vu('#pa-son #voicing-row'), grille: vu('#pa-son .accord-grid'), tete: vu('#pa-son #accord-card > .card-head'),
                basseListe: vu('#pa-son #bass'), basse: document.querySelectorAll('#pa-quel [data-bulle="bass"]').length, btn: document.getElementById('pa-son-btn').textContent,
                exp: document.getElementById('pa-son-btn').getAttribute('aria-expanded'), haut: Math.round(pa.top), h: Math.round(pa.height),
                caseBas: Math.round(document.querySelector('#progression-sections .grid-cell[data-section="1"][data-index="0"]').getBoundingClientRect().bottom) };
        });
        check(d1.etendu && d1.mode === 'edit' && d1.edit === 0 && d1.carte === 'pa-son', `« Réglages du son » agrandit le panneau : l'accord est en modification, la carte Accord est dans le panneau (${JSON.stringify({ mode: d1.mode, carte: d1.carte })})`);
        check(d1v.octave && d1v.voicing && !d1v.grille && !d1v.tete && !d1v.basseListe && d1v.basse === 13 && d1v.btn === 'Moins' && d1v.exp === 'true',
            `le contenu de l'inspecteur (octave, renversement, drop) sans fondamentale / type / durée ni en-tête, la basse en 13 choix, « Moins » (${JSON.stringify(d1v)})`);
        check(d1v.h >= g.h && d1v.caseBas <= d1v.haut, `agrandi (${d1v.h}px), il laisse encore voir la case (${d1v.caseBas} ≤ ${d1v.haut})`);
        await toucher(p, '#pa-quel [data-bulle="bass"][data-valeur="A"]');
        await toucher(p, '#pa-son #voicing-row [data-octave-step="1"]');
        const d2 = await etat(p);
        check(accord(d2, 1, 0).bass === 'A' && +accord(d2, 1, 0).octave === 4 && d2.undo === d1.undo + 1,
            `la basse (panneau) et l'octave (carte) écrivent l'accord, toujours une seule annulation (${JSON.stringify({ basse: accord(d2, 1, 0).bass, oct: accord(d2, 1, 0).octave, n: d2.undo - d1.undo })})`);
        await toucher(p, '#pa-son-btn', 500);
        const d3 = await etat(p);
        check(d3.ouvert && !d3.etendu && d3.mode !== 'edit' && d3.carte !== 'pa-son' && JSON.stringify(d3.sur) === '[1,0]', `« Moins » : le panneau reste, la modification se termine, la carte retourne dans la page (${d3.carte})`);
        await toucher(p, '#pa-quel [data-bulle="root"][data-valeur="G"]');
        check((await etat(p)).undo === d1.undo + 1, 'retoucher la fondamentale après « Moins » : c\'est le même panneau, la même annulation');

        // ===== E. LE DOUBLE TOUCHER, ET AGRANDI IL SUIT LA SÉLECTION ==================================================================
        await p.keyboard.press('Escape'); await p.waitForTimeout(250); // le panneau ouvert couvrirait la case visée
        // La case en BAS de l'écran, sous la place du panneau : le premier toucher ouvre le panneau et fait défiler la page, le second tombe sur le
        // panneau — le doigt, lui, n'a pas bougé. Les deux touchers au même point, comme un vrai pouce.
        await p.evaluate((s) => { const c = document.querySelector(s); window.scrollBy(0, c.getBoundingClientRect().bottom - (innerHeight - 90)); }, CASE(0, 4)); await p.waitForTimeout(200);
        const bas = await p.locator(CASE(0, 4)).boundingBox();
        exiger(bas.y > 300, `la case visée est sous la place du panneau (${Math.round(bas.y)})`);
        await p.touchscreen.tap(bas.x + bas.width / 2, bas.y + bas.height - 6); await p.waitForTimeout(120);
        await p.touchscreen.tap(bas.x + bas.width / 2, bas.y + bas.height - 6); await p.waitForTimeout(500);
        const e1 = await etat(p);
        check(e1.etendu && e1.edit === 4 && e1.sel[0] === 0 && e1.carte === 'pa-son' && JSON.stringify(accord(e1, 0, 4)) === JSON.stringify(accord(e0, 0, 4)),
            `le double toucher hors du nom agrandit le panneau (il ouvrait la carte Accord), sans rien changer à l'accord (${JSON.stringify({ edit: e1.edit, etendu: e1.etendu })})`);
        const dock = await p.evaluate(() => ['dock-terminer', 'dock-rythme'].map(id => { const e = document.getElementById(id); return !e.hidden && e.getBoundingClientRect().height > 0; }));
        check(dock.every(v => !v), `le dock de secours de la Modification n'est plus là : le panneau porte ses sorties (${JSON.stringify(dock)})`);
        await toucher(p, CASE(0, 5), 500);
        const e2 = await etat(p);
        check(e2.etendu && e2.edit === 5 && JSON.stringify(e2.sur) === '[0,5]' && e2.carte === 'pa-son', `agrandi, toucher une autre case y amène la modification sans réduire le panneau (${JSON.stringify(e2.sur)})`);

        // ===== F. SUPPRIMER, DUPLIQUER ===============================================================================================
        await toucher(p, '#pa-son-btn', 400);
        await toucher(p, '#pa-quel [data-bulle="quality"][data-valeur="sus4"]');
        const f0 = await etat(p);
        await toucher(p, '#pa-dupliquer', 500);
        const f1 = await etat(p);
        check(f1.secs[0].chords.length === f0.secs[0].chords.length + 1 && accord(f1, 0, 6).quality === 'sus4' && JSON.stringify(f1.sur) === '[0,6]' && f1.undo === f0.undo,
            `Dupliquer pose la copie juste après, le panneau la suit ; retouche + copie = toujours la même annulation (${JSON.stringify({ sur: f1.sur, n: f1.undo - f0.undo })})`);
        const n0 = (await etat(p)).undo;
        await toucher(p, '#pa-supprimer', 500);
        const f2 = await etat(p);
        check(!f2.ouvert && f2.secs[0].chords.length === f0.secs[0].chords.length && f2.undo === n0 + 1, `Supprimer retire l'accord et referme le panneau, une annulation (${f2.undo - n0})`);
        await toucher(p, '#global-undo-btn', 400);
        check((await etat(p)).secs[0].chords.length === f1.secs[0].chords.length, 'Annuler ramène l\'accord supprimé');

        // ===== G. TROIS FAÇONS DE REFERMER ===========================================================================================
        await toucher(p, CASE(0, 1), 400);
        await toucher(p, '#pa-quel [data-bulle="fermer"]');
        const g1 = await etat(p);
        await toucher(p, CASE(0, 1), 400);
        await p.keyboard.press('Escape'); await p.waitForTimeout(250);
        const g2 = await etat(p);
        await toucher(p, CASE(0, 1), 400);
        await toucher(p, '.prog-section-measures');
        const g3 = await etat(p);
        check(!g1.ouvert && !g2.ouvert && !g3.ouvert, `✕, Échap et le toucher à côté referment le panneau (${[g1.ouvert, g2.ouvert, g3.ouvert]})`);
        await toucher(p, CASE(0, 1), 400);
        await toucher(p, '#pa-son-btn', 400);
        await toucher(p, '#pa-quel [data-bulle="fermer"]', 400);
        const g4 = await etat(p);
        check(!g4.ouvert && g4.mode !== 'edit' && g4.edit == null && g4.carte !== 'pa-son', `agrandi, le refermer termine la modification et rend la carte à la page (${g4.mode}, ${g4.carte})`);
        // Le petit séquenceur de la carte s'ouvre DANS le panneau agrandi (il fait partie des réglages du son).
        await toucher(p, CASE(0, 2), 400);
        await toucher(p, '#pa-son-btn', 400);
        await toucher(p, '#pa-son #seq-zoom', 600);
        const g5 = await p.evaluate(() => ({ ouvert: !document.getElementById('panneau-accord').hidden, seq: window.app.seqMode, dans: !!document.querySelector('#pa-son #arp-sequencer'),
            vu: document.getElementById('arp-sequencer').getBoundingClientRect().height > 0 }));
        check(g5.ouvert && g5.seq === 'compact' && g5.dans && g5.vu, `« Séquenceur » ouvre le séquenceur de l'accord dans le panneau agrandi (${JSON.stringify(g5)})`);
        await toucher(p, '#pa-quel [data-bulle="fermer"]', 400);
        check(erreurs.length === 0, `aucune erreur JavaScript au téléphone (${erreurs.length}) ${erreurs.slice(0, 2).join(' | ')}`);
        await ctx.close();

        // ===== H. LE VERRE ===========================================================================================================
        {
            const off = await ouvrir(nav, TEL, erreurs, 'verre éteint : ');
            const on = await ouvrir(nav, TEL, erreurs, 'verre allumé : ', { 'harmohub.glass.v1': '1' });
            for (const pg of [off.p, on.p]) { await toucher(pg, CASE(0, 1), 500); await toucher(pg, '#pa-son-btn', 500); }
            const fond = (pg) => pg.evaluate(() => { const cs = getComputedStyle(document.getElementById('panneau-accord')); return cs.backgroundColor + ' ' + cs.backdropFilter; });
            const [fOff, fOn] = [await fond(off.p), await fond(on.p)];
            check(fOff !== fOn && /blur/.test(fOn), `verre allumé : le panneau prend le fond dépoli des menus (${fOff} → ${fOn})`);
            const zone = (pg) => pg.evaluate(() => [...document.querySelectorAll('#panneau-accord *')].map(e => e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/)[0] : '')));
            const cles = new Set(await zone(on.p));
            const a = (await V.contrastesFaibles(off.p)).filter(f => cles.has(f.cle.split('|')[0])), b = (await V.contrastesFaibles(on.p)).filter(f => cles.has(f.cle.split('|')[0]));
            const nouveaux = b.filter(f => !a.some(x => x.cle === f.cle));
            check(nouveaux.length === 0, `aucun texte du panneau ne devient illisible verre allumé (${nouveaux.length}${nouveaux.length ? ' : ' + JSON.stringify(nouveaux.slice(0, 3)) : ''})`);
            await off.ctx.close(); await on.ctx.close();
        }

        // ===== I. 320px ==============================================================================================================
        {
            // Ouvert à 390px puis l'écran rétréci : à 320px, une case ne fait que 60px et le ciblage tactile de Chromium attire le toucher vers la
            // poignée de durée (22px de chaque côté) — défaut d'avant ce lot, noté dans docs/dette-tests.md, qu'on ne veut pas confondre avec celui-ci.
            const { p, ctx } = await ouvrir(nav, TEL, erreurs, '320px : ');
            await toucher(p, CASE(0, 1), 500);
            await p.setViewportSize({ width: 320, height: 640 }); await p.waitForTimeout(500);
            const t = await p.evaluate(() => {
                const pa = document.getElementById('panneau-accord'), r = pa.getBoundingClientRect();
                const dehors = [...pa.querySelectorAll('button')].filter(b => { const q = b.getBoundingClientRect(); return q.width > 0 && (q.left < 0 || q.right > innerWidth + 0.5); }).length;
                const coupes = [...pa.querySelectorAll('.pa-actions button, #pa-quel [data-bulle="root"]')].filter(b => b.scrollWidth > b.clientWidth + 1).length;
                const c = document.querySelector('#progression-sections .grid-cell[data-section="0"][data-index="1"]').getBoundingClientRect();
                return { dehors, coupes, debord: document.documentElement.scrollWidth - document.documentElement.clientWidth, h: Math.round(r.height), caseBas: Math.round(c.bottom), haut: Math.round(r.top) };
            });
            check(t.dehors === 0 && t.coupes === 0 && t.debord <= 0 && t.caseBas <= t.haut, `à 320px tout tient, rien n'est coupé, la case reste visible (${JSON.stringify(t)})`);
            await ctx.close();
        }

        // ===== J. L'ORDINATEUR N'A PAS BOUGÉ, ET LE SEUIL NE PERD RIEN =================================================================
        {
            const { p, ctx } = await ouvrir(nav, { viewport: { width: 1320, height: 820 } }, erreurs, 'ordinateur : ');
            await p.click(CASE(0, 1)); await p.waitForTimeout(400);
            const o1 = await p.evaluate(() => ({ bulle: !document.getElementById('bulle-accord').hidden, panneau: document.getElementById('panneau-accord').getBoundingClientRect().height }));
            check(o1.bulle && o1.panneau === 0, `ordinateur : un clic ouvre la bulle, jamais le panneau du téléphone (${JSON.stringify(o1)})`);
            await p.click('#bulle-accord [data-bulle="son"]'); await p.waitForTimeout(400);
            const o2 = await p.evaluate(() => ({ mode: document.body.dataset.appMode, carte: document.getElementById('accord-card').parentElement.className,
                inspecteur: document.querySelector('.sidebar-frame').getBoundingClientRect().width }));
            check(o2.mode === 'edit' && /panel-controls/.test(o2.carte) && o2.inspecteur > 300, `et « Réglages du son » ouvre l'inspecteur à droite, la carte à sa place (${JSON.stringify(o2)})`);
            await ctx.close();
        }
        {
            const { p, ctx } = await ouvrir(nav, TEL, erreurs, 'seuil : ');
            await toucher(p, CASE(0, 2), 500);
            await toucher(p, '#pa-son-btn', 500);
            const avant = await etat(p);
            await p.setViewportSize({ width: 1320, height: 820 }); await p.waitForTimeout(500);
            const apres = await etat(p);
            const insp = await p.evaluate(() => document.querySelector('.sidebar-frame').getBoundingClientRect().width);
            check(avant.carte === 'pa-son' && !apres.ouvert && apres.edit === 2 && apres.mode === 'edit' && /panel-controls/.test(apres.carte) && insp > 300,
                `panneau agrandi puis fenêtre élargie : le panneau s'efface, la modification continue dans l'inspecteur (${JSON.stringify({ avant: avant.carte, edit: apres.edit, carte: apres.carte })})`);
            await ctx.close();
        }
        check(erreurs.length === 0, `aucune erreur JavaScript nulle part (${erreurs.length}) ${erreurs.slice(0, 2).join(' | ')}`);
    } finally { await nav.close(); }
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
