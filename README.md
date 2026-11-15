# PreçoBase — Pesquisa de Preço

Clone do PrecoBase para gestão de pesquisa de preços públicos, emitindo documentos oficiais no padrão dos anexos e conectando os catálogos CATMAT/CATSER à elaboração da cesta.

## Identidade
- **Nome:** PreçoBase
- **Tagline:** Gestão de Pesquisa de Preços
- **Paleta:** canvas `#F7F5F1`, surface `#FFF`, ink `#12211F`, muted `#6B7B78`, brand teal `#0E6E62`, accent âmbar `#E8A33D`, danger `#D64545`, info `#2C7DA0`
- **Tipografia:** serif editorial para títulos

## Stack
- Next.js 15.5.29 (App Router, Server Components)
- PostgreSQL 16 local (`localhost:5432`, database `precobase`)
- Prisma ORM
- CSS puro (design system)
- pdfkit, exceljs, qrcode, docx (geração de documentos)
- Porta: **3100**

## Credenciais do clone
- E-mail: `leandro@precobase.local`
- Senha: `precobase123`

## Rotas
| Rota | Descrição |
|------|-----------|
| `/` | Painel / Dashboard |
| `/cestas` | Lista de cestas de preços |
| `/cestas/nova` | Criar cesta |
| `/cestas/[id]` | Detalhe da cesta (relatórios, status, documentos) |
| `/cestas/[id]/itens` | Itens da cesta |
| `/cestas/[id]/itens/novo` | Adicionar item (catálogo CATMAT/CATSER/PROPRIO ou avulso) |
| `/cestas/[id]/itens/[itemId]/pesquisar-fontes` | Pesquisar preços por fonte |
| `/cestas/[id]/relatorio/[arquivo]` | Download de documentos (PDF/XLSX/DOCX) |
| `/pesquisa-rapida` | Pesquisa rápida de preços |
| `/produtos` | Catálogo de produtos |
| `/fornecedores` | Catálogo de fornecedores |
| `/informativos` | Informativos |
| `/configuracoes` | Configurações do sistema |
| `/status` | Status dos conectores (PNCP, CATMAT, CATSER, BLL, BNC, CGU NFE) |
| `/p/[token]` | Portal público do fornecedor |
| `/login` | Login |

## Documentos gerados (padrão dos anexos)
- **Mapa de Apuração** (PDF paisagem / XLSX): ID/DATA/VALOR TOTAL, OBJETO, colunas por fonte (SIMILARES, BLL, PNCP, CGU NFE, BNC, MULTKA, COMERCIAL VULTY), MÉDIA ARITMÉTICA, VALOR TOTAL, PERCENTUAL DE DIFERENÇA DO MENOR PREÇO, `/////` para fonte sem preço, totais, rodapé institucional, QR Code.
- **Pesquisas Unificadas** (PDF retrato): RELATÓRIO UNIFICADO DAS PESQUISAS DE PREÇOS, blocos por item, tabela órgão/ata/contrato/processo/homologação/assinatura/UN/QTDE/VALOR.
- **Contratações Similares de Outros Órgãos** (PDF retrato).
- **Relatório por Fonte** (PDF retrato): filtro por sigla de fonte.
- **Coleta de Preço** (PDF / DOCX): cabeçalho institucional, dados da cotação, tabela de itens, aplicação do item, núcleo de consumo/veículo/placa, observação, totais, assinaturas.
- **Termo de Referência** (XLSX): layout A1:H11 (ANEXO/LOTE/ITEM/PRODUTO/SERVIÇO/UNIDADE/QUANTIDADE/VALOR UNITÁRIO MÁXIMO/VALOR TOTAL MÁXIMO).
- **Subanexo X** (XLSX): layout A1:J26 (UNIDADE GESTORA, PROCESSO ADMINISTRATIVO, NÚMERO DA LICITAÇÃO, FONTES UTILIZADAS, perguntas SIM/NÃO, notas).

## Catálogos
- **CATMAT:** `https://dadosabertos.compras.gov.br/modulo-material/4_consultarItemMaterial` (paginado, `tamanhoPagina ≥ 10`)
- **CATSER:** `https://dadosabertos.compras.gov.br/modulo-servico/6_consultarItemServico` (paginado, `tamanhoPagina ≥ 10`)
- **PNCP:** `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao` (consulta ao vivo)
- **BLL / BNC / CGU NFE:** requerem convênio/token; uso manual com origem registrada

## Instalação e execução

```powershell
# Instalar dependências
npm install

# Gerar cliente Prisma
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/precobase?schema=public"
npx prisma generate

# Build de produção
$env:NEXT_PUBLIC_APP_URL="http://localhost:3100"
npm run build

# Iniciar servidor destacado (WMI)
$cmd = 'cmd.exe /c "cd /d C:\dev\contratacao-publica\propriosgp-clone && set DATABASE_URL=postgresql://postgres:postgres@localhost:5432/precobase?schema=public && set NEXT_PUBLIC_APP_URL=http://localhost:3100 && node node_modules\next\dist\bin\next start -p 3100 > server.log 2>&1"'
Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $cmd }

# Acessar: http://localhost:3100
```

## Testes E2E
```powershell
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/precobase?schema=public"
node scripts/e2e.cjs
```

## Banco de dados
O banco `precobase` vem semeado com: 1 tenant, 3 usuários, 8 secretarias, 16 categorias, 236 produtos, 48 fornecedores (incluindo 12 locais de Antônio João/MS), 1.706 preços, 5 índices × 12 meses, 5 informativos, 3 cestas.

## Licença
Uso interno — Prefeitura Municipal de Antônio João / MS.
