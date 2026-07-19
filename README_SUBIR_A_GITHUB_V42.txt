SIMUPLC HMI V42

1. Sube todo el contenido de esta carpeta a la raíz del repositorio.
2. Comprueba que existan:
   assets/js/webusb-serial-v22.js
   diagnostico_usb_android_v42.html
   hardware/PRUEBA_ANDROID_DIRECTA_V42.ino
3. Carga PRUEBA_ANDROID_DIRECTA_V42.ino en el Arduino Uno.
4. En Android abre primero diagnostico_usb_android_v42.html desde Chrome.
5. Conecta por WebUSB y prueba I1=1 fijo e I1=0.
6. Revisa si el registro muestra “USB OUT confirmado”.
