#include <flight/modules/lib/Packet.hpp>
#include <flight/modules/lib/Util.hpp>
#include <ArduinoJson.h>

void to_string(string& output, const Packet& packet) {
    doc.clear();
    
    doc["priority"] = packet.priority;
    doc["timestamp"] = packet.timestamp;

    JsonArray array = doc.to<JsonArray>();
    string logs;
    for(Log l : packet.logs) {
        to_string(logs, l);
    }

    doc["logs"] = logs;
    SerializeJson(doc, output);
}

void from_json(const JsonObject& j, Packet& packet) {
    // First, get timestamp and log priority
    long double timestamp = j["timestamp"].as<long double>();
    auto priority = static_cast<LogPriority>(j["priority"].as<int>());
    packet = Packet(priority, timestamp);
    // Then, add logs
    for(JsonObject json_log : j["logs"].as<JsonObject>()) {
        Log l;
        from_json(json_log, l);
        packet.logs.push_back(l);
    }
}

void Packet::add(const Log& log) {
    logs.push_back(log);
}

vector<Log> Packet::getLogs() {
    return this->logs;
}
