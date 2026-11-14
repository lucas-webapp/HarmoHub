// Les accords complexes doivent proposer PLUSIEURS doigtés, pas un seul.
//
// RETOUR UTILISATEUR : « je dois jouer un Cmaj9 à la guitare, je suis étonné qu'il y ait un seul
// diagramme proposé sur l'appli, alors qu'il est facilement jouable à la guitare. Je t'envoie ci-joint
// quelques exemples de Cmaj9. Peux-tu vérifier les accords complexes stp ? » (quatre photos, cases 2,
// 3, 5 et 10).
//
// LE RELEVÉ AVANT CORRECTIF (sonde sur C/A/F# × les 22 qualités) : Cmaj9 énumérait 13 dispositions et
// en rejetait 12, dont 8 sur le seul écartement de la main. Et l'utilisateur s'est arrêté au premier
// symptôme : Cm9, Cdim7, Cm7b5, C11 et C13 n'affichaient RIEN DU TOUT. La cause n'est pas que ces
// accords soient injouables, c'est que le chercheur reproduisait la voix EXACTE du voicing par défaut
// (empilement de tierces à l'octave 3, do3-mi3-sol3-si3-ré4 pour Cmaj9) : un bloc serré qu'aucune main
// ne tient. Un guitariste répartit les mêmes notes sur d'autres octaves et laisse tomber la quinte.
//
// CORRECTIF : un second chercheur (solveGuitarVoicings) qui raisonne en CLASSES DE HAUTEUR, réservé au
// cas où le voicing n'a pas été personnalisé. Dès qu'il y a renversement, drop ou basse imposée, ce
// choix est délibéré : les doigtés EXACTS (à la note près) restent en tête.
//
// COMPLÉTÉ LE 13/11 — « Pourquoi cet accord n'est-il pas jouable à la guitare ? C'est un accord commun. » (un Fm7 ; « cela peut se jouer sur 4 ou 5 cordes, pas obligatoirement les 6 »).
// Mesuré avant : 358 renversements sur 648, 108 drops sur 480 et 283 accords sur basse sur 660 n'avaient AUCUN doigté (Fm7 : tous ses renversements, toutes ses basses), parce que le chercheur
// exact exige l'octave de chaque note. Désormais, quand les doigtés exacts manquent, des positions qui gardent la NOTE LA PLUS GRAVE (renversement ou basse) complètent la liste ; pour un drop,
// seulement s'il n'y en a aucun exact. La dernière vérification de fidélité devient : les exacts restent en tête, et tout doigté ajouté garde la bonne basse.
const { chromium } = require('playwright');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('accords complexes à la guitare');

const RACINES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
// Les qualités qui n'ont AUCUNE forme enseignée dans le code (BARRE_QUALITIES/OPEN_SHAPES) : elles
// dépendent donc entièrement du nouveau chercheur. Ce sont exactement celles que l'utilisateur signale.
const COMPLEXES = ['maj9', 'm9', 'dom11', 'dom13', 'add9', 'add11', 'dim7', 'm7b5', 'aug', 'sus2', 'sus4', 'dim'];
plan(RACINES.length * 2 + COMPLEXES.length * 2 + 29);

(async () => {
    const navigateur = await chromium.launch();
    const page = await navigateur.newPage();
    const erreurs = [];
    page.on('pageerror', e => erreurs.push(e.message));
    await page.goto(`${BASE}/index.html?nocache=` + Date.now());
    await page.waitForTimeout(400);

    // ---------- COUCHE MOTEUR : ce que le générateur produit, pour les 240 accords ----------
    // Un audit note à note plutôt qu'un échantillon : c'est le seul moyen d'affirmer « les accords
    // complexes sont vérifiés », qui est littéralement la demande.
    const audit = await page.evaluate(() => {
        const defauts = [];
        const compte = {};
        NOTES.forEach(root => Object.keys(CHORD_INTERVALS).forEach(qualite => {
            const accord = new Chord(root, qualite, 4, 0, 'none', 3, null, null, []);
            const doigtes = guitarFingeringsForChord(accord, null);
            compte[root + ':' + qualite] = doigtes.length;
            const rootPc = NOTES.indexOf(root);
            const ivs = CHORD_INTERVALS[qualite];
            const pcsAccord = new Set(ivs.map(iv => (((rootPc + iv.semi) % 12) + 12) % 12));
            // Mêmes dispenses que guitarChordPcs, réécrites ici exprès : si le banc appelait la
            // fonction qu'il éprouve, il ne vérifierait plus rien (une règle fausse resterait verte).
            const essentiels = new Set(pcsAccord);
            if (pcsAccord.size >= 4 && ivs.some(iv => (((iv.semi % 12) + 12) % 12) === 7)) essentiels.delete((((rootPc + 7) % 12) + 12) % 12);
            if (ivs.some(iv => iv.semi === 21) && ivs.some(iv => iv.semi === 14)) essentiels.delete((((rootPc + 2) % 12) + 12) % 12);
            // Les formes enseignées (commonGuitarShapes) ne passent pas par le chercheur et ne sont
            // donc pas soumises à ses règles de main : on les identifie pour ne juger que les autres.
            const enseignees = new Set(commonGuitarShapes(root, qualite).map(f => f.map(x => (x == null ? 'x' : x)).join(',')));
            doigtes.forEach(forme => {
                const cle = forme.map(e => (e ? e.fret : 'x')).join(',');
                const jouees = forme.filter(e => e);
                const pcs = new Set(jouees.map(e => (((e.midi % 12) + 12) % 12)));
                const ou = `${root}${qualite} [${cle}]`;
                if ([...pcs].some(pc => !pcsAccord.has(pc))) defauts.push(`${ou} note étrangère à l'accord`);
                if ([...essentiels].some(pc => !pcs.has(pc))) defauts.push(`${ou} degré essentiel absent`);
                if ((((Math.min(...jouees.map(e => e.midi)) % 12) + 12) % 12) !== rootPc) defauts.push(`${ou} basse ≠ fondamentale`);
                // Triade sur trois cordes, tétrade sur quatre (moteur du 14/11) : le plancher est le nombre de notes essentielles, au plus quatre.
                if (jouees.length < Math.min(4, essentiels.size)) defauts.push(`${ou} ${jouees.length} cordes seulement`);
                const idx = forme.map((e, i) => (e ? i : -1)).filter(i => i >= 0);
                if (idx[idx.length - 1] - idx[0] + 1 !== idx.length) defauts.push(`${ou} cordes jouées non contiguës`);
                if (enseignees.has(cle)) return;
                const cases = jouees.filter(e => e.fret > 0).map(e => e.fret);
                if (cases.length && Math.max(...cases) - Math.min(...cases) > GUITAR_MAX_SPAN) defauts.push(`${ou} écartement`);
                if (cases.length && Math.max(...cases) > GUITAR_VOICING_MAX_FRET) defauts.push(`${ou} au-delà de la 12e case`);
                if (guitarFingersNeeded(forme) > GUITAR_MAX_FINGERS) defauts.push(`${ou} plus de quatre doigts`);
                // Une corde à vide veut dire main au sillet : pas de case frettée au-delà de l'écart max.
                if (jouees.some(e => e.fret === 0) && cases.length && Math.max(...cases) > GUITAR_MAX_SPAN) defauts.push(`${ou} corde à vide loin sur le manche`);
            });
        }));
        return { defauts, compte };
    });

    check(audit.defauts.length === 0, `les 240 accords (12 tons × 20 qualités) : aucun doigté fautif (${audit.defauts.length}) ${audit.defauts.slice(0, 3).join(' / ')}`);
    const vides = Object.entries(audit.compte).filter(([, n]) => n === 0).map(([k]) => k);
    const seuls = Object.entries(audit.compte).filter(([, n]) => n === 1).map(([k]) => k);
    check(vides.length === 0, `aucun accord sans le moindre diagramme (avant : Cm9, Cdim7, Cm7b5, C11, C13… en avaient zéro) — ${vides.slice(0, 6).join(' ')}`);
    check(seuls.length === 0, `aucun accord réduit à UN seul diagramme, le symptôme signalé — ${seuls.slice(0, 6).join(' ')}`);

    // Le cas signalé, tel quel.
    const cmaj9 = await page.evaluate(() => {
        const accord = new Chord('C', 'maj9', 4, 0, 'none', 3, null, null, []);
        return guitarFingeringsForChord(accord, null).map(f => f.map(e => (e ? e.fret : 'x')).join(' '));
    });
    check(cmaj9.length >= 4, `Cmaj9 propose ${cmaj9.length} doigtés (avant : 1) — ${cmaj9.join(' | ')}`);
    // Les photos envoyées montraient des positions en cases 2, 3, 5 et 10 : on n'exige pas CES formes
    // précises (il en existe des dizaines), mais qu'au moins une position basse ET une position haute
    // soient proposées — c'est ce qui distingue « plusieurs doigtés » de « quatre fois le même coin ».
    const positions = cmaj9.map(f => {
        const cases = f.split(' ').filter(c => c !== 'x' && c !== '0').map(Number);
        return cases.length ? Math.min(...cases) : 0;
    });
    check(Math.min(...positions) <= 3, `Cmaj9 : au moins une position dans le bas du manche (${positions.join(', ')})`);
    check(Math.max(...positions) - Math.min(...positions) >= 3, `Cmaj9 : les positions couvrent vraiment le manche (${positions.join(', ')})`);
    check(new Set(positions).size === positions.length, `Cmaj9 : une seule proposition par position, pas quatre cousines (${positions.join(', ')})`);

    // Chaque qualité complexe, sur les 12 tons : au moins deux positions réellement distinctes.
    for (const qualite of COMPLEXES) {
        const res = await page.evaluate((q) => {
            const parTon = {};
            NOTES.forEach(root => {
                const doigtes = guitarFingeringsForChord(new Chord(root, q, 4, 0, 'none', 3, null, null, []), null);
                // Une position = la case la plus basse ET la corde la plus grave jouée (moteur du 14/11 : une forme par position et par jeu de cordes).
                const pos = doigtes.map(f => {
                    const c = f.filter(e => e && e.fret > 0).map(e => e.fret);
                    return (c.length ? Math.min(...c) : 0) + '|' + f.findIndex(e => e);
                });
                parTon[root] = { n: doigtes.length, distinctes: new Set(pos).size };
            });
            return parTon;
        }, qualite);
        const maigres = Object.entries(res).filter(([, v]) => v.n < 2).map(([k]) => k);
        const doublons = Object.entries(res).filter(([, v]) => v.distinctes !== v.n).map(([k]) => k);
        check(maigres.length === 0, `${qualite} : les 12 tons proposent au moins deux doigtés — manquants : ${maigres.join(' ') || 'aucun'}`);
        check(doublons.length === 0, `${qualite} : aucune position de manche proposée deux fois — ${doublons.join(' ') || 'aucun'}`);
    }

    // Les formes ENSEIGNÉES gardent la première place : le nouveau chercheur complète la liste, il ne
    // la préempte pas. Un guitariste doit retrouver en premier ce qu'on lui a appris.
    for (const root of RACINES) {
        const t = await page.evaluate((r) => {
            const enseignee = commonGuitarShapes(r, 'maj').map(f => f.map(x => (x == null ? 'x' : x)).join(','));
            const proposes = guitarFingeringsForChord(new Chord(r, 'maj', 4, 0, 'none', 3, null, null, []), null)
                .map(f => f.map(e => (e ? e.fret : 'x')).join(','));
            return { enseignee, proposes };
        }, root);
        check(t.enseignee.length > 0 && t.proposes.slice(0, t.enseignee.length).join(' ') === t.enseignee.join(' '),
            `${root} majeur : les formes enseignées restent en tête (${t.proposes.slice(0, 3).join(' | ')})`);
        check(t.proposes.length >= t.enseignee.length, `${root} majeur : la liste ne perd aucune forme enseignée`);
    }

    // NON-RÉGRESSION, la garde du correctif : un voicing PERSONNALISÉ garde en TÊTE ses doigtés exacts (à la note près), et tout doigté ajouté pour compléter garde la BONNE NOTE GRAVE et
    // ne sonne que des notes de l'accord (plus la basse). Renversement, drop, basse imposée — trois personnalisations, trois vérifications.
    const fidelite = await page.evaluate(() => {
        const cas = [
            { libelle: 'renversement', accord: new Chord('C', 'maj7', 4, 1, 'none', 3, null, null, []) },
            { libelle: 'drop2', accord: new Chord('C', 'maj7', 4, 0, 'drop2', 3, null, null, []) },
            { libelle: 'basse imposée', accord: new Chord('C', 'maj', 4, 0, 'none', 3, 'E', null, []) },
        ];
        const cle = (f) => f.map(e => (e ? e.fret : 'x')).join('-');
        return cas.map(({ libelle, accord }) => {
            const doigtes = guitarFingeringsForChord(accord, null);
            const exacts = solveGuitarFingerings(accord.getVoiced());
            const voix = accord.getVoiced().map(v => v.midi);
            const basPc = ((Math.min(...voix) % 12) + 12) % 12;
            const enTete = exacts.every((f, i) => doigtes[i] && cle(doigtes[i]) === cle(f));
            const bonneBasse = doigtes.every(f => ((Math.min(...f.filter(e => e).map(e => e.midi)) % 12) + 12) % 12 === basPc);
            return { libelle, n: doigtes.length, nExacts: exacts.length, enTete, bonneBasse };
        });
    });
    fidelite.forEach(c => check(c.n > 0 && c.enTete && c.bonneBasse,
        `voicing personnalisé (${c.libelle}) : ${c.nExacts} doigté(s) exact(s) en tête, ${c.n} au total, tous sur la bonne note grave`));

    // ---------- LE CAS SIGNALÉ : Fm7, renversé ou sur une basse (13/11) ----------
    const fm7 = await page.evaluate(() => {
        const liste = (inv, drop, bass) => {
            const c = new Chord('F', 'min7', 4, inv, drop, 3, bass, null, []);
            return guitarFingeringsForChord(c, null).map(f => f.map(e => (e ? { fret: e.fret, midi: e.midi } : null)));
        };
        const pcBasse = (f) => ((Math.min(...f.filter(e => e).map(e => e.midi)) % 12) + 12) % 12;
        const pcs = (f, pc) => f.filter(e => e && (((e.midi % 12) + 12) % 12) === pc).length;
        const accord = [5, 8, 0, 3]; // F, Ab, C, Eb
        const basses = {};
        NOTES.forEach((n, pc) => { if (pc !== 5) basses[n] = liste(0, 'none', n); });
        const voixDrop2 = new Chord('F', 'min7', 4, 0, 'drop2', 3, null, null, []).getVoiced().map(v => v.midi);
        const exactsDrop2 = solveGuitarFingerings(new Chord('F', 'min7', 4, 0, 'drop2', 3, null, null, []).getVoiced());
        // Moteur du 14/11 : les doigtés qui suivent les exacts sont la MÊME forme (mêmes écarts entre les voix) à une autre octave.
        const ecarts = (midis) => { const t = midis.slice().sort((a, b) => a - b); return t.map(m => m - t[0]).join(','); };
        const listeDrop2 = liste(0, 'drop2', null);
        const memeForme = listeDrop2.slice(exactsDrop2.length).every(f => ecarts(f.filter(e => e).map(e => e.midi)) === ecarts(voixDrop2));
        return {
            plein: liste(0, 'none', null).length,
            R1: liste(1, 'none', null).length, R2: liste(2, 'none', null).length, R3: liste(3, 'none', null).length,
            videsBasses: Object.entries(basses).filter(([, l]) => l.length === 0).map(([n]) => n),
            mauvaiseBasse: Object.entries(basses).filter(([n, l]) => l.some(f => pcBasse(f) !== NOTES.indexOf(n))).map(([n]) => n),
            basseEtrangereRepetee: Object.entries(basses).filter(([n, l]) => !accord.includes(NOTES.indexOf(n)) && l.some(f => pcs(f, NOTES.indexOf(n)) !== 1)).map(([n]) => n),
            drop2: listeDrop2.length, drop2Exacts: exactsDrop2.length, memeForme,
        };
    });
    check(fm7.plein >= 2, `Fm7 en position fondamentale propose toujours ses doigtés (${fm7.plein})`);
    check(fm7.R1 >= 2, `Fm7 au 1er renversement (Ab à la basse) propose des doigtés (${fm7.R1}) — avant : aucun, « Non jouable à la guitare »`);
    check(fm7.R2 >= 2, `Fm7 au 2e renversement (C à la basse) propose des doigtés (${fm7.R2})`);
    check(fm7.R3 >= 2, `Fm7 au 3e renversement (Eb à la basse) propose des doigtés (${fm7.R3})`);
    check(fm7.videsBasses.length === 0, `Fm7 sur n'importe laquelle des onze autres basses propose un doigté — sans : ${fm7.videsBasses.join(' ') || 'aucune'}`);
    check(fm7.mauvaiseBasse.length === 0, `et la note la plus grave de chaque doigté EST la basse demandée — écarts : ${fm7.mauvaiseBasse.join(' ') || 'aucun'}`);
    check(fm7.basseEtrangereRepetee.length === 0, `une basse étrangère à l'accord (Fm7/D…) ne sonne qu'une fois, tout en bas — répétée sur : ${fm7.basseEtrangereRepetee.join(' ') || 'aucune'}`);
    check(fm7.drop2 >= fm7.drop2Exacts && fm7.drop2Exacts > 0 && fm7.memeForme, `Fm7 en drop 2 : ses doigtés exacts d'abord, puis la MÊME forme à une autre octave, rien d'autre (${fm7.drop2} dont ${fm7.drop2Exacts} exacts)`);

    // ---------- LE RELEVÉ COMPLET (13/11) : plus de renversement, de drop ni d'accord sur basse « courant » sans doigté ----------
    const releve = await page.evaluate(() => {
        const sans = { inv: [], drop: [], basse: [] };
        const rares = ['maj9', 'm9', 'dom9']; // cinq notes serrées : quelques renversements et drops restent sans doigté
        NOTES.forEach(root => Object.keys(CHORD_INTERVALS).forEach(q => {
            if (rares.includes(q)) return;
            const n = new Chord(root, q, 4, 0, 'none', 3, null, null, []).getIntervals().length;
            for (let inv = 1; inv < n; inv++) if (!guitarFingeringsForChord(new Chord(root, q, 4, inv, 'none', 3, null, null, []), null).length) sans.inv.push(`${root}${q}/R${inv}`);
            if (n >= 3) ['drop2', 'drop3'].forEach(d => { if (!guitarFingeringsForChord(new Chord(root, q, 4, 0, d, 3, null, null, []), null).length) sans.drop.push(`${root}${q}/${d}`); });
        }));
        NOTES.forEach(root => ['maj', 'min', 'dom7', 'maj7', 'min7'].forEach(q => NOTES.forEach(b => {
            if (b !== root && !guitarFingeringsForChord(new Chord(root, q, 4, 0, 'none', 3, b, null, []), null).length) sans.basse.push(`${root}${q}/${b}`);
        })));
        return sans;
    });
    check(releve.inv.length === 0, `aucun renversement sans doigté (hors maj9, m9, dom9) — ${releve.inv.slice(0, 5).join(' ') || 'aucun'} (avant : 358 sur 648)`);
    check(releve.drop.length === 0, `aucun drop sans doigté (hors maj9, m9, dom9) — ${releve.drop.slice(0, 5).join(' ') || 'aucun'} (avant : 108 sur 480)`);
    check(releve.basse.length === 0, `aucun accord sur basse sans doigté (5 qualités courantes × 11 basses × 12 tons) — ${releve.basse.slice(0, 5).join(' ') || 'aucun'} (avant : 283 sur 660)`);

    // ---------- COUCHE CÂBLAGE : le musicien, dans le panneau, voit bien « 1/4 » et peut naviguer ----------
    if (!(await page.evaluate(() => document.getElementById('toggle-viz-guitar').getAttribute('aria-pressed') === 'true'))) {
        await page.click('#toggle-viz-guitar');
    }
    await page.evaluate(() => {
        document.getElementById('root').value = 'C';
        document.getElementById('quality').value = 'maj9';
        window.app.refreshPreview();
    });
    await page.waitForTimeout(200);
    const nav = await page.evaluate(() => {
        const n = document.getElementById('guitar-nav');
        return {
            visible: !!n && getComputedStyle(n).display !== 'none',
            libelle: (document.getElementById('guitar-nav-label') || {}).textContent,
            points: document.querySelectorAll('#guitar-viz circle, #guitar-viz .gd-dot').length,
            introuvable: !!document.querySelector('#guitar-viz .guitar-unplayable'),
        };
    });
    exiger(!nav.introuvable, 'Cmaj9 n\'affiche plus « Non jouable à la guitare »');
    check(nav.visible, 'le navigateur de doigtés est visible pour Cmaj9 (masqué quand il n\'y a qu\'un doigté)');
    check(/^1\/[2-9]$/.test(nav.libelle || ''), `le compteur annonce plusieurs doigtés : « ${nav.libelle} »`);

    const avant = await page.evaluate(() => document.getElementById('guitar-viz').innerHTML);
    await page.click('#guitar-next');
    await page.waitForTimeout(150);
    const apres = await page.evaluate(() => ({
        html: document.getElementById('guitar-viz').innerHTML,
        libelle: (document.getElementById('guitar-nav-label') || {}).textContent,
    }));
    check(apres.html !== avant, 'la flèche « suivant » change réellement le diagramme dessiné');
    check((apres.libelle || '').startsWith('2/'), `le compteur suit : « ${apres.libelle} »`);

    // Le cas signalé le 13/11, dans le panneau : Fm7 renversé, puis Fm7 sur une basse — « Non jouable à la guitare » avant, plusieurs doigtés maintenant.
    for (const [libelle, inversion, basse] of [['Fm7 au 1er renversement', '1', ''], ['Fm7/D (basse ré)', '0', 'D']]) {
        await page.evaluate(([inv, bass]) => {
            document.getElementById('root').value = 'F';
            document.getElementById('quality').value = 'min7';
            document.getElementById('inversion').value = inv;
            document.getElementById('bass').value = bass;
            window.app.refreshPreview();
        }, [inversion, basse]);
        await page.waitForTimeout(200);
        const panneau = await page.evaluate(() => ({
            introuvable: !!document.querySelector('#guitar-viz .guitar-unplayable'),
            libelle: (document.getElementById('guitar-nav-label') || {}).textContent,
        }));
        check(!panneau.introuvable && /^1\/[2-9]$/.test(panneau.libelle || ''), `${libelle} : le panneau n'affiche plus « Non jouable à la guitare » et annonce plusieurs doigtés (« ${panneau.libelle} »)`);
    }

    check(erreurs.length === 0, `aucune erreur JavaScript (${erreurs.slice(0, 2).join(' | ')})`);
    await navigateur.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
