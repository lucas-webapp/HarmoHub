// La conduite de voix et le séquenceur partagent la même zone : ouvrir l'un ferme l'autre.
// Retour utilisateur d'origine : « lorsque j'active le mode loupe+séquenceur, les barres du voice
// leading restent affichées et je ne peux pas l'enlever ». Deux causes, mesurées à l'époque : le
// panneau vivait DANS #progression-sections, déplacé en entier dans la loupe plein écran, donc il
// suivait la grille sans qu'on l'ait demandé ; et le bouton #toggle-voice-leading se retrouvait
// derrière l'en-tête de cette loupe, impossible à recliquer.
//
// CONTRAT MIS À JOUR (trois fois, d'où ce préambule un peu long).
// 1. La loupe plein écran n'existe plus : c'est le VOLET du séquenceur continu, ancré sous la grille,
//    qui a pris sa place (#grid-zoom -> toggleSequencer('continu')). gridZoomOpen a disparu avec
//    elle ; l'état se lit désormais sur seqMode.
// 2. Le choix « on MASQUE sans éteindre, le réglage survit à l'aller-retour » a été abandonné. Les
//    deux panneaux s'ÉTEIGNENT mutuellement, et c'est écrit dans le code des deux côtés :
//    toggleSequencer fait `voiceLeadingOpen = false`, toggleVoiceLeadingPanel referme le séquenceur.
// 3. LOT 9c (refonte) : sur ORDINATEUR, la conduite de voix n'est plus un panneau voisin du séquenceur, c'est un CALQUE de l'éditeur de notes
//    (« Calque Voix = l'ancienne conduite de voix », docs/refonte.md). Plus rien à exclure : le calque vit DANS le séquenceur continu. Ce que la
//    plainte d'origine demandait reste vrai et c'est ce que la partie B tient : on peut toujours l'enlever (son bouton n'est jamais recouvert), il
//    ne déborde jamais hors de l'éditeur, et rien n'en reste quand l'éditeur se ferme. Décision du 05/11 : le réglage est MÉMORISÉ (il revient à la
//    réouverture), contrairement à l'ancien panneau. Le TÉLÉPHONE (< 900px) garde le panneau et l'exclusion mutuelle jusqu'au lot 10 : la partie A
//    rejoue le contrat 2 tel quel, à 860px.
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('conduite de voix et séquenceur continu');
const R = require('./_retrait_ancien');
const { estBruitReseau } = require('./_harness');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
// La police vient de Google Fonts, injoignable derrière le proxy du bac à sable : bruit filtré.

plan(11);

const mk = (root, q) => ({ root, quality: q, beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held', instrument: 'piano', arpPattern: '', seqEdited: false, guitarLock: null, extraNotes: [], intensity: 75, intensityPerStep: {} });

(async () => {
    const browser = await chromium.launch();
    const errs = [];
    const ouvrir = async (viewport, extra = {}) => {
        const page = await browser.newPage({ viewport, ...extra });
        page.on('pageerror', e => errs.push(e.message));
        page.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) errs.push('console: ' + m.text()); });
        await page.goto(`${BASE}/index.html`);
        await page.waitForTimeout(500);
        await page.evaluate((s) => {
            const mk = eval('(' + s + ')');
            localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet',
                chords: [mk('C', 'maj'), mk('A', 'min7'), mk('F', 'maj7'), mk('G', 'dom7')] }] }));
            localStorage.removeItem('harmohubSeqVoix');
            sessionStorage.setItem('cc_accueil_vu', '1');
        }, mk.toString());
        await page.reload();
        await page.waitForTimeout(900);
        return page;
    };
    const atteignable = (page, id) => page.evaluate((id) => {
        const b = document.getElementById(id);
        const r = b.getBoundingClientRect();
        if (!r.width) return false;
        const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !!(el && (el === b || b.contains(el)));
    }, id);

    let page;
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
    // ORDINATEUR — RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4a, 12/11, « réécriture courte ») : la loupe de la conduite de voix (calque Voix, chemin des voix, loupe, zoom) a disparu
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

    await browser.close();
    check(errs.length === 0, 'aucune erreur JavaScript' + (errs.length ? ' — ' + errs[0] : ''));
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
