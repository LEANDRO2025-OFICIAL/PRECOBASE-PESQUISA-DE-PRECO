import pymupdf, os, glob
base = r"C:\dev\contratacao-publica\bdsgp-clone\docs-padrao"
for f in sorted(glob.glob(os.path.join(base, "*.pdf"))):
    doc = pymupdf.open(f)
    name = os.path.splitext(os.path.basename(f))[0]
    for i, page in enumerate(doc):
        pix = page.get_pixmap(dpi=110)
        out = os.path.join(base, f"{name}-p{i+1}.png")
        pix.save(out)
    print(name, doc.page_count)
