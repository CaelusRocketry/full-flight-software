#include <flight/modules/drivers/PseudoThermoDriver.hpp>
#include <flight/modules/lib/logger_util.hpp>

// Ex.
// {
// Thermo 1
// {0, 3, 5, 7}, 
// Thermo 2
// {2, 5, 9, 11}, 
// }
PseudoThermoDriver::PseudoThermoDriver(vector<vector<int>> pins){
    for(unsigned int i = 0; i < pins.size(); i++){
        thermo_pins.push_back(pins[i][0]);
        thermo_vals.push_back((MIN_TEMP + MAX_TEMP) / 2);
    }
}

float PseudoThermoDriver::readSensor(int pin, float curr_reading){
    float new_val = curr_reading + (rand() % 20 - 10);
    return new_val;
}


void PseudoThermoDriver::read(){
    for(unsigned int i = 0; i < thermo_pins.size(); i++){
        thermo_vals[i] = readSensor(thermo_pins[i], thermo_vals[i]);
    }
}

float PseudoThermoDriver::getThermoValue(int pin) {
    // Find index of the pin in the pins list, and return the corresponding value.
    int idx = -1;
    for(unsigned int i = 0; i < thermo_pins.size(); i++){
        if(thermo_pins[i] == pin){
            idx = i;
            break;
        }
    }
    if(idx == -1){
        return 0.0;
    }

    return thermo_vals[idx];
}

