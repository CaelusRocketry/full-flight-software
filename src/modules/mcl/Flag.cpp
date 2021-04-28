#include <flight/modules/mcl/Flag.hpp>
#include <flight/modules/lib/logger_util.hpp>

// Adds all flag fields from config and general default fields

void Flag::enqueue(const Log& log, LogPriority logPriority) {
    string output = log.toString();
    long millisecond_timestamp = static_cast<long>(Util::getTime() - general.mcl_start_time);
    Packet packet(logPriority, millisecond_timestamp);
    packet.add(log);
    telemetry.enqueue.push(packet);
}

void Flag::log_info(const string &header, const string &message) {
    long millisecond_timestamp = static_cast<long>(Util::getTime() - general.mcl_start_time);
    Log log(header, millisecond_timestamp, message);
    enqueue(log, LogPriority::INFO);
}

void Flag::log_debug(const string &header, const string &message) {
    long millisecond_timestamp = static_cast<long>(Util::getTime() - general.mcl_start_time);
    Log log(header, millisecond_timestamp, message);
    enqueue(log, LogPriority::DEBUG);
}

void Flag::log_warning(const string &header, const string &message) {
    long millisecond_timestamp = static_cast<long>(Util::getTime() - general.mcl_start_time);
    Log log(header, millisecond_timestamp, message);
    enqueue(log, LogPriority::WARN);
}

void Flag::log_critical(const string &header, const string &message) {
    long millisecond_timestamp = static_cast<long>(Util::getTime() - general.mcl_start_time);
    Log log(header, millisecond_timestamp, message);
    enqueue(log, LogPriority::CRIT);
}

// Define the value declared with extern in the header file
Flag global_flag;
