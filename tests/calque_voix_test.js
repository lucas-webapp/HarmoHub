// L'ÉDITEUR DE NOTES : LE CALQUE VOIX (refonte, lot 9c), avec de vrais gestes.
// RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4a, 12/11) : à l'ordinateur le calque a disparu (partie A, courte) ; le téléphone le garde jusqu'à l'étape 4c.
//
// CE QUE DEMANDE LA MAQUETTE VALIDÉE (docs/refonte.md) : « Calque Voix = l'ancienne conduite de voix : fonction 1/3/5/7 écrite dans la note (la
// couleur n'est plus seule), trait blanc du chemin des voix. Chaque fonction de l'ancien panneau (règles de voix, loupe, pincement) est vérifiée une
// à une AVANT de fondre. » Décisions du 05/11 : éteint au premier usage puis mémorisé par appareil ; nom et degré de chaque accord dans la règle,
// calque allumé seulement ; allumer Voix sans accord choisi ouvre le premier accord de la partie ; l'icône ⊱ quitte l'ordinateur (le téléphone la
// garde jusqu'au lot 10).
//
// CE QUE LE BANC TIENT — l'inventaire de l'ancien panneau, fonction par fonction (voir docs/dette-tests.md, lot 9c) :
//   la porte (un seul bouton, même logo, à la jauge, éteint au départ) ; toute la partie sans accord choisi ; la fonction dans chaque note, voisins
//   compris, et le vrai degré des couleurs (9) ; le chemin des voix (même appariement par rang, plein = tenue, pointillés = mouvement, posé sur la
//   frontière, du milieu d'une ligne au milieu de l'autre) ; les traits ne prennent aucun clic ; nom + degré dans la règle, au-dessus des mesures,
//   sans rien prendre aux 170px de notes ; le zoom horizontal emporte les traits ; une édition (renversement) les redessine ; mémorisé ; pas d'id
//   en double ; le téléphone n'a pas bougé (icône ⊱ et ancien panneau, aucun calque).
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('éditeur de notes : calque Voix');
const { estBruitReseau } = require('./_harness');
const R = require('./_retrait_ancien');

plan(12);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
// Une partie choisie pour son chemin des voix : C (48 52 55) → F 2e renversement (48 53 57) garde le DO en commun à la voix grave (un trait PLEIN),
// puis G7 1er renversement (47 50 53 55), puis Cadd9 (48 52 55 62, dont un 9).
const graine = () => {
    const mk = (r, q, octave, inversion = 0) => ({ root: r, quality: q, beats: 4, inversion, drop: 'none', octave, bass: null, playStyle: 'held' });
    const S = [{ title: 'Couplet', chords: [mk('C', 'maj', 3), mk('F', 'maj', 2, 2), mk('G', 'dom7', 2, 1), mk('C', 'add9', 3)] }];
    localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), sections: S }]));
    localStorage.setItem('harmohubCurrentSongId', 's1');
    localStorage.setItem('myProgression', JSON.stringify({ sections: S }));
    localStorage.removeItem('harmohubSeqDockHeight');
    localStorage.removeItem('harmohubSeqAjuster');
    localStorage.removeItem('harmohubSeqVoix');
    sessionStorage.setItem('cc_accueil_vu', '1');
};

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    const ouvrir = async (viewport, reseme = true) => {
        const p = await nav.newPage({ viewport });
        p.on('pageerror', e => erreurs.push(e.message));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) erreurs.push('console: ' + m.text()); });
        await p.goto(`${BASE}/index.html`);
        if (reseme) await p.evaluate(graine);
        await p.reload();
        await p.waitForTimeout(900);
        return p;
    };
    const clic = async (p, sel, ms = 500) => { await p.click(sel); await p.waitForTimeout(ms); };
    // Le calque tel qu'on le VOIT : chiffres, traits, bande des accords, légende, bouton.
    const calque = (p) => p.evaluate(() => {
        const q = (s) => [...document.querySelectorAll(s)];
        return {
            presse: document.getElementById('editeur-notes-voix').getAttribute('aria-pressed'),
            legende: !document.getElementById('editeur-notes-legende').hidden && !!document.getElementById('editeur-notes-legende').offsetParent,
            chiffres: q('#arp-sequencer .seq-note .seq-note-fn').length,
            chiffresVoisins: q('#arp-sequencer .seq-ctx-note .seq-note-fn').map(e => e.textContent),
            traits: q('#arp-sequencer .seq-voix-trait').length,
            tenues: q('#arp-sequencer .seq-voix-tenue').map(t => t.dataset.accord + ':' + t.dataset.de + '>' + t.dataset.vers),
            accords: q('#arp-sequencer .seq-voix-accord').map(e => e.textContent.trim()),
            bande: Math.round(document.querySelector('#arp-sequencer .seq-scroll').getBoundingClientRect().height),
        };
    });
    // Bord gauche d'un accord dans la vue : sa première case s'il est en cours, sinon la zone qui le désigne.
    const geometrie = (p) => p.evaluate(() => {
        const bordAccord = (i) => {
            const nav = document.querySelector(`#arp-sequencer .seq-ctx-nav[data-target-index="${i}"]`);
            const el = nav || document.querySelector('#arp-sequencer .seq-cell[data-step="0"]');
            return el.getBoundingClientRect().left;
        };
        const centreLigne = (m) => { const r = document.querySelector(`#arp-sequencer .seq-label[data-row-midi="${m}"]`).getBoundingClientRect(); return r.top + r.height / 2; };
        const mv = [...document.querySelectorAll('#arp-sequencer .seq-voix-mouvement')].map(t => {
            const r = t.getBoundingClientRect(), hi = Math.max(+t.dataset.de, +t.dataset.vers), lo = Math.min(+t.dataset.de, +t.dataset.vers);
            return { ecartX: Math.abs(r.left + r.width / 2 - bordAccord(+t.dataset.accord)), ecartHaut: Math.abs(r.top - centreLigne(hi)), ecartBas: Math.abs(r.bottom - centreLigne(lo)), pointilles: /repeating-linear-gradient/.test(getComputedStyle(t).backgroundImage) };
        });
        const tn = [...document.querySelectorAll('#arp-sequencer .seq-voix-tenue')].map(t => {
            const r = t.getBoundingClientRect(), x = bordAccord(+t.dataset.accord);
            return { enjambe: r.left < x - 2 && r.right > x + 2, ecartY: Math.abs(r.top + r.height / 2 - centreLigne(+t.dataset.de)), plein: !/gradient/.test(getComputedStyle(t).backgroundImage), horizontal: r.width > r.height };
        });
        const etiquettes = [...document.querySelectorAll('#arp-sequencer .seq-voix-accord')].map(e => ({ i: +e.dataset.accord, ecart: Math.abs(e.getBoundingClientRect().left - bordAccord(+e.dataset.accord)), bas: e.getBoundingClientRect().bottom }));
        const mesure = document.querySelector('#arp-sequencer .seq-beat-label[data-mesure] .seq-beat-num').getBoundingClientRect();
        return { mv, tn, etiquettes, mesureHaut: mesure.top };
    });

    // ======================================================================================================
    // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4a, décision du 12/11 « réécriture courte ») : à l'ordinateur, le calque Voix et le chemin des voix sont SUPPRIMÉS
    // (« trop compliqué », 11/11), avec l'éditeur de notes qui les portait. Restent les COULEURS des rôles (1 vert, 3 bleu, 5 rouge, 7 ambre) dans le séquenceur
    // du bloc « Vues ». Les parties A à H d'avant (porte, fonctions dans les notes, traits, règle, zoom, mémoire) n'ont plus d'objet ; I et J (téléphone) restent
    // jusqu'à l'étape 4c.
    console.log('\n=== A. Ordinateur : plus de calque Voix, les couleurs des rôles au séquenceur ===');
    let p = await ouvrir({ width: 1440, height: 900 });
    check(!(await p.locator('#toggle-voice-leading').isVisible()), 'l\'icône ⊱ de la rangée de réglages a quitté l\'ordinateur');
    let r = await R.porteAbsente(p);
    check(r.ok, `l'éditeur de notes (et son bouton Voix) a disparu, le séquenceur est au bloc « Vues » (${r.detail})`);
    r = await R.ouvrirNouveau(p);
    exiger(r.ok, `le séquenceur s'ouvre par son bouton (${r.detail})`);
    check(await p.evaluate(() => !document.querySelector('#editeur-notes-voix:not([hidden])') || !document.getElementById('editeur-notes-voix').offsetParent) && await p.evaluate(() => document.querySelectorAll('.seq-voix-trait, .seq-note-fn').length === 0), 'ni bouton Voix, ni trait du chemin des voix, ni chiffre de fonction à l\'écran');
    r = await R.couleursRoles(p, 0);
    check(r.ok, `les notes gardent les couleurs de leur rôle (${r.detail})`);
    r = await R.toutePartie(p);
    check(r.ok, `toute la partie est à l'écran, sans zoom (${r.detail})`);
    await p.close();

    // ======================================================================================================
    console.log('\n=== I. Le téléphone a le même calque (lot 10f) ===');
    p = await ouvrir({ width: 860, height: 900 });
    await p.evaluate(() => localStorage.setItem('harmohubSeqVoix', '1'));
    await p.reload(); await p.waitForTimeout(900);
    exiger(!(await p.locator('#toggle-voice-leading').isVisible()), 'l\'icône ⊱ a quitté le téléphone');
    await clic(p, '#progression-sections .grid-cell[data-index="1"]', 300);
    await clic(p, '#grid-zoom', 900);
    const tel = await p.evaluate(() => ({ tete: !!document.getElementById('editeur-notes-tete').offsetParent, fn: document.querySelectorAll('.seq-note-fn').length, traits: document.querySelectorAll('.seq-voix-trait').length, seq: window.app.seqOpen, ancien: !!document.querySelector('.voice-leading-panel') }));
    check(tel.seq && tel.tete && tel.fn > 0 && tel.traits > 0, 'l\'éditeur s\'y ouvre avec le calque Voix : fonctions dans les notes et chemin des voix');
    check(!tel.ancien, 'sans ancien panneau de conduite de voix');
    await p.close();

    // ======================================================================================================
    console.log('\n=== J. Élargir la fenêtre éditeur ouvert le rend à son volet ===');
    p = await ouvrir({ width: 860, height: 900 });
    await clic(p, '#grid-zoom', 900);
    exiger(await p.evaluate(() => getComputedStyle(document.getElementById('seq-dock-panel')).position === 'fixed'), 'sous 900px l\'éditeur est une feuille plein écran');
    await p.setViewportSize({ width: 1440, height: 900 }); await p.waitForTimeout(800);
    // RÉÉCRIT (4a) : l'ancien éditeur n'existe plus à l'ordinateur — passé le seuil, il se referme (plus de porte pour le fermer là-haut).
    check(await p.evaluate(() => !window.app.seqOpen && !document.getElementById('seq-dock-panel').offsetParent), 'passé au-dessus de 900px, l\'ancien éditeur se referme : il n\'existe plus à l\'ordinateur');
    await p.close();

    check(erreurs.length === 0, `aucune erreur JavaScript${erreurs.length ? ' — ' + erreurs.slice(0, 3).join(' | ') : ''}`);
    await nav.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
