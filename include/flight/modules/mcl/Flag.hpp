#ifndef FLIGHT_FLAG_HPP
#define FLIGHT_FLAG_HPP

#include <iostream>
#include <string>
#include <map>
#include <vector>
#include <queue>

#include <flight/modules/lib/Log.hpp>
#include <flight/modules/lib/Enums.hpp>
#include <flight/modules/lib/Util.hpp>

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
            long double mcl_start_time = Util::getTime();
        } general;

        /* Telemetry Flags */
        struct {
            priority_queue<Log, vector<Log>, Log::compareTo> enqueue;
            priority_queue<Log, vector<Log>, Log::compareTo> send_queue;

            /* Whether to reset telemetry or not */
            bool reset = false;
        } telemetry;

        /* Valve Flags */
        std::map<string, std::map<string, FlagValveInfo>> valves;

        void enqueue(const Log& log);
        void send_packet(const string& header, const string& message);
};

extern Flag global_flag;

#endif //FLIGHT_FLAG_HPP

