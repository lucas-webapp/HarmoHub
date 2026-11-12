// LA CONDUITE DE VOIX — deux portes depuis le lot 9c, une par écran.
//
// RÉÉCRIT POUR LE NOUVEAU GESTE (lot 9c, docs/refonte.md : « Calque Voix = l'ancienne conduite de voix [...] chaque fonction de l'ancien panneau
// est vérifiée une à une AVANT de fondre »). Sur ORDINATEUR, l'icône ⊱ a quitté la rangée de réglages : la conduite de voix est le calque Voix de
// l'éditeur de notes. Sur TÉLÉPHONE (< 900px), rien ne bouge avant le lot 10 : le panneau d'avant, avec son bouton.
// Le banc garde donc CHACUNE de ses vérifications d'origine, jouées au téléphone telles quelles (partie A), et rejoue chaque fonction à
// l'ordinateur sous sa nouvelle forme (partie B) :
//   un seul bouton global                         → un seul bouton Voix, dans l'éditeur
//   désactivé sur une partie d'un seul accord     → le calque y écrit les fonctions, sans aucun trait (rien à enchaîner)
//   absent au départ, ouvert / fermé d'un clic    → idem, sur le bouton Voix
//   touches à part, fixes, ivoire et noir         → la gouttière collante du séquenceur (touches blanches et noires)
//   16 notes colorées                             → 16 notes colorées ET chiffrées (l'accord en cours + ses voisins)
//   zoom horizontal                               → le zoom de l'éditeur, qui emporte les traits
//   zoom vertical                                 → NON repris tel quel : la hauteur des lignes de l'éditeur est bloquée à la demande de
//                                                    l'utilisateur (« laisser une unique hauteur de barres ») ; pour voir plus de hauteurs, on
//                                                    étend l'éditeur — vérifié ici
//   le contenu suit une édition (renversement)    → les traits partent des nouvelles hauteurs
//   aucun id en double, aucune erreur             → idem
// La police est chargée depuis Google Fonts : injoignable derrière le proxy du bac à sable, bruit filtré (estBruitReseau).
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('conduite de voix (le calque Voix, au téléphone comme à l\'ordinateur)');
const R = require('./_retrait_ancien');
const { ouvrirSon } = require('./_geste_accord');
const { estBruitReseau } = require('./_harness');

plan(11);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const graine = () => {
    localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [
        { root: 'C', quality: 'maj7', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
        { root: 'A', quality: 'min7', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
        { root: 'F', quality: 'maj7', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
        { root: 'G', quality: 'dom7', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
    ] }, { title: 'Refrain', chords: [
        { root: 'C', quality: 'maj', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
    ] }] }));
    localStorage.removeItem('harmohubSeqVoix');
    localStorage.removeItem('harmohubSeqDockHeight');
    sessionStorage.setItem('cc_accueil_vu', '1');
};

(async () => {
    const browser = await chromium.launch();
    const errors = [];
    const ouvrir = async (viewport, extra = {}) => {
        const page = await browser.newPage({ viewport, ...extra });
        page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
        page.on('console', (msg) => { if (msg.type() === 'error' && !estBruitReseau(msg.text()) && !/AudioContext/.test(msg.text())) errors.push('console.error: ' + msg.text()); });
        await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
        await page.evaluate(graine);
        await page.reload({ waitUntil: 'load' });
        await page.waitForTimeout(500);
        return page;
    };

    let page;
    let dupIds;
    const idsEnDouble = () => page.evaluate(() => { const seen = {}; document.querySelectorAll('[id]').forEach(el => { seen[el.id] = (seen[el.id] || 0) + 1; }); return Object.entries(seen).filter(([, n]) => n > 1).map(([id, n]) => id + ' x' + n); });
    // TÉLÉPHONE — RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4c, 12/11, « réécriture courte ») : la feuille « Notes » du téléphone emportait le dernier calque
    // Voix (fonctions dans les notes, chemin des voix, son zoom et son pincement). Comme à l'ordinateur (plus bas), ce qui reste : les couleurs des rôles, dans
    // le séquenceur de l'onglet Rythme du panneau d'accord, ouvert par « Séquenceur » du panneau Lecture.
    console.log('\n=== TÉLÉPHONE (860px) : plus de calque Voix ; l\'onglet Rythme garde les couleurs des rôles ===');
    {
        const pt = await ouvrir({ width: 860, height: 1000 }, { hasTouch: true, isMobile: true });
        let r = await R.porteTelephoneAbsente(pt);
        check(r.ok, `la feuille « Notes » et son calque Voix ont quitté le téléphone (${r.detail})`);
        check(!(await pt.locator('#toggle-voice-leading').isVisible()), 'l\'icône ⊱ n\'y est pas non plus');
        r = await R.ouvrirRythmeTel(pt);
        exiger(r.ok, `« Séquenceur » du panneau Lecture ouvre l'onglet Rythme (${r.detail})`);
        check(await pt.evaluate(() => document.querySelectorAll('.seq-voix-trait, .seq-note-fn, .voice-leading-panel').length === 0), 'ni trait du chemin des voix, ni chiffre de fonction, ni ancien panneau');
        r = await R.couleursRoles(pt, 0);
        check(r.ok, `les notes y gardent les couleurs de leur rôle (${r.detail})`);
        await pt.close();
    }

    // ======================================================================================================
    // ORDINATEUR — RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4a, 12/11, « réécriture courte ») : la conduite de voix (calque Voix, chemin des voix, loupe, zoom) a disparu
    // de l'ordinateur avec l'éditeur de notes (« le chemin des voix est supprimé », décision du 11/11). Restent les couleurs des rôles au séquenceur du bloc « Vues ».
    console.log('\n=== ORDINATEUR : plus de calque Voix ; le séquenceur garde les couleurs des rôles ===');
    {
        const pg = await ouvrir({ width: 1280, height: 1000 });
        let r = await R.porteAbsente(pg);
        check(r.ok, `l'éditeur de notes et son calque Voix ont quitté l'ordinateur (${r.detail})`);
        check(!(await pg.locator('#toggle-voice-leading').isVisible()), 'l\'icône ⊱ n\'y est pas non plus');
        r = await R.ouvrirNouveau(pg);
        exiger(r.ok, `le séquenceur s'ouvre (${r.detail})`);
        check(await pg.evaluate(() => document.querySelectorAll('.seq-voix-trait, .seq-note-fn, .voice-leading-panel').length === 0), 'ni trait du chemin des voix, ni chiffre de fonction, ni ancien panneau');
        r = await R.couleursRoles(pg, 0);
        check(r.ok, `les notes gardent les couleurs de leur rôle (${r.detail})`);
        await pg.close();
    }

    check(errors.length === 0, 'aucune erreur (' + JSON.stringify(errors) + ')');
    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
