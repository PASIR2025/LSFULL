# Pruebas del bloque PID

## FBD
1. Coloca `AI1`, `CONST1`, `PID1` y `PWM1`.
2. Conecta `AI1` a `PV`, `CONST1` a `SP` y `PID1` a `PWM1`.
3. Configura `CONST1 = 60 °C`.
4. Configura PID: Kp 2, Ki 0.5, Kd 0.1, muestreo 100 ms, salida 0–100 %, modo Automático, acción Calefacción.
5. Al variar AI1, la salida PID debe aumentar cuando PV esté por debajo de SP y reducirse al acercarse a SP.

## Ladder
1. Coloca `AI1`, `CONST1`, `PID1` y `PWM1`.
2. PID debe mostrar dos entradas analógicas: `PV` y `SP`, y una salida analógica `A`.
3. Conecta `AI1 → PV`, `CONST1 → SP`, `PID1 → PWM1`.
4. Repite la prueba anterior.

## Modo manual
- Selecciona Manual y fija 35 %. La salida debe permanecer en 35 %.

## Generación MCU
- Genera para Arduino y ESP32.
- El código debe incluir estado PID, Kp/Ki/Kd, muestreo, límites y salida a PWM/AO.
