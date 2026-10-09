import { chromium } from "playwright";
import { verifyMockupCylinder } from "./mockup-cylinder-browser.mjs";

const browser = await chromium.launch({headless:true});
try {
  const context = await browser.newContext();
  await verifyMockupCylinder(context);
} finally {
  await browser.close();
}
