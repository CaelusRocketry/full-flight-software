//
// Created by adiv413 on 4/24/2020.
//

#include <flight/modules/lib/logger_util.hpp>
#include <flight/modules/control_tasks/SensorControl.hpp>
#include <flight/modules/lib/Enums.hpp>
#include <flight/modules/mcl/Config.hpp>
#include <flight/modules/lib/Util.hpp>
#include <iostream> //////////////////////////////GETTTTTTTTTTTTTTTTTTTTTTTTTT RID OF THISSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS

SensorControl::SensorControl() {
    this->last_send_time = 0;

    // config gives it in seconds, convert to milliseconds
    this->send_interval = global_config.sensors.send_interval * 1000;
    JsonObject obj = Util::deserialize("{\"header\": \"info\", \"Description\": \"Sensor Control started\"}");
    global_flag.log_info("response", obj);
}

void SensorControl::begin() {

    print("Sensor control: Beginning");

    // Initialize the Kalman filters

    /* Pair of <string, <string, SensorInfo>> */
    for (const auto& type_ : global_config.sensors.list) {
        /* Pair of <string, SensorInfo> */
        for (const auto& location_ : type_.second) {
            ConfigSensorInfo sensor = location_.second;
            auto kalman = sensor.kalman_args;
            // Use brackets for the first because we want to create a new map
            // We use emplace for the second because Kalman has no default constructor

            kalman_filters[type_.first].emplace(location_.first, Kalman(
                kalman.process_variance,
                kalman.measurement_variance,
                kalman.kalman_value
            ));
        }
    }
}

void SensorControl::execute() {
    print("Sensor control: Controlling");
    boundary_check();

    long double now = Util::getTime();

    if(last_send_time == 0 || now > last_send_time + send_interval) {
        send_sensor_data();
        last_send_time = now;
    }
}

bool between(double a, double b, double x) {
    return a <= x && x <= b;
}

void SensorControl::boundary_check() {
    vector<pair<string, string>> critical_sensors;

    for (const auto& type_ : global_config.sensors.list) {
        string type = type_.first;
        for (const auto& location_ : type_.second) {
            string location = location_.first;
            ConfigSensorInfo conf = location_.second;

            RegistrySensorInfo &sensor_registry = global_registry.sensors[type][location];
            double value = sensor_registry.measured_value;
            // We use .at() here because Kalman has no default constructor
            double kalman_value = kalman_filters.at(type).at(location).update_kalman(value);
            sensor_registry.normalized_value = kalman_value; // reference
            Stage curr_stage = global_registry.general.stage;
            if(curr_stage == Stage::WAITING)
            {
                if (between(conf.boundaries.waiting.safe.lower, conf.boundaries.waiting.safe.upper, kalman_value)) {
                    sensor_registry.status = SensorStatus::SAFE;
                } else if (between(conf.boundaries.waiting.warn.lower, conf.boundaries.waiting.warn.upper, kalman_value)) {
                    sensor_registry.status = SensorStatus::WARNING;
                } else {
                    sensor_registry.status = SensorStatus::CRITICAL;
                    critical_sensors.push_back({type, location});
                }
            }
            else if(curr_stage == Stage::PRESSURIZATION)
            {
                if (between(conf.boundaries.pressurization.safe.lower, conf.boundaries.pressurization.safe.upper, kalman_value)) {
                    sensor_registry.status = SensorStatus::SAFE;
                } else if (between(conf.boundaries.pressurization.warn.lower, conf.boundaries.pressurization.warn.upper, kalman_value)) {
                    sensor_registry.status = SensorStatus::WARNING;
                } else {
                    sensor_registry.status = SensorStatus::CRITICAL;
                    critical_sensors.push_back({type, location});
                }
            }
            else if(curr_stage == Stage::AUTOSEQUENCE)
            {
                if (between(conf.boundaries.autosequence.safe.lower, conf.boundaries.autosequence.safe.upper, kalman_value)) {
                    sensor_registry.status = SensorStatus::SAFE;
                } else if (between(conf.boundaries.autosequence.warn.lower, conf.boundaries.autosequence.warn.upper, kalman_value)) {
                    sensor_registry.status = SensorStatus::WARNING;
                } else {
                    sensor_registry.status = SensorStatus::CRITICAL;
                    critical_sensors.push_back({type, location});
                }
            }
            else if(curr_stage == Stage::POSTBURN)
            {
                if (between(conf.boundaries.postburn.safe.lower, conf.boundaries.postburn.safe.upper, kalman_value)) {
                    sensor_registry.status = SensorStatus::SAFE;
                } else if (between(conf.boundaries.postburn.warn.lower, conf.boundaries.postburn.warn.upper, kalman_value)) {
                    sensor_registry.status = SensorStatus::WARNING;
                } else {
                    sensor_registry.status = SensorStatus::CRITICAL;
                    critical_sensors.push_back({type, location});
                }
            }
        }
    }

    if (!global_registry.general.soft_abort and critical_sensors.empty()) { // one or more of the sensors are critical, soft abort
        global_registry.general.soft_abort = true;

        string message = "Soft aborting because the following sensors have reached critical levels- ";
        for(const pair<string, string>& sensor_location : critical_sensors) {
            message += sensor_location.first + "." + sensor_location.second + ", ";
        }
        message = message.substr(0, message.length() - 2);

        JsonObject obj = Util::deserialize("{\"header\": \"info\", \"Description\": " + message + "}");
        global_flag.log_critical("response", obj);
    }
}

void SensorControl::send_sensor_data() {
    const size_t CAPACITY = JSON_OBJECT_SIZE(50);
    StaticJsonDocument<CAPACITY> doc;
    
    JsonObject sensor_data_json = doc.to<JsonObject>();

    for (const auto& type_pair : global_config.sensors.list) {
        string type = type_pair.first;
        JsonObject type_json = sensor_data_json.createNestedObject(type);
        for (const auto &location_pair : type_pair.second) {
            string location = location_pair.first;
            RegistrySensorInfo sensor = global_registry.sensors[type][location];

            JsonObject location_json = type_json.createNestedObject(location);
            location_json["measured"] = sensor.measured_value;
            location_json["kalman"] = sensor.normalized_value;
            location_json["status"] = int(sensor.status);
        }
    }

    global_flag.log_info("sensor_data", sensor_data_json);
}

