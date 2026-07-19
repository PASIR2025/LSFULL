SIMUPLC HMI V41.1 - SUBIDA AL REPOSITORIO

1. Conserva una copia del ZIP funcional original.
2. Sube todo el contenido de esta carpeta a la raíz del repositorio.
3. Reemplaza index.html y service-worker.js.
4. Verifica que exista assets/js/hmi-global-control-v23.js.
5. No elimines assets/js/webusb-serial-v21.js: es la comunicación funcional original y no fue modificada.
6. En celular/tablet, cierra la PWA y vuelve a abrirla. Si conserva la versión anterior, borra los datos del sitio una sola vez.

COMPROBACION DEL CODIGO GENERADO
Debe aparecer:
  SIMUPLC HMI READY CODE V23
  const bool hmiInputIsNc[...]
  HMI_DEFAULT_CONTROL_MODE=0, 1 o 2 según el modo elegido

No debe permanecer:
  SIMUPLC HMI READY CODE V18
  const uint8_t hmiInputSource[...]
