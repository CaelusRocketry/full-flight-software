#include <flight/modules/lib/logger_util.hpp>
#include <flight/modules/control_tasks/AbortControl.hpp>
#include <flight/modules/lib/Enums.hpp>
#include <flight/modules/mcl/Config.hpp>
#include <flight/modules/lib/Util.hpp>


AbortControl::AbortControl() {
    global_flag.send_packet("INF", "Abort control started.");
    print("Abort control started.");
}

void AbortControl::begin() {
    print("Abort control: Beginning");
}

void AbortControl::execute() {
    print("Abort control: Controlling");
    vector<pair<string, string>> critical_sensors;

    for (const auto& type_ : global_config.sensors.list) {
        string type = type_.first;
        for (const auto& location_ : type_.second) {
            string location = location_.first;
            ConfigSensorInfo conf = location_.second;

            RegistrySensorInfo &sensor_registry = global_registry.sensors[type][location];
            SensorStatus status = sensor_registry.status;
            if(status == SensorStatus::CRITICAL){
                critical_sensors.push_back({type, location});                
            }
        }
    }

    if (!global_registry.general.soft_abort and !(critical_sensors.empty())) { // one or more of the sensors are critical, soft abort
        global_registry.general.soft_abort = true;

        string crit_data;
        for(const pair<string, string>& sensor_location : critical_sensors) {
            // Sensor location pairs: <type, location>
            crit_data += sensor_location.first + sensor_location.second + ",";
        }
        crit_data = crit_data.substr(0, crit_data.length()-1);

        global_flag.send_packet("AAB", crit_data);
        printCritical("Aborting because the following sensors are critical: " + crit_data);
    }
}
