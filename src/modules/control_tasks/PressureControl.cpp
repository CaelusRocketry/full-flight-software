#include <Logger/logger_util.h>
#include <flight/modules/control_tasks/PressureControl.hpp>
#include <vector>
#include <flight/modules/mcl/Config.hpp>

PressureControl::PressureControl(){
    cout << "Pressure Control Initialized";
}

void PressureControl::begin(json& config) {
    log("Pressure control: Beginning");

    global_flag.log_info("response", {
            {"header",      "info"},
            {"Description", "Pressure Control started"}
    });

    this->activate_stages = global_config.pressure_control.active_stages;
    this->valves = global_config.valves.list["solenoid"];
    this->sensors = global_config.sensors.list["pressure"];
    this->matchups.push_back(make_pair(SensorLocation::PT2, ValveLocation::PRESSURE_RELIEF));

    for (pair<SensorLocation, ValveLocation> matched : this->matchups) {
        try {
            int(global_registry.sensors["pressure"][string(reinterpret_cast<const char *>(int(matched.first)))].normalized_value);
        } catch (...) {
            cout << "sensor at" << int(matched.first) << "not registered";
        }

        try {
            int(global_registry.sensors["pressure"][string(reinterpret_cast<const char *>(int(matched.first)))].normalized_value); //not sure if this should be [0]
        } catch (...) {
            cout << "pressure_relief_valve not registered";
        }
    }
}

void PressureControl::execute() {
    check_pressure();
}

void PressureControl::check_pressure() {
    for(pair<SensorLocation, ValveLocation> matched : this->matchups) {

        if (global_registry.sensors["pressure"][string(reinterpret_cast<const char *>(int(matched.first)))].normalized_value >
                global_config.sensors.list["pressure"][string(reinterpret_cast<const char *>(int(matched.first)))].boundaries.pressurization.safe.upper) {
            if (global_registry.valves["solenoid"][string(
                    reinterpret_cast<const char *>(int(matched.second)))].state == SolenoidState::CLOSED) {
                global_registry.valves["solenoid"][string(reinterpret_cast<const char *>(int(
                        matched.second)))].actuation_type = ActuationType::OPEN_VENT;
                global_registry.valves["solenoid"][string(reinterpret_cast<const char *>(int(
                        matched.second)))].actuation_priority = ValvePriority::PI_PRIORITY;
            }
        } else if (global_registry.sensors["pressure"][string(
                reinterpret_cast<const char *>(int(matched.first)))].status == SensorStatus::SAFE) {
            if (global_registry.valves["solenoid"][string(reinterpret_cast<const char *>(int(matched.second)))].state == SolenoidState::OPEN) {
               global_registry.valves["solenoid"][string(reinterpret_cast<const char *>(int(matched.second)))].actuation_type = ActuationType::OPEN_VENT;
               global_registry.valves["solenoid"][string(reinterpret_cast<const char *>(int(matched.second)))].actuation_priority = ValvePriority::PI_PRIORITY;
            }
        }
    }
}
