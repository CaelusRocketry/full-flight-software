//
// Created by adiv413 on 4/24/2020.
//

#include <flight/modules/control_tasks/ValveControl.hpp>
#include <flight/modules/lib/Enums.hpp>
#include <flight/modules/mcl/Config.hpp>
#include <flight/modules/mcl/Registry.hpp>
#include <flight/modules/mcl/Flag.hpp>
#include <flight/modules/lib/logger_util.hpp>
#include <string>
#include <flight/modules/lib/Util.hpp>

ValveControl::ValveControl() {
    // config send interval in seconds, convert to milliseconds
    this->send_interval = global_config.valves.send_interval * 1000;
    this->last_send_time = 0;
    this->aborted = false;
}

void ValveControl::begin() {
    print("Valve Control: Beginning");
    JsonObject obj = Util::deserialize("{\"header\": \"info\", \"Description\": \"Valve Control started\"}");
    global_flag.log_info("response", obj);
}

void ValveControl::execute() {
    print("Valve control: Controlling");
    check_abort();
    auto current_time = Util::getTime();

    if (last_send_time == 0 || current_time > last_send_time + send_interval) {
        send_valve_data();
        last_send_time = Util::getTime();
    }
}

void ValveControl::send_valve_data() {
    const size_t CAPACITY = JSON_OBJECT_SIZE(50);
    StaticJsonDocument<CAPACITY> doc;
    JsonObject valve_data_json = doc.to<JsonObject>();

    for (const auto& type_pair : global_config.valves.list) {
        string type = type_pair.first;
        JsonObject type_json = valve_data_json.createNestedObject(type);
        for (const auto& location_pair : type_pair.second) {
            string location = location_pair.first;
            RegistryValveInfo valve_info = global_registry.valves[type][location];

            type_json[location] = static_cast<int>(valve_info.state);
        }
    }

    // add timestamp?

    valve_data_json["timestamp"] = Util::getTime() / 1000;
    global_flag.log_info("valve_data", valve_data_json);
}

void ValveControl::abort() {
    print("Aborting");
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
    print("Undoing abort");
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