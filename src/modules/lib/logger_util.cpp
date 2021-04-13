#include <iostream>
#include <string>

#ifndef DESKTOP
    #include "Arduino.h"
#endif

void print(std::string message) {
    #ifdef DESKTOP
        std::cout << message << std::endl;
    #else
        Serial.println(String(message.c_str()));
    #endif
}