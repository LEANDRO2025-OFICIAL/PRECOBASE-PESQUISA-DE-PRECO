import openpyxl, os, glob, json
base = r"C:\dev\contratacao-publica\bdsgp-clone\docs-padrao"
for f in sorted(glob.glob(os.path.join(base, "*.xlsx"))):
    wb = openpyxl.load_workbook(f, data_only=False)
    print("="*80)
    print(os.path.basename(f), "sheets:", wb.sheetnames)
    for ws in wb.worksheets:
        print(f"-- sheet {ws.title} dims={ws.dimensions} max_row={ws.max_row} max_col={ws.max_column}")
        print("merged:", [str(r) for r in ws.merged_cells.ranges][:40])
        for row in ws.iter_rows(min_row=1, max_row=min(ws.max_row, 60)):
            vals = []
            for c in row:
                if c.value is not None:
                    vals.append(f"{c.coordinate}={repr(c.value)}")
            if vals:
                print(" | ".join(vals))
