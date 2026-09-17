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

// LE POINT DE PASSAGE UNIQUE de tout ce qui sort de l'appli. Range si c'est possible, télécharge
// sinon, et dit dans son retour ce qui s'est réellement passé — pour que le message affiché à
// l'utilisateur ne mente jamais sur l'endroit où son fichier se trouve.
// `racine` peut être fournie par l'appelant qui l'a déjà préparée pendant le geste (voir
// preparerRangement) ; sinon on tente sans redemander la permission.
async function enregistrerFichier(blob, { morceau, type, extension, dossier, nom, date, appli, racine } = {}) {
    const nomFichier = nom || nomExport({ morceau, type, extension, date, appli });
    const cle = dossier || 'morceaux';
    // `undefined` = l'appelant n'a rien préparé : on s'en charge, en demandant la permission si
    // besoin — légitime ici, ces exports-là sont instantanés et le clic est encore valide. Un `null`
    // explicite, lui, dit « j'ai déjà regardé, il n'y a pas de dossier » : on ne redemande pas.
    let cible = racine;
    if (cible === undefined) cible = await preparerRangement({ demander: true, appli });
    if (cible) {
        try {
            await ecrireDansRacine(cible, cle, nomFichier, blob);
            const chemin = `${cheminRangement(cle)}/${nomFichier}`;
            // L'index est un confort : s'il échoue, le FICHIER est déjà écrit et c'est lui qui compte.
            try {
                await noterDansIndex(cible, {
                    chemin, nom: nomFichier, dossier: cheminRangement(cle),
                    morceau: morceau || null, type: type || null,
                    extension: extension || null, taille: blob.size, ecritAt: Date.now(),
                });
            } catch (e) { console.error('Index non mis à jour (le fichier, lui, est bien écrit) :', e); }
            return { range: true, nom: nomFichier, dossier: cheminRangement(cle), chemin, racine: cible.name || '' };
        } catch (e) {
            // Dossier débranché, disque plein, permission retirée en cours de route : on ne perd pas
            // le fichier pour autant.
            console.error('Rangement impossible, repli sur le téléchargement :', e);
        }
    }
    telechargerBlob(blob, nomFichier);
    return { range: false, nom: nomFichier, dossier: null, chemin: null };
}

// Message à afficher après un export. Un seul endroit, parce qu'une destination annoncée à tort est
// exactement ce qui fait perdre un fichier : « PDF téléchargé → dossier Téléchargements » était écrit
// en dur à sept endroits et deviendrait faux dès qu'un dossier est configuré.
function messageEnregistrement(resultat, quoi) {
    if (!resultat) return quoi;
    return resultat.range
        ? `${quoi} → ${resultat.racine ? resultat.racine + '/' : ''}${resultat.dossier}`
        : `${quoi} → dossier Téléchargements`;
}
