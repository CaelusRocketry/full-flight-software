#include <flight/modules/mcl/Flag.hpp>
#include <ArduinoJson.h>
#include <flight/modules/lib/logger_util.hpp>

// Adds all flag fields from config and general default fields

void Flag::enqueue(const Log& log, LogPriority logPriority) {
    string output;
    Log::to_string(output, log);
    // print("Flag: Enqueue: " + output);
    // print("Flag: Log priority: " + Util::to_string(static_cast<int>(logPriority)));
    long double millisecond_timestamp = Util::getTime() - general.mcl_start_time;
    Packet packet(logPriority, millisecond_timestamp / 1000);
    packet.add(log);
    telemetry.enqueue.push(packet);
}

void Flag::log_info(const string &header, const string &message) {
    long double millisecond_timestamp = Util::getTime() - general.mcl_start_time;
    Log log(header, message, millisecond_timestamp / 1000);
    enqueue(log, LogPriority::INFO);
}

void Flag::log_debug(const string &header, const string &message) {
    long double millisecond_timestamp = Util::getTime() - general.mcl_start_time;
    Log log(header, message, millisecond_timestamp / 1000);
    enqueue(log, LogPriority::DEBUG);
    // enqueue(Log(header, message, millisecond_timestamp / 1000), LogPriority::DEBUG);
}

void Flag::log_warning(const string &header, const string &message) {
    long double millisecond_timestamp = Util::getTime() - general.mcl_start_time;
    Log log(header, message, millisecond_timestamp / 1000);
    enqueue(log, LogPriority::WARN);
    // enqueue(Log(header, message, millisecond_timestamp / 1000), LogPriority::WARN);
}

void Flag::log_critical(const string &header, const string &message) {
    long double millisecond_timestamp = Util::getTime() - general.mcl_start_time;
    Log log(header, message, millisecond_timestamp / 1000);
    enqueue(log, LogPriority::CRIT);
    // enqueue(Log(header, message, millisecond_timestamp / 1000), LogPriority::CRIT);
}

void Flag::log_info(const string &header, const string &message) {
    long double millisecond_timestamp = Util::getTime() - general.mcl_start_time;
    enqueue(Log(header, message, millisecond_timestamp / 1000), LogPriority::DEBUG);
}

void Flag::log_debug(const string &header, const string &message) {
    long double millisecond_timestamp = Util::getTime() - general.mcl_start_time;
    enqueue(Log(header, message, millisecond_timestamp / 1000), LogPriority::DEBUG);
}

void Flag::log_warning(const string &header, const string &message) {
    long double millisecond_timestamp = Util::getTime() - general.mcl_start_time;
    enqueue(Log(header, message, millisecond_timestamp / 1000), LogPriority::WARN);
}

void Flag::log_critical(const string &header, const string &message) {
    long double millisecond_timestamp = Util::getTime() - general.mcl_start_time;
    enqueue(Log(header, message, millisecond_timestamp / 1000), LogPriority::CRIT);
}

// Define the value declared with extern in the header file
Flag global_flag;
