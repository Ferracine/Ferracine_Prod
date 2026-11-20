# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Folha de Produção Diária: PWA offline em que o eletricista registra as OSs do turno e gera o PDF oficial
(Energisa). Projeto de um amigo do Bruno (prefixo `Ferracine_`); textos do app, docs e commits em pt-BR.
Uso real é no celular, em campo, muitas vezes sem sinal: toda mudança tem de continuar funcionando offline.

## Comandos

```bash
pnpm install
pnpm dev               # Vite em 0.0.0.0:5173
pnpm lint              # tsc --noEmit (strict + noUncheckedIndexedAccess)
pnpm test              # Vitest, só tests/unit (ambiente node, sem DOM)
pnpm test wizard       # um arquivo: filtre pelo nome; passar o caminho completo no Git Bash quebra o Vitest
pnpm build             # dist/ + service worker (vite-plugin-pwa, generateSW)
pnpm test:e2e          # Playwright contra o build (pnpm preview :4173), Chrome instalado, viewport Pixel 7
pnpm check             # lint + test + build + e2e: rode antes de commitar
```

O e2e usa o build de produção: depois de mudar `src/`, rode `pnpm build` antes de `pnpm test:e2e`.

Teste no Galaxy A23 (print antes de cada toque): `pnpm preview` e `adb -s RX8TA06NC3W reverse tcp:4173 tcp:4173`, depois
abra `http://localhost:4173/` no Chrome do aparelho (`am start -a android.intent.action.VIEW -d ...`). Pelo
`localhost` o service worker funciona; para simular sem internet, `adb reverse --remove tcp:4173` e reabra.
`adb input text` não aceita acento. Com `adb forward tcp:9333 localabstract:chrome_devtools_remote`, o Playwright
(`chromium.connectOverCDP`) inspeciona a página real do celular.
`pnpm-workspace.yaml` nega o build script do `core-js` (pnpm 11 trava qualquer `pnpm run` com build pendente).

## Arquitetura

- `src/domain/` é puro (sem DOM, sem storage) e é onde estão as regras:
  - `catalog.ts`: códigos por tipo (COMERCIAL/OCORRENCIA) e a lista exata de perguntas. Os textos vêm da versão
    original do app (primeiro commit) e de `design/index_base.html`; o contador "N perguntas" e o PDF derivam daqui.
  - `wizard.ts`: o assistente como funções imutáveis (`startDraft`, `setText/setChoice/setDetail`, `next`, `skip`,
    `back`, `finalize`). `next`/`skip` devolvem `StepResult` com a mensagem de erro; a UI só exibe.
    `finalize` normaliza respostas vazias para `skipped`, então nada vai em branco ao PDF.
    `answerRows` é a única fonte das linhas pergunta/resposta para o modal "Ver respostas" e para o PDF.
- `src/storage.ts`: um único JSON `AppData` (versão 2) na chave `ferracine_prod:v2`: cabeçalho, OSs, rascunho do
  assistente (`draft`) e `lastSheet`. Dado corrompido ou de outra versão vira estado vazio. Campo novo no
  cabeçalho: acrescente em `HEADER_FIELDS` (types.ts); o tipo `ShiftHeader`, o formulário e `normalizeHeader`
  (que preenche com vazio o que faltar em dados antigos) derivam dessa lista. Mudança incompatível
  (renomear/remover campo, mudar `Answer`): suba a versão e escreva a migração, senão o turno em andamento se perde.
- `src/app.ts`: controlador. A tela é derivada do estado (`draft` → assistente; `header` → painel; senão
  cabeçalho). Toda mutação passa por `update()`, que persiste e re-renderiza; digitação persiste sem re-render.
- `src/ui/`: telas montadas com `h()` (`dom.ts`), que coloca texto sempre como nó de texto. Não use `innerHTML`
  com dado do usuário. Ícones vêm do `lucide` 1.x por import nomeado (só os usados entram no bundle).
- `src/pdf.ts`: jsPDF 4 + `autoTable(doc, opts)` (jspdf-autotable 5), lido via `doc.lastAutoTable.finalY`.
  É importado dinamicamente em `app.ts` para não pesar a abertura do app. Página 1 = Espelho de Campo
  (A4 paisagem, modelo em `design/espelho_de_campo.md`); depois, o detalhamento de cada OS. As colunas do espelho
  vêm das perguntas marcadas com `espelho: '<coluna>'` no catálogo (`domain/espelho.ts` só percorre as marcas).
  O espelho tem de caber numa folha com 20 linhas: células longas são cortadas com "..." e o teste trava isso.
  Em `app.ts` o PDF vira um Blob uma vez (memo por folha) e o módulo `./pdf` é carregado sob demanda.
- `design/`: referências que o dono mandou (layout `index_base.html` em tema escuro, `new_icon.png`, modelo do PDF).
  O tema (`ink`, `panel`, `energisa-sky`, classes `field`/`lbl`/`card`) está em `src/styles.css`.
  Não coloque arquivos em `dist/`: o build apaga a pasta.

Regras de negócio que não são óbvias no código:
- A pergunta dos DITAIS (`o6`) é a única obrigatória; não tem botão Pular e sai destacada no detalhamento do PDF.
- Número da OS é opcional: `osNumber` vazio aparece como "S/N" (`osLabel`). Se a OS começou sem número e a
  pergunta `o2` foi respondida, `finalize` adota esse número; `withOSNumber` (lápis da lista) mantém `o2` coerente.
- Gerar o PDF não encerra o turno: só o botão "Encerrar turno" da janela "PDF gerado" limpa cabeçalho e OSs e
  guarda a folha em `lastSheet` (baixar/compartilhar de novo pela tela inicial).
- `TECNICOS_LIDERES` (catalog.ts) são os nomes/telefones do rodapé do modelo de papel; o escolhido sai com [X].
- Testes de PDF procuram texto direto em `doc.output()`: o jsPDF grava sem compressão e com acentos em latin-1.

## Pendências conhecidas

- O catálogo tem perguntas repetidas (KM inicial/final em o7/o8 e o16/o17; dificuldade em o11 e o18) e a o2
  repete o número da OS. Ficaram como o original até o dono do app confirmar.
- O Chrome grava o `localStorage` em disco com atraso. Testado no A23: app em segundo plano e depois morto não
  perde nada; Chrome morto com o app na tela perdeu o último passo do assistente. Se isso virar problema em campo,
  migrar o estado para IndexedDB.
- Sem repositório remoto nem publicação. Criar repositório, `git push` e publicar só com OK explícito do Bruno.
