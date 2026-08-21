// LE BANC QUI SURVEILLE LES BANCS.
//
// Pourquoi il existe. Deux vrais défauts d'application ont dormi des semaines dans cette suite, non
// pas faute de bancs, mais parce que des bancs MENTAIENT sur ce qu'ils couvraient : l'un cherchait une
// vue à une adresse supprimée et sautait tout son bloc en silence (voir docs/dette-tests.md §9), une
// trentaine d'autres appellent encore des méthodes qui n'existent plus. Aucun outil ne le disait ; il
// a fallu qu'un humain relise. Ce banc-ci le dit, à chaque campagne, en quelques secondes.
//
// Il n'ouvre aucun navigateur : c'est une lecture statique des fichiers. Il est donc rapide, et ne
// peut pas échouer pour une mauvaise raison (réseau, minuterie, contention).
//
// LE PRINCIPE DU CLIQUET. La dette existante est trop grosse pour être réparée d'un coup (154 bancs
// sans `plan`, 25 qui avalent leurs erreurs). Interdire tout net ferait échouer la campagne entière et
// le garde-fou serait désactivé dès le lendemain — c'est le sort habituel des règles trop ambitieuses.
// On enregistre donc l'état actuel dans meta_suite_reference.json, et ce banc n'échoue que si la dette
// AUGMENTE. Elle ne peut plus que décroître. Quand elle décroît, il le dit aussi et demande de mettre
// la référence à jour : sans cela la référence se périmerait, et un banc réparé laisserait de la place
// pour un banc cassé.
//
// Régénérer la référence après avoir réparé quelque chose :  node tests/meta_suite_test.js --maj
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const REFERENCE = path.join(__dirname, 'meta_suite_reference.json');
// TOUTES les sources de l'appli, pas seulement la page principale. Une première version ne lisait que
// index.html + script.js et accusait donc les dix bancs de la page Paroles de viser des boutons
// « disparus » — alors qu'ils vivent dans paroles.html/paroles.js. Un outil qui traque les faux
// positifs ne peut pas se permettre d'en produire : il perdrait toute autorité, et on prendrait
// l'habitude d'ignorer ce qu'il dit. Symétriquement, ne pas lire ces fichiers laissait passer un vrai
// bouton mort côté Paroles sans rien dire.
const SOURCES = ['script.js', 'paroles.js'];
const PAGES = ['index.html', 'paroles.html'];
const source = SOURCES.map(f => fs.readFileSync(path.join(RACINE, f), 'utf8')).join('\n');
const html = PAGES.map(f => fs.readFileSync(path.join(RACINE, f), 'utf8')).join('\n');
const fichiers = fs.readdirSync(__dirname).filter(f => f.endsWith('_test.js') && f !== 'meta_suite_test.js');

// Une méthode est-elle DÉFINIE dans script.js ? On cherche une définition (`  nom(...) {`,
// `async nom(...)`, `nom: (…) =>`), jamais une simple mention : openGridZoom est cité neuf fois dans
// des COMMENTAIRES alors que la méthode a disparu — c'est précisément le piège à éviter.
// La dernière alternative (`this.nom =`) couvre les propriétés qui reçoivent une fonction sans être
// écrites comme des méthodes : `this._pdfDialogCancel = fermer;`. Sans elle, ce banc signalait
// _pdfDialogCancel comme « appelé mais absent », alors qu'il est bel et bien posé — un faux positif,
// et sur l'outil chargé justement d'en traquer. Elle accepte aussi `this.x = null` comme une
// définition : c'en est une, la propriété existe, et la question posée ici est seulement « ce nom
// existe-t-il quelque part dans l'appli ».
const estDefinie = (nom) => new RegExp(
    `(^|\\n)\\s*(static\\s+)?(async\\s+)?(get\\s+)?${nom}\\s*\\(`
    + `|\\b${nom}\\s*[:=]\\s*(async\\s*)?(function|\\()`
    + `|\\bthis\\.${nom}\\s*=`
).test(source);

// Un identifiant DOM existe-t-il ? Il peut être écrit dans index.html ou fabriqué par script.js
// (gabarits `id="..."`), d'où la recherche dans les deux.
const idExiste = (id) => html.includes(`"${id}"`) || html.includes(`'${id}'`)
    || source.includes(`"${id}"`) || source.includes(`'${id}'`) || source.includes(`\`${id}\``);

const releve = { api_disparue: {}, id_disparu: {}, erreurs_avalees: {}, sans_plan: [], verifications_conditionnelles: {} };

// LES COMMENTAIRES NE SONT PAS DU CODE, et ce banc les lisait comme tel.
//
// Trouvé en écrivant rythme_une_preference_test, dont un commentaire dit « Le vrai bouton, pas
// window.app.addChord() : un bouton qu'on ne peut atteindre qu'en appelant la fonction derrière
// n'est pas un bouton. » La méta-suite y a vu un APPEL à une méthode absente de script.js et a
// signalé une aggravation — alors que le banc ne l'appelle pas : il explique pourquoi il ne
// l'appelle pas.
//
// C'est le pire genre de faux rouge : il pousse à contorsionner une phrase pour plaire à une
// expression régulière, ou pire, à effacer l'explication. Un garde-fou qui punit les commentaires
// finit par les faire disparaître — et ce sont les commentaires qui portent le POURQUOI.
//
// Les cinq relevés y gagnent tous : une accolade citée dans un commentaire ne fausse plus le
// comptage de la section 5, et un identifiant donné en exemple ne compte plus comme une visée.
// Le repli [^:] devant // épargne les URL des chaînes (http://localhost:8934) : les couper ne
// casserait rien ici, mais autant ne pas mutiler ce qu'on n'a pas besoin de toucher.
const sansCommentaires = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

for (const f of fichiers) {
    const t = sansCommentaires(fs.readFileSync(path.join(__dirname, f), 'utf8'));

    // 1. Méthodes de l'appli appelées par le banc mais absentes de script.js
    const methodes = new Set([...t.matchAll(/\b(?:window\.)?app\.([A-Za-z_$][\w$]*)\s*\(/g)].map(m => m[1]));
    const mortes = [...methodes].filter(n => !estDefinie(n)).sort();
    if (mortes.length) releve.api_disparue[f] = mortes;

    // 2. Identifiants DOM visés par le banc mais introuvables dans l'appli
    //
    // DEUX EXCEPTIONS, apprises en supprimant des boutons à la demande de l'utilisateur. Un
    // identifiant absent de l'appli n'est pas forcément un banc périmé :
    //
    //  a) le banc vérifie justement son ABSENCE. `check(!document.getElementById('accord-goto'), …)`
    //     est la bonne façon d'écrire « ce bouton a bien été retiré » — et c'est même la seule chose
    //     qui empêche un bouton supprimé de revenir un jour. Le signaler comme dette poussait à
    //     effacer la vérification, c'est-à-dire à faire exactement le contraire.
    //  b) le banc CRÉE l'élément lui-même (`s.id = 'banc-largeur'`) pour ses propres besoins.
    //
    // La règle : un identifiant n'est mort que si AU MOINS UNE de ses mentions n'est ni niée ni
    // fabriquée par le banc. Une seule mention affirmative suffit à le rendre suspect — on ne veut
    // pas qu'une vérification d'absence serve d'alibi à un vrai clic devenu impossible.
    const cree = new Set([...t.matchAll(/\.id\s*=\s*['"]([\w-]+)['"]/g)].map(m => m[1]));
    const mentions = new Map(); // id -> a-t-il au moins une mention affirmative ?
    const noter = (id, affirmative) => mentions.set(id, (mentions.get(id) || false) || affirmative);
    for (const m of t.matchAll(/(!?\s*)document\.getElementById\(\s*['"]([\w-]+)['"]/g)) noter(m[2], !m[1].trim().startsWith('!'));
    for (const m of t.matchAll(/(!?\s*)document\.querySelector(?:All)?\(\s*['"]#([\w-]+)['"]/g)) noter(m[2], !m[1].trim().startsWith('!'));
    for (const m of t.matchAll(/(?:page|p|mob)\.click\(\s*['"]#([\w-]+)['"]/g)) noter(m[1], true);
    const idsMorts = [...mentions].filter(([i, affirmative]) => affirmative && !cree.has(i) && !idExiste(i)).map(([i]) => i).sort();
    if (idsMorts.length) releve.id_disparu[f] = idsMorts;

    // 3. Erreurs d'interaction avalées : `.catch(() => {})` sur un clic transforme « ce bouton
    //    n'existe plus » en « tout va bien ».
    const avalees = (t.match(/\.catch\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/g) || []).length;
    if (avalees) releve.erreurs_avalees[f] = avalees;

    // 4. Bancs sans `plan()` : rien ne les empêche de perdre la moitié de leurs vérifications en
    //    silence (voir _harness.js).
    //    Le motif n'exigeait qu'un NOMBRE ÉCRIT (`plan(12)`) et déclarait donc « sans plan » un banc
    //    dont le plan est CALCULÉ — `plan(ROOTS.length * QUALITIES.length * 3 + 2)`, qui est pourtant
    //    la meilleure forme possible : il suit automatiquement la taille du jeu d'essai. On accepte
    //    désormais n'importe quelle expression non vide.
    if (!/\bplan\s*\(\s*[^)\s][^)]*\)/.test(t)) releve.sans_plan.push(f);

    // 5. Vérifications enfermées dans un `if (…) { … }` : elles disparaissent sans bruit dès que la
    //    condition tombe. `exiger()` est fait pour ça (voir _harness.js).
    //
    // DEUX FORMES NE SONT PAS DES VÉRIFICATIONS PERDUES, et les compter poussait à défaire le bon
    // travail — c'est le pire défaut possible pour un garde-fou :
    //
    //  a) `if (exiger(...)) { check(...) }` : la condition EST elle-même une vérification enregistrée.
    //     Si elle tombe, le bilan le dit, et le filet de `plan()` signale la couverture manquante.
    //     C'est précisément la forme que le commentaire ci-dessus recommande — la signaler comme
    //     dette revenait à demander de la remplacer par un `if` nu.
    //  b) `if (!truc) { check(false, '…') ; continue; }` : le bloc ÉCHOUE bruyamment au lieu de sauter
    //     en silence. C'est un garde qui parle, pas une vérification escamotée.
    let cond = 0;
    for (const m of t.matchAll(/\bif\s*\(([^)]*(?:\)[^)]*)?)\)\s*\{/g)) {
        if (/\bexiger\(/.test(m[1])) continue;
        let i = m.index + m[0].length, prof = 1, j = i;
        while (j < t.length && prof) { if (t[j] === '{') prof++; else if (t[j] === '}') prof--; j++; }
        const bloc = t.slice(i, j);
        if (!/\bcheck\(/.test(bloc)) continue;
        if (/\bcheck\(\s*false\s*,/.test(bloc)) continue;
        // …y compris quand c'est la branche `else` qui parle : `if (trouvé) { check(…) } else {
        // check(false, 'rien à mesurer ici') }` couvre les deux issues, aucune ne passe sous silence.
        const suite = t.slice(j, j + 400);
        if (/^\s*else\s*\{/.test(suite)) {
            let k = suite.indexOf('{'), prof2 = 1, l = j + k + 1;
            while (l < t.length && prof2) { if (t[l] === '{') prof2++; else if (t[l] === '}') prof2--; l++; }
            if (/\bcheck\(\s*false\s*,/.test(t.slice(j + k + 1, l))) continue;
        }
        cond++;
    }
    if (cond) releve.verifications_conditionnelles[f] = cond;
}
releve.sans_plan.sort();

if (process.argv.includes('--maj')) {
    fs.writeFileSync(REFERENCE, JSON.stringify(releve, null, 2) + '\n');
    console.log('Référence mise à jour : ' + path.relative(RACINE, REFERENCE));
    process.exit(0);
}

// Harnais créé SEULEMENT ici, après la sortie éventuelle de --maj : son filet de sécurité annonce
// une couverture incomplète dès qu'un processus se termine sans bilan, ce qui est exactement le cas
// d'une simple régénération de la référence — un faux rouge, et sur le banc chargé de traquer les
// faux rouges.
const { check, plan, bilan } = require('./_harness')('méta-suite');
plan(6);

const ref = JSON.parse(fs.readFileSync(REFERENCE, 'utf8'));

// Compare une catégorie « fichier -> liste » ou « fichier -> nombre ».
function comparer(cle, titre) {
    const av = ref[cle] || {}, ap = releve[cle] || {};
    const pire = [], mieux = [];
    for (const f of new Set([...Object.keys(av), ...Object.keys(ap)])) {
        const a = Array.isArray(av[f]) ? av[f].length : (av[f] || 0);
        const b = Array.isArray(ap[f]) ? ap[f].length : (ap[f] || 0);
        if (b > a) pire.push(`${f} (${a} -> ${b}${Array.isArray(ap[f]) ? ' : ' + ap[f].filter(x => !(av[f] || []).includes(x)).join(', ') : ''})`);
        else if (b < a) mieux.push(`${f} (${a} -> ${b})`);
    }
    if (mieux.length) console.log(`  ↓ ${titre} en baisse : ${mieux.join(' | ')}`);
    check(pire.length === 0, pire.length
        ? `${titre} : AUGMENTATION — ${pire.join(' | ')}`
        : `${titre} : aucune aggravation (${Object.keys(ap).length} fichier(s) encore concerné(s))`);
    return mieux.length;
}

console.log(`${fichiers.length} bancs relus (analyse statique, sans navigateur)\n`);

let baisses = 0;
baisses += comparer('api_disparue', 'méthodes appelées mais absentes de script.js');
baisses += comparer('id_disparu', 'identifiants DOM visés mais introuvables');
baisses += comparer('erreurs_avalees', 'erreurs d\'interaction avalées');
baisses += comparer('verifications_conditionnelles', 'vérifications sous condition');

const sansPlanNouveaux = releve.sans_plan.filter(f => !(ref.sans_plan || []).includes(f));
const sansPlanCorriges = (ref.sans_plan || []).filter(f => !releve.sans_plan.includes(f));
if (sansPlanCorriges.length) console.log(`  ↓ bancs ayant adopté plan() : ${sansPlanCorriges.join(', ')}`);
baisses += sansPlanCorriges.length;
check(sansPlanNouveaux.length === 0, sansPlanNouveaux.length
    ? `nouveaux bancs sans plan() : ${sansPlanNouveaux.join(', ')}`
    : `aucun nouveau banc sans plan() (${releve.sans_plan.length} restent à convertir)`);

// La référence doit SUIVRE les réparations, sinon elle laisse rouvrir une place pour un défaut.
check(baisses === 0, baisses === 0
    ? 'la référence est à jour'
    : `la dette a DIMINUÉ (${baisses} amélioration(s)) : relancer « node tests/meta_suite_test.js --maj » pour figer le gain`);

bilan();
