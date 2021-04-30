#include <flight/modules/control_tasks/ValveControl.hpp>
#include <flight/modules/lib/Enums.hpp>
#include <flight/modules/mcl/Config.hpp>
#include <flight/modules/mcl/Registry.hpp>
#include <flight/modules/mcl/Flag.hpp>
#include <flight/modules/lib/logger_util.hpp>
#include <flight/modules/lib/Util.hpp>

ValveControl::ValveControl() {
    // config send interval in seconds, convert to milliseconds
    this->send_interval = global_config.valves.send_interval * 1000;
    this->last_send_time = 0;
    this->aborted = false;
}

void ValveControl::begin() {
    print("Valve Control: Beginning");
    global_flag.send_packet("INF", "Valve control started.");
}

void ValveControl::execute() {
    print("Valve control: Controlling");
    check_abort();
    long double now = Util::getTime();

    if (last_send_time == 0 || now > last_send_time + send_interval) {
        send_valve_data();
        last_send_time = now;
    }
}

void ValveControl::send_valve_data() {
    // Send a batch of valve data (VDT)
    string data; // Final log format example with three valves: VDT|253|120,130,211,|298
    for (const auto& type_pair : global_config.valves.list) { // For each <type, location> pair
        string type = type_pair.first;
        for (const auto& location_pair : type_pair.second) { // For each location pair 
            string location = location_pair.first;
            RegistryValveInfo valve_info = global_registry.valves[type][location];
            string valve_state = Util::to_string(static_cast<int>(valve_info.state));
            // Format each individual valve type, location, and state to be delimited by a comma ","
            data += valve_type_map[type] + valve_location_map[location] + valve_state + ",";
        }
    }
    string mod_data = data.substr(0, data.length()-1); // Strip the last comma
    global_flag.send_packet("VDT", mod_data);
    printCritical("Valve data batch sent: " + mod_data);
}

void ValveControl::abort() {
    print("Aborting!");
    for (const auto& valve_ : valves) {
        RegistryValveInfo valve_info = global_registry.valves[valve_.first][valve_.second];

        auto actuation_type = valve_info.actuation_type;
        auto actuation_priority = valve_info.actuation_priority;

        if (actuation_type != ActuationType::OPEN_VENT || actuation_priority != ValvePriority::ABORT_PRIORITY) {
            FlagValveInfo &valve_flag = global_flag.valves[valve_.first][valve_.second];
            valve_flag.actuation_type = ActuationType::OPEN_VENT;
            valve_flag.actuation_priority = ValvePriority::ABORT_PRIORITY;
        }
    }
    this->aborted = true;
}

// Set the actuation type to NONE, with ABORT_PRIORITY priority
void ValveControl::undo_abort() {
    print("Undoing abort!");
    for (const auto& valve_ : valves) {
        RegistryValveInfo valve_info = global_registry.valves[valve_.first][valve_.second];

        if (valve_info.actuation_priority == ValvePriority::ABORT_PRIORITY) {
            FlagValveInfo &valve_flag = global_flag.valves[valve_.first][valve_.second];
            valve_flag.actuation_type = ActuationType::NONE;
            valve_flag.actuation_priority = ValvePriority::ABORT_PRIORITY;
        }
    }
    this->aborted = false;
}

void ValveControl::check_abort() {
    if (global_registry.general.soft_abort && !this->aborted) {
        abort();
    } else if (!global_registry.general.soft_abort && this->aborted) {
        undo_abort();
    }
}
