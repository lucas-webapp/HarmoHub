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
// choix est délibéré et le doigté doit rester fidèle à la note près — c'est la dernière vérification
// de ce banc, et c'est elle qui empêche le correctif d'aller trop loin.
const { chromium } = require('playwright');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('accords complexes à la guitare');

const RACINES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
// Les qualités qui n'ont AUCUNE forme enseignée dans le code (BARRE_QUALITIES/OPEN_SHAPES) : elles
// dépendent donc entièrement du nouveau chercheur. Ce sont exactement celles que l'utilisateur signale.
const COMPLEXES = ['maj9', 'm9', 'dom11', 'dom13', 'add9', 'add11', 'dim7', 'm7b5', 'aug', 'sus2', 'sus4', 'dim'];
plan(RACINES.length * 2 + COMPLEXES.length * 2 + 14);

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
                if (jouees.length < 4) defauts.push(`${ou} ${jouees.length} cordes seulement`);
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
                const pos = doigtes.map(f => {
                    const c = f.filter(e => e && e.fret > 0).map(e => e.fret);
                    return c.length ? Math.min(...c) : 0;
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

    // NON-RÉGRESSION, la garde du correctif : un voicing PERSONNALISÉ reste rendu à la note près par le
    // chercheur exact. Renversement, drop, basse imposée — trois personnalisations, trois vérifications.
    const fidelite = await page.evaluate(() => {
        const cas = [
            { libelle: 'renversement', accord: new Chord('C', 'maj7', 4, 1, 'none', 3, null, null, []) },
            { libelle: 'drop2', accord: new Chord('C', 'maj7', 4, 0, 'drop2', 3, null, null, []) },
            { libelle: 'basse imposée', accord: new Chord('C', 'maj', 4, 0, 'none', 3, 'E', null, []) },
        ];
        return cas.map(({ libelle, accord }) => {
            const doigtes = guitarFingeringsForChord(accord, null);
            const voulu = accord.getVoiced().map(v => v.midi).sort((a, b) => a - b).join(',');
            const fideles = doigtes.every(f => f.filter(e => e).map(e => e.midi).sort((a, b) => a - b).join(',') === voulu);
            return { libelle, n: doigtes.length, fideles, voulu };
        });
    });
    fidelite.forEach(c => check(c.n === 0 || c.fideles,
        `voicing personnalisé (${c.libelle}) : le doigté reproduit les hauteurs EXACTES demandées (${c.voulu})`));

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

    check(erreurs.length === 0, `aucune erreur JavaScript (${erreurs.slice(0, 2).join(' | ')})`);
    await navigateur.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
