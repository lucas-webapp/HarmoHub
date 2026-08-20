// Finitions 1-4 : ce qui a été RETIRÉ, et ce que le retrait a rendu possible.
//
// LES QUATRE DEMANDES, DANS LES MOTS DE L'UTILISATEUR :
//
//   1. « Bouton repérer l'accord dans la grille : il ne me servira à rien, tu peux l'enlever ou le
//      remplacer. » → retiré, rien à la place (choix confirmé).
//   2. « Bouton "..." affiche maintenant uniquement une note à la basse = peu d'intérêt, trouver une
//      solution pour ajouter une note à la basse. » puis « Je pense qu'on peut enlever le bouton
//      "..." complètement, afin de mettre directement les accords complexes dans la liste. Il n'y en
//      a pas tant que ça. » → la basse rejoint la rangée voicing, le bouton disparaît, les qualités
//      enrichies deviennent permanentes.
//   3. « RENV. : pour gagner de la place, je propose de ne pas afficher le "F" pour fondamental. Que
//      penses-tu de laisser en surbrillance les 1, 2 ou 3 s'il y a des renversements ? Je pensais
//      enlever les renversements en cliquant à nouveau sur un renversement en surbrillance. »
//   4. « DROP : exactement la même remarque pour l'état initial. Tous les boutons de la ligne
//      pourront être élargis comme cela. »
//
// POURQUOI UN BANC POUR DES SUPPRESSIONS. Une suppression rate de deux façons opposées, et les deux
// sont silencieuses. Trop peu : le bouton part de l'écran mais son code reste, et un jour quelqu'un
// le rebranche. Trop : on emporte au passage une aide partagée avec une autre fonction — c'est
// exactement ce qui m'est arrivé ici, en supprimant `toggleSelectOptions` avec le bouton « … » alors
// que le bouton des MODES s'en servait encore. Le fichier passait `node --check` sans broncher (un
// appel de méthode absente n'est pas une erreur de syntaxe) et l'application ne démarrait plus du
// tout. D'où la section E : on charge la page pour de vrai et on écoute les erreurs.
const { chromium, devices } = require('playwright');
const creerHarnais = require('./_harness');
const { plan, check, exiger, bilan } = creerHarnais('Finitions : retraits, basse en rangée, RENV/DROP à bascule');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';

const seed = () => {
    const mk = (r, q, b, extra) => Object.assign({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' }, extra || {});
    const song = {
        id: 'finitions', name: 'Ballade', bpm: 120, timeSig: '4/4', groove: 'straight',
        sections: [{ title: 'Couplet', chords: [
            mk('C', 'maj7', 4),
            // Un accord qui se servait DÉJÀ de ce que le bouton « … » cachait : qualité enrichie (m7b5)
            // ET basse différente. Avant, l'ouvrir devait « révéler » le mode complexe ; maintenant il
            // doit simplement s'afficher. C'est le cas qui prouve que rien n'a été perdu au passage.
            mk('B', 'm7b5', 4, { bass: 'D', inversion: 1, drop: 'drop2' }),
        ] }],
    };
    localStorage.setItem('harmohubSongs', JSON.stringify([song]));
    localStorage.setItem('harmohubCurrentSongId', song.id);
    localStorage.setItem('myProgression', JSON.stringify({ sections: song.sections }));
};
const accord = (i) => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[i];

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
    plan(26);
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const erreurs = [];
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', e => erreurs.push('ordinateur : ' + e.message));
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await page.waitForTimeout(300);
    await page.evaluate(seed);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(800);

    console.log('=== A. Points 1 et 2 : les deux boutons sont partis, code compris ===');
    const partis = await page.evaluate(() => ({
        goto: !document.getElementById('accord-goto'),
        troisPoints: !document.getElementById('toggle-complex-quality'),
        bloc: !document.getElementById('advanced-fields'),
        // Les méthodes qui n'existaient QUE pour ces boutons doivent partir avec eux : un bouton
        // retiré de l'écran dont le code reste est un bouton qui reviendra.
        methodes: ['goToEditedChord', 'applyCellFlash', 'activateMoreOptions', 'revealComplexQualityIfNeeded', 'revealAdvancedIfNeeded']
            .filter(m => typeof window.app[m] === 'function'),
    }));
    check(partis.goto, 'le bouton « repérer l\'accord dans la grille » n\'est plus dans la page');
    check(partis.troisPoints && partis.bloc, 'le bouton « … » et le bloc qu\'il dépliait ne sont plus dans la page');
    check(partis.methodes.length === 0, `et leur code est parti avec eux — ${partis.methodes.join(', ') || 'aucune méthode orpheline'}`);

    // L'inverse du même piège : ce qui SERT ENCORE ailleurs ne doit pas avoir été emporté. Le bouton
    // des modes (carte Morceau) partage `toggleSelectOptions` avec l'ancien bouton « … ».
    const gardes = await page.evaluate(() => ({
        aide: typeof window.app.toggleSelectOptions === 'function',
        modes: typeof window.app.revealComplexModeIfNeeded === 'function',
        bouton: !!document.getElementById('toggle-complex-mode'),
    }));
    check(gardes.aide && gardes.modes && gardes.bouton,
        'ce que le bouton des MODES partageait avec lui est resté en place (toggleSelectOptions, revealComplexModeIfNeeded)');

    console.log('\n=== B. Point 2 : les qualités enrichies sont dans la liste, sans rien déplier ===');
    const qualites = await page.evaluate(() => {
        const q = document.getElementById('quality');
        return { valeurs: [...q.options].map(o => o.value), cachees: q.querySelectorAll('option[hidden], option.opt-complex').length };
    });
    for (const v of ['6', 'm6', 'dim', 'dim7', 'm7b5', 'aug']) {
        check(qualites.valeurs.includes(v), `« ${v} » est proposée d\'emblée dans la liste des qualités`);
    }
    check(qualites.cachees === 0, `aucune qualité n\'est masquée — ${qualites.cachees} option(s) cachée(s)`);

    console.log('\n=== C. Point 2 : la basse vit dans la rangée voicing, et elle est branchée ===');
    await page.evaluate(() => window.app.editChord(0, 0));
    await page.waitForTimeout(400);
    const place = await page.evaluate(() => {
        const b = document.getElementById('bass');
        return { dansRangee: !!(b && b.closest('#voicing-row')), etiquette: document.getElementById('bass-label') ? document.getElementById('bass-label').textContent.trim() : null };
    });
    check(place.dansRangee, 'le menu de basse est bien dans #voicing-row, à côté d\'octave/renversement/drop');
    const rBasse = await page.evaluate(atteignable, '#bass');
    check(rBasse.ok, `et il est atteignable sans ouvrir le moindre menu — ${rBasse.ok ? rBasse.taille : rBasse.pourquoi}`);
    // Branché aux DEUX bouts : on écrit dans la liste comme le ferait un choix, et la donnée doit suivre.
    await page.selectOption('#bass', 'G');
    await page.waitForTimeout(400);
    check((await page.evaluate(accord, 0)).bass === 'G', `choisir une basse l\'écrit dans l\'accord — ${(await page.evaluate(accord, 0)).bass}`);
    // Les options ne redisent plus « Basse » : l'étiquette du groupe le dit déjà une fois.
    const libelles = await page.evaluate(() => [...document.getElementById('bass').options].map(o => o.textContent.trim()));
    check(place.etiquette === 'Basse' && !libelles.some(t => /^Basse /.test(t)),
        `le mot « Basse » est écrit une seule fois, sur l\'étiquette — options : ${libelles.slice(0, 4).join(', ')}…`);

    console.log('\n=== D. Points 3 et 4 : l\'état initial n\'a pas de bouton, et le clic bascule ===');
    // On repart d'un accord propre (fondamentale, sans drop).
    await page.evaluate(() => window.app.editChord(0, 0));
    await page.waitForTimeout(400);
    const etiquettes = await page.evaluate(() => ({
        renv: [...document.querySelectorAll('#inversion-seg .voicing-segment')].map(b => b.textContent.trim()),
        drop: [...document.querySelectorAll('#drop-seg .voicing-segment')].map(b => b.textContent.trim()),
        renvAllumes: document.querySelectorAll('#inversion-seg .voicing-segment.active').length,
        dropAllumes: document.querySelectorAll('#drop-seg .voicing-segment.active').length,
    }));
    check(JSON.stringify(etiquettes.renv) === '["1","2","3"]', `RENV. affiche 1/2/3 et plus de « F » — ${etiquettes.renv.join(' ')}`);
    check(JSON.stringify(etiquettes.drop) === '["2","3"]', `DROP affiche 2/3 et plus de « — » — ${etiquettes.drop.join(' ')}`);
    check(etiquettes.renvAllumes === 0 && etiquettes.dropAllumes === 0,
        'sur un accord sans renversement ni drop, AUCUN bouton n\'est allumé : c\'est ça, l\'état initial');

    // Aller : un clic allume et applique.
    await page.click('#inversion-seg .voicing-segment[data-valeur="2"]');
    await page.waitForTimeout(400);
    check(String((await page.evaluate(accord, 0)).inversion) === '2'
        && await page.evaluate(() => document.querySelector('#inversion-seg .voicing-segment[data-valeur="2"]').classList.contains('active')),
        'un clic pose le 2e renversement et allume son bouton');
    // Retour : re-cliquer le bouton ALLUMÉ revient à la fondamentale. C'est la demande exacte
    // (« enlever les renversements en cliquant à nouveau sur un renversement en surbrillance »), et
    // c'est ce que l'ancienne liste ne savait pas faire.
    await page.click('#inversion-seg .voicing-segment[data-valeur="2"]');
    await page.waitForTimeout(400);
    const retour = await page.evaluate(() => ({
        data: JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[0].inversion,
        select: document.getElementById('inversion').value,
        allumes: document.querySelectorAll('#inversion-seg .voicing-segment.active').length,
    }));
    check(String(retour.data) === '0' && retour.select === '0' && retour.allumes === 0,
        `re-cliquer le bouton allumé retire le renversement — accord : ${retour.data}, boutons allumés : ${retour.allumes}`);

    // Même chose pour le drop.
    await page.click('#drop-seg .voicing-segment[data-valeur="drop2"]');
    await page.waitForTimeout(400);
    exiger((await page.evaluate(accord, 0)).drop === 'drop2', 'le drop 2 s\'est bien appliqué avant d\'éprouver le retour');
    await page.click('#drop-seg .voicing-segment[data-valeur="drop2"]');
    await page.waitForTimeout(400);
    const retourDrop = await page.evaluate(() => ({
        data: JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[0].drop,
        allumes: document.querySelectorAll('#drop-seg .voicing-segment.active').length,
    }));
    check(retourDrop.data === 'none' && retourDrop.allumes === 0,
        `re-cliquer le drop allumé revient à « sans drop » — accord : ${retourDrop.data}`);

    // L'infobulle doit ANNONCER la bascule, sinon le second clic est une trouvaille et non une commande.
    await page.click('#inversion-seg .voicing-segment[data-valeur="1"]');
    await page.waitForTimeout(350);
    const bulle = await page.evaluate(() => {
        const b = document.querySelector('#inversion-seg .voicing-segment[data-valeur="1"]');
        const autre = document.querySelector('#inversion-seg .voicing-segment[data-valeur="3"]');
        return { actif: b.title, inactif: autre.title };
    });
    check(/cliquer pour revenir/i.test(bulle.actif) && !/cliquer pour revenir/i.test(bulle.inactif),
        `l\'infobulle du bouton allumé annonce le retour — « ${bulle.actif} »`);

    console.log('\n=== E. Un accord qui se servait de ce qui était caché s\'ouvre tel quel ===');
    // Le cas qui prouve qu'on n'a rien perdu : qualité enrichie + basse + renversement + drop, tous
    // enregistrés, tous à relire sans le moindre dépliage.
    await page.evaluate(() => window.app.editChord(0, 1));
    await page.waitForTimeout(500);
    const relu = await page.evaluate(() => ({
        quality: document.getElementById('quality').value,
        bass: document.getElementById('bass').value,
        inversion: document.getElementById('inversion').value,
        drop: document.getElementById('drop').value,
        renvAllume: document.querySelector('#inversion-seg .voicing-segment.active') ? document.querySelector('#inversion-seg .voicing-segment.active').dataset.valeur : null,
        dropAllume: document.querySelector('#drop-seg .voicing-segment.active') ? document.querySelector('#drop-seg .voicing-segment.active').dataset.valeur : null,
    }));
    check(relu.quality === 'm7b5' && relu.bass === 'D' && relu.inversion === '1' && relu.drop === 'drop2',
        `Bm7b5/D, 1er renversement, drop 2 : les quatre réglages sont relus — ${JSON.stringify(relu)}`);
    check(relu.renvAllume === '1' && relu.dropAllume === 'drop2',
        'et les boutons correspondants sont allumés, sans qu\'on ait rien déplié');

    console.log('\n=== F. La rangée tient sur toutes les largeurs éprouvées ===');
    // Le padding fixe que j'avais posé d'abord faisait déborder la rangée de 10px sur ordinateur et de
    // 46px sur un téléphone de 360px. Mesurer, plutôt que regarder une seule largeur.
    for (const [w, h] of [[1440, 900], [1024, 768], [768, 900]]) {
        await page.setViewportSize({ width: w, height: h });
        await page.waitForTimeout(350);
        const m = await page.evaluate(() => {
            const row = document.getElementById('voicing-row');
            const cibles = [...document.querySelectorAll('.voicing-segment, .voicing-step')].map(b => b.getBoundingClientRect());
            return { trop: row.scrollWidth - row.clientWidth, pageTrop: document.documentElement.scrollWidth - document.documentElement.clientWidth,
                     larg: Math.round(Math.min(...cibles.map(r => r.width))) };
        });
        check(m.trop <= 0 && m.pageTrop <= 0 && m.larg >= 24,
            `${w}px : la rangée ne déborde pas (${m.trop}px) et le plus petit bouton fait ${m.larg}px`);
    }
    await page.close();

    console.log('\n=== G. Téléphone : les mêmes gestes, au doigt ===');
    const ctx = await browser.newContext({ ...devices['iPhone 13'], hasTouch: true });
    const m = await ctx.newPage();
    m.on('pageerror', e => erreurs.push('téléphone : ' + e.message));
    await m.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await m.waitForTimeout(300);
    await m.evaluate(seed);
    await m.reload({ waitUntil: 'load' });
    await m.waitForTimeout(900);
    await m.evaluate(() => window.app.editChord(0, 0));
    await m.waitForTimeout(600);

    const geo = await m.evaluate(() => {
        const row = document.getElementById('voicing-row');
        const carte = document.getElementById('accord-card').getBoundingClientRect();
        const r = row.getBoundingClientRect();
        const cibles = [...document.querySelectorAll('.voicing-segment, .voicing-step')].map(b => b.getBoundingClientRect());
        const basse = document.getElementById('bass');
        return {
            deborde: r.right > carte.right + 1 || r.left < carte.left - 1 || row.scrollWidth > row.clientWidth,
            basseDeborde: basse.scrollWidth > basse.clientWidth,
            pageDeborde: document.documentElement.scrollWidth > window.innerWidth + 1,
            hMin: Math.round(Math.min(...cibles.map(x => x.height))),
            lMin: Math.round(Math.min(...cibles.map(x => x.width))),
            hBasse: Math.round(basse.getBoundingClientRect().height),
        };
    });
    check(!geo.deborde && !geo.basseDeborde && !geo.pageDeborde,
        'téléphone : ni la rangée ni le menu de basse ne débordent de leur case');
    check(geo.hBasse === geo.hMin,
        `téléphone : le menu de basse a la même hauteur que les boutons — ${geo.hBasse}px contre ${geo.hMin}px`);
    check(geo.lMin >= 24 && geo.hMin >= 28,
        `téléphone : la plus petite cible fait ${geo.lMin}x${geo.hMin}px`);

    // La bascule, au VRAI doigt : un bouton qu'on ne peut atteindre qu'en appelant sa méthode n'est
    // pas un bouton. Leçon retenue du tiroir du séquenceur, que l'utilisateur n'arrivait plus à fermer
    // alors que le banc, lui, le fermait par window.app.toggleSequencer.
    // On amène d'abord le bouton dans la fenêtre, comme le ferait un doigt qui fait défiler la page :
    // la carte Accord vit SOUS la grille sur téléphone, la rangée voicing tombe donc naturellement un
    // peu plus bas que le pli (mesuré : 666px sur une fenêtre de 659px). Ce qu'on éprouve ici n'est
    // pas « visible d'emblée » — ce serait une autre demande — mais « ATTEIGNABLE » : après défilement,
    // le bouton est bien dans la fenêtre ET c'est bien lui que le doigt touche à cet endroit. C'est
    // exactement ce qui manquait au tiroir du séquenceur, dont le bouton de fermeture était à 838px
    // d'une fenêtre de 664px qu'AUCUN défilement n'atteignait, pendant que le banc le fermait par
    // window.app.toggleSequencer et voyait tout en vert.
    await m.evaluate(() => document.querySelector('#drop-seg .voicing-segment[data-valeur="drop2"]').scrollIntoView({ block: 'center' }));
    await m.waitForTimeout(400);
    const r1 = await m.evaluate(atteignable, '#drop-seg .voicing-segment[data-valeur="drop2"]');
    exiger(r1.ok, `téléphone : le bouton drop 2 est atteignable après défilement — ${r1.ok ? r1.taille : r1.pourquoi}`);
    await m.tap('#drop-seg .voicing-segment[data-valeur="drop2"]');
    await m.waitForTimeout(500);
    check((await m.evaluate(accord, 0)).drop === 'drop2', 'téléphone : un vrai appui pose le drop 2');
    await m.tap('#drop-seg .voicing-segment[data-valeur="drop2"]');
    await m.waitForTimeout(500);
    check((await m.evaluate(accord, 0)).drop === 'none', 'téléphone : un second appui sur le même bouton le retire');

    check(erreurs.length === 0, `aucune erreur JavaScript — ${erreurs.join(' | ') || 'aucune'}`);
    await browser.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
