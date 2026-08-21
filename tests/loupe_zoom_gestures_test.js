// Ctrl+molette et pincement sur le séquenceur : quels axes, et où.
//
// LE CONTRAT A CHANGÉ, ET LE BANC NE LE DISAIT PAS. Il affirmait « Ctrl+molette zoome les 2 axes (H
// et V) en même temps » sur le séquenceur épinglé. Ce n'est plus vrai, et pas par accident : le
// grossissement vertical des barres a été retiré sur retour utilisateur explicite — « comme sur
// GarageBand, laisser une unique hauteur de barres. Juste éloigner la vue pour voir plus de notes. On
// se perd avec le grossissement vertical des barres et ça enlève de la fluidité », repris ensuite pour
// le petit séquenceur (« bloquer la hauteur des barres, et supprimer le V+/- »). Le volet sous la
// grille n'a donc plus qu'une échelle, seqInlineZoomLevelX ; seqInlineZoomLevelY n'existe pas.
// La vue AGRANDIE, elle, garde bien ses deux axes (seqZoomLevelX/Y) : les deux surfaces sont donc
// vérifiées séparément, chacune sur son vrai contrat.
//
// Le banc visait en plus #grid-zoom-pinned-body, l'hôte de la vue plein écran supprimée : ses six
// blocs de mesures s'appliquaient à un élément null et il mourait à la première.
//
// OÙ ENVOYER L'ÉVÉNEMENT. La molette est écoutée sur #arp-sequencer lui-même, pas sur son hôte :
// vérifié à la sonde, un `wheel` envoyé sur #seq-dock-host ne change rien du tout, alors que le même
// sur #arp-sequencer zoome. Un banc qui viserait l'hôte conclurait à tort que le zoom est cassé.
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';
const { check, exiger, plan, bilan } = require('./_harness')('gestes de zoom du séquenceur');
plan(11);

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
    await page.evaluate(() => {
        localStorage.setItem('myProgression', JSON.stringify({ sections: [{ title: 'Couplet', chords: [
            { root: 'C', quality: 'maj7', beats: 4, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held' },
        ] }] }));
        // Échelles neuves : elles sont mémorisées par appareil, et déjà au plafond un zoom avant ne
        // changerait plus rien — le banc accuserait alors le geste au lieu de sa propre scène.
        for (const k of ['harmohubSeqInlineZoomLevelX', 'harmohubSeqZoomLevelX', 'harmohubSeqZoomLevelY']) localStorage.removeItem(k);
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(400);
    await page.evaluate(() => window.app.editChord(0, 0));
    await page.waitForTimeout(250);
    await page.click('#grid-zoom');       // ouvre le volet du séquenceur continu
    await page.waitForTimeout(700);

    const echelles = () => page.evaluate(() => ({
        voletX: window.app.seqInlineZoomLevelX,
        voletY: window.app.seqInlineZoomLevelY,   // doit rester absent : plus de zoom vertical ici
        agrandiX: window.app.seqZoomLevelX,
        agrandiY: window.app.seqZoomLevelY,
    }));
    const molette = (ctrl, cible = '#arp-sequencer') => page.evaluate(({ c, s }) => {
        document.querySelector(s).dispatchEvent(new WheelEvent('wheel', { ctrlKey: c, deltaY: -100, bubbles: true, cancelable: true }));
    }, { c: ctrl, s: cible });

    exiger(await page.evaluate(() => !!document.querySelector('#seq-dock-host .seq-grid-continuous')),
        'le volet du séquenceur continu est bien ouvert sur l\'accord');

    console.log('=== VOLET : Ctrl+molette zoome l\'horizontale, et SEULEMENT elle ===');
    const av = await echelles();
    await molette(true);
    await page.waitForTimeout(200);
    const ap1 = await echelles();
    console.log(JSON.stringify({ av, ap1 }));
    check(ap1.voletX > av.voletX, `Ctrl+molette agrandit l'échelle horizontale du volet (${av.voletX} -> ${ap1.voletX})`);
    check(ap1.voletY === undefined,
        `aucune échelle VERTICALE n'existe pour le volet — la hauteur des barres est volontairement unique (${String(ap1.voletY)})`);
    check(ap1.agrandiX === av.agrandiX && ap1.agrandiY === av.agrandiY,
        "le geste dans le volet ne touche pas aux échelles de la vue agrandie, qui sont indépendantes");

    await molette(true);
    await page.waitForTimeout(200);
    const ap2 = await echelles();
    check(ap2.voletX > ap1.voletX, `un second Ctrl+molette continue d'agrandir (${ap1.voletX} -> ${ap2.voletX})`);

    console.log('=== VOLET : molette SANS Ctrl ne zoome pas (elle sert à défiler) ===');
    await molette(false);
    await page.waitForTimeout(200);
    const ap3 = await echelles();
    check(ap3.voletX === ap2.voletX, `molette sans Ctrl ne zoome pas — échelle inchangée à ${ap3.voletX}`);

    console.log('=== VOLET : un seul doigt ne déclenche jamais de zoom ===');
    const avUnDoigt = await echelles();
    await page.evaluate(() => {
        const el = document.getElementById('arp-sequencer');
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const ev = (type, id, dx) => new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: cx + dx, clientY: cy, bubbles: true, cancelable: true });
        el.dispatchEvent(ev('pointerdown', 5, 0));
        el.dispatchEvent(ev('pointermove', 5, 200));
        el.dispatchEvent(ev('pointerup', 5, 200));
    });
    await page.waitForTimeout(200);
    const apUnDoigt = await echelles();
    check(apUnDoigt.voletX === avUnDoigt.voletX, `un seul doigt ne zoome pas — échelle inchangée à ${apUnDoigt.voletX}`);

    console.log('=== VUE AGRANDIE : Ctrl+molette zoome bien les DEUX axes ===');
        // LA PORTE DU PLEIN ÉCRAN A DÉMÉNAGÉ DANS LE SÉQUENCEUR : c'est la loupe de sa barre d'outils
    // (#seq-plein-ecran). « Séquenceur » (#seq-zoom), dans le volet, n'ouvre plus que la vue
    // compacte — et comme il BASCULE, le cliquer ici REFERMAIT le panneau qu'on venait d'ouvrir.
    // Retour utilisateur à l'origine des deux changements : « le bouton séquenceur dans le volet de
    // gauche ne devrait ouvrir que le "Petit séquenceur" […] sinon, je ne peux jamais ouvrir le
    // petit », puis « je propose d'ajouter un bouton loupe dans le petit séquenceur ».
await page.click('#seq-plein-ecran');
    await page.waitForTimeout(800);
    if (!exiger(await page.evaluate(() => window.app.seqZoomOpen === true), 'la vue agrandie est bien ouverte')) bilan();
    const avAgrandi = await echelles();
    await molette(true, '#seq-zoom-host');
    await page.waitForTimeout(200);
    const apAgrandi = await echelles();
    console.log(JSON.stringify({ avAgrandi, apAgrandi }));
    check(apAgrandi.agrandiX > avAgrandi.agrandiX && apAgrandi.agrandiY > avAgrandi.agrandiY,
        `dans la vue agrandie, Ctrl+molette zoome les 2 axes ensemble (${avAgrandi.agrandiX}/${avAgrandi.agrandiY} -> ${apAgrandi.agrandiX}/${apAgrandi.agrandiY})`);
    await molette(false, '#seq-zoom-host');
    await page.waitForTimeout(200);
    const apAgrandiNue = await echelles();
    check(apAgrandiNue.agrandiX === apAgrandi.agrandiX && apAgrandiNue.agrandiY === apAgrandi.agrandiY,
        'molette sans Ctrl ne zoome pas non plus dans la vue agrandie');

    console.log('Errors:', JSON.stringify(errors));
    check(errors.length === 0, 'aucune erreur JavaScript pendant tout le scénario');
    await browser.close();
    bilan();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
