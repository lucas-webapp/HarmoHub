const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

(async () => {
    const browser = await chromium.launch({
        args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const page = await browser.newPage({ viewport: { width: 1400, height: 1400 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (msg) => { if (msg.type() === 'error' && !msg.text().includes('ERR_CONNECTION_RESET')) errors.push('console.error: ' + msg.text()); });

    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        const mk = (root, quality, beats) => ({ root, quality, beats, inversion: 0, drop: 'none', octave: 4, bass: null, playStyle: 'held', instrument: 'piano' });
        const sections = [{ title: 'Couplet', chords: [mk('C', 'maj7', 4), mk('G', 'maj', 4), mk('A', 'min7', 4)] }];
        localStorage.setItem('myProgression', JSON.stringify({ sections }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);

    console.log('=== TEST 1 : changement de tempo pendant la lecture de la grille ===');
    await page.evaluate(() => { document.getElementById('bpm').value = '120'; window.app.playProgression(); });
    await page.waitForFunction(() => window.app.isPlaying === true, { timeout: 10000 });
    await page.waitForTimeout(100);
    const before1 = await page.evaluate(() => ({ gen: window.app._playGen, secPerBeat: [...window.app._progChordSlots.values()][0].secPerBeat }));
    await page.evaluate(() => {
        const el = document.getElementById('bpm');
        el.value = '160';
        el.dispatchEvent(new Event('change'));
    });
    await page.waitForTimeout(200);
    const after1 = await page.evaluate(() => ({ gen: window.app._playGen, isPlaying: window.app.isPlaying, secPerBeat: [...window.app._progChordSlots.values()][0].secPerBeat }));
    console.log(JSON.stringify({ before1, after1 }));
    console.log((after1.gen > before1.gen && after1.isPlaying && Math.abs(after1.secPerBeat - 60 / 160) < 1e-6) ? 'PASS (redémarrage auto + nouveau tempo appliqué)' : 'FAIL');
    await page.evaluate(() => window.app.stopAll());

    console.log('=== TEST 2 : changement de groove pendant la lecture ===');
    await page.evaluate(() => { document.getElementById('bpm').value = '120'; window.app.playProgression(); });
    await page.waitForFunction(() => window.app.isPlaying === true, { timeout: 10000 });
    await page.waitForTimeout(100);
    const genBefore2 = await page.evaluate(() => window.app._playGen);
    await page.evaluate(() => {
        const el = document.getElementById('groove');
        el.value = 'shuffle';
        el.dispatchEvent(new Event('change'));
    });
    await page.waitForTimeout(200);
    const after2 = await page.evaluate(() => ({ gen: window.app._playGen, isPlaying: window.app.isPlaying }));
    console.log(JSON.stringify({ genBefore2, after2 }));
    console.log((after2.gen > genBefore2 && after2.isPlaying) ? 'PASS (redémarrage auto sur changement de groove)' : 'FAIL');
    await page.evaluate(() => window.app.stopAll());

    console.log('=== TEST 3 : changement de plage à boucler pendant la lecture ===');
    await page.evaluate(() => { document.getElementById('bpm').value = '120'; window.app.playProgression(); });
    await page.waitForFunction(() => window.app.isPlaying === true, { timeout: 10000 });
    await page.waitForTimeout(100);
    const genBefore3 = await page.evaluate(() => window.app._playGen);
    await page.evaluate(() => { window.app.setLoopRange(0, 1, 0, 2); }); // boucle sur les accords G et Am7 seulement
    await page.waitForTimeout(200);
    const after3 = await page.evaluate(() => ({
        gen: window.app._playGen,
        isPlaying: window.app.isPlaying,
        loop: Tone.Transport.loop,
        slotKeys: [...window.app._progChordSlots.keys()],
    }));
    console.log(JSON.stringify({ genBefore3, after3 }));
    console.log((after3.gen > genBefore3 && after3.isPlaying && after3.loop === true && after3.slotKeys.join(',') === '0:1,0:2') ? 'PASS (lecture relancée en boucle sur la nouvelle plage)' : 'FAIL');
    await page.evaluate(() => window.app.stopAll());

    console.log('=== TEST 4 : intensité multi-sélection pendant la lecture (patch local, pas de redémarrage complet) ===');
    await page.evaluate(() => { document.getElementById('bpm').value = '120'; window.app.playProgression(); });
    await page.waitForFunction(() => window.app.isPlaying === true, { timeout: 10000 });
    await page.waitForTimeout(100);
    await page.evaluate(() => {
        window.app.multiSelect = new Set([0, 1]);
        window.app.activeSection = 0;
    });
    const genBefore4 = await page.evaluate(() => window.app._playGen);
    await page.evaluate(() => { window.app.applyIntensityToSelection(40); });
    await page.waitForTimeout(150);
    const after4 = await page.evaluate(() => {
        const sections = JSON.parse(localStorage.getItem('myProgression')).sections;
        return {
            gen: window.app._playGen,
            isPlaying: window.app.isPlaying,
            intensities: [sections[0].chords[0].intensity, sections[0].chords[1].intensity, sections[0].chords[2].intensity],
        };
    });
    console.log(JSON.stringify({ genBefore4, after4 }));
    console.log((after4.gen === genBefore4 && after4.isPlaying && after4.intensities[0] === 40 && after4.intensities[1] === 40 && after4.intensities[2] !== 40) ? 'PASS (patch local sans redémarrage, intensité appliquée aux 2 sélectionnés seulement)' : 'FAIL');
    await page.evaluate(() => window.app.stopAll());

    console.log('=== TEST 5 : changer le son du morceau pendant la lecture (patch local, pas de redémarrage) ===');
    await page.evaluate(() => { document.getElementById('bpm').value = '120'; window.app.playProgression(); });
    await page.waitForFunction(() => window.app.isPlaying === true, { timeout: 10000 });
    await page.waitForTimeout(100);
    const genBefore5 = await page.evaluate(() => window.app._playGen);
    // LE SON N'EST PLUS RECOPIÉ DANS CHAQUE ACCORD. Ce banc appelait applyInstrumentToSong() et
    // vérifiait que les N accords portaient tous 'epiano'. Le bouton « appliquer à tout » n'existe
    // plus : le son est un réglage UNIQUE du morceau (retour utilisateur : « à définir une fois dans
    // morceau uniquement, et tout le morceau prendra cet instrument »), il n'y a donc plus rien à
    // propager — et plus de champ par accord à relire.
    // Ce que la section éprouve reste le même, et c'est le point : changer le son PENDANT la lecture
    // ne redémarre pas la boucle. On passe par le vrai évènement du sélecteur, pas par une méthode.
    await page.evaluate(() => {
        const s = document.getElementById('instrument');
        s.value = 'epiano';
        s.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(250);
    const after5 = await page.evaluate(() => ({
        gen: window.app._playGen, isPlaying: window.app.isPlaying, son: window.app.songInstrument,
    }));
    console.log(JSON.stringify({ genBefore5, after5 }));
    console.log((after5.gen === genBefore5 && after5.isPlaying && after5.son === 'epiano') ? 'PASS (patch local sans redémarrage, son du morceau appliqué)' : 'FAIL');
    await page.evaluate(() => window.app.stopAll());

    console.log('Errors:', JSON.stringify(errors));
    await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
