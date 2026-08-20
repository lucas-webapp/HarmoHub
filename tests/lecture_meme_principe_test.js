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
const { chromium, devices } = require('playwright');
const creerHarnais = require('./_harness');
const { plan, check, exiger, bilan } = creerHarnais('Carte Lecture : même principe que la carte Accord');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';

const seed = () => {
    const mk = (r, q, b, x) => Object.assign({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' }, x || {});
    const song = {
        id: 'lecture', name: 'Ballade', bpm: 120, timeSig: '4/4', groove: 'straight',
        sections: [{ title: 'Couplet', chords: [
            mk('A', 'm6', 8, { intensity: 75 }),   // pile sur un niveau
            // Intensité qui ne tombe sur AUCUN des cinq niveaux : le cas des morceaux écrits AVANT ce
            // changement. Il ne doit être ni réécrit en silence, ni affiché comme s'il était exact.
            mk('C', 'maj7', 4, { intensity: 60 }),
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
    const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
    page.on('pageerror', e => erreurs.push('ordinateur : ' + e.message));
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await page.waitForTimeout(300);
    await page.evaluate(seed);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(900);
    await page.evaluate(() => window.app.editChord(0, 0));
    await page.waitForTimeout(600);

    console.log('=== A. Ce sont les MÊMES classes, pas une imitation ===');
    // Le cœur de la demande. Une ressemblance obtenue en recopiant l'aspect se défait à la première
    // retouche de l'une des deux cartes ; une ressemblance obtenue en partageant les classes, non.
    const partage = await page.evaluate(() => {
        const l = document.getElementById('lecture-row'), v = document.getElementById('voicing-row');
        if (!l || !v) return null;
        const cl = (el, s) => !!el.querySelector(s);
        return {
            memeRangee: l.classList.contains('voicing-row') && v.classList.contains('voicing-row'),
            groupes: cl(l, '.voicing-group') && cl(v, '.voicing-group'),
            etiquettes: cl(l, '.voicing-label') && cl(v, '.voicing-label'),
            segments: cl(l, '.voicing-seg .voicing-segment') && cl(v, '.voicing-seg .voicing-segment'),
            nbGroupesLecture: l.querySelectorAll('.voicing-group').length,
        };
    });
    exiger(!!partage, 'les deux rangées existent');
    check(partage.memeRangee, 'la rangée Lecture EST une .voicing-row, comme celle de la carte Accord');
    check(partage.groupes && partage.etiquettes && partage.segments,
        'elle réutilise .voicing-group, .voicing-label et .voicing-seg/.voicing-segment');
    check(partage.nbGroupesLecture === 3, `trois groupes étiquetés : Jeu, Durée, Intensité — ${partage.nbGroupesLecture}`);
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
    const dessus = await page.evaluate(() => [...document.querySelectorAll('#lecture-row .voicing-group')].map(g => {
        const lab = g.querySelector('.voicing-label').getBoundingClientRect();
        const ctl = [...g.children].find(c => !c.classList.contains('voicing-label')).getBoundingClientRect();
        return { t: g.querySelector('.voicing-label').textContent.trim().split(' ')[0], auDessus: lab.bottom <= ctl.top + 1 };
    }));
    check(dessus.every(d => d.auDessus), `les trois étiquettes sont au-dessus de leur commande — ${dessus.map(d => d.t).join(', ')}`);

    console.log('\n=== C. Cinq niveaux, construits depuis la table, jamais écrits en dur ===');
    const niveaux = await page.evaluate(() => ({
        n: document.querySelectorAll('#intensity-seg .voicing-segment').length,
        valeurs: [...document.querySelectorAll('#intensity-seg .voicing-segment')].map(b => +b.dataset.valeur),
        libelles: [...document.querySelectorAll('#intensity-seg .voicing-segment')].map(b => b.textContent.trim()),
        contientDefaut: [...document.querySelectorAll('#intensity-seg .voicing-segment')].some(b => +b.dataset.valeur === 75),
    }));
    check(niveaux.n === 5, `cinq niveaux, pas un de plus — ${niveaux.n}`);
    check(JSON.stringify(niveaux.libelles) === '["1","2","3","4","5"]', `numérotés 1 à 5 — ${niveaux.libelles.join(' ')}`);
    check(niveaux.valeurs.every((v, i) => i === 0 || v > niveaux.valeurs[i - 1]), `les valeurs montent — ${niveaux.valeurs.join(', ')}`);
    // 75 DOIT rester atteignable à l'identique : c'est la valeur par défaut de tous les accords déjà
    // écrits, et computeVelocity s'en sert comme référence (mult = percent / 75). La déplacer aurait
    // changé le son de morceaux existants.
    check(niveaux.contientDefaut, 'la valeur par défaut (75) est l\'un des cinq niveaux, inchangée');

    console.log('\n=== D. Les deux bouts du fil : le bouton ET la donnée ===');
    const avant = await page.evaluate(accord, 0);
    await page.click('#intensity-seg .voicing-segment[data-valeur="35"]');
    await page.waitForTimeout(450);
    check((await page.evaluate(accord, 0)).intensity === 35,
        `cliquer un niveau écrit l'intensité dans l'accord — ${avant.intensity} → ${(await page.evaluate(accord, 0)).intensity}`);
    check(await page.evaluate(() => +document.getElementById('intensity').value) === 35,
        'la barre d\'origine, restée source de vérité, porte la même valeur');
    check(await page.evaluate(() => document.querySelector('#intensity-seg .voicing-segment[data-valeur="35"]').classList.contains('active')),
        'et le niveau cliqué s\'affiche comme retenu');
    check(await page.evaluate(() => document.getElementById('intensity-val').textContent.trim()) === '35',
        'le nombre affiché dans l\'étiquette suit');

    // Ctrl+Z : le chemin d'annulation ne doit rien savoir de la nouvelle commande.
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(450);
    check((await page.evaluate(accord, 0)).intensity === avant.intensity,
        `Ctrl+Z reprend l'intensité d'avant — ${avant.intensity}`);

    console.log('\n=== E. Une valeur héritée n\'est ni réécrite, ni affichée comme exacte ===');
    // Le cas des morceaux écrits avant les cinq niveaux. Réécrire en silence à la simple ouverture de
    // l'accord aurait modifié leur son sans que personne ne demande rien.
    await page.evaluate(() => window.app.editChord(0, 1));
    await page.waitForTimeout(600);
    const herite = await page.evaluate(() => ({
        donnee: JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[1].intensity,
        champ: +document.getElementById('intensity').value,
        affiche: document.getElementById('intensity-val').textContent.trim(),
        allume: [...document.querySelectorAll('#intensity-seg .voicing-segment.active')].map(b => b.dataset.valeur),
        approx: [...document.querySelectorAll('#intensity-seg .voicing-segment.approx')].map(b => b.dataset.valeur),
    }));
    check(herite.donnee === 60 && herite.champ === 60, `la donnée n'a pas bougé à l'ouverture — ${herite.donnee}`);
    check(herite.affiche === '60', `le nombre exact reste lisible dans l'étiquette — « ${herite.affiche} »`);
    check(herite.allume.length === 1 && herite.allume[0] === '55', `le niveau le plus proche est désigné — ${herite.allume.join(',')}`);
    check(herite.approx.length === 1, 'et il est marqué « à peu près » : la commande n\'affirme pas une valeur que l\'accord n\'a pas');
    // Cliquer, en revanche, écrit franchement.
    await page.click('#intensity-seg .voicing-segment[data-valeur="55"]');
    await page.waitForTimeout(450);
    const apresClic = await page.evaluate(() => ({
        donnee: JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[1].intensity,
        approx: document.querySelectorAll('#intensity-seg .voicing-segment.approx').length,
    }));
    check(apresClic.donnee === 55 && apresClic.approx === 0,
        `un clic, lui, écrit franchement la valeur du niveau — ${apresClic.donnee}, plus de « à peu près »`);

    console.log('\n=== F. Le mode studio est devenu la dernière case de l\'échelle ===');
    const studio = await page.evaluate(() => {
        const b = document.getElementById('toggle-studio-mode');
        const seg = document.getElementById('intensity-seg');
        return { dansLaBande: !!b && b.parentElement === seg, dernier: seg.lastElementChild === b };
    });
    check(studio.dansLaBande && studio.dernier,
        'il ferme la bande d\'intensité, à la suite des cinq niveaux — c\'en est le réglage fin');
    const rStudio = await page.evaluate(atteignable, '#toggle-studio-mode');
    check(rStudio.ok, `et il reste atteignable — ${rStudio.ok ? rStudio.taille : rStudio.pourquoi}`);
    const avantStudio = await page.evaluate(() => window.app.studioMode);
    await page.click('#toggle-studio-mode');
    await page.waitForTimeout(400);
    check(await page.evaluate(() => window.app.studioMode) !== avantStudio, 'il bascule toujours le mode studio');
    await page.click('#toggle-studio-mode');
    await page.waitForTimeout(300);

    console.log('\n=== G. Rien ne déborde, et la carte a maigri ===');
    for (const [w, h] of [[1440, 950], [1024, 768], [768, 900]]) {
        await page.setViewportSize({ width: w, height: h });
        await page.waitForTimeout(400);
        const m = await page.evaluate(() => {
            const row = document.getElementById('lecture-row');
            const seg = document.getElementById('intensity-seg');
            const coupes = [...document.querySelectorAll('#lecture-row .duration-dd-label, #lecture-row .playstyle-dd-label')]
                .filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent.trim());
            return { trop: row.scrollWidth - row.clientWidth, segTrop: seg.scrollWidth - seg.clientWidth,
                     page: document.documentElement.scrollWidth - document.documentElement.clientWidth, coupes };
        });
        check(m.trop <= 0 && m.segTrop <= 0 && m.page <= 0 && m.coupes.length === 0,
            `${w}px : rangée ${m.trop}px, bande d'intensité ${m.segTrop}px, aucun libellé tronqué${m.coupes.length ? ' (' + m.coupes.join(', ') + ')' : ''}`);
    }
    await page.setViewportSize({ width: 1440, height: 950 });
    await page.waitForTimeout(300);
    const hauteur = await page.evaluate(() => Math.round(document.getElementById('lecture-card').getBoundingClientRect().height));
    // 160px avant, mesuré sur ce même écran. On vérifie le GAIN, pas une valeur au pixel près : une
    // retouche de police ou d'espacement ferait rougir un banc qui exigerait exactement 124.
    check(hauteur <= 140, `la carte a maigri : ${hauteur}px contre 160px avant (mesuré sur le même écran)`);
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
    await m.evaluate(() => window.app.editChord(0, 0));
    await m.waitForTimeout(700);

    const geo = await m.evaluate(() => {
        const row = document.getElementById('lecture-row');
        const carte = document.getElementById('lecture-card').getBoundingClientRect();
        const r = row.getBoundingClientRect();
        const cibles = [...document.querySelectorAll('#lecture-row .voicing-segment, #lecture-row .voicing-step, #lecture-row .playstyle-dd-toggle, #lecture-row .duration-dd-toggle')].map(x => x.getBoundingClientRect());
        return { deborde: r.right > carte.right + 1 || row.scrollWidth > row.clientWidth,
                 page: document.documentElement.scrollWidth > window.innerWidth + 1,
                 hMin: Math.round(Math.min(...cibles.map(x => x.height))),
                 lMin: Math.round(Math.min(...cibles.map(x => x.width))),
                 nb: cibles.length,
                 hauteur: Math.round(carte.height) };
    });
    check(!geo.deborde && !geo.page, 'téléphone : la rangée tient dans la carte, sans débordement de page');
    check(geo.hMin >= 28 && geo.lMin >= 20,
        `téléphone : les ${geo.nb} cibles font au moins 28px de haut et 20px de large — ${geo.lMin}x${geo.hMin} au plus petit`);
    check(geo.hauteur <= 150, `téléphone : la carte fait ${geo.hauteur}px contre 182px avant`);

    // Un vrai appui, pas un appel de méthode : un bouton qu'on ne peut atteindre qu'en appelant la
    // fonction derrière n'est pas un bouton (leçon du tiroir du séquenceur, que l'utilisateur
    // n'arrivait plus à fermer alors que le banc, lui, le fermait par window.app.toggleSequencer).
    await m.evaluate(() => document.getElementById('lecture-card').scrollIntoView({ block: 'center' }));
    await m.waitForTimeout(400);
    const r1 = await m.evaluate(atteignable, '#intensity-seg .voicing-segment[data-valeur="90"]');
    exiger(r1.ok, `téléphone : le niveau 4 est réellement atteignable — ${r1.ok ? r1.taille : r1.pourquoi}`);
    await m.tap('#intensity-seg .voicing-segment[data-valeur="90"]');
    await m.waitForTimeout(500);
    check((await m.evaluate(accord, 0)).intensity === 90, 'téléphone : un vrai appui pose le niveau 4');

    check(erreurs.length === 0, `aucune erreur JavaScript — ${erreurs.join(' | ') || 'aucune'}`);
    await browser.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
