# 财报四表查询

输入 A 股公司名称或代码，调取近五年年报的利润表、资产负债表、现金流量表、所有者权益表（推算口径）。
四张表为固定行次模板，可导出 Excel、下载 CSV 或直接复制粘贴。

- `index.html`：成品，单文件、零依赖，放到任何静态托管即可（GitHub Pages / Cloudflare Pages / Netlify 等）。
- `src/template.html`：页面源码；`src/build.py 原文件.html` 把固定模板字典、xlsx 生成函数和内置股票名录拼进去生成 `index.html`。
- `test/run.js`：Playwright 测试，用模拟数据代替东方财富接口。

数据来自东方财富公开 F10 数据中心，浏览器直接以 JSONP 请求，无后端。仅供个人研究参考。
