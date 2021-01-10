#include <Logger/logger_util.h>
#include <flight/modules/drivers/Arduino.hpp>
#include <flight/modules/drivers/PseudoSensor.hpp>
#include <flight/modules/drivers/PseudoValve.hpp>

void Arduino::reset(){
    if (name == "PseudoSensor"){
        arduino = new PseudoSensor();
    } else if(name == "PseudoValve") {
        arduino = new PseudoValve();
    } else {
        log("REEEE UNKNOWN ARDUINO TYPE");
    }
}

unsigned char* Arduino::read() {
    return arduino->read();
}

void Arduino::write(unsigned char* msg) {
    if(msg[0] == 254) { // command number to actuate a valve
        unsigned char new_msg[2];
        new_msg[0] = msg[1];
        new_msg[1] = msg[2];
        arduino->write(new_msg);
    }
}
