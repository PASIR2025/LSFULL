#!/usr/bin/env python3
import json
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
MOCK = """<script>(function(){var d=new Map();var s={getItem:k=>d.has(String(k))?d.get(String(k)):null,setItem:(k,v)=>d.set(String(k),String(v)),removeItem:k=>d.delete(String(k)),clear:()=>d.clear(),key:i=>Array.from(d.keys())[i]||null};Object.defineProperty(s,'length',{get:()=>d.size});try{Object.defineProperty(window,'localStorage',{value:s,configurable:true});}catch(e){}})();</script>"""


def inline(html):
    def repl(match):
        file_path = ROOT / match.group(1).replace('./', '')
        if not file_path.exists():
            return match.group(0)
        return '<script>' + file_path.read_text(encoding='utf-8') + '</script>'
    return re.sub(r'<script[^>]+src=["\']([^"\']+)["\'][^>]*>\s*</script>', repl, html, flags=re.I)


def inspect_modal(page):
    return page.evaluate("""() => {
      const overlay = document.getElementById('editOverlay');
      const card = overlay.querySelector('.edit-card');
      const save = document.getElementById('saveEditModal');
      return {
        shown: overlay.classList.contains('show'),
        scrollHeight: card.scrollHeight,
        clientHeight: card.clientHeight,
        scrollTop: card.scrollTop,
        saveRect: save.getBoundingClientRect().toJSON(),
        viewport: {w: innerWidth, h: innerHeight},
        overflowY: getComputedStyle(card).overflowY,
        overlayOverflowY: getComputedStyle(overlay).overflowY
      };
    }""")


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 390, 'height': 667}, is_mobile=True, has_touch=True)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))

    html = inline((ROOT / 'ladder_mobile_compact.html').read_text(encoding='utf-8'))
    page.set_content(MOCK + html, wait_until='load', timeout=180000)
    page.wait_for_timeout(1200)
    page.evaluate("""() => { const b=document.getElementById('ladderPremiumBtn'); if(b) b.style.display='none'; }""")

    page.evaluate("""() => {
      resetDemoProject();
      setPendingType('NO');
      addElementAtPointer(350,270);
      const el = state.ladder.rungs[0].elements[0];
      state.selectedId = el.id;
      openEditModalFromSelection();
    }""")
    portrait_before = inspect_modal(page)
    page.locator('#editNameInput').fill('I9')
    page.locator('#editReferenceInput').fill('Pulsador prueba modal')
    page.evaluate("""() => { const card=document.querySelector('#editOverlay .edit-card'); card.scrollTop=card.scrollHeight; }""")
    page.wait_for_timeout(100)
    portrait_after = inspect_modal(page)
    portrait_save_box = page.locator('#saveEditModal').bounding_box()
    page.locator('#saveEditModal').click(timeout=10000)
    portrait_final = page.evaluate("""() => {
      const el=state.ladder.rungs[0].elements[0];
      return {label:el.label,reference:el.reference,closed:!document.getElementById('editOverlay').classList.contains('show')};
    }""")

    page.set_viewport_size({'width': 844, 'height': 390})
    page.evaluate("""() => { state.selectedId=state.ladder.rungs[0].elements[0].id; openEditModalFromSelection(); }""")
    page.wait_for_timeout(100)
    landscape_before = inspect_modal(page)
    page.evaluate("""() => { const card=document.querySelector('#editOverlay .edit-card'); card.scrollTop=card.scrollHeight; }""")
    page.wait_for_timeout(100)
    landscape_after = inspect_modal(page)
    landscape_save_box = page.locator('#saveEditModal').bounding_box()
    page.locator('#saveEditModal').click(timeout=10000)
    landscape_final = page.evaluate("""() => ({closed:!document.getElementById('editOverlay').classList.contains('show')})""")

    browser.close()

expected = {'label':'I9','reference':'Pulsador prueba modal','closed':True}
def in_view(box, viewport_h):
    return bool(box and box['y'] >= -1 and box['y'] + box['height'] <= viewport_h + 1)

ok = (
    not errors
    and portrait_before['shown']
    and portrait_before['overflowY'] in ('auto','scroll')
    and portrait_before['clientHeight'] <= portrait_before['viewport']['h']
    and in_view(portrait_save_box, portrait_after['viewport']['h'])
    and portrait_final == expected
    and landscape_before['shown']
    and landscape_before['clientHeight'] <= landscape_before['viewport']['h']
    and in_view(landscape_save_box, landscape_after['viewport']['h'])
    and landscape_final['closed']
)

result = {
    'ok': ok,
    'portrait': {'before':portrait_before,'after':portrait_after,'saveBox':portrait_save_box,'final':portrait_final},
    'landscape': {'before':landscape_before,'after':landscape_after,'saveBox':landscape_save_box,'final':landscape_final},
    'pageErrors': errors,
}
print(json.dumps(result, ensure_ascii=False, indent=2))
raise SystemExit(0 if ok else 1)
