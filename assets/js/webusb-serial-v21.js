/*
 * SimuPLC WebUSB Serial V21
 * Puerto serial USB para Android mediante WebUSB.
 * Controladores incluidos: USB CDC-ACM, CH340/CH341, CP210x y FTDI.
 * Mantiene una interfaz compatible con SerialPort: open(), close(), readable,
 * writable, getInfo() y setSignals().
 */
(function (global) {
  'use strict';

  const EMPTY = new Uint8Array(0);
  const USB_CLASS_CDC_CONTROL = 0x02;
  const USB_CLASS_CDC_DATA = 0x0A;
  const USB_CLASS_VENDOR = 0xFF;

  const CHIP_FILTERS = [
    // Arduino oficiales y compatibles CDC.
    { vendorId: 0x2341 },
    { vendorId: 0x2A03 },
    { vendorId: 0x239A },
    { vendorId: 0x1B4F },
    { vendorId: 0x303A },
    { vendorId: 0x2E8A },
    { vendorId: 0x0483 },
    // WCH CH340/CH341/CH343/CH9102.
    { vendorId: 0x1A86, productId: 0x7523 },
    { vendorId: 0x1A86, productId: 0x5523 },
    { vendorId: 0x1A86, productId: 0x55D3 },
    { vendorId: 0x1A86, productId: 0x55D4 },
    { vendorId: 0x1A86, productId: 0x55D5 },
    { vendorId: 0x1A86, productId: 0x55D6 },
    { vendorId: 0x1A86 },
    // Silicon Labs CP210x.
    { vendorId: 0x10C4, productId: 0xEA60 },
    { vendorId: 0x10C4, productId: 0xEA70 },
    { vendorId: 0x10C4, productId: 0xEA71 },
    { vendorId: 0x10C4 },
    // FTDI.
    { vendorId: 0x0403, productId: 0x6001 },
    { vendorId: 0x0403, productId: 0x6010 },
    { vendorId: 0x0403, productId: 0x6011 },
    { vendorId: 0x0403, productId: 0x6014 },
    { vendorId: 0x0403, productId: 0x6015 },
    { vendorId: 0x0403 },
    // Dispositivos CDC genéricos.
    { classCode: USB_CLASS_CDC_CONTROL }
  ];

  const CH340_BAUD = Object.freeze({
    600:    { factor: 0x6481, divisor: 0x0076 },
    1200:   { factor: 0xB281, divisor: 0x003B },
    2400:   { factor: 0xD981, divisor: 0x001E },
    4800:   { factor: 0x6482, divisor: 0x000F },
    9600:   { factor: 0xB282, divisor: 0x0008 },
    14400:  { factor: 0xD980, divisor: 0x00EB },
    19200:  { factor: 0xD982, divisor: 0x0007 },
    38400:  { factor: 0x6483, divisor: 0x0000 },
    57600:  { factor: 0x9883, divisor: 0x0000 },
    115200: { factor: 0xCC83, divisor: 0x0000 },
    230400: { factor: 0xE683, divisor: 0x0000 }
  });

  function asError(value) {
    return value instanceof Error ? value : new Error(String(value || 'Error USB desconocido.'));
  }

  function hex(value, width) {
    return '0x' + Number(value || 0).toString(16).toUpperCase().padStart(width || 4, '0');
  }

  function alternatesOf(iface) {
    if (!iface) return [];
    if (Array.isArray(iface.alternates)) return iface.alternates;
    return iface.alternate ? [iface.alternate] : [];
  }

  function findInterfaceByClass(configuration, classCode) {
    const interfaces = configuration && Array.isArray(configuration.interfaces)
      ? configuration.interfaces : [];
    for (const iface of interfaces) {
      for (const alternate of alternatesOf(iface)) {
        if (alternate && alternate.interfaceClass === classCode) {
          return { iface, alternate };
        }
      }
    }
    return null;
  }

  function findBulkInterface(configuration) {
    const interfaces = configuration && Array.isArray(configuration.interfaces)
      ? configuration.interfaces : [];
    for (const iface of interfaces) {
      for (const alternate of alternatesOf(iface)) {
        const endpoints = alternate && Array.isArray(alternate.endpoints)
          ? alternate.endpoints : [];
        const input = endpoints.find((endpoint) => endpoint.direction === 'in' && endpoint.type === 'bulk');
        const output = endpoints.find((endpoint) => endpoint.direction === 'out' && endpoint.type === 'bulk');
        if (input && output) return { iface, alternate, input, output };
      }
    }
    throw new Error('La placa no expone canales USB de entrada y salida compatibles.');
  }

  function findEndpoint(alternate, direction) {
    const endpoints = alternate && Array.isArray(alternate.endpoints) ? alternate.endpoints : [];
    const endpoint = endpoints.find((item) => item.direction === direction && (!item.type || item.type === 'bulk'));
    if (!endpoint) throw new Error('No se encontró el canal USB de ' + (direction === 'in' ? 'entrada' : 'salida') + '.');
    return endpoint;
  }

  async function ensureOk(result, description) {
    if (!result || result.status !== 'ok') {
      throw new Error(description + ': ' + (result && result.status ? result.status : 'sin respuesta'));
    }
    return result;
  }

  function uint32LE(value) {
    const buffer = new ArrayBuffer(4);
    new DataView(buffer).setUint32(0, Number(value) >>> 0, true);
    return buffer;
  }

  class WebUsbSerialPort {
    constructor(device) {
      this.device = device;
      this.driver = detectDriver(device);
      this.interfaceNumber = 0;
      this.inEndpoint = null;
      this.outEndpoint = null;
      this.packetSize = 64;
      this.options = null;
      this.readable = null;
      this.writable = null;
      this.opened = false;
      this._claimed = [];
      this._closing = false;
      this._signals = { dataTerminalReady: false, requestToSend: false, break: false };
    }

    getInfo() {
      return {
        usbVendorId: this.device.vendorId,
        usbProductId: this.device.productId,
        driver: this.driver,
        chip: this.driver,
        productName: this.device.productName || '',
        manufacturerName: this.device.manufacturerName || ''
      };
    }

    async open(options) {
      if (this.opened) throw new DOMException('El puerto ya está abierto.', 'InvalidStateError');
      this.options = Object.assign({
        baudRate: 115200,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        flowControl: 'none',
        bufferSize: 128
      }, options || {});
      if (!Number.isFinite(Number(this.options.baudRate)) || Number(this.options.baudRate) <= 0) {
        throw new RangeError('Velocidad USB inválida.');
      }

      try {
        this._closing = false;
        // Las interfaces dejan de estar reclamadas después de cerrar/reabrir el dispositivo.
        // Reiniciar esta lista evita que el segundo intento de velocidad quede conectado sin RX/TX real.
        this._claimed = [];
        await this.device.open();
        if (!this.device.configuration) {
          const first = this.device.configurations && this.device.configurations[0];
          await this.device.selectConfiguration(first ? first.configurationValue : 1);
        }
        await this._configureDriver();
        this._createStreams();
        this.opened = true;
      } catch (error) {
        try { if (this.device.opened) await this.device.close(); } catch (_) {}
        const cause = asError(error);
        throw new Error(
          'No se pudo abrir ' + this.deviceLabel() + ' mediante WebUSB (' + this.driver + '): ' + cause.message
        );
      }
    }

    deviceLabel() {
      const product = this.device.productName || 'dispositivo USB';
      return product + ' [' + hex(this.device.vendorId) + ':' + hex(this.device.productId) + ']';
    }

    async _claim(interfaceNumber, alternateSetting) {
      const configuration = this.device.configuration;
      const iface = configuration && Array.isArray(configuration.interfaces)
        ? configuration.interfaces.find((item) => item.interfaceNumber === interfaceNumber) : null;
      if (!iface || !iface.claimed) {
        await this.device.claimInterface(interfaceNumber);
      }
      if (!this._claimed.includes(interfaceNumber)) this._claimed.push(interfaceNumber);
      if (alternateSetting != null && typeof this.device.selectAlternateInterface === 'function') {
        const activeAlt = iface && iface.alternate ? iface.alternate.alternateSetting : null;
        if (Number(activeAlt) !== Number(alternateSetting)) {
          await this.device.selectAlternateInterface(interfaceNumber, alternateSetting);
        }
      }
    }

    _useEndpoints(info) {
      this.interfaceNumber = info.iface.interfaceNumber;
      this.inEndpoint = info.input || findEndpoint(info.alternate, 'in');
      this.outEndpoint = info.output || findEndpoint(info.alternate, 'out');
      this.packetSize = Math.max(8, Number(this.inEndpoint.packetSize) || 64);
    }

    async _configureDriver() {
      if (this.driver === 'CH340/CH341') return this._openCh340();
      if (this.driver === 'CP210x') return this._openCp210x();
      if (this.driver === 'FTDI') return this._openFtdi();
      return this._openCdc();
    }

    async _openCdc() {
      const control = findInterfaceByClass(this.device.configuration, USB_CLASS_CDC_CONTROL);
      const data = findInterfaceByClass(this.device.configuration, USB_CLASS_CDC_DATA);
      if (!control || !data) {
        throw new Error('No se encontraron las interfaces USB CDC-ACM de control y datos.');
      }
      await this._claim(control.iface.interfaceNumber, control.alternate.alternateSetting);
      await this._claim(data.iface.interfaceNumber, data.alternate.alternateSetting);
      this.controlInterfaceNumber = control.iface.interfaceNumber;
      this._useEndpoints({ iface: data.iface, alternate: data.alternate });
      await this._cdcSetLineCoding();
      await this.setSignals({ dataTerminalReady: true, requestToSend: false });
    }

    async _cdcSetLineCoding() {
      const data = new ArrayBuffer(7);
      const view = new DataView(data);
      view.setUint32(0, Number(this.options.baudRate), true);
      view.setUint8(4, Number(this.options.stopBits) === 2 ? 2 : 0);
      view.setUint8(5, this.options.parity === 'odd' ? 1 : this.options.parity === 'even' ? 2 : 0);
      view.setUint8(6, Number(this.options.dataBits) || 8);
      const result = await this.device.controlTransferOut({
        requestType: 'class', recipient: 'interface', request: 0x20,
        value: 0, index: this.controlInterfaceNumber
      }, data);
      await ensureOk(result, 'No se pudo configurar USB CDC');
    }

    async _openCh340() {
      const io = findBulkInterface(this.device.configuration);
      await this._claim(io.iface.interfaceNumber, io.alternate.alternateSetting);
      this._useEndpoints(io);

      await this._chOut(0xA1, 0xC29C, 0xB2B9);
      await this._chOut(0xA4, 0x00DF, 0x0000);
      await this._chOut(0xA4, 0x009F, 0x0000);
      await this._chIn(0x95, 0x0706, 0x0000, 2);
      await this._chOut(0x9A, 0x2727, 0x0000);
      await this._chOut(0x9A, 0x1312, 0xB282);
      await this._chOut(0x9A, 0x0F2C, 0x0008);
      await this._chOut(0x9A, 0x2518, 0x00C3);
      await this._chIn(0x95, 0x0706, 0x0000, 2);
      await this._chOut(0x9A, 0x2727, 0x0000);
      await this._chSetBaud(Number(this.options.baudRate));
      await this.setSignals({ dataTerminalReady: true, requestToSend: false });
    }

    async _chOut(request, value, index) {
      const result = await this.device.controlTransferOut({
        requestType: 'vendor', recipient: 'device', request, value, index
      }, EMPTY);
      return ensureOk(result, 'Error de configuración CH340');
    }

    async _chIn(request, value, index, length) {
      const result = await this.device.controlTransferIn({
        requestType: 'vendor', recipient: 'device', request, value, index
      }, length);
      return ensureOk(result, 'Error de lectura CH340');
    }

    async _chSetBaud(baudRate) {
      const entry = CH340_BAUD[baudRate];
      if (!entry) throw new Error('CH340 no admite la velocidad ' + baudRate + ' en esta versión.');
      await this._chOut(0x9A, 0x1312, entry.factor);
      await this._chOut(0x9A, 0x0F2C, entry.divisor);
      await this._chOut(0x9A, 0x2727, 0x0000);
    }

    async _openCp210x() {
      const io = findBulkInterface(this.device.configuration);
      await this._claim(io.iface.interfaceNumber, io.alternate.alternateSetting);
      this._useEndpoints(io);
      const index = this.interfaceNumber;
      await this._cpOut(0x00, 0x0001, index); // UART enable.
      await this._cpOut(0x03, 0x0800, index); // 8N1.
      await this._cpOut(0x1E, 0x0000, index, uint32LE(this.options.baudRate));
      await this._cpOut(0x07, 0x0303, index); // DTR y RTS activos.
      await this._cpOut(0x12, 0x000F, index); // Purga RX/TX.
      this._signals.dataTerminalReady = true;
      this._signals.requestToSend = true;
    }

    async _cpOut(request, value, index, data) {
      const result = await this.device.controlTransferOut({
        requestType: 'vendor', recipient: 'interface', request, value, index
      }, data || EMPTY);
      return ensureOk(result, 'Error de configuración CP210x');
    }

    async _openFtdi() {
      const io = findBulkInterface(this.device.configuration);
      await this._claim(io.iface.interfaceNumber, io.alternate.alternateSetting);
      this._useEndpoints(io);
      this.ftdiPortIndex = this.interfaceNumber + 1;
      await this._ftdiOut(0x00, 0x0000, this.ftdiPortIndex); // Reset.
      await this._ftdiSetBaud(Number(this.options.baudRate));
      await this._ftdiOut(0x04, 0x0008, this.ftdiPortIndex); // 8N1.
      await this._ftdiOut(0x02, 0x0000, this.ftdiPortIndex); // Sin flow control.
      await this._ftdiOut(0x01, 0x0303, this.ftdiPortIndex); // DTR/RTS activos.
      this._signals.dataTerminalReady = true;
      this._signals.requestToSend = true;
    }

    async _ftdiOut(request, value, index) {
      const result = await this.device.controlTransferOut({
        requestType: 'vendor', recipient: 'device', request, value, index
      }, EMPTY);
      return ensureOk(result, 'Error de configuración FTDI');
    }

    async _ftdiSetBaud(baudRate) {
      const encoded = encodeFtdiBaud(baudRate, this.ftdiPortIndex);
      await this._ftdiOut(0x03, encoded.value, encoded.index);
    }

    _transformIncoming(bytes) {
      if (this.driver !== 'FTDI') return bytes;
      const packet = Math.max(8, this.packetSize);
      const output = [];
      for (let offset = 0; offset < bytes.length; offset += packet) {
        const end = Math.min(bytes.length, offset + packet);
        for (let i = Math.min(offset + 2, end); i < end; i += 1) output.push(bytes[i]);
      }
      return new Uint8Array(output);
    }

    async _readPacket(readSize) {
      let result = await this.device.transferIn(this.inEndpoint.endpointNumber, readSize);
      if (result && result.status === 'stall' && typeof this.device.clearHalt === 'function') {
        await this.device.clearHalt('in', this.inEndpoint.endpointNumber);
        result = await this.device.transferIn(this.inEndpoint.endpointNumber, readSize);
      }
      return ensureOk(result, 'Lectura USB');
    }

    async _writePacket(bytes) {
      let result = await this.device.transferOut(this.outEndpoint.endpointNumber, bytes);
      if (result && result.status === 'stall' && typeof this.device.clearHalt === 'function') {
        await this.device.clearHalt('out', this.outEndpoint.endpointNumber);
        result = await this.device.transferOut(this.outEndpoint.endpointNumber, bytes);
      }
      return ensureOk(result, 'Escritura USB');
    }

    _createStreams() {
      const port = this;
      const highWaterMark = Math.max(255, Number(port.options.bufferSize) || 255);
      this.readable = new ReadableStream({
        type: 'bytes',
        pull(controller) {
          return (async () => {
            try {
              const desired = Math.max(port.packetSize, Number(controller.desiredSize) || highWaterMark);
              const packets = Math.max(1, Math.ceil(desired / port.packetSize));
              const readSize = Math.min(1024, packets * port.packetSize);
              const result = await port._readPacket(readSize);
              if (result.data && result.data.byteLength) {
                const raw = new Uint8Array(result.data.buffer, result.data.byteOffset, result.data.byteLength);
                const bytes = port._transformIncoming(new Uint8Array(raw));
                if (bytes.byteLength) controller.enqueue(bytes);
              }
            } catch (error) {
              if (!port._closing) controller.error(asError(error));
            }
          })();
        },
        cancel() {}
      }, { highWaterMark });
      this.writable = new WritableStream({
        async write(chunk) {
          const bytes = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
          if (bytes.byteLength) await port._writePacket(bytes);
        },
        close() {},
        abort() {}
      }, new ByteLengthQueuingStrategy({ highWaterMark }));
    }

    async setSignals(signals) {
      this._signals = Object.assign({}, this._signals, signals || {});
      const dtr = !!this._signals.dataTerminalReady;
      const rts = !!this._signals.requestToSend;

      if (this.driver === 'CH340/CH341') {
        const bits = (dtr ? 0x20 : 0) | (rts ? 0x40 : 0);
        await this._chOut(0xA4, (~bits) & 0xFF, 0x0000);
        return;
      }
      if (this.driver === 'CP210x') {
        const value = 0x0300 | (dtr ? 0x0001 : 0) | (rts ? 0x0002 : 0);
        await this._cpOut(0x07, value, this.interfaceNumber);
        return;
      }
      if (this.driver === 'FTDI') {
        const value = (dtr ? 0x0101 : 0x0100) | (rts ? 0x0202 : 0x0200);
        await this._ftdiOut(0x01, value, this.ftdiPortIndex || (this.interfaceNumber + 1));
        return;
      }

      const value = (dtr ? 1 : 0) | (rts ? 2 : 0);
      await ensureOk(await this.device.controlTransferOut({
        requestType: 'class', recipient: 'interface', request: 0x22,
        value, index: this.controlInterfaceNumber
      }, EMPTY), 'No se pudieron configurar DTR/RTS');
      if (signals && typeof signals.break === 'boolean') {
        await ensureOk(await this.device.controlTransferOut({
          requestType: 'class', recipient: 'interface', request: 0x23,
          value: signals.break ? 0xFFFF : 0,
          index: this.controlInterfaceNumber
        }, EMPTY), 'No se pudo configurar BREAK');
      }
    }

    async close() {
      this._closing = true;
      this.opened = false;
      try {
        if (this.device.opened) {
          if (this.driver === 'CP210x') {
            await this._cpOut(0x07, 0x0300, this.interfaceNumber).catch(() => {});
            await this._cpOut(0x00, 0x0000, this.interfaceNumber).catch(() => {});
          } else {
            await this.setSignals({ dataTerminalReady: false, requestToSend: false }).catch(() => {});
          }
        }
      } catch (_) {}
      this.readable = null;
      this.writable = null;
      try { if (this.device.opened) await this.device.close(); } catch (_) {}
      this._claimed = [];
      this.inEndpoint = null;
      this.outEndpoint = null;
      this._closing = false;
    }

    async forget() {
      if (this.device && typeof this.device.forget === 'function') await this.device.forget();
    }
  }

  function encodeFtdiBaud(baudRate, portIndex) {
    const rate = Number(baudRate);
    if (!Number.isFinite(rate) || rate <= 0) throw new RangeError('Velocidad FTDI inválida.');
    let divisor3 = Math.max(8, Math.round((3000000 * 8) / rate));
    if (divisor3 === 8) divisor3 = 0;
    const fractions = [0, 3, 2, 4, 1, 5, 6, 7];
    let divisor = divisor3 >> 3;
    divisor |= fractions[divisor3 & 7] << 14;
    const value = divisor & 0xFFFF;
    const index = ((divisor >> 16) & 0xFFFF) | (Number(portIndex) & 0xFF);
    return { value, index };
  }

  function hasCdcDescriptors(device) {
    const configs = Array.isArray(device.configurations) ? device.configurations : [];
    return configs.some((configuration) =>
      !!findInterfaceByClass(configuration, USB_CLASS_CDC_CONTROL) &&
      !!findInterfaceByClass(configuration, USB_CLASS_CDC_DATA)
    );
  }

  function detectDriver(device) {
    const vendor = Number(device.vendorId);
    if (vendor === 0x1A86) return 'CH340/CH341';
    if (vendor === 0x10C4) return 'CP210x';
    if (vendor === 0x0403) return 'FTDI';
    if (hasCdcDescriptors(device)) return 'CDC-ACM';
    // Muchas placas oficiales exponen CDC después de seleccionar configuración.
    if ([0x2341, 0x2A03, 0x239A, 0x1B4F, 0x303A, 0x2E8A, 0x0483].includes(vendor)) {
      return 'CDC-ACM';
    }
    return 'CDC-ACM';
  }


  function isSupportedDevice(device) {
    if (!device) return false;
    const vendor = Number(device.vendorId);
    if ([0x1A86, 0x10C4, 0x0403, 0x2341, 0x2A03, 0x239A, 0x1B4F, 0x303A, 0x2E8A, 0x0483].includes(vendor)) return true;
    return hasCdcDescriptors(device);
  }

  async function requestPort() {
    if (!global.isSecureContext) throw new Error('WebUSB requiere HTTPS.');
    if (!navigator.usb || typeof navigator.usb.requestDevice !== 'function') {
      throw new Error('WebUSB no está disponible en este navegador Android.');
    }
    let device;
    try {
      const granted = typeof navigator.usb.getDevices === 'function'
        ? await navigator.usb.getDevices() : [];
      const compatible = granted.filter(isSupportedDevice);
      if (compatible.length === 1) {
        device = compatible[0];
      } else {
        device = await navigator.usb.requestDevice({ filters: CHIP_FILTERS });
      }
    } catch (error) {
      const cause = asError(error);
      if (cause.name === 'NotFoundError') {
        throw new DOMException(
          'No se seleccionó una placa USB. Conecta el Arduino por OTG, cierra ArduinoDroid y vuelve a tocar Conectar.',
          'NotFoundError'
        );
      }
      throw cause;
    }
    return new WebUsbSerialPort(device);
  }

  async function requestAnyPort() {
    if (!global.isSecureContext) throw new Error('WebUSB requiere HTTPS.');
    if (!navigator.usb || typeof navigator.usb.requestDevice !== 'function') {
      throw new Error('WebUSB no está disponible en este navegador Android.');
    }
    let device;
    try {
      device = await navigator.usb.requestDevice({ acceptAllDevices: true });
    } catch (error) {
      const cause = asError(error);
      if (cause.name === 'NotFoundError') {
        throw new DOMException('No se seleccionó ningún dispositivo USB.', 'NotFoundError');
      }
      throw cause;
    }
    return new WebUsbSerialPort(device);
  }

  async function getPorts() {
    if (!navigator.usb || typeof navigator.usb.getDevices !== 'function') return [];
    const devices = await navigator.usb.getDevices();
    return devices.map((device) => new WebUsbSerialPort(device));
  }

  async function getAuthorizedDevices() {
    if (!navigator.usb || typeof navigator.usb.getDevices !== 'function') return [];
    const devices = await navigator.usb.getDevices();
    return devices.map((device) => ({
      vendorId: device.vendorId,
      productId: device.productId,
      vendorHex: hex(device.vendorId),
      productHex: hex(device.productId),
      productName: device.productName || 'Dispositivo USB',
      manufacturerName: device.manufacturerName || '',
      driver: detectDriver(device)
    }));
  }

  function diagnostics() {
    const ua = navigator.userAgent || '';
    const chromeMatch = ua.match(/(?:Chrome|CriOS)\/(\d+)/i);
    return {
      secureContext: !!global.isSecureContext,
      android: /Android/i.test(ua),
      chromeVersion: chromeMatch ? Number(chromeMatch[1]) : 0,
      nativeSerial: !!navigator.serial,
      webUsb: !!navigator.usb,
      drivers: ['CDC-ACM', 'CH340/CH341', 'CP210x', 'FTDI'],
      driverVersion: 21
    };
  }

  global.SimuPLCWebUsbSerial = {
    requestPort,
    requestAnyPort,
    getPorts,
    getAuthorizedDevices,
    diagnostics,
    Port: WebUsbSerialPort,
    filters: CHIP_FILTERS.slice(),
    detectDriver
  };
})(window);
