// FIXTURES COMMUNES : tout test importe `test` et `expect` d'ici, jamais de '@playwright/test' directement.
// GARDE-FOU N° 2 (automatique, pour chaque test) : toute requête vers un domaine de la PRODUCTION Firebase est interrompue ET le test échoue.
import { test as base, expect, Page } from '@playwright/test';
import { DOMAINES_PRODUCTION, exigerProjetDemo } from './emulateurs';
import { URL_EXTERNES_COUPEES, morceauDeDepart, Accord } from './appli';

type Fixtures = {
  garde: { bloquees: string[] };
  ouvrirAppli: (options?: { accords?: Accord[]; reglages?: Record<string, string>; accueil?: 'passer' | 'garder'; gapi?: boolean }) => Promise<Page>;
};

export const test = base.extend<Fixtures>({
  garde: [async ({ context }, use, testInfo) => {
    exigerProjetDemo();
    const bloquees: string[] = [];
    // Ordre : la DERNIÈRE route déclarée l'emporte. D'abord la barrière générale, puis les ressources externes coupées.
    // Le SDK et la configuration de test sont servis par scripts/serveur-test.cjs (aucune route ici).
    await context.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (DOMAINES_PRODUCTION.test(url.hostname)) { bloquees.push(url.href); return route.abort('blockedbyclient'); }
      return route.fallback();
    });
    await context.route(URL_EXTERNES_COUPEES, (route) => route.abort('blockedbyclient'));
    await use({ bloquees });
    if (bloquees.length) {
      await testInfo.attach('requetes-production-bloquees.txt', { body: bloquees.join('\n'), contentType: 'text/plain' });
      throw new Error(`GARDE-FOU : ${bloquees.length} requête(s) vers la PRODUCTION Firebase ont été bloquées (première : ${bloquees[0]}). Le test échoue.`);
    }
  }, { auto: true }],

  ouvrirAppli: async ({ page, context }, use) => {
    await use(async (options = {}) => {
      // La fenêtre de connexion Google a besoin du chargeur public apis.google.com (pas le projet) : laissé passer seulement si un test le demande.
      if (options.gapi) await context.route(/^https:\/\/apis\.google\.com\//, (route) => route.continue());
      const graine = options.accords ? morceauDeDepart(options.accords) : null;
      await page.addInitScript(([g, reglages]) => {
        if (sessionStorage.getItem('e2e-graine')) return;   // une seule fois : un rechargement garde ce que l'utilisateur a fait
        sessionStorage.setItem('e2e-graine', '1');
        sessionStorage.setItem('cc_accueil_vu', '1');
        if (g) {
          localStorage.setItem('harmohubSongs', JSON.stringify([{ id: 'e2e-1', name: g.nom, savedAt: Date.now(), sections: g.sections }]));
          localStorage.setItem('harmohubCurrentSongId', 'e2e-1');
          localStorage.setItem('myProgression', JSON.stringify({ sections: g.sections }));
        }
        for (const [k, v] of Object.entries(reglages || {})) localStorage.setItem(k, v as string);
      }, [graine, options.reglages || {}] as const);
      await page.goto('/index.html');
      await page.waitForFunction(() => !!(window as any).app);
      // Firebase (émulateur) répond « personne n'est connecté » : à la première visite, la fenêtre d'accueil du compte propose de se connecter.
      // Par défaut on la passe comme un utilisateur (« continuer sans compte ») ; `accueil: 'garder'` la laisse au test qui l'éprouve.
      const accueil = page.locator('#cloud-guard-modal'), pilule = page.locator('#google-signin-btn');
      await expect(accueil.or(pilule).first()).toBeVisible({ timeout: 15_000 });
      if ((options.accueil ?? 'passer') === 'passer' && await accueil.isVisible()) {
        await page.locator('#cloud-guard-continue').click();
        await expect(accueil).toBeHidden();
      }
      return page;
    });
  },
});

export { expect };
