// Import MIDI, étape 1 : le parseur SMF.
// Épreuve principale = ALLER-RETOUR sur l'encodeur de l'appli : on exporte un morceau connu avec
// buildMidiFile, on le relit avec parseMidiFile, et on vérifie qu'on retrouve exactement les notes
// que le séquenceur joue. C'est le test le plus sévère disponible sans fichier de référence externe,
// et il se re-vérifie tout seul si l'export change un jour.
// Épreuves secondaires = cas tordus construits à la main (running status, note-on vélocité 0, tempo,
// chunk inconnu, fichier tronqué, SMPTE) : GarageBand en produit certains, et un fichier abîmé doit
// donner un message clair, pas une grille d'accords absurde.
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
    await page.waitForTimeout(700);

    // ============================================================
    // === A. Aller-retour : ce qu'on exporte, on le relit à l'identique ===
    // ============================================================
    const roundTrip = await page.evaluate(() => {
        const app = window.app;
        // Un morceau volontairement varié : un accord tenu, un accord rythmé, un accord de 2 temps.
        const sections = [{
            title: 'Test',
            chords: [
                { root: 'C', quality: 'maj', beats: 4, inversion: 0, drop: 0, octave: 3, instrument: 'piano' },
                { root: 'A', quality: 'min7', beats: 4, inversion: 0, drop: 0, octave: 3, instrument: 'piano' },
                { root: 'F', quality: 'maj', beats: 2, inversion: 0, drop: 0, octave: 3, instrument: 'piano' },
            ],
        }];
        const bytes = app.buildMidiFile(sections);
        const parsed = parseMidiFile(bytes);

        // Vérité de référence : les mêmes notes, calculées côté séquenceur comme le fait l'export.
        const ticksPerStep = MIDI_PPQ / SEQ_STEPS_PER_BEAT;
        const expected = [];
        let tick = 0;
        sections[0].chords.forEach(data => {
            const chord = new Chord(data.root, data.quality, data.beats, data.inversion, data.drop, data.octave, data.bass, null, data.extraNotes);
            const midis = chord.getSeqMidiNotes();
            const { pattern, tie } = app.resolveSeqPatternForData(chord, data);
            const steps = pattern.length;
            for (let voice = 0; voice < midis.length; voice++) {
                let s = 0;
                while (s < steps) {
                    if (!pattern[s].includes(voice)) { s++; continue; }
                    const runStart = s;
                    s++;
                    while (s < steps && pattern[s].includes(voice) && tie[s].includes(voice)) s++;
                    expected.push({ midi: midis[voice], startTicks: tick + runStart * ticksPerStep });
                }
            }
            tick += data.beats * MIDI_PPQ;
        });
        expected.sort((a, b) => (a.startTicks - b.startTicks) || (a.midi - b.midi));

        return {
            format: parsed.format,
            ticksPerQuarter: parsed.ticksPerQuarter,
            bpm: parsed.tempoMap.length ? Math.round(parsed.tempoMap[0].bpm) : null,
            uiBpm: parseInt(document.getElementById('bpm').value) || 120,
            timeSig: parsed.timeSignatures[0] || null,
            uiTimeSig: document.getElementById('time-sig').value,
            got: parsed.notes.map(n => ({ midi: n.midi, startTicks: n.startTicks, dur: n.endTicks - n.startTicks })),
            expected,
            endTicks: parsed.endTicks,
            totalBeats: 10,
            trackNames: parsed.trackNames.map(t => t.name),
            allVelocitiesValid: parsed.notes.every(n => n.velocity > 0 && n.velocity <= 127),
            allDurationsPositive: parsed.notes.every(n => n.endTicks > n.startTicks),
        };
    });

    check(roundTrip.format === 1, `le format lu est bien celui écrit (1, multipiste) — obtenu ${roundTrip.format}`);
    check(roundTrip.ticksPerQuarter === 480, `la division lue est bien MIDI_PPQ — obtenu ${roundTrip.ticksPerQuarter}`);
    check(roundTrip.bpm === roundTrip.uiBpm, `le tempo relu correspond à celui du morceau — ${roundTrip.bpm} vs ${roundTrip.uiBpm}`);
    const [n, d] = roundTrip.uiTimeSig.split('/').map(Number);
    check(roundTrip.timeSig && roundTrip.timeSig.numerator === n && roundTrip.timeSig.denominator === d,
        `la mesure relue correspond (${roundTrip.uiTimeSig}) — obtenu ${JSON.stringify(roundTrip.timeSig)}`);
    check(roundTrip.got.length === roundTrip.expected.length,
        `on relit EXACTEMENT autant de notes qu'on en a écrit — ${roundTrip.got.length} vs ${roundTrip.expected.length}`);
    const sameNotes = roundTrip.got.length === roundTrip.expected.length
        && roundTrip.got.every((g, i) => g.midi === roundTrip.expected[i].midi && g.startTicks === roundTrip.expected[i].startTicks);
    check(sameNotes, 'chaque note relue a la MÊME hauteur et le MÊME instant d\'attaque que celle écrite');
    if (!sameNotes) {
        console.log('  attendu[0..5]:', JSON.stringify(roundTrip.expected.slice(0, 6)));
        console.log('  obtenu[0..5]:', JSON.stringify(roundTrip.got.slice(0, 6)));
    }
    check(roundTrip.allDurationsPositive, 'aucune note relue n\'a une durée nulle ou négative (appariement note-on/note-off correct)');
    check(roundTrip.allVelocitiesValid, 'toutes les vélocités relues sont dans la plage MIDI valide');
    check(roundTrip.endTicks <= roundTrip.totalBeats * 480 && roundTrip.endTicks > 9 * 480,
        `la fin du morceau tombe bien au bout des 10 temps écrits — obtenu ${roundTrip.endTicks} ticks`);
    check(roundTrip.trackNames.includes('Piano acoustique') || roundTrip.trackNames.length >= 2,
        `les noms de pistes sont relus — obtenu ${JSON.stringify(roundTrip.trackNames)}`);

    // ============================================================
    // === B. Running status + note-on vélocité 0 (ce que produit réellement un DAW) ===
    // ============================================================
    // Fichier écrit à la main : une SEULE fois l'octet de status 0x90, puis 3 messages qui l'omettent.
    // Les relâchements sont des note-on de vélocité 0 — c'est justement ce que le running status
    // permet, et donc ce que la plupart des fichiers réels contiennent.
    const compact = await page.evaluate(() => {
        const trk = [
            0x00, 0x90, 60, 100,   // note-on do (status explicite)
            0x00, 64, 100,         // note-on mi   (running status)
            0x60, 60, 0,           // note-off do  (vélocité 0, running status)
            0x00, 64, 0,           // note-off mi
            0x00, 0xff, 0x2f, 0x00,
        ];
        const bytes = [
            0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0x01, 0xe0, // MThd, format 0, 1 piste, 480
            0x4d, 0x54, 0x72, 0x6b, ...midiU32(trk.length), ...trk,
        ];
        const p = parseMidiFile(new Uint8Array(bytes));
        return p.notes.map(x => ({ midi: x.midi, start: x.startTicks, end: x.endTicks, vel: x.velocity }));
    });
    check(compact.length === 2, `le running status est bien suivi : 2 notes lues, pas plus — obtenu ${compact.length}`);
    check(compact.every(x => x.vel === 100), 'les note-off de vélocité 0 ne sont PAS pris pour des attaques');
    check(compact[0] && compact[0].midi === 60 && compact[0].end - compact[0].start === 0x60,
        `la durée est bien celle du delta-time (0x60 = 96 ticks) — obtenu ${JSON.stringify(compact[0])}`);
    check(compact[1] && compact[1].midi === 64 && compact[1].start === 0,
        `la 2e note, écrite sans octet de status, garde son instant et sa hauteur — obtenu ${JSON.stringify(compact[1])}`);

    // ============================================================
    // === C. Même hauteur rejouée avant d'être relâchée (les note-off s'apparient dans l'ordre) ===
    // ============================================================
    const overlap = await page.evaluate(() => {
        const trk = [
            0x00, 0x90, 60, 100,   // 1re attaque du do, à 0
            0x30, 0x90, 60, 90,    // 2e attaque du MÊME do, à 48, avant tout relâchement
            0x30, 0x80, 60, 0,     // 1er note-off à 96 -> ferme la PLUS ANCIENNE
            0x30, 0x80, 60, 0,     // 2e note-off à 144 -> ferme la seconde
            0x00, 0xff, 0x2f, 0x00,
        ];
        const bytes = [0x4d,0x54,0x68,0x64,0,0,0,6,0,0,0,1,0x01,0xe0, 0x4d,0x54,0x72,0x6b, ...midiU32(trk.length), ...trk];
        return parseMidiFile(new Uint8Array(bytes)).notes.map(x => ({ start: x.startTicks, end: x.endTicks }));
    });
    check(overlap.length === 2, `deux attaques superposées sur la même hauteur donnent bien 2 notes — obtenu ${overlap.length}`);
    check(JSON.stringify(overlap) === JSON.stringify([{ start: 0, end: 96 }, { start: 48, end: 144 }]),
        `chaque note garde sa propre durée (appariement dans l'ordre d'arrivée) — obtenu ${JSON.stringify(overlap)}`);

    // ============================================================
    // === D. Ce qu'on doit savoir ignorer, et ce qu'on doit savoir refuser ===
    // ============================================================
    const robustness = await page.evaluate(() => {
        const mk = (trkBytes, extraChunks = [], head = [0,0, 0,1, 0x01,0xe0]) => new Uint8Array([
            0x4d,0x54,0x68,0x64, 0,0,0,6, ...head,
            ...extraChunks,
            0x4d,0x54,0x72,0x6b, ...midiU32(trkBytes.length), ...trkBytes,
        ]);
        const simple = [0x00, 0x90, 60, 100, 0x40, 0x80, 60, 0, 0x00, 0xff, 0x2f, 0x00];
        const err = (fn) => { try { fn(); return null; } catch (e) { return e instanceof MidiParseError ? e.message : 'AUTRE: ' + e.message; } };

        // Chunk d'un type inconnu ("XFIR", ce que certains logiciels ajoutent) placé AVANT la piste.
        const unknown = [0x58,0x46,0x49,0x52, ...midiU32(4), 1, 2, 3, 4];
        const withUnknown = parseMidiFile(mk(simple, unknown));

        // SysEx au milieu de la piste : à sauter sans décaler l'horloge ni casser le running status.
        const withSysex = parseMidiFile(mk([
            0x00, 0xf0, 0x03, 0x7e, 0x7f, 0xf7,
            0x00, 0x90, 60, 100, 0x40, 0x80, 60, 0, 0x00, 0xff, 0x2f, 0x00,
        ]));

        // Contrôleurs et changement de programme (1 seul octet de donnée) : la longueur doit être
        // correcte, sinon toute la suite de la piste est décalée d'un octet.
        const withCtrl = parseMidiFile(mk([
            0x00, 0xb0, 0x07, 100,   // volume (2 octets)
            0x00, 0xc0, 0x04,        // program change (1 SEUL octet)
            0x00, 0x90, 60, 100, 0x40, 0x80, 60, 0, 0x00, 0xff, 0x2f, 0x00,
        ]));

        // Piste dont le note-off manque : la note doit être fermée à la fin de piste, pas jetée.
        const unclosed = parseMidiFile(mk([0x00, 0x90, 60, 100, 0x40, 0xff, 0x2f, 0x00]));

        // Changement de tempo en cours de route : les deux doivent être relevés, dans l'ordre.
        const tempoed = parseMidiFile(mk([
            0x00, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20,  // 500000 us = 120 bpm
            0x00, 0x90, 60, 100,
            0x40, 0xff, 0x51, 0x03, 0x05, 0x16, 0x15,  // 333333 us = 180 bpm
            0x00, 0x80, 60, 0, 0x00, 0xff, 0x2f, 0x00,
        ]));

        return {
            unknownChunkNotes: withUnknown.notes.length,
            sysexNotes: withSysex.notes.length,
            sysexStart: withSysex.notes[0] && withSysex.notes[0].startTicks,
            ctrlNotes: withCtrl.notes.map(x => ({ midi: x.midi, start: x.startTicks })),
            unclosed: unclosed.notes.map(x => ({ start: x.startTicks, end: x.endTicks })),
            tempos: tempoed.tempoMap.map(t => ({ tick: t.tick, bpm: Math.round(t.bpm) })),
            // Quelques octets de bourrage APRÈS une piste complète (trop courts pour un en-tête de
            // chunk) : tolérés, le morceau se lit quand même.
            paddingTolerated: parseMidiFile(new Uint8Array([...mk(simple), 0, 0, 0])).notes.length,

            errNotMidi: err(() => parseMidiFile(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]))),
            // Coupé DANS les données de la piste : le chunk annonce plus d'octets qu'il n'en reste.
            errTruncated: err(() => parseMidiFile(mk(simple).slice(0, 24))),
            // Coupé au beau milieu d'un message, sans que la longueur annoncée ne mente : c'est le
            // curseur de lecture lui-même qui doit s'en apercevoir.
            errCutMidEvent: err(() => parseMidiFile(mk([0x00, 0x90, 60]))),
            errSmpte: err(() => parseMidiFile(mk(simple, [], [0, 0, 0, 1, 0xe8, 0x28]))), // division SMPTE
            errFormat2: err(() => parseMidiFile(mk(simple, [], [0, 2, 0, 1, 0x01, 0xe0]))),
            errEmpty: err(() => parseMidiFile(mk([0x00, 0xff, 0x2f, 0x00]))),
        };
    });
    check(robustness.unknownChunkNotes === 1, `un chunk de type inconnu est sauté sans gêner la lecture — ${robustness.unknownChunkNotes} note(s)`);
    check(robustness.sysexNotes === 1 && robustness.sysexStart === 0,
        `un SysEx est sauté sans décaler l'horloge — obtenu ${JSON.stringify(robustness)}`.slice(0, 160));
    check(JSON.stringify(robustness.ctrlNotes) === JSON.stringify([{ midi: 60, start: 0 }]),
        `un program change (1 octet) ne décale pas la suite de la piste — obtenu ${JSON.stringify(robustness.ctrlNotes)}`);
    check(JSON.stringify(robustness.unclosed) === JSON.stringify([{ start: 0, end: 64 }]),
        `une note sans relâchement est fermée à la fin de piste, pas jetée — obtenu ${JSON.stringify(robustness.unclosed)}`);
    check(JSON.stringify(robustness.tempos) === JSON.stringify([{ tick: 0, bpm: 120 }, { tick: 64, bpm: 180 }]),
        `les changements de tempo sont relevés dans l'ordre — obtenu ${JSON.stringify(robustness.tempos)}`);
    check(robustness.errNotMidi && robustness.errNotMidi.includes('MThd'),
        `un fichier qui n'est pas un MIDI est refusé avec un message clair — obtenu « ${robustness.errNotMidi} »`);
    check(robustness.paddingTolerated === 1,
        `quelques octets de bourrage en fin de fichier ne l'empêchent pas de se lire — ${robustness.paddingTolerated} note(s)`);
    check(robustness.errTruncated && robustness.errTruncated.startsWith('fichier MIDI tronqué'),
        `un fichier coupé dans une piste est refusé plutôt qu'importé à moitié en silence — obtenu « ${robustness.errTruncated} »`);
    check(robustness.errCutMidEvent && robustness.errCutMidEvent.startsWith('fichier MIDI tronqué'),
        `...même quand la coupure tombe au milieu d'un message — obtenu « ${robustness.errCutMidEvent} »`);
    check(robustness.errSmpte && robustness.errSmpte.includes('SMPTE'),
        `une division SMPTE est refusée explicitement plutôt que mal interprétée — obtenu « ${robustness.errSmpte} »`);
    check(robustness.errFormat2 && robustness.errFormat2.includes('format 2'),
        `le format 2 est refusé plutôt que fusionné à tort — obtenu « ${robustness.errFormat2} »`);
    check(robustness.errEmpty && robustness.errEmpty.includes('aucune note'),
        `un fichier sans la moindre note est refusé explicitement — obtenu « ${robustness.errEmpty} »`);

    // ============================================================
    // === E. Un fichier multipiste est bien FUSIONNÉ et TRIÉ ===
    // ============================================================
    const merged = await page.evaluate(() => {
        const t1 = [0x40, 0x90, 72, 100, 0x40, 0x80, 72, 0, 0x00, 0xff, 0x2f, 0x00]; // note tardive
        const t2 = [0x00, 0x91, 48, 100, 0x40, 0x81, 48, 0, 0x00, 0xff, 0x2f, 0x00]; // note à 0, canal 1
        const bytes = new Uint8Array([
            0x4d,0x54,0x68,0x64, 0,0,0,6, 0,1, 0,2, 0x01,0xe0,
            0x4d,0x54,0x72,0x6b, ...midiU32(t1.length), ...t1,
            0x4d,0x54,0x72,0x6b, ...midiU32(t2.length), ...t2,
        ]);
        const p = parseMidiFile(bytes);
        return p.notes.map(x => ({ midi: x.midi, start: x.startTicks, track: x.track, channel: x.channel }));
    });
    check(merged.length === 2, `les deux pistes sont fusionnées — obtenu ${merged.length} notes`);
    check(merged[0].start === 0 && merged[1].start === 64,
        `...et triées par instant d'attaque, pas par piste — obtenu ${JSON.stringify(merged)}`);
    check(merged[0].track === 1 && merged[1].track === 0,
        `chaque note garde la trace de sa piste d'origine — obtenu ${JSON.stringify(merged.map(m => m.track))}`);
    check(merged[0].channel === 1 && merged[1].channel === 0,
        `...et de son canal — obtenu ${JSON.stringify(merged.map(m => m.channel))}`);

    console.log('=== Bilan :', PASS, 'PASS /', FAIL, 'FAIL ===');
    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
    process.exit(FAIL > 0 || errors.length > 0 ? 1 : 0);
})();
