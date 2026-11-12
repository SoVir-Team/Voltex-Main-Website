void setup() {
  pinMode(8, OUTPUT); pinMode(11, OUTPUT); pinMode(12, OUTPUT);
  digitalWrite(8, LOW);
  shiftOut(11, 12, MSBFIRST, 0xB2);
  digitalWrite(8, HIGH);
}
void loop() {}
