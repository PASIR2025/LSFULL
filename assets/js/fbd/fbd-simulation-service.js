(function(global){
  'use strict';
  if(global.SimuPLCFBDSimulation) return;

  var adapter=global.SimuPLCFBDAdapter;
  var engine=global.SimuPLCFBDSimulationEngine;
  var view=global.SimuPLCFBDSimulationView;
  if(!adapter || !engine || !view){
    console.error('[SimuPLC FBD] No se pudo iniciar el servicio de simulación.');
    return;
  }

  var stats={starts:0,stops:0,scans:0,lastStartAt:null,lastStopAt:null,lastError:null};

  function dispatch(name,detail){
    try{ global.dispatchEvent(new CustomEvent(name,{detail:detail || {}})); }catch(_error){}
  }

  function now(){ return global.performance && typeof global.performance.now==='function' ? global.performance.now() : Date.now(); }

  function scan(){
    if(!adapter.getSimulation()) return null;
    try{
      var result=engine.scan({
        nodes:adapter.getNodes(),
        connections:adapter.getConnections(),
        now:now(),
        maxIterations:6,
        readInput:function(node){ return node && node.el && node.el.classList.contains('active') ? 1 : 0; },
        isInverted:function(term){ return !!(term && term.dataset && term.dataset.not==='1'); }
      });
      view.render({
        nodes:adapter.getNodes(),
        connections:adapter.getConnections(),
        running:true,
        now:result.now,
        applySignal:adapter.applySignalStyles,
        updateConnections:adapter.updateConnections
      });
      stats.scans++;
      return result;
    }catch(error){
      stats.lastError=String(error && error.message || error);
      console.error('[SimuPLC FBD] Error durante el escaneo.',error);
      return null;
    }
  }

  function resetRuntimeBeforeStart(){
    adapter.getNodes().forEach(function(node){
      if(!node) return;
      if(node.type==='ton' || node.type==='toff'){
        node.timerStart=null;
        node.prevIn=0;
      }
      if(node.type==='cnt'){
        node.cv=0;
        node.qState=0;
        node.prevCntIn=0;
      }
      if(node.type==='toff') node.seenHigh=false;
    });

    adapter.getNodes().forEach(function(node){
      if(!node || node.type!=='input' || !node.el) return;
      try{ adapter.attachInputModeBehavior(node,true); }catch(_error){}
      var element=node.el;
      var mode=String((element.dataset && (element.dataset.inputMode || element.dataset.mode)) || '').toLowerCase();
      if(mode.indexOf('momentary-nc')>=0 || mode.indexOf('toggle-nc')>=0 || (element.dataset && element.dataset.nc==='true')){
        element.classList.add('active');
        node.value=1;
      }else if(mode.indexOf('momentary-no')>=0){
        element.classList.remove('active');
        node.value=0;
      }
    });
  }

  function start(){
    if(adapter.getSimulation()) return false;
    try{ adapter.clearSelection(); }catch(_error){}
    adapter.setSimulation(true);
    document.getElementById('simulate')?.classList.add('active');
    document.getElementById('stop')?.classList.remove('active');
    document.body.classList.add('simulating','sim-running');
    resetRuntimeBeforeStart();
    view.initialize(adapter.getNodes());
    scan();
    var timer=global.setInterval(scan,adapter.getScanInterval());
    adapter.setSimTimer(timer);
    stats.starts++;
    stats.lastStartAt=new Date().toISOString();
    dispatch('simuplc:fbd-simulation-started',{scanMs:adapter.getScanInterval()});
    return true;
  }

  function stop(options){
    options=options || {};
    var timer=adapter.getSimTimer();
    if(timer){ global.clearInterval(timer); adapter.setSimTimer(null); }
    adapter.setSimulation(false);
    document.getElementById('simulate')?.classList.remove('active');
    document.getElementById('stop')?.classList.remove('active');
    document.body.classList.remove('simulating','sim-running');
    try{ adapter.clearSelection(); }catch(_error){}
    view.reset({
      nodes:adapter.getNodes(),
      connections:adapter.getConnections(),
      applySignal:adapter.applySignalStyles,
      updateConnections:adapter.updateConnections
    });
    stats.stops++;
    stats.lastStopAt=new Date().toISOString();
    if(!options.silent) dispatch('simuplc:fbd-simulation-stopped',{});
    return true;
  }

  global.SimuPLCFBDSimulation=Object.freeze({
    start:start,
    stop:stop,
    scan:scan,
    isRunning:function(){ return adapter.getSimulation(); },
    getDiagnostics:function(){
      return {
        ok:true,
        module:'fbd-simulation-service',
        running:adapter.getSimulation(),
        scanIntervalMs:adapter.getScanInterval(),
        stats:Object.assign({},stats),
        engine:engine.getDiagnostics(),
        view:view.getDiagnostics()
      };
    }
  });
})(window);
