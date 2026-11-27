import { defineConfig, devices } from '@playwright/test';

// Roda contra o build de produção (`pnpm build` antes), no Chrome instalado, com tela de celular.
export default defineConfig({
  testDir: 'tests/e2e',
  // Referências sem o sufixo do sistema: os estilos calculados (temas.spec.ts) são iguais no Windows e no Linux.
  snapshotPathTemplate: '{testDir}/__snapshots__/{testFileName}/{arg}{ext}',
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
