#ifndef FLIGHT_LOG_HPP
#define FLIGHT_LOG_HPP

#include <string>
#include <vector>
#include <chrono>
#include <ArduinoJson.h>

using namespace std;

class Log;

void to_string(string &output, const Log& log);
void from_json(const JsonObject& j, Log& log);

// Log class stores messages to be sent to and from ground and flight station
class Log {
private:
    StaticJsonDocument<5000> doc;
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

    void save(const string& filename = "black_box.txt") const;
    Log copy();
    string getHeader() const;
    JsonObject getMessage() const;
    long double getTimestamp() const;
};


#endif //FLIGHT_LOG_HPP
