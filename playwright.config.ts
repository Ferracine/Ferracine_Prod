import { defineConfig, devices } from '@playwright/test';

// Roda contra o build de produção (`pnpm build` antes), no Chrome instalado, com tela de celular.
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    ...devices['Pixel 7'],
    channel: 'chrome',
    baseURL: 'http://localhost:4173',
    locale: 'pt-BR',
    timezoneId: 'America/Porto_Velho',
  },
  webServer: {
    command: 'pnpm preview',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
  },
});
