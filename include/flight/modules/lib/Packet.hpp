#ifndef FLIGHT_PACKET_HPP
#define FLIGHT_PACKET_HPP

#include <string>
#include <vector>
#include <chrono>
#include <flight/modules/lib/Enums.hpp>
#include <flight/modules/lib/Log.hpp>
#include <ArduinoJson.h>


using namespace std;

class Packet;

void to_string(string& output, const Packet& packet);
void from_json(const JsonObject& j, Packet& packet);

// Packet class groups together logs of similar priority
class Packet {
private:
    StaticJsonDocument<5000> doc;
    vector<Log> logs;
    long double timestamp;
    LogPriority priority;

public:
    Packet() = default;

    explicit Packet(LogPriority logPriority, long double timestamp)
        : priority(logPriority),
          timestamp(timestamp){}

    void add(const Log& log);
    vector<Log> getLogs();

    friend void to_json_doc(StaticJsonDocument& j, const Packet& packet);
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
