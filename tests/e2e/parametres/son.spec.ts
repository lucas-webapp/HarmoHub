// MODULE « parametres » — section « Son » : volumes, son au déplacement, rythme des nouveaux accords, jouer à la sélection, décompte, son du métronome,
// « Écouter en éditant ». Le son est factice dans la VM : on lit le NIVEAU DE SORTIE (Tone.js), l'état de l'appli et les appels demandés, on n'écoute rien.
import { test, expect } from '../support/fixtures';
import {
  C_AM_F_G, estMobile, appuyer, ouvrir, fermer, deplierAvancees, interrupteur, curseur, liste, NOM, ecouterEnEditant, sonMetronome,
  lireStockage, lireEtat, sortie,
} from './aide-parametres';
import { vitesseMax, espionnerClics, nombreDeClics, boutonLecture, attendreFinDeLecture, enLecture } from '../lecture/aide-lecture';
import { taper } from '../tonalite/aide-tonalite';
import { ouvrirSurAccord, choisirAccord, grille } from '../sequenceur/aide-sequenceur';

const valeurAffichee = (l: import('@playwright/test').Locator) => l.locator('xpath=..');

test.describe('Son : volumes @parametres', () => {
  test('« Volume général » : 100 par défaut, le curseur règle la sortie (0 dB à 100, plus bas ensuite, muet à 0) et le nombre affiché suit @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrir(page);
    const c = curseur(page, 'Volume général');
    await expect(c).toHaveValue('100');
    await expect(valeurAffichee(c)).toContainText('100');
    expect(await sortie(page)).toEqual({ db: 0, muet: false });

    await c.fill('50');
    await expect(valeurAffichee(c)).toContainText('50');
    expect(await lireEtat(page, 'generalVolumePercent')).toBe(50);
    const moitie = await sortie(page);
    expect(moitie.muet).toBe(false);
    expect(moitie.db!).toBeLessThan(-3);      // nettement plus bas qu'à fond
    expect(moitie.db!).toBeGreaterThan(-40);  // mais pas éteint
    await c.fill('80');
    const quatreVingts = await sortie(page);
    expect(quatreVingts.db!).toBeLessThan(0);
    expect(quatreVingts.db!).toBeGreaterThan(moitie.db!);   // plus fort à 80 qu'à 50

    await c.fill('0');
    await expect(valeurAffichee(c)).toContainText('0');
    expect((await sortie(page)).muet).toBe(true);
    await c.fill('100');
    expect(await sortie(page)).toEqual({ db: 0, muet: false });
  });

  test('« Volume général » : de 0 à 100, ne dépasse pas ses bornes', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrir(page);
    for (const nom of ['Volume général', 'Volume du métronome']) {
      const c = curseur(page, nom);
      await expect(c).toHaveAttribute('min', '0');
      await expect(c).toHaveAttribute('max', '100');
    }
  });

  test('« Volume du métronome » : 80 par défaut, le curseur règle le niveau du métronome et le nombre affiché suit', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrir(page);
    const c = curseur(page, 'Volume du métronome');
    await expect(c).toHaveValue('80');
    await expect(valeurAffichee(c)).toContainText('80');
    await c.fill('30');
    await expect(valeurAffichee(c)).toContainText('30');
    expect(await lireEtat(page, 'metronomeVolumePercent')).toBe(30);
    expect(await lireStockage(page, 'harmohubMetronomeVolume')).toBe('30');
    expect(await lireEtat(page, 'generalVolumePercent')).toBe(100);   // l'autre volume n'a pas bougé
  });

  test('chaque volume est retrouvé après un rechargement : curseur, nombre affiché et sortie @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrir(page);
    await curseur(page, 'Volume général').fill('40');
    await curseur(page, 'Volume du métronome').fill('25');
    expect(await lireStockage(page, 'harmohubGeneralVolume')).toBe('40');
    await fermer(page);
    const avant = (await sortie(page)).db!;
    await page.reload();
    await page.waitForFunction(() => !!(window as any).app);
    expect(await lireEtat(page, 'generalVolumePercent')).toBe(40);
    expect(await lireEtat(page, 'metronomeVolumePercent')).toBe(25);
    await expect.poll(async () => (await sortie(page)).db!).toBeCloseTo(avant, 1);
    await ouvrir(page);
    await expect(curseur(page, 'Volume général')).toHaveValue('40');
    await expect(curseur(page, 'Volume du métronome')).toHaveValue('25');
    await expect(valeurAffichee(curseur(page, 'Volume général'))).toContainText('40');
  });
});

test.describe('Son : lecture et écoute @parametres', () => {
  test('« Décompte avant lecture » : allumé, la lecture commence par une mesure de 4 clics ; éteint, plus aucun clic @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await vitesseMax(page);
    await espionnerClics(page);
    await boutonLecture(page).click();
    await expect.poll(() => enLecture(page)).toBe(true);   // (la lecture démarre en asynchrone : on attend son début avant d'attendre sa fin)
    await attendreFinDeLecture(page);
    expect(await nombreDeClics(page)).toBe(4);   // décompte seul (métronome coupé par défaut)

    await ouvrir(page);
    await appuyer(page, interrupteur(page, NOM.decompte));
    await expect(interrupteur(page, NOM.decompte)).toHaveAttribute('aria-checked', 'false');
    expect(await lireEtat(page, 'metronomeCountIn')).toBe(false);
    expect(await lireStockage(page, 'harmohubMetronomeCountIn')).toBe('0');
    await fermer(page);
    await espionnerClics(page);
    await boutonLecture(page).click();
    await expect.poll(() => enLecture(page)).toBe(true);
    await attendreFinDeLecture(page);
    expect(await nombreDeClics(page)).toBe(0);
  });

  test('« Son du métronome » : cinq sonorités, le choix est retenu, et la lecture sonne avec chacune', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrir(page);
    await deplierAvancees(page);
    const l = sonMetronome(page);
    await expect(l.locator('option')).toHaveText(['Clic classique', 'Baguette', 'Clave', 'Cloche douce', 'Tic sec']);
    const cles = await l.locator('option').evaluateAll(os => os.map(o => (o as HTMLOptionElement).value));
    expect(cles).toHaveLength(5);
    // (le premier choix est déjà celui d'usine : il n'est écrit qu'en y revenant ; on finit donc par lui)
    for (const i of [1, 2, 3, 4, 0]) {
      const cle = cles[i];
      await l.selectOption({ index: i });
      expect(await lireEtat(page, 'metronomeSoundKey')).toBe(cle);
      expect(await lireStockage(page, 'harmohubMetronomeSound')).toBe(cle);
    }
    await l.selectOption({ label: 'Cloche douce' });
    await fermer(page);
    await vitesseMax(page);
    await espionnerClics(page);
    await boutonLecture(page).click();
    await expect.poll(() => enLecture(page)).toBe(true);
    await attendreFinDeLecture(page);
    expect(await nombreDeClics(page)).toBe(4);   // le décompte sonne avec la sonorité choisie
    await page.reload();
    await page.waitForFunction(() => !!(window as any).app);
    expect(await lireEtat(page, 'metronomeSoundKey')).toBe('bell');
    await ouvrir(page);
    await deplierAvancees(page);
    await expect(sonMetronome(page).locator('option:checked')).toHaveText('Cloche douce');
  });

  test('« Écouter en éditant » et « Son au déplacement » : allumés au départ, ils s\'éteignent et se rallument, et le choix est retenu', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrir(page);
    await deplierAvancees(page);
    await expect(ecouterEnEditant(page)).toHaveAttribute('aria-checked', 'true');
    await expect(interrupteur(page, NOM.sonDeplacement)).toHaveAttribute('aria-checked', 'true');
    await appuyer(page, ecouterEnEditant(page));
    await appuyer(page, interrupteur(page, NOM.sonDeplacement));
    await expect(ecouterEnEditant(page)).toHaveAttribute('aria-checked', 'false');
    await expect(interrupteur(page, NOM.sonDeplacement)).toHaveAttribute('aria-checked', 'false');
    expect(await lireEtat(page, 'seqEditAudio')).toBe(false);
    expect(await lireEtat(page, 'sonDeplacementSeq')).toBe(false);
    await page.reload();
    await page.waitForFunction(() => !!(window as any).app);
    expect(await lireEtat(page, 'seqEditAudio')).toBe(false);
    expect(await lireEtat(page, 'sonDeplacementSeq')).toBe(false);
    await ouvrir(page);
    await deplierAvancees(page);
    await expect(ecouterEnEditant(page)).toHaveAttribute('aria-checked', 'false');
    await expect(interrupteur(page, NOM.sonDeplacement)).toHaveAttribute('aria-checked', 'false');
    await appuyer(page, ecouterEnEditant(page));
    await expect(ecouterEnEditant(page)).toHaveAttribute('aria-checked', 'true');
    expect(await lireEtat(page, 'seqEditAudio')).toBe(true);
  });
});

test.describe('Son : sélection et rythme de départ @parametres @ordinateur', () => {
  const espionnerAccords = (page: import('@playwright/test').Page) => page.evaluate(() => {
    const a = (window as any).app;
    a.__accords = 0;
    if (a.__espion) return;
    a.__espion = true;
    const o = a.playSavedChord.bind(a);
    a.playSavedChord = (...x: any[]) => { if (x[2] !== false) a.__accords++; return o(...x); };   // 3ᵉ argument faux = sélectionner sans jouer
  });
  const accordsJoues = (page: import('@playwright/test').Page) => page.evaluate(() => (window as any).app.__accords as number);

  test('« Jouer à la sélection » : allumé, un clic ou une flèche sur une case la fait entendre ; éteint, la sélection reste muette', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await espionnerAccords(page);
    const cases = page.locator('#progression-sections .grid-cell[data-index]');
    await espionnerAccords(page);
    await cases.nth(0).click();
    await expect.poll(() => accordsJoues(page)).toBe(1);   // un clic sur une case la sélectionne et la fait entendre
    await espionnerAccords(page);
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => accordsJoues(page)).toBe(1);   // et la flèche aussi

    await ouvrir(page);
    await interrupteur(page, NOM.jouerSelection).click();
    await expect(interrupteur(page, NOM.jouerSelection)).toHaveAttribute('aria-checked', 'false');
    expect(await lireEtat(page, 'autoplaySelect')).toBe(false);
    expect(await lireStockage(page, 'harmohubAutoplaySelect')).toBe('0');
    await fermer(page);
    await espionnerAccords(page);
    await cases.nth(0).click();   // (ouvrir la fenêtre a levé la sélection)
    await expect(cases.nth(0)).toHaveClass(/\bselected\b/);
    expect(await accordsJoues(page)).toBe(0);                  // le clic sélectionne sans un son
    await page.keyboard.press('ArrowRight');
    await expect(cases.nth(1)).toHaveClass(/\bselected\b/);   // la sélection a bien bougé…
    expect(await accordsJoues(page)).toBe(0);                  // …sans un son
  });

  test('« Rythme des nouveaux accords » : un accord ajouté prend le rythme choisi ; ceux déjà écrits gardent le leur @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: [{ root: 'C', quality: '' }, { root: 'A', quality: 'min' }] });
    await ouvrir(page);
    await expect(liste(page, 'Rythme des nouveaux accords').locator('option')).toHaveText(['Une note tenue sur le premier temps', 'Des notes tenues sur tous les temps']);
    await liste(page, 'Rythme des nouveaux accords').selectOption('noire_maintenu');
    await fermer(page);
    await taper(page, 'Dm');
    const styles = () => page.evaluate(() => (JSON.parse(localStorage.getItem('myProgression')!).sections as any[]).flatMap(s => s.chords.map((c: any) => c.root + c.quality + ':' + c.playStyle)));
    await expect.poll(styles).toEqual(['C:held', 'Amin:held', 'Dmin:noire_maintenu']);

    // on le voit dans le séquenceur : le nouvel accord porte des notes sur plus de temps que l'ancien
    await ouvrirSurAccord(page, 2);
    // (une note qui en continue une autre est « soudée à gauche » : on compte les attaques, pas les cases)
    const attaques = (c: number) => grille(page).locator(`.sq-case.on[data-c="${c}"]:not(.soude-g)`).count();
    const nouveau = await attaques(2);
    await choisirAccord(page, 0);
    const ancien = await attaques(0);
    expect(ancien).toBe(3);                  // une note tenue par voix (3 voix) : tout le temps de l'accord
    expect(nouveau).toBe(12);                // une note par temps et par voix : 4 temps × 3 voix

    // retour au rythme d'usine : le suivant est de nouveau « une note tenue »
    await page.keyboard.press('Escape');
    await ouvrir(page);
    await liste(page, 'Rythme des nouveaux accords').selectOption('held');
    await fermer(page);
    await taper(page, 'Em');
    await expect.poll(styles).toEqual(['C:held', 'Amin:held', 'Dmin:noire_maintenu', 'Emin:held']);
  });
});
