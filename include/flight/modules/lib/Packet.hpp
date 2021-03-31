#ifndef FLIGHT_PACKET_HPP
#define FLIGHT_PACKET_HPP

#include <string>
#include <vector>
#include <chrono>
#include <flight/modules/lib/Enums.hpp>
#include <flight/modules/lib/Log.hpp>
#include <ArduinoJson.h>


using namespace std;
using ArduinoJson::StaticJsonDocument;

// class Packet;

// void to_string(string& output, const Packet& packet);
// void from_json(const JsonObject& j, Packet& packet);

// Packet class groups together logs of similar priority
class Packet {
private:

public:
    vector<Log> logs;
    LogPriority priority;
    long double timestamp;

    Packet() = default;

    explicit Packet(LogPriority logPriority, long double timestamp)
        : priority(logPriority),
          timestamp(timestamp){}

    void add(const Log& log);
    vector<Log> getLogs();

    static void to_string(string& output, const Packet& packet);
    static void from_json(const JsonObject& j, Packet& packet);

    friend void to_json_doc(StaticJsonDocument<5000>& j, const Packet& packet);
    friend void from_json(const JsonObject& j, Packet& packet);

    struct compareTo {
        bool operator()(const Packet& lhs, const Packet& rhs) {
            if (lhs.priority != rhs.priority) {
                return lhs.priority < rhs.priority;
            } else {
                return lhs.timestamp < rhs.timestamp;
            }
        }
    };
};

#endif //FLIGHT_PACKET_HPP
