# Folha de Produção Diária (Ferracine_Prod)

App web para o eletricista registrar no celular as Ordens de Serviço (OSs) do turno e gerar o PDF oficial da
Folha de Produção Diária (Energisa, Departamento de Operação). Funciona **sem internet** depois do primeiro acesso
e pode ser instalado na tela inicial (PWA). Nenhum dado sai do aparelho: tudo fica no armazenamento local do navegador.

## Como funciona

1. **Cabeçalho do turno**: Nome e Matrícula do integrante principal (obrigatórios), dupla (opcional), data, horário
   de início e fim e Bodycam 1. O botão "Usar equipe do último turno" repete nomes e matrículas.
2. **Painel**: digita o número da OS e toca no código do atendimento.
   - Comercial (3 perguntas): 28, 709, 739, 33, 798
   - Ocorrência (18 perguntas): 508, 509, 503, 531, 324, 533
3. **Assistente**: uma pergunta por vez, com Pular, Voltar e barra de progresso. A pergunta dos **DITAIS** é
   obrigatória (não tem Pular) e sai destacada em vermelho no PDF. Nas perguntas "Se sim, qual?", marcar SIM exige o
   complemento.
4. **OSs do turno**: ver respostas, editar ou excluir. Número de OS repetido pede confirmação.
5. **Finalizar turno**: gera o PDF A4 (cabeçalho da equipe, total por tipo, uma tabela por OS, rodapé com página),
   encerra a folha e volta ao cabeçalho vazio. O último PDF fica na tela inicial para baixar de novo ou
   compartilhar (WhatsApp, e-mail) caso o download falhe.

A OS em preenchimento é salva a cada toque: fechar o navegador ou a aba no meio não perde as respostas.

## Desenvolvimento

Requer Node 22+ e pnpm 11.

```bash
pnpm install
pnpm dev          # http://localhost:5173 (também na rede local, para abrir no celular)
pnpm check        # tipos + testes unitários + build + testes ponta a ponta
```

| Comando | O que faz |
|---|---|
| `pnpm lint` | checagem de tipos (`tsc --noEmit`, modo estrito) |
| `pnpm test` | testes unitários (Vitest) |
| `pnpm test pdf` | só os testes cujo arquivo contém "pdf" |
| `pnpm build` | gera o site estático em `dist/` com service worker |
| `pnpm test:e2e` | fluxo completo no Chrome com tela de celular (Playwright); rode `pnpm build` antes |
| `pnpm icons` | regenera os ícones PNG do PWA a partir de `public/icon.svg` |

## Estrutura

```
src/domain/   regras puras: catálogo de códigos e perguntas, assistente, formatação
src/storage.ts  estado salvo no localStorage (chave ferracine_prod:v2)
src/pdf.ts    montagem do PDF com jsPDF + AutoTable (carregado só ao gerar)
src/ui/       telas (cabeçalho, painel, assistente), toast e modal
src/app.ts    controlador: estado, persistência e navegação entre telas
tests/unit/   Vitest   ·   tests/e2e/  Playwright
```

Para mudar códigos ou perguntas, edite só [src/domain/catalog.ts](src/domain/catalog.ts): o app e o PDF se ajustam.

## Publicação

`dist/` é um site estático com caminhos relativos: serve em GitHub Pages, Cloudflare Pages ou qualquer servidor
HTTPS (o modo offline exige HTTPS ou `localhost`). Ainda não há repositório remoto nem endereço publicado.

## Histórico

A primeira versão foi um `index.html` único gerado com o Gemini (preservado no primeiro commit deste repositório;
o link da conversa está em `conversa_com_gemini.txt`). Esta versão mantém o fluxo, os códigos, as perguntas e o
layout do PDF e acrescenta: funcionamento offline, salvamento da OS em andamento, edição de OS, correção do
cabeçalho, data e hora com seletor nativo, reenvio do último PDF e proteção contra injeção de HTML.
