// Les réglages du morceau sortent du système d'onglets.
// Ce qu'on éprouve : le bandeau ne parle plus que de modes d'interaction ; les valeurs du morceau se
// lisent SANS un clic ; les déplier ne masque plus rien ; et tous les réglages déménagés fonctionnent
// encore — c'est le risque propre à un déplacement dans le DOM.
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

(async () => {
    const browser = await chromium.launch();
    const errors = [];
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(800);
    for (const s of ['C', 'Am', 'F', 'G']) {
        await page.fill('#quick-add-input', s); await page.click('#quick-add-btn'); await page.waitForTimeout(110);
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
            avantBandeau: song.getBoundingClientRect().top < panel.getBoundingClientRect().top,
            haut: Math.round(song.getBoundingClientRect().top),
        };
    });
    check(place.parent.includes('col-left') && !place.dansPanneau,
        `le bloc Morceau est un bloc à part, hors du panneau à onglets — parent : ${place.parent}`);
    check(place.avantBandeau, `...et il ouvre la colonne, au-dessus du bandeau — à ${place.haut}px du haut`);

    // ============================================================
    // === C. Les valeurs du morceau se lisent SANS un clic ===
    // ============================================================
    const resume = await page.evaluate(() => ({
        texte: document.getElementById('song-summary').innerText.replace(/\s+/g, ' ').trim(),
        replie: document.getElementById('song-settings').hidden,
        visible: document.getElementById('song-summary').getBoundingClientRect().height > 0,
    }));
    check(resume.visible && /120/.test(resume.texte) && /4\/4/.test(resume.texte) && /majeur/i.test(resume.texte),
        `tempo, mesure et tonalité sont lisibles d'emblée — « ${resume.texte} »`);
    check(resume.replie, 'les réglages, eux, restent repliés tant qu\'on n\'en a pas besoin');

    // Le résumé suit les valeurs réelles, quel que soit le chemin emprunté.
    await page.click('#song-summary');
    await page.waitForTimeout(250);
    await page.selectOption('#time-sig', '3/4');
    await page.evaluate(() => {
        const b = document.getElementById('bpm');
        b.value = '96'; b.dispatchEvent(new Event('input', { bubbles: true })); b.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.selectOption('#global-root', 'A');
    await page.selectOption('#global-mode', 'minor').catch(() => {});
    await page.waitForTimeout(350);
    const apres = await page.evaluate(() => document.getElementById('song-summary').innerText.replace(/\s+/g, ' ').trim());
    check(/96/.test(apres) && /3\/4/.test(apres),
        `le résumé suit le tempo et la mesure qu'on vient de changer — « ${apres} »`);
    check(/A|La/.test(apres), `...et la tonalité — « ${apres} »`);

    // Le groove n'apparaît que s'il sort de l'ordinaire.
    const grooveOptions = await page.evaluate(() => [...document.querySelectorAll('#groove option')].map(o => o.value));
    const grooveNonDroit = grooveOptions.find(v => v && v !== 'straight' && v !== 'none');
    if (grooveNonDroit) {
        await page.selectOption('#groove', grooveNonDroit);
        await page.waitForTimeout(250);
        const avecGroove = await page.evaluate(() => ({
            visible: !document.getElementById('song-summary-groove').hidden,
            texte: document.getElementById('song-summary').innerText.replace(/\s+/g, ' ').trim(),
        }));
        check(avecGroove.visible, `un groove non droit s'affiche dans le résumé — « ${avecGroove.texte} »`);
        await page.selectOption('#groove', grooveOptions.find(v => v === 'straight' || v === 'none') || grooveOptions[0]);
        await page.waitForTimeout(200);
        const sansGroove = await page.evaluate(() => document.getElementById('song-summary-groove').hidden);
        check(sansGroove, 'revenu au groove droit, la mention disparaît au lieu d\'encombrer la ligne');
    }

    // ============================================================
    // === D. Déplier les réglages ne masque plus RIEN (le vrai gain) ===
    // ============================================================
    const ouvert = await page.evaluate(() => ({
        reglagesVisibles: !document.getElementById('song-settings').hidden,
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
        const r = c.getBoundingClientRect();
        for (let j = 0; j < 9; j++) for (let k = 0; k < 21; k++) {
            const x = r.left + 2 + (r.width - 4) * k / 20, y = r.top + 2 + (r.height - 4) * j / 8;
            const el = document.elementFromPoint(x, y);
            if (el && String(el.className).includes('grid-cell')) return { x, y };
        }
        return null;
    });
    await page.mouse.dblclick(pointNu.x, pointNu.y);
    await page.waitForTimeout(400);
    const enEdition = await page.evaluate(() => ({
        mode: document.body.dataset.appMode,
        accordOuvert: !document.getElementById('accord-card').hidden,
        reglages: !document.getElementById('song-settings').hidden,
        accordCharge: window.app.editingIndex,
    }));
    check(enEdition.mode === 'edit' && enEdition.accordCharge === 1,
        `un double-clic charge bien l'accord en Modification — index ${enEdition.accordCharge}`);
    // Les réglages ne sont plus dépliés d'office : ils sont devenus un panneau FLOTTANT, qui part
    // fermé à chaque chargement (voir applySongSettingsOpen dans script.js). On les ouvre donc
    // explicitement pour éprouver ce que ce test a toujours voulu éprouver — que les deux
    // COHABITENT, l'un n'en chassant pas l'autre. Et l'exigence est renforcée au passage : il ne
    // suffit plus qu'ils soient tous deux « ouverts », le panneau ne doit pas non plus RECOUVRIR la
    // carte de l'accord. C'est exactement le défaut qu'a produit le premier placement du panneau
    // (96 % de la carte recouverte, mesuré), et qu'aucune vérification d'ouverture n'aurait vu.
    await page.evaluate(() => window.app.toggleSongSettings(true));
    await page.waitForTimeout(350);
    const cohabitation = await page.evaluate(() => {
        const ac = document.getElementById('accord-card');
        const pan = document.getElementById('song-settings');
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
    // Un déplacement dans le DOM casse silencieusement tout ce qui dépendait de l'ancienne place.
    const marche = await page.evaluate(async () => {
        const app = window.app;
        const avant = loadProgressionSections()[0].chords.map(c => c.root).join(',');
        document.getElementById('transpose-song-up').click();
        await new Promise(r => setTimeout(r, 250));
        const apresUp = loadProgressionSections()[0].chords.map(c => c.root).join(',');
        document.getElementById('transpose-song-down').click();
        await new Promise(r => setTimeout(r, 250));
        const retour = loadProgressionSections()[0].chords.map(c => c.root).join(',');
        return { avant, apresUp, retour, tapExiste: !!document.getElementById('tap-tempo'),
                 metroExiste: !!document.getElementById('toggle-metronome') };
    });
    check(marche.apresUp !== marche.avant && marche.retour === marche.avant,
        `transposer le morceau fonctionne encore depuis sa nouvelle place — ${marche.avant} -> ${marche.apresUp} -> ${marche.retour}`);
    check(marche.tapExiste && marche.metroExiste, 'le tap tempo et le métronome ont suivi le déménagement');

    const bpmMarche = await page.evaluate(() => {
        const bv = document.getElementById('bpm-val');
        bv.value = '140'; bv.dispatchEvent(new Event('change', { bubbles: true }));
        return { slider: document.getElementById('bpm').value, resume: document.getElementById('song-summary-bpm').textContent };
    });
    check(bpmMarche.slider === '140', `saisir un tempo au clavier pilote toujours le curseur — ${bpmMarche.slider}`);
    check(bpmMarche.resume === '140', `...et le résumé le reflète — ${bpmMarche.resume}`);

    // ============================================================
    // === F. L'état déplié/replié est retenu ===
    // ============================================================
    await page.reload();
    await page.waitForTimeout(800);
    const apresRechargement = await page.evaluate(() => ({
        ouvert: !document.getElementById('song-settings').hidden,
        resume: document.getElementById('song-summary').innerText.replace(/\s+/g, ' ').trim(),
        // Valeurs RÉELLES des réglages : c'est à elles que le résumé doit correspondre.
        bpm: document.getElementById('bpm').value,
        sig: document.getElementById('time-sig').value,
    }));
    // EXIGENCE INVERSÉE, à dessein. Tant que c'était un bloc déplié DANS la colonne, le retrouver
    // déplié au retour était cohérent. Devenu un panneau flottant posé par-dessus la grille, il ne
    // doit plus se rouvrir tout seul au lancement de l'appli : personne ne l'a demandé, et il
    // masquerait la musique dès l'ouverture. La préférence continue d'être écrite mais n'est plus
    // relue (voir le constructeur, songSettingsOpen).
    check(!apresRechargement.ouvert,
        'devenu panneau flottant, il ne se rouvre plus tout seul au rechargement');
    // On ne vérifie pas que le tempo a SURVÉCU au rechargement — il ne survit pas tant que le morceau
    // n'est pas enregistré, et c'était déjà le cas avant ce chantier. Ce qui compte ici, et qui est
    // tout l'intérêt d'un résumé permanent, c'est qu'il dise VRAI dès l'ouverture : un résumé en
    // retard sur les réglages qu'il annonce serait pire que pas de résumé du tout.
    check(apresRechargement.resume.includes(apresRechargement.bpm)
        && apresRechargement.resume.includes(apresRechargement.sig),
        `dès l'ouverture, le résumé correspond aux réglages réels (${apresRechargement.bpm} BPM, ${apresRechargement.sig}) — « ${apresRechargement.resume} »`);
    await page.click('#song-summary');
    await page.waitForTimeout(200);
    await page.reload();
    await page.waitForTimeout(800);
    check(await page.evaluate(() => document.getElementById('song-settings').hidden),
        'replié avant de recharger, il se retrouve replié');

    // ============================================================
    // === G. Ouvrir/refermer un accord ne touche pas au bloc Morceau ===
    // ============================================================
    // CONTRAT CHANGÉ : ce bloc basculait le bandeau Ajout/Modif, qui n'existe plus. Ce qu'il
    // vérifiait reste valable et se teste par le geste qui l'a remplacé — ouvrir puis refermer un
    // accord : les réglages du morceau sont un bloc autonome, rien de tout ça ne doit les bouger.
    // On FORCE l'ouverture au lieu de cliquer l'interrupteur. Un clic sur #song-summary bascule :
    // il n'ouvre que si le panneau était fermé, et dépend donc silencieusement de tout ce que le banc
    // a fait cent lignes plus haut. C'est précisément ce qui est arrivé — une ouverture ajoutée dans
    // une section précédente a transformé ce clic en fermeture, et la vérification d'en dessous a
    // rougi sans qu'aucun défaut n'existe.
    await page.evaluate(() => window.app.toggleSongSettings(true));
    await page.waitForTimeout(250);
    await page.evaluate(() => window.app.editChord(0, 0));
    await page.waitForTimeout(300);
    const enModif = await page.evaluate(() => ({
        reglages: !document.getElementById('song-settings').hidden,
        mode: window.app.appMode,
        quickAdd: document.getElementById('quick-add-panel').hidden,
    }));
    await page.click('#accord-close');
    await page.waitForTimeout(300);
    const enAjout = await page.evaluate(() => ({
        reglages: !document.getElementById('song-settings').hidden,
        mode: window.app.appMode,
        quickAdd: document.getElementById('quick-add-panel').hidden,
    }));
    check(enModif.mode === 'edit' && enAjout.mode === 'add',
        'ouvrir puis refermer un accord fait bien basculer le mode déduit');
    // CONTRAT CHANGÉ, et il faut le dire au lieu de le contourner. Ce test affirmait que « rien ne
    // bouge les réglages du morceau ». C'était vrai d'un bloc DOCKÉ dans la colonne ; ça ne l'est
    // plus d'un panneau FLOTTANT, dont tout l'intérêt est justement de se refermer dès qu'on clique
    // ailleurs — sans quoi il resterait posé par-dessus la grille sans qu'on sache comment s'en
    // débarrasser. Ce qui RESTE vrai, et que le test garde, c'est l'indépendance vis-à-vis du MODE :
    // le panneau peut être ouvert aussi bien en Ajout qu'en Modification, aucun changement de mode ne
    // le referme de lui-même. C'est bien le clic sur #accord-close — un clic AILLEURS, au sens du
    // popover — qui le referme ci-dessous, pas le passage en mode Ajout.
    check(enModif.reglages,
        'le panneau des réglages reste ouvert quand on passe en Modification : il ne dépend pas du mode');
    check(!enAjout.reglages,
        'un clic ailleurs (ici « fermer l\'accord ») referme bien le panneau flottant, comme tout popover');
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
        ouvert: !document.getElementById('song-settings').hidden,
        deborde: document.documentElement.scrollWidth > window.innerWidth,
    }));
    check(telOuvert.ouvert && !telOuvert.deborde, 'il se déplie au doigt sans faire déborder la page');
    await mob.close();

    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 || errors.length > 0 ? 1 : 0);
})();
