#include <flight/modules/drivers/PseudoThermoDriver.hpp>
#include <flight/modules/lib/logger_util.hpp>
#include <flight/modules/mcl/Config.hpp>
#include <flight/modules/mcl/Registry.hpp>
#include <algorithm>

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

float PseudoThermoDriver::readSensor(int pin){
    Stage curr_stage = global_registry.general.stage;

    for (const auto& type_ : global_config.sensors.list) {
        string type = type_.first;
        for (const auto& location_ : type_.second) {
            string location = location_.first;
            RegistrySensorInfo &sensor_registry = global_registry.sensors[type][location];
            ConfigSensorInfo conf = location_.second;

            vector<int> pins = conf.thermo_pins;

            if(find(pins.begin(), pins.end(), pin) != pins.end()) {
                float return_val = 0;

                if(curr_stage == Stage::WAITING)
                {
                    int range = conf.boundaries.waiting.warn.upper - conf.boundaries.waiting.warn.lower;
                    return_val = rand() % range + conf.boundaries.waiting.warn.lower;

                }
                else if(curr_stage == Stage::PRESSURIZATION)
                {
                    int range = conf.boundaries.pressurization.warn.upper - conf.boundaries.pressurization.warn.lower;
                    return_val = rand() % range + conf.boundaries.pressurization.warn.lower;
                }
                else if(curr_stage == Stage::AUTOSEQUENCE)
                {
                    int range = conf.boundaries.autosequence.warn.upper - conf.boundaries.autosequence.warn.lower;
                    return_val = rand() % range + conf.boundaries.autosequence.warn.lower;
                }
                else if(curr_stage == Stage::POSTBURN)
                {
                    int range = conf.boundaries.postburn.warn.upper - conf.boundaries.postburn.warn.lower;
                    return_val = rand() % range + conf.boundaries.postburn.warn.lower;
                }
                return return_val;
            }
        }
    }
    
    return 0;
}


void PseudoThermoDriver::read(){
    for(unsigned int i = 0; i < thermo_pins.size(); i++){
        thermo_vals[i] = readSensor(thermo_pins[i]);
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

