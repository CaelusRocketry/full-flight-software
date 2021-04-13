#include <flight/modules/lib/Packet.hpp>
#include <flight/modules/lib/Util.hpp>
#include <ArduinoJson.h>
#include <flight/modules/lib/Util.hpp>
#include <flight/modules/lib/logger_util.hpp>
// #include <iostream> 

void Packet::to_string(string& output, const Packet& packet) {
    print("Converting packet to string");
    Util::doc.clear();
    Util::doc["priority"] = static_cast<int>(packet.priority);
    Util::doc["timestamp"] = packet.timestamp;
    string logs;
    for(Log l : packet.logs) {
        try {
            Log::to_string(logs, l);
        }
        catch(std::exception& e) {
            print(":((((((((9 ERORRROR");
            print(e.what());
        }
    }
    Util::doc["logs"] = logs;
    ArduinoJson::serializeJson(Util::doc, output);
    print("Converted packet to string");
}

void Packet::from_json(const JsonObject& j, Packet& packet) {
    // First, get timestamp and log priority
    long double timestamp = j["timestamp"].as<long double>();
    auto priority = static_cast<LogPriority>(j["priority"].as<int>());
    packet = Packet(priority, timestamp);
    // Then, add logs
    string temp;
    ArduinoJson::serializeJson(j["logs"].as<JsonArray>(), temp);
    print("Log array: " + temp);
    // for(JsonObject json_log : j["logs"].as<JsonArray>()) {
    JsonArray temp2 = j["logs"].as<JsonArray>();
    print("----------------------------------------");
    for(JsonArray::iterator it=temp2.begin(); it != temp2.end(); ++it){
        JsonObject json_log = it->as<JsonObject>();
        if(json_log.isNull()){
            continue;
        }
        Log l;
        Log::from_json(json_log, l);
        packet.logs.push_back(l);
    }
}

void Packet::add(const Log& log) {
    logs.push_back(log);
}

vector<Log> Packet::getLogs() {
    return this->logs;
}
