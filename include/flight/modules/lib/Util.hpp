#ifndef FLIGHT_UTIL_HPP
#define FLIGHT_UTIL_HPP

#include <vector>
#include <cmath>
#include <algorithm>
#include <map>
#include <flight/modules/lib/Enums.hpp>
#include <flight/modules/lib/Errors.hpp>
#include <ArduinoJson.h>

using namespace std;

namespace Util {
    extern StaticJsonDocument<15000> doc;
    extern StaticJsonDocument<15000> doc;

    /** Split a string by a delimiter */
    extern vector<string> split(const string &s, const string &delimiter);

    /** Replace all occurrences of a substring in str with a different string */
    string replaceAll(string str, const string& from, const string& to);

    template<typename T> int getIndex(vector<T> arr, T val);
    int getMaxIndex(string str, string val);

    double min(double a, double b);
    double max(double a, double b);
    /*
    long getMiliTimestampLong(const Flag& flag);
    string getMiliTimestampStr(const Flag& flag);
    template<typename T> string int_to_hex(T num);
    */
    string to_string(bool b);
    string to_string(int i);
    string to_string(long int i);
    string to_string(double d);
    string to_string(long double d);
    long double getTime();
    void pause(int millis);
}

#endif // FLIGHT_UTIL_HPP