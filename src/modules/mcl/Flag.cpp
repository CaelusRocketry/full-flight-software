#include <flight/modules/mcl/Flag.hpp>
#include <flight/modules/lib/logger_util.hpp>

// Adds all flag fields from config and general default fields

void Flag::enqueue(const Log& log) {
    telemetry.enqueue.push(log);
}

void Flag::send_packet(const string &header, const string &message) {
    long millisecond_timestamp = static_cast<long>(Util::getTime() - general.mcl_start_time);
    Log log(header, millisecond_timestamp, message);
    enqueue(log);
}

// Define the value declared with extern in the header file
Flag global_flag;
