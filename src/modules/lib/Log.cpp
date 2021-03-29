#include <iostream>
#include <fstream>
#include <flight/modules/lib/Log.hpp>
#include <ArduinoJson.h>
#include <flight/modules/lib/Util.hpp>

void Log::to_string(string &output, const Log& log) {
    Util::doc.clear();
    Util::doc["header"] = log.getHeader();
    Util::doc["message"] = log.getMessage();
    Util::doc["timestamp"] = log.getTimestamp();
    serializeJson(Util::doc, output);
}

void Log::from_json(const JsonObject& j, Log& log) {
    string header = j["header"].as<string>();
    JsonObject message = j["message"];
    long double timestamp = j["timestamp"].as<long double>();
    log = Log(header, message, timestamp);
}

// Log string to black_box.txt
void Log::save(const string& filename) const {
    ofstream file;
    file.open(filename, fstream::in | fstream::out | fstream::app);

    if(!file) {
        file.open(filename, fstream::in | fstream::out | fstream::trunc);
    }

    
    string output;
    to_string(output, *this); 

    file << output << endl;
    file.close();
}

Log Log::copy(){
    // Create a copy of the log
    return Log(header, message, timestamp, false);
}

string Log::getHeader() const {
    return header;
}

JsonObject Log::getMessage() const {
    return message;
}

long double Log::getTimestamp() const {
    return timestamp;
}