// Un seul aspect de bouton dans le volet de gauche.
//
// RETOUR UTILISATEUR : « Je veux que tous les boutons du volet de gauche aient l'aspect sombre que tu
// viens de mettre en place pour les nouveaux boutons, c'est plus joli. »
//
// MESURÉ AVANT, en relevant les styles RÉELLEMENT APPLIQUÉS bouton par bouton : 20 boutons visibles,
// DIX familles d'aspect distinctes. Fonds #1c2027, #16191e, rgba blanc à 3,5 %, transparent ; avec
// dégradé ou sans ; cadres #333, vert, rouge ; rayons 0, 7, 8, 10 et 999px. Personne n'avait dessiné
// ça — c'est le dépôt de quinze lots successifs, chacun ajoutant sa nuance sans regarder la précédente.
//
// CE QUE CE BANC ÉPROUVE, ET POURQUOI IL COMPTE DES FAMILLES PLUTÔT QUE DES VALEURS.
//
// Vérifier « ce bouton-ci a bien tel fond » ne dit rien de l'homogénéité : on peut passer douze
// vérifications de ce genre avec douze aspects différents. Ce banc relève donc l'aspect de CHAQUE
// bouton et compte les familles distinctes — c'est la seule forme qui échoue quand un lot futur
// réintroduira une nuance de plus, ce qui est exactement le défaut qu'on vient de corriger.
//
// TROIS FAMILLES SUBSISTENT, ET CHACUNE EST UNE DÉCISION :
//   1. la référence sombre — fond plat #16191e, cadre 1px, rayon 7px, ni dégradé ni ombre ;
//   2. le sélecteur segmenté (renversement, drop, octave) : ses cases sont transparentes DANS un
//      cadre commun, c'est ce cadre-là qui porte l'aspect sombre ;
//   3. les deux actions colorées, Ajouter et Enregistrer. Question posée, réponse retenue : elles
//      gardent leur vert. La couleur y est un signal, pas une décoration — l'uniformité aurait
//      obligé à LIRE chaque bouton pour retrouver ce qu'un coup d'œil donnait. Elles adoptent en
//      revanche la même FORME : fond plat, cadre 1px, rayon 7px.
const { chromium, devices } = require('playwright');
const creerHarnais = require('./_harness');
const { plan, check, exiger, bilan } = creerHarnais('Un seul aspect de bouton dans le volet');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';

const seed = () => {
    const mk = (r, q, b) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
    const song = { id: 'aspect', name: 'Ballade', bpm: 120, timeSig: '4/4', groove: 'straight',
        sections: [{ title: 'Couplet', chords: [mk('C', 'maj7', 4), mk('F', 'maj', 4)] }] };
    localStorage.setItem('harmohubSongs', JSON.stringify([song]));
    localStorage.setItem('harmohubCurrentSongId', song.id);
    localStorage.setItem('myProgression', JSON.stringify({ sections: song.sections }));
};

// Relève l'aspect de chaque bouton VISIBLE du volet, en excluant deux zones à dessein :
//  - la barre de transport (#global-transport / .transport), qui FLOTTE au-dessus de toute
//    l'application avec sa propre échelle (52px contre 32) — ce n'est pas un bouton de volet ;
//  - le séquenceur (.arp-seq), qui VOYAGE : dans la carte sur téléphone, sous la grille sur
//    ordinateur. Une règle qui le prendrait au passage lui donnerait deux aspects selon la largeur
//    de l'écran, exactement le contraire du but. C'est éprouvé en section D.
const relever = () => {
    const volet = document.querySelector('.col-left');
    if (!volet) return null;
    const vus = [];
    for (const b of volet.querySelectorAll('button')) {
        if (b.offsetParent === null) continue;
        if (b.closest('.transport') || b.closest('#global-transport') || b.closest('.arp-seq')) continue;
        const st = getComputedStyle(b);
        vus.push({
            nom: b.id || b.className.split(' ')[0],
            fond: st.backgroundColor,
            degrade: st.backgroundImage !== 'none',
            cadreL: st.borderTopWidth, cadreC: st.borderTopColor,
            rayon: st.borderTopLeftRadius,
            ombre: st.boxShadow !== 'none',
        });
    }
    return vus;
};
const cle = (x) => `${x.fond}|${x.degrade}|${x.cadreL}|${x.cadreC}|${x.rayon}|${x.ombre}`;

(async () => {
    plan(18);
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const erreurs = [];
    const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
    page.on('pageerror', e => erreurs.push('ordinateur : ' + e.message));
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await page.waitForTimeout(300);
    await page.evaluate(seed);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(1100);

    console.log('=== A. Combien de familles d\'aspect cohabitent ? ===');
    const vus = await page.evaluate(relever);
    exiger(!!vus && vus.length >= 10, `le volet porte assez de boutons pour que la question se pose — ${vus ? vus.length : 0}`);
    const familles = new Map();
    for (const x of vus) { const k = cle(x); if (!familles.has(k)) familles.set(k, []); familles.get(k).push(x.nom); }
    const resume = [...familles.entries()].map(([, m]) => `${m.length}× ${m[0]}`).join(' | ');
    // DIX avant, sur les mêmes boutons. QUATRE est le nombre décidé, pas un nombre subi : la référence
    // sombre, le sélecteur segmenté, les actions colorées — et depuis, UNE exception nommée.
    //
    // L'EXCEPTION, C'EST LA PORTE DU SÉQUENCEUR (retour utilisateur : « le bouton petit séquenceur
    // dans le volet de gauche : remettre en gris comme avant, il faut le différencier un peu des
    // autres boutons »). Elle est justifiée : ce n'est pas un réglage parmi les autres, c'est une
    // porte — elle emmène ailleurs au lieu de modifier ce qu'on regarde.
    // ON LA NOMME AU LIEU DE RELEVER LE PLAFOND, et c'est tout l'intérêt : un simple `<= 4` laisserait
    // passer n'importe quelle quatrième famille apparue par accident. En exigeant que la famille en
    // trop soit CELLE-LÀ, le garde-fou garde ses dents — une cinquième famille, ou une dérive sur un
    // autre bouton, rougit toujours.
    const familleSeule = [...familles.entries()].filter(([, m]) => m.length === 1).map(([, m]) => m[0]);
    check(familles.size <= 4, `au plus quatre familles, contre dix avant — ${familles.size} : ${resume}`);
    check(familles.size <= 3 || familleSeule.includes('seq-zoom'),
        `la famille en trop est bien l'exception nommée (la porte du séquenceur) — seule(s) : ${familleSeule.join(', ') || 'aucune'}`);

    console.log('\n=== B. La famille dominante EST la référence désignée ===');
    // « L'aspect sombre que tu viens de mettre en place pour les nouveaux boutons » : le menu de durée
    // de la rangée du dessous. On lit la référence SUR LUI plutôt que de recopier des valeurs en dur —
    // si elle change un jour, ce banc suit au lieu de mentir.
    const ref = await page.evaluate(() => {
        const d = document.getElementById('duration-dd-toggle');
        if (!d) return null;
        const st = getComputedStyle(d);
        return { fond: st.backgroundColor, degrade: st.backgroundImage !== 'none',
                 cadreL: st.borderTopWidth, rayon: st.borderTopLeftRadius, ombre: st.boxShadow !== 'none' };
    });
    exiger(!!ref, 'le bouton de référence existe');
    check(!ref.degrade && !ref.ombre, `la référence est bien PLATE — dégradé ${ref.degrade}, ombre ${ref.ombre}`);
    const grande = [...familles.entries()].sort((a, b) => b[1].length - a[1].length)[0];
    const membres = grande[1];
    const unExemple = vus.find(x => x.nom === membres[0]);
    check(membres.length >= 6, `la famille dominante rassemble ${membres.length} boutons — ${membres.slice(0, 4).join(', ')}…`);
    check(unExemple.fond === ref.fond && unExemple.rayon === ref.rayon && !unExemple.degrade && !unExemple.ombre,
        `et c'est la référence : fond ${unExemple.fond}, rayon ${unExemple.rayon}, sans dégradé ni ombre`);

    console.log('\n=== C. Les deux signaux de couleur ont survécu ===');
    // Le risque de ce lot : une règle de volet plus spécifique emporte le liseré d'un bouton d'accent
    // sans que rien ne le dise. C'est arrivé au premier jet — .col-left .icon-btn (0,2,0) l'emportait
    // sur .icon-btn-accent (0,1,0), et Enregistrer avait perdu son vert.
    const couleurs = await page.evaluate(() => {
        const lire = (id) => { const e = document.getElementById(id); if (!e) return null; const st = getComputedStyle(e);
            return { cadre: st.borderTopColor, rayon: st.borderTopLeftRadius, degrade: st.backgroundImage !== 'none' }; };
        return { ajouter: lire('save'), enregistrer: lire('song-save') };
    });
    exiger(!!couleurs.ajouter && !!couleurs.enregistrer, 'les deux boutons colorés existent');
    const vert = (c) => /rgb\(\s*4[0-9],\s*9[0-9],\s*6[0-9]/.test(c) || c.includes('47, 91, 64');
    check(vert(couleurs.ajouter.cadre), `« Ajouter » a gardé son liseré vert — ${couleurs.ajouter.cadre}`);
    check(vert(couleurs.enregistrer.cadre), `« Enregistrer » aussi — ${couleurs.enregistrer.cadre}`);
    check(couleurs.ajouter.rayon === ref.rayon && !couleurs.ajouter.degrade,
        `mais ils ont pris la FORME de la référence — rayon ${couleurs.ajouter.rayon}, dégradé ${couleurs.ajouter.degrade}`);

    console.log('\n=== D. Le séquenceur garde le MÊME aspect sur les deux formats ===');
    // C'EST LA RAISON D'ÊTRE DE L'EXCLUSION. #arp-sequencer vit dans la carte Accord sur téléphone et
    // sous la grille sur ordinateur (voir placeSequencer). Une règle de volet l'aurait donc repeint
    // sur l'un des deux seulement — un même outil avec deux aspects selon la largeur de l'écran.
    await page.evaluate(() => window.app.ouvrirSequenceurPleinEcran());
    await page.waitForTimeout(800);
    await page.evaluate(() => window.app.closeSeqZoom());
    await page.waitForTimeout(600);
    const seqBureau = await page.evaluate(() => {
        const b = document.querySelector('.seq-presets .seq-icon-btn');
        if (!b) return null;
        const st = getComputedStyle(b);
        return { fond: st.backgroundColor, rayon: st.borderTopLeftRadius, degrade: st.backgroundImage !== 'none' };
    });
    exiger(!!seqBureau, 'la barre du séquenceur est mesurable sur ordinateur');
    await page.close();

    console.log('\n=== E. Téléphone : le même volet, et le même séquenceur ===');
    const ctx = await browser.newContext({ ...devices['iPhone 13'], hasTouch: true });
    const m = await ctx.newPage();
    m.on('pageerror', e => erreurs.push('téléphone : ' + e.message));
    await m.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await m.waitForTimeout(300);
    await m.evaluate(seed);
    await m.reload({ waitUntil: 'load' });
    await m.waitForTimeout(1200);
    const vusTel = await m.evaluate(relever);
    exiger(!!vusTel && vusTel.length >= 6, `le volet porte des boutons sur téléphone — ${vusTel ? vusTel.length : 0}`);
    // Même compte qu'à l'écran large, exception comprise : la porte du séquenceur se distingue partout,
    // sinon elle ne se distinguerait que sur un format et l'exception ne voudrait plus rien dire.
    const famillesTelMap = new Map();
    for (const x of vusTel) { const k = cle(x); if (!famillesTelMap.has(k)) famillesTelMap.set(k, []); famillesTelMap.get(k).push(x.nom); }
    const seulesTel = [...famillesTelMap.entries()].filter(([, m]) => m.length === 1).map(([, m]) => m[0]);
    check(famillesTelMap.size <= 4, `téléphone : au plus quatre familles également — ${famillesTelMap.size}`);
    check(famillesTelMap.size <= 3 || seulesTel.includes('seq-zoom'),
        `téléphone : la famille en trop est la même exception nommée — seule(s) : ${seulesTel.join(', ') || 'aucune'}`);

    await m.evaluate(() => window.app.ouvrirSequenceurPleinEcran());
    await m.waitForTimeout(1000);
    await m.evaluate(() => window.app.closeSeqZoom());
    await m.waitForTimeout(800);
    const seqTel = await m.evaluate(() => {
        const b = document.querySelector('.seq-presets .seq-icon-btn');
        if (!b) return null;
        const st = getComputedStyle(b);
        return { fond: st.backgroundColor, rayon: st.borderTopLeftRadius, degrade: st.backgroundImage !== 'none' };
    });
    exiger(!!seqTel, 'la barre du séquenceur est mesurable sur téléphone');
    check(seqTel.fond === seqBureau.fond && seqTel.rayon === seqBureau.rayon && seqTel.degrade === seqBureau.degrade,
        `le séquenceur a le même aspect des deux côtés — ${seqTel.fond} / ${seqTel.rayon} contre ${seqBureau.fond} / ${seqBureau.rayon}`);

    check(erreurs.length === 0, `aucune erreur JavaScript — ${erreurs.join(' | ') || 'aucune'}`);
    await browser.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
