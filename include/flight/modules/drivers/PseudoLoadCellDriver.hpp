#ifndef FLIGHT_LOADCELLDRIVER_HPP
#define FLIGHT_LOADCELLDRIVER_HPP

#include <flight/modules/lib/Enums.hpp>

#include <vector>


using namespace std;

class PseudoLoadCellDriver {
private:
    vector<int> load_cell_pins;
    vector<float> force_vals;

    float readSensor(int pin, float curr_reading);

public:
    PseudoLoadCellDriver(vector<vector<int>> pins);
    void read();
    float getForceValue(int pin);
};

#endif // FLIGHT_VALVEDRIVER_HPP

