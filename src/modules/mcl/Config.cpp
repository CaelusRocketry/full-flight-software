#include <flight/modules/mcl/Config.hpp>
#include <flight/modules/lib/Enums.hpp>
#include <flight/modules/lib/logger_util.hpp>
#include <flight/modules/mcl/Registry.hpp>

void 

Config::Config(JsonObject& json) {
    print("Config: Initializing");

    /* Read telemetry */
    print("Config: Reading telemetry data");
    telemetry.GS_IP = json["telemetry"]["GS_IP"].as<string>();
    telemetry.GS_PORT = json["telemetry"]["GS_PORT"].as<int>();
    telemetry.DELAY = json["telmetry"]["DELAY"].as<int>();
    telemetry.SOCKETIO_HOST = json["telmetry"]["SOCKETIO_HOST"].as<string>();
    telemetry.SOCKETIO_PORT = json["telmetry"]["SOCKETIO_PORT"].as<int>();

    /* Read sensor list */
    print("Config: Reading sensor list");
    sensors.address = json["sensors"]["address"].as<string>();
    sensors.baud = json["sensors"]["baud"].as<int>();
    sensors.send_interval = json["sensors"]["send_interval"].as<int>();

    for (JsonVariant sensor_type : json["sensors"]["list"]) {
        for(JsonVariant sensor: sensor_type) {
            ConfigSensorInfo info;
            info.pin = sensor["pin"].as<int>();

            info.kalman_args.process_variance = sensor["kalman_args"]["process_variance"].as<double>();
            info.kalman_args.measurement_variance = sensor["kalman_args"]["measurement_variance"].as<double>();
            info.kalman_args.kalman_value = sensor["kalman_args"]["kalman_value"].as<double>();

            info.boundaries.waiting.safe = sensor["boundaries"]["waiting"]["safe"][0];
            info.boundaries.waiting.warn = sensor["boundaries"]["waiting"]["warn"][1];

            info.boundaries.pressurization.safe = sensor["boundaries"]["pressurization"]["safe"][0];
            info.boundaries.pressurization.warn = sensor["boundaries"]["pressurization"]["warn"][1];

            info.boundaries.autosequence.safe = sensor["boundaries"]["autosequence"]["safe"][0];
            info.boundaries.autosequence.warn = sensor["boundaries"]["autosequence"]["warn"][1];

            info.boundaries.postburn.safe = sensor["boundaries"]["postburn"]["safe"][0];
            info.boundaries.postburn.warn = sensor["boundaries"]["postburn"]["warn"][1];

            sensors.list[sensor_type.as<string>()][sensor.as<string>()] = info;
        }
    }

    /* Read valve list */
    print("Config: Reading valve list");
    valves.address = json["valves"]["address"].as<string>();
    valves.baud = json["valves"]["baud"].as<int>();
    valves.send_interval = json["valves"]["send_interval"].as<int>();
    
    for (JsonVariant valve_type : json["valvues"]["list"]) {
        for(JsonVariant valve: valve_type) {
            ConfigValveInfo info;
            info.pin = valve["pin"].as<int>();
            info.natural = valve["natural"].as<string>();
            info.special = valve["special"].as<bool>();

            valves.list[valve_type.as<string>()][valve.as<string>()] = info;
        }
    }

    /* Read stage list */
    print("Config: Reading stage list");
    stages.list = json["stages"]["list"].as<vector<string>>();  // json.at("stages").at("list").get_to();
    stages.request_interval = json["stages"]["request_interval"].as<double>();
    stages.send_interval = json["stages"]["send_interval"].as<double>();

    /* Read timer config */
    print("Config: Reading timer config");
    timer.delay = json["timer"]["delay"].as<double>();

    /* Read pressure control stages list */
    print("Config: Reading pressure control stages list");
    pressure_control.active_stages = json["pressure_control"]["active_stages"].as<vector<string>>(); 
    
    /* Read arduino type */
    print("Config: Reading arduino type");
    arduino_type = json["arduino_type"].as<string>();

    /* Read task config */
    print("Config: Reading task config");
    task_config.tasks = json["task_config"]["tasks"].as<vector<string>>(); 
    task_config.control_tasks = json["task_config"]["control_tasks"].as<vector<string>>(); 
}

// Define the value declared with extern in the header file
Config global_config;
