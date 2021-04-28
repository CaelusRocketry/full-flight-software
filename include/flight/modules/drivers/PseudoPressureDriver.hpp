#ifndef FLIGHT_PSEUDOPRESSUREDRIVER_HPP
#define FLIGHT_PSEUDOPRESSUREDRIVER_HPP

#include <vector>

class PseudoPressureDriver {
private:
    std::vector<int> pressure_pins;
    std::vector<float> pressure_vals;

    float readSensor(int pin);

public:
    PseudoPressureDriver(std::vector<int> pins);
    void read();
    float getPressureValue(int pin);
};


#endif