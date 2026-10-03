// LA STRUCTURE : feuille claire, commentaires sur plusieurs mesures, et structure qui VOYAGE.
//
// RETOURS UTILISATEUR, mot pour mot :
//   « Impression PDF : le rendu n'est pas joli. Je veux un joli rendu, et sans le thème sombre comme
//     actuellement. Garde un thème clair, éventuellement avec quelques couleurs. »
//   « Pour les commentaires, permets-moi de les mettre sur plusieurs mesures. Par exemple : mesure 1 à 3.
//     Ça doit se retranscrire sur la sortie PDF. »
//   « J'ai l'impression que la structure se sauvegarde mal, quand j'ai ouvert HarmoHub avec Safari
//     (j'étais sur Chrome avant), j'ai dû retaper le nombre de chaque section. »
//
// Cause du 3e point, MESURÉE avant correction : un réglage de structure n'allait que dans le tampon de
// travail ; il n'entrait dans le morceau qu'au prochain « Enregistrer ». Or l'export et la synchro ne lisent
// que le morceau enregistré. Le banc rejoue le vrai parcours : régler sans enregistrer, exporter, ouvrir
// dans un AUTRE navigateur (contexte vierge = stockage vierge, comme Safari après Chrome).
const { chromium } = require('playwright');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('structure feuille');
const bruit = require('./_harness').estBruitReseau;

const mk = (root, quality, beats) => ({ root, quality, beats, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
const SECTIONS = [
    { title: 'Intro', chords: [mk('B', 'min7', 4), mk('D', 'maj7', 4)] },
    { title: 'Couplet', chords: [mk('B', 'min7', 8), mk('D', 'maj7', 8)] },
    { title: 'Refrain', chords: [mk('C#', 'min7', 8), mk('F#', 'min', 8)] },
];
const MORCEAU = { id: 'S1', name: 'Ballade du soir', savedAt: 5000, root: 'D', mode: 'major', timeSig: '4/4', groove: 'none', bpm: 96, sections: SECTIONS };

plan(34);

(async () => {
    const navigateur = await chromium.launch();
    const erreurs = [];
    const surveiller = (page) => {
        page.on('pageerror', (e) => erreurs.push('pageerror: ' + e.message));
        page.on('console', (m) => { if (m.type() === 'error' && !bruit(m.text())) erreurs.push('console: ' + m.text()); });
    };
    const ouvrir = async (contexte, init) => {
        const page = await contexte.newPage();
        surveiller(page);
        await page.addInitScript((i) => {
            if (!sessionStorage.getItem('__init') && i) {
                localStorage.setItem('harmohubSongs', JSON.stringify(i.songs));
                localStorage.setItem('harmohubCurrentSongId', i.songs[0].id);
                localStorage.setItem('myProgression', JSON.stringify({ sections: i.songs[0].sections }));
                sessionStorage.setItem('__init', '1');
            }
        }, init);
        await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
        await page.waitForTimeout(1000);
        return page;
    };

    // ============ A. STRUCTURE QUI VOYAGE : Chrome -> fichier -> Safari ============
    const ctxA = await navigateur.newContext({ viewport: { width: 1300, height: 950 }, acceptDownloads: true });
    const A = await ouvrir(ctxA, { songs: [MORCEAU] });
    await A.evaluate(() => window.app.loadSong('S1'));
    await A.waitForTimeout(300);
    await A.click('#structure-btn');
    await A.waitForTimeout(400);
    if (!exiger(await A.isVisible('#structure-overlay'), 'la fenêtre Structure s\'ouvre')) return bilan();

    // Le geste de l'utilisateur : « Couplet » joué 3 fois, un commentaire sur les mesures 1 à 3 — SANS enregistrer.
    const rowCouplet = A.locator('.struct-row').nth(1);
    await rowCouplet.locator('[data-struct="rep-plus"]').click();
    await rowCouplet.locator('[data-struct="rep-plus"]').click();
    await A.waitForTimeout(200);
    const sauve = () => A.evaluate(() => { const s = loadSongs()[0]; return { structure: s.structure || null, sections: s.sections, sale: hasUnsavedChanges }; });
    let v = await sauve();
    check(Array.isArray(v.structure) && v.structure.length === 3, `la structure est dans le MORCEAU dès le réglage, sans Ctrl+S (${v.structure && v.structure.length} occurrences)`);
    check(v.structure && v.structure[1].rep === 3, `avec le nombre de passages réglé (×${v.structure && v.structure[1].rep})`);
    check(v.sale === false, 'et le morceau n\'est pas faussement « modifié » : rien n\'attend d\'être enregistré');
    check(v.structure && v.sections.every(s => s.sid) && v.structure.every(it => v.sections.some(s => s.sid === it.sid)),
        'les parties du morceau portent leurs identifiants : aucune occurrence orpheline à la réouverture');

    // Un autre réglage de l'utilisateur, non enregistré, ne doit PAS partir avec la structure.
    await A.evaluate(() => { document.getElementById('bpm').value = '140'; marquerModifie(); });
    await rowCouplet.locator('[data-struct="rep-moins"]').click();
    await A.waitForTimeout(200);
    v = await A.evaluate(() => ({ bpm: loadSongs()[0].bpm, sale: hasUnsavedChanges, rep: loadSongs()[0].structure[1].rep }));
    check(v.bpm === 96 && v.sale === true, `le tempo non enregistré reste non enregistré (morceau ${v.bpm}, modifié=${v.sale}) : seule la structure est reportée`);
    check(v.rep === 2, 'et la structure, elle, suit chaque geste');

    // ============ B. COMMENTAIRE SUR PLUSIEURS MESURES ============
    const menu = async (i, action) => {
        const r = A.locator('.struct-row').nth(i).locator('.struct-main');
        const b = await r.boundingBox();
        await A.mouse.click(b.x + 20, b.y + 8, { button: 'right' });
        await A.waitForTimeout(150);
        await A.click(`#struct-menu [data-struct-ctx="${action}"]`);
        await A.waitForTimeout(250);
    };
    await menu(1, 'commentaire');
    check(await A.isVisible('#struct-edit-mesure') && await A.isVisible('#struct-edit-mesureFin'),
        'la fenêtre propose « de la mesure » ET « à la mesure »');
    await A.fill('#struct-edit-mesure', '1');
    await A.fill('#struct-edit-mesureFin', '3');
    await A.fill('#struct-edit-body textarea', 'batterie uniquement');
    await A.click('#struct-edit-ok');
    await A.waitForTimeout(250);
    let notes = await A.evaluate(() => loadSongs()[0].structure[1].notes);
    check(notes.length === 1 && notes[0].mesure === 1 && notes[0].mesureFin === 3, `la plage est enregistrée avec le morceau — ${JSON.stringify(notes)}`);
    const libelle = await A.locator('.struct-row').nth(1).locator('.struct-note-mes').first().textContent();
    check(libelle.trim() === 'mes. 1–3', `elle s'affiche « mes. 1–3 » (${libelle.trim()})`);

    // Entrées bancales : jamais bloquantes, jamais une plage absurde.
    await menu(1, 'commentaire');
    await A.fill('#struct-edit-mesure', '3'); await A.fill('#struct-edit-mesureFin', '1'); await A.fill('#struct-edit-body textarea', 'à l\'envers');
    await A.click('#struct-edit-ok'); await A.waitForTimeout(250);
    await menu(1, 'commentaire');
    await A.fill('#struct-edit-mesure', ''); await A.fill('#struct-edit-mesureFin', '4'); await A.fill('#struct-edit-body textarea', 'fin seule');
    await A.click('#struct-edit-ok'); await A.waitForTimeout(250);
    notes = await A.evaluate(() => loadSongs()[0].structure[1].notes);
    const envers = notes.find(n => n.texte === 'à l\'envers'), seule = notes.find(n => n.texte === 'fin seule');
    check(envers && envers.mesure === 3 && !envers.mesureFin, '« de 3 à 1 » se lit comme la mesure 3 seule');
    check(seule && !seule.mesure && !seule.mesureFin, 'une fin sans début vaut « toute la partie »');
    check(notes[0].texte === 'fin seule' && notes[1].texte === 'batterie uniquement' && notes[2].texte === 'à l\'envers',
        `triés : toute la partie, puis mes. 1–3, puis mes. 3 — ${notes.map(n => n.texte)}`);
    // Un commentaire déjà enregistré avant les plages (mesure seule) reste lisible tel quel.
    check(await A.evaluate(() => libelleMesuresNote({ mesure: 4, texte: 'x' }) === 'mes. 4' && libelleMesuresNote({ texte: 'x' }) === 'toute la partie'),
        'un ancien commentaire { mesure, texte } s\'affiche comme avant');

    // ============ C. LA FEUILLE : claire, colorée, avec les plages ============
    const feuille = await A.evaluate(() => {
        const m = window.app.monterFeuilleStructure();
        const z = m.zone;
        z.setAttribute('style', 'display:block; position:fixed; left:-10000px; top:0; width:794px;');
        const lum = (css) => { const c = css.match(/\d+(\.\d+)?/g).map(Number); return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255; };
        const fond = lum(getComputedStyle(z).backgroundColor);
        const encre = lum(getComputedStyle(z).color);
        // Les aplats de couleur franche (marge, pastille ×N) sont voulus ; tout le reste doit être clair.
        const sombres = [...z.querySelectorAll('*')].filter(e => !e.matches('.sf-rep') &&
            getComputedStyle(e).backgroundColor !== 'rgba(0, 0, 0, 0)' && lum(getComputedStyle(e).backgroundColor) < 0.93).length;
        const r = {
            fond, encre, sombres,
            texte: z.innerText,
            lignes: z.querySelectorAll('.sf-row').length,
            commandes: z.querySelectorAll('.struct-actions, .struct-ajout, button, select').length,
            classesEcran: z.querySelectorAll('[class*="struct-"]').length,
            couleurs: new Set([...z.querySelectorAll('.sf-nom')].map(e => getComputedStyle(e).color)).size,
            gros: [...z.querySelectorAll('*')].filter(e => e.tagName !== 'H1' && parseFloat(getComputedStyle(e).fontSize) > 16).length,
            etendues: [...z.querySelectorAll('.sf-etendue')].map(e => ({ t: e.textContent.trim(), px: parseFloat(getComputedStyle(e).fontSize) })),
            largeurDebord: z.scrollWidth > z.clientWidth + 1,
        };
        m.zone.remove();
        return r;
    });
    check(feuille.fond > 0.95, `fond blanc (luminance ${feuille.fond.toFixed(2)}), pas le thème sombre de l'appli`);
    check(feuille.encre < 0.25, `encre sombre (luminance ${feuille.encre.toFixed(2)})`);
    check(feuille.sombres === 0, `aucun aplat soutenu : fonds presque blancs, couleurs discrètes (${feuille.sombres} fonds trop foncés)`);
    // Retour utilisateur : « les numéros de mesure en gros sur la gauche sont un peu inutiles [...] à afficher en petit ».
    check(feuille.gros === 0, `plus rien de grand hors du titre : le numéro de mesure n'est plus en gros (${feuille.gros})`);
    check(feuille.etendues.length === 3 && feuille.etendues.every(e => e.px <= 12 && /^mes\. \d/.test(e.t)),
        `la mesure de départ reste donnée, en petit — ${JSON.stringify(feuille.etendues.map(e => e.t))}`);
    check(feuille.lignes === 3, `une carte par occurrence de la structure (${feuille.lignes})`);
    check(feuille.couleurs >= 3, `une couleur par famille de parties (${feuille.couleurs} couleurs)`);
    check(feuille.commandes === 0 && feuille.classesEcran === 0, 'aucune commande ni classe de l\'écran dans la feuille');
    check(/mes\. 1–3/.test(feuille.texte) && /batterie uniquement/.test(feuille.texte), 'la plage « mes. 1–3 » et son texte sont sur la feuille');
    // Le tempo imprimé est celui de l'écran (140, réglé plus haut sans enregistrer) : la feuille montre ce qu'on voit.
    check(/Ballade du soir/.test(feuille.texte) && /140 BPM/.test(feuille.texte) && /×2/.test(feuille.texte), `titre du morceau, tempo et répétitions y figurent — ${feuille.texte.replace(/\s+/g, ' ').slice(0, 120)}`);

    // ============ D. PDF RÉEL, plusieurs pages si la structure est longue ============
    const longue = await A.evaluate(() => {
        const sid = loadProgressionSections()[1].sid;
        window.app.modifierStructure((l) => { for (let k = 0; k < 14; k++) l.push({ id: 'z' + k, sid, rep: 1, label: 'Passage ' + (k + 1), notes: [{ mesure: 1, mesureFin: 2, texte: 'plage ' + k }] }); });
        return true;
    });
    const dl = A.waitForEvent('download', { timeout: 30000 }).catch(() => null);
    await A.click('#structure-pdf');
    const telechargement = await dl;
    let pages = 0, entete = '';
    if (telechargement) {
        const chemin = await telechargement.path();
        const buf = require('fs').readFileSync(chemin);
        entete = buf.slice(0, 5).toString();
        pages = (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    }
    check(telechargement && entete === '%PDF-', `l'export produit un vrai PDF (${entete || 'rien reçu'})`);
    check(pages >= 2, `une structure longue est COUPÉE en pages au lieu d'être écrasée sur une seule (${pages} pages)`);

    // ============ E. SAFARI : un contexte vierge reçoit le fichier ============
    const exporte = await A.evaluate(() => JSON.stringify({ app: 'HarmoHub', kind: 'library-backup', version: 1, songs: loadSongs() }));
    const ctxB = await navigateur.newContext({ viewport: { width: 1300, height: 950 } });
    const B = await ouvrir(ctxB, null);
    await B.evaluate((json) => { window.__imp = window.app.importLibraryFile(new File([json], 'b.json', { type: 'application/json' })); }, exporte);
    await B.evaluate(() => window.__imp);
    await B.waitForTimeout(400);
    const recu = await B.evaluate(() => { const s = loadSongs()[0]; return s ? { id: s.id, structure: s.structure || null } : null; });
    check(recu && Array.isArray(recu.structure) && recu.structure.length === 17, `l'import dans l'autre navigateur apporte la structure (${recu && recu.structure && recu.structure.length} occurrences)`);
    await B.evaluate((id) => window.app.loadSong(id), recu.id);
    await B.waitForTimeout(300);
    await B.click('#structure-btn');
    await B.waitForTimeout(400);
    const rb = await B.evaluate(() => ({
        reps: [...document.querySelectorAll('.struct-row')].slice(0, 3).map(r => r.querySelector('.struct-rep')?.textContent || '×1'),
        plage: [...(document.querySelectorAll('.struct-row')[1]?.querySelectorAll('.struct-note-mes') || [])].map(e => e.textContent).join(' / '),
    }));
    check(rb.reps.join(' ') === '×1 ×2 ×1', `rien à retaper : les nombres de passages sont retrouvés (${rb.reps.join(' ')})`);
    check(/mes\. 1–3/.test(rb.plage), `ni les plages de commentaires (${rb.plage})`);

    // ============ F. TÉLÉPHONE : mêmes gestes, au doigt ============
    const ctxM = await navigateur.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const M = await ouvrir(ctxM, { songs: [MORCEAU] });
    await M.evaluate(() => window.app.loadSong('S1'));
    await M.waitForTimeout(300);
    await M.click('#structure-btn');
    await M.waitForTimeout(400);
    await M.locator('.struct-row').nth(1).locator('[data-struct="rep-plus"]').tap();
    await M.waitForTimeout(250);
    check(await M.evaluate(() => loadSongs()[0].structure[1].rep === 2), 'au doigt aussi : le réglage entre dans le morceau tout de suite');
    await M.evaluate(() => { window.app.editerCommentaireStructure(1, null); }); // sans attendre : la promesse ne se résout qu'à la fermeture de la fenêtre
    await M.waitForTimeout(300);
    const champs = await M.evaluate(() => ['struct-edit-mesure', 'struct-edit-mesureFin', 'struct-edit-ok'].map(id => {
        const r = document.getElementById(id).getBoundingClientRect();
        return r.width > 0 && r.left >= 0 && r.right <= window.innerWidth;
    }));
    check(champs.every(Boolean), `la fenêtre de commentaire tient dans l'écran du téléphone (${champs})`);
    await M.fill('#struct-edit-mesure', '2'); await M.fill('#struct-edit-mesureFin', '4'); await M.fill('#struct-edit-body textarea', 'basse seule');
    await M.tap('#struct-edit-ok');
    await M.waitForTimeout(300);
    check(await M.evaluate(() => { const n = loadSongs()[0].structure[1].notes[0]; return n.mesure === 2 && n.mesureFin === 4; }), 'la plage saisie au doigt est enregistrée');
    check(/mes\. 2–4/.test(await M.locator('.struct-row').nth(1).textContent()), 'et lisible sur la ligne');

    check(erreurs.length === 0, `aucune erreur JavaScript (${erreurs.slice(0, 2).join(' | ')})`);
    void longue;
    await navigateur.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
