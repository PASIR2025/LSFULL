(function(global){
  'use strict';
  if(global.SimuPLCFBDMovement) return;

  var adapter=global.SimuPLCFBDAdapter;
  if(!adapter){ console.error('[SimuPLC FBD] Adaptador de movimiento no disponible.'); return; }
  var stats={bound:0,mouseMoves:0,touchMoves:0,completed:0};
  var positionTransformer=null;

  function transformPosition(x,y){
    var transform=positionTransformer || global.__SimuPLCFBDPositionTransformer;
    if(typeof transform!=='function') return {x:x,y:y};
    try{
      var result=transform(x,y);
      return result && Number.isFinite(result.x) && Number.isFinite(result.y) ? result : {x:x,y:y};
    }catch(_e){ return {x:x,y:y}; }
  }

  function bind(el,node){
    if(!el || !node || el.__simuplcFbdMovementBound) return false;
    el.__simuplcFbdMovementBound=true;
    stats.bound++;
    var sx=0,sy=0,ix=0,iy=0,dragging=false,raf=0,px=0,py=0;

    function applyPos(){
      raf=0;
      var point=transformPosition(px,py);
      el.style.left=point.x+'px';
      el.style.top=point.y+'px';
      try{ document.body.classList.add('dragging-node'); }catch(_e){}
      adapter.updateConnections();
    }
    function queuePos(nx,ny){
      px=nx; py=ny;
      if(!raf) raf=requestAnimationFrame(applyPos);
    }
    function begin(clientX,clientY){
      sx=clientX; sy=clientY;
      ix=parseFloat(el.style.left)||0; iy=parseFloat(el.style.top)||0;
      px=ix; py=iy;
      dragging=true;
      try{ document.body.classList.add('dragging-node'); }catch(_e){}
    }
    function finish(){
      try{ global.__libGestureActive=false; }catch(_e){}
      if(raf){ cancelAnimationFrame(raf); raf=0; }
      var point=transformPosition(px,py);
      el.style.left=point.x+'px'; el.style.top=point.y+'px';
      adapter.flushConnections();
      try{ document.body.classList.remove('dragging-node'); }catch(_e){}
      dragging=false;
      stats.completed++;
    }

    function onMouseMove(event){
      if(!dragging) return;
      queuePos(ix+(event.clientX-sx)/adapter.getScale(),iy+(event.clientY-sy)/adapter.getScale());
      stats.mouseMoves++;
    }
    function onMouseUp(){
      if(!dragging) return;
      finish();
      document.removeEventListener('mousemove',onMouseMove);
      document.removeEventListener('mouseup',onMouseUp);
    }
    el.addEventListener('mousedown',function(event){
      if(event.target && event.target.closest && event.target.closest('.node-associated-description,.fbd-free-text')) return;
      if(event.target && event.target.classList && event.target.classList.contains('terminal')) return;
      if(adapter.getSimulation() || adapter.getSelectedNode()!==node) return;
      event.preventDefault();
      begin(event.clientX,event.clientY);
      document.addEventListener('mousemove',onMouseMove);
      document.addEventListener('mouseup',onMouseUp);
    });

    function onTouchMove(event){
      if(!dragging) return;
      var touch=event.changedTouches && event.changedTouches[0];
      if(!touch) return;
      queuePos(ix+(touch.clientX-sx)/adapter.getScale(),iy+(touch.clientY-sy)/adapter.getScale());
      stats.touchMoves++;
      if(event.cancelable) event.preventDefault();
    }
    function onTouchEnd(){
      if(!dragging) return;
      finish();
      document.removeEventListener('touchmove',onTouchMove);
      document.removeEventListener('touchend',onTouchEnd);
      document.removeEventListener('touchcancel',onTouchEnd);
    }
    el.addEventListener('touchstart',function(event){
      if(event.target && event.target.closest && event.target.closest('.node-associated-description,.fbd-free-text')) return;
      if(event.target && event.target.classList && event.target.classList.contains('terminal')) return;
      if(adapter.getSimulation() || adapter.getSelectedNode()!==node) return;
      var touch=event.changedTouches && event.changedTouches[0];
      if(!touch) return;
      begin(touch.clientX,touch.clientY);
      document.addEventListener('touchmove',onTouchMove,{passive:false});
      document.addEventListener('touchend',onTouchEnd);
      document.addEventListener('touchcancel',onTouchEnd);
      event.stopPropagation();
      if(event.cancelable) event.preventDefault();
    },{passive:false});
    return true;
  }

  global.SimuPLCFBDMovement=Object.freeze({
    bind:bind,
    setPositionTransformer:function(transform){ positionTransformer=typeof transform==='function' ? transform : null; },
    getDiagnostics:function(){ return {ok:true,module:'fbd-movement-service',stats:Object.assign({},stats)}; }
  });
})(window);
