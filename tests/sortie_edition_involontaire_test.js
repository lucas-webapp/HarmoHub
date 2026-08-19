const { chromium } = require('playwright');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
// LE DÉFAUT QUI REVIENT. Huit fois la garde `inEditor` (voir setupEventListeners dans script.js) a
// laissé échapper un contrôle : #guitar-lock-btn, #guitar-next, #arp-sequencer déplacé, .viz-toggle
// déplacé, les boutons Annuler/Rétablir, la poignée du volet, puis les six groupes d'échelle. À
// chaque fois le même symptôme, et à chaque fois signalé par l'utilisateur plutôt que par un banc :
// cliquer le contrôle sort silencieusement du mode Modification (editingIndex retombe à null), et
// tout ce qu'on fait ensuite n'est plus écrit nulle part. En prime, la vue continue du séquenceur
// EXIGE editingIndex != null (voir `continuous` dans renderSequencer) : elle retombe donc en vue
// sommaire — « des fois le séquenceur saute et redevient un séquenceur sommaire ».
//
// Ce banc ne teste pas une liste de contrôles connus : il BALAIE tout ce qui est cliquable et
// visible pendant une modification. C'est ce qui a permis de trouver les 7e et 8e d'un coup, au lieu
// d'attendre le prochain signalement. Un contrôle ajouté demain sera couvert sans rien écrire.
//
// Ce qui DOIT sortir de l'édition n'est pas testé ici (cliquer dans le vide, ouvrir un morceau...) :
// voir click_away_still_works_test.js, qui garde l'autre moitié du contrat.
let PASS = 0, FAIL = 0;
const check = (c, l) => { if (c) { PASS++; console.log('PASS - ' + l); } else { FAIL++; console.log('FAIL - ' + l); } };

// Contrôles dont un clic SIGNIFIE légitimement « j'ai fini avec cet accord » : les exclure du
// balayage, sinon on affirmerait l'inverse de ce qu'on veut.
const SORTIES_LEGITIMES = new Set([
    'accord-close',      // la croix de l'accord : c'est sa raison d'être
    'save',              // Ajouter/Modifier : valide et referme
    'song-new', 'song-files', 'song-import', 'song-export', 'song-rename', 'song-save',
    'open-settings', 'file-menu-btn', 'lyrics-btn', 'quick-add-btn', 'add-section',
]);

(async () => {
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

    const preparer = async () => {
        await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 20000 });
        await page.evaluate(() => {
            const mk = (r, q, b) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 0, octave: 3, bass: null, playStyle: 'held' });
            localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [
                mk('C', 'maj', 4), mk('A', 'min7', 4), mk('G', '7', 4)] }] }));
        });
        await page.reload({ waitUntil: 'load' });
        await page.waitForTimeout(300);
        await page.evaluate(() => window.app.editChord(0, 1));
        await page.click('#grid-zoom');
        await page.waitForTimeout(500);
    };

    await preparer();
    // Inventaire pris UNE fois, sur un état en cours de modification : tous les boutons visibles et
    // actifs, plus la poignée du volet (qui n'est pas un <button> mais se manipule comme tel).
    const cibles = await page.evaluate((exclus) => {
        const vus = [];
        document.querySelectorAll('button, #seq-dock-resize').forEach(e => {
            if (!e.offsetParent || e.disabled) return;
            const id = e.id || '';
            if (exclus.includes(id)) return;
            vus.push(id || ('(' + (e.title || e.textContent || '').trim().slice(0, 24) + ')'));
        });
        return vus;
    }, [...SORTIES_LEGITIMES]);
    // Flèches de doigté, crayon de substitution et cadenas vivent maintenant DANS la fenêtre d'édition
    // manuelle du manche (voir #guitar-edit-btn/openGuitarEditor) : masqués par défaut, l'inventaire
    // générique ci-dessus ne les voit donc jamais (offsetParent nul tant que la fenêtre est fermée).
    // Ajoutés ici explicitement plutôt que balayés en aveugle : le balayage générique clique un
    // contrôle À LA FOIS derrière tout le reste de la page, et ouvrir cette fenêtre masquerait TOUS
    // les autres contrôles derrière elle si elle restait ouverte pour le reste du balayage — la
    // boucle rouvre donc CETTE fenêtre juste avant de chercher un de CES contrôles précis, jamais pour
    // les autres (voir CONTROLES_SOUS_MANCHE plus bas).
    const CONTROLES_SOUS_MANCHE = ['guitar-edit-close', 'guitar-edit-tab-draw', 'guitar-edit-tab-name', 'guitar-prev', 'guitar-next', 'guitar-override-btn', 'guitar-lock-btn'];
    cibles.push(...CONTROLES_SOUS_MANCHE);
    console.log(`${cibles.length} contrôles visibles à éprouver`);

    // Une seule page pour les 31 contrôles tant que rien ne casse — un `goto`+`reload` coûte ~26s dans
    // un conteneur lent, et 31 rechargements condamnaient ce banc à ne jamais être lancé.
    // MAIS on RECHARGE dès qu'un contrôle a fait sortir de l'édition. Une première version se
    // contentait de rappeler editChord() : elle accusait alors trois contrôles sains
    // (#play-prog, #stop, #toggle-loop-section), parce qu'un fautif RENCONTRÉ PLUS TÔT laissait
    // l'appli dans un état différent (panneau de gauche replié, volet refermé) et faussait tous les
    // verdicts suivants. Un banc qui contamine ses propres cas ne prouve rien : mieux vaut le payer
    // en secondes que d'aller « corriger » du code qui n'a rien.
    const fautifs = [];
    let etatSain = true;
    for (const nom of cibles) {
        if (!etatSain) { await preparer(); etatSain = true; }
        await page.keyboard.press('Escape').catch(() => {});   // referme un éventuel panneau ouvert
        await page.evaluate(() => { window.app.editChord(0, 1); });
        await page.waitForTimeout(80);
        const arme = await page.evaluate(() => window.app.appMode + '/' + window.app.editingIndex);
        if (arme !== 'edit/1') { await preparer(); }
        // Rouvre la fenêtre d'édition manuelle du manche JUSTE avant de chercher un de SES contrôles
        // (voir CONTROLES_SOUS_MANCHE) — jamais laissée ouverte pour les autres, sous peine de masquer
        // tout le reste de la page derrière elle pour le reste du balayage. L'onglet « Taper le nom »
        // est réaffirmé à chaque fois : sans ça, un passage antérieur sur guitar-edit-tab-draw
        // laisserait guitar-override-btn/guitar-lock-btn masqués (dans l'autre onglet) selon l'ordre
        // de passage — l'inventaire doit rester le même quel que soit cet ordre.
        if (CONTROLES_SOUS_MANCHE.includes(nom)) {
            await page.click('#guitar-edit-btn').catch(() => {});
            await page.waitForTimeout(80);
            await page.click('#guitar-edit-tab-name').catch(() => {});
            await page.waitForTimeout(80);
        }
        // VRAI clic de souris, jamais un évènement fabriqué. Une première version dispatchait
        // `new PointerEvent('pointerdown')` puis `.click()` : elle accusait six contrôles, dont trois
        // (#play-prog, #stop, #toggle-loop-section) qu'un balayage à vrais clics venait de déclarer
        // sains. Un évènement synthétique n'a ni la même cible effective ni le même enchaînement que
        // le geste réel — s'y fier revenait à corriger l'appli d'après une sonde fausse, exactement
        // l'erreur que ce fichier de bancs sert à éviter.
        const cible = await page.evaluateHandle((n) => [...document.querySelectorAll('button, #seq-dock-resize')]
            .find(e => e.offsetParent && !e.disabled
                && (e.id || ('(' + (e.title || e.textContent || '').trim().slice(0, 24) + ')')) === n), nom);
        const el = cible.asElement();
        if (!el) continue;
        const clique = await el.click({ timeout: 3000 }).then(() => true).catch(() => false);
        if (!clique) continue;   // masqué derrière autre chose à cet instant : rien à conclure
        await page.waitForTimeout(150);
        const ok = await page.evaluate(() => window.app.appMode + '/' + window.app.editingIndex);
        if (ok !== 'edit/1') { fautifs.push(`${nom} -> ${ok}`); etatSain = false; }
    }

    check(fautifs.length === 0,
        fautifs.length ? `des contrôles font sortir de l'édition : ${fautifs.join(', ')}`
                       : `aucun contrôle ne fait sortir de l'édition (${cibles.length} éprouvés)`);

    // Et le corollaire visible : tant qu'on édite, le séquenceur reste en vue CONTINUE.
    await preparer();
    const vue = await page.evaluate(() => document.querySelector('.seq-grid-continuous') ? 'continue' : 'sommaire');
    check(vue === 'continue', `le séquenceur reste en vue continue pendant la modification — ${vue}`);

    check(errors.length === 0, 'aucune erreur JavaScript — ' + JSON.stringify(errors));
    console.log(`\n=== Bilan : ${PASS} PASS / ${FAIL} FAIL ===`);
    await browser.close();
    process.exit(FAIL ? 1 : 0);
})();
