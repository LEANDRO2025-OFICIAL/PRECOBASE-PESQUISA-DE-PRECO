# Recon map: PrecoBase — Gestão Pública (web, PWA)

Scope: app inteiro — pesquisa de preços, cesta/mapa de apuração, catálogos, cotações, relatórios e administração
For: uso próprio (réplica funcional rebrandeada, clean room)
Date: 2026-11-14

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | app (login) | https://app.propriosgp.com.br/login | Flutter Web em canvas: sem DOM útil, recon é por tela/screenshot |
| 2 | site institucional | https://propriosgp.com.br | lista completa de funcionalidades, portais integrados, posicionamento |
| 3 | Wappalyzer | (CSV do usuário) | PWA, Flutter, Dart, Bootstrap, Nginx, ipify |
| 4 | conta do usuário | app.propriosgp.com.br | login feito pelo usuário; telas lidas por captura de canvas |
| 5 | PNCP API | https://pncp.gov.br/api/consulta | API pública — integração legítima, não é API privada do alvo |
| 6 | Painel de Preços | https://paineldeprecos.planejamento.gov.br | consulta pública |

Método de captura (não é código do alvo, é leitura de tela):
o app desenha em `<canvas>` dentro do shadow root de `flt-glass-pane`; a árvore `flt-semantics`
fica vazia na maior parte das telas. Captura = `canvas.toDataURL()` + download via `<a download>`;
clique = `PointerEvent` sintético em `document.elementFromPoint(x,y)`; texto = setar `.value`
no `input` de `flt-text-editing-host` + `InputEvent('input')`.

## Core loop

Pesquisar preços de um objeto nas bases oficiais → montar a cesta → apurar (média/mediana, outliers, índices) → gerar o mapa de apuração e o relatório que instrui o processo licitatório.

É o loop que o órgão paga: transformar consulta dispersa em **preço de referência defensável** para a fase preparatória (art. 23, Lei 14.133/2021).

## Screens

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S00 | Login | /login | autenticar por CPF/CNPJ + instituição | logo, campo usuário, select instituição, senha com reveal, botão Entrar | visto (default) |
| S01 | Cestas (lista) | /cesta_precos/cestas | ver e filtrar as cestas do órgão | header "Cestas finalizadas 50435 / 536", ícones imprimir/filtro/raio/`+`, cards | visto com 3+ cestas; modal NPS sobreposto |
| S02 | Detalhe da cesta | /cesta_precos/cestas/{id} | configurar a cesta e emitir relatórios | banner de posse, formulário, RELATÓRIOS, CORRIGIR VALORES, ARQUIVOS COMPROVAS | visto (#173935, posse SUPORTE) |
| S03 | Itens da cesta | /cesta_precos/cestas/{id}/itens | montar o objeto, quantidades e apurar por item | toolbar, tabela com MENOR/MÉDIA/MEDIANA/MAIOR, agrupamento por anexo/lote | visto (5 itens, preço não calculado) |
| S04 | Pesquisar fontes (por item) | /cesta_precos/cestas/{id}/itens/{itemId}/pesquisar_fontes | escolher preços que entram na apuração daquele item | pills do item, abas por fonte, filtros, gráfico | visto (bloqueado: posse SUPORTE) |
| S05 | Seletor de fontes | overlay em S04 e S06 | ligar/desligar as 30+ bases consultadas | abas SELECIONAR/PADRÕES/UTILIZADAS, checkboxes, editar/salvar | visto (5 fontes marcadas) |
| S06 | Pesquisa rápida de preços | /cesta_precos/pesquisa_rapida | pesquisar preço sem montar cesta | card de produto, FONTE, abas por fonte, filtros de rodapé | visto (vazio e com produto) |
| S07 | Modal Selecionar produto | overlay em S06 | escolher o item do catálogo padronizado | busca, lista `#ID (BR…) DESCRIÇÃO … UN` | visto (busca "notebook") |
| S08 | Resumo de preços do produto | dentro de S06 | ver menor/média/mediana/maior do item | bloco com ícones e 4 valores + `+` | visto (todos 0,0000; toast de timeout) |

Telas ainda não vistas (existem pelo menu/site, não confirmadas): Informativos, Catálogo de Produtos,
Catálogo de Fornecedores, Cotações, Administração/usuários, e o PDF/XLS do mapa de preços.

> Regra: nenhuma tela entra aqui por suposição. O que o site público descreve vira **feature**, não **tela**.

## Shell

Sidebar fixa ~250 px, sempre presente **exceto** nas telas de itens e de pesquisa (que são full-width
com seta de voltar).

- topo: logo "PROPRIO SISTEMAS", avatar, "Olá, Leandro Santos da Silva"
- alertas: "Contrato vencido a 30 dias", "Questionário pendente"
- menu: Cesta de Preços → Cestas / Pesquisa rápida de preços / Catálogo de Produtos / Catálogo de Fornecedores
- Informativos, Sair, "Versão: 202611130732"

Os dois itens de Catálogo aparecem **desabilitados** nesta conta (hipótese: contrato vencido ou permissão).
Na nossa versão ficam ativos (decisão do usuário).

## Flows

```
F01 Pesquisar preço de um objeto
    S00 -> S01 -> S06 -> S07 (escolher produto) -> S08 (resumo) -> abas por fonte -> selecionar preços
    edge: objeto sem resultado, item sem CATMAT/CATSER, preço muito distoante, fonte fora do ar (toast de timeout)

F02 Montar cesta e gerar mapa de apuração
    S01 (+) -> S02 (objeto, secretaria, tipo, cálculo, casas decimais, prazo) -> S03 (itens/qtd)
    -> S04 por item (fontes e preços) -> S02 RELATÓRIOS "MÉDIA DE PREÇOS (MAPA)" PDF/XLS
    edge: menos de 3 preços, outliers, correção por índice, anexos comprobatórios

F03 Cotação eletrônica com fornecedores
    catálogo de fornecedores -> seleção -> envio -> respostas -> consolidação
    (não observado; pelo site + campos "PRAZO PARA ENVIO DE COTAÇÕES" em S02)

F04 Administração da instituição
    usuários, permissões, dados do órgão, índices, integrações (não observado)
```

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Botão primário | pill, escuro, full-width no login | default, hover, disabled, loading | login, ações |
| Campo com label flutuante | texto, select, senha com ícone | vazio, preenchido, erro, foco | login, S02, S03 |
| Card de cesta | status EM ANDAMENTO (azul) / PRONTA (verde) | default | S01 |
| Bloco de resumo de preços | MENOR / MÉDIA / MEDIANA / MAIOR com ícones e cor | zerado, calculado | S03, S06/S08 |
| Tabela de preços por fonte | abas com contador, linha com órgão/data/valor/link | vazia, carregando, populada, erro de fonte | S04, S06 |
| Seletor de fontes | 3 abas + checkbox + editar/salvar | leitura, edição | S05 |
| Filtros de pesquisa (rodapé) | incluir dispensas, janela de dias, faixa de preço, faixa de qtde, UF, "apenas na região" | ativo/inativo | S04, S06 |
| Toast | erro (vermelho) / sucesso | auto-dismiss | global |
| Modal NPS | 5 perguntas (1–5, múltipla escolha, comentário, recomendação, contato) | aparece a cada carga de S01 | S01 |

## Inferred data model

```
Instituicao   id, nome, cnpj, municipio, uf, logo, plano, contrato_vigencia
              evidence: select "Instituição" no S00; alerta "Contrato vencido a 30 dias" no shell
              confidence: high

Usuario       id, instituicao_id, cpf, nome, email, papel, ativo, nivel
              evidence: "Olá, Leandro Santos da Silva"; GET /base/usuarios/eu; "usuarios/niveis"
              confidence: high

Produto       id, codigo_br (BR0xxxxxx), descricao, unidade, grupo, categoria
              evidence: S07 "#1071361 (BR0271239) ADAPTADOR CONECTOR, PADRAO: ETHERNET 10/100 MBPS, ... UN"
              confidence: high

Fonte         id, nome, sigla, tipo, requer_convenio, ativo
              evidence: S05 lista (BANPARA, BANRISUL, BBMNET, BECSP, BLL, BNC, BPS, CGU NFE, CMED,
                        COMPRAS BR, COMPRAS GOV, COMPRAS NET, COMPRAS NET GO, DOMÍNIO AMPLO, HISTÓRICO,
                        LICITA MAIS BRASIL, LICITANET, PNCP, PORTAL DE COMPRAS, S2GPR CE, SIMILARES,
                        SUPEL RO, TABELAS DE REFERÊNCIA, TCE CE/MT/PE/PI/PR/RJ/RS/SC, TCM PA,
                        TRANSP. BAHIA, TRANSP. ESPÍRITO SANTO, ...)
              confidence: high

Preco         id, produto_id, fonte_id, orgao, uf, municipio, data, valor, quantidade, documento_url,
              anexo, dispensa(bool)
              evidence: abas por fonte em S04/S06 + filtros "incluir dispensas", "270 dias", "Estados: MS"
              confidence: high

Cesta         id, instituicao_id, objeto, secretaria, categorias_objetos, tipo_contratacao,
              tipo_calculo (MÉDIA ARITMÉTICA), casas_decimais (2|3|4), data_solicitacao,
              situacao_suporte, posse (SUPORTE|CLIENTE), data_finalizacao, prazo_envio_cotacoes,
              observacao, status (EM ANDAMENTO|PRONTA), criado_por
              evidence: S02 campos literais; S01 cards com status
              confidence: high

CestaItem     cesta_id, produto_id, quantidade, unidade, anexo/lote, preco_estimado, ordem
              evidence: S03 "ANEXO I - LOTE 001", qtd editável, "PREÇO ESTIMADO NÃO CALCULADO"
              confidence: high

Apuracao      cesta_item_id, menor, media, mediana, maior, metodo, precos_selecionados[]
              evidence: colunas de S03 e bloco de S08
              confidence: high

CorrecaoIndice cesta_id, incidir_sobre, indice, data_inicial, data_final
              evidence: S02 "CORRIGIR VALORES (INCIDIR SOBRE / ÍNDICE / DATA INICIAL / DATA FINAL)"
              confidence: high

DocumentoComprovante cesta_id, nome, tipo, tamanho, data, url
              evidence: S02 "ARQUIVOS COMPROVAS" (docx/pdf com tamanho e data, remover)
              confidence: high

Cotacao       id, instituicao_id, fornecedor_id, itens[], prazo, status
              evidence: "PRAZO PARA ENVIO DE COTAÇÕES" em S02 + site
              confidence: medium

Fornecedor    id, cnpj, razao, contatos, ramos
              evidence: "catálogo de fornecedores por objeto e/ou produto"
              confidence: high
```

Relationships: Instituicao 1-n Usuario, Instituicao 1-n Cesta, Cesta 1-n CestaItem n-1 Produto,
CestaItem 1-1 Apuracao, Apuracao n-n Preco, Cesta 1-n DocumentoComprovante, Cesta 1-1 CorrecaoIndice,
Instituicao 1-n Cotacao n-n Fornecedor, Preco n-1 Fonte.

## API observada (rotas do app, não endpoints privados)

Chamadas de rede visíveis ao carregar a home autenticada — servem para nomear as entidades, não para copiar contrato:

```
GET api.propriosgp.com.br/auth/check
GET api.propriosgp.com.br/base/usuarios/eu
GET api.propriosgp.com.br/base/clientes/{id}
GET api.propriosgp.com.br/cesta_precos/revendedores
GET api.propriosgp.com.br/cesta_precos/entidades/niveis
GET api.propriosgp.com.br/cesta_precos/usuarios/niveis
GET api.propriosgp.com.br/base/informativos?somenteNaoLidos=true
GET api.propriosgp.com.br/base/questionarios/
```

## Feature matrix

Ver `features.csv`. Must: 14, should: 8, could: 5, skip: 2.

## Out of scope (cannot or should not be cloned)

- **A base de preços proprietária da PROPRIO** e o histórico acumulado dos clientes deles. Reconstruímos a integração com fontes públicas (PNCP, Painel de Preços), não o acervo deles.
- **Rede de revendas** (CGMS, Cerrado, Colibri, Eldorado, LF, Talski, Tech Bahia, Triângulo, Vilharga): é canal comercial, não funcionalidade.
- **Marca, logo, textos e identidade visual** da PROPRIO.
- **Credenciais/contratos** de acesso a portais que exijam convênio (BPS, PCP podem exigir).

## Size

Screens: 9 vistas, ~14-18 estimadas. Flows 4 principais. Entidades 12.
Hard parts: apuração estatística defensável (art. 23), normalização de itens entre portais (descrições divergentes), cotações com fornecedores, geração de mapa/relatório em PDF, multi-tenant com permissões, ingestão do catálogo padronizado.
Size: **L** (um trimestre para o app inteiro). Fatiar: núcleo de pesquisa+mapa primeiro.

## Decisões tomadas com o usuário

- Stack da nossa versão: **Next.js + Postgres** (fatia 1).
- Catálogo de Produtos e Catálogo de Fornecedores ficam **ativos** na nossa versão (no alvo estão desabilitados nesta conta).
- Copiar o catálogo de produtos do alvo (dados públicos de descrição/unidade) e, se possível, fornecedores.
- Autorizado criar uma cesta nova de aquisição de veículos na conta do usuário para observar o fluxo completo.
