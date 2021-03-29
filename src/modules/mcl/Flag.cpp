#include <flight/modules/mcl/Flag.hpp>
#include <ArduinoJson.h>

// Adds all flag fields from config and general default fields

void Flag::enqueue(const Log& log, LogPriority logPriority) {
    long double millisecond_timestamp = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch()).count() - general.mcl_start_time;
    Packet packet(logPriority, millisecond_timestamp / 1000);
    packet.add(log);
    telemetry.enqueue.push(packet);
}

void Flag::log_info(const string &header, JsonObject &message) {
    long double millisecond_timestamp = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch()).count() - general.mcl_start_time;
    enqueue(Log(header, message, millisecond_timestamp / 1000), LogPriority::INFO);
}

void Flag::log_debug(const string &header, JsonObject &message) {
    long double millisecond_timestamp = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch()).count() - general.mcl_start_time;
    enqueue(Log(header, message, millisecond_timestamp / 1000), LogPriority::DEBUG);
}

void Flag::log_warning(const string &header, JsonObject &message) {
    long double millisecond_timestamp = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch()).count() - general.mcl_start_time;
    enqueue(Log(header, message, millisecond_timestamp / 1000), LogPriority::WARN);
}

void Flag::log_critical(const string &header, JsonObject &message) {
    long double millisecond_timestamp = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch()).count() - general.mcl_start_time;
    enqueue(Log(header, message, millisecond_timestamp / 1000), LogPriority::CRIT);
}

// Define the value declared with extern in the header file
Flag global_flag;
