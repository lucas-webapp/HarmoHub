// FILET DE REFONTE — Lot 0. Ce banc ne teste aucune nouveauté : il fige une EXIGENCE que la refonte
// de l'interface (volet de gauche remplacé par un inspecteur contextuel) ne doit jamais casser.
//
// Retour utilisateur, mot pour mot : « Voici ce que je veux toujours voir apparaître : nom du
// morceau, tonalité, tempo, les boutons fichier, enregistrer, import/export etc... »
//
// « TOUJOURS » se décline en quatre situations, et c'est là que le risque est réel : la refonte fait
// APPARAÎTRE ET DISPARAÎTRE des blocs selon la sélection. Un élément peut donc rester dans le DOM,
// garder une taille non nulle, et pourtant devenir inatteignable — poussé hors de l'écran par un
// panneau qui vient de s'ouvrir, ou recouvert par lui. Le banc éprouve donc les quatre cas :
//     ordinateur / mode Ajout      ordinateur / mode Modification
//     téléphone  / mode Ajout      téléphone  / mode Modification
//
// ET IL NE SE CONTENTE PAS DU RECTANGLE. Trois questions séparées, parce que chacune a sa propre
// façon de tomber :
//   1. l'élément a-t-il une surface ? (display:none, hauteur 0 — la panne la plus grossière)
//   2. cette surface est-elle DANS la fenêtre ? (poussé sous le pli par un panneau plus haut —
//      c'est exactement le défaut déjà signalé pour les boutons du bas : « Ne sont pas descendus en
//      bas de page », ils étaient bien là, simplement hors de vue)
//   3. le clic l'atteint-il ? (document.elementFromPoint en son centre — un panneau flottant
//      posé PAR-DESSUS laisse le rectangle intact et vole quand même tous les clics ; c'est le
//      risque propre au « panneau volant » du séquenceur qu'on s'apprête à ajouter)
//
// AUCUN clic préalable n'est autorisé pour révéler ces éléments : « toujours voir » veut dire à
// l'ouverture, sans rien déplier. C'est pour ça que la tonalité et le tempo sont lus sur la ligne de
// résumé (#song-summary-bpm / #song-summary-key), et non sur les réglages qu'elle déplie.
const { chromium, devices } = require('playwright');
const creerHarnais = require('./_harness');
const { plan, check, exiger, bilan } = creerHarnais('Filet : ce qui doit TOUJOURS rester visible');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';

// Les sept choses nommées par l'utilisateur. Le libellé sert au message d'échec : il doit parler de
// la FONCTION (« le nom du morceau »), pas de l'adresse technique, pour rester lisible dans deux ans.
const INDISPENSABLES = [
    ['#song-select',      'le nom du morceau'],
    ['#song-summary-key', 'la tonalité'],
    ['#song-summary-bpm', 'le tempo'],
    ['#song-files',       'le bouton fichiers'],
    ['#song-save',        'le bouton enregistrer'],
    ['#song-import',      'le bouton importer'],
    ['#song-export',      'le bouton exporter'],
];

const seed = () => {
    const mk = (r, q, b) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 0, octave: 3, bass: null, playStyle: 'held' });
    const song = {
        id: 'filet-visible-1', name: 'Morceau du filet', bpm: 120, timeSig: '4/4', groove: 'straight',
        sections: [{ title: 'Couplet', chords: [mk('C', 'maj7', 4), mk('F', 'maj', 4), mk('G', '7', 4)] }],
    };
    localStorage.setItem('harmohubSongs', JSON.stringify([song]));
    localStorage.setItem('harmohubCurrentSongId', song.id);
    localStorage.setItem('myProgression', JSON.stringify({ sections: song.sections }));
};

// Rendu dans la page : les trois questions posées d'un coup, pour un seul aller-retour.
const auditer = (liste) => liste.map(([sel, nom]) => {
    const el = document.querySelector(sel);
    if (!el) return { nom, sel, present: false };
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    const surface = r.width > 0 && r.height > 0 && st.display !== 'none' && st.visibility !== 'hidden' && +st.opacity > 0.05;
    // Marge de 1px : un élément qui affleure exactement le bord n'est pas un défaut.
    const dansFenetre = r.top >= -1 && r.left >= -1 && r.bottom <= window.innerHeight + 1 && r.right <= window.innerWidth + 1;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const dessus = (cx >= 0 && cy >= 0 && cx <= window.innerWidth && cy <= window.innerHeight)
        ? document.elementFromPoint(cx, cy) : null;
    // « Atteignable » = ce qui répond au centre est l'élément lui-même, un de ses enfants, ou un de
    // ses parents (cas normal d'un <select> ou d'un bouton dont l'étiquette occupe le centre).
    const atteignable = !!dessus && (dessus === el || el.contains(dessus) || dessus.contains(el));
    const voleur = atteignable ? null : (dessus ? (dessus.id ? '#' + dessus.id : dessus.className || dessus.tagName) : 'rien');
    return { nom, sel, present: true, surface, dansFenetre, atteignable, voleur,
             rect: { t: Math.round(r.top), b: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) },
             vh: window.innerHeight };
});

async function eprouver(page, contexte) {
    const res = await page.evaluate(auditer, INDISPENSABLES);
    for (const r of res) {
        if (!r.present) { check(false, `${contexte} — ${r.nom} : introuvable dans la page (${r.sel})`); continue; }
        const ok = r.surface && r.dansFenetre && r.atteignable;
        let pourquoi = '';
        if (!r.surface) pourquoi = 'aucune surface visible';
        else if (!r.dansFenetre) pourquoi = `hors de la fenêtre (haut ${r.rect.t}, bas ${r.rect.b}, fenêtre ${r.vh}px)`;
        else if (!r.atteignable) pourquoi = `recouvert : le clic atteint ${r.voleur}`;
        check(ok, `${contexte} — ${r.nom} est visible et cliquable${ok ? '' : ' — ' + pourquoi}`);
    }
    return res;
}

(async () => {
    plan(28); // 7 éléments × 4 situations
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const erreurs = [];

    // ---------- ORDINATEUR ----------
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', e => erreurs.push('ordinateur : ' + e.message));
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await page.waitForTimeout(300);
    await page.evaluate(seed);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(500);

    exiger(await page.evaluate(() => window.app && window.app.appMode === 'add'), 'ordinateur : on démarre bien en mode Ajout (aucun accord sélectionné)');
    await eprouver(page, 'ordinateur, mode Ajout');

    // Mode Modification par un VRAI geste sur un accord : c'est lui qui fait apparaître le panneau
    // d'édition, donc lui qui peut recouvrir ou repousser le reste.
    // DOUBLE-clic, et non simple : « je veux une seule possibilité : double clic pour modifier »
    // (retour utilisateur, voir le gestionnaire isSecondTap dans script.js — simple clic = écouter).
    // On vise le BAS de la case, pas son centre : au centre se trouve le symbole d'accord, dont le
    // double-clic ouvre la retape du texte (d.symTarget) au lieu du panneau. Et on reste au milieu
    // horizontalement pour éviter les poignées .cell-resize des deux bords.
    const caseAccord = await page.locator('.grid-cell').first().boundingBox();
    const cx = caseAccord.x + caseAccord.width / 2, cy = caseAccord.y + caseAccord.height * 0.85;
    await page.mouse.click(cx, cy);
    await page.waitForTimeout(90);
    await page.mouse.click(cx, cy);
    await page.waitForTimeout(450);
    exiger(await page.evaluate(() => window.app.appMode === 'edit'), 'ordinateur : le clic sur un accord fait bien entrer en mode Modification');
    await eprouver(page, 'ordinateur, mode Modification');
    await page.close();

    // ---------- TÉLÉPHONE ----------
    const ctx = await browser.newContext({ ...devices['iPhone 13'] });
    const m = await ctx.newPage();
    m.on('pageerror', e => erreurs.push('téléphone : ' + e.message));
    await m.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await m.waitForTimeout(300);
    await m.evaluate(seed);
    await m.reload({ waitUntil: 'load' });
    await m.waitForTimeout(600);

    await eprouver(m, 'téléphone, mode Ajout');

    // Sur téléphone, le geste est un VRAI toucher (dispatchTouchEvent via CDP) : un
    // element.dispatchEvent(new TouchEvent(...)) ne synthétise PAS les évènements pointeur dans
    // Chromium, et le banc passerait à côté de tout le code de sélection.
    // Double-TAP, dans la fenêtre de 420ms que reconnaît isSecondTap, et hors du symbole (bas de la
    // case) pour la même raison que sur ordinateur.
    const cdp = await ctx.newCDPSession(m);
    const boite = await m.locator('.grid-cell').first().boundingBox();
    if (exiger(!!boite, 'téléphone : une case d\'accord est atteignable au doigt')) {
        const x = boite.x + boite.width / 2, y = boite.y + boite.height * 0.85;
        for (let i = 0; i < 2; i++) {
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            if (i === 0) await m.waitForTimeout(120);
        }
        await m.waitForTimeout(500);
    }
    const modeTel = await m.evaluate(() => window.app.appMode);
    check(modeTel === 'edit', `téléphone : le toucher sur un accord fait entrer en mode Modification — mode ${modeTel}`);
    await eprouver(m, 'téléphone, mode Modification');

    check(erreurs.length === 0, `aucune erreur JavaScript pendant le parcours — ${erreurs.join(' | ') || 'aucune'}`);
    await browser.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
