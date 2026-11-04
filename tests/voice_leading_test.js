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
const { check, exiger, plan, bilan } = require('./_harness')('conduite de voix (téléphone : panneau ; ordinateur : calque Voix)');
const { estBruitReseau } = require('./_harness');

plan(35);

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
    const ouvrir = async (viewport) => {
        const page = await browser.newPage({ viewport });
        page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
        page.on('console', (msg) => { if (msg.type() === 'error' && !estBruitReseau(msg.text()) && !/AudioContext/.test(msg.text())) errors.push('console.error: ' + msg.text()); });
        await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
        await page.evaluate(graine);
        await page.reload({ waitUntil: 'load' });
        await page.waitForTimeout(500);
        return page;
    };

    // ======================================================================================================
    console.log('\n=== A. TÉLÉPHONE (860px) : le panneau d\'avant, vérifications d\'origine ===');
    let page = await ouvrir({ width: 860, height: 1000 });
    const btnCount = await page.evaluate(() => document.querySelectorAll('#toggle-voice-leading').length);
    check(btnCount === 1 && await page.locator('#toggle-voice-leading').isVisible(), 'un seul bouton global (pas un par partie), visible — trouvé ' + btnCount);
    await page.evaluate(() => { window.app.setActiveSection(1); }); // "Refrain", 1 seul accord (lecture d'état seulement : aucun geste ne choisit une partie vide de sélection)
    await page.waitForTimeout(100);
    let disabled = await page.evaluate(() => document.querySelector('#toggle-voice-leading').disabled);
    check(disabled, 'désactivé sur la partie à 1 seul accord (Refrain)');
    await page.evaluate(() => { window.app.setActiveSection(0); }); // retour sur "Couplet", 4 accords
    await page.waitForTimeout(100);
    disabled = await page.evaluate(() => document.querySelector('#toggle-voice-leading').disabled);
    check(!disabled, 'réactivé sur la partie à 4 accords (Couplet)');
    check(await page.evaluate(() => document.querySelectorAll('.voice-leading-panel').length) === 0, 'panneau absent au départ (fermé par défaut)');
    await page.click('#toggle-voice-leading');
    await page.waitForTimeout(150);
    check(await page.evaluate(() => document.querySelectorAll('.voice-leading-panel').length) === 1, 'panneau présent après clic');
    check(await page.evaluate(() => !!document.querySelector('.voice-leading-panel svg')), 'un <svg> est bien rendu dans le panneau');
    check(await page.evaluate(() => document.querySelector('#toggle-voice-leading').classList.contains('active')), 'le bouton passe en état actif (classe .active)');
    const twoSvgs = await page.evaluate(() => ({
        keys: !!document.querySelector('.voice-leading-keys svg'),
        notes: !!document.querySelector('.voice-leading-scroll svg'),
        distinct: document.querySelector('.voice-leading-keys svg') !== document.querySelector('.voice-leading-scroll svg'),
    }));
    check(twoSvgs.keys && twoSvgs.notes && twoSvgs.distinct, 'deux <svg> distincts (touches + notes) — ' + JSON.stringify(twoSvgs));
    const noteRectCount = await page.evaluate(() => [...document.querySelector('.voice-leading-scroll svg').querySelectorAll('rect[fill^="url(#vlg-"]')].length);
    check(noteRectCount === 16, '16 notes colorées rendues (4 accords x 4 notes) — trouvé ' + noteRectCount);
    const keyColors = await page.evaluate(() => [...new Set([...document.querySelectorAll('.voice-leading-keys svg rect')].map(r => r.getAttribute('fill')))]);
    check(keyColors.includes('#ece1cd') && keyColors.includes('#171310'), 'couleurs ivoire (#ece1cd) et noir (#171310) trouvées — ' + JSON.stringify(keyColors));
    const dim = () => page.evaluate(() => { const svg = document.querySelector('.voice-leading-scroll svg'); return { w: +svg.getAttribute('width'), h: +svg.getAttribute('height') }; });
    const dimsBefore = await dim();
    await page.click('.voice-leading-zoom-in-h');
    await page.click('.voice-leading-zoom-in-h');
    await page.click('.voice-leading-zoom-in-v');
    await page.click('.voice-leading-zoom-in-v');
    await page.waitForTimeout(150);
    const dimsAfter = await dim();
    check(dimsAfter.w > dimsBefore.w, 'largeur augmentée après 2 clics zoom H (' + dimsBefore.w + ' -> ' + dimsAfter.w + ')');
    check(dimsAfter.h > dimsBefore.h, 'hauteur augmentée après 2 clics zoom V (' + dimsBefore.h + ' -> ' + dimsAfter.h + ')');
    const keysHeightAfter = await page.evaluate(() => +document.querySelector('.voice-leading-keys svg').getAttribute('height'));
    check(keysHeightAfter === dimsAfter.h, 'la colonne des touches suit la même hauteur que la zone de notes (' + keysHeightAfter + ' === ' + dimsAfter.h + ')');
    const idsEnDouble = () => page.evaluate(() => { const seen = {}; document.querySelectorAll('[id]').forEach(el => { seen[el.id] = (seen[el.id] || 0) + 1; }); return Object.entries(seen).filter(([, n]) => n > 1).map(([id, n]) => id + ' x' + n); });
    let dupIds = await idsEnDouble();
    check(dupIds.length === 0, 'aucun id dupliqué dans le DOM (bug de la maquette corrigé) — ' + JSON.stringify(dupIds));
    await page.click('#toggle-voice-leading');
    await page.waitForTimeout(150);
    check(await page.evaluate(() => document.querySelectorAll('.voice-leading-panel').length) === 0, 'panneau retiré du DOM après re-clic');
    // Ré-ouvre, édite un accord (renversement) : le panneau se met à jour.
    await page.click('#toggle-voice-leading');
    await page.waitForTimeout(150);
    const lireNoms = () => page.evaluate(() => { const svg = document.querySelector('.voice-leading-scroll svg'); return svg ? [...svg.querySelectorAll('text[font-family="ui-monospace, monospace"]')].map(t => t.textContent) : null; });
    const beforeMidis = await lireNoms();
    await page.evaluate(() => { window.app.editChord(0, 0); }); // ouvre l'édition du 1er accord, comme le banc d'origine (téléphone inchangé, lot 10)
    await page.waitForTimeout(150);
    // Le renversement se choisit par les SEGMENTS de la rangée de voicing (la liste déroulante, masquée, reste la source de vérité de readChord).
    exiger(!!(await page.$('#inversion-seg .voicing-segment[data-valeur="1"]')), 'le panneau Accord (avec les segments de renversement) s\'est bien ouvert');
    await page.click('#inversion-seg .voicing-segment[data-valeur="1"]');
    await page.waitForTimeout(250);
    const afterMidis = await lireNoms();
    check(afterMidis !== null, 'le panneau existe toujours après édition (pas de crash)');
    check(JSON.stringify(afterMidis) !== JSON.stringify(beforeMidis), 'le contenu du panneau a bien changé après le renversement');
    await page.close();

    // ======================================================================================================
    console.log('\n=== B. ORDINATEUR (1280px) : la même chose, sous sa nouvelle forme — le calque Voix ===');
    page = await ouvrir({ width: 1280, height: 1000 });
    check(!(await page.locator('#toggle-voice-leading').isVisible()) && await page.evaluate(() => document.querySelectorAll('#editeur-notes-voix').length === 1),
        'un seul bouton : Voix, dans l\'éditeur de notes (l\'icône ⊱ a quitté la rangée de réglages)');
    // Le Couplet : un clic sur Am7 dans la grille, puis l'éditeur de notes, puis Voix.
    await page.click('#progression-sections .grid-cell[data-section="0"][data-index="1"]');
    await page.waitForTimeout(300);
    await page.click('#grid-zoom');
    await page.waitForTimeout(900);
    check(await page.evaluate(() => document.querySelectorAll('.seq-voix-trait, .seq-note-fn').length === 0), 'calque absent au départ (éteint par défaut)');
    await page.click('#editeur-notes-voix');
    await page.waitForTimeout(700);
    let v = await page.evaluate(() => ({
        notes: document.querySelectorAll('#arp-sequencer .seq-note').length, voisines: document.querySelectorAll('#arp-sequencer .seq-ctx-note').length,
        chiffrees: document.querySelectorAll('#arp-sequencer .seq-note .seq-note-fn, #arp-sequencer .seq-ctx-note .seq-note-fn').length,
        colorees: [...document.querySelectorAll('#arp-sequencer .seq-note, #arp-sequencer .seq-ctx-note')].filter(n => /role-(root|third|fifth|seventh|ext)/.test(n.className)).length,
        traits: document.querySelectorAll('#arp-sequencer .seq-voix-trait').length, accord: window.app.editingIndex, partie: window.app.activeSection,
        presse: document.getElementById('editeur-notes-voix').getAttribute('aria-pressed'),
    }));
    exiger(v.partie === 0 && v.accord === 1 && v.presse === 'true', 'l\'éditeur montre le Couplet autour de Am7, calque allumé');
    check(v.notes + v.voisines === 16 && v.colorees === 16 && v.chiffrees === 16, `16 notes colorées ET chiffrées : l'accord en cours + ses trois voisins (${v.notes} + ${v.voisines}, ${v.chiffrees} chiffres)`);
    check(v.traits === 12, `le chemin des voix : 4 voix x 3 enchaînements = 12 traits (${v.traits})`);
    const touches = await page.evaluate(() => {
        const b = document.querySelector('#arp-sequencer .seq-label.seq-key-white'), n = document.querySelector('#arp-sequencer .seq-label.seq-key-black');
        return { pos: b && getComputedStyle(b).position, blanc: b && getComputedStyle(b).backgroundImage, noir: n && getComputedStyle(n).backgroundImage, horsNotes: !!b && !b.closest('.seq-note') };
    });
    check(touches.pos === 'sticky' && touches.horsNotes, 'les touches sont à part des notes et restent fixes au défilement (gouttière collante)');
    check(/243, 237, 224/.test(touches.blanc || '') && /23, 19, 16/.test(touches.noir || ''), 'touches ivoire et noires, les couleurs du clavier de l\'appli');
    const alignees = await page.evaluate(() => [...document.querySelectorAll('#arp-sequencer .seq-label[data-row-voice]:not([data-row-voice="-1"])')].every(l => {
        const c = document.querySelector(`#arp-sequencer .seq-cell[data-voice="${l.dataset.rowVoice}"]`); if (!c) return false;
        const a = l.getBoundingClientRect(), b = c.getBoundingClientRect(); return Math.abs(a.top - b.top) <= 1 && Math.abs(a.height - b.height) <= 1;
    }));
    check(alignees, 'chaque touche fait face à SA ligne de notes, même hauteur');
    const largeur = () => page.evaluate(() => document.querySelector('#arp-sequencer .seq-cell[data-step="0"]').getBoundingClientRect().width);
    const ecartTraits = () => page.evaluate(() => Math.max(0, ...[...document.querySelectorAll('#arp-sequencer .seq-voix-mouvement')].map(t => {
        const nav = document.querySelector(`#arp-sequencer .seq-ctx-nav[data-target-index="${t.dataset.accord}"]`);
        const x = (nav || document.querySelector('#arp-sequencer .seq-cell[data-step="0"]')).getBoundingClientRect().left;
        const r = t.getBoundingClientRect(); return Math.abs(r.left + r.width / 2 - x);
    })));
    const l0 = await largeur();
    await page.click('#seq-zoom-in-h-inline');
    await page.click('#seq-zoom-in-h-inline');
    await page.waitForTimeout(500);
    const l1 = await largeur();
    check(l1 > l0, `largeur augmentée après 2 clics zoom + (${l0.toFixed(1)} -> ${l1.toFixed(1)} px par case)`);
    check(await ecartTraits() <= 2, 'les traits suivent le zoom, sur leurs frontières');
    const hauteurBande = () => page.evaluate(() => Math.round(document.querySelector('#arp-sequencer .seq-scroll').getBoundingClientRect().height));
    const h0 = await hauteurBande();
    await page.click('#editeur-notes-etendre');
    await page.waitForTimeout(700);
    const h1 = await hauteurBande();
    check(h1 > h0, `plus de hauteurs à voir : on étend l'éditeur (la hauteur des lignes reste bloquée) — ${h0} -> ${h1} px`);
    dupIds = await idsEnDouble();
    check(dupIds.length === 0, 'aucun id dupliqué dans le DOM — ' + JSON.stringify(dupIds));
    const lireTraits = () => page.evaluate(() => [...document.querySelectorAll('#arp-sequencer .seq-voix-trait')].map(t => t.dataset.accord + ':' + t.dataset.de + '>' + t.dataset.vers).sort().join(' '));
    const avant = await lireTraits();
    await page.click('#inversion-seg .voicing-segment[data-valeur="1"]');
    await page.waitForTimeout(600);
    const apres = await lireTraits();
    check(apres !== '' && apres !== avant, 'le calque a bien changé après le renversement de l\'accord en cours');
    await page.click('#editeur-notes-voix');
    await page.waitForTimeout(500);
    check(await page.evaluate(() => document.querySelectorAll('.seq-voix-trait, .seq-note-fn, .seq-voix-accord').length === 0 && document.getElementById('editeur-notes-voix').getAttribute('aria-pressed') === 'false'),
        'un second clic sur Voix retire tout le calque');
    check(await page.evaluate(() => !document.querySelector('.voice-leading-panel')), 'aucun ancien panneau à l\'ordinateur');
    // Une partie d'UN seul accord : on ferme, on choisit le Refrain dans la grille, on rouvre ; Voix rallumé.
    await page.click('#editeur-notes-fermer');
    await page.waitForTimeout(500);
    await page.click('#progression-sections .grid-cell[data-section="1"][data-index="0"]');
    await page.waitForTimeout(300);
    await page.click('#grid-zoom');
    await page.waitForTimeout(900);
    await page.click('#editeur-notes-voix');
    await page.waitForTimeout(700);
    v = await page.evaluate(() => ({ fn: document.querySelectorAll('#arp-sequencer .seq-note-fn').length, traits: document.querySelectorAll('#arp-sequencer .seq-voix-trait').length, partie: window.app.activeSection, presse: document.getElementById('editeur-notes-voix').getAttribute('aria-pressed') }));
    check(v.partie === 1 && v.presse === 'true' && v.fn === 3 && v.traits === 0, `partie d'un seul accord : les fonctions s'écrivent, aucun trait — rien à enchaîner (${v.fn} chiffres, ${v.traits} traits)`);
    await page.close();

    check(errors.length === 0, 'aucune erreur (' + JSON.stringify(errors) + ')');
    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
