// LOT 10c DE LA REFONTE — les réglages du morceau, l'affichage de la grille et l'en-tête de partie au TÉLÉPHONE (docs/refonte.md, section
// « Téléphone » ; maquette « Téléphone (v2) », page project/Telephone2.dc.html).
//
// « Infos du morceau (tonalité, mesure, swing, son) repliées dans UNE barre-résumé pleine largeur → quatre grosses cases sur deux colonnes ; bouton
// carré "Affichage" à côté : Compact (4 mesures/ligne, noms seuls, 44 px), Normal (4 mesures/ligne + degrés, 64 px), Large (2 mesures/ligne, 72 px).
// Pincement conservé. » Et l'en-tête de partie : nom + « N mesures » + ×N + menu ⋯ (celui du lot 5c).
//
// Jusqu'au 10c le téléphone avait la carte Morceau d'avant la refonte : « 120 BPM · 4/4 · C majeur » qui dépliait un panneau flottant de listes
// déroulantes ; les boutons H± V± ; l'en-tête de partie à quatre petits boutons ▲▼⧉🗑 et « 8 mes. ».
//
// Ce que le banc tient, par de VRAIS gestes (toucher, clavier) — window.app ne sert qu'à relire l'état :
//   A. la ligne : barre-résumé pleine largeur à 44px (les quatre valeurs, pas le tempo) et Affichage carré à côté, plus de cadre de carte ;
//   B. les quatre cases : sur deux colonnes, dans l'ordre de la maquette, dans la page (elles poussent la grille), Transposer dessous ; l'ancien
//      panneau ne s'ouvre plus ;
//   C. les choix : chaque case ouvre son choix dans l'écran, à 44px ; il règle la vraie liste (Mesure, Tonalité, Swing, Son), le résumé suit, une
//      annulation par geste ; Transposer déplace les accords ; Échap et le toucher à côté le referment, il suit sa case au défilement ;
//   D. le contretemps du métronome passe dans le panneau Lecture (la carte ne s'ouvrant plus, il aurait été perdu) ;
//   E. Affichage : Compact / Normal / Large aux valeurs de la maquette (hauteur, mesures par ligne, degrés), une préférence de l'APPAREIL — le
//      morceau et ses échelles ne bougent pas, le choix survit au rechargement ; trois façons de refermer ;
//   F. le pincement agrandit la grille du téléphone sans toucher aux échelles du morceau ; choisir un affichage le remet à ses valeurs ;
//   G. l'en-tête de partie : « 8 mesures », ⋯ à 44px au bout de la ligne, ▲▼⧉🗑 disparus, le menu (44px) agit ;
//   H. le verre : la carte reste sans cadre, le panneau Affichage est un creux, aucun texte n'y devient illisible ;
//   I. 320px : tout tient ;
//   J. l'ordinateur n'a pas bougé, et franchir le seuil remet les puces à leur place.
const { chromium } = require('playwright');
const V = require('./_verre_commun');
const { check, exiger, plan, bilan } = require('./_harness')('téléphone : réglages du morceau, affichage, en-tête de partie (lot 10c)');
const { estBruitReseau } = require('./_harness');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';

plan(47);

const mk = (root, quality) => ({ root, quality, beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
const SECTIONS = [
    { title: 'Couplet', chords: ['C', 'A', 'F', 'G', 'C', 'A', 'D', 'G'].map((r, i) => mk(r, i % 2 ? 'min' : 'maj7')) },
    { title: 'Refrain', chords: [mk('F', 'maj'), mk('G', 'maj'), mk('E', 'min7'), mk('A', 'min')] },
];

async function ouvrir(nav, contexte, erreurs, nom, reglages = {}) {
    const ctx = await nav.newContext(contexte);
    await ctx.addInitScript(([sections, reglages]) => {
        if (sessionStorage.getItem('banc-10c')) return; // un rechargement garde ce que le banc a fait
        sessionStorage.setItem('banc-10c', '1');
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
const toucher = async (p, sel, ms = 250) => { await p.tap(sel); await p.waitForTimeout(ms); };
const boite = (p, sel) => p.evaluate((s) => {
    const e = document.querySelector(s); if (!e) return null;
    const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
    return { x: r.x, y: r.y, w: r.width, h: r.height, b: r.bottom, rt: r.right, rayon: parseFloat(cs.borderTopLeftRadius), vis: r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && cs.display !== 'none' };
}, sel);
const dansLEcran = (p, sel) => p.evaluate((s) => {
    const e = document.querySelector(s); if (!e) return false;
    const r = e.getBoundingClientRect();
    return r.width > 1 && r.left >= 0 && r.right <= innerWidth + 0.5 && r.top >= 0 && r.bottom <= innerHeight + 0.5;
}, sel);
// Ce que montre la grille : hauteur d'une case, temps par ligne, rangées de degrés, échelles du morceau et du téléphone.
const grille = (p) => p.evaluate(() => {
    const c = document.querySelector('#progression-sections .grid-cell');
    const g = document.querySelector('#progression-sections .chord-grid');
    return {
        h: Math.round(c.getBoundingClientRect().height), temps: +g.dataset.beatsPerRow,
        degres: document.querySelectorAll('#progression-sections .row-roman').length,
        morceau: [window.app.classicGridZoomLevelX, window.app.classicGridZoomLevelY], tel: [window.app.gridTelZoomLevelX, window.app.gridTelZoomLevelY],
        modifie: hasUnsavedChanges === true,
    };
});
const pincer = (p, ecart) => p.evaluate((ecart) => {
    const cases = document.querySelectorAll('#progression-sections .grid-cell');
    const a = cases[0], b = cases[1];
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    const ev = (type, id, r, dx = 0) => new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: r.left + r.width / 2 + dx, clientY: r.top + r.height / 2, bubbles: true, cancelable: true });
    a.dispatchEvent(ev('pointerdown', 11, ra)); b.dispatchEvent(ev('pointerdown', 12, rb));
    for (const f of [0.5, 1]) { a.dispatchEvent(ev('pointermove', 11, ra, -ecart * f)); b.dispatchEvent(ev('pointermove', 12, rb, ecart * f)); }
    a.dispatchEvent(ev('pointerup', 11, ra)); b.dispatchEvent(ev('pointerup', 12, rb));
}, ecart);

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    try {
        const { p, ctx } = await ouvrir(nav, TEL, erreurs, 'téléphone : ');

        // ===== A. LA LIGNE ===========================================================================================================
        const resume = await boite(p, '#song-summary');
        const aff = await boite(p, '#tel-affichage');
        exiger(resume && resume.vis && aff && aff.vis, 'au téléphone, la barre-résumé et le bouton Affichage sont à l\'écran');
        check(Math.abs(resume.h - 44) < 1 && resume.rayon === 7 && Math.abs(aff.w - 44) < 1 && Math.abs(aff.h - 44) < 1 && aff.rayon === 7,
            `barre-résumé de 44px et Affichage carré de 44px, angles de 7px (${Math.round(resume.h)} / ${Math.round(aff.w)}×${Math.round(aff.h)})`);
        check(Math.abs(resume.y - aff.y) < 1 && aff.x > resume.rt && aff.x - resume.rt <= 8 && aff.rt <= 390 - 9 && resume.x <= 21 && resume.w >= 280,
            `sur une ligne : la barre prend toute la largeur (${Math.round(resume.w)}px), Affichage collé à sa droite`);
        const texte = await p.evaluate(() => document.getElementById('song-summary').innerText.trim());
        check(texte === 'C majeur · 120 BPM · 4/4 · Droit · Piano', `la barre résume les quatre réglages, le tempo juste après la tonalité (« ${texte} »)`);
        const carte = await p.evaluate(() => { const cs = getComputedStyle(document.getElementById('song-card')); return { bord: cs.borderTopWidth, fond: cs.backgroundColor, img: cs.backgroundImage }; });
        check(carte.bord === '0px' && /rgba\(0, 0, 0, 0\)|transparent/.test(carte.fond) && carte.img === 'none', `plus de cadre de carte autour de la ligne (${JSON.stringify(carte)})`);

        // ===== B. LES QUATRE CASES ===================================================================================================
        const grilleAvant = await boite(p, '#progression-sections .grid-cell');
        await toucher(p, '#song-summary');
        const cases = await p.evaluate(() => [...document.querySelectorAll('#tel-reglages-cases .rr-puce')].map(b => {
            const r = b.getBoundingClientRect();
            return { id: b.id, nom: b.querySelector('.rr-nom').textContent, val: b.querySelector('.rr-val').textContent, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
        }));
        exiger(cases.length === 4, `toucher la barre déplie quatre cases (${cases.length})`);
        check(cases.map(c => c.nom).join() === 'Tonalité,Mesure,Swing,Son' && cases.map(c => c.val).join() === 'C majeur,4/4,Droit,Piano',
            `dans l'ordre de la maquette, le nom au-dessus de la valeur (${cases.map(c => c.nom + ' ' + c.val).join(' · ')})`);
        check(cases[0].y === cases[1].y && cases[2].y === cases[3].y && cases[2].y > cases[0].y && cases[0].x === cases[2].x && cases.every(c => Math.abs(c.w - cases[0].w) <= 1 && c.h === 52),
            `sur deux colonnes égales, deux rangées de cases de 52px (${cases.map(c => c.w + '×' + c.h).join(' ')})`);
        const etat = await p.evaluate(() => ({ exp: document.getElementById('song-summary').getAttribute('aria-expanded'), ancien: document.getElementById('song-settings').hidden, rangee: document.getElementById('rangee-reglages').parentElement.id }));
        const grilleApres = await boite(p, '#progression-sections .grid-cell');
        const casesBas = await boite(p, '#tel-reglages-cases');
        check(etat.exp === 'true' && etat.ancien && etat.rangee === 'tel-reglages-cases' && grilleApres.y >= casesBas.b && grilleApres.y > grilleAvant.y,
            `les cases sont les puces de l'ordinateur déplacées ici ; elles poussent la grille sans la recouvrir ; l'ancien panneau reste fermé (${JSON.stringify(etat)})`);
        const transp = await p.evaluate(() => ['#rr-transposer-bas', '#rr-transposer-haut'].map(s => { const r = document.querySelector(s).getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
        check(transp.every(([w, h]) => w === 44 && h === 44), `Transposer reste, ses deux flèches à 44px (${JSON.stringify(transp)})`);

        // ===== C. LES CHOIX ==========================================================================================================
        await toucher(p, '#rr-mesure');
        const choix = await p.evaluate(() => { const pop = document.getElementById('rr-pop'); const r = pop.getBoundingClientRect(); const b = document.getElementById('rr-mesure').getBoundingClientRect();
            return { ouvert: !pop.hidden, dessous: r.top >= b.bottom - 0.5 && r.top - b.bottom <= 10, lignes: [...pop.querySelectorAll('.tb-mi')].map(x => Math.round(x.getBoundingClientRect().height)) }; });
        check(choix.ouvert && choix.dessous && (await dansLEcran(p, '#rr-pop')) && choix.lignes.length === 8 && choix.lignes.every(h => h >= 44),
            `la case Mesure ouvre son choix sous elle, dans l'écran, huit lignes d'au moins 44px (${choix.lignes.join(',')})`);
        await toucher(p, '#rr-pop [data-rr-valeur="3/4"]', 400);
        const apres34 = await p.evaluate(() => ({ sig: document.getElementById('time-sig').value, resume: document.getElementById('song-summary-tel').textContent, ferme: document.getElementById('rr-pop').hidden, temps: +document.querySelector('#progression-sections .chord-grid').dataset.beatsPerRow, modifie: hasUnsavedChanges === true }));
        check(apres34.sig === '3/4' && apres34.resume === 'C majeur · 120 BPM · 3/4 · Droit · Piano' && apres34.ferme && apres34.temps === 15 && apres34.modifie,
            `choisir 3/4 règle la vraie mesure, le résumé suit, la grille se refait en mesures de 3 temps (5 par ligne : la largeur d'une ligne reste celle de 16 temps, règle de beatsPerRowFor), le morceau est modifié (${JSON.stringify(apres34)})`);
        await toucher(p, '#global-undo-btn', 400);
        check(await p.evaluate(() => document.getElementById('time-sig').value === '4/4' && document.querySelector('#rr-mesure .rr-val').textContent === '4/4'),
            'une seule annulation rend 4/4, et la case le dit');
        await toucher(p, '#rr-tonalite');
        const tonPop = await p.evaluate(() => { const b = [...document.querySelectorAll('#rr-pop .rr-grille button')]; return { n: b.length, h: Math.min(...b.map(x => x.getBoundingClientRect().height)) }; });
        check(tonPop.n === 19 && tonPop.h >= 38 && (await dansLEcran(p, '#rr-pop')), `la case Tonalité ouvre ses douze toniques et sept modes dans l'écran, segments de ${tonPop.h}px`);
        const premierAvant = await p.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[0].root);
        await toucher(p, '#rr-pop [data-rr-action="tonique"][data-rr-valeur="D#"]');
        await p.keyboard.press('Escape'); await p.waitForTimeout(200);
        const ton = await p.evaluate(() => ({ root: document.getElementById('global-root').value, val: document.querySelector('#rr-tonalite .rr-val').textContent, ferme: document.getElementById('rr-pop').hidden, premier: JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[0].root }));
        check(ton.root === 'D#' && ton.val === 'E♭ majeur' && ton.ferme && ton.premier === premierAvant,
            `E♭ choisi : la tonalité change (notation internationale), pas les accords ; Échap referme le choix (${JSON.stringify(ton)})`);
        await toucher(p, '#rr-swing'); await toucher(p, '#rr-pop [data-rr-valeur="ternary"]');
        await toucher(p, '#rr-son'); await toucher(p, '#rr-pop [data-rr-valeur="pad"]');
        const deux = await p.evaluate(() => ({ g: document.getElementById('groove').value, i: document.getElementById('instrument').value, resume: document.getElementById('song-summary-tel').textContent }));
        check(deux.g === 'ternary' && deux.i === 'pad' && deux.resume === 'E♭ majeur · 120 BPM · 4/4 · Ternaire · Nappe', `Swing et Son se règlent de même, le résumé suit (« ${deux.resume} »)`);
        await toucher(p, '#rr-transposer-haut', 400);
        check(await p.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[0].root === 'C#'), 'la flèche ↑ de Transposer déplace les accords d\'un demi-ton');
        await toucher(p, '#rr-mesure');
        await toucher(p, '.prog-section-head .prog-title[data-section="1"]');
        check(await p.evaluate(() => document.getElementById('rr-pop').hidden), 'toucher à côté referme le choix ouvert');
        await toucher(p, '#rr-son');
        await p.mouse.wheel(0, 120); await p.waitForTimeout(300);
        const suit = await p.evaluate(() => { const pop = document.getElementById('rr-pop'); const b = document.getElementById('rr-son').getBoundingClientRect(); return pop.hidden || Math.abs(pop.getBoundingClientRect().top - b.bottom - 6) < 1.5; });
        check(suit, 'la page défile : le choix suit sa case (ou se referme si elle sort de l\'écran)');
        await p.keyboard.press('Escape'); await p.waitForTimeout(150);
        await p.evaluate(() => window.scrollTo(0, 0));
        await toucher(p, '#song-summary');
        check(await p.evaluate(() => document.getElementById('tel-reglages-cases').hidden && document.getElementById('song-summary').getAttribute('aria-expanded') === 'false'), 'toucher la barre de nouveau replie les cases');

        // ===== D. LE CONTRETEMPS DANS LE PANNEAU LECTURE =============================================================================
        await toucher(p, '#bl-plus');
        const sub = await p.evaluate(() => { const b = document.getElementById('toggle-metronome-subdivision'); const r = b.getBoundingClientRect(); return { hote: b.parentElement.id, w: Math.round(r.width), h: Math.round(r.height), avant: window.app.metronomeSubdivision }; });
        await toucher(p, '#toggle-metronome-subdivision');
        const subApres = await p.evaluate(() => window.app.metronomeSubdivision);
        check(sub.hote === 'pl-subdivision' && sub.w === 44 && sub.h === 44 && subApres === !sub.avant && (await dansLEcran(p, '#toggle-metronome-subdivision')),
            `le contretemps du métronome est dans le panneau Lecture, à 44px, et se bascule (${JSON.stringify(sub)} → ${subApres})`);
        await toucher(p, '#bl-plus');

        // ===== E. AFFICHAGE ==========================================================================================================
        await p.keyboard.press('Control+s'); await p.waitForTimeout(300);
        const normal = await grille(p);
        check(normal.h === 64 && normal.temps === 16 && normal.degres > 0, `Normal par défaut : cases de ${normal.h}px, ${normal.temps / 4} mesures par ligne, avec les degrés`);
        await toucher(p, '#tel-affichage');
        const pan = await p.evaluate(() => { const pn = document.getElementById('tel-affichage-panneau'); const seg = [...pn.querySelectorAll('[data-densite-tel]')];
            return { ouvert: !pn.hidden, noms: seg.map(b => b.textContent).join(), allume: seg.filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.dataset.densiteTel).join(), h: Math.round(document.getElementById('tel-densites').getBoundingClientRect().height), aide: document.getElementById('tel-affichage-aide').textContent, exp: document.getElementById('tel-affichage').getAttribute('aria-expanded') }; });
        const ligneBas = await boite(p, '.tel-reglages-ligne');
        const panB = await boite(p, '#tel-affichage-panneau');
        check(pan.ouvert && pan.noms === 'Compact,Normal,Large' && pan.allume === 'normal' && pan.h === 44 && pan.exp === 'true' && /degré/.test(pan.aide) && panB.y >= ligneBas.b && panB.rayon === 12,
            `Affichage ouvre, sous la ligne, un groupe segmenté de 44px Compact / Normal / Large, Normal allumé, et ce qu'il fait (${JSON.stringify(pan)})`);
        await toucher(p, '#tel-densites [data-densite-tel="compact"]', 400);
        const compact = await grille(p);
        check(compact.h === 44 && compact.temps === 16 && compact.degres === 0, `Compact : cases de ${compact.h}px, ${compact.temps / 4} mesures par ligne, noms seuls (degrés : ${compact.degres})`);
        await toucher(p, '#tel-densites [data-densite-tel="large"]', 400);
        const large = await grille(p);
        const aideLarge = await p.evaluate(() => ({ aide: document.getElementById('tel-affichage-aide').textContent, titre: document.getElementById('tel-affichage').getAttribute('aria-label') }));
        check(large.h === 72 && large.temps === 8 && large.degres > 0 && /Deux mesures/.test(aideLarge.aide) && aideLarge.titre === 'Affichage de la grille : Large',
            `Large : cases de ${large.h}px, ${large.temps / 4} mesures par ligne, avec les degrés ; l'aide et le nom du bouton suivent`);
        check(!large.modifie && JSON.stringify(large.morceau) === JSON.stringify(normal.morceau),
            `une préférence de l'appareil : le morceau n'est pas modifié, ses échelles d'ordinateur n'ont pas bougé (${JSON.stringify(large.morceau)})`);
        await toucher(p, '#tel-affichage-fermer');
        check(await p.evaluate(() => document.getElementById('tel-affichage-panneau').hidden && document.activeElement === document.getElementById('tel-affichage')), 'la croix referme le panneau et rend le focus au bouton');
        await toucher(p, '#tel-affichage'); await p.keyboard.press('Escape'); await p.waitForTimeout(150);
        const parEchap = await p.evaluate(() => document.getElementById('tel-affichage-panneau').hidden);
        await toucher(p, '#tel-affichage'); await toucher(p, '#tel-affichage');
        check(parEchap && await p.evaluate(() => document.getElementById('tel-affichage-panneau').hidden), 'Échap le referme aussi, et le bouton lui-même');
        await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => !!window.app); await p.waitForTimeout(700);
        const recharge = await grille(p);
        check(recharge.h === 72 && recharge.temps === 8, `rechargé : Large revient (cases de ${recharge.h}px), mémorisé sur l'appareil`);

        // ===== F. LE PINCEMENT ========================================================================================================
        const avantPince = await grille(p);
        await pincer(p, 70); await p.waitForTimeout(400);
        const pince = await grille(p);
        check(pince.h > avantPince.h && pince.tel[0] > avantPince.tel[0] && pince.tel[1] > avantPince.tel[1],
            `écarter deux doigts agrandit la grille du téléphone (${avantPince.h} → ${pince.h}px, échelles ${JSON.stringify(avantPince.tel)} → ${JSON.stringify(pince.tel)})`);
        check(JSON.stringify(pince.morceau) === JSON.stringify(avantPince.morceau) && !pince.modifie,
            `sans toucher aux échelles du morceau ni le marquer modifié (${JSON.stringify(pince.morceau)})`);
        await toucher(p, '#tel-affichage'); await toucher(p, '#tel-densites [data-densite-tel="normal"]', 400);
        const remis = await grille(p);
        check(remis.h === 64 && remis.temps === 16 && remis.tel[0] === 1, `choisir Normal remet ses valeurs, pincement effacé (${remis.h}px, ${remis.temps / 4} mesures)`);
        await toucher(p, '#tel-affichage-fermer');
        const zooms = await p.evaluate(() => ['#classic-grid-in-h', '#classic-grid-out-h', '#classic-grid-in-v', '#classic-grid-out-v'].map(s => document.querySelector(s).getBoundingClientRect().width));
        check(zooms.every(w => w === 0), 'les zooms H / V se sont effacés (le pincement les remplace)');

        // ===== G. L'EN-TÊTE DE PARTIE =================================================================================================
        const tete = await p.evaluate(() => {
            const h = document.querySelector('.prog-section-head');
            const m = h.querySelector('.prog-section-menu').getBoundingClientRect(), hr = h.getBoundingClientRect();
            const vus = [...h.querySelectorAll('.psh-ancien')].filter(b => b.getBoundingClientRect().width > 0).length;
            return { mesures: h.querySelector('.prog-section-measures').innerText.trim(), w: Math.round(m.width), hh: Math.round(m.height), bout: Math.abs(m.right - hr.right) < 1.5, vus };
        });
        check(tete.mesures === '8 mesures' && tete.w === 44 && tete.hh === 44 && tete.bout && tete.vus === 0,
            `l'en-tête de partie : « ${tete.mesures} » en toutes lettres, ⋯ de ${tete.w}×${tete.hh}px au bout de la ligne, ▲▼⧉🗑 disparus (${tete.vus} visible)`);
        // La page a DÉFILÉ (le ⋯ de la seconde partie au milieu de l'écran) : un menu posé d'après l'écran mais non fixé tomberait à côté de son bouton.
        await p.evaluate(() => document.querySelector('.prog-section-menu[data-section="1"]').scrollIntoView({ block: 'center' }));
        await p.waitForTimeout(200);
        exiger(await p.evaluate(() => window.scrollY > 50), 'la page a bien défilé avant d\'ouvrir le menu');
        await toucher(p, '.prog-section-menu[data-section="1"]');
        const menu = await p.evaluate(() => { const mn = document.getElementById('partie-menu'); const r = mn.getBoundingClientRect(); const b = document.querySelector('.prog-section-menu[data-section="1"]').getBoundingClientRect();
            return { ouvert: !mn.hidden, colle: Math.abs(r.top - (b.bottom + 6)) < 1.5 || Math.abs(r.bottom - (b.top - 6)) < 1.5, lignes: [...mn.querySelectorAll('.tb-mi')].map(x => Math.round(x.getBoundingClientRect().height)) }; });
        check(menu.ouvert && menu.colle && (await dansLEcran(p, '#partie-menu')) && menu.lignes.length >= 5 && menu.lignes.every(h => h >= 44), `le ⋯ ouvre le menu de la partie collé à son bouton, dans l'écran, lignes de 44px (${menu.lignes.join(',')})`);
        await p.keyboard.press('Escape'); await p.waitForTimeout(150);
        await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(150);
        await toucher(p, '.prog-section-menu[data-section="0"]');
        const nbAvant = await p.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections.length);
        await toucher(p, '#partie-menu [data-partie-action="dupliquer"]', 400);
        check(await p.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections.length) === nbAvant + 1, 'Dupliquer, depuis le menu, ajoute une partie');
        await toucher(p, '.prog-section-menu[data-section="0"]');
        await toucher(p, '#partie-menu [data-partie-action="rep-plus"]', 300);
        const rep = await p.evaluate(() => { const e = document.querySelector('.prog-section-head .prog-section-rep'); return e ? e.textContent : ''; });
        await p.keyboard.press('Escape'); await p.waitForTimeout(150);
        check(rep === '×2' && await p.evaluate(() => document.getElementById('partie-menu').hidden), `Répéter + affiche ×2 dans l'en-tête ; Échap referme le menu (${rep})`);
        check(erreurs.length === 0, `aucune erreur JavaScript au téléphone (${erreurs.length}) ${erreurs.slice(0, 2).join(' | ')}`);
        await ctx.close();

        // ===== H. LE VERRE ============================================================================================================
        {
            const off = await ouvrir(nav, TEL, erreurs, 'verre éteint : ');
            const on = await ouvrir(nav, TEL, erreurs, 'verre allumé : ', { 'harmohub.glass.v1': '1' });
            for (const pg of [off.p, on.p]) { await toucher(pg, '#song-summary'); await toucher(pg, '#tel-affichage'); }
            const v = await on.p.evaluate(() => { const c = getComputedStyle(document.getElementById('song-card')); const pn = getComputedStyle(document.getElementById('tel-affichage-panneau'));
                return { carteFond: c.backgroundColor, carteImg: c.backgroundImage, carteOmbre: c.boxShadow, panneau: pn.backgroundColor }; });
            v.panneauEteint = await off.p.evaluate(() => getComputedStyle(document.getElementById('tel-affichage-panneau')).backgroundColor);
            check(/rgba\(0, 0, 0, 0\)/.test(v.carteFond) && v.carteImg === 'none' && v.carteOmbre === 'none' && /rgba\(\d+, \d+, \d+, 0\.\d+\)/.test(v.panneau) && v.panneau !== v.panneauEteint,
                `verre allumé : la ligne reste sans cadre (ni fond ni ombre), le panneau Affichage devient un creux translucide (${JSON.stringify(v)})`);
            const zone = (pg) => pg.evaluate(() => [...document.querySelectorAll('#song-card *')].map(e => e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/)[0] : '')));
            const cles = new Set(await zone(on.p));
            const a = (await V.contrastesFaibles(off.p)).filter(f => cles.has(f.cle.split('|')[0])), b = (await V.contrastesFaibles(on.p)).filter(f => cles.has(f.cle.split('|')[0]));
            const nouveaux = b.filter(f => !a.some(g => g.cle === f.cle));
            check(nouveaux.length === 0, `aucun texte des réglages ni de l'affichage ne devient illisible verre allumé (${nouveaux.length}${nouveaux.length ? ' : ' + JSON.stringify(nouveaux.slice(0, 3)) : ''})`);
            await off.ctx.close(); await on.ctx.close();
        }

        // ===== I. 320px ===============================================================================================================
        {
            const { p, ctx } = await ouvrir(nav, { ...TEL, viewport: { width: 320, height: 640 } }, erreurs, '320px : ');
            const l = await p.evaluate(() => ({ r: document.getElementById('song-summary').getBoundingClientRect().width, t: document.getElementById('song-summary-tel'), debord: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
            check(l.r >= 200 && l.debord <= 0 && (await dansLEcran(p, '#tel-affichage')), `à 320px la barre garde ${Math.round(l.r)}px, Affichage à l'écran, rien ne déborde`);
            await toucher(p, '#song-summary');
            const casesOk = await p.evaluate(() => [...document.querySelectorAll('#tel-reglages-cases .rr-puce, #tel-reglages-cases .rr-seg button')].every(e => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 0.5; }));
            await toucher(p, '#rr-tonalite');
            check(casesOk && (await dansLEcran(p, '#rr-pop')), 'les cases et le choix de la tonalité tiennent dans l\'écran');
            await p.keyboard.press('Escape'); await p.waitForTimeout(150);
            await toucher(p, '#tel-affichage');
            check(await p.evaluate(() => [...document.querySelectorAll('#tel-densites button')].every(b => { const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && b.scrollWidth <= b.clientWidth; })),
                'et les trois affichages se lisent en entier');
            await ctx.close();
        }

        // ===== J. L'ORDINATEUR N'A PAS BOUGÉ, ET LE SEUIL REMET TOUT EN PLACE =========================================================
        {
            const { p, ctx } = await ouvrir(nav, { viewport: { width: 1320, height: 820 } }, erreurs, 'ordinateur : ', { harmohubGrilleTelephone: JSON.stringify({ densite: 'large', x: 2, y: 1.125 }) });
            const o = await p.evaluate(() => {
                const vu = (s) => { const e = document.querySelector(s); return !!e && e.getBoundingClientRect().width > 0; };
                const c = document.querySelector('#progression-sections .grid-cell');
                return { rangee: document.getElementById('rangee-reglages').parentElement.className, puce: Math.round(document.getElementById('rr-tonalite').getBoundingClientRect().height), carte: vu('#song-card'), aff: vu('#tel-affichage'), densites: vu('#grille-densites'), h: Math.round(c.getBoundingClientRect().height), temps: +document.querySelector('#progression-sections .chord-grid').dataset.beatsPerRow, sub: document.getElementById('toggle-metronome-subdivision').parentElement.id };
            });
            check(/grid-head-sticky/.test(o.rangee) && o.puce === 32 && !o.carte && !o.aff && o.densites && o.h === 52 && o.temps === 16 && o.sub === 'bl-hote-subdivision',
                `ordinateur : les puces dans la rangée à 32px, ni carte Morceau ni Affichage du téléphone ; Normal à 52px malgré « Large » choisi au téléphone (${JSON.stringify(o)})`);
            await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(400);
            const tel = await p.evaluate(() => ({ rangee: document.getElementById('rangee-reglages').parentElement.id, h: Math.round(document.querySelector('#progression-sections .grid-cell').getBoundingClientRect().height), sub: document.getElementById('toggle-metronome-subdivision').parentElement.id }));
            await p.click('#song-summary'); await p.waitForTimeout(200);
            await p.setViewportSize({ width: 1320, height: 820 }); await p.waitForTimeout(400);
            const retour = await p.evaluate(() => ({ rangee: document.getElementById('rangee-reglages').parentElement.className, ferme: document.getElementById('tel-reglages-cases').hidden, puce: Math.round(document.getElementById('rr-tonalite').getBoundingClientRect().height) }));
            check(tel.rangee === 'tel-reglages-cases' && tel.h === 72 && tel.sub === 'pl-subdivision' && /grid-head-sticky/.test(retour.rangee) && retour.ferme && retour.puce === 32,
                `franchir le seuil met les puces dans les cases (Large du téléphone : ${tel.h}px), puis les rend à la rangée de l'ordinateur, cases refermées (${JSON.stringify({ tel, retour })})`);
            await ctx.close();
        }
        check(erreurs.length === 0, `aucune erreur JavaScript nulle part (${erreurs.length}) ${erreurs.slice(0, 2).join(' | ')}`);
    } finally { await nav.close(); }
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
