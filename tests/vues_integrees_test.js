// LES VUES INTÉGRÉES : PAROLES ET STRUCTURE DANS LE MORCEAU (refonte, lot 4b), avec de vrais clics et de vraies frappes.
//
// CE QUE L'UTILISATEUR A DEMANDÉ : « au lieu de séparer Paroles, on peut l'intégrer directement au morceau. Ce sera plus simple. Il ne faut pas
// qu'elle garde sa propre en-tête, ni le logo. On peut garder les trois onglets avec Paroles et Structure intégrées. »
//
// COMMENT C'EST FAIT (et donc ce qui peut casser) : la page Paroles est chargée DANS HarmoHub, en mode intégré (paroles.html?integre=1) —
// son code ne pouvait pas entrer dans script.js sans tout renommer (mêmes noms globaux, CSS qui habille toute la page). Les risques propres
// à ce montage, et ce que le banc en fait :
//   1. ON VOIT ENCORE L'AUTRE PAGE — en-tête, logo, bouton d'import, son propre compte, ses propres annuler / rétablir : relevé DANS le cadre.
//   2. ON PERD DES PAROLES — elles s'enregistrent un instant après la frappe ; quitter la vue juste après avoir tapé ne doit rien perdre.
//   3. LES DEUX HISTORIQUES SE MÉLANGENT — annuler dans la barre du haut, vue Paroles ouverte, doit défaire les PAROLES, jamais la grille cachée.
//   4. LA GRILLE CACHÉE RÉAGIT — une lettre ou Suppr tapée vue ouverte modifiait un accord qu'on ne voit pas.
//   5. LA VUE NE SUIT PAS LE MORCEAU — changer de morceau vue ouverte doit montrer les accords et les paroles du NOUVEAU morceau.
//   6. LE FOND — un rectangle blanc à la place de la vue (le navigateur peint un fond opaque si les color-scheme diffèrent) ; mesuré en pixels.
// Et la Structure : une vue dans la page (pas de voile, pas de croix), la grille masquée derrière, la barre de lecture toujours utilisable.
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('vues intégrées (Paroles, Structure)');
const { estBruitReseau } = require('./_harness');

plan(40);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const mk = (root, quality, beats = 4) => ({ root, quality, beats, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held', instrument: 'piano', arpPattern: '', seqEdited: false, guitarLock: null, extraNotes: [], intensity: 75, intensityPerStep: {} });
const graine = ({ src, avecMorceau, verre }) => {
    const m = eval('(' + src + ')');
    const A = [{ title: 'Couplet', chords: [m('C', 'maj7'), m('A', 'min7'), m('D', 'min7'), m('G', '7')] }, { title: 'Refrain', chords: [m('F', 'maj7'), m('E', 'min7')] }];
    const B = [{ title: 'Pont', chords: [m('B', 'min7'), m('E', '7')] }];
    localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 's1', name: 'Démo', savedAt: Date.now(), sections: A }, { id: 's2', name: 'Autre', savedAt: Date.now() - 1000, sections: B }]));
    if (avecMorceau) { localStorage.setItem('harmohubCurrentSongId', 's1'); localStorage.setItem('myProgression', JSON.stringify({ sections: A })); }
    else { localStorage.removeItem('harmohubCurrentSongId'); localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: '', chords: [m('C', 'maj')] }] })); }
    if (verre) localStorage.setItem('harmohub.glass.v1', '1'); else localStorage.removeItem('harmohub.glass.v1');
    sessionStorage.setItem('cc_accueil_vu', '1');
};

(async () => {
    const nav = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const erreurs = [];
    const ouvrir = async (opts = {}) => {
        const ctx = await nav.newContext({ viewport: opts.viewport || { width: 1300, height: 820 }, acceptDownloads: true });
        const p = await ctx.newPage();
        p.on('pageerror', e => erreurs.push((opts.nom || '') + e.message));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) erreurs.push((opts.nom || '') + 'console: ' + m.text()); });
        p.on('dialog', d => d.accept());
        await p.goto(`${BASE}/index.html`);
        await p.evaluate(graine, { src: mk.toString(), avecMorceau: opts.sansMorceau ? false : true, verre: !!opts.verre });
        await p.reload();
        await p.waitForTimeout(800);
        return { p, ctx };
    };
    const cadre = (p) => p.frame({ url: /paroles\.html\?integre=1/ });
    const attendreCadre = async (p) => {
        for (let i = 0; i < 40; i++) { const f = cadre(p); if (f && await f.evaluate(() => document.readyState === 'complete' && !!document.querySelector('.lyrics-text')).catch(() => false)) return f; await p.waitForTimeout(100); }
        return null;
    };
    const grilleEnregistree = (p) => p.evaluate(() => localStorage.getItem('myProgression'));
    const sessionDe = (p, id) => p.evaluate((id) => { const s = localStorage.getItem('harmohub_lyrics_v1_id-' + id); return s ? JSON.parse(s) : null; }, id);
    const texteParoles = (s) => s ? s.sections.map(x => (x.lyricsHtml || '').replace(/<[^>]+>/g, '')).join('|') : '';

    // ======================================================================================================
    console.log('\n=== A. La vue Paroles : la page Paroles, sans son en-tête ni son logo ===');
    let { p, ctx } = await ouvrir({ nom: 'A: ' });
    let pages = 0, fichiers = 0;
    ctx.on('page', () => pages++); p.on('download', () => fichiers++);
    await p.click('#lyrics-btn');
    let f = await attendreCadre(p);
    exiger(!!f, 'la vue Paroles charge la page Paroles en mode intégré (paroles.html?integre=1)');
    check(pages === 0 && fichiers === 0, 'ni nouvel onglet du navigateur, ni fichier .json téléchargé');
    const dedans = await f.evaluate(() => {
        const vis = (s) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
        return {
            entete: vis('.top-bar'), logo: vis('.logo-mark'), retour: vis('.btn-back'), titrePage: vis('h1'), importer: vis('#btn-import'), compte: vis('#compte-cloud'),
            annuler: vis('#btn-undo'), retablir: vis('#btn-redo'),
            exports: ['btn-export-text', 'btn-copy-text', 'btn-export-pdf'].map(id => !!document.getElementById(id).closest('#toolbar') && vis('#' + id)),
            etat: !!document.getElementById('save-status').closest('#toolbar'),
            accords: [...document.querySelectorAll('.pool-chord, .chord-pool button, .pool-pill')].map(b => b.textContent.trim()).filter(Boolean),
            parties: [...document.querySelectorAll('.section-title')].map(t => t.textContent.trim()),
        };
    });
    check(!dedans.entete && !dedans.logo && !dedans.retour && !dedans.titrePage, 'dans la vue : ni en-tête, ni logo, ni lien « HarmoHub », ni titre « Paroles »');
    check(!dedans.importer && !dedans.compte, '…ni bouton d\'import (le morceau vient de HarmoHub), ni second bouton de compte (celui de la barre du haut suffit)');
    check(!dedans.annuler && !dedans.retablir, '…ni ses propres annuler / rétablir : ce sont ceux de la barre du haut (pas de doublon à l\'écran)');
    check(dedans.exports.every(Boolean) && dedans.etat, 'les exports texte, copie, PDF et l\'état d\'enregistrement des paroles ont rejoint sa barre d\'outils (rien de perdu)');
    check(dedans.parties.join() === 'Couplet,Refrain', `la vue montre les parties du morceau ouvert (${dedans.parties.join(', ')})`);
    const geo = await p.evaluate(() => {
        const v = document.getElementById('vue-paroles').getBoundingClientRect();
        const bar = document.querySelector('.top-bar').getBoundingClientRect();
        const bl = document.getElementById('barre-lecture').getBoundingClientRect();
        const r = document.getElementById('play-prog').getBoundingClientRect();
        const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { haut: v.top, basBarre: bar.bottom, bas: v.bottom, hautLecture: bl.top, lecture: !!el && (el.id === 'play-prog' || document.getElementById('play-prog').contains(el)), grilleCachee: getComputedStyle(document.querySelector('main')).visibility === 'hidden' };
    });
    check(Math.abs(geo.haut - geo.basBarre) <= 1 && Math.abs(geo.bas - geo.hautLecture) <= 1, `la vue occupe exactement l'espace entre la barre du haut et la barre de lecture (${Math.round(geo.haut)} → ${Math.round(geo.bas)}px)`);
    check(geo.lecture, 'la barre de lecture reste utilisable sous la vue (on joue le morceau en lisant ses paroles)');
    check(geo.grilleCachee, 'la grille est masquée derrière la vue (sans être recalculée : revenir à la grille est instantané)');

    console.log('\n--- A2. Écrire des paroles, quitter la vue tout de suite : rien ne se perd ---');
    await f.click('.lyrics-text');
    await p.keyboard.type('Sous le pont Mirabeau');
    await p.click('#tab-grille'); // AUSSITÔT : pas d'attente du délai d'enregistrement
    await p.waitForTimeout(150);
    const apres = await sessionDe(p, 's1');
    check(/Sous le pont Mirabeau/.test(texteParoles(apres)), 'paroles tapées puis vue quittée aussitôt : elles sont déjà enregistrées (écriture forcée en quittant la vue)');
    await p.click('#lyrics-btn');
    f = await attendreCadre(p);
    check(/Sous le pont Mirabeau/.test(await f.evaluate(() => document.querySelector('.lyrics-text').textContent)), 'en revenant sur Paroles, elles sont là');

    console.log('\n--- A3. Annuler / rétablir de la barre du haut agissent sur les PAROLES, jamais sur la grille cachée ---');
    const grilleAvant = await grilleEnregistree(p);
    // Paroles regroupe les frappes rapprochées en UNE étape d'annulation (UNDO_GROUP_WINDOW dans paroles.js) : on laisse passer ce délai, pour que la
    // seconde phrase soit bien une étape à part — sinon un seul Ctrl+Z efface les deux, ce qui est le comportement voulu de Paroles, pas un défaut.
    const fenetreGroupe = await f.evaluate(() => UNDO_GROUP_WINDOW);
    await p.waitForTimeout(fenetreGroupe + 300);
    await f.click('.lyrics-text');
    await p.keyboard.press('End');
    await p.keyboard.type(' coule la Seine');
    await p.waitForTimeout(900); // le regroupement des frappes de Paroles : une étape d'annulation
    await p.click('#tb-etat'); // retour du focus à HarmoHub : le voyant d'enregistrement, zone neutre de la barre du haut (pas un onglet !)
    await p.waitForTimeout(200);
    check(await p.evaluate(() => !document.getElementById('global-undo-btn').disabled), 'il y a quelque chose à annuler dans les paroles : le bouton Annuler de la barre du haut s\'allume');
    await p.click('#global-undo-btn');
    await p.waitForTimeout(300);
    const apresAnnuler = await f.evaluate(() => document.querySelector('.lyrics-text').textContent);
    check(apresAnnuler.trim() === 'Sous le pont Mirabeau', `Annuler (barre du haut) défait la dernière étape des paroles, et elle seule (« ${apresAnnuler.trim()} »)`);
    check(await grilleEnregistree(p) === grilleAvant, '…et ne touche pas à la grille cachée');
    await p.click('#global-redo-btn');
    await p.waitForTimeout(300);
    check(/coule la Seine/.test(await f.evaluate(() => document.querySelector('.lyrics-text').textContent)), 'Rétablir la refait');
    await p.click('#tb-etat');
    await p.keyboard.press('Control+z');
    await p.waitForTimeout(300);
    check((await f.evaluate(() => document.querySelector('.lyrics-text').textContent)).trim() === 'Sous le pont Mirabeau' && await grilleEnregistree(p) === grilleAvant, 'Ctrl+Z, le focus dans HarmoHub et la vue ouverte : même chose (les paroles, pas la grille)');

    console.log('\n--- A4. La grille cachée ne réagit plus au clavier ---');
    // CE QUI MENACE VRAIMENT. Ouvrir une vue (à la souris comme au clavier : l'activation de l'onglet est un clic) efface la sélection de la grille —
    // mesuré à part —, si bien que Suppr ou les lettres n'ont plus d'accord à viser. Mais Ctrl+V colle le presse-papiers des accords SANS sélection
    // (mesuré : 3 → 4 accords) : vue ouverte, il ajouterait un accord dans une grille qu'on ne voit pas. On copie donc un accord, on ouvre la vue, on
    // tape Ctrl+V et le reste ; puis TÉMOIN : vue fermée, le même Ctrl+V colle bien — sans lui, « rien n'a bougé » ne prouverait rien (un premier jet
    // de ce banc, avec Suppr seul, restait vert la garde retirée).
    await p.click('#tab-grille'); await p.waitForTimeout(250);
    const caseA = await p.locator('.grid-cell').first().boundingBox();
    await p.mouse.click(caseA.x + caseA.width / 2, caseA.y + caseA.height * 0.85);
    await p.waitForTimeout(300);
    await p.keyboard.press('Control+c');
    const grilleSel = await grilleEnregistree(p);
    await p.click('#lyrics-btn'); await attendreCadre(p);
    exiger(await p.evaluate(() => document.activeElement && document.activeElement.id === 'lyrics-btn' && (window.app.clipboard || []).length === 1), 'vue Paroles ouverte, le focus dans HarmoHub (sur l\'onglet), un accord dans le presse-papiers');
    // Ctrl+V SEUL d'abord : sans la garde, il colle un accord ET le sélectionne — un Suppr juste derrière l'effacerait, et la grille reviendrait
    // identique : la séquence entière masquerait le défaut (c'est arrivé, sabotage à l'appui).
    await p.keyboard.press('Control+v'); await p.waitForTimeout(250);
    check(await grilleEnregistree(p) === grilleSel, 'vue Paroles ouverte : Ctrl+V ne colle rien dans la grille cachée');
    for (const k of ['Delete', 'Backspace', 'c', 'ArrowRight']) await p.keyboard.press(k);
    await p.waitForTimeout(250);
    check(await grilleEnregistree(p) === grilleSel, '…ni Suppr, Retour, une lettre, une flèche');
    await p.keyboard.press('Escape');
    await p.waitForTimeout(250);
    check(await p.evaluate(() => document.getElementById('vue-paroles').hidden && document.getElementById('tab-grille').getAttribute('aria-pressed') === 'true'), 'Échap (focus dans HarmoHub) referme la vue Paroles et rallume Grille');
    const nAvantTemoin = await p.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections.flatMap(x => x.chords).length);
    await p.keyboard.press('Control+v'); await p.waitForTimeout(250);
    const nApresTemoin = await p.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections.flatMap(x => x.chords).length);
    check(nApresTemoin === nAvantTemoin + 1, `TÉMOIN : vue fermée, le même Ctrl+V colle bien l'accord (${nAvantTemoin} → ${nApresTemoin}) — la garde n'est donc pas vide`);
    await p.keyboard.press('Control+z'); await p.waitForTimeout(250);

    console.log('\n--- A5. La vue suit le morceau ouvert ---');
    await p.click('#lyrics-btn');
    f = await attendreCadre(p);
    await p.click('#tb-titre');
    await p.click('#tb-menu .tb-mi-morceau:not(.actif)');
    await p.waitForTimeout(300);
    if (await p.evaluate(() => !document.getElementById('unsaved-modal').hidden)) await p.click('#unsaved-discard');
    await p.waitForTimeout(800);
    f = await attendreCadre(p);
    const autre = await f.evaluate(() => ({ parties: [...document.querySelectorAll('.section-title')].map(t => t.textContent.trim()), texte: document.querySelector('.lyrics-text').textContent }));
    check(autre.parties.join() === 'Pont' && !/Mirabeau/.test(autre.texte), `changer de morceau, vue ouverte : la vue montre le NOUVEAU morceau (${autre.parties.join(', ')}), sans les paroles de l'autre`);
    await f.click('.lyrics-text');
    await p.keyboard.type('Paroles du pont');
    await p.click('#tb-titre');
    await p.click('#tb-menu .tb-mi-morceau:not(.actif)');
    await p.waitForTimeout(1000);
    f = await attendreCadre(p);
    const retour = await f.evaluate(() => document.querySelector('.lyrics-text').textContent);
    const duSecond = texteParoles(await sessionDe(p, 's2'));
    const ouvertMaintenant = await p.evaluate(() => localStorage.getItem('harmohubCurrentSongId'));
    check(ouvertMaintenant === 's1' && /Mirabeau/.test(retour), `retour au premier morceau : ses paroles reviennent (ouvert : ${ouvertMaintenant}, vue : « ${retour.trim()} »)`);
    check(/Paroles du pont/.test(duSecond), `…et celles du second ont été enregistrées en le quittant (« ${duSecond} »)`);
    await ctx.close();

    // ======================================================================================================
    console.log('\n=== B. Le fond : celui de l\'appli, jamais un rectangle blanc ===');
    for (const verre of [false, true]) {
        ({ p, ctx } = await ouvrir({ nom: `B${verre ? 'v' : 'u'}: `, verre }));
        await p.click('#lyrics-btn');
        await attendreCadre(p);
        await p.waitForTimeout(400);
        // Un point de la vue SANS contenu (marge à gauche du texte), en pixels réels de la capture.
        const shot = await p.screenshot({ clip: { x: 40, y: 300, width: 4, height: 4 } });
        const { PNG } = (() => { try { return require('pngjs'); } catch (e) { return {}; } })();
        let lum;
        if (PNG) { const img = PNG.sync.read(shot); lum = (img.data[0] + img.data[1] + img.data[2]) / 3; }
        else lum = await p.evaluate(async (b64) => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const c = document.createElement('canvas'); c.width = 4; c.height = 4; const x = c.getContext('2d'); x.drawImage(img, 0, 0); const d = x.getImageData(1, 1, 1, 1).data; return (d[0] + d[1] + d[2]) / 3; }, shot.toString('base64'));
        check(lum < 80, `verre ${verre ? 'allumé' : 'éteint'} : le fond de la vue Paroles est celui de l'appli, sombre (luminosité ${Math.round(lum)}/255) — pas un rectangle blanc`);
        await ctx.close();
    }

    // ======================================================================================================
    console.log('\n=== C. Un morceau sans nom ===');
    ({ p, ctx } = await ouvrir({ nom: 'C: ', sansMorceau: true }));
    await p.click('#lyrics-btn');
    await p.waitForTimeout(300);
    check(await p.evaluate(() => !document.getElementById('vue-paroles-vide').hidden && document.getElementById('paroles-cadre').hidden), 'morceau jamais enregistré : la vue explique qu\'il faut d\'abord le nommer (les paroles sont attachées au morceau)');
    await p.click('#vue-paroles-nommer');
    await p.waitForTimeout(200);
    check(await p.evaluate(() => !!document.querySelector('.top-bar input.tb-titre-saisie')), '« Nommer le morceau » ouvre le champ du nom dans la barre du haut');
    await p.keyboard.type('Chanson neuve'); await p.keyboard.press('Enter');
    f = await attendreCadre(p);
    check(!!f && await p.evaluate(() => document.getElementById('vue-paroles-vide').hidden), 'une fois nommé, la vue Paroles s\'ouvre sur lui, sans autre geste');
    await ctx.close();

    // ======================================================================================================
    console.log('\n=== D. La vue Structure ===');
    ({ p, ctx } = await ouvrir({ nom: 'D: ' }));
    await p.click('#structure-btn');
    await p.waitForTimeout(400);
    const s = await p.evaluate(() => {
        const o = document.getElementById('structure-overlay'); const st = getComputedStyle(o);
        const bl = document.getElementById('barre-lecture').getBoundingClientRect(); const r = o.getBoundingClientRect();
        const pp = document.getElementById('play-prog').getBoundingClientRect(); const el = document.elementFromPoint(pp.left + pp.width / 2, pp.top + pp.height / 2);
        return { fond: st.backgroundColor, flou: st.backdropFilter || st.webkitBackdropFilter || 'none', bas: r.bottom, hautLecture: bl.top, lecture: !!el && document.getElementById('play-prog').contains(el) || (el && el.id === 'play-prog'),
            pdf: document.getElementById('structure-pdf').getBoundingClientRect().width > 0, grilleCachee: getComputedStyle(document.querySelector('main')).visibility === 'hidden', contenu: document.getElementById('structure-panel').textContent };
    });
    check(/rgba\(0, 0, 0, 0\)|transparent/.test(s.fond) && (s.flou === 'none' || s.flou === ''), `plus de voile ni de flou : c'est une vue dans la page (fond ${s.fond})`);
    check(Math.abs(s.bas - s.hautLecture) <= 1 && s.lecture, 'elle s\'arrête au-dessus de la barre de lecture, qui reste utilisable');
    check(s.grilleCachee && /Couplet/.test(s.contenu) && /Refrain/.test(s.contenu), 'la grille est masquée derrière ; la vue montre les parties du morceau');
    check(s.pdf, 'le bouton « Aperçu / PDF » reste à sa place');
    await p.click('#tab-grille'); await p.waitForTimeout(250);
    const caseD = await p.locator('.grid-cell').first().boundingBox();
    await p.mouse.click(caseD.x + caseD.width / 2, caseD.y + caseD.height * 0.85);
    await p.waitForTimeout(300);
    await p.keyboard.press('Control+c');
    const avantS = await grilleEnregistree(p);
    await p.click('#structure-btn'); await p.waitForTimeout(300);
    await p.keyboard.press('Control+v'); await p.waitForTimeout(250);
    check(await grilleEnregistree(p) === avantS, 'vue Structure ouverte : Ctrl+V ne colle rien dans la grille cachée');
    for (const k of ['Delete', 'c']) await p.keyboard.press(k);
    await p.waitForTimeout(250);
    check(await grilleEnregistree(p) === avantS, '…ni Suppr ni les lettres');
    await p.click('#tab-grille'); await p.waitForTimeout(250);
    check(await p.evaluate(() => getComputedStyle(document.querySelector('main')).visibility !== 'hidden'), 'retour à la grille : elle réapparaît');
    await ctx.close();

    // ======================================================================================================
    console.log('\n=== E. La page Paroles ouverte seule ne change pas ===');
    ({ p, ctx } = await ouvrir({ nom: 'E: ' }));
    const seule = await ctx.newPage();
    await seule.goto(`${BASE}/paroles.html`);
    await seule.waitForTimeout(600);
    const e = await seule.evaluate(() => ({ integre: document.documentElement.classList.contains('integre'), entete: getComputedStyle(document.querySelector('.top-bar')).display !== 'none', logo: !!document.querySelector('.top-bar .logo-mark'), retour: !!document.querySelector('.btn-back') }));
    check(!e.integre && e.entete && e.logo && e.retour, 'paroles.html ouverte directement (favori, téléphone) : son en-tête, son logo et le lien de retour sont toujours là');
    await ctx.close();

    // ======================================================================================================
    // CHANGÉ DE SENS AU LOT 10b : avant, le téléphone ouvrait encore Paroles dans sa page (nouvel onglet) — sa barre de lecture n'existait pas, et une
    // vue posée sur la page aurait masqué le transport du volet. Il a désormais la barre de lecture, et la vue s'arrête au-dessus d'elle.
    console.log('\n=== F. Téléphone (lot 10b) : Paroles y est aussi une vue intégrée ===');
    ({ p, ctx } = await ouvrir({ nom: 'F: ', viewport: { width: 390, height: 844 } }));
    let ongletsTel = 0; ctx.on('page', () => { ongletsTel++; });
    await p.click('#lyrics-btn'); await p.waitForTimeout(1500);
    const vueTel = await p.evaluate(() => { const v = document.getElementById('vue-paroles'); return { ouverte: !v.hidden, bas: Math.round(v.getBoundingClientRect().bottom), lecture: Math.round(document.getElementById('barre-lecture').getBoundingClientRect().top), src: document.getElementById('paroles-cadre').getAttribute('src') }; });
    check(ongletsTel === 0 && vueTel.ouverte && vueTel.bas === vueTel.lecture && /integre=1/.test(vueTel.src || ''),
        `téléphone : Paroles s'ouvre en vue intégrée, jusqu'à la barre de lecture, sans nouvel onglet (${ongletsTel} onglet, ${JSON.stringify(vueTel)})`);
    await ctx.close();

    console.log(`\nErreurs de page : ${erreurs.length}${erreurs.length ? '\n  ' + erreurs.slice(0, 6).join('\n  ') : ''}`);
    check(erreurs.length === 0, 'aucune erreur JavaScript pendant tout le banc');
    await nav.close();
    bilan();
})();
