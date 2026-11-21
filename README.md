# Folha de Produção Diária (Ferracine_Prod)

App para o eletricista registrar no celular as Ordens de Serviço (OSs) do turno e gerar o PDF oficial do
**Espelho de Campo** (Energisa, Departamento de Operação). Funciona **100% sem internet**: como APK Android ou como
app web instalável (PWA). Nenhum dado sai do aparelho: tudo fica guardado no próprio celular.

- **APK (Android)**: baixe o `FerracineProd-<versão>.apk` em
  [Releases](https://github.com/Bruno1991/Ferracine_Prod/releases/latest) e instale (o Android pede para permitir
  "instalar apps desconhecidos" na primeira vez).
- **Web / PWA**: <https://bruno1991.github.io/Ferracine_Prod/> (abra uma vez com internet; depois funciona offline e
  pode ser instalado pelo menu do navegador).

## Como funciona

1. **Cabeçalho do turno**: nome e matrícula do integrante principal (obrigatórios), dupla (opcional), equipe,
   viatura, data, horário de início e fim, bodycams e técnico líder. A partir do segundo turno, **tudo vem
   preenchido com o último turno**; a data é sempre a de hoje (do sistema) e o técnico líder começa em branco.
   Os técnicos líderes são cadastrados no próprio app ("Adicionar / excluir técnicos").
2. **Painel**: digita o número da OS (opcional: vazio vira "S/N") e toca no código, ou digita outro código.
   - **Comercial** (28 / 709 / 739 / 33 / 798), 12 perguntas: tipo de serviço, KM inicial, hora inicial, cliente
     presente, lançou ramal, medidor instalado e retirado (com número), leituras, KM final, horário final,
     dificuldade na execução.
   - **Ocorrência** (508 / 509 / 503 / 531 / 324 / 533), 12 perguntas: callback, número da OS, hora inicial,
     KM inicial, tipo de serviço, defeito, dispositivo manobrado, **DITAIS** (obrigatória), KM final, alteração
     na UC do cliente, hora final, dificuldade.
3. **Assistente**: uma pergunta por vez, com Pular, Voltar e barra de progresso. Voltar (o da tela ou o do
   Android) vai à pergunta anterior e, na primeira, ao painel. Perguntas "se sim, qual?" exigem o complemento.
4. **OSs do turno**: o **lápis** abre a edição completa (número, código e qualquer resposta); o olho mostra as
   respostas; a lixeira exclui. Número de OS repetido pede confirmação.
5. **Finalizar turno**: gera o PDF e salva na hora (no APK, na pasta Downloads). A janela "PDF gerado" oferece
   Compartilhar, Baixar e Abrir; o turno só é encerrado ao tocar em **Encerrar turno**. O último PDF fica na tela
   inicial para baixar de novo.

A OS em preenchimento é salva a cada toque: fechar o app no meio não perde as respostas.

### O PDF (Espelho de Campo)

Segue a folha de papel [design/ex_pdf.jpeg](design/ex_pdf.jpeg), em A4 paisagem e preto e branco: logo do Grupo
Energisa, identificação da equipe e tabela de 15 linhas com **ITEM, OS/OCORRÊNCIA, TIPO DE SERVIÇO (só o código),
KM INICIAL, HORÁRIO INICIAL, HORÁRIO FINAL, KM FINAL, MEDIDOR INSTALADO, LEITURA, MEDIDOR RETIRADO, LEITURA,
CLIENTE PRESENTE (quadradinhos SIM/NÃO) e INFO ADICIONAL**. INFO ADICIONAL traz tudo o que o eletricista respondeu
e não tem coluna própria (tipo de serviço, callback, defeito, dispositivo, DITAIS, alteração na UC, dificuldades...).
No rodapé, produção total e os técnicos cadastrados com o líder marcado. Com mais de 15 OSs, cada 15 viram uma folha
completa (logo, identificação e 15 linhas, numeração do ITEM seguindo), marcada "FOLHA 1/2", "FOLHA 2/2"...; o rodapé
sai só na última. Nome do arquivo: `Nome1_Nome2_N_servicos.pdf`.

### Aparência

Tema claro e escuro (botão no topo; sem escolha, segue o celular), com as cores do logo: ciano para Comercial e
ações principais, laranja para Ocorrência e encerramento. O logo do Grupo Energisa aparece no topo do app e no
PDF; a prancheta é o ícone do app (aba do navegador, PWA e APK).

## Desenvolvimento

Requer Node 22+ e pnpm 11. O APK precisa também do JDK 17 e do Android SDK (plataforma 35).

```bash
pnpm install
pnpm dev          # http://localhost:5173 (também na rede local, para abrir no celular)
pnpm check        # tipos + testes unitários + build + testes ponta a ponta
pnpm apk          # build web + APK assinado em release/FerracineProd-<versão>.apk
```

| Comando | O que faz |
|---|---|
| `pnpm lint` | checagem de tipos (`tsc --noEmit`, modo estrito) |
| `pnpm test` | testes unitários (Vitest) |
| `pnpm test pdf` | só os testes cujo arquivo contém "pdf" |
| `pnpm build` | gera o site estático em `dist/` com service worker |
| `pnpm test:e2e` | fluxo completo no Chrome com tela de celular (Playwright); rode `pnpm build` antes |
| `pnpm apk` | build web + APK release assinado (ver "APK" abaixo) |
| `pnpm icons` | regenera favicon e ícones do PWA a partir de `public/icon.png` (prancheta) |
| `pnpm android:icons` | regenera os ícones do APK a partir de `public/icon.png` |
| `pnpm logo` | regenera o logo do PDF (`src/assets/energisa-pdf.png`) a partir de `src/assets/energisa.svg` |

## APK

`android/` é um app nativo mínimo: uma WebView que serve o build web de dentro do APK (sem permissão de internet),
mais uma ponte que salva o PDF em Downloads, abre no leitor de PDF e compartilha. O botão voltar do Android segue
a navegação do app. A versão do APK é a do `package.json`.

A assinatura usa a chave `C:\dev\.secrets\ferracine-prod-release.jks`, com as variáveis
`FERRACINE_PROD_KEYSTORE_FILE`, `FERRACINE_PROD_KEYSTORE_PASSWORD`, `FERRACINE_PROD_KEY_ALIAS` e
`FERRACINE_PROD_KEY_PASSWORD` em `C:\dev\.env` (fora do repositório). **Guarde essa chave**: sem ela, uma versão
nova não instala por cima da antiga. O `android/local.properties` aponta o SDK (`sdk.dir=...`) e não vai para o git.

## Estrutura

```
design/       referências do dono do app: layout, logo, ícone, modelo e foto do PDF
src/domain/   regras puras: catálogo de códigos e perguntas, assistente, linhas do espelho, formatação
src/storage.ts  estado salvo no aparelho (chave ferracine_prod:v3; migra a v2)
src/pdf.ts    montagem do PDF com jsPDF + AutoTable (carregado só ao gerar)
src/platform.ts ponte com o APK (salvar/abrir/compartilhar o PDF)
src/ui/       telas (cabeçalho, painel, assistente, edição), toast e modal
src/app.ts    controlador: estado, persistência e navegação entre telas
android/      app Android (WebView + ponte do PDF)
tests/unit/   Vitest   ·   tests/e2e/  Playwright
```

Para mudar códigos ou perguntas, edite só [src/domain/catalog.ts](src/domain/catalog.ts): o app e o PDF se ajustam.

## Publicação

- **GitHub Pages**: todo push no `main` roda `.github/workflows/deploy-pages.yml` (tipos, testes unitários, build)
  e publica `dist/` em <https://bruno1991.github.io/Ferracine_Prod/>.
- **APK**: `pnpm apk` e anexar `release/FerracineProd-<versão>.apk` a uma Release do GitHub
  (`gh release create v<versão> release/FerracineProd-<versão>.apk`).

## Histórico

A primeira versão foi um `index.html` único gerado com o Gemini (preservado no primeiro commit deste repositório).
O layout segue `design/index_base.html` e o PDF segue a folha de papel do Espelho de Campo. Sobre essa base, o app
acrescenta: funcionamento offline (PWA e APK), salvamento da OS em andamento, edição completa de OS, correção do
cabeçalho, preenchimento automático do turno, técnicos cadastráveis, reenvio do último PDF e proteção contra
injeção de HTML.
