// La barre d'outils du tiroir : ses boutons agissent sans refermer le tiroir.
//
// CE BANC S'APPELAIT seq_tiroir_motifs_test, ET SON SUJET A ÉTÉ SUPPRIMÉ. Il éprouvait le raccourci
// vers les motifs rythmiques ajouté au Lot 4 bis-C, né d'un manque mesuré : sur iPhone 13 (fenêtre de
// 664px), le bouton qui ouvrait le menu des neuf motifs se trouvait à 630px — hors écran — au moment
// précis où l'on travaille le rythme. Le raccourci a ensuite été étendu à l'ordinateur, avec un
// argument qui tenait : « poser un motif type est une action sur le rythme, sa place est dans l'outil
// du rythme ».
//
// Puis l'utilisateur a tranché autrement, et plus haut : « Je pense que je ne me servirai rarement du
// rythme. Pour diminuer le nombre de boutons, laisser uniquement un choix favori dans les paramètres.
// […] Supprime les boutons dans "Lecture" et dans le petit séquenceur. » Le bon endroit pour une
// commande dont on ne se sert pas n'est aucun endroit. Le raccourci a donc disparu, et son ABSENCE
// est désormais éprouvée par rythme_une_preference_test, section A.
//
// CE QUI RESTE ICI, ET POURQUOI ÇA NE DOIT PAS PARTIR AVEC LUI. Ce banc avait établi une garantie qui
// ne dépendait pas du bouton : agir depuis la barre d'outils du tiroir NE REFERME PAS le tiroir. Elle
// vient d'un piège réel — le gestionnaire de clic-à-côté qui ferme les menus flottants — et elle vaut
// pour tous les boutons de cette barre, pas seulement pour celui qui est parti. Sur téléphone, un
// tiroir qui se referme à chaque action rendrait le séquenceur inutilisable au doigt.
const { chromium, devices } = require('playwright');
const creerHarnais = require('./_harness');
const { plan, check, exiger, bilan } = creerHarnais('Tiroir : sa barre d\'outils agit sans le refermer');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';

const seed = () => {
    const mk = (r, q, b, s) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: s || 'held' });
    const song = {
        id: 'tiroir', name: 'Ballade', bpm: 120, timeSig: '4/4', groove: 'straight',
        sections: [{ title: 'Couplet', chords: [mk('C', 'maj7', 4), mk('F', 'maj', 4)] }],
    };
    localStorage.setItem('harmohubSongs', JSON.stringify([song]));
    localStorage.setItem('harmohubCurrentSongId', song.id);
    localStorage.setItem('myProgression', JSON.stringify({ sections: song.sections }));
};

(async () => {
    plan(10);
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const erreurs = [];

    console.log('=== A. Téléphone : le tiroir s\'ouvre, sa barre est atteignable ===');
    const ctx = await browser.newContext({ ...devices['iPhone 13'], hasTouch: true });
    const m = await ctx.newPage();
    m.on('pageerror', e => erreurs.push('téléphone : ' + e.message));
    await m.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await m.waitForTimeout(300);
    await m.evaluate(seed);
    await m.reload({ waitUntil: 'load' });
    await m.waitForTimeout(900);
    await m.evaluate(() => { window.app.editChord(0, 1); window.app.toggleSequencer('compact'); });
    await m.waitForTimeout(1100);

    const barre = await m.evaluate(() => {
        const presets = document.querySelector('.arp-seq.seq-tiroir .seq-presets');
        if (!presets) return { present: false };
        const boutons = [...presets.querySelectorAll('button')].filter(b => b.offsetParent !== null).map(b => {
            const r = b.getBoundingClientRect();
            const dessus = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return { id: b.id, h: Math.round(r.height), l: Math.round(r.width),
                     dansEcran: r.top >= 0 && r.bottom <= window.innerHeight,
                     atteignable: !!dessus && (dessus === b || b.contains(dessus) || dessus.contains(b)) };
        });
        return { present: true, boutons, motif: !!document.getElementById('seq-playstyle-btn') };
    });
    exiger(barre.present, 'la barre d\'outils est bien dans le tiroir');
    check(barre.boutons.length >= 4, `elle porte ses boutons — ${barre.boutons.length} visibles`);
    check(barre.boutons.every(b => b.dansEcran && b.atteignable),
        `tous sont à l'écran et le doigt les atteint — ${barre.boutons.filter(b => !b.dansEcran || !b.atteignable).map(b => b.id || '?').join(', ') || 'aucun problème'}`);
    // UNE EXCEPTION CONNUE, ET NOMMÉE. Les deux boutons de zoom horizontal sont EMPILÉS dans un
    // même cadre (« + » au-dessus, « − » en dessous) : ils font 30x15 chacun, et 30x30 ensemble.
    // Mon premier seuil les comptait comme deux cibles trop petites — c était le seuil qui avait
    // tort, pas la barre : cet empilement est un choix de conception antérieur, et le pouce vise le
    // cadre commun. On les met donc à part EN LES NOMMANT, pour qu un TROISIÈME petit bouton qui
    // apparaîtrait un jour, lui, fasse rougir ce banc.
    const empiles = barre.boutons.filter(b => /zoom-(in|out)-h-inline/.test(b.id));
    const autres = barre.boutons.filter(b => !/zoom-(in|out)-h-inline/.test(b.id));
    check(empiles.length === 2 && empiles.every(b => b.h >= 14 && b.l >= 24),
        `la paire de zoom empilée fait ${empiles.map(b => b.l + "x" + b.h).join(" et ")} — 30x30 pour le pouce`);
    check(autres.every(b => b.h >= 26 && b.l >= 24),
        `les ${autres.length} autres font au moins 26x24 — le plus petit : ${Math.min(...autres.map(b => b.l))}x${Math.min(...autres.map(b => b.h))}`);
    // Le raccourci de motifs a disparu d'ici comme d'ailleurs : sa présence serait la régression.
    check(!barre.motif, 'et plus aucun raccourci de motif rythmique n\'y traîne');

    console.log('\n=== B. Agir depuis cette barre ne referme pas le tiroir ===');
    // LE PIÈGE, ET IL EST RÉEL : les menus flottants se ferment sur un clic « à côté ». Un bouton de
    // cette barre qui remonterait jusqu'à ce gestionnaire refermerait le tiroir dans la foulée du clic
    // qui l'actionne — et sur téléphone, un tiroir qui se referme à chaque geste rend le séquenceur
    // inutilisable au doigt.
    const cible = await m.evaluate(() => {
        // Un bouton qui AGIT sans rien détruire ni rien lancer : le mode studio est le candidat
        // évident (il bascule un affichage, et rien d'autre).
        const b = document.querySelector('.arp-seq.seq-tiroir #toggle-studio-mode');
        return b ? { id: b.id, actifAvant: b.classList.contains('active') } : null;
    });
    exiger(!!cible, 'un bouton d\'action sans effet destructeur est disponible dans la barre');
    await m.tap('.arp-seq.seq-tiroir #toggle-studio-mode');
    await m.waitForTimeout(700);
    const apres = await m.evaluate(() => ({
        tiroirOuvert: window.app.seqOpen === true,
        tiroirVisible: !!document.querySelector('.arp-seq.seq-tiroir'),
        studio: window.app.studioMode,
    }));
    check(apres.tiroirOuvert && apres.tiroirVisible,
        `le tiroir est toujours ouvert après l'appui — ${apres.tiroirOuvert ? 'ouvert' : 'REFERMÉ'}`);
    check(apres.studio !== cible.actifAvant,
        `et le bouton a bien agi — mode studio ${cible.actifAvant} → ${apres.studio}`);
    await m.close();

    check(erreurs.length === 0, `aucune erreur JavaScript — ${erreurs.join(' | ') || 'aucune'}`);
    await browser.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
