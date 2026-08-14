const { chromium } = require('playwright')
const BASE = process.env.HARMOHUB_URL || 'http://localhost:8934';;

(async () => {
    const browser = await chromium.launch({
        args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const page = await browser.newPage();
    await page.goto(`${BASE}/index.html?nocache=` + Date.now(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        const sections = [{ title: 'Couplet', chords: [
            { root: 'C', quality: 'maj7', beats: 16, inversion: 0, drop: 0, octave: 4, bass: null, playStyle: 'held' },
        ]}];
        localStorage.setItem('myProgression', JSON.stringify({ sections }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
        window.app.editChord(0, 0);
        if (!window.app.seqOpen) window.app.toggleSequencer();
    });
    await page.waitForTimeout(150);
    let r = await page.evaluate(() => {
        const label = document.querySelector('#arp-sequencer .seq-page-label');
        return { label: label ? label.textContent : null };
    });
    console.log('default (compact, hZoom=1):', JSON.stringify(r));

    // Le bouton se DÉSACTIVE une fois la butée atteinte : on s'arrête là, au lieu
    // d'attendre 30s qu'un bouton grisé redevienne cliquable.
    for (let i = 0; i < 13; i++) {
        if (await page.evaluate(() => document.getElementById('seq-zoom-out-h-inline').disabled)) break;
        await page.click('#seq-zoom-out-h-inline');
        await page.waitForTimeout(60);
    } // ZOOM levels 1->0.7 in 0.1 steps = 3 clicks needed, extra clicks clamp
    await page.waitForTimeout(100);
    r = await page.evaluate(() => {
        const label = document.querySelector('#arp-sequencer .seq-page-label');
        return { label: label ? label.textContent : null, level: window.app.seqInlineZoomLevelX };
    });
    console.log('after H- to min (compact, should now show MORE bars/page):', JSON.stringify(r));

    await browser.close();
    process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
