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
            rangeeDuree: dans('lecture-row'),
            sequenceur: dans('arp-sequencer'),
            agrandir: dans('seq-zoom'),
            sources: ['playStyle', 'duration', 'intensity', 'arpPattern'].filter(dans),
            boutonSeq: dans('toggle-sequencer'),
            boutonSeqEntete: (() => { const b = document.getElementById('toggle-sequencer'); return !!b && !!b.closest('.card-head'); })(),
        };
    });
    exiger(a.nbAccord === 1, `il y a exactement une carte Accord — ${a.nbAccord}`);
    check(!a.lecture, 'la carte Lecture n\'existe plus du tout, pas même masquée');
    check(a.rangeeDuree && a.sequenceur && a.agrandir,
        'la rangée de durée, le séquenceur et son bouton « Agrandir » sont dans la carte Accord');
    check(a.sources.length === 4,
        `les quatre champs sources ont suivi — ${a.sources.join(', ') || 'AUCUN'}`);
    check(a.boutonSeq && a.boutonSeqEntete,
        'le bouton du séquenceur est passé dans l\'en-tête, qui est désormais le seul');

    console.log('\n=== B. Ce sont les MÊMES classes, dans la même carte ===');
    // Ce que le banc d'origine éprouvait, et qui garde tout son sens : une ressemblance obtenue en
    // recopiant l'aspect se défait à la première retouche ; une ressemblance obtenue en partageant
    // les classes, non. Désormais les deux rangées sont sœurs, au sens propre.
    const b = await page.evaluate(() => {
        const l = document.getElementById('lecture-row'), v = document.getElementById('voicing-row');
        if (!l || !v) return null;
        const cl = (el, s) => !!el.querySelector(s);
        return {
            memeCarte: !!l.closest('#accord-card') && !!v.closest('#accord-card'),
            memeRangee: l.classList.contains('voicing-row') && v.classList.contains('voicing-row'),
            groupes: cl(l, '.voicing-group') && cl(v, '.voicing-group'),
            etiquettes: cl(l, '.voicing-label') && cl(v, '.voicing-label'),
            segments: cl(v, '.voicing-seg .voicing-segment'),
            nbGroupesVisibles: [...l.querySelectorAll('.voicing-group')].filter(g => g.offsetParent !== null).length,
        };
    });
    exiger(!!b, 'les deux rangées existent');
    check(b.memeCarte, 'elles sont maintenant dans la MÊME carte, plus dans deux cadres séparés');
    check(b.memeRangee && b.groupes && b.etiquettes && b.segments,
        'elles partagent .voicing-row, .voicing-group et .voicing-label — pas une imitation');
    // Un seul groupe reste dans l'ancienne rangée Lecture : c'est précisément ce qui a rendu la
    // fusion évidente.
    check(b.nbGroupesVisibles === 1, `un seul groupe subsiste dans cette rangée : la Durée — ${b.nbGroupesVisibles}`);
    const dessus = await page.evaluate(() => [...document.querySelectorAll('#lecture-row .voicing-group')]
        .filter(g => g.offsetParent !== null).map(g => {
            const lab = g.querySelector('.voicing-label').getBoundingClientRect();
            const ctl = [...g.children].find(c => !c.classList.contains('voicing-label')).getBoundingClientRect();
            // Des boîtes réellement dessinées : sans hauteur, « au-dessus » ne veut rien dire.
            return { t: g.querySelector('.voicing-label').textContent.trim().split(' ')[0],
                     auDessus: lab.height > 0 && ctl.height > 0 && lab.bottom <= ctl.top + 1 };
        }));
    check(dessus.length === 1 && dessus.every(d => d.auDessus),
        `l'étiquette reste au-dessus de sa commande — ${dessus.map(d => d.t).join(', ')}`);

    console.log('\n=== C. Rien ne déborde, et la colonne a maigri ===');
    for (const [w, h] of [[1440, 950], [1024, 768], [768, 900]]) {
        await page.setViewportSize({ width: w, height: h });
        await page.waitForTimeout(400);
        const m = await page.evaluate(() => {
            const row = document.getElementById('lecture-row');
            const carte = document.getElementById('accord-card');
            const coupes = [...document.querySelectorAll('#lecture-row .duration-dd-label')]
                .filter(e => e.offsetParent !== null && e.scrollWidth > e.clientWidth + 1).map(e => e.textContent.trim());
            return { trop: row.scrollWidth - row.clientWidth,
                     carteTrop: carte.scrollWidth - carte.clientWidth,
                     page: document.documentElement.scrollWidth - document.documentElement.clientWidth, coupes };
        });
        check(m.trop <= 0 && m.carteTrop <= 0 && m.page <= 0 && m.coupes.length === 0,
            `${w}px : rangée ${m.trop}px, carte ${m.carteTrop}px, page ${m.page}px, aucun libellé tronqué${m.coupes.length ? ' (' + m.coupes.join(', ') + ')' : ''}`);
    }
    await page.setViewportSize({ width: 1440, height: 950 });
    await page.waitForTimeout(300);
    const hAjout = await page.evaluate(() => Math.round(document.getElementById('accord-card').getBoundingClientRect().height));
    // 297px avant pour les DEUX cartes plus leur écart, mesuré sur ce même écran. On vérifie le GAIN,
    // pas une valeur au pixel près : une retouche de police ferait rougir un banc qui exigerait 227.
    check(hAjout <= 250, `mode Ajout : ${hAjout}px contre 297px pour les deux cartes d'avant`);
    await page.evaluate(() => window.app.editChord(0, 0));
    await page.waitForTimeout(600);
    const hEdit = await page.evaluate(() => ({
        mode: document.body.dataset.appMode,
        h: Math.round(document.getElementById('accord-card').getBoundingClientRect().height),
        visibles: [...document.querySelectorAll('#lecture-row .voicing-group')].filter(g => g.offsetParent !== null).length,
    }));
    check(hEdit.mode === 'edit' && hEdit.visibles === 0 && hEdit.h < hAjout - 30,
        `mode Modification : ${hEdit.visibles} groupe(s) visible(s), la carte tombe à ${hEdit.h}px (contre ${hAjout}px)`);

    console.log('\n=== D. Le séquenceur s\'ouvre toujours, depuis son bouton ===');
    // La cloison a disparu, pas les fonctions. Un vrai clic, pas un appel de méthode.
    const r0 = await page.evaluate(atteignable, '#toggle-sequencer');
    exiger(r0.ok, `le bouton du séquenceur est réellement atteignable — ${r0.ok ? r0.taille : r0.pourquoi}`);
    await page.click('#toggle-sequencer');
    await page.waitForTimeout(900);
    const d = await page.evaluate(() => ({
        ouvert: window.app.seqOpen === true,
        grille: !!document.querySelector('.seq-grid'),
        dansCarte: !!document.querySelector('#accord-card .seq-grid'),
        agrandirVisible: (() => { const z = document.getElementById('seq-zoom'); return !!z && z.offsetParent !== null; })(),
    }));
    check(d.ouvert && d.grille, 'un vrai clic ouvre le séquenceur');
    check(d.dansCarte, 'et il se déploie DANS la carte Accord, là où il a atterri');
    check(d.agrandirVisible, 'le bouton « Agrandir » apparaît avec lui, comme avant');
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
        const row = document.getElementById('lecture-row');
        const carte = document.getElementById('accord-card').getBoundingClientRect();
        const r = row.getBoundingClientRect();
        const cibles = [...document.querySelectorAll('#lecture-row .duration-dd-toggle')]
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
    check(geo.hauteur <= 260, `téléphone : la carte unique fait ${geo.hauteur}px contre 310px pour les deux d'avant`);

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
