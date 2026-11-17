// MODULE « lecture » — la barre de lecture au téléphone : lecture, stop, boucle, « Mes. N », nom de la partie et un bouton « … » qui ouvre le panneau
// « Lecture » (tempo, vitesse, métronome, clavier / guitare / séquenceur). Le tempo, la vitesse et le métronome sont aussi éprouvés par
// `tempo.spec.ts` et `vitesse-metronome.spec.ts`, qui tournent sur les projets téléphone.
import { test, expect } from '../support/fixtures';
import {
  C_AM_F_G, reglagesMorceau, barre, boutonLecture, boutonStop, boutonBoucle, fenetreTempo, curseurVitesse, boutonMetronome, vitesseMax, lireEtAttendre,
  mesureAffichee, enLecture, suivreSequence, observerMesures, mesuresVues,
} from './aide-lecture';

test.describe('Barre de lecture au téléphone @lecture @mobile', () => {
  test('la barre n\'a que lecture, stop, boucle, « Mes. N », la partie et « … » ; le tempo est dans le panneau @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await expect(barre(page)).toBeVisible();
    await expect(boutonLecture(page)).toBeVisible();
    await expect(boutonStop(page)).toBeVisible();
    await expect(boutonBoucle(page)).toBeVisible();
    await expect(page.locator('#bl-mesure')).toHaveText('Mes. 1');
    await expect(barre(page).getByText('Couplet')).toBeVisible();
    await expect(page.locator('#bl-plus')).toHaveAccessibleName('Tempo, métronome, clavier, guitare, notes');
    await expect(page.locator('#bl-tempo')).toBeHidden();   // pas de bouton « 120 BPM » dans la barre du téléphone
    // la barre tient dans l'écran, collée en bas
    const b = (await barre(page).boundingBox())!, vue = page.viewportSize()!;
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(vue.width + 1);
    expect(b.y + b.height).toBeLessThanOrEqual(vue.height + 1);
    expect(garde.bloquees).toEqual([]);
  });

  test('« … » ouvre le panneau « Lecture » ; le bouton « Fermer » le referme, « … » le rouvre', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await expect(page.locator('#bl-plus')).toHaveAttribute('aria-expanded', 'false');
    await page.locator('#bl-plus').tap();
    await expect(fenetreTempo(page)).toBeVisible();
    await expect(page.locator('#bl-plus')).toHaveAttribute('aria-expanded', 'true');
    for (const nom of ['Clavier', 'Guitare', 'Séquenceur']) await expect(fenetreTempo(page).getByRole('button', { name: nom, exact: true })).toBeVisible();
    // le panneau reste dans l'écran
    const b = (await fenetreTempo(page).boundingBox())!, vue = page.viewportSize()!;
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(vue.width + 1);
    await fenetreTempo(page).getByRole('button', { name: 'Fermer le panneau Lecture' }).tap();
    await expect(fenetreTempo(page)).toBeHidden();
    await expect(page.locator('#bl-plus')).toHaveAttribute('aria-expanded', 'false');
    await page.locator('#bl-plus').tap();
    await expect(fenetreTempo(page)).toBeVisible();
  });

  test('le panneau garde sa vitesse et son métronome pendant la lecture, et « Mes. N » avance @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await vitesseMax(page);
    await page.locator('#bl-plus').tap();
    await expect(curseurVitesse(page)).toHaveValue('200');
    await expect(boutonMetronome(page)).toHaveAttribute('aria-pressed', 'false');
    await fenetreTempo(page).getByRole('button', { name: 'Fermer le panneau Lecture' }).tap();
    await observerMesures(page);
    await lireEtAttendre(page);
    await expect.poll(async () => (await mesuresVues(page)).includes(4), { timeout: 25_000 }).toBe(true);
    expect(await mesuresVues(page)).toEqual([1, 2, 3, 4]);
    await expect(page.locator('#bl-mesure')).toHaveText('Mes. 4');
    await boutonStop(page).tap();
    await expect.poll(() => enLecture(page)).toBe(false);
  });

  test('un morceau à deux parties : la barre nomme la partie en cours au fil de la lecture', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({
      reglages: reglagesMorceau([
        { titre: 'Couplet', accords: [{ root: 'C', quality: '' }, { root: 'G', quality: '' }] },
        { titre: 'Refrain', accords: [{ root: 'F', quality: '' }, { root: 'C', quality: '' }] },
      ]),
    });
    await vitesseMax(page);
    await expect(barre(page).getByText('Couplet')).toBeVisible();
    await lireEtAttendre(page);
    await expect(barre(page).getByText('Refrain')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('#bl-mesure')).toHaveText(/Mes\. [34]/);
    await boutonStop(page).tap();
  });

  test('la boucle du téléphone relance le morceau (le panneau n\'est pas nécessaire)', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await vitesseMax(page);
    await boutonBoucle(page).tap();
    await expect(boutonBoucle(page)).toHaveAttribute('aria-pressed', 'true');
    await lireEtAttendre(page);
    expect(await suivreSequence(page, 5)).toEqual([0, 1, 2, 3, 0]);
    await boutonStop(page).tap();
    await expect.poll(() => enLecture(page)).toBe(false);
  });
});
