"""
End-to-end test: verifies that the shipment mode picked in the New Quote
dialog (direct / console / transship) is persisted to the backend and
reflected back in the "הצעות שנשמרו לאחרונה" panel on the Commercial
dashboard.

Requires:
  - Dev server running at http://localhost:8080
  - Python playwright available (the sandbox ships with it preinstalled)

Run:
  python tests/e2e/quote_shipment_mode.py
"""

import asyncio
import os
import time
from pathlib import Path
from playwright.async_api import async_playwright, expect

BASE_URL = os.environ.get("E2E_BASE_URL", "http://localhost:8080")
SCREENSHOTS = Path("/tmp/browser/quote-shipment-mode")
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

MODES = ["direct", "console", "transship"]


async def signup(page):
    stamp = int(time.time() * 1000)
    email = f"e2e+{stamp}@example.com"
    org_code = f"E2E{stamp % 100000}"
    await page.goto(f"{BASE_URL}/signup", wait_until="networkidle")
    await page.get_by_placeholder("Acme Logistics").fill(f"E2E Org {stamp}")
    await page.get_by_role("textbox", name="ACME", exact=True).fill(org_code)
    await page.get_by_placeholder("Jane Doe").fill("E2E User")
    await page.get_by_placeholder("you@company.com").fill(email)
    await page.locator('input[type="password"]').fill("password1234")
    await page.get_by_role("button", name="Create organization").click()
    # Signup redirects to /dashboard/shipments on success
    await page.wait_for_url("**/dashboard/**", timeout=15000)
    return email


async def create_quote_with_mode(page, mode: str):
    await page.goto(f"{BASE_URL}/dashboard/commercial", wait_until="networkidle")
    await page.get_by_test_id("open-new-quote").click()

    # Step 1: pick the first customer
    await page.locator('[role="dialog"] button:has-text("אחראי:")').first.click()
    await page.get_by_test_id("wizard-next").click()  # -> step 2

    # Step 2: no card is pre-selected anymore — explicitly pick shipment kind
    # and incoterm (required whenever kind != domestic) before continuing.
    await page.locator('[role="dialog"] button:has-text("ייצוא")').first.click()
    await page.locator('[role="dialog"] button:has-text("CIP")').first.click()
    await page.get_by_test_id("wizard-next").click()  # -> step 3

    # Step 3: cargo type and the default package's pallet type are both
    # required (no default selection) before continuing.
    await page.locator('[role="dialog"] button:has-text("מטען כללי")').first.click()
    await page.locator('[role="dialog"] button:has-text("משטח יורו")').first.click()
    await page.get_by_test_id("wizard-next").click()  # -> step 4

    # Step 4: pick shipment mode
    mode_btn = page.get_by_test_id(f"mode-{mode}")
    await mode_btn.click()
    await expect(mode_btn).to_have_attribute("data-active", "true")

    await page.get_by_test_id("wizard-next").click()  # -> step 5
    await page.get_by_test_id("wizard-next").click()  # -> step 6
    await page.get_by_test_id("wizard-finish").click()  # opens the finish-options panel
    await page.get_by_test_id("finish-save").click()  # "שמור שינויים" — save and close, stay put

    # Wait for success toast (Sonner)
    await expect(page.locator('[data-sonner-toast]').first).to_be_visible(timeout=15000)

    # Dialog closes and saved quotes refetches — assert a row with the mode is visible
    row = page.locator(
        f'[data-testid="saved-quote-row"][data-shipment-mode="{mode}"]'
    ).first
    await expect(row).to_be_visible(timeout=10000)
    return row


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        page.on("pageerror", lambda e: print("PAGE ERROR:", e))
        page.on("console", lambda m: m.type == "error" and print("CONSOLE ERROR:", m.text))

        email = await signup(page)
        print(f"signed up as {email}")
        await page.screenshot(path=str(SCREENSHOTS / "0_after_signup.png"))

        for i, mode in enumerate(MODES, start=1):
            print(f"--- creating quote with mode={mode} ---")
            await create_quote_with_mode(page, mode)
            await page.screenshot(path=str(SCREENSHOTS / f"{i}_after_{mode}.png"))

        # Final assertion: reload and verify persistence survived a fresh fetch
        await page.reload(wait_until="networkidle")
        for mode in MODES:
            await expect(
                page.locator(
                    f'[data-testid="saved-quote-row"][data-shipment-mode="{mode}"]'
                ).first
            ).to_be_visible(timeout=10000)
            print(f"persisted mode visible after reload: {mode}")

        await page.screenshot(path=str(SCREENSHOTS / "final_reload.png"))
        await browser.close()
        print("PASS: all three shipment modes persisted and rendered.")


if __name__ == "__main__":
    asyncio.run(main())
