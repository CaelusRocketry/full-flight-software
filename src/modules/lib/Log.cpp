#include <iostream>
#include <fstream>
#include <flight/modules/lib/Log.hpp>
#include <ArduinoJson.h>
#include <flight/modules/lib/Util.hpp>
#include <flight/modules/lib/logger_util.hpp>
// #include <functional>

void Log::to_string(string& output, const Log& log) {
    print("TO STRING METHOD");
    print("Log details:");
    print(log.getHeader());
    string msg;
    serializeJson(log.getMessage(), msg);
    print(msg);
    print(Util::to_string(log.getTimestamp()));

    // JsonObject& msgLog = std::reference_wrapper<ObjectRef>(log.getMessage()).get();
    JsonObject msgLog = log.getMessage();
    Util::doc.clear();
    JsonObject object = Util::doc.to<JsonObject>();
    object["thing"] = msgLog;
    serializeJson(object, output);
    print(output);
    print("REEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEe");
    int a = 1;
    int b = 0;
    a / b;
    Util::doc.clear();
    Util::doc["header"] = log.getHeader();
    Util::doc["message"] = msgLog;
    Util::doc["timestamp"] = log.getTimestamp();


    print("AFTER THE TO STRING METHOD");
    print("Log details:");
    print(log.getHeader());
    string msg2;
    serializeJson(log.getMessage(), msg2);
    print(msg2);
    print(Util::to_string(log.getTimestamp()));

    serializeJson(Util::doc, output);
}

void Log::from_json(const JsonObject& j, Log& log) {
    string header = j["header"].as<string>();
    JsonObject message = j["message"];
    double timestamp = j["timestamp"].as<double>(); // TODO: Timestamp is an int for some reason?
    string msg;
    serializeJson(j, msg);
    print("Message: " + msg);
    print("Message 2: " + j["message"].as<string>());
    log = Log(header, message, timestamp);
}

// Log string to black_box.txt
void Log::save(const string& filename) const {
    // ofstream file;
    // file.open(filename, fstream::in | fstream::out | fstream::app);

    // if(!file) {
    //     file.open(filename, fstream::in | fstream::out | fstream::trunc);
    // }

    
    string output;
    to_string(output, *this); 

    // file << output << endl;
    // file.close();
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