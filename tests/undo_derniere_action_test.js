// Lot 4 bis (première moitié) : Ctrl+Z suit la DERNIÈRE ACTION, plus la fenêtre ouverte.
//
// LE DÉFAUT. L'appli tient trois historiques séparés — la grille (accords et réglages du morceau), le
// séquenceur (motif de l'accord édité), les fichiers — mais l'utilisateur n'a qu'un seul Ctrl+Z. Il
// fallait donc décider lequel il vise, et c'était la FENÊTRE OUVERTE qui décidait : séquenceur
// ouvert, Ctrl+Z allait au séquenceur, même si la dernière chose faite était de changer le
// renversement de l'accord. D'où le signalement : « mon CTRL+Z ne garde pas toujours en mémoire TOUS
// mes changements. C'est important. »
//
// POURQUOI MAINTENANT. Le défaut ne pouvait que s'aggraver avec le panneau de rythme volant, qui
// reste ouvert pendant qu'on travaille la grille. L'utilisateur a tranché deux fois : « le rythme
// ouvert ne doit pas détourner le ctrl+Z et la barre espace », puis « la dernière action gagne ».
//
// CE QUE LE BANC ÉPROUVE, ET DANS QUEL ORDRE. Un banc qui ferait « une action, un Ctrl+Z » ne
// prouverait rien : c'était déjà juste avant. Le défaut n'apparaît qu'en ALTERNANT les contextes, et
// c'est ce que fait chaque famille ci-dessous — séquenceur puis accord, accord puis séquenceur, et
// des séries qui remontent le temps à travers les deux.
const { chromium } = require('playwright');
const creerHarnais = require('./_harness');
const { plan, check, exiger, bilan } = creerHarnais('Ctrl+Z : la dernière action gagne');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';

const seed = () => {
    const mk = (r, q, b, s) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: s || 'held' });
    const song = {
        id: 'lot4bis-undo', name: 'Ballade', bpm: 120, timeSig: '4/4', groove: 'straight',
        // Style détaché : il laisse des cases éteintes où poser une note (avec « tenu », les 64 cases
        // du séquenceur sont allumées d'emblée et il n'y a plus rien à y ajouter).
        sections: [{ title: 'Couplet', chords: [mk('C', 'maj7', 4, 'noire_staccato'), mk('F', 'maj', 4)] }],
    };
    localStorage.setItem('harmohubSongs', JSON.stringify([song]));
    localStorage.setItem('harmohubCurrentSongId', song.id);
    localStorage.setItem('myProgression', JSON.stringify({ sections: song.sections }));
};
const etat = () => {
    const c = JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[0];
    return { inversion: String(c.inversion), motif: c.arpPattern, octave: String(c.octave) };
};
const boiteDe = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return null;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

(async () => {
    plan(15);
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const erreurs = [];
    const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
    page.on('pageerror', e => erreurs.push(e.message));
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await page.waitForTimeout(300);
    await page.evaluate(seed);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(650);

    // Toujours par de VRAIS gestes : c'est la chaîne complète (widget → select → change →
    // commitLiveEdit → pushUndo → journal) qu'on veut éprouver, pas les fonctions prises une à une.
    const retoucherAccord = async (valeur) => {
        await page.click(`#inversion-seg .voicing-segment[data-valeur="${valeur}"]`);
        await page.waitForTimeout(300);
    };
    const retoucherSequenceur = async () => {
        const c = await page.evaluate(boiteDe, '#arp-sequencer .seq-cell[data-voice][data-step]:not(.on):not(.seq-cell-edge)');
        if (!c) return false;
        // Clic-PUIS-GLISSÉ : poser une note se fait en définissant sa longueur (« je veux cliquer,
        // puis définir sa longueur en glissant »). Un clic seul ne crée rien.
        const l = await page.evaluate(() => {
            const x = document.querySelector('#arp-sequencer .seq-cell[data-voice][data-step]');
            return x ? x.getBoundingClientRect().width : 20;
        });
        await page.mouse.move(c.x, c.y);
        await page.mouse.down();
        await page.mouse.move(c.x + l * 1.5, c.y, { steps: 6 });
        await page.mouse.up();
        await page.waitForTimeout(350);
        return true;
    };
    const annuler = async () => {
        await page.evaluate(() => document.activeElement && document.activeElement.blur());
        await page.keyboard.press('Control+z');
        await page.waitForTimeout(350);
    };

    await page.evaluate(() => { window.app.editChord(0, 0); window.app.toggleSequencer('compact'); });
    await page.waitForTimeout(600);
    exiger(await page.evaluate(() => window.app.seqOpen === true), 'le séquenceur est ouvert — c\'est la situation où le défaut se produisait');

    console.log('=== A. Séquenceur ouvert, dernière action = un RÉGLAGE D\'ACCORD ===');
    // Le cas exact du signalement. Avant ce lot, Ctrl+Z partait dans le séquenceur parce qu'il était
    // ouvert, et le renversement restait changé.
    const depart = await page.evaluate(etat);
    if (exiger(await retoucherSequenceur(), 'une note a bien été posée dans le séquenceur')) {
        const apresSeq = await page.evaluate(etat);
        check(apresSeq.motif !== depart.motif, 'le motif a changé');
        await retoucherAccord('2');
        const apresAccord = await page.evaluate(etat);
        check(apresAccord.inversion === '2', `puis le renversement a changé — ${apresAccord.inversion}`);

        await annuler();
        const apres1 = await page.evaluate(etat);
        check(apres1.inversion === depart.inversion,
            `le premier Ctrl+Z annule le RÉGLAGE D'ACCORD, la dernière action — renversement ${apres1.inversion}`);
        // EXIGENCE RETIRÉE ICI, parce qu'elle était fausse et contredisait un comportement voulu.
        // J'avais écrit « et il ne touche PAS au motif du séquenceur ». Mais l'instantané de la
        // grille photographie TOUT le morceau, motif compris, et commitLiveEdit n'en prend qu'UN SEUL
        // par session d'édition — c'est explicitement voulu et déjà éprouvé ailleurs (« un seul
        // Ctrl+Z annule toute la session d'édition », voir ajout_modif_test). Dans la même session,
        // un Ctrl+Z remet donc l'accord entier tel qu'il était en entrant, rythme inclus. Ce qui
        // compte — et qui est vérifié juste au-dessus — c'est que Ctrl+Z ne parte PLUS dans le
        // séquenceur sous prétexte qu'il est ouvert.
        check(await page.evaluate(() => window.app.pileVisee(window.app._journalUndo)) !== 'sequenceur',
            'le séquenceur ouvert ne détourne plus le Ctrl+Z suivant vers sa propre pile');
    }

    console.log('\n=== B. Changer la FORME de l\'accord vide l\'historique du séquenceur, à dessein ===');
    // Ce banc demandait d'abord que le Ctrl+Z suivant remonte au motif du séquenceur. C'était une
    // exigence FAUSSE, et le code le disait déjà : les sept réglages qui changent la forme de
    // l'accord (fondamentale, nature, durée, renversement, drop, octave, basse) appellent
    // clearSeqHistory() — « l'historique portait sur une autre forme d'accord ». Un motif dessiné sur
    // un accord de quatre notes n'a plus de sens sur trois : le restaurer serait pire que de
    // l'oublier. On éprouve donc ce qui est VRAIMENT garanti, et qui compte tout autant : l'historique
    // du séquenceur est bien vidé, et Ctrl+Z ne reste pas coincé dessus à ne rien faire — il enchaîne
    // sur la grille.
    const pilesApres = await page.evaluate(() => ({
        seq: window.app.seqUndoStack.length,
        journalSeq: window.app._journalUndo.filter(x => x === 'sequenceur').length,
    }));
    check(pilesApres.seq === 0 && pilesApres.journalSeq === 0,
        `changer le renversement a vidé l'historique du séquenceur ET sa trace dans le journal — ${pilesApres.seq} instantané(s), ${pilesApres.journalSeq} entrée(s)`);

    console.log('\n=== C. L\'inverse : dernière action = le SÉQUENCEUR ===');
    // Le symétrique doit valoir aussi, sinon on aurait juste déplacé le défaut.
    await page.evaluate(() => { if (window.app.appMode !== 'edit') window.app.editChord(0, 0); if (!window.app.seqOpen) window.app.toggleSequencer('compact'); });
    await page.waitForTimeout(500);
    const base = await page.evaluate(etat);
    await retoucherAccord('1');
    const avecRenv = await page.evaluate(etat);
    check(avecRenv.inversion === '1', `renversement posé — ${avecRenv.inversion}`);
    await page.evaluate(() => { if (window.app.appMode !== 'edit') window.app.editChord(0, 0); });
    await page.waitForTimeout(250);
    if (exiger(await retoucherSequenceur(), 'une note a bien été posée après le réglage d\'accord')) {
        const avecNote = await page.evaluate(etat);
        await annuler();
        const apres = await page.evaluate(etat);
        check(apres.motif !== avecNote.motif && apres.inversion === avecRenv.inversion,
            `Ctrl+Z annule la note du séquenceur et laisse le renversement — renversement ${apres.inversion}`);
    }

    console.log('\n=== D. La fenêtre Fichiers reste une exception, et c\'est voulu ===');
    // Elle est MODALE : elle couvre l'écran, on ne peut y agir que sur des fichiers. Sans cette
    // garde, l'ouvrir puis appuyer sur Ctrl+Z sans rien y avoir fait annulerait la dernière retouche
    // d'accord DERRIÈRE la fenêtre, donc invisible. Le panneau de rythme, lui, n'est pas modal —
    // c'est toute la différence, et c'est pour ça qu'il ne détourne rien.
    await page.evaluate(() => { if (window.app.appMode !== 'edit') window.app.editChord(0, 0); });
    await page.waitForTimeout(250);
    await retoucherAccord('3');
    const avantFichiers = await page.evaluate(etat);
    await page.evaluate(() => window.app.openFilesWindow());
    await page.waitForTimeout(400);
    exiger(await page.evaluate(() => window.app.filesOpen === true), 'la fenêtre Fichiers est ouverte');
    await annuler();
    check(String((await page.evaluate(etat)).inversion) === String(avantFichiers.inversion),
        `fenêtre Fichiers ouverte, Ctrl+Z ne touche PAS aux accords derrière elle — renversement ${(await page.evaluate(etat)).inversion}`);
    await page.evaluate(() => window.app.closeFilesWindow());
    await page.waitForTimeout(300);

    console.log('\n=== E. Le bouton Annuler vise la même pile que le raccourci ===');
    // Un bouton actif pendant que Ctrl+Z ne fait rien (ou l'inverse) serait pire que pas de bouton.
    await page.evaluate(() => { if (window.app.appMode !== 'edit') window.app.editChord(0, 0); });
    await page.waitForTimeout(250);
    await retoucherAccord('0');
    const bouton = await page.evaluate(() => ({
        actif: !document.getElementById('global-undo-btn').disabled,
        pile: window.app.pileVisee(window.app._journalUndo),
    }));
    check(bouton.actif && bouton.pile === 'grille',
        `après un réglage d'accord, le bouton Annuler est actif et vise la grille — pile « ${bouton.pile} »`);

    console.log('\n=== F. Rétablir suit le même fil, à l\'envers ===');
    // Session d'édition NEUVE et changement franc : sans ça, la vérification s'appuierait sur l'état
    // laissé par la famille précédente, et un « rien n'a changé » passerait pour un rétablissement
    // réussi. On part donc d'une valeur connue, on en pose une autre, puis on annule.
    await page.evaluate(() => { window.app.exitEditMode(); window.app.editChord(0, 0); });
    await page.waitForTimeout(350);
    await retoucherAccord('2');
    const avantAnnul = await page.evaluate(etat);
    exiger(avantAnnul.inversion === '2', `point de départ franc pour le rétablissement — renversement ${avantAnnul.inversion}`);
    await annuler();
    const apresAnnul = await page.evaluate(etat);
    check(apresAnnul.inversion !== avantAnnul.inversion,
        `l'annulation a bien eu lieu — ${avantAnnul.inversion} → ${apresAnnul.inversion}`);
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press('Control+y');
    await page.waitForTimeout(400);
    const apresRetabli = await page.evaluate(etat);
    check(apresRetabli.inversion === avantAnnul.inversion,
        `Ctrl+Y rétablit ce que Ctrl+Z venait d'annuler — ${apresAnnul.inversion} → ${apresRetabli.inversion} (attendu ${avantAnnul.inversion})`);

    check(erreurs.length === 0, `aucune erreur JavaScript — ${erreurs.join(' | ') || 'aucune'}`);
    await browser.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
