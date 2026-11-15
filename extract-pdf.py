import fitz, os, glob
base = r"C:\dev\contratacao-publica\bdsgp-clone\docs-padrao"
for f in sorted(glob.glob(os.path.join(base, "*.pdf"))):
    doc = fitz.open(f)
    name = os.path.basename(f)
    out = os.path.join(base, name + ".txt")
    with open(out, "w", encoding="utf-8") as fh:
        for i, page in enumerate(doc):
            fh.write(f"\n===== PAGINA {i+1} =====\n")
            fh.write(page.get_text("text"))
    print(name, "->", len(doc), "paginas")
