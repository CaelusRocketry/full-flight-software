#ifndef FLIGHT_FLAG_HPP
#define FLIGHT_FLAG_HPP

#include <iostream>
#include <string>
#include <map>
#include <vector>
#include <queue>

#include <flight/modules/lib/Packet.hpp>
#include <flight/modules/lib/Enums.hpp>

#include <ArduinoJson.h>

using namespace std;

struct FlagValveInfo {
    SolenoidState state = SolenoidState::CLOSED;
    ActuationType actuation_type = ActuationType::NONE;
    ValvePriority actuation_priority = ValvePriority::NONE;
};

class Flag {
    public:
        Flag() = default;
        ~Flag() = default;

        struct {
            bool progress = false;

            // calculated in milliseconds
            long mcl_start_time = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch()).count();;
        } general;

        /* Telemetry Flags */
        struct {
            priority_queue<Packet, vector<Packet>, Packet::compareTo> enqueue;
            priority_queue<Packet, vector<Packet>, Packet::compareTo> send_queue;

            /* Whether to reset telemetry or not */
            bool reset = false;
        } telemetry;

        /* Valve Flags */
        std::map<string, std::map<string, FlagValveInfo>> valves;

        void enqueue(const Log& log, LogPriority logPriority);
        void log_info(const string& header, JsonObject& message);
        void log_debug(const string& header, JsonObject& message);
        void log_warning(const string& header, JsonObject& message);
        void log_critical(const string& header, JsonObject& message);
};

extern Flag global_flag;

#endif //FLIGHT_FLAG_HPP

