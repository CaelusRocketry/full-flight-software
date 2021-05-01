#include <iostream>
#include <string>

#ifndef DESKTOP
    #include "Arduino.h"
#endif

// TODO: Add priorities to print statements
void print(std::string message) {
    if(true){
        #ifdef DESKTOP
            // std::cout << message << std::endl;
        #else
            // Serial.println(String(message.c_str()));
        #endif
    }
}

void printCritical(std::string message) {
    if(true){
        #ifdef DESKTOP
            std::cout << message << std::endl;
        #else
            Serial.println(String(message.c_str()));
        #endif
    }
}

void printEssential(std::string message) {
    if(true){
        #ifdef DESKTOP
            std::cout << message << std::endl;
        #else
            Serial.println(String(message.c_str()));
        #endif
    }
}
