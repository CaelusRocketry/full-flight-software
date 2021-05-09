#include <flight/modules/drivers/ValveDriver.hpp>
#include <flight/modules/lib/logger_util.hpp>
#include <flight/modules/lib/logger_util.hpp>
#include <flight/modules/lib/Util.hpp>
#ifndef DESKTOP
    #include "Arduino.h"
#endif

ValveDriver::ValveDriver(vector<int> pins){
    for(unsigned int i = 0; i < pins.size(); i++){
        valve_pins.push_back(pins[i]);
        valve_states.push_back(SolenoidState::CLOSED);
        valve_actuations.push_back(ActuationType::NONE);
        #ifndef DESKTOP
            pinMode(pins[i], OUTPUT);
            digitalWrite(pins[i], LOW);
        #endif
    }
    NUM_VALVES = valve_pins.size();
}

int ValveDriver::getIndex(int pin){
    for(int i = 0; i < NUM_VALVES; i++){
        if(valve_pins[i] == pin){
            return i;
        }
    }
    return -1;
}

SolenoidState ValveDriver::getSolenoidState(int pin){
    int idx = getIndex(pin);
    if(idx == -1){
        return SolenoidState::CLOSED;
    }
    return valve_states[idx];
}

ActuationType ValveDriver::getActuationType(int pin){
    int idx = getIndex(pin);
    if(idx == -1){
        return ActuationType::NONE;
    }
    return valve_actuations[idx];
}

// TODO: Add in pulsing and special
// void ValveDriver::handlePulsing(){
//     for(unsigned int i = 0; i < pins.size(); i++){

//     }
// }

// void ValveDriver::handleSpecial(){
    
// }

void ValveDriver::actuate(int pin, ActuationType actuation_type){
    int idx = getIndex(pin);
    
    valve_actuations[idx] = actuation_type;
    if(actuation_type == ActuationType::OPEN_VENT){
        valve_states[idx] = SolenoidState::OPEN;

        #ifndef DESKTOP
            writeVal(pin, HIGH);
        #endif
    }
    else if(actuation_type == ActuationType::CLOSE_VENT){
        valve_states[idx] = SolenoidState::CLOSED;

        #ifndef DESKTOP
            writeVal(pin, LOW);
        #endif
    }
    for(SolenoidState i : valve_states) {
        print(Util::to_string((int) i));
    }
}

void ValveDriver::writeVal(int pin, int signal){
    printEssential("writing " + Util::hex(pin) + " with signal " + Util::hex(signal));

     #ifndef DESKTOP
        digitalWrite(pin, signal);
    #endif
}