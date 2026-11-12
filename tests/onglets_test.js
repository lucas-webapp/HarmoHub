// LES ONGLETS GRILLE / STRUCTURE / PAROLES (refonte, lot 4 — docs/refonte.md et la maquette « Version 2 »), avec de vrais clics.
//
// CE QUE L'UTILISATEUR A DEMANDÉ : « onglets Grille / Structure / Paroles EXACTEMENT au centre » (trois colonnes égales) et « Structure et Paroles
// deviennent des onglets (Paroles garde sa page et sa synchro propre, ouverte depuis l'onglet) ». Plus la règle du chantier : « rien ne doit régresser » —
// donc Structure et Paroles font ce qu'ils faisaient (même identifiant, même logo, même code), seulement posés ailleurs.
//
// LES QUATRE FAÇONS DONT ÇA PEUT FAILLIR, et ce que le banc en fait :
//   1. LE CENTRE N'EST PAS LE CENTRE — le groupe dérive quand un côté est plus large que l'autre (un titre de 280px, un compte connecté). Mesuré à six
//      largeurs, avec un titre court ET un titre très long, voyant allumé : l'écart au centre de la fenêtre doit rester ≤ 1px, sans jamais toucher un voisin.
//   2. UN BOUTON EN DOUBLE — deux Structure, deux Paroles (l'un caché) : benches qui cliquent le mauvais, identifiants dupliqués. Un nœud, ou rien.
//   3. UN ONGLET QU'ON NE PEUT PLUS CLIQUER — la fenêtre Structure couvre l'écran, onglets compris : pour revenir à la grille il faudrait la fermer d'abord.
//      On vérifie ce que le clic atteint réellement (elementFromPoint), fenêtre ouverte.
//   4. L'ONGLET ALLUMÉ MENT — Grille allumée alors que Structure est ouverte, ou l'inverse.
//
// CE QUE LE BANC NE PEUT PAS DIRE : à quoi ça ressemble (l'œil de l'utilisateur) ; ni ce que fait un vrai Safari de l'ouverture d'un nouvel onglet.
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('onglets');
const { estBruitReseau } = require('./_harness');

plan(35);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const NOM_LONG = 'Ballade en mi bémol pour quatuor à cordes et piano, version longue';
const mk = (root, quality, beats = 4) => ({ root, quality, beats, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held', instrument: 'piano', arpPattern: '', seqEdited: false, guitarLock: null, extraNotes: [], intensity: 75, intensityPerStep: {} });
const graine = (src) => {
    const m = eval('(' + src + ')');
    const sections = [{ title: 'Couplet', chords: [m('C', 'maj7'), m('A', 'min7'), m('D', 'min7'), m('G', '7')] }, { title: 'Refrain', chords: [m('F', 'maj7'), m('E', 'min7')] }];
    localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), sections }]));
    localStorage.setItem('harmohubCurrentSongId', 's1');
    localStorage.setItem('myProgression', JSON.stringify({ sections }));
    sessionStorage.setItem('cc_accueil_vu', '1');
};

(async () => {
    const nav = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const erreurs = [];
    const ouvrir = async (viewport, nom = '') => {
        const ctx = await nav.newContext({ viewport, acceptDownloads: true });
        const p = await ctx.newPage();
        p.on('pageerror', e => erreurs.push(nom + e.message));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) erreurs.push(nom + 'console: ' + m.text()); });
        p.on('dialog', d => d.accept());
        await p.goto(`${BASE}/index.html`);
        await p.evaluate(graine, mk.toString());
        await p.reload();
        await p.waitForTimeout(800);
        return { p, ctx };
    };
    const etat = (p) => p.evaluate(() => ({
        grille: document.getElementById('tab-grille').getAttribute('aria-pressed'),
        structure: document.getElementById('structure-btn').getAttribute('aria-pressed'),
        paroles: document.getElementById('lyrics-btn').getAttribute('aria-pressed'),
        fenetre: !document.getElementById('structure-overlay').hidden,
    }));

    // ======================================================================================================
    console.log('\n=== A. Exactement au centre, à toutes les largeurs, sans toucher un voisin ===');
    let { p, ctx } = await ouvrir({ width: 1440, height: 900 });
    const larges = [900, 1000, 1100, 1280, 1440, 1920];
    let pireEcart = 0, pireJeu = 1e9, pireQui = '';
    for (const w of larges) {
        await p.setViewportSize({ width: w, height: 900 });
        for (const cas of ['court', 'long']) {
            await p.evaluate(({ cas, nom }) => {
                if (cas === 'long') { document.getElementById('tb-titre-nom').textContent = nom; marquerModifie(); }
                else { window.app.refreshSongList(); window.app.rafraichirBarreMorceau(); }
            }, { cas, nom: NOM_LONG });
            await p.waitForTimeout(120);
            const m = await p.evaluate(() => {
                const o = document.getElementById('tb-onglets').getBoundingClientRect();
                const gauche = Math.max(...[...document.querySelector('.tb-gauche').children].map(e => e.getBoundingClientRect().right));
                const droite = Math.min(...[...document.querySelector('.tb-droite').children].map(e => e.getBoundingClientRect().left));
                return { ecart: Math.abs((o.left + o.width / 2) - innerWidth / 2), jeuG: o.left - gauche, jeuD: droite - o.right };
            });
            pireEcart = Math.max(pireEcart, m.ecart);
            if (Math.min(m.jeuG, m.jeuD) < pireJeu) { pireJeu = Math.min(m.jeuG, m.jeuD); pireQui = `${w}px, titre ${cas}`; }
        }
    }
    check(pireEcart <= 1, `le groupe d'onglets est au centre de la fenêtre à ${larges.length} largeurs × titre court et très long : pire écart ${pireEcart.toFixed(2)}px`);
    check(pireJeu >= 8, `…et ne touche jamais le groupe de gauche ni celui de droite : plus petit jeu ${Math.round(pireJeu)}px (${pireQui})`);
    await p.setViewportSize({ width: 1440, height: 900 });
    await p.evaluate(() => { window.app.refreshSongList(); window.app.rafraichirBarreMorceau(); });
    await p.waitForTimeout(150);
    const g = await p.evaluate(() => {
        const ids = ['tab-grille', 'structure-btn', 'lyrics-btn'];
        const bs = ids.map(i => document.getElementById(i));
        const r = (e) => e.getBoundingClientRect();
        return {
            ordre: bs.every((b, i) => i === 0 || r(b).left > r(bs[i - 1]).left),
            hauteurs: bs.map(b => Math.round(r(b).height)),
            rayons: bs.map(b => parseFloat(getComputedStyle(b).borderTopLeftRadius)),
            milieuY: bs.map(b => Math.round((r(b).top + r(b).bottom) / 2)),
            barreMilieu: Math.round((r(document.querySelector('.top-bar')).top + r(document.querySelector('.top-bar')).bottom - 1) / 2),
            noms: bs.map(b => b.textContent.trim()),
            dansCentre: bs.every(b => b.closest('#tb-centre')),
            titres: bs.map(b => b.title),
        };
    });
    check(g.ordre && JSON.stringify(g.noms) === JSON.stringify(['Grille', 'Structure', 'Paroles']), `de gauche à droite : ${g.noms.join(' · ')}`);
    check(g.hauteurs.every(h => h === 32) && g.rayons.every(r => r === 7), `les trois onglets sont à la jauge : ${g.hauteurs.join('/')}px de haut, angles de ${g.rayons.join('/')}px`);
    check(Math.max(...g.milieuY) - Math.min(...g.milieuY) <= 1 && Math.abs(g.milieuY[0] - g.barreMilieu) <= 1, 'ils sont alignés entre eux ET sur le milieu de la barre (une ligne de base)');
    check(g.dansCentre && g.titres.every(t => t.length > 3), 'ils vivent dans la colonne du centre, et chacun a son infobulle');
    // sous 1000px : logos seuls
    await p.setViewportSize({ width: 960, height: 900 }); await p.waitForTimeout(150);
    const etroit = await p.evaluate(() => ({ mots: [...document.querySelectorAll('.tb-onglets .btn-label')].map(e => getComputedStyle(e).display), logos: [...document.querySelectorAll('.tb-onglets .icon')].map(e => e.getBoundingClientRect().width > 0) }));
    check(etroit.mots.every(d => d === 'none') && etroit.logos.every(Boolean), 'sous 1000px les onglets gardent leur logo et perdent leur mot (infobulle) : la place manque, le centrage reste');
    await p.setViewportSize({ width: 1440, height: 900 }); await p.waitForTimeout(150);

    // ======================================================================================================
    console.log('\n=== B. Un seul bouton Structure, un seul Paroles : ceux d\'avant, déplacés ===');
    const b = await p.evaluate(() => ({
        n: ['structure-btn', 'lyrics-btn', 'tab-grille'].map(i => document.querySelectorAll('#' + i).length),
        ilsSontLa: ['structure-btn', 'lyrics-btn'].map(i => !!document.getElementById(i).closest('#tb-onglets')),
        fichierSeul: [...document.querySelectorAll('.viz-export-actions > button')].map(x => x.id),
        fichierHaut: !!document.getElementById('file-menu-btn').closest('.top-bar .tb-gauche') && document.getElementById('file-menu-btn').previousElementSibling.id === 'tb-save',
        rangeeVide: getComputedStyle(document.querySelector('.viz-wrap')).display,
        logoStruct: !!document.querySelector('#structure-btn svg rect'), logoParoles: !!document.querySelector('#lyrics-btn svg rect'),
    }));
    check(JSON.stringify(b.n) === '[1,1,1]', 'un seul nœud par identifiant : jamais deux copies (benches, lecteurs d\'écran)');
    check(b.ilsSontLa.every(Boolean), '#structure-btn et #lyrics-btn sont les boutons d\'origine, maintenant dans la barre du haut');
    // Retour du 11/11 : « Il y a toute une barre noire juste pour le bouton "fichier". Place ce bouton ailleurs et supprime l'espace perdu » : à
    // l'ordinateur, « Fichier » (les exports PDF / MIDI / MP3) quitte le coin bas de la grille pour la barre du haut, juste après « Enregistrer ».
    check(b.fichierSeul.length === 0 && b.fichierHaut && b.rangeeVide === 'none', `« Fichier » est dans la barre du haut, après « Enregistrer », et la rangée du bas a disparu (${b.fichierSeul.join(',')}, ${b.rangeeVide})`);
    check(b.logoStruct && b.logoParoles, 'les logos d\'origine (lignes de structure, micro) sont conservés');
    // aller-retour téléphone ↔ ordinateur : toujours un nœud, au bon endroit. Depuis le lot 10a le « bon endroit » est le même aux deux formats : le
    // téléphone a lui aussi ses onglets (seconde rangée de la barre du haut) ; avant, les deux boutons redescendaient à côté de Fichier.
    await p.setViewportSize({ width: 600, height: 900 }); await p.waitForTimeout(250);
    const tel = await p.evaluate(() => ({ n: ['structure-btn', 'lyrics-btn'].map(i => document.querySelectorAll('#' + i).length), onglets: ['structure-btn', 'lyrics-btn'].map(i => !!document.getElementById(i).closest('#tb-onglets')), ordre: [...document.querySelectorAll('#tb-onglets > button')].map(x => x.id), fichier: [...document.querySelectorAll('.viz-export-actions > button')].map(x => x.id), visible: ['tab-grille', 'structure-btn', 'lyrics-btn', 'file-menu-btn'].map(i => document.getElementById(i).getBoundingClientRect().width > 0) }));
    check(JSON.stringify(tel.n) === '[1,1]' && tel.onglets.every(Boolean) && JSON.stringify(tel.ordre) === '["tab-grille","structure-btn","lyrics-btn"]', `à 600px ils restent dans les onglets, dans le même ordre (${tel.ordre.join(', ')})`);
    check(tel.visible.every(Boolean) && JSON.stringify(tel.fichier) === '["file-menu-btn"]', 'téléphone : les trois onglets sont visibles ; « Fichier » garde seul le coin bas de la grille (à l\'ordinateur il est dans la barre du haut)');
    await p.setViewportSize({ width: 1440, height: 900 }); await p.waitForTimeout(250);
    const retour = await p.evaluate(() => ({ n: ['structure-btn', 'lyrics-btn'].map(i => document.querySelectorAll('#' + i).length), ontglets: ['structure-btn', 'lyrics-btn'].map(i => !!document.getElementById(i).closest('#tb-onglets')), fichier: document.querySelectorAll('#file-menu-btn').length === 1 && !!document.getElementById('file-menu-btn').closest('.tb-gauche') }));
    check(JSON.stringify(retour.n) === '[1,1]' && retour.ontglets.every(Boolean) && retour.fichier, 'de retour à 1440px : de nouveau dans les onglets (et « Fichier » dans la barre du haut), toujours un seul nœud chacun');
    // Le menu Fichier s'ouvre sous son bouton, dans l'écran, depuis sa nouvelle place (un vrai clic).
    const bf = await p.locator('#file-menu-btn').boundingBox();
    await p.mouse.click(bf.x + bf.width / 2, bf.y + bf.height / 2); await p.waitForTimeout(250);
    const menuF = await p.evaluate(() => { const m = document.getElementById('file-menu'), r = m.getBoundingClientRect(), b = document.getElementById('file-menu-btn').getBoundingClientRect(); return { ouvert: !m.hidden, sous: r.top >= b.bottom - 1, dedans: r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, entrees: m.querySelectorAll('button').length }; });
    check(menuF.ouvert && menuF.sous && menuF.dedans && menuF.entrees > 3, `un clic sur « Fichier » ouvre son menu sous lui, dans l'écran (${JSON.stringify(menuF)})`);
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);

    // ======================================================================================================
    console.log('\n=== C. L\'onglet allumé dit la vérité ===');
    let e = await etat(p);
    check(e.grille === 'true' && e.structure === 'false' && e.paroles === 'false' && !e.fenetre, 'à l\'ouverture : Grille allumée, les deux autres éteints');
    await p.click('#structure-btn');
    await p.waitForTimeout(350);
    e = await etat(p);
    check(e.fenetre && e.structure === 'true' && e.grille === 'false', 'un clic sur Structure ouvre la fenêtre et l\'allume ; Grille s\'éteint');
    const sous = await p.evaluate(() => {
        const o = document.getElementById('structure-overlay').getBoundingClientRect();
        const bar = document.querySelector('.top-bar').getBoundingClientRect();
        const atteint = (id) => { const r = document.getElementById(id).getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!el && (el.id === id || document.getElementById(id).contains(el)); };
        return { hautFenetre: o.top, basBarre: bar.bottom, grille: atteint('tab-grille'), structure: atteint('structure-btn'), paroles: atteint('lyrics-btn'), titre: atteint('tb-titre'), enregistrer: atteint('tb-save') };
    });
    check(sous.hautFenetre >= sous.basBarre - 0.5, `la fenêtre Structure s'ouvre SOUS la barre (elle commence à ${Math.round(sous.hautFenetre)}px, la barre finit à ${Math.round(sous.basBarre)}px)`);
    check(sous.grille && sous.structure && sous.paroles, 'fenêtre ouverte, les trois onglets reçoivent encore le clic (rien ne les recouvre)');
    check(sous.titre && sous.enregistrer, '…et le titre du morceau et Enregistrer aussi : la barre entière reste utilisable');
    await p.click('#tab-grille');
    await p.waitForTimeout(250);
    e = await etat(p);
    check(!e.fenetre && e.grille === 'true' && e.structure === 'false', 'un clic sur Grille referme la fenêtre : on est revenu à la grille');
    await p.click('#structure-btn'); await p.waitForTimeout(250);
    await p.click('#structure-btn'); await p.waitForTimeout(250);
    e = await etat(p);
    check(!e.fenetre && e.grille === 'true' && e.structure === 'false', 'un second clic sur Structure la referme (c\'est un onglet, pas un simple bouton d\'ouverture)');
    await p.click('#structure-btn'); await p.waitForTimeout(250);
    await p.keyboard.press('Escape'); await p.waitForTimeout(250);
    e = await etat(p);
    check(!e.fenetre && e.grille === 'true' && e.structure === 'false', 'Échap referme la fenêtre ET rallume Grille (l\'état suit, d\'où que vienne la fermeture)');
    await p.click('#structure-btn'); await p.waitForTimeout(250);
    // LOT 4b : sur ordinateur Structure est une VUE — pas de croix de fenêtre (l'onglet Grille ramène à la grille) ; le téléphone, où elle reste
    // une fenêtre, garde la sienne (section E).
    check(await p.evaluate(() => getComputedStyle(document.getElementById('structure-close')).display === 'none' && getComputedStyle(document.getElementById('structure-title')).display === 'none'),
        'vue Structure : ni croix ni titre de fenêtre (l\'onglet dit « Structure », l\'onglet Grille ramène à la grille)');
    await p.click('#tab-grille'); await p.waitForTimeout(250);
    await p.click('#structure-btn'); await p.waitForTimeout(250);
    await p.mouse.click(1420, 600); // à côté du panneau
    await p.waitForTimeout(250);
    e = await etat(p);
    // LOT 4b : Structure est une VUE dans la page, plus une fenêtre posée sur un voile — « à côté du panneau », c'est la page : cliquer là ne la
    // referme plus (on revient à la grille par l'onglet Grille). Avant, ce clic la fermait : c'était un fond de fenêtre.
    check(e.fenetre && e.structure === 'true', 'un clic à côté du panneau ne referme pas la vue Structure (c\'est la page, plus un voile de fenêtre)');
    await p.click('#tab-grille'); await p.waitForTimeout(250);
    // ce que montre la fenêtre : la structure du morceau, comme avant
    await p.click('#structure-btn'); await p.waitForTimeout(300);
    const contenu = await p.evaluate(() => document.getElementById('structure-panel').textContent);
    check(/Couplet/.test(contenu) && /Refrain/.test(contenu), 'la fenêtre Structure montre toujours les parties du morceau (Couplet, Refrain)');
    await p.click('#tab-grille'); await p.waitForTimeout(250);
    // le clavier
    await p.focus('#structure-btn');
    await p.keyboard.press('Enter'); await p.waitForTimeout(250);
    e = await etat(p);
    check(e.fenetre && e.structure === 'true', 'au clavier : Entrée sur Structure l\'ouvre');
    await p.click('#tab-grille'); await p.waitForTimeout(200);

    // ======================================================================================================
    console.log('\n=== D. Paroles : une vue du morceau, dans la page (lot 4b) ===');
    // « Au lieu de séparer Paroles, on peut l'intégrer directement au morceau. » Plus de nouvel onglet du navigateur, plus de fichier téléchargé :
    // l'onglet ouvre la vue, et c'est un onglet comme les deux autres (allumé, exclusif). Le détail de la vue est éprouvé par vues_integrees_test.
    let nouvellesPages = 0, telechargements = 0;
    ctx.on('page', () => nouvellesPages++);
    p.on('download', () => telechargements++);
    await p.click('#lyrics-btn');
    await p.waitForSelector('#vue-paroles:not([hidden])', { timeout: 3000 });
    await p.waitForTimeout(400);
    e = await etat(p);
    check(e.paroles === 'true' && e.grille === 'false' && e.structure === 'false' && !e.fenetre, 'un clic sur Paroles ouvre la vue Paroles et l\'allume ; Grille et Structure s\'éteignent');
    check(nouvellesPages === 0 && telechargements === 0, 'ni nouvel onglet du navigateur, ni fichier téléchargé : Paroles fait partie du morceau');
    await p.click('#structure-btn'); await p.waitForTimeout(300);
    e = await etat(p);
    check(e.structure === 'true' && e.paroles === 'false' && await p.evaluate(() => document.getElementById('vue-paroles').hidden), 'Structure depuis Paroles : une vue à la fois');
    await p.click('#lyrics-btn'); await p.waitForTimeout(300);
    await p.click('#lyrics-btn'); await p.waitForTimeout(300);
    e = await etat(p);
    check(e.grille === 'true' && e.paroles === 'false', 'un second clic sur Paroles referme la vue et rallume Grille');
    await p.click('#lyrics-btn'); await p.waitForTimeout(300);
    await p.click('#tab-grille'); await p.waitForTimeout(300);
    e = await etat(p);
    check(e.grille === 'true' && e.paroles === 'false', 'Grille referme la vue Paroles');

    // ======================================================================================================
    console.log('\n=== E. Téléphone (lot 10a) : les onglets sous la barre du haut ===');
    // AVANT le lot 10a : « pas d'onglets en haut, Structure plein écran comme avant ». La refonte du téléphone a changé ce sens : les onglets sont
    // un groupe segmenté de 44px sur la seconde rangée de la barre, et la fenêtre Structure s'ouvre SOUS la barre pour qu'ils restent atteignables.
    await ctx.close();
    ({ p, ctx } = await ouvrir({ width: 390, height: 844 }, 'tel: '));
    const t = await p.evaluate(() => {
        const r = (i) => document.getElementById(i).getBoundingClientRect();
        const barre = document.querySelector('.top-bar').getBoundingClientRect();
        return { groupe: r('tb-onglets').height, onglets: ['tab-grille', 'structure-btn', 'lyrics-btn'].map(i => Math.round(r(i).width)), dansBarre: r('tb-onglets').bottom <= barre.bottom, egaux: (() => { const w = ['tab-grille', 'structure-btn', 'lyrics-btn'].map(i => r(i).width); return Math.max(...w) - Math.min(...w) < 1.5; })() };
    });
    check(t.groupe === 44 && t.dansBarre && t.egaux && t.onglets.every(w => w > 60), `téléphone : trois onglets égaux dans un groupe de 44px, dans la barre du haut (${t.onglets} px)`);
    await p.click('#structure-btn'); await p.waitForTimeout(350);
    const tf = await p.evaluate(() => ({ ouverte: !document.getElementById('structure-overlay').hidden, haut: document.getElementById('structure-overlay').getBoundingClientRect().top, barre: document.querySelector('.top-bar').getBoundingClientRect().bottom, allume: document.getElementById('structure-btn').getAttribute('aria-pressed') }));
    check(tf.ouverte && Math.abs(tf.haut - tf.barre) <= 1 && tf.allume === 'true', `téléphone : la fenêtre Structure s'ouvre SOUS la barre (haut à ${Math.round(tf.haut)}px, barre jusqu'à ${Math.round(tf.barre)}px), onglet allumé`);
    await p.click('#tab-grille'); await p.waitForTimeout(250);
    check(await p.evaluate(() => document.getElementById('structure-overlay').hidden && document.getElementById('tab-grille').getAttribute('aria-pressed') === 'true'), 'téléphone : l\'onglet Grille la referme (les onglets restent sous le doigt)');
    // CHANGÉ DE SENS AU LOT 10b : Structure n'est plus une fenêtre au téléphone mais une vue, comme à l'ordinateur — sans croix (l'onglet Grille
    // ramène) ; Échap la referme, comme à l'ordinateur.
    await p.click('#structure-btn'); await p.waitForTimeout(350);
    const croixTel = await p.evaluate(() => document.getElementById('structure-close').getBoundingClientRect().width);
    await p.keyboard.press('Escape'); await p.waitForTimeout(250);
    check(croixTel === 0 && await p.evaluate(() => document.getElementById('structure-overlay').hidden), `téléphone : Structure est une vue sans croix (${croixTel}px), Échap la referme (lot 10b)`);
    await ctx.close();

    console.log(`\nErreurs de page : ${erreurs.length}${erreurs.length ? '\n  ' + erreurs.slice(0, 6).join('\n  ') : ''}`);
    check(erreurs.length === 0, 'aucune erreur JavaScript pendant tout le banc');
    await nav.close();
    bilan();
})();
