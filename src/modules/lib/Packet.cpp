#include <flight/modules/lib/Packet.hpp>
#include <flight/modules/lib/Util.hpp>
#include <flight/modules/lib/logger_util.hpp>


string Packet::toString() const {
    string output;
    for(Log log : logs) {
        output += "^" + log.toString() + "$";
    }
    return output;
}

Packet Packet::from_string(string& str) {
    Packet packet;
    size_t packet_start = str.find('^');
    if(packet_start != string::npos) {
        size_t packet_end = str.find('$', packet_start);
        if (packet_end != string::npos) {
            // Strips the leading ^ and trailing $ off the packet string
            string stripped_str = str.substr(packet_start + 1, packet_end - packet_start - 1);
            print("Packet stripped string: " + stripped_str);
            for (const string& log_str : Util::split(stripped_str, "$^")) {
                Log log = Log::from_string(log_str);
                packet.add(log);
            }
        }
    }
    return packet;
}

void Packet::add(const Log& log) {
    logs.push_back(log);
}

vector<Log> Packet::getLogs() {
    return this->logs;
}
