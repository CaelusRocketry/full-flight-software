#include <flight/modules/drivers/ValveDriver.hpp>
#include <flight/modules/lib/logger_util.hpp>

ValveDriver::ValveDriver(vector<int> pins){
    for(int i = 0; i < pins.size(); i++){
        valve_pins.push_back(pins[i]);
        valve_states.push_back(SolenoidState::CLOSED);
        valve_actuations.push_back(ActuationType::NONE);
        #ifndef DESKTOP
            #include "Arduino.h";
            pinMode(pins[i], OUTPUT);
            digitalWrite(pins[i], LOW);
        #endif
    }
}

int ValveDriver::getIndex(int pin){
    for(int i = 0; i < valve_pins.size(); i++){
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

// TODO: Add in pulsing and stuff

void ValveDriver::actuate(int pin, ActuationType actuation_type){
    int idx = getIndex(pin);
    valve_actuations[idx] = actuation_type;
    if(actuation_type == ActuationType::OPEN_VENT){
        valve_states[idx] = SolenoidState::OPEN;
    }
    else if(actuation_type == ActuationType::CLOSE_VENT){
        valve_states[idx] = SolenoidState::CLOSED;
    }
}

void writeVal(int pin, bool signal){
    #ifdef DESKTOP
        // TODO figure this out
    #else
        #include "Arduino.h";
        digitalWrite(pin, signal);
    #endif
}