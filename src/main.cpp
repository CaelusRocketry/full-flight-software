#include <flight/modules/lib/logger_util.hpp> // external logging utility
#include <flight/modules/mcl/Supervisor.hpp> // Includes 'Supervisor' type

using namespace std; // allows access to standard library utilities


#ifndef DESKTOP
    #include <Arduino.h>
#endif
// #include <Arduino.h>

int main(int argc, char** argv) { // argc = len(argv) in python; char** argv = actual arguments
    print("INFO: Starting Application"); 

    // pinMode(13, OUTPUT);
    // digitalWrite(13, HIGH);

    // Serial4.begin(9600);
    // Serial.begin(9600);
    // unsigned long last_sent_time = millis();
    // while(true){
    //     if(millis() > last_sent_time + 4000){
    //         Serial4.println("HELLO ITS THE XBEE");
    //         Serial.println("HELLO ITS THE XBEE");
    //         last_sent_time = millis();
    //     }
    //     while(Serial4.available()){
    //         Serial.println(Serial4.read());
    //     }
    // }
    
    Supervisor supervisor; // Creates a new instance of 'Supervisor'
    supervisor.initialize();
    supervisor.run();

    print("INFO: Created supervisor");

    return 0; // return exit code (0=application completed successfully)
}
