// Le rythme : deux boutons en moins, une préférence en plus.
//
// RETOUR UTILISATEUR : « Je pense que je ne me servirai rarement du rythme. Pour diminuer le nombre
// de boutons, laisser uniquement un choix favori dans les paramètres : jouer des notes tenues tous
// les temps, ou jouer uniquement une note tenue sur le premier temps de l'accord (par défaut).
// Supprime les boutons dans "Lecture" et dans le petit séquenceur. »
//
// CE QUE CE BANC ÉPROUVE, ET POURQUOI CHAQUE FAMILLE EST LÀ.
//
// Retirer deux boutons est facile ; ne rien casser en le faisant, non. Trois dangers précis :
//
//   1. LE CHAMP SOURCE. #playStyle n'est pas le bouton, c'est ce que lisent readChord, seqPreset et
//      les exports. Il doit rester, masqué. Section A.
//   2. LES ACCORDS DÉJÀ ÉCRITS. Une préférence GLOBALE qui repeindrait le rythme d'accords existants
//      serait une perte de travail silencieuse. Sections D et E.
//   3. LE MENU D'INTENSITÉ. Il porte les classes .playstyle-dd-menu / .playstyle-dd-item, héritées
//      du menu de rythme dont il a repris l'habillage. Nettoyer « tout ce qui commence par
//      .playstyle-dd » l'aurait déshabillé — fond, cadre et ombre en moins, en fixed par-dessus la
//      grille. Un nom de classe partagé ne se voit pas dans un diff. Section G.
const { chromium, devices } = require('playwright');
const creerHarnais = require('./_harness');
const { plan, check, exiger, bilan } = creerHarnais('Rythme : une seule préférence, plus aucun bouton');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';

// L'accord en place porte un rythme qui n'est NI l'un NI l'autre des deux choix offerts : c'est le
// cas des morceaux écrits quand les neuf styles étaient proposés. Il doit traverser tout ce banc
// sans être touché.
const seed = (pref) => {
    const song = { id: 'r', name: 'Ballade', bpm: 120, timeSig: '4/4', groove: 'straight',
        sections: [{ title: 'Couplet', chords: [
            { root: 'A', quality: 'm6', beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'croche_staccato' },
        ] }] };
    localStorage.setItem('harmohubSongs', JSON.stringify([song]));
    localStorage.setItem('harmohubCurrentSongId', song.id);
    localStorage.setItem('myProgression', JSON.stringify({ sections: song.sections }));
    if (pref !== undefined) localStorage.setItem('harmohubRythmeDepart', pref);
};

const ouvrir = async (p) => { await p.click('#open-settings'); await p.waitForTimeout(500); };

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
    await page.waitForTimeout(1000);

    console.log('=== A. Les deux boutons sont partis, la source de vérité est restée ===');
    const a = await page.evaluate(() => {
        const src = document.getElementById('playStyle');
        return {
            boutonCarte: !!document.getElementById('playstyle-dd-toggle'),
            boutonSeq: !!document.getElementById('seq-playstyle-btn'),
            menuNeuf: !!document.getElementById('playstyle-dd-menu'),
            source: !!src, sourceMasquee: !!src && src.offsetParent === null,
            // Les neuf styles ne sont pas SUPPRIMÉS, ils ne sont plus PROPOSÉS : seqPreset s'en sert
            // toujours, et un accord ancien peut en porter un.
            neufOptions: typeof PLAYSTYLE_OPTIONS !== 'undefined' && PLAYSTYLE_OPTIONS.length >= 9,
        };
    });
    check(!a.boutonCarte && !a.boutonSeq, 'plus de bouton Rythme, ni dans la carte ni dans le séquenceur');
    check(!a.menuNeuf, 'le menu des neuf styles a disparu du document');
    check(a.source && a.sourceMasquee, '#playStyle est resté dans le DOM, masqué : c\'est lui que lit readChord');
    check(a.neufOptions, 'les neuf styles existent toujours dans le code — ils ne sont plus proposés, pas supprimés');

    console.log('\n=== B. Le réglage est dans Paramètres > Son, et pas enterré ===');
    await ouvrir(page);
    const b = await page.evaluate(() => {
        const sel = document.getElementById('rythme-depart');
        if (!sel) return null;
        const rang = sel.closest('.settings-select-row');
        const rb = rang.getBoundingClientRect(), sb = sel.getBoundingClientRect();
        const lab = rang.querySelector('label').getBoundingClientRect();
        return {
            options: [...sel.options].map(o => o.textContent),
            valeurs: [...sel.options].map(o => o.value),
            valeur: sel.value,
            // « Un choix favori dans les paramètres » ne veut pas dire caché derrière un repli.
            dansAvancees: !!sel.closest('.settings-advanced'),
            deborde: rang.scrollWidth > rang.clientWidth + 1 || sb.right > rb.right + 1,
            chevauche: lab.right > sb.left + 1,
        };
    });
    exiger(!!b, 'le réglage « Rythme des nouveaux accords » existe');
    check(b.options.length === 2, `deux choix, pas neuf — ${b.options.length} : ${b.options.join(' / ')}`);
    check(b.valeurs.join(',') === 'held,noire_maintenu',
        `les deux que l'utilisateur a nommés — ${b.valeurs.join(', ')}`);
    check(b.valeur === 'held', `« une note tenue sur le premier temps » par défaut — ${b.valeur}`);
    check(!b.dansAvancees, 'il est dans le groupe Son, pas replié dans « Options avancées »');
    check(!b.deborde && !b.chevauche, 'son libellé et sa liste tiennent côte à côte sans déborder');

    console.log('\n=== C. Choisir écrit dans la source ET dans la mémoire ===');
    await page.selectOption('#rythme-depart', 'noire_maintenu');
    await page.waitForTimeout(300);
    const c = await page.evaluate(() => ({
        source: document.getElementById('playStyle').value,
        memoire: localStorage.getItem('harmohubRythmeDepart'),
    }));
    check(c.source === 'noire_maintenu' && c.memoire === 'noire_maintenu',
        `le choix arrive dans #playStyle (${c.source}) et dans la mémoire (${c.memoire})`);
    await page.click('#settings-close');
    await page.waitForTimeout(400);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(1000);
    const cc = await page.evaluate(() => ({ etat: window.app.rythmeDepart, source: document.getElementById('playStyle').value }));
    check(cc.etat === 'noire_maintenu' && cc.source === 'noire_maintenu',
        `il survit à un rechargement complet — ${cc.etat}`);

    console.log('\n=== D. Un accord DÉJÀ ÉCRIT garde le sien ===');
    // Le vrai risque d'une préférence globale : repeindre du travail existant sans le dire.
    await page.evaluate(() => window.app.editChord(0, 0));
    await page.waitForTimeout(600);
    const d = await page.evaluate(() => document.getElementById('playStyle').value);
    check(d === 'croche_staccato', `ouvrir un accord ancien montre SON rythme, pas la préférence — ${d}`);
    const d2 = await page.evaluate(() => {
        window.app.setRythmeDepart('held');   // on change la préférence PENDANT la modification
        return { source: document.getElementById('playStyle').value, pref: window.app.rythmeDepart };
    });
    check(d2.source === 'croche_staccato' && d2.pref === 'held',
        `changer la préférence en pleine modification ne touche pas l'accord ouvert — accord ${d2.source}, préférence ${d2.pref}`);
    const d3 = await page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords[0].playStyle);
    check(d3 === 'croche_staccato', `et rien n'est écrit dans le morceau enregistré — ${d3}`);

    console.log('\n=== E. Un NOUVEL accord prend la préférence ===');
    await page.evaluate(() => window.app.setRythmeDepart('noire_maintenu'));
    // On SORT du mode Modification par le vrai geste : la croix de l'en-tête de la carte Accord.
    // window.app.exitEditMode() seul laisse « Ajouter » masqué jusqu'au prochain rendu de la grille —
    // état qu'aucun geste réel ne produit, et qu'un banc ne doit donc pas fabriquer pour lui-même.
    await page.click('#accord-close');
    await page.waitForTimeout(700);
    const avant = await page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords.length);
    await page.selectOption('#root', 'D');
    await page.waitForTimeout(200);
    // Le vrai bouton, pas window.app.addChord() : un bouton qu'on ne peut atteindre qu'en appelant la
    // fonction derrière n'est pas un bouton.
    await page.click('#save');
    await page.waitForTimeout(700);
    const e = await page.evaluate(() => {
        const ch = JSON.parse(localStorage.getItem('myProgression')).sections[0].chords;
        return { n: ch.length, dernier: ch[ch.length - 1].playStyle, premier: ch[0].playStyle };
    });
    exiger(e.n === avant + 1, `l'accord a bien été ajouté — ${avant} puis ${e.n}`);
    check(e.dernier === 'noire_maintenu', `le nouvel accord naît avec la préférence — ${e.dernier}`);
    check(e.premier === 'croche_staccato', `et l'ancien n'a toujours pas bougé — ${e.premier}`);

    console.log('\n=== F. Une valeur mémorisée invalide ne se pose pas dans la source ===');
    // Un des sept styles retirés du choix, ou n'importe quoi d'autre, resté d'une version antérieure.
    // Plus aucune commande visible ne permettrait de le corriger : il faut donc qu'il ne passe pas.
    await page.evaluate(() => localStorage.setItem('harmohubRythmeDepart', 'blanche_staccato'));
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(1000);
    const f = await page.evaluate(() => ({
        etat: window.app.rythmeDepart,
        source: document.getElementById('playStyle').value,
        liste: document.getElementById('rythme-depart') ? document.getElementById('rythme-depart').value : null,
    }));
    check(f.etat === 'held' && f.source === 'held',
        `une valeur hors des deux choix retombe sur le défaut — ${f.etat}`);

    console.log('\n=== G. Le menu d\'intensité a gardé son habillage ===');
    // Il porte les classes du menu de rythme (.playstyle-dd-menu/.playstyle-dd-item). Un nettoyage
    // « tout ce qui commence par .playstyle-dd » l'aurait laissé sans fond, sans cadre et sans ombre,
    // en position fixed par-dessus la grille — invisible dans un diff, très visible à l'écran.
    await page.evaluate(() => window.app.ouvrirMenuIntensite(0, 0, document.body));
    await page.waitForTimeout(400);
    const g = await page.evaluate(() => {
        const m = document.getElementById('intensity-menu');
        const st = getComputedStyle(m);
        const item = m.querySelector('.playstyle-dd-item');
        return { ouvert: !m.hidden, fixed: st.position === 'fixed',
                 habille: st.backgroundColor !== 'rgba(0, 0, 0, 0)' && parseFloat(st.borderTopWidth) >= 1 && st.boxShadow !== 'none',
                 nb: m.querySelectorAll('.playstyle-dd-item').length,
                 hauteurEntree: item ? Math.round(item.getBoundingClientRect().height) : 0 };
    });
    check(g.ouvert && g.fixed && g.habille,
        `fond, cadre et ombre toujours là, en fixed — ${g.habille ? 'habillé' : 'DÉSHABILLÉ'}`);
    check(g.nb === 5 && g.hauteurEntree >= 24,
        `ses cinq entrées gardent leur gabarit — ${g.nb} entrées de ${g.hauteurEntree}px`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await page.close();

    console.log('\n=== H. Téléphone : le réglage s\'atteint au doigt ===');
    const ctx = await browser.newContext({ ...devices['iPhone 13'], hasTouch: true });
    const m = await ctx.newPage();
    m.on('pageerror', e => erreurs.push('téléphone : ' + e.message));
    await m.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await m.waitForTimeout(300);
    await m.evaluate(seed);
    await m.reload({ waitUntil: 'load' });
    await m.waitForTimeout(1200);
    await m.tap('#open-settings');
    await m.waitForTimeout(600);
    const h = await m.evaluate(() => {
        const sel = document.getElementById('rythme-depart');
        if (!sel) return null;
        sel.scrollIntoView({ block: 'center' });
        const r = sel.getBoundingClientRect();
        const dessus = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { h: Math.round(r.height), l: Math.round(r.width),
                 atteignable: !!dessus && (dessus === sel || sel.contains(dessus)),
                 pageDeborde: document.documentElement.scrollWidth > window.innerWidth + 1 };
    });
    exiger(!!h, 'téléphone : le réglage est là');
    check(h.h >= 28 && h.l >= 120, `téléphone : la liste fait ${h.l}x${h.h}, assez grande pour le doigt`);
    check(h.atteignable && !h.pageDeborde, 'téléphone : rien ne la recouvre, et la page ne déborde pas');

    check(erreurs.length === 0, `aucune erreur JavaScript — ${erreurs.join(' | ') || 'aucune'}`);
    await browser.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
