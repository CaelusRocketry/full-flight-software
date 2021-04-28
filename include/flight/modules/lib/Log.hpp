#ifndef FLIGHT_LOG_HPP
#define FLIGHT_LOG_HPP

#include <string>
#include <vector>
#include <flight/modules/lib/Util.hpp>
#include <flight/modules/lib/logger_util.hpp>

#ifdef TEENSY
    // #include <SD_ts.h>
    #include <SD.h>
#endif

using namespace std;
// Log class stores messages to be sent to and from ground and flight station
class Log {
private:
    string header;
    string message;
    long timestamp;

public:
    Log() = default;

    Log(const string& header, long timestamp, const string& message, bool save = true)
        : header(header),
          timestamp(timestamp),
          message(message) {
        if (save) {
            this->save();
        }
    }

    string toString() const;
    static Log from_string(const string& str);
    static string generateChecksum(const string& packet);
    static bool checkChecksum(const string& str, const string& sum);
    // TODO: Get save() to actually work
    void save(const string& filename = "black_box.txt") const;
    Log copy();
    string getHeader() const;
    string getMessage() const;
    long getTimestamp() const;
};

#endif //FLIGHT_LOG_HPP
