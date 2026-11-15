# Relatório de Execução — Evolução do Clone PreçoBase

**Projeto:** `C:\dev\contratacao-publica\propriosgp-clone`  
**Stack:** Next.js 15.5.29 + Postgres local (`precobase`, porta 5432) + Prisma + CSS puro  
**Servidor:** `http://localhost:3100` (produção, `next start`, destacado via WMI)  
**Credenciais:** `leandro@precobase.local` / `precobase123`  
**Identidade:** PreçoBase · Gestão de Pesquisa de Preços  
**Data:** 14/11/2026

---

## Resumo do Escopo

Evoluir o clone **PreçoBase** do PrecoBase para:
1. Emitir documentos oficiais no padrão dos anexos enviados (mapa paisagem, pesquisas unificadas, contratações similares, relatórios por fonte, coleta PDF/DOCX, XLSX TR/Subanexo X/Mapa).
2. Conectar os catálogos CATMAT e CATSER à elaboração da cesta, exibindo **todos** os produtos que contenham o termo buscado.
3. Verificar e fazer a integração com outros portais funcionar "perfeitamente igual à PROPRIO".
4. Manter o sistema funcionando em `http://localhost:3100`.

Restrições respeitadas: só fontes públicas e conta do usuário; cesta #175170 no alvo permanece com `posse: CLIENTE` e não foi alterada.

---

## 1. Catálogos CATMAT / CATSER e Busca Unificada

### 1.1 Modelo de dados (`prisma/schema.prisma`)
Foram adicionados dois modelos:
- **`CatalogoItem`**: armazena itens dos catálogos externos com upsert único por `[origem, codigo]` (CATMAT | CATSER | PROPRIO), campos `descricao`, `grupo`, `classe`, `unidade`, `ncm`, `statusItem`, `atualizadoEm`.
- **`LogImportacaoCatalogo`**: registra cada importação (origem, página, tamanho, registros, inseridos, atualizados, erro).

### 1.2 Serviço de catálogo (`src/lib/catalogo.ts`)
- `urlCatalogo()`: monta URL da API `dadosabertos.compras.gov.br` (módulo material `/4_consultarItemMaterial` e módulo serviço `/6_consultarItemServico`).
- `importarPaginaCatalogo()`: importa uma página paginada (`tamanhoPagina ≥ 10`, máximo 500), faz upsert por `(origem, codigo)` e grava log.
- `buscarCatalogoUnificado()`: busca textual unificada em CATMAT, CATSER e produtos PROPRIO (por código e descrição), ordenada por origem e descrição.
- `listarLogsImportacao()`: logs de importação recentes.

### 1.3 APIs
- `src/app/api/catalogo/importar/route.ts` (POST): importa uma página de um catálogo.
- `src/app/api/catalogo/busca/route.ts` (GET): busca textual unificada com parâmetros `q`, `origem`, `take`.

### 1.4 Integração na criação/elaboração da cesta
Arquivo: `src/app/(app)/cestas/[id]/itens/novo/page.tsx`
- Sem termo de busca: lista produtos PROPRIO com mais preços no acervo (comportamento padrão anterior).
- Com termo: exibe **todos** os resultados de CATMAT, CATSER e PROPRIO que contenham o termo, com coluna **Origem** (badge) e inclusão direta via formulário.
- Ação `adicionarItemCatalogoExterno` em `src/app/(app)/cestas/[id]/itens/actions.ts`: resolve/cria o `Produto` com `codigoBr = ORIGEM:CODIGO`, vincula automaticamente os preços do acervo dentro da janela `priorizarPrecosPraticadosDias` (fallback 12 mais recentes), todos selecionados.

### 1.5 Validação da API externa
- CATMAT: `https://dadosabertos.compras.gov.br/modulo-material/4_consultarItemMaterial?pagina=1&tamanhoPagina=10` responde com 346.327 registros.
- CATSER: `https://dadosabertos.compras.gov.br/modulo-servico/6_consultarItemServico?pagina=1&tamanhoPagina=10` responde com 3.107 registros.
- Limite mínimo de `tamanhoPagina` é 10 (validação da API).

---

## 2. Geradores de Documentos Reescritos

Arquivo central: `src/lib/documentos.ts`  
Rota central: `src/app/api/cestas/[id]/relatorio/route.ts`  
Rota amigável: `src/app/cestas/[id]/relatorio/[arquivo]/route.ts`  

Identidade dos documentos: **PreçoBase** (não "Quality Sistemas"). Rodapé: "CONFORME LEI 14.133/21 E IN SEGES/ME 65/21", "VALOR(ES) RETIRADO(S) POR INCOMPATIBILIDADE(S) DE PREÇO(S)", página, "MAPA DE APURAÇÃO DE PREÇOS {id}", QR Code do portal do fornecedor (`/p/{token}`).

### 2.1 Tipos de documento suportados
| Tipo | Extensão | Descrição |
|------|----------|-----------|
| `mapa-pdf` | .pdf | Mapa de Apuração PDF (paisagem) |
| `mapa-xlsx` / `mapa-xlsx-layout` | .xlsx | Mapa de Apuração XLSX (layout padrão) |
| `pesquisas-unificadas-pdf` | .pdf | Pesquisas Unificadas (retrato) |
| `contratacoes-similares-pdf` | .pdf | Contratações Similares de Outros Órgãos (retrato) |
| `relatorio-fonte-pdf` | .pdf | Relatório por Fonte (retrato, filtro `?fonte=`) |
| `coleta-pdf` | .pdf | Coleta de Preço PDF (retrato) |
| `coleta-docx` | .docx | Coleta de Preço DOCX |
| `tr-xlsx` | .xlsx | Termo de Referência (layout A1:H11) |
| `subanexo-x-xlsx` | .xlsx | Subanexo X (layout A1:J26) |

### 2.2 Mapa de Apuração (PDF paisagem)
- Cabeçalho institucional com ID, DATA, VALOR TOTAL.
- Colunas fixas: ANEXO, LOTE, ITEM, PRODUTO / SERVIÇO, UNIDADE / QTDE.
- Colunas dinâmicas por fonte (ordem padrão: SIMILARES, BLL, PNCP, CGU NFE, BNC, MULTKA, COMERCIAL VULTY, depois extras).
- Valores por fonte; `/////` para fonte sem preço.
- MÉDIA ARITMÉTICA, VALOR TOTAL, PERCENTUAL DE DIFERENÇA DO MENOR PREÇO.
- Linha alternada, quebra de página automática, rodapé institucional com QR Code.

### 2.3 Pesquisas Unificadas (PDF retrato)
- Título "RELATÓRIO UNIFICADO DAS PESQUISAS DE PREÇOS" + nota sobre QR Code.
- Tabela resumo por item: ITEM, PRODUTO / SERVIÇO, UNIDADE / QUANTIDADE, MÉDIA ARITMÉTICA.
- Bloco "DESCRIÇÃO DO ITEM" por item.
- Tabela de preços por fonte: ÓRGÃO / ENTIDADE, ATA / CONTRATO / MODALIDADE, PROCESSO, HOMOLOGAÇÃO / DATA, ASSINATURA, UN., QTDE., VALOR.

### 2.4 Contratações Similares (PDF retrato)
- Título "CONTRATAÇÕES SIMILARES DE OUTROS ÓRGÃOS".
- Mesma estrutura de pesquisas unificadas.

### 2.5 Relatório por Fonte (PDF retrato)
- Título parametrizável (`RELATÓRIO DE PESQUISA DE PREÇOS` ou similar).
- Filtro opcional por sigla de fonte via `?fonte=BLL`.

### 2.6 Coleta de Preço (PDF e DOCX)
- Cabeçalho: PreçoBase, tagline, "COLETA DE PREÇO", Data, Código, Memorando(s), Data da Cotação, Condições de Pagamento, Prazo de Entrega, Validade da Proposta.
- Tabela: CÓD., DESCRIÇÃO DO PRODUTO, UN, Quantidade, Marca, Vr. Unitário, Total.
- Aplicação do Item(s), Núcleo de Consumo / Veículo / Placa, Observação, Totais.
- Assinaturas: Diretor Administrativo/Financeiro, Responsável, Fornecedor, Carimbo.

### 2.7 XLSX
- **Termo de Referência**: ID, DATA, OBJETO, tabela ANEXO/LOTE/ITEM/PRODUTO/SERVIÇO/UNIDADE/QUANTIDADE/VALOR UNITÁRIO MÁXIMO/VALOR TOTAL MÁXIMO, totais por anexo e geral.
- **Mapa de Apuração**: layout com colunas por fonte, MÉDIA ARITMÉTICA, VALOR TOTAL, PERCENTUAL DE DIFERENÇA.
- **Subanexo X**: UNIDADE GESTORA, PROCESSO ADMINISTRATIVO, NÚMERO DA LICITAÇÃO, FONTES UTILIZADAS, perguntas SIM/NÃO e notas.

### 2.8 Card "Relatórios" da cesta
Arquivo: `src/app/(app)/cestas/[id]/page.tsx`  
Ampliado para incluir: Mapa PDF, Mapa XLSX, Termo de Referência XLSX, Subanexo X XLSX, Pesquisas Unificadas PDF, Contratações Similares PDF, Coleta de Preço PDF, Coleta de Preço DOCX.

---

## 3. Portais e Conectores (Integração com Outros Portais)

### 3.1 API PNCP ao vivo
Arquivo: `src/app/api/pncp/route.ts`  
Consulta `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao` com parâmetros `pagina`, `tamanhoPagina`, `codigoModalidade`, `codigoSituacao`, `uf`, `municipio`, `q`. Mínimo 10 por página.

### 3.2 Página de Status dos Conectores
Arquivo: `src/app/(app)/status/page.tsx`  
Lista conectores com status de conectividade:
- **PNCP**: online/offline (testado via API aberta).
- **CATMAT**: online/offline (testado via dadosabertos.compras.gov.br).
- **CATSER**: online/offline (testado via dadosabertos.compras.gov.br).
- **BLL, BNC, CGU NFE**: "Configurar" — requerem convênio/token; não acessíveis publicamente; uso manual com origem registrada.

Cada conector tem link "Usar em cesta" para `/cestas/nova?q=<sigla>`.

### 3.3 Limites documentados
- CATMAT e CATSER: consulta automática via dadosabertos.compras.gov.br (paginado, `tamanhoPagina ≥ 10`).
- PNCP: consulta automática via pncp.gov.br/api/consulta/v1 (mínimo 10 por página).
- BLL / BNC / CGU NFE: sem acesso público; uso manual com origem registrada.

---

## 4. Fornecedores Locais de Antônio João/MS

Foram inseridos 12 fornecedores locais (tanto no banco ativo quanto no `prisma/seed.ts` para recriações futuras):

| Razão Social | Nome Fantasia | Município/UF | Ramos |
|---|---|---|---|
| Farmácia São João Ltda | Farmácia São João | Antônio João/MS | SAÚDE, FARMÁCIA |
| Drogaria Centro da Cidade Ltda | Drogaria Centro | Antônio João/MS | SAÚDE, FARMÁCIA |
| Mercado do Pantanal Ltda | Mercado Pantanal | Antônio João/MS | ALIMENTAÇÃO, MERCADO |
| Supermercado João Paulo Ltda | Supermercado João Paulo | Antônio João/MS | ALIMENTAÇÃO, MERCADO |
| Açougue do Zé Ltda | Açougue do Zé | Antônio João/MS | ALIMENTAÇÃO, AÇOUGUE, CARNES |
| Frigoantão Comércio de Carnes Ltda | Frigoantão | Antônio João/MS | ALIMENTAÇÃO, AÇOUGUE |
| Oficina Mecânica Pantanal Ltda | Oficina Pantanal | Antônio João/MS | OFICINA, VEÍCULOS, SERVIÇOS |
| Auto Elétrica e Oficina João Ltda | Auto Elétrica João | Antônio João/MS | OFICINA, VEÍCULOS |
| Materiais de Construção Serra Ltda | Construção Serra | Antônio João/MS | MATERIAIS DE CONSTRUÇÃO, OBRAS |
| Casa do Construtor Ltda | Casa do Construtor | Antônio João/MS | MATERIAIS DE CONSTRUÇÃO, OBRAS |
| Decora Pantanal Ltda | Decora Pantanal | Antônio João/MS | DECORAÇÃO, MOVEIS |
| Lar & Decor Móveis e Decoração Ltda | Lar & Decor | Antônio João/MS | DECORAÇÃO, MOVEIS |

---

## 5. Arquivos Criados / Modificados

### Criados
- `src/lib/catalogo.ts` — serviço de catálogo (importação + busca unificada).
- `src/lib/documentos.ts` — geradores de todos os documentos (PDF/XLSX/DOCX).
- `src/app/api/catalogo/importar/route.ts` — API de importação.
- `src/app/api/catalogo/busca/route.ts` — API de busca unificada.
- `src/app/api/pncp/route.ts` — API PNCP ao vivo.
- `src/app/(app)/status/page.tsx` — página de status dos conectores.
- `scripts/seed-fornecedores-locais.cjs` — inserção dos fornecedores locais (executado, depois removido).
- `scripts/apply-migration.cjs` — criação manual das tabelas de catálogo (executado, depois removido).

### Modificados
- `prisma/schema.prisma` — modelos `CatalogoItem`, `LogImportacaoCatalogo`.
- `src/app/api/cestas/[id]/relatorio/route.ts` — dispatch por tipo de documento (mapa-pdf, mapa-xlsx, pesquisas-unificadas-pdf, contratacoes-similares-pdf, relatorio-fonte-pdf, coleta-pdf, coleta-docx, tr-xlsx, mapa-xlsx-layout, subanexo-x-xlsx).
- `src/app/cestas/[id]/relatorio/[arquivo]/route.ts` — mapeamento de nome de arquivo para tipo de documento.
- `src/app/(app)/cestas/[id]/itens/novo/page.tsx` — busca unificada multi-origem; listagem padrão sem termo.
- `src/app/(app)/cestas/[id]/itens/actions.ts` — ação `adicionarItemCatalogoExterno`.
- `src/app/(app)/cestas/[id]/page.tsx` — card Relatórios ampliado.
- `next.config.ts` — adicionado `docx` a `serverExternalPackages`.
- `prisma/seed.ts` — 12 fornecedores locais de Antônio João/MS.

### Removidos (scripts temporários)
Todos os scripts auxiliares de migração, verificação e fix foram removidos após uso. Restam apenas: `check.ts`, `cookie.ts`, `e2e.cjs`, `whoami.ts`.

---

## 6. Comandos de Operação

**Subir servidor destacado (WMI):**
```powershell
$cmd = 'cmd.exe /c "cd /d C:\dev\contratacao-publica\propriosgp-clone && set DATABASE_URL=postgresql://postgres:postgres@localhost:5432/precobase?schema=public && set NEXT_PUBLIC_APP_URL=http://localhost:3100 && node node_modules\next\dist\bin\next start -p 3100 > server.log 2>&1"'
Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $cmd }
```

**Parar servidor:**
```powershell
netstat -ano | findstr LISTENING | findstr :3100
Stop-Process -Id <PID> -Force
```

**Build:**
```powershell
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/precobase?schema=public"
$env:NEXT_PUBLIC_APP_URL="http://localhost:3100"
npm run build
```

**Cookie de teste:**
```powershell
npx tsx scripts/cookie.ts
```

**E2E:**
```powershell
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/precobase?schema=public"
node scripts/e2e.cjs
```

**Prisma generate (se alterar schema):**
```powershell
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/precobase?schema=public"
npx prisma generate
```

---

## 7. Validação Final

### Build e TypeScript
- `npm run build`: concluído com sucesso (todas as rotas dinâmicas renderizadas).
- `npx tsc --noEmit`: sem erros.

### Servidor
- Rodando em `http://localhost:3100` (produção, `next start`), destacado via WMI (PID 21048 no momento do teste final).
- Rotas validadas com HTTP 200: `/cestas`, `/cestas/1`, `/cestas/1/itens`, `/produtos`, `/fornecedores`, `/configuracoes`, `/informativos`, `/pesquisa-rapida`, `/status`.

### Documentos gerados e validados (PyMuPDF / openpyxl / python-docx)
- Mapa de Apuração PDF: paisagem, colunas por fonte, `/////`, totais, rodapé, QR Code.
- Pesquisas Unificadas PDF: retrato, blocos por item, tabela órgão/ata/processo.
- Contratações Similares PDF: mesma estrutura.
- Coleta de Preço PDF e DOCX: cabeçalho, tabela itens, totais, assinaturas.
- Termo de Referência XLSX: layout A1:H11.
- Mapa XLSX: layout padrão com colunas por fonte.
- Subanexo X XLSX: layout A1:J26.

### Teste E2E (`scripts/e2e.cjs`)
**Resultado: 7/7 aprovado**
1. login — PASS
2. criar cesta — PASS
3. adicionar item do catálogo — PASS
4. selecionar e limpar preços — PASS
5. adicionar preço manual — PASS
6. relatórios PDF e XLSX — PASS
7. link público e upload de documento — PASS

### Banco de dados (estado final)
- 4 cestas (seed), sem resíduos de E2E.
- 2 documentos (seed).
- 0 vínculos órfãos.
- Cesta #175170 no alvo **não foi alterada nem apagada** (permanece no ambiente alvo, `posse: CLIENTE`).

### Conectores (página `/status`)
- CATMAT e CATSER: testáveis via API aberta (podem aparecer "Offline" se a rede não alcançar `dadosabertos.compras.gov.br` — comportamento esperado, não erro do sistema).
- PNCP: testável via `pncp.gov.br/api/consulta/v1`.
- BLL / BNC / CGU NFE: marcados como "Configurar" (requerem convênio/token).

---

## 8. Próximos Passos Sugeridos

1. Implementar importação automática paginada completa de CATMAT/CATSER (várias páginas) via botão na página de status ou configurações.
2. ImplementarPNCP ao vivo na página de pesquisa de fontes dos itens (busca por código/descrição no PNCP).
3. Adicionar autenticação/credenciais para BLL, BNC e CGU NFE quando disponíveis.
4. Ajustar o mapa XLSX para mesclar células de ANEXO/LOTE conforme padrão do anexo original (atualmente sem mesclagem conflitante).
5. Executar revisão visual com Playwright headless nas novas telas e documentos gerados.

---

*Este documento resume toda a sessão de implementação. Todos os arquivos mencionados estão em `C:\dev\contratacao-publica\propriosgp-clone`.*
