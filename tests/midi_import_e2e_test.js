// Import MIDI, étape 6 : le parcours complet, par le vrai bouton.
// L'épreuve de vérité : on exporte un morceau depuis l'appli, on le RÉIMPORTE par le bouton comme
// le ferait l'utilisateur, et on vérifie qu'on retrouve la même grille et les mêmes notes. Puis on
// éprouve ce qui doit être protégé : ne rien écraser, refuser proprement un fichier illisible,
// et fonctionner aussi bien au doigt qu'à la souris.
const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
const fs = require('fs');
const path = require('path');

let PASS = 0, FAIL = 0;
function check(cond, label) { if (cond) { PASS++; console.log('PASS - ' + label); } else { FAIL++; console.log('FAIL - ' + label); } }

const TMP = 'fixtures';

// Notes que l'appli jouerait pour une grille donnée : sert à comparer AVANT/APRÈS l'aller-retour.
const READBACK = `
window._notesJouees = () => {
    const out = [];
    let t = 0;
    loadProgressionSections().forEach(sec => sec.chords.forEach(data => {
        const beats = beatsFromData(data);
        const chord = new Chord(data.root, data.quality, beats, data.inversion, data.drop, octaveFromData(data), data.bass, null, data.extraNotes);
        const midis = chord.getSeqMidiNotes();
        const { pattern, tie } = window.app.resolveSeqPatternForData(chord, data);
        for (let v = 0; v < midis.length; v++) {
            let s = 0;
            while (s < pattern.length) {
                if (!pattern[s].includes(v)) { s++; continue; }
                const start = s; s++;
                while (s < pattern.length && pattern[s].includes(v) && tie[s].includes(v)) s++;
                out.push([midis[v], t + start, t + s]);
            }
        }
        t += beats * SEQ_STEPS_PER_BEAT;
    }));
    out.sort((a, b) => (a[1] - b[1]) || (a[0] - b[0]));
    return out;
};
window._grille = () => loadProgressionSections().map(s => ({
    titre: s.title,
    accords: s.chords.map(c => (c.unnamed ? 'à nommer' : chordSymbolForData(c, false)) + ':' + beatsFromData(c)),
}));
`;

(async () => {
    fs.mkdirSync(TMP, { recursive: true });
    const browser = await chromium.launch();
    const errors = [];

    // ============================================================
    // === ORDINATEUR ===
    // ============================================================
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(700);
    await page.addScriptTag({ content: READBACK });

    // --- L'import se trouve-t-il là où on l'attend, et se lit-il ? ---
    // CONTRAT CHANGÉ : ce test décrivait une RANGÉE de six petits boutons-icônes, où l'import MIDI
    // était posé « juste à côté » de l'export MIDI et devait s'en distinguer par la teinte. Cette
    // rangée n'existe plus : six icônes muettes de 26px alignées côte à côte se ressemblaient toutes
    // et ne disaient pas ce qu'elles faisaient. Elles ont fusionné dans un seul bouton « Fichier »
    // qui ouvre un menu de lignes nommées et légendées. Ce qui se teste ici reste le MÊME besoin —
    // trouver l'import, le lire, ne pas le confondre avec l'export — mais il est désormais satisfait
    // par des mots plutôt que par des couleurs.
    await page.click('#file-menu-btn');
    await page.waitForTimeout(250);
    const bouton = await page.evaluate(() => {
        const menu = document.getElementById('file-menu');
        const b = menu.querySelector('[data-file-action="import-midi"]');
        const exp = menu.querySelector('[data-file-action="midi"]');
        if (!b || !exp) return null;
        const r = b.getBoundingClientRect();
        const lignes = [...menu.querySelectorAll('button')];
        return {
            menuOuvert: !menu.hidden,
            visible: r.width > 0 && r.height > 0,
            taille: [Math.round(r.width), Math.round(r.height)],
            // Un menu déroulant se lit en colonne : c'est l'alignement qui compte, pas la contiguïté.
            memeLargeur: lignes.every(l => Math.abs(l.getBoundingClientRect().width - r.width) < 2),
            // L'import est le SEUL à passer sous le trait de séparation : les exports d'un côté,
            // ce qui modifie le morceau de l'autre. C'est ce qui remplace la « teinte distincte ».
            apresLeTrait: b.previousElementSibling && b.previousElementSibling.className.includes('file-menu-sep'),
            expAvantLeTrait: exp.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING,
            libelle: b.querySelector('.file-menu-label') && b.querySelector('.file-menu-label').textContent,
            legende: b.querySelector('.file-menu-hint') && b.querySelector('.file-menu-hint').textContent,
            champCache: !!document.getElementById('import-midi-input') && document.getElementById('import-midi-input').hidden,
        };
    });
    check(bouton && bouton.menuOuvert && bouton.visible,
        `l'import se trouve dans le menu Fichier, visible une fois celui-ci ouvert — ${JSON.stringify(bouton && bouton.taille)}`);
    check(bouton && bouton.apresLeTrait && bouton.expAvantLeTrait,
        'un trait le sépare des exports : ce qui SORT du morceau d\'un côté, ce qui y ENTRE de l\'autre');
    check(bouton && bouton.memeLargeur, 'sa ligne est alignée sur les autres, le menu se lit d\'un seul coup d\'œil');
    check(bouton && /MIDI/i.test(bouton.libelle || ''),
        `il se nomme en toutes lettres, plus besoin de deviner une icône — « ${bouton && bouton.libelle} »`);
    check(bouton && (bouton.legende || '').length > 0,
        `...et une légende dit à quoi ça sert — « ${bouton && bouton.legende} »`);
    check(bouton && bouton.taille[1] >= 40,
        `sa ligne est une cible confortable au doigt, ce que les icônes de 26px n'étaient pas — ${bouton && bouton.taille[1]}px de haut`);
    check(bouton && bouton.champCache, 'le champ de fichier natif reste caché derrière l\'entrée de menu');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // --- Fabrique un fichier MIDI depuis l'appli, puis l'importe par le bouton ---
    const b64 = await page.evaluate(() => {
        const app = window.app;
        const sections = [{ title: 'Origine', chords: [
            { root: 'C', quality: 'maj', beats: 4, inversion: 0, drop: 0, octave: 3, instrument: 'piano' },
            { root: 'A', quality: 'min', beats: 4, inversion: 0, drop: 0, octave: 3, instrument: 'piano' },
            { root: 'F', quality: 'maj', beats: 4, inversion: 0, drop: 0, octave: 3, instrument: 'piano' },
            { root: 'G', quality: 'dom7', beats: 4, inversion: 0, drop: 0, octave: 3, instrument: 'piano' },
        ] }];
        const bytes = app.buildMidiFile(sections);
        let s = '';
        for (const b of bytes) s += String.fromCharCode(b);
        return btoa(s);
    });
    const midiPath = path.join(TMP, 'aller-retour.mid');
    fs.writeFileSync(midiPath, Buffer.from(b64, 'base64'));

    // Grille vierge avant l'import.
    await page.evaluate(() => { localStorage.clear(); });
    await page.reload();
    await page.waitForTimeout(700);
    await page.addScriptTag({ content: READBACK });

    await page.setInputFiles('#import-midi-input', midiPath);
    await page.waitForTimeout(900);

    const apres = await page.evaluate(() => ({
        grille: window._grille(),
        notes: window._notesJouees(),
        toast: (document.getElementById('toast') || {}).textContent || '',
        bpm: document.getElementById('bpm').value,
        sig: document.getElementById('time-sig').value,
    }));
    console.log('  grille importée :', JSON.stringify(apres.grille));
    console.log('  compte rendu    :', apres.toast);
    check(apres.grille.length === 1 && apres.grille[0].accords.length === 4,
        `les quatre mesures deviennent quatre cases — obtenu ${JSON.stringify(apres.grille)}`);
    check(JSON.stringify(apres.grille[0].accords) === JSON.stringify(['C:4', 'Am:4', 'F:4', 'G7:4']),
        `les accords d'origine sont retrouvés à l'identique — obtenu ${JSON.stringify(apres.grille[0].accords)}`);
    check(apres.grille[0].titre === 'aller-retour',
        `la partie porte le nom du fichier — obtenu « ${apres.grille[0].titre} »`);
    check(/reconnus?/.test(apres.toast) && /4 mesures/.test(apres.toast),
        `un compte rendu est affiché — « ${apres.toast} »`);

    // --- Fusion des mesures identiques ---
    const fusion = await page.evaluate(async () => {
        const app = window.app;
        localStorage.clear();
        const sections = [{ title: 'T', chords: [
            { root: 'C', quality: 'maj', beats: 4, inversion: 0, drop: 0, octave: 3, instrument: 'piano' },
            { root: 'C', quality: 'maj', beats: 4, inversion: 0, drop: 0, octave: 3, instrument: 'piano' },
            { root: 'C', quality: 'maj', beats: 4, inversion: 0, drop: 0, octave: 3, instrument: 'piano' },
            { root: 'F', quality: 'maj', beats: 4, inversion: 0, drop: 0, octave: 3, instrument: 'piano' },
        ] }];
        const bytes = app.buildMidiFile(sections);
        const avant = (() => { saveProgressionSections(sections); app.loadProgression(); return window._notesJouees(); })();
        localStorage.clear();
        app.loadProgression();
        const rapport = app.importMidiChords(bytes, 'fusion.mid');
        return { avant, apres: window._notesJouees(), grille: window._grille(), rapport };
    });
    check(JSON.stringify(fusion.grille[0].accords) === JSON.stringify(['C:12', 'F:4']),
        `trois mesures de do identiques se fondent en un seul accord de 12 temps — obtenu ${JSON.stringify(fusion.grille[0].accords)}`);
    check(JSON.stringify(fusion.avant) === JSON.stringify(fusion.apres),
        `...et la fusion ne change RIEN à ce qu'on entend — ${fusion.apres.length} notes des deux côtés`);

    // --- Un morceau existant n'est jamais écrasé ---
    const preserve = await page.evaluate((b64) => {
        const app = window.app;
        localStorage.clear();
        saveProgressionSections([{ title: 'Mon morceau', chords: [
            { root: 'D', quality: 'min', beats: 4, inversion: 0, drop: 0, octave: 3, instrument: 'piano' },
        ] }]);
        document.getElementById('bpm').value = '84';
        app.loadProgression();
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        app.importMidiChords(bytes, 'ajout.mid');
        return { grille: window._grille(), bpm: document.getElementById('bpm').value };
    }, b64);
    check(preserve.grille.length === 2 && preserve.grille[0].titre === 'Mon morceau'
        && JSON.stringify(preserve.grille[0].accords) === JSON.stringify(['Dm:4']),
        `l'import s'AJOUTE et ne touche pas au morceau en cours — obtenu ${JSON.stringify(preserve.grille)}`);
    check(preserve.bpm === '84',
        `...et ne déègle pas non plus son tempo (le fichier était à 120) — obtenu ${preserve.bpm}`);

    // --- Un fichier illisible le dit, au lieu de ne rien faire ---
    const cassePath = path.join(TMP, 'pas-un-midi.mid');
    fs.writeFileSync(cassePath, Buffer.from('ceci n\'est pas un fichier MIDI du tout', 'utf8'));
    const avantCasse = await page.evaluate(() => window._grille());
    await page.setInputFiles('#import-midi-input', cassePath);
    await page.waitForTimeout(700);
    const casse = await page.evaluate(() => ({
        toast: (document.getElementById('toast') || {}).textContent || '',
        grille: window._grille(),
    }));
    check(/impossible/i.test(casse.toast) && /MThd|MIDI/.test(casse.toast),
        `un fichier qui n'est pas un MIDI est refusé avec une explication — « ${casse.toast} »`);
    check(JSON.stringify(casse.grille) === JSON.stringify(avantCasse),
        'un import refusé ne laisse aucune trace dans la grille');

    // --- Deux fois le même fichier d'affilée : le second import doit marcher aussi ---
    await page.evaluate(() => { localStorage.clear(); window.app.loadProgression(); });
    await page.setInputFiles('#import-midi-input', midiPath);
    await page.waitForTimeout(700);
    await page.setInputFiles('#import-midi-input', midiPath);
    await page.waitForTimeout(700);
    const deuxFois = await page.evaluate(() => window._grille());
    check(deuxFois.length === 2,
        `réimporter le MÊME fichier fonctionne une deuxième fois — obtenu ${deuxFois.length} partie(s)`);

    // --- Mélodie : les cases « à nommer » arrivent bien jusqu'à la grille ---
    const melodiePath = path.join(TMP, 'melodie.mid');
    const melB64 = await page.evaluate(() => {
        // Deux mesures : un do plaqué, puis une gamme montante (mélodie pure).
        const trk = [];
        let prev = 0;
        const ev = [];
        [60, 64, 67].forEach(m => { ev.push({ t: 0, b: [0x90, m, 100] }); ev.push({ t: 1920, b: [0x80, m, 0] }); });
        [60, 62, 64, 65, 67, 69, 71, 72].forEach((m, i) => {
            ev.push({ t: 1920 + i * 240, b: [0x90, m, 100] });
            ev.push({ t: 1920 + i * 240 + 240, b: [0x80, m, 0] });
        });
        ev.push({ t: 0, b: [0xff, 0x58, 0x04, 4, 2, 24, 8] });
        ev.sort((a, b) => a.t - b.t);
        ev.forEach(e => { trk.push(...midiVarLen(e.t - prev), ...e.b); prev = e.t; });
        trk.push(0, 0xff, 0x2f, 0x00);
        const bytes = [0x4d,0x54,0x68,0x64,0,0,0,6,0,0,0,1,0x01,0xe0, 0x4d,0x54,0x72,0x6b, ...midiU32(trk.length), ...trk];
        let s = '';
        for (const b of bytes) s += String.fromCharCode(b);
        return btoa(s);
    });
    fs.writeFileSync(melodiePath, Buffer.from(melB64, 'base64'));
    await page.evaluate(() => { localStorage.clear(); window.app.loadProgression(); });
    await page.setInputFiles('#import-midi-input', melodiePath);
    await page.waitForTimeout(900);
    const mel = await page.evaluate(() => ({
        grille: window._grille(),
        notes: window._notesJouees(),
        cellules: [...document.querySelectorAll('.grid-cell[data-index]')].map(c => ({
            texte: c.querySelector('.cell-sym').textContent.trim(),
            marquee: c.classList.contains('cell-unnamed'),
        })),
        toast: (document.getElementById('toast') || {}).textContent || '',
    }));
    console.log('  mélodie :', JSON.stringify(mel.grille), '|', mel.toast);
    check(JSON.stringify(mel.grille[0].accords) === JSON.stringify(['C:4', 'à nommer:4']),
        `l'accord est nommé, la mélodie non — obtenu ${JSON.stringify(mel.grille[0].accords)}`);
    check(mel.cellules.length === 2 && mel.cellules[1].texte === 'à nommer' && mel.cellules[1].marquee,
        `la case « à nommer » est bien marquée dans la grille — obtenu ${JSON.stringify(mel.cellules)}`);
    check(/1 à nommer/.test(mel.toast), `le compte rendu dit combien de cases restent à nommer — « ${mel.toast} »`);
    // Les huit notes de la gamme doivent s'entendre, en plus des trois de l'accord.
    const gammeAudible = [60, 62, 64, 65, 67, 69, 71, 72].every((m, i) =>
        mel.notes.some(n => n[0] === m && n[1] === 16 + i * 2));
    check(gammeAudible, `les huit notes de la mélodie s'entendent bien à leur place — ${mel.notes.length} notes au total`);

    await page.close();

    // ============================================================
    // === TÉLÉPHONE : le bouton doit être atteignable au doigt ===
    // ============================================================
    const mob = await browser.newPage({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });
    mob.on('pageerror', e => errors.push('pageerror(mobile): ' + e.message));
    await mob.goto(`${BASE}/index.html`);
    await mob.waitForTimeout(700);
    await mob.addScriptTag({ content: READBACK });
    // CONTRAT CHANGÉ, même raison qu'à l'ordinateur : il n'y a plus de rangée de six icônes à faire
    // tenir sur une ligne, mais un bouton « Fichier » et son menu. Le grief que ce bloc portait —
    // « 26px, c'est petit au doigt, mais c'est la taille de la rangée » — est justement ce que le
    // menu règle : on ne vise plus qu'une seule cible, puis des lignes pleine largeur.
    await mob.evaluate(() => document.getElementById('file-menu-btn').scrollIntoView({ block: 'center' }));
    await mob.waitForTimeout(200);
    await mob.tap('#file-menu-btn');
    await mob.waitForTimeout(300);
    const mobBtn = await mob.evaluate(() => {
        const menu = document.getElementById('file-menu');
        const b = menu.querySelector('[data-file-action="import-midi"]');
        const r = b.getBoundingClientRect();
        const lignes = [...menu.querySelectorAll('button')].map(l => l.getBoundingClientRect());
        const m = menu.getBoundingClientRect();
        return {
            taille: [Math.round(r.width), Math.round(r.height)],
            dansEcran: r.left >= 0 && r.right <= window.innerWidth,
            menuDansEcran: m.left >= 0 && m.right <= window.innerWidth && m.top >= 0,
            plusPetiteLigne: Math.round(Math.min(...lignes.map(x => x.height))),
            declencheurDansEcran: (() => {
                const d = document.getElementById('file-menu-btn').getBoundingClientRect();
                return d.left >= 0 && d.right <= window.innerWidth;
            })(),
        };
    });
    check(mobBtn.plusPetiteLigne >= 40,
        `au doigt, chaque ligne du menu est une vraie cible — la plus petite fait ${mobBtn.plusPetiteLigne}px de haut`);
    check(mobBtn.dansEcran && mobBtn.menuDansEcran, 'ni l\'entrée ni le menu ne débordent de l\'écran du téléphone');
    check(mobBtn.declencheurDansEcran,
        'et le bouton Fichier qui l\'ouvre tient largement dans la largeur, là où six icônes se serraient');
    await mob.keyboard.press('Escape');
    await mob.waitForTimeout(200);

    await mob.setInputFiles('#import-midi-input', midiPath);
    await mob.waitForTimeout(900);
    const mobGrille = await mob.evaluate(() => window._grille());
    check(mobGrille[0] && mobGrille[0].accords.length === 4,
        `et l'import fonctionne à l'identique sur téléphone — obtenu ${JSON.stringify(mobGrille[0] && mobGrille[0].accords)}`);
    await mob.close();

    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 || errors.length > 0 ? 1 : 0);
})();
