// HISTORIQUE DES VERSIONS — le filet sous l'enregistrement MANUEL (refonte de l'interface, lot 3b ; docs/refonte.md).
//
// POURQUOI. Décision prise avec l'utilisateur sur la maquette : « je veux bien garder le bouton enregistrer… enregistrement manuel. Mais
// garde quand même des enregistrements automatiques en arrière-plan pour pouvoir revenir en arrière. » Un enregistrement manuel n'est
// supportable que s'il y a une porte de sortie : on teste, on casse, on veut revenir. Ce fichier est cette porte — il garde des
// INSTANTANÉS du morceau, il ne décide pas QUAND en prendre (script.js : toutes les 5 minutes de travail, avant chaque opération lourde,
// à chaque enregistrement) ni comment les présenter (Paramètres › Historique et récupération).
//
// OÙ ILS VIVENT, ET C'EST LE POINT QUI COMPTE.
//   • PAS DANS localStorage. Il est limité (≈ 5 Mo) et PARTAGÉ avec la bibliothèque des morceaux : un historique qui le remplirait ferait
//     échouer l'enregistrement des morceaux eux-mêmes — le filet de sécurité qui coule le bateau. IndexedDB a son propre quota, bien plus large.
//   • PAS DANS LE CLOUD. Le document Firestore d'un utilisateur est limité à 1 Mio (voir docs/synchro-donnees.md) ; des versions de tous
//     les morceaux n'y tiendraient pas. Elles restent donc PAR APPAREIL : ce qu'on a défait sur l'ordinateur n'est pas défait sur le téléphone.
//     C'est dit tel quel à l'utilisateur dans le panneau.
//
// CE QUE CE FICHIER NE FAIT JAMAIS : lever. Navigation privée, IndexedDB absent, quota plein, base verrouillée par un autre onglet — dans
// tous ces cas l'historique devient simplement indisponible (raison() dit pourquoi, le panneau l'affiche) et l'appli continue d'enregistrer
// comme avant. Un filet de sécurité qui peut faire tomber la voiture est pire que pas de filet.
//
// FORMAT D'UNE VERSION  { id, songId, songName, date, motif, libelle, empreinte, resume:{accords,parties}, charge }
//   songId  '' pour un tampon qui n'a jamais été enregistré sous un nom (« Nouveau morceau ») : c'est là qu'un plantage coûte le plus.
//   motif   'auto' | 'enregistre' | 'avant-transposition' | 'avant-suppression-partie' | 'avant-suppression-morceau' | 'avant-import' |
//           'avant-restauration' | 'abandon'  (le panneau en tire l'étiquette ; un motif inconnu s'affiche tel quel, jamais d'erreur)
//   charge  le contenu du morceau tel que saveCurrentSong l'écrirait : sections, structure, root, mode, timeSig, groove, bpm, instrumentMorceau, zoom…
//   empreinte  condensé du CONTENU musical (pas du zoom) : deux versions d'empreinte égale sont la même version, la seconde n'est pas gardée.
//
// LES PAROLES ONT LEUR PROPRE HISTORIQUE (sous-lot « Paroles homogènes », 05/11). Demande de l'utilisateur : « Garde en mémoire des sauvegardes
// précédentes » — les paroles s'enregistrent toutes seules (« Oui tu peux enregistrer les paroles automatiquement »), sans ce filet une
// mauvaise manipulation (tout sélectionner, taper) ou une version reçue d'un autre appareil remplaçait le texte sans retour possible. Même
// mécanique que les morceaux (même fichier, même élagage, même « ne lève jamais »), mais une BASE À PART (`harmohub-historique-paroles`) :
// ajouter un magasin à la base des morceaux aurait exigé d'en monter la version, et un onglet resté ouvert sur l'ancien fichier aurait
// alors perdu son historique jusqu'au rechargement. D'où la fabrique `creerHistorique` : les morceaux et les paroles ne diffèrent que par
// le nom de la base, l'empreinte (ce qui fait qu'une version est « la même ») et le résumé affiché.
function creerHistorique({ nomBase, empreinteDe, resumeDe }) {
    const NOM_BASE = nomBase;
    const MAGASIN = 'versions';
    // Combien on en garde. 40 par morceau : à raison d'une version toutes les 5 minutes de travail effectif, c'est plus de trois heures de
    // travail en arrière — et chaque opération lourde en ajoute une. Au-delà de 90 jours, une version n'est plus qu'un souvenir : on les
    // retire, SAUF les 5 plus récentes de chaque morceau (un morceau qu'on rouvre après six mois garde de quoi revenir en arrière).
    const MAX_PAR_MORCEAU = 40;
    const MAX_JOURS = 90;
    const MIN_GARDEES = 5;
    const MAX_TOTAL = 800; // plafond global : quelques Mo au pire, et la base ne grossit pas sans fin quand on a beaucoup de morceaux

    let promesseBase = null;
    let indisponible = null; // texte lisible si l'historique ne peut pas fonctionner ici
    let derniereErreur = null;

    const demande = (req) => new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
    const fin = (tx) => new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || new Error('transaction annulée')); });

    function ouvrir() {
        if (promesseBase) return promesseBase;
        promesseBase = new Promise((resolve) => {
            try {
                if (typeof indexedDB === 'undefined' || !indexedDB) { indisponible = 'Ce navigateur ne propose pas de stockage pour l\'historique.'; resolve(null); return; }
                const req = indexedDB.open(NOM_BASE, 1);
                req.onupgradeneeded = () => {
                    const db = req.result;
                    const mag = db.createObjectStore(MAGASIN, { keyPath: 'id' });
                    mag.createIndex('songId', 'songId', { unique: false });
                    mag.createIndex('date', 'date', { unique: false });
                };
                req.onsuccess = () => {
                    const db = req.result;
                    // Une autre fenêtre qui met la base à jour doit pouvoir passer : on se ferme plutôt que de la bloquer.
                    db.onversionchange = () => { try { db.close(); } catch (e) { /* déjà fermée */ } promesseBase = null; };
                    resolve(db);
                };
                req.onerror = () => { indisponible = 'Le stockage de l\'historique est refusé (navigation privée ou stockage bloqué ?).'; derniereErreur = req.error; resolve(null); };
                req.onblocked = () => { indisponible = 'Le stockage de l\'historique est verrouillé par un autre onglet.'; resolve(null); };
            } catch (e) {
                indisponible = 'Le stockage de l\'historique est refusé (navigation privée ou stockage bloqué ?).';
                derniereErreur = e;
                resolve(null);
            }
        });
        return promesseBase;
    }

    // Condensé stable du CONTENU musical. Pas du zoom (réglage de vue, pas de contenu : une version de plus à cause d'un zoom n'aurait aucun sens).
    function empreinte(charge) {
        const texte = JSON.stringify(empreinteDe(charge));
        // FNV-1a 32 bits, deux fois (graines différentes) : pas de la cryptographie, juste « ces deux textes sont-ils les mêmes ? » — et la
        // longueur s'y ajoute, ce qui rend une collision accidentelle négligeable à l'échelle de quelques centaines de versions.
        let h1 = 0x811c9dc5, h2 = 0x1b873593;
        for (let i = 0; i < texte.length; i++) {
            const c = texte.charCodeAt(i);
            h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
            h2 = Math.imul(h2 ^ c, 0x85ebca6b) >>> 0;
        }
        return `${h1.toString(16)}-${h2.toString(16)}-${texte.length}`;
    }

    function resume(charge) { return resumeDe(charge); }

    async function toutes(db, songId) {
        const tx = db.transaction(MAGASIN, 'readonly');
        const mag = tx.objectStore(MAGASIN);
        const liste = songId === undefined ? await demande(mag.getAll()) : await demande(mag.index('songId').getAll(IDBKeyRange.only(songId)));
        return liste.sort((a, b) => b.date - a.date || (a.id < b.id ? 1 : -1));
    }

    // Élagage : par morceau (plafond + ancienneté, en gardant toujours les plus récentes) puis global (plafond). Silencieux : un élagage
    // raté n'est pas une raison de perdre la version qu'on vient de poser.
    async function elaguer(db, songId) {
        try {
            const aSupprimer = new Set();
            const limite = Date.now() - MAX_JOURS * 86400000;
            const deCeMorceau = await toutes(db, songId);
            deCeMorceau.forEach((v, i) => {
                if (i >= MAX_PAR_MORCEAU) aSupprimer.add(v.id);
                else if (i >= MIN_GARDEES && v.date < limite) aSupprimer.add(v.id);
            });
            const restantes = (await toutes(db)).filter(v => !aSupprimer.has(v.id));
            if (restantes.length > MAX_TOTAL) {
                // Les plus anciennes d'abord, mais jamais l'une des MIN_GARDEES plus récentes de son morceau.
                const rang = new Map(); // id -> rang dans son morceau (0 = la plus récente)
                const vus = new Map();
                restantes.forEach(v => { const n = vus.get(v.songId) || 0; rang.set(v.id, n); vus.set(v.songId, n + 1); });
                const anciennes = restantes.filter(v => rang.get(v.id) >= MIN_GARDEES).sort((a, b) => a.date - b.date);
                anciennes.slice(0, restantes.length - MAX_TOTAL).forEach(v => aSupprimer.add(v.id));
            }
            if (!aSupprimer.size) return;
            const tx = db.transaction(MAGASIN, 'readwrite');
            aSupprimer.forEach(id => tx.objectStore(MAGASIN).delete(id));
            await fin(tx);
        } catch (e) { derniereErreur = e; }
    }

    async function poser(db, version) {
        const tx = db.transaction(MAGASIN, 'readwrite');
        tx.objectStore(MAGASIN).put(version);
        await fin(tx);
    }

    // Garde un instantané. Rend { fait, raison } : raison = 'identique' (même contenu que la dernière version du morceau : rien à ajouter),
    // 'indisponible' (pas de stockage), 'quota' ou 'erreur'. Ne lève jamais.
    async function ajouter({ songId, songName, motif, libelle, charge, date }) {
        try {
            if (!charge || typeof charge !== 'object') return { fait: false, raison: 'erreur' };
            const db = await ouvrir();
            if (!db) return { fait: false, raison: 'indisponible' };
            const sid = songId || '';
            const emp = empreinte(charge);
            const precedentes = await toutes(db, sid);
            if (precedentes.length && precedentes[0].empreinte === emp) return { fait: false, raison: 'identique', id: precedentes[0].id };
            const version = {
                id: 'v_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
                songId: sid, songName: songName || '', date: date || Date.now(), motif: motif || 'auto', libelle: libelle || '',
                empreinte: emp, resume: resume(charge), charge: JSON.parse(JSON.stringify(charge)),
            };
            try {
                await poser(db, version);
            } catch (e) {
                // Quota plein : on fait de la place (la moitié des plus anciennes, sauf les récentes de chaque morceau) puis on retente UNE fois.
                if (e && (e.name === 'QuotaExceededError' || /quota/i.test(String(e.message)))) {
                    await liberer(db);
                    try { await poser(db, version); }
                    catch (e2) { derniereErreur = e2; return { fait: false, raison: 'quota' }; }
                } else { derniereErreur = e; return { fait: false, raison: 'erreur' }; }
            }
            await elaguer(db, sid);
            return { fait: true, id: version.id };
        } catch (e) {
            derniereErreur = e;
            return { fait: false, raison: 'erreur' };
        }
    }

    async function liberer(db) {
        try {
            const tout = await toutes(db);
            const vus = new Map();
            const candidates = tout.filter(v => { const n = vus.get(v.songId) || 0; vus.set(v.songId, n + 1); return n >= MIN_GARDEES; }).sort((a, b) => a.date - b.date);
            const tx = db.transaction(MAGASIN, 'readwrite');
            candidates.slice(0, Math.max(1, Math.ceil(candidates.length / 2))).forEach(v => tx.objectStore(MAGASIN).delete(v.id));
            await fin(tx);
        } catch (e) { derniereErreur = e; }
    }

    async function lister(songId) {
        try { const db = await ouvrir(); return db ? await toutes(db, songId === null ? '' : songId) : []; }
        catch (e) { derniereErreur = e; return []; }
    }

    // Les morceaux qui ont une histoire : [{ songId, songName, derniere, n }], le plus récemment travaillé d'abord.
    async function morceaux() {
        try {
            const db = await ouvrir();
            if (!db) return [];
            const par = new Map();
            (await toutes(db)).forEach(v => {
                const m = par.get(v.songId);
                if (!m) par.set(v.songId, { songId: v.songId, songName: v.songName, derniere: v.date, n: 1 });
                else m.n++;
            });
            return [...par.values()].sort((a, b) => b.derniere - a.derniere);
        } catch (e) { derniereErreur = e; return []; }
    }

    async function lire(id) {
        try { const db = await ouvrir(); if (!db) return null; return (await demande(db.transaction(MAGASIN, 'readonly').objectStore(MAGASIN).get(id))) || null; }
        catch (e) { derniereErreur = e; return null; }
    }

    // Tout effacer sur CET appareil. Jamais appelé sans confirmation de l'utilisateur (voir script.js).
    async function vider() {
        try {
            const db = await ouvrir();
            if (!db) return false;
            const tx = db.transaction(MAGASIN, 'readwrite');
            tx.objectStore(MAGASIN).clear();
            await fin(tx);
            return true;
        } catch (e) { derniereErreur = e; return false; }
    }

    async function disponible() { return !!(await ouvrir()); }

    return {
        ajouter, lister, morceaux, lire, vider, disponible, empreinte, resume,
        raison: () => indisponible,
        derniereErreur: () => derniereErreur,
        limites: { MAX_PAR_MORCEAU, MAX_JOURS, MIN_GARDEES, MAX_TOTAL },
    };
}

// Les MORCEAUX : l'empreinte porte sur le contenu musical (pas le zoom), le résumé compte accords et parties.
const HistoriqueVersions = creerHistorique({
    nomBase: 'harmohub-historique',
    empreinteDe: (charge) => [charge.sections, charge.structure || null, charge.root, charge.mode, charge.timeSig, charge.groove, charge.bpm, charge.instrumentMorceau || null],
    resumeDe: (charge) => {
        const sections = Array.isArray(charge.sections) ? charge.sections : [];
        return { parties: sections.length, accords: sections.reduce((n, s) => n + (s && Array.isArray(s.chords) ? s.chords.length : 0), 0) };
    },
});

// Les PAROLES : `charge` est la session de paroles telle que paroles.js l'écrit ({ songName, savedAt, sections: [{ lyricsHtml, placements,
// repeatCount }] }). L'empreinte ignore la date d'enregistrement et le nom : réécrire le même texte, ou renommer le morceau, n'est pas une
// nouvelle version. Le résumé compte les MOTS (de quoi reconnaître une version sans l'ouvrir) et les accords posés.
function texteDesParoles(html) {
    return String(html || '').replace(/<(br|\/div|\/p)[^>]*>/gi, ' ').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}
const HistoriqueParoles = creerHistorique({
    nomBase: 'harmohub-historique-paroles',
    empreinteDe: (charge) => (Array.isArray(charge.sections) ? charge.sections : []).map(s => [s && s.lyricsHtml || '', (s && s.placements) || [], (s && s.repeatCount) || 1]),
    resumeDe: (charge) => {
        const sections = Array.isArray(charge.sections) ? charge.sections : [];
        const mots = sections.reduce((n, s) => n + texteDesParoles(s && s.lyricsHtml).split(/\s+/).filter(Boolean).length, 0);
        const poses = sections.reduce((n, s) => n + ((s && Array.isArray(s.placements)) ? s.placements.length : 0), 0);
        const extrait = sections.map(s => texteDesParoles(s && s.lyricsHtml).replace(/\s+/g, ' ').trim()).filter(Boolean).join(' / ').slice(0, 80);
        return { parties: sections.length, mots, poses, extrait };
    },
});
if (typeof window !== 'undefined') { window.HistoriqueVersions = HistoriqueVersions; window.HistoriqueParoles = HistoriqueParoles; }
