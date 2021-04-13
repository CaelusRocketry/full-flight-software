#include <flight/modules/lib/Packet.hpp>
#include <flight/modules/lib/Util.hpp>
#include <ArduinoJson.h>
#include <flight/modules/lib/Util.hpp>
#include <flight/modules/lib/logger_util.hpp>
// #include <iostream> 

void Packet::to_string(string& output, const Packet& packet) {
    Util::doc.clear();
    print("s1");
    
    Util::doc["priority"] = static_cast<int>(packet.priority);
    print("s2");
    Util::doc["timestamp"] = packet.timestamp;
    print("s3");

    string logs;
    print("s4");
    for(Log l : packet.logs) {
        print("s4.5");
        try {
            Log::to_string(logs, l);
        }
        catch(std::exception& e) {
            print(":((((((((9 ERORRROR");
            print(e.what());
        }
    }
    print("s5");
    Util::doc["logs"] = logs;
    print("s6");
    serializeJson(Util::doc, output);
    print("s7");
}

void Packet::from_json(const JsonObject& j, Packet& packet) {
    // First, get timestamp and log priority
    long double timestamp = j["timestamp"].as<long double>();
    auto priority = static_cast<LogPriority>(j["priority"].as<int>());
    packet = Packet(priority, timestamp);
    // Then, add logs
    string temp;
    serializeJson(j["logs"].as<JsonArray>(), temp);
    print("Log array: " + temp);
    // for(JsonObject json_log : j["logs"].as<JsonArray>()) {
    JsonArray temp2 = j["logs"].as<JsonArray>();
    print("----------------------------------------");
    for(JsonArray::iterator it=temp2.begin(); it != temp2.end(); ++it){
        JsonObject json_log = it->as<JsonObject>();
        if(json_log.isNull()){
            continue;
        }
        string ankit;
        Util::serialize(json_log, ankit);
        print("Ankit: " + ankit);
        Log l;
        Log::from_json(json_log, l);

        string srikar;
        Log::to_string(srikar, l);
        print("Srikar: " + srikar);

        packet.logs.push_back(l);
    }
}

void Packet::add(const Log& log) {
    logs.push_back(log);
}

vector<Log> Packet::getLogs() {
    return this->logs;
}
