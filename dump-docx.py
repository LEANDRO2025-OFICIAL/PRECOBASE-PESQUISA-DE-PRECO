import docx, os
f = r"C:\dev\contratacao-publica\bdsgp-clone\docs-padrao\47963932-3e06-4c6f-aab8-4745bbf8554e-Cotação Notebook e Forno.docx"
d = docx.Document(f)
print("PARAGRAFOS:")
for i,p in enumerate(d.paragraphs):
    if p.text.strip():
        print(i, repr(p.style.name), "|", p.text)
print("\nTABELAS:", len(d.tables))
for ti, t in enumerate(d.tables):
    print(f"--- tabela {ti}: {len(t.rows)}x{len(t.columns)}")
    for ri, row in enumerate(t.rows):
        cells = []
        for c in row.cells:
            cells.append(c.text.replace("\n"," ")[:80])
        print(ri, " | ".join(cells))
