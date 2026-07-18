SIMUPLC HMI PROFESIONAL V33 — SUBIR A GITHUB

1. Extrae el ZIP.
2. Abre la carpeta SimuPLC-HMI-Profesional-V33-PWA.
3. Sube TODO el contenido interior a la raíz de tu repositorio.
4. Reemplaza los archivos existentes cuando GitHub lo solicite.
5. No elimines las carpetas:
   - assets
   - icons
   - hardware
   - .well-known
6. Conserva también:
   - manifest.json
   - service-worker.js
   - .nojekyll
   - CNAME, si continúas usando el mismo dominio.

DESPUÉS DE PUBLICAR
- En Android cierra completamente la PWA.
- Abre Chrome, entra a la dirección de SimuPLC y recarga una vez.
- Vuelve a abrir la PWA instalada.
- Si Android no muestra WebUSB dentro de una APK/PWA, usa el botón Abrir en Chrome desde la ventana de conexión.

PRUEBA USB
- Usa un cable OTG con transferencia de datos.
- Cierra ArduinoDroid, Serial USB Terminal y cualquier aplicación que esté usando el puerto.
- Conecta el Arduino.
- En HMI pulsa Conectar y acepta el permiso USB de Android.
