# Protocolo SimuPLC IO v1

Mensajes terminados en salto de línea (`\n`).

## HMI hacia controlador

- `HELLO,SIMUPLC,1`
- `SET,<TAG>,<0|1>`
- `RUN,1`
- `STOP`
- `GET_STATE`
- `PING`

## Controlador hacia HMI

- `STATE,I1,1,I2,0,Q1,1`
- `RUNNING,1`
- `TAG,Q1,1`
- `PONG`
- `ERROR,<mensaje>`

También se acepta JSON:

```json
{"type":"state","inputs":{"I1":1,"I2":0},"outputs":{"Q1":1},"running":true}
```
