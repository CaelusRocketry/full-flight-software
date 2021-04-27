#ifndef FLIGHT_PACKET_HPP
#define FLIGHT_PACKET_HPP

#include <string>
#include <vector>
#include <flight/modules/lib/Enums.hpp>
#include <flight/modules/lib/Log.hpp>

using namespace std;
// Packet class groups together Logs of similar priority

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

    string toString();
    static void from_string(string& str, Packet& packet);

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
