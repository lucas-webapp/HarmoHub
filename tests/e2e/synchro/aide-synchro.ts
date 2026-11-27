// Aides communes aux specs du module « synchro » (ce n'est pas une spec : le nom ne finit pas par .spec.ts).
// Un « appareil » = un contexte de navigateur (stockage local propre). Le compte est FICTIF : l'émulateur Auth accepte un jeton Google non signé,
// ce qui suit le même chemin que la fenêtre Google, sans elle. Les documents Firestore se lisent avec le jeton « owner » de l'émulateur.
import { test as base, expect } from '../support/fixtures';
import type { Page, Locator, Browser, BrowserContext, TestInfo } from '@playwright/test';   // types seulement
import { DOMAINES_PRODUCTION, lireDocument, FIRESTORE, PROJET } from '../support/emulateurs';
import { URL_EXTERNES_COUPEES, morceauDeDepart } from '../support/appli';
import type { Accord } from '../support/appli';

export const DO_SOL_DO: Accord[] = [{ root: 'D', quality: 'min7' }, { root: 'G', quality: 'dom7' }, { root: 'C', quality: 'maj7' }];
export const C_AM_F_G: Accord[] = [{ root: 'C', quality: 'maj' }, { root: 'A', quality: 'min' }, { root: 'F', quality: 'maj' }, { root: 'G', quality: 'maj' }];

export const unique = (testInfo: TestInfo, prefixe = 'e2e') => `${prefixe}-${testInfo.project.name}-${testInfo.workerIndex}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
export const emailDe = (testInfo: TestInfo, prefixe = 'e2e') => `${unique(testInfo, prefixe)}@exemple.test`;

// ---------- les appareils ----------
// Un 2ᵉ appareil : un nouveau contexte, de la MÊME forme que le projet (taille d'écran, tactile), avec le même garde-fou anti-production.
// Les requêtes de production bloquées sont ajoutées à `bloquees` (la fixture `garde` fait alors échouer le test).
export async function nouvelAppareil(browser: Browser, testInfo: TestInfo, bloquees: string[]): Promise<BrowserContext> {
  const u: any = testInfo.project.use;
  const ctx = await browser.newContext({
    viewport: u.viewport, userAgent: u.userAgent, isMobile: u.isMobile, hasTouch: u.hasTouch, deviceScaleFactor: u.deviceScaleFactor,
    baseURL: u.baseURL, locale: u.locale, timezoneId: u.timezoneId, serviceWorkers: 'block',
  });
  await ctx.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (DOMAINES_PRODUCTION.test(url.hostname)) { bloquees.push(url.href); return route.abort('blockedbyclient'); }
    return route.fallback();
  });
  await ctx.route(URL_EXTERNES_COUPEES, (route) => route.abort('blockedbyclient'));
  return ctx;
}

// Ouvre l'appli dans un contexte donné : morceau de départ facultatif (posé dans le stockage local AVANT le chargement), fenêtre d'accueil passée.
export async function ouvrirDans(ctx: BrowserContext, options: { accords?: Accord[]; titre?: string; bibliotheque?: Record<string, string> } = {}): Promise<Page> {
  const page = await ctx.newPage();
  const graine = options.accords ? morceauDeDepart(options.accords, 'Couplet', options.titre ?? 'Démo') : null;
  await page.addInitScript(([g, biblio]) => {
    if (sessionStorage.getItem('e2e-graine')) return;
    sessionStorage.setItem('e2e-graine', '1');
    sessionStorage.setItem('cc_accueil_vu', '1');
    if (g) {
      localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 'e2e-1', name: g.nom, savedAt: Date.now(), sections: g.sections }]));
      localStorage.setItem('harmohubCurrentSongId', 'e2e-1');
      localStorage.setItem('myProgression', JSON.stringify({ sections: g.sections }));
    }
    for (const [k, v] of Object.entries(biblio || {})) localStorage.setItem(k, v as string);
  }, [graine, options.bibliotheque || {}] as const);
  await page.goto('/index.html');
  await page.waitForFunction(() => !!(window as any).app);
  const accueil = page.locator('#cloud-guard-modal'), pilule = page.locator('#google-signin-btn');
  await expect(accueil.or(pilule).first()).toBeVisible({ timeout: 15_000 });
  if (await accueil.isVisible()) { await page.locator('#cloud-guard-continue').click(); await expect(accueil).toBeHidden(); }
  return page;
}

// ---------- le compte ----------
export async function connecter(page: Page, email: string, nom = 'Testeur E2E'): Promise<string> {
  const uid = await page.evaluate(async ([email, nom]) => {
    const fb = (window as any).firebase;
    const jeton = JSON.stringify({ sub: 'g-' + email, email, email_verified: true, name: nom });
    const r = await fb.auth().signInWithCredential(fb.auth.GoogleAuthProvider.credential(jeton));
    return r.user.uid as string;
  }, [email, nom]);
  await expect(page.locator('#account-info')).toBeVisible({ timeout: 15_000 });
  return uid;
}
export const pastille = (page: Page): Locator => page.locator('#sync-status');
export const attendreSynchronise = (page: Page) => expect(pastille(page)).toHaveAttribute('data-etat', 'synced', { timeout: 20_000 });

// ---------- lire ce que le cloud a reçu (jeton « owner » de l'émulateur : contourne les règles, pour VÉRIFIER) ----------
export type MorceauCloud = { id: string; name: string; savedAt: number; accords: string[]; titres: string[] };
const valeur = (v: any): any => {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(valeur);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, valeur(x)]));
  return v;
};
export async function documentCloud(uid: string, nom: string): Promise<any | null> {
  const d = await lireDocument(`users/${uid}/apps/${nom}`);
  return d ? valeur({ mapValue: { fields: d.fields } }) : null;
}
export async function morceauxCloud(uid: string): Promise<MorceauCloud[]> {
  const d = await documentCloud(uid, 'harmohub');
  return ((d && d.songs) || []).map((s: any) => {
    const m = JSON.parse(s.json);
    return {
      id: s.id, name: s.name, savedAt: s.savedAt,
      titres: m.sections.map((p: any) => p.title),
      accords: m.sections.flatMap((p: any) => p.chords.map((c: any) => c.root + c.quality)),
    };
  });
}

// ---------- lire l'état local ----------
export type MorceauLocal = { id: string; name: string; savedAt: number; accords: string[]; titres: string[] };
export const morceauxLocaux = (page: Page): Promise<MorceauLocal[]> => page.evaluate(() =>
  (JSON.parse(localStorage.getItem('harmohubSongs') || '[]') as any[]).map(s => ({
    id: s.id, name: s.name, savedAt: s.savedAt, titres: s.sections.map((p: any) => p.title),
    accords: s.sections.flatMap((p: any) => p.chords.map((c: any) => c.root + (c.quality || ''))),
  })));
export const accordsAffiches = (page: Page): Promise<string[]> => page.evaluate(() =>
  [...document.querySelectorAll('#progression-sections .grid-cell[data-index]')].map(e => (e.textContent || '').replace(/\s+/g, ' ').trim()));

// ---------- les gestes ----------
export const titre = (page: Page): Locator => page.locator('#tb-titre');
export const etat = (page: Page): Locator => page.locator('#tb-etat');
export const boutonEnregistrer = (page: Page): Locator => page.getByRole('button', { name: 'Enregistrer', exact: true });

export async function ouvrirMorceauDeLaListe(page: Page, nom: string) {
  await titre(page).click();
  await page.getByRole('menu', { name: 'Morceau' }).getByRole('menuitemradio', { name: new RegExp('^' + nom) }).click();
  await expect(titre(page)).toHaveText(nom);
}

// Renomme la première partie ET enregistre : le geste le plus simple qui modifie un morceau (la partie change de titre).
export async function renommerPartieEtEnregistrer(page: Page, nouveauTitre: string) {
  const champ = page.getByRole('textbox', { name: 'Section' }).first();
  await champ.fill(nouveauTitre);
  await champ.press('Enter');
  await boutonEnregistrer(page).click();
  await expect(etat(page)).toContainText(/Enregistré à \d{1,2}:\d{2}/);
}

// Ordinateur : les chevrons de transposition sont dans la barre du morceau. Téléphone : ils sont dans le panneau « Réglages du morceau », qu'on referme ensuite.
export async function transposerHaut(page: Page) {
  const telephone = page.viewportSize()!.width < 900;
  const reglages = page.getByRole('button', { name: /^Réglages du morceau/ });
  if (telephone) await reglages.click();
  await page.getByRole('button', { name: 'Transposer tout le morceau vers le haut' }).click();
  if (telephone) {
    await reglages.click();   // le même bouton referme le panneau
    await expect(page.getByRole('group', { name: 'Transposer le morceau' })).toBeHidden();
  }
}

export async function ouvrirParametres(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Paramètres' }).click();
  const fenetre = page.getByRole('dialog', { name: 'Paramètres' });
  await expect(fenetre).toBeVisible();
  // Les réglages sont rangés par onglet (26/11) : les versions du morceau sont dans « Historique », seul onglet que ce module consulte.
  await fenetre.getByRole('tab', { name: 'Historique', exact: true }).click();
  return fenetre;
}

export const PROJET_TEST = PROJET;
export const ADRESSE_FIRESTORE = FIRESTORE;

// Réutilisation des aides du module « fichiers » (bibliothèque de départ, liste « Mes morceaux », boîtes natives).
export { bibliotheque, ouvrirMesMorceaux, ligne, groupe, repondreAuxBoitesNatives, choisirDansMenuMorceau, toast, enregistrerSous, creerMorceau, fenetreMorceaux } from '../fichiers/aide-fichiers';

// Attend que le cloud contienne exactement ces noms de morceaux (ordre sans importance).
export async function attendreNomsCloud(uid: string, noms: string[]) {
  await expect.poll(async () => (await morceauxCloud(uid)).map(m => m.name).sort(), { timeout: 20_000 }).toEqual([...noms].sort());
}
export async function attendreNomsLocaux(page: Page, noms: string[]) {
  await expect.poll(async () => (await morceauxLocaux(page)).map(m => m.name).sort(), { timeout: 20_000 }).toEqual([...noms].sort());
}
// Le titre de la première partie du morceau (lu dans la grille : c'est ce que l'utilisateur voit).
export const titrePartie = (page: Page): Locator => page.getByRole('textbox', { name: 'Section' }).first();

// `test` du module : celui des fixtures communes (garde-fou anti-production compris) + un 2ᵉ appareil à la demande, fermé en fin de test.
type OptionsAppareil = { accords?: Accord[]; titre?: string; bibliotheque?: Record<string, string> };
export const test = base.extend<{ nouvelAppareilOuvert: (options?: OptionsAppareil) => Promise<Page> }>({
  nouvelAppareilOuvert: async ({ browser, garde }, use, testInfo) => {
    const contextes: BrowserContext[] = [];
    await use(async (options = {}) => {
      const ctx = await nouvelAppareil(browser, testInfo, garde.bloquees);
      contextes.push(ctx);
      return ouvrirDans(ctx, options);
    });
    for (const c of contextes) await c.close();
  },
});
export { expect };
