#include <iostream>
#include <string>

void print(std::string message) {
    #ifdef DESKTOP
        std::cout << message << std::endl;
    #else
        #include "Arduino.h"
        Serial.println(message);
    #endif
}