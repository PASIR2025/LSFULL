(function(global){
  'use strict';
  if(global.SimuPLCTextPalette) return;

  const palettes={
    text:[
      ['#263548','Gris industrial'],['#111827','Negro'],['#0066cc','Azul PLC'],['#0b3f76','Azul oscuro'],
      ['#08783d','Verde'],['#c62828','Rojo'],['#c05a00','Naranja'],['#6b3fa0','Morado'],['#ffffff','Blanco']
    ],
    background:[
      ['transparent','Sin fondo'],['#f8fafc','Gris claro'],['#ffffff','Blanco'],['#eef6ff','Azul claro'],
      ['#fff8d6','Amarillo claro'],['#eaf8ee','Verde claro'],['#fdecec','Rojo claro'],['#fff1e6','Naranja claro'],['#263548','Oscuro']
    ]
  };

  function escapeHtml(value){
    return String(value == null ? '' : value)
      .replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function normalize(value){ return String(value == null ? '' : value).toLowerCase(); }
  function markup(inputId,kind,defaultValue){
    const list=palettes[kind] || palettes.text;
    const value=defaultValue || (kind==='background' ? '#f8fafc' : '#263548');
    return '<input type="hidden" id="'+escapeHtml(inputId)+'" value="'+escapeHtml(value)+'">'
      +'<div class="simuplc-color-palette" data-palette-input="'+escapeHtml(inputId)+'" role="group">'
      +list.map(function(item){
        const val=item[0], label=item[1];
        return '<button type="button" class="simuplc-color-swatch'+(val==='transparent'?' is-transparent':'')+'" data-value="'+escapeHtml(val)+'" title="'+escapeHtml(label)+'" aria-label="'+escapeHtml(label)+'" style="background:'+escapeHtml(val)+'"></button>';
      }).join('')
      +'</div><div class="simuplc-palette-caption">Colores industriales predefinidos</div>';
  }
  function set(root,inputId,value){
    root=root || document;
    const input=(root.querySelector && root.querySelector('#'+inputId)) || document.getElementById(inputId);
    if(!input) return;
    const next=value || input.value;
    input.value=next;
    const group=(root.querySelector && root.querySelector('[data-palette-input="'+inputId+'"]')) || document.querySelector('[data-palette-input="'+inputId+'"]');
    if(!group) return;
    group.querySelectorAll('.simuplc-color-swatch').forEach(function(button){
      button.classList.toggle('is-selected',normalize(button.dataset.value)===normalize(next));
    });
  }
  function bind(root){
    root=root || document;
    root.querySelectorAll('[data-palette-input]').forEach(function(group){
      if(group.__simuplcPaletteBound) return;
      group.__simuplcPaletteBound=true;
      const id=group.getAttribute('data-palette-input');
      group.addEventListener('click',function(event){
        const button=event.target.closest && event.target.closest('.simuplc-color-swatch');
        if(!button) return;
        event.preventDefault();
        event.stopPropagation();
        set(root,id,button.dataset.value);
      });
      const input=(root.querySelector && root.querySelector('#'+id)) || document.getElementById(id);
      set(root,id,input ? input.value : '');
    });
  }

  global.SimuPLCTextPalette=Object.freeze({markup:markup,bind:bind,set:set,palettes:palettes});
})(window);
