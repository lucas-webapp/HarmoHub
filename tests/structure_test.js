// LA VUE STRUCTURE (voir openStructureWindow/renderStructurePanel dans script.js).
//
// Ce que ce banc garde, et pourquoi. Structure a été faite VUE et non module : elle lit les parties
// réelles de la grille au lieu d'en recevoir une copie, précisément pour qu'il n'y ait rien à
// synchroniser (retour utilisateur : « il faut que les sections de HarmoHub, Paroles, et Structure
// soient liées »). Cette promesse ne tient que si modifier quelque chose ICI modifie le morceau
// LÀ-BAS — c'est donc ça qu'on vérifie, plus que l'affichage lui-même.
const { chromium } = require('playwright');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('structure du morceau');

const c = (r, q, b) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
// Un jeu d'essai qui contient TOUS les cas intéressants : une partie répétée, un accord tenu sur deux
// mesures, une variation, et une partie vide.
const PROG = { sections: [
    { title: 'Couplet', repeatCount: 2, chords: [c('C', 'maj', 4), c('A', 'min', 4), c('F', 'maj', 2), c('G', 'maj', 2)] },
    { title: 'Refrain', chords: [c('F', 'maj', 8), c('C', 'maj', 4), c('G', 'maj', 4)] },
    { title: 'Couplet (variation)', chords: [c('C', 'maj', 4), c('A', 'min', 4)] },
    { title: 'Pont', chords: [c('D', 'min', 4), c('G', 'dom7', 4)] },
] };

plan(14);

(async () => {
    const navigateur = await chromium.launch();
    const erreurs = [];
    const page = await navigateur.newPage({ viewport: { width: 1300, height: 950 } });
    page.on('pageerror', (e) => erreurs.push('pageerror: ' + e.message));
    page.on('console', (m) => {
        if (m.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_CERT_AUTHORITY_INVALID|fonts\.googleapis|fonts\.gstatic/.test(m.text())) erreurs.push('console.error: ' + m.text());
    });
    await page.addInitScript((pr) => localStorage.setItem('myProgression', JSON.stringify(pr)), PROG);
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(1200);

    if (!exiger(await page.isVisible('#structure-btn'), 'le bouton Structure existe à côté de Paroles')) return bilan();
    await page.click('#structure-btn');
    await page.waitForTimeout(500);
    if (!exiger(await page.isVisible('#structure-overlay'), 'il ouvre la fenêtre Structure')) return bilan();

    const lire = () => page.evaluate(() => ({
        somme: document.querySelector('.struct-somme').innerText.replace(/\s+/g, ' ').trim(),
        deroule: document.querySelector('.struct-deroule')?.innerText.replace(/\s+/g, ' ').trim() || '',
        lignes: [...document.querySelectorAll('.struct-row')].map(r => ({
            titre: r.querySelector('.struct-title').textContent,
            mesures: r.querySelector('.struct-measures')?.textContent || '',
            rep: r.querySelector('.struct-rep')?.textContent || '',
            pos: r.querySelector('.struct-pos')?.textContent || '',
            accords: r.querySelector('.struct-chords')?.textContent.trim() || '',
            famille: [...r.querySelector('.struct-famille').classList].find(x => /^struct-famille-\d+$/.test(x)),
        })),
    }));

    let v = await lire();
    // 6 mesures (Couplet ×2) + 4 + 2 + 2 = 14. À 120 BPM en 4/4 : 14 × 4 × 60 / 120 = 28 s.
    check(/14 mesures/.test(v.somme), `le total compte les RÉPÉTITIONS — « ${v.somme} »`);
    check(/0 min 28 s/.test(v.somme), `la durée en découle, au tempo du morceau — « ${v.somme} »`);

    // LA POSITION EN MESURES : l'information qui n'existait nulle part avant cette vue. Chaque module
    // savait dire la longueur d'une partie, aucun ne savait dire OÙ elle tombe dans le morceau.
    check(v.lignes[0].pos === 'mes. 1–6', `le Couplet répété occupe bien 6 mesures — « ${v.lignes[0].pos} »`);
    check(v.lignes[1].pos === 'mes. 7–10', `le Refrain commence APRÈS les deux passages du couplet — « ${v.lignes[1].pos} »`);
    check(v.lignes[3].pos === 'mes. 13–14', `et le Pont tombe à la bonne mesure — « ${v.lignes[3].pos} »`);

    // Les accords se lisent en MESURES, pas à plat : c'est ce qui distingue une grille d'une liste.
    check(v.lignes[0].accords === '| C | Am | F G |', `accords groupés par mesure — « ${v.lignes[0].accords} »`);
    // Un accord tenu deux mesures n'est écrit qu'une fois ; la seconde porte « % ». L'écrire deux fois
    // donnerait à lire deux accords là où il n'y en a qu'un.
    check(v.lignes[1].accords === '| F | % | C | G |', `accord tenu : « % » sur la mesure suivante — « ${v.lignes[1].accords} »`);

    // « Couplet » et « Couplet (variation) » sont la même chose jouée autrement : même famille, donc
    // même couleur, sans que l'utilisateur ait rien eu à saisir.
    check(v.lignes[0].famille === v.lignes[2].famille,
        `la variation partage la couleur de sa famille (${v.lignes[0].famille} / ${v.lignes[2].famille})`);
    check(v.lignes[1].famille !== v.lignes[0].famille, 'un Refrain n\'est pas de la famille du Couplet');

    check(/Couplet ×2 · Refrain · Couplet \(variation\) · Pont/.test(v.deroule),
        `le déroulé donne la FORME du morceau d'un trait — « ${v.deroule} »`);

    // ---- LE LIEN : agir ici doit agir sur le morceau, pas sur une copie ----
    await page.evaluate(() => document.querySelectorAll('.struct-row')[3].querySelector('[data-struct="rep-plus"]').click());
    await page.waitForTimeout(400);
    v = await lire();
    const persiste = await page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections[3].repeatCount);
    check(persiste === 2, `une répétition ajoutée ici est écrite dans le MORCEAU — repeatCount = ${persiste}`);
    check(/16 mesures/.test(v.somme), `...et le total suit aussitôt — « ${v.somme} »`);

    // Réordonner depuis Structure réordonne la vraie grille : la vue est l'endroit où l'on arrange.
    await page.evaluate(() => document.querySelectorAll('.struct-row')[3].querySelector('[data-struct="haut"]').click());
    await page.waitForTimeout(400);
    const ordre = await page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections.map(s => s.title));
    check(ordre[2] === 'Pont' && ordre[3] === 'Couplet (variation)',
        `monter une partie réordonne la GRILLE elle-même — ${JSON.stringify(ordre)}`);

    check(erreurs.length === 0, `aucune erreur JavaScript (${erreurs.slice(0, 2).join(' | ')})`);

    await navigateur.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
