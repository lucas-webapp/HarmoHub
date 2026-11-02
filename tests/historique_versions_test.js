// L'HISTORIQUE DES VERSIONS (refonte, lot 3b — historique.js, script.js « HISTORIQUE DES VERSIONS », Paramètres › Historique et récupération).
//
// CE QUE L'UTILISATEUR A DEMANDÉ : « je veux bien garder le bouton enregistrer… enregistrement manuel. Mais garde quand même des
// enregistrements automatiques en arrière-plan pour pouvoir revenir en arrière » + « mettre versions de l'appli et récupérations
// historiques dans les paramètres ». Un enregistrement manuel n'est supportable que s'il y a une porte de sortie : ce banc éprouve cette porte.
//
// LES QUATRE FAÇONS DONT ELLE PEUT FAILLIR, et ce que le banc en fait :
//   1. ELLE NE GARDE PAS CE QU'IL FAUT — une version prise APRÈS l'opération ne protège de rien. Chaque opération lourde (transposer, supprimer
//      une partie, un morceau, importer, abandonner) est lancée par son VRAI geste, et on lit le CONTENU de la version : c'est celui d'AVANT.
//   2. ELLE GARDE TROP — un historique qui grossit sans fin, ou une version par seconde. Plafonds, ancienneté et doublons sont mesurés.
//   3. ELLE COÛTE DES DONNÉES — l'historique ne doit JAMAIS faire échouer l'enregistrement des morceaux (quota partagé de localStorage), ni
//      partir au cloud (1 Mio par document). Il vit dans IndexedDB : on vérifie qu'aucune trace n'est dans localStorage ni dans la synchro.
//   4. ELLE FAIT TOMBER L'APPLI — IndexedDB absent, bloqué, quota plein : l'appli doit enregistrer comme avant, sans erreur, et le DIRE.
//
// CE QUE LE BANC NE PEUT PAS DIRE : le comportement réel d'IndexedDB sur Safari / iOS (Chromium ici), ni ce que donne une vraie semaine de travail.
const { chromium } = require('playwright');
const { check, exiger, plan, bilan } = require('./_harness')('historique des versions');
const { estBruitReseau } = require('./_harness');

plan(68);

const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const mk = (root, quality, beats = 4) => ({ root, quality, beats, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held', instrument: 'piano', arpPattern: '', seqEdited: false, guitarLock: null, extraNotes: [], intensity: 75, intensityPerStep: {} });
const graine = ({ src, avec }) => {
    const m = eval('(' + src + ')');
    const A = [{ title: 'Couplet', chords: [m('C', 'maj7'), m('A', 'min7'), m('D', 'min7'), m('G', '7')] }, { title: 'Refrain', chords: [m('F', 'maj7'), m('E', 'min7')] }];
    const B = [{ title: 'Pont', chords: [m('E', 'min7'), m('A', '7')] }];
    const now = Date.now();
    const songs = [{ id: 's1', name: 'Démo', savedAt: now, sections: A }, { id: 's2', name: 'Autre morceau', savedAt: now - 1000, sections: B }];
    localStorage.setItem('harmohubSongs', JSON.stringify(songs));
    if (avec) { localStorage.setItem('harmohubCurrentSongId', 's1'); localStorage.setItem('myProgression', JSON.stringify({ sections: A })); }
    else { localStorage.removeItem('harmohubCurrentSongId'); localStorage.removeItem('myProgression'); }
    sessionStorage.setItem('cc_accueil_vu', '1');
};

(async () => {
    const nav = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const erreurs = [];
    const ouvrir = async (opts = {}) => {
        const ctx = await nav.newContext({ viewport: opts.viewport || { width: 1440, height: 900 }, acceptDownloads: true });
        const p = await ctx.newPage();
        p.on('pageerror', e => erreurs.push((opts.nom || '') + e.message));
        // Sans IndexedDB (cas G), fichiers.js — un AUTRE module, celui du dossier de rangement — le consigne lui-même et continue : ce n'est pas une panne ici.
        p.on('console', m => { if (m.type() === 'error' && !estBruitReseau(m.text()) && !/AudioContext/.test(m.text()) && !(opts.sansIndexedDB && /Lecture du dossier mémorisé impossible|IndexedDB indisponible/.test(m.text()))) erreurs.push((opts.nom || '') + 'console: ' + m.text()); });
        p.on('dialog', d => d.accept());
        if (opts.avant) await opts.avant(p, ctx);
        await p.goto(`${BASE}/index.html`);
        await p.evaluate(graine, { src: mk.toString(), avec: opts.sansMorceau ? false : true });
        await p.reload();
        await p.waitForTimeout(900);
        return p;
    };
    const versions = (p, songId) => p.evaluate((id) => HistoriqueVersions.lister(id).then(l => l.map(v => ({ id: v.id, motif: v.motif, libelle: v.libelle, songId: v.songId, accords: v.resume.accords, parties: v.resume.parties, premier: v.charge.sections[0] && v.charge.sections[0].chords[0] && v.charge.sections[0].chords[0].root, titres: v.charge.sections.map(s => s.title), bpm: v.charge.bpm }))), songId);
    const attendreVersion = async (p, songId, motif, essais = 20) => {
        for (let i = 0; i < essais; i++) { const l = await versions(p, songId); const v = l.find(x => x.motif === motif); if (v) return v; await p.waitForTimeout(100); }
        return null;
    };
    const accordsTampon = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections.flatMap(s => s.chords).map(c => c.root + c.quality));
    const accordsEnregistres = (p, id = 's1') => p.evaluate((i) => { const s = JSON.parse(localStorage.getItem('harmohubSongs')).find(x => x.id === i); return s ? s.sections.flatMap(x => x.chords).map(c => c.root + c.quality) : null; }, id);
    // Transposer d'un demi-ton vers le haut par le vrai bouton (rangé sous le résumé du morceau, qui se replie quand on s'occupe de la grille).
    const transposerHaut = async (p) => {
        // Sur ordinateur, « Transposer + » est dans la rangée de réglages au-dessus de la grille (lot 6a) ; sur téléphone, dans la carte Morceau dépliée.
        if (await p.locator('#rangee-reglages [data-rr-transposer="1"]').isVisible()) { await p.click('#rangee-reglages [data-rr-transposer="1"]'); return; }
        if (!(await p.locator('#transpose-song-up').isVisible())) { await p.click('#song-summary'); await p.waitForTimeout(150); }
        await p.click('#transpose-song-up');
    };
    // Dans un morceau de plusieurs parties, l'ajout rapide demande OÙ poser l'accord (le menu « section-picker ») : on choisit la première partie.
    const ajouterAccord = async (p, texte) => {
        await p.fill('#quick-add-input', texte);
        await p.click('#quick-add-btn');
        const choix = p.locator('#section-picker-menu:not([hidden]) button').first();
        if (await choix.isVisible().catch(() => false)) await choix.click();
        await p.waitForTimeout(250);
    };

    // ======================================================================================================
    console.log('\n=== A. Le moteur (historique.js) : garder, dédoublonner, élaguer ===');
    let p = await ouvrir({ nom: 'A: ' });
    check(await p.evaluate(() => HistoriqueVersions.disponible()), 'IndexedDB est disponible : l\'historique peut fonctionner');
    const charge = (n) => ({ sections: [{ title: 'A', chords: Array.from({ length: n }, (_, i) => ({ root: 'C', quality: 'maj', beats: 4, i })) }], structure: null, root: 'C', mode: 'maj', timeSig: '4/4', groove: 'straight', bpm: 100, instrumentMorceau: 'piano' });
    const r1 = await p.evaluate((c) => HistoriqueVersions.ajouter({ songId: 'x', songName: 'X', motif: 'auto', libelle: 'a', charge: c }), charge(3));
    const r2 = await p.evaluate((c) => HistoriqueVersions.ajouter({ songId: 'x', songName: 'X', motif: 'auto', libelle: 'a', charge: c }), charge(3));
    const r3 = await p.evaluate((c) => HistoriqueVersions.ajouter({ songId: 'x', songName: 'X', motif: 'enregistre', libelle: 'b', charge: c }), charge(4));
    check(r1.fait && !r2.fait && r2.raison === 'identique' && r3.fait, 'une version identique à la précédente n\'est pas gardée (une nuit sans rien toucher ne produit rien) ; un contenu différent l\'est');
    const zoom = await p.evaluate((c) => HistoriqueVersions.ajouter({ songId: 'x', songName: 'X', motif: 'auto', charge: { ...c, classicGridZoomLevelX: 2, seqZoomLevelY: 3 } }), charge(4));
    check(!zoom.fait && zoom.raison === 'identique', 'un simple changement de ZOOM (réglage de vue, pas de contenu) ne fait pas une version de plus');
    const l = await p.evaluate(() => HistoriqueVersions.lister('x'));
    check(l.length === 2 && l[0].date >= l[1].date && l[0].resume.accords === 4, 'lister rend les versions de la plus récente à la plus ancienne, avec leur résumé');
    const lu = await p.evaluate((id) => HistoriqueVersions.lire(id), l[0].id);
    check(lu && lu.charge.sections[0].chords.length === 4, 'lire retrouve une version par son identifiant, contenu complet');
    // plafond par morceau
    for (let i = 0; i < 46; i++) await p.evaluate(([c, i]) => HistoriqueVersions.ajouter({ songId: 'plein', songName: 'Plein', motif: 'auto', charge: c, date: Date.now() - (46 - i) * 1000 }), [charge(5 + i), i]);
    const plein = await p.evaluate(() => HistoriqueVersions.lister('plein'));
    check(plein.length === 40, `plafond de 40 versions par morceau : 46 ajoutées, ${plein.length} gardées`);
    check(plein[0].resume.accords === 5 + 45 && !plein.some(v => v.resume.accords === 5), 'et ce sont les plus RÉCENTES qui restent (la plus ancienne est partie, la dernière est là)');
    // ancienneté : les versions de plus de 90 jours partent, sauf les 5 plus récentes
    const vieux = Date.now() - 120 * 86400000;
    for (let i = 0; i < 8; i++) await p.evaluate(([c, i, d]) => HistoriqueVersions.ajouter({ songId: 'vieux', songName: 'Vieux', motif: 'auto', charge: c, date: d + i * 1000 }), [charge(2 + i), i, vieux]);
    const gardees = await p.evaluate(() => HistoriqueVersions.lister('vieux'));
    check(gardees.length === 5, `au-delà de 90 jours on ne garde que les 5 plus récentes de chaque morceau (8 anciennes → ${gardees.length}) : un morceau rouvert après six mois garde de quoi revenir en arrière`);
    const morceaux = await p.evaluate(() => HistoriqueVersions.morceaux());
    check(morceaux.some(m => m.songId === 'x' && m.n === 2) && morceaux.some(m => m.songId === 'plein' && m.n === 40), 'morceaux() résume l\'histoire de chaque morceau (nombre de versions)');
    const jamais = await p.evaluate(async () => { const r = []; try { r.push(await HistoriqueVersions.ajouter({ songId: 'x', charge: null })); r.push(await HistoriqueVersions.ajouter({})); r.push(await HistoriqueVersions.lire(undefined)); r.push(await HistoriqueVersions.lister(undefined)); return { ok: true, r }; } catch (e) { return { ok: false, e: String(e) }; } });
    check(jamais.ok && jamais.r[0].fait === false && jamais.r[1].fait === false, 'des entrées invalides ne lèvent JAMAIS : l\'historique ne doit pas pouvoir faire tomber l\'appli');
    await p.close();

    // ======================================================================================================
    console.log('\n=== B. Chaque opération lourde garde l\'état D\'AVANT (vrais gestes) ===');
    p = await ouvrir({ nom: 'B: ' });
    const avantTous = await accordsEnregistres(p);
    // enregistrement manuel
    await ajouterAccord(p, 'A#');
    await p.click('#tb-save');
    const vEnr = await attendreVersion(p, 's1', 'enregistre');
    check(!!vEnr && vEnr.accords === 7 && vEnr.libelle === 'Enregistrée', `Enregistrer laisse une version « Enregistrée » (${vEnr ? vEnr.accords : 0} accords, avec le A# ajouté)`);
    // transposition. Juste après un enregistrement, le tampon est IDENTIQUE à la version « Enregistrée » : une seconde version de même contenu
    // n'apporterait rien (l'état d'avant existe déjà, et sous un nom plus parlant) — c'est le doublon que la règle écarte.
    await transposerHaut(p);
    await p.waitForTimeout(500);
    check(!(await versions(p, 's1')).some(v => v.motif === 'avant-transposition'), 'transposer juste après avoir enregistré ne double pas la version : l\'état d\'avant existe déjà, c\'est « Enregistrée »');
    // …mais avec du travail non enregistré entre les deux, l'état d'avant est NOUVEAU et doit être gardé
    await ajouterAccord(p, 'C#');
    const avantSecondeTransposition = await accordsTampon(p);
    await transposerHaut(p);
    const vTr = await attendreVersion(p, 's1', 'avant-transposition');
    const apresTr = await accordsTampon(p);
    check(!!vTr && vTr.premier === avantSecondeTransposition[0].replace(/maj7|min7|7|maj|min/, '') && vTr.accords === avantSecondeTransposition.length,
        `la transposition garde une version AVANT : ses ${vTr && vTr.accords} accords commencent encore par ${vTr && vTr.premier} (le tampon, lui, est passé à ${apresTr[0]})`);
    check(vTr && /demi-ton/.test(vTr.libelle), `…et elle dit ce qui s'est passé (« ${vTr && vTr.libelle} »)`);
    // suppression d'une partie : le bouton de suppression de la partie « Refrain »
    await p.evaluate(() => window.app.deleteSection(1));
    const vSp = await attendreVersion(p, 's1', 'avant-suppression-partie');
    check(!!vSp && vSp.titres.includes('Refrain'), `la suppression d'une partie garde une version AVANT qui contient encore la partie supprimée (${vSp && vSp.titres.join(', ')})`);
    check(!(await p.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections.some(s => s.title === 'Refrain'))), '…alors que le tampon ne l\'a plus');
    // abandon : on modifie puis on change de morceau en refusant d'enregistrer
    await ajouterAccord(p, 'G#');
    const nAvantAbandon = (await accordsTampon(p)).length;
    await p.click('#tb-titre');
    await p.click('#tb-menu .tb-mi-morceau:not(.actif)');
    await p.waitForTimeout(250);
    await p.click('#unsaved-discard');
    const vAb = await attendreVersion(p, 's1', 'abandon');
    check(!!vAb && vAb.accords === nAvantAbandon, `« Continuer sans enregistrer » garde les modifications abandonnées (${vAb && vAb.accords} accords, dont le G#) avant de les perdre`);
    check(await p.evaluate(() => localStorage.getItem('harmohubCurrentSongId')) === 's2', '…et le changement de morceau a bien eu lieu');
    // suppression d'un morceau
    const nomS2 = await p.evaluate(() => JSON.parse(localStorage.getItem('harmohubSongs')).find(x => x.id === 's2').name);
    await p.evaluate(() => window.app.deleteSongById('s2'));
    const vSm = await attendreVersion(p, 's2', 'avant-suppression-morceau');
    check(!!vSm && vSm.accords === 2 && vSm.songId === 's2', 'la suppression d\'un morceau garde sa version enregistrée (retrouvable ensuite)');
    check(!(await p.evaluate(() => JSON.parse(localStorage.getItem('harmohubSongs')).some(x => x.id === 's2'))), '…alors que la bibliothèque ne l\'a plus');
    // import d'une bibliothèque qui écrase le morceau ouvert
    await p.evaluate(() => window.app.loadSong('s1'));
    const contenuAvantImport = await accordsEnregistres(p);
    const sauv = await p.evaluate(() => JSON.stringify({ app: 'HarmoHub', kind: 'library', songs: [{ id: 's1', name: 'Démo', savedAt: Date.now() + 5000, bpm: 90, sections: [{ title: 'Importé', chords: [{ root: 'D', quality: 'maj', beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' }] }] }] }));
    const importation = p.evaluate((txt) => window.app.importLibraryFile(new File([txt], 'sauvegarde.json')), sauv);
    await p.waitForSelector('#import-conflict-modal:not([hidden])', { timeout: 4000 });
    await p.click('#import-conflict-overwrite'); // le raccourci « écraser » choisit pour tous ET applique : la fenêtre se referme d'elle-même
    await importation;
    const vIm = await attendreVersion(p, 's1', 'avant-import');
    check(!!vIm && vIm.titres.includes('Couplet'), `l'import qui ÉCRASE un morceau garde l'ancien contenu (${vIm && vIm.titres.join(', ')})`);
    check((await accordsEnregistres(p)).length === 1, '…et le morceau contient bien le contenu importé maintenant (1 accord)');
    // import MIDI : le tampon reçoit des accords
    const nAvantMidi = (await versions(p, 's1')).filter(v => v.motif === 'avant-import').length;
    await p.evaluate(() => { const bytes = window.app.buildMidiFile(); window.app.importMidiChords(bytes, 'essai.mid'); });
    await p.waitForTimeout(500);
    check((await versions(p, 's1')).filter(v => v.motif === 'avant-import').length === nAvantMidi + 1, 'l\'import d\'un fichier MIDI garde aussi une version avant d\'ajouter ses accords');
    await p.close();

    // ======================================================================================================
    console.log('\n=== C. Les versions automatiques : cinq minutes de TRAVAIL ===');
    p = await ouvrir({ nom: 'C: ', avant: async (pg) => { await pg.clock.install(); } });
    const autos = async () => (await versions(p, 's1')).filter(v => v.motif === 'auto').length;
    await p.clock.fastForward('06:00');
    await p.waitForTimeout(300);
    check(await autos() === 0, 'six minutes SANS toucher à rien : aucune version (rien de neuf à garder)');
    await ajouterAccord(p, 'F#');
    await p.clock.fastForward('04:00');
    await p.waitForTimeout(300);
    check(await autos() === 0, 'une modification, mais quatre minutes seulement : pas encore de version (seuil de cinq minutes)');
    await p.clock.fastForward('02:00');
    await p.waitForTimeout(400);
    check(await autos() === 1, 'au-delà de cinq minutes de travail : une version automatique');
    const vAuto = (await versions(p, 's1')).find(v => v.motif === 'auto');
    check(vAuto && vAuto.accords === 7, `…qui contient bien le travail en cours, le F# compris (${vAuto && vAuto.accords} accords)`);
    await p.clock.fastForward('10:00');
    await p.waitForTimeout(300);
    check(await autos() === 1, 'dix minutes de plus sans modification : toujours une seule version');
    await ajouterAccord(p, 'C#');
    await p.clock.fastForward('06:00');
    await p.waitForTimeout(400);
    check(await autos() === 2, 'une nouvelle modification, six minutes plus tard : une deuxième version');
    // en quittant la page
    await ajouterAccord(p, 'D#');
    await p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await p.waitForTimeout(400);
    const vQuit = (await versions(p, 's1')).find(v => /quittant/.test(v.libelle));
    check(!!vQuit && vQuit.accords === 9, `en quittant la page avec du travail non enregistré : une version (${vQuit && vQuit.accords} accords, le D# compris)`);
    await p.close();

    // ======================================================================================================
    console.log('\n=== D. Paramètres › Historique et récupération, À propos ===');
    p = await ouvrir({ nom: 'D: ' });
    await ajouterAccord(p, 'A#'); await p.click('#tb-save');
    await attendreVersion(p, 's1', 'enregistre');
    await ajouterAccord(p, 'C#');
    await transposerHaut(p);
    await attendreVersion(p, 's1', 'avant-transposition');
    await p.click('#open-settings');
    await p.waitForSelector('#settings-panel-historique .hist-carte', { timeout: 4000 });
    const panneau = await p.evaluate(() => ({
        titre: document.getElementById('settings-title-historique').textContent,
        selection: document.getElementById('hist-morceau').selectedOptions[0].textContent,
        maintenant: document.getElementById('hist-maintenant') && document.getElementById('hist-maintenant').textContent,
        cartes: document.querySelectorAll('#hist-liste [data-version]').length,
        boutons: document.querySelectorAll('#hist-liste [data-restaurer]').length,
        tags: [...document.querySelectorAll('#hist-liste .hist-tag')].map(t => t.textContent),
        aide: document.querySelector('#settings-panel-historique .hist-aide').textContent,
    }));
    check(/Historique et récupération/.test(panneau.titre), 'les Paramètres ont un groupe « Historique et récupération »');
    check(/Démo/.test(panneau.selection) && /version/.test(panneau.selection), `le morceau ouvert est choisi d'office (${panneau.selection})`);
    check(/Maintenant/.test(panneau.maintenant) && /Brouillon modifié/.test(panneau.maintenant), 'la carte « Maintenant » dit que le brouillon est modifié (transposé, pas enregistré)');
    check(panneau.cartes >= 2 && panneau.cartes === panneau.boutons, `chaque version a son bouton Restaurer (${panneau.cartes} versions, ${panneau.boutons} boutons)`);
    check(panneau.tags.includes('Enregistrée') && panneau.tags.includes('Avant transposition'), `les étiquettes disent d'où vient chaque version (${panneau.tags.join(', ')})`);
    check(/cet appareil/.test(panneau.aide) && /5 minutes/.test(panneau.aide), 'le texte dit que les versions restent sur CET appareil et rappelle la règle des 5 minutes');
    const apropos = await p.evaluate(() => ({ v: document.getElementById('apropos-version').textContent, balise: (document.querySelector('script[src*="script.js"]').src.match(/v=(\d+)/) || [])[1], date: !!document.getElementById('apropos-date'), btn: !!document.getElementById('apropos-recharger') }));
    check(apropos.v === apropos.balise && /^\d{12}$/.test(apropos.v), `« À propos » donne la version réellement chargée (${apropos.v}), lue sur la balise script.js — pas un numéro écrit en dur`);
    check(apropos.date && apropos.btn, '…avec sa date et un bouton « Recharger l\'application »');
    await p.click('#settings-close');
    // l'entrée du menu du morceau
    await p.click('#tb-titre'); await p.click('#tb-menu [data-tb-action="historique"]');
    await p.waitForSelector('#settings-panel-historique .hist-carte');
    await p.waitForTimeout(250);
    // Le titre ne peut pas toujours remonter TOUT en haut : s'il reste peu de contenu dessous, la fenêtre ne défile pas davantage. Ce qui compte,
    // c'est que le groupe soit sous les yeux, avec sa première version, sans rien à faire défiler.
    const place = await p.evaluate(() => {
        const c = document.querySelector('#settings-overlay .settings-modal').getBoundingClientRect(); // (.settings-body n'a pas de boîte propre : c'est la fenêtre qui borne)
        const t = document.getElementById('settings-title-historique').getBoundingClientRect();
        const v = document.querySelector('#hist-liste .hist-carte').getBoundingClientRect();
        return { titreVisible: t.top >= c.top - 2 && t.bottom <= c.bottom, carteVisible: v.top >= c.top && v.bottom <= c.bottom, dessus: Math.round(t.top - c.top) };
    });
    check(place.titreVisible && place.carteVisible, `« Historique du morceau… » (menu du morceau) ouvre les Paramètres sur le bon groupe : titre et première version sous les yeux (titre à ${place.dessus}px du haut de la fenêtre)`);
    await p.click('#settings-close');
    await p.close();

    // ======================================================================================================
    console.log('\n=== E. Restaurer : sur place, un autre morceau, un morceau supprimé ===');
    p = await ouvrir({ nom: 'E: ' });
    const original = await accordsEnregistres(p);
    await transposerHaut(p);
    const vOrig = await attendreVersion(p, 's1', 'avant-transposition');
    const transpose = await accordsTampon(p);
    await p.click('#open-settings');
    await p.waitForSelector('#settings-panel-historique [data-restaurer]');
    await p.click(`[data-restaurer="${vOrig.id}"]`);
    await p.waitForTimeout(600);
    const apresRestaurer = await accordsTampon(p);
    check(JSON.stringify(apresRestaurer) === JSON.stringify(original), 'A. restaurer sur place : le brouillon retrouve les accords d\'AVANT la transposition');
    check(JSON.stringify(await accordsEnregistres(p)) === JSON.stringify(original), '…et le morceau ENREGISTRÉ n\'a pas bougé (restaurer n\'écrase rien tant qu\'on n\'a pas cliqué Enregistrer)');
    check(await p.evaluate(() => hasUnsavedChanges === true), '…le brouillon est marqué « non enregistré » : on décide');
    const vAr = await attendreVersion(p, 's1', 'avant-restauration');
    check(!!vAr && vAr.premier === transpose[0].replace(/maj7|min7|7|maj|min/, ''), 'l\'état d\'avant la restauration (le transposé) a été gardé : on peut revenir sur ses pas');
    check(await p.evaluate(() => /Clique Enregistrer/.test(document.getElementById('hist-message').textContent && !document.getElementById('hist-message').hidden ? document.getElementById('hist-message').textContent : '')), 'un message dit « Clique Enregistrer pour la garder »');
    await p.click('#settings-close');
    await p.keyboard.press('Control+z');
    await p.waitForTimeout(400);
    check(JSON.stringify(await accordsTampon(p)) === JSON.stringify(transpose), 'Ctrl+Z défait la restauration (retour au transposé)');
    await p.keyboard.press('Control+y');
    await p.waitForTimeout(400);
    await p.click('#tb-save'); await p.waitForTimeout(300);
    check(JSON.stringify(await accordsEnregistres(p)) === JSON.stringify(original), 'Enregistrer garde la version restaurée : le morceau enregistré a maintenant le contenu d\'avant');

    // B. une version d'un AUTRE morceau (qui existe encore)
    await ajouterAccord(p, 'G#');
    await p.evaluate(() => HistoriqueVersions.ajouter({ songId: 's2', songName: 'Autre morceau', motif: 'auto', libelle: 'v2', charge: { sections: [{ title: 'Ancien pont', chords: [{ root: 'G', quality: 'maj', beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' }] }], root: 'G', mode: 'maj', timeSig: '4/4', groove: 'straight', bpm: 77 } }));
    await p.click('#open-settings');
    await p.waitForSelector('#hist-morceau');
    await p.selectOption('#hist-morceau', 's2');
    await p.waitForSelector('#hist-liste [data-restaurer]');
    await p.click('#hist-liste [data-restaurer]');
    await p.waitForSelector('#unsaved-modal:not([hidden])', { timeout: 3000 });
    check(true, 'B. restaurer une version d\'un AUTRE morceau avec un brouillon modifié passe par la confirmation habituelle');
    await p.click('#unsaved-discard');
    await p.waitForTimeout(600);
    check(await p.evaluate(() => localStorage.getItem('harmohubCurrentSongId')) === 's2' && await p.evaluate(() => hasUnsavedChanges === true), '…le morceau s\'ouvre, la version est dans le brouillon, non enregistrée');
    check((await accordsTampon(p)).join() === 'Gmaj' && await p.evaluate(() => document.getElementById('bpm').value) === '77', '…avec le contenu ET le tempo de la version (G, 77 BPM)');
    await p.click('#settings-close');

    // C. un morceau supprimé
    await p.evaluate(() => window.app.loadSong('s1'));
    await p.evaluate(() => window.app.deleteSongById('s1'));
    await attendreVersion(p, 's1', 'avant-suppression-morceau');
    check(!(await p.evaluate(() => JSON.parse(localStorage.getItem('harmohubSongs')).some(x => x.id === 's1'))), 'C. le morceau « Démo » est supprimé de la bibliothèque');
    await p.click('#open-settings');
    await p.waitForSelector('#hist-morceau');
    const listeSuppr = await p.evaluate(() => [...document.querySelectorAll('#hist-morceau option')].map(o => o.textContent));
    check(listeSuppr.some(t => /Démo.*supprimé/.test(t)), `le morceau supprimé reste dans l'historique, marqué (${listeSuppr.find(t => /supprimé/.test(t))})`);
    await p.selectOption('#hist-morceau', 's1');
    await p.waitForSelector('#hist-liste [data-restaurer]');
    await p.click('#hist-liste [data-restaurer]');
    await p.waitForTimeout(700);
    const apres = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('harmohubSongs')); const id = localStorage.getItem('harmohubCurrentSongId'); return { noms: s.map(x => x.name), courant: s.find(x => x.id === id), modifie: hasUnsavedChanges }; });
    check(apres.noms.includes('Démo') && apres.courant && apres.courant.name === 'Démo' && apres.modifie === false, `restaurer une version d'un morceau supprimé le fait revenir dans Mes morceaux (« ${apres.courant && apres.courant.name} »), ouvert et enregistré`);
    await p.click('#settings-close');
    await p.close();

    // tampon jamais nommé
    p = await ouvrir({ nom: 'E2: ', sansMorceau: true });
    await ajouterAccord(p, 'C'); await ajouterAccord(p, 'F');
    await p.evaluate(() => window.app.transposeSong(2));
    const vSans = await attendreVersion(p, '', 'avant-transposition');
    check(!!vSans && vSans.songId === '', 'un tampon qui n\'a jamais eu de nom a aussi son historique (c\'est là qu\'un plantage coûte le plus)');
    await p.click('#open-settings');
    await p.waitForSelector('#hist-morceau');
    check(await p.evaluate(() => document.getElementById('hist-morceau').selectedOptions[0].textContent.startsWith('Morceau sans nom')), '…listé sous « Morceau sans nom »');
    await p.click('#hist-liste [data-restaurer]');
    await p.waitForTimeout(700);
    check(await p.evaluate(() => document.getElementById('unsaved-modal').hidden), 'restaurer le tampon sans nom depuis sa propre histoire ne pose pas la question « continuer sans enregistrer ? » (rien à y protéger : l\'état actuel est gardé)');
    const recupere = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('harmohubSongs')); return s.map(x => x.name); });
    check(recupere.includes('Morceau récupéré'), `la version du tampon sans nom redevient un morceau (« Morceau récupéré ») plutôt que d'être perdue (${recupere.join(', ')})`);
    await p.close();

    // ======================================================================================================
    console.log('\n=== F. L\'historique ne coûte rien à l\'enregistrement ni au cloud ===');
    p = await ouvrir({ nom: 'F: ' });
    const cles0 = await p.evaluate(() => Object.keys(localStorage).sort());
    const taille0 = await p.evaluate(() => localStorage.getItem('harmohubSongs').length);
    for (let i = 0; i < 12; i++) { await ajouterAccord(p, ['C', 'D', 'E', 'F', 'G', 'A'][i % 6]); await p.click('#tb-save'); await p.waitForTimeout(120); }
    await p.waitForTimeout(500);
    const nbVersions = (await versions(p, 's1')).length;
    const cles1 = await p.evaluate(() => Object.keys(localStorage).sort());
    const texteLS = await p.evaluate(() => JSON.stringify(localStorage));
    check(nbVersions >= 10, `douze enregistrements laissent leurs versions (${nbVersions})`);
    check(!cles1.some(k => /histor|version/i.test(k)) && !/avant-transposition|"motif"/.test(texteLS), 'aucune version dans localStorage : le quota (≈ 5 Mo) partagé avec la bibliothèque n\'est jamais entamé');
    check(await p.evaluate(() => { const liste = typeof REGLAGES_SYNCHRONISES !== 'undefined' ? REGLAGES_SYNCHRONISES : null; return !!liste && !JSON.stringify(liste).match(/histor|version/i); }), 'l\'historique n\'est pas dans la liste des réglages synchronisés : il reste sur l\'appareil (le document cloud est limité à 1 Mio)');
    const nouvellesCles = cles1.filter(k => !cles0.includes(k));
    check(nouvellesCles.every(k => !/histor|version/i.test(k)), `aucune nouvelle clé liée à l'historique ${nouvellesCles.length ? '(' + nouvellesCles.join(', ') + ' : sans rapport)' : ''}`);
    await p.close();

    // ======================================================================================================
    console.log('\n=== G. Quand le stockage est refusé : l\'appli enregistre comme avant, et le dit ===');
    // G1. IndexedDB absent
    p = await ouvrir({ nom: 'G1: ', sansIndexedDB: true, avant: async (pg) => { await pg.addInitScript(() => { Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true }); }); } });
    check(await p.evaluate(() => HistoriqueVersions.disponible()) === false, 'G1. sans IndexedDB : l\'historique se déclare indisponible (au lieu de lever)');
    await ajouterAccord(p, 'A#');
    await p.click('#tb-save');
    await p.waitForTimeout(400);
    check((await accordsEnregistres(p)).length === 7, '…et Enregistrer fonctionne comme avant (7 accords écrits dans le morceau)');
    await p.click('#open-settings');
    await p.waitForSelector('#settings-panel-historique');
    await p.waitForTimeout(300);
    check(await p.evaluate(() => !!document.getElementById('hist-indispo') && /Enregistrer fonctionne/.test(document.getElementById('hist-indispo').textContent)), '…et les Paramètres le DISENT, sans que l\'enregistrement soit en cause');
    await p.click('#settings-close');
    await p.close();
    // G2. l'ouverture de la base lève
    p = await ouvrir({ nom: 'G2: ', sansIndexedDB: true, avant: async (pg) => { await pg.addInitScript(() => { const o = indexedDB.open.bind(indexedDB); indexedDB.open = function () { throw new DOMException('stockage bloqué', 'SecurityError'); }; }); } });
    await transposerHaut(p);
    await p.waitForTimeout(500);
    check(await p.evaluate(() => HistoriqueVersions.disponible()) === false && (await accordsTampon(p))[0] !== 'Cmaj7', 'G2. une base qui refuse de s\'ouvrir : la transposition a quand même lieu (l\'historique ne bloque jamais l\'opération)');
    await p.close();
    // G3. quota plein au premier essai
    p = await ouvrir({ nom: 'G3: ' });
    await p.evaluate(() => {
        let n = 0; const orig = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function (...a) { if (n++ === 0) throw new DOMException('quota', 'QuotaExceededError'); return orig.apply(this, a); };
    });
    const q = await p.evaluate((c) => HistoriqueVersions.ajouter({ songId: 'q', songName: 'Q', motif: 'auto', charge: c }), charge(3));
    check(q.fait === true, 'G3. quota plein au premier essai : on fait de la place et on RETENTE une fois — la version est gardée');
    await p.evaluate(() => { IDBObjectStore.prototype.put = function () { throw new DOMException('quota', 'QuotaExceededError'); }; });
    const q2 = await p.evaluate((c) => HistoriqueVersions.ajouter({ songId: 'q', songName: 'Q', motif: 'auto', charge: c }), charge(9));
    check(q2.fait === false && q2.raison === 'quota', 'quota qui ne cède pas : on abandonne proprement (raison « quota »), sans lever');
    await ajouterAccord(p, 'A#'); await p.click('#tb-save'); await p.waitForTimeout(300);
    check((await accordsEnregistres(p)).length === 7, '…et l\'enregistrement du morceau n\'en souffre pas');
    await p.close();

    // ======================================================================================================
    console.log('\n=== H. Téléphone ===');
    p = await ouvrir({ nom: 'H: ', viewport: { width: 390, height: 844 } });
    await ajouterAccord(p, 'A#'); await p.click('#song-save'); await attendreVersion(p, 's1', 'enregistre');
    await p.evaluate(() => window.app.openSettings());
    await p.waitForSelector('#settings-panel-historique .hist-carte');
    const tel = await p.evaluate(() => { const c = document.querySelector('.settings-content'); const bt = document.querySelector('#hist-liste [data-restaurer]').getBoundingClientRect(); return { deborde: c.scrollWidth - c.clientWidth, h: bt.height, ds: bt.right <= innerWidth }; });
    check(tel.deborde <= 1 && tel.ds, `téléphone : le panneau ne déborde pas (${tel.deborde}px) et le bouton Restaurer reste à l'écran`);
    await p.close();

    console.log(`\nErreurs de page : ${erreurs.length}${erreurs.length ? '\n  ' + erreurs.slice(0, 6).join('\n  ') : ''}`);
    check(erreurs.length === 0, 'aucune erreur JavaScript pendant tout le banc');
    await nav.close();
    bilan();
})();
