(function(global){
  'use strict';
  if(global.__simuplcPidFbdExtensionV2)return;
  global.__simuplcPidFbdExtensionV2=true;
  function init(){
    document.querySelectorAll('.component[data-type="pid"]').forEach(function(el){
      el.classList.add('lib-analog');
      el.setAttribute('title','Controlador PID: entradas PV y SP, salida analógica A');
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);
