#include <Arduino.h>

class PressureCalibrator
{
  private:
    int pin;
    int runs;

  public:
    PressureCalibrator(int pin, int runs)
    {
      pin = pin;
      runs = runs;
    }

    double calculate_m(double bias, double actual_pressure) {
      int n = 1;
      double average = 0;
      double m = 0;

      for (int j = 0; j < runs; j++) {
        average += (readSensor(pin) - average) / n;
      }

      m = (average - bias) / actual_pressure;
      return m;
    }

    double calculate_bias(double actual_pressure) {
      int n = 1;
      double average = 0;
      double m = 0;

      for (int j = 0; j < runs; j++) {
        average += (readSensor(pin) - average) / n;
      }

      m = average - actual_pressure;
      return m;
    }

    float map_value(float x, float in_min, float in_max, float out_min, float out_max) {
      float in_width = in_max - in_min;
      float out_width = out_max - out_min;
      float factor = out_width / in_width;
      return (x - in_min) * factor + out_min;
    }

    float readSensor(int pin) {
      // print("in pressure readSensor");
      float pwmVal = analogRead(pin);
      float voltage = map_value(pwmVal, 0.0, 1024.0, 0.0, 5.0);
      // voltage *= 1000;
      // print(Util::hex(voltage));
      float psi = map_value(voltage, 0.5, 4.5, 15, 1000);
      return psi;
    }
};
