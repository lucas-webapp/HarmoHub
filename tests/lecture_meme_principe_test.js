// La carte Lecture prend la même forme que la carte Accord.
//
// RETOUR UTILISATEUR : « Le panneau lecture n'est pas harmonieux non plus, mets en place le même
// principe de menu que pour accord au dessus. Tu peux définir 5 niveaux d'intensité au lieu de la
// barre si tu veux gagner de la place. »
//
// MESURÉ AVANT : la carte empilait trois rangées de formes différentes — deux gros boutons de poids
// inégaux, puis une barre de réglage avec son étiquette à GAUCHE et son nombre à droite. Aucune ne
// suivait la mise en page de la carte au-dessus (étiquettes minuscules AU-DESSUS, commandes
// compactes sur UNE rangée). Hauteur : 160px sur ordinateur, 182px sur téléphone.
//
// CE QUE CE BANC ÉPROUVE, ET POURQUOI. « Le même principe » n'est pas une impression : c'est
// vérifiable. Les deux rangées doivent porter les MÊMES classes (section A) — si un jour quelqu'un
// recopie l'aspect au lieu de réutiliser les classes, les deux cartes se remettront à diverger sans
// que rien ne le dise. Et comme pour la rangée de voicing, une commande débranchée est invisible à
// l'œil : le bouton s'allume et rien n'arrive dans l'accord. On éprouve donc systématiquement les
// deux bouts du fil.
//
// EN MODE AJOUT, ET C'EST VOULU. Ce banc n'ouvre AUCUN accord. Depuis que Rythme et Durée sont
// cachés en mode Modification (retour utilisateur : « je ne me servirai pas souvent de ces options
// de lecture… vu que je modifie plus rapidement le séquenceur »), les mesurer après un editChord
// revenait à mesurer des boîtes en display:none : largeur 0, hauteur 0, étiquette « au-dessus » de
// rien du tout. Toutes les vérifications de forme passaient au vert sans rien éprouver. On mesure
// donc là où la rangée est réellement affichée, et la section G vérifie séparément qu'elle
// disparaît bien en mode Modification.
const { chromium, devices } = require('playwright');
const creerHarnais = require('./_harness');
const { plan, check, exiger, bilan } = creerHarnais('Carte Lecture : même principe que la carte Accord');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';

const seed = () => {
    const mk = (r, q, b, x) => Object.assign({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' }, x || {});
    const song = {
        id: 'lecture', name: 'Ballade', bpm: 120, timeSig: '4/4', groove: 'straight',
        sections: [{ title: 'Couplet', chords: [
            mk('A', 'm6', 8, { intensity: 75 }),
            mk('C', 'maj7', 4, { intensity: 60 }),
        ] }],
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
    plan(19);   // quatre familles sont parties dans intensite_reparee_test.js, voir plus bas
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const erreurs = [];
    const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
    page.on('pageerror', e => erreurs.push('ordinateur : ' + e.message));
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await page.waitForTimeout(300);
    await page.evaluate(seed);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(900);

    console.log('=== A. Ce sont les MÊMES classes, pas une imitation ===');
    // Le cœur de la demande. Une ressemblance obtenue en recopiant l'aspect se défait à la première
    // retouche de l'une des deux cartes ; une ressemblance obtenue en partageant les classes, non.
    const partage = await page.evaluate(() => {
        const l = document.getElementById('lecture-row'), v = document.getElementById('voicing-row');
        if (!l || !v) return null;
        const cl = (el, s) => !!el.querySelector(s);
        return {
            mode: document.body.dataset.appMode,
            memeRangee: l.classList.contains('voicing-row') && v.classList.contains('voicing-row'),
            groupes: cl(l, '.voicing-group') && cl(v, '.voicing-group'),
            etiquettes: cl(l, '.voicing-label') && cl(v, '.voicing-label'),
            // La rangée Lecture n'a plus de segments à elle (ils étaient ceux de l'intensité) : ce
            // qu'on vérifie est qu'elle partage bien les classes de STRUCTURE avec celle du dessus.
            segments: cl(v, '.voicing-seg .voicing-segment'),
            nbGroupesVisibles: [...l.querySelectorAll('.voicing-group')].filter(g => g.offsetParent !== null).length,
        };
    });
    exiger(!!partage, 'les deux rangées existent');
    exiger(partage.mode === 'add', `le banc mesure en mode Ajout, là où la rangée s'affiche — mode « ${partage.mode} »`);
    check(partage.memeRangee, 'la rangée Lecture EST une .voicing-row, comme celle de la carte Accord');
    check(partage.groupes && partage.etiquettes && partage.segments,
        'elle réutilise .voicing-group et .voicing-label, et la rangée du dessus garde ses segments');
    // UN SEUL groupe désormais. La rangée en portait trois : l'intensité est partie au menu
    // contextuel de l'accord, le rythme aux Paramètres. Il ne reste que la Durée — et c'est
    // précisément ce qui rend la question du Lot 4 légitime : une carte pour un seul réglage.
    check(partage.nbGroupesVisibles === 1, `un seul groupe étiqueté et visible : la Durée — ${partage.nbGroupesVisibles}`);
    // Et les deux formes d'avant ne doivent plus exister : les laisser en place, c'est laisser
    // quelqu'un les rebrancher un jour.
    const parties = await page.evaluate(() => ({
        selectGroup: !document.querySelector('.select-group'),
        intensityRow: !document.querySelector('.intensity-row'),
        barreVisible: (() => { const i = document.getElementById('intensity'); return !!i && i.offsetParent === null; })(),
    }));
    check(parties.selectGroup && parties.intensityRow, 'les deux anciennes rangées (.select-group, .intensity-row) ont disparu');
    check(parties.barreVisible, 'la barre #intensity est restée dans le DOM mais masquée : c\'est elle la source de vérité');

    console.log('\n=== B. Les étiquettes sont AU-DESSUS, comme dans la carte Accord ===');
    // C'est ce qui fait qu'elles ne coûtent rien en largeur — et c'est le détail qui rendait la carte
    // Lecture différente : son « Intensité » était à gauche de la barre, sur la même ligne.
    const dessus = await page.evaluate(() => [...document.querySelectorAll('#lecture-row .voicing-group')]
        .filter(g => g.offsetParent !== null).map(g => {
            const lab = g.querySelector('.voicing-label').getBoundingClientRect();
            const ctl = [...g.children].find(c => !c.classList.contains('voicing-label')).getBoundingClientRect();
            // Des boîtes réellement dessinées : sans hauteur, « au-dessus » ne veut rien dire.
            return { t: g.querySelector('.voicing-label').textContent.trim().split(' ')[0],
                     auDessus: lab.height > 0 && ctl.height > 0 && lab.bottom <= ctl.top + 1 };
        }));
    check(dessus.length === 1 && dessus.every(d => d.auDessus),
        `l'étiquette est au-dessus de sa commande — ${dessus.map(d => d.t).join(', ')}`);
    // ============================================================
    // SECTIONS C À F DÉPLACÉES, PAS SUPPRIMÉES.
    // ============================================================
    // Elles éprouvaient les cinq niveaux d'intensité, leur câblage, le sort d'une valeur héritée et la
    // place du mode studio. L'intensité a depuis quitté la carte pour le menu contextuel d'un accord
    // (retour utilisateur : « Pas besoin de tout le temps le laisser afficher, c'est une option pour
    // affiner le morceau seulement. À cacher. ») et le mode studio l'a suivie dans la barre d'outils du
    // séquenceur. Ces quatre familles vivent désormais dans intensite_reparee_test.js, qui les éprouve
    // à leur nouvelle adresse ET vérifie en plus le défaut qui les a fait bouger : trois des cinq
    // niveaux donnaient la même vélocité sur un accord tenu.
    // Ce banc-ci garde ce qui lui appartient : la FORME de la rangée.

    console.log('\n=== G. Rien ne déborde, et la carte a maigri ===');
    for (const [w, h] of [[1440, 950], [1024, 768], [768, 900]]) {
        await page.setViewportSize({ width: w, height: h });
        await page.waitForTimeout(400);
        const m = await page.evaluate(() => {
            const row = document.getElementById('lecture-row');
            const coupes = [...document.querySelectorAll('#lecture-row .duration-dd-label, #lecture-row .playstyle-dd-label')]
                .filter(e => e.offsetParent !== null && e.scrollWidth > e.clientWidth + 1).map(e => e.textContent.trim());
            return { trop: row.scrollWidth - row.clientWidth,
                     page: document.documentElement.scrollWidth - document.documentElement.clientWidth, coupes };
        });
        check(m.trop <= 0 && m.page <= 0 && m.coupes.length === 0,
            `${w}px : rangée ${m.trop}px, page ${m.page}px, aucun libellé tronqué${m.coupes.length ? ' (' + m.coupes.join(', ') + ')' : ''}`);
    }
    await page.setViewportSize({ width: 1440, height: 950 });
    await page.waitForTimeout(300);
    const hAjout = await page.evaluate(() => Math.round(document.getElementById('lecture-card').getBoundingClientRect().height));
    // 160px avant, mesuré sur ce même écran. On vérifie le GAIN, pas une valeur au pixel près : une
    // retouche de police ou d'espacement ferait rougir un banc qui exigerait exactement 122.
    check(hAjout <= 140, `mode Ajout : ${hAjout}px contre 160px avant (mesuré sur le même écran)`);
    // Et en mode Modification la rangée s'efface entièrement : la carte doit vraiment rétrécir, pas
    // garder un trou de la taille des boutons disparus.
    await page.evaluate(() => window.app.editChord(0, 0));
    await page.waitForTimeout(600);
    const hEdit = await page.evaluate(() => ({
        mode: document.body.dataset.appMode,
        h: Math.round(document.getElementById('lecture-card').getBoundingClientRect().height),
        visibles: [...document.querySelectorAll('#lecture-row .voicing-group')].filter(g => g.offsetParent !== null).length,
    }));
    check(hEdit.mode === 'edit' && hEdit.visibles === 0 && hEdit.h < hAjout - 30,
        `mode Modification : ${hEdit.visibles} groupe(s) visible(s) et la carte tombe à ${hEdit.h}px (contre ${hAjout}px)`);
    await page.close();

    console.log('\n=== H. Téléphone : les mêmes gestes, au doigt ===');
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
        const carte = document.getElementById('lecture-card').getBoundingClientRect();
        const r = row.getBoundingClientRect();
        const cibles = [...document.querySelectorAll('#lecture-row .playstyle-dd-toggle, #lecture-row .duration-dd-toggle')]
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
        `téléphone : la cible restante fait au moins 28px de haut et 20px de large — ${geo.lMin}x${geo.hMin}`);
    check(geo.hauteur <= 150, `téléphone : la carte fait ${geo.hauteur}px contre 182px avant`);

    // Un vrai appui, pas un appel de méthode : un bouton qu'on ne peut atteindre qu'en appelant la
    // fonction derrière n'est pas un bouton (leçon du tiroir du séquenceur, que l'utilisateur
    // n'arrivait plus à fermer alors que le banc, lui, le fermait par window.app.toggleSequencer).
    await m.evaluate(() => document.getElementById('lecture-card').scrollIntoView({ block: 'center' }));
    await m.waitForTimeout(400);
    // L'appui portait sur le bouton Rythme jusqu'à ce qu'il quitte la carte. Il se reporte sur la
    // Durée, seule commande restante : la vérification garde exactement le même sens — un bouton
    // qu'on ne peut atteindre qu'en appelant la fonction derrière n'est pas un bouton.
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
    // La source de vérité, et non l'étiquette du bouton : c'est #duration que lit readChord().
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
