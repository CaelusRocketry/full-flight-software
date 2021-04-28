#include <flight/modules/control_tasks/TelemetryControl.hpp>
#include <flight/modules/lib/Util.hpp>
#include <flight/modules/lib/logger_util.hpp>
#include <flight/modules/mcl/Flag.hpp>
#include <queue>


TelemetryControl::TelemetryControl() {
    global_flag.log_info("INF", "Telemetry control starting.");
}

void TelemetryControl::begin() {
    print("Telemetry control: beginning.");
    make_functions();
}

// Store list of all commands that GS can send as functions, add the function pointers to the map and call when necessary
void TelemetryControl::make_functions() {
    print("Telemetry: making functions.");
    this->functions.emplace("HRT", &TelemetryControl::heartbeat);
    this->functions.emplace("SAB", &TelemetryControl::soft_abort);
    this->functions.emplace("UAB", &TelemetryControl::undo_soft_abort);
    this->functions.emplace("SAC", &TelemetryControl::solenoid_actuate);
    this->functions.emplace("SRQ", &TelemetryControl::sensor_request);
    this->functions.emplace("VRQ", &TelemetryControl::valve_request);
    this->functions.emplace("SGP", &TelemetryControl::stage_progression);
    this->functions.emplace("INF", &TelemetryControl::info);
}

void TelemetryControl::execute() {
    print("Telemetry control: controlling.");
    if (!global_registry.telemetry.status) {
        global_flag.telemetry.reset = true;
    } else {
        global_flag.telemetry.reset = false;
        auto &ingest_queue = global_registry.telemetry.ingest_queue;
        while (!ingest_queue.empty()) {
            // Pop the packet at the top of the ingest queue
            Packet packet = ingest_queue.top();
            ingest_queue.pop();
            // Convert the packet to a string
            string packet_to_str = packet.toString();
            print("TelemetryControl packet to string: " + packet_to_str);
            // Ingest each Log in the packet
            for (const Log& log_ : packet.getLogs()) {
                string to_str_log = log_.toString();
                print("TelemetryControl log to string: " + to_str_log);
                ingest(log_);
            }
        }
    }
}

void TelemetryControl::ingest(const Log& log) {
    string header = log.getHeader();
    string msg = log.getMessage();
    // Make sure the function exists
    if (this->functions.find(header) == this->functions.end()) {
        print("TelemetryControl packet header: " + header);
        throw INVALID_HEADER_ERROR();
    }
    auto function = this->functions.at(header); // The reference to the actual function
    vector<string> param_values; // The arguments for that specific function
    int arg_len = arguments.at(header).size(); // Number of arguments
    // Attempt to parse arguments
    try {
        if (arg_len > 0) { // If the message in the log are arguments and not just text
            for (unsigned int i = 0; i < msg.length(); i++) {
                string s(1, msg[i]);
                param_values.push_back(s);
            }
        }
        else { // Message is just text; probably an HBT or INF
            param_values.push_back(msg);
        }
    } catch (...) {
        string obj = "Invalid function arguments.";
        global_flag.log_warning("INF", obj);
        throw INVALID_PACKET_ARGUMENTS_ERROR();
    }
    (this->*function)(param_values); // Call function which maps to the GS command sent w/ all params necessary
}

void TelemetryControl::heartbeat(const vector<string>& args) {
    global_flag.log_info("HBR", "OK"); // This is sent back to GS
}

void TelemetryControl::soft_abort(const vector<string>& args) {
    global_registry.general.soft_abort = true;
    global_flag.log_critical("SAB", "1");
}

void TelemetryControl::undo_soft_abort(const vector<string>& args) {
    global_registry.general.soft_abort = false;
    global_flag.log_critical("UAB", "1");
}

void TelemetryControl::solenoid_actuate(const vector<string>& args) {
    // TODO: Should we send return packets with error codes to GS in case an error is thrown?
    string msg;
    for (const string& str : args) {
        msg += str;
    }
    if (!global_registry.valve_exists("solenoid", args[0])) {
        global_flag.log_critical("SAC", msg + "-0"); // "-0" indicates a failure; this is "dash-zero" 
        throw INVALID_SOLENOID_ERROR();
    }

    int current_priority = int(global_registry.valves["solenoid"][args[0]].actuation_priority);

    if (int(valve_priority_map[args[2]]) < current_priority) {
        global_flag.log_critical("SAC", msg + "-0");
        printCritical("Priority too low to actuate. Valve location: " + args[0] + " Actuation type: " + args[1] + " Priority: " + args[2] + ".");
        throw INVALID_SOLENOID_ERROR();
    }

    print("Actuating solenoid at " + args[0] + "with actuation type " + args[1] + ".");

    try {
        FlagValveInfo &valve_flag = global_flag.valves["solenoid"][args[0]];
        valve_flag.actuation_type = (ActuationType) std::atoi(args[1].c_str());
        valve_flag.actuation_priority = (ValvePriority) std::atoi(args[2].c_str());
    } catch(...) {
        global_flag.log_critical("SAC", msg + "-0");
        printCritical("Invalid packet message. Valve location: " + args[0] + " Actuation type: " + args[1] + " Priority: " + args[2] + ".");
        throw INVALID_PACKET_MESSAGE_ERROR();
    }

    global_flag.log_info("SAC", msg + "-1");
    print("Successfully actuated solenoid at " + args[0] + ".");
    
    print("SOLENOID ACTUATION SUCCESSFUL!");
}

void TelemetryControl::sensor_request(const vector<string>& args) {
    double value;
    double kalman_value;
    string sensor_status_str;
    string sensor_type = args[0];
    string sensor_loc = args[1];

    if (!global_registry.sensor_exists(sensor_type, sensor_loc)) {
        global_flag.log_critical("response", obj);
        printCritical("Unable to find sensor. Sensor type: " + args[0] + " Sensor location: " + args[1] + ".");
        throw INVALID_SENSOR_LOCATION_ERROR();
    }

    auto sensor = global_registry.sensors[sensor_type][sensor_loc];
    value = sensor.measured_value;
    kalman_value = sensor.normalized_value;
    sensor_status_str = sensor_status_map[sensor.status];

    string value_str = Util::to_string((int) value);
    string kalman_str = Util::to_string((int) kalman_value);
    string time_str = Util::to_string((int) (Util::getMiliTimestampLong(global_flag)));

    global_flag.log_critical("SDT", args[0] + args[1] + "-" + sensor_status_str + value_str + kalman_str);
    print("Sensor data request successful. Sensor type: " + args[0] + ", Sensor location: " + args[1] + ", Sensor status: " + sensor_status_str + ", Measured value: " + value_str + ", Normalized value: " + kalman_str + ".");
}

void TelemetryControl::valve_request(const vector<string>& args) {
    string state;
    string actuation_type;
    string actuation_priority;
    string valve_type = args[0];
    string valve_loc = args[1];

    if (!global_registry.valve_exists(valve_type, valve_loc)) {
        printCritical("Unable to find valve. Valve type: " + valve_type + ", Valve location: " + valve_loc + ".");
        global_flag.log_critical("VST", valve_type + valve_loc + "-0");
        throw INVALID_VALVE_LOCATION_ERROR();
    }

    auto valve_registry = global_registry.valves[valve_type][valve_loc];
    actuation_type = actuation_type_inverse_map.at(valve_registry.actuation_type);
    actuation_priority = valve_priority_inverse_map.at(valve_registry.actuation_priority);
    // string time_str = Util::to_string((int) (Util::getMiliTimestampLong(global_flag);));
    
    // TODO: Does time_str actually give the last time the valve was actuated? It just returns the current time, right?
    global_flag.log_critical("VST", valve_type + valve_loc + "-" + actuation_type + actuation_priority);
    print("Valve data request successful. Actuation type: " + actuation_type + ", Actuation priority: " + actuation_priority + ", Valve type: " + valve_type + ", Valve location: " + valve_loc + ".");
}

void stage_progression(const vector<string>& args) {
    // Progresses the rocket to the next stage of flight
    global_flag.general.progress = true;
    // global_flag.log_critical("SGP", "1");
    // print("Stage progression successful.");
}

void TelemetryControl::info(const vector<string>& args) {
    print("Information packet received: " + args[0]);
}
