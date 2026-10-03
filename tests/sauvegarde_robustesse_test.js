// LES QUATRE PROTECTIONS DE LA SAUVEGARDE.
//
// Contexte d'usage donné par l'utilisateur : Chrome, Safari, et des applications posées sur l'écran
// d'accueil depuis Safari. Son filet de sécurité est une HABITUDE — exporter en fin de séance. Une
// habitude tient jusqu'au jour où la séance ne finit pas comme prévu, et sur Safari le travail de
// cette séance-là a une mèche de sept jours (le stockage d'un site y est effacé après sept jours sans
// visite). Ces quatre protections visent ce trou-là, chacune à sa façon.
//
// CE QUE CE BANC NE PEUT PAS FAIRE, et il faut le dire : il tourne sur Chromium. Le comportement réel
// de Safari et d'iOS n'est pas mesuré ici. Ce qui EST éprouvé, c'est que le code fait ce qu'il annonce
// et, surtout, qu'il se comporte proprement quand l'API visée est ABSENTE — ce qui est la situation de
// tous les navigateurs sauf un pour chacune de ces fonctions.
const { chromium } = require('playwright');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('robustesse des sauvegardes');
const bruit = require('./_harness').estBruitReseau;

plan(19);

(async () => {
    const navigateur = await chromium.launch();
    const erreurs = [];
    const contexte = await navigateur.newContext({ viewport: { width: 1300, height: 950 } });
    const page = await contexte.newPage();
    page.on('pageerror', (e) => erreurs.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !bruit(m.text())) erreurs.push('console: ' + m.text()); });
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(900);

    if (!exiger(await page.evaluate(() => typeof window.app.demanderStockagePersistant === 'function'),
        'les protections sont chargées')) return bilan();

    // ---- 1. LE STOCKAGE PERSISTANT ----
    check(await page.evaluate(() => window.app.demanderStockagePersistant()) !== undefined,
        'la demande de stockage persistant rend une réponse au lieu de lever');
    // Le cas qui compte : un navigateur SANS l'API (Safari d'avant 17, et d'autres). Elle doit rendre
    // false sans casser le démarrage — c'est du confort, pas une dépendance.
    const sansApi = await page.evaluate(async () => {
        const vrai = navigator.storage;
        Object.defineProperty(navigator, 'storage', { value: undefined, configurable: true });
        const r = await window.app.demanderStockagePersistant();
        Object.defineProperty(navigator, 'storage', { value: vrai, configurable: true });
        return r;
    });
    check(sansApi === false, `sans l'API de stockage, la demande rend false sans lever — ${sansApi}`);

    // ---- 2. LA FRAÎCHEUR DE LA SAUVEGARDE ----
    const fraicheur = await page.evaluate(() => {
        localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 'x', name: 'A', savedAt: 1, sections: [] }]));
        localStorage.removeItem('harmohub_derniere_sauvegarde');
        localStorage.removeItem('harmohub_dernier_rappel_sauvegarde');
        const jamais = window.app.joursDepuisSauvegarde();
        window.app.marquerSauvegardeFaite();
        const neuf = window.app.joursDepuisSauvegarde();
        localStorage.setItem('harmohub_derniere_sauvegarde', String(Date.now() - 9 * 86400000));
        return { jamais, neuf, vieux: window.app.joursDepuisSauvegarde() };
    });
    check(fraicheur.jamais === null, 'sans repère, la fraîcheur est inconnue (et non « zéro jour »)');
    check(fraicheur.neuf === 0, 'une sauvegarde qui vient d\'être faite compte zéro jour');
    check(fraicheur.vieux === 9, `et neuf jours plus tard, neuf — ${fraicheur.vieux}`);

    // Le rappel ne doit PAS harceler : une fois par jour, et jamais en deçà de cinq jours.
    const rappels = await page.evaluate(() => {
        const compte = { vus: 0 };
        const vrai = window.app.flashHint.bind(window.app);
        window.app.flashHint = (t) => { if (/Dernière sauvegarde/.test(t)) compte.vus++; return vrai(t); };
        localStorage.removeItem('harmohub_dernier_rappel_sauvegarde');
        localStorage.setItem('harmohub_derniere_sauvegarde', String(Date.now() - 2 * 86400000));
        window.app.surveillerFraicheurSauvegarde();               // 2 jours : rien
        localStorage.setItem('harmohub_derniere_sauvegarde', String(Date.now() - 9 * 86400000));
        window.app.surveillerFraicheurSauvegarde();               // 9 jours : un rappel
        window.app.surveillerFraicheurSauvegarde();               // aussitôt : pas un second
        // 4,6 s et non 2,2 : le rappel attend 4 s avant de décider, pour laisser à la connexion cloud le
        // temps de répondre — son seuil et son ton en dépendent (voir surveillerFraicheurSauvegarde).
        return new Promise((r) => setTimeout(() => r(compte.vus), 4600));
    });
    check(rappels === 1, `un seul rappel : rien à deux jours, un à neuf, et pas de second dans la journée (${rappels})`);

    // AVEC LE CLOUD : Safari n'efface plus rien sous sept jours, donc l'urgence tombe. Le rappel de
    // copie sur disque reste — l'utilisateur le veut, « de temps en temps » — mais au bout de trente
    // jours, et sur un autre ton.
    const avecCloud = await page.evaluate(() => {
        const vus = [];
        const vrai = window.app.flashHint.bind(window.app);
        window.app.flashHint = (t) => { if (/copie sur disque|Dernière sauvegarde/.test(t)) vus.push(t); return vrai(t); };
        SYNCHRO.etat.utilisateur = { uid: 'x' }; SYNCHRO.etat.statut = 'synced';
        localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 'x', name: 'A', savedAt: 1, sections: [] }]));
        const essayer = (jours) => {
            localStorage.removeItem('harmohub_dernier_rappel_sauvegarde');
            localStorage.setItem('harmohub_derniere_sauvegarde', String(Date.now() - jours * 86400000));
            window.app.surveillerFraicheurSauvegarde();
        };
        essayer(9);      // avec le cloud : rien
        essayer(40);     // au-delà de trente jours : un rappel d'un autre ton
        return new Promise((r) => setTimeout(() => { SYNCHRO.etat.utilisateur = null; SYNCHRO.etat.statut = null; r(vus); }, 4700));
    });
    check(avecCloud.length === 1 && /protégée par le cloud/.test(avecCloud[0]),
        `cloud actif : rien à neuf jours, un rappel d'un autre ton à quarante — « ${(avecCloud[0] || '').slice(0, 70)} »`);

    const sansMorceaux = await page.evaluate(() => {
        localStorage.setItem('harmohubSongs', '[]');
        localStorage.removeItem('harmohub_derniere_sauvegarde');
        window.app.surveillerFraicheurSauvegarde();
        return localStorage.getItem('harmohub_derniere_sauvegarde');
    });
    check(sansMorceaux === null,
        'sur une bibliothèque vide, aucune leçon et aucun repère posé — il n\'y a rien à sauvegarder');

    // ---- 3. LE RAPPEL EN PARTANT ----
    // `visibilitychange` et non `beforeunload` : sur iOS, seul le premier arrive vraiment.
    const marque = await page.evaluate(async () => {
        localStorage.removeItem('harmohub_parti_sans_enregistrer');
        // On force l'état « modifications non enregistrées » comme le ferait une saisie.
        window.eval('hasUnsavedChanges = true');
        Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
        const pose = localStorage.getItem('harmohub_parti_sans_enregistrer');
        Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
        window.eval('hasUnsavedChanges = false');
        document.dispatchEvent(new Event('visibilitychange'));
        return { pose, apresRetour: localStorage.getItem('harmohub_parti_sans_enregistrer') };
    });
    check(marque.pose === '1', `partir avec des modifications non enregistrées laisse un repère — ${marque.pose}`);
    check(marque.apresRetour === '1', 'revenir ne l\'efface pas tout seul : c\'est le prochain démarrage qui le lit');

    const sansModif = await page.evaluate(() => {
        localStorage.removeItem('harmohub_parti_sans_enregistrer');
        window.eval('hasUnsavedChanges = false');
        Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
        Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
        return localStorage.getItem('harmohub_parti_sans_enregistrer');
    });
    check(sansModif === null, 'partir sans rien avoir modifié ne laisse aucun repère — donc aucun rappel inutile');

    // ---- 4. LE PARTAGE SYSTÈME (iPhone, Safari) ----
    check(await page.evaluate(() => typeof partagerFichier === 'function'), 'le partage système est en place');
    // Sans l'API — le cas de Chrome bureau, donc du banc : on doit retomber sur le téléchargement.
    const sansPartage = await page.evaluate(async () => {
        const vus = [];
        const vrai = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function () { if (this.download) vus.push(this.download); };
        try { await enregistrerFichier(new Blob(['x']), { morceau: 'Sans partage', type: 'Morceau', extension: 'json', dossier: 'morceaux', racine: null }); }
        finally { HTMLAnchorElement.prototype.click = vrai; }
        return vus;
    });
    check(sansPartage.length === 1, `sans feuille de partage, le fichier est téléchargé — ${JSON.stringify(sansPartage)}`);

    // AVEC l'API : le fichier part au partage et AUCUN téléchargement ne se déclenche derrière.
    const avecPartage = await page.evaluate(async () => {
        const partages = [], telecharges = [];
        const vraiClick = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function () { if (this.download) telecharges.push(this.download); };
        const vraiMM = window.matchMedia; window.matchMedia = (q) => (/coarse/.test(q) ? { matches: true } : vraiMM.call(window, q));   // iPhone : pointeur tactile
        navigator.canShare = (d) => !!(d && d.files && d.files.length);
        navigator.share = async (d) => { partages.push({ cles: Object.keys(d), nom: d.files[0].name }); };
        try { await enregistrerFichier(new Blob(['x']), { morceau: 'Avec partage', type: 'Morceau', extension: 'json', dossier: 'morceaux', racine: null }); }
        finally { HTMLAnchorElement.prototype.click = vraiClick; delete navigator.share; delete navigator.canShare; window.matchMedia = vraiMM; }
        return { partages, telecharges };
    });
    check(avecPartage.partages.length === 1 && avecPartage.telecharges.length === 0,
        `avec la feuille de partage, rien n'est téléchargé en double — ${JSON.stringify(avecPartage)}`);
    check(JSON.stringify(avecPartage.partages[0].cles) === '["files"]',
        `on ne passe QUE « files » : ajouter title ou text fait échouer le partage de fichier sur iOS — ${JSON.stringify(avecPartage.partages[0].cles)}`);

    // Refermer la feuille sans choisir n'est pas une panne : on ne télécharge pas dans le dos de
    // quelqu'un qui vient de renoncer.
    const annule = await page.evaluate(async () => {
        const telecharges = [];
        const vraiClick = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function () { if (this.download) telecharges.push(this.download); };
        const vraiMM = window.matchMedia; window.matchMedia = (q) => (/coarse/.test(q) ? { matches: true } : vraiMM.call(window, q));
        navigator.canShare = () => true;
        navigator.share = async () => { const e = new Error('annulé'); e.name = 'AbortError'; throw e; };
        let res;
        try { res = await enregistrerFichier(new Blob(['x']), { morceau: 'Annule', type: 'Morceau', extension: 'json', dossier: 'morceaux', racine: null }); }
        finally { HTMLAnchorElement.prototype.click = vraiClick; delete navigator.share; delete navigator.canShare; window.matchMedia = vraiMM; }
        return { res, telecharges };
    });
    check(annule.telecharges.length === 0 && annule.res.annule === true,
        `renoncer au partage ne déclenche pas un téléchargement furtif — ${JSON.stringify(annule.telecharges)}`);

    // SUR ORDINATEUR, la feuille de partage ne s'ouvre PAS, même quand l'API existe (Safari sur Mac l'expose).
    // Retour utilisateur, capture à l'appui : « je n'en ai pas besoin, je veux juste un "enregistrer sous" ».
    const surMac = await page.evaluate(async () => {
        const partages = [], telecharges = [];
        const vraiClick = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function () { if (this.download) telecharges.push(this.download); };
        navigator.canShare = () => true;                                  // l'API est là, comme dans Safari sur Mac
        navigator.share = async (d) => { partages.push(d); };
        const fin = window.matchMedia('(pointer: coarse)').matches;      // un Chromium de banc a une souris
        try { await enregistrerFichier(new Blob(['x']), { morceau: 'Sur Mac', type: 'Structure', extension: 'pdf', dossier: 'pdfStructure', racine: null }); }
        finally { HTMLAnchorElement.prototype.click = vraiClick; delete navigator.share; delete navigator.canShare; }
        return { partages: partages.length, telecharges, tactile: fin };
    });
    check(surMac.tactile === false && surMac.partages === 0 && surMac.telecharges.length === 1,
        `souris + API de partage présente : un TÉLÉCHARGEMENT ordinaire, pas la feuille de partage — ${JSON.stringify(surMac)}`);
    check(erreurs.length === 0, `aucune erreur JavaScript (${erreurs.slice(0, 2).join(' | ')})`);
    await navigateur.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
