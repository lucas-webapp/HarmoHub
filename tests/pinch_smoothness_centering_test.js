// Un pincement PROLONGÉ sur le séquenceur en volet doit rester fluide et ne rien perdre en route :
// la reconstruction horizontale doit rattraper PENDANT le geste, l'accord en édition doit rester le
// même du début à la fin, et sa case doit rester visible dans la grille.
//
// POURQUOI CE BANC. Un cran de zoom HORIZONTAL change la mise en page (mesures par page, largeur de
// colonne) : la reconstruire à chaque pixel de mouvement saccaderait. applyZoomLevel la diffère donc
// et pose un drapeau (_seqZoomRenderPending / _gridZoomRenderPending), qu'un rattrapage périodique
// consomme. Si ce rattrapage n'avait lieu qu'au RELÂCHEMENT, le geste entier se ferait à l'aveugle et
// la vue sauterait d'un coup à la fin — exactement le reproche « l'agrandissement avec les doigts ne
// fonctionne pas bien ». Ce banc vérifie que le drapeau retombe en cours de route.
//
// Il montait sa scène par app.openGridZoom() + app.editChordFromGridZoom(), disparues avec la vue
// plein écran, pinçait #grid-zoom-pinned-body, dont l'identifiant n'existe plus, et lisait
// seqZoomLevelX, l'échelle de la vue AGRANDIE, alors que le volet est à l'échelle seqInline. Trois
// adresses périmées : il mourait à la mise en place. Sa dernière vérification cherchait la case de
// l'accord dans #grid-zoom-host ; la grille ne déménage plus, on la lit là où elle vit.
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('pincement prolongé et centrage');
plan(7);

(async () => {
    const browser = await chromium.launch({
        args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const page = await browser.newPage({ viewport: { width: 390, height: 700 }, hasTouch: true, isMobile: true });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (msg) => { if (msg.type() === 'error' && !msg.text().includes('CONNECTION') && !msg.text().includes('TUNNEL')) errors.push('console.error: ' + msg.text()); });

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    // Une partie assez longue pour que la pagination horizontale ait vraiment de quoi bouger, et pour
    // que le centrage sur l'accord édité ait un sens (le 6e est loin des deux bouts).
    await page.evaluate(() => {
        const chords = [];
        for (let i = 0; i < 12; i++) {
            chords.push({ root: ['C', 'D', 'E', 'F', 'G', 'A'][i % 6], quality: 'maj7', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' });
        }
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords }] }));
        localStorage.removeItem('harmohubSeqInlineZoomLevelX'); // échelle neuve : déjà au plafond, plus rien ne bougerait
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(400);
    await page.evaluate(() => window.app.editChord(0, 5));
    await page.waitForTimeout(250);
    await page.click('#grid-zoom');
    await page.waitForTimeout(800);

    if (!exiger(await page.evaluate(() => !!document.querySelector('#seq-dock-host .seq-grid-continuous') && window.app.editingIndex === 5),
        'le volet est ouvert sur l\'accord d\'index 5')) bilan();

    console.log('=== Pincement PROLONGÉ : plusieurs vagues de mouvement, avec de vraies pauses ===');
    const vagues = await page.evaluate(async () => {
        const el = document.getElementById('arp-sequencer');
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const ev = (type, id, dx) => new PointerEvent(type, {
            pointerId: id, pointerType: 'touch', clientX: cx + dx, clientY: cy, bubbles: true, cancelable: true,
        });
        el.dispatchEvent(ev('pointerdown', 1, -20));
        el.dispatchEvent(ev('pointerdown', 2, 20));
        const vu = [];
        const pause = (ms) => new Promise(res => setTimeout(res, ms));
        // Les pauses sont indispensables : elles laissent tourner requestAnimationFrame, contrairement
        // à une rafale d'événements envoyée d'un bloc, qui ne laisserait jamais le rattrapage s'exécuter
        // et ferait échouer le banc pour une raison qui n'a rien à voir avec l'appli.
        for (let i = 1; i <= 6; i++) {
            el.dispatchEvent(ev('pointermove', 1, -20 - i * 15));
            el.dispatchEvent(ev('pointermove', 2, 20 + i * 15));
            await pause(90);
            vu.push({ t: i, enAttente: window.app._seqZoomRenderPending, zoomX: window.app.seqInlineZoomLevelX });
        }
        el.dispatchEvent(ev('pointerup', 1, -110));
        el.dispatchEvent(ev('pointerup', 2, 110));
        return vu;
    });
    console.log(JSON.stringify(vagues));

    // Au moins un point INTERMÉDIAIRE doit montrer le rendu déjà rattrapé (enAttente === false) : la
    // preuve que le rattrapage a tourné pendant le geste, pas seulement au relâchement.
    const rattrapeEnCours = vagues.some((v, i) => i < vagues.length - 1 && v.enAttente === false);
    check(rattrapeEnCours, 'le rattrapage du rendu horizontal a bien eu lieu PENDANT le pincement, pas seulement à la fin');
    check(vagues[vagues.length - 1].zoomX > vagues[0].zoomX,
        `le pincement a bien fait grandir l'échelle au fil des vagues (${vagues[0].zoomX} -> ${vagues[vagues.length - 1].zoomX})`);
    // Une échelle qui grandit à chaque vague, jamais qui revient en arrière : c'est ce qui distingue un
    // zoom fluide d'une oscillation. Un défaut de ce genre a bien existé (le déplacement à deux doigts
    // se battait avec le recentrage du zoom, voir seq_twofinger_zoom_test).
    const jamaisEnArriere = vagues.every((v, i) => i === 0 || v.zoomX >= vagues[i - 1].zoomX);
    check(jamaisEnArriere, `l'échelle ne recule jamais en cours de geste — ${JSON.stringify(vagues.map(v => v.zoomX))}`);

    console.log('=== L\'accord en édition est resté le même, et le drapeau est retombé ===');
    await page.waitForTimeout(400);
    const apres = await page.evaluate(() => ({
        editingIndex: window.app.editingIndex,
        seqOpen: window.app.seqOpen,
        enAttente: window.app._seqZoomRenderPending,
    }));
    console.log(JSON.stringify(apres));
    check(apres.editingIndex === 5 && apres.seqOpen === true,
        `l'accord en édition (index 5) est resté le même après tout le pincement — ${apres.editingIndex}`);
    check(apres.enAttente === false, 'plus aucun rendu en attente une fois le geste terminé');

    console.log('=== La case de l\'accord en édition reste visible dans la grille ===');
    // La grille ne déménage plus dans une fenêtre : on la lit là où elle vit, et « visible » veut dire
    // dans la fenêtre du navigateur — c'est ce que voit l'utilisateur.
    const visible = await page.evaluate(() => {
        const c = document.querySelector('#progression-sections .grid-cell[data-section="0"][data-index="5"]');
        if (!c) return null;
        c.scrollIntoView({ block: 'center', inline: 'center' });
        const r = c.getBoundingClientRect();
        return {
            dansLaFenetre: r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth,
            classes: c.className,
            rect: { t: Math.round(r.top), b: Math.round(r.bottom), l: Math.round(r.left), r: Math.round(r.right) },
        };
    });
    console.log(JSON.stringify(visible));
    check(visible && visible.dansLaFenetre && /editing/.test(visible.classes),
        `la case de l'accord en édition est atteignable et toujours marquée comme telle — ${visible ? visible.classes : 'ABSENTE'}`);

    console.log('Errors:', JSON.stringify(errors));
    check(errors.length === 0, 'aucune erreur JavaScript pendant tout le scénario');
    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
