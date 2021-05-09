#ifndef FLIGHT_THERMODRIVER_HPP
#define FLIGHT_THERMODRIVER_HPP

#include <flight/modules/lib/Enums.hpp>

#include <vector>

// THESE VALUES ARE NOT CORRECT, please confirm with someone on propulsion
#define MIN_TEMP 15
#define MAX_TEMP 1000
#define MIN_VOLTAGE 0.5
#define MAX_VOLTAGE 4.5

using namespace std;

class PseudoThermoDriver {
private:
    vector<int> thermo_pins;
    vector<float> thermo_vals;

    float readSensor(int pin);

public:
    PseudoThermoDriver(vector<vector<int>> pins);
    void read();
    float getThermoValue(int pin);
};

#endif // FLIGHT_VALVEDRIVER_HPP

