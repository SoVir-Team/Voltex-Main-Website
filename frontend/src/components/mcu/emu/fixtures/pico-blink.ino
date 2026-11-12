void setup() {
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);
  pinMode(15, OUTPUT);
  analogWriteFreq(1000);
}
int n = 0;
void loop() {
  digitalWrite(LED_BUILTIN, n & 1);
  analogWrite(15, 77);
  Serial.print("tick ");
  Serial.println(analogRead(26));
  n++;
  delay(100);
}
