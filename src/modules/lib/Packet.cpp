#include <flight/modules/lib/Packet.hpp>
#include <flight/modules/lib/Util.hpp>
#include <flight/modules/lib/logger_util.hpp>

string Packet::toString() {
    // Util::doc["priority"] = static_cast<int>(priority);
    // Util::doc["timestamp"] = timestamp;
    string output;
    for(Log l : logs) {
        try {
            output += "^" + l.toString() + "$";
        }
        catch(std::exception& e) {
            print("ERROR: ");
            print(e.what());
        }
    }
    return output;
}

static void from_string(string& str, Packet& packet) {
    size_t packet_start = str.find('^');
    if(packet_start != string::npos) {
        size_t packet_end = str.find('$', packet_start);
        if (packet_end != string::npos) {
            // Strips the leading ^ and trailing $ off the packet string
            string stripped_str = str.substr(packet_start + 1, packet_end - packet_start - 1);
            print("Packet stripped string: " + stripped_str);
            for (const string& log_str : Util::split(stripped_str, "$^")) {
                Log log;
                Log::from_string(log_str, log);
                packet.add(log);
            }
        }
    }
}

void Packet::add(const Log& log) {
    logs.push_back(log);
}

vector<Log> Packet::getLogs() {
    return this->logs;
}
