#include <flight/modules/lib/logger_util.hpp>
#include <flight/modules/tasks/TelemetryTask.hpp>
#include <flight/modules/lib/Util.hpp>
#include <flight/modules/mcl/Flag.hpp>

void TelemetryTask::initialize() {
    #ifdef DESKTOP
        telemetry = new Telemetry();
    #else
        telemetry = new XBee();
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
        for (const string &packet_string = packets.front(); !packets.empty(); packets.pop()) {
            printCritical("TelemetryTask: read packet group: " + packet_string);
            if (!packet_string.empty()) {
                printCritical("TelemetryTask: processing packet: " + packet_string);
                string processed_packet_string = packet_string;

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
        enqueue();
        auto& send_queue = global_flag.telemetry.send_queue;

        // For each packet in the send_queue, write that packet to telemetry
        for (auto &packet = send_queue.top(); !send_queue.empty(); send_queue.pop()) {
            print("Calling telem write method: Writing stuff");
            string output;
            Packet::to_string(output, packet);
            string packet_string = "^" + output + "$";
            telemetry->send_queue.push(packet_string);
        }
        telemetry->write();
    }
}

void TelemetryTask::enqueue() {
    auto &enqueue_queue = global_flag.telemetry.enqueue;
    // For each packet in the enqueue_queue, push that packet to the send_queue
    for(auto &packet = enqueue_queue.top(); !enqueue_queue.empty(); enqueue_queue.pop()) {
        global_flag.telemetry.send_queue.push(packet);
    }
}
