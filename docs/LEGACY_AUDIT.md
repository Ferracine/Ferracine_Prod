# Auditoria de Código Legado
Data: 2026-11-27 (revisada depois da saída do Windows 3.1) | Escopo: projeto inteiro (`src/`, `tests/`, `scripts/`, `android/`, `index.html`, docs) | Linha de base dos testes: `pnpm lint` OK, `pnpm test` 67/67, e2e 43/43 (commit `c3b5cba`, `git status` limpo)

Projeto: TypeScript (Vite, Tailwind 4, Vitest, Playwright) + Kotlin (APK). Comandos: `pnpm lint` (tsc com
`noUnusedLocals`/`noUnusedParameters`), `pnpm test`, `pnpm test:e2e`, `pnpm check`.

Evidências gerais:
- `tsc --noEmit` sem avisos: nenhum import, variável ou parâmetro sem uso.
- Nenhum `console.log`/`debugger`/`TODO`/`FIXME` em `src/` ou `android/`. Os `console.log` de `scripts/*.mjs` são a saída
  dessas ferramentas de linha de comando: manter.
- Exports usados só no próprio arquivo (`EditResult`, `QuestionType`, `InputKind`, `Leitor`, `DashboardProps`,
  `ToastType`, `ModalAction`, `HeaderScreenProps`, `OSScreenProps`): são tipos de assinaturas exportadas: manter.
- Dependências: todas têm uso (imports, `vite.config.ts`, `scripts/`, `package.json`).
- Tokens `--color-*`/`--radius-*` do `@theme inline`: todos geram utilidades usadas em `src/` ou `index.html`.

## Lote 1 (Risco Baixo)
- [x] `CLAUDE.md` — lista de ganchos dos temas desatualizada — atualizada (`.painel`, `.faixa-cabecalho`,
  `.janela-rodape`, `.selo-status`, `.aviso`, `.sobre-app`, variáveis `--w-*`/`--bisel*` e fontes do sistema).

## Lote 2 (Risco Baixo/Médio)
- Nenhum item: não há arquivo, função ou export sem referência (ver evidências gerais).

## Lote 3 (Risco Médio) — dentro de `src/styles.css` + componentes de `src/ui/` (mesma fronteira: aparência)
Resolvidos na reescrita dos temas Windows e no /simplify de 27/11 (commits `414e860` e `3f41e0a`):
- [x] Estados de botão do 98 e do 3.1 escritos duas vezes — um bloco `:is([data-estilo='win98'], [data-estilo='win31'])`
  com as regras; cada tema só declara cores do sistema (`--w-*`) e biséis (`--bisel*`); a paleta igual nos dois claros
  fica no bloco comum.
- [x] Desabilitado e foco triplicados — uma regra para 98/3.1 (`--w-gray`, `--w-gray-relevo`); XP e 10 têm o próprio
  desenho de sistema.
- [x] `#update-banner > div` (estrutura do DOM) — gancho `.aviso` no div montado em `src/update.ts`.
- [x] Textos sobre o fundo do app listados à mão (win98) — gancho `.sobre-app` + variável `--sobre-app`.
- [x] Papel do botão deduzido de utilidades (`.btn-outline.text-danger-fg`, `.nova-os.bg-accent-600`) — o "+" leva
  `btn-primary`/`btn-accent`; a cor de papel por utilidade saiu (temas clássicos usam a face do sistema em todo botão).
- [x] `border-radius` repetido no Win10/XP — tokens `--radius-*` num bloco comum (98, 3.1 e 10); só card, campo e
  `rounded-full` têm regra própria.

Novos (achados no /simplify e no /clear-legacy de 27/11; não executados):
- [ ] `src/styles.css` (`[data-estilo='win98']`) — `--w-borda-btn: none`, `--w-borda-campo: none` e `--w-raio-btn: 0`
  só existiam para alternar entre o 98 e o 3.1; com o 3.1 fora, viraram indireção — consolidar: escrever os valores
  direto nas regras de botão e campo do 98. Evidência: 1 declaração e 1 uso cada (`grep`). Risco Baixo.
- [ ] `src/styles.css` (≈28 ocorrências) — o X das janelas (`btn('ghost', 'icon')` em `src/ui/feedback.ts`) e as opções
  da janela de temas (`BTN_CHOICE` em `src/theme.ts`) reaproveitam `.btn`/`.escolha` e por isso cada regra de botão
  exclui `.janela-titulo .btn` e `[data-estilo-opcao]` (dentro de `:where()` para não subir a especificidade) —
  extrair: classes próprias na origem (`btn-fechar`, `opcao-estilo`) e regras curtas para elas.
- [ ] `src/app.ts` (`encerrar`) — proteção contra toque duplo desliga `pointerEvents` em `root` e `#modal` à mão —
  extrair: um helper em `src/ui/dom.ts` que engole o clique fantasma por ~400 ms em captura no `document`, chamado
  quando a tela troca (`render`) e quando uma janela abre (`openModal`).

## Lote 4 (Revisão Manual) — não executar sem decisão item a item
- [ ] `src/storage.ts` — bloco "Conversões de versões antigas (1.1.0 a 1.4.17)" e a chamada de `converterDados` em
  `loadData`. Pode sair quando todos os aparelhos tiverem aberto a **1.4.18** ou mais nova (a conversão das perguntas
  que só a ocorrência tinha entrou nela). Não há como comprovar pelo código (sem telemetria): decisão do Bruno/Paulo.
  Risco Alto: um aparelho parado numa versão antiga perderia dados ao atualizar.
- [ ] `src/storage.ts` — `LEGACY_KEY = 'ferracine_prod:v2'` apaga o protótipo v2 ao abrir. Referência só por string no
  `localStorage`. Remover só junto com o item anterior.
- Tema Windows 3.1 removido (1.4.18): o id `win31` gravado no aparelho cai na regra geral de tema desconhecido
  (volta a `moderno`), sem código próprio; há teste e2e. Nada a remover.
- [ ] `src/theme.ts` — id antigo `retro` vira `win98` (valor gravado no `localStorage` por versões antigas; há teste
  e2e). Mesmo critério: só quando ninguém mais tiver o valor antigo.

---

# Auditoria anterior
Data: 2026-11-24 | Escopo: restos do encerramento que gerava e baixava o PDF (1.4.16) | Linha de base dos testes: `pnpm lint` OK, `pnpm test` 65/65, e2e 39/39

## Lote 1 (Risco Baixo)
- [x] `src/app.ts:213` — comentário do pré-carregamento ainda cita "Encerrar gera o PDF" — corrigir
- [x] `src/app.ts:48` — comentário do `pdfMemo` cita "a do turno" — corrigir
- [x] `README.md:45` — "Encerrar turno e gerar PDF … baixa o PDF" — atualizar para o fluxo novo
- [x] `CLAUDE.md:85` e `CLAUDE.md:150-151` — descrevem o download automático — atualizar

## Lote 2, 3 e 4
- Nenhum item (ver histórico do git).
