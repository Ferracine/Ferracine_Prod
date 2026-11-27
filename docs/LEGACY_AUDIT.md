# Auditoria de Código Legado
Data: 2026-11-27 | Escopo: projeto inteiro (`src/`, `tests/`, `scripts/`, `android/`, `index.html`, docs) | Linha de base dos testes: `pnpm lint` OK, `pnpm test` 66/66, e2e 41/41 (com as mudanças de tema ainda não commitadas)

Projeto: TypeScript (Vite, Tailwind 4, Vitest, Playwright) + Kotlin (APK). Comandos: `pnpm lint` (tsc com
`noUnusedLocals`/`noUnusedParameters`), `pnpm test`, `pnpm test:e2e`, `pnpm check`.
`git status`: **não está limpo** (temas Windows reescritos, fontes offline, ganchos `.painel`/`.janela-rodape`/
`.faixa-cabecalho`/`.selo-status`). Nenhum lote roda antes desse trabalho virar commit (Regra 6).

Evidências gerais:
- `tsc --noEmit` sem avisos: nenhum import, variável ou parâmetro sem uso.
- Nenhum `console.log`/`debugger`/`TODO`/`FIXME` em `src/` ou `android/`. Os `console.log` de `scripts/*.mjs` são a saída
  dessas ferramentas de linha de comando: manter.
- Exports usados só no próprio arquivo (`EditResult`, `QuestionType`, `InputKind`, `Leitor`, `DashboardProps`,
  `ToastType`, `ModalAction`, `HeaderScreenProps`, `OSScreenProps`): são tipos de assinaturas exportadas: manter.
- Dependências: as 7 de produção e as 9 de desenvolvimento têm uso (imports, `vite.config.ts`, `scripts/`, `package.json`).
- Tokens `--color-*`/`--radius-*` do `@theme inline`: todos geram utilidades usadas em `src/` ou `index.html`.

## Lote 1 (Risco Baixo)
- [ ] `CLAUDE.md:120` — a lista de ganchos dos temas está desatualizada: faltam `.painel`, `.faixa-cabecalho`,
  `.janela-rodape`, `.selo-status`, a variável `--btn-fg` (cor do papel do botão nos temas de face cinza) e as fontes
  offline em `src/fonts.css` (WIN95FA, PT Sans, Selawik) — atualizar o texto. Evidência: os ganchos foram criados no /simplify de hoje.

## Lote 2 (Risco Baixo/Médio)
- Nenhum item: não há arquivo, função ou export sem referência (ver evidências gerais).

## Lote 3 (Risco Médio) — tudo dentro de `src/styles.css` + componentes de `src/ui/` (mesma fronteira: aparência)
- [ ] `src/styles.css` (win98 ≈432–500 e win31 ≈895–975) — os estados de botão (face, padrão, ativo com
  `translate(1px,1px)`, ghost, foco pontilhado, desabilitado) estão escritos duas vezes, só com nomes de variável
  diferentes — consolidar: nomes comuns (`--face`, `--bisel`, `--bisel-padrao`, `--bisel-ativo`) em cada tema e um bloco
  só em `:is([data-estilo='win98'], [data-estilo='win31'])`. Cerca de 70 linhas a menos.
- [ ] `src/styles.css` (desabilitado e foco em win98/xp/win31) — `--w98-/--xp-/--w31-disabled-shadow` têm os mesmos
  valores; o par `opacity: 1; cursor: default` e o contorno pontilhado se repetem — consolidar numa regra do reset compartilhado (≈290).
- [ ] `src/styles.css:393, 397, 627, 852, 856, 1257` — `#update-banner > div` depende da estrutura do DOM — extrair um
  gancho (`aviso-atualizacao`) no div montado em `src/update.ts` (≈89) e mirar nele.
- [ ] `src/styles.css:378` (win98 claro) — lista à mão os textos sobre o fundo do app (`footer > p`, `#btn-check-update`,
  `#screen-dashboard > div:last-child > p`...) — extrair um token `--sobre-app` (padrão = `--subtle`) e a utilidade
  `text-sobre-app` nesses textos; o win98 só redefine a variável.
- [ ] `src/styles.css:1282–1290` — o papel do botão é deduzido de utilidades (`.btn-outline.text-danger-fg`,
  `.nova-os.bg-accent-600`) — extrair: `btn()` (`src/ui/dom.ts`) e o "+" (`dashboard-screen.ts`) emitem o papel
  (`data-papel`), e o CSS mira nele. Mexe na API de `btn()`, por isso Médio.
- [ ] `src/styles.css` (win10) — `border-radius: 0.25rem` repetido em botão, janela, ghost, itens e banner, embora
  `--radius-*` já valha 0.25rem; e `box-shadow: none` por tema repete o reset compartilhado (≈293) — remover as repetições
  (conferir com a impressão digital de estilos usada no /simplify).

## Lote 4 (Revisão Manual) — não executar sem decisão item a item
- [ ] `src/storage.ts:164–295` — bloco "Conversões de versões antigas (1.1.0 a 1.4.15)" (`lastSheet`, eletricistas,
  `migrateAnswers`, `baixadaEm` das folhas antigas) e a chamada de `converterDados` em `loadData`. O próprio comentário
  diz que pode sair quando todos os aparelhos tiverem aberto a 1.4.16 ou mais nova (versão atual: 1.4.17). Não há como
  comprovar isso pelo código (sem telemetria): decisão do Bruno/Paulo. Risco Alto: um aparelho parado na 1.4.15 perderia
  dados ao atualizar.
- [ ] `src/storage.ts:6` — `LEGACY_KEY = 'ferracine_prod:v2'` apaga o protótipo v2 ao abrir. Referência só por string no
  `localStorage`. Remover só junto com o item anterior.
- [ ] `src/theme.ts:67` — id antigo `retro` vira `win98` (valor gravado no `localStorage` por versões antigas; há teste
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
