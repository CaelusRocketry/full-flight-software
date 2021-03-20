#ifndef FLIGHT_UTIL_HPP
#define FLIGHT_UTIL_HPP

#include <iostream>
#include <vector>
#include <map>
#include <flight/modules/lib/logger_util.hpp>
#include <flight/modules/mcl/Flag.hpp>
#include <flight/modules/lib/Log.hpp>
#include <flight/modules/lib/Enums.hpp>
#include <flight/modules/lib/Packet.hpp>
#include <flight/modules/lib/Errors.hpp>

using namespace std;

namespace Util {
    /** Split a string by a delimiter */
    vector<string> split(const string &s, const string &delimiter);

    /** Replace all occurrences of a substring in str with a different string */
    string replaceAll(string str, const string& from, const string& to);
}

#endif // FLIGHT_UTIL_HPP