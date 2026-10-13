"""Browser smoke test: walks the main flows at phone size and saves screenshots.
Usage: python3 tests/smoke.py <base-url> <out-dir>
"""
import sys, os
from playwright.sync_api import sync_playwright

base, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
errors = []

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    page = ctx.new_page()
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.on("pageerror", lambda e: errors.append(str(e)))

    def shot(name, full=False):
        page.wait_for_timeout(250)
        page.screenshot(path=f"{out}/{name}.png", full_page=full)

    page.goto(base)
    page.wait_for_selector("text=Money this week")
    shot("01-home", full=True)

    # Quick add: expense via keypad
    page.click("button[aria-label='Quick add']")
    page.wait_for_selector("role=dialog")
    for k in ["1", "2", ".", "5"]:
        page.click(f".keypad button[aria-label='{k}']" if k != "." else ".keypad button[aria-label='Decimal point']")
    page.fill("#qa-note", "Lunch")
    page.click("text=Add expense")
    page.wait_for_selector("text=Pick need or want.")
    page.click(".kind-toggle .want")
    page.click(".tag-chip:has-text('#coffee')")
    page.fill("#qa-tag", "lunch")
    page.press("#qa-tag", "Enter")
    shot("02-quickadd-spend")
    page.click("text=Add expense")
    page.wait_for_selector("text=Added $12.50 · want")

    # Quick add: task with tags
    page.click("button[aria-label='Quick add']")
    page.click("role=tab[name='Task']")
    page.fill("#qa-task", "Print cover sheet #lab4 !!")
    shot("03-quickadd-task")
    page.click("button:has-text('Add task')")
    page.wait_for_selector("text=Print cover sheet")

    # Home inline add + toggle
    page.fill("#home-new-task", "Buy stamps #errands")
    page.press("#home-new-task", "Enter")
    page.wait_for_selector("text=Buy stamps")
    page.click("button[aria-label='Mark done: Buy stamps']")

    # Time: paint the day
    page.click("nav >> text=Time")
    page.wait_for_selector(".timeline")
    shot("04-time-day")
    shot("04b-time-day-full", full=True)
    page.click(".tblock >> nth=0")
    page.wait_for_selector("role=dialog")
    shot("05-time-editor")
    page.click("role=dialog >> text=Cancel")
    page.click("button[aria-label='Paint with Friends']")
    page.wait_for_selector(".dock-hint")
    tl = page.locator(".timeline").bounding_box()
    page.evaluate("window.scrollTo(0, 0)")
    page.wait_for_timeout(200)
    tl = page.locator(".timeline").bounding_box()
    x = tl["x"] + tl["width"] * 0.6
    y0 = tl["y"] + 40
    page.mouse.move(x, y0)
    page.mouse.down()
    page.mouse.move(x, y0 + 60, steps=6)
    page.mouse.move(x, y0 + 110, steps=6)
    shot("05b-painting")
    page.mouse.up()
    page.wait_for_selector(".toast:has-text('Painted Friends')")
    shot("05c-painted")
    # Names on: the dock opens into labelled chips
    page.click("button[aria-label='Show names']")
    page.wait_for_selector(".dock.open")
    shot("05d-dock-names")
    page.click(".dock.open .erase-btn")
    page.mouse.move(x, y0 + 80)
    page.mouse.down()
    page.mouse.move(x, y0 + 110, steps=4)
    page.mouse.up()
    page.wait_for_selector(".toast:has-text('Erased')")
    page.click(".dock-hint button[aria-label='Stop painting']")
    page.click("button[aria-label='Hide names']")
    # Milestone
    page.click("button[aria-label='Add a milestone']")
    page.wait_for_selector("role=dialog >> text=Milestone")
    page.click(".ms-tile:has-text('Bed')")
    page.fill("#ms-time", "00:30")
    shot("05e-milestone")
    page.click("role=dialog >> button:has-text('Add Bed')")
    page.wait_for_selector(".toast:has-text('Bed · 12:30 am')")
    # Hidden dial
    page.click("button.card-link.quiet")
    page.wait_for_selector("svg[aria-label^='The day as a 24-hour ring']")
    page.locator("svg[aria-label^='The day as a 24-hour ring']").scroll_into_view_if_needed()
    shot("05f-dial")
    page.click("button[aria-label^='Add a block at 9 pm']")
    page.fill("#entry-label", "Evening walk")
    page.click("role=dialog >> button:has-text('Save')")
    page.wait_for_selector("text=Evening walk")

    # Week spread
    page.click("role=tab[name='Week']")
    page.wait_for_selector(".spread")
    shot("06-time-week")
    page.click("button[aria-label='Previous week']")
    page.wait_for_timeout(200)
    shot("06b-last-week", full=True)
    page.click("button[aria-label='Paint with Drift']")
    sp = page.locator(".spread").bounding_box()
    cx = sp["x"] + 30 + (sp["width"] - 36) * 2.5 / 7
    page.mouse.move(cx, sp["y"] + 400)
    page.mouse.down()
    page.mouse.move(cx, sp["y"] + 440, steps=5)
    page.mouse.up()
    page.wait_for_selector(".toast:has-text('Painted Drift')")
    page.click(".spread-day >> nth=0")
    page.wait_for_selector(".timeline")

    # Stats
    page.click("role=tab[name='Stats']")
    page.wait_for_selector("text=Hours per day")
    shot("07-time-stats")
    page.click("role=tab[name='Month']")
    page.wait_for_selector("text=Each day")

    # Money
    page.click("nav >> text=Money")
    page.wait_for_selector("text=Need vs want")
    shot("08-money", full=True)
    page.click("button:has-text('Paid') >> nth=0")
    page.wait_for_selector("text=Paid Phone plan")
    page.click(".kind-card >> nth=0")
    page.wait_for_selector("text=Needs ·")
    page.click("role=tab[name='Month']")
    page.wait_for_selector("text=Each week")
    shot("08b-money-month", full=True)
    page.click("button:has-text('4 ×')")
    page.fill("#allowance", "300")
    page.click("role=dialog >> button:has-text('Save')")
    page.wait_for_selector("text=Weekly allowance set to $300.00")

    # Tasks
    page.goto(base + "#tasks")
    page.wait_for_selector("text=Next 7 days")
    shot("09-tasks", full=True)
    page.click("role=tab[name^='Uni']")
    page.click(".chip:has-text('#lab4')")
    shot("10-tasks-filtered")
    page.click(".item-main >> nth=0")
    page.wait_for_selector("text=Edit task")
    shot("11-task-editor")
    page.click("role=dialog >> text=Cancel")

    # More
    page.click("nav >> text=More")
    page.wait_for_selector("text=Your data")
    page.click("text=Back up my data")
    shot("12-more", full=True)

    # Persistence: reload keeps data
    page.reload()
    page.wait_for_selector("text=Your data")
    page.goto(base + "#tasks")
    page.wait_for_selector("text=Print cover sheet")

    # Dark mode
    ctx2 = browser.new_context(viewport={"width": 390, "height": 844}, color_scheme="dark", device_scale_factor=2)
    p2 = ctx2.new_page()
    p2.on("pageerror", lambda e: errors.append(str(e)))
    p2.goto(base)
    p2.wait_for_selector("text=Money this week")
    p2.wait_for_timeout(300)
    p2.screenshot(path=f"{out}/13-home-dark.png")

    # Desktop width
    ctx3 = browser.new_context(viewport={"width": 1280, "height": 860})
    p3 = ctx3.new_page()
    p3.on("pageerror", lambda e: errors.append(str(e)))
    p3.goto(base + "#week")
    p3.wait_for_selector(".spread")
    p3.wait_for_timeout(300)
    p3.screenshot(path=f"{out}/14-desktop-time.png")
    overflow = p3.evaluate("document.documentElement.scrollWidth > window.innerWidth")
    overflow_m = page.evaluate("document.documentElement.scrollWidth > window.innerWidth")

    browser.close()

print("horizontal overflow (desktop, phone):", overflow, overflow_m)
print("errors:", errors if errors else "none")
