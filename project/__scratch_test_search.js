const { chromium } = require("playwright");

const USER_ID = "6a94d04c4190fd5ca16a66ad";
const OUT = "C:/Users/delga/AppData/Local/Temp/claude/c--meu-dinheiro/416ba9c9-c28f-43bb-b5a9-2f89ea8d9def/scratchpad";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.goto(`http://localhost:3000/users/${USER_ID}/cashflows`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Lancamento Seed 1", { timeout: 15000 });
  await page.screenshot({ path: `${OUT}/search-before.png` });

  const [response] = await Promise.all([
    page.waitForResponse((resp) => resp.url().includes("/cashflow?") && resp.url().includes("search=")),
    page.getByPlaceholder("Buscar por nome...").fill("Seed 12"),
  ]);

  console.log("search request url:", response.url());
  console.log("search response status:", response.status());
  const body = await response.json();
  console.log("results count:", body.data.length, body.data.map((c) => c.name));

  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/search-after.png` });

  console.log("Console errors:", consoleErrors);
  await browser.close();
})().catch((err) => {
  console.error("SCRIPT ERROR:", err);
  process.exit(1);
});
