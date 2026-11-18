// MODULE « synchro » — l'ENVOI du morceau dans le cloud et sa RELECTURE sur un 2ᵉ appareil (un 2ᵉ contexte de navigateur = un autre stockage local).
// Les comptes sont FICTIFS (émulateur Auth), le cloud est l'émulateur Firestore avec les règles de production. Seuls les morceaux ENREGISTRÉS partent.
import {
  test, expect, DO_SOL_DO, C_AM_F_G, emailDe, connecter, attendreSynchronise, pastille, morceauxCloud, morceauxLocaux, accordsAffiches, titre, etat,
  ouvrirMorceauDeLaListe, renommerPartieEtEnregistrer, bibliotheque, attendreNomsCloud, attendreNomsLocaux, titrePartie, documentCloud,
  ouvrirMesMorceaux, ligne, repondreAuxBoitesNatives, boutonEnregistrer, fenetreMorceaux, creerMorceau,
} from './aide-synchro';

const DEUX_MORCEAUX = bibliotheque([
  { id: 'a', nom: 'Alpha', accords: C_AM_F_G },
  { id: 'b', nom: 'Bravo', accords: DO_SOL_DO },
], 'a');

test.describe('Envoi du morceau et relecture sur un 2ᵉ appareil @synchro', () => {
  test('se connecter envoie toute la bibliothèque enregistrée sous ce compte, et la pastille passe à « Synchronisé » @critique', async ({ ouvrirAppli }, testInfo) => {
    const page = await ouvrirAppli({ reglages: DEUX_MORCEAUX });
    const uid = await connecter(page, emailDe(testInfo));
    await attendreSynchronise(page);
    await expect(pastille(page)).toHaveAttribute('aria-label', 'Synchronisé avec le cloud');
    await attendreNomsCloud(uid, ['Alpha', 'Bravo']);
    const cloud = await morceauxCloud(uid);
    expect(cloud.find(m => m.name === 'Alpha')!.accords).toEqual(['Cmaj', 'Amin', 'Fmaj', 'Gmaj']);
    expect(cloud.find(m => m.name === 'Bravo')!.accords).toEqual(['Dmin7', 'Gdom7', 'Cmaj7']);
    // Le document du compte porte son identité d'application et un numéro de schéma (les trois applis du projet partagent le même projet Firebase).
    const doc = await documentCloud(uid, 'harmohub');
    expect(doc.app).toBe('HarmoHub');
    expect(doc.schema).toBe(1);
  });

  test('« Enregistrer » une modification l\'envoie : la pastille repasse à « Synchronisé » et le cloud porte la nouvelle partie @critique', async ({ ouvrirAppli }, testInfo) => {
    const page = await ouvrirAppli({ reglages: DEUX_MORCEAUX });
    const uid = await connecter(page, emailDe(testInfo));
    await attendreSynchronise(page);
    await renommerPartieEtEnregistrer(page, 'Refrain');
    await expect.poll(async () => (await morceauxCloud(uid)).find(m => m.name === 'Alpha')!.titres, { timeout: 20_000 }).toEqual(['Refrain']);
    await attendreSynchronise(page);
    // L'autre morceau n'a pas bougé.
    expect((await morceauxCloud(uid)).find(m => m.name === 'Bravo')!.titres).toEqual(['Couplet']);
  });

  test('un brouillon NON enregistré ne part pas dans le cloud (« Enregistrer reste manuel »)', async ({ ouvrirAppli }, testInfo) => {
    const page = await ouvrirAppli({ reglages: DEUX_MORCEAUX });
    const uid = await connecter(page, emailDe(testInfo));
    await attendreSynchronise(page);
    await attendreNomsCloud(uid, ['Alpha', 'Bravo']);
    await titrePartie(page).fill('Brouillon');
    await titrePartie(page).press('Enter');
    await expect(etat(page)).toContainText('Non enregistré');
    await attendreSynchronise(page);
    expect((await morceauxCloud(uid)).find(m => m.name === 'Alpha')!.titres).toEqual(['Couplet']);
    // Puis l'enregistrement le fait partir (la preuve que le silence précédent n'était pas une panne).
    await boutonEnregistrer(page).click();
    await expect.poll(async () => (await morceauxCloud(uid)).find(m => m.name === 'Alpha')!.titres, { timeout: 20_000 }).toEqual(['Brouillon']);
  });

  test('un 2ᵉ appareil vide retrouve la bibliothèque à la connexion ; ouvrir le morceau affiche les mêmes accords @critique', async ({ ouvrirAppli, nouvelAppareilOuvert }, testInfo) => {
    const a = await ouvrirAppli({ reglages: DEUX_MORCEAUX });
    const email = emailDe(testInfo);
    const uid = await connecter(a, email);
    await attendreNomsCloud(uid, ['Alpha', 'Bravo']);

    const b = await nouvelAppareilOuvert();
    expect(await morceauxLocaux(b)).toEqual([]);   // un appareil neuf : rien en local
    await expect(titre(b)).toHaveText('Nouveau morceau');
    await connecter(b, email);
    await attendreNomsLocaux(b, ['Alpha', 'Bravo']);
    await attendreSynchronise(b);
    await ouvrirMorceauDeLaListe(b, 'Alpha');
    expect(await accordsAffiches(b)).toEqual(await accordsAffiches(a));
    expect((await accordsAffiches(b)).length).toBe(4);
    await ouvrirMorceauDeLaListe(b, 'Bravo');
    expect((await accordsAffiches(b)).map(t => t.split(' ')[0])).toEqual(['Dm7', 'G7', 'Cmaj7']);
  });

  test('une modification enregistrée sur l\'appareil A arrive EN DIRECT sur l\'appareil B, sans recharger @critique', async ({ ouvrirAppli, nouvelAppareilOuvert }, testInfo) => {
    const a = await ouvrirAppli({ reglages: DEUX_MORCEAUX });
    const email = emailDe(testInfo);
    await connecter(a, email);
    await attendreSynchronise(a);
    const b = await nouvelAppareilOuvert();
    await connecter(b, email);
    await attendreNomsLocaux(b, ['Alpha', 'Bravo']);
    await ouvrirMorceauDeLaListe(b, 'Alpha');
    await expect(titrePartie(b)).toHaveValue('Couplet');

    await renommerPartieEtEnregistrer(a, 'Refrain');
    await expect.poll(async () => (await morceauxLocaux(b)).find(m => m.name === 'Alpha')!.titres, { timeout: 20_000 }).toEqual(['Refrain']);
    // L'autre morceau reste intact, et B est toujours sur son compte, sans recharger.
    expect((await morceauxLocaux(b)).find(m => m.name === 'Bravo')!.titres).toEqual(['Couplet']);
    await expect(b.locator('#account-info')).toBeVisible();
  });

  test('un morceau neuf créé et enregistré sur B apparaît dans la liste de A', async ({ ouvrirAppli, nouvelAppareilOuvert }, testInfo) => {
    const a = await ouvrirAppli({ reglages: DEUX_MORCEAUX });
    const email = emailDe(testInfo);
    const uid = await connecter(a, email);
    await attendreNomsCloud(uid, ['Alpha', 'Bravo']);
    const b = await nouvelAppareilOuvert();
    await connecter(b, email);
    await attendreNomsLocaux(b, ['Alpha', 'Bravo']);

    await creerMorceau(b, 'Charlie');
    if (b.viewportSize()!.width < 900) {   // téléphone : « + Accord » ouvre le panneau d'ajout ; ordinateur : la case « + » du bout de la partie
      await b.locator('.prog-section-ajout').first().click();
      await b.locator('#quick-add-input').fill('Em');
      await b.locator('#quick-add-btn').click();
      await b.keyboard.press('Escape');
    } else {
      const plus = b.getByRole('textbox', { name: 'Ajouter un accord à la fin de cette partie' }).first();
      await plus.click(); await plus.fill('Em'); await plus.press('Enter');
    }
    await expect.poll(() => accordsAffiches(b)).toHaveLength(1);
    await expect(titre(b)).toHaveText('Charlie');
    await boutonEnregistrer(b).click();
    await expect(etat(b)).toContainText(/Enregistré à \d{1,2}:\d{2}/);
    await attendreNomsCloud(uid, ['Alpha', 'Bravo', 'Charlie']);
    // Le morceau peut arriver avant son contenu : on attend les accords d'abord dans le cloud, puis sur A, avant d'ouvrir.
    await expect.poll(async () => (await morceauxCloud(uid)).find(m => m.name === 'Charlie')!.accords, { timeout: 20_000 }).toEqual(['Emin']);
    await attendreNomsLocaux(a, ['Alpha', 'Bravo', 'Charlie']);
    await expect.poll(async () => (await morceauxLocaux(a)).find(m => m.name === 'Charlie')!.accords, { timeout: 20_000 }).toEqual(['Emin']);
    await ouvrirMorceauDeLaListe(a, 'Charlie');
    expect((await accordsAffiches(a)).map(t => t.split(' ')[0])).toEqual(['Em']);
  });

  test('deux bibliothèques DIFFÉRENTES se fusionnent à la connexion : chaque appareil garde ses morceaux et reçoit ceux de l\'autre @critique', async ({ ouvrirAppli, nouvelAppareilOuvert }, testInfo) => {
    const a = await ouvrirAppli({ reglages: bibliotheque([{ id: 'a', nom: 'Alpha', accords: C_AM_F_G }], 'a') });
    const email = emailDe(testInfo);
    const uid = await connecter(a, email);
    await attendreNomsCloud(uid, ['Alpha']);

    // L'appareil B a déjà un morceau à lui, jamais envoyé.
    const b = await nouvelAppareilOuvert({ bibliotheque: bibliotheque([{ id: 'z', nom: 'Zulu', accords: DO_SOL_DO }], 'z') });
    expect((await morceauxLocaux(b)).map(m => m.name)).toEqual(['Zulu']);
    await connecter(b, email);
    await attendreNomsLocaux(b, ['Alpha', 'Zulu']);
    await attendreNomsCloud(uid, ['Alpha', 'Zulu']);
    await attendreNomsLocaux(a, ['Alpha', 'Zulu']);
  });

  test('supprimer un morceau sur A le retire du cloud et de B ; un appareil absent pendant ce temps ne le ressuscite pas @critique', async ({ ouvrirAppli, nouvelAppareilOuvert }, testInfo) => {
    const a = await ouvrirAppli({ reglages: DEUX_MORCEAUX });
    const email = emailDe(testInfo);
    const uid = await connecter(a, email);
    await attendreNomsCloud(uid, ['Alpha', 'Bravo']);
    const b = await nouvelAppareilOuvert();
    await connecter(b, email);
    await attendreNomsLocaux(b, ['Alpha', 'Bravo']);
    await attendreSynchronise(b);

    // B perd le réseau, A supprime « Bravo », puis B revient.
    await b.context().setOffline(true);
    await expect(pastille(b)).toHaveAttribute('data-etat', 'offline', { timeout: 20_000 });
    repondreAuxBoitesNatives(a, true);
    await ouvrirMesMorceaux(a);
    await ligne(a, 'Bravo').getByRole('button', { name: 'Supprimer' }).click();
    await expect(ligne(a, 'Bravo')).toHaveCount(0);
    await attendreNomsCloud(uid, ['Alpha']);
    await expect(fenetreMorceaux(a)).toBeVisible();

    await b.context().setOffline(false);
    await attendreSynchronise(b);
    await attendreNomsLocaux(b, ['Alpha']);
    // Le cloud n'a pas été repeuplé par l'appareil qui revenait.
    await expect.poll(async () => (await morceauxCloud(uid)).map(m => m.name), { timeout: 5_000 }).toEqual(['Alpha']);
    await expect.poll(async () => (await morceauxLocaux(a)).map(m => m.name)).toEqual(['Alpha']);
  });
});
