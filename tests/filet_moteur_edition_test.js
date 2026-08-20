// FILET DE REFONTE — Lot 0. Le MOTEUR d'édition d'un accord, indépendamment de l'apparence des
// commandes. La refonte remplace le volet de gauche toujours ouvert par un inspecteur contextuel :
// les <select> actuels deviennent la SOURCE DE VÉRITÉ cachée, et de nouvelles commandes (segments,
// molettes) écrivent dedans puis émettent 'change'. Tout ce que ce banc éprouve doit donc survivre
// tel quel — s'il rougit après un lot, c'est que le nouveau bouton n'est pas branché sur l'ancien
// champ, pas que le test est périmé.
//
// DEUX COUCHES, ET ELLES NE VIEILLISSENT PAS PAREIL. C'est le point de méthode de tout ce filet :
//   • Couche MOTEUR (ce banc) : on écrit dans le champ source et on émet l'évènement, sans jamais
//     cliquer sur un widget. Aucune adresse d'écran n'y apparaît, donc rien à réadapter d'un lot à
//     l'autre. Elle répond à « la donnée de l'accord suit-elle encore ? »
//   • Couche CÂBLAGE (les bancs de gestes existants) : de vrais clics sur de vrais widgets. Elle,
//     doit être ADAPTÉE lot par lot, jamais supprimée — c'est la seule qui prouve que la commande
//     visible touche bien le moteur.
// Un banc qui ne ferait que la couche moteur laisserait passer un inspecteur entièrement débranché,
// et un banc qui ne ferait que la couche câblage rougirait à chaque changement de maquette sans rien
// dire du fond. Il faut les deux.
//
// LE PIÈGE QUE CE BANC EXISTE POUR ATTRAPER (repéré en relisant le code AVANT d'y toucher) :
// le raccourci « Entrée depuis un réglage d'accord ajoute l'accord » se décide sur
// `CHORD_PARAM_IDS.includes(document.activeElement.id)` (voir setupKeyboardShortcuts). Le jour où la
// commande visible devient un <button> qui écrit dans un <select> caché, l'élément qui a le focus
// est ce bouton — dont l'identifiant n'est PAS dans la liste. Le raccourci meurt alors en silence :
// aucune erreur, aucun symptôme, juste une touche qui ne fait plus rien. Il est donc éprouvé ici
// avec un VRAI focus et une VRAIE touche Entrée, pas par un appel direct à saveCurrent().
const { chromium } = require('playwright');
const creerHarnais = require('./_harness');
const { plan, check, exiger, bilan } = creerHarnais('Filet : le moteur d\'édition d\'un accord');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';

// Les dix réglages qui FONT un accord (CHORD_PARAM_IDS dans script.js), avec pour chacun une valeur
// de rechange sûre et le nom du champ qu'ils écrivent dans la donnée stockée. `evt` rappelle
// l'évènement réellement écouté : 'input' pour l'intensité (curseur), 'change' pour les neuf autres.
const REGLAGES = [
    { id: 'root',       valeur: 'F',      champ: 'root',       evt: 'change', nom: 'la fondamentale' },
    { id: 'quality',    valeur: 'min7',   champ: 'quality',    evt: 'change', nom: 'la nature' },
    { id: 'duration',   valeur: '2',      champ: 'beats',      evt: 'change', nom: 'la durée' },
    { id: 'inversion',  valeur: '1',      champ: 'inversion',  evt: 'change', nom: 'le renversement' },
    { id: 'drop',       valeur: 'drop2',  champ: 'drop',       evt: 'change', nom: 'le drop' },
    { id: 'octave',     valeur: '4',      champ: 'octave',     evt: 'change', nom: "l'octave" },
    { id: 'bass',       valeur: 'A',      champ: 'bass',       evt: 'change', nom: 'la basse' },
    // 'noire_staccato', et surtout PAS une valeur inventée : un <select> à qui l'on donne une valeur
    // absente de ses options se met sur la chaîne vide sans rien dire. Le banc voyait alors bien un
    // changement (« held » → «  ») et passait au vert pour de mauvaises raisons. Les valeurs réelles
    // sont des LONGUEURS de note (ronde/blanche/noire/croche, liées ou détachées), pas des arpèges.
    { id: 'playStyle',  valeur: 'noire_staccato', champ: 'playStyle', evt: 'change', nom: 'le style de jeu' },
    { id: 'instrument', valeur: null,     champ: 'instrument', evt: 'change', nom: "l'instrument" },
    { id: 'intensity',  valeur: '95',     champ: 'intensity',  evt: 'input',  nom: "l'intensité" },
];

const seed = () => {
    const mk = (r, q, b) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
    const song = {
        id: 'filet-moteur-1', name: 'Morceau du filet', bpm: 120, timeSig: '4/4', groove: 'straight',
        sections: [{ title: 'Couplet', chords: [mk('C', 'maj7', 4), mk('F', 'maj', 4), mk('G', '7', 4)] }],
    };
    localStorage.setItem('harmohubSongs', JSON.stringify([song]));
    localStorage.setItem('harmohubCurrentSongId', song.id);
    localStorage.setItem('myProgression', JSON.stringify({ sections: song.sections }));
};

// Lecture de la donnée STOCKÉE, pas de l'affichage : c'est le seul point d'observation que la
// refonte ne peut pas déplacer.
const lireAccord = (i) => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[i];

(async () => {
    plan(25);
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
    const erreurs = [];
    page.on('pageerror', e => erreurs.push(e.message));

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await page.waitForTimeout(300);
    await page.evaluate(seed);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(500);

    // L'instrument n'a pas de valeur fixe connue d'avance (la banque de sons évolue) : on prend la
    // deuxième option offerte, quelle qu'elle soit, plutôt que d'en coder une en dur qui périmerait.
    REGLAGES.find(r => r.id === 'instrument').valeur = await page.evaluate(() => {
        const s = document.getElementById('instrument');
        const autre = [...s.options].find(o => o.value !== s.value && !o.disabled);
        return autre ? autre.value : null;
    });

    console.log('=== A. Chaque réglage s\'applique en direct à l\'accord édité, et Ctrl+Z le reprend ===');
    for (const r of REGLAGES) {
        if (r.valeur == null) { check(false, `${r.nom} : aucune valeur de rechange disponible pour éprouver le réglage`); continue; }
        // Session d'édition NEUVE à chaque réglage : commitLiveEdit ne pousse qu'UN instantané
        // Annuler par session (voir _editSessionUndoPushed), donc enchaîner dix changements dans la
        // même session ne laisserait qu'un seul point de retour et le Ctrl+Z du dixième reprendrait
        // aussi les neuf premiers.
        await page.evaluate(() => { window.app.exitEditMode && window.app.exitEditMode(); window.app.editChord(0, 0); });
        await page.waitForTimeout(200);
        const avant = await page.evaluate(lireAccord, 0);

        // Garde-fou : on vérifie que le champ a bien ACCEPTÉ la valeur avant d'en tirer la moindre
        // conclusion. Sans ça, une valeur qui n'existe pas dans les options passe à la chaîne vide,
        // le banc constate « ça a changé » et devient vert alors qu'il n'éprouve plus rien.
        const accepte = await page.evaluate(({ id, valeur, evt }) => {
            const el = document.getElementById(id);
            el.value = valeur;
            const retenu = el.value;
            el.dispatchEvent(new Event(evt, { bubbles: true }));
            return retenu === String(valeur);
        }, r);
        if (!accepte) { check(false, `${r.nom} : le champ refuse la valeur d'essai « ${r.valeur} » — banc à corriger, pas l'application`); continue; }
        await page.waitForTimeout(250);
        const apres = await page.evaluate(lireAccord, 0);
        const change = String(apres[r.champ]) !== String(avant[r.champ]);
        check(change, `${r.nom} : le changement s'écrit tout de suite dans l'accord — ${avant[r.champ]} → ${apres[r.champ]}`);

        // Ctrl+Z RÉEL au clavier. Le focus est sur <body> ici (on n'a cliqué sur rien) : c'est
        // volontaire, le garde-fou `typing` de setupKeyboardShortcuts bloque Ctrl+Z tant qu'un
        // <select> garde le focus, et ce banc-ci éprouve le moteur, pas le clavier — le cas « focus
        // sur la commande » est traité par les bancs de gestes.
        await page.keyboard.press('Control+z');
        await page.waitForTimeout(250);
        const repris = await page.evaluate(lireAccord, 0);
        check(String(repris[r.champ]) === String(avant[r.champ]),
            `${r.nom} : Ctrl+Z reprend la valeur d'avant — ${apres[r.champ]} → ${repris[r.champ]} (attendu ${avant[r.champ]})`);
    }

    console.log('\n=== B. Entrée depuis un réglage d\'accord ajoute l\'accord (mode Ajout seulement) ===');
    // On sort de l'édition pour repasser en Ajout, où ce raccourci a un sens.
    await page.evaluate(() => window.app.exitEditMode && window.app.exitEditMode());
    await page.waitForTimeout(250);
    exiger(await page.evaluate(() => window.app.appMode === 'add'), 'on est bien revenu en mode Ajout');
    const nbAvant = await page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords.length);

    // VRAI focus sur la commande, VRAIE touche Entrée : c'est tout l'enjeu du piège décrit en tête.
    await page.focus('#root');
    const focusId = await page.evaluate(() => document.activeElement && document.activeElement.id);
    check(focusId === 'root', `le focus est bien sur le réglage de fondamentale — activeElement #${focusId}`);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(350);
    const nbApres = await page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords.length);
    check(nbApres === nbAvant + 1, `Entrée depuis un réglage ajoute un accord — ${nbAvant} → ${nbApres}`);

    console.log('\n=== C. En mode Modification, Entrée ne doit RIEN ajouter ===');
    // Le pendant du précédent, et il compte autant : « en mode Modification, chaque champ s'applique
    // déjà tout seul, Entrée n'a plus rien à valider et ne doit pas refermer l'édition en cours ».
    await page.evaluate(() => window.app.editChord(0, 0));
    await page.waitForTimeout(250);
    const nbAvantEdit = await page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords.length);
    await page.focus('#root');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    const nbApresEdit = await page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords.length);
    check(nbApresEdit === nbAvantEdit, `Entrée en mode Modification n'ajoute rien — ${nbAvantEdit} → ${nbApresEdit}`);
    check(await page.evaluate(() => window.app.appMode === 'edit'), 'Entrée en mode Modification ne referme pas l\'édition en cours');

    console.log('\n=== D. Intensité sur une sélection MULTIPLE ===');
    // Exigence explicite de l'utilisateur pour la refonte : « l'intensité doit rester visible » et
    // fonctionner « pour les nouveaux accords, les accords existants ET la sélection multiple ».
    // Ce troisième cas passe par un chemin de code séparé (applyIntensityToSelection), qui court-
    // circuite commitLiveEdit — il ne suffit donc pas d'éprouver l'accord en édition.
    await page.evaluate(() => {
        window.app.exitEditMode && window.app.exitEditMode();
        window.app.toggleGridMultiSelect(0, 0);
        window.app.toggleGridMultiSelect(0, 1);
    });
    await page.waitForTimeout(250);
    const taille = await page.evaluate(() => window.app.multiSelect.size);
    if (exiger(taille === 2, `deux accords sont bien sélectionnés ensemble — ${taille}`)) {
        // On LIT la valeur retenue au lieu de la supposer : le curseur avance par pas de 5
        // (step="5"), une consigne de 42 est ramenée à 40 par le navigateur lui-même. Comparer à la
        // valeur demandée ferait échouer le banc sur une contrainte du champ, pas sur un défaut.
        const voulu = await page.evaluate(() => {
            const el = document.getElementById('intensity');
            el.value = '42';
            el.dispatchEvent(new Event('input', { bubbles: true }));
            return +el.value;
        });
        await page.waitForTimeout(300);
        const [a, b] = await page.evaluate(() => {
            const c = JSON.parse(localStorage.getItem('myProgression')).sections[0].chords;
            return [c[0].intensity, c[1].intensity];
        });
        check(+a === voulu && +b === voulu, `l'intensité s'applique aux DEUX accords sélectionnés — ${a} et ${b} (curseur sur ${voulu})`);
    }

    check(erreurs.length === 0, `aucune erreur JavaScript pendant le parcours — ${erreurs.join(' | ') || 'aucune'}`);
    await browser.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
