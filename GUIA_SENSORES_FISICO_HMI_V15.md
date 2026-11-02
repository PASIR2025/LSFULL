# SimuPLC HMI V15 — Sensores físicos y virtuales trabajando juntos

## Configuración recomendada

Ejemplo de llenado de tanque:

- `I1`: STOP NC — **Ambos obligatorios: Físico Y HMI**.
- `I2`: START — **Ambos: Físico O HMI**.
- `I3`: electronivel alto — **Ambos: Físico O HMI**.
- `Q1`: motor o bomba.

En el editor HMI:

- START se enlaza a `I2`.
- La bomba y el motor se enlazan a `Q1`.
- El tanque utiliza `Q1` como salida de llenado.
- El electronivel alto del tanque se enlaza a `I3`.

## Comportamiento

1. START envía `I2_HMI=1`.
2. Arduino ejecuta el circuito y activa `Q1`.
3. `Q1` activa la salida física y también anima motor/bomba en el HMI.
4. El tanque virtual se llena porque su salida de llenado es `Q1`.
5. Si el agua virtual llega al sensor, el HMI envía `I3_HMI=1`.
6. Si el electronivel físico se activa antes, Arduino establece `I3_PHYSICAL=1`.
7. En ambos casos la entrada efectiva queda `I3=1`, el circuito apaga `Q1`, el motor real se detiene y el HMI también se detiene.

El protocolo V15 informa por separado:

```text
STATE,I3,1,I3_PHYSICAL,1,I3_HMI,0,Q1,0,RUNNING,1
```

El sensor del HMI se ilumina según `I3` efectivo y muestra si fue activado por `FÍSICO`, `HMI` o `FÍSICO + HMI`, aunque el nivel gráfico todavía no alcance el sensor.
