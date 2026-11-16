// MODULE « demarrage » — le parcours principal, sur TOUS les appareils (@smoke : toujours filmé).
// L'appli s'ouvre sans connexion (morceau dans le navigateur), on ajoute trois accords par le geste de l'appareil, on les lit, on arrête.
import { test, expect } from '../support/fixtures';

test.use({ video: 'on' });

test.describe('Parcours principal @smoke @critique @demarrage', () => {
  test('ouvrir l\'appli, ajouter C Am F, lire puis arrêter', async ({ ouvrirAppli, garde }, testInfo) => {
    const page = await ouvrirAppli({ accueil: 'garder' });
    const mobile = page.viewportSize()!.width < 900;   // la mise en page « téléphone » de l'appli (l'iPad en paysage a celle de l'ordinateur)
    await expect(page).toHaveTitle(/HarmoHub/);
    // Firebase est branché sur les émulateurs (et jamais sur la production).
    await expect.poll(() => page.evaluate(() => (window as any).__EMULATEURS_BRANCHES === true && (window as any).firebase.app().options.projectId)).toMatch(/^demo-/);

    // Première visite : la fenêtre d'accueil propose de se connecter ; on continue sans compte (données dans le navigateur).
    await expect(page.locator('#cloud-guard-modal')).toBeVisible();
    await expect(page.locator('#cloud-guard-modal').getByRole('button', { name: 'Se connecter avec Google' })).toBeVisible();
    await page.locator('#cloud-guard-continue').click();
    await expect(page.locator('#cloud-guard-modal')).toBeHidden();

    if (mobile) {
      // Téléphone : « + Accord » de l'en-tête de la partie ouvre le panneau d'ajout ; on y tape les accords.
      await page.locator('.prog-section-ajout').first().click();
      const saisie = page.locator('#quick-add-input');
      await expect(saisie).toBeVisible();
      await saisie.fill('C//Am//F');   // « // » sépare plusieurs accords (une barre seule = une basse)
      await page.locator('#quick-add-btn').click();
      await page.keyboard.press('Escape');
    } else {
      // Ordinateur : on tape dans la case « + » du bout de la partie, Entrée valide.
      const plus = page.getByRole('textbox', { name: 'Ajouter un accord à la fin de cette partie' }).first();
      for (const accord of ['C', 'Am', 'F']) { await plus.click(); await plus.fill(accord); await plus.press('Enter'); }
    }
    const grille = page.locator('#progression-sections .grid-cell[data-index]');
    await expect(grille).toHaveCount(3);
    await expect(grille.nth(1)).toContainText('Am');

    const lecture = page.locator('#play-prog');
    await lecture.click();
    await expect.poll(() => page.evaluate(() => (window as any).app.isPlaying)).toBe(true);
    await page.locator('#stop').click();
    await expect.poll(() => page.evaluate(() => (window as any).app.isPlaying)).toBe(false);

    // Rechargement : le morceau est resté dans le navigateur (mode sans connexion).
    await page.reload();
    await expect(page.locator('#progression-sections .grid-cell[data-index]')).toHaveCount(3);
    expect(garde.bloquees).toEqual([]);
  });
});
