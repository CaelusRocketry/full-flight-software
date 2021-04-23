#include <flight/modules/lib/logger_util.hpp>
#include <flight/modules/tasks/TelemetryTask.hpp>
#include <flight/modules/lib/Util.hpp>

#include <flight/modules/mcl/Flag.hpp>

void TelemetryTask::initialize() {
    #ifdef DESKTOP
        telemetry = new Telemetry();
    #else 
        // Util::pause(5000);
        // print("\n\n\nYAYAYAYA\n\n\n\n\n\nCONNECTED");
        telemetry = new XBee();
        // print("\n\n\nYAYAYAYA\n\n\n\n\n\nCONNECTED");
    #endif

    telemetry->connect();
}

void TelemetryTask::read() {
    print("Telemetry: Reading");
    bool status = telemetry->get_status();
    global_registry.telemetry.status = status;

    if (status) {
        queue<string> packets = telemetry->read(-1);
        // For packet in packets read from telemetry, push packet to ingest queue
        
        // NOTE: ONLY WORKS FOR XBEE, with "^" and "$" formatting
        for (const string &packet_string = packets.front(); !packets.empty(); packets.pop()) {
            printCritical("TelemetryTask: Read packet group: " + packet_string);
            if (!packet_string.empty() && packet_string[0] == '{') {
                printCritical("TelemetryTask: Processing packet: " + packet_string);
                printCritical("");
                string processed_packet_string = packet_string;

                // get rid of {} in the message field if necessary
                if(processed_packet_string.find("\"message\": {") != string::npos) {
                    // print("TelemetryTask: reformatting packet message: " + processed_packet_string);
                    // print("");
                    printCritical("Reformating");
                    int start = processed_packet_string.find("\"message\": {");

                    if (processed_packet_string.find("\"message\": {}") != string::npos) {
                        string message_str = "\"message\": {}";
                        processed_packet_string =
                                processed_packet_string.substr(0, start + message_str.length() - 2) + "\"\"" +
                                processed_packet_string.substr(start + message_str.length());

                    } else {
                        string message_str = "\"message\": ";
                        int end = processed_packet_string.find(", \"timestamp\"", start) - (start + message_str.length() + 1);
                        string inside_str = processed_packet_string.substr(start + message_str.length(), end + 1);

                        inside_str = Util::replaceAll(inside_str, "\"", "\\\"");

                        processed_packet_string =
                                processed_packet_string.substr(0, start + message_str.length()) + "\"" +
                                inside_str + "\"" +
                                processed_packet_string.substr(start + message_str.length() + end + 1);
                    }
                    // print("TelemetryTask: finished reformatting packet message: " + processed_packet_string);
                    // print("");
                }

                printCritical("Reached here!!");

                Packet pack;
                // print("Hello: " + processed_packet_string);
                JsonObject j;
                try{
                    j = Util::deserialize(processed_packet_string);
                }
                catch (std::exception& e) {
                    printCritical("ERRRRRRRRRRRRRRRRRRRRRRRRRROR:");
                    printCritical(e.what());
                    throw XBEE_READ_ERROR();
                }

                printCritical("Another checkpoint !!");

                string output2;
                Util::serialize(j, output2);
                // print("Telemtask: json string " + output2);
                Packet::from_json(j, pack);

                string output;
                Packet::to_string(output, pack);

                // print("TelemetryTask: packet string " + output);

                global_registry.telemetry.ingest_queue.push(pack);
                }
        }

        print("Telemetry: Finished reading packets");
    }
}

void TelemetryTask::actuate() {
    print("Telemetry: Actuating");
    if (global_flag.telemetry.reset) {
        telemetry->reset();
    } else {
        // print("here 1");
        enqueue();
        // print("here 2");
        auto& send_queue = global_flag.telemetry.send_queue;

        // JsonObject test = doc.to<JsonObject>();
        // test["timestamp"] = 100;
        // global_flag.log_info("test", test);


        // for each packet in the send_queue, write that packet to telemetry
        for (auto &packet = send_queue.top(); !send_queue.empty(); send_queue.pop()) {
            print("Calling telem write method: Writing stuff");
            string output;
            Packet::to_string(output, packet);
            string packet_string = "^" + output + "$";
            telemetry->send_queue.push(packet_string);
        }
        telemetry->write();
        // print("here 3");
    }
}

void TelemetryTask::enqueue() {
    // print("here 1.5");
    auto &enqueue_queue = global_flag.telemetry.enqueue;
    // printCritical("Enqueueing");

    // for each packet in the enqueue_queue, push that packet to the send_queue
    for(auto &packet = enqueue_queue.top(); !enqueue_queue.empty(); enqueue_queue.pop()) {
        // print("here 1.75");
        global_flag.telemetry.send_queue.push(packet);
    }
}
