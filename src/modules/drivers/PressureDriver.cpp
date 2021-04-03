#ifndef DESKTOP
    #include <flight/modules/drivers/PressureDriver.hpp>
    #include <flight/modules/lib/logger_util.hpp>
    #include <flight/modules/lib/Util.hpp>

    #include "Arduino.h"


    PressureDriver::PressureDriver(vector<int> pins){
        for(unsigned int i = 0; i < pins.size(); i++){
            pressure_pins.push_back(pins[i]);
            pressure_vals.push_back(MIN_PSI);
            pinMode(pins[i], INPUT);
        }
    }

    float map_value(float x, float in_min, float in_max, float out_min, float out_max) {
        float in_width = in_max - in_min;
        float out_width = out_max - out_min;
        float factor = out_width / in_width;
        return (x - in_min) * factor + out_min;
    }

    float PressureDriver::readSensor(int pin){
        float pwmVal = analogRead(pin);
        if(pin == 15){
            Serial.println(pwmVal);
        }
        float voltage = map_value(pwmVal, 147, 1024, 0.5, 4.5) + 0.0100;
        if(pin == 15){
            Serial.println(voltage);
        }
        float psi = map_value(voltage, 0.5, 4.5, 15, 1000) - 15;
        if(pin == 15){
            Serial.println(psi);
        }
        return psi;
    }

    void PressureDriver::read(){
        for(unsigned int i = 0; i < pressure_pins.size(); i++){
            pressure_vals[i] = readSensor(pressure_pins[i]);
        }
    }

    float PressureDriver::getPressureValue(int pin){
        // Find index of the pin in the pins list, and return the corresponding value.
        int idx = Util::getIndex(pressure_pins, pin);
        // int idx = -1;
        if(idx == -1){
            return 0.0;
        }
        return pressure_vals[idx];
    }

#endif
