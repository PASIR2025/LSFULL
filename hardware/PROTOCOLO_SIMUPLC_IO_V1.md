# Protocolo SimuPLC HMI V42

Todos los mensajes terminan en salto de línea `\n`.

## Comandos enviados por la app

- `HELLO,SIMUPLC,1`
- `SET,<TAG>,<0|1>`
- `MODE,HMI`
- `MODE,PHYSICAL`
- `MODE,BOTH`
- `RUN,1`
- `STOP`
- `GET_STATE`
- `PING`

## Respuestas del Arduino

- `OK,SIMUPLC,READY_CODE_V42,1`
- `ACK,<TAG>,<0|1>`
- `ACK,MODE,HMI|PHYSICAL|BOTH`
- `ACK,RUN,0|1`
- `STATE,<TAG>,<0|1>,...,RUNNING,<0|1>,CONTROL_MODE,<MODO>`
- `PONG`
- `ERROR,<DESCRIPCION>`

La app V42 reintenta una vez un comando `SET` cuando no recibe `ACK` ni un `STATE` que confirme el valor.
