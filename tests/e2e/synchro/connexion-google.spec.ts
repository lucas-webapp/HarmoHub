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

// AJOUTS (17/11, phase 5) : la fenêtre d'accueil du compte et le comportement de la connexion. Les trois tests ci-dessus ne sont pas modifiés.
test.describe('Fenêtre d\'accueil du compte @synchro', () => {
  test('à la première visite, elle propose de se connecter ou de continuer sans compte @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accueil: 'garder' });
    const accueil = page.locator('#cloud-guard-modal');
    await expect(accueil).toBeVisible();
    await expect(accueil).toContainText('Retrouve ton travail partout');
    await expect(accueil.getByRole('button', { name: 'Se connecter avec Google' })).toBeVisible();
    await expect(accueil.getByRole('button', { name: 'Continuer sans compte' })).toBeVisible();
    await expect(accueil.getByRole('checkbox', { name: 'Ne plus me le proposer sur cet appareil' })).not.toBeChecked();
    await expect(accueil).toContainText('ne reviendra pas avant une semaine');   // ES-17 : la fenêtre dit combien de temps dure le refus
  });

  test('« Continuer sans compte » ferme la fenêtre : l\'appli reste en mode local, avec le bouton « Se connecter » dans la barre @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: [{ root: 'C', quality: 'maj' }], accueil: 'garder' });
    await page.locator('#cloud-guard-continue').click();
    await expect(page.locator('#cloud-guard-modal')).toBeHidden();
    await expect(page.locator('#google-signin-btn')).toBeVisible();
    await expect(page.locator('#account-info')).toBeHidden();
    await expect(page.locator('#progression-sections .grid-cell[data-index]')).toHaveCount(1);   // le travail local est intact
  });

  // ES-17 (essai neutre du 20/11 : « la fenêtre revient à chaque chargement »). Refuser la fenêtre la fait taire sept jours, dans tous les onglets de l'appareil ; passé ce délai
  // (simulé : la date retenue est reculée), elle revient ; la case « Ne plus me le proposer » la fait taire pour de bon.
  test('« Continuer sans compte » : la fenêtre ne revient ni au rechargement ni dans un nouvel onglet pendant sept jours, puis revient @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accueil: 'garder' });
    const accueil = page.locator('#cloud-guard-modal');
    await page.locator('#cloud-guard-continue').click();
    await expect(accueil).toBeHidden();
    await page.reload();
    await page.waitForFunction(() => !!(window as any).app);
    await expect(page.locator('#google-signin-btn')).toBeVisible({ timeout: 15_000 });
    await expect(accueil).toBeHidden();
    // un nouvel onglet = une nouvelle session : avant, la fenêtre revenait ; maintenant le refus dure
    const onglet2 = await page.context().newPage();
    await onglet2.goto('/index.html');
    await onglet2.waitForFunction(() => !!(window as any).app);
    await expect(onglet2.locator('#google-signin-btn')).toBeVisible({ timeout: 15_000 });
    await expect(onglet2.locator('#cloud-guard-modal')).toBeHidden();
    // sept jours plus tard : la date retenue est dans le passé, la fenêtre revient
    await onglet2.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.endsWith('.reporteJusqua')) localStorage.setItem(k, String(Date.now() - 1000)); });
    const onglet3 = await page.context().newPage();
    await onglet3.goto('/index.html');
    await expect(onglet3.locator('#cloud-guard-modal')).toBeVisible({ timeout: 15_000 });
    await onglet3.locator('#cloud-guard-modal').getByRole('checkbox', { name: 'Ne plus me le proposer sur cet appareil' }).check();
    await onglet3.locator('#cloud-guard-continue').click();
    await expect(onglet3.locator('#cloud-guard-modal')).toBeHidden();
    // la case cochée la fait taire pour de bon, même une fois le délai passé
    await onglet3.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.endsWith('.reporteJusqua')) localStorage.setItem(k, String(Date.now() - 1000)); });
    const onglet4 = await page.context().newPage();
    await onglet4.goto('/index.html');
    await onglet4.waitForFunction(() => !!(window as any).app);
    await expect(onglet4.locator('#google-signin-btn')).toBeVisible({ timeout: 15_000 });
    await expect(onglet4.locator('#cloud-guard-modal')).toBeHidden();
  });

  test('se connecter pendant que la fenêtre est ouverte la referme et affiche le compte', async ({ ouvrirAppli }, testInfo) => {
    const page = await ouvrirAppli({ accueil: 'garder' });
    await expect(page.locator('#cloud-guard-modal')).toBeVisible();
    const email = `e2e-accueil-${testInfo.project.name}-${testInfo.workerIndex}-${Date.now()}@exemple.test`;
    await page.evaluate(async (email) => {
      const fb = (window as any).firebase;
      await fb.auth().signInWithCredential(fb.auth.GoogleAuthProvider.credential(JSON.stringify({ sub: 'g-' + email, email, email_verified: true, name: 'Accueil E2E' })));
    }, email);
    await expect(page.locator('#account-info')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#cloud-guard-modal')).toBeHidden();
  });
});
