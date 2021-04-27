#include <iostream>
#include <fstream>
#include <flight/modules/lib/Log.hpp>
#include <ArduinoJson.h>
#include <flight/modules/lib/Util.hpp>
#include <flight/modules/lib/logger_util.hpp>
// #include <functional>

void Log::to_string(string& output, const Log& log) {
    // print("Creating log from string");
    StaticJsonDocument<1500> newDoc;
    JsonObject object = newDoc.to<JsonObject>();
    object["header"] = log.getHeader();
    object["timestamp"] = (double) log.getTimestamp();
    object["message"] = log.getMessage();

    // Serial.println("HERE");
    // Serial.println((double) object["timestamp"]);
    // Serial.println((double) log.getTimestamp());
    // print("Done creating Log from string");
    ArduinoJson::serializeJson(newDoc, output);
    // print(output);
}

void Log::from_json(const JsonObject& j, Log& log) {
    string output;
    serializeJson(j, output);

    string header = j["header"].as<string>();
    JsonObject message = j["message"];
    double timestamp = j["timestamp"].as<double>(); // TODO: Timestamp is an int for some reason?


    string msg, messageString;
    ArduinoJson::serializeJson(j, msg);
    Util::serialize(j, messageString);
    // print("Message: " + msg);
    // print("Message 2: " + j["message"].as<string>());
    log = Log(header, messageString, timestamp);
}

// Log string to black_box.txt
void Log::save(const string& filename) const {
     #ifdef DESKTOP
        ofstream savefile;
        savefile.open(filename);
        string output;
        to_string(output, *this);
        savefile << output + "\n";
        savefile.close();
    #endif

    #ifdef TEENSY
        print("\n\n\n\n\n\nWRITING STUFF TO SD CARD !!!\n\n\n\n\n\n");
        File savefile;
        savefile = SD.open("blackbox.txt", FILE_WRITE);

        if (savefile) // it opened OK
        {
            print("Saving file! Timestamp:");
            Serial.println((double) timestamp);
            string output;
            to_string(output, *this);
            
            savefile.println(output.c_str());
            savefile.close();
            print("Done");
        }
        else {
            print("Error opening file:");
            print("blackbox.txt");
        }
    #endif
}

Log Log::copy(){
    // Create a copy of the log
    return Log(header, message, timestamp, false);
}

string Log::getHeader() const {
    return header;
}

string Log::getMessage() const {
    return message;
}

long double Log::getTimestamp() const {
    return timestamp;
}