#!/usr/bin/env python3
import json
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'docs'
OUT.mkdir(exist_ok=True)
STORAGE = """<script>(function(){var d=new Map();var s={getItem:k=>d.has(String(k))?d.get(String(k)):null,setItem:(k,v)=>d.set(String(k),String(v)),removeItem:k=>d.delete(String(k)),clear:()=>d.clear(),key:i=>Array.from(d.keys())[i]||null};Object.defineProperty(s,'length',{get:()=>d.size});Object.defineProperty(window,'localStorage',{value:s,configurable:true});})();</script>"""
EXPECTED = {
    'analog_input': ('AI', 'Entrada analógica'),
    'scale': ('SCALE', 'Escalamiento'),
    'gt': ('>', 'Mayor que'),
    'lt': ('<', 'Menor que'),
    'eq': ('=', 'Igual a'),
    'gte': ('≥', 'Mayor o igual'),
    'lte': ('≤', 'Menor o igual'),
    'hyst': ('HYS', 'Histéresis'),
}

def inline_assets(source: str) -> str:
    def script(match):
        path = ROOT / match.group(1).replace('./', '')
        return '<script>\n' + path.read_text(encoding='utf-8') + '\n</script>' if path.exists() else match.group(0)
    def css(match):
        path = ROOT / match.group(1).replace('./', '')
        return '<style>\n' + path.read_text(encoding='utf-8') + '\n</style>' if path.exists() else match.group(0)
    source = re.sub(r'<script[^>]+src=["\']([^"\']+)["\'][^>]*>\s*</script>', script, source, flags=re.I)
    return re.sub(r'<link[^>]+href=["\']([^"\']+\.css)["\'][^>]*>', css, source, flags=re.I)

def run_view(browser, name, viewport, mobile=False):
    page = browser.new_page(viewport=viewport, device_scale_factor=1, is_mobile=mobile, has_touch=mobile)
    errors=[]
    page.on('pageerror', lambda error: errors.append(str(error)))
    html = STORAGE + inline_assets((ROOT / 'index.html').read_text(encoding='utf-8'))
    html = re.sub(r'(<iframe[^>]+id=["\']ladderFrame["\'][^>]+)src=["\'][^"\']+["\']', r'\1src="about:blank"', html, flags=re.I)
    page.set_content(html, wait_until='load', timeout=180000)
    page.wait_for_timeout(2500)
    ready = page.evaluate('!!(window.SimuPLCAnalogCatalog && window.SimuPLCRenderLibrarySymbols)')
    if not ready:
        errors.append('El catálogo o el renderizador visual no cargó.')
    page.evaluate("document.getElementById('sidebar').classList.add('open')")
    page.evaluate("document.querySelector('#sidebar .component[data-type=\"analog_input\"]')?.scrollIntoView({block:'start'})")
    page.wait_for_timeout(400)
    data = page.evaluate('''() => Array.from(document.querySelectorAll('#sidebar .component.lib-analog')).map(el => {
      const symbol=el.querySelector('.lib-symbol');
      const label=el.querySelector('.lib-name');
      const badge=el.querySelector('.lib-badge-analog');
      const er=el.getBoundingClientRect(), sr=symbol.getBoundingClientRect(), lr=label.getBoundingClientRect();
      return {
        type:el.dataset.type,
        symbol:symbol.textContent,
        name:label.textContent,
        title:el.title,
        badge:badge && badge.textContent,
        card:{left:er.left,right:er.right,top:er.top,bottom:er.bottom,width:er.width,height:er.height},
        symbolRect:{left:sr.left,right:sr.right,top:sr.top,bottom:sr.bottom,width:sr.width,height:sr.height},
        labelRect:{left:lr.left,right:lr.right,top:lr.top,bottom:lr.bottom,width:lr.width,height:lr.height},
        overflowX:el.scrollWidth > el.clientWidth + 3,
        overflowY:el.scrollHeight > el.clientHeight + 1,
        fontSize:getComputedStyle(symbol).fontSize
      };
    })''')
    section = page.locator('#sidebar')
    section.screenshot(path=str(OUT / f'analog-library-{name}.png'))
    page.close()
    failures=[]
    if errors: failures.extend(errors)
    if len(data)!=len(EXPECTED): failures.append(f'expected {len(EXPECTED)} cards, got {len(data)}')
    for card in data:
        expected=EXPECTED.get(card['type'])
        if not expected: failures.append(f"unexpected {card['type']}"); continue
        if (card['symbol'],card['name']) != expected:
            failures.append(f"{card['type']} shows {(card['symbol'],card['name'])}, expected {expected}")
        if card['badge']!='A': failures.append(f"{card['type']} badge={card['badge']}")
        c,s,l=card['card'],card['symbolRect'],card['labelRect']
        if s['left'] < c['left']-1 or s['right'] > c['right']+1: failures.append(f"{card['type']} symbol outside card")
        if l['left'] < c['left']-1 or l['right'] > c['right']+1: failures.append(f"{card['type']} label outside card")
    return {'viewport':viewport,'cards':data,'errors':errors,'failures':failures}

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    result={
        'desktop':run_view(browser,'desktop',{'width':1280,'height':900}),
        'mobile':run_view(browser,'mobile',{'width':390,'height':844},True),
    }
    browser.close()

(OUT/'RESULTADOS_PRUEBAS_FASE2_PASO4_BIBLIOTECA.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=False,indent=2))
ok=not result['desktop']['failures'] and not result['mobile']['failures']
raise SystemExit(0 if ok else 1)
