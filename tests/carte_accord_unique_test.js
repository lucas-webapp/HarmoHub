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
    plan(21);
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const erreurs = [];
    const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
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
            sequenceur: dans('arp-sequencer'),
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
        'la durée, le séquenceur et sa porte « Séquenceur » sont dans la carte Accord');
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
    await page.setViewportSize({ width: 1440, height: 950 });
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
    check(hEdit.mode === 'edit' && !hEdit.dureeVisible && hEdit.colonnes === 2,
        `mode Modification : la durée s'efface, la ligne repasse à ${hEdit.colonnes} colonnes (carte ${hEdit.h}px contre ${hAjout}px en Ajout)`);

    console.log('\n=== D. Le séquenceur s\'ouvre toujours, depuis son bouton ===');
    // La cloison a disparu, pas les fonctions. Un vrai clic, pas un appel de méthode.
    const r0 = await page.evaluate(atteignable, '#seq-zoom');
    exiger(r0.ok, `la porte « Séquenceur » est réellement atteignable — ${r0.ok ? r0.taille : r0.pourquoi}`);
    await page.click('#seq-zoom');
    await page.waitForTimeout(900);
    // Elle ouvre ET agrandit : on referme le plein écran pour mesurer le séquenceur là où il vit
    // normalement, c'est-à-dire dans la carte — ce que la vérification suivante éprouve.
    await page.evaluate(() => window.app.closeSeqZoom());
    await page.waitForTimeout(600);
    const d = await page.evaluate(() => ({
        ouvert: window.app.seqOpen === true,
        grille: !!document.querySelector('.seq-grid'),
        dansCarte: !!document.querySelector('#accord-card .seq-grid'),
        agrandirVisible: (() => { const z = document.getElementById('seq-zoom'); return !!z && z.offsetParent !== null; })(),
    }));
    check(d.ouvert && d.grille, 'un vrai clic ouvre le séquenceur');
    check(d.dansCarte, 'et il se déploie DANS la carte Accord, là où il a atterri');
    check(d.agrandirVisible, 'la porte « Séquenceur » reste visible, séquenceur ouvert');
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
    check(geo.nb === 1 && geo.hMin >= 28 && geo.lMin >= 20,
        `téléphone : la cible restante fait ${geo.lMin}x${geo.hMin}`);
    // Même relèvement, même raison qu'en section C : la porte « Séquenceur » est devenue permanente.
    check(geo.hauteur <= 290, `téléphone : la carte unique fait ${geo.hauteur}px contre 310px pour les deux d'avant`);

    // Un vrai appui : un bouton qu'on ne peut atteindre qu'en appelant la fonction derrière n'est pas
    // un bouton (leçon du tiroir du séquenceur).
    await m.evaluate(() => document.getElementById('accord-card').scrollIntoView({ block: 'center' }));
    await m.waitForTimeout(400);
    const r1 = await m.evaluate(atteignable, '#duration-dd-toggle');
    exiger(r1.ok, `téléphone : le bouton Durée est réellement atteignable — ${r1.ok ? r1.taille : r1.pourquoi}`);
    await m.tap('#duration-dd-toggle');
    await m.waitForTimeout(400);
    const cible = await m.evaluate(() => {
        const actuel = document.getElementById('duration').value;
        const autre = [...document.querySelectorAll('.duration-dd-item')].find(i => i.dataset.beats !== actuel);
        return autre ? autre.dataset.beats : null;
    });
    exiger(!!cible, 'téléphone : une autre durée que celle en place est proposée');
    await m.tap(`.duration-dd-item[data-beats="${cible}"]`);
    await m.waitForTimeout(400);
    const pose = await m.evaluate(() => ({
        valeur: document.getElementById('duration').value,
        ferme: document.getElementById('duration-dd-menu').hidden,
    }));
    check(pose.valeur === cible && pose.ferme,
        `téléphone : deux appuis posent la durée dans #duration — « ${pose.valeur} », menu ${pose.ferme ? 'refermé' : 'RESTÉ OUVERT'}`);

    check(erreurs.length === 0, `aucune erreur JavaScript — ${erreurs.join(' | ') || 'aucune'}`);
    await browser.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
