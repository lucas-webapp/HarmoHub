const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ acceptDownloads: true });
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        const mk = (root, quality, beats) => ({ root, quality, beats, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held', instrument: 'piano', arpPattern: '', seqEdited: false, guitarLock: null, extraNotes: [], intensity: 75, intensityPerStep: {} });
        const sections = [
            { title: 'Couplet', chords: [mk('C', 'maj', 4)] },
            { title: '', chords: [mk('G', 'maj', 4)] },
            { title: 'Refrain', chords: [mk('A', 'min', 4)] },
        ];
        localStorage.setItem('myProgression', JSON.stringify({ sections }));
        localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 'song1', name: 'Ma Chanson', savedAt: 1, sections }]));
        localStorage.setItem('harmohubCurrentSongId', 'song1');
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);

    const downloads = [];
    page.on('download', (d) => downloads.push(d.suggestedFilename()));
    // Accolades, PAS un retour implicite : exportMidi() rend une promesse qui n'est tenue qu'une
    // fois le choix fait dans la fenêtre « par partie / en un seul fichier ». En la RENVOYANT, le
    // test la faisait attendre par page.evaluate — et le clic qui devait la dénouer se trouvait à la
    // ligne suivante, jamais atteinte. Interblocage : le test tournait jusqu'à sa limite de temps.
    await page.evaluate(() => { window.app.exportMidi(); });
    await page.waitForTimeout(150);
    await page.click('#midi-export-persection');
    await page.waitForTimeout(1200);
    console.log('Downloads:', JSON.stringify(downloads));
    // Les noms suivent la règle unique de fichiers.js : « Appli - Morceau - Type - Date Heure.ext »,
    // le type portant ici le nom de la PARTIE. On éprouve la RÈGLE, pas une chaîne figée : écrire la
    // date en dur condamnerait ce banc à devenir faux le lendemain.
    const attendus = ['MIDI Couplet', 'MIDI Partie 2', 'MIDI Refrain'];
    const conforme = downloads.length === 3 && downloads.every((nom, i) =>
        new RegExp(`^HarmoHub - Ma Chanson - ${attendus[i]} - \\d{4}-\\d{2}-\\d{2} \\d{4}\\.mid$`).test(nom));
    console.log(conforme ? 'PASS (3 correctly named per-section files)' : 'FAIL - ' + JSON.stringify(downloads));
    await browser.close();
})();
