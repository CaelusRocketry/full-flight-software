#include <iostream>
#include <fstream>
#include <flight/modules/lib/Log.hpp>
#include <ArduinoJson.h>


void to_string(string &output, const Log& log) {
    doc.clear()
    doc["header"] = log.getHeader();
    doc["message"] = log.getMessage();
    doc["timestamp"] = log.getTimestamp();
    SerializeJson(doc, output);
}

void from_json(const JsonObject& j, Log& log) {
    string header = j["header"].as<string>();
    string message = j["message"].as<string>();
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