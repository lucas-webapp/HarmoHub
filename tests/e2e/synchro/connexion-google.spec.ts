// MODULE « synchro » — LES DEUX MODES DE L'APPLI : sans connexion (tout reste dans le navigateur) et avec la connexion Google.
// La connexion passe par l'ÉMULATEUR Auth : sa fenêtre « Google » est une page locale qui fabrique un compte FICTIF (jamais un vrai compte Google).
// Les règles Firestore de production (firestore.rules) sont appliquées par l'émulateur : on vérifie aussi qu'un inconnu ne lit rien.
import { test, expect } from '../support/fixtures';
import { lireDocument, PROJET, FIRESTORE } from '../support/emulateurs';

test.describe('Connexion Google (émulateur) et synchro @critique @synchro', () => {
  test('sans connexion, rien n\'est écrit dans Firestore', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: [{ root: 'C', quality: 'maj' }, { root: 'G', quality: 'maj' }] });
    await expect(page.locator('#progression-sections .grid-cell[data-index]')).toHaveCount(2);
    await expect(page.locator('#google-signin-btn')).toBeVisible();
    const r = await fetch(`http://${FIRESTORE}/v1/projects/${PROJET}/databases/(default)/documents/users`, { headers: { Authorization: 'Bearer owner' } });
    const j: any = await r.json();
    expect(j.documents ?? []).toEqual([]);
  });

  test('connecté avec un compte Google FICTIF : le morceau part dans Firestore, sous ce compte seulement', async ({ ouvrirAppli }, testInfo) => {
    const page = await ouvrirAppli({ accords: [{ root: 'D', quality: 'min7' }, { root: 'G', quality: 'dom7' }, { root: 'C', quality: 'maj7' }] });
    // Jeton Google FICTIF accepté par l'émulateur Auth seulement (non signé) : le même chemin que la fenêtre Google, sans elle.
    const email = `e2e-${testInfo.project.name}-${Date.now()}@exemple.test`;
    const uid = await page.evaluate(async (email) => {
      const fb = (window as any).firebase;
      const jeton = JSON.stringify({ sub: 'g-' + email, email, email_verified: true, name: 'Testeur E2E' });
      const r = await fb.auth().signInWithCredential(fb.auth.GoogleAuthProvider.credential(jeton));
      return r.user.uid;
    }, email);
    await expect(page.locator('#account-info')).toBeVisible({ timeout: 15_000 });
    // Le document de l'appli apparaît sous users/{uid}/apps/harmohub (lu par l'API de l'émulateur, en contournant les règles) et porte le morceau.
    await expect.poll(async () => JSON.stringify(await lireDocument(`users/${uid}/apps/harmohub`)), { timeout: 20_000 }).toMatch(/min7/);
    // Les règles de production : un inconnu (sans jeton) ne lit PAS ce document.
    const anonyme = await fetch(`http://${FIRESTORE}/v1/projects/${PROJET}/databases/(default)/documents/users/${uid}/apps/harmohub`);
    expect(anonyme.status).toBe(403);
  });

  test('la fenêtre « Se connecter avec Google » ouvre celle de l\'émulateur (compte fictif)', async ({ ouvrirAppli }, testInfo) => {
    // Le SDK Auth charge son chargeur de fenêtres depuis apis.google.com (script public de Google, pas le projet) : bloqué par le réseau
    // « Limité » de la VM cloud. Ce test tourne donc en CI ; dans la VM il est sauté, et le dit.
    const joignable = await fetch('https://apis.google.com/js/api.js', { method: 'HEAD' }).then(r => r.ok, () => false);
    test.skip(!joignable, 'apis.google.com injoignable depuis cet environnement (réseau « Limité ») : test de la fenêtre de connexion en CI seulement');
    const page = await ouvrirAppli({ accords: [{ root: 'C', quality: 'maj' }], accueil: 'garder', gapi: true });
    const email = `e2e-fenetre-${testInfo.project.name}-${Date.now()}@exemple.test`;
    const fenetre = page.waitForEvent('popup');
    await page.locator('#cloud-guard-modal').getByRole('button', { name: 'Se connecter avec Google' }).click();
    const popup = await fenetre;
    await popup.waitForLoadState();
    expect(new URL(popup.url()).host).toMatch(/^127\.0\.0\.1:\d+$/);   // la fenêtre de l'émulateur local, jamais accounts.google.com
    await popup.getByRole('button', { name: /add new account/i }).click();
    await popup.getByLabel(/email/i).fill(email);
    await popup.getByRole('button', { name: /sign in with google\.com/i }).click();
    await expect(page.locator('#account-info')).toBeVisible({ timeout: 20_000 });
  });
});
