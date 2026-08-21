// La boucle est un ÉTAT DE LA LECTURE, plus un troisième bouton.
//
// RETOUR UTILISATEUR : « L'affichage des boutons de lecture n'est pas très beau, notamment le bouton
// boucle qui est plus haut que les autres, et prend trop de place. J'aurais bien vu une option du
// style : bouton "boucle" à l'intérieur du bouton "Lecture" et non à part, à activer/désactiver au
// besoin. Le fait de mettre un 3ème bouton uniquement pour les boucles alourdit un peu le visuel.
// As-tu de meilleures idées pour lancer des boucles de lecture ? Comment font les DAW
// professionnels ? »
//
// CE QUE FONT LES DAW, ET CE QUI EST REPRIS ICI. Pro Tools ne met pas de bouton « boucle » dans son
// transport : la lecture en boucle est un état du bouton Lecture, qui dessine alors une flèche
// circulaire autour du triangle. Logic, Cubase, Ableton et Reaper gardent un interrupteur, mais font
// l'essentiel sur la RÈGLE : on y trace la zone de cycle, et l'interrupteur s'allume tout seul. Les
// deux moitiés sont reprises — l'anneau de Pro Tools, l'allumage automatique de Logic.
//
// LE DÉFAUT DE HAUTEUR ÉTAIT RÉEL, et mesuré avant d'y toucher : à 1440px, Lecture et Stop faisaient
// 44px (rabaissés sur ordinateur par « .dock .transport > button ») quand le bouton boucle en gardait
// 52 — sa règle par identifiant (spécificité 1,1,0) l'emportait sur celle d'ordinateur (0,2,1), donc
// lui seul ignorait le rabaissement. Section A.
//
// DEUX COUCHES, comme partout ailleurs :
//   - CÂBLAGE (sections A-C) : de vrais gestes de souris, de doigt et de clic droit sur de vrais
//     boutons. C'est la couche qui casse quand un sélecteur change, et c'est voulu.
//   - MOTEUR (section D) : ce que la lecture fait vraiment de l'état, lu sur Tone.Transport plutôt
//     que sur l'apparence d'un bouton — un anneau allumé qui ne boucle rien serait le pire résultat.
const { chromium, devices } = require('playwright');
const creerHarnais = require('./_harness');
const { plan, check, exiger, bilan } = creerHarnais('La boucle, état du bouton Lecture');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';

const seed = () => {
    const mk = (r) => ({ root: r, quality: 'maj', beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
    const sections = [{ title: 'Couplet', chords: ['C', 'D', 'E', 'F', 'G', 'A'].map(mk) }];
    localStorage.setItem('myProgression', JSON.stringify({ sections }));
};

const etatBouton = () => {
    const b = document.getElementById('play-prog');
    const s = document.getElementById('stop');
    const simple = document.querySelector('#play-prog .transport-icon-simple');
    const anneau = document.querySelector('#play-prog .transport-icon-boucle');
    return {
        boucle: window.app.bouclerLecture,
        classe: b.classList.contains('boucle-active'),
        pressed: b.getAttribute('aria-pressed'),
        hLecture: Math.round(b.getBoundingClientRect().height),
        hStop: Math.round(s.getBoundingClientRect().height),
        simpleVisible: getComputedStyle(simple).display !== 'none',
        anneauVisible: getComputedStyle(anneau).display !== 'none',
        nbBoutons: document.querySelectorAll('.transport > button').length,
        ancienBouton: !!document.getElementById('toggle-loop-section'),
    };
};

// Appui long à la souris : on descend, on attend au-delà du seuil, on remonte SANS bouger.
async function appuiLong(page, selecteur) {
    const b = await page.locator(selecteur).boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(750);
    await page.mouse.up();
    await page.waitForTimeout(250);
}

(async () => {
    plan(20);
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const erreurs = [];
    const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
    page.on('pageerror', e => erreurs.push('ordinateur : ' + e.message));
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await page.waitForTimeout(300);
    await page.evaluate(seed);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(900);

    // === A. Deux boutons, de la même hauteur ===
    let e = await page.evaluate(etatBouton);
    check(!e.ancienBouton, 'le troisième bouton (#toggle-loop-section) a bien disparu');
    check(e.nbBoutons === 2, `la barre de transport ne compte plus que deux boutons — obtenu ${e.nbBoutons}`);
    check(e.hLecture === e.hStop, `Lecture et Stop ont la MÊME hauteur — obtenu ${e.hLecture} et ${e.hStop}`);
    check(e.simpleVisible && !e.anneauVisible, 'au repos, le triangle seul est affiché, pas l\'anneau');
    check(e.pressed === 'false', 'au repos, le bouton s\'annonce non enfoncé aux lecteurs d\'écran');

    // === B. L'appui long et le clic droit basculent, sans lancer la lecture ===
    await appuiLong(page, '#play-prog');
    e = await page.evaluate(etatBouton);
    check(e.boucle === true && e.classe, 'un appui long allume la boucle');
    check(e.anneauVisible && !e.simpleVisible, 'l\'anneau remplace alors le triangle seul');
    check(e.pressed === 'true', 'et le bouton s\'annonce enfoncé');
    // LE POINT QUI JUSTIFIE LE CLIC EN CAPTURE (voir setupBoucleLecture) : sans lui, l'appui long
    // basculerait la boucle ET lancerait la lecture, puisque le clic part quand même au relâchement.
    check(await page.evaluate(() => window.app.isPlaying !== true),
        'un appui long ne lance PAS la lecture — seule la boucle a changé');

    await page.click('#play-prog');
    await page.waitForTimeout(400);
    check(await page.evaluate(() => window.app.isPlaying === true), 'un clic normal lance bien la lecture');
    check(await page.evaluate(() => window.app.bouclerLecture === true), 'et ne touche pas à l\'état de la boucle');
    await page.evaluate(() => window.app.stopAll());
    await page.waitForTimeout(300);

    await page.click('#play-prog', { button: 'right' });
    await page.waitForTimeout(250);
    e = await page.evaluate(etatBouton);
    check(e.boucle === false && e.simpleVisible, 'le clic droit éteint la boucle');

    // === C. Tracer une plage allume la boucle toute seule ===
    // C'est la moitié « Logic » : sans elle, l'appui long serait le SEUL accès, et un geste caché
    // comme unique porte d'entrée serait indéfendable.
    const regle = await page.evaluate(() => {
        const m = document.querySelector('.row-measure');
        if (!m) return null;
        const r = m.getBoundingClientRect();
        return { x: r.left + 6, y: r.top + r.height / 2, fin: r.left + r.width * 2.5 };
    });
    exiger(!!regle, 'la règle des mesures est présente pour y tracer une plage');
    await page.mouse.move(regle.x, regle.y);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) { await page.mouse.move(regle.x + (regle.fin - regle.x) * i / 8, regle.y); await page.waitForTimeout(15); }
    await page.mouse.up();
    await page.waitForTimeout(350);
    check(await page.evaluate(() => !!window.app.loopRange), 'le glissé sur la règle a bien posé une plage');
    check(await page.evaluate(() => window.app.bouclerLecture === true), 'tracer une plage allume la boucle sans rien demander de plus');

    // Les deux restent INDÉPENDANTS : éteindre l'anneau ne doit pas effacer la plage tracée.
    await page.evaluate(() => window.app.basculerBoucle(false));
    await page.waitForTimeout(200);
    check(await page.evaluate(() => !!window.app.loopRange && window.app.bouclerLecture === false),
        'éteindre l\'anneau garde la plage : elle dit QUOI jouer, l\'anneau dit SI ça se répète');

    // === D. Couche MOTEUR : ce que la lecture fait vraiment de cet état ===
    // Lu sur Tone.Transport, l'horloge audio qui exécute la boucle (voir playProgression) : un anneau
    // allumé qui ne boucle rien serait exactement le défaut que ce banc doit attraper.
    const lancer = async () => {
        await page.evaluate(() => window.app.playProgression());
        await page.waitForTimeout(500);
        const r = await page.evaluate(() => ({ loop: window.Tone.Transport.loop, debut: window.Tone.Transport.loopStart, fin: window.Tone.Transport.loopEnd }));
        await page.evaluate(() => window.app.stopAll());
        await page.waitForTimeout(300);
        return r;
    };
    let moteur = await lancer();
    check(moteur.loop === false, `plage tracée mais anneau ÉTEINT : la lecture ne boucle pas — obtenu loop=${moteur.loop}`);

    await page.evaluate(() => window.app.basculerBoucle(true));
    moteur = await lancer();
    const dureePlage = moteur.fin - moteur.debut;
    check(moteur.loop === true, 'anneau allumé : l\'horloge audio boucle bien');
    check(dureePlage > 0 && dureePlage < 12, `et sur la seule PLAGE, pas sur tout le morceau — ${dureePlage.toFixed(2)}s pour 6 accords de 4 temps à 120 BPM (le morceau entier ferait 12s)`);

    // Sans plage : la boucle porte sur TOUT le morceau, jamais sur « la partie active seulement »
    // (« mais jamais "uniquement une section" »).
    await page.evaluate(() => { window.app.loopRange = null; window.app.loadProgression(); });
    await page.waitForTimeout(300);
    moteur = await lancer();
    const dureeTout = moteur.fin - moteur.debut;
    check(moteur.loop === true && dureeTout > dureePlage,
        `sans plage, la boucle porte sur tout le morceau — ${dureeTout.toFixed(2)}s contre ${dureePlage.toFixed(2)}s pour la plage`);

    // === E. Au doigt : l'appui long doit marcher là aussi, c'est même son terrain naturel ===
    const tel = await browser.newPage({ ...devices['iPhone 12'], hasTouch: true });
    tel.on('pageerror', (x) => erreurs.push('téléphone : ' + x.message));
    await tel.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await tel.waitForTimeout(300);
    await tel.evaluate(seed);
    await tel.reload({ waitUntil: 'load' });
    await tel.waitForTimeout(900);
    const t = await tel.evaluate(etatBouton);
    check(t.hLecture === t.hStop, `téléphone : Lecture et Stop ont la même hauteur — ${t.hLecture} et ${t.hStop}`);
    const b = await tel.locator('#play-prog').boundingBox();
    await tel.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); // un vrai appui COURT d'abord
    await tel.waitForTimeout(400);
    check(await tel.evaluate(() => window.app.bouclerLecture === false),
        'téléphone : un appui court ne bascule pas la boucle');
    await tel.evaluate(() => window.app.stopAll());
    await tel.waitForTimeout(200);

    check(erreurs.length === 0, `aucune erreur JavaScript — ${erreurs.join(' | ') || 'aucune'}`);
    await browser.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
