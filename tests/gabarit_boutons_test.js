// LA JAUGE DES COMMANDES — « les boutons sont rangés n'importe comment » (refonte, voir docs/refonte.md).
//
// CE QUE CE BANC TIENT. Sur ordinateur, toute commande visible (bouton, liste, champ de nombre) a une hauteur de 32px, ou de
// 44px pour le bloc de lecture ; tout ce qu'on clique a des angles de 7px (les pastilles — logo, compte — gardent leur forme).
// Mesuré le 31/10 sur l'écran d'arrivée : 43 commandes, 10 hauteurs différentes, 8 arrondis différents.
//
// UN CLIQUET, PAS UN OBJECTIF. L'interface actuelle porte encore des commandes hors jauge, que les lots suivants font disparaître
// (la carte Accord, le bandeau de gauche, les quatre boutons de zoom…). Les exiger à 32px maintenant serait refaire à la main ce
// que la refonte supprime. Ce banc fait donc deux choses :
//   1. il REFUSE toute commande hors jauge qui ne figure pas dans HORS_JAUGE (une commande neuve ne peut pas être de travers) ;
//   2. il REFUSE une entrée de HORS_JAUGE qui n'est plus hors jauge ou n'existe plus (la liste ne doit que raccourcir : le lot
//      qui supprime une commande la retire d'ici, et la liste prouve ainsi que le travail a été fait).
// Le jour où HORS_JAUGE est vide, la jauge est tenue partout — c'est la fin de la refonte.
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('jauge des commandes');
const { estBruitReseau } = require('./_harness');

plan(20);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const HAUTEURS = [32, 44];
const RAYON = '7px';
// Pastilles : forme voulue (le compte vient de compte-cloud.js, commun aux trois applis).
const PASTILLES = new Set(['logo', 'cc-pill']);

// Commande → lot qui la supprime ou la remet à la jauge. Clé = id, à défaut la première classe.
const HORS_JAUGE = {
    // Lot 6c : fondamentale, type, durée, « Ajouter » et le repli du bandeau ne sont plus à l'écran sur ordinateur (bulle + inspecteur) — sortis d'ici.
    // Les commandes de voicing restent : elles vivent dans l'inspecteur, à remettre à la jauge avec lui.
    'voicing-step': 'lot 6',
    'voicing-segment': 'lot 6',
    'bass': 'lot 6',
    // 'seq-zoom' (le « Séquenceur » de l'inspecteur) est sorti d'ici au retrait de l'ancien séquenceur, étape 4b (12/11) : la porte a quitté l'ordinateur.
    'add-section': 'lot 5 — « Nouvelle section », à 7px',
};

const mk = (root, quality) => ({ root, quality, beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held', instrument: 'piano', arpPattern: '', seqEdited: false, guitarLock: null, extraNotes: [], intensity: 75, intensityPerStep: {} });

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    const page = await nav.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', e => erreurs.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text())) erreurs.push('console: ' + m.text()); });

    await page.goto(`${BASE}/index.html`);
    await page.evaluate((src) => {
        const mkc = eval('(' + src + ')');
        const s = [{ title: 'Couplet', chords: [mkc('C', 'maj7'), mkc('A', 'min7'), mkc('D', 'min7'), mkc('G', '7')] }];
        localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: 1, sections: s }]));
        localStorage.setItem('harmohubCurrentSongId', 's1');
        localStorage.setItem('myProgression', JSON.stringify({ sections: s }));
        sessionStorage.setItem('cc_accueil_vu', '1');
    }, mk.toString());
    await page.reload();
    await page.waitForTimeout(1200);

    // Les commandes réellement visibles, avec ce que le navigateur en rend.
    const releve = () => page.evaluate(() => {
        const r = [];
        document.querySelectorAll('button, select, input[type=number], a.logo').forEach(el => {
            const bb = el.getBoundingClientRect(), cs = getComputedStyle(el);
            if (bb.width < 2 || bb.height < 2 || cs.visibility === 'hidden' || cs.display === 'none') return;
            if (el.closest('[hidden]')) return;
            const cls = (typeof el.className === 'string' ? el.className : '').split(/\s+/).filter(Boolean);
            r.push({ cle: el.id || cls.slice(0, 2).join('.') || el.tagName.toLowerCase(), h: Math.round(bb.height * 10) / 10, rayon: cs.borderTopLeftRadius });
        });
        return r;
    });

    const etats = {};
    etats.arrivee = await releve();
    await page.evaluate(() => window.app.editChord(0, 1));
    await page.waitForTimeout(500);
    etats.modification = await releve();

    const horsJauge = new Map();
    for (const [etat, liste] of Object.entries(etats)) {
        for (const c of liste) {
            const hauteurOk = HAUTEURS.some(h => Math.abs(c.h - h) < 0.6);
            const rayonOk = PASTILLES.has(c.cle) || c.rayon === RAYON || c.rayon === '0px 7px 7px 0px' || parseFloat(c.rayon) >= 100;
            if (!hauteurOk || !rayonOk) {
                const k = c.cle;
                const m = horsJauge.get(k) || { etats: new Set(), h: new Set(), rayons: new Set() };
                m.etats.add(etat); m.h.add(c.h); m.rayons.add(c.rayon);
                horsJauge.set(k, m);
            }
        }
    }

    if (process.env.JAUGE_INVENTAIRE) {
        for (const [k, m] of horsJauge) console.log(`  ${k}: hauteurs ${[...m.h].join('/')} rayons ${[...m.rayons].join('/')}`);
    }

    // 1. Aucune commande hors jauge qui ne soit pas déclarée.
    const inconnues = [...horsJauge.keys()].filter(k => !(k in HORS_JAUGE));
    check(inconnues.length === 0, `aucune commande hors jauge non déclarée (${inconnues.map(k => `${k} ${[...horsJauge.get(k).h].join('/')}px ${[...horsJauge.get(k).rayons].join('/')}`).join(' ; ') || 'rien'})`);
    // 2. Aucune entrée périmée.
    const perimees = Object.keys(HORS_JAUGE).filter(k => !horsJauge.has(k));
    check(perimees.length === 0, `aucune entrée périmée dans HORS_JAUGE (à retirer : ${perimees.join(', ') || 'rien'})`);

    // 3. Ce que la refonte a déjà remis à la jauge ne doit plus en sortir.
    const dejaTenues = ['structure-btn', 'lyrics-btn', 'file-menu-btn', 'global-undo-btn', 'global-redo-btn', 'open-settings', 'logo', 'play-prog', 'stop', 'boucle-btn', 'bl-tempo', 'bl-metro', 'bl-reorg'];
    const mesure = Object.fromEntries(etats.arrivee.map(c => [c.cle, c]));
    for (const k of dejaTenues) {
        const c = mesure[k];
        exiger(!!c, `« ${k} » est visible à l'arrivée`);
        if (c) check(HAUTEURS.some(h => Math.abs(c.h - h) < 0.6), `« ${k} » est à la jauge (${c.h}px)`);
    }

    check(erreurs.length === 0, 'aucune erreur JavaScript (' + (erreurs.join(' | ') || 'rien') + ')');
    await nav.close();
    bilan();
})();
