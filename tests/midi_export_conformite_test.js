// CONFORMITÉ DU FICHIER .MID EXPORTÉ (voir buildMidiFile dans script.js).
//
// POURQUOI CE BANC EXISTE. « Je n'ai pas MuseScore » — l'utilisateur ne peut pas ouvrir les fichiers
// qu'il exporte pour vérifier qu'ils sont bons. Les autres bancs MIDI font un ALLER-RETOUR : ils
// exportent puis réimportent avec notre propre analyseur. Ça ne prouve rien sur MuseScore, GarageBand
// ou Logic : si notre écrivain et notre lecteur partagent le même malentendu, l'aller-retour passe et
// le fichier reste illisible ailleurs.
//
// Ce banc-ci relit donc les octets avec un lecteur écrit DEPUIS LA NORME (Standard MIDI File 1.0),
// sans réutiliser une seule ligne de l'appli. Il ne vérifie pas « ce qu'on voulait écrire » mais
// « ce qu'un logiciel tiers y trouvera ».
//
// (Recoupé une fois à la main, hors dépôt, avec @tonejs/midi — un lecteur tiers réel : mêmes tempo,
// même programme d'instrument, mêmes durées. C'est ce recoupement qui a révélé l'encodage du texte,
// voir asciiPourMidi.)
const { chromium } = require('playwright');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('conformité du MIDI exporté');

plan(24);

// ---------------------------------------------------------------------------------------------
// Lecteur SMF minimal, écrit d'après la norme. Volontairement strict et bête : il n'essaie pas de
// rattraper un fichier bancal, il signale.
// ---------------------------------------------------------------------------------------------
function lireSMF(octets) {
    let i = 0;
    const anomalies = [];
    const u32 = () => ((octets[i++] << 24) | (octets[i++] << 16) | (octets[i++] << 8) | octets[i++]) >>> 0;
    const u16 = () => (octets[i++] << 8) | octets[i++];
    const marque = () => String.fromCharCode(octets[i++], octets[i++], octets[i++], octets[i++]);

    const entete = marque();
    if (entete !== 'MThd') anomalies.push(`en-tête « ${entete} » au lieu de MThd`);
    const tailleEntete = u32();
    if (tailleEntete !== 6) anomalies.push(`longueur d'en-tête ${tailleEntete} au lieu de 6`);
    const format = u16(), nbPistes = u16(), division = u16();
    i = 8 + tailleEntete; // la norme autorise un en-tête plus long : on saute ce qu'on ne connaît pas

    const pistes = [];
    while (i < octets.length) {
        const m = marque();
        const taille = u32();
        const fin = i + taille;
        if (m !== 'MTrk') { anomalies.push(`chunk « ${m} » inattendu`); i = fin; continue; }
        if (fin > octets.length) { anomalies.push(`piste ${pistes.length} annoncée ${taille} octets, dépasse le fichier`); break; }

        const piste = { evenements: [], finDePiste: false, tick: 0 };
        let statutCourant = 0, tick = 0;
        while (i < fin) {
            // Delta-time : entier de longueur variable, 4 octets au maximum.
            let delta = 0, n = 0;
            for (;;) {
                const b = octets[i++];
                delta = (delta << 7) | (b & 0x7f);
                if (++n > 4) { anomalies.push(`delta-time de plus de 4 octets dans la piste ${pistes.length}`); break; }
                if (!(b & 0x80)) break;
            }
            tick += delta;
            let statut = octets[i];
            if (statut & 0x80) i++; else statut = statutCourant; // statut courant (running status)
            if (statut < 0xf0) statutCourant = statut;

            if (statut === 0xff) {
                const type = octets[i++];
                let taille2 = 0, n2 = 0;
                for (;;) { const b = octets[i++]; taille2 = (taille2 << 7) | (b & 0x7f); if (++n2 > 4 || !(b & 0x80)) break; }
                const donnees = octets.slice(i, i + taille2); i += taille2;
                if (type === 0x2f) piste.finDePiste = true;
                else if (piste.finDePiste) anomalies.push(`événement après la fin de piste ${pistes.length}`);
                piste.evenements.push({ tick, meta: type, donnees });
            } else if (statut === 0xf0 || statut === 0xf7) {
                let taille2 = 0; for (;;) { const b = octets[i++]; taille2 = (taille2 << 7) | (b & 0x7f); if (!(b & 0x80)) break; }
                i += taille2;
            } else {
                const haut = statut & 0xf0, canal = statut & 0x0f;
                const d1 = octets[i++];
                const d2 = (haut === 0xc0 || haut === 0xd0) ? null : octets[i++];
                piste.evenements.push({ tick, haut, canal, d1, d2 });
            }
        }
        if (i !== fin) anomalies.push(`piste ${pistes.length} : longueur annoncée ${taille}, ${i - (fin - taille)} octets consommés`);
        piste.tick = tick;
        pistes.push(piste);
        i = fin;
    }
    return { format, nbPistes, division, pistes, anomalies };
}

// Apparie Note On / Note Off. Une note jamais refermée reste bloquée à l'infini dans un synthé.
function notesDe(piste) {
    const ouvertes = new Map(), notes = [];
    for (const e of piste.evenements) {
        if (e.haut === 0x90 && e.d2 > 0) {
            const cle = `${e.canal}:${e.d1}`;
            if (ouvertes.has(cle)) notes.push({ ...ouvertes.get(cle), fin: e.tick, superposee: true });
            ouvertes.set(cle, { note: e.d1, canal: e.canal, velocite: e.d2, debut: e.tick });
        } else if (e.haut === 0x80 || (e.haut === 0x90 && e.d2 === 0)) {
            const cle = `${e.canal}:${e.d1}`;
            if (ouvertes.has(cle)) { notes.push({ ...ouvertes.get(cle), fin: e.tick }); ouvertes.delete(cle); }
            else notes.push({ note: e.d1, canal: e.canal, debut: null, fin: e.tick, orpheline: true });
        }
    }
    return { notes, restees: [...ouvertes.values()] };
}

const textes = (piste, type) => piste.evenements
    .filter((e) => e.meta === type)
    .map((e) => ({ tick: e.tick, texte: String.fromCharCode(...e.donnees), octets: e.donnees }));

(async () => {
    const navigateur = await chromium.launch();
    const erreurs = [];
    const page = await navigateur.newPage({ viewport: { width: 1300, height: 950 } });
    page.on('pageerror', (e) => erreurs.push('pageerror: ' + e.message));
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(600);

    // Un morceau qui couvre ce qui casse d'habitude : accords tenus et détachés, durées inégales, une
    // partie SANS titre (le marqueur doit quand même exister), et des ACCENTS partout — c'est une
    // appli française, les vrais titres en portent.
    const poser = async () => page.evaluate(() => {
        const mk = (root, quality, beats, extra = {}) => Object.assign({
            root, quality, beats, inversion: 0, drop: 'none', octave: 3, bass: null,
            playStyle: 'held', arpPattern: '', seqEdited: false, guitarLock: null,
            extraNotes: [], intensity: 75, intensityPerStep: {},
        }, extra);
        const sections = [
            { title: 'Couplet (été)', chords: [mk('C', 'maj', 4), mk('A', 'min7', 4), mk('F', 'maj', 2), mk('G', 'dom7', 2)] },
            { title: '', chords: [mk('D', 'min', 4), mk('G', 'maj', 4, { playStyle: 'noire_staccato' })] },
            { title: 'Refrain à Noël', chords: [mk('C', 'maj7', 8)] },
        ];
        localStorage.setItem('myProgression', JSON.stringify({ sections }));
        localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 'm1', name: 'Rêve d’été', savedAt: 1, sections, instrumentMorceau: 'strings' }]));
        localStorage.setItem('harmohubCurrentSongId', 'm1');
    });
    await poser();
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(800);
    await page.evaluate(() => { document.getElementById('bpm').value = '96'; window.app.songInstrument = 'strings'; });

    const octets = await page.evaluate(() => Array.from(window.app.buildMidiFile()));
    if (!exiger(octets.length > 50, `l'export produit un fichier non vide (${octets.length} octets)`)) return bilan();

    const f = lireSMF(octets);
    check(f.anomalies.length === 0, `le fichier se relit sans anomalie de structure — ${JSON.stringify(f.anomalies)}`);
    check(f.format === 1, `format 1 (multipiste synchronisée), attendu par tout séquenceur — reçu ${f.format}`);
    check(f.division === 480, `480 tops par noire — reçu ${f.division}`);
    check(f.nbPistes === f.pistes.length,
        `l'en-tête annonce ${f.nbPistes} pistes et le fichier en contient ${f.pistes.length} (un écart fait planter certains lecteurs)`);
    check(f.pistes.every((p) => p.finDePiste), 'chaque piste se termine par un End of Track en bonne et due forme');

    // LA PISTE 0 NE DOIT PORTER AUCUNE NOTE. C'est la convention du format 1 : tempo, mesure et
    // marqueurs d'un côté, musique de l'autre. Des notes en piste 0 gênent l'import de plusieurs
    // logiciels de notation.
    const meta = f.pistes[0];
    check(meta.evenements.every((e) => e.haut !== 0x90 && e.haut !== 0x80),
        'la piste 0 ne porte que du temps et des repères, aucune note');
    check(meta.evenements.some((e) => e.meta === 0x51), 'le tempo est bien écrit (méta 0x51)');
    check(meta.evenements.some((e) => e.meta === 0x58), 'la métrique est bien écrite (méta 0x58)');
    const tempo = meta.evenements.find((e) => e.meta === 0x51).donnees;
    const bpmRelu = Math.round(60000000 / ((tempo[0] << 16) | (tempo[1] << 8) | tempo[2]));
    check(bpmRelu === 96, `le tempo relu vaut celui de l'appli — ${bpmRelu} BPM`);

    // ---- L'ENCODAGE DU TEXTE : le piège qui ne se voit qu'en ouvrant le fichier ailleurs ----
    const tousTextes = f.pistes.flatMap((p) => [...textes(p, 0x01), ...textes(p, 0x03), ...textes(p, 0x06)]);
    const horsAscii = tousTextes.filter((t) => t.octets.some((o) => o < 0x20 || o > 0x7e));
    check(horsAscii.length === 0,
        `aucun texte hors ASCII imprimable — sinon MuseScore l'affiche en charabia (${JSON.stringify(horsAscii.map((t) => t.texte))})`);
    const titre = textes(meta, 0x03)[0];
    check(titre && titre.texte === 'Reve d\'ete',
        `le titre accentué est translittéré LISIBLEMENT, pas mutilé — « ${titre && titre.texte} »`);

    // ---- LES MARQUEURS DE PARTIE : c'est par eux qu'on navigue dans un DAW ----
    const marqueurs = textes(meta, 0x06);
    check(marqueurs.length === 3, `un marqueur par partie, y compris celle sans titre (${marqueurs.length})`);
    check(marqueurs.map((m) => m.texte).join('|') === 'Couplet (ete)|Partie 2|Refrain a Noel',
        `les marqueurs portent les bons libellés, dans l'ordre — ${JSON.stringify(marqueurs.map((m) => m.texte))}`);
    check(marqueurs[0].tick === 0 && marqueurs[1].tick === 12 * 480 && marqueurs[2].tick === 20 * 480,
        `chaque marqueur tombe au début de sa partie — ${JSON.stringify(marqueurs.map((m) => m.tick))}`);

    // ---- LES NOTES ----
    const pisteNotes = f.pistes[1];
    const { notes, restees } = notesDe(pisteNotes);
    check(restees.length === 0,
        `aucune note laissée ouverte — une note sans Note Off sonne indéfiniment (${restees.length})`);
    check(notes.every((n) => !n.orpheline), 'aucun Note Off sans Note On correspondant');
    check(notes.length > 0 && notes.every((n) => n.fin > n.debut),
        `toute note a une durée strictement positive (${notes.length} notes)`);
    check(notes.every((n) => n.note >= 0 && n.note <= 127 && n.velocite >= 1 && n.velocite <= 127),
        'hauteurs et vélocités restent dans les bornes MIDI (0-127, vélocité jamais nulle sur un Note On)');

    // Le programme d'instrument : c'est lui qui décide du son à l'ouverture.
    const prog = pisteNotes.evenements.find((e) => e.haut === 0xc0);
    check(prog && prog.d1 === 50, `le programme General MIDI suit l'instrument du morceau (cordes = 50) — ${prog && prog.d1}`);
    check(pisteNotes.evenements.filter((e) => e.haut === 0x90 || e.haut === 0x80).every((e) => e.canal === prog.canal),
        'toutes les notes de la piste sont sur le canal de son programme');
    check(prog.canal !== 9, 'le canal 9 (percussions en General MIDI) n\'est jamais utilisé pour des accords');

    // La longueur totale : 28 temps écrits doivent faire 28 temps dans le fichier.
    const dernier = Math.max(...f.pistes.map((p) => p.tick));
    check(dernier === 28 * 480, `le fichier dure exactement les 28 temps de la grille — ${dernier / 480} temps`);

    // ---- L'export d'UNE partie repart de zéro ----
    const parPartie = await page.evaluate(() => Array.from(window.app.buildMidiFile([loadProgressionSections()[2]])));
    const g = lireSMF(parPartie);
    check(g.anomalies.length === 0, `un fichier « une partie » est conforme lui aussi — ${JSON.stringify(g.anomalies)}`);
    const notesPartie = notesDe(g.pistes[1]);
    check(notesPartie.restees.length === 0 && Math.min(...notesPartie.notes.map((n) => n.debut)) === 0,
        'la partie exportée seule commence au temps 0 au lieu de garder son décalage dans le morceau');
    check(Math.max(...g.pistes.map((p) => p.tick)) === 8 * 480,
        `et ne dure que ses 8 temps — ${Math.max(...g.pistes.map((p) => p.tick)) / 480} temps`);

    check(erreurs.length === 0, `aucune erreur JavaScript (${erreurs.slice(0, 2).join(' | ')})`);

    await navigateur.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
