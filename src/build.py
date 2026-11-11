"""把原文件里的固定模板字典、xlsx 底层函数、内置股票名录拼进新页面。用法：python3 build.py 原文件.html"""
import sys, pathlib
here = pathlib.Path(__file__).resolve().parent
src = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8").split("\n")
def block(start, end):
    i = next(k for k, l in enumerate(src) if l.startswith(start))
    j = next(k for k, l in enumerate(src) if k > i and l.startswith(end))
    return "\n".join(src[i:j]).rstrip()
parts = {
    "/*@@DICT@@*/": block("const DICT = {", "/* ============ 网络"),
    "/*@@XLSX@@*/": block("function xmlEsc", "function buildSheetRows"),
    "/*@@STOCKLIST@@*/": next(l for l in src if l.startswith("window.__STOCK_LIST__")),
}
out = (here / "template.html").read_text(encoding="utf-8")
for k, v in parts.items():
    assert out.count(k) == 1, k
    out = out.replace(k, v)
(here.parent / "index.html").write_text(out, encoding="utf-8")
print("index.html", len(out.encode()), "bytes")
