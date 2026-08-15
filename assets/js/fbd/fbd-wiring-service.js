(function(global){
  'use strict';
  if(global.SimuPLCFBDWiring) return;

  var adapter=global.SimuPLCFBDAdapter;
  var geometry=global.SimuPLCFBDWireGeometry;
  if(!adapter){ console.error('[SimuPLC FBD] Adaptador de cableado no disponible.'); return; }
  if(!geometry){ console.error('[SimuPLC FBD] Geometría de cableado no disponible.'); return; }

  var stats={
    boundPins:0,created:0,removed:0,updated:0,bendsAdded:0,convertedToLabel:0,
    rejected:{simulation:0,missingTerminal:0,sameTerminal:0,sameNode:0,direction:0,duplicate:0}
  };
  var updateEventQueued=false;

  function dispatch(name,detail){
    try{ global.dispatchEvent(new CustomEvent(name,{detail:detail || {}})); }catch(_e){}
  }

  function queueUpdatedEvent(){
    if(updateEventQueued) return;
    updateEventQueued=true;
    var schedule=global.requestAnimationFrame || function(cb){ return setTimeout(cb,0); };
    schedule(function(){
      updateEventQueued=false;
      dispatch('connections-updated',{count:adapter.getConnections().length});
    });
  }

  function terminalNode(term){
    return adapter.getNodes().find(function(node){
      return node && (((Array.isArray(node.outputs)&&node.outputs.length?node.outputs:(node.output?[node.output]:[])).indexOf(term)>=0) || (Array.isArray(node.inputs) && node.inputs.indexOf(term)>=0));
    }) || null;
  }

  function reject(reason,message){
    if(Object.prototype.hasOwnProperty.call(stats.rejected,reason)) stats.rejected[reason]++;
    return {ok:false,reason:reason,message:message};
  }

  function validate(fromTerm,toTerm){
    if(adapter.getSimulation()) return reject('simulation','No se puede modificar el cableado durante la simulación.');
    if(!fromTerm || !toTerm) return reject('missingTerminal','Falta un terminal de origen o destino.');
    if(fromTerm===toTerm) return reject('sameTerminal','Un terminal no puede conectarse consigo mismo.');

    var fromNode=terminalNode(fromTerm);
    var toNode=terminalNode(toTerm);
    if(fromNode && toNode && fromNode===toNode) return reject('sameNode','Un bloque no puede conectarse a sí mismo.');

    var fromIsOutput=!!(fromTerm.classList && fromTerm.classList.contains('output'));
    var toIsInput=!!(toTerm.classList && toTerm.classList.contains('input'));
    if(!fromIsOutput || !toIsInput) return reject('direction','La conexión debe ir de una salida hacia una entrada.');

    var duplicate=adapter.getConnections().some(function(conn){ return conn && conn.from===fromTerm && conn.to===toTerm; });
    if(duplicate) return reject('duplicate','La conexión ya existe.');

    return {ok:true,fromNode:fromNode,toNode:toNode};
  }

  function create(fromTerm,toTerm){
    var validation=validate(fromTerm,toTerm);
    if(!validation.ok) return null;
    var conn={
      from:fromTerm,to:toTerm,path:null,hit:null,bends:[],handles:[],selected:false,
      mode:'wire',srcBranch:null,dstBranch:null
    };
    adapter.getConnections().push(conn);
    adapter.legacyRenderConnection(conn);
    stats.created++;
    dispatch('connection-added',{connection:conn,count:adapter.getConnections().length});
    dispatch('simuplc:fbd-wire-created',{connection:conn});
    return conn;
  }

  function clearObjectSelection(){
    var node=adapter.getSelectedNode();
    try{ node && node.el && node.el.classList.remove('selected'); }catch(_e){}
    adapter.setSelectedNode(null);

    var conn=adapter.getSelectedConnection();
    try{ if(conn){ conn.selected=false; conn.path && conn.path.classList.remove('selected'); } }catch(_e){}
    adapter.setSelectedConnection(null);

    var tag=adapter.getSelectedTag();
    try{ tag && tag.classList && tag.classList.remove('selected'); }catch(_e){}
    adapter.setSelectedTag(null);
    adapter.setSelectedBranch(null);
  }

  function clearPinSelection(){
    var selected=adapter.getSelectedPin();
    try{ selected && selected.classList && selected.classList.remove('pin-selected'); }catch(_e){}
    adapter.setSelectedPin(null);
  }

  function cancelPending(){
    var pendingInput=adapter.getPendingInput();
    try{ pendingInput && pendingInput.classList && pendingInput.classList.remove('pin-selected'); }catch(_e){}
    clearPinSelection();
    adapter.clearPendingTerminals();
    adapter.removeGhost();
    return true;
  }

  function handleTerminal(el){
    if(adapter.getSimulation() || !el || !el.classList) return false;
    clearObjectSelection();

    var isOut=el.classList.contains('output');
    var isIn=el.classList.contains('input');
    if(!isOut && !isIn) return false;

    var previous=adapter.getSelectedPin();
    if(previous && previous!==el){
      try{ previous.classList.remove('pin-selected'); }catch(_e){}
    }
    adapter.setSelectedPin(el);
    el.classList.add('pin-selected');

    if(isOut){
      var pendingInput=adapter.getPendingInput();
      if(pendingInput && pendingInput!==el){
        global.createConnection(el,pendingInput);
        try{ pendingInput.classList.remove('pin-selected'); }catch(_e){}
        cancelPending();
        return true;
      }
      adapter.setPendingOutput(el);
      adapter.setPendingInput(null);
      adapter.showGhost(el);
      dispatch('simuplc:fbd-wire-pending',{direction:'output'});
      return true;
    }

    el.classList.add('pin-target');
    setTimeout(function(){ try{ el.classList.remove('pin-target'); }catch(_e){} },300);
    var pendingOutput=adapter.getPendingOutput();
    if(pendingOutput && pendingOutput!==el){
      global.createConnection(pendingOutput,el);
      cancelPending();
      return true;
    }

    if(adapter.getPendingInput()===el){
      cancelPending();
      return true;
    }

    adapter.setPendingInput(el);
    adapter.setPendingOutput(null);
    adapter.removeGhost();
    dispatch('simuplc:fbd-wire-pending',{direction:'input'});
    return true;
  }

  function bindTerminal(el){
    if(!el || el.__simuplcFbdWiringBound) return false;
    el.__simuplcFbdWiringBound=true;
    stats.boundPins++;
    el.addEventListener('click',function(event){
      event.stopPropagation();
      handleTerminal(el);
    });
    return true;
  }

  function bindNode(node){
    if(!node) return false;
    (Array.isArray(node.outputs)&&node.outputs.length?node.outputs:(node.output?[node.output]:[])).forEach(bindTerminal);
    (node.inputs || []).forEach(function(inp){
      bindTerminal(inp);
      if(!inp.__simuplcFbdNotBound){
        inp.__simuplcFbdNotBound=true;
        inp.addEventListener('dblclick',function(event){ event.stopPropagation(); global.toggleNotOnInput(inp); });
        var lastTap=0;
        inp.addEventListener('touchend',function(){
          var now=Date.now();
          if(now-lastTap<250) global.toggleNotOnInput(inp);
          lastTap=now;
        },{passive:true});
      }
    });
    return true;
  }

  function belongsToBranch(conn,branch){
    return !!branch && (conn.srcBranch===branch || conn.dstBranch===branch);
  }

  function remove(conn){
    if(!conn) return false;
    var srcBranch=conn.srcBranch || null;
    var dstBranch=conn.dstBranch || null;
    var srcTag=srcBranch && srcBranch.tagEl;
    var dstTag=dstBranch && dstBranch.tagEl;

    try{ conn.path && conn.path.remove(); }catch(_e){}
    try{ conn.hit && conn.hit.remove(); }catch(_e){}
    (conn.handles || []).forEach(function(handle){
      if(!handle) return;
      try{
        var parent=handle.parentNode;
        if(parent && parent.tagName && parent.tagName.toLowerCase()==='g') parent.remove();
        else handle.remove();
      }catch(_e){}
    });
    conn.handles=[];

    if(srcBranch){
      var hub=srcBranch.hub;
      try{ hub && hub.branches && hub.branches.delete(srcBranch); }catch(_e){}
      try{ srcBranch.tagEl && srcBranch.tagEl.remove(); }catch(_e){}
      try{ srcBranch.path && srcBranch.path.remove(); }catch(_e){}
      try{ srcBranch.hit && srcBranch.hit.remove(); }catch(_e){}
      conn.srcBranch=null;
      if(hub && (!hub.branches || hub.branches.size===0)){
        try{ hub.stemPath && hub.stemPath.remove(); }catch(_e){}
        try{ hub.dot && hub.dot.remove(); }catch(_e){}
        try{ hub.hit && hub.hit.remove(); }catch(_e){}
        adapter.deleteOutputHub(hub.pin);
      }
    }

    if(dstBranch){
      try{ dstBranch.tagEl && dstBranch.tagEl.remove(); }catch(_e){}
      try{ dstBranch.path && dstBranch.path.remove(); }catch(_e){}
      try{ dstBranch.hit && dstBranch.hit.remove(); }catch(_e){}
      conn.dstBranch=null;
    }

    var list=adapter.getConnections();
    var index=list.indexOf(conn);
    if(index>=0) list.splice(index,1);

    if(adapter.getSelectedConnection()===conn) adapter.setSelectedConnection(null);
    var selectedTag=adapter.getSelectedTag();
    var tagBelongs=selectedTag && (
      selectedTag===(conn.tagSrcEl || null) || selectedTag===(conn.tagDstEl || null) ||
      selectedTag===srcTag || selectedTag===dstTag
    );
    if(tagBelongs){
      try{ selectedTag.classList.remove('selected'); }catch(_e){}
      adapter.setSelectedTag(null);
    }
    var selectedBranch=adapter.getSelectedBranch();
    if(selectedBranch===srcBranch || selectedBranch===dstBranch) adapter.setSelectedBranch(null);

    cancelPending();
    stats.removed++;
    dispatch('connection-removed',{connection:conn,count:list.length});
    dispatch('simuplc:fbd-wire-removed',{connection:conn});
    return true;
  }

  function update(){
    var current=adapter.getConnections();
    var live=current.filter(function(conn){
      return conn && conn.from && conn.to && document.body.contains(conn.from) && document.body.contains(conn.to);
    });
    if(live.length!==current.length){
      adapter.replaceConnections(live);
      queueUpdatedEvent();
    }
    live.forEach(function(conn){ adapter.legacyRenderConnection(conn); });
    stats.updated++;
    return live.length;
  }

  function addBend(conn,point){
    if(!conn || adapter.getConnections().indexOf(conn)<0) return null;
    var bend=geometry.addBend(conn,point);
    if(!bend) return null;
    adapter.legacyRenderConnection(conn);
    stats.bendsAdded++;
    dispatch('simuplc:fbd-wire-bend-added',{connection:conn,bend:bend});
    return bend;
  }

  function convertToLabel(conn){
    if(!conn || adapter.getConnections().indexOf(conn)<0) return false;
    if(conn.mode==='label') return true;
    adapter.legacyConvertWireToLabel(conn);
    stats.convertedToLabel++;
    dispatch('connections-updated',{count:adapter.getConnections().length});
    dispatch('simuplc:fbd-wire-label-created',{connection:conn});
    return true;
  }

  global.SimuPLCFBDWiring=Object.freeze({
    bindNode:bindNode,
    handleTerminal:handleTerminal,
    validate:validate,
    create:create,
    remove:remove,
    update:update,
    addBend:addBend,
    convertToLabel:convertToLabel,
    cancelPending:cancelPending,
    list:function(){ return adapter.getConnections().slice(); },
    getDiagnostics:function(){
      return {
        ok:true,module:'fbd-wiring-service',connectionCount:adapter.getConnections().length,
        pendingOutput:!!adapter.getPendingOutput(),pendingInput:!!adapter.getPendingInput(),
        stats:JSON.parse(JSON.stringify(stats)),geometry:geometry.getDiagnostics()
      };
    }
  });

  try{ adapter.getNodes().forEach(bindNode); }catch(_e){}
})(window);
