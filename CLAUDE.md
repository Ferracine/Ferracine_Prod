# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Folha de Produção Diária: app offline em que o eletricista registra as OSs do turno e gera o PDF oficial do Espelho
de Campo (Energisa). Roda como PWA (GitHub Pages) e como APK Android (WebView com o mesmo build web). Projeto de um
amigo do Bruno (prefixo `Ferracine_`); textos do app, docs e commits em pt-BR. Uso real é no celular, em campo,
muitas vezes sem sinal: toda mudança tem de continuar funcionando offline.

## Comandos

```bash
pnpm install
pnpm dev               # Vite em 0.0.0.0:5173
pnpm lint              # tsc --noEmit (strict + noUncheckedIndexedAccess)
pnpm test              # Vitest, só tests/unit (ambiente node, sem DOM)
pnpm test ordem        # um arquivo: filtre pelo nome; passar o caminho completo no Git Bash quebra o Vitest
pnpm build             # dist/ + service worker (vite-plugin-pwa, generateSW)
pnpm test:e2e          # Playwright contra o build (pnpm preview :4173), Chrome instalado, viewport Pixel 7
pnpm check             # lint + test + build + e2e: rode antes de commitar
pnpm apk               # build web + APK release assinado em release/FerracineProd-<versão>.apk (scripts/apk.mjs)
pnpm logo              # regenera src/assets/energisa-pdf.png (logo do PDF) a partir de src/assets/energisa.svg
pnpm icons             # regenera favicon/ícones do PWA a partir de public/icon.png (prancheta)
pnpm android:icons     # regenera os mipmaps do APK a partir de public/icon.png
```

O e2e usa o build de produção: depois de mudar `src/`, rode `pnpm build` antes de `pnpm test:e2e`.
`pnpm-workspace.yaml` nega o build script do `core-js` (pnpm 11 trava qualquer `pnpm run` com build pendente).

APK: JDK 17 em `C:\dev\jdk-17.0.2` (o script usa se `JAVA_HOME` não estiver definido) e SDK em
`android/local.properties` (`C:/Users/conta/AppData/Local/Android/Sdk`, plataforma 35; não vai para o git).
Assinatura: `C:\dev\.secrets\ferracine-prod-release.jks` + `FERRACINE_PROD_KEYSTORE_FILE/_PASSWORD`,
`FERRACINE_PROD_KEY_ALIAS/_PASSWORD` no `C:\dev\.env` (lidos pelo `android/app/build.gradle.kts`). Perder a chave
impede atualizar o app instalado. A versão do APK é a do `package.json` (versionCode = major·10000 + minor·100 + patch).

Teste no Galaxy A23 (print antes de cada toque): APK com `adb -s RX8TA06NC3W install -r release/FerracineProd-*.apk`;
web com `pnpm preview` + `adb reverse tcp:4173 tcp:4173` e `http://localhost:4173/` no Chrome do aparelho.
`adb input text` não aceita acento. Com `adb forward tcp:9333 localabstract:chrome_devtools_remote`, o Playwright
(`chromium.connectOverCDP`) inspeciona a página real do celular.

## Arquitetura

- `src/domain/` é puro (sem DOM, sem storage) e é onde estão as regras:
  - `catalog.ts`: códigos por tipo e a lista exata de perguntas, na ordem definida pelo dono. Ids descritivos e
    estáveis (`kmIni`, `ditais`...): OSs salvas guardam respostas por id. `espelho: '<coluna>'` liga a resposta a uma
    coluna do PDF; sem coluna, vai para INFO ADICIONAL com o rótulo `short`. `prefillOS` marca a pergunta do número
    da OS. `LEGACY_*` serve só à migração da v2.
  - `ordem.ts`: regras da OS como funções puras. `startDraft` (OS nova), `createOS` ("Salvar OS") e `applyEdit`
    (lápis) passam pelas mesmas regras (código, DITAIS, complemento do SIM). `finalize` normaliza respostas vazias
    para `skipped` e grava o número do topo na pergunta `prefillOS` (que a tela não mostra). `isUnchanged` decide se Cancelar confirma.
  - `espelho.ts`: linhas do PDF a partir do catálogo (TIPO DE SERVIÇO = só o código).
- `src/storage.ts`: um JSON `AppData` versão 3 em `ferracine_prod:v3`: cabeçalho, OSs, rascunho da OS nova (`draft`),
  `lastSheet`, `lastHeader` (preenche o próximo turno) e `tecnicos` (cadastrados no app). A v2 só é migrada se a
  v3 nunca foi gravada: ids antigos → novos; respostas sem pergunta equivalente viram texto em `legado` (vai para
  INFO ADICIONAL); o líder antigo vira técnico cadastrado. Campo novo no cabeçalho: acrescente em `HEADER_FIELDS`
  (types.ts). Mudança incompatível: suba a versão e escreva a migração.
- `src/app.ts`: controlador. Tela derivada do estado (`editingHeader`/sem header → cabeçalho; `editing` → edição;
  `draft` → OS nova; senão painel). OS nova e edição usam a mesma `osScreen` (`src/ui/os-screen.ts`); a OS nova
  grava o rascunho a cada alteração (`onChange`, sem redesenhar). O painel tem um "+" por tipo (`#btn-new-comercial`, `#btn-new-ocorrencia`):
  abre a tela da OS em branco (`startDraft(tipo)`, código vazio; no topo, número e, abaixo,
  código, digitados). `checked` recusa código da lista do outro tipo; erro de regra rola até o campo
  (`data-field`) e o foca.
  Toda mutação passa por `update()`, que persiste e re-renderiza. Na tela da OS, uma entrada extra no `history` faz
  o voltar do Android agir como o Cancelar da tela.
- `src/platform.ts`: ponte com o APK (`window.FerracineAndroid`). Na WebView não há download de blob, nova aba nem
  `navigator.share`: o PDF vai em base64 para `FerracineBridge.kt`. No navegador a ponte não existe.
- Atualização do APK: `src/update.ts` consulta `releases/latest` da API do GitHub (CORS liberado; ao abrir e ao
  voltar para o app, no máximo a cada 6 h quando não há nada novo), `src/domain/update.ts` decide (tag `vX.Y.Z` maior
  que `__APP_VERSION__` + asset `FerracineProd-X.Y.Z.apk` de `.../releases/download/`) e mostra o aviso
  `#update-banner`. "Atualizar" chama `installUpdate(url)` da ponte: `Updater.kt` confere o mesmo prefixo, baixa em
  `cache/update/`, confere pacote e versionCode maiores, pede "Instalar apps desconhecidos" (Android 8+, retoma no
  `onResume`) e abre o instalador; o andamento volta pelo evento `ferracine-update`. `__APP_VERSION__` vem do
  `package.json` (define do vite.config.ts), a mesma versão do APK. Só no APK: no navegador o service worker atualiza.
- `src/ui/`: telas montadas com `h()` (`dom.ts`), que coloca texto sempre como nó de texto. Não use `innerHTML`
  com dado do usuário. Ícones vêm do `lucide` 1.x por import nomeado.
  `os-screen.ts` é a tela da OS (nova e lápis). O cabeçalho não é redesenhado ao cadastrar técnicos (para não perder o digitado).
- Tema claro/escuro (`src/theme.ts` + script no `<head>` do index.html, mesma chave `ferracine_prod:theme`).
  Cores em `src/styles.css`, do logo: `brand` = ciano `#0fabcc`, `accent` = laranja `#f36f23` (`-600/-700` para
  botões com texto branco, `-fg` para texto). Use `bg-app`, `bg-card`, `text-fg`, `text-muted`, `text-subtle`,
  `text-danger-fg`, `bg-fg/5`, `border-fg/10`, nunca cores fixas. Comercial = ciano, Ocorrência = laranja.
- Ícones: logo Energisa (`src/assets/energisa.svg`) no topo do app e no PDF; a prancheta (`public/icon.png`) é o
  favicon, o ícone do PWA e o do APK. No `icon.png` a prancheta (sem o lápis) fica no centro; o lápis sobra para a
  direita. O ícone adaptativo usa a figura a 58% para caber no círculo seguro (tela de abertura do Android 12+).
- Rodapé: "© Ferracine Prod" (dono do app/repositório), versão e "Procurar atualização".
- `src/pdf.ts`: jsPDF 4 + `autoTable(doc, opts)` (jspdf-autotable 5). Segue `design/ex_pdf.jpeg` (A4 paisagem, preto
  e branco, 15 linhas, 13 colunas somando 281 mm); logo, ITEM vertical, quadradinhos SIM/NÃO de cliente presente,
  produção total e técnicos (3 por linha) são desenhados em `didDrawCell`. Nenhuma célula corta texto; o rodapé
  usa `pageBreak: 'avoid'`. Logo e identificação só na 1ª folha (com dois cabeçalhos parecia
  outro arquivo); acima de 15 OSs, cada 15 abrem uma folha só com a tabela (títulos repetidos, ITEM contínuo);
  técnicos/produção só na última; data, equipe e "FOLHA n/N" embaixo de toda folha (`rodapePaginas`). Testes travam: 15 OSs completas numa folha. Importado sob demanda em `app.ts`.
- `android/`: Kotlin mínimo (AGP 8.7.3, Kotlin 2.0.21, Gradle 8.9, minSdk 24, target 35). `MainActivity` serve
  `assets/www` (cópia do `dist/` feita pelo `scripts/apk.mjs`, sem service worker) via `WebViewAssetLoader` em
  `https://appassets.androidplatform.net/www/`; internet só para a atualização (INTERNET e
  REQUEST_INSTALL_PACKAGES). Borda a borda em todas as versões
  (o Android 15 obriga): o espaço das barras e do teclado é padding de um `FrameLayout` em volta da WebView (a
  WebView ignora o próprio padding e o app ficava sob as barras). O `index.html` não usa `viewport-fit=cover`. `FerracineBridge` salva em Downloads
  (MediaStore no Android 10+; permissão de armazenamento no 7–9), abre e compartilha via FileProvider.
- `design/`: referências que o dono mandou. Não coloque arquivos em `dist/`: o build apaga a pasta.

Regras de negócio que não são óbvias no código:
- A pergunta dos DITAIS (`ditais`) é a única obrigatória (OS nova e edição).
- Número da OS é opcional: `osNumber` vazio aparece como "S/N" (`osLabel`).
- Gerar o PDF não encerra o turno: só "Encerrar turno" limpa cabeçalho e OSs e guarda a folha em `lastSheet`.
- Turno novo vem preenchido com `lastHeader` (exceto data = hoje e líder em branco).
- O "Não" de pergunta "se sim, qual?" não entra em INFO ADICIONAL; DITAIS e demais SIM/NÃO entram sempre.
- Testes de PDF procuram texto direto em `doc.output()` (sem compressão, acentos em latin-1); `flat()` emenda
  linhas quebradas da mesma célula.

## Publicação

Remoto `origin` = github.com/Bruno1991/Ferracine_Prod (público). Push no `main` publica no GitHub Pages pelo
workflow `.github/workflows/deploy-pages.yml` (lint, testes unitários, build). O APK vai como asset de uma
Release (`gh release create v<versão> release/FerracineProd-<versão>.apk`). **Publicar a Release entrega a
atualização a todos os APKs instalados**: tag `v` + versão do `package.json` e o APK com esse nome exato, assinado
com a chave de sempre. Push, Release e publicação só com OK explícito do Bruno.

## Pendências conhecidas

- O Chrome grava o `localStorage` em disco com atraso: Chrome morto com o app na tela pode perder o último passo do
  preenchimento. Se isso virar problema em campo, migrar o estado para IndexedDB.
- No navegador/PWA, o voltar do sistema com uma janela aberta no painel segue o histórico (pode sair do app). No APK
  não: a MainActivity chama `window.ferracineBack()` antes, e a janela é fechada.
