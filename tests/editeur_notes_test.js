// L'ÉDITEUR DE NOTES : OUVRIR, FERMER, ÉTENDRE (refonte, lot 9a), avec de vrais gestes.
// RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4a, 12/11, « réécriture courte ») : voir le bloc ordinateur plus bas ; les parties téléphone restent jusqu'à l'étape 4c.
//
// CE QUE DEMANDE LA MAQUETTE VALIDÉE (docs/refonte.md, « Éditeur de notes ») : « ouvert par un bouton bleu libellé Éditeur de notes dans la rangée
// de réglages (pas parmi les instruments), fermé par Fermer » ; « Étendre ou non : réduit par défaut (~170 px de notes), bouton à chevrons,
// double-clic sur la poignée, ou poignée tirée ». Le Compact provisoire du lot 9a (« la grille passe d'elle-même en Compact ») est ANNULÉ par la
// refonte du séquenceur (11/11, point A) : « ouvrir le séquenceur ne doit jamais changer l'affichage de la grille […] je ne veux absolument pas ça ».
//
// CE QUE LE BANC TIENT : le bouton (bleu, 32px, 7px, son libellé) ouvre et referme ; l'en-tête Notes / Fermer / chevrons ; la hauteur réduite à
// l'ouverture, étendue au chevron et au double-clic, défaite au chevron après une poignée tirée ; la grille garde EXACTEMENT son affichage
// (affichage, largeur de la fenêtre, taille de chaque case) à l'ouverture, pendant et à la fermeture, sans rien marquer « modifié » ; un affichage
// choisi éditeur ouvert est un vrai réglage ; le téléphone (feuille du lot 10f) garde aussi sa grille.
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('éditeur de notes');
const R = require('./_retrait_ancien');
const { estBruitReseau } = require('./_harness');

plan(14);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const graine = () => {
    const mk = (r, q, b = 4) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
    const S = [
        { title: 'Couplet', chords: [mk('C', 'maj7'), mk('A', 'min7'), mk('D', 'min7'), mk('G', 'dom7')] },
        { title: 'Refrain', chords: [mk('F', 'maj7'), mk('E', 'min7')] },
    ];
    localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), sections: S }]));
    localStorage.setItem('harmohubCurrentSongId', 's1');
    localStorage.setItem('myProgression', JSON.stringify({ sections: S }));
    localStorage.removeItem('harmohubSeqDockHeight');
    sessionStorage.setItem('cc_accueil_vu', '1');
};

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    const ouvrir = async (viewport) => {
        const p = await nav.newPage({ viewport });
        p.on('pageerror', e => erreurs.push(e.message));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) erreurs.push('console: ' + m.text()); });
        await p.goto(`${BASE}/index.html`);
        await p.evaluate(graine);
        await p.reload();
        await p.waitForTimeout(900);
        return p;
    };
    // Ce que l'écran montre (relu, jamais déclenché par window.app).
    const etat = (p) => p.evaluate(() => {
        const panneau = document.getElementById('seq-dock-panel');
        const bande = document.querySelector('#seq-dock-host .seq-scroll');
        const tete = document.getElementById('editeur-notes-tete');
        const ext = document.getElementById('editeur-notes-etendre');
        const btn = document.getElementById('grid-zoom');
        const cs = getComputedStyle(btn);
        const cas = document.querySelector('#progression-sections .grid-cell');
        const densiteEcran = ['compact', 'normal', 'detail'].find(d => document.querySelector('.history-section').classList.contains('densite-' + d));
        const presse = [...document.querySelectorAll('#grille-densites [data-densite]')].find(b => b.getAttribute('aria-pressed') === 'true');
        return {
            ouvert: !panneau.hidden && panneau.getBoundingClientRect().height > 0,
            bande: bande && !panneau.hidden ? Math.round(bande.getBoundingClientRect().height) : 0,
            hote: Math.round(document.getElementById('seq-dock-host').getBoundingClientRect().height),
            tete: Math.round(tete.getBoundingClientRect().height),
            titre: tete.querySelector('.editeur-notes-titre').textContent.trim(),
            etenduPresse: ext.getAttribute('aria-pressed'), etenduLabel: ext.getAttribute('aria-label'),
            btnTexte: btn.innerText.trim(), btnLabel: btn.getAttribute('aria-label'), btnPresse: btn.getAttribute('aria-pressed'),
            btnH: Math.round(btn.getBoundingClientRect().height), btnRayon: cs.borderTopLeftRadius, btnBord: cs.borderTopColor,
            caseH: cas ? Math.round(cas.getBoundingClientRect().height) : 0,
            densiteEcran, densitePressee: presse ? presse.dataset.densite : null,
            modifie: hasUnsavedChanges,
            memoire: localStorage.getItem('harmohubGrilleDensite'),
            hauteurTiree: localStorage.getItem('harmohubSeqDockHeight'),
        };
    });
    // L'empreinte de la grille : affichage, largeur de la fenêtre et taille de CHAQUE case — ce qui ne doit jamais changer à l'ouverture du séquenceur.
    const empreinte = (p) => p.evaluate(() => JSON.stringify({
        d: ['compact', 'normal', 'detail'].find(d => document.querySelector('.history-section').classList.contains('densite-' + d)),
        w: Math.round(document.getElementById('grille-cadre').getBoundingClientRect().width),
        cases: [...document.querySelectorAll('#progression-sections .grid-cell')].map(c => { const r = c.getBoundingClientRect(); return Math.round(r.width) + 'x' + Math.round(r.height); }),
    }));
    const clic = async (p, sel, ms = 600) => { await p.click(sel); await p.waitForTimeout(ms); };
    const centre = async (p, sel) => { const b = await p.locator(sel).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };

    // ======================================================================================================
    // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4a, 12/11, « réécriture courte ») : « Éditeur de notes » (bouton bleu, en-tête Notes / Fermer, chevrons d'extension,
    // poignée) a quitté l'ordinateur ; le séquenceur s'ouvre par le bloc « Vues » (cahier, section D : « pas de poignée de hauteur, pas d'« Étendre » »). LA RÈGLE A
    // RESTE ENTIÈRE : ouvrir et fermer le séquenceur ne change JAMAIS l'affichage de la grille (« je ne veux absolument pas ça »).
    console.log('\n=== A. Ordinateur : plus d\'éditeur de notes ; le séquenceur ne touche pas à la grille ===');
    let p = await ouvrir({ width: 1440, height: 900 });
    let r = await R.porteAbsente(p);
    check(r.ok, `le bouton « Éditeur de notes » a quitté la rangée de réglages (${r.detail})`);
    const avantSq = await empreinte(p);
    r = await R.ouvrirNouveau(p);
    exiger(r.ok, `le séquenceur s'ouvre par son bouton (${r.detail})`);
    check(await empreinte(p) === avantSq, 'ouvert : la grille garde EXACTEMENT son affichage (affichage, largeur, taille de chaque case)');
    check(await p.evaluate(() => !document.getElementById('editeur-notes-etendre') || !document.getElementById('editeur-notes-etendre').offsetParent), 'ni en-tête « Notes / Fermer », ni chevrons d\'extension');
    const etatTb = await p.evaluate(() => document.getElementById('tb-etat').dataset.etat);
    check(etatTb !== 'modifie', `ouvrir le séquenceur ne marque rien « modifié » (${etatTb})`);
    r = await R.poserCroche(p, 1);
    check(r.ok && await empreinte(p) === avantSq, `on y travaille (${r.detail}) sans que la grille bouge`);
    await R.cliquer(p, '#sq-fermer', 400);
    check(await empreinte(p) === avantSq && await p.evaluate(() => document.getElementById('sequenceur').hidden), 'fermé par son × : la grille n\'a toujours pas bougé');
    await p.close();

    // ======================================================================================================
    console.log('\n=== I. Le téléphone : l\'éditeur de notes est une feuille plein écran (lot 10f) ===');
    p = await ouvrir({ width: 390, height: 844 });
    e = await etat(p);
    check(e.btnTexte === 'Notes', `la porte dit « Notes » (« ${e.btnTexte} »)`);
    check(e.btnLabel === 'Éditeur de notes', 'et son aria-label est celui de l\'ordinateur');
    await p.locator('#grid-zoom').scrollIntoViewIfNeeded();
    await clic(p, '#grid-zoom', 900);
    e = await etat(p);
    exiger(e.ouvert, 'elle ouvre l\'éditeur');
    check(e.tete > 40, `avec son en-tête (${e.tete}px)`);
    check(e.densiteEcran === 'normal' && e.modifie === false, `la grille garde l\'affichage de l\'appareil (${e.densiteEcran})`);
    check(e.bande > 230, `la feuille donne toute la place aux notes (${e.bande}px de bande)`);
    await p.close();

    check(erreurs.length === 0, `aucune erreur de page${erreurs.length ? ' : ' + erreurs.slice(0, 3).join(' | ') : ''}`);
    await nav.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
