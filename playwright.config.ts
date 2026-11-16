// Tests de bout en bout d'HarmoHub (@playwright/test). Plan, modules et état : tests/PLAN.md.
// Les « bancs » historiques (tests/*_test.js, scripts Node) ne passent PAS par ce fichier : voir tests/README.md.
import { defineConfig, devices } from '@playwright/test';

const CI = !!process.env.CI;
const PORT = Number(process.env.PORT_APPLI || 8936);
// Tags d'appareil : un test « @ordinateur » ne tourne que sur les mises en page ≥ 900 px, un test « @mobile » que sous 900 px ; sans tag, partout.
const ORDINATEUR = { grepInvert: /@mobile\b/ };
const MOBILE = { grepInvert: /@ordinateur\b/ };

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results',
  globalSetup: './tests/e2e/support/global-setup.ts',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: CI ? 2 : 3,
  timeout: 45_000,
  expect: { timeout: 7_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }], ['json', { outputFile: 'test-results/resultats.json' }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',   // les fichiers « @smoke » forcent `video: 'on'` (toujours filmés)
    serviceWorkers: 'block',
  },
  webServer: {
    command: 'node scripts/serveur-test.cjs',
    url: `http://127.0.0.1:${PORT}/index.html`,
    reuseExistingServer: !CI,
    timeout: 60_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }, ...ORDINATEUR },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 } }, ...ORDINATEUR },
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } }, ...ORDINATEUR },
    { name: 'edge', use: { ...devices['Desktop Edge'], channel: 'msedge', viewport: { width: 1440, height: 900 } }, ...ORDINATEUR },
    { name: 'mobile-android', use: { ...devices['Pixel 7'] }, ...MOBILE },
    { name: 'mobile-iphone', use: { ...devices['iPhone 15'] }, ...MOBILE },
    { name: 'tablette', use: { ...devices['iPad Pro 11 landscape'] }, ...ORDINATEUR },
  ],
});
