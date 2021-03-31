#include <flight/modules/control_tasks/StageControl.hpp>
#include <flight/modules/mcl/Flag.hpp>
#include <flight/modules/mcl/Registry.hpp>
#include <flight/modules/lib/Enums.hpp>
#include <flight/modules/lib/logger_util.hpp>
#include <chrono>
#include <flight/modules/lib/Util.hpp>

StageControl::StageControl()
{
    this->start_time = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch()).count();
    // convert seconds to milliseconds
    this->send_interval = global_config.stages.send_interval * 1000;
    this->stage_index = 0;

    JsonObject obj = Util::deserialize("{\"header\": \"info\", \"Description\": \"Stage Control started\"}");
    global_flag.log_info("response", obj);
}

void StageControl::begin()
{
    print("Stage control: Beginning");
    this->acutated_postburn = false;
    global_registry.general.stage = stage_names.at(stage_index);
    global_registry.general.stage_status = 0.0;
}

void StageControl::execute()
{
    print("Stage control: Controlling");

    double status = calculate_status();
    global_registry.general.stage_status = status;
    bool &progress_flag = global_flag.general.progress;
    if (progress_flag)
    {
        this->progress();
        progress_flag = false;
    }
    else if (status >= 100)
    {
        if (request_time == 0 || std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch()).count() - request_time > request_interval)
        {
            send_progression_request();
            request_time = std::chrono::duration_cast<std::chrono::milliseconds>(
                               std::chrono::system_clock::now().time_since_epoch())
                               .count();
        }
    }

    stage_valve_control();
    send_data();
}

double StageControl::calculate_status() const
{
    Stage current_stage = global_registry.general.stage;

    if (current_stage == Stage::WAITING)
    {
        return 100.0;
    }
    else if (current_stage == Stage::PRESSURIZATION)
    {
        // if we're using PT-2 in the current test
        if (global_registry.sensors["pressure"].find("PT-2") != global_registry.sensors["pressure"].end())
        {
            float pressure = global_registry.sensors["pressure"]["PT-2"].normalized_value;
            return Util::min(100.0, pressure / 4.9);
        }
        else
        {
            return 100.0;
        }
    }
    else if (current_stage == Stage::AUTOSEQUENCE)
    {
        ActuationType mpv_actuation = global_registry.valves["solenoid"]["main_propellant_valve"].actuation_type;
        if (mpv_actuation == ActuationType::OPEN_VENT)
        {
            return 100.0;
        }
        else
        {
            return Util::min(((std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch()).count() - this->start_time) / this->AUTOSEQUENCE_DELAY) * 100, 99.0);
        }
    }
    else if (current_stage == Stage::POSTBURN)
    {
        double pressure = global_registry.sensors["pressure"]["PT-2"].normalized_value;
        double inv = (pressure - 20.0) / 5.0; // Assuming that "depressurization" means 20psi
        double progress = Util::min(100.0, 100.0 - inv);
        return Util::max(0.0, progress); //  makes sure that progress isn't negative
    }

    throw INVALID_STAGE();
}

void StageControl::send_progression_request()
{
    JsonObject obj = Util::deserialize("{\"header\": \"Stage progression request\", \"Description\": \"Request to progress to the next stage\", \"Current stage\": " + stage_strings.at(stage_index) + ", \"Current stage\": " + stage_strings.at(stage_index + 1) + "}");
    global_flag.log_critical("response", obj);
}

void StageControl::send_data()
{
    print("Sending Stage Data.");
    if (this->send_time == 0 || std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch()).count() > (this->send_time + this->send_interval))
    {
        JsonObject obj = Util::deserialize("{\"header\": \"stage_data\", \"stage\": " + stage_strings.at(stage_index) + ", \"status\": " + to_string(calculate_status()) + "}");
        global_flag.log_info("stage", obj);
        this->send_time = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch()).count();
    }
}

void StageControl::progress()
{
    status = calculate_status();
    if (status != 100.0)
    {
        // JsonObject obj = Util::createJsonObject();
        // obj["header"] = "stage_progress";
        // obj["Status"] = status;
        // obj["Stage"] = curr_stage;
        // obj["Description"] = "Stage progression failed, the rocket's not ready yet";
        // global_flag.log_critical("stage", obj);
    }
    else
    {
        stage_index++;
        curr_stage = stage_names[stage_index];
        global_registry.general.stage = curr_stage;
        send_time = 0;
        request_time = 0;
        status = calculate_status();
        global_registry.general.stage_status = status;
        start_time = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch()).count();
        // JsonObject obj = Util::createJsonObject();
        // obj["header"] = "stage_progress";
        // obj["Status"] = status;
        // obj["Stage"] = stage_strings.at(stage_index);
        // obj["Description"] = "Stage progression successful";
        // global_flag.log_critical("response", obj);
    }
}

void StageControl::stage_valve_control()
{
    //TODO: make this actuate valves based on the current stage
    if (stage_index == int(Stage::WAITING))
    {
        if (global_registry.valves["solenoid"]["pressure_relief"].actuation_type != ActuationType::CLOSE_VENT)
        {
            global_flag.valves["solenoid"]["pressure_relief"].actuation_type = ActuationType::CLOSE_VENT;
            global_flag.valves["solenoid"]["pressure_relief"].actuation_priority = ValvePriority::PI_PRIORITY;
        }
        if (global_registry.valves["solenoid"]["main_propellant_valve"].actuation_type != ActuationType::CLOSE_VENT)
        {
            global_flag.valves["solenoid"]["main_propellant_valve"].actuation_type = ActuationType::CLOSE_VENT;
            global_flag.valves["solenoid"]["main_propellant_valve"].actuation_priority = ValvePriority::PI_PRIORITY;
        }
    }
    else if (stage_index == int(Stage::PRESSURIZATION))
    {
        return;
    }
    else if (stage_index == int(Stage::AUTOSEQUENCE))
    {
        long double curr_time = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch()).count() - start_time;

        if (global_registry.valves["solenoid"]["main_propellant_valve"].actuation_type != ActuationType::OPEN_VENT && curr_time - start_time > AUTOSEQUENCE_DELAY)
        {
            global_flag.valves["solenoid"]["main_propellant_valve"].actuation_type = ActuationType::OPEN_VENT;
            global_flag.valves["solenoid"]["main_propellant_valve"].actuation_priority = ValvePriority::PI_PRIORITY;
        }
    }
    else if (stage_index == int(Stage::POSTBURN))
    {
        if (!acutated_postburn)
        {
            global_flag.valves["solenoid"]["main_propellant_valve"].actuation_type = ActuationType::OPEN_VENT;
            global_flag.valves["solenoid"]["main_propellant_valve"].actuation_priority = ValvePriority::PI_PRIORITY;

            global_flag.valves["solenoid"]["pressure_relief"].actuation_type = ActuationType::OPEN_VENT;
            global_flag.valves["solenoid"]["pressure_relief"].actuation_priority = ValvePriority::PI_PRIORITY;

            acutated_postburn = true;
        }
    }
    else
    {
        throw INVALID_STAGE();
    }
}