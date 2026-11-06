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
const { estBruitReseau } = require('./_harness');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
// La police vient de Google Fonts, injoignable derrière le proxy du bac à sable : bruit filtré.

plan(23);

const mk = (root, q) => ({ root, quality: q, beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held', instrument: 'piano', arpPattern: '', seqEdited: false, guitarLock: null, extraNotes: [], intensity: 75, intensityPerStep: {} });

(async () => {
    const browser = await chromium.launch();
    const errs = [];
    const ouvrir = async (viewport) => {
        const page = await browser.newPage({ viewport });
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
    // Lot 10f : le téléphone a le MÊME éditeur et le même calque que l'ordinateur (plus d'exclusion avec un ancien panneau) : mêmes vérifications aux deux largeurs.
    for (const [nom, larg] of [['TÉLÉPHONE (860px)', 860], ['ORDINATEUR (1440px)', 1440]]) {
        // ======================================================================================================
        console.log(`\n=== ${nom} : un calque DANS l'éditeur, qu'on peut toujours enlever ===`);
        page = await ouvrir({ width: larg, height: 900 });
        const calque = () => page.evaluate(() => {
            const ed = document.getElementById('seq-dock-panel');
            // Ce qui se VOIT : fermé, le séquenceur garde son dernier dessin dans un hôte masqué (renderSequencer ne redessine pas un panneau fermé).
            const el = [...document.querySelectorAll('.seq-voix-trait, .seq-note-fn, .seq-voix-accord')].filter(e => e.offsetParent !== null);
            return {
                volet: window.app.seqMode === 'continu', ancien: !!document.querySelector('.voice-leading-panel'),
                presents: el.length, horsEditeur: el.filter(e => !ed.contains(e)).length,
                presse: document.getElementById('editeur-notes-voix').getAttribute('aria-pressed'),
            };
        });
        check(!(await page.locator('#toggle-voice-leading').isVisible()) && !(await page.locator('#editeur-notes-voix').isVisible()),
            'éditeur fermé : aucune porte de conduite de voix (l\'icône ⊱ a quitté la page, Voix vit dans l\'éditeur)');
        await page.click('#progression-sections .grid-cell[data-index="0"]');
        await page.waitForTimeout(300);
        await page.click('#grid-zoom');
        await page.waitForTimeout(800);
        exiger(await atteignable(page, 'editeur-notes-voix'), 'éditeur ouvert : le bouton Voix est atteignable, rien ne le recouvre');
        await page.click('#editeur-notes-voix');
        await page.waitForTimeout(700);
        let c = await calque();
        check(c.volet && c.presents > 0 && c.presse === 'true', 'un clic pose le calque, et l\'éditeur reste ouvert (plus d\'exclusion : le calque vit dedans)');
        check(c.horsEditeur === 0 && !c.ancien, 'rien n\'en déborde hors de l\'éditeur, et aucun ancien panneau ne s\'affiche');
        // Un autre accord, choisi DANS l'éditeur (la zone de l'accord voisin, le geste de l'éditeur pour changer d'accord) : le calque suit.
        const zone = await page.locator('#arp-sequencer .seq-ctx-nav[data-target-index="2"]').boundingBox();
        exiger(!!zone, 'la zone de l\'accord voisin F est à l\'écran');
        await page.mouse.click(zone.x + 8, zone.y + 8);
        await page.waitForTimeout(800);
        c = await calque();
        check(c.presents > 0 && await page.evaluate(() => window.app.editingIndex === 2 && document.getElementById('arp-sequencer').offsetParent !== null),
            'un autre accord chargé dans l\'éditeur : le calque est toujours là, sur le séquenceur affiché');
        await page.click('#editeur-notes-fermer');
        await page.waitForTimeout(800);
        c = await calque();
        check(!c.volet && c.presents === 0, 'l\'éditeur fermé, il ne reste rien du calque dans la page');
        await page.click('#grid-zoom');
        await page.waitForTimeout(800);
        c = await calque();
        check(c.volet && c.presents > 0 && c.presse === 'true', 'rouvert, le calque revient (réglage mémorisé, décision du 05/11)');
        check(await atteignable(page, 'editeur-notes-voix'), 'le bouton reste atteignable, calque allumé');
        await page.click('#editeur-notes-voix');
        await page.waitForTimeout(600);
        c = await calque();
        check(c.presents === 0 && c.presse === 'false', 'un clic l\'enlève pour de bon');
        await page.click('#editeur-notes-voix');
        await page.waitForTimeout(600);
        c = await calque();
        check(c.presents > 0 && c.presse === 'true', '...et un second le remet');
        await page.close();

    }

    await browser.close();
    check(errs.length === 0, 'aucune erreur JavaScript' + (errs.length ? ' — ' + errs[0] : ''));
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
