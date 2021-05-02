#include <iostream>
#include <fstream>
#include <flight/modules/lib/Log.hpp>
#include <flight/modules/mcl/Config.hpp>
#include <flight/modules/lib/Util.hpp>
#include <flight/modules/lib/logger_util.hpp>
#include <flight/modules/lib/Errors.hpp>


string Log::toString() const {
    // NOTE: Checksum DOES NOT INCLUDE the last delimiter (before the checksum itself)
    string delim = global_config.telemetry.PACKET_DELIMITER;
    string out = header;
    out += delim + Util::hex(timestamp);
    out += delim + message;
    string checksum = Log::generateChecksum(out);
    out += delim + checksum;
    out = "^" + out + "$";
    return out;
}

Log Log::from_string(const string& str) {
    string delim = global_config.telemetry.PACKET_DELIMITER;
    // Ingests strings that DO NOT have the ^ and $ headers/tails
    if (str.find(delim) == string::npos) { // If the string contains no pipes
        throw INVALID_LOG_ERROR();
    }
    vector<string> sections = Util::split(str, delim); // Split string by pipes
    // Substring the checksum and the packet itself, EXCLUDING final delimiter
    string csum = str.substr(Util::getMaxIndex(str, delim)+1, str.length());
    string log_str = str.substr(0, Util::getMaxIndex(str, delim));
    // If header != 3 chars long or the checksum indicates the Log is corrupted
    if (sections[0].size() != 3 || !(Log::checkChecksum(log_str, csum))) {
        throw INVALID_LOG_ERROR();
    }
    long ts;
    try {
        // Convert string to char* array
        char* char_arr;
        char* end;
        string str_obj(sections[1]);
        char_arr = &str_obj[0];
    // Attempt to cast string to a long
        ts = strtol(char_arr, &end, 10);
    }
    catch (exception& e) {
        print(e.what());
        throw INVALID_LOG_ERROR();
    }
    return Log(sections[0], ts, sections[2]);
}

string Log::generateChecksum(const string& packet) {
    int ascii_sum = 0;
    for (int i = 0; i < packet.length(); i++) {
        ascii_sum += i * (int)(packet[i]);
    }
    // Modulus of 999 restricts the checksum to three digits
    return Util::to_string(ascii_sum % 999);
}

bool Log::checkChecksum(const string& str, const string& sum) {
    if (generateChecksum(str) == sum) {
        return true;
    }
    return false;
}

// TODO: Log string to black_box.txt on SD card currently doesn't compile
void Log::save(const string& filename) const {
    
    // #ifdef DESKTOP
    //     ofstream savefile;
    //     savefile.open(filename);
    //     string output;
    //     to_string(output, *this);
    //     savefile << output + "\n";
    //     savefile.close();
    // #endif

    #ifdef TEENSY
        print("Writing data to SD card.");
        File savefile;
        savefile = SD.open("blackbox.txt", FILE_WRITE);

        if (savefile) // SD card successfully opened
        {
            Serial.println("Saving file!");
            Serial.println((double) timestamp);
            string output = toString();
            
            savefile.println(output.c_str());
            savefile.close();
            Serial.println("Done");
        }
        else {
            Serial.println("Error opening file:");
            Serial.println("blackbox.txt");
        }
    #endif
    
   return;
}

Log Log::copy(){
    // Create a copy of the log
    return Log(header, timestamp, message, false);
}

string Log::getHeader() const {
    return header;
}

string Log::getMessage() const {
    return message;
}

long Log::getTimestamp() const {
    return timestamp;
}
