import type { McuBoard } from "../../lab/engine/mcu-boards.ts";
import type { Board, Layer, LedColor, Part, PartProps, PartType, Pt, Trace } from "../../lab/engine/types.ts";

/**
 * Starter projects: code plus the circuit it drives, wired to the real header positions. The Uno sits at (12,12):
 * top header on y = 12 (GND at x 15, D13 at 16, D9 at 20, D8 at 21, D2 at 28), power and analog header on y = 31
 * (5V at 17, GND at 18, A0 at 22). The Pico sits at (20,8): GP0 at (20,8), GP15 at (20,27), GP16 at (27,27).
 */

export type Language = "cpp" | "python";

export interface Example {
  id: string;
  title: string;
  board: McuBoard;
  language: Language;
  summary: string;
  code: string;
  circuit: Board;
}

let n = 0;
const part = (id: string, type: PartType, x: number, y: number, props: PartProps = {}): Part => ({ id, type, x, y, rot: 0, props });
const wire = (pts: [number, number][], layer: Layer = "top"): Trace => ({ id: `w${n++}`, layer, width: 0.4, points: pts.map(([x, y]): Pt => ({ x, y })) });
const UNO_AT: [number, number] = [12, 12];
const uno = () => part("U1", "uno", ...UNO_AT);
const PICO_AT: [number, number] = [20, 8];
const pico = () => part("U1", "pico", ...PICO_AT);
const W = 48;
const H = 40;
const circuit = (parts: Part[], traces: Trace[] = []): Board => ({ w: W, h: H, parts, traces, vias: [] });

/** A 220 Ω resistor and a red LED from a pin at x on the Uno's top header, returning to GND. */
const ledFrom = (x: number, color: LedColor = "red") => ({
  parts: [part("R1", "resistor", x, 6, { value: 220 }), part("D1", "led", x + 6, 6, { color })],
  traces: [wire([[x, 12], [x, 6]]), wire([[x + 4, 6], [x + 6, 6]]), wire([[x + 7, 6], [x + 7, 4], [15, 4], [15, 12]])],
});

const blinkLed = ledFrom(16);
const fadeLed = ledFrom(20, "green");

export const EXAMPLES: Example[] = [
  {
    id: "blink",
    title: "Blink",
    board: "uno",
    language: "cpp",
    summary: "Switch an LED on and off once a second, with the on-board LED on pin 13.",
    code: `// Blink: the "hello world" of electronics.
// Pin 13 drives the on-board LED and the red LED on the breadboard.

void setup() {
  pinMode(13, OUTPUT);
}

void loop() {
  digitalWrite(13, HIGH);   // 5 V on pin 13: current flows through the resistor and LED
  delay(500);
  digitalWrite(13, LOW);    // 0 V: the LED goes out
  delay(500);
}
`,
    circuit: circuit([uno(), ...blinkLed.parts], blinkLed.traces),
  },
  {
    id: "fade",
    title: "Fade (PWM)",
    board: "uno",
    language: "cpp",
    summary: "Make an LED breathe with analogWrite. Pin 9 switches 490 times a second; the duty sets the brightness.",
    code: `// Fade: analogWrite() switches pin 9 on and off 490 times a second.
// The share of time it is on (the duty) sets how bright the LED looks.

int level = 0;
int step = 5;

void setup() {
  pinMode(9, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  analogWrite(9, level);    // 0 = always off, 255 = always on
  Serial.println(level);
  level += step;
  if (level <= 0 || level >= 255) step = -step;
  delay(30);
}
`,
    circuit: circuit([uno(), ...fadeLed.parts], fadeLed.traces),
  },
  {
    id: "button",
    title: "Button",
    board: "uno",
    language: "cpp",
    summary: "Read a push button with the internal pull-up resistor and light the on-board LED while it is held.",
    code: `// Button: INPUT_PULLUP holds pin 2 at 5 V through a resistor inside the chip.
// Pressing the button connects pin 2 to GND, so it reads LOW while pressed.

void setup() {
  pinMode(2, INPUT_PULLUP);
  pinMode(13, OUTPUT);
  Serial.begin(9600);
}

bool was = HIGH;

void loop() {
  bool now = digitalRead(2);
  digitalWrite(13, now == LOW ? HIGH : LOW);
  if (now != was) {
    Serial.println(now == LOW ? "pressed" : "released");
    was = now;
  }
  delay(10);   // a little time for the contacts to stop bouncing
}
`,
    circuit: circuit([uno(), part("SW1", "button", 28, 6)], [wire([[28, 12], [28, 6]]), wire([[31, 6], [31, 3], [15, 3], [15, 12]])]),
  },
  {
    id: "pot",
    title: "Potentiometer and serial",
    board: "uno",
    language: "cpp",
    summary: "Measure the voltage on a knob with analogRead and print it to the serial monitor. Turn the knob while it runs.",
    code: `// analogRead() measures the voltage on A0: 0 V reads 0, 5 V reads 1023.
// Select the knob and drag its slider in the inspector while this runs.

void setup() {
  Serial.begin(9600);
}

void loop() {
  int raw = analogRead(A0);
  float volts = raw * 5.0 / 1024.0;
  Serial.print(raw);
  Serial.print("  ");
  Serial.print(volts, 2);
  Serial.println(" V");
  delay(200);
}
`,
    circuit: circuit(
      // The knob is turned round (180°) so its pins face the header: 1 at (23,34), wiper at (22,34), 3 at (21,34).
      [uno(), { ...part("RV1", "pot", 23, 34, { value: 10000, pos: 0.5 }), rot: 180 }],
      [wire([[22, 34], [22, 31]]), wire([[21, 34], [21, 33], [18, 33], [18, 31]]), wire([[23, 34], [25, 34], [25, 39], [17, 39], [17, 31]])],
    ),
  },
  {
    id: "servo",
    title: "Servo sweep",
    board: "uno",
    language: "cpp",
    summary: "Sweep a hobby servo from 0° to 180° and back with the Servo library. Pin 9 sends a 1–2 ms pulse 50 times a second.",
    code: `#include <Servo.h>

// A servo reads the width of a pulse sent 50 times a second:
// about 0.5 ms is 0°, 1.5 ms is 90°, 2.4 ms is 180°.
Servo arm;

void setup() {
  arm.attach(9);
}

void loop() {
  for (int angle = 0; angle <= 180; angle += 2) {
    arm.write(angle);
    delay(15);
  }
  for (int angle = 180; angle >= 0; angle -= 2) {
    arm.write(angle);
    delay(15);
  }
}
`,
    circuit: circuit(
      [uno(), part("M1", "servo", 18, 6)],
      [wire([[20, 6], [20, 12]]), wire([[18, 6], [15, 6], [15, 12]]), wire([[19, 6], [19, 4], [3, 4], [3, 34], [17, 34], [17, 31]])],
    ),
  },
  {
    id: "tone",
    title: "Buzzer melody",
    board: "uno",
    language: "cpp",
    summary: "Play notes with tone(). The pin's frequency goes to your speakers, so turn the sound on.",
    code: `// tone() makes pin 8 switch at an exact frequency: 440 times a second is the note A.

int notes[] = { 262, 294, 330, 349, 392, 440, 494, 523 };

void setup() {
  pinMode(8, OUTPUT);
}

void loop() {
  for (int i = 0; i < 8; i++) {
    tone(8, notes[i]);
    delay(250);
  }
  noTone(8);
  delay(1000);
}
`,
    circuit: circuit([uno(), part("BZ1", "buzzer", 21, 6)], [wire([[21, 12], [21, 6]]), wire([[24, 6], [24, 4], [15, 4], [15, 12]])]),
  },
  {
    id: "oled",
    title: "OLED display (I²C)",
    board: "uno",
    language: "cpp",
    summary: "Draw text and a moving bar on a 128×64 SSD1306 OLED with the Adafruit library, over I²C on A4 (SDA) and A5 (SCL).",
    code: `#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// 128 x 64 pixels on I2C address 0x3C. A4 is SDA, A5 is SCL.
Adafruit_SSD1306 display(128, 64, &Wire, -1);

void setup() {
  display.begin(SSD1306_SWITCHCAPVCC, 0x3C);
}

void loop() {
  unsigned long s = millis() / 1000;
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(2);
  display.setCursor(0, 0);
  display.println("VOLTEX");
  display.setTextSize(1);
  display.print("Running for ");
  display.print(s);
  display.println(" s");
  int w = (millis() / 20) % 128;
  display.drawRect(0, 44, 128, 12, SSD1306_WHITE);
  display.fillRect(0, 44, w, 12, SSD1306_WHITE);
  display.display();   // send the whole picture over I2C
}
`,
    circuit: circuit(
      [uno(), part("OLED1", "oled", 28, 37)],
      [
        wire([[29, 37], [29, 39], [17, 39], [17, 31]]),
        wire([[28, 37], [28, 38], [18, 38], [18, 31]]),
        wire([[30, 37], [30, 35], [27, 35], [27, 31]]),
        // SDA crosses SCL, so it runs on the bottom layer.
        wire([[31, 37], [31, 34], [26, 34], [26, 31]], "bottom"),
      ],
    ),
  },
  {
    id: "lcd",
    title: "16×2 LCD",
    board: "uno",
    language: "cpp",
    summary: "Print to a character LCD with the LiquidCrystal library, wired in 4-bit mode: RS on 12, E on 11, D4–D7 on 5, 4, 3, 2.",
    code: `#include <LiquidCrystal.h>

// RS, E, D4, D5, D6, D7: the classic Arduino wiring.
LiquidCrystal lcd(12, 11, 5, 4, 3, 2);

void setup() {
  lcd.begin(16, 2);
  lcd.print("Hello, Voltex!");
}

void loop() {
  lcd.setCursor(0, 1);       // column 0, line 2
  lcd.print("Uptime ");
  lcd.print(millis() / 1000);
  lcd.print(" s");
  delay(200);
}
`,
    // LCD at (15,6): VSS 15, VDD 16, V0 17, RS 18, RW 19, E 20, D4–D7 25–28.
    circuit: circuit(
      [uno(), part("LCD1", "lcd1602", 15, 6)],
      [
        wire([[15, 6], [15, 12]]),
        wire([[17, 6], [17, 7], [15, 7]]),
        wire([[19, 6], [19, 5], [17, 5], [17, 6]], "bottom"),
        wire([[16, 6], [16, 4], [4, 4], [4, 35], [17, 35], [17, 31]]),
        wire([[18, 6], [18, 8], [17, 8], [17, 12]]),
        wire([[20, 6], [20, 10], [18, 10], [18, 12]]),
        wire([[25, 6], [25, 12]]),
        wire([[26, 6], [26, 12]]),
        wire([[27, 6], [27, 12]]),
        wire([[28, 6], [28, 12]]),
      ],
    ),
  },
  {
    id: "py-blink",
    title: "MicroPython blink",
    board: "pico",
    language: "python",
    summary: "Blink the Pico's on-board LED and an LED on GP15 from MicroPython. No compiling: the script runs as it is.",
    code: `# MicroPython on the Raspberry Pi Pico.
from machine import Pin
import time

led = Pin("LED", Pin.OUT)     # the LED on the board (GP25)
ext = Pin(15, Pin.OUT)        # the LED on the breadboard

while True:
    led.toggle()
    ext.value(led.value())
    print("LED is", "on" if led.value() else "off")
    time.sleep(0.5)
`,
    circuit: circuit(
      [pico(), part("R1", "resistor", 12, 27, { value: 220 }), part("D1", "led", 9, 27, { color: "red" })],
      // GP15 (20,27) → R1 (16..12) → LED anode at 9; the cathode at 10 returns to GND at (20,25).
      [wire([[20, 27], [16, 27]]), wire([[12, 27], [12, 29], [9, 29], [9, 27]]), wire([[10, 27], [10, 25], [20, 25]])],
    ),
  },
  {
    id: "py-pot",
    title: "MicroPython ADC",
    board: "pico",
    language: "python",
    summary: "Read a potentiometer on GP26 with the Pico's 12-bit ADC, which MicroPython scales to 0–65535.",
    code: `from machine import ADC
import time

knob = ADC(26)                 # GP26 is ADC0

while True:
    raw = knob.read_u16()      # 0 .. 65535 for 0 .. 3.3 V
    print(raw, round(raw * 3.3 / 65535, 2), "V")
    time.sleep(0.2)
`,
    circuit: circuit(
      [pico(), part("RV1", "pot", 33, 18, { value: 10000, pos: 0.5 })],
      // Right header: 3V3 at (27,12), AGND at (27,15), GP26 at (27,17).
      [wire([[34, 18], [34, 20], [29, 20], [29, 17], [27, 17]]), wire([[33, 18], [33, 15], [27, 15]]), wire([[35, 18], [35, 12], [27, 12]])],
    ),
  },
];

export const exampleById = (id: string) => EXAMPLES.find((e) => e.id === id);
export const EXAMPLE_BOARD = { w: W, h: H };
