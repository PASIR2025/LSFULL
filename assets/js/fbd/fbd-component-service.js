(function(global){
  'use strict';
  if(global.SimuPLCFBDComponents) return;

  var adapter=global.SimuPLCFBDAdapter;
  if(!adapter){ console.error('[SimuPLC FBD] Adaptador de componentes no disponible.'); return; }
  var stats={created:0,removed:0,blockedDuplicateGesture:0};

  function dispatch(name,detail){
    try{ global.dispatchEvent(new CustomEvent(name,{detail:detail || {}})); }catch(_e){}
  }

  function create(type,x,y){
    try{
      if(global.__libGestureActive){
        if(global.__libGestureCreated){ stats.blockedDuplicateGesture++; return; }
        global.__libGestureCreated=true;
      }
    }catch(_e){}
    var before=adapter.getNodes().length;
    var result=adapter.legacyCreateNode(type,x,y);
    var list=adapter.getNodes();
    var node=list.length>before ? list[list.length-1] : null;
    if(node){
      stats.created++;
      dispatch('simuplc:fbd-component-created',{id:node.id,type:node.type});
    }
    return result;
  }

  function remove(node){
    if(adapter.getSimulation() || !node || !node.el) return false;
    var selectedPin=adapter.getSelectedPin();
    var outputs=(Array.isArray(node.outputs)&&node.outputs.length?node.outputs:(node.output?[node.output]:[]));
    if(selectedPin && (outputs.includes(selectedPin) || (node.inputs || []).includes(selectedPin))){
      try{ selectedPin.classList.remove('pin-selected'); }catch(_e){}
      adapter.setSelectedPin(null);
      adapter.setPendingOutput(null);
      adapter.removeGhost();
    }

    adapter.getConnections().filter(function(conn){
      return outputs.includes(conn.from) || (node.inputs || []).includes(conn.to);
    }).forEach(adapter.removeConnection);

    outputs.forEach(function(outputTerm){
      var hub=adapter.getOutputHub(outputTerm);
      if(hub){
        Array.from(hub.branches || []).forEach(function(branch){
          try{ branch.tagEl && branch.tagEl.remove(); }catch(_e){}
          try{ branch.path && branch.path.remove(); }catch(_e){}
          try{ branch.hit && branch.hit.remove(); }catch(_e){}
        });
        try{ hub.stemPath && hub.stemPath.remove(); }catch(_e){}
        try{ hub.dot && hub.dot.remove(); }catch(_e){}
        try{ hub.hit && hub.hit.remove(); }catch(_e){}
        adapter.deleteOutputHub(outputTerm);
      }
    });

    node.el.remove();
    adapter.removeNodeFromCollection(node);
    global.clearSelection();
    adapter.updateConnections();
    stats.removed++;
    dispatch('simuplc:fbd-component-removed',{id:node.id,type:node.type});
    return true;
  }

  global.SimuPLCFBDComponents=Object.freeze({
    create:create,
    remove:remove,
    getById:function(id){ return adapter.getNodes().find(function(node){ return node.id===id; }) || null; },
    list:function(){ return adapter.getNodes().slice(); },
    getDiagnostics:function(){
      return {ok:true,module:'fbd-component-service',nodeCount:adapter.getNodes().length,stats:Object.assign({},stats)};
    }
  });
})(window);
