#include <flight/modules/drivers/PseudoPressureDriver.hpp>
#include <flight/modules/lib/logger_util.hpp>
#include <flight/modules/lib/Util.hpp>

PseudoPressureDriver::PseudoPressureDriver(vector<int> pins){
    for(unsigned int i = 0; i < pins.size(); i++){
        pressure_pins.push_back(pins[i]);
        pressure_vals.push_back(0);
    }
}

float PseudoPressureDriver::readSensor(int pin, int curr_val){
    float new_val = curr_val + (rand() % 20 - 10);
    return new_val;
}

void PseudoPressureDriver::read(){
    for(unsigned int i = 0; i < pressure_pins.size(); i++){
        pressure_vals[i] = readSensor(pressure_pins[i], pressure_vals[i]);
    }
}

float PseudoPressureDriver::getPressureValue(int pin){
    // Find index of the pin in the pins list, and return the corresponding value.
    int idx = Util::getIndex<int>(pressure_pins, pin);
    if(idx == -1){
        return 0.0;
    }
    return pressure_vals[idx];
}
