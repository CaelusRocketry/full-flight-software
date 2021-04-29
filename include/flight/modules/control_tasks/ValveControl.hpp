//
// Created by Srikar on 4/15/2020.
//

#ifndef FLIGHT_VALVECONTROL_HPP
#define FLIGHT_VALVECONTROL_HPP

#include <flight/modules/control_tasks/Control.hpp>
#include <vector>
#include <string>
#include <unordered_map>

class ValveControl : public Control {
    private:
        std::vector<std::pair<std::string, std::string>> valves;

        std::unordered_map<std::string, std::string> valve_type_map {
            {"solenoid", "0"}
        };
        
        std::unordered_map<std::string, std::string> valve_location_map {
            {"ethanol_pressurization", "1"},
            {"ethanol_vent", "2"},
            {"ethanol_mpv", "3"},
            {"nitrous_pressurization", "4"},
            {"nitrous_fill", "5"},
            {"nitrous_mpv", "6"},
        };

        // all time is calculated in milliseconds
        long send_interval;
        long double last_send_time;
        bool aborted;

        void send_valve_data();
        void abort();
        void undo_abort();
        void check_abort();

    public:
        ValveControl();
        void begin() override;
        void execute() override;
};

#endif //FLIGHT_VALVECONTROL_HPP
