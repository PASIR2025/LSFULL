#!/usr/bin/env python3
import html as html_lib
import json
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]

LOCAL_STORAGE_MOCK = """<script>
(function(){
  var data = new Map();
  var storage = {
    getItem:function(k){ k=String(k); return data.has(k) ? data.get(k) : null; },
    setItem:function(k,v){ data.set(String(k), String(v)); },
    removeItem:function(k){ data.delete(String(k)); },
    clear:function(){ data.clear(); },
    key:function(i){ return Array.from(data.keys())[i] || null; }
  };
  Object.defineProperty(storage, 'length', {get:function(){ return data.size; }});
  try{ Object.defineProperty(window, 'localStorage', {value:storage, configurable:true}); }catch(e){}
})();
</script>"""


def inline_assets(source: str) -> str:
    def script_repl(match):
        target = ROOT / match.group(1).replace('./', '')
        return '<script>\n' + target.read_text(encoding='utf-8') + '\n</script>' if target.exists() else match.group(0)

    def css_repl(match):
        target = ROOT / match.group(1).replace('./', '')
        return '<style>\n' + target.read_text(encoding='utf-8') + '\n</style>' if target.exists() else match.group(0)

    source = re.sub(r'<script[^>]+src=["\']([^"\']+)["\'][^>]*>\s*</script>', script_repl, source, flags=re.I)
    return re.sub(r'<link[^>]+href=["\']([^"\']+\.css)["\'][^>]*>', css_repl, source, flags=re.I)


def main():
    ladder = LOCAL_STORAGE_MOCK + inline_assets((ROOT / 'ladder_mobile_compact.html').read_text(encoding='utf-8'))
    parent = LOCAL_STORAGE_MOCK + inline_assets((ROOT / 'index.html').read_text(encoding='utf-8'))
    srcdoc = html_lib.escape(ladder, quote=True)
    parent, count = re.subn(
        r'(<iframe[^>]+id=["\']ladderFrame["\'][^>]+)src=["\'][^"\']+["\']',
        lambda match: match.group(1) + 'src="about:blank" srcdoc="' + srcdoc + '"',
        parent,
        count=1,
        flags=re.I,
    )
    if count != 1:
        raise RuntimeError('No se encontró el iframe Ladder.')

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page = browser.new_page(viewport={'width': 1400, 'height': 900})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.set_content(parent, wait_until='load', timeout=180000)
        page.wait_for_function("window.SimuPLCEditorFrameBridge && window.SimuPLCEditors", timeout=30000)

        result = page.evaluate('''async () => {
          const ready = await SimuPLCEditorFrameBridge.waitUntilReady({maxWaitMs:12000, intervalMs:150});
          let changedEvents = 0;
          window.addEventListener('simuplc:ladder-changed', () => changedEvents++);

          const before = await SimuPLCEditors.getLadderState();
          const model = JSON.parse(JSON.stringify(before));
          if (!Array.isArray(model.rungs) || !model.rungs.length) model.rungs = [{id:'r1', elements:[]}];
          model.rungs[0].elements = [{id:'bridge_no_1', type:'NO', label:'I9', x:340, y:180}];
          model.proWires = Array.isArray(model.proWires) ? model.proWires : [];

          const loaded = await SimuPLCEditors.loadLadderState(model);
          const after = await SimuPLCEditors.getLadderState();
          const labels = await SimuPLCEditors.getLadderLabels();
          const arduino = await SimuPLCEditors.getLadderArduino();

          const frame = document.getElementById('ladderFrame');
          frame.contentWindow.SimuPLCLadderHostBridge.emitEvent('editorChanged', {reason:'prueba-puente'});
          await new Promise(resolve => setTimeout(resolve, 250));

          const reset = await SimuPLCEditors.resetLadderOnly();
          const empty = await SimuPLCEditors.getLadderState();
          const bridgeDiagnostics = SimuPLCEditorFrameBridge.getDiagnostics();
          const editorDiagnostics = SimuPLCEditors.getDiagnostics();
          const hostDiagnostics = await SimuPLCEditorFrameBridge.getLadderDiagnostics();

          return {
            ready,
            loaded,
            afterElements: after.rungs && after.rungs[0] ? after.rungs[0].elements : [],
            labels,
            arduinoHasI9: String(arduino).includes('I9'),
            changedEvents,
            reset,
            emptyElementCount: (empty.rungs || []).reduce((sum, rung) => sum + ((rung.elements || []).length), 0),
            bridgeDiagnostics,
            editorDiagnostics,
            hostDiagnostics
          };
        }''')
        browser.close()

    output = {'result': result, 'pageErrors': errors}
    print(json.dumps(output, ensure_ascii=False, indent=2))
    labels = result.get('labels') or {}
    all_labels = (labels.get('inputs') or []) + (labels.get('outputs') or []) + (labels.get('memories') or [])
    ok = (
        not errors
        and result.get('ready', {}).get('ok')
        and result.get('loaded')
        and any(el.get('label') == 'I9' for el in result.get('afterElements', []))
        and 'I9' in all_labels
        and result.get('arduinoHasI9')
        and result.get('changedEvents', 0) >= 1
        and result.get('reset')
        and result.get('emptyElementCount') == 0
        and result.get('bridgeDiagnostics', {}).get('ladderReady')
        and result.get('bridgeDiagnostics', {}).get('pendingCount') == 0
        and result.get('editorDiagnostics', {}).get('ok')
        and result.get('hostDiagnostics', {}).get('ok')
    )
    raise SystemExit(0 if ok else 1)


if __name__ == '__main__':
    main()
