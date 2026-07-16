/*
 * SimuPLC WebUSB Serial V18
 * Respaldo USB CDC-ACM para Android cuando Web Serial no enumera la placa.
 * Compatible con dispositivos que exponen interfaces USB CDC Communications
 * (clase 2) y CDC Data (clase 10), como muchas placas Arduino oficiales.
 */
(function (global) {
  'use strict';

  const CONTROL_CLASS = 0x02;
  const DATA_CLASS = 0x0A;
  const SET_LINE_CODING = 0x20;
  const SET_CONTROL_LINE_STATE = 0x22;
  const SEND_BREAK = 0x23;

  const KNOWN_USB_FILTERS = [
    { classCode: CONTROL_CLASS },
    { vendorId: 0x2341 }, // Arduino SA
    { vendorId: 0x2A03 }, // Arduino SRL
    { vendorId: 0x239A }, // Adafruit
    { vendorId: 0x1B4F }, // SparkFun
    { vendorId: 0x303A }, // Espressif
    { vendorId: 0x1A86 }, // QinHeng / CH340 (diagnóstico; no siempre CDC)
    { vendorId: 0x10C4 }, // Silicon Labs (diagnóstico; no siempre CDC)
    { vendorId: 0x0403 }  // FTDI (diagnóstico; no siempre CDC)
  ];

  function asError(error) {
    if (error instanceof Error) return error;
    return new Error(String(error || 'Error USB desconocido.'));
  }

  function getAlternates(iface) {
    if (!iface) return [];
    if (Array.isArray(iface.alternates)) return iface.alternates;
    if (iface.alternate) return [iface.alternate];
    return [];
  }

  function findInterface(configuration, classCode) {
    if (!configuration || !Array.isArray(configuration.interfaces)) {
      throw new Error('El dispositivo USB no tiene interfaces disponibles.');
    }
    for (const iface of configuration.interfaces) {
      const alternate = getAlternates(iface).find((item) => item && item.interfaceClass === classCode);
      if (alternate) return { iface, alternate };
    }
    throw new Error(
      classCode === CONTROL_CLASS
        ? 'La placa no expone una interfaz USB CDC de control.'
        : 'La placa no expone una interfaz USB CDC de datos.'
    );
  }

  function findEndpoint(alternate, direction) {
    const endpoints = alternate && Array.isArray(alternate.endpoints) ? alternate.endpoints : [];
    const endpoint = endpoints.find((item) => item && item.direction === direction);
    if (!endpoint) throw new Error('No se encontró el canal USB CDC de ' + (direction === 'in' ? 'entrada' : 'salida') + '.');
    return endpoint;
  }

  function parityIndex(parity) {
    if (parity === 'odd') return 1;
    if (parity === 'even') return 2;
    return 0;
  }

  function stopBitsIndex(stopBits) {
    return Number(stopBits) === 2 ? 2 : 0;
  }

  class SimuPLCWebUsbPort {
    constructor(device) {
      this.device = device;
      this.control = null;
      this.data = null;
      this.inEndpoint = null;
      this.outEndpoint = null;
      this.readable = null;
      this.writable = null;
      this.opened = false;
      this.options = null;
    }

    getInfo() {
      return {
        usbVendorId: this.device.vendorId,
        usbProductId: this.device.productId
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
        bufferSize: 512
      }, options || {});

      if (!Number.isFinite(Number(this.options.baudRate)) || Number(this.options.baudRate) <= 0) {
        throw new RangeError('Velocidad USB inválida.');
      }

      try {
        await this.device.open();
        if (!this.device.configuration) {
          const configurationValue = this.device.configurations && this.device.configurations[0]
            ? this.device.configurations[0].configurationValue
            : 1;
          await this.device.selectConfiguration(configurationValue || 1);
        }

        this.control = findInterface(this.device.configuration, CONTROL_CLASS);
        this.data = findInterface(this.device.configuration, DATA_CLASS);
        this.inEndpoint = findEndpoint(this.data.alternate, 'in');
        this.outEndpoint = findEndpoint(this.data.alternate, 'out');

        await this.device.claimInterface(this.control.iface.interfaceNumber);
        if (this.data.iface.interfaceNumber !== this.control.iface.interfaceNumber) {
          await this.device.claimInterface(this.data.iface.interfaceNumber);
        }

        if (typeof this.device.selectAlternateInterface === 'function') {
          if (this.control.alternate.alternateSetting) {
            await this.device.selectAlternateInterface(
              this.control.iface.interfaceNumber,
              this.control.alternate.alternateSetting
            );
          }
          if (this.data.alternate.alternateSetting) {
            await this.device.selectAlternateInterface(
              this.data.iface.interfaceNumber,
              this.data.alternate.alternateSetting
            );
          }
        }

        await this.setLineCoding();
        await this.setSignals({ dataTerminalReady: true, requestToSend: true });
        this.createStreams();
        this.opened = true;
      } catch (error) {
        try {
          if (this.device.opened) await this.device.close();
        } catch (_) {}
        const cause = asError(error);
        if (/CDC/i.test(cause.message)) {
          throw new Error(
            cause.message + ' En esta tablet prueba Web Serial con Chrome actualizado o utiliza ESP32 por Wi‑Fi.'
          );
        }
        throw new Error('No se pudo abrir la placa mediante WebUSB: ' + cause.message);
      }
    }

    createStreams() {
      const port = this;
      const packetSize = Math.max(64, Number(this.inEndpoint.packetSize) || 64);
      const readSize = Math.max(packetSize, Number(this.options.bufferSize) || 512);

      this.readable = new ReadableStream({
        type: 'bytes',
        async pull(controller) {
          try {
            const result = await port.device.transferIn(port.inEndpoint.endpointNumber, readSize);
            if (!result || result.status !== 'ok') {
              throw new Error('Lectura USB: ' + (result ? result.status : 'sin respuesta'));
            }
            if (result.data && result.data.byteLength) {
              const bytes = new Uint8Array(
                result.data.buffer,
                result.data.byteOffset,
                result.data.byteLength
              );
              controller.enqueue(new Uint8Array(bytes));
            }
          } catch (error) {
            controller.error(asError(error));
          }
        },
        cancel() {}
      }, { highWaterMark: readSize });

      this.writable = new WritableStream({
        async write(chunk) {
          const bytes = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
          const result = await port.device.transferOut(port.outEndpoint.endpointNumber, bytes);
          if (!result || result.status !== 'ok') {
            throw new Error('Escritura USB: ' + (result ? result.status : 'sin respuesta'));
          }
        },
        close() {},
        abort() {}
      });
    }

    async setLineCoding() {
      const data = new ArrayBuffer(7);
      const view = new DataView(data);
      view.setUint32(0, Number(this.options.baudRate), true);
      view.setUint8(4, stopBitsIndex(this.options.stopBits));
      view.setUint8(5, parityIndex(this.options.parity));
      view.setUint8(6, Number(this.options.dataBits) || 8);
      const result = await this.device.controlTransferOut({
        requestType: 'class',
        recipient: 'interface',
        request: SET_LINE_CODING,
        value: 0,
        index: this.control.iface.interfaceNumber
      }, data);
      if (!result || result.status !== 'ok') throw new Error('No se pudo configurar la velocidad USB.');
    }

    async setSignals(signals) {
      const dtr = !!(signals && signals.dataTerminalReady);
      const rts = !!(signals && signals.requestToSend);
      const value = (dtr ? 1 : 0) | (rts ? 2 : 0);
      const result = await this.device.controlTransferOut({
        requestType: 'class',
        recipient: 'interface',
        request: SET_CONTROL_LINE_STATE,
        value,
        index: this.control.iface.interfaceNumber
      });
      if (!result || result.status !== 'ok') throw new Error('No se pudieron configurar DTR/RTS.');

      if (signals && typeof signals.break === 'boolean') {
        await this.device.controlTransferOut({
          requestType: 'class',
          recipient: 'interface',
          request: SEND_BREAK,
          value: signals.break ? 0xFFFF : 0,
          index: this.control.iface.interfaceNumber
        });
      }
    }

    async close() {
      this.readable = null;
      this.writable = null;
      this.opened = false;
      try {
        if (this.device && this.device.opened && this.control) {
          await this.setSignals({ dataTerminalReady: false, requestToSend: false });
        }
      } catch (_) {}
      try {
        if (this.device && this.device.opened) await this.device.close();
      } catch (_) {}
    }

    async forget() {
      if (this.device && typeof this.device.forget === 'function') await this.device.forget();
    }
  }

  async function requestPort() {
    if (!global.isSecureContext) {
      throw new Error('WebUSB requiere HTTPS.');
    }
    if (!navigator.usb || typeof navigator.usb.requestDevice !== 'function') {
      throw new Error('WebUSB no está disponible en este navegador.');
    }
    const device = await navigator.usb.requestDevice({ filters: KNOWN_USB_FILTERS });
    return new SimuPLCWebUsbPort(device);
  }

  async function getPorts() {
    if (!navigator.usb || typeof navigator.usb.getDevices !== 'function') return [];
    const devices = await navigator.usb.getDevices();
    return devices.map((device) => new SimuPLCWebUsbPort(device));
  }

  function diagnostics() {
    const ua = navigator.userAgent || '';
    const chromeMatch = ua.match(/(?:Chrome|CriOS)\/(\d+)/i);
    return {
      secureContext: !!global.isSecureContext,
      android: /Android/i.test(ua),
      chromeVersion: chromeMatch ? Number(chromeMatch[1]) : 0,
      nativeSerial: !!navigator.serial,
      webUsb: !!navigator.usb
    };
  }

  global.SimuPLCWebUsbSerial = {
    requestPort,
    getPorts,
    diagnostics,
    Port: SimuPLCWebUsbPort,
    filters: KNOWN_USB_FILTERS.slice()
  };
})(window);
