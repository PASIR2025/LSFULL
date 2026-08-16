(function(global){
  'use strict';
  if(global.SimuPLCFBDSimulationView) return;

  var stats={renders:0,resets:0,lastRenderAt:null};

  function setTextIfChanged(element,text){
    if(!element) return;
    if(element.__lastText!==text){
      element.textContent=text;
      element.__lastText=text;
    }
  }

  function timerDisplay(node,now,running){
    var display=node.el && node.el.querySelector('.timer-display');
    if(!display && node.el){
      display=document.createElement('div');
      display.className='timer-display';
      node.el.appendChild(display);
    }
    var delay=Number.isFinite(node.delayMs) ? node.delayMs : 1000;
    var seconds=delay/1000;
    if(running && node.timerStart!=null){
      seconds=Math.max(0,delay-(now-node.timerStart))/1000;
    }
    setTextIfChanged(display,seconds.toFixed(1)+' s');
  }

  function counterDisplay(node){
    var display=node.el && node.el.querySelector('.cnt-display');
    if(!display && node.el){
      display=document.createElement('div');
      display.className='cnt-display';
      node.el.appendChild(display);
    }
    var cv=Number.isFinite(node.cv) ? node.cv : 0;
    var onValue=Number.isFinite(node.on) ? node.on : 1;
    var offValue=Number.isFinite(node.off) ? node.off : 0;
    setTextIfChanged(display,'Cnt: '+cv+'  ON:'+onValue+'  OFF:'+offValue);
  }

  function render(options){
    options=options || {};
    var nodes=Array.isArray(options.nodes) ? options.nodes : [];
    var connections=Array.isArray(options.connections) ? options.connections : [];
    var running=!!options.running;
    var now=Number.isFinite(options.now) ? options.now : Date.now();
    var applySignal=typeof options.applySignal==='function' ? options.applySignal : function(){};
    var updateConnections=typeof options.updateConnections==='function' ? options.updateConnections : function(){};

    nodes.forEach(function(node){
      if(!node || !node.el) return;
      var analogApi=global.SimuPLCFBDAnalog;
      var isAnalog=!!(analogApi && analogApi.isAnalogType && analogApi.isAnalogType(node.type));
      var isAnalogSource=!!(analogApi && analogApi.isAnalogSource && analogApi.isAnalogSource(node));
      var isAnalogSink=!!(analogApi && analogApi.isAnalogSink && analogApi.isAnalogSink(node));
      var isAnalogValue=isAnalogSource||isAnalogSink;
      var active=isAnalogValue ? Number.isFinite(Number(node.value)) : node.value===1;
      node.el.classList.toggle('has-signal',!isAnalogValue && active);
      node.el.classList.toggle('analog-running',isAnalogValue && running);
      if(node.type==='input' || node.type==='output' || node.type==='M'){
        node.el.classList.toggle('active',active);
        (Array.isArray(node.outputs)&&node.outputs.length?node.outputs:(node.output?[node.output]:[])).forEach(function(out){out.classList.toggle('signal-on',active);});
      }
      if(isAnalogSource) (Array.isArray(node.outputs)&&node.outputs.length?node.outputs:(node.output?[node.output]:[])).forEach(function(out){out.classList.toggle('signal-on',running);});
      if(node.qIndicator) node.qIndicator.classList.toggle('on',!isAnalogValue && node.value===1);
      if(node.type==='ton' || node.type==='toff') timerDisplay(node,now,running);
      if(node.type==='cnt') counterDisplay(node);
      if(isAnalog && analogApi.refreshNode) analogApi.refreshNode(node);
    });

    if(running){
      connections.forEach(function(connection){
        if(!connection || !connection.from || !connection.to) return;
        if(!document.body.contains(connection.from) || !document.body.contains(connection.to)) return;
        var source=null,sourceIndex=0;nodes.some(function(node){var outs=node?(Array.isArray(node.outputs)&&node.outputs.length?node.outputs:(node.output?[node.output]:[])):[];var ix=outs.indexOf(connection.from);if(ix>=0){source=node;sourceIndex=ix;return true;}return false;});
        var signal=source?(source.type==='split_range'?(sourceIndex===1?source.splitDrain:source.splitFill):source.value):0;
        applySignal(connection,signal);
      });
    }else{
      updateConnections();
    }

    stats.renders++;
    stats.lastRenderAt=new Date().toISOString();
    return true;
  }

  function initialize(nodes){
    (Array.isArray(nodes) ? nodes : []).forEach(function(node){
      if(node && (node.type==='ton' || node.type==='toff')) timerDisplay(node,0,false);
      if(node && node.type==='cnt') counterDisplay(node);
    });
  }

  function reset(options){
    options=options || {};
    var nodes=Array.isArray(options.nodes) ? options.nodes : [];
    var connections=Array.isArray(options.connections) ? options.connections : [];
    var applySignal=typeof options.applySignal==='function' ? options.applySignal : function(){};
    var updateConnections=typeof options.updateConnections==='function' ? options.updateConnections : function(){};

    nodes.forEach(function(node){
      if(!node) return;
      node.value=0;
      node.nextValue=0;
      node.invalid=false;
      if('q' in node) node.q=0;
      if('selected' in node) node.selected=false;
      if(node.el){
        node.el.classList.remove('has-signal','active','selected','dragging','analog-running');
      }
      if(node.qIndicator) node.qIndicator.classList.remove('on');
      (Array.isArray(node.outputs)&&node.outputs.length?node.outputs:(node.output?[node.output]:[])).forEach(function(out){out.classList.remove('signal-on');});
      (node.inputs || []).forEach(function(input){ input.classList.remove('signal-on'); });
      if(node.type==='ton' || node.type==='toff'){
        node.timerStart=null;
        node.prevIn=0;
      }
      if(node.type==='toff') node.seenHigh=false;
      if(node.type==='cnt'){
        node.cv=0;
        node.qState=0;
        node.prevCntIn=0;
      }
      if(global.SimuPLCFBDAnalog && global.SimuPLCFBDAnalog.isAnalogType && global.SimuPLCFBDAnalog.isAnalogType(node.type)){
        global.SimuPLCFBDAnalog.resetRuntime(node);
      }
    });

    try{
      document.querySelectorAll('.signal-on,.has-signal,.active-wire').forEach(function(element){
        element.classList.remove('signal-on','has-signal','active-wire');
      });
    }catch(_error){}

    connections.forEach(function(connection){ applySignal(connection,0); });
    initialize(nodes);
    updateConnections();
    stats.resets++;
    return true;
  }

  global.SimuPLCFBDSimulationView=Object.freeze({
    render:render,
    reset:reset,
    initialize:initialize,
    getDiagnostics:function(){
      return {ok:true,module:'fbd-simulation-view',stats:Object.assign({},stats)};
    }
  });
})(window);
