#!/usr/bin/env python3
import json
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
STORAGE = """<script>(function(){var d=new Map();var s={getItem:k=>d.has(String(k))?d.get(String(k)):null,setItem:(k,v)=>d.set(String(k),String(v)),removeItem:k=>d.delete(String(k)),clear:()=>d.clear(),key:i=>Array.from(d.keys())[i]||null};Object.defineProperty(s,'length',{get:()=>d.size});Object.defineProperty(window,'localStorage',{value:s,configurable:true});})();</script>"""

def inline_assets(source: str) -> str:
    def script(match):
        path = ROOT / match.group(1).replace('./', '')
        return '<script>\n' + path.read_text(encoding='utf-8') + '\n</script>' if path.exists() else match.group(0)
    def css(match):
        path = ROOT / match.group(1).replace('./', '')
        return '<style>\n' + path.read_text(encoding='utf-8') + '\n</style>' if path.exists() else match.group(0)
    source = re.sub(r'<script[^>]+src=["\']([^"\']+)["\'][^>]*>\s*</script>', script, source, flags=re.I)
    return re.sub(r'<link[^>]+href=["\']([^"\']+\.css)["\'][^>]*>', css, source, flags=re.I)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=1, is_mobile=True, has_touch=True)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    html = STORAGE + inline_assets((ROOT / 'index.html').read_text(encoding='utf-8'))
    html = re.sub(r'(<iframe[^>]+id=["\']ladderFrame["\'][^>]+)src=["\'][^"\']+["\']', r'\1src="about:blank"', html, flags=re.I)
    page.set_content(html, wait_until='load', timeout=180000)
    page.wait_for_function('window.SimuPLCFBDAnalog && window.SimuPLCFBDTapPlacement', timeout=30000)
    page.wait_for_timeout(1200)

    page.click('#burger')
    page.locator('#sidebar .component[data-type="analog_input"]').click()
    page.click('#burger')
    selected = page.evaluate("SimuPLCFBDTapPlacement.getSelectedType()")
    page.locator('#canvas').click(position={'x': 195, 'y': 360})
    page.wait_for_timeout(300)

    result = page.evaluate('''() => {
      const node = nodes[0];
      if(node) SimuPLCFBDAnalog.openConfig(node);
      const modal = document.querySelector('.analog-config-card');
      const rect = modal ? modal.getBoundingClientRect() : null;
      const slider = node && node.el ? node.el.querySelector('.analog-slider') : null;
      if(slider){ slider.value='3072'; slider.dispatchEvent(new Event('input',{bubbles:true})); }
      return {
        selectedType: window.SimuPLCFBDTapPlacement.getSelectedType(),
        insertedType: node && node.type,
        insertedName: node && node.name,
        sliderExists: !!slider,
        scaledValue: node && node.analogValue,
        modalVisible: !!(modal && document.getElementById('analogConfigModal').classList.contains('show')),
        modalBounds: rect ? {left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,width:rect.width,height:rect.height} : null,
        viewport: {width:innerWidth,height:innerHeight}
      };
    }''')
    browser.close()

print(json.dumps({'result': result, 'errors': errors}, ensure_ascii=False, indent=2))
bounds = result.get('modalBounds') or {}
viewport = result.get('viewport') or {}
ok = (
    not errors
    and selected == 'analog_input'
    and result.get('insertedType') == 'analog_input'
    and result.get('insertedName') == 'AI1'
    and result.get('sliderExists')
    and 74.9 < float(result.get('scaledValue') or 0) < 75.2
    and result.get('modalVisible')
    and bounds.get('left', -1) >= 0
    and bounds.get('right', 10**9) <= viewport.get('width', 0)
    and bounds.get('top', -1) >= 0
    and bounds.get('bottom', 10**9) <= viewport.get('height', 0)
)
raise SystemExit(0 if ok else 1)
