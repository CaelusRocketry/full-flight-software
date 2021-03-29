#ifndef FLIGHT_CONFIG_HPP
#define FLIGHT_CONFIG_HPP

#include <ArduinoJson.h>
#include <string>
#include <map>
#include <vector>

using std::string;
using std::map;
using std::vector;

struct ConfigBoundary {
    double lower, upper;
};
struct ConfigStage {
    ConfigBoundary safe, warn;
};

struct ConfigSensorInfo {
    struct {
        double process_variance, measurement_variance, kalman_value;
    } kalman_args;
    struct {
        ConfigStage waiting, pressurization, autosequence, postburn;
    } boundaries;
    int pin;
};

struct ConfigValveInfo {
    int pin;
    string natural;
    bool special;
};

class Config {
public:
    /* Default constructor */
    Config() = default;

    /* Reads config from a JSON object */
    explicit Config(JsonObject& json);

    struct {
        string GS_IP;
        int GS_PORT;

        string SOCKETIO_HOST;
        int SOCKETIO_PORT;

        int DELAY;
    } telemetry;

    struct {
        map<string, map<string, ConfigSensorInfo>> list;
        string address;
        int baud;
        double send_interval;
    } sensors;

    struct {
        map<string, map<string, ConfigValveInfo>> list;
        string address;
        int baud;
        double send_interval;
    } valves;

    struct {
        vector<string> list;
        double request_interval;
        double send_interval;
    } stages;

    struct {
        double delay = 1;
    } timer;

    struct {
        vector<string> active_stages;
    } pressure_control;

    struct {
        vector<string> tasks, control_tasks;
    } task_config;

    string arduino_type;
};

extern Config global_config;

#endif //FLIGHT_CONFIG_HPP
