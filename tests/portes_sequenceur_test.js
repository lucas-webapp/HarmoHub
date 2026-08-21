// Deux portes vers le séquenceur, et toutes deux portent un nom.
//
// RETOUR UTILISATEUR : « Vu qu'on a gagné de la place, le bouton agrandir est pas mal, mais il fait
// la même chose que le bouton séquenceur déjà présent. Tu peux laisser uniquement le bouton agrandir
// car il est plus visible. Renomme-le en "Séquenceur". Il faut l'abaisser un peu, il colle d'autres
// boutons. Mettre le même bouton au-dessus de la grille au lieu du logo peu clair, mais en moins
// large. Par exemple "Séq." ? »
//
// TROIS PORTES, AUCUNE NOMMÉE. Avant ce lot : un pictogramme de barres dans l'en-tête de la carte
// (#toggle-sequencer, vue compacte), le MÊME pictogramme au-dessus de la grille (#grid-zoom, vue
// d'ensemble), et une loupe « Agrandir » qui n'apparaissait qu'une fois le séquenceur déjà ouvert.
// Deux dessins identiques pour deux vues différentes, et un troisième bouton dont le mot décrivait un
// geste, pas une destination. Rien ne disait qui ouvrait quoi.
//
// DEUX PORTES, DEUX NOMS, DEUX VUES :
//   « Séq. »       au-dessus de la grille  -> vue d'ensemble (mode continu)
//   « Séquenceur » dans la carte Accord    -> plein écran sur l'accord ouvert
//
// LE POINT DÉLICAT, ET IL EST ÉPROUVÉ SECTION B. « Agrandir » refusait d'agir séquenceur fermé
// (openSeqZoom commence par `if (!this.seqOpen) return`), ce qui était juste tant qu'un autre bouton
// se chargeait de l'ouvrir. Ce bouton n'existe plus : cette porte doit donc faire les DEUX gestes,
// sinon elle ne fait rien du tout — et rien n'est plus silencieux qu'un bouton qui rend la main.
const { chromium, devices } = require('playwright');
const creerHarnais = require('./_harness');
const { plan, check, exiger, bilan } = creerHarnais('Deux portes nommées vers le séquenceur');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';

const seed = () => {
    const mk = (r, q, b) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
    const song = { id: 'portes', name: 'Ballade', bpm: 120, timeSig: '4/4', groove: 'straight',
        sections: [{ title: 'Couplet', chords: [mk('C', 'maj7', 4), mk('F', 'maj', 4)] }] };
    localStorage.setItem('harmohubSongs', JSON.stringify([song]));
    localStorage.setItem('harmohubCurrentSongId', song.id);
    localStorage.setItem('myProgression', JSON.stringify({ sections: song.sections }));
};

const atteignable = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return { ok: false, pourquoi: 'introuvable' };
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return { ok: false, pourquoi: 'aucune surface' };
    if (r.top < -1 || r.bottom > window.innerHeight + 1) return { ok: false, pourquoi: `hors fenêtre (${Math.round(r.top)}..${Math.round(r.bottom)})` };
    const dessus = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (!dessus || !(dessus === el || el.contains(dessus) || dessus.contains(el))) {
        return { ok: false, pourquoi: 'recouvert par ' + (dessus ? (dessus.id ? '#' + dessus.id : dessus.tagName) : 'rien') };
    }
    return { ok: true, taille: `${Math.round(r.width)}x${Math.round(r.height)}` };
};

(async () => {
    plan(28);
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const erreurs = [];
    const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
    page.on('pageerror', e => erreurs.push('ordinateur : ' + e.message));
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await page.waitForTimeout(300);
    await page.evaluate(seed);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(1000);

    console.log('=== A. Deux portes, deux noms, et plus aucun pictogramme muet ===');
    const a = await page.evaluate(() => {
        const lire = (id) => {
            const e = document.getElementById(id);
            if (!e) return null;
            const r = e.getBoundingClientRect();
            return { texte: (e.textContent || '').trim(), l: Math.round(r.width), h: Math.round(r.height),
                     visible: e.offsetParent !== null, svg: !!e.querySelector('svg') };
        };
        return { ancien: !!document.getElementById('toggle-sequencer'), seq: lire('grid-zoom'), plein: lire('seq-zoom') };
    });
    check(!a.ancien, 'le pictogramme de l\'en-tête a disparu : il faisait doublon sans le dire');
    exiger(!!a.seq && !!a.plein, 'les deux portes existent');
    check(a.seq.texte === 'Séq.', `au-dessus de la grille, un mot et non un logo — « ${a.seq.texte} »`);
    // LE LOGO EST REVENU, et ce n'est pas un retour en arrière. Ce qui posait problème, c'était le
    // logo SEUL — rien ne disait ce qu'il ouvrait. Le mot répond à cela ; l'icône, à côté de lui,
    // redevient ce qu'elle sait faire de mieux : rendre le bouton repérable dans une barre de texte
    // (retour utilisateur : « je veux garder l'ancien logo séquenceur en petit à côté de l'écriture
    // Séq. On peut l'élargir un peu pour le mettre en valeur »).
    check(a.seq.svg, 'le logo est de retour À CÔTÉ du mot — c\'est le logo seul qui ne disait rien');
    check(a.plein.texte === 'Séquenceur', `dans la carte Accord, « ${a.plein.texte} » et non plus « Agrandir »`);
    // « Moins large » : la demande était explicite, et c'est ce qui distingue les deux jumeaux à l'œil.
    check(a.seq.l < a.plein.l, `« Séq. » est plus étroit que « Séquenceur » — ${a.seq.l}px contre ${a.plein.l}px`);
    // Le piège de la règle générique `button { min-width: 120px }` : sans neutralisation explicite,
    // ce bouton faisait 120px, soit près de trois fois le logo de 44px qu'il remplace.
    // « On peut l'élargir un peu » : la borne monte donc, mais elle RESTE — sans elle, la règle
    // générique `button { min-width: 120px }` reprendrait la main en silence, ce qu'elle a déjà fait
    // une fois (mesuré : 120px, près de trois fois le logo de 44px qu'il remplaçait).
    check(a.seq.l <= 90, `élargi pour loger son logo, sans repartir vers les 120px de la règle générique — ${a.seq.l}px`);

    console.log('\n=== B. « Séquenceur » ouvre ET agrandit, d\'un seul geste ===');
    // LE point du lot. Séquenceur fermé, openSeqZoom() rendait la main sans rien faire.
    exiger(await page.evaluate(() => window.app.seqOpen === false), 'on part séquenceur fermé');
    const r0 = await page.evaluate(atteignable, '#seq-zoom');
    exiger(r0.ok, `la porte est réellement atteignable, séquenceur fermé — ${r0.ok ? r0.taille : r0.pourquoi}`);
    await page.click('#seq-zoom');
    await page.waitForTimeout(900);
    const b = await page.evaluate(() => ({
        ouvert: window.app.seqOpen, mode: window.app.seqMode, zoom: window.app.seqZoomOpen,
        overlay: !document.getElementById('seq-zoom-overlay').hidden,
        grilleDansLePleinEcran: !!document.querySelector('#seq-zoom-host .seq-grid'),
    }));
    check(b.ouvert && b.mode === 'compact', `un seul clic ouvre le séquenceur — mode ${b.mode}`);
    // ELLE N'AGRANDIT PLUS, ET C'ÉTAIT UN BLOCAGE. Retour utilisateur : « le bouton séquenceur dans
    // le volet de gauche ne devrait ouvrir que le "Petit séquenceur", pas le grand séquenceur en
    // continu. Sinon, je ne peux jamais ouvrir le petit... » — et c'est exact : la porte ouvrait le
    // compact PUIS l'agrandissait aussitôt, si bien que la vue compacte n'existait à aucun moment.
    check(!b.zoom && !b.overlay, 'elle n\'agrandit plus : le petit séquenceur reste visible, c\'était tout le problème');
    // Elle BASCULE désormais : un second appui referme. C'est cohérent avec « Séq. » juste à côté, et
    // avec l'état allumé que le bouton porte déjà quand sa vue est ouverte — un bouton qui s'allume
    // annonce qu'il s'éteint.
    await page.click('#seq-zoom');
    await page.waitForTimeout(700);
    check(await page.evaluate(() => window.app.seqOpen === false),
        'un second appui referme le petit séquenceur : le bouton allumé annonce qu\'il s\'éteint');
    await page.click('#seq-zoom');
    await page.waitForTimeout(700);

    // === B bis. Le plein écran se demande DEPUIS le séquenceur, par sa loupe ===
    // « Je propose d'ajouter un bouton loupe dans le petit séquenceur, qui permettra d'afficher ce
    // dernier en grand écran […] car je n'aurais pas souvent besoin d'ouvrir le séquenceur en grand. »
    // Agrandir est une opération SUR le séquenceur : sa commande lui appartient.
    exiger(await page.evaluate(() => !!document.getElementById('seq-plein-ecran')),
        'la loupe est présente dans la barre du séquenceur');
    const casePetite = await page.evaluate(() => {
        const c = document.querySelector('.seq-cell');
        return c ? Math.round(c.getBoundingClientRect().width) : null;
    });
    exiger(casePetite > 0, `la taille d'une case du petit séquenceur est mesurable — ${casePetite}px`);
    await page.click('#seq-plein-ecran');
    await page.waitForTimeout(800);
    check(await page.evaluate(() => window.app.seqZoomOpen === true), 'la loupe ouvre bien le plein écran');
    check(await page.evaluate(() => !document.getElementById('seq-plein-ecran')),
        'et disparaît une fois en plein écran : il n\'y a plus rien à agrandir');
    // AGRANDIR NE CHANGE PAS DE VUE, IL CHANGE DE TAILLE. Retour utilisateur : « il y a peut-être un
    // malentendu pour la loupe […] j'aimerais juste voir le petit séquenceur simple, mais en plus gros
    // pour le modifier plus facilement. Donc pas besoin de voir les demi-tons ni les accords
    // adjacents. » C'était bien un malentendu : la loupe basculait dans la vue continue.
    const agrandi = await page.evaluate(() => {
        const g = document.querySelector('.seq-grid');
        const c = document.querySelector('.seq-cell');
        return {
            continu: g.className.includes('continuous'),
            plafonnee: g.className.includes('plafonnee'),
            voisins: document.querySelectorAll('.seq-ctx-note').length,
            lignes: document.querySelectorAll('.seq-row-name, .seq-label').length,
            largeurCase: Math.round(c.getBoundingClientRect().width),
            largeurGrille: Math.round(g.getBoundingClientRect().width),
            fenetre: window.innerWidth,
        };
    });
    check(!agrandi.continu, 'la loupe garde la vue SIMPLE : ni axe chromatique, ni demi-tons');
    check(agrandi.voisins === 0, `et aucun accord voisin en lecture seule — ${agrandi.voisins}`);
    check(agrandi.largeurCase > casePetite,
        `mais des cases plus GRANDES, ce qui est tout l'objet de la loupe — ${casePetite}px puis ${agrandi.largeurCase}px`);
    // « Pour des accords très courts, il faudra limiter la largeur du séquenceur pour que ça garde du
    // sens » : sans plafond, `1fr` étire seize doubles croches sur toute la largeur de l'écran.
    check(agrandi.plafonnee && agrandi.largeurGrille < agrandi.fenetre - 100,
        `la largeur est plafonnée plutôt que d'occuper tout l'écran — grille ${agrandi.largeurGrille}px pour une fenêtre de ${agrandi.fenetre}px`);

    await page.evaluate(() => window.app.closeSeqZoom());
    await page.waitForTimeout(500);

    console.log('\n=== C. « Séq. » ouvre l\'autre vue, et les deux s\'annoncent ===');
    await page.evaluate(() => window.app.closeSeqZoom());
    await page.waitForTimeout(400);
    await page.click('#grid-zoom');
    await page.waitForTimeout(900);
    const c = await page.evaluate(() => ({
        mode: window.app.seqMode, ouvert: window.app.seqOpen,
        seqAllume: document.getElementById('grid-zoom').classList.contains('active'),
        pleinAllume: document.getElementById('seq-zoom').classList.contains('active'),
    }));
    check(c.ouvert && c.mode === 'continu', `« Séq. » ouvre la vue d'ensemble — mode ${c.mode}`);
    // Chacune dit si c'est SA vue qui est ouverte : sans ça, deux portes nommées mais muettes.
    check(c.seqAllume && !c.pleinAllume, 'la porte ouverte s\'allume, l\'autre non');

    console.log('\n=== D. Rien ne déborde, sur aucun format ===');
    for (const [w, h] of [[1440, 950], [1024, 768], [768, 900]]) {
        await page.setViewportSize({ width: w, height: h });
        await page.waitForTimeout(400);
        const m = await page.evaluate(() => {
            const g = document.getElementById('grid-zoom'), barre = g.parentElement;
            return { barre: barre.scrollWidth - barre.clientWidth,
                     page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
                     tronque: g.scrollWidth > g.clientWidth + 1 };
        });
        check(m.barre <= 0 && m.page <= 0 && !m.tronque,
            `${w}px : barre ${m.barre}px, page ${m.page}px, « Séq. » ${m.tronque ? 'TRONQUÉ' : 'entier'}`);
    }
    await page.setViewportSize({ width: 1440, height: 950 });
    await page.waitForTimeout(300);

    console.log('\n=== E. « Séquenceur » ne colle plus ce qui la précède ===');
    // Retour utilisateur : « Il faut l'abaisser un peu, il colle d'autres boutons. » Mesuré avant : 0px.
    const ecart = await page.evaluate(() => {
        const z = document.getElementById('seq-zoom').getBoundingClientRect();
        const dessus = [...document.querySelectorAll('#accord-card *')]
            .filter(e => e.offsetParent !== null && e.getBoundingClientRect().height > 4
                         && e.getBoundingClientRect().bottom <= z.top + 1)
            .sort((x, y) => y.getBoundingClientRect().bottom - x.getBoundingClientRect().bottom)[0];
        return dessus ? { px: Math.round(z.top - dessus.getBoundingClientRect().bottom),
                          quoi: dessus.id || dessus.className } : null;
    });
    exiger(!!ecart, 'il y a bien quelque chose au-dessus d\'elle à mesurer');
    check(ecart.px >= 10, `elle est détachée de ${ecart.px}px de « ${ecart.quoi} », contre 0px avant`);
    await page.close();

    console.log('\n=== F. Téléphone : les deux portes au doigt ===');
    const ctx = await browser.newContext({ ...devices['iPhone 13'], hasTouch: true });
    const m = await ctx.newPage();
    m.on('pageerror', e => erreurs.push('téléphone : ' + e.message));
    await m.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await m.waitForTimeout(300);
    await m.evaluate(seed);
    await m.reload({ waitUntil: 'load' });
    await m.waitForTimeout(1200);
    const tailles = await m.evaluate(() => ['grid-zoom', 'seq-zoom'].map(id => {
        const r = document.getElementById(id).getBoundingClientRect();
        return { id, l: Math.round(r.width), h: Math.round(r.height) };
    }));
    check(tailles.every(t => t.h >= 24 && t.l >= 40),
        `téléphone : les deux portes restent des cibles — ${tailles.map(t => t.id + ' ' + t.l + 'x' + t.h).join(', ')}`);
    await m.evaluate(() => document.getElementById('seq-zoom').scrollIntoView({ block: 'center' }));
    await m.waitForTimeout(400);
    const r1 = await m.evaluate(atteignable, '#seq-zoom');
    exiger(r1.ok, `téléphone : « Séquenceur » est atteignable — ${r1.ok ? r1.taille : r1.pourquoi}`);
    await m.tap('#seq-zoom');
    await m.waitForTimeout(1000);
    check(await m.evaluate(() => window.app.seqOpen === true && window.app.seqZoomOpen === false),
        'téléphone : un vrai appui ouvre le PETIT séquenceur, comme au clic');

    check(erreurs.length === 0, `aucune erreur JavaScript — ${erreurs.join(' | ') || 'aucune'}`);
    await browser.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
