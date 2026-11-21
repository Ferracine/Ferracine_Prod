# Folha de Produção Diária (Ferracine_Prod)

App para o eletricista registrar no celular as Ordens de Serviço (OSs) do turno e gerar o PDF oficial do
**Espelho de Campo** (Energisa, Departamento de Operação). Funciona **100% sem internet**: como APK Android ou como
app web instalável (PWA). Nenhum dado sai do aparelho: tudo fica guardado no próprio celular. A internet, quando
houver, só serve para o app se atualizar.

- **APK (Android)**: baixe o `FerracineProd-<versão>.apk` em
  [Releases](https://github.com/Bruno1991/Ferracine_Prod/releases/latest) e instale (o Android pede para permitir
  "instalar apps desconhecidos" na primeira vez). Depois disso o próprio app avisa quando sair versão nova (ver
  "Atualização do APK").
- **Web / PWA**: <https://bruno1991.github.io/Ferracine_Prod/> (abra uma vez com internet; depois funciona offline e
  pode ser instalado pelo menu do navegador).

## Como funciona

1. **Cabeçalho do turno**: nome e matrícula do eletricista 1 (obrigatórios), eletricista 2 (opcional), equipe,
   viatura, data, horário de início e fim, bodycams e técnico líder. A partir do segundo turno, **tudo vem
   preenchido com o último turno**; a data é sempre a de hoje (do sistema) e o técnico líder começa em branco.
   Os técnicos líderes são cadastrados no próprio app ("Adicionar / excluir técnicos").
2. **Painel**: dois botões **+**, um **Comercial** (ciano) e um **Ocorrência** (laranja). Cada um abre a tela da OS em
   branco com as perguntas do tipo; no topo, o campo do número (da ocorrência ou da OS comercial) e, abaixo,
   o do código do serviço. Código da lista do outro tipo é recusado (as perguntas seriam as erradas).
   - **Comercial** (28 / 709 / 739 / 33 / 798), 12 perguntas: tipo de serviço, KM inicial, hora inicial, cliente
     presente, lançou ramal, medidor instalado e retirado (com número), leituras, KM final, horário final,
     dificuldade na execução.
   - **Ocorrência** (508 / 509 / 503 / 531 / 324 / 533), 14 perguntas: callback, número da OS, hora inicial,
     KM inicial, tipo de serviço, defeito, dispositivo manobrado, **DITAIS** (obrigatória), KM final, alteração
     na UC do cliente, medidor instalado (com número), leitura do medidor instalado, hora final, dificuldade.
3. **Tela da OS**: número (opcional: vazio vira "S/N"), código (obrigatório) e todas as perguntas numa página só, a
   mesma do lápis. Responda o que souber e toque em **Salvar OS**. Perguntas "se sim, qual?" exigem o complemento. O que é
   preenchido fica salvo no aparelho na hora: fechar o app no meio não perde a OS. Cancelar (ou o voltar do
   Android) pede confirmação se algo foi preenchido.
4. **OSs do turno**: o **lápis** abre a mesma tela da OS para editar qualquer item; o olho mostra as
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
No rodapé, produção total e os técnicos cadastrados com o líder marcado. Logo e identificação ficam só na primeira folha. Com
mais de 15 OSs, cada 15 a mais abrem uma folha que continua a tabela (títulos das colunas repetidos, ITEM seguindo); a
produção total e os técnicos saem na última. Embaixo de toda folha: data, equipe e "FOLHA 1/2", "FOLHA 2/2"... Nome do arquivo: `Nome1_Nome2_N_servicos.pdf`.

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

`android/` é um app nativo mínimo: uma WebView que serve o build web de dentro do APK (funciona sem internet),
mais uma ponte que salva o PDF em Downloads, abre no leitor de PDF e compartilha. O botão voltar do Android segue
a navegação do app. A versão do APK é a do `package.json`.

A assinatura usa a chave `C:\dev\.secrets\ferracine-prod-release.jks`, com as variáveis
`FERRACINE_PROD_KEYSTORE_FILE`, `FERRACINE_PROD_KEYSTORE_PASSWORD`, `FERRACINE_PROD_KEY_ALIAS` e
`FERRACINE_PROD_KEY_PASSWORD` em `C:\dev\.env` (fora do repositório). **Guarde essa chave**: sem ela, uma versão
nova não instala por cima da antiga. O `android/local.properties` aponta o SDK (`sdk.dir=...`) e não vai para o git.

## Estrutura

```
design/       referências do dono do app: layout, logo, ícone, modelo e foto do PDF
src/domain/   regras puras: catálogo de códigos e perguntas, regras da OS, linhas do espelho, formatação
src/storage.ts  estado salvo no aparelho (chave ferracine_prod:v3; migra a v2)
src/pdf.ts    montagem do PDF com jsPDF + AutoTable (carregado só ao gerar)
src/platform.ts ponte com o APK (salvar/abrir/compartilhar o PDF)
src/ui/       telas (cabeçalho, painel, tela da OS), toast e modal
src/app.ts    controlador: estado, persistência e navegação entre telas
android/      app Android (WebView + ponte do PDF)
tests/unit/   Vitest   ·   tests/e2e/  Playwright
```

Para mudar códigos ou perguntas, edite só [src/domain/catalog.ts](src/domain/catalog.ts): o app e o PDF se ajustam.

## Publicação

- **GitHub Pages**: todo push no `main` roda `.github/workflows/deploy-pages.yml` (tipos, testes unitários, build)
  e publica `dist/` em <https://bruno1991.github.io/Ferracine_Prod/>.
- **APK**: suba a versão no `package.json`, rode `pnpm apk` e anexe `release/FerracineProd-<versão>.apk` a uma Release
  do GitHub (`gh release create v<versão> release/FerracineProd-<versão>.apk`). Publicar a Release já entrega a
  atualização a todos os celulares com o APK (ver abaixo).

### Atualização do APK

Com internet, o APK consulta a última Release do repositório (ao abrir e ao voltar para o app; se não houver nada
novo, no máximo a cada 6 horas). Se a Release `vX.Y.Z` for maior que a versão instalada e tiver o
`FerracineProd-X.Y.Z.apk` anexado, aparece um aviso no topo: **Atualizar** baixa o APK (~0,6 MB) e abre o instalador
do Android; **X** esconde o aviso até a próxima abertura. Na primeira vez o Android pede para liberar "Instalar apps
desconhecidos" para a Folha de Produção; liberado, a instalação continua sozinha. O Android só instala por cima um
APK assinado com a mesma chave, e os dados do turno continuam. O Google Play Protect pode pedir para "Verificar
app" (envia o APK ao Google) ou oferecer "Mais detalhes" → "Instalar sem análise" (o Samsung pede a digital ou o
PIN); qualquer um dos dois segue a instalação. No rodapé ficam a versão instalada e o botão
**Procurar atualização**. Sem internet nada muda. No navegador/PWA quem atualiza é o service worker.

## Histórico

A primeira versão foi um `index.html` único gerado com o Gemini (preservado no primeiro commit deste repositório).
O layout segue `design/index_base.html` e o PDF segue a folha de papel do Espelho de Campo. Sobre essa base, o app
acrescenta: funcionamento offline (PWA e APK), salvamento da OS em andamento, edição completa de OS, correção do
cabeçalho, preenchimento automático do turno, técnicos cadastráveis, reenvio do último PDF e proteção contra
injeção de HTML.
