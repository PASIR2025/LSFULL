(function(global){
  'use strict';
  if(global.SimuPLCFBDWireGeometry) return;

  var stats={pathsBuilt:0,bendsAdded:0,invalidPoints:0};

  function point(value){
    if(!value || !Number.isFinite(Number(value.x)) || !Number.isFinite(Number(value.y))){
      stats.invalidPoints++;
      return null;
    }
    return {x:Number(value.x),y:Number(value.y)};
  }

  function normalizeBends(bends){
    return (Array.isArray(bends) ? bends : []).map(point).filter(Boolean);
  }

  function buildOrthogonalPath(start,end,bends){
    var s=point(start), e=point(end);
    if(!s || !e) return '';
    var middle=normalizeBends(bends);
    stats.pathsBuilt++;
    if(!middle.length){
      var midX=(s.x+e.x)/2;
      return 'M'+s.x+','+s.y+' L'+midX+','+s.y+' L'+midX+','+e.y+' L'+e.x+','+e.y;
    }
    var pts=[s].concat(middle,[e]);
    var d='M'+pts[0].x+','+pts[0].y+' ';
    for(var i=1;i<pts.length;i++){
      var prev=pts[i-1], next=pts[i];
      d+='L'+next.x+','+prev.y+' L'+next.x+','+next.y+' ';
    }
    return d.trim();
  }

  function addBend(target,value){
    if(!target) return null;
    var p=point(value);
    if(!p) return null;
    if(!Array.isArray(target.bends)) target.bends=[];
    target.bends.push(p);
    stats.bendsAdded++;
    return p;
  }

  global.SimuPLCFBDWireGeometry=Object.freeze({
    buildOrthogonalPath:buildOrthogonalPath,
    normalizeBends:normalizeBends,
    addBend:addBend,
    getDiagnostics:function(){ return {ok:true,module:'fbd-wire-geometry',stats:Object.assign({},stats)}; }
  });
})(window);
