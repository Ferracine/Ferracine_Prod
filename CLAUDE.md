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
pnpm release           # sobe a versão, roda pnpm check, gera o APK, faz commit + push e publica a Release no GitHub
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
  - `catalog.ts`: a lista exata de perguntas de cada tipo, na ordem definida pelo dono (código do serviço é livre). Ids descritivos e
    estáveis (`kmIni`, `ditais`...): OSs salvas guardam respostas por id. `espelho: '<coluna>'` liga a resposta a uma
    coluna do PDF; sem coluna, vai para INFORMAÇÃO ADICIONAL com o rótulo `short`. O número da OS não é pergunta: fica
    em `osNumber` (campo do topo da tela; vazio = S/N).
  - Perguntas condicionais: `showIf(respostas)` no catálogo (ex.: número/leitura do medidor novo da comercial só com
    "Foi instalado novo medidor?" = SIM). `espelho` pode ser função das respostas: na troca, o medidor da UC vai para
    MEDIDOR RETIRADO e o novo para MEDIDOR INSTALADO. Escondida não vale:
    `finalize` grava `skipped`, `checked` não valida, `answerRows`/espelho ignoram (`isVisible`). `semInfo` = pergunta
    de controle que não vai para INFORMAÇÃO ADICIONAL. Na tela, a dependente fica recuada (`ml-6`) e aparece/some na hora.
  - `ordem.ts`: regras da OS como funções puras. `startDraft` (OS nova), `createOS` ("Salvar OS") e `applyEdit`
    (lápis) passam pelas mesmas regras (código, DITAIS). `finalize` normaliza respostas vazias
    (e escondidas) para `skipped`. `isUnchanged` decide se Cancelar confirma.
  - `espelho.ts`: linhas do PDF a partir do catálogo (coluna CÓDIGO = código do serviço).
- `src/storage.ts`: um JSON `AppData` versão 3 em `ferracine_prod:v3`: cabeçalho, OSs, rascunho da OS nova (`draft`),
  `sheets` (as 4 últimas folhas encerradas, a mais recente primeiro; `lastSheet` da 1.4.x vira o 1º item),
  `lastHeader` (preenche o próximo turno), `tecnicos` e `eletricistas` (cadastrados no app; sem a lista, os
  eletricistas começam com a dupla dos últimos cabeçalhos) e `reaberta` (a folha original enquanto ela é corrigida). `loadData`: lê, roda as conversões de versões antigas
  sobre o JSON cru (bloco `// --- Conversões de versões antigas` no fim do arquivo: `lastSheet`, eletricistas,
  número do rascunho do assistente, `migrateAnswers` com os medidores da 1.4.1–1.4.4, a cópia escondida do número
  em `answers.os`, a pergunta de dificuldade até a 1.4.12 e as perguntas que só a ocorrência tinha até a 1.4.17, que
  viram "Informações adicionais"), monta tudo pelos **esquemas** e **grava já no formato atual** se mudou; dado ilegível não é
  sobrescrito. O bloco de conversões pode sair inteiro quando todos os aparelhos já tiverem aberto a 1.4.18 ou mais
  nova. Esquemas (`Esquema<T>` + `montar`): um leitor por campo de cada tipo (`DADOS`, `OS`, `RASCUNHO`, `FOLHA`,
  `TECNICO`, `ELETRICISTA`, `CABECALHO`); campo novo no tipo, mesmo opcional, sem leitor **não compila** (se
  compilasse, a primeira abertura o apagaria). Leitor devolve `INVALIDO` para descartar o item (OS sem id, tipo
  desconhecido, técnico com campo que não é texto). A ordem dos campos no esquema é a mesma com que o app grava
  (senão regravaria a cada abertura; há teste). O protótipo v2
  (antes da 1.1.0, nunca virou APK) não é migrado e a chave `ferracine_prod:v2` é apagada ao abrir. Campo novo no
  cabeçalho: acrescente em `HEADER_FIELDS`
  (types.ts). Mudança incompatível: suba a versão e escreva a migração. Campo novo que só acrescenta (ex.: `sheets`
  no lugar de `lastSheet`) fica na v3 com detecção na carga: subir a versão faria um APK antigo descartar tudo.
- Ocorrência = as mesmas perguntas da comercial (`OCORRENCIA = COMERCIAL` no catálogo, 1.4.18). As que só a
  ocorrência tinha até a 1.4.17 (callback, defeito, dispositivo, alteração na UC) viram texto no começo de
  "Informações adicionais" ao abrir (`migrateAnswers`, bloco de conversões do storage: "CALLBACK: SIM; DEFEITO: ...").
  O PDF segue com a informação e dá para corrigir pelo lápis.
- `src/app.ts`: controlador. Tela derivada do estado (`editingHeader`/sem header → cabeçalho; `editing` → edição;
  `draft` → OS nova; senão painel). OS nova e edição usam a mesma `osScreen` (`src/ui/os-screen.ts`); a OS nova
  grava o rascunho a cada alteração (`onChange`, sem redesenhar). O painel tem um botão por tipo, "Nova Comercial" (`btn('primary')`, `#btn-new-comercial`) e "Nova Ocorrência" (`btn('accent')`, `#btn-new-ocorrencia`):
  abre a tela da OS em branco (`startDraft(tipo)`, código vazio; no topo, número e, abaixo,
  código, digitados). Erro de regra rola até o campo
  (`data-field`) e o foca.
  Toda mutação passa por `update()`, que persiste e re-renderiza. Na tela da OS, uma entrada extra no `history` faz
  o voltar do Android agir como o Cancelar da tela.
- `src/platform.ts`: ponte com o APK (`window.FerracineAndroid`). Na WebView não há download de blob, nova aba nem
  `navigator.share`: o PDF vai em base64 com o tipo (`mime`) para `FerracineBridge.kt`
  (`saveFile`/`openFile`/`shareFile`). No navegador a ponte não existe.
- Fim do turno (`app.ts`): "Encerrar turno" (`encerrarTurno` → `encerrar`) encerra num toque, sem gerar nem baixar o
  PDF (ele é montado só quando pedido no histórico: Baixar/Abrir/Compartilhar, `deliverSheet`); só
  pergunta antes se houver pendência (nenhuma OS, S/N, `faltaObrigatoria`). Ao encerrar, a janela "Produção
  encerrada" mostra só a folha encerrada (`abrirFolhas` com uma lista de uma folha). Histórico (`src/ui/folhas.ts`,
  `listaFolhas`): só na janela do botão `#historico-toggle` do topo (a tela do cabeçalho não mostra mais o cartão);
  ações Baixar/Abrir/Compartilhar/Editar/Excluir. **Editar** (`reabrirFolha`) devolve a folha ao turno aberto
  (cabeçalho e OSs) e a tira de `sheets`, guardando a original em `AppData.reaberta` (gravada: sobrevive ao app
  fechar no meio da correção); só sem turno aberto. Com `reaberta`, corrigir o cabeçalho não muda `lastHeader`.
  **Cancelar turno** (`#btn-cancel-turno`, `cancelarTurno` → `cancelarDados`) descarta cabeçalho/OSs/rascunho
  depois de confirmar; com `reaberta`, a folha volta ao histórico como estava. A lista "OSs concluídas" tem
  `#btn-ordem-os` (Crescente/Decrescente, chave `ferracine_prod:ordem-os`; o # é a posição na folha). Não há
  planilha: o app só gera PDF.
- Campo que falta: `marcarFaltando(el)` (dom.ts) põe `.faltando` (borda vermelha, styles.css) até a pessoa mexer;
  usado no cabeçalho, no cadastro e na OS (`showRuleError`).
- Atualização do APK: `src/update.ts` consulta `releases/latest` da API do GitHub (CORS liberado; a cada abertura e,
  ao voltar para o app, se a última consulta foi há mais de 1 h; se o GitHub recusou por limite, espera 1 h), `src/domain/update.ts` decide (tag `vX.Y.Z` maior
  que `__APP_VERSION__` + asset `FerracineProd-X.Y.Z.apk` de `.../releases/download/`) e mostra o aviso
  `#update-banner` (no topo quando achado sozinho; no rodapé, com "Procurando..." no botão, quando achado pelo
  "Procurar atualização"). "Atualizar" chama `installUpdate(url)` da ponte: `Updater.kt` confere o mesmo prefixo, baixa em
  `cache/update/`, confere pacote e versionCode maiores, pede "Instalar apps desconhecidos" (Android 8+, retoma no
  `onResume`) e abre o instalador; o andamento volta pelo evento `ferracine-update`. `__APP_VERSION__` vem do
  `package.json` (define do vite.config.ts), a mesma versão do APK. Só no APK: no navegador o service worker atualiza.
- Cabeçalho (`header-screen.ts`): Eletricista 1 e 2 são listas dos cadastrados (só o nome; a matrícula aparece no
  campo só leitura ao lado, `#matricula1/2`; nome repetido mostra a matrícula na opção), como o técnico líder; a janela de cadastro (`manageCadastro`) é a mesma para técnicos e eletricistas. Solo esconde o Eletricista 2.
  Quem estava no cabeçalho e não está mais no cadastro aparece como opção "anterior" (não se perde na correção).
  Na dupla, a lista de cada eletricista fica sem quem está escolhido na outra (`fillEletricistas`). Técnico líder é
  obrigatório.
  O `ShiftHeader` continua guardando nome/matrícula (o PDF não muda).
- `src/ui/`: telas montadas com `h()` (`dom.ts`), que coloca texto sempre como nó de texto. Todo `input`/`textarea`
  sai com `autocapitalize="characters"` e `forceUppercase` (main.ts) converte o digitado para maiúsculas. Não use `innerHTML`
  com dado do usuário. Ícones vêm do `lucide` 1.x por import nomeado.
  `os-screen.ts` é a tela da OS (nova e lápis). O cabeçalho não é redesenhado ao cadastrar técnicos (para não perder o digitado).
- Temas clássicos, em ordem cronológica (`win98`, `xp`, `win10`; o Windows 3.1 saiu na 1.4.18 e quem o usava volta
  ao padrão): cores e desenho dos próprios sistemas, com a fonte de cada valor no comentário do topo da seção em
  `styles.css` e o relatório em `reports/Paletas e botões dos temas Windows.md` (fora do git; notas em
  `research_notes/`). O 98 declara as cores do sistema (`--w-face`, `--w-hilight`, `--w-shadow`, `--w-dk`,
  `--w-window`, `--w-sel`, `--w-gray`...) e os biséis (`--bisel`, `--bisel-padrao`, `--bisel-ativo`, `--bisel-campo`...),
  e as regras usam só elas. Todo botão tem a face do sistema; o principal (`.btn-primary`) é o "botão padrão".
  Escuros: High Contrast Black (98), Royale Noir (XP: só moldura/barras escuras, janelas claras) e o escuro do 10. No XP
  e no 10 o destaque (`--accent*`) é um azul do próprio sistema, não verde; no 10 só `.btn-primary` tem a cor de
  destaque (o `btn('accent')` é botão comum, como no 98/XP). Ganchos além dos de baixo: `.painel`
  (item de lista/bloco), `.faixa-cabecalho`, `.janela-rodape`, `.selo-status`, `.aviso` (aviso de atualização) e
  `.sobre-app` (texto direto sobre o fundo do app, cor `--sobre-app`). Seletores longos de `:not()` vão dentro de
  `:where()`, e o botão padrão usa `.btn.btn-primary` (senão o botão comum vence pela especificidade).
- Aparência em dois eixos (`src/theme.ts` + script no `<head>` do index.html, que aplica antes da pintura): **estilo**
  `data-estilo` (chave `ferracine_prod:estilo`) e **claro/escuro** `data-theme` (chave `ferracine_prod:theme`; sem
  escolha, segue o celular). Temas em `ESTILOS`: paletas modernas `moderno` (Safira & Violeta, padrão), `floresta`
  (Esmeralda & Ouro) e `sol-forte` (Alto Contraste); clássicos `win98`, `xp` e `win10`. Id antigo `retro`
  vira `win98`; id desconhecido (temas removidos) volta a `moderno`. **Nenhum tema usa as cores do logo**: cada um
  define a própria paleta completa em `styles.css` (`--brand*`, `--accent*`, `--danger-*` → `rose-*`, `--ok/--warn/--err`,
  superfícies e textos), ligadas às utilidades do Tailwind por `@theme inline` (`bg-brand-600`, `bg-accent-600`,
  `bg-rose-600`...). O padrão fica em `@layer base` (`:root, [data-estilo]`); os demais temas, fora de `@layer` (vencem
  as utilidades), com variáveis + acabamento pelos ganchos `.btn`/`.btn-<tom>` (de `btn()`), `.card`, `.field`,
  `.escolha`, `.janela`/`.janela-titulo` e `.barra-app`. As variáveis ficam em `[data-estilo=...]` (não só
  no `:root`) porque a miniatura da janela de temas (`.amostra`) usa as do tema que mostra. Tema novo: id em
  `ESTILOS`, na regex do script do `<head>` e um bloco de variáveis claro/escuro + acabamento em `styles.css`. O PDF
  não muda com o tema.
- Botões (padrão em `dom.ts`): `btn(tom, tamanho)` (único jeito de estilizar botão; o tema é montado em JS por isso) com tom `primary`/`neutral`/`danger`/`accent`/`outline`/`ghost` e
  tamanho `lg` (56 px, ação principal da tela), `md` (48 px, padrão), `sm` (44 px) e `icon` (44 × 44); raio único
  `rounded-xl`; nada abaixo de 44 px de toque. `BTN_LINK` para links de ação, `BTN_CHOICE` para SIM/NÃO e
  Solo/Dupla. Grupo de botões lado a lado: `gradeBotoes` (colunas iguais; o ímpar ou o marcado como largo ocupa a linha). Nas
  janelas, as ações ficam empilhadas na largura toda. Botões do topo: `botaoDoTopo` (dom.ts). Não escreva classes de botão
  soltas.
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
  (MediaStore no Android 10+; permissão de armazenamento no 7–9), abre e compartilha via FileProvider; só PDF (`TIPOS`/`extOf` recusam outro tipo).
- `design/`: referência que o dono mandou (foto do PDF em papel, com os dados à mão cobertos por tarja preta). Não coloque arquivos em `dist/`: o build apaga a pasta.

Regras de negócio que não são óbvias no código:
- A pergunta dos DITAIS (`ditais`) é a única obrigatória, nos dois tipos (OS nova e edição). OS comercial salva
  antes da 1.4.11 não tem a resposta: o lápis pede antes de salvar.
- Número da OS é opcional: `osNumber` vazio aparece como "S/N" (`osLabel`).
- "Encerrar turno" encerra de fato: limpa cabeçalho e OSs e guarda a folha no topo de `sheets` (`SHEETS_KEPT` = 4; a
  mais antiga sai). O PDF só é baixado quando o eletricista toca em "Baixar PDF". A folha guarda `baixadaEm` ('' =
  ainda não baixada): o histórico mostra "PDF não baixado" e o encerramento avisa se uma folha não baixada vai sair do
  histórico. Só **Baixar** marca (o compartilhar do Android não confirma o envio; Abrir é só ver); no navegador o
  clique de download também não confirma que salvou. Reabrir e reencerrar zera a marca (o PDF corrigido precisa ser
  baixado de novo). Folhas de antes da 1.4.16 (encerrar já baixava) contam como baixadas.
- Turno novo vem preenchido com `lastHeader` (exceto data = hoje e líder em branco).
- DITAIS e demais SIM/NÃO entram sempre em INFORMAÇÃO ADICIONAL ("Rótulo: SIM/NÃO"), menos as perguntas de controle
  (`semInfo`: "Foi instalado novo medidor?"), porque as colunas de medidor já dizem. "Informações adicionais"
  (`infoAdicional`, caixa aberta, `semRotulo`) entra sem rótulo.
- Testes de PDF procuram texto direto em `doc.output()` (sem compressão, acentos em latin-1); `flat()` emenda
  linhas quebradas da mesma célula.

## Publicação

Remoto `origin` = github.com/Ferracine/Ferracine_Prod (público; dono: conta **Ferracine**, idealizador Paulo Vitor
Ferracini Silva; Pages em ferracine.github.io/Ferracine_Prod). O Bruno1991 (o `gh`/git padrão desta máquina) é
colaborador com escrita: push e Release saem normalmente (`git push`, `gh release create -R Ferracine/Ferracine_Prod`).
Configurações do repositório (Pages, colaboradores) só pela conta Ferracine: `GH_TOKEN=$FERRACINE_GITHUB_TOKEN gh api ...`
(`C:\dev\.env`), por comando e sem gravar o token. Push no `main` publica no GitHub Pages pelo
workflow `.github/workflows/deploy-pages.yml` (lint, testes unitários, build). O APK vai como asset de uma
Release (`gh release create v<versão> release/FerracineProd-<versão>.apk`). **Publicar a Release entrega a
atualização a todos os APKs instalados**: tag `v` + versão do `package.json` e o APK com esse nome exato, assinado
com a chave de sempre. Push, Release e publicação só com OK explícito do Bruno.

## Pendências conhecidas

- Mudança de conta (1.4.15): o repositório antigo `Bruno1991/Ferracine_Prod` foi apagado. APK até a 1.4.14 não
  recebe mais atualização sozinho: instalar uma vez à mão o APK da Release mais recente da conta Ferracine (mesma
  assinatura; os dados do app ficam).
- O Chrome grava o `localStorage` em disco com atraso: Chrome morto com o app na tela pode perder o último passo do
  preenchimento. Se isso virar problema em campo, migrar o estado para IndexedDB.
- No navegador/PWA, o voltar do sistema com uma janela aberta no painel segue o histórico (pode sair do app). No APK
  não: a MainActivity chama `window.ferracineBack()` antes, e a janela é fechada.
