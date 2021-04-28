#include <flight/modules/control_tasks/StageControl.hpp>
#include <flight/modules/mcl/Flag.hpp>
#include <flight/modules/mcl/Registry.hpp>
#include <flight/modules/lib/Enums.hpp>
#include <flight/modules/lib/logger_util.hpp>
#include <flight/modules/lib/Util.hpp>


StageControl::StageControl() {
    this->start_time = Util::getTime();
    this->send_interval = global_config.stages.send_interval * 1000; // Convert seconds to milliseconds
    this->stage_index = 0;
    global_flag.log_info("INF", "Stage control started.");
    print("Stage control started.");
}

void StageControl::begin() {
    print("Stage control: beginning");
    this->acutated_postburn = false;
    global_registry.general.stage = stage_names.at(stage_index);
    global_registry.general.stage_status = 0;
}

void StageControl::execute()
{
    print("Stage control: Controlling");

    int status = calculate_status();
    global_registry.general.stage_status = status;
    bool &progress_flag = global_flag.general.progress;
    if (progress_flag) {
        this->progress();
        progress_flag = false;
    }
    else if (status >= 100) {
        if (request_time == 0 || Util::getTime() - request_time > request_interval) {
            send_progression_request();
            request_time = Util::getTime();
        }
    }
    stage_valve_control();
    send_data();
}

int StageControl::calculate_status() const
{
    Stage current_stage = global_registry.general.stage;

    if (current_stage == Stage::WAITING)
    {
        return 100;
    }
    else if (current_stage == Stage::PRESSURIZATION) {
        // If we're using PT-2 in the current test
        if (global_registry.sensors["pressure"].find("PT-2") != global_registry.sensors["pressure"].end()) {
            float pressure = global_registry.sensors["pressure"]["PT-2"].normalized_value;
            return static_cast<int>(Util::min(100.0, pressure / 4.9));
        }
        else
        {
            return 100;
        }
    }
    else if (current_stage == Stage::AUTOSEQUENCE) {
        ActuationType mpv_actuation = global_registry.valves["solenoid"]["main_propellant_valve"].actuation_type;
        if (mpv_actuation == ActuationType::OPEN_VENT)
        {
            return 100;
        }
        else
        {
            return static_cast<int>(Util::min(((Util::getTime() - this->start_time) / this->AUTOSEQUENCE_DELAY) * 100, 99.0));
        }
    }
    else if (current_stage == Stage::POSTBURN) {
        double pressure = global_registry.sensors["pressure"]["PT-2"].normalized_value;
        double inv = (pressure - 20.0) / 5.0; // Assuming that "depressurization" means 20psi
        double progress = Util::min(100.0, 100.0 - inv);
        return static_cast<int>(Util::max(0.0, progress)); //  makes sure that progress isn't negative
    }
    throw INVALID_STAGE();
}

void StageControl::send_progression_request() {
    global_flag.log_critical("SPQ", stage_strings.at(stage_index) + stage_strings.at(stage_index + 1));
    print("Stage progression request. Current stage: " + stage_strings.at(stage_index) + ", Next stage: " + stage_strings.at(stage_index + 1) + ".");
}

void StageControl::send_data() {
    print("Sending stage data.");
    if (this->send_time == 0 || Util::getTime() > (this->send_time + this->send_interval)) {
        // Send stage data, where first char is the current stage, second char is said stage's status
        global_flag.log_info("SGD", stage_strings.at(stage_index) + Util::to_string(calculate_status()));
        this->send_time = Util::getTime();
    }
}

void StageControl::progress() {
    status = calculate_status();
    if (status != 100.0) {
        // Log the failed stage progression to GS
        global_flag.log_critical("SGP", stage_strings.at(stage_index) + Util::to_string(status) + "-0");
        // NOTE: Using stage_strings.at(stage_index) instead of obj["Status"] = status; 
        printCritical("Stage progression failed.");
    }
    else {
        stage_index++;
        curr_stage = stage_names[stage_index];
        global_registry.general.stage = curr_stage;
        send_time = 0;
        request_time = 0;
        status = calculate_status();
        global_registry.general.stage_status = status;
        start_time = Util::getTime();
        // Log the successful stage progression to GS
        global_flag.log_critical("SGP", stage_strings.at(stage_index) + Util::to_string(status) + "-1");
        print("Stage progression successful.");
    }
}

void StageControl::stage_valve_control() {
    //TODO: Make this actuate valves based on the current stage
    if (stage_index == int(Stage::WAITING)) {
        if (global_registry.valves["solenoid"]["pressure_relief"].actuation_type != ActuationType::CLOSE_VENT) {
            global_flag.valves["solenoid"]["pressure_relief"].actuation_type = ActuationType::CLOSE_VENT;
            global_flag.valves["solenoid"]["pressure_relief"].actuation_priority = ValvePriority::PI_PRIORITY;
        }
        if (global_registry.valves["solenoid"]["main_propellant_valve"].actuation_type != ActuationType::CLOSE_VENT) {
            global_flag.valves["solenoid"]["main_propellant_valve"].actuation_type = ActuationType::CLOSE_VENT;
            global_flag.valves["solenoid"]["main_propellant_valve"].actuation_priority = ValvePriority::PI_PRIORITY;
        }
    }
    else if (stage_index == int(Stage::PRESSURIZATION)) {
        return;
    }
    else if (stage_index == int(Stage::AUTOSEQUENCE)) {
        long curr_time = static_cast<long>(Util::getTime() - start_time);

        if (global_registry.valves["solenoid"]["main_propellant_valve"].actuation_type != ActuationType::OPEN_VENT && curr_time - start_time > AUTOSEQUENCE_DELAY) {
            global_flag.valves["solenoid"]["main_propellant_valve"].actuation_type = ActuationType::OPEN_VENT;
            global_flag.valves["solenoid"]["main_propellant_valve"].actuation_priority = ValvePriority::PI_PRIORITY;
        }
    }
    else if (stage_index == int(Stage::POSTBURN)) {
        if (!acutated_postburn) {
            global_flag.valves["solenoid"]["main_propellant_valve"].actuation_type = ActuationType::OPEN_VENT;
            global_flag.valves["solenoid"]["main_propellant_valve"].actuation_priority = ValvePriority::PI_PRIORITY;

            global_flag.valves["solenoid"]["pressure_relief"].actuation_type = ActuationType::OPEN_VENT;
            global_flag.valves["solenoid"]["pressure_relief"].actuation_priority = ValvePriority::PI_PRIORITY;

            acutated_postburn = true;
        }
    }
    else {
        throw INVALID_STAGE();
    }
}
