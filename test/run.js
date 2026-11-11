const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const out = path.join(__dirname, 'out'); fs.mkdirSync(out, { recursive: true });
// 模拟东财接口：按报表类型生成自洽的 6 年数据
function rows(kind, code) {
  const res = [];
  for (let i = 0; i < 7; i++) {
    const y = 2025 - i, g = Math.pow(1.12, -i);
    const base = { SECUCODE: code, SECURITY_NAME_ABBR: '测试公司', REPORT_DATE: y + '-12-31 00:00:00', REPORT_TYPE: '年报', NOTICE_DATE: (y + 1) + '-03-28 00:00:00', CURRENCY: 'CNY', OPINION_TYPE: '标准无保留意见', ORG_TYPE: '通用' };
    if (kind === 'INCOME') Object.assign(base, { TOTAL_OPERATE_INCOME: 1500e8 * g, OPERATE_INCOME: 1500e8 * g, OPERATE_COST: 130e8 * g, OPERATE_TAX_ADD: 230e8 * g, SALE_EXPENSE: 50e8 * g, MANAGE_EXPENSE: 90e8 * g, RESEARCH_EXPENSE: 1.5e8 * g, FINANCE_EXPENSE: -18e8 * g, CREDIT_IMPAIRMENT_LOSS: 0.2e8, OPERATE_PROFIT: 1000e8 * g, NONBUSINESS_EXPENSE: 1e8, TOTAL_PROFIT: 999e8 * g, INCOME_TAX: 250e8 * g, NETPROFIT: 749e8 * g, PARENT_NETPROFIT: 720e8 * g, MINORITY_INTEREST: 29e8 * g, BASIC_EPS: 57.3 * g, DILUTED_EPS: 57.3 * g, OTHER_COMPRE_INCOME: -0.05e8, TOTAL_COMPRE_INCOME: 749e8 * g - 0.05e8 });
    if (kind === 'BALANCE') Object.assign(base, { MONETARYFUNDS: 600e8 * g, INVENTORY: 460e8 * g, TOTAL_CURRENT_ASSETS: 2200e8 * g, FIXED_ASSET: 200e8 * g, TOTAL_NONCURRENT_ASSETS: 500e8 * g, TOTAL_ASSETS: 2700e8 * g, CONTRACT_LIAB: 140e8 * g, TOTAL_CURRENT_LIAB: 480e8 * g, TOTAL_NONCURRENT_LIAB: 5e8 * g, TOTAL_LIABILITIES: 485e8 * g, SHARE_CAPITAL: 12.56e8, CAPITAL_RESERVE: 13.7e8, SURPLUS_RESERVE: 380e8 * g, UNASSIGN_RPOFIT: 1700e8 * g, TOTAL_PARENT_EQUITY: 2130e8 * g, MINORITY_EQUITY: 85e8 * g, TOTAL_EQUITY: 2215e8 * g, TOTAL_LIAB_EQUITY: 2700e8 * g });
    if (kind === 'CASHFLOW') Object.assign(base, { SALES_SERVICES: 1600e8 * g, TOTAL_OPERATE_INFLOW: 1700e8 * g, TOTAL_OPERATE_OUTFLOW: 1000e8 * g, NETCASH_OPERATE: (i === 2 ? -50e8 : 700e8 * g), CONSTRUCT_LONG_ASSET: 30e8 * g, NETCASH_INVEST: -90e8 * g, ASSIGN_DIVIDEND_PORFIT: 600e8 * g, NETCASH_FINANCE: -600e8 * g, CCE_ADD: 10e8, BEGIN_CCE: 590e8, END_CCE: 600e8 });
    res.push(base);
  }
  return res;
}
async function mock(page) {
  await page.route(/eastmoney\.com/, route => {
    const u = new URL(route.request().url());
    const cb = u.searchParams.get('callback') || u.searchParams.get('cb');
    const rn = u.searchParams.get('reportName') || '';
    const f = u.searchParams.get('filter') || '';
    const code = (f.match(/SECUCODE="([^"]+)"/) || [])[1];
    let data = null;
    if (rn && code === '600036.SH') { if (/_B(INCOME|BALANCE|CASHFLOW)$/.test(rn)) data = rows(rn.replace(/.*_B/, ''), code).map(r => { delete r.OPERATE_COST; delete r.TOTAL_CURRENT_ASSETS; delete r.TOTAL_CURRENT_LIAB; r.TOTAL_OPERATE_INCOME = undefined; return r; }); }
    else if (rn && code === '000001.SZ') data = null;
    else if (rn && /_G(INCOME|BALANCE|CASHFLOW)$/.test(rn)) data = rows(rn.replace(/.*_G/, ''), code);
    route.fulfill({ contentType: 'application/javascript', body: cb + '(' + JSON.stringify(data ? { result: { data } } : { result: null }) + ')' });
  });
}
(async () => {
  const browser = await chromium.launch();
  const errs = [];
  const mk = async (opts, url) => { const ctx = await browser.newContext(Object.assign({ acceptDownloads: true }, opts)); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e))); p.on('console', m => m.type() === 'error' && errs.push(m.text())); await mock(p); await p.goto(url); return p; };
  const base = 'http://127.0.0.1:8765/index.html';
  // 1 桌面浅色：概览
  let p = await mk({ viewport: { width: 1280, height: 900 } }, base);
  await p.waitForSelector('.kpi');
  await p.screenshot({ path: out + '/1-overview-light.png', fullPage: true });
  console.log('title:', await p.title(), '| name:', await p.textContent('#coName'), '| url:', p.url().replace(base, ''));
  // 利润表各视图
  await p.click('[data-tab=income]'); await p.screenshot({ path: out + '/2-income.png' });
  console.log('note:', await p.textContent('#tabNote'));
  await p.click('#viewSeg [data-v=yoy]'); const yoyCell = await p.textContent('#tblWrap table.data tbody tr:nth-child(2) td:nth-child(6)');
  await p.click('#viewSeg [data-v=pct]'); const pctCell = await p.textContent('#tblWrap table.data tbody tr:nth-child(2) td:nth-child(2)');
  console.log('yoy oldest:', yoyCell, '| pct:', pctCell);
  await p.click('#viewSeg [data-v=amt]');
  await p.fill('#rowFilter', '费用'); console.log('filter rows:', await p.locator('#tblWrap table.data tbody tr:not(.sec)').count()); await p.fill('#rowFilter', '');
  await p.uncheck('#hideEmpty'); console.log('all rows income:', await p.locator('#tblWrap table.data tbody tr:not(.sec)').count()); await p.check('#hideEmpty');
  await p.click('[data-tab=equity]'); await p.screenshot({ path: out + '/3-equity.png' });
  // 导出
  const [d1] = await Promise.all([p.waitForEvent('download'), p.click('#xlsxBtn')]); await d1.saveAs(out + '/new.xlsx'); console.log('xlsx:', d1.suggestedFilename());
  await p.click('[data-tab=balance]');
  const [d2] = await Promise.all([p.waitForEvent('download'), p.click('#csvBtn')]); await d2.saveAs(out + '/new-balance.csv'); console.log('csv:', d2.suggestedFilename());
  // 联想 + 键盘
  await p.fill('#q', '茅台'); await p.waitForSelector('.sugItem'); console.log('sug:', (await p.locator('.sugItem').allTextContents()).slice(0, 3));
  await p.fill('#q', '6005'); console.log('sug code:', (await p.locator('.sugItem').allTextContents()).slice(0, 3));
  // 银行
  await p.click('[data-tab=overview]'); await p.fill('#q', '招商银行'); await p.keyboard.press('Enter'); await p.waitForFunction(() => document.querySelector('#coName').textContent === '招商银行');
  console.log('bank type:', await p.textContent('#coType'), '| kpi labels:', await p.locator('.kpiLabel').allTextContents());
  // 无数据 + 港股
  await p.fill('#q', '000001'); await p.keyboard.press('Enter'); await p.waitForSelector('.status.err'); console.log('err:', await p.textContent('#status'));
  await p.fill('#q', '00700'); await p.keyboard.press('Enter'); await p.waitForFunction(() => /港股/.test(document.querySelector('#status').textContent)); console.log('hk:', await p.textContent('#status'));
  await p.close();
  // 2 深色 + 手机
  p = await mk({ viewport: { width: 1280, height: 900 }, colorScheme: 'dark' }, base + '?q=600519&tab=balance');
  await p.waitForSelector('table.data'); await p.screenshot({ path: out + '/4-balance-dark.png' });
  await p.click('[data-tab=overview]'); await p.screenshot({ path: out + '/5-overview-dark.png', fullPage: true }); await p.close();
  p = await mk({ viewport: { width: 390, height: 844 } }, base);
  await p.waitForSelector('.kpi'); await p.screenshot({ path: out + '/6-mobile.png', fullPage: true });
  await p.click('[data-tab=income]'); await p.screenshot({ path: out + '/7-mobile-income.png' });
  console.log('mobile overflow:', await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)); await p.close();
  // 3 原版导出，用于对比模板
  p = await mk({ viewport: { width: 1280, height: 900 } }, 'http://127.0.0.1:8765/test/_orig.html?q=' + encodeURIComponent('贵州茅台'));
  await p.waitForSelector('#result:not(.hide)');
  const [d3] = await Promise.all([p.waitForEvent('download'), p.click('#dx')]); await d3.saveAs(out + '/orig.xlsx'); console.log('orig name:', d3.suggestedFilename());
  await browser.close();
  console.log('errors:', errs.length ? errs : 'none');
})();
