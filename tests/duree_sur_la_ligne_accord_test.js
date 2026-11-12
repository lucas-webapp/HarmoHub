// La durée de l'accord, au téléphone (réécrit au lot 10e).
//
// HISTOIRE : la durée avait d'abord remonté sur la ligne de définition de l'accord (fondamentale, type, durée) de la carte « Nouvel accord ». Depuis le
// lot 10d (panneau d'accord) et le lot 10e (panneau d'ajout), cette carte a quitté la page sous 900px : la ligne n'existe plus nulle part. La durée d'un
// accord se règle dans son panneau, par un stepper − / + (« 1 mes. », « 2 mes. »…). Ce banc garde sa question — la durée se lit en entier, à la jauge
// du téléphone, aux trois largeurs qui comptent, et son geste écrit bien dans l'accord — sur le nouveau porteur. L'ancien texte suit, pour mémoire.
//
// ANCIEN EN-TÊTE :
// La durée remonte sur la ligne de définition de l'accord.
//
// RETOUR UTILISATEUR : « Le bouton "durée" pour un accord dans le volet de gauche prend trop de place
// pour rien. Est-ce que ça te semble être une bonne idée de le remonter au niveau de la définition de
// l'accord (note et type d'accord), en réduisant la largeur des 2 boutons existants sur cette ligne ? »
//
// CE QUI JUSTIFIE LE DÉPLACEMENT, au-delà de la place gagnée : la rangée qui l'accueillait ne
// contenait PLUS QU'ELLE. Elle portait trois groupes (jeu, durée, intensité) ; l'intensité est partie
// au menu contextuel de l'accord, le rythme dans Paramètres > Son — deux lots précédents. Il restait
// une rangée entière, son espacement et son étiquette pour une seule commande.
//
// DEUX COUCHES :
//   - CÂBLAGE (A-C) : la ligne se tient vraiment sur UNE ligne, à trois largeurs d'écran, sans rien
//     tronquer, et le menu s'ouvre encore au clic réel.
//   - MOTEUR (D) : choisir une durée écrit toujours dans #duration, la source de vérité que lisent
//     readChord et les exports. Déplacer un bouton ne doit rien changer à ce qu'il commande.
const { chromium } = require('playwright');
const creerHarnais = require('./_harness');
const { dblclickHorsNom } = require('./_geste_accord');
const { plan, check, exiger, bilan } = creerHarnais('La durée sur la ligne de l\'accord');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';

const seed = () => {
    const mk = (r) => ({ root: r, quality: 'maj', beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
    localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: ['C', 'D'].map(mk) }] }));
};

// Mesure la ligne : les trois commandes sont-elles côte à côte, et de la même hauteur ?
const mesurer = () => {
    const q = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { l: Math.round(r.width), h: Math.round(r.height), t: Math.round(r.top) }; };
    const lbl = document.querySelector('#duration-dd-toggle [data-label-slot]');
    return {
        root: q('#root'), quality: q('#quality'), duree: q('#duration-dd'),
        grille: q('.accord-grid'),
        libelle: lbl ? lbl.textContent.trim() : null,
        // scrollWidth > clientWidth = le texte est coupé par l'ellipsis, donc illisible en entier.
        tronque: lbl ? lbl.scrollWidth > lbl.clientWidth + 1 : null,
        ancienneRangee: !!document.getElementById('lecture-row'),
        colonnes: getComputedStyle(document.querySelector('.accord-grid')).gridTemplateColumns.split(' ').length,
    };
};

async function ouvrir(page, vp) {
    const p = await page.newPage({ viewport: vp });
    await p.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await p.waitForTimeout(250);
    await p.evaluate(seed);
    await p.reload({ waitUntil: 'load' });
    await p.waitForTimeout(800);
    return p;
}

(async () => {
    plan(21);
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const erreurs = [];
    const case1 = '#progression-sections .grid-cell[data-section="0"][data-index="1"]';
    // Point B de la refonte du séquenceur : un premier toucher choisit l'accord (et le fait entendre), un second sur la case choisie ouvre le panneau.
    const ouvrirPanneau = async (p) => { await p.tap(case1); await p.waitForTimeout(500); await p.tap(case1); await p.waitForTimeout(500); };
    const duree = (p) => p.evaluate(() => {
        const q = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { l: Math.round(r.width), h: Math.round(r.height), t: Math.round(r.top) }; };
        const lbl = document.querySelector('#pa-quel .pa-duree');
        const pa = document.getElementById('panneau-accord').getBoundingClientRect();
        const btn = [...document.querySelectorAll('#pa-quel [data-bulle="duree-moins"], #pa-quel [data-bulle="duree-plus"]')].map(b => b.getBoundingClientRect());
        return {
            ouvert: !document.getElementById('panneau-accord').hidden, libelle: lbl ? lbl.textContent.trim() : null,
            tronque: lbl ? lbl.scrollWidth > lbl.clientWidth + 1 : null, valeur: lbl ? q('#pa-quel .pa-duree') : null,
            boutons: btn.map(r => Math.round(r.height)), dansEcran: btn.every(r => r.left >= 0 && r.right <= innerWidth),
            deborde: document.documentElement.scrollWidth > innerWidth + 1, haut: Math.round(pa.top),
            beats: JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[1].beats,
        };
    });
    const ouvrirTel = async (vp) => {
        const ctx = await browser.newContext({ viewport: vp, hasTouch: true, isMobile: true });
        const p = await ctx.newPage();
        p.on('pageerror', e => erreurs.push(vp.width + 'px : ' + e.message));
        await p.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
        await p.waitForTimeout(250);
        await p.evaluate(seed);
        await p.reload({ waitUntil: 'load' });
        await p.waitForTimeout(800);
        return { p, ctx };
    };

    // === A. La durée est dans le panneau, lisible en entier, à la jauge du doigt, aux trois largeurs ===
    for (const vp of [{ width: 860, height: 950 }, { width: 390, height: 844 }, { width: 320, height: 640 }]) {
        const { p, ctx } = await ouvrirTel(vp);
        await ouvrirPanneau(p);
        const m = await duree(p);
        exiger(m.ouvert && !!m.valeur && m.valeur.l > 0 && m.boutons.length === 2, `${vp.width}px : le panneau montre la durée et ses deux boutons − / + (${m.libelle})`);
        check(m.boutons.every(h => h >= 38) && m.dansEcran && !m.deborde, `${vp.width}px : − et + sont à la jauge des groupes segmentés du téléphone (38px au moins), tiennent dans l'écran, sans débordement de page (${m.boutons})`);
        check(!m.tronque, `${vp.width}px : « ${m.libelle} » se lit en entier`);
        await ctx.close();
    }

    // === B. Le libellé le PLUS LONG, à la largeur la plus étroite ===
    // « 4 mesures » est le pire cas (le panneau écrit les mots en entier) : c'est lui qu'il faut éprouver à 320px, pas « 1 mes. » qui passe partout.
    const etroit = await ouvrirTel({ width: 320, height: 640 });
    await etroit.p.evaluate(() => { const s = JSON.parse(localStorage.getItem('myProgression')); s.sections[0].chords[1].beats = 15; localStorage.setItem('myProgression', JSON.stringify(s)); });
    await etroit.p.reload({ waitUntil: 'load' }); await etroit.p.waitForTimeout(800);
    await ouvrirPanneau(etroit.p);
    await etroit.p.tap('#pa-quel [data-bulle="duree-plus"]'); await etroit.p.waitForTimeout(300);
    const pire = await duree(etroit.p);
    check(pire.libelle === '4 mesures' && pire.beats === 16, `le pire libellé est bien affiché, et la durée écrite : « ${pire.libelle} », ${pire.beats} temps`);
    check(!pire.tronque, `et il se lit en entier à 320px — « ${pire.libelle} »`);
    await etroit.ctx.close();

    // === C. Le geste réel : − et + écrivent dans l'accord, d'un temps ===
    const { p, ctx } = await ouvrirTel({ width: 390, height: 844 });
    await ouvrirPanneau(p);
    const avant = (await duree(p)).beats;
    await p.tap('#pa-quel [data-bulle="duree-plus"]'); await p.waitForTimeout(300);
    const plus = await duree(p);
    check(plus.beats === avant + 1, `+ allonge l'accord d'un temps dans la grille — ${avant} → ${plus.beats}`);
    await p.tap('#pa-quel [data-bulle="duree-moins"]'); await p.waitForTimeout(300);
    const moins = await duree(p);
    check(moins.beats === avant, `− le raccourcit d'un temps — ${plus.beats} → ${moins.beats}`);
    check(await p.evaluate(() => window.app.appMode) === 'add', 'régler la durée n\'ouvre pas la modification : le panneau reste à mi-hauteur');

    // === D. « Réglages du son » agrandit le panneau : la durée reste en haut, à sa place ===
    await p.tap('#pa-son-btn'); await p.waitForTimeout(500);
    const agrandi = await duree(p);
    check(agrandi.ouvert && !!agrandi.valeur && agrandi.valeur.l > 0, `agrandi, le panneau garde la durée sous les yeux (« ${agrandi.libelle} »)`);
    await ctx.close();

    // === E. Le téléphone n'a plus de ligne « fondamentale / type / durée » dans la page ===
    const vide = await ouvrirTel({ width: 390, height: 844 });
    const ligne = await vide.p.evaluate(() => { const g = document.querySelector('.accord-grid'); return !g || g.getBoundingClientRect().width === 0 || getComputedStyle(g).display === 'none' || getComputedStyle(document.getElementById('accord-card')).display === 'none'; });
    check(ligne, 'la ligne de l\'accord a quitté la page : au repos, la carte « Nouvel accord » n\'y est plus');
    check(await vide.p.evaluate(() => !document.getElementById('lecture-row')), 'et l\'ancienne rangée #lecture-row n\'existe toujours pas');
    check(await vide.p.evaluate(() => getComputedStyle(document.getElementById('duration-dd')).display === 'none' || document.getElementById('duration-dd').getBoundingClientRect().width === 0),
        'la durée « des prochains accords » n\'est plus un réglage de la page : chaque accord a la sienne, dans son panneau');
    await vide.ctx.close();

    // === F. À l'ordinateur, la durée vit dans la bulle (lot 6b/6c), et la ligne d'accord n'y est plus ===
    const o = await ouvrir(browser, { width: 1440, height: 950 });
    o.on('pageerror', e => erreurs.push('ordinateur : ' + e.message));
    check(await o.evaluate(() => getComputedStyle(document.querySelector('.accord-grid')).display === 'none' || document.querySelector('.accord-grid').getBoundingClientRect().width === 0),
        'ordinateur : la ligne de l\'accord n\'est pas affichée (rien aux deux endroits)');
    await dblclickHorsNom(o, '#progression-sections .grid-cell[data-index="0"]'); // point B : le double-clic ouvre la bulle (B2, 12/11 : hors du texte du nom, que le double-clic retape)
    await o.waitForTimeout(300);
    const bulleDuree = await o.evaluate(() => { const b = document.getElementById('bulle-accord'); const d = b && !b.hidden && b.querySelector('.bulle-duree'); return d ? { txt: d.textContent.trim(), l: Math.round(d.getBoundingClientRect().width) } : null; });
    check(!!bulleDuree && bulleDuree.l > 0 && /mes|temps/.test(bulleDuree.txt), `ordinateur : un double-clic sur la case ouvre la bulle, qui dit la durée — « ${bulleDuree && bulleDuree.txt} »`);
    await o.close();

    check(erreurs.length === 0, `aucune erreur JavaScript — ${erreurs.join(' | ') || 'aucune'}`);
    await browser.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
