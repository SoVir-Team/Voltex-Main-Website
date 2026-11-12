#include <Wire.h>
#include <LiquidCrystal_I2C.h>
LiquidCrystal_I2C lcd(0x27, 16, 2);
void setup() {
  lcd.init();
  lcd.backlight();
  lcd.print("I2C backpack");
  lcd.setCursor(3, 1);
  lcd.print("works");
}
void loop() {}
