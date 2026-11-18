// MODULE « synchro » — LES RÈGLES DE SÉCURITÉ FIRESTORE (firestore.rules = copie de la production, appliquée par l'émulateur, jamais déployée).
// Règle : seul l'utilisateur CONNECTÉ lit et écrit `users/{son uid}/apps/{appli}`. Tout le reste est refusé.
// Ces tests parlent à l'API REST de l'émulateur : le résultat ne dépend pas du navigateur, ils ne tournent donc que sur `chromium`.
import { test, expect, emailDe, connecter, attendreNomsCloud, bibliotheque, C_AM_F_G, DO_SOL_DO } from './aide-synchro';
import { creerCompte, PROJET, FIRESTORE } from '../support/emulateurs';

const BASE = `http://${FIRESTORE}/v1/projects/${PROJET}/databases/(default)/documents`;
const doc = (chemin: string, jeton?: string, methode = 'GET', corps?: object) =>
  fetch(`${BASE}/${chemin}`, {
    method: methode,
    headers: { ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}), 'Content-Type': 'application/json' },
    body: corps ? JSON.stringify(corps) : undefined,
  });
const CONTENU = { fields: { note: { stringValue: 'secret de test' } } };

test.describe('Règles de sécurité Firestore (émulateur) @synchro', () => {
  test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'chromium', 'Règles évaluées par l\'émulateur : identiques pour tous les navigateurs, jouées sur chromium seulement'); });

  test('le propriétaire écrit puis relit son document d\'appli @critique', async ({}, testInfo) => {
    const { uid, idToken } = await creerCompte(emailDe(testInfo, 'proprio'));
    const ecriture = await doc(`users/${uid}/apps/harmohub-regles`, idToken, 'PATCH', CONTENU);
    expect(ecriture.status).toBe(200);
    const lecture = await doc(`users/${uid}/apps/harmohub-regles`, idToken);
    expect(lecture.status).toBe(200);
    expect(((await lecture.json()) as any).fields.note.stringValue).toBe('secret de test');
  });

  test('un AUTRE compte connecté ne lit ni n\'écrit le document d\'un tiers @critique', async ({}, testInfo) => {
    const proprio = await creerCompte(emailDe(testInfo, 'proprio'));
    const intrus = await creerCompte(emailDe(testInfo, 'intrus'));
    expect((await doc(`users/${proprio.uid}/apps/harmohub-regles`, proprio.idToken, 'PATCH', CONTENU)).status).toBe(200);
    expect((await doc(`users/${proprio.uid}/apps/harmohub-regles`, intrus.idToken)).status).toBe(403);
    expect((await doc(`users/${proprio.uid}/apps/harmohub-regles`, intrus.idToken, 'PATCH', { fields: { note: { stringValue: 'piraté' } } })).status).toBe(403);
    // Le document n'a pas bougé.
    const relu: any = await (await doc(`users/${proprio.uid}/apps/harmohub-regles`, proprio.idToken)).json();
    expect(relu.fields.note.stringValue).toBe('secret de test');
  });

  test('sans connexion, ni lecture ni écriture @critique', async ({}, testInfo) => {
    const proprio = await creerCompte(emailDe(testInfo, 'proprio'));
    expect((await doc(`users/${proprio.uid}/apps/harmohub-regles`, proprio.idToken, 'PATCH', CONTENU)).status).toBe(200);
    expect((await doc(`users/${proprio.uid}/apps/harmohub-regles`)).status).toBe(403);
    expect((await doc(`users/${proprio.uid}/apps/harmohub-regles`, undefined, 'PATCH', CONTENU)).status).toBe(403);
    expect((await doc(`users/${proprio.uid}/apps`)).status).toBe(403);   // pas non plus de liste
  });

  test('même le propriétaire ne peut rien écrire hors de « users/{uid}/apps/{appli} »', async ({}, testInfo) => {
    const { uid, idToken } = await creerCompte(emailDe(testInfo, 'proprio'));
    expect((await doc(`users/${uid}/profil/moi`, idToken, 'PATCH', CONTENU)).status).toBe(403);
    expect((await doc(`users/${uid}`, idToken, 'PATCH', CONTENU)).status).toBe(403);
    expect((await doc(`publics/${uid}`, idToken, 'PATCH', CONTENU)).status).toBe(403);
    expect((await doc(`users/${uid}/profil/moi`, idToken)).status).toBe(403);
  });

  test('le document que l\'appli écrit pour un compte est refusé à un autre compte et aux inconnus @critique', async ({ ouvrirAppli }, testInfo) => {
    const page = await ouvrirAppli({ reglages: bibliotheque([{ id: 'a', nom: 'Alpha', accords: C_AM_F_G }, { id: 'b', nom: 'Bravo', accords: DO_SOL_DO }], 'a') });
    const uid = await connecter(page, emailDe(testInfo));
    await attendreNomsCloud(uid, ['Alpha', 'Bravo']);
    const intrus = await creerCompte(emailDe(testInfo, 'intrus'));
    for (const nom of ['harmohub', 'harmohub-versions', 'harmohub-formes', 'harmohub-doigtes', 'harmohub-paroles']) {
      expect((await doc(`users/${uid}/apps/${nom}`, intrus.idToken)).status, `${nom} lu par un autre compte`).toBe(403);
      expect((await doc(`users/${uid}/apps/${nom}`)).status, `${nom} lu sans connexion`).toBe(403);
    }
  });
});
