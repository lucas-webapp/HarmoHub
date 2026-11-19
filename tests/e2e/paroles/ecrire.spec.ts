// MODULE « paroles » — ouvrir l'onglet, écrire les paroles, les retrouver.
// Une carte par partie (titre, mesures, ×N, accords de la partie, zone de texte) ; le texte s'enregistre tout seul (clé `harmohub_lyrics_v1_id-<morceau>`).
import { test, expect } from '../support/fixtures';
import {
  morceauParoles, DEUX_PARTIES, UNE_PARTIE, ouvrirParoles, retourGrille, ongletParoles, ongletGrille, regionParoles, cadre, cartes, carte, zoneTexte, reserve,
  ecrire, focaliser, texteSaisi, invite, nommer, parolesStockees, attendreStockage, sansTags, voyantEnregistre, appuyer, estMobile,
} from './aide-paroles';

const INVITE = 'Clique ici pour écrire les paroles de cette partie…';

test.describe('Ouvrir l\'onglet Paroles @paroles', () => {
  test('« Paroles » ouvre la page des paroles : une carte par partie avec son titre, ses mesures et ses accords dans l\'ordre de la grille @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli(morceauParoles(DEUX_PARTIES));
    await expect(regionParoles(page)).toBeHidden();
    await appuyer(page, ongletParoles(page));
    await expect(ongletParoles(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(ongletGrille(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(regionParoles(page)).toBeVisible();
    await expect(cartes(page)).toHaveCount(2);
    await expect(carte(page, 0)).toContainText(/couplet/i);
    await expect(carte(page, 0)).toContainText('4 mesures');
    await expect(carte(page, 1)).toContainText(/refrain/i);
    await expect(carte(page, 1)).toContainText('2 mesures');
    await expect(reserve(page, 0)).toHaveText(['C', 'Am', 'F', 'G']);
    await expect(reserve(page, 1)).toHaveText(['F', 'G']);
    expect(garde.bloquees).toEqual([]);
  });

  test('chaque partie vide propose d\'écrire, sans accord posé ni accord armé', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(DEUX_PARTIES));
    await ouvrirParoles(page);
    expect(await invite(page, 0)).toBe(INVITE);
    expect(await invite(page, 1)).toBe(INVITE);
    await expect(cadre(page).locator('.lyric-pill')).toHaveCount(0);
    await expect(cadre(page).locator('.chord-chip.armed')).toHaveCount(0);
    await expect(cadre(page).getByRole('button', { name: 'Arrêter' })).toBeHidden();
  });

  test('« Grille » revient à la grille et « Paroles » rouvre la page', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await retourGrille(page);
    await expect(ongletGrille(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#progression-sections .grid-cell[data-index]').first()).toBeVisible();
    await ouvrirParoles(page);
    await expect(ongletParoles(page)).toHaveAttribute('aria-pressed', 'true');
  });

  test('un morceau sans nom propose de le nommer ; une fois nommé, la page des paroles s\'ouvre sans erreur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli();
    const erreurs: string[] = [];
    page.on('pageerror', e => erreurs.push(e.message));
    await appuyer(page, ongletParoles(page));
    await expect(page.getByText('Donne un nom à ton morceau pour écrire ses paroles : elles lui sont attachées.')).toBeVisible();
    await expect(regionParoles(page).locator('iframe')).toBeHidden();
    await appuyer(page, nommer(page));
    await page.keyboard.type('Mon essai');
    await page.keyboard.press('Enter');
    await expect(regionParoles(page).locator('iframe')).toBeVisible();
    await expect(page.getByText('Donne un nom à ton morceau')).toBeHidden();
    await expect(cartes(page)).toHaveCount(1);
    await ecrire(page, 0, 'Première phrase');
    await attendreStockage(page, p => p.sections[0].lyricsHtml, 'Première phrase');
    expect(erreurs).toEqual([]);
  });

  test('le bouton « Nommer le morceau » est assez large pour son libellé @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli();
    await appuyer(page, ongletParoles(page));
    await expect(nommer(page)).toBeVisible();
    const { boite, texte } = await nommer(page).evaluate(e => {
      const r = document.createRange(); r.selectNodeContents(e);
      return { boite: e.getBoundingClientRect().width, texte: r.getBoundingClientRect().width };
    });
    expect(boite).toBeGreaterThanOrEqual(texte);
  });
});

test.describe('Écrire les paroles @paroles', () => {
  test('on clique dans la zone, on tape : le texte s\'affiche, l\'invite disparaît et « Enregistré » le confirme @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli(morceauParoles(DEUX_PARTIES));
    await ouvrirParoles(page);
    await ecrire(page, 0, 'Dans la nuit');
    await expect(zoneTexte(page, 0)).toHaveText('Dans la nuit');
    expect(await invite(page, 0)).toBe('');   // l'invite s'efface dès qu'il y a du texte…
    expect(await invite(page, 1)).toBe(INVITE);   // …et la partie 2, vide, la garde
    await expect(voyantEnregistre(page)).toHaveText(/^Enregistré ✓ \d{2}:\d{2}$/);
    await attendreStockage(page, p => p.sections.map(s => s.lyricsHtml), ['Dans la nuit', '']);
    expect(garde.bloquees).toEqual([]);
  });

  test('Entrée passe à la ligne : le texte garde ses lignes, dans l\'écran et dans le stockage', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await ecrire(page, 0, 'Premier vers\nDeuxième vers\nTroisième vers');
    expect(await texteSaisi(page)).toBe('Premier vers\nDeuxième vers\nTroisième vers');
    await attendreStockage(page, p => sansTags(p.sections[0].lyricsHtml), 'Premier vers\nDeuxième vers\nTroisième vers');
  });

  test('chaque partie a ses propres paroles : écrire dans l\'une ne touche pas l\'autre @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(DEUX_PARTIES));
    await ouvrirParoles(page);
    await ecrire(page, 1, 'Refrain qui revient');
    await ecrire(page, 0, 'Couplet un');
    await expect(zoneTexte(page, 0)).toHaveText('Couplet un');
    await expect(zoneTexte(page, 1)).toHaveText('Refrain qui revient');
    await attendreStockage(page, p => p.sections.map(s => s.lyricsHtml), ['Couplet un', 'Refrain qui revient']);
  });

  test('les paroles sont retrouvées après un rechargement de l\'appli @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(DEUX_PARTIES));
    await ouvrirParoles(page);
    await ecrire(page, 0, 'Premier vers\nSecond vers');
    await ecrire(page, 1, 'Refrain');
    await attendreStockage(page, p => p.sections.map(s => sansTags(s.lyricsHtml)), ['Premier vers\nSecond vers', 'Refrain']);
    await page.reload();
    await ouvrirParoles(page);
    expect(await texteSaisi(page, 0)).toBe('Premier vers\nSecond vers');
    expect(await texteSaisi(page, 1)).toBe('Refrain');
  });

  test('les paroles survivent à un aller-retour Grille / Paroles', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await ecrire(page, 0, 'Je reviens tout de suite');
    await retourGrille(page);
    await ouvrirParoles(page);
    await expect(zoneTexte(page, 0)).toHaveText('Je reviens tout de suite');
  });

  test('accents, guillemets, symboles et écritures non latines sont gardés tels quels après rechargement', async ({ ouvrirAppli }) => {
    const texte = 'Été, ça brûle — « oui » ♪ 日本語 ñ';
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await ecrire(page, 0, texte);
    await attendreStockage(page, p => sansTags(p.sections[0].lyricsHtml), texte);
    await page.reload();
    await ouvrirParoles(page);
    expect(await texteSaisi(page)).toBe(texte);
  });

  test('un caractère HTML tapé (« <b>gras</b> & co ») reste du texte, il n\'est pas interprété', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await ecrire(page, 0, '<b>gras</b> & co');
    await attendreStockage(page, p => sansTags(p.sections[0].lyricsHtml), '&lt;b&gt;gras&lt;/b&gt; &amp; co');
    await expect(zoneTexte(page, 0).locator('b')).toHaveCount(0);
    await page.reload();
    await ouvrirParoles(page);
    expect(await texteSaisi(page)).toBe('<b>gras</b> & co');
    await expect(zoneTexte(page, 0).locator('b')).toHaveCount(0);
  });

  test('un texte collé est du texte brut : lignes séparées, aucune mise en forme @ordinateur', async ({ ouvrirAppli }) => {
    test.skip(test.info().project.name === 'firefox', 'Firefox ignore un évènement `paste` fabriqué par un script (évènement non fiable) et le presse-papiers réel n\'est pas pilotable : couvert sur Chromium, Edge, WebKit et iPad');
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await focaliser(page, 0);
    // Collage simulé : le presse-papiers réel n'est pas lisible partout (Firefox, WebKit) ; on envoie l'évènement `paste` avec un contenu riche.
    await zoneTexte(page, 0).evaluate(el => {
      const dt = new DataTransfer();
      dt.setData('text/plain', 'Premier vers\nDeuxième vers\nTroisième vers');
      dt.setData('text/html', '<b style="color:red;font-size:40px">Premier vers</b><br>Deuxième vers');
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    });
    await expect.poll(() => texteSaisi(page)).toBe('Premier vers\nDeuxième vers\nTroisième vers');
    expect(await zoneTexte(page, 0).evaluate(e => !!e.querySelector('b, span, font, [style]'))).toBe(false);
  });

  test('un long texte passe à la ligne dans la carte sans faire défiler la page de côté', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    const long = Array.from({ length: 40 }, (_, i) => `mot${i}`).join(' ');
    await ecrire(page, 0, long);
    await expect(zoneTexte(page, 0)).toContainText('mot39');
    const decalage = await cadre(page).locator('html').evaluate(e => e.scrollWidth - e.clientWidth);
    expect(decalage).toBeLessThanOrEqual(1);
    const carteBox = (await carte(page, 0).boundingBox())!, zoneBox = (await zoneTexte(page, 0).boundingBox())!;
    expect(zoneBox.x + zoneBox.width).toBeLessThanOrEqual(carteBox.x + carteBox.width + 1);
    // le texte a besoin de plusieurs lignes : la zone est plus haute qu'une ligne
    expect(zoneBox.height).toBeGreaterThan(40);
  });

  test('au téléphone : écrire au doigt, enregistré, retrouvé après rechargement @mobile @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(DEUX_PARTIES));
    expect(estMobile(page)).toBe(true);
    await ouvrirParoles(page);
    await ecrire(page, 0, 'Au creux de la nuit');
    await expect(zoneTexte(page, 0)).toHaveText('Au creux de la nuit');
    await attendreStockage(page, p => p.sections[0].lyricsHtml, 'Au creux de la nuit');
    await page.reload();
    await ouvrirParoles(page);
    await expect(zoneTexte(page, 0)).toHaveText('Au creux de la nuit');
    expect((await parolesStockees(page))!.sections[1].lyricsHtml).toBe('');
  });
});
