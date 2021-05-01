#include <flight/modules/lib/logger_util.hpp> // external logging utility
#include <flight/modules/mcl/Supervisor.hpp> // Includes 'Supervisor' type

using namespace std; // allows access to standard library utilities


#ifndef DESKTOP
    #include <Arduino.h>
#endif


int main(int argc, char** argv) { // argc = len(argv) in python; char** argv = actual arguments
    #ifndef DESKTOP
        Serial.begin(9600);
    #endif

    #ifdef TEENSY
        pinMode(13, OUTPUT);
        digitalWrite(13, HIGH);
        print("Initializing SD card");
        Serial.println(BUILTIN_SDCARD);
        if(SD.begin(BUILTIN_SDCARD)){
            Serial.println("Initialization success");
        }
        else{
            Serial.println("Init failed");
        }
    #endif

    print("INFO: Starting Application"); 
    
    Supervisor supervisor; // Creates a new instance of 'Supervisor'
    supervisor.initialize();
    supervisor.run();

    print("INFO: Created supervisor");

    return 0; // return exit code (0=application completed successfully)
}
