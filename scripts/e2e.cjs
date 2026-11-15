/**
 * Teste E2E dos fluxos de escrita do PreçoBase.
 * Requer o servidor de produção em http://127.0.0.1:3100 e o banco `precobase`.
 *
 * Uso: node scripts/e2e.cjs
 */
const fs = require("fs");
const { chromium } = require("C:/Users/Leandro Santos/AppData/Roaming/npm/node_modules/playwright-core");
const { PrismaClient } = require("@prisma/client");

const BASE = "http://127.0.0.1:3100";
const prisma = new PrismaClient();

const PDF_MINIMO = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n" +
    "trailer<</Root 1 0 R>>\n%%EOF\n",
);

let falhas = 0;

function ok(rotulo) {
  console.log(`PASS ${rotulo}`);
}

function assert(condicao, mensagem) {
  if (!condicao) throw new Error(mensagem);
}

async function passo(rotulo, fn) {
  try {
    await fn();
    ok(rotulo);
  } catch (erro) {
    falhas++;
    console.log(`FAIL ${rotulo}: ${erro.message}`);
    throw erro;
  }
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);

  let cestaId = null;
  let itemId = null;

  try {
    await passo("login", async () => {
      await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
      await page.fill("#email", "leandro@precobase.local");
      await page.fill("#senha", "precobase123");
      await Promise.all([
        page.waitForURL("**/cestas", { timeout: 25000 }),
        page.getByRole("button", { name: /Entrar/ }).click(),
      ]);
      assert(page.url().endsWith("/cestas"), `URL inesperada após login: ${page.url()}`);
    });

    await passo("criar cesta", async () => {
      await page.goto(`${BASE}/cestas/nova`, { waitUntil: "networkidle" });
      const objeto = `E2E teste automatizado ${Date.now()}`;
      await page.fill("#objeto", objeto);
      await Promise.all([
        page.waitForURL(/\/cestas\/\d+$/, { timeout: 25000 }),
        page.getByRole("button", { name: /Criar cesta/ }).click(),
      ]);
      cestaId = Number(new URL(page.url()).pathname.split("/").pop());
      assert(Number.isFinite(cestaId) && cestaId > 0, "id da cesta inválido");
      await page.getByText(objeto).first().waitFor({ timeout: 15000 });
      const situacao = await prisma.cesta.findUnique({ where: { id: cestaId }, select: { situacao: true } });
      assert(situacao?.situacao === "CLIENTE", `situação inesperada: ${situacao?.situacao}`);
    });

    await passo("adicionar item do catálogo", async () => {
      await page.goto(`${BASE}/cestas/${cestaId}/itens/novo`, { waitUntil: "networkidle" });
      const codigo = (await page.locator("table.data tbody tr td.mono").first().innerText()).trim();
      assert(codigo.length > 0, "catálogo sem produtos");

      await page.fill('input[name="q"]', codigo);
      await Promise.all([
        page.waitForURL(/\/itens\/novo\?q=/, { timeout: 25000 }),
        page.getByRole("button", { name: /^Buscar$/ }).click(),
      ]);
      await page.waitForSelector("table.data tbody tr");

      await Promise.all([
        page.waitForURL(new RegExp(`/cestas/${cestaId}/itens$`), { timeout: 25000 }),
        page.locator('button:has-text("Incluir")').first().click(),
      ]);

      const editar = page.locator('a[title="Editar item"]').first();
      await editar.waitFor({ timeout: 15000 });
      const href = await editar.getAttribute("href");
      itemId = Number(String(href).split("/").pop());
      assert(Number.isFinite(itemId) && itemId > 0, `item inválido: ${href}`);

      const itens = await prisma.cestaItem.count({ where: { cestaId } });
      assert(itens >= 1, `cesta sem itens (${itens})`);
    });

    await passo("selecionar e limpar preços", async () => {
      await page.goto(`${BASE}/cestas/${cestaId}/itens/${itemId}/pesquisar-fontes`, {
        waitUntil: "networkidle",
      });
      await page.getByText("Preços por fonte").waitFor({ timeout: 15000 });

      const linhas = await page.locator("table.data tbody tr").count();
      assert(linhas > 0, "nenhum preço vinculado ao item");

      await page.getByRole("button", { name: /Limpar seleção visível/ }).click();
      await page.waitForFunction(
        () => document.querySelectorAll("table.data tbody tr .badge.success").length === 0,
        null,
        { timeout: 20000 },
      );

      await page.getByRole("button", { name: /Selecionar todos visíveis/ }).click();
      await page.waitForFunction(
        (n) => document.querySelectorAll("table.data tbody tr .badge.success").length === n,
        linhas,
        { timeout: 20000 },
      );

      const selecionados = await prisma.itemPreco.count({
        where: { itemId, selecionado: true },
      });
      assert(selecionados >= linhas, `selecionados no banco (${selecionados}) < linhas (${linhas})`);
    });

    await passo("adicionar preço manual", async () => {
      await page.getByRole("button", { name: /Preço manual/ }).click();
      await page.fill('input[name="valor"]', "1.234,56");
      await page.fill('input[name="orgao"]', "Pesquisa direta E2E");
      await page.fill('input[name="uf"]', "MS");
      await page.getByRole("button", { name: /^Adicionar$/ }).click();
      await page.getByText("Preço manual adicionado").waitFor({ timeout: 20000 });

      await page.waitForFunction(
        () => document.body.innerText.includes("Pesquisa direta E2E"),
        null,
        { timeout: 20000 },
      );

      const manual = await prisma.itemPreco.count({
        where: { itemId, origem: "MANUAL", orgaoManual: "Pesquisa direta E2E" },
      });
      assert(manual === 1, `preço manual no banco: ${manual}`);
    });

    await passo("relatórios PDF e XLSX", async () => {
      const pdf = await ctx.request.get(`${BASE}/cestas/${cestaId}/relatorio/mapa.pdf`);
      assert(pdf.status() === 200, `PDF status ${pdf.status()}`);
      assert((pdf.headers()["content-type"] || "").includes("application/pdf"), "content-type do PDF inválido");
      const pdfBuf = await pdf.body();
      assert(pdfBuf.length > 1000, `PDF pequeno demais (${pdfBuf.length} bytes)`);
      assert(pdfBuf.subarray(0, 5).toString() === "%PDF-", "assinatura do PDF inválida");

      const xlsx = await ctx.request.get(`${BASE}/cestas/${cestaId}/relatorio/mapa.xlsx`);
      assert(xlsx.status() === 200, `XLSX status ${xlsx.status()}`);
      assert(
        (xlsx.headers()["content-type"] || "").includes("spreadsheetml"),
        "content-type do XLSX inválido",
      );
      const xlsxBuf = await xlsx.body();
      assert(xlsxBuf.length > 1000, `XLSX pequeno demais (${xlsxBuf.length} bytes)`);
      assert(xlsxBuf.subarray(0, 2).toString() === "PK", "assinatura do XLSX inválida");
    });

    await passo("link público e upload de documento", async () => {
      await page.goto(`${BASE}/cestas/${cestaId}`, { waitUntil: "networkidle" });

      const gerar = page.getByRole("button", { name: /Gerar link e QR Code/ });
      if (await gerar.count()) {
        await gerar.click();
        await page.locator('a[href^="/p/"]').first().waitFor({ timeout: 20000 });
      }

      const link = page.locator('a[href^="/p/"]').first();
      const href = await link.getAttribute("href");
      assert(href && href.startsWith("/p/"), "link público não gerado");

      await page.goto(`${BASE}${href}`, { waitUntil: "networkidle" });
      await page.getByText("Portal do Fornecedor").waitFor({ timeout: 15000 });

      const input = page.locator('input[type="file"]');
      await input.setInputFiles({
        name: "e2e-documento.pdf",
        mimeType: "application/pdf",
        buffer: PDF_MINIMO,
      });

      await Promise.all([
        page.waitForEvent("framenavigated", { timeout: 25000 }),
        page.getByRole("button", { name: /Enviar 1 documento/ }).click(),
      ]);
      await page.waitForLoadState("networkidle");
      await page.getByText(/Documentos já enviados/).waitFor({ timeout: 20000 });
      await page.getByText("e2e-documento.pdf").first().waitFor({ timeout: 15000 });

      const documentos = await prisma.documento.count({ where: { cestaId } });
      assert(documentos >= 1, `documento não persistido (${documentos})`);
    });
  } catch {
    // erro já registrado em passo()
  } finally {
    if (falhas > 0) {
      await page.screenshot({ path: "shots/e2e-falha.png", fullPage: true }).catch(() => {});
    }

    if (cestaId) {
      await prisma.documento.deleteMany({ where: { cestaId } }).catch(() => {});
      await prisma.cesta.delete({ where: { id: cestaId } }).catch(() => {});
    }

    await prisma.$disconnect();
    await browser.close();

    if (falhas === 0) console.log("\nE2E concluído com sucesso.");
    else console.log(`\nE2E com ${falhas} falha(s).`);
    process.exitCode = falhas === 0 ? 0 : 1;
  }
})();
