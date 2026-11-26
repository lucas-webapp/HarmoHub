// MODULE « synchro » — la STRUCTURE du morceau voyage dans le cloud, sans « Enregistrer », et se relit sur un 2ᵉ appareil (demande de l'utilisateur du 26/11 : « très importante »).
// Un geste d'arrangement entre dans le morceau aussitôt (voir persisterStructureDansMorceau) : il part donc dans le cloud comme n'importe quelle modification du morceau.
// Comptes fictifs (émulateur Auth), cloud = émulateur Firestore avec les règles de production. Un « appareil » = un contexte de navigateur.
import {
  test, expect, emailDe, connecter, attendreSynchronise, pastille, documentCloud, attendreNomsLocaux, ouvrirMorceauDeLaListe, enregistrerSous,
} from './aide-synchro';
import {
  morceauTroisParties, ouvrirStructure, lire, titresLignes, repsLignes, plus, moins, monter, renommer, commenter, appuyer, lignes, estMobile,
} from '../structure/aide-structure';
import type { Page } from '@playwright/test';

// NOTE (constat du 26/11, non corrigé) : modifier le morceau dans la toute première seconde qui suit la connexion, avant la première synchro, peut faire ranger dans « Archives »
// une copie « arch_… » de l'envoi précédent du MÊME appareil (`base` absent = « concurrent par défaut » dans fusionnerBibliotheques). Inoffensif, mais visible : les tests
// attendent donc « Synchronisé » avant d'arranger, comme le fait l'utilisateur dès qu'il lève les yeux vers la pastille.

type Occ = { id: string; sid: string; rep: number; label: string; notes: { texte: string }[] };
// La structure du morceau « Démo » dans le cloud (le morceau y est rangé comme une chaîne JSON) et dans le stockage local d'un appareil.
const structureCloud = async (uid: string): Promise<Occ[] | null> => {
  const d = await documentCloud(uid, 'harmohub');
  const s = ((d && d.songs) || []).find((x: any) => x.name === 'Démo');
  return s ? (JSON.parse(s.json).structure || null) : null;
};
const structureLocale = (page: Page): Promise<Occ[] | null> => page.evaluate(() => {
  const s = (JSON.parse(localStorage.getItem('harmohubSongs') || '[]') as any[]).find(x => x.name === 'Démo');
  return s ? (s.structure || null) : null;
});
const resume = (o: Occ[] | null) => (o || []).map(x => [x.rep, x.label, x.notes.map(n => n.texte).join('|')]);

async function arranger(page: Page) {
  await ouvrirStructure(page);
  await appuyer(page, plus(page, 0));                                  // Couplet ×2
  await renommer(page, 1, 'Refrain final');
  await commenter(page, 1, 'à fond');
  await appuyer(page, monter(page, 2));                                // Couplet, Pont, Refrain final
}
const ARRANGEMENT = [[2, '', ''], [1, '', ''], [1, 'Refrain final', 'à fond']];

test.describe('La structure dans le cloud @synchro', () => {
  test('un geste d\'arrangement part dans le cloud SANS « Enregistrer » ; le cloud porte la structure telle quelle @critique', async ({ ouvrirAppli }, testInfo) => {
    const a = await ouvrirAppli(morceauTroisParties());
    const uid = await connecter(a, emailDe(testInfo));
    await attendreSynchronise(a);
    expect(await structureCloud(uid)).toBeNull();                      // pas encore arrangé : le cloud ne porte pas de structure
    await arranger(a);
    await expect.poll(async () => resume(await structureCloud(uid)), { timeout: 20_000 }).toEqual(ARRANGEMENT);
    expect(await structureCloud(uid)).toEqual(await structureLocale(a));   // octet pour octet : identités des occurrences et des parties comprises
    await attendreSynchronise(a);
  });

  test('un appareil neuf, connecté au même compte, retrouve l\'arrangement dans la fenêtre Structure @critique', async ({ ouvrirAppli, nouvelAppareilOuvert }, testInfo) => {
    const a = await ouvrirAppli(morceauTroisParties());
    const email = emailDe(testInfo);
    const uid = await connecter(a, email);
    await attendreSynchronise(a);
    await arranger(a);
    await expect.poll(async () => resume(await structureCloud(uid)), { timeout: 20_000 }).toEqual(ARRANGEMENT);

    const b = await nouvelAppareilOuvert();
    expect(await structureLocale(b)).toBeNull();
    await connecter(b, email);
    await attendreNomsLocaux(b, ['Démo']);
    await attendreSynchronise(b);
    await ouvrirMorceauDeLaListe(b, 'Démo');
    await ouvrirStructure(b);
    expect(await titresLignes(b)).toEqual(['Couplet', 'Pont', 'Refrain final']);
    expect(await repsLignes(b)).toEqual(['×2', '', '']);
    expect((await lire(b)).lignes[2].notes).toEqual(['à fond']);
    expect((await lire(b)).mesures).toBe('12 mesures');                // Couplet ×2 (6) + Pont (2) + Refrain (4) : les mêmes totaux sur les deux appareils
  });

  test('une modification de A arrive EN DIRECT sur B : le morceau et la fenêtre Structure ouverte se mettent à jour @critique', async ({ ouvrirAppli, nouvelAppareilOuvert }, testInfo) => {
    const a = await ouvrirAppli(morceauTroisParties());
    const email = emailDe(testInfo);
    const uid = await connecter(a, email);
    await attendreSynchronise(a);
    await arranger(a);
    await expect.poll(async () => resume(await structureCloud(uid)), { timeout: 20_000 }).toEqual(ARRANGEMENT);
    const b = await nouvelAppareilOuvert();
    await connecter(b, email);
    await attendreNomsLocaux(b, ['Démo']);
    await ouvrirMorceauDeLaListe(b, 'Démo');
    await ouvrirStructure(b);
    expect(await repsLignes(b)).toEqual(['×2', '', '']);

    await a.bringToFront();
    await appuyer(a, plus(a, 1));                                      // A : Pont ×2
    await expect.poll(async () => resume(await structureLocale(b)), { timeout: 20_000 }).toEqual([[2, '', ''], [2, '', ''], [1, 'Refrain final', 'à fond']]);
    await expect(lignes(b).nth(1).locator('.struct-rep')).toHaveText('×2', { timeout: 15_000 });   // la fenêtre ouverte sur B suit, sans la rouvrir
    expect((await lire(b)).mesures).toBe('14 mesures');                // Couplet ×2 (6) + Pont ×2 (4) + Refrain (4)
  });

  test('annuler (Ctrl+Z) un geste de structure sur A revient aussi dans le cloud et sur B @critique', async ({ ouvrirAppli, nouvelAppareilOuvert }, testInfo) => {
    const a = await ouvrirAppli(morceauTroisParties());
    const email = emailDe(testInfo);
    const uid = await connecter(a, email);
    await attendreSynchronise(a);
    await ouvrirStructure(a);
    await appuyer(a, plus(a, 0));
    await expect.poll(async () => resume(await structureCloud(uid)), { timeout: 20_000 }).toEqual([[2, '', ''], [1, '', ''], [1, '', '']]);
    const b = await nouvelAppareilOuvert();
    await connecter(b, email);
    await attendreNomsLocaux(b, ['Démo']);
    await expect.poll(async () => resume(await structureLocale(b)), { timeout: 20_000 }).toEqual([[2, '', ''], [1, '', ''], [1, '', '']]);

    await a.bringToFront();
    await a.keyboard.press('Control+z');
    // Revenue avant le premier geste, la structure est de nouveau DÉDUITE de la grille : le morceau n'en porte plus (ni dans le cloud, ni sur B).
    await expect.poll(async () => await structureCloud(uid), { timeout: 20_000 }).toBeNull();
    await expect.poll(async () => await structureLocale(b), { timeout: 20_000 }).toBeNull();
    await a.keyboard.press('Control+y');                                // et la rétablir la renvoie partout
    await expect.poll(async () => (await structureCloud(uid) || []).map(o => o.rep), { timeout: 20_000 }).toEqual([2, 1, 1]);
    await expect.poll(async () => (await structureLocale(b) || []).map(o => o.rep), { timeout: 20_000 }).toEqual([2, 1, 1]);
  });

  test('un glissé de ligne est un geste d\'arrangement comme un autre : il part dans le cloud', async ({ ouvrirAppli }, testInfo) => {
    const a = await ouvrirAppli(morceauTroisParties());
    const uid = await connecter(a, emailDe(testInfo));
    await attendreSynchronise(a);
    await ouvrirStructure(a);
    const h = (await lignes(a).nth(0).locator('.struct-poignee').boundingBox())!;
    const bas = (await lignes(a).nth(2).boundingBox())!;
    await a.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
    await a.mouse.down();
    await a.mouse.move(h.x + h.width / 2, h.y + h.height / 2 + 4, { steps: 2 });
    await a.mouse.move(h.x + h.width / 2, bas.y + bas.height - 2, { steps: 8 });
    await a.mouse.up();
    expect(await titresLignes(a)).toEqual(['Refrain', 'Pont', 'Couplet']);
    await expect.poll(async () => (await structureCloud(uid) || []).length, { timeout: 20_000 }).toBe(3);
    expect(await structureCloud(uid)).toEqual(await structureLocale(a));
  });

  test('hors ligne : l\'arrangement reste en local, puis part dans le cloud au retour du réseau @critique', async ({ ouvrirAppli }, testInfo) => {
    const a = await ouvrirAppli(morceauTroisParties());
    const uid = await connecter(a, emailDe(testInfo));
    await attendreSynchronise(a);
    await a.context().setOffline(true);
    await expect(pastille(a)).toHaveAttribute('data-etat', 'offline', { timeout: 20_000 });
    await arranger(a);
    expect(resume(await structureLocale(a))).toEqual(ARRANGEMENT);     // le travail continue, en local
    await a.context().setOffline(false);
    await attendreSynchronise(a);
    await expect.poll(async () => resume(await structureCloud(uid)), { timeout: 20_000 }).toEqual(ARRANGEMENT);
  });

  test('deux appareils modifient l\'arrangement l\'un après l\'autre : les deux convergent, rien ne se perd en silence', async ({ ouvrirAppli, nouvelAppareilOuvert }, testInfo) => {
    const a = await ouvrirAppli(morceauTroisParties());
    const email = emailDe(testInfo);
    const uid = await connecter(a, email);
    await attendreSynchronise(a);
    await ouvrirStructure(a);
    await appuyer(a, plus(a, 0));                                      // A : Couplet ×2
    await expect.poll(async () => (await structureCloud(uid) || []).map(o => o.rep), { timeout: 20_000 }).toEqual([2, 1, 1]);
    const b = await nouvelAppareilOuvert();
    await connecter(b, email);
    await attendreNomsLocaux(b, ['Démo']);
    await expect.poll(async () => (await structureLocale(b) || []).map(o => o.rep), { timeout: 20_000 }).toEqual([2, 1, 1]);
    await ouvrirMorceauDeLaListe(b, 'Démo');
    await ouvrirStructure(b);
    await appuyer(b, plus(b, 2));                                      // B (qui a reçu ×2) : Pont ×2
    await expect.poll(async () => (await structureCloud(uid) || []).map(o => o.rep), { timeout: 20_000 }).toEqual([2, 1, 2]);
    await expect.poll(async () => (await structureLocale(a) || []).map(o => o.rep), { timeout: 20_000 }).toEqual([2, 1, 2]);
    await a.bringToFront();
    await expect(lignes(a).nth(2).locator('.struct-rep')).toHaveText('×2', { timeout: 15_000 });
  });

  test('conflit : A arrange hors ligne, B arrange plus tard — B gagne partout, l\'arrangement de A est gardé dans « Archives » @critique', async ({ ouvrirAppli, nouvelAppareilOuvert }, testInfo) => {
    const a = await ouvrirAppli(morceauTroisParties());
    const email = emailDe(testInfo);
    const uid = await connecter(a, email);
    await attendreSynchronise(a);
    const b = await nouvelAppareilOuvert();
    await connecter(b, email);
    await attendreNomsLocaux(b, ['Démo']);
    await attendreSynchronise(b);
    await ouvrirMorceauDeLaListe(b, 'Démo');

    await a.context().setOffline(true);
    await expect(pastille(a)).toHaveAttribute('data-etat', 'offline', { timeout: 20_000 });
    await ouvrirStructure(a);
    await appuyer(a, plus(a, 0));                                       // A (hors ligne) : Couplet ×2
    expect((await structureLocale(a) || []).map(o => o.rep)).toEqual([2, 1, 1]);
    await b.waitForTimeout(1100);                                       // B agit nettement APRÈS A (la date de modification tranche)
    await ouvrirStructure(b);
    await appuyer(b, plus(b, 2));                                       // B (en ligne) : Pont ×2
    await expect.poll(async () => (await structureCloud(uid) || []).map(o => o.rep), { timeout: 20_000 }).toEqual([1, 1, 2]);

    await a.context().setOffline(false);
    await attendreSynchronise(a);
    await expect.poll(async () => (await structureLocale(a) || []).map(o => o.rep), { timeout: 20_000 }).toEqual([1, 1, 2]);   // B gagne sur A aussi
    expect((await structureCloud(uid) || []).map(o => o.rep)).toEqual([1, 1, 2]);
    // La version écartée n'est pas perdue : un exemplaire « arch_… » garde l'arrangement de A.
    const archives = await a.evaluate(() => (JSON.parse(localStorage.getItem('harmohubSongs') || '[]') as any[]).filter(s => String(s.id).startsWith('arch_')).map(s => (s.structure || []).map((o: any) => o.rep)));
    expect(archives).toEqual([[2, 1, 1]]);
  });

  test('un morceau neuf, arrangé AVANT d\'être nommé, part dans le cloud AVEC sa structure une fois enregistré', async ({ ouvrirAppli }, testInfo) => {
    const a = await ouvrirAppli({});
    test.skip(estMobile(a), 'la saisie d\'accord « à la fin » est celle de l\'ordinateur ; le reste est commun aux appareils');
    const uid = await connecter(a, emailDe(testInfo));
    await attendreSynchronise(a);
    const champ = a.getByRole('textbox', { name: 'Ajouter un accord à la fin de cette partie' }).first();
    await champ.fill('C'); await champ.press('Enter');
    await champ.fill('G'); await champ.press('Enter');
    await ouvrirStructure(a);
    await appuyer(a, plus(a, 0));                                       // une seule partie : ×2 (morceau pas encore nommé : l'arrangement est dans le tampon)
    await a.getByRole('button', { name: 'Grille', exact: true }).click();
    await enregistrerSous(a, 'Neuf');
    await expect.poll(async () => {
      const d = await documentCloud(uid, 'harmohub');
      const s = ((d && d.songs) || []).find((x: any) => x.name === 'Neuf');
      return s ? (JSON.parse(s.json).structure || []).map((o: any) => o.rep) : null;
    }, { timeout: 20_000 }).toEqual([2]);
  });
});
