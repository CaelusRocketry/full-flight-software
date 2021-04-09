#include <flight/modules/lib/Packet.hpp>
#include <flight/modules/lib/Util.hpp>
#include <ArduinoJson.h>
#include <flight/modules/lib/Util.hpp>

void Packet::to_string(string& output, const Packet& packet) {
    Util::doc.clear();
    
    Util::doc["priority"] = static_cast<int>(packet.priority);
    Util::doc["timestamp"] = packet.timestamp;

    string logs;
    for(Log l : packet.logs) {
        Log::to_string(logs, l);
    }

    Util::doc["logs"] = logs;
    serializeJson(Util::doc, output);
}

void Packet::from_json(const JsonObject& j, Packet& packet) {
    // First, get timestamp and log priority
    long double timestamp = j["timestamp"].as<long double>();
    auto priority = static_cast<LogPriority>(j["priority"].as<int>());
    packet = Packet(priority, timestamp);
    // Then, add logs
    for(JsonObject json_log : j["logs"].as<JsonArray>()) {
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
