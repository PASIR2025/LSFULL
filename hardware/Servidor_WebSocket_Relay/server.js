/*
  SimuPLC WebSocket Relay básico
  Requisitos: Node.js 18+ y paquete "ws".
  Uso:
    npm install
    npm start

  Este relay reenvía los mensajes entre el HMI y el ESP32/ESP8266.
  Para producción usa HTTPS/WSS, autenticación y una sala por dispositivo.
*/
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = Number(process.env.PORT || 8080);
const server = http.createServer((_, res) => {
  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('SimuPLC WebSocket Relay activo\n');
});
const wss = new WebSocketServer({ server, path: '/simuplc' });

wss.on('connection', (socket) => {
  socket.on('message', (data, isBinary) => {
    for (const client of wss.clients) {
      if (client !== socket && client.readyState === WebSocket.OPEN) {
        client.send(data, { binary: isBinary });
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`SimuPLC Relay: ws://localhost:${PORT}/simuplc`);
});
