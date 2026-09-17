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
