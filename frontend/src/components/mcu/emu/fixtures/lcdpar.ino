#include <LiquidCrystal.h>
LiquidCrystal lcd(12, 11, 5, 4, 3, 2);
byte heart[8] = {0, 10, 31, 31, 14, 4, 0, 0};
void setup() {
  lcd.createChar(0, heart);
  lcd.begin(16, 2);
  lcd.print("Hello, Voltex!");
  lcd.setCursor(0, 1);
  lcd.write(byte(0));
  lcd.print(" line 2");
}
void loop() {}
