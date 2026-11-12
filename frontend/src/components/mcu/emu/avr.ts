import {
  AVRADC,
  AVRIOPort,
  AVRSPI,
  AVRTWI,
  AVRTimer,
  AVRUSART,
  CPU,
  PinState,
  adcConfig,
  avrInstruction,
  portBConfig,
  portCConfig,
  portDConfig,
  spiConfig,
  timer0Config,
  timer1Config,
  timer2Config,
  twiConfig,
  usart0Config,
  type TWIEventHandler,
} from "avr8js";
import { UNO, type PinDrive } from "../../lab/engine/mcu-boards.ts";
import { I2cBus } from "../devices/i2c.ts";
import { parseIntelHex } from "./hex.ts";
import type { Machine } from "./machine.ts";
import { PinMeter } from "./meter.ts";

const HZ = 16_000_000;
const FLASH = 0x8000;

/**
 * Arduino Uno: an ATmega328P at 16 MHz running the compiled sketch instruction by instruction (avr8js), with its
 * three timers (millis, PWM, tone), USART, ADC, I²C and SPI.
 */
export class UnoMachine implements Machine {
  readonly board = "uno" as const;
  readonly hz = HZ;
  readonly meter = new PinMeter(HZ);
  readonly cpu: CPU;
  readonly ports: Record<"B" | "C" | "D", AVRIOPort>;
  readonly usart: AVRUSART;
  readonly adc: AVRADC;
  readonly twi: AVRTWI;
  readonly spi: AVRSPI;
  readonly i2c = [new I2cBus()];
  onPin: (pin: string, level: 0 | 1) => void = () => {};
  private tx: number[] = [];
  private rx: number[] = [];

  constructor(hex: string | Uint8Array) {
    const image = typeof hex === "string" ? parseIntelHex(hex, FLASH) : hex;
    this.cpu = new CPU(new Uint16Array(image.buffer, image.byteOffset, FLASH / 2));
    new AVRTimer(this.cpu, timer0Config);
    new AVRTimer(this.cpu, timer1Config);
    new AVRTimer(this.cpu, timer2Config);
    this.ports = { B: new AVRIOPort(this.cpu, portBConfig), C: new AVRIOPort(this.cpu, portCConfig), D: new AVRIOPort(this.cpu, portDConfig) };
    this.usart = new AVRUSART(this.cpu, usart0Config, HZ);
    this.usart.onByteTransmit = (b) => this.tx.push(b);
    this.usart.onRxComplete = () => this.feed();
    this.adc = new AVRADC(this.cpu, adcConfig);
    this.adc.avcc = UNO.adcRef;
    this.twi = new AVRTWI(this.cpu, twiConfig, HZ);
    this.spi = new AVRSPI(this.cpu, spiConfig, HZ);
    for (const name of ["B", "C", "D"] as const) this.ports[name].addListener(() => this.sample(name));
    const twi = this.twi;
    const bus = this.i2c[0];
    twi.eventHandler = {
      start: () => twi.completeStart(),
      stop: () => {
        bus.stop();
        twi.completeStop();
      },
      connectToSlave: (addr) => twi.completeConnect(bus.connect(addr)),
      writeByte: (v) => twi.completeWrite(bus.write(v)),
      readByte: () => twi.completeRead(bus.read()),
    };
  }

  get cycles() {
    return this.cpu.cycles;
  }

  /** Attach an I²C bus model (displays, port expanders). */
  setI2c(handler: TWIEventHandler) {
    this.twi.eventHandler = handler;
  }

  private sample(port: "B" | "C" | "D") {
    const p = this.ports[port];
    for (const io of UNO.gpio) {
      if (io.port !== port) continue;
      const s = p.pinState(io.bit!);
      if (s === PinState.High) {
        this.meter.set(io.id, 1, this.cpu.cycles);
        this.onPin(io.id, 1);
      } else if (s === PinState.Low) {
        this.meter.set(io.id, 0, this.cpu.cycles);
        this.onPin(io.id, 0);
      }
    }
  }

  run(cycles: number) {
    const cpu = this.cpu;
    const end = cpu.cycles + cycles;
    while (cpu.cycles < end) {
      avrInstruction(cpu);
      cpu.tick();
    }
  }

  modes(): Record<string, PinDrive["mode"]> {
    const out: Record<string, PinDrive["mode"]> = {};
    for (const io of UNO.gpio) {
      const s = this.ports[io.port!].pinState(io.bit!);
      out[io.id] = s === PinState.High || s === PinState.Low ? "out" : s === PinState.InputPullUp ? "pullup" : "in";
    }
    // With the UART on, TX is driven by the UART (idle high) whatever DDRD says.
    if (this.usart.txEnable) out.D1 = "out";
    return out;
  }

  /** Output levels, including the TX line the UART drives. */
  level(pin: string): 0 | 1 {
    if (pin === "D1" && this.usart.txEnable) return 1;
    return this.meter.level(pin);
  }

  input(pin: string, level: boolean, volts: number) {
    const io = UNO.gpio.find((g) => g.id === pin);
    if (!io) return;
    this.ports[io.port!].setPin(io.bit!, level);
    if (io.adc !== undefined) this.adc.channelValues[io.adc] = Math.max(0, Math.min(UNO.adcRef, volts));
  }

  serialIn(bytes: number[]) {
    this.rx.push(...bytes);
    this.feed();
  }

  private feed() {
    if (!this.rx.length || !this.usart.rxEnable || this.usart.rxBusy) return;
    this.usart.writeByte(this.rx.shift()!);
  }

  drainSerial(): number[] {
    const out = this.tx;
    this.tx = [];
    return out;
  }
}
