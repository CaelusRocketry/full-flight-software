#ifndef FLIGHT_PRESSUREDRIVER_HPP
#define FLIGHT_PRESSUREDRIVER_HPP

#include <vector>

using namespace std;

#define MIN_PSI 15
#define MAX_PSI 1000
#define MIN_VOLTAGE 0.5
#define MAX_VOLTAGE 4.5

class PressureDriver {
private:
    vector<int> pressure_pins;
    vector<float> pressure_vals;

    float readSensor(int pin);

public:
    PressureDriver(vector<int> pins);
    void read();
    float getPressureValue(int pin);
};

#endif // FLIGHT_PRESSUREDRIVER_HPP