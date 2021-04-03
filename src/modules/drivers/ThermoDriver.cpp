#ifndef DESKTOP

    #include <flight/modules/drivers/ThermoDriver.hpp>
    #include <flight/modules/lib/logger_util.hpp>

    #include "Arduino.h"
    #include <Adafruit_MAX31856.h>


    // Ex.
    // {
    // Thermo 1
    // {0, 3, 5, 7}, 
    // Thermo 2
    // {2, 5, 9, 11}, 
    // }
    ThermoDriver::ThermoDriver(vector<vector<int>> pins){
        for(unsigned int i = 0; i < pins.size(); i++){
            for (int j = 0; j < 4; j++) {
                thermo_pins.push_back(pins[i][j]);
            }
            thermo_vals.push_back(MIN_TEMP);
            maxthermo = new Adafruit_MAX31856(pins[i][0], pins[i][1], pins[i][2], pins[i][3]);
            // Begin making readings
            maxthermo->begin();
        }
    }

    void ThermoDriver::read(){
        for(unsigned int i = 0; i < thermo_pins.size(); i++){
            thermo_vals[i] = readSensor(thermo_pins[i]);
        }
    }

    float ThermoDriver::getThermoValue(int pin) {
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

    float ThermoDriver::readSensor(int pin){
        float ret = 0.0;
        ret = this->maxthermo->readThermocoupleTemperature();
        uint8_t fault = this->maxthermo->readFault();

        if (fault) {
            ret = -420;
        }

        return ret;
    }

#endif