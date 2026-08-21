// Le son appartient au morceau, plus à l'accord.
//
// RETOUR UTILISATEUR : « On va simplifier les types d'instruments : à définir une fois dans morceau
// uniquement, et tout le morceau prendra cet instrument, je ne ferai jamais de mélange. À cacher une
// fois modifié (dans la popover morceau). »
//
// TROIS MÉCANISMES POUR UN RÉGLAGE QUI NE VARIE JAMAIS. Avant ce lot, le son était écrit dans CHAQUE
// accord (data.instrument), présélectionné par une clé d'appareil, et recopiable partout par un
// bouton « pot de peinture ». Il n'en reste qu'un : le champ instrumentMorceau du morceau.
//
// LE POINT DÉLICAT, ET IL EST DÉCIDÉ, PAS SUBI. Les morceaux déjà écrits portent un son par accord —
// souvent plusieurs différents, posés sans y penser au fil de l'écriture. Trois issues étaient
// possibles : promouvoir le son du premier accord, promouvoir l'ancien champ song.instrument, ou
// tout ramener à Piano. L'utilisateur a choisi la troisième, et c'est aussi la plus défendable : les
// deux premières feraient d'un choix ACCIDENTEL — celui du dernier accord touché — la couleur de
// l'œuvre entière. Piano est le repli neutre, et il suffit d'un geste pour en changer.
// Un morceau enregistré APRÈS, lui, retrouve le sien : c'est ce que la section C éprouve.
const { chromium, devices } = require('playwright');
const creerHarnais = require('./_harness');
const { plan, check, exiger, bilan } = creerHarnais('Le son appartient au morceau');
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';

// UN MORCEAU « D'AVANT », aussi hostile que possible : des sons différents par accord, ET l'ancien
// champ song.instrument. Aucun des deux ne doit décider de quoi que ce soit.
const seedAncien = () => {
    const mk = (r, q, b, i) => ({ root: r, quality: q, beats: b, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held', instrument: i });
    const song = {
        id: 'vieux', name: 'Ballade', bpm: 120, timeSig: '4/4', groove: 'straight',
        instrument: 'organ',   // l'ancien champ : « le son du prochain accord », pas celui du morceau
        sections: [{ title: 'Couplet', chords: [mk('C', 'maj7', 4, 'pad'), mk('F', 'maj', 4, 'strings')] }],
    };
    localStorage.setItem('harmohubSongs', JSON.stringify([song]));
    localStorage.setItem('harmohubCurrentSongId', song.id);
    localStorage.setItem('myProgression', JSON.stringify({ sections: song.sections }));
};

(async () => {
    plan(17);
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const erreurs = [];
    const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
    page.on('pageerror', e => erreurs.push('ordinateur : ' + e.message));
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await page.waitForTimeout(300);
    await page.evaluate(seedAncien);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(1100);

    console.log('=== A. Le sélecteur a déménagé, et le pot de peinture a disparu ===');
    const a = await page.evaluate(() => {
        const sel = document.getElementById('instrument');
        return {
            existe: !!sel,
            dansMorceau: !!sel && !!sel.closest('#song-settings'),
            dansLecture: !!sel && !!sel.closest('#lecture-card'),
            pot: !!document.getElementById('apply-instrument-all'),
        };
    });
    exiger(a.existe, 'le sélecteur de son existe toujours');
    check(a.dansMorceau && !a.dansLecture, 'il vit dans les réglages du morceau, plus dans la carte Lecture');
    // Quand il n'y a qu'une valeur pour tout le morceau, « appliquer à tout » ne veut plus rien dire.
    check(!a.pot, 'le bouton « appliquer ce son à tout le morceau » a disparu');

    console.log('\n=== B. Un morceau écrit AVANT rouvre sur Piano ===');
    const b = await page.evaluate(() => ({
        etat: window.app.songInstrument,
        select: document.getElementById('instrument').value,
        // Les sons par accord sont TOUJOURS dans le fichier : on ne réécrit pas des morceaux
        // enregistrés pour effacer un champ devenu inerte. On vérifie qu'ils sont ignorés, pas effacés.
        parAccord: JSON.parse(localStorage.getItem('myProgression')).sections[0].chords.map(c => c.instrument),
        ancienChamp: JSON.parse(localStorage.getItem('harmohubSongs'))[0].instrument,
    }));
    check(b.etat === 'piano' && b.select === 'piano',
        `Piano, malgré des accords en ${b.parAccord.join('/')} et un ancien champ « ${b.ancienChamp} » — ${b.etat}`);
    check(b.parAccord.join(',') === 'pad,strings' && b.ancienChamp === 'organ',
        'et rien n\'a été effacé dans le fichier : les anciens champs sont ignorés, pas réécrits');

    console.log('\n=== C. Choisir un son l\'écrit dans le MORCEAU, et il y reste ===');
    // Par le vrai geste : déplier les réglages du morceau, puis choisir.
    await page.click('#song-summary');
    await page.waitForTimeout(400);
    const atteignable = await page.evaluate(() => {
        const s = document.getElementById('instrument');
        const r = s.getBoundingClientRect();
        const dessus = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { visible: s.offsetParent !== null, taille: `${Math.round(r.width)}x${Math.round(r.height)}`,
                 dessus: !!dessus && (dessus === s || s.contains(dessus)) };
    });
    exiger(atteignable.visible && atteignable.dessus,
        `le sélecteur est réellement atteignable une fois les réglages dépliés — ${atteignable.taille}`);
    await page.selectOption('#instrument', 'strings');
    await page.waitForTimeout(400);
    check(await page.evaluate(() => window.app.songInstrument) === 'strings',
        'choisir met à jour le son du morceau tout de suite');
    await page.evaluate(() => window.app.saveCurrentSong());
    await page.waitForTimeout(600);
    const c = await page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem('harmohubSongs'))[0];
        return { nouveau: s.instrumentMorceau, ancien: s.instrument };
    });
    check(c.nouveau === 'strings', `il est enregistré dans le champ du morceau — instrumentMorceau = ${c.nouveau}`);
    // Champ NEUF, et pas l'ancien réutilisé : c'est ce qui permet de distinguer « écrit avant » de
    // « enregistré depuis ». Réutiliser song.instrument aurait rendu les deux cas indiscernables.
    check(c.ancien === 'organ', `l'ancien champ n'est pas récupéré ni écrasé — song.instrument = ${c.ancien}`);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(1100);
    check(await page.evaluate(() => window.app.songInstrument) === 'strings',
        'et un morceau enregistré DEPUIS ce changement retrouve bien le sien au rechargement');

    console.log('\n=== D. Un nouvel accord n\'emporte plus de son à lui ===');
    const avant = await page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')).sections[0].chords.length);
    await page.selectOption('#root', 'D');
    await page.waitForTimeout(200);
    await page.click('#save');
    await page.waitForTimeout(700);
    const d = await page.evaluate(() => {
        const ch = JSON.parse(localStorage.getItem('myProgression')).sections[0].chords;
        return { n: ch.length, champ: 'instrument' in ch[ch.length - 1] };
    });
    exiger(d.n === avant + 1, `l'accord a bien été ajouté — ${avant} puis ${d.n}`);
    check(!d.champ, 'le nouvel accord ne porte aucun champ instrument : le son est celui du morceau');

    console.log('\n=== E. Le son du morceau est bien celui qu\'on entend ===');
    // Le bout du fil : ce n'est pas parce qu'une valeur est stockée qu'elle est JOUÉE. On lit ce que
    // la lecture demande réellement à la banque de sons, en interceptant getInstrument.
    const e = await page.evaluate(async () => {
        const demandes = [];
        const vrai = window.app.getInstrument.bind(window.app);
        window.app.getInstrument = (nom, ...r) => { demandes.push(nom); return vrai(nom, ...r); };
        window.app.playProgression();
        await new Promise(r => setTimeout(r, 900));
        window.app.stopAll();
        window.app.getInstrument = vrai;
        return { demandes: [...new Set(demandes)] };
    });
    check(e.demandes.length > 0 && e.demandes.every(n => n === 'strings'),
        `la lecture ne demande que le son du morceau — ${e.demandes.join(', ') || 'aucune demande'}`);

    console.log('\n=== F. L\'export MIDI suit le même son ===');
    const f = await page.evaluate(() => {
        try { const buf = window.app.buildMidiFile(); return { ok: !!buf, taille: buf ? (buf.byteLength || buf.length) : 0 }; }
        catch (err) { return { ok: false, erreur: err.message }; }
    });
    check(f.ok && f.taille > 0, `l'export MIDI passe sans lever d'erreur — ${f.ok ? f.taille + ' octets' : f.erreur}`);
    await page.close();

    console.log('\n=== G. Téléphone : le réglage reste atteignable au doigt ===');
    const ctx = await browser.newContext({ ...devices['iPhone 13'], hasTouch: true });
    const m = await ctx.newPage();
    m.on('pageerror', ev => erreurs.push('téléphone : ' + ev.message));
    await m.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load' });
    await m.waitForTimeout(300);
    await m.evaluate(seedAncien);
    await m.reload({ waitUntil: 'load' });
    await m.waitForTimeout(1200);
    await m.tap('#song-summary');
    await m.waitForTimeout(600);
    const g = await m.evaluate(() => {
        const s = document.getElementById('instrument');
        if (!s) return null;
        s.scrollIntoView({ block: 'center' });
        const r = s.getBoundingClientRect();
        const dessus = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { h: Math.round(r.height), l: Math.round(r.width),
                 atteignable: !!dessus && (dessus === s || s.contains(dessus)),
                 pageDeborde: document.documentElement.scrollWidth > window.innerWidth + 1 };
    });
    exiger(!!g, 'téléphone : le sélecteur est là');
    check(g.h >= 28 && g.l >= 80, `téléphone : il fait ${g.l}x${g.h}, assez grand pour le doigt`);
    check(g.atteignable && !g.pageDeborde, 'téléphone : rien ne le recouvre, et la page ne déborde pas');
    await m.selectOption('#instrument', 'pad');
    await m.waitForTimeout(400);
    check(await m.evaluate(() => window.app.songInstrument) === 'pad',
        'téléphone : le choix arrive bien dans le son du morceau');

    check(erreurs.length === 0, `aucune erreur JavaScript — ${erreurs.join(' | ') || 'aucune'}`);
    await browser.close();
    bilan();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
