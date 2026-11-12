// RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4a, 12/11) : à l'ordinateur la porte au-dessus de la grille est devenue le bouton « Séquenceur » du bloc « Vues ».
// RÉÉCRIT DE NOUVEAU (4b, 12/11) : la porte « Séquenceur » de la carte Accord a quitté l'ordinateur avec le petit séquenceur et sa loupe (sections A à C).
// Deux portes vers le séquenceur, et toutes deux portent un nom.
//
// RETOUR UTILISATEUR : « Vu qu'on a gagné de la place, le bouton agrandir est pas mal, mais il fait
// la même chose que le bouton séquenceur déjà présent. Tu peux laisser uniquement le bouton agrandir
// car il est plus visible. Renomme-le en "Séquenceur". Il faut l'abaisser un peu, il colle d'autres
// boutons. Mettre le même bouton au-dessus de la grille au lieu du logo peu clair, mais en moins
// large. Par exemple "Séq." ? »
//
// TROIS PORTES, AUCUNE NOMMÉE. Avant ce lot : un pictogramme de barres dans l'en-tête de la carte
// (#toggle-sequencer, vue compacte), le MÊME pictogramme au-dessus de la grille (#grid-zoom, vue
// d'ensemble), et une loupe « Agrandir » qui n'apparaissait qu'une fois le séquenceur déjà ouvert.
// Deux dessins identiques pour deux vues différentes, et un troisième bouton dont le mot décrivait un
// geste, pas une destination. Rien ne disait qui ouvrait quoi.
//
// DEUX PORTES, DEUX NOMS, DEUX VUES :
//   « Séq. »       au-dessus de la grille  -> vue d'ensemble (mode continu)
//   « Séquenceur » dans la carte Accord    -> plein écran sur l'accord ouvert
//
// LE POINT DÉLICAT, ET IL EST ÉPROUVÉ SECTION B. « Agrandir » refusait d'agir séquenceur fermé
// (openSeqZoom commence par `if (!this.seqOpen) return`), ce qui était juste tant qu'un autre bouton
// se chargeait de l'ouvrir. Ce bouton n'existe plus : cette porte doit donc faire les DEUX gestes,
// sinon elle ne fait rien du tout — et rien n'est plus silencieux qu'un bouton qui rend la main.
const { chromium, devices } = require('playwright');
const creerHarnais = require('./_harness');
const R = require('./_retrait_ancien');
const { plan, check, exiger, bilan } = creerHarnais('Deux portes nommées vers le séquenceur');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';

const seed = () => {
    const mk = (r, q, b) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
    const song = { id: 'portes', name: 'Ballade', bpm: 120, timeSig: '4/4', groove: 'straight',
        sections: [{ title: 'Couplet', chords: [mk('C', 'maj7', 4), mk('F', 'maj', 4)] }] };
    localStorage.setItem('harmohubSongs', JSON.stringify([song]));
    localStorage.setItem('harmohubCurrentSongId', song.id);
    localStorage.setItem('myProgression', JSON.stringify({ sections: song.sections }));
};

const atteignable = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return { ok: false, pourquoi: 'introuvable' };
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return { ok: false, pourquoi: 'aucune surface' };
    if (r.top < -1 || r.bottom > window.innerHeight + 1) return { ok: false, pourquoi: `hors fenêtre (${Math.round(r.top)}..${Math.round(r.bottom)})` };
    const dessus = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (!dessus || !(dessus === el || el.contains(dessus) || dessus.contains(el))) {
        return { ok: false, pourquoi: 'recouvert par ' + (dessus ? (dessus.id ? '#' + dessus.id : dessus.tagName) : 'rien') };
    }
    return { ok: true, taille: `${Math.round(r.width)}x${Math.round(r.height)}` };
};

(async () => {
    plan(22);
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const erreurs = [];
    const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
    page.on('pageerror', e => erreurs.push('ordinateur : ' + e.message));
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await page.waitForTimeout(300);
    await page.evaluate(seed);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(1000);
    // LOT 6c : sur ordinateur, la porte « Séquenceur » de la carte Accord vit dans l'inspecteur, qui n'existe qu'en modification d'un accord. On en
    // ouvre un, comme l'utilisateur (clic sur la case, puis « Réglages du son » dans la bulle) : les deux portes sont alors à l'écran ensemble.
    await page.dblclick('#progression-sections .grid-cell[data-index="0"]'); // point B : le double-clic ouvre la bulle (un clic seul fait entendre l'accord)
    await page.waitForTimeout(300);
    await page.click('#bulle-accord [data-bulle="son"]');
    await page.waitForTimeout(500);

    // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4b, 12/11) : à l'ordinateur, la porte « Séquenceur » de la carte Accord (petit séquenceur, sa loupe « plein écran »)
    // a disparu à son tour — la fenêtre d'accord n'a « pas de ligne Rythme » : le rythme se règle dans le séquenceur, sans le dire (cahier 3 bis). Il ne reste qu'UNE
    // porte à l'ordinateur, le bouton « Séquenceur » du bloc « Vues ». Les sections B, B bis et E éprouvaient la porte de la carte (ouvrir sans agrandir, la loupe, l'écart
    // avec ce qui la précède) : réécriture courte (décision du 12/11) — la porte n'existe plus, et le geste qui la remplace règle bien le rythme de l'accord ouvert.
    console.log('=== A. Une seule porte à l\'ordinateur, nommée, et plus aucun pictogramme muet ===');
    const a = await page.evaluate(() => {
        const lire = (id) => {
            const e = document.getElementById(id);
            if (!e) return null;
            const r = e.getBoundingClientRect();
            return { texte: (e.innerText || '').trim(), l: Math.round(r.width), h: Math.round(r.height),
                     visible: e.offsetParent !== null && r.width > 0, svg: !!e.querySelector('svg') };
        };
        return { ancien: !!document.getElementById('toggle-sequencer'), seq: lire('grid-zoom'), plein: lire('seq-zoom'), petit: lire('arp-sequencer'), vues: lire('vue-sequenceur'),
                 vuesNom: (document.getElementById('vue-sequenceur') || { getAttribute: () => null }).getAttribute('aria-label'), edite: window.app.editingIndex };
    });
    check(!a.ancien, 'le pictogramme de l\'en-tête a disparu : il faisait doublon sans le dire');
    exiger(!!a.seq && !!a.plein && a.edite === 0, 'les deux anciennes portes sont encore dans la page (masquées partout depuis la 4c), et l\'inspecteur est ouvert sur le premier accord');
    check(!a.seq.visible, 'au-dessus de la grille, plus de porte à l\'ordinateur (4a)');
    check(!a.plein.visible && !a.petit.visible, `dans l'inspecteur, plus de porte « Séquenceur » ni de petit séquenceur (4b) — porte ${a.plein.visible}, petit ${a.petit.visible}`);
    check(a.vues && a.vues.visible && a.vues.svg && a.vuesNom === 'Séquenceur', `la porte du séquenceur est dans le bloc « Vues », avec son logo et son nom (« ${a.vuesNom} »)`);
    check(a.vues.l === 32 && a.vues.h === 32, `le bouton du bloc « Vues » est à la jauge de la barre — ${a.vues.l}x${a.vues.h}px`);

    console.log('\n=== B. Le rythme de l\'accord ouvert se règle au séquenceur du bloc « Vues » ===');
    exiger(await page.evaluate(() => window.app.seqOpen === false && document.getElementById('sequenceur').hidden), 'on part séquenceur fermé');
    const r0 = await page.evaluate(atteignable, '#vue-sequenceur');
    exiger(r0.ok, `la porte est réellement atteignable, inspecteur ouvert — ${r0.ok ? r0.taille : r0.pourquoi}`);
    await page.click('#vue-sequenceur');
    await page.waitForTimeout(700);
    const b = await page.evaluate(() => {
        const n = document.querySelector('#sq-grille .sq-nom.choisi');
        return { ouvert: !document.getElementById('sequenceur').hidden, choisi: n ? +n.dataset.c : null, ancien: window.app.seqMode };
    });
    check(b.ouvert && b.choisi === 0, `un clic ouvre le séquenceur sur l'accord ouvert dans l'inspecteur — accord choisi ${b.choisi}`);
    check(b.ancien === null, `l'ancien petit séquenceur ne s'ouvre pas avec lui — mode ${b.ancien}`);
    const croche = await R.poserCroche(page, 0);
    check(croche.ok, `le rythme de l'accord s'y règle : un clic pose une croche, Ctrl+Z la retire (${croche.detail})`);

    console.log('\n=== C. La porte s\'allume quand sa vue est ouverte, et referme au second appui ===');
    check(await page.evaluate(() => document.getElementById('vue-sequenceur').getAttribute('aria-pressed') === 'true'), 'la porte ouverte s\'allume');
    await page.click('#vue-sequenceur');
    await page.waitForTimeout(500);
    check(await page.evaluate(() => document.getElementById('sequenceur').hidden && document.getElementById('vue-sequenceur').getAttribute('aria-pressed') !== 'true'),
        'un second appui referme le séquenceur : le bouton allumé annonce qu\'il s\'éteint');

    console.log('\n=== D. Rien ne déborde, sur aucun format ===');
    for (const [w, h] of [[1440, 950], [1024, 768], [768, 900]]) {
        await page.setViewportSize({ width: w, height: h });
        await page.waitForTimeout(400);
        const m = await page.evaluate(() => {
            const g = document.getElementById('grid-zoom'), barre = g.parentElement;
            return { barre: barre.scrollWidth - barre.clientWidth,
                     page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
                     tronque: g.scrollWidth > g.clientWidth + 1 };
        });
        check(m.barre <= 0 && m.page <= 0 && !m.tronque,
            `${w}px : barre ${m.barre}px, page ${m.page}px, « Séq. » ${m.tronque ? 'TRONQUÉ' : 'entier'}`);
    }
    await page.setViewportSize({ width: 1440, height: 950 });
    await page.waitForTimeout(300);
    await page.close();

    console.log('\n=== F. Téléphone : les deux portes au doigt ===');
    const ctx = await browser.newContext({ ...devices['iPhone 13'], hasTouch: true });
    const m = await ctx.newPage();
    m.on('pageerror', e => erreurs.push('téléphone : ' + e.message));
    await m.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await m.waitForTimeout(300);
    await m.evaluate(seed);
    await m.reload({ waitUntil: 'load' });
    await m.waitForTimeout(1200);
    // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4c, 12/11) : au téléphone aussi, les deux portes d'avant (« Notes » au-dessus de la grille, « Séquenceur » de la
    // carte Accord) et le petit séquenceur ont disparu. UNE porte, nommée : « Séquenceur » du panneau Lecture (⋯), qui ouvre l'onglet Rythme du panneau d'accord.
    const rt0 = await R.porteTelephoneAbsente(m);
    check(rt0.ok, `téléphone : plus de porte « Notes » ni « Séquenceur » dans la carte, plus de petit séquenceur (${rt0.detail})`);
    await m.tap('#bl-plus'); await m.waitForTimeout(400);
    const taille = await m.evaluate(() => { const b = document.getElementById('pl-notes'), r = b.getBoundingClientRect(); return { l: Math.round(r.width), h: Math.round(r.height), nom: b.querySelector('.btn-label').textContent, svg: !!b.querySelector('svg') }; });
    check(taille.h === 44 && taille.l >= 44 && taille.nom === 'Séquenceur' && taille.svg, `téléphone : la porte « ${taille.nom} » du panneau Lecture, logo et nom, ${taille.l}x${taille.h}px`);
    const r1 = await m.evaluate(atteignable, '#pl-notes');
    exiger(r1.ok, `téléphone : « Séquenceur » est atteignable — ${r1.ok ? r1.taille : r1.pourquoi}`);
    await m.tap('#pl-notes');
    await m.waitForTimeout(900);
    check(await m.evaluate(() => !!(window.app._bulle && window.app._bulle.rythme) && document.getElementById('sequenceur').parentElement.id === 'pa-rythme' && !window.app.seqOpen),
        'téléphone : un vrai appui ouvre l\'onglet Rythme, le séquenceur dedans — l\'ancien séquenceur reste fermé');
    // Ouvert au téléphone, l'onglet Rythme n'a pas de sens à l'ordinateur : passé 900 px, le panneau se referme et le séquenceur retourne à sa place.
    await m.setViewportSize({ width: 1300, height: 900 });
    await m.waitForTimeout(700);
    const elargi = await m.evaluate(() => ({ panneau: !document.getElementById('panneau-accord').hidden, place: document.getElementById('sequenceur').parentElement === document.getElementById('vues-tiroir').parentElement, ancien: window.app.seqOpen }));
    check(!elargi.panneau && elargi.place && !elargi.ancien, `fenêtre élargie au-delà de 900 px : panneau refermé ${!elargi.panneau}, séquenceur à sa place ${elargi.place}, ancien fermé ${!elargi.ancien}`);

    check(erreurs.length === 0, `aucune erreur JavaScript — ${erreurs.join(' | ') || 'aucune'}`);
    await browser.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
