// Une seule carte « Accord » : la carte « Lecture » a disparu.
//
// RETOUR UTILISATEUR : « Vu qu'on a bien réduit tout ça, je pense que le volet "Lecture" n'a plus
// trop d'intérêt. Tout regrouper dans un seul volet Accord. Qu'en penses-tu ? »
//
// CE BANC S'APPELAIT lecture_meme_principe_test. Il éprouvait que la carte Lecture avait pris la
// FORME de la carte Accord — mêmes classes, étiquettes au-dessus, rangée compacte — à la demande
// « mets en place le même principe de menu que pour accord au dessus ». Ce travail-là n'est pas
// annulé : il est mené à son terme. Deux cartes qui finissent par se ressembler en tout point, qui
// portent le même liseré de sujet, la même teinte de fond et la même classe subject-existing posée
// sur leur conteneur commun, ne sont pas deux cartes — ce sont deux cadres autour d'un seul sujet.
//
// LES CHIFFRES DONNENT RAISON À L'UTILISATEUR. La carte Lecture portait quatre réglages : le son, le
// rythme, la durée, l'intensité. Trois l'ont quittée en trois lots successifs (menu contextuel,
// Paramètres, réglages du morceau). Il restait un titre, un en-tête, un liseré et une bordure POUR
// UN SEUL RÉGLAGE. Mesuré de haut en bas, les deux cartes plus leur écart :
//     ordinateur, Ajout        297px -> 227px
//     ordinateur, Modification 249px -> 179px
//     téléphone,  Ajout        310px -> 232px
//     téléphone,  Modification 265px -> 184px
//
// CE QUE CE BANC ÉPROUVE. D'abord la disparition elle-même — et surtout que RIEN n'est parti avec la
// cloison : la rangée de durée, les quatre champs sources masqués, la barre du séquenceur et le
// séquenceur doivent tous se retrouver DANS la carte Accord. Une fusion qui laisse un morceau
// derrière ne se voit pas à l'œil : le champ manquant ne casse rien tant qu'on ne le lit pas.
const { chromium, devices } = require('playwright');
const creerHarnais = require('./_harness');
const { plan, check, exiger, bilan } = creerHarnais('Une seule carte Accord');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';

const seed = () => {
    const mk = (r, q, b, x) => Object.assign({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' }, x || {});
    const song = {
        id: 'fusion', name: 'Ballade', bpm: 120, timeSig: '4/4', groove: 'straight',
        sections: [{ title: 'Couplet', chords: [mk('A', 'm6', 8, { intensity: 75 }), mk('C', 'maj7', 4, { intensity: 60 })] }],
    };
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
    plan(27);
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const erreurs = [];
    // LOT 6c : sur ordinateur, la carte Accord n'existe plus qu'en modification — c'est l'inspecteur « son de l'accord », SANS la rangée « quel accord »
    // (fondamentale, type, durée : la bulle). Sa mise en page de carte complète, mode Ajout compris, vit sous le seuil jusqu'au lot 10 : ce banc s'y joue
    // (860px), et vérifie en plus, plus bas, ce que devient la carte sur ordinateur. DETTE : à reprendre au lot 10.
    const page = await browser.newPage({ viewport: { width: 860, height: 950 } });
    page.on('pageerror', e => erreurs.push('ordinateur : ' + e.message));
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await page.waitForTimeout(300);
    await page.evaluate(seed);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(1000);

    console.log('=== A. Il n\'y a plus qu\'une carte, et elle a tout récupéré ===');
    const a = await page.evaluate(() => {
        const dans = (id) => { const e = document.getElementById(id); return !!e && !!e.closest('#accord-card'); };
        return {
            lecture: !!document.getElementById('lecture-card'),
            nbAccord: document.querySelectorAll('#accord-card').length,
            mode: document.body.dataset.appMode,
            // Le déménagement, pièce par pièce. Une fusion qui oublie un champ source ne se voit pas
            // à l'œil : rien ne casse tant que personne ne le lit.
            // La durée n'a plus de rangée : elle est remontée sur la ligne de définition de l'accord
            // (retour utilisateur : « prend trop de place pour rien »). Ce que cette section éprouve
            // reste le même — la fusion n'a rien laissé derrière elle —, on vise juste la commande
            // plutôt que le conteneur qui l'entourait.
            rangeeDuree: dans('duration-dd'),
            sequenceur: !document.getElementById('arp-sequencer'), // A2 (13/11) : le petit séquenceur a quitté la page (il n'y a plus qu'UN séquenceur)
            agrandir: dans('seq-zoom'),
            sources: ['playStyle', 'duration', 'intensity', 'arpPattern'].filter(dans),
            // Le bouton icône remonté ici par la fusion a depuis disparu tout court : la porte de
            // cette carte s'appelle « Séquenceur » et vit juste au-dessus du séquenceur qu'elle ouvre
            // (voir portes_sequenceur_test). Ce que cette section éprouve reste le même : la fusion
            // n'a rien laissé derrière elle.
            boutonSeq: dans('seq-zoom'),
        };
    });
    exiger(a.nbAccord === 1, `il y a exactement une carte Accord — ${a.nbAccord}`);
    check(!a.lecture, 'la carte Lecture n\'existe plus du tout, pas même masquée');
    check(a.rangeeDuree && a.sequenceur && a.agrandir,
        'la durée et la porte « Séquenceur » sont dans la carte Accord, et le petit séquenceur n\'existe plus dans la page');
    check(a.sources.length === 4,
        `les quatre champs sources ont suivi — ${a.sources.join(', ') || 'AUCUN'}`);
    check(a.boutonSeq, 'la porte « Séquenceur » est bien dans la carte Accord');

    console.log('\n=== B. Ce sont les MÊMES classes, dans la même carte ===');
    // Ce que le banc d'origine éprouvait, et qui garde tout son sens : une ressemblance obtenue en
    // recopiant l'aspect se défait à la première retouche ; une ressemblance obtenue en partageant
    // les classes, non. Désormais les deux rangées sont sœurs, au sens propre.
    // IL N'Y A PLUS DEUX RANGÉES À COMPARER. Cette section éprouvait que la rangée Lecture et la
    // rangée de voicing partageaient les MÊMES classes — « même principe », c'était le sujet du lot.
    // La rangée Lecture a fini par disparaître entièrement : son dernier occupant, la durée, est
    // remonté sur la ligne de définition de l'accord. Comparer deux rangées dont une n'existe plus
    // n'éprouve rien ; ce qui reste vrai, et qui était le fond de l'affaire, c'est qu'il n'y a plus
    // qu'UNE grammaire de rangée dans cette carte, et que la durée a bien atterri là où on l'attend.
    const b = await page.evaluate(() => {
        const v = document.getElementById('voicing-row');
        const d = document.getElementById('duration-dd');
        if (!v || !d) return null;
        return {
            ancienneRangee: !!document.getElementById('lecture-row'),
            dureeDansLaLigne: !!d.closest('.accord-grid'),
            ligneDansLaCarte: !!d.closest('#accord-card'),
            voicingGarde: v.classList.contains('voicing-row')
                && !!v.querySelector('.voicing-group') && !!v.querySelector('.voicing-label'),
            segments: !!v.querySelector('.voicing-seg .voicing-segment'),
        };
    });
    exiger(!!b, 'la rangée de voicing et la durée sont là toutes les deux');
    check(!b.ancienneRangee, 'la rangée Lecture a fini par disparaître entièrement, jusqu\'à son cadre');
    check(b.dureeDansLaLigne && b.ligneDansLaCarte,
        'la durée a atterri sur la ligne de définition de l\'accord, dans la carte Accord');
    check(b.voicingGarde && b.segments,
        'la rangée de voicing garde .voicing-row, .voicing-group, .voicing-label et ses segments');
    // Le fond du lot d'origine tient toujours : une seule grammaire de rangée dans cette carte.
    // Deux, ça se met à diverger sans qu'on le voie — c'était l'argument, il n'a pas vieilli.
    const grammaire = await page.evaluate(() =>
        [...document.querySelectorAll('#accord-card .voicing-row')].map(r => r.id || '(sans id)'));
    check(grammaire.length === 1 && grammaire[0] === 'voicing-row',
        `une seule rangée de ce type dans la carte — ${grammaire.join(', ')}`);

    console.log('\n=== C. Rien ne déborde, et la colonne a maigri ===');
    for (const [w, h] of [[1440, 950], [1024, 768], [768, 900]]) {
        await page.setViewportSize({ width: w, height: h });
        await page.waitForTimeout(400);
        const m = await page.evaluate(() => {
            // La rangée surveillée est désormais la LIGNE DE DÉFINITION DE L'ACCORD : c'est elle qui
            // porte la durée depuis qu'elle est remontée, et elle a gagné une troisième colonne — donc
            // trois occasions de déborder là où il n'y en avait que deux. #lecture-row a disparu, et
            // le viser rendait ce banc muet à partir d'ici (mesuré : 10 vérifications sur 21).
            const row = document.querySelector('.accord-grid');
            const carte = document.getElementById('accord-card');
            const coupes = [...document.querySelectorAll('.accord-grid .duration-dd-label')]
                .filter(e => e.offsetParent !== null && e.scrollWidth > e.clientWidth + 1).map(e => e.textContent.trim());
            return { trop: row.scrollWidth - row.clientWidth,
                     carteTrop: carte.scrollWidth - carte.clientWidth,
                     page: document.documentElement.scrollWidth - document.documentElement.clientWidth, coupes };
        });
        check(m.trop <= 0 && m.carteTrop <= 0 && m.page <= 0 && m.coupes.length === 0,
            `${w}px : ligne d'accord ${m.trop}px, carte ${m.carteTrop}px, page ${m.page}px, aucun libellé tronqué${m.coupes.length ? ' (' + m.coupes.join(', ') + ')' : ''}`);
    }
    await page.setViewportSize({ width: 860, height: 950 });
    await page.waitForTimeout(300);
    const hAjout = await page.evaluate(() => Math.round(document.getElementById('accord-card').getBoundingClientRect().height));
    // 297px avant pour les DEUX cartes plus leur écart, mesuré sur ce même écran. On vérifie le GAIN,
    // pas une valeur au pixel près : une retouche de police ferait rougir un banc qui exigerait 266.
    //
    // LE SEUIL A ÉTÉ RELEVÉ DE 250 À 285, ET IL FAUT DIRE POURQUOI. La fusion avait ramené la carte à
    // 227px. Le lot suivant en a repris 39 : la porte « Séquenceur » ne s'affichait qu'une fois le
    // séquenceur DÉJÀ ouvert par un bouton icône, lequel a disparu — elle est donc devenue permanente,
    // et on l'a descendue de 14px pour qu'elle ne colle plus la rangée du dessus (retour utilisateur).
    // C'est un choix, pas une dérive : 266px pour UNE carte contre 297 pour deux, avec un accès nommé
    // toujours sous les yeux au lieu d'un pictogramme qui apparaissait après coup.
    check(hAjout <= 285, `mode Ajout : ${hAjout}px contre 297px pour les deux cartes d'avant`);
    await page.evaluate(() => window.app.editChord(0, 0));
    await page.waitForTimeout(600);
    const hEdit = await page.evaluate(() => ({
        mode: document.body.dataset.appMode,
        h: Math.round(document.getElementById('accord-card').getBoundingClientRect().height),
        dureeVisible: getComputedStyle(document.getElementById('duration-dd')).display !== 'none',
        colonnes: getComputedStyle(document.querySelector('.accord-grid')).gridTemplateColumns.split(' ').length,
    }));
    // LA CARTE NE MAIGRIT PLUS DE 30px EN MODIFICATION, et c'est le résultat attendu du lot qui a
    // remonté la durée : elle n'occupe plus une RANGÉE entière qu'on masquait, mais une colonne. La
    // masquer ne rend donc plus de hauteur — elle rend de la LARGEUR aux deux menus voisins, ce qui
    // est justement ce qu'on cherchait. Exiger encore -30px reviendrait à réclamer la rangée perdue.
    check(hEdit.mode === 'edit' && !hEdit.dureeVisible,
        `mode Modification : la durée s'efface (carte ${hEdit.h}px contre ${hAjout}px en Ajout)`);
    // Et sur ordinateur : la même carte, en modification, est l'inspecteur — la rangée « quel accord » n'y est plus du tout (« rien aux deux endroits »).
    await page.setViewportSize({ width: 1440, height: 950 });
    await page.waitForTimeout(400);
    const bureau = await page.evaluate(() => ({ rangee: getComputedStyle(document.querySelector('.accord-grid')).display, voicing: document.getElementById('voicing-row').getBoundingClientRect().height > 0,
        aDroite: document.querySelector('.sidebar-frame').getBoundingClientRect().left > document.querySelector('.col-right').getBoundingClientRect().left }));
    check(bureau.rangee === 'none' && bureau.voicing && bureau.aDroite, `ordinateur, en modification : la carte est l'inspecteur, à droite, sans la rangée « quel accord » (${JSON.stringify(bureau)})`);
    await page.setViewportSize({ width: 860, height: 950 });
    await page.waitForTimeout(400);

    // RÉÉCRIT AU RETRAIT DE L'ANCIEN SÉQUENCEUR (4c, 12/11) : la porte « Séquenceur » de la carte et le petit séquenceur qu'elle déployait DANS la carte ont
    // disparu (ils restent dans la page, masqués). La fonction, elle, reste : régler le rythme de l'accord, par la porte du séquenceur du téléphone —
    // « Séquenceur » du panneau Lecture —, qui ouvre l'onglet Rythme du panneau d'accord. Un vrai clic, pas un appel de méthode.
    console.log('\n=== D. Le séquenceur s\'ouvre toujours, depuis son bouton ===');
    const vu = (id) => page.evaluate((id) => { const e = document.getElementById(id); return !!e && e.offsetParent !== null && e.getBoundingClientRect().height > 0; }, id);
    check(!(await vu('seq-zoom')) && !(await vu('arp-sequencer')), 'la carte ne montre plus ni la porte « Séquenceur » ni le petit séquenceur');
    await page.click('#bl-plus'); await page.waitForTimeout(400);
    const r0 = await page.evaluate(atteignable, '#pl-notes');
    exiger(r0.ok, `la porte « Séquenceur » du panneau Lecture est réellement atteignable — ${r0.ok ? r0.taille : r0.pourquoi}`);
    await page.click('#pl-notes');
    await page.waitForTimeout(900);
    const d = await page.evaluate(() => ({ rythme: !!(window.app._bulle && window.app._bulle.rythme), dansPanneau: document.getElementById('sequenceur').parentElement.id === 'pa-rythme', cases: document.querySelectorAll('#pa-rythme .sq-case[data-r]').length, ancien: window.app.seqOpen }));
    check(d.rythme && d.dansPanneau && d.cases > 0, `un vrai clic ouvre le séquenceur, dans l'onglet Rythme du panneau d'accord (${JSON.stringify(d)})`);
    check(!d.ancien, 'l\'ancien séquenceur reste fermé');
    await page.close();

    console.log('\n=== E. Téléphone : les mêmes gestes, au doigt ===');
    const ctx = await browser.newContext({ ...devices['iPhone 13'], hasTouch: true });
    const m = await ctx.newPage();
    m.on('pageerror', e => erreurs.push('téléphone : ' + e.message));
    await m.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await m.waitForTimeout(300);
    await m.evaluate(seed);
    await m.reload({ waitUntil: 'load' });
    await m.waitForTimeout(1000);
    await m.evaluate(() => window.app.editChord(0, 0)); // lot 10e : la carte suit un accord ouvert, plus le mode Ajout
    await m.waitForTimeout(500);
    const geo = await m.evaluate(() => {
        // Même déplacement de cible qu'en section C : la durée vit sur la ligne de définition de
        // l'accord, #lecture-row n'existe plus. Au doigt, c'est cette ligne-là qu'il faut mesurer.
        const row = document.querySelector('.accord-grid');
        const carte = document.getElementById('accord-card').getBoundingClientRect();
        const r = row.getBoundingClientRect();
        const cibles = [...document.querySelectorAll('.accord-grid .duration-dd-toggle')]
            .filter(x => x.offsetParent !== null).map(x => x.getBoundingClientRect());
        return { deborde: r.right > carte.right + 1 || row.scrollWidth > row.clientWidth,
                 page: document.documentElement.scrollWidth > window.innerWidth + 1,
                 hMin: cibles.length ? Math.round(Math.min(...cibles.map(x => x.height))) : 0,
                 lMin: cibles.length ? Math.round(Math.min(...cibles.map(x => x.width))) : 0,
                 nb: cibles.length,
                 hauteur: Math.round(carte.height) };
    });
    check(!geo.deborde && !geo.page, 'téléphone : la rangée tient dans la carte, sans débordement de page');
    // Lot 10e : la durée a quitté la carte (elle se règle dans le panneau de l'accord, par − / +) : la carte ouverte en modification ne la porte plus.
    check(geo.nb === 0, `téléphone : la carte ouverte en modification ne porte plus de bouton Durée (${geo.nb}) — elle est dans le panneau`);
    // Même relèvement, même raison qu'en section C : la porte « Séquenceur » est devenue permanente.
    check(geo.hauteur <= 290, `téléphone : la carte unique fait ${geo.hauteur}px contre 310px pour les deux d'avant`);

    // Un vrai appui : un bouton qu'on ne peut atteindre qu'en appelant la fonction derrière n'est pas un bouton (leçon du tiroir du séquenceur).
    // La durée se règle maintenant dans le panneau d'accord, par − / + : on y va par le geste, un toucher sur la case.
    await m.evaluate(() => window.app.exitEditMode());
    await m.evaluate(() => window.scrollTo(0, 0));
    await m.waitForTimeout(400);
    // Point B de la refonte du séquenceur : le premier toucher choisit l'accord, le second (sur la case choisie) ouvre le panneau.
    await m.tap('#progression-sections .grid-cell[data-section="0"][data-index="1"]');
    await m.waitForTimeout(500);
    await m.tap('#progression-sections .grid-cell[data-section="0"][data-index="1"]');
    await m.waitForTimeout(500);
    // Sur cet écran court (664px) le panneau défile : le doigt amène d'abord la durée sous le pouce.
    await m.locator('#pa-quel [data-bulle="duree-plus"]').scrollIntoViewIfNeeded(); await m.waitForTimeout(300);
    const r1 = await m.evaluate(atteignable, '#pa-quel [data-bulle="duree-plus"]');
    exiger(r1.ok, `téléphone : le bouton + de la durée est réellement atteignable — ${r1.ok ? r1.taille : r1.pourquoi}`);
    const beatsAvant = await m.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[1].beats);
    await m.tap('#pa-quel [data-bulle="duree-plus"]');
    await m.waitForTimeout(400);
    const beatsApres = await m.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[1].beats);
    exiger(beatsApres === beatsAvant + 1, `téléphone : un appui sur + allonge l'accord d'un temps — ${beatsAvant} → ${beatsApres}`);
    check(await m.evaluate(() => document.getElementById('duration').value) !== undefined, 'et #duration, la source des prochains accords, reste lisible');

    check(erreurs.length === 0, `aucune erreur JavaScript — ${erreurs.join(' | ') || 'aucune'}`);
    await browser.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
