// #include <flight/modules/lib/logger_util.hpp>
// #include <flight/modules/tasks/TelemetryTask.hpp>
// #include <flight/modules/lib/Util.hpp>

// void TelemetryTask::initialize() {
//     this->telemetry.connect();
// }

// void TelemetryTask::read() {
//     log("Telemetry: Reading");
//     bool status = this->telemetry.get_status();
//     global_registry.telemetry.status = status;

//     if (status) {
//         queue<string> packets = this->telemetry.read(-1);
//         // For packet in packets read from telemetry, push packet to ingest queue
//         const string &h = packets.front();

//         for (const string &packet_string_group = packets.front(); !packets.empty(); packets.pop()) {
//             log("Telemetry: Read packet group: " + packet_string_group);
//             // strip of the "END"s off each packet_string_group string
//             vector<string> split_packets = Util::split(packet_string_group, "END");
//             for (auto packet_string : split_packets) {
//                 if (!packet_string.empty() && packet_string[0] == '{') {
//                     log("Telemetry: Processing packet: " + packet_string);
//                     string processed_packet_string = packet_string;

//                     // get rid of {} in the message field if necessary
//                     if(processed_packet_string.find("\"message\": {") != string::npos) {

//                         int start = processed_packet_string.find("\"message\": {");

//                         if (processed_packet_string.find("\"message\": {}") != string::npos) {
//                             string message_str = "\"message\": {}";
//                             processed_packet_string =
//                                     processed_packet_string.substr(0, start + message_str.length() - 2) + "\"\"" +
//                                     processed_packet_string.substr(start + message_str.length());

//                         } else {
//                             string message_str = "\"message\": ";
//                             int end = processed_packet_string.find(", \"timestamp\"", start) - (start + message_str.length() + 1);
//                             string inside_str = processed_packet_string.substr(start + message_str.length(), end + 1);

//                             inside_str = Util::replaceAll(inside_str, "\"", "\\\"");

//                             processed_packet_string =
//                                     processed_packet_string.substr(0, start + message_str.length()) + "\"" +
//                                     inside_str + "\"" +
//                                     processed_packet_string.substr(start + message_str.length() + end + 1);
//                         }

//                         cout << "Message converted processed packet string: " << processed_packet_string << endl;

//                     }
//                     json packet_json = json::parse(processed_packet_string);
//                     Packet packet;

//                     from_json(packet_json, packet);
//                     global_registry.telemetry.ingest_queue.push(packet);
//                 }
//             }
//         }

//         log("Telemetry: Finished reading packets");
//     }
// }

// void TelemetryTask::actuate() {
//     log("Telemetry: Actuating");
//     if (global_flag.telemetry.reset) {
//         this->telemetry.reset();
//     } else {
//         enqueue();
//         auto& send_queue = global_flag.telemetry.send_queue;

//         // for each packet in the send_queue, write that packet to telemetry
//         for (auto &packet = send_queue.top(); !send_queue.empty(); send_queue.pop()) {
//             this->telemetry.write(packet);
//         }
//     }
// }

// void TelemetryTask::enqueue() {
//     auto &enqueue_queue = global_flag.telemetry.enqueue;

//     // for each packet in the enqueue_queue, push that packet to the send_queue
//     for(auto &packet = enqueue_queue.top(); !enqueue_queue.empty(); enqueue_queue.pop()) {
//         global_flag.telemetry.send_queue.push(packet);
//     }
// }