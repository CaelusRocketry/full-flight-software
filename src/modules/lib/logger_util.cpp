#include <iostream>
#include <string>
#include <fstream>

#ifndef DESKTOP
    #include "Arduino.h"
#endif

#ifdef TEENSY
    // #include <SD_ts.h>
    #include <SD.h>
#endif

void saveData(std::string message){
    // SD stuff
    File savefile;
    savefile = SD.open("printbox.txt", FILE_WRITE);

    if (savefile) // SD card successfully opened
    {
        std::string output = message;
        savefile.println(output.c_str());
        savefile.close();
    }
}

// TODO: Add priorities to print statements
void print(std::string message) {
    if(false){
        #ifdef DESKTOP
            std::cout << message << std::endl;
        #else
            Serial.println(String(message.c_str()));
            saveData(message);
        #endif
    }
}

void printCritical(std::string message) {
    if(false){
        #ifdef DESKTOP
            std::cout << message << std::endl;
        #else
            Serial.println(String(message.c_str()));
            saveData(message);
        #endif
    }
}

void printEssential(std::string message) {
    if(true){
        #ifdef DESKTOP
            std::cout << message << std::endl;
        #else
            Serial.println(String(message.c_str()));
            saveData(message);
        #endif
    }
}
