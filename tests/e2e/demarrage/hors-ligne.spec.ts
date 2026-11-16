// MODULE « demarrage » — état HORS LIGNE : le SDK Firebase ne se charge pas (réseau coupé, bloqueur de contenu, `www.gstatic.com` injoignable).
// Prévu par tests/PLAN.md (§ 3, module 1) : l'appli doit rester utilisable en local, sans fenêtre d'accueil du compte, et dire pourquoi
// la synchronisation est absente quand on demande à se connecter. Ici, le serveur de test sert le SDK sous /__e2e__/firebase/ : on l'y refuse (503).
import { test, expect } from '../support/fixtures';

test.describe('Hors ligne (Firebase indisponible) @critique @demarrage', () => {
  test('sans SDK Firebase, l\'appli marche en local et explique l\'absence de synchronisation', async ({ page, ouvrirAppli, garde }) => {
    await page.route('**/__e2e__/firebase/**', (route) => route.fulfill({ status: 503, body: 'indisponible' }));
    const sdkRefuse: string[] = [];
    page.on('response', (r) => { if (r.url().includes('/__e2e__/firebase/') && r.status() === 503) sdkRefuse.push(r.url()); });

    await ouvrirAppli({ accueil: 'garder' });
    const mobile = page.viewportSize()!.width < 900;
    await expect.poll(() => sdkRefuse.length).toBeGreaterThanOrEqual(1);
    await expect.poll(() => page.evaluate(() => typeof (window as any).firebase)).toBe('undefined');
    // Sans Firebase, personne ne peut se connecter : la fenêtre d'accueil du compte ne doit PAS s'ouvrir.
    await expect(page.locator('#cloud-guard-modal')).toBeHidden();

    if (mobile) {
      await page.locator('.prog-section-ajout').first().click();
      const saisie = page.locator('#quick-add-input');
      await expect(saisie).toBeVisible();
      await saisie.fill('C//G');
      await page.locator('#quick-add-btn').click();
      await page.keyboard.press('Escape');
    } else {
      const plus = page.getByRole('textbox', { name: 'Ajouter un accord à la fin de cette partie' }).first();
      for (const accord of ['C', 'G']) { await plus.click(); await plus.fill(accord); await plus.press('Enter'); }

      // Ordinateur : la pilule « Se connecter » de la barre du haut dit pourquoi la synchronisation manque, au survol et au clic.
      const pilule = page.locator('#google-signin-btn');
      await expect(pilule).toBeVisible();
      await expect(pilule).toHaveAttribute('title', /Firebase n'a pas pu se charger/);
      await pilule.click();
      await expect(page.getByText(/Synchronisation indisponible/).first()).toBeVisible();
    }
    const grille = page.locator('#progression-sections .grid-cell[data-index]');
    await expect(grille).toHaveCount(2);
    await expect(grille.nth(1)).toContainText('G');

    // Le morceau reste dans le navigateur après un rechargement, toujours sans Firebase.
    await page.reload();
    await expect(page.locator('#progression-sections .grid-cell[data-index]')).toHaveCount(2);
    await expect(page.locator('#cloud-guard-modal')).toBeHidden();
    expect(garde.bloquees).toEqual([]);
  });
});
