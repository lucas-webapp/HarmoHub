// Lot 4 de la refonte : octave, renversement et drop directement sous la main.
//
// RETOUR UTILISATEUR : « Lorsque je suis en mode édition, je veux pouvoir rapidement changer une
// octave, un renversement etc... Sans avoir à ouvrir trop de menus. »
//
// MESURÉ AVANT : ces trois réglages vivaient tous dans #advanced-fields, replié par défaut derrière
// le bouton « … ». Monter d'une octave demandait d'ouvrir le bloc, dérouler une liste, choisir — pour
// un réglage qu'on ajuste par tâtonnement, à l'oreille, dix fois de suite.
//
// LA STRATÉGIE, ET CE QU'ELLE OBLIGE À VÉRIFIER. Les <select> d'origine restent la SOURCE DE VÉRITÉ :
// ils gardent leurs identifiants et leurs écouteurs, readChord continue de les lire, et les nouvelles
// commandes se contentent d'écrire dedans puis d'émettre 'change'. C'est ce qui rend le lot sûr —
// mais c'est aussi ce qui rend une commande DÉBRANCHÉE indétectable à l'œil : le bouton s'allume, et
// rien n'arrive dans l'accord. Ce banc éprouve donc systématiquement les DEUX bouts du fil : le
// widget change d'aspect ET la donnée stockée change.
const { chromium, devices } = require('playwright');
const creerHarnais = require('./_harness');
const { plan, check, exiger, bilan } = creerHarnais('Voicing : octave, renversement, drop sous la main');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';

const seed = () => {
    const mk = (r, q, b) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
    const song = {
        id: 'lot4-voicing', name: 'Ballade', bpm: 120, timeSig: '4/4', groove: 'straight',
        // Cmaj7 (quatre notes) puis F majeur (trois notes) : il FAUT les deux pour éprouver le grisage
        // des renversements impossibles.
        sections: [{ title: 'Couplet', chords: [mk('C', 'maj7', 4), mk('F', 'maj', 4)] }],
    };
    localStorage.setItem('harmohubSongs', JSON.stringify([song]));
    localStorage.setItem('harmohubCurrentSongId', song.id);
    localStorage.setItem('myProgression', JSON.stringify({ sections: song.sections }));
};
const accord = (i) => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[i];

// « Visible et cliquable » au sens fort : surface non nulle, dans la fenêtre, et le clic l'atteint
// vraiment. C'est le même critère que le filet du Lot 0 — un bouton recouvert est un bouton absent.
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
    plan(25);
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const erreurs = [];
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', e => erreurs.push('ordinateur : ' + e.message));
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await page.waitForTimeout(300);
    await page.evaluate(seed);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(700);

    console.log('=== A. Sous la main SANS ouvrir le moindre menu ===');
    // Le cœur de la demande. On ne clique sur RIEN avant de mesurer : ni le bouton « … », ni un
    // dépliage quelconque. Et on éprouve les deux modes : préparer un accord compte autant que
    // retoucher un accord posé.
    for (const [etat, preparer] of [['Ajout', () => {}], ['Modification', () => window.app.editChord(0, 0)]]) {
        await page.evaluate(preparer);
        await page.waitForTimeout(350);
        for (const [sel, nom] of [['#octave-value', "la valeur d'octave"], ['[data-octave-step="1"]', "le bouton octave +"],
                                  ['#inversion-seg .voicing-segment', 'les segments de renversement'], ['#drop-seg .voicing-segment', 'les segments de drop']]) {
            const r = await page.evaluate(atteignable, sel);
            check(r.ok, `${etat} : ${nom} — ${r.ok ? r.taille : r.pourquoi}`);
        }
    }
    // Et le bloc « avancé » doit être toujours REPLIÉ : si le lot n'avait fait que l'ouvrir d'office,
    // les vérifications ci-dessus passeraient sans que rien ne soit vraiment résolu.
    check(await page.evaluate(() => document.getElementById('advanced-fields').hidden),
        'le bloc « … » est resté replié : les commandes sont vraiment à la surface, pas juste dépliées d\'office');

    console.log('\n=== B. Les segments sont CONSTRUITS à partir des listes, pas écrits en dur ===');
    // J'ai déjà proposé dans une maquette un « Drop 2+4 » qui n'existe pas, et l'utilisateur l'a
    // relevé (« ça ne veut rien dire »). Une commande qui LIT la liste ne peut pas inventer d'option ;
    // ce banc vérifie qu'elle la lit bien, plutôt que de recopier la même erreur en dur.
    const comptes = await page.evaluate(() => ({
        renvSeg: document.querySelectorAll('#inversion-seg .voicing-segment').length,
        renvOpt: document.getElementById('inversion').options.length,
        dropSeg: document.querySelectorAll('#drop-seg .voicing-segment').length,
        dropOpt: document.getElementById('drop').options.length,
        valeursDrop: [...document.querySelectorAll('#drop-seg .voicing-segment')].map(b => b.dataset.valeur),
        valeursOptDrop: [...document.getElementById('drop').options].map(o => o.value),
    }));
    check(comptes.renvSeg === comptes.renvOpt && comptes.renvSeg > 0,
        `autant de segments de renversement que d'options — ${comptes.renvSeg} pour ${comptes.renvOpt}`);
    check(comptes.dropSeg === comptes.dropOpt && JSON.stringify(comptes.valeursDrop) === JSON.stringify(comptes.valeursOptDrop),
        `les segments de drop reprennent exactement les valeurs de la liste — ${comptes.valeursDrop.join(', ')}`);

    console.log('\n=== C. Les DEUX bouts du fil : le widget ET la donnée ===');
    await page.evaluate(() => window.app.editChord(0, 0));
    await page.waitForTimeout(350);
    const avant = await page.evaluate(accord, 0);

    // Renversement, par un VRAI clic.
    await page.click('#inversion-seg .voicing-segment[data-valeur="2"]');
    await page.waitForTimeout(350);
    const apresRenv = await page.evaluate(accord, 0);
    check(String(apresRenv.inversion) === '2', `le clic sur un segment écrit le renversement dans l'accord — ${avant.inversion} → ${apresRenv.inversion}`);
    check(await page.evaluate(() => document.getElementById('inversion').value) === '2',
        'la liste d\'origine, restée source de vérité, porte bien la même valeur');
    check(await page.evaluate(() => document.querySelector('#inversion-seg .voicing-segment[data-valeur="2"]').classList.contains('active')),
        'et le segment cliqué s\'affiche comme retenu');

    // Ctrl+Z : le chemin d'annulation ne doit rien savoir de la nouvelle commande.
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(350);
    check(String((await page.evaluate(accord, 0)).inversion) === String(avant.inversion),
        `Ctrl+Z reprend le renversement d'avant — ${avant.inversion}`);

    // ON REVIENT EN ÉDITION AVANT DE CONTINUER, et ce n'est pas une formalité : Ctrl+Z fait SORTIR
    // du mode Modification (mesuré — après l'annulation, appMode repasse à « add » et editingIndex à
    // null). C'est un comportement antérieur à ce lot, pas une régression, mais il piège : tout ce
    // qui suivait dans ce banc s'exécutait en mode Ajout, où commitLiveEdit ne fait rien — à juste
    // titre — et les vérifications rougissaient en accusant les nouvelles commandes.
    await page.evaluate(() => window.app.editChord(0, 0));
    await page.waitForTimeout(350);
    exiger(await page.evaluate(() => window.app.appMode === 'edit'), 'retour en Modification après l\'annulation');

    // Drop.
    await page.click('#drop-seg .voicing-segment[data-valeur="drop2"]');
    await page.waitForTimeout(350);
    check((await page.evaluate(accord, 0)).drop === 'drop2',
        `le clic sur un segment écrit le drop dans l'accord — ${(await page.evaluate(accord, 0)).drop}`);

    console.log('\n=== D. Le pas-à-pas d\'octave avance d\'un cran et s\'arrête aux bornes ===');
    const octAvant = +(await page.evaluate(() => document.getElementById('octave').value));
    await page.click('[data-octave-step="1"]');
    await page.waitForTimeout(350);
    const octApres = +(await page.evaluate(() => document.getElementById('octave').value));
    check(octApres === octAvant + 1, `« + » monte d'exactement une octave — ${octAvant} → ${octApres}`);
    check(String((await page.evaluate(accord, 0)).octave) === String(octApres), 'et l\'octave s\'écrit dans l\'accord');
    check(await page.evaluate(() => document.getElementById('octave-value').textContent.trim()) === String(octApres),
        'la valeur affichée suit');

    // Jusqu'à la borne haute, puis on vérifie que le bouton se grise au lieu de dépasser en silence.
    for (let i = 0; i < 6; i++) { 
        const bloque = await page.evaluate(() => document.querySelector('[data-octave-step="1"]').disabled);
        if (bloque) break;
        await page.click('[data-octave-step="1"]');
        await page.waitForTimeout(180);
    }
    const haut = await page.evaluate(() => ({
        val: document.getElementById('octave').value,
        max: Math.max(...[...document.getElementById('octave').options].map(o => +o.value)),
        plusGrise: document.querySelector('[data-octave-step="1"]').disabled,
        moinsGrise: document.querySelector('[data-octave-step="-1"]').disabled,
    }));
    check(String(haut.val) === String(haut.max) && haut.plusGrise && !haut.moinsGrise,
        `arrivé à l'octave la plus haute (${haut.val}/${haut.max}), « + » est grisé et « − » reste actif`);

    console.log('\n=== E. Ce qui est impossible pour CET accord est grisé ===');
    // Le vrai gain sur les listes d'avant : elles offraient les quatre renversements à tous les
    // accords, y compris aux accords de trois notes. Choisir « 3e renv. » sur une triade ne faisait
    // alors rien de visible, la valeur étant ramenée en silence.
    await page.evaluate(() => window.app.editChord(0, 1)); // F majeur : trois notes
    await page.waitForTimeout(400);
    const triade = await page.evaluate(() => [...document.querySelectorAll('#inversion-seg .voicing-segment')].map(b => ({ v: b.dataset.valeur, off: b.disabled })));
    check(triade.length >= 4 && triade[3].off && !triade[2].off,
        `sur une triade, le 3e renversement est grisé et le 2e reste actif — ${triade.map(t => t.v + (t.off ? '(grisé)' : '')).join(' ')}`);

    await page.evaluate(() => window.app.editChord(0, 0)); // Cmaj7 : quatre notes
    await page.waitForTimeout(400);
    const quatre = await page.evaluate(() => [...document.querySelectorAll('#inversion-seg .voicing-segment')].map(b => b.disabled));
    check(quatre.every(x => !x), 'sur un accord de quatre notes, les quatre renversements sont disponibles');

    console.log('\n=== F. Le piège du raccourci Entrée ===');
    // Le raccourci « Entrée depuis un réglage d'accord ajoute l'accord » se décidait sur
    // l'IDENTIFIANT de l'élément ayant le focus (CHORD_PARAM_IDS). Un <button> n'a pas l'identifiant
    // d'un <select> : sans précaution, ce raccourci serait mort en silence dès qu'on clique une des
    // nouvelles commandes avant d'appuyer sur Entrée. Repéré en relisant le code AVANT d'ajouter les
    // boutons — et éprouvé ici avec un VRAI focus et une VRAIE touche.
    await page.evaluate(() => window.app.exitEditMode());
    await page.waitForTimeout(300);
    exiger(await page.evaluate(() => window.app.appMode === 'add'), 'on est bien revenu en mode Ajout');
    const nbAvant = await page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords.length);
    await page.focus('#drop-seg .voicing-segment[data-valeur="drop2"]');
    const cible = await page.evaluate(() => {
        const a = document.activeElement;
        return { tag: a.tagName, param: a.dataset ? a.dataset.chordParam : null };
    });
    check(cible.tag === 'BUTTON' && cible.param === 'drop',
        `le focus est bien sur un BOUTON de réglage d'accord — ${cible.tag}, param « ${cible.param} »`);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    const nbApres = await page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords.length);
    check(nbApres === nbAvant + 1, `Entrée depuis une commande de voicing ajoute bien l'accord — ${nbAvant} → ${nbApres}`);

    console.log('\n=== G. Cliquer une commande ne sort pas du mode Modification ===');
    await page.evaluate(() => window.app.editChord(0, 0));
    await page.waitForTimeout(350);
    await page.click('#inversion-seg .voicing-segment[data-valeur="1"]');
    await page.waitForTimeout(300);
    check(await page.evaluate(() => window.app.appMode === 'edit'),
        'cliquer un segment de renversement ne referme PAS l\'édition en cours');
    await page.close();

    console.log('\n=== H. Téléphone : la rangée tient, et les cibles sont assez grandes ===');
    const ctx = await browser.newContext({ ...devices['iPhone 13'] });
    const m = await ctx.newPage();
    m.on('pageerror', e => erreurs.push('téléphone : ' + e.message));
    await m.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await m.waitForTimeout(300);
    await m.evaluate(seed);
    await m.reload({ waitUntil: 'load' });
    await m.waitForTimeout(700);
    const tel = await m.evaluate(() => {
        const rang = document.getElementById('voicing-row').getBoundingClientRect();
        const carte = document.getElementById('accord-card').getBoundingClientRect();
        const cibles = [...document.querySelectorAll('.voicing-segment, .voicing-step')].map(b => b.getBoundingClientRect());
        return {
            deborde: rang.right > carte.right + 1 || rang.left < carte.left - 1,
            pageDeborde: document.documentElement.scrollWidth > window.innerWidth + 1,
            hauteurMin: Math.round(Math.min(...cibles.map(r => r.height))),
            largeurMin: Math.round(Math.min(...cibles.map(r => r.width))),
            nb: cibles.length,
        };
    });
    check(!tel.deborde && !tel.pageDeborde, 'téléphone : la rangée tient dans la carte, sans débordement de page');
    // 28px : en dessous, une cible devient pénible au doigt. On le mesure au lieu de l'espérer.
    check(tel.hauteurMin >= 28 && tel.largeurMin >= 24,
        `téléphone : les ${tel.nb} cibles font au moins 28px de haut et 24px de large — ${tel.largeurMin}x${tel.hauteurMin} au plus petit`);

    check(erreurs.length === 0, `aucune erreur JavaScript — ${erreurs.join(' | ') || 'aucune'}`);
    await browser.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
