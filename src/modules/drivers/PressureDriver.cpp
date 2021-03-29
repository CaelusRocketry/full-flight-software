#include <flight/modules/drivers/PressureDriver.hpp>
#include <flight/modules/lib/logger_util.hpp>
#ifndef DESKTOP
    #include "Arduino.h"
#endif

PressureDriver::PressureDriver(vector<int> pins){
    for(int i = 0; i < pins.size(); i++){
        pressure_pins.push_back(pins[i]);
        pressure_vals.push_back(MIN_PSI);
        #ifndef DESKTOP
            pinMode(pins[i], INPUT);
        #endif
    }
}

float map_value(float x, float in_min, float in_max, float out_min, float out_max) {
	float in_width = in_max - in_min;
	float out_width = out_max - out_min;
	float factor = out_width / in_width;
	return (x - in_min) * factor + out_min;
}

float PressureDriver::readSensor(int pin){
    float ret = 0.0;
    #ifdef DESKTOP
        // Pseudo sensor stuff
        ret = (float)pin;
    #else
        #include "Arduino.h"
        float pwmVal = analogRead(pin);
        float voltage = map_value(pwmVal, 0, 1024, 0, 5) + 0.0100;
        float psi = map_value(voltage, MIN_VOLTAGE, MAX_VOLTAGE, MIN_PSI, MAX_PSI);
        ret = psi - MIN_PSI;
    #endif
    return ret;
}

void PressureDriver::read(){
    for(int i = 0; i < pressure_pins.size(); i++){
        pressure_vals[i] = readSensor(pressure_pins[i]);
    }
}

float PressureDriver::getPressureValue(int pin){
    // Find index of the pin in the pins list, and return the corresponding value.
    int idx = -1;
    for(int i = 0; i < pressure_pins.size(); i++){
        if(pressure_pins[i] == pin){
            idx = i;
            break;
        }
    }
    if(idx == -1){
        return 0.0;
    }
    return pressure_vals[idx];
}
