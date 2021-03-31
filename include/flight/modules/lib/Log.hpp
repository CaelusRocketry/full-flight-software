#ifndef FLIGHT_LOG_HPP
#define FLIGHT_LOG_HPP

#include <string>
#include <vector>
#include <chrono>
#include <ArduinoJson.h>

using namespace std;
using ArduinoJson::StaticJsonDocument;

// class Log;

// Log class stores messages to be sent to and from ground and flight station
class Log {
private:
    string header;
    JsonObject message;
    long double timestamp;

public:
    Log() = default;

    Log(const string& header, const JsonObject& message, long double timestamp, bool save = true)
        : header(header),
          message(message),
          timestamp(timestamp) {
        if (save) {
            this->save();
        }
    }

    static void to_string(string &output, const Log& log);
    static void from_json(const JsonObject& j, Log& log);
    void save(const string& filename = "black_box.txt") const;
    Log copy();
    string getHeader() const;
    JsonObject getMessage() const;
    long double getTimestamp() const;
};


#endif //FLIGHT_LOG_HPP
