"""
Browser-automated download of Nexusmods files via Playwright.
Handles the Slow Download flow: open page → click Slow download → wait 6s → save file.
"""
import asyncio
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

MODS_DIR = os.getenv("MODS_DIR", "")
CHROME_PROFILE_PATH = os.getenv("CHROME_PROFILE_PATH", "")


async def download_mod_file(url: str, mod_name: str = "") -> dict:
    """
    Automate Nexusmods Slow Download flow with Playwright.
    Returns {"filename": ..., "path": ..., "success": True} on success.
    """
    from playwright.async_api import async_playwright

    if not MODS_DIR:
        raise RuntimeError("MODS_DIR not configured")
    if not CHROME_PROFILE_PATH:
        raise RuntimeError("CHROME_PROFILE_PATH not configured in .env")

    mods_path = Path(MODS_DIR)
    if not mods_path.exists():
        raise RuntimeError(f"MODS_DIR does not exist: {MODS_DIR}")

    async with async_playwright() as p:
        context = await p.chromium.launch_persistent_context(
            user_data_dir=CHROME_PROFILE_PATH,
            headless=False,
            accept_downloads=True,
            downloads_path=str(mods_path),
            args=["--no-first-run", "--no-default-browser-check"],
        )

        page = context.pages[0] if context.pages else await context.new_page()

        try:
            print(f"[downloader] Navigating to {url}")
            await page.goto(url, wait_until="domcontentloaded", timeout=30_000)

            # Find the "Slow download" button - try several selectors
            slow_btn = None
            for selector in [
                "text=Slow download",
                "a:has-text('Slow download')",
                "button:has-text('Slow download')",
                "[data-id='slowDownload']",
            ]:
                try:
                    loc = page.locator(selector).first
                    await loc.wait_for(state="visible", timeout=5_000)
                    slow_btn = loc
                    break
                except Exception:
                    continue

            if slow_btn is None:
                raise RuntimeError(
                    "Could not find 'Slow download' button. "
                    "Are you logged in? Check CHROME_PROFILE_PATH."
                )

            print("[downloader] Clicking 'Slow download'...")
            async with page.expect_download(timeout=60_000) as dl_info:
                await slow_btn.click()
                # Countdown is ~6 seconds; wait a bit longer to be safe
                print("[downloader] Waiting for countdown (~6 s)...")
                await page.wait_for_timeout(8_000)

            download = await dl_info.value
            filename = download.suggested_filename
            dest = mods_path / filename

            print(f"[downloader] Saving to {dest}")
            await download.save_as(str(dest))

            print(f"[downloader] Done: {filename}")
            return {"success": True, "filename": filename, "path": str(dest)}

        finally:
            await context.close()
