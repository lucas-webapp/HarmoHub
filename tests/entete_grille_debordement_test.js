// La barre de commandes de la grille ne doit RIEN laisser dépasser, et ses boutons doivent former
// une seule ligne propre — sur téléphone (390px) comme sur ordinateur.
//
// D'OÙ VIENT CE BANC. Il s'appelait grid_zoom_header_overflow et mesurait les dix boutons de
// l'en-tête de l'ancienne vue plein écran (#grid-zoom-play-prog, #grid-zoom-close, etc.). Cette vue a
// été supprimée : ses dix identifiants ont zéro occurrence dans l'appli, donc les dix vérifications
// portaient sur du néant — le banc échouait à chaque campagne sans rien apprendre à personne, ce qui
// est la meilleure façon de le faire ignorer. Le CONTRAT, lui, a simplement changé d'adresse : la
// barre qui porte aujourd'hui ces commandes est .grid-head-sticky, au-dessus de la grille.
//
// Il reprend aussi le sujet d'edge_alignment_test (supprimé) : ce banc vérifiait qu'un groupe de zoom
// et le bouton voisin alignaient bien leur bord DROIT quand l'en-tête plein écran passait à la ligne.
// Il n'y a plus ni bouton « Fermer » ni passage à la ligne à 390px — mais le défaut qu'il traquait
// (une boîte de groupe, padding compris, qui ne s'aligne pas sur ses voisines) reste possible ici, et
// c'est ce que vérifient les contrôles d'alignement ci-dessous.
//
// On mesure les ENFANTS de la barre, jamais sa propre boîte : sur téléphone elle passe en
// `display: contents` et son rectangle est alors 0×0 — mesuré. Un banc qui lirait ce rectangle
// conclurait « rien ne dépasse » quoi qu'il arrive.
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('en-tête de la grille');
plan(14);

const GRAINE = { sections: [{ title: 'Couplet', chords: [
    { root: 'G', quality: 'maj', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
    { root: 'D', quality: 'maj', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
] }] };

(async () => {
    const browser = await chromium.launch();
    const errors = [];

    // Un seul écran passé en revue, pour ne pas dupliquer sept assertions à la main.
    const passerEnRevue = async (nom, taille) => {
        const page = await browser.newPage({ viewport: { width: taille.w, height: taille.h }, hasTouch: !!taille.mobile, isMobile: !!taille.mobile });
        page.on('pageerror', (e) => errors.push(`${nom} pageerror: ` + e.message));
        page.on('console', (msg) => { if (msg.type() === 'error' && !msg.text().includes('CONNECTION')) errors.push(`${nom} console.error: ` + msg.text()); });
        await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
        await page.waitForTimeout(200);
        await page.evaluate((g) => localStorage.setItem('myProgression', JSON.stringify(g)), GRAINE);
        await page.reload({ waitUntil: 'load' });
        await page.waitForTimeout(500);

        const info = await page.evaluate(() => {
            const barre = document.querySelector('.history-section .grid-head-sticky');
            if (!barre) return null;
            const actions = barre.querySelector('.card-head-actions');
            // Seuls les enfants VISIBLES comptent : la barre contient aussi des champs cachés (un
            // <input type="file"> par exemple), dont le rectangle est 0×0 et n'a rien à aligner.
            const visibles = [...actions.children].filter(e => e.getBoundingClientRect().width > 0);
            const boite = (e) => { const r = e.getBoundingClientRect(); return { q: e.id || e.className.split(' ')[0], l: r.left, r: r.right, t: r.top, b: r.bottom, h: r.height }; };
            const titre = barre.querySelector('h2').getBoundingClientRect();
            const hote = document.getElementById('grid-head-transport-host');
            return {
                vw: window.innerWidth,
                enfants: visibles.map(boite),
                titre: { l: titre.left, r: titre.right, t: titre.top, b: titre.bottom },
                hoteTransport: { enfants: hote.children.length, hauteur: hote.getBoundingClientRect().height },
                debordementPage: document.documentElement.scrollWidth - window.innerWidth,
            };
        });
        await page.close();
        return info;
    };

    for (const [nom, taille] of [['téléphone', { w: 390, h: 844, mobile: true }], ['ordinateur', { w: 1500, h: 1000 }]]) {
        const i = await passerEnRevue(nom, taille);
        console.log(`--- ${nom} (${taille.w}px) ---`);
        console.log(JSON.stringify(i && i.enfants.map(e => `${e.q} ${Math.round(e.l)}→${Math.round(e.r)} t=${Math.round(e.t)} h=${Math.round(e.h)}`)));

        if (!exiger(i && i.enfants.length >= 4, `${nom} : la barre de la grille et ses commandes sont bien là (${i ? i.enfants.length : 0} éléments visibles)`)) continue;

        const dedans = i.enfants.filter(e => e.l >= 0 && e.r <= i.vw + 1);
        check(dedans.length === i.enfants.length,
            `${nom} : aucune commande ne dépasse la largeur de l'écran — ${dedans.length}/${i.enfants.length} dedans`
            + (dedans.length === i.enfants.length ? '' : ` (fautives : ${i.enfants.filter(e => !dedans.includes(e)).map(e => e.q).join(', ')})`));

        // Une seule ligne : même bord haut à 1px près. C'est l'invariant qu'edge_alignment cherchait à
        // vérifier par la négative (« V et Fermer sont bien sur 2 lignes différentes ») — désormais il
        // n'y a qu'UNE ligne, et c'est elle qui doit tenir.
        const hauts = i.enfants.map(e => Math.round(e.t));
        check(Math.max(...hauts) - Math.min(...hauts) <= 1,
            `${nom} : toutes les commandes sont sur la MÊME ligne (bords hauts : ${[...new Set(hauts)].join(', ')})`);

        // Même hauteur de boîte : c'est le padding des .zoom-axis-group qui décidait de l'alignement
        // dans le banc d'origine, pas la taille des petits boutons qu'ils contiennent.
        const hauteurs = i.enfants.map(e => Math.round(e.h));
        check(Math.max(...hauteurs) - Math.min(...hauteurs) <= 1,
            `${nom} : toutes les boîtes ont la même hauteur, padding compris (${[...new Set(hauteurs)].join(', ')}px)`);

        // Le titre « Grille d'accords » ne doit pas passer sous ni sur les boutons.
        const chevauche = i.enfants.some(e => e.l < i.titre.r - 1 && e.r > i.titre.l + 1 && e.t < i.titre.b - 1 && e.b > i.titre.t + 1);
        check(!chevauche, `${nom} : le titre de la grille ne chevauche aucune commande`);

        check(i.debordementPage <= 1, `${nom} : la page elle-même ne défile pas horizontalement (dépassement ${i.debordementPage}px)`);

        // L'hôte de transport de l'en-tête est volontairement vide depuis que le transport est ancré en
        // bas de la colonne de gauche (voir placeGlobalTransport). Le vérifier ici évite qu'il
        // reprenne de la hauteur en silence et repousse la barre.
        check(i.hoteTransport.enfants === 0 && i.hoteTransport.hauteur === 0,
            `${nom} : l'ancre de transport de l'en-tête reste vide et sans hauteur (${i.hoteTransport.enfants} enfant(s), ${i.hoteTransport.hauteur}px)`);
    }

    console.log('Errors:', JSON.stringify(errors));
    check(errors.length === 0, 'aucune erreur JavaScript sur aucun des deux écrans');
    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
