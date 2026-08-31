import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const SHOTS = "C:\\Users\\delga\\AppData\\Local\\Temp\\claude\\c--meu-dinheiro\\5be369fb-79b4-4a64-90d1-6ca5f17c7cdc\\scratchpad\\shots";

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

async function scrollInfo(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    return {
      docScrollable: doc.scrollHeight > doc.clientHeight,
      docScrollHeight: doc.scrollHeight,
      docClientHeight: doc.clientHeight,
      bodyScrollable: body.scrollHeight > body.clientHeight,
      bodyScrollHeight: body.scrollHeight,
      bodyClientHeight: body.clientHeight,
    };
  });
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on("console", (msg) => {
    if (msg.type() === "error") log("CONSOLE ERROR:", msg.text());
  });
  page.on("pageerror", (err) => log("PAGE ERROR:", err.message));

  // 1. Create a real user via /users/new
  log("Navigating to /users/new");
  await page.goto(`${BASE}/users/new`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${SHOTS}/01-users-new.png` });

  const uniqueName = "Scrollbar Test User " + Date.now();
  const uniqueEmail = `scrolltest${Date.now()}@example.com`;
  await page.fill("#name", uniqueName);
  await page.fill("#email", uniqueEmail);
  await page.click('button[type="submit"]');

  // wait for redirect to /users/[id]
  await page.waitForURL(/\/users\/[^/]+$/, { timeout: 15000 });
  const url = page.url();
  const userId = url.split("/").pop();
  log("Created user, redirected to", url, "userId=", userId);
  await page.screenshot({ path: `${SHOTS}/02-user-detail.png` });
  log("Scroll info /users/[id]:", JSON.stringify(await scrollInfo(page)));

  // 2. Go to cashflows page for this user (should be empty initially)
  log("Navigating to cashflows page");
  await page.goto(`${BASE}/users/${userId}/cashflows`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${SHOTS}/03-cashflows-empty.png` });
  log("Scroll info cashflows (empty):", JSON.stringify(await scrollInfo(page)));

  // 3. Create ~18 cashflow entries via the "Novo lançamento" link/form
  for (let i = 0; i < 18; i++) {
    await page.goto(`${BASE}/users/${userId}/cashflows/new`, { waitUntil: "networkidle" });
    if (i === 0) {
      await page.screenshot({ path: `${SHOTS}/04-cashflow-new-form.png` });
    }
    // Inspect form fields dynamically the first time
    const nameInput = page.locator('input[name="name"], #name').first();
    await nameInput.fill(`Lançamento teste ${i + 1}`);

    const totalInput = page.locator('input[name="total"], #total').first();
    if (await totalInput.count()) {
      await totalInput.fill(String(100 + i));
    }

    // date field might be a shadcn calendar button, not native input
    // try common patterns
    const dateButton = page.locator('button:has-text("Selecione uma data"), button[id="date"], [data-slot="calendar"] button').first();

    const submitBtn = page.locator('button[type="submit"]').first();
    await submitBtn.click();
    // wait a bit for either redirect or success message
    await page.waitForTimeout(600);
    const errText = await page.locator("text=/erro|inválid/i").first().count().catch(() => 0);
    if (errText) {
      log(`Entry ${i + 1}: possible validation error on page`, page.url());
      await page.screenshot({ path: `${SHOTS}/err-entry-${i + 1}.png` });
    }
  }

  log("Finished creating entries, navigating to cashflows list");
  await page.goto(`${BASE}/users/${userId}/cashflows`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/05-cashflows-populated.png` });
  log("Scroll info cashflows (populated):", JSON.stringify(await scrollInfo(page)));

  // Check inner list scroll container
  const innerInfo = await page.evaluate(() => {
    const el = document.querySelector(".overflow-y-auto");
    if (!el) return null;
    return {
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      scrollable: el.scrollHeight > el.clientHeight,
    };
  });
  log("Inner list scroll info:", JSON.stringify(innerInfo));

  // Scroll the inner list to confirm it works, and outer page stays fixed
  await page.evaluate(() => {
    const el = document.querySelector(".overflow-y-auto");
    if (el) el.scrollTop = 300;
  });
  await page.screenshot({ path: `${SHOTS}/06-cashflows-scrolled-inner.png` });
  log("Window scrollY after inner scroll:", await page.evaluate(() => window.scrollY));

  // 4. Spot-check other pages
  log("Checking home page /");
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${SHOTS}/07-home.png` });
  log("Scroll info /:", JSON.stringify(await scrollInfo(page)));

  log("Checking /users/new again");
  await page.goto(`${BASE}/users/new`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${SHOTS}/08-users-new-recheck.png` });

  log("Checking /users/[id]");
  await page.goto(`${BASE}/users/${userId}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${SHOTS}/09-user-detail-recheck.png` });
  log("Scroll info /users/[id] recheck:", JSON.stringify(await scrollInfo(page)));

  await browser.close();
  log("DONE");
})().catch((e) => {
  console.error("SCRIPT FAILED", e);
  process.exit(1);
});
