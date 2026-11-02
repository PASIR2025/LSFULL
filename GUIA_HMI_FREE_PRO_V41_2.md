# SimuPLC HMI V41.2 — Plan Free y Pro

## Activación

Esta versión utiliza la misma API de Google Apps Script y el mismo sistema de licencia que ya estaban integrados en la aplicación.

- Sin licencia válida: **HMI Free**.
- Licencia con respuesta `status: OK`: **HMI Pro**.
- Licencia vencida, inactiva o eliminada: vuelve a **HMI Free**.

No se creó una segunda API y no se modificó el método de conexión con Arduino o ESP32.

## HMI Free

La versión Free permite crear y ejecutar procesos completos básicos:

- Arranque directo.
- Inversión de giro.
- Estrella-triángulo.
- Control de bomba.
- Llenado de tanque.
- Procesos con hasta dos tanques.

### Límites de elementos

| Elemento | Límite Free |
|---|---:|
| Elementos funcionales totales | 20 |
| Pulsadores NO | 3 |
| Pulsadores NC | 2 |
| Parada de emergencia | 1 |
| Selector | 1 |
| Pilotos | 4 |
| Electroniveles | 4 |
| Motores o bombas combinados | 2 |
| Tanques | 2 |
| Válvulas | 2 |
| Textos, títulos y estados | No cuentan en el límite funcional |

### Plantillas Free

- Arranque / parada de motor.
- Tanque + cisterna + vaciado.
- Inversión de giro.
- Arranque estrella-triángulo.
- Pantalla en blanco.

## HMI Pro

La licencia Pro elimina los límites Free y desbloquea:

- Contador HMI.
- Sensor universal.
- Sensor fotoeléctrico.
- Final de carrera.
- Cilindros horizontal y vertical.
- Electroválvula 5/2.
- Banda transportadora.
- Cajas para procesos.
- Plantillas neumáticas, clasificación y conteo.
- Cantidad de elementos sin los límites del plan Free.

## Proyectos Pro abiertos en Free

El proyecto no se elimina ni se modifica automáticamente.

- Se conserva completo.
- Se abre en modo de solo lectura.
- No puede entrar en Operación mientras exceda los límites Free.
- Se puede eliminar elementos para volver a cumplir los límites Free.
- Al activar Pro, el proyecto se desbloquea inmediatamente.

## Comunicación

Los siguientes archivos se mantuvieron sin cambios respecto de la base funcional V41.1:

- `assets/js/webusb-serial-v21.js`
- `assets/js/hmi-global-control-v23.js`
- `assets/js/hmi-codegen-v18.js`

Por tanto, la comunicación USB/OTG, Web Serial, WebUSB y Wi-Fi no fue alterada.
