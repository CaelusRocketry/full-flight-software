#include <flight/modules/drivers/ValveDriver.hpp>
#include <flight/modules/lib/logger_util.hpp>
#include <flight/modules/lib/logger_util.hpp>
#include <flight/modules/lib/Util.hpp>
#include <flight/modules/lib/Constants.hpp>
#ifdef DESKTOP
    #define LOW 0
    #define HIGH 1
#else
    #include "Arduino.h"
#endif

ValveDriver::ValveDriver(vector<ConfigValveInfo> valve_infos){
    for(unsigned int i = 0; i < valve_infos.size(); i++){
        ConfigValveInfo info = valve_infos[i];
        int pin = info.pin;
        bool is_nc = info.is_nc;

        if(is_nc){
            valve_states.push_back(SolenoidState::CLOSED);
        }
        else{
            valve_states.push_back(SolenoidState::OPEN);
        }
        valve_actuations.push_back(ActuationType::NONE);
        valve_pins.push_back(pin);
        time_starts.push_back(-1.0);
        valve_is_nc.push_back(is_nc);
        is_specialing.push_back(false);

        #ifndef DESKTOP
            pinMode(pin, OUTPUT);
            digitalWrite(pin, LOW);
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
void ValveDriver::handlePulsing(){
    for(unsigned int i = 0; i < valve_pins.size(); i++){ // Only applies to valves that are currently pulsing
        if(valve_actuations[i] == ActuationType::PULSE){
            long double currTime = Util::getTime();
            long double startTime = time_starts[i];
            if(currTime - startTime > VALVE_PULSE_TIME){
                actuate(valve_pins[i], ActuationType::CLOSE_VENT);
            }
        }
    }
}

// Special handling for NC valves
void ValveDriver::handleSpecial(){
    for(unsigned int i = 0; i < valve_pins.size(); i++){
        if(valve_actuations[i] == ActuationType::OPEN_VENT && valve_is_nc[i]){ // Only applies to NC valves that are open venting
            long double currTime = Util::getTime();
            long double startTime = time_starts[i];
            if(is_specialing[i] && currTime - startTime > VALVE_SPECIAL_OPEN){
                writeVal(valve_pins[i], LOW);
                time_starts[i] = currTime;
            }
            else if(!is_specialing[i] && currTime - startTime > VALVE_SPECIAL_CLOSE){
                writeVal(valve_pins[i], HIGH);
                time_starts[i] = currTime;
            }
        }
    }
}

void ValveDriver::control(){
    handlePulsing();
    handleSpecial();
}

void ValveDriver::actuate(int pin, ActuationType actuation_type){
    int idx = getIndex(pin);
    
    valve_actuations[idx] = actuation_type;
    if(actuation_type == ActuationType::OPEN_VENT || actuation_type == ActuationType::PULSE){
        valve_states[idx] = SolenoidState::OPEN;
        if(valve_is_nc[idx]){
            writeVal(pin, HIGH);
        }
        else{
            writeVal(pin, LOW);
        }
    }
    else if(actuation_type == ActuationType::CLOSE_VENT){
        valve_states[idx] = SolenoidState::CLOSED;
        if(valve_is_nc[idx]){
            writeVal(pin, LOW);
        }
        else{
            writeVal(pin, HIGH);
        }
    }
    for(SolenoidState i : valve_states) {
        print(Util::to_string((int) i));
    }
}

void ValveDriver::writeVal(int pin, int signal){
    printEssential("Writing " + Util::hex(pin) + " with signal " + Util::hex(signal));
    #ifndef DESKTOP
        digitalWrite(pin, signal);
    #endif
}
