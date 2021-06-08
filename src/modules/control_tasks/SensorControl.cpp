#include <flight/modules/lib/logger_util.hpp>
#include <flight/modules/control_tasks/SensorControl.hpp>
#include <flight/modules/lib/Enums.hpp>
#include <flight/modules/mcl/Config.hpp>
#include <flight/modules/lib/Util.hpp>


SensorControl::SensorControl() {
    this->last_send_time = 0;
    // Config gives it in seconds, convert to milliseconds
    this->send_interval = global_config.sensors.send_interval * 1000;
    global_flag.send_packet("INF", "Sensor control started.");
    print("Sensor control started.");
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
            kalman_filters[type_.first].emplace(location_.first, Kalman (
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
    if (last_send_time == 0 || now > last_send_time + send_interval) {
        send_sensor_data();
        last_send_time = now;
    }
}

bool between(double a, double b, double x) {
    return a <= x && x <= b;
}

void SensorControl::boundary_check() {
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
            ConfigStage boundary_conf;
            bool found_stage = false;
            if(curr_stage == Stage::WAITING)
            {
                boundary_conf = conf.boundaries.waiting;
                found_stage = true;
            }
            else if(curr_stage == Stage::PRESSURIZATION)
            {
                boundary_conf = conf.boundaries.pressurization;
                found_stage = true;
            }
            else if(curr_stage == Stage::AUTOSEQUENCE)
            {
                boundary_conf = conf.boundaries.autosequence;
                found_stage = true;
            }
            else if(curr_stage == Stage::POSTBURN)
            {
                boundary_conf = conf.boundaries.postburn;
                found_stage = true;
            }

            if(!found_stage){
                continue;
            }

            if (between(boundary_conf.safe.lower, boundary_conf.safe.upper, kalman_value)) {
                sensor_registry.status = SensorStatus::SAFE;
            } else if (between(boundary_conf.warn.lower, boundary_conf.warn.upper, kalman_value)) {
                sensor_registry.status = SensorStatus::WARNING;
            } else {
                sensor_registry.status = SensorStatus::CRITICAL;
            }
        }
    }
}

void SensorControl::send_sensor_data() {
    // Send batch of sensor data (DAT)
    string data;
    // Format each sensor type, location, measured data, kalman, and status to be delimited by a comma ","
    for (const auto& type_pair : global_config.sensors.list) {
        string type = type_pair.first;
        for (const auto &location_pair : type_pair.second) {
            string location = location_pair.first;
            RegistrySensorInfo sensor = global_registry.sensors[type][location];
            // NOTE: Data is rounded to integers!
            string measured = Util::hex(static_cast<long>(sensor.measured_value));
            // Example data batch (two transducers): DAT|FA12|14-223-1A1-1,11-14D-2DA-1|121
            data += sensor_type_map[type] + sensor_location_map[location] + measured + ",";
        }
    }
    data = data.substr(0, data.length()-1);
    global_flag.send_packet("DAT", data);
    printCritical("Sensor data batch sent: " + data + ".");
}
