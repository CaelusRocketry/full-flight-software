#ifndef FLIGHT_VALVETASK_HPP
#define FLIGHT_VALVETASK_HPP

#include <vector>
#include <string>
#include <flight/modules/tasks/Task.hpp>
#include <flight/modules/drivers/ValveDriver.hpp>
#include <flight/modules/lib/Enums.hpp>

class ValveTask : public Task {
    private:
        ValveDriver* valve_driver;
        vector<pair<string, string>> valve_list;
        vector<int> pins;
        unordered_map<int, pair<string, string>> pin_to_valve;
        int get_pin(string valve_type, string valve_loc);

    public:
        ValveTask() {}

        void initialize();
        void read();
        void actuate();
};


#endif // FLIGHT_VALVETASK_HPP
