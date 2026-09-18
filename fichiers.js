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
async function ecrireDansRacine(racine, cle, nomFichier, blob) {
    const dossier = await sousDossier(racine, cle, true);
    const fichier = await dossier.getFileHandle(nomFichier, { create: true });
    const flux = await fichier.createWritable();
    try { await flux.write(blob); } finally { await flux.close(); }
    return fichier;
}

// L'INDEX. Un fichier _index.json à la racine recense ce qui a été écrit. Il ne sert pas à retrouver
// les fichiers — l'explorateur le fait très bien — mais à ce que l'appli sache, SANS parcourir tout le
// disque, quelles versions d'un même document existent déjà. C'est ce qui permettra de proposer
// « écraser ou garder les deux », puis de ne conserver que les dix dernières versions.
// Il est reconstructible : s'il manque ou s'il est illisible, on repart d'un index vide plutôt que de
// refuser d'écrire. Un catalogue perdu ne doit jamais bloquer une sauvegarde.
const NOM_INDEX = '_index.json';

async function lireIndex(racine) {
    try {
        const fichier = await racine.getFileHandle(NOM_INDEX, { create: false });
        const contenu = JSON.parse(await (await fichier.getFile()).text());
        if (contenu && Array.isArray(contenu.fichiers)) return contenu;
    } catch (e) { /* absent ou abîmé : on repart à zéro, voir ci-dessus */ }
    return { app: NOM_APPLI, version: 1, fichiers: [] };
}

async function ecrireIndex(racine, index) {
    index.majAt = Date.now();
    const fichier = await racine.getFileHandle(NOM_INDEX, { create: true });
    const flux = await fichier.createWritable();
    try { await flux.write(new Blob([JSON.stringify(index, null, 2)], { type: 'application/json' })); }
    finally { await flux.close(); }
}

async function noterDansIndex(racine, entree) {
    const index = await lireIndex(racine);
    // Même chemin = même fichier réécrit : on remplace la ligne au lieu d'en empiler une seconde, sinon
    // l'index compterait des versions qui n'existent plus.
    index.fichiers = index.fichiers.filter((f) => f.chemin !== entree.chemin);
    index.fichiers.push(entree);
    await ecrireIndex(racine, index);
    return index;
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
    let ancien;
    try { ancien = await dossier.getFileHandle(nomFichier, { create: false }); }
    catch (e) { return null; } // rien à archiver : premier enregistrement
    const fichier = await ancien.getFile();
    const { base, ext } = separeNom(nomFichier);
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
        const fichier = await (await dossier.getFileHandle(nomFichier, { create: false })).getFile();
        return { existe: true, contenu: JSON.parse(await fichier.text()), modifieAt: fichier.lastModified };
    } catch (e) {
        return { existe: false, contenu: null, modifieAt: 0 };
    }
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
            await ecrireDansRacine(cible, cle, nomFichier, blob);
            if (versionne) { try { await purgerVersions(cible, cle, nomFichier); } catch (e) { console.error('Purge des versions impossible :', e); } }
            const chemin = `${cheminRangement(cle)}/${nomFichier}`;
            // L'index est un confort : s'il échoue, le FICHIER est déjà écrit et c'est lui qui compte.
            try {
                await noterDansIndex(cible, {
                    chemin, nom: nomFichier, dossier: cheminRangement(cle),
                    morceau: morceau || null, type: type || null,
                    extension: extension || null, taille: blob.size, ecritAt: Date.now(),
                });
            } catch (e) { console.error('Index non mis à jour (le fichier, lui, est bien écrit) :', e); }
            return { range: true, nom: nomFichier, dossier: cheminRangement(cle), chemin, archive, racine: cible.name || '' };
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
