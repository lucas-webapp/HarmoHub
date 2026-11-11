// Les réglages du morceau sortent du système d'onglets.
// Ce qu'on éprouve : le bandeau ne parle plus que de modes d'interaction ; les valeurs du morceau se
// lisent SANS un clic ; les déplier ne masque plus rien ; et tous les réglages déménagés fonctionnent
// encore — c'est le risque propre à un déplacement dans le DOM.
const { chromium } = require('playwright')
const { ajouterAccord } = require('./_ajout');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

(async () => {
    const browser = await chromium.launch();
    const errors = [];
    // LOT 6a : à partir de 900px, la carte Morceau n'est plus affichée — ses réglages sont des puces au-dessus de la grille (rangee_reglages_test),
    // le tempo est dans la barre du bas. Sous le seuil elle reste (lot 10c : la barre-résumé et ses quatre cases) : la partie « grand écran » se joue
    // donc juste sous le seuil.
    const page = await browser.newPage({ viewport: { width: 860, height: 1000 } });
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(800);
    for (const s of ['C', 'Am', 'F', 'G']) {
        await ajouterAccord(page, s); await page.waitForTimeout(110);
    }
    await page.waitForTimeout(300);

    // ============================================================
    // === A. Le bandeau ne parle plus que de modes d'interaction ===
    // ============================================================
    // CONTRAT CHANGÉ : ce test attendait un bandeau réduit à ['Ajout', 'Modif'] après la sortie de
    // l'onglet Config. Le bandeau a depuis disparu en entier — le panneau nomme son sujet, l'ajout a
    // ses propres cibles, et ce qui restait est un réglage (voir ajout_modif_test.js).
    const bandeau = await page.evaluate(() => ({
        segments: [...document.querySelectorAll('.app-mode-seg')].map(b => b.textContent.trim()),
        banniereExiste: !!document.querySelector('.app-mode-banner'),
        configExiste: !!document.getElementById('app-mode-config'),
        configCardExiste: !!document.getElementById('config-card'),
    }));
    check(bandeau.segments.length === 0 && !bandeau.banniereExiste,
        `plus aucun bandeau de mode en haut du panneau — obtenu ${JSON.stringify(bandeau.segments)}`);
    check(!bandeau.configExiste && !bandeau.configCardExiste,
        'plus aucune trace de l\'onglet Config ni de son conteneur');

    // ============================================================
    // === B. Le bloc Morceau ouvre la colonne, hors du panneau à onglets ===
    // ============================================================
    const place = await page.evaluate(() => {
        const song = document.getElementById('song-card');
        const panel = document.querySelector('.panel-controls');
        return {
            parent: song.parentElement.className,
            dansPanneau: panel.contains(song),
            // Le bandeau ayant disparu, le repère devient le panneau de réglages lui-même : le bloc
            // Morceau doit toujours ouvrir la colonne, avant tout le reste.
            // Sous 900px, .panel-controls est « aplati » (display: contents, rectangle nul) : c'est la carte Accord, sa première carte, qui sert
            // de repère (lot 6a : la partie « grand écran » de ce banc se joue désormais sous le seuil).
            avantBandeau: song.getBoundingClientRect().top < document.getElementById('progression-sections').getBoundingClientRect().top, // lot 10e : la carte Accord n'est plus dans la page en mode Ajout, la grille sert de repère
            haut: Math.round(song.getBoundingClientRect().top),
        };
    });
    check(place.parent.includes('col-left') && !place.dansPanneau,
        `le bloc Morceau est un bloc à part, hors du panneau à onglets — parent : ${place.parent}`);
    check(place.avantBandeau, `...et il ouvre la colonne, au-dessus du bandeau — à ${place.haut}px du haut`);

    // ============================================================
    // === C. Les valeurs du morceau se lisent SANS un clic ===
    // ============================================================
    // LOT 10c : sous 900px, la ligne de résumé est la barre-résumé de la maquette (« C majeur · 120 BPM · 4/4 · Droit · Piano ») et elle déplie
    // quatre CASES (les puces de l'ordinateur, déplacées) au lieu de l'ancien panneau de listes déroulantes, qui ne s'ouvre plus à aucune largeur.
    // Chaque intention de ce banc est gardée, éprouvée par le nouveau geste : toucher la barre, toucher une case, choisir.
    const resume = await page.evaluate(() => ({
        texte: document.getElementById('song-summary').innerText.replace(/\s+/g, ' ').trim(),
        replie: document.getElementById('tel-reglages-cases').hidden && document.getElementById('song-settings').hidden,
        visible: document.getElementById('song-summary').getBoundingClientRect().height > 0,
    }));
    check(resume.visible && /120/.test(resume.texte) && /4\/4/.test(resume.texte) && /majeur/i.test(resume.texte),
        `tempo, mesure et tonalité sont lisibles d'emblée — « ${resume.texte} »`);
    check(resume.replie, 'les réglages, eux, restent repliés tant qu\'on n\'en a pas besoin');

    // Le résumé suit les valeurs réelles, quel que soit le chemin emprunté.
    const choisir = async (puce, valeur, action = null) => {
        await page.click(`#rr-${puce}`); await page.waitForTimeout(150);
        await page.click(action ? `#rr-pop [data-rr-action="${action}"][data-rr-valeur="${valeur}"]` : `#rr-pop [data-rr-valeur="${valeur}"]`);
        await page.waitForTimeout(150);
        if (await page.evaluate(() => !document.getElementById('rr-pop').hidden)) { await page.keyboard.press('Escape'); await page.waitForTimeout(100); }
    };
    await page.click('#song-summary');
    await page.waitForTimeout(250);
    await choisir('mesure', '3/4');
    await page.evaluate(() => {
        const b = document.getElementById('bpm');
        b.value = '96'; b.dispatchEvent(new Event('input', { bubbles: true })); b.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await choisir('tonalite', 'A', 'tonique');
    await page.waitForTimeout(350);
    const apres = await page.evaluate(() => document.getElementById('song-summary').innerText.replace(/\s+/g, ' ').trim());
    check(/96/.test(apres) && /3\/4/.test(apres),
        `le résumé suit le tempo et la mesure qu'on vient de changer — « ${apres} »`);
    check(/A|La/.test(apres), `...et la tonalité — « ${apres} »`);

    // Le swing : la barre-résumé de la maquette le dit toujours (« Droit » compris) — il suit donc le choix, dans les deux sens.
    await choisir('swing', 'ternary');
    const avecGroove = await page.evaluate(() => document.getElementById('song-summary').innerText.replace(/\s+/g, ' ').trim());
    check(/Ternaire/.test(avecGroove), `un swing non droit s'affiche dans le résumé — « ${avecGroove} »`);
    await choisir('swing', 'straight');
    const sansGroove = await page.evaluate(() => document.getElementById('song-summary').innerText.replace(/\s+/g, ' ').trim());
    check(/Droit/.test(sansGroove) && !/Ternaire/.test(sansGroove), `revenu au swing droit, le résumé le dit — « ${sansGroove} »`);

    // ============================================================
    // === D. Déplier les réglages ne masque plus RIEN (le vrai gain) ===
    // ============================================================
    const ouvert = await page.evaluate(() => ({
        reglagesVisibles: !document.getElementById('tel-reglages-cases').hidden,
        accord: !document.getElementById('accord-card').hidden,
        // Lecture a fusionné dans Accord : ce qu'on vérifiait sur elle se vérifie sur la carte unique.
        lecture: !document.getElementById('lecture-card'),
        actions: !document.getElementById('edit-actions').hidden,
    }));
    check(ouvert.reglagesVisibles, 'un clic sur le résumé déplie les réglages');
    check(ouvert.accord && ouvert.lecture,
        `...sans masquer la carte Accord, contrairement à l'onglet qu'elle remplace — ${JSON.stringify(ouvert)}`);

    // Même chose en mode Modification, avec un accord chargé : régler le tempo ne doit pas faire
    // perdre de vue l'accord qu'on est en train d'éditer.
    // Le double-clic doit tomber sur une zone NUE de la case. Playwright vise le centre de
    // l'élément, c'est-à-dire le symbole — or un double-clic sur le symbole ouvre désormais la
    // retape de son texte, pas le panneau (premier clic = sélectionner partout, second clic =
    // renommer si l'on a visé le symbole, ouvrir le panneau sinon). Ce test n'a jamais voulu
    // éprouver le renommage : il veut un accord chargé en Modification.
    const pointNu = await page.evaluate(() => {
        const c = document.querySelector('.grid-cell[data-index="1"]');
        c.scrollIntoView({ block: 'center' });
        const r = c.getBoundingClientRect();
        for (let j = 0; j < 9; j++) for (let k = 0; k < 21; k++) {
            const x = r.left + 2 + (r.width - 4) * k / 20, y = r.top + 2 + (r.height - 4) * j / 8;
            const el = document.elementFromPoint(x, y);
            if (el && String(el.className).includes('grid-cell')) return { x, y };
        }
        return null;
    });
    // Refonte du séquenceur, point B : le double-clic OUVRE le panneau d'accord (à mi-hauteur) ; « Réglages du son » l'agrandit, c'est la Modification.
    await page.mouse.dblclick(pointNu.x, pointNu.y);
    await page.waitForTimeout(400);
    await page.click('#pa-son-btn');
    await page.waitForTimeout(400);
    const enEdition = await page.evaluate(() => ({
        mode: document.body.dataset.appMode,
        accordCharge: window.app.editingIndex,
    }));
    check(enEdition.mode === 'edit' && enEdition.accordCharge === 1,
        `un double-clic puis « Réglages du son » chargent bien l'accord en Modification — index ${enEdition.accordCharge}`);
    // Les cases sont DANS la page (elles poussent la grille, comme la maquette) : elles ne peuvent pas recouvrir la carte de l'accord. On l'éprouve
    // quand même, mesuré, parce que c'est exactement le défaut qu'avait produit le premier placement de l'ancien panneau flottant (96 % recouverts).
    const cohabitation = await page.evaluate(() => {
        const ac = document.getElementById('accord-card');
        const pan = document.getElementById('tel-reglages-cases');
        if (ac.hidden || pan.hidden) return { deux: false, part: 100 };
        const a = ac.getBoundingClientRect(), p = pan.getBoundingClientRect();
        const ox = Math.max(0, Math.min(p.right, a.right) - Math.max(p.left, a.left));
        const oy = Math.max(0, Math.min(p.bottom, a.bottom) - Math.max(p.top, a.top));
        const aire = a.width * a.height;
        return { deux: true, part: aire > 0 ? Math.round(ox * oy / aire * 100) : 0 };
    });
    check(cohabitation.deux && cohabitation.part === 0,
        `réglages du morceau ET accord en cours d'édition cohabitent à l'écran sans se recouvrir — ${cohabitation.part} % recouverts`);

    // ============================================================
    // === E. Les réglages déménagés fonctionnent toujours ===
    // ============================================================
    // Un déplacement dans le DOM casse silencieusement tout ce qui dépendait de l'ancienne place. Transposer est la ligne sous les cases ; le Tap et
    // le métronome sont dans le panneau Lecture (lot 10b).
    const racines = () => page.evaluate(() => loadProgressionSections()[0].chords.map(c => c.root).join(','));
    const avantT = await racines();
    await page.click('#rr-transposer-haut'); await page.waitForTimeout(250);
    const apresUp = await racines();
    await page.click('#rr-transposer-bas'); await page.waitForTimeout(250);
    const retourT = await racines();
    const existent = await page.evaluate(() => ({ tap: !!document.querySelector('#panneau-lecture #bl-tap'), metro: !!document.querySelector('#panneau-lecture #bl-metro') }));
    check(apresUp !== avantT && retourT === avantT,
        `transposer le morceau fonctionne encore depuis sa nouvelle place — ${avantT} -> ${apresUp} -> ${retourT}`);
    check(existent.tap && existent.metro, `le tap tempo et le métronome ont suivi le déménagement (panneau Lecture) — ${JSON.stringify(existent)}`);

    const bpmMarche = await page.evaluate(() => {
        const bv = document.getElementById('bpm-val');
        bv.value = '140'; bv.dispatchEvent(new Event('change', { bubbles: true }));
        return { slider: document.getElementById('bpm').value, resume: document.getElementById('song-summary-tel-bpm').textContent };
    });
    check(bpmMarche.slider === '140', `saisir un tempo au clavier pilote toujours le curseur — ${bpmMarche.slider}`);
    check(bpmMarche.resume === '140 BPM', `...et le résumé le reflète — ${bpmMarche.resume}`);

    // ============================================================
    // === F. L'état déplié/replié au rechargement ===
    // ============================================================
    await page.reload();
    await page.waitForTimeout(800);
    const apresRechargement = await page.evaluate(() => ({
        ouvert: !document.getElementById('tel-reglages-cases').hidden || !document.getElementById('song-settings').hidden,
        resume: document.getElementById('song-summary').innerText.replace(/\s+/g, ' ').trim(),
        // Valeurs RÉELLES des réglages : c'est à elles que le résumé doit correspondre.
        bpm: document.getElementById('bpm').value,
        sig: document.getElementById('time-sig').value,
    }));
    // Rien ne se rouvre tout seul au lancement de l'appli : personne ne l'a demandé (exigence du temps du panneau flottant, gardée).
    check(!apresRechargement.ouvert,
        'les réglages ne se rouvrent pas tout seuls au rechargement');
    // On ne vérifie pas que le tempo a SURVÉCU au rechargement — il ne survit pas tant que le morceau
    // n'est pas enregistré, et c'était déjà le cas avant ce chantier. Ce qui compte ici, et qui est
    // tout l'intérêt d'un résumé permanent, c'est qu'il dise VRAI dès l'ouverture : un résumé en
    // retard sur les réglages qu'il annonce serait pire que pas de résumé du tout.
    check(apresRechargement.resume.includes(apresRechargement.bpm)
        && apresRechargement.resume.includes(apresRechargement.sig),
        `dès l'ouverture, le résumé correspond aux réglages réels (${apresRechargement.bpm} BPM, ${apresRechargement.sig}) — « ${apresRechargement.resume} »`);
    await page.click('#song-summary');
    await page.waitForTimeout(200);
    await page.click('#song-summary');
    await page.waitForTimeout(200);
    await page.reload();
    await page.waitForTimeout(800);
    check(await page.evaluate(() => document.getElementById('tel-reglages-cases').hidden),
        'replié avant de recharger, il se retrouve replié');

    // ============================================================
    // === G. Ouvrir/refermer un accord ne touche pas au bloc Morceau ===
    // ============================================================
    // Les cases sont un dépliage DANS la page, pas un flottant : le contrat d'origine (« rien ne bouge les réglages du morceau »), que l'ancien
    // panneau flottant avait dû assouplir (il se refermait au clic ailleurs), redevient vrai — et c'est lui qu'on éprouve de nouveau.
    await page.click('#song-summary');
    await page.waitForTimeout(250);
    await page.evaluate(() => window.app.editChord(0, 0));
    await page.waitForTimeout(300);
    const enModif = await page.evaluate(() => ({
        reglages: !document.getElementById('tel-reglages-cases').hidden,
        mode: window.app.appMode,
        quickAdd: document.getElementById('quick-add-panel').hidden,
    }));
    await page.click('#accord-close');
    await page.waitForTimeout(300);
    const enAjout = await page.evaluate(() => ({
        reglages: !document.getElementById('tel-reglages-cases').hidden,
        mode: window.app.appMode,
        quickAdd: document.getElementById('quick-add-panel').hidden,
    }));
    check(enModif.mode === 'edit' && enAjout.mode === 'add',
        'ouvrir puis refermer un accord fait bien basculer le mode déduit');
    check(enModif.reglages,
        'les réglages restent ouverts quand on passe en Modification : ils ne dépendent pas du mode');
    check(enAjout.reglages,
        'et ils restent ouverts quand on referme l\'accord : un dépliage dans la page ne se referme qu\'à la demande');
    check(enModif.quickAdd === false && enAjout.quickAdd === false,
        'la saisie rapide reste visible dans les deux cas (c\'est une cible d\'ajout, elle ne bouge plus)');

    await page.close();

    // ============================================================
    // === H. Téléphone ===
    // ============================================================
    const mob = await browser.newPage({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });
    mob.on('pageerror', e => errors.push('pageerror(mobile): ' + e.message));
    await mob.goto(`${BASE}/index.html`);
    await mob.waitForTimeout(900);
    const tel = await mob.evaluate(() => {
        const song = document.getElementById('song-card');
        const grille = document.querySelector('.history-section');
        const sr = song.getBoundingClientRect();
        const btn = document.getElementById('song-summary').getBoundingClientRect();
        return {
            hautMorceau: Math.round(sr.top),
            hauteurMorceau: Math.round(sr.height),
            hautGrille: grille ? Math.round(grille.getBoundingClientRect().top) : null,
            cible: [Math.round(btn.width), Math.round(btn.height)],
            deborde: document.documentElement.scrollWidth > window.innerWidth,
            resume: document.getElementById('song-summary').innerText.replace(/\s+/g, ' ').trim(),
        };
    });
    check(!tel.deborde, 'rien ne déborde de l\'écran du téléphone');
    check(tel.hautMorceau < tel.hautGrille,
        `le bloc Morceau précède la grille — ${tel.hautMorceau}px vs ${tel.hautGrille}px`);
    check(tel.hauteurMorceau < 220,
        `...et replié il reste compact, pour ne pas repousser la grille hors de l'écran — ${tel.hauteurMorceau}px`);
    check(tel.cible[1] >= 38, `la ligne de résumé est une cible confortable au doigt — ${JSON.stringify(tel.cible)}`);
    check(/BPM/.test(tel.resume), `le résumé est lisible sur téléphone — « ${tel.resume} »`);

    await mob.tap('#song-summary');
    await mob.waitForTimeout(300);
    const telOuvert = await mob.evaluate(() => ({
        ouvert: !document.getElementById('tel-reglages-cases').hidden,
        deborde: document.documentElement.scrollWidth > window.innerWidth,
    }));
    check(telOuvert.ouvert && !telOuvert.deborde, 'il se déplie au doigt sans faire déborder la page');
    await mob.close();

    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 || errors.length > 0 ? 1 : 0);
})();
