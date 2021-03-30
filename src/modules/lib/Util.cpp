#include <flight/modules/lib/Util.hpp>

StaticJsonDocument<5000> Util::doc;

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

void Util::serialize(JsonObject obj, string output){
    serializeJson(obj, output);
}

JsonObject Util::deserialize(string str){
    // Memory allocation
    doc.clear();

    // deserialize the object
    deserializeJson(doc, str);

    // extract the data
    JsonObject object = doc.as<JsonObject>();
    return object;
}

// JsonObject Util::createJsonObject(){
//     StaticJsonDocument<JSON_OBJECT_SIZE(1)> doc;
//     JsonObject obj = doc.to<JsonObject>();
//     return obj;
// }

// string Util::to_string(double val){
//   int temp = i;
//   String ret = "";
//   while (temp > 0) {
//       ret = String('0' + temp % 10) + ret;
//       temp /= 10;
//   }
//   return ret;
// }
