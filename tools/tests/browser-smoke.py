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
  try{ Object.defineProperty(window, 'localStorage', {value:storage, configurable:true}); }catch(e){}
})();
</script>"""


def inline_assets(html: str) -> str:
    def script_repl(match):
        src = match.group(1).replace('./', '')
        target = ROOT / src
        if target.exists():
            return '<script>\n' + target.read_text(encoding='utf-8') + '\n</script>'
        return match.group(0)

    def css_repl(match):
        href = match.group(1).replace('./', '')
        target = ROOT / href
        if target.exists():
            return '<style>\n' + target.read_text(encoding='utf-8') + '\n</style>'
        return match.group(0)

    html = re.sub(r'<script[^>]+src=["\']([^"\']+)["\'][^>]*>\s*</script>', script_repl, html, flags=re.I)
    html = re.sub(r'<link[^>]+href=["\']([^"\']+\.css)["\'][^>]*>', css_repl, html, flags=re.I)
    return html


def run_index(browser):
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    html = LOCAL_STORAGE_MOCK + inline_assets((ROOT / 'index.html').read_text(encoding='utf-8'))
    html = re.sub(r'(<iframe[^>]+id=["\']ladderFrame["\'][^>]+)src=["\'][^"\']+["\']', r'\1src="about:blank"', html, flags=re.I)
    page.set_content(html, wait_until='load', timeout=120000)
    page.wait_for_timeout(5200)

    results = {
        'title': page.title(),
        'health': page.evaluate('SimuPLCPhase1.getHealthReport()'),
        'storageFallback': page.evaluate("SimuPLCStorage.getJSON('no-existe', {ok:true})"),
        'storageBackup': page.evaluate("!!localStorage.getItem('simuplc_phase1_storage_backup_v1')"),
        'fbdModules': page.evaluate('''() => {
          if (!window.SimuPLCFBDSelection || !window.SimuPLCFBDMovement || !window.SimuPLCFBDComponents) {
            return {ok:false, reason:'Módulos FBD no disponibles'};
          }
          clearAll();
          createNode('input', 240, 220);
          const node = nodes[0];
          const before = {left:parseFloat(node.el.style.left), top:parseFloat(node.el.style.top)};
          selectNode(node);
          node.el.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true,clientX:250,clientY:230,button:0}));
          document.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,cancelable:true,clientX:310,clientY:270,button:0}));
          document.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,cancelable:true,clientX:310,clientY:270,button:0}));
          const after = {left:parseFloat(node.el.style.left), top:parseFloat(node.el.style.top)};
          const selected = node.el.classList.contains('selected') && window.selectedNode === node;
          deleteSelected();
          return {
            ok:selected && after.left > before.left && after.top > before.top && nodes.length === 0,
            selected:selected,before:before,after:after,nodeCount:nodes.length,
            selection:SimuPLCFBDSelection.getDiagnostics(),
            movement:SimuPLCFBDMovement.getDiagnostics(),
            components:SimuPLCFBDComponents.getDiagnostics()
          };
        }'''),
        'fbdWiring': page.evaluate('''() => {
          if (!window.SimuPLCFBDWiring || !window.SimuPLCFBDWireGeometry) {
            return {ok:false, reason:'Módulos de cableado no disponibles'};
          }
          clearAll();
          createNode('input', 230, 260);
          createNode('output', 650, 260);
          const src=nodes[0], dst=nodes[1];
          src.output.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,button:0}));
          dst.inputs[0].dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,button:0}));
          const created=connections.length===1 ? connections[0] : null;
          const pathBefore=created && created.path ? created.path.getAttribute('d') : '';
          const duplicate=SimuPLCFBDWiring.create(src.output,dst.inputs[0]);
          const duplicateRejected=duplicate===null && connections.length===1;
          const selfRejected=SimuPLCFBDWiring.validate(src.output,src.output).ok===false;
          const bend=SimuPLCFBDWiring.addBend(created,{x:430,y:340});
          const pathAfter=created && created.path ? created.path.getAttribute('d') : '';
          const bendOk=!!bend && created.bends.length===1 && pathAfter && pathAfter!==pathBefore;
          convertWireToLabel(created);
          const labelOk=created.mode==='label' && !!created.srcBranch && !!created.dstBranch;
          const srcTag=created.srcBranch && created.srcBranch.tagEl;
          const dstTag=created.dstBranch && created.dstBranch.tagEl;
          const srcPath=created.srcBranch && created.srcBranch.path;
          const dstPath=created.dstBranch && created.dstBranch.path;
          removeConnection(created);
          const removed=connections.length===0 && (!srcTag || !document.body.contains(srcTag)) && (!dstTag || !document.body.contains(dstTag)) && (!srcPath || !document.body.contains(srcPath)) && (!dstPath || !document.body.contains(dstPath));
          const diagnostics=SimuPLCFBDWiring.getDiagnostics();
          return {
            ok:!!created && duplicateRejected && selfRejected && bendOk && labelOk && removed,
            duplicateRejected:duplicateRejected,selfRejected:selfRejected,bendOk:bendOk,labelOk:labelOk,removed:removed,
            diagnostics:diagnostics,geometry:SimuPLCFBDWireGeometry.getDiagnostics()
          };
        }'''),
        'counterRegression': page.evaluate('''() => {
          if (typeof clearAll !== 'function' || typeof createNode !== 'function' || typeof serializeFBD !== 'function' || typeof loadFromData !== 'function') {
            return {ok:false, reason:'API FBD no disponible'};
          }
          clearAll();
          createNode('input', 180, 180);
          createNode('and', 420, 180);
          createNode('output', 660, 180);
          const saved = serializeFBD();
          loadFromData(saved);
          createNode('input', 900, 180);
          const names = nodes.map(n => n.name);
          return {ok:names.includes('I2') && !names.includes('I3'), names};
        }'''),
        'schema': page.evaluate('''() => {
          const project = SimuPLCProjectSchema.createProject({
            name:'Prueba Fase 1',
            fbd:serializeFBD(),
            ladder:SimuPLCProjectSchema.emptyLadder()
          });
          const legacy = {type:'simuplc-dual-project', version:2, name:'Anterior', activeEditor:'ladder', editors:project.editors};
          const migrated = SimuPLCProjectSchema.migrate(legacy);
          return {
            type:project.type,
            schemaVersion:project.schemaVersion,
            validation:SimuPLCProjectSchema.validate(project),
            migratedType:migrated.type,
            migratedEditor:migrated.activeEditor
          };
        }'''),
        'exportSchema': page.evaluate('''async () => {
          const project = await SimuPLCProject.makeUnifiedProject('Exportación Fase 1');
          return {type:project.type, schemaVersion:project.schemaVersion, hasFbd:!!project.editors.fbd, hasLadder:!!project.editors.ladder};
        }'''),
        'recovery': page.evaluate('''async () => {
          await SimuPLCRecovery.saveNow('prueba-autoguardado', {force:true, pending:true, allowSuspended:true});
          const backup = await SimuPLCRecovery.createBackup('prueba-respaldo');
          let invalidMessage = '';
          let incompatibleMessage = '';
          try { SimuPLCRecovery.validateImportText('{archivo-danado'); } catch (error) { invalidMessage = error.message; }
          try {
            SimuPLCRecovery.validateImportText(JSON.stringify({
              type:'simuplc-project', schemaVersion:99, version:99,
              editors:{
                fbd:{type:'simuplc-fbd',version:3,nodes:[],connections:[],settings:{}},
                ladder:{type:'ladder-phase9',version:1,rungs:[{id:'r1',elements:[]}],proWires:[],settings:{}}
              }
            }));
          } catch (error) { incompatibleMessage = error.message; }
          return {
            diagnostics: SimuPLCRecovery.getDiagnostics(),
            autosave: JSON.parse(localStorage.getItem('simuplc_autosave_project_v1') || 'null'),
            state: JSON.parse(localStorage.getItem('simuplc_recovery_state_v1') || 'null'),
            backup: backup,
            backupCount: SimuPLCRecovery.listBackups().length,
            invalidMessage: invalidMessage,
            incompatibleMessage: incompatibleMessage
          };
        }'''),
        'actions': page.evaluate('''async () => {
          localStorage.setItem('logicsoft_circuits_v1', '[]');
          window.__actionPromptCount = 0;
          const modal = {
            prompt: async function(){ window.__actionPromptCount++; return 'Prueba acción'; },
            confirm: async function(){ return true; },
            alert: async function(){ return true; }
          };
          window.SimuPLCNativeModal = modal;
          window.SimuPLCModal = modal;
          document.getElementById('btnSave').click();
          await new Promise(function(resolve){ setTimeout(resolve, 4600); });
          const saved = JSON.parse(localStorage.getItem('logicsoft_circuits_v1') || '[]');
          return {
            diagnostics: SimuPLCActions.getDiagnostics(),
            promptCount: window.__actionPromptCount,
            savedCount: saved.length,
            editor: saved[0] && saved[0].editor
          };
        }''')
    }
    page.close()
    return results, errors


def run_ladder(browser):
    page = browser.new_page(viewport={'width': 1200, 'height': 800})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    html = LOCAL_STORAGE_MOCK + inline_assets((ROOT / 'ladder_mobile_compact.html').read_text(encoding='utf-8'))
    page.set_content(html, wait_until='load', timeout=120000)
    page.wait_for_timeout(1800)
    result = page.evaluate('''() => ({
      health: typeof SimuPLCLadderHealth === 'function' ? SimuPLCLadderHealth() : null,
      hasProject: typeof getLadderProject === 'function',
      project: typeof getLadderProject === 'function' ? getLadderProject() : null
    })''')
    page.close()
    return result, errors


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        index_results, index_errors = run_index(browser)
        ladder_results, ladder_errors = run_ladder(browser)
        browser.close()

    output = {
        'index': index_results,
        'ladder': ladder_results,
        'pageErrors': {'index': index_errors, 'ladder': ladder_errors}
    }
    print(json.dumps(output, ensure_ascii=False, indent=2))

    ok = (
        not index_errors
        and not ladder_errors
        and index_results.get('health', {}).get('ok')
        and index_results.get('storageFallback', {}).get('ok')
        and index_results.get('storageBackup')
        and index_results.get('fbdModules', {}).get('ok')
        and index_results.get('fbdWiring', {}).get('ok')
        and index_results.get('counterRegression', {}).get('ok')
        and index_results.get('schema', {}).get('type') == 'simuplc-project'
        and index_results.get('schema', {}).get('validation', {}).get('ok')
        and index_results.get('schema', {}).get('migratedType') == 'simuplc-project'
        and index_results.get('exportSchema', {}).get('type') == 'simuplc-project'
        and index_results.get('recovery', {}).get('diagnostics', {}).get('ok')
        and index_results.get('recovery', {}).get('diagnostics', {}).get('autosaveExists')
        and index_results.get('recovery', {}).get('backupCount', 0) >= 1
        and bool(index_results.get('recovery', {}).get('invalidMessage'))
        and bool(index_results.get('recovery', {}).get('incompatibleMessage'))
        and index_results.get('actions', {}).get('diagnostics', {}).get('ok')
        and index_results.get('actions', {}).get('promptCount') == 1
        and index_results.get('actions', {}).get('savedCount') == 1
        and index_results.get('actions', {}).get('editor') == 'fbd'
        and ladder_results.get('health', {}).get('ok')
        and ladder_results.get('hasProject')
    )
    raise SystemExit(0 if ok else 1)

if __name__ == '__main__':
    main()
