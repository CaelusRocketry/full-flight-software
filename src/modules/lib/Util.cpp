#include <flight/modules/lib/Util.hpp>

vector<string> Util::split(const string &s, const string &delimiter){
    vector<string> result;
    int start = 0;
    int end = 0;
    while (end != string::npos) {
        end = s.find(delimiter, start);
        result.push_back(s.substr(start, end-start));
        start = end + delimiter.length();
    }
    return result;
}

string Util::replaceAll(string str, const string& from, const string& to) {
    size_t start_pos = 0;
    while((start_pos = str.find(from, start_pos)) != string::npos) {
        str.replace(start_pos, from.length(), to);
        start_pos += to.length(); // Handles case where 'to' is a substring of 'from'
    }
    return str;
}
