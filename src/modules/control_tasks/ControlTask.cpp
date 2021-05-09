#include <flight/modules/control_tasks/ControlTask.hpp>
#include <flight/modules/control_tasks/TelemetryControl.hpp>
#include <flight/modules/control_tasks/SensorControl.hpp>
#include <flight/modules/control_tasks/StageControl.hpp>
#include <flight/modules/control_tasks/ValveControl.hpp>
#include <flight/modules/control_tasks/PressureControl.hpp>
#include <flight/modules/lib/logger_util.hpp>
#include <flight/modules/lib/Util.hpp>

ControlTask::ControlTask(const set<string>& config) {
    print("Control task: Adding controls");

    if (config.count("sensor")) {
        controls.push_back(unique_ptr<Control>(new SensorControl()));
    }

    if (config.count("telemetry")) {
        controls.push_back(unique_ptr<Control>(new TelemetryControl()));
    }

    if (config.count("valve")) {
        controls.push_back(unique_ptr<Control>(new ValveControl()));
    }

    if (config.count("stage")) {
        controls.push_back(unique_ptr<Control>(new StageControl()));
    }

    if (config.count("pressure")) {
        controls.push_back(unique_ptr<Control>(new PressureControl()));
    }
    global_flag.send_packet("INF", "Control tasks started.");
}

void ControlTask::begin() {
    print("Control task: Beginning");
    
    for (auto &control : this->controls) {
        control->begin();
    }
}

void ControlTask::control() {
    print("Control task: Controlling");

    for (auto &control : this->controls) {
        control->execute();
    }
}