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
    print("a1");
    StaticJsonDocument<1500> newDoc;
    print("a2");
    JsonObject object = newDoc.to<JsonObject>();
    print("a3");
    JsonObject messageObject = newDoc.createNestedObject("message");
    print("a4");
    JsonObject msgLog = log.getMessage();
    print("a5");
    if(msgLog.size() == 0) {
        print("daskaasdasdasdadasd [bruh moment onii chan");
    }
    else {
        print("sizeeeeeee " + Util::to_string((int) msgLog.size()));
        for(JsonPair kv : msgLog) {
            print(string(kv.key().c_str()));
            print(string(kv.value().as<string>()));
        }
    }
    try {
        string msg;
        print("??????????");
        serializeJson(msgLog, msg);
        print("bruh");
        print(msg);
    }
    catch(std::exception& e) {
        print("SDFKJLLLLL ERORROROROOROROR");
        std::cout << e.what();
    }
    
    for(JsonPair kv : msgLog){
        print("ADI");
        string key = kv.key().c_str();
        print(key);
        print("ADI2");
        string value = kv.value().as<string>();
        print(value);
        print("ADI3");
        if(value.find("{") != string::npos){
            print("HI");
            JsonObject depth2 = messageObject.createNestedObject(key);
            for(JsonPair kv2 : kv.value().as<JsonObject>()){
                print("a6");
                string key2 = kv2.key().c_str();
                string value2 = kv2.value().as<string>();
                depth2[key2] = value2;
            }
        }
        else{
            print("a7");
            messageObject[key] = value;
        }
    }
    print("a8");
    object["header"] = log.getHeader();
    print("a9");
    object["timestamp"] = log.getTimestamp();
    print("a10");
    print("DONE");

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

    serializeJson(newDoc, output);
    print("a11 serialize");
    print(output);
    // int a = 1;
    // int b = 0;
    // int c = a / b;
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