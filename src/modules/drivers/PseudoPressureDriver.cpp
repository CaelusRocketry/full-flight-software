#include <flight/modules/drivers/PseudoPressureDriver.hpp>
#include <flight/modules/lib/logger_util.hpp>
#include <flight/modules/lib/Util.hpp>
#include <flight/modules/mcl/Config.hpp>
#include <flight/modules/mcl/Registry.hpp>

PseudoPressureDriver::PseudoPressureDriver(vector<int> pins){
    for(unsigned int i = 0; i < pins.size(); i++){
        pressure_pins.push_back(pins[i]);
        pressure_vals.push_back(0);
    }
}

float PseudoPressureDriver::readSensor(int pin){
    Stage curr_stage = global_registry.general.stage;

    for (const auto& type_ : global_config.sensors.list) {
        string type = type_.first;
        for (const auto& location_ : type_.second) {
            string location = location_.first;
            RegistrySensorInfo &sensor_registry = global_registry.sensors[type][location];
            ConfigSensorInfo conf = location_.second;

            if(conf.pressure_pin == pin) {
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

void PseudoPressureDriver::read(){
    for(unsigned int i = 0; i < pressure_pins.size(); i++){
        pressure_vals[i] = readSensor(pressure_pins[i]);
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
