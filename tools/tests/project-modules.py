#!/usr/bin/env python3
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
  Object.defineProperty(window, 'localStorage', {value:storage, configurable:true});
})();
</script>"""


def inline_assets(html: str) -> str:
    def script_repl(match):
        target = ROOT / match.group(1).replace('./', '')
        return '<script>\n' + target.read_text(encoding='utf-8') + '\n</script>' if target.exists() else match.group(0)

    def css_repl(match):
        target = ROOT / match.group(1).replace('./', '')
        return '<style>\n' + target.read_text(encoding='utf-8') + '\n</style>' if target.exists() else match.group(0)

    html = re.sub(r'<script[^>]+src=["\']([^"\']+)["\'][^>]*>\s*</script>', script_repl, html, flags=re.I)
    return re.sub(r'<link[^>]+href=["\']([^"\']+\.css)["\'][^>]*>', css_repl, html, flags=re.I)


def main():
    html = inline_assets((ROOT / 'index.html').read_text(encoding='utf-8'))
    html = re.sub(
        r'(<iframe[^>]+id=["\']ladderFrame["\'][^>]+)src=["\'][^"\']+["\']',
        r'\1src="about:blank"',
        html,
        flags=re.I
    )

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page = browser.new_page(viewport={'width': 1400, 'height': 900})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.set_content(LOCAL_STORAGE_MOCK + html, wait_until='load', timeout=120000)
        page.wait_for_timeout(5200)

        result = page.evaluate('''async () => {
          const modal = {confirm:async()=>true,prompt:async()=> 'Renombrado',alert:async()=>true};
          window.SimuPLCNativeModal = modal;
          window.SimuPLCModal = modal;

          localStorage.setItem('logicsoft_circuits_v1', '[]');
          clearAll();
          createNode('input', 180, 180);
          const savedState = serializeFBD();
          const item = SimuPLCProjectRepository.createSavedItem({name:'Original', editor:'fbd', fbd:savedState});
          const added = SimuPLCProjectRepository.add(item);
          const afterAdd = SimuPLCProjectRepository.list();

          clearAll();
          const opened = await SimuPLCActions.openSavedCircuit(item.id);
          const openedNames = nodes.map(node => node.name);

          const renamed = SimuPLCProjectRepository.rename(item.id, 'Renombrado');
          const renamedItem = SimuPLCProjectRepository.get(item.id);

          const canonical = await SimuPLCProjectIO.captureCurrentProject('Proyecto modular');
          const legacyFbd = {name:'Importado anterior', nodes:savedState.nodes, connections:savedState.connections, settings:savedState.settings};
          const prepared = await SimuPLCProjectIO.prepareImport(legacyFbd);

          let invalidMessage = '';
          try {
            SimuPLCProjectIO.validateEditorState('fbd', {type:'simuplc-fbd', version:3, nodes:[{id:'x'}], connections:[], settings:{}});
          } catch (error) { invalidMessage = String(error.message || error); }

          const removed = SimuPLCProjectRepository.remove(item.id);
          const afterRemove = SimuPLCProjectRepository.list();

          return {
            repository: SimuPLCProjectRepository.getDiagnostics(),
            projectIO: SimuPLCProjectIO.getDiagnostics(),
            actionDiagnostics: SimuPLCActions.getDiagnostics(),
            added: !!added,
            afterAddCount: afterAdd.length,
            opened: opened,
            openedNames: openedNames,
            renamed: renamed,
            renamedName: renamedItem && renamedItem.name,
            canonical: {type:canonical.type, schemaVersion:canonical.schemaVersion, name:canonical.name},
            prepared: {type:prepared.type, schemaVersion:prepared.schemaVersion, activeEditor:prepared.activeEditor, fbdNodes:prepared.editors.fbd.nodes.length},
            safeName: SimuPLCProjectIO.safeFileName('Motor 1: Arranque/Parada'),
            invalidMessage: invalidMessage,
            removed: removed,
            afterRemoveCount: afterRemove.length
          };
        }''')

        output = {'result': result, 'pageErrors': errors}
        print(json.dumps(output, ensure_ascii=False, indent=2))
        browser.close()

        ok = (
            not errors
            and result['repository']['ok']
            and result['projectIO']['ok']
            and result['actionDiagnostics']['ok']
            and result['added']
            and result['afterAddCount'] == 1
            and result['opened']
            and 'I1' in result['openedNames']
            and result['renamed']
            and result['renamedName'] == 'Renombrado'
            and result['canonical']['type'] == 'simuplc-project'
            and result['canonical']['schemaVersion'] == 1
            and result['prepared']['type'] == 'simuplc-project'
            and result['prepared']['fbdNodes'] == 1
            and result['safeName'] == 'Motor_1__Arranque_Parada'
            and bool(result['invalidMessage'])
            and result['removed']
            and result['afterRemoveCount'] == 0
        )
        raise SystemExit(0 if ok else 1)


if __name__ == '__main__':
    main()
