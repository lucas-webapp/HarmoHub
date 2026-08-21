// Le rythme et la durée : là où on les définit vraiment.
//
// RETOURS UTILISATEUR :
//   « Le bouton "jeu" n'est pas clair, à travailler également. »
//   « Je pense que je ne me servirai pas souvent de ces options de lecture (durée accord et type de
//     rythme) vu que je modifie plus rapidement le séquenceur. Que penses-tu de les modifier
//     fortement voire de les supprimer ? »
//
// MESURÉ AVANT DE DÉCIDER — trois constats, tous vérifiés dans le navigateur :
//   1. « Jeu » n'était pas un état mais un TAMPON : il écrase tout le motif du séquenceur. Sa forme
//      (un menu affichant une valeur) mentait — après avoir dessiné une note, le bouton continuait
//      d'annoncer « 1t » alors que l'accord jouait autre chose.
//   2. Ce tampon DÉTRUISAIT sans retour : il appelait clearSeqHistory(), pile du séquenceur 2 → 0, et
//      trois Ctrl+Z de suite ne retrouvaient jamais le motif dessiné à la main.
//   3. « Durée » faisait doublon en Modification : la poignée au bord de la case fait déjà le travail
//      (tiré la case, « 1 mes. » est devenu « 2 mes. », le menu a suivi).
//
// D'où la décision d'alors : PAS de suppression — un partage par mode. En Ajout, les deux restaient ;
// en Modification, ils s'effaçaient.
//
// PUIS LE RYTHME A QUITTÉ LA CARTE POUR DE BON. Retour utilisateur suivant : « Je pense que je ne me
// servirai rarement du rythme. […] Supprime les boutons dans "Lecture" et dans le petit séquenceur. »
// Il ne reste donc, dans cette rangée, que la DURÉE. Ce banc a été réduit d'autant — il n'éprouve
// plus que ce qui existe — mais SES SECTIONS D ET E SONT RESTÉES ENTIÈRES : le tampon de rythme et
// « ce rythme pour toute la partie » n'ont pas disparu avec le bouton, ils sont seulement devenus
// invisibles depuis la carte. La présence du bouton Rythme, elle, est désormais éprouvée par son
// ABSENCE, dans rythme_une_preference_test.
//
// SECTION D, UN AVERTISSEMENT HONNÊTE : elle écrit dans #playStyle et émet 'change' à la main. Plus
// aucun geste réel ne le fait aujourd'hui (voir le commentaire de cet écouteur dans script.js) —
// c'est donc une garantie de MOTEUR, pas de câblage. Elle reste parce que le correctif qu'elle
// protège (un instantané avant d'écraser, au lieu d'un historique vidé) devrait sinon être
// redécouvert par le prochain lot qui redonnerait un moyen de changer le rythme d'un accord.
const { chromium, devices } = require('playwright');
const creerHarnais = require('./_harness');
const { plan, check, exiger, bilan } = creerHarnais('Rythme et durée : mode Ajout, tampon annulable, rythme par partie');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';

const seed = () => {
    const mk = (r, q, b, x) => Object.assign({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' }, x || {});
    const song = {
        id: 'rythme', name: 'Ballade', bpm: 100, timeSig: '4/4', groove: 'straight',
        sections: [
            // Durées VOLONTAIREMENT différentes dans la même partie : c'est le cœur de la section E.
            { title: 'Couplet', chords: [mk('C', 'maj7', 4), mk('A', 'min7', 8), mk('D', 'min7', 2), mk('G', 'dom7', 2)] },
            { title: 'Refrain', chords: [mk('F', 'maj7', 4), mk('E', 'dom7', 4)] },
        ],
    };
    localStorage.setItem('harmohubSongs', JSON.stringify([song]));
    localStorage.setItem('harmohubCurrentSongId', song.id);
    localStorage.setItem('myProgression', JSON.stringify({ sections: song.sections }));
};
const grille = () => JSON.parse(localStorage.getItem('myProgression')).sections
    .map(s => s.chords.map(c => ({ beats: +c.beats, motif: c.arpPattern || '', edite: !!c.seqEdited })));
// Injecté DANS LA PAGE (et non défini ici) : une fonction du fichier de banc n'existe pas dans le
// navigateur, et un `page.evaluate` qui l'appellerait lèverait une ReferenceError — que le harnais
// remonterait en « aucune erreur JavaScript », c'est-à-dire au mauvais endroit. addInitScript survit
// aux rechargements, donc une seule pose suffit pour toute la session.
const POSER_AIDES = `window.visible = (sel) => { const e = document.querySelector(sel); return !!e && e.offsetParent !== null; };`;

(async () => {
    plan(24);
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const erreurs = [];
    const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
    page.on('pageerror', e => erreurs.push('ordinateur : ' + e.message));
    await page.addInitScript(POSER_AIDES);
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await page.waitForTimeout(300);
    await page.evaluate(seed);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(900);

    console.log('=== A. En AJOUT, les deux réglages sont là : ce sont les prochains accords ===');
    exiger(await page.evaluate(() => window.app.appMode === 'add'), 'on démarre bien en mode Ajout');
    const ajout = await page.evaluate(() => ({
        duree: visible('.voicing-group-duree'),
        // Les deux qui ont quitté la rangée, chacun pour sa raison, et qui ne doivent plus y être
        // dans AUCUN des deux modes : l'intensité au menu contextuel (« c'est une option pour
        // affiner le morceau seulement. À cacher »), le rythme aux Paramètres (« je ne me servirai
        // rarement du rythme »).
        intensite: visible('.voicing-group-intensite'),
        jeu: !!document.querySelector('.voicing-group-jeu'),
        etiquette: !!document.getElementById('playstyle-label'),
    }));
    check(ajout.duree && !ajout.intensite,
        'en Ajout : la Durée est là, l\'intensité non — elle est passée au menu contextuel');
    check(!ajout.jeu && !ajout.etiquette,
        'le groupe Rythme n\'existe plus du tout dans la rangée, pas même masqué');
    // Et ce sont bien les valeurs par défaut des accords AJOUTÉS : on les change, on ajoute, on vérifie.
    await page.evaluate(() => {
        const d = document.getElementById('duration');
        d.value = String([...d.options].map(o => +o.value).sort((a, b) => b - a)[0]); // la plus longue
        d.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(300);
    const dureeChoisie = await page.evaluate(() => +document.getElementById('duration').value);
    // DEUX PIÈGES, tous deux tombés dedans en écrivant ce banc, aucun n'étant un défaut de l'appli :
    //  - l'ajout rapide se valide par le BOUTON ou Ctrl+Entrée (le champ est un <textarea>, Entrée
    //    seule y insère une ligne — c'est écrit dans son infobulle) ;
    //  - avec plusieurs parties, un sélecteur de partie s'interpose (voir openSectionPicker).
    // Première version : Entrée seule, sur une grille à deux parties. Rien n'était ajouté, et le banc
    // lisait le DERNIER accord déjà présent en croyant lire le sien — il annonçait donc « 2 temps au
    // lieu de 16 » et accusait l'application d'un défaut qu'elle n'a pas.
    const avantAjout = (await page.evaluate(grille))[0].length;
    await page.fill('#quick-add-input', 'Bm7');
    await page.click('#quick-add-btn');
    await page.waitForTimeout(500);
    const picker = await page.$('#section-picker-menu:not([hidden]) button');
    if (picker) { await picker.click(); await page.waitForTimeout(600); }
    await page.waitForTimeout(400);
    const apresAjout = await page.evaluate(grille);
    exiger(apresAjout[0].length === avantAjout + 1,
        `l'accord a bien été ajouté — ${avantAjout} → ${apresAjout[0].length} accords`);
    const ajoute = apresAjout[0][apresAjout[0].length - 1];
    check(ajoute.beats === dureeChoisie,
        `l'accord ajouté prend la durée choisie — ${ajoute.beats} temps pour ${dureeChoisie} demandés`);

    console.log('\n=== B. En MODIFICATION, ils s\'effacent : la grille et le séquenceur suffisent ===');
    await page.evaluate(() => window.app.editChord(0, 0));
    await page.waitForTimeout(600);
    const modif = await page.evaluate(() => ({
        duree: visible('.voicing-group-duree'),
        intensite: visible('.voicing-group-intensite'),
        // Les champs SOURCES, eux, doivent rester lisibles : rien n'est débranché, seulement masqué.
        selects: ['playStyle', 'duration', 'intensity'].filter(i => !!document.getElementById(i)).length,
        valeurs: ['playStyle', 'duration'].map(i => document.getElementById(i).value),
    }));
    check(!modif.duree, 'la Durée ne s\'affiche plus en Modification : la poignée de la case suffit');
    check(!modif.intensite, 'l\'intensité non plus : la rangée entière a disparu de la carte');
    check(modif.selects === 3 && modif.valeurs.every(v => v !== ''),
        `les champs sources restent dans le DOM et portent une valeur — ${modif.valeurs.join(', ')}`);

    console.log('\n=== C. La durée se règle dans la grille, et c\'est un vrai geste ===');
    // Le doublon n'en était un que parce que l'autre chemin marche. On le prouve plutôt que de le dire.
    const avantDuree = (await page.evaluate(grille))[0][0].beats;
    const poignee = await page.evaluate(() => {
        const el = document.querySelector('.cell-resize-right');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, pas: document.querySelector('.grid-cell').getBoundingClientRect().width };
    });
    exiger(!!poignee, 'la poignée de durée existe au bord de la case');
    await page.mouse.move(poignee.x, poignee.y);
    await page.mouse.down();
    await page.mouse.move(poignee.x + poignee.pas, poignee.y, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(800);
    const apresDuree = (await page.evaluate(grille))[0][0].beats;
    check(apresDuree > avantDuree, `tirer le bord de la case allonge l'accord — ${avantDuree} → ${apresDuree} temps`);
    check(await page.evaluate(() => +document.getElementById('duration').value) === apresDuree,
        'et le champ source suit, sans qu\'on ait touché au menu');

    console.log('\n=== D. Le tampon de rythme est devenu ANNULABLE ===');
    // Le défaut mesuré : un clic sur un préréglage effaçait un rythme dessiné, sans retour.
    await page.evaluate(() => { if (!window.app.seqOpen) window.app.toggleSequencer('compact'); });
    await page.waitForTimeout(800);
    // On part d'un motif clairsemé, pour avoir des cases vides où dessiner.
    await page.evaluate(() => {
        const s = document.getElementById('playStyle');
        s.value = 'noire_staccato';
        s.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(700);
    const dessiner = async () => {
        const c = await page.evaluate(() => {
            const x = document.querySelector('#arp-sequencer .seq-cell[data-voice][data-step]:not(.on):not(.seq-cell-edge)');
            if (!x) return null;
            const r = x.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width };
        });
        if (!c) return false;
        await page.mouse.move(c.x, c.y); await page.mouse.down();
        await page.mouse.move(c.x + c.w * 2, c.y, { steps: 6 }); await page.mouse.up();
        await page.waitForTimeout(500);
        return true;
    };
    exiger(await dessiner(), 'une note a pu être dessinée à la main dans le séquenceur');
    const monRythme = await page.evaluate(() => document.getElementById('arpPattern').value);
    const pileAvant = await page.evaluate(() => window.app.seqUndoStack.length);
    await page.evaluate(() => {
        const s = document.getElementById('playStyle');
        s.value = 'croche_maintenu';
        s.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(700);
    const pileApres = await page.evaluate(() => window.app.seqUndoStack.length);
    check(await page.evaluate(() => document.getElementById('arpPattern').value) !== monRythme,
        'le tampon a bien écrasé le rythme dessiné (c\'est son rôle)');
    // LE point : la pile ne doit plus être vidée, elle doit avoir GRANDI d'un cran.
    check(pileApres === pileAvant + 1,
        `l'historique du séquenceur a gagné un instantané au lieu d'être vidé — ${pileAvant} → ${pileApres}`);
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(700);
    check(await page.evaluate(() => document.getElementById('arpPattern').value) === monRythme,
        'et UN SEUL Ctrl+Z retrouve le rythme dessiné à la main');

    console.log('\n=== E. Un rythme pour toute la partie ===');
    await page.evaluate(() => window.app.exitEditMode());
    await page.waitForTimeout(500);
    const avant = await page.evaluate(grille);
    const boite = await page.evaluate(() => { const c = document.querySelector('.grid-cell'); const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await page.mouse.click(boite.x, boite.y, { button: 'right' });
    await page.waitForTimeout(500);
    const entree = await page.evaluate(() => { const e = document.querySelector('[data-ctx-action="rhythm-to-section"]'); return { existe: !!e, visible: !!e && !e.hidden, texte: e ? e.querySelector('.ctx-label').textContent.trim() : null }; });
    exiger(entree.existe && entree.visible, `l'entrée de menu est proposée — « ${entree.texte} »`);
    await page.click('[data-ctx-action="rhythm-to-section"]');
    await page.waitForTimeout(900);
    const apres = await page.evaluate(grille);

    check(apres[0].every(c => c.edite), `les ${apres[0].length} accords de la partie ont reçu un rythme`);
    // LE point de conception : la durée de chacun est CONSERVÉE. Imposer celle de la source aurait
    // aplati le rythme harmonique — deux accords de deux temps seraient devenus deux accords de quatre.
    check(JSON.stringify(apres[0].map(c => c.beats)) === JSON.stringify(avant[0].map(c => c.beats)),
        `chaque accord garde SA durée — ${avant[0].map(c => c.beats).join('/')} → ${apres[0].map(c => c.beats).join('/')}`);
    // Le motif est ajusté à chaque durée : plus long sur un accord plus long, plus court sur un plus court.
    const parDuree = apres[0].map(c => ({ b: c.beats, n: c.motif.split(';').length }));
    const longs = parDuree.filter(x => x.b === Math.max(...parDuree.map(y => y.b)));
    const courts = parDuree.filter(x => x.b === Math.min(...parDuree.map(y => y.b)));
    check(longs[0].n > courts[0].n,
        `le motif est ajusté à la durée de chacun — ${courts[0].b} temps : ${courts[0].n} cases, ${longs[0].b} temps : ${longs[0].n} cases`);
    check(JSON.stringify(apres[1]) === JSON.stringify(avant[1]),
        'l\'autre partie n\'a pas été touchée : c\'est bien « la partie », pas « le morceau »');
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(800);
    check(JSON.stringify(await page.evaluate(grille)) === JSON.stringify(avant),
        'un seul Ctrl+Z annule toute l\'application');

    console.log('\n=== F. L\'entrée disparaît quand elle n\'aurait personne à servir ===');
    await page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem('myProgression')).sections;
        s[1].chords = [s[1].chords[0]];   // une partie d'UN seul accord
        localStorage.setItem('myProgression', JSON.stringify({ sections: s }));
        window.app.loadProgression();
    });
    await page.waitForTimeout(600);
    const seule = await page.evaluate(() => {
        const cases = [...document.querySelectorAll('.grid-cell:not(.grid-cell-add)')];
        const derniere = cases[cases.length - 1];
        const r = derniere.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await page.mouse.click(seule.x, seule.y, { button: 'right' });
    await page.waitForTimeout(500);
    check(await page.evaluate(() => document.querySelector('[data-ctx-action="rhythm-to-section"]').hidden),
        'sur une partie d\'un seul accord, l\'entrée est masquée plutôt que sans effet');
    await page.keyboard.press('Escape');
    await page.close();

    console.log('\n=== G. Téléphone : le partage par mode tient aussi ===');
    const ctx = await browser.newContext({ ...devices['iPhone 13'], hasTouch: true });
    const m = await ctx.newPage();
    m.on('pageerror', e => erreurs.push('téléphone : ' + e.message));
    await m.addInitScript(POSER_AIDES);
    await m.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await m.waitForTimeout(300);
    await m.evaluate(seed);
    await m.reload({ waitUntil: 'load' });
    await m.waitForTimeout(1000);
    const telAjout = await m.evaluate(() => ({ duree: visible('.voicing-group-duree'), jeu: !!document.querySelector('.voicing-group-jeu') }), null);
    check(telAjout.duree && !telAjout.jeu, 'téléphone, Ajout : la Durée est là, le Rythme n\'existe plus');
    await m.evaluate(() => window.app.editChord(0, 0));
    await m.waitForTimeout(800);
    const telModif = await m.evaluate(() => {
        const row = document.getElementById('lecture-row');
        return { duree: visible('.voicing-group-duree'),
                 intensite: visible('.voicing-group-intensite'),
                 trop: row.scrollWidth - row.clientWidth,
                 // Plus d'intensité dans la rangée : on mesure ce qui y reste vraiment (rien en
                 // Modification, d'où le repli sur Infinity, neutralisé par le check ci-dessous).
                 lMin: (() => { const c = [...document.querySelectorAll('#lecture-row .voicing-segment, #lecture-row .voicing-step')].filter(x => x.offsetParent !== null);
                                return c.length ? Math.round(Math.min(...c.map(x => x.getBoundingClientRect().width))) : null; })() };
    });
    check(!telModif.duree && !telModif.intensite, 'téléphone, Modification : la rangée est vide, comme sur ordinateur');
    check(telModif.trop <= 0 && (telModif.lMin === null || telModif.lMin >= 20),
        `téléphone : la rangée ne déborde pas${telModif.lMin === null ? ' (et elle est vide, comme attendu)' : ' et ses cases restent tactiles — ' + telModif.lMin + 'px'}`);

    check(erreurs.length === 0, `aucune erreur JavaScript — ${erreurs.join(' | ') || 'aucune'}`);
    await browser.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
