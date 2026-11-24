# Auditoria de Código Legado
Data: 2026-11-24 | Escopo: restos do encerramento que gerava e baixava o PDF (1.4.16) | Linha de base dos testes: `pnpm lint` OK, `pnpm test` 65/65, e2e 39/39

Projeto: TypeScript (Vite, Vitest, Playwright) + Kotlin (APK). Comandos: `pnpm lint`, `pnpm test`, `pnpm test:e2e`, `pnpm check`.
Evidências: `git grep` em src, tests, README.md e CLAUDE.md; `tsc --noEmit` (noUnusedLocals) sem avisos.

## Lote 1 (Risco Baixo)
- [x] `src/app.ts:213` — comentário do pré-carregamento ainda cita "Encerrar gera o PDF" — corrigir (o pré-carregamento continua útil para Abrir/Compartilhar)
- [x] `src/app.ts:48` — comentário do `pdfMemo` cita "a do turno" — corrigir (só folhas do histórico)
- [x] `README.md:45` — "Encerrar turno e gerar PDF … baixa o PDF" — atualizar para o fluxo novo
- [x] `CLAUDE.md:85` e `CLAUDE.md:150-151` — descrevem o download automático e "erro ao gerar mantém o turno aberto" — atualizar

## Lote 2 (Risco Baixo/Médio)
- Nenhum item: `sheetPdf`, `loadPdfModule`, `downloadFile` e o pré-carregamento seguem em uso (`deliverSheet`, `abrirHistorico`); a variável `generating` e a guarda de "turno mudou" já saíram no commit da funcionalidade.

## Lote 3 (Risco Médio)
- Nenhum item.

## Lote 4 (Revisão Manual)
- Nenhum item.
