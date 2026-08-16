(function(global){
  'use strict';
  if(global.__simuplcPidLadderExtensionV2)return;
  global.__simuplcPidLadderExtensionV2=true;
  function ready(fn){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fn,{once:true});else fn();}
  function install(){
    var api=global.SimuPLCLadderAnalogProcessing;
    if(!api||typeof api.isPID!=='function')return;
    try{
      var previous=global.addFreePinsForElement;
      if(typeof previous==='function'&&!previous.__simuplcPidTwoPins){
        var wrapped=function(element){
          if(!element||!api.isPID(element))return previous.apply(this,arguments);
          if(typeof global.isProMode==='function'&&!global.isProMode())return;
          try{api.normalize(element);}catch(_){ }
          var dx=global.PRO&&global.PRO.componentPinDx||68;
          var scale=typeof global.px==='function'?global.px:function(v){return v;};
          var id=typeof global.proPinId==='function'?global.proPinId:function(el,side){return el.id+':'+side;};
          var add=global.addProPin;
          if(typeof add!=='function')return previous.apply(this,arguments);
          add({id:id(element,'pv'),elementId:element.id,elementType:element.type,kind:'input',side:'pv',role:'PV',signalType:'analog',valueType:'number',x:element.x-scale(dx),y:element.y-scale(16),r:scale(9)});
          add({id:id(element,'sp'),elementId:element.id,elementType:element.type,kind:'input',side:'sp',role:'SP',signalType:'analog',valueType:'number',x:element.x-scale(dx),y:element.y+scale(16),r:scale(9)});
          add({id:id(element,'out'),elementId:element.id,elementType:element.type,kind:'output',side:'out',role:'A',signalType:'analog',valueType:'number',x:element.x+scale(dx),y:element.y,r:scale(9)});
        };
        wrapped.__simuplcPidTwoPins=true;
        wrapped.__previous=previous;
        global.addFreePinsForElement=wrapped;
        try{addFreePinsForElement=wrapped;}catch(_){ }
      }
    }catch(_){ }
  }
  ready(install);
})(window);
