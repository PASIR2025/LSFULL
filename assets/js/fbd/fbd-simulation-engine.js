(function(global){
  'use strict';
  if(global.SimuPLCFBDSimulationEngine) return;

  var stats={scans:0,logicPasses:0,counterUpdates:0,analogUpdates:0,lastDurationMs:0,lastScanAt:null};

  function bit(value){ return value ? 1 : 0; }
  function numeric(value,fallback){ value=Number(value); return Number.isFinite(value)?value:(fallback||0); }
  function clampInt(value,min,max){
    value=parseInt(value,10);
    if(Number.isNaN(value)) value=0;
    return Math.max(min,Math.min(max,value));
  }
  function analogApi(){ return global.SimuPLCFBDAnalog || null; }
  function isAnalogType(node){
    var api=analogApi();
    return !!(node && api && api.isAnalogType && api.isAnalogType(node.type));
  }
  function isAnalogSource(node){
    var api=analogApi();
    return !!(node && api && api.isAnalogSource && api.isAnalogSource(node));
  }
  function isAnalogSink(node){
    var api=analogApi();
    return !!(node && api && api.isAnalogSink && api.isAnalogSink(node));
  }
  function isComparator(node){
    var api=analogApi();
    return !!(node && api && api.isComparator && api.isComparator(node));
  }

  function evaluateGate(type,inputs){
    if(!inputs.length) return 0;
    var bits=inputs.map(bit);
    var sum=bits.reduce(function(total,value){ return total + value; },0);
    var all=bits.every(Boolean);
    var any=bits.some(Boolean);
    switch(String(type || '').toLowerCase()){
      case 'and': return all ? 1 : 0;
      case 'or': return any ? 1 : 0;
      case 'nand': return all ? 0 : 1;
      case 'nor': return any ? 0 : 1;
      case 'xor': return sum % 2 === 1 ? 1 : 0;
      case 'xnor': return sum % 2 === 0 ? 1 : 0;
      case 'not': return bits[0] ? 0 : 1;
      default: return any ? 1 : 0;
    }
  }

  function scan(options){
    options=options || {};
    var started=(global.performance && typeof global.performance.now==='function') ? global.performance.now() : Date.now();
    var nodes=Array.isArray(options.nodes) ? options.nodes : [];
    var connections=Array.isArray(options.connections) ? options.connections : [];
    var now=Number.isFinite(options.now) ? options.now : started;
    var maxIterations=Number.isFinite(options.maxIterations) ? Math.max(1,options.maxIterations) : 6;
    var readInput=typeof options.readInput==='function' ? options.readInput : function(node){
      return node && node.el && node.el.classList.contains('active') ? 1 : 0;
    };
    var isInverted=typeof options.isInverted==='function' ? options.isInverted : function(term){
      return !!(term && term.dataset && term.dataset.not==='1');
    };
    var analog=analogApi();

    var sourceByOutput=new Map();
    var connectionByInput=new Map();
    nodes.forEach(function(node){ if(!node)return;(Array.isArray(node.outputs)&&node.outputs.length?node.outputs:(node.output?[node.output]:[])).forEach(function(term,index){sourceByOutput.set(term,{node:node,index:index});}); });
    connections.forEach(function(connection){
      if(connection && connection.to && !connectionByInput.has(connection.to)) connectionByInput.set(connection.to,connection);
    });

    nodes.forEach(function(node){
      if(!node) return;
      if(node.type==='input') node.value=bit(readInput(node));
      else if(node.type==='analog_constant' && analog && analog.constantValue) node.value=numeric(analog.constantValue(node),0);
      else if(node.type==='analog_input' && analog && analog.analogInputValue) node.value=numeric(analog.analogInputValue(node),0);
      node.invalid=false;
    });

    var values=new Map();
    nodes.forEach(function(node){ values.set(node,(isAnalogSource(node)||isAnalogSink(node))?numeric(node && node.value,0):bit(node && node.value)); });

    function sourceValueForTerm(term){
      var connection=connectionByInput.get(term);
      if(!connection) return 0;
      var sourceRef=sourceByOutput.get(connection.from);
      var source=sourceRef&&sourceRef.node;
      var value=0;
      if(source){
        if(source.type==='split_range') value=numeric(sourceRef.index===1?source.splitDrain:source.splitFill,0);
        else value=numeric(values.get(source),0);
      }
      if(isInverted(term)) value=bit(value) ? 0 : 1;
      return value;
    }
    function inputsAlignedNumeric(node){
      var inputs=Array.isArray(node && node.inputs) ? node.inputs : [];
      return inputs.map(sourceValueForTerm);
    }
    function inputsConnectedNumeric(node){
      var inputs=Array.isArray(node && node.inputs) ? node.inputs : [];
      var result=[];
      inputs.forEach(function(term){ if(connectionByInput.has(term)) result.push(sourceValueForTerm(term)); });
      return result;
    }
    function inputsAlignedDigital(node){ return inputsAlignedNumeric(node).map(bit); }
    function inputsConnectedDigital(node){ return inputsConnectedNumeric(node).map(bit); }

    function evaluateNode(node){
      var alignedNumeric=inputsAlignedNumeric(node);
      var aligned=alignedNumeric.map(bit);
      var input0=aligned[0] || 0;
      var current=values.get(node);

      if(node.type==='analog_constant'){
        return analog && analog.constantValue ? analog.constantValue(node) : numeric(node.constantValue,0);
      }
      if(node.type==='analog_input'){
        return analog && analog.analogInputValue ? analog.analogInputValue(node) : numeric(node.analogValue,0);
      }
      if(node.type==='pid'){node.pidPV=numeric(alignedNumeric[0],0);node.pidSP=numeric(alignedNumeric[1],0);return analog&&analog.evaluatePID?analog.evaluatePID(node,node.pidPV,node.pidSP,now):0;}
      if(node.type==='split_range'){
        node.lastAnalogInput=numeric(alignedNumeric[0],node.neutral||50);
        var split=analog&&analog.splitRangeValue?analog.splitRangeValue(node,node.lastAnalogInput):{input:node.lastAnalogInput,fill:0,drain:0};
        node.splitFill=numeric(split.fill,0);node.splitDrain=numeric(split.drain,0);
        return numeric(split.input,node.lastAnalogInput);
      }
      if(node.type==='scale'){
        node.lastAnalogInput=numeric(alignedNumeric[0],0);
        return analog && analog.scaleValue ? analog.scaleValue(node,node.lastAnalogInput) : node.lastAnalogInput;
      }
      if(isAnalogSink(node)){
        node.lastAnalogInput=numeric(alignedNumeric[0],0);
        return analog && analog.evaluateOutput ? analog.evaluateOutput(node,node.lastAnalogInput) : node.lastAnalogInput;
      }
      if(isComparator(node)){
        node.lastAnalogInput=numeric(alignedNumeric[0],0);
        return analog && analog.compare ? analog.compare(node,node.lastAnalogInput) : 0;
      }

      if(node.type==='output' || node.type==='M') return input0;

      if(node.type==='sr'){
        var set=aligned[0] ? 1 : 0;
        var reset=aligned[1] ? 1 : 0;
        var q=bit(values.get(node) || node.q);
        if(set===1 && reset===0) return 1;
        if(set===0 && reset===1) return 0;
        return q;
      }

      if(node.type==='ton'){
        var tonDelay=Number.isFinite(node.delayMs) ? node.delayMs : 1000;
        if(input0===1){
          if(node.timerStart==null) node.timerStart=now;
          return now-node.timerStart>=tonDelay ? 1 : 0;
        }
        node.timerStart=null;
        return 0;
      }

      if(node.type==='toff'){
        var toffDelay=Number.isFinite(node.delayMs) ? node.delayMs : 1000;
        if(input0===1){
          node.seenHigh=true;
          node.timerStart=null;
          return 1;
        }
        if(!node.seenHigh){
          node.timerStart=null;
          return 0;
        }
        if(node.timerStart==null) node.timerStart=now;
        return now-node.timerStart>=toffDelay ? 0 : 1;
      }

      var gateInputs=inputsConnectedDigital(node);
      return gateInputs.length ? evaluateGate(node.type,gateInputs) : current && node.type==='input' ? bit(current) : 0;
    }

    function normalizedNodeValue(node,value){
      if(isAnalogSource(node)||isAnalogSink(node)||node.type==='pid'||node.type==='split_range') return numeric(value,0);
      return bit(value);
    }
    function valuesDiffer(node,a,b){
      if(isAnalogSource(node)||isAnalogSink(node)||node.type==='pid'||node.type==='split_range') return Math.abs(numeric(a,0)-numeric(b,0))>1e-9;
      return bit(a)!==bit(b);
    }

    function propagate(){
      var total=0;
      for(var iteration=0;iteration<maxIterations;iteration++){
        var changed=false;
        nodes.forEach(function(node){
          if(!node || node.type==='input' || node.type==='analog_input' || node.type==='analog_constant' || node.type==='cnt') return;
          var next=normalizedNodeValue(node,evaluateNode(node));
          if(valuesDiffer(node,next,values.get(node))){
            values.set(node,next);
            changed=true;
          }
        });
        total++;
        if(!changed) break;
      }
      return total;
    }

    var passes=propagate();
    var counterCount=0;
    var analogCount=nodes.filter(function(node){return isAnalogType(node);}).length;
    var counterMax=999999;

    nodes.forEach(function(node){
      if(!node || node.type!=='cnt') return;
      counterCount++;
      var aligned=inputsAlignedDigital(node);
      var reset=aligned[0] ? 1 : 0;
      var count=aligned[1] ? 1 : 0;
      var direction=aligned[2] ? 1 : 0;

      if(!Number.isFinite(node.cv)) node.cv=0;
      if(!Number.isFinite(node.on)) node.on=1;
      if(!Number.isFinite(node.off)) node.off=0;
      if(!Number.isFinite(node.qState)) node.qState=0;
      if(!Number.isFinite(node.prevCntIn)) node.prevCntIn=0;

      if(reset===1){
        node.cv=0;
        node.qState=0;
        node.prevCntIn=count;
      }else{
        var rising=node.prevCntIn===0 && count===1;
        if(rising){ node.cv=direction===1 ? Math.max(0,node.cv-1) : Math.min(counterMax,node.cv+1); }
        node.prevCntIn=count;
        var onValue=clampInt(node.on,0,counterMax);
        var offValue=clampInt(node.off,0,counterMax);
        node.on=onValue;
        node.off=offValue;
        if(onValue<offValue){ node.qState=node.cv>=onValue && node.cv<offValue ? 1 : 0; }
        else{
          if(node.cv>=onValue) node.qState=1;
          else if(node.cv<offValue) node.qState=0;
        }
      }
      values.set(node,node.qState ? 1 : 0);
    });

    if(counterCount) passes+=propagate();

    nodes.forEach(function(node){
      if(!node) return;
      node.nextValue=normalizedNodeValue(node,values.get(node));
      node.value=node.nextValue;
      if(node.type==='sr') node.q=bit(node.nextValue);
    });

    var ended=(global.performance && typeof global.performance.now==='function') ? global.performance.now() : Date.now();
    stats.scans++;
    stats.logicPasses+=passes;
    stats.counterUpdates+=counterCount;
    stats.analogUpdates+=analogCount;
    stats.lastDurationMs=Math.max(0,ended-started);
    stats.lastScanAt=new Date().toISOString();

    return {
      ok:true,now:now,values:values,passes:passes,counterCount:counterCount,analogCount:analogCount,
      nodeCount:nodes.length,connectionCount:connections.length,durationMs:stats.lastDurationMs
    };
  }

  global.SimuPLCFBDSimulationEngine=Object.freeze({
    scan:scan,evaluateGate:evaluateGate,
    getDiagnostics:function(){ return {ok:true,module:'fbd-simulation-engine',stats:Object.assign({},stats)}; }
  });
})(window);
