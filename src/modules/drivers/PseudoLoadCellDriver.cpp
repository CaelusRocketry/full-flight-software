#include <flight/modules/drivers/PseudoLoadCellDriver.hpp>
#include <flight/modules/lib/logger_util.hpp>

// Ex.
// {
// Thermo 1
// {0, 3, 5, 7}, 
// Thermo 2
// {2, 5, 9, 11}, 
// }
PseudoLoadCellDriver::PseudoLoadCellDriver(vector<vector<int>> pins){
    for(unsigned int i = 0; i < pins.size(); i++){
        load_cell_pins.push_back(pins[i][0]);
        force_vals.push_back(10.0);
    }
}

float PseudoLoadCellDriver::readSensor(int pin, float curr_reading){
    float new_val = curr_reading + (rand() % 20 - 10);
    return new_val;
}


void PseudoLoadCellDriver::read(){
    for(unsigned int i = 0; i < load_cell_pins.size(); i++){
        force_vals[i] = readSensor(load_cell_pins[i], force_vals[i]);
    }
}

float PseudoLoadCellDriver::getForceValue(int pin) {
    // Find index of the pin in the pins list, and return the corresponding value.
    int idx = -1;
    for(unsigned int i = 0; i < load_cell_pins.size(); i++){
        if(load_cell_pins[i] == pin){
            idx = i;
            break;
        }
    }
    if(idx == -1){
        return 0.0;
    }

    return force_vals[idx];
}

