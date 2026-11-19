// MODULE « parametres » — les réglages qui VOYAGENT avec le compte (son, métronome, ce que la grille affiche, rythme de départ) et ceux qui restent à l'appareil
// (verre dépoli et couleur du fond, hauteur des barres du séquenceur, étiquettes des diagrammes). Compte fictif de l'émulateur Auth ; un 2ᵉ appareil = un 2ᵉ contexte.
import {
  test, expect, C_AM_F_G, emailDe, connecter, attendreSynchronise, documentCloud,
} from '../synchro/aide-synchro';
import type { Page } from '@playwright/test';
import { appuyer, ouvrir, fermer, interrupteur, curseur, choix, NOM, lireStockage as lireStockageBrut, lireEtat } from './aide-parametres';

// Sur un appareil qui vient de se connecter, la page se recharge d'elle-même (mesuré : une navigation de la page principale environ une demi-seconde
// après la connexion, sur Chromium comme sur WebKit). Une lecture qui tombe pile dessus échoue avec « Execution context was destroyed » : on rend alors
// `undefined` (« pas encore ») et le sondage recommence ; toute autre erreur remonte.
// On pose un repère dans la page AVANT de se connecter ; quand il a disparu, la page s'est rechargée et ne bougera plus.
const poserRepere = (page: Page) => page.evaluate(() => { (window as any).__repere = true; });
const attendreRechargement = async (page: Page) => {
  await page.waitForFunction(() => !(window as any).__repere, null, { timeout: 20_000 });
  await page.waitForFunction(() => !!(window as any).app);
};
const lireStockage = async (page: Page, cle: string): Promise<string | null | undefined> => {
  try { return await lireStockageBrut(page, cle); }
  catch (e) { if (/Execution context was destroyed|navigation/i.test(String(e))) return undefined; throw e; }
};

const reglagesDuCloud = async (uid: string): Promise<Record<string, string>> => {
  const doc = await documentCloud(uid, 'harmohub');
  return Object.fromEntries(((doc && doc.reglages) || []).map((r: any) => [r.k, r.v]));
};

test.describe('Réglages et compte @parametres', () => {
  test('connecté, un réglage changé part dans le cloud ; un appareil neuf qui se connecte le retrouve @critique', async ({ ouvrirAppli, nouvelAppareilOuvert }, testInfo) => {
    const a = await ouvrirAppli({ accords: C_AM_F_G });
    const email = emailDe(testInfo);
    const uid = await connecter(a, email);
    await attendreSynchronise(a);
    await ouvrir(a);
    await appuyer(a, interrupteur(a, NOM.decompte));
    await curseur(a, 'Volume général').fill('55');
    await appuyer(a, interrupteur(a, NOM.degres));
    await fermer(a);
    await expect.poll(() => reglagesDuCloud(uid), { timeout: 20_000 }).toMatchObject({ harmohubMetronomeCountIn: '0', harmohubGeneralVolume: '55', harmohubShowRomanNumerals: '0' });

    // un autre ordinateur : valeurs d'usine, puis la connexion apporte les réglages du compte
    const b = await nouvelAppareilOuvert();
    expect(await lireStockage(b, 'harmohubGeneralVolume')).toBeNull();
    await poserRepere(b);
    await connecter(b, email);
    await expect.poll(() => lireStockage(b, 'harmohubGeneralVolume'), { timeout: 20_000 }).toBe('55');
    await attendreRechargement(b);
    await attendreSynchronise(b);
    await b.reload();
    await b.waitForFunction(() => !!(window as any).app);
    expect(await lireEtat(b, 'generalVolumePercent')).toBe(55);
    expect(await lireEtat(b, 'metronomeCountIn')).toBe(false);
    await ouvrir(b);
    await expect(curseur(b, 'Volume général')).toHaveValue('55');
    await expect(interrupteur(b, NOM.decompte)).toHaveAttribute('aria-checked', 'false');
    await expect(interrupteur(b, NOM.degres)).toHaveAttribute('aria-checked', 'false');
  });

  test('le verre dépoli, la couleur du fond et les étiquettes des diagrammes restent propres à l\'appareil : le cloud ne les reçoit pas, l\'autre appareil non plus @critique', async ({ ouvrirAppli, nouvelAppareilOuvert }, testInfo) => {
    const a = await ouvrirAppli({ accords: C_AM_F_G });
    const email = emailDe(testInfo);
    const uid = await connecter(a, email);
    await attendreSynchronise(a);
    await ouvrir(a);
    await appuyer(a, interrupteur(a, NOM.verre));
    await appuyer(a, choix(a, 'Couleur du fond', 'Rose'));
    await appuyer(a, choix(a, 'Touches du piano', 'Notes'));
    await curseur(a, 'Volume du métronome').fill('33');   // un réglage qui voyage : sert de témoin que l'envoi a bien eu lieu
    await fermer(a);
    await expect.poll(() => reglagesDuCloud(uid), { timeout: 20_000 }).toMatchObject({ harmohubMetronomeVolume: '33' });
    const cloud = await reglagesDuCloud(uid);
    expect(Object.keys(cloud).filter(k => /glass|Etiquettes|SequenceurLigne|NomsNotes/i.test(k))).toEqual([]);

    const b = await nouvelAppareilOuvert();
    await poserRepere(b);
    await connecter(b, email);
    await expect.poll(() => lireStockage(b, 'harmohubMetronomeVolume'), { timeout: 20_000 }).toBe('33');
    await attendreRechargement(b);
    // (`toPass` : la page peut se recharger d'elle-même au milieu de ces lectures, voir plus haut ; chaque lecture est refaite en entier)
    await expect(async () => {
      expect(await b.evaluate(() => document.documentElement.getAttribute('data-glass'))).toBeNull();
      expect(await lireStockage(b, 'harmohub.glass.v1')).toBeNull();
      expect(await lireStockage(b, 'harmohubEtiquettesPiano')).toBeNull();
    }).toPass({ timeout: 10_000 });
    // et après un rechargement bien net de B, plus rien ne peut arriver en retard
    // (WebKit répond parfois « internal error » à un rechargement qui suit de près celui de l'appli : on le refait, toute autre erreur reste une erreur)
    await expect(async () => {
      await b.reload();
      await b.waitForFunction(() => !!(window as any).app);
    }).toPass({ timeout: 20_000 });
    expect(await b.evaluate(() => document.documentElement.getAttribute('data-glass'))).toBeNull();
    expect(await lireStockage(b, 'harmohub.glass.v1')).toBeNull();
    expect(await lireStockage(b, 'harmohubEtiquettesPiano')).toBeNull();
    expect(await lireStockage(b, 'harmohubMetronomeVolume')).toBe('33');
    // et A garde les siens
    expect(await a.evaluate(() => document.documentElement.getAttribute('data-glass'))).toBe('1');
  });

  test('se déconnecter ne touche pas aux réglages de l\'appareil', async ({ ouvrirAppli }, testInfo) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await connecter(page, emailDe(testInfo));
    await attendreSynchronise(page);
    await ouvrir(page);
    await curseur(page, 'Volume général').fill('45');
    await appuyer(page, interrupteur(page, NOM.verre));
    await fermer(page);
    await expect.poll(() => lireStockage(page, 'harmohubGeneralVolume')).toBe('45');
    await page.locator('#account-info').click();
    await page.getByRole('menuitem', { name: /Se déconnecter/ }).click();
    await expect(page.locator('#google-signin-btn')).toBeVisible();
    expect(await lireStockage(page, 'harmohubGeneralVolume')).toBe('45');
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-glass'))).toBe('1');
    expect(await lireEtat(page, 'generalVolumePercent')).toBe(45);
  });
});
