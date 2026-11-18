// MODULE « synchro » — LE MENU DU COMPTE et la DÉCONNEXION. Se déconnecter n'efface rien : « Ce qui est déjà envoyé reste dans le cloud ».
import {
  test, expect, C_AM_F_G, DO_SOL_DO, emailDe, connecter, attendreSynchronise, pastille, morceauxCloud, morceauxLocaux, renommerPartieEtEnregistrer,
  bibliotheque, attendreNomsCloud, titre, titrePartie,
} from './aide-synchro';

const DEUX = bibliotheque([{ id: 'a', nom: 'Alpha', accords: C_AM_F_G }, { id: 'b', nom: 'Bravo', accords: DO_SOL_DO }], 'a');

test.describe('Menu du compte et déconnexion @synchro', () => {
  test('la pastille du compte porte le nom ; son menu donne le nom, l\'adresse, l\'état et « Se déconnecter » @critique', async ({ ouvrirAppli }, testInfo) => {
    const page = await ouvrirAppli({ reglages: DEUX });
    const email = emailDe(testInfo);
    await expect(page.locator('#google-signin-btn')).toBeVisible();
    await expect(page.locator('#account-info')).toBeHidden();
    await connecter(page, email, 'Camille Test');
    await attendreSynchronise(page);
    await expect(page.locator('#google-signin-btn')).toBeHidden();
    await expect(page.locator('#account-name')).toHaveText('Camille Test');
    await expect(page.locator('#account-info')).toHaveAttribute('title', /Camille Test — Synchronisé avec le cloud/);

    await page.locator('#account-info').click();
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    await expect(menu).toContainText('Camille Test');
    await expect(menu).toContainText(email);
    await expect(menu).toContainText('Synchronisé avec le cloud');
    await expect(menu.getByRole('menuitem', { name: /Se déconnecter/ })).toContainText('Ce qui est déjà envoyé reste dans le cloud');
  });

  test('Échap, ou un clic à côté, referme le menu du compte sans déconnecter', async ({ ouvrirAppli }, testInfo) => {
    const page = await ouvrirAppli({ reglages: DEUX });
    await connecter(page, emailDe(testInfo));
    await page.locator('#account-info').click();
    await expect(page.getByRole('menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toBeHidden();
    await page.locator('#account-info').click();
    await expect(page.getByRole('menu')).toBeVisible();
    await titre(page).click({ force: false }).catch(() => {});   // un clic à côté : le menu du morceau s'ouvre, celui du compte se ferme
    await expect(page.getByRole('menuitem', { name: /Se déconnecter/ })).toBeHidden();
    await expect(page.locator('#account-info')).toBeVisible();   // toujours connecté
  });

  test('la connexion survit à un rechargement de la page', async ({ ouvrirAppli }, testInfo) => {
    const page = await ouvrirAppli({ reglages: DEUX });
    await connecter(page, emailDe(testInfo), 'Camille Test');
    await page.reload();
    await page.waitForFunction(() => !!(window as any).app);
    await expect(page.locator('#account-info')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#account-name')).toHaveText('Camille Test');
    await attendreSynchronise(page);
  });

  test('« Se déconnecter » : retour au bouton « Se connecter », morceaux locaux et cloud intacts @critique', async ({ ouvrirAppli }, testInfo) => {
    const page = await ouvrirAppli({ reglages: DEUX });
    const uid = await connecter(page, emailDe(testInfo));
    await attendreNomsCloud(uid, ['Alpha', 'Bravo']);
    await attendreSynchronise(page);
    const avant = await morceauxCloud(uid);

    await page.locator('#account-info').click();
    await page.getByRole('menuitem', { name: /Se déconnecter/ }).click();
    await expect(page.locator('#google-signin-btn')).toBeVisible();
    await expect(page.locator('#account-info')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Se connecter avec Google' })).toBeVisible();
    // Le morceau ouvert est toujours là, avec ses accords et ses autres morceaux.
    await expect(titre(page)).toHaveText('Alpha');
    await expect(page.locator('#progression-sections .grid-cell[data-index]')).toHaveCount(4);
    expect((await morceauxLocaux(page)).map(m => m.name).sort()).toEqual(['Alpha', 'Bravo']);
    // Le cloud n'a pas été vidé.
    expect(await morceauxCloud(uid)).toEqual(avant);
    // Et la déconnexion tient après rechargement.
    await page.reload();
    await page.waitForFunction(() => !!(window as any).app);
    await expect(page.locator('#google-signin-btn')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#account-info')).toBeHidden();
  });

  test('déconnecté, enregistrer ne part plus dans le cloud ; en se reconnectant au même compte, la modification part @critique', async ({ ouvrirAppli }, testInfo) => {
    const page = await ouvrirAppli({ reglages: DEUX });
    const email = emailDe(testInfo);
    const uid = await connecter(page, email);
    await attendreNomsCloud(uid, ['Alpha', 'Bravo']);
    await attendreSynchronise(page);
    await page.locator('#account-info').click();
    await page.getByRole('menuitem', { name: /Se déconnecter/ }).click();
    await expect(page.locator('#google-signin-btn')).toBeVisible();

    await renommerPartieEtEnregistrer(page, 'Hors compte');
    expect((await morceauxLocaux(page)).find(m => m.name === 'Alpha')!.titres).toEqual(['Hors compte']);
    // Laisser au cloud une vraie chance de recevoir (si l'appli envoyait, ce serait dans la seconde) : on vérifie par une lecture de la source.
    await expect.poll(async () => (await morceauxCloud(uid)).find(m => m.name === 'Alpha')!.titres[0], { timeout: 3_000 }).toBe('Couplet').catch(() => { throw new Error('Le cloud a reçu une modification faite sans compte connecté'); });

    // Même compte : la modification faite dans l'intervalle part.
    const uid2 = await connecter(page, email);
    expect(uid2).toBe(uid);
    await expect.poll(async () => (await morceauxCloud(uid)).find(m => m.name === 'Alpha')!.titres[0], { timeout: 20_000 }).toBe('Hors compte');
    await attendreSynchronise(page);
  });

  test('se connecter avec un AUTRE compte sur le même appareil ne modifie pas le cloud du premier compte', async ({ ouvrirAppli }, testInfo) => {
    const page = await ouvrirAppli({ reglages: DEUX });
    const uid1 = await connecter(page, emailDe(testInfo, 'premier'));
    await attendreNomsCloud(uid1, ['Alpha', 'Bravo']);
    await attendreSynchronise(page);
    const avant = await morceauxCloud(uid1);
    await page.locator('#account-info').click();
    await page.getByRole('menuitem', { name: /Se déconnecter/ }).click();
    await expect(page.locator('#google-signin-btn')).toBeVisible();
    await renommerPartieEtEnregistrer(page, 'Sans compte');

    const uid2 = await connecter(page, emailDe(testInfo, 'second'), 'Second Compte');
    expect(uid2).not.toBe(uid1);
    await expect(page.locator('#account-name')).toHaveText('Second Compte');
    await attendreSynchronise(page);
    expect(await morceauxCloud(uid1)).toEqual(avant);   // le premier compte n'a rien reçu de ce qui s'est passé après sa déconnexion
    await expect(titrePartie(page)).toHaveValue('Sans compte');
    expect(pastille(page)).toBeTruthy();
  });

  test('Y-02 (constat, à arbitrer) : sur un appareil partagé, les morceaux du premier compte restent sur l\'appareil et partent chez le compte suivant', async ({ ouvrirAppli }, testInfo) => {
    // Comportement OBSERVÉ, figé ici pour que le jour où il change (effacement à la déconnexion, ou demande de confirmation) le test le dise.
    const page = await ouvrirAppli({ reglages: DEUX });
    const uid1 = await connecter(page, emailDe(testInfo, 'premier'));
    await attendreNomsCloud(uid1, ['Alpha', 'Bravo']);
    await page.locator('#account-info').click();
    await page.getByRole('menuitem', { name: /Se déconnecter/ }).click();
    await expect(page.locator('#google-signin-btn')).toBeVisible();
    const uid2 = await connecter(page, emailDe(testInfo, 'second'));
    await attendreNomsCloud(uid2, ['Alpha', 'Bravo']);
  });
});
