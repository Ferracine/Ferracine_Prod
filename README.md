# Folha de Produção Diária (Ferracine_Prod)

App para o eletricista registrar no celular as Ordens de Serviço (OSs) do turno e gerar o PDF oficial do
**Espelho de Campo** (Energisa, Departamento de Operação). Funciona **100% sem internet**: como APK Android ou como
app web instalável (PWA). Nenhum dado sai do aparelho: tudo fica guardado no próprio celular. A internet, quando
houver, só serve para o app se atualizar.

- **APK (Android)**: baixe o `FerracineProd-<versão>.apk` em
  [Releases](https://github.com/Ferracine/Ferracine_Prod/releases/latest) e instale (o Android pede para permitir
  "instalar apps desconhecidos" na primeira vez). Depois disso o próprio app avisa quando sair versão nova (ver
  "Atualização do APK").
- **Web / PWA**: <https://ferracine.github.io/Ferracine_Prod/> (abra uma vez com internet; depois funciona offline e
  pode ser instalado pelo menu do navegador).

## Como funciona

1. **Cabeçalho do turno**: **Solo** ou **Dupla**, Eletricista 1 (e 2 na dupla) escolhidos na lista dos cadastrados
   (a matrícula aparece no campo ao lado), equipe, viatura, data, horário de início e fim, bodycams e técnico líder (obrigatório). Na dupla, quem está escolhido num eletricista não aparece na lista do
   outro. A partir do segundo turno, **tudo vem
   preenchido com o último turno**; a data é sempre a de hoje (do sistema) e o técnico líder começa em branco.
   Eletricistas (nome e matrícula) e técnicos líderes (nome e telefone) são cadastrados no próprio app
   ("Adicionar / excluir eletricistas" e "Adicionar / excluir técnicos").
2. **Painel**: dois botões **+**, um **Comercial** (ciano) e um **Ocorrência** (laranja). Cada um abre a tela da OS em
   branco com as perguntas do tipo; no topo, o campo do número (da ocorrência ou da OS comercial) e, abaixo,
   o do código do serviço. Qualquer código vale nos dois tipos (são muitos serviços; a folha pode ser corrigida
   depois).
   - **Comercial** (ex.: 28 / 709 / 739 / 33 / 798): tipo de serviço, KM inicial, hora inicial, cliente presente,
     lançou ramal, número e leitura do medidor instalado (o da UC), **foi instalado novo medidor?** (SIM abre,
     recuados, o número e a leitura do medidor novo), **DITAIS** (obrigatória), KM final, horário final,
     informações adicionais. No Espelho
     de Campo: sem troca, o medidor da UC vai para MEDIDOR INSTALADO; na troca, o novo vai para MEDIDOR INSTALADO e
     o da UC para MEDIDOR RETIRADO.
   - **Ocorrência** (ex.: 508 / 509 / 503 / 531 / 324 / 533), 13 perguntas: callback, hora inicial,
     KM inicial, tipo de serviço, defeito, dispositivo manobrado, **DITAIS** (obrigatória), KM final, alteração
     na UC do cliente, número do medidor instalado (só o número: troca de medidor é OS comercial), leitura do
     medidor instalado, hora final, informações adicionais.
   - Todos os campos de texto ficam em maiúsculas (o teclado abre com caps e o texto é convertido).
3. **Tela da OS**: número (opcional: vazio vira "S/N"), código (obrigatório) e todas as perguntas numa página só, a
   mesma do lápis. Responda o que souber e toque em **Salvar OS**. A última pergunta, **Informações adicionais**, é uma caixa aberta
   para relatar o que for necessário; vai direto para a coluna INFORMAÇÃO ADICIONAL. O que é
   preenchido fica salvo no aparelho na hora: fechar o app no meio não perde a OS. Cancelar (ou o voltar do
   Android) pede confirmação se algo foi preenchido.
4. **OSs do turno**: o **lápis** abre a mesma tela da OS para editar qualquer item; o olho mostra as
   respostas; a lixeira exclui. Número de OS repetido pede confirmação.
5. **Encerrar turno**: um toque encerra o turno e a folha vai para as últimas encerradas; nada é baixado sozinho.
   Só aparece uma janela se houver o que conferir (nenhuma OS, OS sem número, sem DITAIS, sem técnico líder ou uma
   folha ainda não baixada que sairia do histórico). Até ser baixada (botão Baixar PDF), a folha mostra **PDF não baixado**.
6. **Últimas 4 folhas encerradas** (na tela inicial e no botão de histórico do topo, ao lado do tema): **Baixar** (salva o PDF; no APK, na pasta Downloads),
   **Abrir**, **Compartilhar**, **Editar** e **Excluir**. Editar reabre a folha como turno (cabeçalho e OSs) para
   corrigir; ao encerrar de novo, o PDF corrigido volta ao topo. A 5ª folha mais antiga sai.

Campo obrigatório que falta (eletricista, horário, código da OS, DITAIS, dados do cadastro) fica
com a **caixa vermelha** até ser preenchido.

A OS em preenchimento é salva a cada toque: fechar o app no meio não perde as respostas.

### O PDF (Espelho de Campo)

Segue a folha de papel [design/ex_pdf.jpeg](design/ex_pdf.jpeg), em A4 paisagem e preto e branco: logo do Grupo
Energisa, identificação da equipe e tabela de 15 linhas com **ITEM, OS/OCORRÊNCIA, CÓDIGO (do serviço),
KM INICIAL, HORÁRIO INICIAL, HORÁRIO FINAL, KM FINAL, MEDIDOR INSTALADO, LEITURA, MEDIDOR RETIRADO, LEITURA,
CLIENTE PRESENTE (quadradinhos SIM/NÃO) e INFORMAÇÃO ADICIONAL**. INFORMAÇÃO ADICIONAL traz tudo o que o eletricista respondeu
e não tem coluna própria (tipo de serviço, callback, defeito, dispositivo, DITAIS, alteração na UC, informações adicionais...).
No rodapé, produção total e os técnicos cadastrados com o líder marcado. Logo e identificação ficam só na primeira folha. Com
mais de 15 OSs, cada 15 a mais abrem uma folha que continua a tabela (títulos das colunas repetidos, ITEM seguindo); a
produção total e os técnicos saem na última. Embaixo de toda folha: data, equipe e "FOLHA 1/2", "FOLHA 2/2"... Nome do arquivo: `Nome1_Nome2_DD-MM-AAAA_N_servicos.pdf` (com a data do turno).

### Aparência

Três temas, cada um com variante clara e escura. O botão da paleta, no topo, abre a lista para escolher o tema; o do
sol/lua troca claro e escuro (sem escolha, segue o celular):
- **Tema 1 – Moderno** (padrão): cantos arredondados, com as cores do logo: ciano para Comercial e ações
  principais, laranja para Ocorrência e encerramento.
- **Tema 2 – Retrô 98**: visual de janela dos anos 90, com área de trabalho verde-azulada, superfícies cinza,
  cantos retos, botões e campos em relevo e barra de título em degradê nas janelas.
- **Tema 3 – Windows 3.1**: janelas brancas com moldura preta, botões cinza em relevo e barra de título sólida.

Nos temas retrô os azuis são os do logo Energisa. O logo do Grupo Energisa aparece no topo do app e no
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

`android/` é um app nativo mínimo: uma WebView que serve o build web de dentro do APK (funciona sem internet),
mais uma ponte que salva o PDF em Downloads, abre no leitor de PDF e compartilha. O botão voltar do Android segue
a navegação do app. A versão do APK é a do `package.json`.

A assinatura usa a chave `C:\dev\.secrets\ferracine-prod-release.jks`, com as variáveis
`FERRACINE_PROD_KEYSTORE_FILE`, `FERRACINE_PROD_KEYSTORE_PASSWORD`, `FERRACINE_PROD_KEY_ALIAS` e
`FERRACINE_PROD_KEY_PASSWORD` em `C:\dev\.env` (fora do repositório). **Guarde essa chave**: sem ela, uma versão
nova não instala por cima da antiga. O `android/local.properties` aponta o SDK (`sdk.dir=...`) e não vai para o git.

## Estrutura

```
design/       referência do dono do app: foto do PDF em papel (dados à mão cobertos)
src/domain/   regras puras: catálogo de perguntas, regras da OS, linhas do espelho, formatação
src/storage.ts  estado salvo no aparelho (chave ferracine_prod:v3)
src/pdf.ts    montagem do PDF com jsPDF + AutoTable (carregado só ao gerar)
src/platform.ts ponte com o APK (salvar/abrir/compartilhar o PDF)
src/ui/       telas (cabeçalho, painel, tela da OS), toast e modal
src/app.ts    controlador: estado, persistência e navegação entre telas
android/      app Android (WebView + ponte do PDF)
tests/unit/   Vitest   ·   tests/e2e/  Playwright
```

Para mudar perguntas, edite só [src/domain/catalog.ts](src/domain/catalog.ts): o app e o PDF se ajustam.

## Publicação

- **GitHub Pages**: todo push no `main` roda `.github/workflows/deploy-pages.yml` (tipos, testes unitários, build)
  e publica `dist/` em <https://ferracine.github.io/Ferracine_Prod/>.
- **APK**: suba a versão no `package.json`, rode `pnpm apk` e anexe `release/FerracineProd-<versão>.apk` a uma Release
  do GitHub (`gh release create v<versão> release/FerracineProd-<versão>.apk`). Publicar a Release já entrega a
  atualização a todos os celulares com o APK (ver abaixo).

### Atualização do APK

Com internet, o APK consulta a última Release do repositório (toda vez que o app é aberto, e ao voltar para ele se a
última consulta foi há mais de 1 hora). Se a Release `vX.Y.Z` for maior que a versão instalada e tiver o
`FerracineProd-X.Y.Z.apk` anexado, aparece um aviso no topo: **Atualizar** baixa o APK (~0,6 MB) e abre o instalador
do Android; **X** esconde o aviso até a próxima abertura. Na primeira vez o Android pede para liberar "Instalar apps
desconhecidos" para a Folha de Produção; liberado, a instalação continua sozinha. O Android só instala por cima um
APK assinado com a mesma chave, e os dados do turno continuam. O Google Play Protect pode pedir para "Verificar
app" (envia o APK ao Google) ou oferecer "Mais detalhes" → "Instalar sem análise" (o Samsung pede a digital ou o
PIN); qualquer um dos dois segue a instalação. No rodapé ficam a versão instalada e o botão
**Procurar atualização**: enquanto consulta mostra "Procurando..." e, se houver versão nova, o aviso aparece ali no
rodapé. Sem internet nada muda. No navegador/PWA quem atualiza é o service worker.

## Créditos

- **Idealizador:** Paulo Vitor Ferracini Silva — [github.com/Ferracine](https://github.com/Ferracine)
- **Desenvolvimento:** Elias Bruno Silva — [github.com/Bruno1991](https://github.com/Bruno1991) · Claude Code —
  [github.com/claude](https://github.com/claude)

## Histórico

A primeira versão foi um `index.html` único gerado com o Gemini (preservado no primeiro commit deste repositório).
O layout seguiu um modelo enviado pelo dono e o PDF segue a folha de papel do Espelho de Campo. Sobre essa base, o app
acrescenta: funcionamento offline (PWA e APK), salvamento da OS em andamento, edição completa de OS, correção do
cabeçalho, preenchimento automático do turno, técnicos cadastráveis, histórico das 4 últimas folhas (baixar, abrir, compartilhar, editar e excluir) e proteção contra
injeção de HTML.
