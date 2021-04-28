#ifndef FLIGHT_TELEMETRYCONTROL_HPP
#define FLIGHT_TELEMETRYCONTROL_HPP

#include <flight/modules/control_tasks/Control.hpp>
#include <flight/modules/mcl/Registry.hpp>
#include <flight/modules/mcl/Flag.hpp>
#include <flight/modules/lib/Log.hpp>
#include <flight/modules/drivers/Telemetry.hpp>
#include <flight/modules/lib/Util.hpp>
#include <string>

class TelemetryControl : public Control {

typedef void (TelemetryControl::*functionType)(const vector<string>&);

private:
    unordered_map<string, functionType> functions;
    const unordered_map<string, vector<string>> arguments {
        {"HRT", {}},
        {"SAB", {}},
        {"UAB", {}},
        {"SAC", {"valve_location", "actuation_type", "priority"}},
        {"SRQ", {"sensor_type", "sensor_location"}},
        {"VRQ", {"valve_type", "valve_location"}},
        {"SGP", {}},
        {"INF", {}}
    };
    void ingest(const Log& log);

    void heartbeat(const vector<string>& args);
    void soft_abort(const vector<string>& args);
    void undo_soft_abort(const vector<string>& args);
    void solenoid_actuate(const vector<string>& args);
    void sensor_request(const vector<string>& args);
    void valve_request(const vector<string>& args);
    void stage_progression(const vector<string>& args);
    void info(const vector<string>& args);
    void make_functions();

public:
    TelemetryControl();
    void begin() override;
    void execute() override;
};
#endif //FLIGHT_TELEMETRYCONTROL_HPP
