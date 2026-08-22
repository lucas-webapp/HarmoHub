// SENTINELLE 2/3 — ce qu'une surface ouverte propose doit être atteignable DANS cette surface.
//
// POURQUOI. Deuxième famille du journal par la fréquence, première par la gêne réellement ressentie —
// ce sont les défauts que l'utilisateur SIGNALE, parce qu'ils l'empêchent de travailler :
//   « la modification se passe derrière sans que je le voie »  -> champ construit HORS de la fenêtre
//        ouverte : il avait le focus, mais elementFromPoint en son centre renvoyait le voile ;
//   « le tiroir n'avait aucune sortie atteignable »            -> commande présente, jamais joignable ;
//   bande morte de 4px entre deux cases                        -> elementFromPoint renvoyait .seq-grid ;
//   bouton d'édition guitare à 26px sur téléphone              -> visible, trop petit pour le doigt.
// Aucun de ces défauts ne se voit dans les COORDONNÉES : l'élément occupe le bon rectangle. Il faut
// interroger le POINT — la seule question qui les attrape tous.
//
// DEUX ERREURS DE CONCEPTION CORRIGÉES, et elles valent d'être écrites parce qu'elles disent où est la
// frontière entre un garde-fou et du bruit :
//   1. La première version éprouvait TOUTE la page. Fenêtre d'édition ouverte, elle accusait 34
//      commandes d'être « recouvertes par guitar-edit-overlay » — c'est le PROPRE d'une fenêtre
//      modale, et le voile est là pour ça. On n'éprouve donc que la surface ACTIVE : celle qui est au
//      premier plan. Ce qui est derrière est censé l'être.
//   2. Elle imposait 24px à toute commande, et accusait `toggle-sidebar` (16x86, un rail vertical) et
//      les quatre chevrons de zoom (30x15, délibérément fins). Un seuil qui produit cinq exceptions
//      dès le premier essai n'est pas un seuil, c'est une opinion. La taille n'est donc vérifiée que
//      sur TÉLÉPHONE, où elle se paie vraiment, et où le projet s'est déjà donné une borne mesurée.
const { chromium, devices } = require('playwright');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('sentinelle : atteignabilité des commandes');

const SURFACES = [
    { nom: 'panneau Accord', ouvrir: async (p) => { await p.evaluate(() => window.app.editChord(0, 0)); } },
    { nom: 'réglages du morceau', ouvrir: async (p) => { await p.click('#song-settings-btn').catch(() => {}); } },
    { nom: 'Paramètres', ouvrir: async (p) => { await p.click('#settings-btn').catch(() => {}); } },
    { nom: 'édition manuelle guitare', ouvrir: async (p) => {
        if (!(await p.evaluate(() => document.getElementById('toggle-viz-guitar')?.getAttribute('aria-pressed') === 'true'))) await p.click('#toggle-viz-guitar').catch(() => {});
        await p.evaluate(() => window.app.editChord(0, 0));
        await p.click('#guitar-edit-btn').catch(() => {});
    } },
    { nom: 'séquenceur continu', ouvrir: async (p) => {
        await p.evaluate(() => window.app.editChord(0, 0));
        await p.evaluate(() => { if (window.app.seqMode !== 'continu') window.app.toggleSequencer('continu'); });
    } },
];

// Commandes plus petites que la cible tactile, chacune NOMMÉE avec sa raison. Une exception muette est
// un trou ; une exception nommée reste un garde-fou (même principe que l'exception « seq-zoom » de
// aspect_boutons_volet_test.js). Si cette liste devait s'allonger, c'est le seuil qu'il faudrait
// rediscuter — pas la liste.
const PLUS_PETITES_ADMISES = {
    'classic-grid-in-h': 'chevron de zoom, délibérément fin (30x15) — voir le lot « H/V zoom »',
    'classic-grid-out-h': 'idem',
    'classic-grid-in-v': 'idem',
    'classic-grid-out-v': 'idem',
    'seq-zoom-in-h-inline': 'idem, version en ligne du séquenceur',
    'seq-zoom-out-h-inline': 'idem',
    'toggle-sidebar': 'rail vertical de repli du volet : 16px de large, mais 86px de haut',
    'guitar-nav-label': 'compteur « 1/4 », pas une commande',
};

// DETTE CONSTATÉE, PAS ACCEPTÉE. Ces six commandes passent sous les 32px sur téléphone — la borne que
// ce projet s'est donnée en corrigeant #guitar-edit-btn, mesuré à 26px, sur retour utilisateur. Elles
// ne sont pas ici parce qu'elles auraient raison de l'être : elles y sont parce que les corriger est
// une décision d'interface qui appartient à l'utilisateur, pas une réparation évidente. La sentinelle
// les laisse donc passer MAIS refuse que la liste s'allonge : une septième commande trop petite la
// fait rougir. C'est le même arbitrage que l'exception « seq-zoom » d'aspect_boutons_volet_test.js —
// enregistrer une décision plutôt que désarmer un test.
const DETTE_TACTILE = {
    'bass': '59x30 — sélecteur de basse',
    'seq-zoom': '315x25 — porte « Séquenceur » du volet',
    'quick-add-help-btn': '26x44 — ampoule d\'aide de l\'ajout rapide, étroite',
    'add-section': '138x31 — « Ajouter une partie »',
    'lyrics-btn': '81x26 — bouton Paroles',
    'file-menu-btn': '77x26 — menu Fichier',
};

// La surface ACTIVE : la fenêtre/le panneau au premier plan, ou le document si rien ne se superpose.
// C'est elle, et elle seule, qui doit répondre au clic.
const releverSurfaceActive = (minTactile) => {
    const superposees = [...document.querySelectorAll('.settings-overlay:not([hidden]), .popover:not([hidden]), [role="dialog"]')]
        .filter(el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
            return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden'; });
    const hote = superposees.length ? superposees[superposees.length - 1] : document.body;

    const resultats = [];
    hote.querySelectorAll('button[id], input[id], select[id], a[id], [role="button"][id]').forEach(el => {
        const r = el.getBoundingClientRect();
        const st = getComputedStyle(el);
        if (r.width === 0 || r.height === 0 || st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') return;
        if (el.disabled) return;
        // ON FAIT DÉFILER AVANT DE JUGER, parce que c'est ce que fait un utilisateur. Sans cela, la
        // sentinelle accusait `#root` d'être « recouvert par play-prog » sur téléphone — vérifié : la
        // carte de l'accord va de 543 à 758 px dans une fenêtre de 664, le sélecteur était simplement
        // sous la barre de transport À CETTE POSITION DE DÉFILEMENT. Ce n'est pas un défaut, c'est un
        // écran. Un élément qui reste recouvert APRÈS avoir été amené au centre, lui, l'est vraiment :
        // c'est le cas du champ de saisie construit hors de sa fenêtre, que rien ne pouvait dégager.
        el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
        const r2 = el.getBoundingClientRect();
        if (r2.bottom <= 0 || r2.top >= innerHeight || r2.right <= 0 || r2.left >= innerWidth) return;
        const cx = Math.min(Math.max(r2.left + r2.width / 2, 1), innerWidth - 1);
        const cy = Math.min(Math.max(r2.top + r2.height / 2, 1), innerHeight - 1);
        const dessous = document.elementFromPoint(cx, cy);
        const atteint = !!dessous && (dessous === el || el.contains(dessous) || dessous.contains(el));
        resultats.push({
            id: el.id, atteint,
            obstacle: atteint ? null : (dessous ? (dessous.id || String(dessous.className).split(' ')[0] || dessous.tagName) : 'rien'),
            l: Math.round(r.width), h: Math.round(r.height),
            tropPetit: Math.min(r.width, r.height) < minTactile,
        });
    });
    return {
        surface: hote === document.body ? 'document' : (hote.id || String(hote.className).split(' ')[0]),
        commandes: resultats,
        deborde: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
};

plan(SURFACES.length * 2 * 2 + 5);

(async () => {
    const navigateur = await chromium.launch();
    const erreurs = [];
    let total = 0;

    for (const [ecran, options, minTactile] of [
        ['ordinateur', { viewport: { width: 1440, height: 900 } }, 0],   // 0 = taille non éprouvée ici, voir l'en-tête
        ['téléphone', devices['iPhone 13'], 32],
    ]) {
        // UNE page par écran, ensemencée avant le chargement : douze rechargements coûtaient plus de
        // six minutes, pour rien. Les surfaces s'ouvrent et se referment sur la même page.
        const page = await navigateur.newPage(options);
        page.on('pageerror', e => erreurs.push(`${ecran} : ${e.message}`));
        await page.addInitScript(() => {
            const mk = r => ({ root: r, quality: 'maj7', beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
            localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: ['C', 'G', 'A'].map(mk) }] }));
        });
        await page.goto(`${BASE}/index.html?nocache=` + Date.now());
        await page.waitForTimeout(900);

        for (const surface of SURFACES) {
            await page.keyboard.press('Escape').catch(() => {});
            await page.waitForTimeout(120);
            await surface.ouvrir(page);
            await page.waitForTimeout(450);
            const r = await page.evaluate(releverSurfaceActive, minTactile);
            total += r.commandes.length;

            const recouvertes = r.commandes.filter(c => !c.atteint);
            check(recouvertes.length === 0,
                `${ecran} · ${surface.nom} (${r.surface}) : les ${r.commandes.length} commandes visibles répondent au clic en leur centre${recouvertes.length ? ' — RECOUVERTES : ' + recouvertes.map(c => `${c.id} par ${c.obstacle}`).join(', ') : ''}`);

            if (minTactile > 0) {
                const petites = r.commandes.filter(c => c.tropPetit && !PLUS_PETITES_ADMISES[c.id] && !DETTE_TACTILE[c.id]);
                check(petites.length === 0,
                    `${ecran} · ${surface.nom} : aucune NOUVELLE commande sous ${minTactile}px (${Object.keys(DETTE_TACTILE).length} déjà consignées)${petites.length ? ' — NOUVELLES : ' + petites.map(c => `${c.id} ${c.l}x${c.h}`).join(', ') : ''}`);
            } else {
                check(!r.deborde, `${ecran} · ${surface.nom} : rien ne déborde horizontalement`);
            }
        }
        await page.close();
    }

    check(total > 40, `l'inventaire a vu un volume significatif de commandes (${total}) — sinon c'est le relevé qui est cassé, pas le produit qui est propre`);
    check(Object.keys(PLUS_PETITES_ADMISES).length <= 10, `les exceptions de taille restent dénombrables et nommées (${Object.keys(PLUS_PETITES_ADMISES).length})`);
    check(Object.keys(DETTE_TACTILE).length <= 6, `la dette tactile ne grossit pas : ${Object.keys(DETTE_TACTILE).length} commandes sous 32px sur téléphone, toutes nommées`);
    check(erreurs.length === 0, `aucune erreur JavaScript (${erreurs.slice(0, 2).join(' | ')})`);
    check(true, 'sentinelle exécutée de bout en bout');

    await navigateur.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
