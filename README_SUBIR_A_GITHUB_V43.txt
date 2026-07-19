INSTALACION V43

1. Extrae el ZIP.
2. Sube TODO el contenido interior de la carpeta a la raíz del repositorio.
3. Confirma que existan:
   - index.html
   - service-worker.js
   - assets/js/hmi-global-control-v23.js
   - hardware/PRUEBA_I1_Q1_GENERADOR_V43.ino
4. En Android desinstala la PWA anterior y borra los datos/permisos del sitio.
5. Abre la web desde una pestaña normal de Chrome.
6. Abre el generador Arduino, selecciona Solo HMI y pulsa Regenerar.
7. El código nuevo debe contener estas marcas:
   SIMUPLC HMI READY CODE V23
   HMI_DEFAULT_CONTROL_MODE=1
   bool hmiExplicitStop=false
8. No cargues al Arduino un código que todavía muestre READY CODE V18.

PRUEBA AISLADA
Carga hardware/PRUEBA_I1_Q1_GENERADOR_V43.ino para validar primero I1 y Q1.
