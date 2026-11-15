// VOICING — LA CONDUITE DES VOIX DANS UNE POPOVER (L4, 15/11) : l'ancien piano-roll, repris à l'identique, ouvert par un bouton à l'extrémité droite de l'en-tête de la grille.
//
// CE QUE L'UTILISATEUR A DEMANDÉ (docs/decisions-13-14-11.md, lettre C) : « Le bouton voicing doit sortir du séquenceur pour aller en haut à droite » ; « cette conduite de voix
// doit être dans une popover comme avant. Elle doit rester minimaliste » ; « il faut vraiment que tu copies la conduite de voix qu'on avait avant sur l'application. On fera ça
// plus tard si tu veux, tu reprendras tout comme il faut. Puis on l'améliorera si besoin plus tard. »
//
// CE QUE LE BANC TIENT, avec de vrais gestes : le bouton (logo d'avant, nom au-dessus de 1180 px, gabarit 32 px / 7 px, à droite de « Vue »), l'ouverture et les trois façons de
// fermer (Échap, clic à côté, le bouton lui-même), le piano-roll (une note par voix, colorée par rôle, trait plein épais = note tenue, fin pointillé = mouvement, comptés d'après
// le modèle musical et non d'après le dessin), la colonne des touches qui reste fixe quand on défile, les échelles H / V (cran, bornes, mémoire de l'appareil), la partie montrée
// (la partie active, un état vide sous deux accords), le rafraîchissement quand la grille change (Suppr puis Ctrl+Z), et que le TÉLÉPHONE n'a pas bougé.
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('voicing : la conduite des voix en popover');
const { estBruitReseau } = require('./_harness');
const V = require('./_verre_commun');

plan(50);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const mk = (r, q, b = 4) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
// Couplet : Cmaj7 deux fois (quatre voix TENUES), puis deux changements (voix qui bougent). Refrain : trois accords. Pont : UN accord (rien à enchaîner).
// Long : douze accords de quatre temps (plus de 2 600 px de piano-roll : il faut défiler).
const LONG = ['C', 'A', 'D', 'G', 'C', 'A', 'D', 'G', 'C', 'A', 'D', 'G'].map((r, i) => mk(r, ['maj7', 'min7', 'min7', 'dom7'][i % 4]));
const PARTIES = [
    { title: 'Couplet', chords: [mk('C', 'maj7'), mk('C', 'maj7'), mk('F', 'maj7'), mk('G', 'dom7')] },
    { title: 'Refrain', chords: [mk('F', 'maj7'), mk('G', 'dom7'), mk('C', 'maj7')] },
    { title: 'Pont', chords: [mk('A', 'min7')] },
    { title: 'Long', chords: LONG },
];
const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
const TEL = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 };

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    const ouvrir = async (contexte) => {
        const ctx = await nav.newContext(contexte);
        await ctx.addInitScript((S) => {
            if (sessionStorage.getItem('banc-voicing')) return;
            sessionStorage.setItem('banc-voicing', '1');
            localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), sections: S }]));
            localStorage.setItem('harmohubCurrentSongId', 's1');
            localStorage.setItem('myProgression', JSON.stringify({ sections: S }));
            sessionStorage.setItem('cc_accueil_vu', '1');
        }, PARTIES);
        await ctx.route(/gstatic\.com|googleapis\.com|tonejs\.github\.io/, r => r.abort());
        const p = await ctx.newPage();
        p.on('pageerror', e => erreurs.push(e.message));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !V.BRUIT.test(m.text())) erreurs.push('console: ' + m.text()); });
        await p.goto(`${BASE}/index.html`);
        await p.waitForFunction(() => !!window.app);
        await p.waitForTimeout(900);
        return { p, ctx };
    };
    const ouvert = (p) => p.evaluate(() => ({ cache: document.getElementById('voicing-pop').hidden, aria: document.getElementById('voicing-btn').getAttribute('aria-expanded'), contenu: document.getElementById('voicing-pop').children.length }));
    // Un vrai clic au centre d'un élément visible.
    const cliquer = async (p, sel, ms = 350) => { const b = await p.locator(sel).first().boundingBox(); await p.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await p.waitForTimeout(ms); };
    const caseGrille = (i, s = 0) => `#progression-sections .chord-grid[data-section="${s}"] .grid-cell[data-index="${i}"]`;
    // Le coin d'une case porte le « + » d'insertion, ses bords la poignée de durée : un clic au milieu, un peu haut.
    const cliquerCase = async (p, i, s = 0) => { const b = await p.locator(caseGrille(i, s)).first().boundingBox(); await p.mouse.click(b.x + b.width / 2, b.y + b.height * 0.35); await p.waitForTimeout(450); };
    const lecture = (p) => p.evaluate(() => {
        const pop = document.getElementById('voicing-pop');
        const notes = [...pop.querySelectorAll('.vl-note')];
        const traits = [...pop.querySelectorAll('.voice-leading-scroll line.vl-tenue, .voice-leading-scroll line.vl-mouvement')];
        const svg = pop.querySelector('.voice-leading-scroll svg');
        return {
            panneau: pop.querySelectorAll('.voice-leading-panel').length, partie: (pop.querySelector('.voice-leading-panel') || {}).dataset ? pop.querySelector('.voice-leading-panel').dataset.section : null,
            titre: (pop.querySelector('.voice-leading-titre') || {}).textContent || '', vide: (pop.querySelector('.voice-leading-vide') || {}).textContent || '',
            notes: notes.length, roles: notes.reduce((a, n) => { a[n.dataset.role] = (a[n.dataset.role] || 0) + 1; return a; }, {}),
            tenues: pop.querySelectorAll('line.vl-tenue').length, mouvements: pop.querySelectorAll('line.vl-mouvement').length, traits: traits.length,
            largeur: svg ? +svg.getAttribute('width') : 0, haut: notes[0] ? +notes[0].getAttribute('height') : 0,
            textes: [...pop.querySelectorAll('.voice-leading-scroll text')].map(t => t.textContent),
        };
    });

    // ======================================================================================================
    console.log('\n=== A. Le bouton : à droite de l\'en-tête de la grille, logo d\'avant, nom au-dessus de 1180 px ===');
    let { p, ctx } = await ouvrir(DESKTOP);
    const bouton = await p.evaluate(() => {
        const b = document.getElementById('voicing-btn'), r = b.getBoundingClientRect(), cs = getComputedStyle(b);
        const tete = document.querySelector('.grid-head-sticky').getBoundingClientRect(), vue = document.getElementById('grille-densites').getBoundingClientRect();
        const svg = b.querySelector('svg');
        return { vu: r.width > 0 && cs.display !== 'none', h: r.height, rayon: cs.borderRadius, droite: tete.right - r.right, apresVue: r.left - vue.right,
            rects: svg.querySelectorAll('rect').length, paths: svg.querySelectorAll('path').length, pointilles: svg.querySelectorAll('path[stroke-dasharray]').length,
            nom: getComputedStyle(b.querySelector('.rr-voicing-nom')).display, texte: b.textContent.trim(), titre: b.title, parent: b.parentElement.className };
    });
    exiger(bouton.vu, 'le bouton « Voicing » est affiché à l\'ordinateur');
    check(Math.round(bouton.h) === 32 && bouton.rayon === '7px', `au gabarit : 32 px de haut, arrondi 7 px (${bouton.h} px, ${bouton.rayon})`);
    check(bouton.droite >= 0 && bouton.droite <= 24, `à l'extrémité DROITE de l'en-tête de la grille (${bouton.droite.toFixed(0)} px du bord)`);
    check(bouton.apresVue > 0, `à droite de « Vue ‹ n mes. › » (${bouton.apresVue.toFixed(0)} px après)`);
    check(bouton.rects === 4 && bouton.paths === 2 && bouton.pointilles === 2, `le logo est celui d'avant : deux paires de notes reliées par des pointillés (${bouton.rects} barres, ${bouton.paths} traits)`);
    check(bouton.nom !== 'none' && bouton.texte === 'Voicing', `à 1440 px le mot « Voicing » accompagne le logo (« ${bouton.texte} »)`);
    check(/voix/i.test(bouton.titre), 'et l\'infobulle dit ce que le bouton ouvre');
    const avant = await ouvert(p);
    check(avant.cache && avant.aria === 'false' && avant.contenu === 0, 'fermée au départ : popover cachée, vide, aria-expanded à false');

    // ======================================================================================================
    console.log('\n=== B. Ouvrir : le piano-roll de la partie active ===');
    await cliquer(p, '#voicing-btn');
    const o = await ouvert(p);
    exiger(!o.cache && o.aria === 'true', 'un clic sur le bouton ouvre la popover (aria-expanded à true)');
    let l = await lecture(p);
    check(l.panneau === 1 && l.partie === '0' && l.titre === 'Couplet', `elle montre la partie active, « ${l.titre} » (partie ${l.partie})`);
    check(l.notes === 16, `une note par voix : 4 accords × 4 notes = ${l.notes}`);
    // Les traits attendus sont recalculés d'après le MODÈLE (les notes réelles de chaque accord), pas d'après le dessin.
    const attendu = await p.evaluate((S) => {
        const midis = S[0].chords.map(h => new Chord(h.root, h.quality, h.beats, h.inversion, h.drop, h.octave, h.bass, h.guitarLock, h.extraNotes).getVoiced().map(v => v.midi));
        let tenues = 0, mouvements = 0;
        for (let i = 0; i < midis.length - 1; i++) for (let v = 0; v < Math.min(midis[i].length, midis[i + 1].length); v++) { if (midis[i][v] === midis[i + 1][v]) tenues++; else mouvements++; }
        return { tenues, mouvements };
    }, PARTIES);
    check(l.traits === l.tenues + l.mouvements && l.traits === attendu.tenues + attendu.mouvements, `chaque voix est reliée à la voix de même rang de l'accord suivant : ${l.traits} traits, attendus ${attendu.tenues + attendu.mouvements}`);
    check(l.tenues === attendu.tenues && l.tenues >= 4 && l.mouvements === attendu.mouvements && l.mouvements >= 1, `${l.tenues} notes tenues et ${l.mouvements} mouvements, comme dans le modèle`);
    const style = await p.evaluate(() => {
        const a = (cls) => { const e = document.querySelector('#voicing-pop line.' + cls); return e ? { w: e.getAttribute('stroke-width'), d: e.getAttribute('stroke-dasharray'), c: e.getAttribute('stroke') } : null; };
        return { tenue: a('vl-tenue'), mouvement: a('vl-mouvement') };
    });
    check(style.tenue && style.tenue.w === '2.5' && style.tenue.d === 'none', `note tenue = trait PLEIN et épais (${style.tenue && style.tenue.w} px, pointillé ${style.tenue && style.tenue.d})`);
    check(style.mouvement && style.mouvement.w === '1.6' && style.mouvement.d === '3,2', `mouvement = trait FIN en pointillé (${style.mouvement && style.mouvement.w} px, pointillé ${style.mouvement && style.mouvement.d})`);
    check(l.roles.root === 4 && l.roles.third === 4 && l.roles.fifth === 4 && l.roles.seventh === 4, `les notes sont rangées par rôle : 4 fondamentales, 4 tierces, 4 quintes, 4 septièmes (${JSON.stringify(l.roles)})`);
    const couleurs = await p.evaluate(() => {
        const pop = document.getElementById('voicing-pop');
        const stop = (role) => { const g = pop.querySelector(`linearGradient[id="vlg-0-${role}"]`); return g ? [...g.querySelectorAll('stop')].map(s => s.getAttribute('stop-color')).join('>') : null; };
        const note = pop.querySelector('.vl-note[data-role="root"]');
        return { root: stop('root'), third: stop('third'), fifth: stop('fifth'), seventh: stop('seventh'), ext: stop('ext'), remplissage: note.getAttribute('fill'),
            pastilles: ['root', 'third', 'fifth', 'seventh', 'ext'].map(r => pop.querySelectorAll('.piano-legend .dot-' + r).length).join('') , legende: [...pop.querySelectorAll('.piano-legend .lg')].map(e => e.textContent.trim()).join(' ') };
    });
    check(couleurs.root === '#3fe3a0>#00a855' && couleurs.third === '#5b98f0>#1f5fc0' && couleurs.fifth === '#ff6f66>#d42a20' && couleurs.seventh === '#ffc247>#cc8f00' && couleurs.ext === '#dba8ee>#c48ce6', 'fondamentale verte, tierce bleue, quinte rouge, septième ambre, extension mauve (les dégradés d\'avant)');
    check(couleurs.remplissage === 'url(#vlg-0-root)', 'une note prend le dégradé de son rôle');
    check(couleurs.pastilles === '11111' && couleurs.legende === '1 3 5 7 Autres', `la légende : ${couleurs.legende}`);
    check(['Cmaj7', 'Fmaj7', 'G7'].every(t => l.textes.includes(t)), `chaque bloc d'accord porte son nom (${l.textes.filter(t => /7$/.test(t)).slice(0, 4).join(', ')})`);
    check(l.textes.includes('I7') || l.textes.includes('Imaj7') || l.textes.some(t => /^[IV]+/.test(t)), 'et son chiffrage romain');
    const touches = await p.evaluate(() => {
        const pop = document.getElementById('voicing-pop'), cles = pop.querySelector('.voice-leading-keys'), defile = pop.querySelector('.voice-leading-scroll');
        const r = [...cles.querySelectorAll('rect')];
        return { dehors: !defile.contains(cles), larg: cles.getBoundingClientRect().width, ivoire: r.filter(e => e.getAttribute('fill') === '#ece1cd').length, noires: r.filter(e => e.getAttribute('fill') === '#171310').length, labels: [...cles.querySelectorAll('text')].map(t => t.textContent).join(',') };
    });
    check(touches.dehors && Math.round(touches.larg) === 34 && touches.ivoire > 0 && touches.noires > 0, `la colonne des touches (ivoire et noir) est HORS de la zone qui défile (${touches.larg}px, ${touches.ivoire} blanches, ${touches.noires} noires)`);
    check(/C3/.test(touches.labels) && /C4/.test(touches.labels), `les touches « Do » sont nommées (${touches.labels})`);
    const place = await p.evaluate(() => { const r = document.getElementById('voicing-pop').getBoundingClientRect(), b = document.getElementById('voicing-btn').getBoundingClientRect(); return { gauche: r.left, droite: window.innerWidth - r.right, haut: r.top - b.bottom, bas: window.innerHeight - r.bottom }; });
    check(place.gauche >= 0 && place.droite >= 0 && place.haut >= 0 && place.bas >= 0, `la popover tient dans la fenêtre, sous le bouton (gauche ${place.gauche.toFixed(0)}, droite ${place.droite.toFixed(0)}, sous le bouton de ${place.haut.toFixed(0)}, marge basse ${place.bas.toFixed(0)})`);

    // ======================================================================================================
    console.log('\n=== C. Les échelles H / V : un cran, des bornes, la mémoire de l\'appareil ===');
    const L0 = await lecture(p);
    await cliquer(p, '#voicing-pop .voice-leading-zoom-in-h');
    let z = await lecture(p), e1 = await ouvert(p);
    check(!e1.cache && Math.abs(z.largeur / L0.largeur - 1.25) < 0.01 && z.haut === L0.haut, `H + : la largeur ×1,25 (${L0.largeur} → ${z.largeur}), la hauteur ne bouge pas, la popover reste ouverte`);
    await cliquer(p, '#voicing-pop .voice-leading-zoom-in-v');
    z = await lecture(p);
    check(Math.abs((z.haut + 4) / (L0.haut + 4) - 1.25) < 0.01, `V + : la hauteur d'une ligne ×1,25 (${L0.haut + 4} → ${z.haut + 4} px)`);
    const memoire = await p.evaluate(() => [localStorage.getItem('harmohubVoiceLeadingZoomLevelX'), localStorage.getItem('harmohubVoiceLeadingZoomLevelY')]);
    check(memoire[0] === '1.25' && memoire[1] === '1.25', `les deux échelles sont gardées pour l'appareil (${memoire.join(' / ')})`);
    await cliquer(p, '#voicing-pop .voice-leading-zoom-out-h'); await cliquer(p, '#voicing-pop .voice-leading-zoom-out-v');
    z = await lecture(p);
    check(z.largeur === L0.largeur && z.haut === L0.haut, 'H − et V − ramènent au dessin de départ');
    for (let k = 0; k < 6; k++) await cliquer(p, '#voicing-pop .voice-leading-zoom-in-h', 120);
    z = await lecture(p);
    check(Math.abs(z.largeur / L0.largeur - 2) < 0.02, `l'échelle s'arrête à 2 (${(z.largeur / L0.largeur).toFixed(2)})`);
    for (let k = 0; k < 8; k++) await cliquer(p, '#voicing-pop .voice-leading-zoom-out-h', 120);
    z = await lecture(p);
    check(Math.abs(z.largeur / L0.largeur - 0.7) < 0.02, `et à 0,7 dans l'autre sens (${(z.largeur / L0.largeur).toFixed(2)})`);
    for (let k = 0; k < 3; k++) await cliquer(p, '#voicing-pop .voice-leading-zoom-in-h', 120);
    await p.reload(); await p.waitForFunction(() => !!window.app); await p.waitForTimeout(700);
    await cliquer(p, '#voicing-btn');
    z = await lecture(p);
    check(z.notes === 16 && Math.abs(z.largeur / L0.largeur - 1.367) < 0.02, `après un rechargement l'échelle mémorisée est retrouvée (×${(z.largeur / L0.largeur).toFixed(2)}, attendu ×1,37)`);

    // ======================================================================================================
    console.log('\n=== D. Fermer : Échap, clic à côté, le bouton lui-même ; un clic dedans ne ferme pas ===');
    const dedans = await p.locator('#voicing-pop .voice-leading-scroll').boundingBox();
    await p.mouse.click(dedans.x + 120, dedans.y + 80); await p.waitForTimeout(250);
    let f = await ouvert(p);
    check(!f.cache, 'un clic DANS le piano-roll ne le ferme pas');
    await p.keyboard.press('Escape'); await p.waitForTimeout(250);
    f = await ouvert(p);
    check(f.cache && f.aria === 'false' && f.contenu === 0, 'Échap ferme (cachée, vidée, aria-expanded à false)');
    await cliquer(p, '#voicing-btn');
    await cliquer(p, '#voicing-btn');
    f = await ouvert(p);
    check(f.cache && f.aria === 'false', 'le bouton ferme aussi : un second clic referme');
    await cliquer(p, '#voicing-btn');
    exiger(!(await ouvert(p)).cache, 'rouverte');
    await p.mouse.click(60, 400); await p.waitForTimeout(300);
    f = await ouvert(p);
    check(f.cache && f.aria === 'false', 'un clic à côté ferme');

    // ======================================================================================================
    console.log('\n=== E. La partie montrée : la partie active ; sous deux accords, un état vide ===');
    await cliquerCase(p, 0, 1); // le premier accord du Refrain
    await cliquer(p, '#voicing-btn');
    l = await lecture(p);
    check(l.panneau === 1 && l.partie === '1' && l.titre === 'Refrain' && l.notes === 12, `la partie active a changé : « ${l.titre} », ${l.notes} notes`);
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    await cliquerCase(p, 0, 2); // l'unique accord du Pont
    await cliquer(p, '#voicing-btn');
    l = await lecture(p);
    check(l.panneau === 0 && l.notes === 0 && /Pont/.test(l.vide) && /deux accords/.test(l.vide), `une partie d'un seul accord n'a rien à enchaîner : « ${l.vide} »`);
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);

    // ======================================================================================================
    console.log('\n=== F. Elle suit la grille : Suppr, puis Ctrl+Z, pendant qu\'elle est ouverte ===');
    await cliquerCase(p, 2, 1); // Cmaj7, dernier accord du Refrain
    await p.keyboard.press('Delete'); await p.waitForTimeout(500);
    await cliquer(p, '#voicing-btn');
    l = await lecture(p);
    check(l.partie === '1' && l.notes === 8, `le Refrain n'a plus que deux accords : ${l.notes} notes`);
    await p.keyboard.press('Control+z'); await p.waitForTimeout(600);
    f = await ouvert(p); l = await lecture(p);
    check(!f.cache && l.notes === 12, `Ctrl+Z rend l'accord, et la popover, restée ouverte, se redessine : ${l.notes} notes`);
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);

    // ======================================================================================================
    console.log('\n=== G. Une partie longue : on défile, la colonne des touches reste fixe ===');
    await cliquerCase(p, 0, 3);
    await cliquer(p, '#voicing-btn');
    l = await lecture(p);
    check(l.partie === '3' && l.notes === 48, `la partie « Long » : ${l.notes} notes`);
    const avantDef = await p.evaluate(() => { const c = document.querySelector('#voicing-pop .voice-leading-keys').getBoundingClientRect(), d = document.querySelector('#voicing-pop .voice-leading-scroll'); return { x: c.x, y: c.y, defile: d.scrollLeft, large: d.scrollWidth - d.clientWidth }; });
    check(avantDef.large > 200, `le piano-roll déborde de la fenêtre (${avantDef.large.toFixed(0)} px à parcourir)`);
    const zone = await p.locator('#voicing-pop .voice-leading-scroll').boundingBox();
    await p.mouse.move(zone.x + zone.width / 2, zone.y + zone.height / 2);
    await p.mouse.wheel(500, 0); await p.waitForTimeout(500);
    const apresDef = await p.evaluate(() => { const c = document.querySelector('#voicing-pop .voice-leading-keys').getBoundingClientRect(), d = document.querySelector('#voicing-pop .voice-leading-scroll'); return { x: c.x, y: c.y, defile: d.scrollLeft }; });
    check(apresDef.defile > 100 && Math.abs(apresDef.x - avantDef.x) < 1 && Math.abs(apresDef.y - avantDef.y) < 1, `un coup de molette fait défiler les notes (${apresDef.defile.toFixed(0)} px) et les touches ne bougent pas`);
    await cliquer(p, '#voicing-pop .voice-leading-zoom-in-v');
    const gardeDef = await p.evaluate(() => document.querySelector('#voicing-pop .voice-leading-scroll').scrollLeft);
    check(Math.abs(gardeDef - apresDef.defile) < 2, `changer l'échelle verticale garde l'endroit où l'on est (${gardeDef.toFixed(0)} px)`);
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    await p.close(); await ctx.close();

    // ======================================================================================================
    console.log('\n=== H. Entre 900 et 1180 px : le logo seul ; fermée par un passage au téléphone ===');
    ({ p, ctx } = await ouvrir({ viewport: { width: 1000, height: 800 }, deviceScaleFactor: 1 }));
    const etroit = await p.evaluate(() => { const b = document.getElementById('voicing-btn'), r = b.getBoundingClientRect(); return { l: r.width, h: r.height, nom: getComputedStyle(b.querySelector('.rr-voicing-nom')).display, dans: r.right <= window.innerWidth && r.left >= 0 }; });
    check(Math.round(etroit.l) === 32 && Math.round(etroit.h) === 32 && etroit.nom === 'none' && etroit.dans, `à 1000 px : un carré de 32 px, sans le mot (${etroit.l} × ${etroit.h})`);
    await cliquer(p, '#voicing-btn');
    const p1 = await p.evaluate(() => { const r = document.getElementById('voicing-pop').getBoundingClientRect(); return { g: r.left, d: window.innerWidth - r.right }; });
    check(!(await ouvert(p)).cache && p1.g >= 0 && p1.d >= 0, `la popover s'ouvre et tient dans la fenêtre (marges ${p1.g.toFixed(0)} / ${p1.d.toFixed(0)})`);
    await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(500);
    const ferme = await ouvert(p);
    check(ferme.cache && ferme.aria === 'false', 'la fenêtre devient celle d\'un téléphone : la popover se referme');
    await p.close(); await ctx.close();

    // ======================================================================================================
    console.log('\n=== I. Le téléphone n\'a pas bougé : pas de bouton, pas de popover, une rangée de réglages intacte ===');
    ({ p, ctx } = await ouvrir(TEL));
    const tel = await p.evaluate(() => {
        const b = document.getElementById('voicing-btn'), pop = document.getElementById('voicing-pop');
        const rangee = document.querySelector('#tel-reglages-cases .rangee-reglages') || document.getElementById('rangee-reglages');
        return { affiche: getComputedStyle(b).display !== 'none' && b.getBoundingClientRect().width > 0, popCachee: pop.hidden, enfants: rangee ? rangee.children.length : -1,
            enRangee: !!b.closest('.rangee-reglages'), panneaux: document.querySelectorAll('.voice-leading-panel').length };
    });
    check(!tel.affiche && tel.popCachee && tel.panneaux === 0, 'au téléphone le bouton n\'est pas affiché et la popover reste fermée');
    check(tel.enfants === 5 && !tel.enRangee, `la rangée de réglages du téléphone garde ses cinq éléments, sans case en plus (${tel.enfants})`);
    await p.close(); await ctx.close();

    check(erreurs.length === 0, `aucune erreur de page ni de console (${erreurs.slice(0, 3).join(' | ')})`);
    await nav.close();
    bilan();
})().catch(e => { console.log('FATAL ' + (e && e.stack || e)); process.exit(1); });
