SUBIR V40 A GITHUB

1. Extrae el ZIP.
2. Entra en la carpeta SimuPLC-HMI-Profesional-V40-Android-Fix.
3. Sube TODO su contenido a la raíz del repositorio y reemplaza los archivos existentes.
4. Confirma que también se subió assets/js/webusb-serial-v20.js.
5. En Android abre Chrome > Configuración > Configuración de sitios > Todos los sitios > tu dominio > Borrar y restablecer.
6. Desinstala la PWA anterior y vuelve a abrir el sitio desde Chrome.
7. Selecciona USB / OTG — Automático recomendado. En Chrome Android 148+ debe mostrar Web Serial Android, no WebUSB alternativo.
8. Para la prueba mínima carga hardware/PRUEBA_ANDROID_I1_Q1_V40.ino.

RESULTADO ESPERADO
- El registro debe mostrar flechas de salida SET y flechas de entrada STATE.
- Al tocar I1 debe aparecer I1_HMI,1 y Q1,1; al soltar, I1_HMI,0 y Q1,0.
- Los LED RX/TX pueden parpadear, pero no deben quedar bloqueados por un bucle de comandos.
