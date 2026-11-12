/** A device on an I²C bus, seen from the bus: it answers its address, takes bytes and gives bytes. */
export interface I2cDevice {
  readonly address: number;
  /** A transaction to this device begins (after its address was acknowledged). */
  start?(): void;
  /** A byte from the controller; true to acknowledge it. */
  write(b: number): boolean;
  /** A byte for the controller. */
  read(): number;
  stop?(): void;
}

/** One I²C bus: routes each transaction to the device whose address the controller sent. */
export class I2cBus {
  devices: I2cDevice[] = [];
  private current: I2cDevice | null = null;

  /** Address phase. Returns whether a device acknowledged. */
  connect(address: number): boolean {
    this.current = this.devices.find((d) => d.address === address) ?? null;
    this.current?.start?.();
    return this.current !== null;
  }

  write(b: number): boolean {
    return this.current ? this.current.write(b) : false;
  }

  read(): number {
    return this.current ? this.current.read() : 0xff;
  }

  stop() {
    this.current?.stop?.();
    this.current = null;
  }
}

/** PCF8574 8-bit I/O expander: the byte written is what its eight pins output. */
export class Pcf8574 implements I2cDevice {
  readonly address: number;
  value = 0xff;
  onChange: (value: number) => void = () => {};

  constructor(address: number) {
    this.address = address;
  }

  write(b: number) {
    if (b !== this.value) {
      this.value = b;
      this.onChange(b);
    }
    return true;
  }

  read() {
    return this.value;
  }
}
