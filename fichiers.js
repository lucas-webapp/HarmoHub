// NOMMAGE DES FICHIERS EXPORTÉS — commun à HarmoHub, à Paroles et, plus tard, à TabHub.
//
// POURQUOI UN FICHIER À PART. Les deux applications seront servies depuis la MÊME origine (décision
// prise avec l'utilisateur) : un seul fichier chargé par les trois pages vaut mieux que la même règle
// recopiée trois fois, qui divergerait au premier ajustement. C'est déjà arrivé dans ce projet — le
// nombre de mesures d'une partie était calculé deux fois, avec deux arrondis différents, et le même
// morceau paraissait changer de longueur selon l'écran où on le regardait.
//
// POURQUOI LE NOMMAGE D'ABORD. Le rangement automatique dans un dossier choisi (File System Access)
// ne fonctionne que sur Chrome/Edge en version bureau : ni Safari, ni Firefox, ni iPhone, ni Android.
// Le nommage, lui, marche PARTOUT — c'est la seule partie qui tienne l'exigence « sur n'importe quel
// système ». Même déversés en vrac dans Téléchargements, les fichiers se regroupent et se trient tout
// seuls. Le rangement viendra par-dessus, sans rien changer à ceci.
//
// LA FORME : « Appli - Morceau - Type - Date Heure.ext »
//
//     HarmoHub - Ballade - Accords - 2026-09-17 1432.pdf
//     HarmoHub - Ballade - Morceau - 2026-09-17 1432.json
//     HarmoHub - Bibliotheque - 2026-09-17 1432.json
//
// L'ordre n'est pas arbitraire. L'appli en tête pour que HarmoHub et TabHub ne se mélangent jamais.
// Le MORCEAU ensuite, parce que c'est par morceau qu'on se perd — toutes ses pièces se retrouvent
// côte à côte dans n'importe quel explorateur trié par nom. Le type après, la date en dernier : les
// versions d'un même document s'empilent alors dans l'ordre chronologique.
//
// L'HEURE N'EST PAS DÉCORATIVE. Avec la seule date, deux exports le même jour donnent « (1) », « (2) »
// ajoutés par le navigateur — précisément ce qui fait perdre le fil des versions (retour utilisateur :
// « je me perds rapidement dans les versions »). Les deux-points étant interdits sous Windows, l'heure
// s'écrit « 1432 » et non « 14:32 ».
const NOM_APPLI = 'HarmoHub';

// Caractères interdits par Windows, plus les caractères de contrôle. macOS et Linux sont plus
// permissifs, mais un fichier doit pouvoir voyager d'une machine à l'autre : on s'aligne sur le plus
// strict des trois.
// Les points et espaces en FIN de nom sont retirés à part : Windows les supprime silencieusement à la
// création, si bien qu'un fichier ne porte pas le nom qu'on croit lui avoir donné.
function nettoyerNomFichier(nom, longueurMax = 60) {
    let propre = String(nom == null ? '' : nom)
        .replace(/[\\/:*?"<>|]/g, '_')
        .replace(/[\x00-\x1f\x7f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (propre.length > longueurMax) propre = propre.slice(0, longueurMax).trim();
    propre = propre.replace(/[. ]+$/, '');
    return propre || 'Sans titre';
}

// « 2026-09-17 1432 » — se trie correctement par ordre alphabétique, ce que ne permet aucun format
// local (17/09/2026 se classerait avant 03/12/2025).
function horodatageFichier(date = new Date()) {
    const deux = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${deux(date.getMonth() + 1)}-${deux(date.getDate())} `
        + `${deux(date.getHours())}${deux(date.getMinutes())}`;
}

// Construit le nom complet. `morceau` absent = document qui ne concerne pas un morceau précis
// (la bibliothèque), et le segment saute plutôt que d'afficher un vide.
function nomExport({ morceau, type, extension, date, appli } = {}) {
    const bouts = [appli || NOM_APPLI];
    if (morceau) bouts.push(nettoyerNomFichier(morceau));
    if (type) bouts.push(nettoyerNomFichier(type, 20));
    bouts.push(horodatageFichier(date instanceof Date ? date : new Date()));
    return `${bouts.join(' - ')}.${String(extension || 'dat').replace(/^\./, '')}`;
}

// =====================================================================================
// COUCHE RANGEMENT — écrire dans un dossier choisi plutôt que dans Téléchargements.
// =====================================================================================
//
// LE BESOIN. « Les exports de la bibliothèque et des morceaux se font directement dans les
// téléchargements, puis je dois les ranger correctement moi-même. Je me perds rapidement dans les
// versions. » Le nommage ci-dessus règle déjà le « je m'y perds » ; il reste le « je dois les ranger
// moi-même ».
//
// CE QUI EST POSSIBLE, ET CE QUI NE L'EST PAS. Aucun site web ne peut écrire où il veut sur un
// disque — ce serait une faille béante. La seule porte est File System Access : l'utilisateur DÉSIGNE
// un dossier une fois, et le navigateur nous y laisse écrire. Cette porte n'existe que sur Chrome et
// Edge en version bureau. Ni Safari (Mac ET iPhone), ni Firefox, ni Chrome Android ne l'ont.
// D'où l'architecture en deux étages, décidée avec l'utilisateur :
//   - étage du bas, PARTOUT : le nommage strict (voir plus haut). Les fichiers atterrissent en vrac
//     dans Téléchargements mais se regroupent et se trient tout seuls.
//   - étage du haut, LÀ OÙ C'EST POSSIBLE : le rangement automatique dans l'arborescence ci-dessous.
// Le second ne remplace jamais le premier : il se pose dessus. Si quoi que ce soit échoue — dossier
// débranché, permission refusée, clé USB retirée — on RETOMBE sur le téléchargement au lieu de perdre
// le fichier. Un export qui ne produit rien serait bien pire qu'un export mal rangé.
//
// LA RACINE. L'utilisateur choisit LE dossier de l'appli (pas un parent) : « deux dossiers frères
// plutôt, je ne vais pas les utiliser pour les mêmes musiques ». HarmoHub et TabHub, servis depuis la
// même origine, gardent donc chacun leur propre racine — d'où la clé par nom d'appli ci-dessous.
//
// L'ARBORESCENCE est à PLAT par type, sans refléter les dossiers de la bibliothèque (décision prise
// avec l'utilisateur) : un classement à deux dimensions — par dossier ET par type — oblige à choisir
// où chercher. À plat, on sait toujours : le PDF d'accords est dans PDF/Accords, point. Le lien entre
// les pièces d'un même morceau est porté par le NOM, pas par l'emplacement, et le nom voyage partout,
// y compris sur les téléphones qui n'ont pas cette couche.
const DOSSIERS_RANGEMENT = {
    bibliotheque: ['Bibliotheque'],
    morceaux: ['Morceaux'],
    pdfAccords: ['PDF', 'Accords'],
    pdfParoles: ['PDF', 'Paroles'],
    pdfStructure: ['PDF', 'Structure'],
    midi: ['MIDI'],
    audio: ['Audio'],
    texte: ['Texte'],
};

// Chemin affichable à l'utilisateur. Le navigateur ne donne JAMAIS le chemin absolu du dossier choisi
// (seulement son nom) : inutile d'essayer d'afficher « C:\... » — on montre ce qu'on connaît.
function cheminRangement(cle) {
    return (DOSSIERS_RANGEMENT[cle] || [String(cle)]).join('/');
}

function rangementDisponible() {
    return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}

// ---------- Mémoire de la racine ----------
// Les poignées de dossier ne sont pas du texte : localStorage ne peut pas les garder. IndexedDB, si —
// c'est le seul magasin du navigateur qui sache sérialiser un FileSystemHandle. Sans ça il faudrait
// redésigner le dossier à chaque session, ce qui viderait la fonctionnalité de son sens.
// ATTENTION : la poignée survit, mais PAS la permission. Chrome la redemande à chaque session, et
// seulement pendant un geste de l'utilisateur (voir preparerRangement).
const BDD_FICHIERS = 'harmohub_fichiers';
const BDD_STORE = 'racines';

function ouvrirBddFichiers() {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB indisponible'));
        const req = indexedDB.open(BDD_FICHIERS, 1);
        req.onupgradeneeded = () => {
            if (!req.result.objectStoreNames.contains(BDD_STORE)) req.result.createObjectStore(BDD_STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function transactionRacine(mode, action) {
    return ouvrirBddFichiers().then((bdd) => new Promise((resolve, reject) => {
        const tx = bdd.transaction(BDD_STORE, mode);
        const req = action(tx.objectStore(BDD_STORE));
        tx.oncomplete = () => { bdd.close(); resolve(req && req.result); };
        tx.onerror = () => { bdd.close(); reject(tx.error); };
    }));
}

// Clé par appli : HarmoHub et TabHub partagent l'origine, donc la base, mais pas la racine.
const cleRacine = (appli) => `racine:${appli || NOM_APPLI}`;

// Le NOM du dossier est doublé dans localStorage. Pas par redondance : lire IndexedDB demande un
// `await`, or les menus se construisent d'un trait, sans attente. Sans ce doublon, le menu ne pourrait
// pas dire quel dossier est configuré au moment où il s'affiche. Le nom seul ne donne aucun accès —
// la poignée, elle, reste dans IndexedDB.
const CLE_NOM_RACINE = 'harmohub_dossier_rangement';
function nomRacineAffiche(appli) {
    try { return localStorage.getItem(`${CLE_NOM_RACINE}:${appli || NOM_APPLI}`) || ''; } catch (e) { return ''; }
}
function retenirNomRacine(nom, appli) {
    try {
        const cle = `${CLE_NOM_RACINE}:${appli || NOM_APPLI}`;
        if (nom) localStorage.setItem(cle, nom); else localStorage.removeItem(cle);
    } catch (e) { /* mode privé saturé : le rangement marche quand même, seul l'affichage du nom se tait */ }
}

async function lireRacineMemorisee(appli) {
    try { return (await transactionRacine('readonly', (s) => s.get(cleRacine(appli)))) || null; }
    catch (e) { console.error('Lecture du dossier mémorisé impossible :', e); return null; }
}

async function memoriserRacine(handle, appli) {
    try { await transactionRacine('readwrite', (s) => s.put(handle, cleRacine(appli))); return true; }
    catch (e) { console.error('Mémorisation du dossier impossible :', e); return false; }
}

async function oublierRacine(appli) {
    retenirNomRacine('', appli);
    try { await transactionRacine('readwrite', (s) => s.delete(cleRacine(appli))); return true; }
    catch (e) { console.error('Oubli du dossier impossible :', e); return false; }
}

// ---------- Permission ----------
// `demander` n'est vrai que dans un geste de l'utilisateur : hors geste, Chrome REFUSE la demande au
// lieu de l'afficher, et on aurait brûlé notre unique occasion de la poser. On se contente alors de
// l'état actuel.
async function permissionEcriture(handle, demander) {
    if (!handle) return false;
    if (typeof handle.queryPermission !== 'function') return true; // stub de banc, ou OPFS : pas de garde-barrière
    const options = { mode: 'readwrite' };
    try {
        if ((await handle.queryPermission(options)) === 'granted') return true;
        if (!demander || typeof handle.requestPermission !== 'function') return false;
        return (await handle.requestPermission(options)) === 'granted';
    } catch (e) {
        console.error('Vérification de la permission impossible :', e);
        return false;
    }
}

// Renvoie la racine utilisable, ou null. À appeler EN PREMIER dans chaque export, tant que le clic de
// l'utilisateur est encore « chaud » : un export PDF passe trois secondes dans html2canvas, après quoi
// le navigateur considère le geste expiré et n'affiche plus aucune demande de permission.
async function preparerRangement({ demander = true, appli } = {}) {
    if (!rangementDisponible()) return null;
    const racine = await lireRacineMemorisee(appli);
    if (!racine) return null;
    if (!(await permissionEcriture(racine, demander))) return null;
    return racine;
}

// Ouvre le sélecteur de dossier. DOIT être appelé directement depuis un gestionnaire de clic : tout
// `await` placé avant consomme le geste et le navigateur rejette l'ouverture.
async function choisirDossierRangement(appli) {
    if (!rangementDisponible()) return null;
    let racine;
    try {
        racine = await window.showDirectoryPicker({ id: `racine-${appli || NOM_APPLI}`, mode: 'readwrite', startIn: 'documents' });
    } catch (e) {
        if (e && e.name === 'AbortError') return null; // l'utilisateur a fermé le sélecteur : ce n'est pas une panne
        console.error('Choix du dossier impossible :', e);
        return null;
    }
    if (!(await permissionEcriture(racine, true))) return null;
    // On crée l'arborescence TOUT DE SUITE, au lieu d'attendre le premier export de chaque type. Un
    // dossier vide n'inspire pas confiance : voir les huit sous-dossiers apparaître dit ce que l'appli
    // va faire, et laisse y déposer des fichiers à la main dès maintenant.
    try { await creerArborescence(racine); } catch (e) { console.error('Création de l\'arborescence incomplète :', e); }
    await memoriserRacine(racine, appli);
    retenirNomRacine(racine.name || '', appli);
    return racine;
}

async function creerArborescence(racine) {
    for (const cle of Object.keys(DOSSIERS_RANGEMENT)) await sousDossier(racine, cle, true);
}

async function sousDossier(racine, cle, creer) {
    let courant = racine;
    for (const nom of (DOSSIERS_RANGEMENT[cle] || [String(cle)])) {
        courant = await courant.getDirectoryHandle(nom, { create: !!creer });
    }
    return courant;
}

// ---------- Écriture ----------
// TOUS LES SUPPORTS N'ACCEPTENT PAS TOUS LES NOMS. Mesuré : le système de fichiers privé du
// navigateur (OPFS) refuse TOUT nom non-ASCII, précomposé ou décomposé — « Été à Noël » y est
// impossible, « Ete a Noel » passe. Un disque ordinaire, lui, accepte les accents sans broncher ;
// mais une clé en FAT, un partage réseau ou un support exotique peuvent avoir leurs propres limites.
// Plutôt que de retomber dans Téléchargements — ce que faisait le code, en silence, alors qu'un
// dossier est configuré — on réessaie avec le nom translittéré. La même translittération que pour le
// texte MIDI (voir asciiPourMidi) et pour la même raison : écrire ce qu'aucun support ne peut refuser.
// Les accents sont GARDÉS partout où c'est possible : c'est une appli française, les titres en portent.
// LES ACCENTS SONT RETIRÉS DU TEXTE MIDI, ET CE N'EST PAS UNE NÉGLIGENCE.
// La norme MIDI ne dit RIEN de l'encodage des événements de texte (titre du morceau, nom de piste,
// marqueurs de partie) : elle les décrit comme du texte 8 bits, sans préciser lequel. Chaque lecteur
// devine donc à sa façon — et chez MuseScore, savoir lire un jeu de caractères autre qu'ASCII est
// encore une demande ouverte, pas une capacité (musescore.org/en/node/3370). Résultat mesuré ici même
// avec un lecteur MIDI tiers : « Cordes synthé » écrit en UTF-8 ressort en « Cordes synthÃ© ».
// Aucun encodage n'étant universellement juste, on ne parie pas : on écrit ce qu'AUCUN lecteur ne peut
// déformer. « Été à Noël » devient « Ete a Noel » — l'accent se perd, mais lisiblement, et le repère
// reste utilisable pour naviguer dans le morceau.
// CE CHOIX NE VAUT QUE POUR LE MIDI. Les NOMS DE FICHIERS, eux, gardent leurs accents (voir
// nettoyerNomFichier dans fichiers.js) : un système de fichiers moderne sait exactement quoi en faire,
// là où le MIDI ne le sait pas. Deux médias, deux contraintes, deux réponses.
function asciiPourMidi(text) {
    return String(text == null ? '' : text)
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // é -> e, à -> a, ï -> i...
        .replace(/[œŒ]/g, (c) => (c === 'œ' ? 'oe' : 'OE'))
        .replace(/[æÆ]/g, (c) => (c === 'æ' ? 'ae' : 'AE'))
        .replace(/[’‘‚‛]/g, "'").replace(/[“”„]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...')
        .replace(/ß/g, 'ss')
        .replace(/[^\x20-\x7e]/g, '');                      // tout ce qui reste hors ASCII imprimable
}

function nomsCandidats(nomFichier) {
    const ascii = asciiPourMidi(nomFichier);
    return (ascii && ascii !== nomFichier) ? [nomFichier, ascii] : [nomFichier];
}

// Vrai si l'erreur dit « ce nom ne convient pas » plutôt que « le disque est plein » ou « permission
// refusée ». On ne translittère que dans ce cas-là : réessayer sous un autre nom parce que le disque
// est plein ne ferait que produire un second échec, sous un nom moins lisible.
function estErreurDeNom(e) {
    return !!e && (e.name === 'TypeMismatchError' || e.name === 'TypeError' || e.name === 'InvalidCharacterError');
}

async function ecrireDansRacine(racine, cle, nomFichier, blob) {
    const dossier = await sousDossier(racine, cle, true);
    let derniere;
    for (const candidat of nomsCandidats(nomFichier)) {
        try {
            const fichier = await dossier.getFileHandle(candidat, { create: true });
            const flux = await fichier.createWritable();
            try { await flux.write(blob); } finally { await flux.close(); }
            return { fichier, nom: candidat };
        } catch (e) {
            derniere = e;
            if (!estErreurDeNom(e)) throw e;
        }
    }
    throw derniere;
}

// Liste les fichiers réellement présents dans un sous-dossier, du plus récent au plus ancien. Lit le
// DISQUE, pas l'index : c'est le disque qui fait foi (l'utilisateur peut supprimer des fichiers à la
// main sans que l'appli en sache rien).
async function listerRangement(cle, { appli } = {}) {
    const racine = await preparerRangement({ demander: false, appli });
    if (!racine) return [];
    try {
        const dossier = await sousDossier(racine, cle, false);
        const noms = [];
        for await (const [nom, handle] of dossier.entries()) {
            if (handle.kind === 'file') noms.push(nom);
        }
        // Les noms portent « aaaa-mm-jj hhmm » : le tri alphabétique décroissant EST le tri
        // chronologique inverse (voir horodatageFichier). Pas besoin de lire les dates du système.
        return noms.sort().reverse();
    } catch (e) { return []; }
}

// ---------- Repli : le téléchargement classique ----------
// Ce bloc était recopié à SEPT endroits (bibliothèque, morceau, PDF, MIDI, paroles, MP3, texte). Un
// seul exemplaire : l'oubli d'un revokeObjectURL ou d'un remove() ne peut plus exister qu'une fois.
function telechargerBlob(blob, nomFichier) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomFichier;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

// =====================================================================================
// NOM CANONIQUE ET ROTATION DES VERSIONS
// =====================================================================================
//
// LE DÉFAUT QUE ÇA CORRIGE. Jusqu'ici chaque nom portait la date à la minute : deux exports du même
// morceau donnaient deux fichiers, et rien n'était jamais écrasé. Sûr, mais c'est une sûreté PAR
// ACCUMULATION — rien n'étant jamais écrasé, rien n'est jamais REMPLACÉ non plus. Au bout de dix
// exports, dix fichiers, et aucun dont on puisse dire « c'est LE fichier de Ballade ». Le « je me
// perds rapidement dans les versions » revenait par la fenêtre.
//
// DÉSORMAIS : un nom STABLE pour le fichier courant, et les anciens poussés dans `_versions/`.
//
//     Morceaux/HarmoHub - Ballade.json                              <- LE fichier, jamais renommé
//     Morceaux/_versions/HarmoHub - Ballade - 2026-09-17 1432.json  <- les dix précédents
//
// Le nom stable se retrouve les yeux fermés, se met en favori, et donne un point fixe à l'import.
// Les versions gardent l'horodatage triable du lot A — c'est LÀ qu'il sert vraiment, puisque c'est là
// qu'on cherche « celle d'avant ».
//
// SOURCES ET DÉRIVÉS, DEUX RÉGIMES. Un JSON de morceau ou de bibliothèque est une SOURCE : l'écraser
// peut perdre du travail, d'où le garde-fou de fraîcheur (voir lireMorceauSurDisque, côté appli). Un
// PDF, un MIDI, un MP3, un TXT sont DÉRIVÉS : ils se régénèrent d'un clic, les écraser ne perd rien.
// Les deux profitent de la rotation ; seules les sources déclenchent une question.
const DOSSIER_VERSIONS = '_versions';
// Le même nom, destiné à l'affichage : il apparaît dans des phrases lues par l'utilisateur.
const DOSSIER_VERSIONS_AFFICHE = '_versions';
const VERSIONS_GARDEES = 10;

// « HarmoHub - Ballade.json » — le même nom, toujours, pour un morceau donné.
function nomCanonique({ morceau, type, extension, appli } = {}) {
    const bouts = [appli || NOM_APPLI];
    if (morceau) bouts.push(nettoyerNomFichier(morceau));
    if (type) bouts.push(nettoyerNomFichier(type, 20));
    return `${bouts.join(' - ')}.${String(extension || 'dat').replace(/^\./, '')}`;
}

const separeNom = (nomFichier) => {
    const i = nomFichier.lastIndexOf('.');
    return i > 0 ? { base: nomFichier.slice(0, i), ext: nomFichier.slice(i) } : { base: nomFichier, ext: '' };
};

// LES VERSIONS SE DATENT À LA SECONDE, pas à la minute comme les noms d'export.
// Mesuré : quatre enregistrements rapprochés ne laissaient qu'UNE archive. L'horodatage à la minute
// donnait le même nom aux quatre, et chacune écrasait la précédente — le filet de sécurité se vidait
// tout seul, en silence, exactement dans le cas où l'on en a le plus besoin (des essais successifs en
// quelques minutes). Deux Ctrl+S d'affilée suffisaient.
// La seconde suffit à les distinguer et garde le tri chronologique (aaaa-mm-jj hhmmss se trie comme
// il se lit). Le compteur en dernier recours couvre le cas, improbable mais pas impossible, de deux
// écritures dans la même seconde.
function horodatageVersion(date = new Date()) {
    const deux = (n) => String(n).padStart(2, '0');
    return `${horodatageFichier(date)}${deux(date.getSeconds())}`;
}

// Recopie le fichier en place dans `_versions/`, horodaté à SA date de dernière écriture — pas à
// maintenant. Une version doit dire quand elle a été faite, sinon les dix archives portent toutes
// l'heure du jour où on a archivé et ne servent plus à se repérer.
async function archiverVersion(racine, cle, nomFichier) {
    const dossier = await sousDossier(racine, cle, true);
    let ancien, nomReel;
    for (const candidat of nomsCandidats(nomFichier)) {
        try { ancien = await dossier.getFileHandle(candidat, { create: false }); nomReel = candidat; break; }
        catch (e) { /* essaie le suivant */ }
    }
    if (!ancien) return null; // rien à archiver : premier enregistrement
    const fichier = await ancien.getFile();
    const { base, ext } = separeNom(nomReel);
    const versions = await dossier.getDirectoryHandle(DOSSIER_VERSIONS, { create: true });
    const socle = `${base} - ${horodatageVersion(new Date(fichier.lastModified || Date.now()))}`;
    let nomVersion = `${socle}${ext}`;
    for (let n = 2; n <= 20; n++) {
        try { await versions.getFileHandle(nomVersion, { create: false }); }
        catch (e) { break; }                       // libre : on garde ce nom
        nomVersion = `${socle} (${n})${ext}`;      // occupé : on ne recouvre pas une archive existante
    }
    const flux = await (await versions.getFileHandle(nomVersion, { create: true })).createWritable();
    try { await flux.write(await fichier.arrayBuffer()); } finally { await flux.close(); }
    return nomVersion;
}

// LA SEULE SUPPRESSION DE TOUT LE PROJET, et elle est volontairement étroite : uniquement dans
// `_versions/`, uniquement les fichiers dont le nom commence par la base du morceau concerné, et
// uniquement au-delà des dix plus récents. Elle ne peut pas atteindre un fichier courant, ni le
// fichier d'un autre morceau, ni quoi que ce soit que l'utilisateur aurait déposé là à la main sous
// un autre nom. Le tri est alphabétique DÉCROISSANT, ce qui est l'ordre chronologique inverse puisque
// l'horodatage s'écrit aaaa-mm-jj hhmm (voir horodatageFichier).
async function purgerVersions(racine, cle, nomFichier, nbGardees = VERSIONS_GARDEES) {
    const dossier = await sousDossier(racine, cle, true);
    let versions;
    try { versions = await dossier.getDirectoryHandle(DOSSIER_VERSIONS, { create: false }); }
    catch (e) { return []; }
    const { base, ext } = separeNom(nomFichier);
    const prefixe = `${base} - `;
    const siennes = [];
    for await (const [nom, h] of versions.entries()) {
        if (h.kind === 'file' && nom.startsWith(prefixe) && nom.endsWith(ext)) siennes.push(nom);
    }
    siennes.sort().reverse();
    const aSupprimer = siennes.slice(nbGardees);
    for (const nom of aSupprimer) {
        try { await versions.removeEntry(nom); }
        catch (e) { console.error('Version non purgée (sans gravité, le fichier courant est intact) :', nom, e); }
    }
    return aSupprimer;
}

// Lit le fichier en place, s'il existe, et rend son JSON. Sert au garde-fou de fraîcheur : c'est le
// DISQUE qui fait foi, pas ce que l'appli croit y avoir laissé. Un fichier illisible est traité comme
// absent plutôt que comme un obstacle — on ne refuse pas d'enregistrer à cause d'un fichier abîmé.
async function lireJsonRange(racine, cle, nomFichier) {
    try {
        const dossier = await sousDossier(racine, cle, false);
        for (const candidat of nomsCandidats(nomFichier)) {
            try {
                const fichier = await (await dossier.getFileHandle(candidat, { create: false })).getFile();
                return { existe: true, nom: candidat, contenu: JSON.parse(await fichier.text()), modifieAt: fichier.lastModified };
            } catch (e) { /* nom suivant */ }
        }
    } catch (e) { /* sous-dossier absent */ }
    return { existe: false, contenu: null, modifieAt: 0 };
}

// Liste les versions archivées d'un fichier, de la plus récente à la plus ancienne.
async function listerVersions(racine, cle, nomFichier) {
    const dossier = await sousDossier(racine, cle, true);
    let versions;
    try { versions = await dossier.getDirectoryHandle(DOSSIER_VERSIONS, { create: false }); }
    catch (e) { return []; }
    const { base, ext } = separeNom(nomFichier);
    const trouvees = [];
    for await (const [nom, h] of versions.entries()) {
        if (h.kind === 'file' && nom.startsWith(`${base} - `) && nom.endsWith(ext)) trouvees.push(nom);
    }
    return trouvees.sort().reverse();
}

// ---------- L'IMPORT DIRECT ----------
// Le sélecteur de fichiers s'ouvrait là où le SYSTÈME s'était arrêté la dernière fois — soit, le plus
// souvent, dans Téléchargements, ou dans le dernier dossier visité pour une raison sans rapport. Il
// fallait donc naviguer à la main jusqu'au dossier HarmoHub à chaque import, alors que l'appli sait
// exactement où il est.
// `startIn` accepte une poignée de dossier : on l'ouvre DANS le bon sous-dossier, pas seulement à la
// racine. Comme le sélecteur de dossier, ceci DOIT partir d'un geste de l'utilisateur.
// Repli complet sur `<input type="file">` là où l'API n'existe pas (Safari, Firefox, téléphones) : le
// confort disparaît, l'import reste possible.
async function choisirFichierAImporter({ cle = 'morceaux', appli, description = 'Sauvegarde HarmoHub', extensions = ['.json'] } = {}) {
    if (typeof window === 'undefined' || typeof window.showOpenFilePicker !== 'function') return null;
    let depart;
    try {
        const racine = await preparerRangement({ demander: true, appli });
        if (racine) depart = await sousDossier(racine, cle, false);
    } catch (e) { /* dossier absent : le sélecteur s'ouvrira où il veut, ce n'est pas bloquant */ }
    try {
        const options = {
            multiple: false,
            types: [{ description, accept: { 'application/json': extensions } }],
        };
        if (depart) options.startIn = depart;
        const [poignee] = await window.showOpenFilePicker(options);
        return await poignee.getFile();
    } catch (e) {
        if (e && e.name === 'AbortError') return 'annule'; // fermé sans choisir : ce n'est pas une panne
        console.error('Sélecteur de fichier indisponible, repli sur le champ classique :', e);
        return null;
    }
}

// =====================================================================================
// LE PARTAGE SYSTÈME — le seul rangement possible sur iPhone et sur Safari
// =====================================================================================
//
// File System Access n'existe pas sur Safari (Mac ET iPhone), ni sur Chrome Android. Sur ces
// appareils-là, un export tombait dans Téléchargements sans que personne choisisse rien. Or l'iPhone
// a une autre porte : la FEUILLE DE PARTAGE. `navigator.share` avec des fichiers fonctionne depuis
// Safari 15, et la feuille propose « Enregistrer dans Fichiers » — donc iCloud Drive, donc un vrai
// rangement, choisi par l'utilisateur, au même endroit que ce que l'ordinateur range tout seul.
//
// DEUX PIÈGES CONNUS, LES DEUX ÉVITÉS ICI :
//   - il faut passer UNIQUEMENT `files`. Ajouter `title` ou `text` fait échouer le partage de fichier
//     sur iOS, ou le transforme en partage de texte ;
//   - `canShare` doit être interrogé AVANT, avec le fichier lui-même : le type de fichier peut être
//     refusé, et on ne le sait pas autrement.
// Comme partout ailleurs, l'échec retombe sur le téléchargement plutôt que de perdre le fichier.
function partageFichierPossible(fichier) {
    return typeof navigator !== 'undefined'
        && typeof navigator.share === 'function'
        && typeof navigator.canShare === 'function'
        && navigator.canShare({ files: [fichier] });
}

// Doit être appelé DANS le geste de l'utilisateur, comme le sélecteur de dossier.
async function partagerFichier(blob, nomFichier) {
    let fichier;
    try { fichier = new File([blob], nomFichier, { type: blob.type || 'application/octet-stream' }); }
    catch (e) { return false; } // constructeur File absent (très vieux navigateur)
    if (!partageFichierPossible(fichier)) return false;
    try {
        await navigator.share({ files: [fichier] });
        return true;
    } catch (e) {
        // AbortError = feuille de partage refermée sans choisir. Ce n'est pas une panne, et surtout ce
        // n'est pas une invitation à télécharger dans le dos de quelqu'un qui vient de renoncer.
        if (e && e.name === 'AbortError') return 'annule';
        console.error('Partage impossible, repli sur le téléchargement :', e);
        return false;
    }
}


// =====================================================================================
// LES FICHIERS D'UN MORCEAU — pour pouvoir les montrer avant d'y toucher
// =====================================================================================
//
// Demande de l'utilisateur : « lorsque je supprime un morceau de l'appli, l'appli doit me demander si
// elle doit également supprimer tous les fichiers du disque qui lui sont liés ».
//
// C'est la première fois que ce projet efface des fichiers que l'utilisateur n'a pas désignés un par
// un (la purge des versions, elle, est bornée à `_versions/`). La sûreté ne vient donc pas d'une règle
// prudente cachée dans le code, mais du fait qu'on MONTRE la liste exacte avant de demander.
//
// LE PIÈGE DU PRÉFIXE, et il n'est pas théorique. Les fichiers d'un morceau « Ballade » commencent par
// « HarmoHub - Ballade - ». Or ceux d'un morceau nommé « Ballade - live » commencent PAR LA MÊME
// CHAÎNE. Supprimer le premier emporterait les fichiers du second. D'où la règle ci-dessous : un
// fichier qui appartient AUSSI à un autre morceau de la bibliothèque n'est jamais retenu. On préfère
// laisser un fichier de trop que d'en enlever un de travers.
function prefixeMorceau(nom, appli) {
    return `${appli || NOM_APPLI} - ${nettoyerNomFichier(nom)} - `;
}

// Retrouve le nom du morceau À PARTIR DU NOM DE FICHIER — « HarmoHub - Ballade - Morceau.json » donne
// « Ballade ». C'est le nom de FICHIER qui détermine quels fichiers vont ensemble sur le disque, pas ce
// que contient le JSON : un fichier renommé à la main, ou dont le titre interne a divergé, doit quand
// même se regrouper avec ses PDF et ses MIDI, qui n'ont aucun contenu interrogeable.
function nomMorceauDepuisFichier(nomFichier, appli) {
    const tete = `${appli || NOM_APPLI} - `;
    if (!nomFichier.startsWith(tete)) return null;
    const reste = nomFichier.slice(tete.length).replace(/\.[^.]+$/, '');
    // Le dernier segment est le TYPE (Morceau, Accords, Audio…) ; tout ce qui précède est le nom.
    const i = reste.lastIndexOf(' - ');
    return (i > 0 ? reste.slice(0, i) : reste) || null;
}

function estFichierDuMorceau(nomFichier, prefixe, prefixesAutres) {
    if (!nomFichier.startsWith(prefixe)) return false;
    // Plus spécifique = appartient à l'autre. « HarmoHub - Ballade - live - … » est à « Ballade - live »,
    // pas à « Ballade ».
    return !prefixesAutres.some(p => p.length > prefixe.length && nomFichier.startsWith(p));
}

// Parcourt tous les dossiers de rangement, `_versions/` compris, et rend la liste exacte des fichiers
// rattachés à ce morceau. Ne supprime rien : c'est cette liste qu'on affiche.
async function fichiersDuMorceau(racine, nom, autresNoms = [], { appli } = {}) {
    // Les DEUX écritures possibles du préfixe (accentuée et translittérée, voir nomsCandidats) :
    // un morceau écrit sur un support qui refuse les accents doit quand même se retrouver.
    const prefixes = nomsCandidats(prefixeMorceau(nom, appli));
    const prefixe = prefixes[0];
    const prefixesAutres = autresNoms.flatMap(n => nomsCandidats(prefixeMorceau(n, appli)));
    const trouves = [];
    for (const cle of Object.keys(DOSSIERS_RANGEMENT)) {
        // La BIBLIOTHÈQUE est exclue : son fichier contient TOUS les morceaux, le supprimer pour un
        // seul serait une catastrophe. Elle est rafraîchie autrement (voir l'appli).
        if (cle === 'bibliotheque') continue;
        let dossier;
        try { dossier = await sousDossier(racine, cle, false); } catch (e) { continue; }
        const scruter = async (d, sousChemin) => {
            for await (const [nomFichier, h] of d.entries()) {
                if (h.kind === 'directory') {
                    if (nomFichier === DOSSIER_VERSIONS) await scruter(h, `${sousChemin}/${DOSSIER_VERSIONS}`);
                    continue;
                }
                if (prefixes.some(p => estFichierDuMorceau(nomFichier, p, prefixesAutres))) {
                    trouves.push({ cle, nom: nomFichier, versions: sousChemin.endsWith(DOSSIER_VERSIONS), chemin: `${sousChemin}/${nomFichier}` });
                }
            }
        };
        await scruter(dossier, cheminRangement(cle));
    }
    return trouves;
}

// Supprime la liste RENDUE PAR fichiersDuMorceau, et rien d'autre. Elle ne recalcule pas ce qu'il faut
// effacer : ce qui a été montré est ce qui est supprimé, sans possibilité d'écart entre les deux.
async function supprimerFichiers(racine, liste) {
    let faits = 0;
    const echecs = [];
    for (const f of liste) {
        try {
            let dossier = await sousDossier(racine, f.cle, false);
            if (f.versions) dossier = await dossier.getDirectoryHandle(DOSSIER_VERSIONS, { create: false });
            await dossier.removeEntry(f.nom);
            faits++;
        } catch (e) {
            echecs.push(f.chemin);
            console.error('Suppression impossible :', f.chemin, e);
        }
    }
    return { faits, echecs };
}

// LE POINT DE PASSAGE UNIQUE de tout ce qui sort de l'appli. Range si c'est possible, télécharge
// sinon, et dit dans son retour ce qui s'est réellement passé — pour que le message affiché à
// l'utilisateur ne mente jamais sur l'endroit où son fichier se trouve.
// `racine` peut être fournie par l'appelant qui l'a déjà préparée pendant le geste (voir
// preparerRangement) ; sinon on tente sans redemander la permission.
// `versionne` (par défaut vrai quand un dossier est configuré) : nom STABLE, l'ancien fichier poussé
// dans `_versions/`. Mis à faux, on retrouve l'ancien régime — un fichier horodaté par export. Le
// TÉLÉCHARGEMENT, lui, garde toujours le nom horodaté : dans Téléchargements il n'y a ni dossier de
// versions ni rotation, et deux fichiers de même nom y deviennent « (1) », « (2) » — exactement ce
// qu'on cherche à éviter.
async function enregistrerFichier(blob, { morceau, type, extension, dossier, nom, date, appli, racine, versionne = true, partage } = {}) {
    const nomHorodate = nom || nomExport({ morceau, type, extension, date, appli });
    const nomFichier = (versionne && !nom) ? nomCanonique({ morceau, type, extension, appli }) : nomHorodate;
    const cle = dossier || 'morceaux';
    // `undefined` = l'appelant n'a rien préparé : on s'en charge, en demandant la permission si
    // besoin — légitime ici, ces exports-là sont instantanés et le clic est encore valide. Un `null`
    // explicite, lui, dit « j'ai déjà regardé, il n'y a pas de dossier » : on ne redemande pas.
    let cible = racine;
    if (cible === undefined) cible = await preparerRangement({ demander: true, appli });
    if (cible) {
        try {
            // L'ancien est mis de côté AVANT d'écrire le nouveau : si l'écriture échoue à mi-chemin,
            // la copie d'archive existe déjà et rien n'est perdu. L'ordre inverse laisserait une
            // fenêtre où ni l'ancien ni le nouveau ne seraient complets.
            let archive = null;
            if (versionne) {
                try { archive = await archiverVersion(cible, cle, nomFichier); }
                catch (e) { console.error('Version précédente non archivée :', e); }
            }
            // `nomEcrit` peut différer de `nomFichier` : voir nomsCandidats, quand le support refuse
            // les accents. Tout ce qui suit s'appuie sur le nom RÉELLEMENT écrit, jamais sur celui
            // qu'on espérait — sinon la rotation des versions purgerait à côté et le message
            // annoncerait un fichier qui n'existe pas.
            const { nom: nomEcrit } = await ecrireDansRacine(cible, cle, nomFichier, blob);
            if (versionne) { try { await purgerVersions(cible, cle, nomEcrit); } catch (e) { console.error('Purge des versions impossible :', e); } }
            const chemin = `${cheminRangement(cle)}/${nomEcrit}`;
            // PAS D'INDEX. Un `_index.json` était écrit ici à chaque export, recensant ce qui avait été
            // rangé. Il a été retiré : RIEN NE LE LISAIT. Les garde-fous, l'inventaire et la liste des
            // versions interrogent tous le DISQUE directement — et c'est le bon choix, puisque
            // l'utilisateur peut déplacer ou effacer un fichier à la main sans que l'appli en sache
            // rien. Une comptabilité parallèle qui peut diverger de la réalité est un passif, pas un
            // actif : elle coûte une lecture, une analyse et une écriture à chaque export, et le jour
            // où elle ment, elle ment avec assurance.
            return { range: true, nom: nomEcrit, dossier: cheminRangement(cle), chemin, archive, racine: cible.name || '' };
        } catch (e) {
            // Dossier débranché, disque plein, permission retirée en cours de route : on ne perd pas
            // le fichier pour autant.
            console.error('Rangement impossible, repli sur le téléchargement :', e);
        }
    }
    // AVANT DE TÉLÉCHARGER À L'AVEUGLE : proposer la feuille de partage, là où elle existe. C'est
    // l'iPhone et Safari, c'est-à-dire précisément les appareils où rien ne range automatiquement.
    // `partage: false` permet de la refuser explicitement (écriture de fond, sans geste).
    if (partage !== false) {
        const resultat = await partagerFichier(blob, nomHorodate);
        if (resultat === true) return { range: 'partage', nom: nomHorodate, dossier: null, chemin: null, archive: null };
        if (resultat === 'annule') return { range: false, annule: true, nom: nomHorodate, dossier: null, chemin: null, archive: null };
    }
    telechargerBlob(blob, nomHorodate);
    return { range: false, nom: nomHorodate, dossier: null, chemin: null, archive: null };
}

// Message à afficher après un export. Un seul endroit, parce qu'une destination annoncée à tort est
// exactement ce qui fait perdre un fichier : « PDF téléchargé → dossier Téléchargements » était écrit
// en dur à sept endroits et deviendrait faux dès qu'un dossier est configuré.
function messageEnregistrement(resultat, quoi) {
    if (!resultat) return quoi;
    if (resultat.annule) return `${quoi} : annulé, rien n'a été enregistré`;
    if (resultat.range === 'partage') return `${quoi} → choisis « Enregistrer dans Fichiers »`;
    return resultat.range
        ? `${quoi} → ${resultat.racine ? resultat.racine + '/' : ''}${resultat.dossier}`
        : `${quoi} → dossier Téléchargements`;
}
