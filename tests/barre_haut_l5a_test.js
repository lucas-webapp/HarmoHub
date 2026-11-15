// L5a — BARRE DU HAUT : Enregistrer, « Fichiers », tonalité courte, onglets, bord gauche (refonte, lettres D, H et I.1 des décisions des 13 et 14/11).
//
// CE QUE DEMANDE L'UTILISATEUR (docs/decisions-13-14-11.md) :
//   - « les boutons à gauche de la barre d'outils doivent être placés sur le bord gauche, aligné avec le logo HarmoHub » : la rangée de réglages, la barre
//     du séquenceur et la barre de lecture commencent toutes à 26 px, à 1920 px comme à 1280 px (`main` n'est plus plafonné ni centré) ;
//   - Enregistrer : logo seul, fond ORANGE quand il y a des modifications non enregistrées, retour au vert une fois enregistré ;
//   - « Fichier » devient « Fichiers » (l'ordinateur seulement : le téléphone attend le lot 7) ;
//   - la tonalité tient en notation internationale courte sur la puce : « C », « Am », « B♭ », « D dor » (nom complet en infobulle) ;
//   - onglets Grille / Structure / Paroles à 132 px au moins, séparés d'un fin trait qui s'efface sous l'onglet actif et au survol ; par paliers
//     (132 / 112 / 104 px, puis largeur naturelle) quand l'écran se resserre, et la pastille du compte plafonnée : jamais de recouvrement d'« Annuler ».
// CE QUE LE BANC TIENT : de vrais gestes (clics, survol à la souris), l'état relu dans la page ; le téléphone n'a pas bougé.
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('barre du haut, L5a');
const { estBruitReseau } = require('./_harness');

plan(69);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const graine = () => {
    const mk = (r, q, b = 4) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
    const S = [
        { title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7'), mk('D', 'min7'), mk('G', 'dom7')] },
        { title: 'Refrain', chords: [mk('F', 'maj7'), mk('E', 'min7')] },
    ];
    localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), sections: S }]));
    localStorage.setItem('harmohubCurrentSongId', 's1');
    localStorage.setItem('myProgression', JSON.stringify({ sections: S }));
    sessionStorage.setItem('cc_accueil_vu', '1');
};

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    const ouvrir = async (width, height = 900) => {
        const p = await nav.newPage({ viewport: { width, height } });
        p.on('pageerror', e => erreurs.push(e.message));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) erreurs.push('console: ' + m.text()); });
        await p.goto(`${BASE}/index.html`);
        await p.evaluate(graine);
        await p.reload();
        await p.waitForTimeout(900);
        return p;
    };
    const gauche = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? Math.round(r.left * 10) / 10 : null; }, sel);
    const largeur = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().width * 10) / 10 : null; }, sel);
    const puce = (p) => p.evaluate(() => ({ val: document.querySelector('#rr-tonalite .rr-val').textContent, titre: document.getElementById('rr-tonalite').title }));
    const choisir = async (p, action, valeur) => { await p.click(`#rr-pop [data-rr-action="${action}"][data-rr-valeur="${valeur}"]`); await p.waitForTimeout(250); };

    // ======================================================================================================
    console.log('\n=== A. Bord gauche commun à 26 px, du petit au très grand écran ===');
    for (const w of [1280, 1920]) {
        const p = await ouvrir(w);
        // Le séquenceur s'ouvre par son vrai bouton ; sa barre d'outils est le repère de sa rangée.
        await p.click('#vue-sequenceur'); await p.waitForTimeout(500);
        const g = await p.evaluate(() => {
            const prem = (host, filtre) => { const e = [...host.children].filter(filtre).map(c => Math.round(c.getBoundingClientRect().left * 10) / 10).filter(x => x > 0); return e.length ? Math.min(...e) : null; };
            const vis = (c) => c.getBoundingClientRect().width > 0;
            return {
                rangee: prem(document.getElementById('rangee-reglages'), vis),
                lecture: prem(document.getElementById('barre-lecture'), vis),
                outils: prem(document.querySelector('#sequenceur .sq-outils'), vis),
                main: Math.round(document.querySelector('main').getBoundingClientRect().left),
                ouvert: !document.getElementById('sequenceur').hidden,
            };
        });
        exiger(g.ouvert, `${w} px : le séquenceur s'ouvre (un vrai clic)`);
        check(g.rangee === 26, `${w} px : la rangée de réglages commence à 26 px (${g.rangee})`);
        check(g.lecture === 26, `${w} px : la barre de lecture commence à 26 px (${g.lecture})`);
        check(g.outils === 26, `${w} px : la barre du séquenceur commence à 26 px (${g.outils})`);
        check(g.main === 0, `${w} px : la colonne est calée à gauche, plus centrée (main à ${g.main} px)`);
        await p.close();
    }
    {
        // Le dessin du logo (le vrai repère visuel) est dans le même alignement, à 4 px près (son bouton est à 16 px).
        const p = await ouvrir(1440);
        const l = await gauche(p, '.top-bar .logo-mark');
        check(Math.abs(l - 26) <= 4, `le dessin du logo est sur la verticale commune (à ${l} px)`);
        await p.close();
    }

    // ======================================================================================================
    console.log('\n=== B. Enregistrer : logo seul, fond orange tant qu\'il y a des modifications ===');
    let p = await ouvrir(1440);
    const save0 = await p.evaluate(() => {
        const b = document.getElementById('tb-save'), r = b.getBoundingClientRect(), mot = b.querySelector('.tb-save-mot');
        return { w: Math.round(r.width), h: Math.round(r.height), motVisible: mot.getBoundingClientRect().width > 0, modifie: b.dataset.modifie, bg: getComputedStyle(b).backgroundImage, titre: b.title, nom: b.getAttribute('aria-label') };
    });
    check(save0.w === 32 && save0.h === 32 && !save0.motVisible, `Enregistrer est un carré de 32 px, sans mot (${save0.w}×${save0.h}, mot ${save0.motVisible ? 'visible' : 'caché'})`);
    check(save0.modifie === '0' && !/92, 64, 35/.test(save0.bg), 'rien à enregistrer : pas d\'orange');
    check(save0.nom === 'Enregistrer' && /Enregistrer/.test(save0.titre), `le nom reste dit : « ${save0.nom} », infobulle « ${save0.titre} »`);
    await p.click('#rr-transposer-haut'); await p.waitForTimeout(400);
    const save1 = await p.evaluate(() => { const b = document.getElementById('tb-save'); return { modifie: b.dataset.modifie, bg: getComputedStyle(b).backgroundImage, bord: getComputedStyle(b).borderTopColor, titre: b.title }; });
    check(save1.modifie === '1' && /92, 64, 35/.test(save1.bg), `une modification (clic sur Transposer ↑) : le fond devient orange (${save1.modifie})`);
    check(/modifications/.test(save1.titre), `l'infobulle le dit : « ${save1.titre} »`);
    await p.click('#tb-save'); await p.waitForTimeout(500);
    const save2 = await p.evaluate(() => { const b = document.getElementById('tb-save'); return { modifie: b.dataset.modifie, bg: getComputedStyle(b).backgroundImage, titre: b.title }; });
    check(save2.modifie === '0' && !/92, 64, 35/.test(save2.bg), `un clic sur Enregistrer : retour au vert (${save2.modifie})`);
    check(save2.titre === 'Enregistrer (Ctrl+S)', 'et l\'infobulle redevient « Enregistrer (Ctrl+S) »');

    // ======================================================================================================
    console.log('\n=== C. « Fichiers » à l\'ordinateur ===');
    const fich = await p.evaluate(() => ({ mot: document.querySelector('#file-menu-btn .btn-label').textContent, haut: !!document.querySelector('.top-bar .tb-gauche > #file-menu-btn') }));
    check(fich.mot === 'Fichiers' && fich.haut, `le bouton de la barre du haut s'appelle « ${fich.mot} »`);
    await p.click('#file-menu-btn'); await p.waitForTimeout(300);
    check(await p.evaluate(() => { const m = document.getElementById('file-menu'); return !!m && !m.hidden; }), 'et il ouvre toujours son menu (un vrai clic)');
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);

    // ======================================================================================================
    console.log('\n=== D. Tonalité courte sur la puce ===');
    await p.close();
    p = await ouvrir(1440); // page neuve : B a transposé le morceau
    const t0 = await puce(p);
    check(t0.val === 'C' && /C majeur/.test(t0.titre), `C majeur se lit « ${t0.val} », le nom complet est dans l'infobulle`);
    await p.click('#rr-tonalite'); await p.waitForTimeout(250);
    await choisir(p, 'tonique', 'A'); await choisir(p, 'mode', 'min');
    const t1 = await puce(p);
    check(t1.val === 'Am' && /A mineur/.test(t1.titre), `A mineur se lit « ${t1.val} » (${t1.titre.slice(0, 30)}…)`);
    await choisir(p, 'tonique', 'D'); await choisir(p, 'mode', 'dorian');
    check((await puce(p)).val === 'D dor', `D dorien se lit « ${(await puce(p)).val} »`);
    await choisir(p, 'tonique', 'E'); await choisir(p, 'mode', 'phrygian');
    check((await puce(p)).val === 'E phr', `E phrygien se lit « ${(await puce(p)).val} »`);
    await choisir(p, 'tonique', 'F'); await choisir(p, 'mode', 'lydian');
    check((await puce(p)).val === 'F lyd', `F lydien se lit « ${(await puce(p)).val} »`);
    await choisir(p, 'tonique', 'G'); await choisir(p, 'mode', 'mixolydian');
    check((await puce(p)).val === 'G mix', `G mixolydien se lit « ${(await puce(p)).val} »`);
    await choisir(p, 'tonique', 'B'); await choisir(p, 'mode', 'locrian');
    check((await puce(p)).val === 'B loc', `B locrien se lit « ${(await puce(p)).val} »`);
    await choisir(p, 'tonique', 'A#'); await choisir(p, 'mode', 'maj');
    check((await puce(p)).val === 'B♭', `la tonalité de B♭ majeur se lit « ${(await puce(p)).val} » (♭ et non « b »)`);
    await choisir(p, 'tonique', 'F#'); await choisir(p, 'mode', 'min');
    check((await puce(p)).val === 'F♯m', `F♯ mineur se lit « ${(await puce(p)).val} »`);
    const pleine = await p.evaluate(() => window.app.libelleTonalite());
    check(/mineur/.test(pleine), `le nom complet reste disponible pour l'impression et les menus (« ${pleine} »)`);
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    await p.close();

    // ======================================================================================================
    console.log('\n=== E. Onglets : 132 px, par paliers, et le trait qui sépare ===');
    const PALIERS = [[1440, 132], [1280, 132], [1279, 112], [1100, 112], [1099, 104], [1000, 104]];
    for (const [w, attendu] of PALIERS) {
        p = await ouvrir(w, 700);
        const ls = await p.evaluate(() => ['#tab-grille', '#structure-btn', '#lyrics-btn'].map(s => Math.round(document.querySelector(s).getBoundingClientRect().width)));
        check(ls.every(x => x === attendu), `${w} px : trois onglets de ${attendu} px (${ls.join(' / ')})`);
        await p.close();
    }
    p = await ouvrir(960, 700);
    const nat = await p.evaluate(() => ['#tab-grille', '#structure-btn', '#lyrics-btn'].map(s => Math.round(document.querySelector(s).getBoundingClientRect().width)));
    check(nat.every(x => x < 100), `960 px : largeur naturelle, logos seuls (${nat.join(' / ')})`);
    await p.close();

    console.log('\n=== F. Jamais de recouvrement d\'Annuler, pastille du compte plafonnée ===');
    for (const w of [900, 960, 1000, 1024, 1100, 1180, 1280]) {
        p = await ouvrir(w, 700);
        const m = await p.evaluate(() => {
            const r = (s) => document.querySelector(s).getBoundingClientRect();
            return { ecart: Math.round(r('#global-undo-btn').left - r('#lyrics-btn').right), compte: Math.round(r('#compte-cloud').width), droite: Math.round(r('#compte-cloud').right), fenetre: window.innerWidth };
        });
        check(m.ecart >= 8, `${w} px : « Paroles » finit ${m.ecart} px avant « Annuler »`);
        if (w <= 999) check(m.compte <= 150, `${w} px : la pastille du compte fait au plus 150 px (${m.compte})`);
        else if (w <= 1179) check(m.compte <= 170, `${w} px : la pastille du compte fait au plus 170 px (${m.compte})`);
        else check(m.compte >= 190, `${w} px : la pastille du compte garde sa largeur (${m.compte})`);
        check(m.droite <= m.fenetre, `${w} px : et elle tient dans la fenêtre (finit à ${m.droite})`);
        await p.close();
    }

    console.log('\n=== G. Le trait entre les onglets : il s\'efface sous l\'onglet allumé et au survol ===');
    p = await ouvrir(1440, 700);
    const trait = (id) => p.evaluate((s) => { const c = getComputedStyle(document.querySelector(s), '::before'); return { contenu: c.content, opacite: c.opacity }; }, id);
    const t_grille = await trait('#tab-grille'), t_struct = await trait('#structure-btn'), t_par = await trait('#lyrics-btn');
    check(t_grille.contenu === 'none', 'le premier onglet n\'a pas de trait à sa gauche');
    check(t_struct.opacite === '0', 'sous l\'onglet allumé (Grille) : pas de trait à gauche de Structure');
    check(t_par.contenu === '""' && t_par.opacite === '1', 'entre Structure et Paroles : un trait visible');
    const bs = await p.locator('#structure-btn').boundingBox();
    await p.mouse.move(bs.x + bs.width / 2, bs.y + bs.height / 2); await p.waitForTimeout(250);
    check((await trait('#lyrics-btn')).opacite === '0' && (await trait('#structure-btn')).opacite === '0', 'au survol de Structure : ses deux traits s\'effacent');
    await p.mouse.move(700, 400); await p.waitForTimeout(250);
    check((await trait('#lyrics-btn')).opacite === '1', 'la souris partie : le trait revient');
    await p.close();

    // ======================================================================================================
    console.log('\n=== H. Le téléphone n\'a pas bougé (lot 7) ===');
    p = await ouvrir(390, 844);
    const tel = await p.evaluate(() => ({
        ton: document.querySelector('#rr-tonalite .rr-val').textContent,
        mot: document.querySelector('#file-menu-btn .btn-label').textContent,
        saveW: Math.round(document.getElementById('tb-save').getBoundingClientRect().width),
        mainG: getComputedStyle(document.querySelector('main')).paddingLeft,
        marge: getComputedStyle(document.querySelector('main')).marginLeft,
        onglet: Math.round(document.getElementById('tab-grille').getBoundingClientRect().width),
        sepGrille: getComputedStyle(document.getElementById('structure-btn'), '::before').content,
    }));
    check(tel.ton === 'C majeur', `la case de tonalité garde son nom complet (« ${tel.ton} »)`);
    check(tel.mot === 'Fichier', `le bouton garde « ${tel.mot} »`);
    check(tel.saveW === 44, `Enregistrer garde ses 44 px (${tel.saveW})`);
    check(tel.mainG !== '26px' && tel.marge !== '0px' || tel.mainG === '20px', `la colonne garde ses marges (${tel.mainG})`);
    check(tel.onglet < 132 && tel.sepGrille === 'none', `les onglets n'ont ni les 132 px ni le trait (${tel.onglet} px, trait ${tel.sepGrille})`);
    await p.close();

    check(erreurs.length === 0, `aucune erreur JavaScript (${erreurs.length ? erreurs.join(' | ') : 'aucune'})`);
    await nav.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
