(function(global){
  'use strict';
  if(global.SimuPLCFBDSelection) return;

  var adapter=global.SimuPLCFBDAdapter;
  if(!adapter){ console.error('[SimuPLC FBD] Adaptador de selección no disponible.'); return; }
  var stats={selectNode:0,selectConnection:0,selectTag:0,clear:0,deleted:0};

  function removeClass(target,name){
    try{ if(target && target.classList) target.classList.remove(name); }catch(_e){}
  }

  function selectNode(node){
    if(adapter.getSimulation() || !node || !node.el) return false;
    clearSelection();
    adapter.setSelectedNode(node);
    node.el.classList.add('selected');
    stats.selectNode++;
    return true;
  }

  function selectConnection(conn){
    if(adapter.getSimulation() || !conn) return false;
    clearSelection();
    adapter.setSelectedConnection(conn);
    conn.selected=true;
    if(conn.path) conn.path.classList.add('selected');
    adapter.renderConnection(conn);
    stats.selectConnection++;
    return true;
  }

  function selectTag(tag){
    if(!tag || adapter.getSelectedTag()===tag) return false;
    removeClass(adapter.getSelectedTag(),'selected');
    adapter.setSelectedTag(tag);
    tag.classList.add('selected');
    var conn=adapter.getSelectedConnection();
    if(conn){
      removeClass(conn.path,'selected');
      conn.selected=false;
      adapter.setSelectedConnection(null);
    }
    stats.selectTag++;
    return true;
  }

  function clearSelection(){
    var node=adapter.getSelectedNode();
    if(node) removeClass(node.el,'selected');
    adapter.setSelectedNode(null);

    var conn=adapter.getSelectedConnection();
    if(conn){ removeClass(conn.path,'selected'); conn.selected=false; }
    adapter.setSelectedConnection(null);

    removeClass(adapter.getSelectedTag(),'selected');
    adapter.setSelectedTag(null);
    adapter.setSelectedBranch(null);

    removeClass(adapter.getSelectedPin(),'pin-selected');
    adapter.setSelectedPin(null);
    adapter.clearPendingTerminals();
    adapter.removeGhost();
    adapter.hideWireMenu();
    adapter.clearLongPress();

    adapter.getConnections().forEach(function(item){
      (item.handles || []).forEach(function(handle){ try{ handle.remove(); }catch(_e){} });
      item.handles=[];
    });
    stats.clear++;
    return true;
  }

  function deleteSelected(){
    if(adapter.getSimulation()) return false;
    var node=adapter.getSelectedNode();
    if(node){ global.removeNode(node); stats.deleted++; return true; }

    var conn=adapter.getSelectedConnection();
    if(conn){ adapter.removeConnection(conn); stats.deleted++; return true; }

    var branch=adapter.getSelectedBranch();
    if(branch){
      var branchConn=adapter.getConnections().find(function(item){ return item.srcBranch===branch || item.dstBranch===branch; });
      if(branchConn){ adapter.removeConnection(branchConn); stats.deleted++; return true; }
    }

    var tag=adapter.getSelectedTag();
    if(tag){
      var tagConn=adapter.getConnections().find(function(item){
        return (item.srcBranch && item.srcBranch.tagEl===tag) || (item.dstBranch && item.dstBranch.tagEl===tag);
      });
      if(tagConn){ adapter.removeConnection(tagConn); stats.deleted++; return true; }
    }
    adapter.removeGhost();
    return false;
  }

  global.SimuPLCFBDSelection=Object.freeze({
    selectNode:selectNode,
    selectConnection:selectConnection,
    selectTag:selectTag,
    clearSelection:clearSelection,
    deleteSelected:deleteSelected,
    getDiagnostics:function(){
      return {ok:true,module:'fbd-selection-service',selectedNode:!!adapter.getSelectedNode(),selectedConnection:!!adapter.getSelectedConnection(),stats:Object.assign({},stats)};
    }
  });
})(window);
