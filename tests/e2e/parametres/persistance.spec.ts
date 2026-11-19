// MODULE « parametres » — la persistance : tous les réglages survivent à un rechargement, appartiennent à l'APPAREIL (pas au morceau), repartent des valeurs
// d'usine si le stockage est vidé, et une valeur abîmée ne casse pas l'appli. Ordinateur et téléphone.
import { test, expect } from '../support/fixtures';
import {
  C_AM_F_G, estMobile, appuyer, ouvrir, fermer, deplierAvancees, interrupteur, curseur, liste, choix, NOM, ecouterEnEditant, sonMetronome, reperesDeTemps,
  reglagesStockes, lireEtat, degresAffiches, sortie, mentions,
} from './aide-parametres';
import { bibliotheque, titre, ouvrirMesMorceaux } from '../fichiers/aide-fichiers';

// Un réglage de chaque sorte, à une valeur qui n'est PAS celle d'usine.
// Le réglage « Noms des rythmes » part d'une valeur qui dépend de la largeur de l'écran (allumé au-dessus de 1340 px, éteint en dessous, dit son infobulle) :
// on le met donc à l'OPPOSÉ de ce qu'il vaut au départ, et on rend la valeur choisie.
async function toutChanger(page: import('@playwright/test').Page): Promise<string> {
  await ouvrir(page);
  await deplierAvancees(page);
  await curseur(page, 'Volume général').fill('40');
  await curseur(page, 'Volume du métronome').fill('25');
  await appuyer(page, interrupteur(page, NOM.sonDeplacement));
  await liste(page, 'Rythme des nouveaux accords').selectOption('noire_maintenu');
  await appuyer(page, interrupteur(page, NOM.jouerSelection));
  await appuyer(page, interrupteur(page, NOM.decompte));
  await sonMetronome(page).selectOption({ label: 'Clave' });
  await appuyer(page, ecouterEnEditant(page));
  await appuyer(page, interrupteur(page, NOM.degres));
  const depart = await interrupteur(page, NOM.nomsRythmes).getAttribute('aria-checked');
  await appuyer(page, interrupteur(page, NOM.nomsRythmes));
  const nomsRythmes = depart === 'true' ? 'false' : 'true';
  await curseur(page, 'Barres du séquenceur').fill('34');
  await liste(page, 'Position d\'accord').selectOption({ label: 'Masquée' });
  await appuyer(page, interrupteur(page, NOM.dateModif));
  await appuyer(page, choix(page, 'Touches du piano', 'Notes'));
  await appuyer(page, choix(page, 'Pastilles de la guitare', 'Degrés'));
  await appuyer(page, interrupteur(page, NOM.nomsManche));
  await appuyer(page, interrupteur(page, NOM.fonction));
  await reperesDeTemps(page).selectOption({ label: 'Tous les temps' });
  await appuyer(page, interrupteur(page, NOM.verre));
  await appuyer(page, choix(page, 'Couleur du fond', 'Violet'));
  return nomsRythmes;
}
async function toutVerifier(page: import('@playwright/test').Page, nomsRythmes: string) {
  await expect(curseur(page, 'Volume général')).toHaveValue('40');
  await expect(curseur(page, 'Volume du métronome')).toHaveValue('25');
  await expect(interrupteur(page, NOM.sonDeplacement)).toHaveAttribute('aria-checked', 'false');
  await expect(liste(page, 'Rythme des nouveaux accords')).toHaveValue('noire_maintenu');
  await expect(interrupteur(page, NOM.jouerSelection)).toHaveAttribute('aria-checked', 'false');
  await expect(interrupteur(page, NOM.decompte)).toHaveAttribute('aria-checked', 'false');
  await expect(sonMetronome(page).locator('option:checked')).toHaveText('Clave');
  await expect(ecouterEnEditant(page)).toHaveAttribute('aria-checked', 'false');
  await expect(interrupteur(page, NOM.degres)).toHaveAttribute('aria-checked', 'false');
  await expect(interrupteur(page, NOM.nomsRythmes)).toHaveAttribute('aria-checked', nomsRythmes);
  await expect(curseur(page, 'Barres du séquenceur')).toHaveValue('34');
  await expect(liste(page, 'Position d\'accord').locator('option:checked')).toHaveText('Masquée');
  await expect(interrupteur(page, NOM.dateModif)).toHaveAttribute('aria-checked', 'false');
  await expect(choix(page, 'Touches du piano', 'Notes')).toBeChecked();
  await expect(choix(page, 'Pastilles de la guitare', 'Degrés')).toBeChecked();
  await expect(interrupteur(page, NOM.nomsManche)).toHaveAttribute('aria-checked', 'true');
  await expect(interrupteur(page, NOM.fonction)).toHaveAttribute('aria-checked', 'true');
  await expect(reperesDeTemps(page).locator('option:checked')).toHaveText('Tous les temps');
  await expect(interrupteur(page, NOM.verre)).toHaveAttribute('aria-checked', 'true');
  await expect(choix(page, 'Couleur du fond', 'Violet')).toBeChecked();
}

test.describe('Persistance des réglages @parametres', () => {
  test('les vingt réglages sont retrouvés tels quels après un rechargement, dans la fenêtre ET sur la page @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const nomsRythmes = await toutChanger(page);
    await toutVerifier(page, nomsRythmes);
    await fermer(page);

    await page.reload();
    await page.waitForFunction(() => !!(window as any).app);
    // ce qu'on voit sur la page, avant même d'ouvrir la fenêtre
    // degrés éteints, fonction harmonique allumée : la rangée ne porte plus que T / ? / SD / D, plus aucun chiffre romain
    expect(await degresAffiches(page)).toEqual(['T', '?', 'SD', 'D']);
    expect((await mentions(page)).filter(Boolean)).toEqual([]);
    await expect.poll(() => page.evaluate(() => document.documentElement.getAttribute('data-glass'))).toBe('1');
    expect(await lireEtat(page, 'generalVolumePercent')).toBe(40);
    await expect.poll(async () => (await sortie(page)).db!).toBeLessThan(-3);
    // puis dans la fenêtre
    await ouvrir(page);
    await deplierAvancees(page);
    await toutVerifier(page, nomsRythmes);
    expect(garde.bloquees).toEqual([]);
  });

  test('un 2ᵉ rechargement ne change rien (aucune dérive) et une fermeture de l\'onglet puis une réouverture non plus', async ({ ouvrirAppli, context }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await toutChanger(page);
    await fermer(page);
    const avant = await reglagesStockes(page);
    await page.reload();
    await page.waitForFunction(() => !!(window as any).app);
    await page.reload();
    await page.waitForFunction(() => !!(window as any).app);
    expect(await reglagesStockes(page)).toEqual(avant);
    // un onglet neuf de la même session de navigateur (même stockage)
    const autre = await context.newPage();
    await autre.goto('/index.html');
    await autre.waitForFunction(() => !!(window as any).app);
    expect(await reglagesStockes(autre)).toEqual(avant);
    await autre.close();
  });

  test('un appareil neuf (stockage vidé) repart des valeurs d\'usine : volume 100, degrés allumés, verre éteint…', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await toutChanger(page);
    await fermer(page);
    await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (/^harmohub(?!Songs|CurrentSongId)/.test(k)) localStorage.removeItem(k); });
    await page.reload();
    await page.waitForFunction(() => !!(window as any).app);
    expect(await degresAffiches(page)).toEqual(['I', 'vi', 'IV', 'V']);
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-glass'))).toBeNull();
    expect(await sortie(page)).toEqual({ db: 0, muet: false });
    await ouvrir(page);
    await expect(curseur(page, 'Volume général')).toHaveValue('100');
    await expect(interrupteur(page, NOM.degres)).toHaveAttribute('aria-checked', 'true');
    await expect(interrupteur(page, NOM.verre)).toHaveAttribute('aria-checked', 'false');
    await expect(choix(page, 'Couleur du fond', 'Aurore')).toBeChecked();
  });

  test('les réglages sont ceux de l\'appareil : ouvrir un autre morceau ne les change pas @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: bibliotheque([{ id: 'a', nom: 'Alpha', accords: C_AM_F_G }, { id: 'b', nom: 'Bravo', accords: [{ root: 'D', quality: 'min7' }, { root: 'G', quality: 'dom7' }] }], 'a') });
    await ouvrir(page);
    await appuyer(page, interrupteur(page, NOM.degres));
    await appuyer(page, choix(page, 'Couleur du fond', 'Vert'));
    await appuyer(page, interrupteur(page, NOM.verre));
    await fermer(page);
    const avant = await reglagesStockes(page);
    await titre(page).click();
    await page.getByRole('menu', { name: 'Morceau' }).getByRole('menuitemradio', { name: /^Bravo/ }).click();
    await expect(titre(page)).toHaveText('Bravo');
    expect(await degresAffiches(page)).toEqual([]);   // toujours éteints, sur le morceau d'à côté
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-glass'))).toBe('1');
    expect(await reglagesStockes(page)).toEqual(avant);
  });

  test('une valeur abîmée dans le stockage ne casse pas l\'appli : elle charge, et les réglages retombent sur des valeurs permises', async ({ ouvrirAppli }) => {
    const erreurs: string[] = [];
    const page = await ouvrirAppli({
      accords: C_AM_F_G,
      reglages: {
        harmohubSequenceurLigne: '9999', harmohubShowRomanNumerals: 'peut-être', harmohubEtiquettesPiano: 'n\'importe quoi', harmohubNomsNotesGuitare: '{',
        'harmohub.glassBg.v1': 'fuchsia', harmohubRythmeDepart: 'zigzag',
      },
    });
    page.on('pageerror', e => erreurs.push(e.message));
    await page.reload();
    await page.waitForFunction(() => !!(window as any).app);
    await expect(page.locator('#progression-sections .grid-cell[data-index]')).toHaveCount(4);
    await ouvrir(page);
    const barres = Number(await curseur(page, 'Barres du séquenceur').inputValue());
    expect(barres).toBeGreaterThanOrEqual(22);
    expect(barres).toBeLessThanOrEqual(48);
    // les groupes de choix tombent sur un choix permis (un seul coché)
    for (const g of ['Touches du piano', 'Pastilles de la guitare', 'Couleur du fond']) {
      await expect(page.getByRole('dialog', { name: 'Paramètres' }).getByRole('radiogroup', { name: g }).getByRole('radio', { checked: true })).toHaveCount(1);
    }
    await expect(liste(page, 'Rythme des nouveaux accords').locator('option:checked')).toHaveCount(1);
    expect(erreurs).toEqual([]);
  });

  test('une hauteur de barres du séquenceur abîmée (9999) reste dans la fourchette permise, 22 à 48 px @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G, reglages: { harmohubSequenceurLigne: '9999' } });
    await page.locator('#vue-sequenceur').click();
    const h = await page.locator('#sq-grille .sq-case').first().evaluate(e => Math.round(e.getBoundingClientRect().height));
    expect(h).toBeGreaterThanOrEqual(22);
    expect(h).toBeLessThanOrEqual(48);
  });
});

// Une valeur de volume qui n'est pas un nombre (stockage abîmé à la main, ancienne version…) : l'appli doit démarrer quand même.
test.describe('Valeurs de volume abîmées @parametres @ordinateur', () => {
  for (const [cle, valeur] of [['harmohubGeneralVolume', 'beaucoup'], ['harmohubGeneralVolume', ''], ['harmohubMetronomeVolume', 'abc']] as const) {
    test(`E-06 : « ${cle} » vaut « ${valeur} » : l'appli démarre`, async ({ page }) => {
      await page.addInitScript(([c, v]) => { sessionStorage.setItem('cc_accueil_vu', '1'); localStorage.setItem(c, v); }, [cle, valeur]);
      await page.goto('/index.html');
      await page.waitForFunction(() => !!(window as any).app, null, { timeout: 10_000 });
      await expect(page.locator('#progression-sections')).toBeVisible();
    });
  }

  for (const [cle, valeur, lecture] of [['harmohubGeneralVolume', '150', 'generalVolumePercent'], ['harmohubGeneralVolume', '-5', 'generalVolumePercent'], ['harmohubMetronomeVolume', '500', 'metronomeVolumePercent']] as const) {
    test(`E-07 : « ${cle} » vaut « ${valeur} » : le volume est ramené entre 0 et 100`, async ({ ouvrirAppli }) => {
      const page = await ouvrirAppli({ reglages: { [cle]: valeur } });
      const v = await lireEtat<number>(page, lecture);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    });
  }
});
