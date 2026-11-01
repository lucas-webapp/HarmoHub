// LA BARRE DU HAUT (refonte, lot 3 — docs/refonte.md et la maquette « Version 2 »), avec de vrais clics et de vraies touches.
//
// CE QUE L'UTILISATEUR A DEMANDÉ, mot pour mot, et que ce banc tient :
//   • « laisser le logo, mais enlever le nom de l'appli » : logo seul, à gauche ;
//   • « ajuster la largeur de la barre avec le titre du morceau (rétrécir ou élargir avec seuil) » : le titre est un bouton de 128 à
//     280px, « … » au-delà, nom complet en infobulle ;
//   • « je veux bien garder le bouton enregistrer… enregistrement manuel » : Enregistrer reste MANUEL, et un voyant dit s'il y a quelque
//     chose à enregistrer — sans quoi un enregistrement manuel est un piège ;
//   • « bouton Paramètres avec l'engrenage » (l'engrenage existant), « pas de bouton rond ici » : tous les boutons de la barre ont le
//     même arrondi (7px), la pilule du compte (commune aux trois applis) exceptée ;
//   • « onglets EXACTEMENT au centre » : la colonne du milieu est réservée et centrée sur la fenêtre (lot 4 y posera les onglets) ;
//   • « rien ne doit régresser » : changer de morceau reste à deux clics, et chaque ancien bouton de la carte Morceau (renommer, nouveau,
//     mes morceaux, importer, exporter) a son entrée dans le menu, qui appelle le MÊME code.
//
// CE QUE LE BANC NE PEUT PAS DIRE : à quoi ça ressemble. Les mesures disent « aligné, à la bonne hauteur, centré » ; l'œil reste à
// l'utilisateur (voir les captures dans le journal du lot).
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('barre du haut');
const { estBruitReseau } = require('./_harness');

plan(70);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const NOM_LONG = 'Ballade en mi bémol pour quatuor à cordes et piano, version longue';
const mk = (root, quality, beats = 4) => ({ root, quality, beats, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held', instrument: 'piano', arpPattern: '', seqEdited: false, guitarLock: null, extraNotes: [], intensity: 75, intensityPerStep: {} });
const graine = ({ src, noms, courant }) => {
    const m = eval('(' + src + ')');
    const sections = [{ title: 'Couplet', chords: [m('C', 'maj7'), m('A', 'min7'), m('D', 'min7'), m('G', '7')] }];
    const now = Date.now();
    const songs = noms.map((nom, i) => ({ id: 's' + (i + 1), name: nom, savedAt: now - i * 3600000, sections: JSON.parse(JSON.stringify(sections)) }));
    localStorage.setItem('harmohubSongs', JSON.stringify(songs));
    if (courant) {
        localStorage.setItem('harmohubCurrentSongId', courant);
        localStorage.setItem('myProgression', JSON.stringify({ sections }));
    } else localStorage.removeItem('harmohubCurrentSongId');
    sessionStorage.setItem('cc_accueil_vu', '1');
};

(async () => {
    const nav = await chromium.launch();
    const erreurs = [];
    const ouvrir = async (viewport, noms, courant) => {
        const p = await nav.newPage({ viewport });
        p.on('pageerror', e => erreurs.push((viewport.width < 900 ? 'tel: ' : '') + e.message));
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text())) erreurs.push('console: ' + m.text()); });
        await p.goto(`${BASE}/index.html`);
        await p.evaluate(graine, { src: mk.toString(), noms, courant });
        await p.reload();
        await p.waitForTimeout(900);
        return p;
    };
    const idCourant = (p) => p.evaluate(() => localStorage.getItem('harmohubCurrentSongId'));
    const nomsEnBase = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('harmohubSongs')).map(s => s.name));
    const etat = (p) => p.evaluate(() => ({
        etat: document.getElementById('tb-etat').dataset.etat,
        texte: document.getElementById('tb-etat-texte').textContent,
        modifie: document.getElementById('tb-save').dataset.modifie,
        drapeau: hasUnsavedChanges,
    }));

    // ======================================================================================================
    console.log('\n=== A. La barre : pleine largeur, trois colonnes, hauteur et arrondi de la jauge ===');
    const p = await ouvrir({ width: 1440, height: 900 }, ['Blues du dimanche', 'Autumn Leaves', 'Fly me to the moon'], 's1');
    const a = await p.evaluate(() => {
        const R = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, r: b.right, b: b.bottom }; };
        const rayon = (s) => parseFloat(getComputedStyle(document.querySelector(s)).borderTopLeftRadius);
        return {
            bar: R('.top-bar'), logo: R('.logo'), titre: R('#tb-titre'), save: R('#tb-save'), etat: R('#tb-etat'), centre: R('#tb-centre'),
            undo: R('#global-undo-btn'), redo: R('#global-redo-btn'), reglages: R('#open-settings'), compte: R('#compte-cloud'),
            colGauche: R('.col-left'), pos: getComputedStyle(document.querySelector('.top-bar')).position, W: innerWidth,
            rayons: { titre: rayon('#tb-titre'), save: rayon('#tb-save'), undo: rayon('#global-undo-btn'), reglages: rayon('#open-settings'), logo: rayon('.logo') },
            logoTexte: document.querySelector('.logo').textContent.trim(),
        };
    });
    check(a.pos === 'fixed' && a.bar.x === 0 && Math.abs(a.bar.w - a.W) < 1 && a.bar.y === 0, `la barre est fixée en haut et occupe toute la largeur (${Math.round(a.bar.w)}px sur ${a.W}px)`);
    check(a.bar.b < 60, `la barre est basse : ${Math.round(a.bar.b)}px (maquette : 52px)`);
    check(a.colGauche.y >= a.bar.b, `le contenu commence SOUS la barre (volet de gauche à ${Math.round(a.colGauche.y)}px, barre jusqu'à ${Math.round(a.bar.b)}px)`);
    check(a.logoTexte === '', 'le logo est SEUL : aucun mot (« enlever le nom de l\'appli »)');
    const ordreG = [a.logo.x, a.titre.x, a.save.x, a.etat.x];
    check(ordreG.every((x, i) => i === 0 || x > ordreG[i - 1]), 'à gauche, de gauche à droite : logo, titre du morceau, Enregistrer, voyant');
    const ordreD = [a.undo.x, a.redo.x, a.reglages.x, a.compte.x];
    check(ordreD.every((x, i) => i === 0 || x > ordreD[i - 1]) && a.compte.r <= a.W - 8, 'à droite : annuler, rétablir, Paramètres, compte — le compte colle au bord, sans le dépasser');
    check([a.titre, a.save, a.undo, a.redo, a.reglages, a.logo].every(b => Math.abs(b.h - 32) < 0.6), 'titre, Enregistrer, annuler, rétablir, Paramètres, logo : tous à 32px de haut');
    check([a.titre, a.save, a.undo, a.redo, a.reglages, a.logo].every(b => Math.abs((b.y + b.h / 2) - (a.bar.y + (a.bar.b - a.bar.y) / 2)) < 1.5), 'tous sont centrés verticalement sur la barre (une ligne de base)');
    check(Object.values(a.rayons).every(r => r === 7), `un seul arrondi pour ce qu'on clique : 7px (${JSON.stringify(a.rayons)}) — « pas de bouton rond »`);
    const centreX = a.centre.x + a.centre.w / 2;
    check(Math.abs(centreX - a.W / 2) <= 1, `la colonne du milieu est CENTRÉE sur la fenêtre (${centreX.toFixed(1)} pour ${a.W / 2}) — c'est là que viendront les onglets`);
    check(a.etat.r < a.centre.x + 1 || a.centre.w === 0 && a.etat.r < centreX, 'le voyant ne déborde pas sur la colonne du milieu');

    // ======================================================================================================
    console.log('\n=== B. Le titre : largeur adaptative de 128 à 280px ===');
    const larg = async (nom) => {
        await p.evaluate((n) => { document.getElementById('tb-titre-nom').textContent = n; }, nom);
        return p.evaluate(() => { const t = document.getElementById('tb-titre'), z = document.getElementById('tb-titre-nom'); return { w: t.getBoundingClientRect().width, coupe: z.scrollWidth > z.clientWidth + 1 }; });
    };
    const court = await larg('Ré');
    const moyen = await larg('Autumn Leaves en do');
    const long = await larg(NOM_LONG);
    check(Math.abs(court.w - 128) < 1, `un titre court n'écrase pas la barre : plancher de 128px (${Math.round(court.w)}px)`);
    check(moyen.w > 128 && moyen.w < 280, `un titre moyen élargit le bouton selon son nom (${Math.round(moyen.w)}px)`);
    check(Math.abs(long.w - 280) < 1 && long.coupe, `un titre très long plafonne à 280px et se coupe (« … ») : ${Math.round(long.w)}px`);
    await p.evaluate(() => window.app.refreshSongList());
    check(await p.evaluate(() => document.getElementById('tb-titre-nom').textContent) === 'Blues du dimanche', 'le titre affiche le nom du morceau ouvert');
    const infobulleLongue = await p.evaluate((n) => { window.app.rafraichirBarreMorceau(); const s = JSON.parse(localStorage.getItem('harmohubSongs')); s[0].name = n; localStorage.setItem('harmohubSongs', JSON.stringify(s)); window.app.rafraichirBarreMorceau(); return document.getElementById('tb-titre').title; }, NOM_LONG);
    check(infobulleLongue.includes(NOM_LONG), 'le nom COMPLET est dans l\'infobulle (le bouton, lui, coupe à 280px)');

    // ======================================================================================================
    console.log('\n=== C. Le voyant d\'enregistrement et l\'enregistrement MANUEL ===');
    await p.reload(); await p.waitForTimeout(900);
    let e = await etat(p);
    check(e.etat === 'enregistre' && /^Enregistré/.test(e.texte) && e.drapeau === false, `morceau tout juste ouvert : « ${e.texte} » (voyant vert, rien à enregistrer)`);
    const avant = await p.evaluate(() => JSON.parse(localStorage.getItem('harmohubSongs'))[0].sections[0].chords.length);
    await p.fill('#quick-add-input', 'F');
    await p.click('#quick-add-btn');
    await p.waitForTimeout(250);
    e = await etat(p);
    check(e.etat === 'modifie' && e.texte === 'Non enregistré' && e.drapeau === true, `après un ajout : voyant orange « ${e.texte} »`);
    check(e.modifie === '1', 'le bouton Enregistrer s\'allume d\'un liseré orangé quand il y a quelque chose à enregistrer');
    check(await p.evaluate(() => document.getElementById('tb-etat').title).then(t => /Ctrl\+S/.test(t)), 'l\'infobulle du voyant dit comment enregistrer (Ctrl+S)');
    const surDisqueAvant = await p.evaluate(() => JSON.parse(localStorage.getItem('harmohubSongs'))[0].sections[0].chords.length);
    check(surDisqueAvant === avant, `ENREGISTREMENT MANUEL : l'ajout n'a PAS touché le morceau enregistré (${surDisqueAvant} accords, comme avant)`);
    await p.click('#tb-save');
    await p.waitForTimeout(250);
    e = await etat(p);
    const surDisqueApres = await p.evaluate(() => JSON.parse(localStorage.getItem('harmohubSongs'))[0].sections.flatMap(s => s.chords).length);
    check(surDisqueApres === avant + 1, `un clic sur Enregistrer écrit le morceau (${avant} → ${surDisqueApres} accords)`);
    check(e.etat === 'enregistre' && /^Enregistré à \d\d:\d\d$/.test(e.texte) && e.modifie === '0', `le voyant repasse au vert : « ${e.texte} »`);
    await p.fill('#quick-add-input', 'Am');
    await p.click('#quick-add-btn');
    await p.waitForTimeout(250);
    check((await etat(p)).etat === 'modifie', 'une nouvelle modification rallume le voyant');
    await p.locator('body').click({ position: { x: 700, y: 600 } }); // le focus quitte le champ : Ctrl+S doit marcher partout
    await p.keyboard.press('Control+s');
    await p.waitForTimeout(250);
    e = await etat(p);
    check(e.etat === 'enregistre' && e.drapeau === false, 'Ctrl+S enregistre aussi, et le voyant le sait');
    await p.keyboard.press('Control+z');
    await p.waitForTimeout(250);
    check((await etat(p)).etat === 'modifie', 'annuler (Ctrl+Z) après un enregistrement rend le tampon différent du morceau enregistré : le voyant repasse à « Non enregistré »');

    // ======================================================================================================
    console.log('\n=== D. Le menu du morceau ===');
    await p.reload(); await p.waitForTimeout(900);
    const ouvertMenu = () => p.evaluate(() => ({ ouvert: !document.getElementById('tb-menu').hidden, aria: document.getElementById('tb-titre').getAttribute('aria-expanded') }));
    await p.click('#tb-titre');
    let m = await ouvertMenu();
    check(m.ouvert && m.aria === 'true', 'un clic sur le titre ouvre le menu (aria-expanded = true)');
    const geo = await p.evaluate(() => { const b = document.getElementById('tb-menu').getBoundingClientRect(); const t = document.getElementById('tb-titre').getBoundingClientRect(); return { dans: b.left >= 0 && b.right <= innerWidth && b.bottom <= innerHeight, sous: b.top >= t.bottom, gauche: Math.abs(b.left - t.left) < 2 }; });
    check(geo.dans && geo.sous && geo.gauche, 'le menu tombe SOUS le titre, aligné à gauche, entièrement dans l\'écran');
    const entrees = await p.evaluate(() => [...document.querySelectorAll('#tb-menu .tb-mi')].map(b => ({ a: b.dataset.tbAction, t: b.textContent.trim(), coche: b.getAttribute('aria-checked') })));
    const morceaux = entrees.filter(x => x.a === 'ouvrir-id');
    check(morceaux.length === 3, `le menu s'ouvre sur la liste des morceaux : ${morceaux.length} morceaux (changer de morceau = deux clics, comme avant)`);
    check(morceaux.filter(x => x.coche === 'true').length === 1 && /Blues|Ballade/.test(morceaux.find(x => x.coche === 'true').t), 'le morceau ouvert est coché, et un seul');
    const actions = entrees.filter(x => x.a !== 'ouvrir-id').map(x => x.a);
    check(JSON.stringify(actions) === JSON.stringify(['mes-morceaux', 'nouveau', 'renommer', 'dupliquer', 'importer', 'exporter', 'rangement']), `les entrées, dans l'ordre de la maquette : ${actions.join(' · ')}`);
    check(await p.evaluate(() => document.activeElement && document.activeElement.closest('#tb-menu') !== null), 'le focus passe dans le menu (clavier utilisable)');
    await p.keyboard.press('ArrowDown');
    const f1 = await p.evaluate(() => document.activeElement.dataset.songId || document.activeElement.dataset.tbAction);
    await p.keyboard.press('ArrowDown');
    const f2 = await p.evaluate(() => document.activeElement.dataset.songId || document.activeElement.dataset.tbAction);
    check(f1 && f2 && f1 !== f2, `les flèches ↓ déplacent le focus d'entrée en entrée (${f1} → ${f2})`);
    await p.keyboard.press('Escape');
    m = await ouvertMenu();
    check(!m.ouvert && m.aria === 'false', 'Échap referme le menu');
    check(await p.evaluate(() => document.activeElement && document.activeElement.id) === 'tb-titre', '…et rend le focus au titre');
    await p.click('#tb-titre');
    await p.mouse.click(900, 500);
    check(!(await ouvertMenu()).ouvert, 'un clic ailleurs referme le menu');
    await p.click('#tb-titre'); await p.click('#tb-titre');
    check(!(await ouvertMenu()).ouvert, 'un second clic sur le titre le referme aussi');

    console.log('\n--- D2. Chaque entrée appelle le code de l\'ancien bouton ---');
    // CHANGER DE MORCEAU : deux clics.
    await p.click('#tb-titre');
    await p.click('#tb-menu .tb-mi-morceau:nth-child(2)');
    await p.waitForTimeout(300);
    const apresOuvrir = await idCourant(p);
    check(apresOuvrir !== 's1' && /^s\d$/.test(apresOuvrir), `choisir un autre morceau l'ouvre (de s1 à ${apresOuvrir}), en deux clics`);
    check(await p.evaluate(() => document.getElementById('tb-titre-nom').textContent) !== 'Blues du dimanche', 'le titre suit');
    // … et le garde-fou des modifications non enregistrées passe par le même chemin que l'ancienne liste.
    await p.fill('#quick-add-input', 'E7');
    await p.click('#quick-add-btn');
    await p.waitForTimeout(200);
    const avantGarde = await idCourant(p);
    await p.click('#tb-titre');
    await p.click('#tb-menu .tb-mi-morceau:not(.actif)');
    await p.waitForTimeout(250);
    check(await p.evaluate(() => !document.getElementById('unsaved-modal').hidden), 'changer de morceau avec des modifications non enregistrées ouvre la fenêtre de confirmation (même garde-fou qu\'avant)');
    await p.click('#unsaved-cancel');
    await p.waitForTimeout(200);
    check(await idCourant(p) === avantGarde && (await etat(p)).etat === 'modifie', 'Annuler : on reste sur le morceau, modifications intactes');
    await p.click('#tb-save'); await p.waitForTimeout(200);

    // NOUVEAU
    await p.click('#tb-titre'); await p.click('#tb-menu [data-tb-action="nouveau"]');
    await p.waitForTimeout(250);
    check(await p.evaluate(() => !document.getElementById('new-song-modal').hidden), '« Nouveau morceau » ouvre la fenêtre de création (comme le bouton +)');
    await p.click('#new-song-cancel'); await p.waitForTimeout(150);

    // RENOMMER (menu, puis double-clic, puis Échap)
    await p.click('#tb-titre'); await p.click('#tb-menu [data-tb-action="renommer"]');
    await p.waitForTimeout(150);
    const champ = await p.evaluate(() => { const i = document.querySelector('.top-bar input.tb-titre-saisie'); const t = document.getElementById('tb-titre'); return { present: !!i, titreCache: t.hidden, focus: document.activeElement === i, h: i && i.getBoundingClientRect().height, dansBarre: i && i.closest('.top-bar') !== null }; });
    check(champ.present && champ.titreCache && champ.focus && champ.dansBarre, '« Renommer » remplace le titre par un champ DANS la barre, focus dedans');
    check(Math.abs(champ.h - 32) < 0.6, 'le champ a la hauteur du bouton qu\'il remplace (32px) : rien ne saute');
    await p.keyboard.press('Control+a');
    await p.keyboard.type('Titre renommé');
    await p.keyboard.press('Enter');
    await p.waitForTimeout(250);
    check((await nomsEnBase(p)).includes('Titre renommé') && await p.evaluate(() => document.getElementById('tb-titre-nom').textContent) === 'Titre renommé', 'Entrée valide : le nom est écrit dans le morceau et le titre le montre');
    check(await p.evaluate(() => !document.querySelector('.top-bar input.tb-titre-saisie') && !document.getElementById('tb-titre').hidden), 'le champ disparaît, le titre revient');
    await p.dblclick('#tb-titre');
    await p.waitForTimeout(150);
    check(await p.evaluate(() => !!document.querySelector('.top-bar input.tb-titre-saisie')) && !(await ouvertMenu()).ouvert, 'le double-clic sur le titre renomme aussi (sans laisser le menu ouvert)');
    await p.keyboard.type('X'); await p.keyboard.press('Escape');
    await p.waitForTimeout(150);
    check((await nomsEnBase(p)).includes('Titre renommé') && !(await nomsEnBase(p)).some(n => n.endsWith('X')), 'Échap abandonne le renommage : le nom n\'a pas bougé');

    // DUPLIQUER : une copie, l'original ne bouge pas
    await p.fill('#quick-add-input', 'B7'); await p.click('#quick-add-btn'); await p.waitForTimeout(200);
    const idAvantDup = await idCourant(p);
    const nbAvant = (await nomsEnBase(p)).length;
    await p.click('#tb-titre'); await p.click('#tb-menu [data-tb-action="dupliquer"]');
    await p.waitForTimeout(250);
    const noms = await nomsEnBase(p);
    check(noms.length === nbAvant + 1 && noms.includes('Titre renommé (2)'), `« Dupliquer » ajoute « Titre renommé (2) » (${nbAvant} → ${noms.length} morceaux)`);
    check(await idCourant(p) === idAvantDup && (await etat(p)).etat === 'modifie', 'l\'original reste ouvert, avec ses modifications non enregistrées (une copie ne doit rien coûter à l\'original)');
    const copie = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('harmohubSongs')); const c = s.find(x => x.name === 'Titre renommé (2)'), o = s.find(x => x.name === 'Titre renommé'); return { id: c.id !== o.id, accords: c.sections.flatMap(x => x.chords).length === o.sections.flatMap(x => x.chords).length }; });
    check(copie.id && copie.accords, 'la copie a son propre identifiant et la version ENREGISTRÉE de l\'original (sans le B7 en cours)');
    await p.click('#tb-save'); await p.waitForTimeout(200);

    // IMPORTER / EXPORTER
    const [choix] = await Promise.all([p.waitForEvent('filechooser', { timeout: 3000 }).catch(() => null), (async () => { await p.click('#tb-titre'); await p.click('#tb-menu [data-tb-action="importer"]'); })()]);
    check(!!choix, '« Importer… » ouvre le sélecteur de fichier (le même champ que l\'ancienne flèche)');
    await p.click('#tb-titre'); await p.click('#tb-menu [data-tb-action="exporter"]');
    await p.waitForTimeout(150);
    const portee = await p.evaluate(() => { const m = document.getElementById('backup-scope-menu'); return { ouvert: !m.hidden, boutons: [...m.querySelectorAll('button')].map(b => b.textContent.trim()) }; });
    check(portee.ouvert && portee.boutons.length === 2 && /morceau/i.test(portee.boutons[0]) && /biblioth/i.test(portee.boutons[1]), `« Exporter… » demande la portée (${portee.boutons.join(' / ')}), comme l'ancienne flèche`);
    await p.mouse.click(900, 500);
    // MES MORCEAUX
    await p.click('#tb-titre'); await p.click('#tb-menu [data-tb-action="mes-morceaux"]');
    await p.waitForTimeout(300);
    check(await p.evaluate(() => !document.getElementById('files-overlay').hidden), '« Mes morceaux… » ouvre la fenêtre des fichiers (dossiers compris)');
    await p.click('#files-close'); await p.waitForTimeout(150);
    // LE RANGEMENT : présent (sa fenêtre native ne se teste pas ici)
    await p.click('#tb-titre');
    check(await p.locator('#tb-menu [data-tb-action="rangement"]').count() === 1, '« Rangement sur le disque… » est dans le menu (le sélecteur de dossier natif ne se pilote pas d\'ici)');
    await p.keyboard.press('Escape');

    // ======================================================================================================
    console.log('\n=== E. Premier enregistrement d\'un morceau sans nom, dans la barre ===');
    const q = await ouvrir({ width: 1440, height: 900 }, [], null);
    check((await etat(q)).etat === 'neuf' && await q.evaluate(() => document.getElementById('tb-titre-nom').textContent) === 'Nouveau morceau', 'sans morceau ouvert : titre « Nouveau morceau », voyant gris');
    await q.fill('#quick-add-input', 'C'); await q.click('#quick-add-btn'); await q.waitForTimeout(200);
    check((await etat(q)).etat === 'modifie', 'une modification sur un tampon vierge allume le voyant orange');
    await q.click('#tb-save');
    await q.waitForTimeout(250);
    check(await q.evaluate(() => !!document.querySelector('.top-bar input.tb-titre-saisie')), 'Enregistrer sans nom demande le nom DANS la barre, à la place du titre');
    await q.keyboard.type('Mon premier morceau'); await q.keyboard.press('Enter');
    await q.waitForTimeout(300);
    check((await nomsEnBase(q)).includes('Mon premier morceau') && (await etat(q)).etat === 'enregistre', 'Entrée crée le morceau ; le voyant passe au vert');
    await q.close();

    // ======================================================================================================
    console.log('\n=== F. L\'ancienne carte Morceau : discrète sur ordinateur, intacte pour le téléphone ===');
    const f = await p.evaluate(() => ({
        tete: getComputedStyle(document.querySelector('#song-card > .card-head')).display,
        resume: document.getElementById('song-summary').getBoundingClientRect().height > 0,
        ids: ['song-select', 'song-rename', 'song-new', 'song-files', 'song-export', 'song-import', 'song-save', 'song-import-input'].filter(i => !document.getElementById(i)),
    }));
    check(f.tete === 'none', 'l\'en-tête de la carte Morceau (titre, liste, six boutons) est masqué : tout est dans la barre, pas en double');
    check(f.resume, 'le résumé « tempo · mesure · tonalité » reste (il disparaîtra avec le volet, lot 6)');
    check(f.ids.length === 0, 'aucun ancien élément n\'a disparu du DOM (le téléphone s\'en sert encore)');
    // seuil : sous 1180px, le voyant garde son point et perd son texte
    await p.setViewportSize({ width: 1100, height: 800 }); await p.waitForTimeout(250);
    const etroit = await p.evaluate(() => ({ texte: getComputedStyle(document.getElementById('tb-etat-texte')).display, mot: getComputedStyle(document.querySelector('.tb-save-mot')).display, point: document.querySelector('.tb-etat-point').getBoundingClientRect().width, titre: document.getElementById('tb-titre').getBoundingClientRect().width, save: document.getElementById('tb-save').getBoundingClientRect().height }));
    check(etroit.texte === 'none' && etroit.point > 0, 'à 1100px le voyant garde son point, son texte passe en infobulle (le titre garde sa place)');
    check(etroit.mot === 'none' && etroit.save === 32, 'à 1100px Enregistrer garde son icône seule, toujours à 32px');
    await p.setViewportSize({ width: 1440, height: 900 }); await p.waitForTimeout(200);

    // ======================================================================================================
    console.log('\n=== G. Verre dépoli ===');
    const verre = await p.evaluate(() => {
        document.documentElement.dataset.glass = '1';
        const flou = (el) => { const c = getComputedStyle(el); return (c.backdropFilter || c.webkitBackdropFilter || 'none'); };
        document.getElementById('tb-titre').click();
        const autre = document.getElementById('backup-scope-menu'); const etaitCache = autre.hidden; autre.hidden = false;
        const r = { barre: flou(document.querySelector('.top-bar')), menu: flou(document.getElementById('tb-menu')), fondMenu: getComputedStyle(document.getElementById('tb-menu')).backgroundColor, fondAutreMenu: getComputedStyle(autre).backgroundColor };
        autre.hidden = etaitCache;
        document.getElementById('tb-titre').click();
        delete document.documentElement.dataset.glass;
        return r;
    });
    check(verre.barre !== 'none' && verre.menu !== 'none', `verre allumé : la barre et le menu du morceau sont floutés (${verre.barre})`);
    // Le fond du menu est celui des AUTRES menus (le même jeton) : sa lisibilité est mesurée par verre_test, qui relève maintenant aussi cet
    // état (menuMorceau). Ici on vérifie seulement qu'il n'a pas son propre fond, à part.
    check(verre.fondMenu === verre.fondAutreMenu, `…et le fond du menu du morceau est celui des autres menus (${verre.fondMenu})`);

    // ======================================================================================================
    console.log('\n=== H. Téléphone : rien ne change avant le lot 10 ===');
    const t = await ouvrir({ width: 390, height: 844 }, ['Blues du dimanche', 'Autumn Leaves'], 's1');
    const tel = await t.evaluate(() => {
        const vis = (s) => { const e = document.querySelector(s); return !!e && e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden'; };
        const barre = [...document.querySelector('.top-bar').children].filter(e => e.getBoundingClientRect().width > 0).map(e => e.id || e.className.split(' ')[0]);
        return {
            titre: vis('#tb-titre'), save: vis('#tb-save'), etat: vis('#tb-etat'), centre: vis('#tb-centre'), liste: vis('#song-select'), sauve: vis('#song-save'),
            // « le dernier » se juge à l'ÉCRAN (abscisse), pas dans le DOM : le logo est le premier dans le HTML depuis le lot 3 et reste le dernier à l'écran
            logoDernier: (() => { const x = (s) => document.querySelector(s).getBoundingClientRect().x; return x('.top-bar .logo') > Math.max(x('#compte-cloud'), x('#open-settings'), x('#global-redo-btn'), x('#global-undo-btn')); })(),
            barre,
            bar: document.querySelector('.top-bar').getBoundingClientRect().width, W: innerWidth,
        };
    });
    check(!tel.titre && !tel.save && !tel.etat && !tel.centre, 'téléphone : ni titre-bouton, ni Enregistrer, ni voyant dans la barre');
    check(tel.liste && tel.sauve, 'téléphone : la carte Morceau garde sa liste déroulante et son bouton Enregistrer');
    check(tel.logoDernier && Math.abs(tel.bar - tel.W) < 1, 'téléphone : barre pleine largeur, le logo reste le dernier, comme avant');
    await t.click('#song-rename'); await t.waitForTimeout(150);
    check(await t.evaluate(() => { const i = document.querySelector('#song-card input.inline-rename-input'); return !!i && !i.classList.contains('tb-titre-saisie'); }), 'téléphone : renommer pose son champ dans la carte, pas dans la barre');
    await t.keyboard.press('Escape');
    await t.close();

    console.log(`\nErreurs de page : ${erreurs.length}${erreurs.length ? '\n  ' + erreurs.slice(0, 6).join('\n  ') : ''}`);
    check(erreurs.length === 0, 'aucune erreur JavaScript pendant tout le banc');
    await nav.close();
    bilan();
})();
