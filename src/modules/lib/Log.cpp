#include <iostream>
#include <fstream>
#include <flight/modules/lib/Log.hpp>
#include <ArduinoJson.h>
#include <flight/modules/lib/Util.hpp>
#include <flight/modules/lib/logger_util.hpp>
// #include <functional>

void Log::to_string(string& output, const Log& log) {
    // print("TO STRING METHOD");
    // print("Log details:");
    // print(log.getHeader());
    // string msg;
    // serializeJson(log.getMessage(), msg);
    // print(msg);
    // print(Util::to_string(log.getTimestamp()));

    // JsonObject& msgLog = std::reference_wrapper<ObjectRef>(log.getMessage()).get();
    // Util::doc.clear();


    // JsonObject messageObject = newDoc.createNestedObject("message");
    // print("a4");
    // string msgLog = log.getMessage();
    // print("a5");
    // print(Util::to_string((int)msgLog.size()));
    // print("whats up");
    // if(msgLog.size() == 0) {
    //     print("Empty msgLog");
    // }
    // else {
    //     print("sizeeeeeee " + Util::to_string((int) msgLog.size()));
    //     for(JsonPair kv : msgLog) {
    //         print(string(kv.key().c_str()));
    //         print(string(kv.value().as<string>()));
    //     }
    // }
    // print("ayyo");
    // try {
    //     string msg;
    //     print("??????????");
    //     ArduinoJson::serializeJson(msgLog, msg);
    //     print("bruh");
    //     print(msg);
    // }
    // catch(std::exception& e) {
    //     print("SDFKJLLLLL ERORROROROOROROR");
    //     std::cout << e.what();
    // }
    
    // for(JsonPair kv : msgLog){
    //     print("ADI");
    //     string key = kv.key().c_str();
    //     print(key);
    //     print("ADI2");
    //     string value = kv.value().as<string>();
    //     print(value);
    //     print("ADI3");
    //     if(value.find("{") != string::npos){
    //         print("HI");
    //         JsonObject depth2 = messageObject.createNestedObject(key);
    //         for(JsonPair kv2 : kv.value().as<JsonObject>()){
    //             print("a6");
    //             string key2 = kv2.key().c_str();
    //             string value2 = kv2.value().as<string>();
    //             depth2[key2] = value2;
    //         }
    //     }
    //     else{
    //         print("a7");
    //         messageObject[key] = value;
    //     }
    // }


    // object["thing"] = msgLog;
    // serializeJson(object, output);
    // print(output);
    // print("REEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEe");
    // Util::doc.clear();
    // Util::doc["header"] = log.getHeader();
    // Util::doc["message"] = msgLog;
    // Util::doc["timestamp"] = log.getTimestamp();


    // print("AFTER THE TO STRING METHOD");
    // print("Log details:");
    // print(log.getHeader());
    // string msg2;
    // serializeJson(log.getMessage(), msg2);
    // print(msg2);
    // print(Util::to_string(log.getTimestamp()));

    // print("Creating log from string");
    StaticJsonDocument<1500> newDoc;
    JsonObject object = newDoc.to<JsonObject>();
    object["header"] = log.getHeader();
    object["timestamp"] = log.getTimestamp();
    object["message"] = log.getMessage();
    // print("Done creating Log from string");
    ArduinoJson::serializeJson(newDoc, output);
    // print(output);
    // int a = 1;
    // int b = 0;
    // int c = a / b;
}

void Log::from_json(const JsonObject& j, Log& log) {
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

string Log::getMessage() const {
    return message;
}

long double Log::getTimestamp() const {
    return timestamp;
}