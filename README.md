# Folha de Produção Diária (Ferracine_Prod)

App web para o eletricista registrar no celular as Ordens de Serviço (OSs) do turno e gerar o PDF oficial da
Folha de Produção Diária (Energisa, Departamento de Operação). Funciona **sem internet** depois do primeiro acesso
e pode ser instalado na tela inicial (PWA). Nenhum dado sai do aparelho: tudo fica no armazenamento local do navegador.

## Como funciona

1. **Cabeçalho do turno**: Nome e Matrícula do integrante principal (obrigatórios), dupla (opcional), equipe,
   viatura, data, horário de início e fim, Bodycam 1 e 2 e técnico líder responsável. O botão "Usar equipe do
   último turno" repete nomes, matrículas, equipe, viatura e líder.
2. **Painel**: digita o número da OS (opcional: vazio vira "S/N") e toca no código do atendimento, ou digita outro
   código em "Outro código".
   - Comercial (3 perguntas): 28, 709, 739, 33, 798
   - Ocorrência (18 perguntas): 508, 509, 503, 531, 324, 533
3. **Assistente**: uma pergunta por vez, com Pular, Voltar e barra de progresso. A pergunta dos **DITAIS** é
   obrigatória (não tem Pular). Nas perguntas "Se sim, qual?", marcar SIM exige o complemento. Numa OS "S/N", o
   número respondido na pergunta 2 da ocorrência vira o número da OS.
4. **OSs do turno**: lápis para preencher/corrigir o número, olho para ver (e editar) as respostas, lixeira para
   excluir. Número de OS repetido pede confirmação.
5. **Finalizar turno**: gera o **Espelho de Campo** em PDF e baixa na hora. A janela "PDF gerado" oferece
   Compartilhar, Baixar e Abrir; o turno só é encerrado ao tocar em **Encerrar turno**. O último PDF fica na tela
   inicial para baixar de novo.

### O PDF (Espelho de Campo)

Segue o modelo em [design/espelho_de_campo.md](design/espelho_de_campo.md), em A4 paisagem:
identificação (nomes, matrículas, equipe, viatura, data, horário, bodycams), tabela com uma linha por OS (mínimo de
20 linhas: OS, tipo de serviço, medidor instalado/retirado e leituras, desvios), produção total e técnico líder
marcado com [X]. As páginas seguintes trazem o **detalhamento** de cada OS com todas as respostas (DITAIS, KM,
horários, defeito...), que não têm coluna no espelho. Nome do arquivo: `Nome1_Nome2_N_servicos.pdf`.

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
| `pnpm icons` | regenera os ícones PNG do PWA a partir de `public/icon.png` |

## Estrutura

```
design/       referências do dono do app: layout (index_base.html), ícone e modelo do PDF
src/domain/   regras puras: catálogo de códigos e perguntas, assistente, linhas do espelho, formatação
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

A primeira versão foi um `index.html` único gerado com o Gemini (preservado no primeiro commit deste repositório).
O layout atual segue `design/index_base.html` (tema escuro, OS sem número, outro código, encerramento manual do
turno) e o PDF segue o modelo do Espelho de Campo. Sobre essa base, o app acrescenta: funcionamento offline,
salvamento da OS em andamento, edição de respostas, correção do cabeçalho, data e hora com seletor nativo, reenvio
do último PDF e proteção contra injeção de HTML.
