# SimuPLC HMI V21 — modo global de entradas

La V21 trabaja sobre la conexión USB/OTG de la V19. No modifica los controladores WebUSB para Android.

## Selección única

En la barra superior del HMI aparecen tres botones:

- **HMI:** todas las entradas se controlan desde la pantalla. Los pines físicos se supervisan, pero no intervienen en la lógica.
- **FÍSICO:** todas las entradas se controlan desde Arduino. Los pulsadores, selectores, emergencia y sensores del HMI funcionan como indicadores y no envían órdenes.
- **AMBOS:** conserva el comportamiento de la V19. Los contactos NO trabajan con OR y los contactos NC con AND.

La misma opción aparece en el generador Arduino. Se aplica a todas las entradas del proyecto; no se configura I1, I2, I3… individualmente.

## Reglas del modo AMBOS

- Contacto NO: `FISICO OR HMI`. Cualquiera puede activar.
- Contacto NC: `FISICO AND HMI`. Cualquiera puede abrir y detener.
- El Arduino devuelve estado físico, estado HMI y estado efectivo.

## Respuesta rápida

El código V21:

- Ejecuta un scan inmediato al recibir `SET`, `MODE`, `RUN` o `GET_STATE`.
- Envía `STATE` inmediatamente cuando cambia una entrada o salida.
- Mantiene un refresco de respaldo de 50 ms.
- Usa antirrebote físico de 20 ms.

## Modo Solo físico sin pantalla

Cuando el código fue generado con **Solo físico** como modo inicial:

- La lógica se habilita al energizar Arduino.
- La pérdida del HMI no apaga las salidas por timeout.
- La pantalla puede conectarse después únicamente para visualizar.

## Actualización

1. Reemplaza los archivos de la V19 por los de esta carpeta.
2. Borra la caché/datos de la PWA en celular o tablet.
3. Abre la aplicación actualizada.
4. Selecciona el modo global.
5. Regenera el `.ino`.
6. Comprueba que contenga `SIMUPLC HMI READY CODE V21`.
7. Carga nuevamente el código en Arduino.

La V19 grabada anteriormente no entiende el comando `MODE`; por eso se requiere regenerar y volver a cargar el programa.
