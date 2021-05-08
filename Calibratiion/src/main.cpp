#include <Arduino.h>
#include <PressureCalibrator.hpp>

int num_pins = 5;
int pins[] = {1, 2, 3, 4, 5};

void setup()
{
  Serial.begin(9600);
  for (int i = 0; i < num_pins; i++)
    pinMode(INPUT, i);
}

void loop() {

  for (int i = 0; i < num_pins; i++) {
    Serial.println("Pin " + i);
    PressureCalibrator pcal = PressureCalibrator(i, 100);

    double actual_pressures[] = {15, 100.0};

    double bias = pcal.calculate_bias(actual_pressures[0]);

    double m = pcal.calculate_m(bias, actual_pressures[1]);

    Serial.println("Bias: ");
    Serial.print(bias);
    Serial.println("");

    Serial.println("Slope: ");
    Serial.print(m);
    Serial.println("");
  }

  while(true);
}